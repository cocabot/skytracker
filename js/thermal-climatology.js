// 過去フライト（IGC / GPS）からサーマル発生地点の気候値を蓄積する。
// Reichmann / Bradbury: 尾根・斜面の発生源は日をまたいで繰り返しやすい。
class ThermalClimatology {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'skytracker_thermal_hotspots';
        this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this.cellKm = options.cellKm || 1.6;
        this.maxCells = options.maxCells || 800;
        this.cells = this.load();
        this.ensureCompetitionPriors();
    }

    cellKey(lat, lon) {
        const dlat = this.cellKm / 111.32;
        const row = Math.round(Number(lat) / dlat);
        const cos = Math.max(0.2, Math.cos(Number(lat) * Math.PI / 180));
        const dlon = this.cellKm / (111.32 * cos);
        const col = Math.round(Number(lon) / dlon);
        return `${row}:${col}`;
    }

    load() {
        if (!this.storage) return {};
        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && parsed.cells ? parsed.cells : {};
        } catch (e) {
            return {};
        }
    }

    save() {
        if (!this.storage) return;
        try {
            const keys = Object.keys(this.cells);
            if (keys.length > this.maxCells) {
                const ranked = keys.map((k) => this.cells[k]).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
                const keep = {};
                ranked.slice(0, this.maxCells).forEach((c) => {
                    keep[this.cellKey(c.lat, c.lon)] = c;
                });
                this.cells = keep;
            }
            this.storage.setItem(this.storageKey, JSON.stringify({ cells: this.cells, savedAt: Date.now() }));
        } catch (e) {
            // quota / private mode
        }
    }

    competitionCatalog() {
        if (typeof JhfCompetitionThermals !== 'undefined' && JhfCompetitionThermals.hotspots) {
            return JhfCompetitionThermals.hotspots;
        }
        if (typeof window !== 'undefined' && window.JhfCompetitionThermals) {
            return window.JhfCompetitionThermals.hotspots || [];
        }
        return ThermalClimatology.SITE_PRIORS || [];
    }

    ensureCompetitionPriors() {
        this.competitionCatalog().forEach((p) => {
            const key = this.cellKey(p.lat, p.lon);
            const prev = this.cells[key];
            if (!prev) {
                this.cells[key] = {
                    lat: p.lat,
                    lon: p.lon,
                    hits: p.hits || 2,
                    gain: p.gain || 120,
                    lastAt: 0,
                    source: p.source || 'jhf_hgc',
                    kind: p.kind || 'competition',
                    site: p.site,
                    meanClimb: p.meanClimb
                };
                return;
            }
            if ((prev.source === 'jhf_hgc' || prev.source === 'prior') && (p.hits || 0) > (prev.hits || 0)) {
                prev.hits = p.hits;
                prev.gain = p.gain;
                prev.meanClimb = p.meanClimb;
                prev.site = p.site;
            }
        });
    }

    ingestThermals(thermals) {
        if (!thermals || !thermals.length) return 0;
        let n = 0;
        thermals.forEach((t) => {
            const lat = t.lat != null ? t.lat : t.latitude;
            const lon = t.lon != null ? t.lon : t.longitude;
            if (lat == null || lon == null) return;
            const key = this.cellKey(lat, lon);
            const prev = this.cells[key] || {
                lat, lon, hits: 0, gain: 0, lastAt: 0, source: 'track'
            };
            prev.hits += 1;
            prev.gain += Math.max(0, Number(t.gain) || 0);
            prev.lastAt = Date.now();
            prev.source = 'track';
            prev.lat = (prev.lat * (prev.hits - 1) + lat) / prev.hits;
            prev.lon = (prev.lon * (prev.hits - 1) + lon) / prev.hits;
            this.cells[key] = prev;
            n += 1;
        });
        if (n) this.save();
        return n;
    }

    ingestTrack(trackPoints, extractor) {
        if (!trackPoints || trackPoints.length < 8) return 0;
        let thermals = [];
        if (extractor && typeof extractor.extractLiveThermals === 'function') {
            thermals = extractor.extractLiveThermals(trackPoints);
        } else if (typeof ThermalPredictor !== 'undefined') {
            thermals = new ThermalPredictor().extractLiveThermals(trackPoints);
        }
        return this.ingestThermals(thermals);
    }

    /**
     * 0〜0.28 の地形ブースト。近くの過去上昇が多いほど高い。
     */
    boostAt(lat, lon) {
        if (lat == null || lon == null) return 0;
        let best = 0;
        const keys = Object.keys(this.cells);
        for (let i = 0; i < keys.length; i++) {
            const c = this.cells[keys[i]];
            const d = Geo.distance(lat, lon, c.lat, c.lon);
            if (d > 2800) continue;
            const proximity = 1 - d / 2800;
            const hitTerm = 0.038 * Math.log(1 + (c.hits || 0));
            const gainTerm = 0.03 * Math.min(1, (c.gain || 0) / 20000);
            best = Math.max(best, proximity * (hitTerm + gainTerm));
        }
        return Math.max(0, Math.min(0.28, best));
    }

    nearby(lat, lon, radiusM = 8000) {
        const out = [];
        Object.keys(this.cells).forEach((k) => {
            const c = this.cells[k];
            const d = Geo.distance(lat, lon, c.lat, c.lon);
            if (d <= radiusM) out.push(Object.assign({ distance: d }, c));
        });
        return out.sort((a, b) => a.distance - b.distance);
    }
}

// ウェイポイント由来の仮priorsは使わない。大会ログは jhf-competition-thermals.js。
ThermalClimatology.SITE_PRIORS = [];

if (typeof window !== 'undefined') {
    window.ThermalClimatology = ThermalClimatology;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThermalClimatology };
}
