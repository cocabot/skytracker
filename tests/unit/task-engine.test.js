describe('TaskEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new TaskEngine();
        engine.loadTask(SampleTasks.shortTriangle);
    });

    it('サンプルタスクを正規化して読み込む', () => {
        expect(engine.task.name).toBe('ショートトライアングル');
        expect(engine.task.turnpoints.length).toBeGreaterThan(3);
        expect(engine.optimized.totalDistance).toBeGreaterThan(0);
    });

    it('最適化距離が中心間より短いまたは同等', () => {
        const tps = engine.task.turnpoints;
        let centers = 0;
        for (let i = 1; i < tps.length; i++) {
            centers += Geo.distance(tps[i - 1].lat, tps[i - 1].lon, tps[i].lat, tps[i].lon);
        }
        expect(engine.optimized.totalDistance).toBeLessThan(centers + 1);
    });

    it('SSS EXIT で円筒を出るとスタートする', () => {
        engine.armStart();
        const sss = engine.task.turnpoints.find((tp) => tp.type === 'SSS');
        engine.updatePosition({
            latitude: sss.lat,
            longitude: sss.lon,
            altitude: 100,
            timestamp: new Date()
        });
        expect(engine.state.phase === 'PRESTART' || engine.state.phase === 'ARMED').toBeTruthy();
        const outside = Geo.destination(sss.lat, sss.lon, 0, sss.radius + 80);
        engine.updatePosition({
            latitude: outside.lat,
            longitude: outside.lon,
            altitude: 100,
            timestamp: new Date()
        });
        expect(engine.state.startTime).toBeTruthy();
        expect(engine.state.phase).toBe('RACING');
    });

    it('ターンポイント円筒進入でタグされる', () => {
        engine.armStart();
        const sss = engine.task.turnpoints.find((tp) => tp.type === 'SSS');
        engine.updatePosition({ latitude: sss.lat, longitude: sss.lon, timestamp: new Date() });
        const out = Geo.destination(sss.lat, sss.lon, 0, sss.radius + 50);
        engine.updatePosition({ latitude: out.lat, longitude: out.lon, timestamp: new Date() });

        const tp = engine.task.turnpoints.find((t) => t.type === 'TURNPOINT');
        engine.state.nextIndex = engine.task.turnpoints.indexOf(tp);
        engine.updatePosition({ latitude: tp.lat, longitude: tp.lon, timestamp: new Date() });
        expect(engine.state.tagged[engine.task.turnpoints.indexOf(tp)]).toBeTruthy();
    });

    it('残距離がゴールに近づくと減る', () => {
        engine.armStart();
        const start = engine.task.turnpoints[0];
        const far = engine.remainingOptimizedDistance({
            latitude: start.lat - 0.2,
            longitude: start.lon
        });
        const near = engine.remainingOptimizedDistance({
            latitude: start.lat,
            longitude: start.lon
        });
        expect(far).toBeGreaterThan(near);
    });

    it('xctsk JSON をパースできる', () => {
        const json = {
            taskType: 'RACE',
            turnpoints: [
                { radius: 400, type: 'TAKEOFF', waypoint: { name: 'A', lat: 35.0, lon: 139.0, altSmoothed: 10 } },
                { radius: 400, type: 'GOAL', waypoint: { name: 'B', lat: 35.1, lon: 139.1, altSmoothed: 10 } }
            ],
            sss: { direction: 'EXIT', timeGates: [] }
        };
        const parsed = TaskEngine.parseXctsk(JSON.stringify(json));
        const loaded = new TaskEngine();
        loaded.loadTask(parsed);
        expect(loaded.task.turnpoints[0].name).toBe('A');
        expect(loaded.task.turnpoints[1].type).toBe('GOAL');
    });

    it('CUP ウェイポイントをパースできる', () => {
        const cup = [
            'name,code,country,lat,lon,elev,style,rwdir,rwlen,freq,desc',
            '"Takeoff","TO",JP,3540.572N,13835.214E,900.0m,1,,,,',
            '"Goal","GL",JP,3510.000N,13837.000E,40.0m,1,,,,'
        ].join('\n');
        const parsed = TaskEngine.parseCup(cup);
        expect(parsed.turnpoints).toHaveLength(2);
        expect(parsed.turnpoints[0].lat).toBeGreaterThan(35.6);
        expect(parsed.turnpoints[0].lat).toBeLessThan(35.8);
        expect(parsed.turnpoints[0].type).toBe('TAKEOFF');
        expect(parsed.turnpoints[1].type).toBe('GOAL');
    });
});
