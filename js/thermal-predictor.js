// サーマル位置・強度の予測
//
// 物理の根拠:
// - Deardorff (1970): 対流速度 w* = [(g/θ) · Qs · zi]^(1/3)
// - Lenschow / RASP DrJack: コア上昇 ≈ 0.7–0.9 w*、Hcrit は PG 沈下を上回る高度
// - Kuettner: クラウドストリート間隔 ≈ 2–3 × 混合層高度、BL 風に沿う
// - Reichmann / Bradbury: 午前は東〜南東斜面、午後は南西〜西。風上斜面がトリガー
// - CAPE は深い湿潤対流の指標であり、ドライ CBL の PG/HG サーマルでは補助
class ThermalPredictor {
    constructor(options = {}) {
        // JHF大会ログ: 朝霧の発生源間隔 p50≈1.1km / p75≈1.7km
        this.minSourceSpacingM = options.minSourceSpacingM || 1600;
        this.maxSources = options.maxSources || 32;
        this.pgSinkMs = options.pgSinkMs || 1.1;
    }

    /**
     * @param {object} snapshot WeatherService.interpret の結果
     * @param {object} elevationGrid {rows, cols, cells:[{lat,lon,elevation,row,col}]}
     * @param {object[]} [liveThermals] 実測サーマル
     * @param {object} [climatology] ThermalClimatology
     */
    predict(snapshot, elevationGrid, liveThermals = [], climatology = null) {
        const aloftIn = (snapshot && snapshot.aloft) || {};
        const current = (snapshot && snapshot.current) || {};
        const localHour = aloftIn.localHour != null
            ? aloftIn.localHour
            : this.localSolarHour(snapshot);
        const aloft = Object.assign({}, aloftIn, { localHour });
        const wind = this.effectiveWind(snapshot);
        const meteo = this.scoreMeteo(aloft, current, wind);

        const cells = (elevationGrid && elevationGrid.cells) || [];
        const rows = (elevationGrid && elevationGrid.rows) || 0;
        const cols = (elevationGrid && elevationGrid.cols) || 0;
        const elevMap = this.buildElevMatrix(cells, rows, cols);
        const solarAz = this.solarAzimuthDeg(localHour);

        const scored = cells.map((cell) => {
            const terrain = this.scoreTerrain(cell, elevMap, rows, cols, wind, solarAz);
            const climateBoost = climatology && typeof climatology.boostAt === 'function'
                ? climatology.boostAt(cell.lat, cell.lon)
                : 0;
            const combined = this.combineScores(meteo, terrain, wind, climateBoost);
            const drift = this.driftOffset(cell, wind, meteo.blh || aloft.blh || 800, combined.climbMs);
            return Object.assign({}, cell, {
                meteoScore: meteo.score,
                terrainScore: terrain.score,
                peak: terrain.peak,
                south: terrain.south,
                aspect: terrain.aspect,
                solar: terrain.solar,
                windward: terrain.windward,
                climateBoost,
                strength: combined.strength,
                climbMs: combined.climbMs,
                maxAlt: combined.maxAlt,
                trigger: combined.trigger,
                driftLat: drift.lat,
                driftLon: drift.lon
            });
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

    localSolarHour(snapshot) {
        const tz = snapshot && snapshot.timezone && snapshot.timezone !== 'auto'
            ? snapshot.timezone
            : 'Asia/Tokyo';
        const t = snapshot && snapshot.hourTime ? snapshot.hourTime : Date.now();
        try {
            const hour = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                hourCycle: 'h23',
                timeZone: tz
            }).format(new Date(t));
            return Number(hour);
        } catch (e) {
            return (new Date(t).getUTCHours() + 9) % 24;
        }
    }

    solarAzimuthDeg(hour) {
        return Geo.normalizeBearing(90 + (Number(hour) - 6) * 15);
    }

    effectiveWind(snapshot) {
        const alt = typeof WeatherService !== 'undefined'
            ? WeatherService.flightWindAltitude(snapshot, null)
            : 1500;
        const interpolated = typeof WindEstimator !== 'undefined'
            ? WindEstimator.windAtAltitude(snapshot, alt)
            : null;
        const w10 = snapshot && snapshot.current && snapshot.current.wind;
        const speed = (interpolated && interpolated.speed) || (w10 && w10.speed) || 0;
        const from = (interpolated && interpolated.from) || (w10 && w10.from) || 0;
        return {
            speed,
            from,
            to: Geo.normalizeBearing(from + 180),
            alt: (interpolated && interpolated.alt) || alt,
            surface: w10 ? Number(w10.speed) || 0 : 0
        };
    }

    /**
     * Deardorff 対流速度 w* と、PG/HG 向けのコア上昇・Hcrit。
     */
    convectiveVelocity(aloft, current) {
        const sw = Number(aloft.shortwave || 0);
        const blh = Math.max(80, Number(aloft.blh || 0));
        const tC = Number(
            aloft.temperature2m != null
                ? aloft.temperature2m
                : (current && current.temperature != null ? current.temperature : 20)
        );
        const theta = tC + 273.15;
        const sm = aloft.soilMoisture;
        const evapFrac = sm != null
            ? Math.max(0.22, Math.min(0.72, 0.22 + Number(sm) * 1.15))
            : 0.38;
        const heatFlux = Math.max(0, (1 - evapFrac) * 0.88 * sw);
        const rho = 1.15;
        const cp = 1006;
        const qs = heatFlux / (rho * cp);
        const wStar = Math.pow(Math.max(0, (9.81 / theta) * qs * blh), 1 / 3);

        const lcl = Number(aloft.lclM || aloft.cloudbaseM || 0);
        const cloud = Number((current && current.cloudCover) || aloft.cloudLow || 0);
        const precip = Number((current && current.precipitation) || aloft.precipitation || 0);
        const cu = cloud >= 12 && cloud <= 72 && precip < 0.25 && lcl > 200 && lcl < blh * 1.2;
        const cloudSuck = cu ? 1.12 : 1;

        // JHF大会GPS上昇の中央値 ≈ 1.2 m/s。気団w*に沈下を含めた係数。
        const coreAirmass = 0.62 * wStar * cloudSuck;
        const w0 = Math.max(0.05, coreAirmass);
        let hcrit = w0 > this.pgSinkMs
            ? blh * Math.max(0.22, 1 - this.pgSinkMs / w0)
            : blh * 0.22;
        hcrit = Math.max(180, Math.min(blh, hcrit));
        if (cu) {
            hcrit = Math.min(blh, Math.max(hcrit, lcl * 0.92));
        } else if (lcl > 250) {
            hcrit = Math.min(hcrit, lcl);
        }

        return {
            wStar,
            heatFlux,
            qs,
            blh,
            lcl,
            coreAirmass,
            hcrit,
            cloudSuck,
            cu
        };
    }

    scoreMeteo(aloft, current, windAloft) {
        const conv = this.convectiveVelocity(aloft || {}, current || {});
        const cape = Number(aloft.cape || 0);
        const li = aloft.liftedIndex;
        const cin = Number(aloft.cin || 0);
        const cloud = Number((current && current.cloudCover) || aloft.cloudLow || 0);
        const precip = Number((current && current.precipitation) || aloft.precipitation || 0);
        const surfaceWind = (current && current.wind && current.wind.speed) || 0;
        const flightWind = (windAloft && windAloft.speed) || surfaceWind;
        const t2 = Number(
            aloft.temperature2m != null
                ? aloft.temperature2m
                : (current && current.temperature) || 20
        );
        const t850 = aloft.temperature850;
        const sw = Number(aloft.shortwave || 0);

        const sunScore = Math.max(0, Math.min(1, sw / 780));
        const wStarScore = Math.max(0, Math.min(1, conv.wStar / 2.8));
        const blhScore = Math.max(0, Math.min(1, (conv.blh - 250) / 2000));

        let lapseScore = 0.5;
        if (t850 != null && Number.isFinite(Number(t850))) {
            const lapse = (t2 - Number(t850)) / 1.46;
            lapseScore = Math.max(0, Math.min(1, (lapse - 5.5) / 5.5));
        } else if (li != null) {
            lapseScore = Math.max(0, Math.min(1, (-Number(li) + 2) / 8));
        }

        let capeScore = Math.max(0, Math.min(1, cape / 1400));
        if (cape > 1800) capeScore *= 0.55;

        let cloudScore = 1;
        if (cloud < 12) cloudScore = 0.88;
        else if (cloud <= 50) cloudScore = 1;
        else if (cloud <= 72) cloudScore = 0.72;
        else cloudScore = 0.22;

        const cinPenalty = Math.max(0, Math.min(0.55, Math.abs(cin) / 180));
        const rainPenalty = precip > 0.15 ? Math.min(0.92, 0.35 + precip / 1.6) : 0;
        const surfacePenalty = surfaceWind > 9 ? Math.min(0.4, (surfaceWind - 9) / 14) : 0;

        // 10m と飛行高度の差の多くは接地境界層。CBL 内シアはその一部。
        const rawShear = Math.abs(flightWind - surfaceWind);
        const blShear = Math.max(0.2, rawShear * 0.28);
        const bOverS = conv.wStar > 0 ? conv.wStar / blShear : 0;
        let bsPenalty = 0;
        if (bOverS < 3) bsPenalty = 0.45;
        else if (bOverS < 5) bsPenalty = 0.22;
        else if (bOverS < 8) bsPenalty = 0.08;

        const orgWind = this.windOrganization(flightWind);

        let score = 0.10 * capeScore + 0.16 * lapseScore + 0.28 * sunScore + 0.28 * wStarScore + 0.10 * blhScore + 0.08 * cloudScore;
        score = score * (1 - cinPenalty) * (1 - rainPenalty) * (1 - surfacePenalty) * (1 - bsPenalty);
        score = Math.max(0, Math.min(1, score));

        const climbMs = Math.max(0, conv.coreAirmass * orgWind * (1 - rainPenalty) * (1 - 0.5 * bsPenalty));
        const maxAlt = conv.hcrit;

        let trigger = 'poor';
        if (score >= 0.70 && climbMs >= 2.0) trigger = 'excellent';
        else if (score >= 0.52 && climbMs >= 1.3) trigger = 'good';
        else if (score >= 0.34 && climbMs >= 0.7) trigger = 'fair';
        else if (score >= 0.16 && climbMs >= 0.35) trigger = 'weak';

        return {
            score,
            climbMs,
            maxAlt,
            trigger,
            cape,
            liftedIndex: li,
            blh: conv.blh,
            lcl: conv.lcl,
            shortwave: sw,
            cin,
            cloud,
            precip,
            wStar: conv.wStar,
            bOverS,
            heatFlux: conv.heatFlux,
            hcrit: conv.hcrit,
            cu: conv.cu
        };
    }

    windOrganization(speed) {
        if (speed >= 2 && speed <= 6.5) return 1;
        if (speed < 2) return 0.88 + speed * 0.06;
        if (speed <= 10) return Math.max(0.62, 1 - (speed - 6.5) / 12);
        return Math.max(0.38, 1 - (speed - 6.5) / 11);
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

    elevAt(elevMap, rows, cols, r, c, fallback) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) return elevMap[r][c];
        return fallback;
    }

    scoreTerrain(cell, elevMap, rows, cols, wind, solarAz) {
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
        const southNeighbor = this.elevAt(elevMap, rows, cols, r + 1, c, e);
        const south = e - southNeighbor;

        const eEast = this.elevAt(elevMap, rows, cols, r, c + 1, e);
        const eWest = this.elevAt(elevMap, rows, cols, r, c - 1, e);
        const eNorth = this.elevAt(elevMap, rows, cols, r - 1, c, e);
        const eSouth = this.elevAt(elevMap, rows, cols, r + 1, c, e);
        const dzdx = eEast - eWest;
        const dzdy = eNorth - eSouth;
        const azUp = Math.atan2(dzdx, dzdy) * 180 / Math.PI;
        const aspect = Geo.normalizeBearing(azUp + 180);
        const slopeMag = Math.abs(dzdx) + Math.abs(dzdy);

        const sunDelta = Geo.wrapDelta(aspect - (solarAz != null ? solarAz : 180));
        const sunAlign = Math.cos(Geo.toRad(sunDelta));
        const solar = slopeMag > 35 ? Math.max(0, sunAlign) : 0.32;

        const windFrom = wind && wind.from != null ? wind.from : 0;
        const windSpeed = wind && wind.speed != null ? wind.speed : 0;
        const windwardAlign = Math.cos(Geo.toRad(Geo.wrapDelta(aspect - windFrom)));
        const windward = slopeMag > 35 ? windwardAlign : 0;

        const peakScore = Math.max(0, Math.min(1, peak / 200));
        const solarScore = solar;
        const windwardScore = Math.max(0, windward);
        const lee = windward < -0.35 && windSpeed > 6 && peak > 220;
        const leePenalty = lee ? Math.min(0.5, (windSpeed - 6) / 14) : 0;
        const elevScore = Math.max(0, Math.min(0.35, e / 2800));
        const southScore = Math.max(0, Math.min(1, south / 140));

        let score = Math.min(1,
            0.38 * peakScore +
            0.28 * solarScore +
            0.16 * windwardScore +
            0.10 * southScore +
            0.08 * elevScore
        );
        score = Math.max(0, score * (1 - leePenalty));

        return { score, peak, south, aspect, solar, windward, lee };
    }

    combineScores(meteo, terrain, wind, climateBoost) {
        const windOrg = this.windOrganization(wind && wind.speed != null ? wind.speed : 0);
        const climate = Math.max(0, Math.min(0.28, climateBoost || 0));
        const terrainMix = 0.42 + 0.58 * terrain.score;
        const strength = Math.max(0, Math.min(1,
            0.70 * meteo.score + 0.22 * terrainMix * Math.max(meteo.score, 0.18) + 0.08 * climate
        ));
        const climbMs = Math.min(3.4, Math.max(0, meteo.climbMs * (0.78 + 0.32 * terrain.score) * (1 + climate) * (0.92 + 0.08 * windOrg)));
        const maxAlt = meteo.maxAlt * (0.88 + 0.14 * terrain.score);
        let trigger = meteo.trigger;
        if (terrain.score > 0.5 && meteo.score >= 0.22 && trigger === 'weak') trigger = 'fair';
        if (climbMs < 0.35 && trigger !== 'poor') trigger = 'weak';
        return { strength, climbMs, maxAlt, trigger };
    }

    driftOffset(cell, wind, blh, climbMs) {
        const climb = Math.max(0.55, climbMs);
        const timeToCloudbase = Math.min(1800, (Math.max(300, blh) * 0.55) / climb);
        const driftM = wind.speed * timeToCloudbase * 0.65;
        return Geo.destination(cell.lat, cell.lon, wind.to, driftM);
    }

    pickSources(cells, wind, liveThermals) {
        const ranked = cells.slice().sort((a, b) => b.climbMs - a.climbMs);
        const sources = [];
        const minClimb = 0.4;
        const relativeCut = ranked.length ? ranked[0].climbMs * 0.38 : 0;

        for (let i = 0; i < ranked.length; i++) {
            const cell = ranked[i];
            if (cell.climbMs < minClimb && sources.length >= 6) break;
            if (cell.climbMs < Math.max(minClimb, relativeCut) && sources.length >= 10) break;
            const tooClose = sources.some((s) => Geo.distancePts(s, cell) < this.minSourceSpacingM);
            if (tooClose) continue;
            let kind = 'surface';
            if (cell.peak > 50) kind = 'ridge';
            else if (cell.solar > 0.55 && cell.south > 20) kind = 'sun_slope';
            else if (cell.windward > 0.45) kind = 'windward';
            else if (cell.climateBoost > 0.08) kind = 'climatology';
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
                kind,
                source: 'forecast'
            });
            if (sources.length >= this.maxSources) break;
        }

        for (let i = liveThermals.length - 1; i >= 0; i--) {
            const live = liveThermals[i];
            sources.unshift({
                lat: live.lat,
                lon: live.lon,
                driftLat: live.lat,
                driftLon: live.lon,
                climbMs: live.strength || live.climbMs || 2,
                strength: Math.min(1, (live.strength || live.climbMs || 2) / 4),
                maxAlt: live.maxAlt || 1500,
                kind: 'live',
                source: live.source || 'gps',
                gain: live.gain
            });
        }

        return sources;
    }

    buildCloudStreets(cells, wind, aloft, meteo) {
        if (wind.speed < 3.5 || wind.speed > 12 || meteo.score < 0.28 || (meteo.wStar || 0) < 0.9) {
            return [];
        }
        const blh = aloft.blh || meteo.blh || 800;
        const spacing = Math.max(1800, Math.min(9000, blh * 2.7));
        const streets = [];
        const used = new Set();

        const strong = cells.filter((c) => c.climbMs >= 0.9).sort((a, b) => b.climbMs - a.climbMs);
        for (let i = 0; i < strong.length; i++) {
            const cell = strong[i];
            const key = `${cell.row}:${cell.col}`;
            if (used.has(key)) continue;

            const along = [];
            for (let j = 0; j < cells.length; j++) {
                const other = cells[j];
                const brg = Geo.bearingPts(cell, other);
                const delta = Math.abs(Geo.wrapDelta(brg - wind.to));
                const aligned = delta < 14 || Math.abs(delta - 180) < 14;
                if (aligned && Geo.distancePts(cell, other) < spacing * 4 && other.climbMs >= 0.7) {
                    along.push(other);
                    used.add(`${other.row}:${other.col}`);
                }
            }
            if (along.length >= 3) {
                const proj = (p) => {
                    const d = Geo.distancePts(cell, p);
                    const brg = Geo.bearingPts(cell, p);
                    const sign = Math.cos(Geo.toRad(Geo.wrapDelta(brg - wind.to))) >= 0 ? 1 : -1;
                    return sign * d;
                };
                along.sort((a, b) => proj(a) - proj(b));
                streets.push({
                    points: along.map((p) => ({ lat: p.lat, lon: p.lon })),
                    spacing,
                    climbMs: along.reduce((s, c) => s + c.climbMs, 0) / along.length
                });
            }
            if (streets.length >= 8) break;
        }
        return streets;
    }

    normalizeTrack(trackPoints) {
        const out = [];
        for (let i = 0; i < trackPoints.length; i++) {
            const p = trackPoints[i];
            const lat = p.lat != null ? p.lat : p.latitude;
            const lon = p.lon != null ? p.lon : p.longitude;
            const alt = p.alt != null ? p.alt : p.altitude;
            const t = p.time != null
                ? Number(p.time)
                : (p.timestamp != null ? new Date(p.timestamp).getTime() : 0);
            let vario = p.vario;
            let heading = p.heading;
            if (i > 0) {
                const prev = out[i - 1];
                const dt = Math.max(0.4, (t - prev.time) / 1000);
                if (!(vario != null && Number.isFinite(Number(vario)))) {
                    vario = (alt - prev.alt) / dt;
                }
                if (!(heading != null && Number.isFinite(Number(heading)))) {
                    heading = Geo.bearing(prev.lat, prev.lon, lat, lon);
                }
            }
            out.push({
                lat,
                lon,
                alt: Number(alt) || 0,
                time: t,
                vario: Number(vario) || 0,
                heading: Number(heading) || 0
            });
        }
        for (let i = 0; i < out.length; i++) {
            const a = out[Math.max(0, i - 2)];
            const b = out[i];
            const c = out[Math.min(out.length - 1, i + 2)];
            b.smoothVario = (a.vario + b.vario + c.vario) / 3;
        }
        return out;
    }

    /**
     * トラックから実測サーマル（持続上昇、可能なら旋回）を抽出する。
     * IGC は vario が無いことが多いので高度差から復元する。
     */
    extractLiveThermals(trackPoints) {
        if (!trackPoints || trackPoints.length < 8) return [];
        const pts = this.normalizeTrack(trackPoints);
        const thermals = [];
        let current = null;

        const flush = () => {
            if (!current) return;
            const seg = current.points;
            const gain = seg[seg.length - 1].alt - seg[0].alt;
            const dt = (seg[seg.length - 1].time - seg[0].time) / 1000;
            const mean = current.sumVario / seg.length;
            if (seg.length >= 6 && gain >= 50 && dt >= 20 && (mean >= 0.5 || current.maxVario >= 0.8)) {
                thermals.push(this.summarizeLive(current));
            }
            current = null;
        };

        for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            const vario = p.smoothVario != null ? p.smoothVario : p.vario;
            if (vario >= 0.45) {
                if (!current) {
                    current = { points: [p], maxVario: vario, sumVario: vario, turn: 0 };
                } else {
                    current.points.push(p);
                    current.maxVario = Math.max(current.maxVario, vario);
                    current.sumVario += vario;
                    current.turn += Geo.wrapDelta(p.heading - pts[i - 1].heading);
                }
            } else {
                flush();
            }
        }
        flush();
        return thermals.slice(-12);
    }

    summarizeLive(current) {
        const pts = current.points;
        const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
        const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
        const gain = pts[pts.length - 1].alt - pts[0].alt;
        const dt = Math.max(1, (pts[pts.length - 1].time - pts[0].time) / 1000);
        const mean = current.sumVario / pts.length;
        return {
            lat,
            lon,
            climbMs: Math.max(mean, current.maxVario * 0.85),
            strength: Math.max(mean, current.maxVario * 0.85),
            gain,
            duration: dt,
            circling: Math.abs(current.turn || 0) > 180,
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
        for (let i = 0; i < recent.length; i++) {
            const p = recent[i];
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
