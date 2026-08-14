// レースコンピュータ（XCTrack 相当の計器 + 風修正）
// マッククリーディ速度、必要高度、ファイナルグライド、カニ角
const GliderPolar = {
    vBestKmh: 37,
    sinkBest: 1.05,
    k: 0.007,
    minKmh: 32,
    maxKmh: 55,

    sink(tasMs) {
        const v = tasMs * 3.6;
        return this.sinkBest + this.k * Math.pow(v - this.vBestKmh, 2);
    },

    ld(tasMs) {
        const s = this.sink(tasMs);
        return s > 0.05 ? tasMs / s : 0;
    },

    speedToFly(mc, headwindMs) {
        let bestV = this.vBestKmh / 3.6;
        let bestCost = Infinity;
        for (let vKmh = this.minKmh; vKmh <= this.maxKmh; vKmh += 0.5) {
            const tas = vKmh / 3.6;
            const sink = this.sink(tas);
            const gs = tas - headwindMs;
            if (gs < 2) continue;
            const cost = (sink + Math.max(0, mc)) / gs;
            if (cost < bestCost) {
                bestCost = cost;
                bestV = tas;
            }
        }
        return bestV;
    }
};

class RaceComputer {
    constructor(taskEngine, windEstimator, options = {}) {
        this.taskEngine = taskEngine;
        this.windEstimator = windEstimator;
        this.mc = options.mc != null ? options.mc : 1.2;
        this.reserveM = options.reserveM != null ? options.reserveM : 80;
        this.polar = options.polar || GliderPolar;
    }

    setMacCready(mc) {
        this.mc = Math.max(0, Math.min(6, Number(mc) || 0));
    }

    compute(position) {
        const progress = this.taskEngine
            ? this.taskEngine.getProgress(position)
            : null;
        const wind = this.windEstimator
            ? this.windEstimator.getFused(position && position.altitude)
            : { speed: 0, from: 0, to: 180, source: 'none' };

        if (!progress || !progress.nextTurnpoint || !position) {
            return {
                progress,
                wind,
                mc: this.mc,
                ready: false
            };
        }

        const here = {
            lat: position.latitude ?? position.lat,
            lon: position.longitude ?? position.lon,
            altitude: position.altitude || 0
        };

        const optPoints = this.taskEngine.getOptimizedPoints();
        const nextIdx = Math.min(progress.nextIndex, optPoints.length - 1);
        const nextOpt = optPoints[nextIdx] || progress.nextTurnpoint;
        const nextTp = progress.nextTurnpoint;

        const bearing = Geo.bearingPts(here, nextOpt);
        const distNext = Geo.distancePts(here, nextOpt);
        const headwind = -Geo.windAlongTrack(bearing, wind.speed, wind.from);
        const stf = this.polar.speedToFly(this.mc, headwind);
        const triangle = Geo.headingForTrack(stf, bearing, wind.speed, wind.from);

        const remainingRoute = this.buildRemainingRoute(here, nextIdx, optPoints, nextTp);
        const glide = this.glideAlong(remainingRoute, here.altitude, wind);

        const now = position.timestamp ? new Date(position.timestamp) : new Date();
        const raceMs = this.taskEngine.raceTimeMs(now);
        const xcSpeed = raceMs > 0
            ? ((progress.optimizedDistanceM - progress.remainingM) / 1000) / (raceMs / 3600000)
            : 0;

        const deadline = this.parseDeadline();
        let requiredXc = null;
        let timeToGoalS = glide.timeS;
        if (deadline && progress.remainingM > 0) {
            const remainH = (deadline - now) / 3600000;
            if (remainH > 0) {
                requiredXc = (progress.remainingKm) / remainH;
            }
        }

        const currentSpeed = (position.smoothedSpeed != null ? position.smoothedSpeed : position.speed) || 0;
        const requiredLd = distNext > 0 && here.altitude > (nextTp.altitude || 0)
            ? distNext / Math.max(30, here.altitude - (nextTp.altitude || 0) - this.reserveM)
            : Infinity;

        return {
            ready: true,
            progress,
            wind,
            mc: this.mc,
            nextTp,
            nextOpt,
            bearing,
            distNextM: distNext,
            remainingM: progress.remainingM,
            remainingKm: progress.remainingKm,
            headwind,
            tailwind: -headwind,
            speedToFlyMs: stf,
            speedToFlyKmh: stf * 3.6,
            headingToFly: triangle ? triangle.heading : bearing,
            crab: triangle ? triangle.crab : 0,
            gsExpected: triangle ? triangle.gs : Math.max(1, stf - headwind),
            altitudeRequired: glide.altRequired,
            arrivalAltitude: glide.arrival,
            altitudeMargin: glide.margin,
            altLoss: glide.altLoss,
            timeToGoalS,
            requiredLd,
            currentLd: this.polar.ld(Math.max(stf, currentSpeed || stf)),
            xcSpeed,
            requiredXc,
            raceMs,
            taskSpeed: this.taskEngine.taskSpeedKmh(now),
            finalGlide: glide.margin > 0 && progress.remainingKm < 25,
            currentSpeedKmh: currentSpeed * 3.6
        };
    }

    buildRemainingRoute(here, nextIdx, optPoints, nextTp) {
        const legs = [];
        const first = optPoints[nextIdx] || nextTp;
        legs.push({ from: here, to: first, goalAlt: nextTp.altitude || 0 });
        for (let i = nextIdx + 1; i < optPoints.length; i++) {
            const tp = this.taskEngine.task.turnpoints[i];
            legs.push({
                from: optPoints[i - 1],
                to: optPoints[i],
                goalAlt: (tp && tp.altitude) || 0
            });
        }
        return legs;
    }

    glideAlong(legs, startAlt, wind) {
        let alt = startAlt;
        let timeS = 0;
        let altLoss = 0;
        const goalAlt = legs.length ? legs[legs.length - 1].goalAlt : 0;

        for (const leg of legs) {
            const dist = Geo.distancePts(leg.from, leg.to);
            if (dist < 5) continue;
            const brg = Geo.bearingPts(leg.from, leg.to);
            const headwind = -Geo.windAlongTrack(brg, wind.speed, wind.from);
            const stf = this.polar.speedToFly(this.mc, headwind);
            const tri = Geo.headingForTrack(stf, brg, wind.speed, wind.from);
            const gs = tri ? tri.gs : Math.max(2, stf - headwind);
            const t = dist / gs;
            const loss = this.polar.sink(stf) * t;
            alt -= loss;
            altLoss += loss;
            timeS += t;
        }

        const arrival = alt;
        const altRequired = goalAlt + altLoss + this.reserveM;
        return {
            arrival,
            altRequired,
            margin: arrival - goalAlt - this.reserveM,
            altLoss,
            timeS
        };
    }

    parseDeadline() {
        if (!this.taskEngine || !this.taskEngine.task || !this.taskEngine.task.goal) return null;
        const dl = this.taskEngine.task.goal.deadline;
        if (!dl) return null;
        const m = String(dl).match(/(\d{2}):(\d{2}):(\d{2})/);
        if (!m) return null;
        const now = new Date();
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
            Number(m[1]), Number(m[2]), Number(m[3])));
        return d;
    }
}

if (typeof window !== 'undefined') {
    window.RaceComputer = RaceComputer;
    window.GliderPolar = GliderPolar;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RaceComputer, GliderPolar };
}
