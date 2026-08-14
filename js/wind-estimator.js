// 風向・風速の推定
// 予報モデル風 + GPS旋回ドリフト（XCTrack方式）を融合
class WindEstimator {
    constructor() {
        this.modelWind = null;
        this.gpsWind = null;
        this.gpsUpdatedAt = 0;
        this.modelUpdatedAt = 0;
    }

    updateFromWeather(snapshot, altitudeM = 80) {
        if (!snapshot) return this.getFused(altitudeM);
        let wind = WindEstimator.windAtAltitude(snapshot, altitudeM);
        if (!wind && snapshot.current && snapshot.current.wind) {
            wind = snapshot.current.wind;
        }
        if (wind) {
            this.modelWind = {
                speed: wind.speed || 0,
                from: wind.from || wind.direction || 0,
                source: 'model',
                alt: wind.alt || altitudeM
            };
            this.modelUpdatedAt = Date.now();
        }
        return this.getFused(altitudeM);
    }

    /**
     * 旋回中の対地速度ベクトル平均 = 風ベクトル（吹いていく方向）。
     */
    updateFromTrack(trackPoints, windowSeconds = 50) {
        const estimate = WindEstimator.fromCircling(trackPoints, windowSeconds);
        if (estimate) {
            this.gpsWind = estimate;
            this.gpsUpdatedAt = Date.now();
        }
        return this.getFused();
    }

    static fromCircling(trackPoints, windowSeconds = 50) {
        if (!trackPoints || trackPoints.length < 8) return null;
        const last = trackPoints[trackPoints.length - 1];
        const cutoff = new Date(last.timestamp).getTime() - windowSeconds * 1000;
        const recent = trackPoints.filter((p) => new Date(p.timestamp).getTime() >= cutoff && (p.speed || 0) > 1);
        if (recent.length < 8) return null;

        let turn = 0;
        for (let i = 1; i < recent.length; i++) {
            turn += Geo.wrapDelta((recent[i].heading || 0) - (recent[i - 1].heading || 0));
        }
        if (Math.abs(turn) < 250) return null;

        let vx = 0;
        let vy = 0;
        let maxGs = 0;
        let minGs = Infinity;
        let maxHeading = 0;
        let minHeading = 0;

        for (const p of recent) {
            const gs = p.smoothedSpeed != null ? p.smoothedSpeed : (p.speed || 0);
            const hdg = p.heading || 0;
            vx += gs * Math.sin(Geo.toRad(hdg));
            vy += gs * Math.cos(Geo.toRad(hdg));
            if (gs > maxGs) {
                maxGs = gs;
                maxHeading = hdg;
            }
            if (gs < minGs) {
                minGs = gs;
                minHeading = hdg;
            }
        }
        vx /= recent.length;
        vy /= recent.length;

        let speed = Math.hypot(vx, vy);
        let to = Geo.normalizeBearing(Geo.toDeg(Math.atan2(vx, vy)));

        if (maxGs - minGs > 1.5) {
            const gsWind = (maxGs - minGs) / 2;
            if (Math.abs(gsWind - speed) < 3 || speed < 0.8) {
                speed = gsWind;
                to = maxHeading;
            }
        }

        if (speed < 0.4) return null;

        return {
            speed,
            from: Geo.normalizeBearing(to + 180),
            to,
            source: 'gps',
            samples: recent.length,
            turnDeg: turn
        };
    }

    getFused(altitudeM = 80) {
        const gpsAge = Date.now() - this.gpsUpdatedAt;
        const gpsFresh = this.gpsWind && gpsAge < 3 * 60 * 1000;

        if (gpsFresh && this.modelWind) {
            const gpsWeight = gpsAge < 45000 ? 0.75 : 0.45;
            const modelWeight = 1 - gpsWeight;
            const from = Geo.normalizeBearing(
                this.gpsWind.from + Geo.wrapDelta(this.modelWind.from - this.gpsWind.from) * modelWeight
            );
            return {
                speed: this.gpsWind.speed * gpsWeight + this.modelWind.speed * modelWeight,
                from,
                to: Geo.normalizeBearing(from + 180),
                source: 'fused',
                gps: this.gpsWind,
                model: this.modelWind,
                altitude: altitudeM
            };
        }

        if (gpsFresh) {
            return { ...this.gpsWind, to: Geo.normalizeBearing(this.gpsWind.from + 180), altitude: altitudeM };
        }
        if (this.modelWind) {
            return { ...this.modelWind, to: Geo.normalizeBearing(this.modelWind.from + 180), altitude: altitudeM };
        }
        return { speed: 0, from: 0, to: 180, source: 'none', altitude: altitudeM };
    }
}

WindEstimator.windAtAltitude = function windAtAltitude(snapshot, altitudeM) {
    const levels = snapshot && snapshot.aloft && snapshot.aloft.levels;
    if (!levels || levels.length === 0) {
        const w = snapshot && snapshot.current && snapshot.current.wind;
        return w ? { speed: w.speed, from: w.from || w.direction || 0, alt: altitudeM } : null;
    }
    if (altitudeM <= levels[0].alt) return { ...levels[0] };
    const last = levels[levels.length - 1];
    if (altitudeM >= last.alt) return { ...last };
    for (let i = 1; i < levels.length; i++) {
        const lo = levels[i - 1];
        const hi = levels[i];
        if (altitudeM <= hi.alt) {
            const t = (altitudeM - lo.alt) / (hi.alt - lo.alt);
            const from = Geo.normalizeBearing(lo.from + Geo.wrapDelta(hi.from - lo.from) * t);
            return { alt: altitudeM, speed: lo.speed + (hi.speed - lo.speed) * t, from };
        }
    }
    return { ...last };
};

if (typeof window !== 'undefined') {
    window.WindEstimator = WindEstimator;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WindEstimator };
}
