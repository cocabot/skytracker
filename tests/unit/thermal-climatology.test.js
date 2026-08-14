describe('JhfCompetitionThermals', () => {
    it('HGC公開ログ由来のホットスポットを持つ', () => {
        expect(JhfCompetitionThermals).toBeTruthy();
        expect(JhfCompetitionThermals.hotspots.length).toBeGreaterThan(50);
        expect(JhfCompetitionThermals.flightsParsed).toBeGreaterThan(500);
        expect(String(JhfCompetitionThermals.source)).toContain('hgc');
    });

    it('朝霧TO付近の大会上昇セルがある', () => {
        const to = JhfCompetitionThermals.hotspots.find((h) =>
            Math.abs(h.lat - 35.375) < 0.012 && Math.abs(h.lon - 138.536) < 0.012
        );
        expect(to).toBeTruthy();
        expect(to.site).toBe('asagiri_nishifuji');
        expect(to.hits).toBeGreaterThan(100);
        const keys = Object.keys(to).sort().join(',');
        expect(keys).toBe('gain,hits,lat,lon,meanClimb,site');
    });
});

describe('ThermalClimatology', () => {
    it('朝霧TOは遠方セルより気候ブーストが高い', () => {
        const climate = new ThermalClimatology({ storage: null });
        const atTo = climate.boostAt(35.375, 138.536);
        const far = climate.boostAt(35.0, 139.8);
        expect(atTo).toBeGreaterThan(0.12);
        expect(atTo).toBeGreaterThan(far);
        expect(atTo).toBeLessThan(0.281);
        expect(far).toBeLessThan(0.04);
    });

    it('予測に大会気候値を渡すと朝霧TO付近が強まる', () => {
        const predictor = new ThermalPredictor();
        const climate = new ThermalClimatology({ storage: null });
        const cells = [];
        const spots = [
            { lat: 35.375, lon: 138.536, elevation: 900 },
            { lat: 35.000, lon: 139.800, elevation: 900 }
        ];
        spots.forEach((s, i) => {
            cells.push({ lat: s.lat, lon: s.lon, elevation: s.elevation, row: 0, col: i });
        });
        const snap = {
            current: {
                temperature: 24, humidity: 40, cloudCover: 30, precipitation: 0,
                wind: { speed: 4, from: 270, gusts: 6 }
            },
            aloft: {
                cape: 500, liftedIndex: -2, cin: 10, blh: 1600, shortwave: 700,
                cloudLow: 25, precipitation: 0, localHour: 12,
                levels: [{ alt: 10, speed: 3, from: 270 }, { alt: 80, speed: 5, from: 275 }]
            }
        };
        const withClimate = predictor.predict(snap, { rows: 1, cols: 2, cells }, [], climate);
        const to = withClimate.cells[0];
        const far = withClimate.cells[1];
        expect(to.climateBoost).toBeGreaterThan(far.climateBoost);
        expect(to.climbMs).toBeGreaterThan(far.climbMs);
    });
});
