// 地理計算ユーティリティ（WGS84 / 球面近似）
// パイロンレースの円筒最適化・滑空計算の共通基盤
const Geo = {
    EARTH_RADIUS: 6371000,

    toRad(degrees) {
        return degrees * Math.PI / 180;
    },

    toDeg(radians) {
        return radians * 180 / Math.PI;
    },

    normalizeBearing(degrees) {
        return ((degrees % 360) + 360) % 360;
    },

    wrapDelta(degrees) {
        let d = ((degrees + 180) % 360 + 360) % 360 - 180;
        return d;
    },

    distance(lat1, lon1, lat2, lon2) {
        const R = this.EARTH_RADIUS;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    distancePts(a, b) {
        return this.distance(a.lat, a.lon, b.lat, b.lon);
    },

    bearing(lat1, lon1, lat2, lon2) {
        const φ1 = this.toRad(lat1);
        const φ2 = this.toRad(lat2);
        const Δλ = this.toRad(lon2 - lon1);
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        return this.normalizeBearing(this.toDeg(Math.atan2(y, x)));
    },

    bearingPts(a, b) {
        return this.bearing(a.lat, a.lon, b.lat, b.lon);
    },

    destination(lat, lon, bearingDeg, distanceM) {
        const δ = distanceM / this.EARTH_RADIUS;
        const θ = this.toRad(bearingDeg);
        const φ1 = this.toRad(lat);
        const λ1 = this.toRad(lon);
        const sinφ1 = Math.sin(φ1);
        const cosφ1 = Math.cos(φ1);
        const sinδ = Math.sin(δ);
        const cosδ = Math.cos(δ);
        const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ));
        const λ2 = λ1 + Math.atan2(
            Math.sin(θ) * sinδ * cosφ1,
            cosδ - sinφ1 * Math.sin(φ2)
        );
        return {
            lat: this.toDeg(φ2),
            lon: ((this.toDeg(λ2) + 540) % 360) - 180
        };
    },

    midpoint(lat1, lon1, lat2, lon2) {
        const φ1 = this.toRad(lat1);
        const φ2 = this.toRad(lat2);
        const λ1 = this.toRad(lon1);
        const Δλ = this.toRad(lon2 - lon1);
        const Bx = Math.cos(φ2) * Math.cos(Δλ);
        const By = Math.cos(φ2) * Math.sin(Δλ);
        const φ3 = Math.atan2(
            Math.sin(φ1) + Math.sin(φ2),
            Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
        );
        const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);
        return { lat: this.toDeg(φ3), lon: ((this.toDeg(λ3) + 540) % 360) - 180 };
    },

    isInsideCylinder(lat, lon, centerLat, centerLon, radiusM) {
        return this.distance(lat, lon, centerLat, centerLon) <= radiusM;
    },

    pointOnCircle(centerLat, centerLon, radiusM, bearingDeg) {
        return this.destination(centerLat, centerLon, bearingDeg, radiusM);
    },

    /**
     * 円筒（円盤）を経由する最短経路上の点。
     * 直線 AB が円盤と交わる場合は中心に最も近い AB 上の点（円内）を返す。
     * そうでなければ円周上で dist(A,P)+dist(P,B) を最小化する点。
     */
    shortestViaCylinder(from, center, radiusM, to) {
        if (!from) {
            return this.closestOnCylinder(to, center, radiusM);
        }
        if (!to) {
            return this.closestOnCylinder(from, center, radiusM);
        }

        const distFrom = this.distancePts(from, center);
        const distTo = this.distancePts(to, center);

        if (distFrom <= radiusM && distTo <= radiusM) {
            return { lat: center.lat, lon: center.lon, onBoundary: false };
        }

        const intersection = this.segmentDiskContact(from, to, center, radiusM);
        if (intersection) {
            return intersection;
        }

        return this.minimizePathOnCircle(from, center, radiusM, to);
    },

    closestOnCylinder(point, center, radiusM) {
        const d = this.distancePts(point, center);
        if (d <= radiusM) {
            return { lat: point.lat, lon: point.lon, onBoundary: d >= radiusM * 0.98 };
        }
        const brg = this.bearingPts(center, point);
        const p = this.pointOnCircle(center.lat, center.lon, radiusM, brg);
        return { lat: p.lat, lon: p.lon, onBoundary: true };
    },

    segmentDiskContact(from, to, center, radiusM) {
        const distAB = this.distancePts(from, to);
        if (distAB < 1) {
            return this.distancePts(from, center) <= radiusM
                ? { lat: from.lat, lon: from.lon, onBoundary: false }
                : null;
        }

        const samples = Math.max(8, Math.min(64, Math.ceil(distAB / Math.max(radiusM / 4, 50))));
        let closest = null;
        let closestDist = Infinity;
        let anyInside = false;

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const p = this.interpolate(from, to, t);
            const d = this.distancePts(p, center);
            if (d <= radiusM) {
                anyInside = true;
            }
            if (d < closestDist) {
                closestDist = d;
                closest = p;
            }
        }

        if (!anyInside) {
            return null;
        }

        if (closestDist <= radiusM) {
            return { lat: closest.lat, lon: closest.lon, onBoundary: closestDist > radiusM * 0.95 };
        }
        return null;
    },

    interpolate(from, to, t) {
        return {
            lat: from.lat + (to.lat - from.lat) * t,
            lon: from.lon + (to.lon - from.lon) * t
        };
    },

    minimizePathOnCircle(from, center, radiusM, to) {
        const coarse = 36;
        let best = null;
        let bestCost = Infinity;
        let bestBearing = 0;

        for (let i = 0; i < coarse; i++) {
            const brg = i * (360 / coarse);
            const p = this.pointOnCircle(center.lat, center.lon, radiusM, brg);
            const cost = this.distancePts(from, p) + this.distancePts(p, to);
            if (cost < bestCost) {
                bestCost = cost;
                best = p;
                bestBearing = brg;
            }
        }

        const refineSteps = [5, 1, 0.2];
        for (const step of refineSteps) {
            for (let d = -step * 5; d <= step * 5; d += step) {
                const brg = this.normalizeBearing(bestBearing + d);
                const p = this.pointOnCircle(center.lat, center.lon, radiusM, brg);
                const cost = this.distancePts(from, p) + this.distancePts(p, to);
                if (cost < bestCost) {
                    bestCost = cost;
                    best = p;
                    bestBearing = brg;
                }
            }
        }

        return { lat: best.lat, lon: best.lon, onBoundary: true, bearing: bestBearing };
    },

    /**
     * 円筒列を通る最短経路を反復最適化する（XCTrack / XCSoar と同系統）。
     * turnpoints: [{lat, lon, radius, type}]
     */
    optimizeCylinderRoute(turnpoints, options = {}) {
        const maxIter = options.maxIter || 40;
        if (!turnpoints || turnpoints.length === 0) {
            return { points: [], totalDistance: 0, legs: [] };
        }

        const points = turnpoints.map((tp) => ({ lat: tp.lat, lon: tp.lon }));

        for (let iter = 0; iter < maxIter; iter++) {
            let moved = 0;
            for (let i = 0; i < turnpoints.length; i++) {
                const tp = turnpoints[i];
                const radius = tp.radius || 0;
                const prev = i === 0 ? null : points[i - 1];
                const next = i === turnpoints.length - 1 ? null : points[i + 1];
                const center = { lat: tp.lat, lon: tp.lon };

                let candidate;
                if (radius <= 0) {
                    candidate = { lat: tp.lat, lon: tp.lon };
                } else if (tp.type === 'TAKEOFF' && i === 0) {
                    candidate = next
                        ? this.closestOnCylinder(next, center, radius)
                        : { lat: tp.lat, lon: tp.lon };
                } else if ((tp.type === 'GOAL' || tp.type === 'ESS') && i === turnpoints.length - 1) {
                    candidate = prev
                        ? this.closestOnCylinder(prev, center, radius)
                        : { lat: tp.lat, lon: tp.lon };
                } else {
                    candidate = this.shortestViaCylinder(prev, center, radius, next);
                }

                moved += this.distancePts(points[i], candidate);
                points[i] = { lat: candidate.lat, lon: candidate.lon };
            }
            if (moved < 3) {
                break;
            }
        }

        const legs = [];
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            const d = this.distancePts(points[i - 1], points[i]);
            totalDistance += d;
            legs.push({
                from: points[i - 1],
                to: points[i],
                distance: d,
                bearing: this.bearingPts(points[i - 1], points[i])
            });
        }

        return { points, totalDistance, legs };
    },

    /**
     * 風の三角：希望トラックに対する機首方位と対地速度。
     * tas / windSpeed は m/s。windFrom は気象庁定義（風が吹いてくる方位）。
     */
    headingForTrack(tas, desiredTrack, windSpeed, windFrom) {
        const windTo = this.normalizeBearing(windFrom + 180);
        const wx = windSpeed * Math.sin(this.toRad(windTo));
        const wy = windSpeed * Math.cos(this.toRad(windTo));
        const tx = Math.sin(this.toRad(desiredTrack));
        const ty = Math.cos(this.toRad(desiredTrack));
        const tw = tx * wx + ty * wy;
        const w2 = wx * wx + wy * wy;
        const disc = tas * tas - (w2 - tw * tw);
        if (disc < 0) {
            return null;
        }
        const gs = tw + Math.sqrt(disc);
        if (gs <= 0.5) {
            return null;
        }
        const ax = gs * tx - wx;
        const ay = gs * ty - wy;
        const heading = this.normalizeBearing(this.toDeg(Math.atan2(ax, ay)));
        return {
            heading,
            gs,
            crab: this.wrapDelta(heading - desiredTrack),
            tailwind: tw,
            crosswind: tx * wy - ty * wx
        };
    },

    windAlongTrack(trackBearing, windSpeed, windFrom) {
        const windTo = this.normalizeBearing(windFrom + 180);
        const delta = this.wrapDelta(windTo - trackBearing);
        return windSpeed * Math.cos(this.toRad(delta));
    },

    cardinal(bearing) {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const idx = Math.round(this.normalizeBearing(bearing) / 22.5) % 16;
        return dirs[idx];
    }
};

if (typeof window !== 'undefined') {
    window.Geo = Geo;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Geo };
}
