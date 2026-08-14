describe('Geo', () => {
    it('東京〜大阪の距離が約400km', () => {
        const d = Geo.distance(35.68, 139.77, 34.69, 135.50);
        expect(d).toBeGreaterThan(380000);
        expect(d).toBeLessThan(430000);
    });

    it('真北の方位が約0度', () => {
        const b = Geo.bearing(35.0, 139.0, 36.0, 139.0);
        expect(Math.abs(b) < 1 || Math.abs(b - 360) < 1).toBeTruthy();
    });

    it('真東の方位が約90度', () => {
        const b = Geo.bearing(35.0, 139.0, 35.0, 140.0);
        expect(b).toBeGreaterThan(80);
        expect(b).toBeLessThan(100);
    });

    it('destination が距離と方位を保存する', () => {
        const start = { lat: 35.0, lon: 139.0 };
        const dest = Geo.destination(start.lat, start.lon, 90, 1000);
        const d = Geo.distance(start.lat, start.lon, dest.lat, dest.lon);
        expect(Math.abs(d - 1000)).toBeLessThan(5);
        expect(Geo.bearingPts(start, dest)).toBeGreaterThan(85);
        expect(Geo.bearingPts(start, dest)).toBeLessThan(95);
    });

    it('円筒内判定が半径どおり', () => {
        expect(Geo.isInsideCylinder(35.0, 139.0, 35.0, 139.0, 400)).toBeTruthy();
        const edge = Geo.pointOnCircle(35.0, 139.0, 400, 0);
        expect(Geo.isInsideCylinder(edge.lat, edge.lon, 35.0, 139.0, 410)).toBeTruthy();
        expect(Geo.isInsideCylinder(edge.lat, edge.lon, 35.0, 139.0, 300)).toBeFalsy();
    });

    it('直線が円筒を横切るとき最適化点は円内', () => {
        const from = { lat: 35.00, lon: 139.00 };
        const to = { lat: 35.02, lon: 139.00 };
        const center = { lat: 35.01, lon: 139.00 };
        const p = Geo.shortestViaCylinder(from, center, 400, to);
        expect(Geo.distancePts(p, center)).toBeLessThan(401);
        const viaCenters = Geo.distancePts(from, center) + Geo.distancePts(center, to);
        const viaP = Geo.distancePts(from, p) + Geo.distancePts(p, to);
        expect(viaP).toBeLessThan(viaCenters + 1);
    });

    it('円筒を迂回する最短路は中心経由より短い', () => {
        const from = { lat: 35.00, lon: 139.00 };
        const to = { lat: 35.00, lon: 139.04 };
        const center = { lat: 35.02, lon: 139.02 };
        const radius = 1500;
        const p = Geo.shortestViaCylinder(from, center, radius, to);
        const viaP = Geo.distancePts(from, p) + Geo.distancePts(p, to);
        const viaC = Geo.distancePts(from, center) + Geo.distancePts(center, to);
        expect(viaP).toBeLessThan(viaC);
        expect(Math.abs(Geo.distancePts(p, center) - radius)).toBeLessThan(30);
    });

    it('円筒列の最適化距離は中心間距離以下', () => {
        const tps = [
            { lat: 35.00, lon: 139.00, radius: 400, type: 'TAKEOFF' },
            { lat: 35.03, lon: 139.00, radius: 400, type: 'TURNPOINT' },
            { lat: 35.03, lon: 139.03, radius: 400, type: 'GOAL' }
        ];
        const route = Geo.optimizeCylinderRoute(tps);
        const centerDist =
            Geo.distance(35.00, 139.00, 35.03, 139.00) +
            Geo.distance(35.03, 139.00, 35.03, 139.03);
        expect(route.totalDistance).toBeGreaterThan(0);
        expect(route.totalDistance).toBeLessThan(centerDist + 1);
        expect(route.points).toHaveLength(3);
    });

    it('bearing を 0-360 に正規化する', () => {
        expect(Geo.normalizeBearing(-90)).toBe(270);
        expect(Geo.normalizeBearing(370)).toBe(10);
    });

    it('風の三角で追い風時に対地速度が増す', () => {
        const tas = 10;
        const tail = Geo.headingForTrack(tas, 90, 5, 270);
        const head = Geo.headingForTrack(tas, 90, 5, 90);
        expect(tail).toBeTruthy();
        expect(head).toBeTruthy();
        expect(tail.gs).toBeGreaterThan(head.gs);
    });

    it('強すぎる横風ではトラックを維持できない', () => {
        const result = Geo.headingForTrack(5, 0, 20, 90);
        expect(result).toBeNull();
    });
});
