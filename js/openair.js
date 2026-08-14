// OpenAir 空域パーサ（AC/AN/AH/AL/DP/DC/V X=）
class OpenAirParser {
    static parse(text) {
        const lines = String(text).split(/\r?\n/);
        const zones = [];
        let cur = null;
        let center = null;
        let arcDir = '+';

        const flush = () => {
            if (cur && ((cur.points && cur.points.length >= 3) || (cur.circle && cur.circle.radiusM > 0))) {
                zones.push(cur);
            }
            cur = null;
            center = null;
            arcDir = '+';
        };

        for (let raw of lines) {
            const line = raw.replace(/^\s+/, '');
            if (!line || line.startsWith('*') || line.startsWith('#')) continue;
            const cmd = line.slice(0, 2).toUpperCase();
            const rest = line.slice(2).trim().replace(/^[=:\s]+/, '');

            if (cmd === 'AC') {
                flush();
                cur = {
                    class: rest.toUpperCase(),
                    name: rest,
                    floor: { raw: 'SFC', meters: 0 },
                    ceiling: { raw: 'UNL', meters: 20000 },
                    points: [],
                    circle: null
                };
                continue;
            }
            if (!cur) continue;

            if (cmd === 'AN') {
                cur.name = rest;
            } else if (cmd === 'AH') {
                cur.ceiling = OpenAirParser.parseAltitude(rest);
            } else if (cmd === 'AL') {
                cur.floor = OpenAirParser.parseAltitude(rest);
            } else if (cmd === 'DP') {
                const p = OpenAirParser.parseLatLon(rest);
                if (p) cur.points.push(p);
            } else if (cmd === 'DC') {
                const nm = parseFloat(rest);
                if (center && Number.isFinite(nm)) {
                    cur.circle = {
                        lat: center.lat,
                        lon: center.lon,
                        radiusM: nm * 1852
                    };
                }
            } else if (cmd === 'V ') {
                const v = line.slice(1).trim();
                if (/^X=/i.test(v)) {
                    center = OpenAirParser.parseLatLon(v.slice(2));
                } else if (/^D=/i.test(v)) {
                    arcDir = v.slice(2).trim();
                }
            } else if (line.toUpperCase().startsWith('V')) {
                const v = line.slice(1).trim();
                if (/^X=/i.test(v)) {
                    center = OpenAirParser.parseLatLon(v.slice(2));
                } else if (/^D=/i.test(v)) {
                    arcDir = v.slice(2).trim();
                }
            }
        }
        flush();
        return zones.map((z) => ({
            ...z,
            type: OpenAirParser.classType(z.class),
            warning: OpenAirParser.classWarning(z.class)
        }));
    }

    static parseAltitude(raw) {
        const s = String(raw || '').trim().toUpperCase();
        if (!s || s === 'SFC' || s === 'GND' || s === 'GROUND') {
            return { raw: s || 'SFC', meters: 0 };
        }
        if (s === 'UNL' || s === 'UNLIMITED') {
            return { raw: s, meters: 20000 };
        }
        const fl = s.match(/^FL\s*(\d+)/);
        if (fl) {
            return { raw: s, meters: Number(fl[1]) * 100 * 0.3048 };
        }
        const m = s.match(/([\d.]+)\s*(FT|M)?/);
        if (m) {
            const n = Number(m[1]);
            const unit = m[2] || (s.includes('FT') ? 'FT' : 'M');
            return { raw: s, meters: unit === 'FT' ? n * 0.3048 : n };
        }
        return { raw: s, meters: 0 };
    }

    static parseLatLon(text) {
        const s = String(text || '').trim();
        const compact = s.match(/(\d{2,4})(\d{2})(\d{2}(?:\.\d+)?)([NS])\s+(\d{2,5})(\d{2})(\d{2}(?:\.\d+)?)([EW])/i);
        if (compact) {
            const lat = OpenAirParser.dms(compact[1], compact[2], compact[3], compact[4]);
            const lon = OpenAirParser.dms(compact[5], compact[6], compact[7], compact[8]);
            return { lat, lon };
        }
        const spaced = s.match(
            /(\d{1,2})\s*[:\s]\s*(\d{1,2})(?:\s*[:\s]\s*([\d.]+))?\s*([NS])\s+(\d{1,3})\s*[:\s]\s*(\d{1,2})(?:\s*[:\s]\s*([\d.]+))?\s*([EW])/i
        );
        if (spaced) {
            const lat = OpenAirParser.dms(spaced[1], spaced[2], spaced[3] || 0, spaced[4]);
            const lon = OpenAirParser.dms(spaced[5], spaced[6], spaced[7] || 0, spaced[8]);
            return { lat, lon };
        }
        return null;
    }

    static dms(d, m, s, hemi) {
        let dec = Number(d) + Number(m) / 60 + Number(s) / 3600;
        const h = String(hemi).toUpperCase();
        if (h === 'S' || h === 'W') dec = -dec;
        return dec;
    }

    static classType(ac) {
        const c = String(ac || '').toUpperCase();
        if (c === 'P' || c === 'R') return 'restricted';
        if (c === 'Q') return 'danger';
        if (c === 'CTR' || c === 'C' || c === 'B' || c === 'A' || c === 'D') return 'airport_control';
        if (c === 'GP' || c === 'W') return 'gliding';
        if (c === 'TMZ' || c === 'RMZ') return 'radio';
        return 'other';
    }

    static classWarning(ac) {
        const map = {
            P: '禁止空域。進入できません',
            R: '制限空域。許可なく進入しないでください',
            Q: '危険空域。通過注意',
            CTR: '管制圏。許可が必要です',
            C: 'クラスC。管制機関との交信が必要です',
            D: 'クラスD / 危険空域。注意して通過',
            GP: 'グライダー空域',
            W: 'ウェイブウィンドウ',
            TMZ: 'トランスポンダ必須空域',
            RMZ: '無線必携空域'
        };
        return map[String(ac || '').toUpperCase()] || '空域情報を確認してください';
    }

    static color(type) {
        const colors = {
            airport_control: '#ef4444',
            military: '#f59e0b',
            restricted: '#dc2626',
            danger: '#991b1b',
            gliding: '#2563eb',
            radio: '#7c3aed',
            other: '#64748b'
        };
        return colors[type] || '#64748b';
    }

    static pointInPolygon(lat, lon, points) {
        if (!points || points.length < 3) return false;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const yi = points[i].lat;
            const xi = points[i].lon;
            const yj = points[j].lat;
            const xj = points[j].lon;
            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    static distanceToZone(lat, lon, zone) {
        if (zone.circle) {
            const d = Geo.distance(lat, lon, zone.circle.lat, zone.circle.lon);
            return d - zone.circle.radiusM;
        }
        if (OpenAirParser.pointInPolygon(lat, lon, zone.points)) return -1;
        let min = Infinity;
        for (const p of zone.points || []) {
            min = Math.min(min, Geo.distance(lat, lon, p.lat, p.lon));
        }
        return min;
    }

    static relevantAtAltitude(zone, altM) {
        const floor = zone.floor && zone.floor.meters != null ? zone.floor.meters : 0;
        const ceil = zone.ceiling && zone.ceiling.meters != null ? zone.ceiling.meters : 20000;
        if (!Number.isFinite(altM)) return true;
        return altM + 80 >= floor && altM - 80 <= ceil;
    }
}

if (typeof window !== 'undefined') {
    window.OpenAirParser = OpenAirParser;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpenAirParser };
}
