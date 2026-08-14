describe('ThermalPredictor', () => {
    let predictor;

    beforeEach(() => {
        predictor = new ThermalPredictor();
    });

    function snapshot(overrides = {}) {
        return {
            current: {
                temperature: 24,
                humidity: 40,
                cloudCover: 30,
                precipitation: 0,
                wind: { speed: 4, from: 270, gusts: 6 }
            },
            aloft: {
                cape: 600,
                liftedIndex: -2,
                cin: 10,
                blh: 1600,
                shortwave: 700,
                cloudLow: 25,
                precipitation: 0,
                levels: [
                    { alt: 10, speed: 3, from: 270 },
                    { alt: 80, speed: 5, from: 275 }
                ]
            },
            ...overrides
        };
    }

    function grid() {
        const cells = [];
        let i = 0;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                cells.push({
                    lat: 35.6 + r * 0.01,
                    lon: 139.6 + c * 0.01,
                    elevation: r === 2 && c === 2 ? 400 : 80,
                    row: r,
                    col: c
                });
                i++;
            }
        }
        return { rows: 5, cols: 5, cells };
    }

    it('日射とCAPEが高いとサーマル指数が上がる', () => {
        const good = predictor.scoreMeteo(snapshot().aloft, snapshot().current);
        const poor = predictor.scoreMeteo({
            cape: 0, liftedIndex: 4, cin: 80, blh: 200, shortwave: 20, cloudLow: 90, precipitation: 2
        }, { cloudCover: 90, precipitation: 2, wind: { speed: 12, from: 0 } });
        expect(good.score).toBeGreaterThan(poor.score);
        expect(good.climbMs).toBeGreaterThan(poor.climbMs);
        expect(good.trigger === 'good' || good.trigger === 'excellent' || good.trigger === 'fair').toBeTruthy();
    });

    it('尾根セルが発生源として選ばれる', () => {
        const pred = predictor.predict(snapshot(), grid());
        expect(pred.sources.length).toBeGreaterThan(0);
        const peak = pred.cells.find((c) => c.row === 2 && c.col === 2);
        const flat = pred.cells.find((c) => c.row === 0 && c.col === 0);
        expect(peak.climbMs).toBeGreaterThan(flat.climbMs);
    });

    it('サーマルが風下へドリフトする', () => {
        const pred = predictor.predict(snapshot(), grid());
        const src = pred.sources.find((s) => s.source === 'forecast');
        expect(src).toBeTruthy();
        expect(src.driftLon).toBeGreaterThan(src.lon);
    });

    it('トラックから実測サーマルを抽出する', () => {
        const start = new Date('2024-06-01T03:00:00Z');
        const points = [];
        for (let i = 0; i < 20; i++) {
            points.push({
                timestamp: new Date(start.getTime() + i * 5000),
                latitude: 35.6,
                longitude: 139.7,
                altitude: 800 + i * 8,
                vario: 1.5,
                heading: i * 20,
                speed: 10
            });
        }
        const live = predictor.extractLiveThermals(points);
        expect(live.length).toBeGreaterThan(0);
        expect(live[0].climbMs).toBeGreaterThan(1);
    });

    it('旋回中にコアを推定する', () => {
        const start = new Date();
        const points = [];
        for (let i = 0; i < 20; i++) {
            const ang = i * 24;
            const p = Geo.destination(35.6, 139.7, ang, 80);
            points.push({
                timestamp: new Date(start.getTime() + i * 2000),
                latitude: p.lat,
                longitude: p.lon,
                altitude: 900,
                vario: 1.2 + (i % 5) * 0.2,
                heading: ang,
                speed: 9
            });
        }
        const core = predictor.estimateCore(points);
        expect(core).toBeTruthy();
        expect(core.circling).toBeTruthy();
    });
});
