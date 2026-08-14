// ウェイポイントライブラリ（JHF .wpt / CUP / GPX）。
// 日本ハング・パラグライディング連盟の公式WPは GpsDump $FormatGEO の .wpt が主形式。
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
                comment: wp.comment || '',
                role: wp.role || WaypointLibrary.classifyRole(wp)
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
     * JHF 名称規約 + CIVL Sporting Code S7 の円筒でレースタスク化する。
     * TAKEOFF 400 / SSS EXIT 2000 / TP 400（下限 200）/ ESS 1000 / GOAL 400
     * ESS はゴールより前。可能なら中心間 500 m 以上（Cat 1）。
     */
    toRaceTask(waypoints, name) {
        const wps = waypoints || this.selectedWaypoints();
        if (!wps || wps.length < 2) {
            throw new Error('タスクにはウェイポイントが2点以上必要です');
        }
        const civl = WaypointLibrary.CIVL;
        const named = wps.some((wp) => {
            const role = WaypointLibrary.classifyRole(wp);
            return role === 'takeoff' || role === 'goal' || role === 'sss' || role === 'ess'
                || /^N\d/i.test(wp.name || '');
        });

        let turnpoints;
        if (named) {
            turnpoints = WaypointLibrary.buildNamedTask(wps, civl);
        } else {
            turnpoints = WaypointLibrary.buildSequentialTask(wps, civl);
        }

        const ess = turnpoints.find((tp) => tp.type === 'ESS');
        const goal = turnpoints.find((tp) => tp.type === 'GOAL');
        const essGoalM = ess && goal
            ? Geo.distance(ess.lat, ess.lon, goal.lat, goal.lon)
            : 0;

        return {
            name: name || 'ウェイポイントタスク',
            taskType: 'RACE',
            rules: 'CIVL S7 / JHF',
            turnpoints,
            sss: { direction: 'EXIT', timeGates: [] },
            goal: { type: 'CYLINDER' },
            meta: {
                essGoalSeparationM: essGoalM,
                essGoalOk: !ess || essGoalM >= civl.ESS_GOAL_MIN || essGoalM < 30
            }
        };
    }

    static buildNamedTask(wps, civl) {
        const classified = wps.map((wp) => ({ wp, role: WaypointLibrary.classifyRole(wp) }));
        const racing = classified.filter((c) => c.role !== 'nogo' && c.role !== 'hq' && c.role !== 'safety');
        const pts = racing.length >= 2 ? racing : classified.filter((c) => c.role !== 'nogo');
        if (pts.length < 2) {
            throw new Error('離陸とゴールを含むウェイポイントを選んでください（NG/SL はタスクに使いません）');
        }

        const takeoff = (pts.find((c) => c.role === 'takeoff') || pts[0]).wp;
        const goal = ([...pts].reverse().find((c) => c.role === 'goal') || pts[pts.length - 1]).wp;
        const namedSss = pts.find((c) => c.role === 'sss');
        const namedEss = pts.find((c) => c.role === 'ess' && c.wp !== goal);
        const tps = pts
            .filter((c) => {
                if (c.wp === takeoff || c.wp === goal) return false;
                if (c.role === 'sss' || c.role === 'ess' || c.role === 'takeoff' || c.role === 'goal') return false;
                return c.role === 'tp' || c.role === 'extra';
            })
            .map((c) => c.wp);

        const turnpoints = [
            WaypointLibrary.asTp(takeoff, 'TAKEOFF', civl.TAKEOFF),
            WaypointLibrary.asTp(namedSss ? namedSss.wp : takeoff, 'SSS', civl.SSS)
        ];
        tps.forEach((tp) => turnpoints.push(WaypointLibrary.asTp(tp, 'TURNPOINT', civl.TP)));

        if (namedEss) {
            turnpoints.push(WaypointLibrary.asTp(namedEss.wp, 'ESS', civl.ESS));
        } else if (tps.length) {
            turnpoints[turnpoints.length - 1].type = 'ESS';
            turnpoints[turnpoints.length - 1].radius = civl.ESS;
        } else {
            turnpoints.push(WaypointLibrary.asTp(goal, 'ESS', civl.ESS));
        }
        turnpoints.push(WaypointLibrary.asTp(goal, 'GOAL', civl.GOAL));
        return turnpoints;
    }

    static buildSequentialTask(wps, civl) {
        const turnpoints = wps.map((wp, i) => {
            let type = 'TURNPOINT';
            let radius = civl.TP;
            if (i === 0) {
                type = 'TAKEOFF';
                radius = civl.TAKEOFF;
            } else if (i === 1 && wps.length >= 3) {
                type = 'SSS';
                radius = civl.SSS;
            } else if (i === wps.length - 1) {
                type = 'GOAL';
                radius = civl.GOAL;
            } else if (wps.length >= 4 && i === wps.length - 2) {
                type = 'ESS';
                radius = civl.ESS;
            }
            return WaypointLibrary.asTp(wp, type, radius);
        });
        if (wps.length === 2) {
            return [
                WaypointLibrary.asTp(wps[0], 'TAKEOFF', civl.TAKEOFF),
                WaypointLibrary.asTp(wps[0], 'SSS', civl.SSS),
                WaypointLibrary.asTp(wps[1], 'ESS', civl.ESS),
                WaypointLibrary.asTp(wps[1], 'GOAL', civl.GOAL)
            ];
        }
        return turnpoints;
    }

    static asTp(wp, type, radius) {
        return {
            name: wp.name,
            lat: wp.lat,
            lon: wp.lon,
            altitude: wp.altitude || 0,
            radius,
            type
        };
    }

    /**
     * JHF 西富士・南陽などの名称接頭辞。
     * TO 離陸 / GL ゴール着陸 / SL* セーフティLD / NG* 進入禁止 / N## TP / P## 補助 / HQ 本部
     */
    static classifyRole(wp) {
        const name = String(wp.name || '').toUpperCase().replace(/[\s_\-]/g, '');
        const comment = String(wp.comment || wp.description || '').toUpperCase();
        const blob = `${name} ${comment}`;
        if (/^NG/.test(name) || /NOGO|NO-GO|禁止/.test(blob)) return 'nogo';
        if (/^HQ/.test(name)) return 'hq';
        if (/^SL/.test(name) || /SAFETY|緊急着陸|セーフティ/.test(blob)) return 'safety';
        if (/^TO/.test(name) || /^TK/.test(name) || /TAKEOFF|TKOF/.test(blob)) return 'takeoff';
        if (/^GL/.test(name) || /^Z\d/.test(name) || /\bGOAL\b|\bLANDING\b|\bMAIN-?LD\b/.test(blob)) return 'goal';
        if (/^SSS/.test(name) || /\bSSS\b/.test(blob)) return 'sss';
        if (/^ESS/.test(name) || /\bESS\b/.test(blob)) return 'ess';
        if (/^P\d/.test(name)) return 'extra';
        return 'tp';
    }

    static parseAuto(text, filename = '') {
        const name = String(filename).toLowerCase();
        const trimmed = String(text).replace(/^\uFEFF/, '').trim();
        if (WaypointLibrary.isGeoDump(trimmed) || name.endsWith('.wpt') && !WaypointLibrary.isOziWpt(trimmed)) {
            if (WaypointLibrary.isGeoDump(trimmed)) {
                return WaypointLibrary.parseGeoDump(trimmed);
            }
            if (WaypointLibrary.isOziWpt(trimmed)) {
                return WaypointLibrary.parseOziWpt(trimmed);
            }
        }
        if (WaypointLibrary.isOziWpt(trimmed)) {
            return WaypointLibrary.parseOziWpt(trimmed);
        }
        if (name.endsWith('.gpx') || trimmed.includes('<gpx') || /<wpt\b/i.test(trimmed)) {
            return WaypointLibrary.parseGpx(trimmed);
        }
        if (name.endsWith('.cup') || /name\s*,\s*code\s*,\s*country/i.test(trimmed)) {
            return WaypointLibrary.parseCup(trimmed);
        }
        if (WaypointLibrary.isGeoDump(trimmed) || name.endsWith('.wpt')) {
            return WaypointLibrary.parseGeoDump(trimmed);
        }
        try {
            return WaypointLibrary.parseCup(trimmed);
        } catch (cupErr) {
            try {
                return WaypointLibrary.parseGeoDump(trimmed);
            } catch (geoErr) {
                throw new Error('未対応のウェイポイント形式です（JHF .wpt / CUP / GPX）');
            }
        }
    }

    static isGeoDump(text) {
        return /\$FormatGEO/i.test(String(text).slice(0, 80));
    }

    static isOziWpt(text) {
        return /OziExplorer\s+Waypoint/i.test(String(text).slice(0, 120));
    }

    /**
     * GpsDump $FormatGEO（JHF 公式 .wpt）
     * TO-116 N 35 22 31.98 E 138 32 22.00 1167 TAKEOFF
     */
    static parseGeoDump(text) {
        const lines = String(text).split(/\r?\n/);
        const waypoints = [];
        const re = /^(\S+)\s+([NS])\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([EW])\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(-?\d+)\s*(.*)$/i;
        let sawHeader = false;
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            if (/^\$FormatGEO/i.test(line)) {
                sawHeader = true;
                continue;
            }
            if (/^\$/.test(line)) continue;
            const m = line.match(re);
            if (!m) continue;
            const lat = WaypointLibrary.dmsToDec(m[2], m[3], m[4], m[5]);
            const lon = WaypointLibrary.dmsToDec(m[6], m[7], m[8], m[9]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const wp = {
                name: m[1],
                lat,
                lon,
                altitude: Number(m[10]) || 0,
                comment: (m[11] || '').trim()
            };
            wp.role = WaypointLibrary.classifyRole(wp);
            waypoints.push(wp);
        }
        if (waypoints.length === 0) {
            throw new Error(sawHeader
                ? 'WPT（$FormatGEO）にウェイポイントがありません'
                : 'JHF WPT（$FormatGEO）として読めませんでした');
        }
        return waypoints;
    }

    static dmsToDec(hem, deg, min, sec) {
        let value = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
        const h = String(hem).toUpperCase();
        if (h === 'S' || h === 'W') value = -value;
        return value;
    }

    /**
     * OziExplorer Waypoint File。高度フィールドはフィート（-777 は不明）。
     */
    static parseOziWpt(text) {
        const lines = String(text).split(/\r?\n/);
        const waypoints = [];
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            if (/^OziExplorer/i.test(line) || /^WGS\s*84/i.test(line) || /^Reserved/i.test(line)) continue;
            const parts = line.split(',');
            if (parts.length < 4) continue;
            const lat = parseFloat(parts[2]);
            const lon = parseFloat(parts[3]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            let altitude = 0;
            if (parts.length >= 15) {
                const feet = parseFloat(parts[14]);
                if (Number.isFinite(feet) && feet > -777) {
                    altitude = Math.round(feet * 0.3048);
                }
            }
            const wp = {
                name: String(parts[1] || '').trim() || `WP${waypoints.length + 1}`,
                lat,
                lon,
                altitude,
                comment: String(parts[10] || '').trim()
            };
            wp.role = WaypointLibrary.classifyRole(wp);
            waypoints.push(wp);
        }
        if (waypoints.length === 0) {
            throw new Error('OziExplorer WPT にウェイポイントがありません');
        }
        return waypoints;
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
            if (wp) {
                wp.role = WaypointLibrary.classifyRole(wp);
                waypoints.push(wp);
            }
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
            const wp = {
                name: nameM ? nameM[1].trim() : `WP${waypoints.length + 1}`,
                lat,
                lon,
                altitude: eleM ? Number(eleM[1]) || 0 : 0,
                comment: cmtM ? cmtM[1].trim() : ''
            };
            wp.role = WaypointLibrary.classifyRole(wp);
            waypoints.push(wp);
        }
        if (waypoints.length === 0) {
            throw new Error('GPX にウェイポイントがありません');
        }
        return waypoints;
    }
}

WaypointLibrary.CIVL = {
    TAKEOFF: 400,
    SSS: 2000,
    TP: 400,
    TP_MIN: 200,
    ESS: 1000,
    GOAL: 400,
    ESS_GOAL_MIN: 500
};

if (typeof window !== 'undefined') {
    window.WaypointLibrary = WaypointLibrary;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WaypointLibrary };
}
