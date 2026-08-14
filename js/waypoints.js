// ウェイポイントライブラリ（CUP / GPX）。タスク化はしない。
class WaypointLibrary {
    constructor() {
        this.waypoints = [];
        this.selected = new Set();
    }

    clear() {
        this.waypoints = [];
        this.selected.clear();
    }

    addMany(list) {
        const existing = new Set(this.waypoints.map((w) => `${w.name}|${w.lat.toFixed(5)}|${w.lon.toFixed(5)}`));
        for (const wp of list || []) {
            if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lon)) continue;
            const key = `${wp.name}|${wp.lat.toFixed(5)}|${wp.lon.toFixed(5)}`;
            if (existing.has(key)) continue;
            existing.add(key);
            this.waypoints.push({
                id: wp.id || `wp-${this.waypoints.length + 1}`,
                name: wp.name || `WP${this.waypoints.length + 1}`,
                code: wp.code || '',
                lat: wp.lat,
                lon: wp.lon,
                altitude: wp.altitude || 0,
                comment: wp.comment || ''
            });
        }
        return this.waypoints;
    }

    toggleSelected(index) {
        if (this.selected.has(index)) this.selected.delete(index);
        else this.selected.add(index);
        return this.selected.has(index);
    }

    selectedWaypoints() {
        return [...this.selected].sort((a, b) => a - b).map((i) => this.waypoints[i]).filter(Boolean);
    }

    /**
     * CIVL Sporting Code S7 系の一般的な円筒：TK 400 / SSS 1000 EXIT / TP 400 / ESS 1000 / GOAL 400
     */
    toRaceTask(waypoints, name) {
        const wps = waypoints || this.selectedWaypoints();
        if (!wps || wps.length < 2) {
            throw new Error('タスクにはウェイポイントが2点以上必要です');
        }
        const turnpoints = wps.map((wp, i) => {
            let type = 'TURNPOINT';
            let radius = 400;
            if (i === 0) {
                type = 'TAKEOFF';
                radius = 400;
            } else if (i === 1) {
                type = 'SSS';
                radius = 1000;
            } else if (i === wps.length - 1) {
                type = 'GOAL';
                radius = 400;
            } else if (wps.length >= 4 && i === wps.length - 2) {
                type = 'ESS';
                radius = 1000;
            }
            return {
                name: wp.name,
                lat: wp.lat,
                lon: wp.lon,
                altitude: wp.altitude || 0,
                radius,
                type
            };
        });
        return {
            name: name || 'ウェイポイントタスク',
            taskType: 'RACE',
            turnpoints,
            sss: { direction: 'EXIT', timeGates: [] },
            goal: { type: 'CYLINDER' }
        };
    }

    static parseAuto(text, filename = '') {
        const name = String(filename).toLowerCase();
        const trimmed = String(text).trim();
        if (name.endsWith('.gpx') || trimmed.includes('<gpx') || trimmed.includes('<wpt')) {
            return WaypointLibrary.parseGpx(trimmed);
        }
        return WaypointLibrary.parseCup(trimmed);
    }

    static parseCup(text) {
        const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const waypoints = [];
        for (const line of lines) {
            if (line.startsWith('-----')) break;
            if (line.toLowerCase().startsWith('name,')) continue;
            const wp = typeof TaskEngine !== 'undefined'
                ? TaskEngine.parseCupWaypoint(line)
                : WaypointLibrary.parseCupWaypoint(line);
            if (wp) waypoints.push(wp);
        }
        if (waypoints.length === 0) {
            throw new Error('CUP にウェイポイントがありません');
        }
        return waypoints;
    }

    static parseCupWaypoint(line) {
        const parts = WaypointLibrary.splitCsv(line);
        if (parts.length < 6) return null;
        const lat = WaypointLibrary.parseCupCoord(parts[3], true);
        const lon = WaypointLibrary.parseCupCoord(parts[4], false);
        if (lat == null || lon == null) return null;
        const elev = parseFloat(String(parts[5]).replace(/[mft]/ig, '')) || 0;
        return {
            name: parts[0].replace(/"/g, '') || parts[1],
            code: parts[1],
            lat,
            lon,
            altitude: elev,
            comment: parts[10] || ''
        };
    }

    static parseCupCoord(value, isLat) {
        if (typeof TaskEngine !== 'undefined' && TaskEngine.parseCupCoord) {
            return TaskEngine.parseCupCoord(value, isLat);
        }
        if (!value) return null;
        const s = String(value).trim().toUpperCase();
        const m = s.match(/^(\d+)(\d\d\.\d+)([NSEW])$/);
        if (!m) {
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        }
        let dec = parseInt(m[1], 10) + parseFloat(m[2]) / 60;
        if (m[3] === 'S' || m[3] === 'W') dec = -dec;
        if (isLat && Math.abs(dec) > 90) return null;
        return dec;
    }

    static splitCsv(line) {
        if (typeof TaskEngine !== 'undefined' && TaskEngine.splitCsv) {
            return TaskEngine.splitCsv(line);
        }
        const out = [];
        let cur = '';
        let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') q = !q;
            else if (ch === ',' && !q) {
                out.push(cur.trim());
                cur = '';
            } else cur += ch;
        }
        out.push(cur.trim());
        return out;
    }

    static parseGpx(text) {
        const waypoints = [];
        const re = /<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi;
        let m;
        while ((m = re.exec(text))) {
            const attrs = m[1];
            const body = m[2];
            const latM = attrs.match(/\blat=["']([^"']+)["']/i);
            const lonM = attrs.match(/\blon=["']([^"']+)["']/i);
            const lat = latM ? Number(latM[1]) : NaN;
            const lon = lonM ? Number(lonM[1]) : NaN;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const nameM = body.match(/<name[^>]*>([^<]*)<\/name>/i);
            const eleM = body.match(/<ele[^>]*>([^<]*)<\/ele>/i);
            const cmtM = body.match(/<(?:cmt|desc)[^>]*>([^<]*)<\/(?:cmt|desc)>/i);
            waypoints.push({
                name: nameM ? nameM[1].trim() : `WP${waypoints.length + 1}`,
                lat,
                lon,
                altitude: eleM ? Number(eleM[1]) || 0 : 0,
                comment: cmtM ? cmtM[1].trim() : ''
            });
        }
        if (waypoints.length === 0) {
            throw new Error('GPX にウェイポイントがありません');
        }
        return waypoints;
    }
}

if (typeof window !== 'undefined') {
    window.WaypointLibrary = WaypointLibrary;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WaypointLibrary };
}
