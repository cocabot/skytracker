// サーマル位置・強度の予測
// 気象モデル（CAPE / LI / 日射 / 混合層高度）+ 地形（尾根・南斜面）+ 風によるドリフト
class ThermalPredictor {
    constructor(options = {}) {
        this.minSourceSpacingM = options.minSourceSpacingM || 1200;
    }

    /**
     * @param {object} snapshot WeatherService.interpret の結果
     * @param {object} elevationGrid {rows, cols, cells:[{lat,lon,elevation,row,col}]}
     * @param {object} [liveThermals] 実測サーマル [{lat,lon,strength,source}]
     */
    predict(snapshot, elevationGrid, liveThermals = []) {
        const aloft = (snapshot && snapshot.aloft) || {};
        const current = (snapshot && snapshot.current) || {};
        const wind = this.effectiveWind(snapshot);
        const meteo = this.scoreMeteo(aloft, current);

        const cells = (elevationGrid && elevationGrid.cells) || [];
        const rows = (elevationGrid && elevationGrid.rows) || 0;
        const cols = (elevationGrid && elevationGrid.cols) || 0;
        const elevMap = this.buildElevMatrix(cells, rows, cols);

        const scored = cells.map((cell) => {
            const terrain = this.scoreTerrain(cell, elevMap, rows, cols);
            const combined = this.combineScores(meteo, terrain, wind);
            const drift = this.driftOffset(cell, wind, aloft.blh || 800, combined.climbMs);
            return {
                ...cell,
                meteoScore: meteo.score,
                terrainScore: terrain.score,
                peak: terrain.peak,
                south: terrain.south,
                strength: combined.strength,
                climbMs: combined.climbMs,
                maxAlt: combined.maxAlt,
                trigger: combined.trigger,
                driftLat: drift.lat,
                driftLon: drift.lon
            };
        });

        const sources = this.pickSources(scored, wind, liveThermals);
        const streets = this.buildCloudStreets(scored, wind, aloft, meteo);

        return {
            meteo,
            wind,
            cells: scored,
            sources,
            streets,
            liveThermals,
            generatedAt: new Date().toISOString()
        };
    }

    effectiveWind(snapshot) {
        const w80 = snapshot && snapshot.aloft && snapshot.aloft.levels
            ? snapshot.aloft.levels.find((l) => l.alt >= 80) || snapshot.aloft.levels[0]
            : null;
        const w10 = snapshot && snapshot.current && snapshot.current.wind;
        const speed = (w80 && w80.speed) || (w10 && w10.speed) || 0;
        const from = (w80 && w80.from) || (w10 && w10.from) || 0;
        return { speed, from, to: Geo.normalizeBearing(from + 180) };
    }

    scoreMeteo(aloft, current) {
        const cape = Number(aloft.cape || 0);
        const li = aloft.liftedIndex;
        const blh = Number(aloft.blh || 0);
        const sw = Number(aloft.shortwave || 0);
        const cin = Number(aloft.cin || 0);
        const cloud = Number((current && current.cloudCover) || aloft.cloudLow || 0);
        const precip = Number((current && current.precipitation) || aloft.precipitation || 0);
        const windSpeed = (current && current.wind && current.wind.speed) || 0;

        let capeScore = Math.max(0, Math.min(1, cape / 900));
        let liScore = 0.45;
        if (li != null) {
            liScore = Math.max(0, Math.min(1, (-li + 2) / 8));
        }
        const sunScore = Math.max(0, Math.min(1, sw / 750));
        const blhScore = Math.max(0, Math.min(1, (blh - 300) / 1800));

        let cloudScore = 1;
        if (cloud < 15) cloudScore = 0.85;
        else if (cloud <= 45) cloudScore = 1;
        else if (cloud <= 70) cloudScore = 0.7;
        else cloudScore = 0.25;

        const cinPenalty = Math.max(0, Math.min(0.6, Math.abs(cin) / 200));
        const rainPenalty = precip > 0.2 ? Math.min(0.8, precip / 2) : 0;
        const windPenalty = windSpeed > 8 ? Math.min(0.5, (windSpeed - 8) / 12) : 0;

        let score = 0.28 * capeScore + 0.18 * liScore + 0.28 * sunScore + 0.18 * blhScore + 0.08 * cloudScore;
        score = score * (1 - cinPenalty) * (1 - rainPenalty) * (1 - windPenalty);
        score = Math.max(0, Math.min(1, score));

        const climbMs = score * 4.2;
        const maxAlt = Math.max(400, blh * (0.55 + 0.45 * score));
        let trigger = 'poor';
        if (score >= 0.72) trigger = 'excellent';
        else if (score >= 0.55) trigger = 'good';
        else if (score >= 0.35) trigger = 'fair';
        else if (score >= 0.18) trigger = 'weak';

        return {
            score,
            climbMs,
            maxAlt,
            trigger,
            cape,
            liftedIndex: li,
            blh,
            shortwave: sw,
            cin,
            cloud,
            precip
        };
    }

    buildElevMatrix(cells, rows, cols) {
        const m = [];
        for (let r = 0; r < rows; r++) {
            m[r] = [];
            for (let c = 0; c < cols; c++) {
                const cell = cells[r * cols + c];
                m[r][c] = cell ? cell.elevation : 0;
            }
        }
        return m;
    }

    scoreTerrain(cell, elevMap, rows, cols) {
        const r = cell.row;
        const c = cell.col;
        const e = cell.elevation || 0;
        const neighbors = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const rr = r + dr;
                const cc = c + dc;
                if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
                    neighbors.push(elevMap[rr][cc]);
                }
            }
        }
        const avg = neighbors.length ? neighbors.reduce((s, v) => s + v, 0) / neighbors.length : e;
        const peak = e - avg;

        const south = (r + 1 < rows) ? e - elevMap[r + 1][c] : 0;
        const peakScore = Math.max(0, Math.min(1, peak / 180));
        const southScore = Math.max(0, Math.min(1, south / 120));
        const elevScore = Math.max(0, Math.min(0.4, e / 2500));
        const score = Math.min(1, 0.55 * peakScore + 0.35 * southScore + 0.1 * elevScore);

        return { score, peak, south };
    }

    combineScores(meteo, terrain, wind) {
        const windOrg = wind.speed >= 2 && wind.speed <= 8 ? 1 : (wind.speed < 2 ? 0.85 : Math.max(0.4, 1 - (wind.speed - 8) / 10));
        const terrainMix = 0.35 + 0.65 * terrain.score;
        const strength = Math.max(0, Math.min(1, 0.74 * meteo.score + 0.26 * terrainMix * Math.max(meteo.score, 0.25)));
        const climbMs = Math.max(0, strength * 4.6 * windOrg);
        const maxAlt = meteo.maxAlt * (0.85 + 0.15 * terrain.score);
        let trigger = meteo.trigger;
        if (terrain.score > 0.45 && meteo.score >= 0.25 && trigger === 'weak') trigger = 'fair';
        return { strength, climbMs, maxAlt, trigger };
    }

    driftOffset(cell, wind, blh, climbMs) {
        const climb = Math.max(0.6, climbMs);
        const timeToCloudbase = Math.min(1800, (blh * 0.6) / climb);
        const driftM = wind.speed * timeToCloudbase * 0.7;
        const p = Geo.destination(cell.lat, cell.lon, wind.to, driftM);
        return p;
    }

    pickSources(cells, wind, liveThermals) {
        const ranked = [...cells].sort((a, b) => b.climbMs - a.climbMs);
        const sources = [];
        const minClimb = 0.7;

        for (const cell of ranked) {
            if (cell.climbMs < minClimb) break;
            const tooClose = sources.some((s) => Geo.distancePts(s, cell) < this.minSourceSpacingM);
            if (tooClose) continue;
            sources.push({
                lat: cell.lat,
                lon: cell.lon,
                driftLat: cell.driftLat,
                driftLon: cell.driftLon,
                climbMs: cell.climbMs,
                strength: cell.strength,
                maxAlt: cell.maxAlt,
                peak: cell.peak,
                south: cell.south,
                kind: cell.peak > 40 ? 'ridge' : (cell.south > 30 ? 'south_slope' : 'surface'),
                source: 'forecast'
            });
            if (sources.length >= 18) break;
        }

        for (const live of liveThermals) {
            sources.unshift({
                lat: live.lat,
                lon: live.lon,
                driftLat: live.lat,
                driftLon: live.lon,
                climbMs: live.strength || live.climbMs || 2,
                strength: Math.min(1, (live.strength || 2) / 4),
                maxAlt: live.maxAlt || 1500,
                kind: 'live',
                source: live.source || 'gps'
            });
        }

        return sources;
    }

    buildCloudStreets(cells, wind, aloft, meteo) {
        if (wind.speed < 3 || wind.speed > 12 || meteo.score < 0.35) {
            return [];
        }
        const blh = aloft.blh || 800;
        const spacing = Math.max(1500, Math.min(5000, blh * 2.4));
        const streets = [];
        const used = new Set();

        const strong = cells.filter((c) => c.climbMs >= 1.2).sort((a, b) => b.climbMs - a.climbMs);
        for (const cell of strong) {
            const key = `${cell.row}:${cell.col}`;
            if (used.has(key)) continue;

            const along = [];
            for (const other of cells) {
                const brg = Geo.bearingPts(cell, other);
                const delta = Math.abs(Geo.wrapDelta(brg - wind.to));
                const aligned = delta < 12 || Math.abs(delta - 180) < 12;
                if (aligned && Geo.distancePts(cell, other) < spacing * 4 && other.climbMs >= 0.9) {
                    along.push(other);
                    used.add(`${other.row}:${other.col}`);
                }
            }
            if (along.length >= 3) {
                along.sort((a, b) => Geo.bearingPts(cell, a) === undefined ? 0 : a.lat - b.lat);
                const pts = along
                    .sort((a, b) => (a.lat - b.lat) * Math.cos(Geo.toRad(wind.to)) + (a.lon - b.lon) * Math.sin(Geo.toRad(wind.to)))
                    .map((p) => ({ lat: p.lat, lon: p.lon }));
                streets.push({
                    points: pts,
                    spacing,
                    climbMs: along.reduce((s, c) => s + c.climbMs, 0) / along.length
                });
            }
            if (streets.length >= 6) break;
        }
        return streets;
    }

    /**
     * トラックから実測サーマル（上昇＋旋回）を抽出する。
     */
    extractLiveThermals(trackPoints) {
        if (!trackPoints || trackPoints.length < 8) return [];
        const thermals = [];
        let current = null;

        for (let i = 1; i < trackPoints.length; i++) {
            const p = trackPoints[i];
            const vario = p.vario || 0;
            if (vario >= 0.6) {
                if (!current) {
                    current = { points: [p], maxVario: vario };
                } else {
                    current.points.push(p);
                    current.maxVario = Math.max(current.maxVario, vario);
                }
            } else if (current) {
                if (current.points.length >= 6 && current.maxVario >= 0.8) {
                    thermals.push(this.summarizeLive(current));
                }
                current = null;
            }
        }
        if (current && current.points.length >= 6) {
            thermals.push(this.summarizeLive(current));
        }
        return thermals.slice(-8);
    }

    summarizeLive(current) {
        const pts = current.points;
        const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
        const lon = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
        const gain = pts[pts.length - 1].altitude - pts[0].altitude;
        return {
            lat,
            lon,
            climbMs: current.maxVario,
            strength: current.maxVario,
            gain,
            source: 'track',
            kind: 'live'
        };
    }

    /**
     * 旋回中のサーマルコア推定（XCTrack サーマルアシスタント相当）。
     */
    estimateCore(trackPoints, windowSeconds = 45) {
        if (!trackPoints || trackPoints.length < 6) return null;
        const last = trackPoints[trackPoints.length - 1];
        const cutoff = new Date(last.timestamp).getTime() - windowSeconds * 1000;
        const recent = trackPoints.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
        if (recent.length < 6) return null;

        let turn = 0;
        for (let i = 1; i < recent.length; i++) {
            const h0 = recent[i - 1].heading || 0;
            const h1 = recent[i].heading || 0;
            turn += Geo.wrapDelta(h1 - h0);
        }
        if (Math.abs(turn) < 220) return null;

        const lat = recent.reduce((s, p) => s + p.latitude, 0) / recent.length;
        const lon = recent.reduce((s, p) => s + p.longitude, 0) / recent.length;
        const avgVario = recent.reduce((s, p) => s + (p.vario || 0), 0) / recent.length;

        let best = recent[0];
        for (const p of recent) {
            if ((p.vario || 0) > (best.vario || 0)) best = p;
        }

        return {
            lat,
            lon,
            coreLat: best.latitude,
            coreLon: best.longitude,
            climbMs: Math.max(avgVario, best.vario || 0),
            turnDeg: turn,
            circling: true
        };
    }
}

if (typeof window !== 'undefined') {
    window.ThermalPredictor = ThermalPredictor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThermalPredictor };
}
