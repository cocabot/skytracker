// FAI パイロンレース タスクエンジン
// XCTrack 互換の円筒ターンポイント / SSS / ESS / ゴール、CUP・xctsk 読み込み
class TaskEngine {
    constructor() {
        this.task = null;
        this.optimized = null;
        this.state = this.createIdleState();
        this.listeners = [];
    }

    createIdleState() {
        return {
            phase: 'IDLE',
            nextIndex: 0,
            tagged: [],
            takeoffTime: null,
            startTime: null,
            essTime: null,
            goalTime: null,
            lastPosition: null
        };
    }

    loadTask(task) {
        this.task = this.normalizeTask(task);
        this.optimized = this.optimize();
        this.state = this.createIdleState();
        this.emit('taskLoaded', { task: this.task, optimized: this.optimized });
        return this.task;
    }

    clearTask() {
        this.task = null;
        this.optimized = null;
        this.state = this.createIdleState();
        this.emit('taskCleared');
    }

    normalizeTask(raw) {
        if (!raw) {
            throw new Error('タスクが空です');
        }

        const turnpoints = (raw.turnpoints || raw.turnPoints || []).map((tp, index) => {
            const wp = tp.waypoint || tp;
            return {
                id: tp.id || wp.name || `TP${index + 1}`,
                name: wp.name || tp.name || `TP${index + 1}`,
                lat: Number(wp.lat ?? wp.latitude ?? tp.lat),
                lon: Number(wp.lon ?? wp.lng ?? wp.longitude ?? tp.lon),
                altitude: Number(wp.altSmoothed ?? wp.altitude ?? tp.altitude ?? 0),
                radius: Number(tp.radius ?? wp.radius ?? 400),
                type: this.normalizeType(tp.type || wp.type, index, raw.turnpoints ? raw.turnpoints.length : 0)
            };
        });

        if (turnpoints.length < 2) {
            throw new Error('ターンポイントが不足しています（最低2点）');
        }

        for (const tp of turnpoints) {
            if (!Number.isFinite(tp.lat) || !Number.isFinite(tp.lon)) {
                throw new Error(`無効な座標: ${tp.name}`);
            }
        }

        return {
            name: raw.name || raw.taskName || 'パイロンレース',
            type: (raw.taskType || raw.type || 'RACE').toUpperCase(),
            earthModel: raw.earthModel || 'WGS84',
            turnpoints,
            sss: {
                direction: (raw.sss && raw.sss.direction) || 'EXIT',
                timeGates: (raw.sss && raw.sss.timeGates) || []
            },
            goal: {
                type: (raw.goal && raw.goal.type) || 'CYLINDER',
                deadline: (raw.goal && raw.goal.deadline) || null
            }
        };
    }

    normalizeType(type, index, total) {
        const t = String(type || '').toUpperCase();
        if (['TAKEOFF', 'SSS', 'TURNPOINT', 'ESS', 'GOAL'].includes(t)) {
            return t;
        }
        if (index === 0) return 'TAKEOFF';
        if (index === total - 1) return 'GOAL';
        return 'TURNPOINT';
    }

    optimize() {
        if (!this.task) return null;
        const route = Geo.optimizeCylinderRoute(this.task.turnpoints);
        return {
            ...route,
            totalDistanceKm: route.totalDistance / 1000
        };
    }

    getTurnpoints() {
        return this.task ? this.task.turnpoints : [];
    }

    getOptimizedPoints() {
        return this.optimized ? this.optimized.points : [];
    }

    getScoredTurnpoints() {
        if (!this.task) return [];
        return this.task.turnpoints.filter((tp) => tp.type !== 'TAKEOFF');
    }

    findIndexByType(type) {
        if (!this.task) return -1;
        return this.task.turnpoints.findIndex((tp) => tp.type === type);
    }

    resetRace() {
        this.state = this.createIdleState();
        this.optimized = this.optimize();
        this.emit('raceReset', this.state);
    }

    armStart() {
        if (!this.task) return;
        this.state.phase = 'ARMED';
        this.state.nextIndex = this.firstNavigableIndex();
        this.emit('phase', this.state);
    }

    firstNavigableIndex() {
        const sss = this.findIndexByType('SSS');
        if (sss >= 0) return sss;
        return this.task.turnpoints[0].type === 'TAKEOFF' ? 1 : 0;
    }

    /**
     * GPS 位置を与えてタスク進行を更新する。
     */
    updatePosition(position) {
        if (!this.task || !position) return this.getProgress(position);

        const lat = position.latitude ?? position.lat;
        const lon = position.longitude ?? position.lon;
        const now = position.timestamp instanceof Date
            ? position.timestamp
            : new Date(position.timestamp || Date.now());

        this.state.lastPosition = { lat, lon, altitude: position.altitude || 0, timestamp: now };

        if (this.state.phase === 'IDLE') {
            return this.getProgress(position);
        }

        if (this.state.phase === 'ARMED' || this.state.phase === 'PRESTART') {
            this.tryStart({ lat, lon }, now);
        }

        this.tryTagTurnpoints({ lat, lon }, now);
        return this.getProgress(position);
    }

    isStartGateOpen(now) {
        const gates = this.task.sss.timeGates || [];
        if (gates.length === 0) return true;
        const t = now instanceof Date ? now : new Date(now);
        const utc = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}:${String(t.getUTCSeconds()).padStart(2, '0')}Z`;
        return gates.some((g) => utc >= g);
    }

    tryStart(point, now) {
        const sssIndex = this.findIndexByType('SSS');
        if (sssIndex < 0) {
            if (!this.state.startTime) {
                this.state.startTime = now;
                this.state.phase = 'RACING';
                this.state.tagged[this.firstNavigableIndex()] = now;
                this.emit('started', { time: now });
            }
            return;
        }

        const sss = this.task.turnpoints[sssIndex];
        const inside = Geo.isInsideCylinder(point.lat, point.lon, sss.lat, sss.lon, sss.radius);
        const direction = this.task.sss.direction || 'EXIT';

        if (!this.isStartGateOpen(now)) {
            this.state.phase = 'PRESTART';
            return;
        }

        if (direction === 'ENTER') {
            if (inside && !this.state.startTime) {
                this.markStarted(now, sssIndex);
            }
        } else {
            const wasInside = this.state._sssInside;
            this.state._sssInside = inside;
            if (wasInside && !inside && !this.state.startTime) {
                this.markStarted(now, sssIndex);
            }
            if (inside) {
                this.state.phase = 'PRESTART';
            }
        }
    }

    markStarted(now, sssIndex) {
        this.state.startTime = now;
        this.state.phase = 'RACING';
        this.state.tagged[sssIndex] = now;
        this.state.nextIndex = sssIndex + 1;
        this.emit('started', { time: now, index: sssIndex });
    }

    tryTagTurnpoints(point, now) {
        if (this.state.phase !== 'RACING' && this.state.phase !== 'ESS') return;

        for (let i = 0; i < this.task.turnpoints.length; i++) {
            if (this.state.tagged[i]) continue;
            const tp = this.task.turnpoints[i];
            if (tp.type === 'TAKEOFF' || tp.type === 'SSS') continue;
            if (i > this.state.nextIndex) break;

            const inside = Geo.isInsideCylinder(point.lat, point.lon, tp.lat, tp.lon, tp.radius);
            if (!inside) continue;

            this.state.tagged[i] = now;
            this.state.nextIndex = i + 1;
            this.emit('tagged', { index: i, turnpoint: tp, time: now });

            if (tp.type === 'ESS' && !this.state.essTime) {
                this.state.essTime = now;
                this.state.phase = 'ESS';
            }
            if (tp.type === 'GOAL') {
                this.state.goalTime = now;
                this.state.phase = 'FINISHED';
                this.emit('finished', { time: now });
            }
        }
    }

    nextTurnpoint() {
        if (!this.task) return null;
        const idx = Math.min(this.state.nextIndex, this.task.turnpoints.length - 1);
        if (this.state.phase === 'FINISHED') {
            return this.task.turnpoints[this.task.turnpoints.length - 1];
        }
        return this.task.turnpoints[idx] || null;
    }

    remainingOptimizedDistance(position) {
        if (!this.task || !this.optimized) return 0;
        const points = this.optimized.points;
        if (points.length === 0) return 0;

        const nextIdx = Math.min(
            Math.max(this.state.nextIndex, 0),
            points.length - 1
        );

        let remaining = 0;
        if (position) {
            const lat = position.latitude ?? position.lat;
            const lon = position.longitude ?? position.lon;
            remaining += Geo.distance(lat, lon, points[nextIdx].lat, points[nextIdx].lon);
        }
        for (let i = nextIdx + 1; i < points.length; i++) {
            remaining += Geo.distancePts(points[i - 1], points[i]);
        }
        return remaining;
    }

    distanceToNextCylinder(position) {
        const tp = this.nextTurnpoint();
        if (!tp || !position) return null;
        const lat = position.latitude ?? position.lat;
        const lon = position.longitude ?? position.lon;
        const toCenter = Geo.distance(lat, lon, tp.lat, tp.lon);
        return Math.max(0, toCenter - (tp.radius || 0));
    }

    getProgress(position) {
        const next = this.nextTurnpoint();
        const remaining = this.remainingOptimizedDistance(position);
        const toCylinder = this.distanceToNextCylinder(position);
        const lat = position ? (position.latitude ?? position.lat) : null;
        const lon = position ? (position.longitude ?? position.lon) : null;

        let bearing = null;
        if (next && lat != null) {
            const opt = this.optimized && this.optimized.points[this.state.nextIndex];
            const target = opt || next;
            bearing = Geo.bearing(lat, lon, target.lat, target.lon);
        }

        return {
            phase: this.state.phase,
            nextIndex: this.state.nextIndex,
            nextTurnpoint: next,
            taggedCount: this.state.tagged.filter(Boolean).length,
            totalTurnpoints: this.task ? this.task.turnpoints.length : 0,
            remainingM: remaining,
            remainingKm: remaining / 1000,
            distanceToCylinderM: toCylinder,
            bearing,
            startTime: this.state.startTime,
            essTime: this.state.essTime,
            goalTime: this.state.goalTime,
            optimizedDistanceM: this.optimized ? this.optimized.totalDistance : 0,
            inNextCylinder: !!(next && lat != null &&
                Geo.isInsideCylinder(lat, lon, next.lat, next.lon, next.radius))
        };
    }

    raceTimeMs(now = new Date()) {
        if (!this.state.startTime) return 0;
        const end = this.state.essTime || this.state.goalTime || now;
        return end - this.state.startTime;
    }

    taskSpeedKmh(now = new Date()) {
        if (!this.state.startTime || !this.optimized) return 0;
        const elapsedH = this.raceTimeMs(now) / 3600000;
        if (elapsedH <= 0) return 0;
        const sssIdx = Math.max(this.findIndexByType('SSS'), 0);
        const essIdx = this.findIndexByType('ESS');
        const endIdx = essIdx >= 0 ? essIdx : this.task.turnpoints.length - 1;
        let scored = 0;
        for (let i = sssIdx + 1; i <= Math.min(this.state.nextIndex, endIdx); i++) {
            if (i > 0 && this.optimized.points[i] && this.optimized.points[i - 1]) {
                scored += Geo.distancePts(this.optimized.points[i - 1], this.optimized.points[i]);
            }
        }
        return (scored / 1000) / elapsedH;
    }

    toJSON() {
        return this.task;
    }

    on(fn) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== fn);
        };
    }

    emit(type, detail) {
        this.listeners.forEach((fn) => {
            try { fn(type, detail); } catch (e) { console.warn(e); }
        });
    }

    // ---- インポート ----

    static parseXctsk(text) {
        const data = typeof text === 'string' ? JSON.parse(text) : text;
        const tps = (data.turnpoints || []).map((tp) => ({
            name: tp.waypoint && tp.waypoint.name,
            lat: tp.waypoint && tp.waypoint.lat,
            lon: tp.waypoint && tp.waypoint.lon,
            altitude: tp.waypoint && (tp.waypoint.altSmoothed || tp.waypoint.altitude),
            radius: tp.radius,
            type: tp.type
        }));
        return {
            name: data.name || 'XCTrack Task',
            taskType: data.taskType || 'RACE',
            earthModel: data.earthModel || 'WGS84',
            turnpoints: tps,
            sss: data.sss || { direction: 'EXIT', timeGates: [] },
            goal: data.goal || { type: 'CYLINDER' }
        };
    }

    static parseCup(text) {
        const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const waypoints = [];
        let inTask = false;
        const taskNames = [];
        const taskWaypoints = [];

        for (const line of lines) {
            if (line.startsWith('-----')) {
                inTask = true;
                continue;
            }
            if (!inTask) {
                if (line.toLowerCase().startsWith('name,')) continue;
                const wp = TaskEngine.parseCupWaypoint(line);
                if (wp) waypoints.push(wp);
            } else {
                if (line.startsWith('"') || line.startsWith('Task')) {
                    taskNames.push(line.replace(/"/g, ''));
                }
            }
        }

        if (waypoints.length === 0) {
            throw new Error('CUP ファイルにウェイポイントがありません');
        }

        const turnpoints = waypoints.map((wp, i) => ({
            ...wp,
            radius: i === 0 ? 400 : (i === waypoints.length - 1 ? 1000 : 400),
            type: i === 0 ? 'TAKEOFF' : (i === waypoints.length - 1 ? 'GOAL' : 'TURNPOINT')
        }));

        if (turnpoints.length >= 3) {
            turnpoints[1].type = 'SSS';
            turnpoints[1].radius = Math.max(turnpoints[1].radius, 1000);
            if (turnpoints.length >= 4) {
                turnpoints[turnpoints.length - 2].type = 'ESS';
            }
        }

        return {
            name: taskNames[0] || 'CUP Task',
            taskType: 'RACE',
            turnpoints
        };
    }

    static parseCupWaypoint(line) {
        const parts = TaskEngine.splitCsv(line);
        if (parts.length < 6) return null;
        const lat = TaskEngine.parseCupCoord(parts[3], true);
        const lon = TaskEngine.parseCupCoord(parts[4], false);
        if (lat == null || lon == null) return null;
        const elev = parseFloat(String(parts[5]).replace(/[mft]/ig, '')) || 0;
        return {
            name: parts[0].replace(/"/g, '') || parts[1],
            code: parts[1],
            lat,
            lon,
            altitude: elev
        };
    }

    static parseCupCoord(value, isLat) {
        if (!value) return null;
        const s = String(value).trim().toUpperCase();
        const m = s.match(/^(\d+)(\d\d\.\d+)([NSEW])$/);
        if (!m) {
            const n = Number(s);
            return Number.isFinite(n) ? n : null;
        }
        const deg = parseInt(m[1], 10);
        const minutes = parseFloat(m[2]);
        let dec = deg + minutes / 60;
        if (m[3] === 'S' || m[3] === 'W') dec = -dec;
        if (isLat && Math.abs(dec) > 90) return null;
        return dec;
    }

    static splitCsv(line) {
        const out = [];
        let cur = '';
        let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                q = !q;
            } else if (ch === ',' && !q) {
                out.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur.trim());
        return out;
    }

    static parseAuto(text, filename = '') {
        const name = filename.toLowerCase();
        const trimmed = String(text).trim();
        if (name.endsWith('.xctsk') || trimmed.startsWith('{')) {
            return TaskEngine.parseXctsk(trimmed);
        }
        if (name.endsWith('.cup') || trimmed.toLowerCase().includes('name,code,country')) {
            return TaskEngine.parseCup(trimmed);
        }
        if (trimmed.startsWith('{')) {
            return TaskEngine.parseXctsk(trimmed);
        }
        throw new Error('未対応のタスク形式です（.xctsk / .cup / JSON）');
    }
}

if (typeof window !== 'undefined') {
    window.TaskEngine = TaskEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TaskEngine };
}
