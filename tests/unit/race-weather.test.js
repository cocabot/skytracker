describe('WindEstimator', () => {
    it('旋回トラックから風を推定する', () => {
        const start = new Date();
        const windTo = 90;
        const windSpeed = 5;
        const tas = 10;
        const points = [];
        for (let i = 0; i < 24; i++) {
            const heading = i * 15;
            const tri = Geo.headingForTrack(tas, heading, windSpeed, Geo.normalizeBearing(windTo + 180));
            const gs = tri ? tri.gs : tas;
            const track = tri ? tri.heading : heading;
            const p = Geo.destination(35.6, 139.7, heading, 70);
            points.push({
                timestamp: new Date(start.getTime() + i * 2000),
                latitude: p.lat,
                longitude: p.lon,
                heading: track,
                speed: gs,
                smoothedSpeed: gs
            });
        }
        const est = WindEstimator.fromCircling(points, 60);
        expect(est).toBeTruthy();
        expect(est.speed).toBeGreaterThan(1);
        expect(est.source).toBe('gps');
    });

    it('モデル風とGPS風を融合する', () => {
        const estimator = new WindEstimator();
        estimator.updateFromWeather({
            current: { wind: { speed: 4, from: 270 } },
            aloft: { levels: [{ alt: 10, speed: 4, from: 270 }, { alt: 80, speed: 6, from: 280 }] }
        }, 80);
        estimator.gpsWind = { speed: 5, from: 260, source: 'gps' };
        estimator.gpsUpdatedAt = Date.now();
        const fused = estimator.getFused(80);
        expect(fused.source).toBe('fused');
        expect(fused.speed).toBeGreaterThan(4);
        expect(fused.speed).toBeLessThan(6.5);
    });

    it('高度別の風を補間する', () => {
        const w = WindEstimator.windAtAltitude({
            aloft: {
                levels: [
                    { alt: 10, speed: 2, from: 180 },
                    { alt: 180, speed: 8, from: 180 }
                ]
            }
        }, 95);
        expect(w.speed).toBeGreaterThan(2);
        expect(w.speed).toBeLessThan(8);
    });
});

describe('RaceComputer', () => {
    it('マッククリーディ上昇で速度が上がる', () => {
        const slow = GliderPolar.speedToFly(0, 0);
        const fast = GliderPolar.speedToFly(2.5, 0);
        expect(fast).toBeGreaterThan(slow);
    });

    it('ハングコンペは EN-B より巡航が速い', () => {
        const pg = createGliderPolar(GliderPolarSpecs.pg_enb);
        const hg = createGliderPolar(GliderPolarSpecs.hg_comp);
        expect(hg.speedToFly(2, 0)).toBeGreaterThan(pg.speedToFly(2, 0));
        expect(hg.ld(hg.vBestKmh / 3.6)).toBeGreaterThan(pg.ld(pg.vBestKmh / 3.6));
    });

    it('向かい風で必要高度が増える', () => {
        const engine = new TaskEngine();
        engine.loadTask(SampleTasks.shortTriangle);
        engine.armStart();
        const pos = {
            latitude: 35.6762,
            longitude: 139.6503,
            altitude: 1500,
            speed: 12,
            timestamp: new Date()
        };
        const wind = new WindEstimator();
        const computer = new RaceComputer(engine, wind, { mc: 1.2 });

        wind.modelWind = { speed: 0, from: 0, source: 'model' };
        wind.modelUpdatedAt = Date.now();
        const calm = computer.compute(pos);

        wind.modelWind = { speed: 8, from: calm.bearing, source: 'model' };
        const head = computer.compute(pos);
        expect(head.altitudeRequired).toBeGreaterThan(calm.altitudeRequired);
    });

    it('次パイロンの方位と残距離を返す', () => {
        const engine = new TaskEngine();
        engine.loadTask(SampleTasks.tokyoDemo);
        engine.armStart();
        const computer = new RaceComputer(engine, new WindEstimator());
        const inst = computer.compute({
            latitude: 35.6850,
            longitude: 139.7530,
            altitude: 800,
            speed: 10,
            timestamp: new Date()
        });
        expect(inst.ready).toBeTruthy();
        expect(inst.nextTp).toBeTruthy();
        expect(inst.remainingKm).toBeGreaterThan(0);
        expect(inst.bearing).toBeGreaterThan(-0.1);
    });
});

describe('WeatherService', () => {
    it('Open-Meteo レスポンスを解釈する', () => {
        const svc = new WeatherService({ fetchImpl: null });
        const now = new Date();
        const hour = new Date(now);
        hour.setMinutes(0, 0, 0);
        const parsed = svc.interpret({
            current: {
                temperature_2m: 22,
                relative_humidity_2m: 50,
                wind_speed_10m: 4,
                wind_direction_10m: 180,
                wind_gusts_10m: 6,
                cloud_cover: 20,
                pressure_msl: 1015,
                weather_code: 1
            },
            hourly: {
                time: [hour.toISOString()],
                cape: [400],
                lifted_index: [-1],
                boundary_layer_height: [1200],
                shortwave_radiation: [650],
                wind_speed_80m: [6],
                wind_direction_80m: [190],
                wind_speed_10m: [4],
                wind_direction_10m: [180],
                wind_speed_850hPa: [9],
                wind_direction_850hPa: [210],
                wind_speed_700hPa: [14],
                wind_direction_700hPa: [240],
                dew_point_2m: [8],
                temperature_2m: [22]
            }
        }, 35.6, 139.7);
        expect(parsed.current.temperature).toBe(22);
        expect(parsed.aloft.cape).toBe(400);
        expect(parsed.aloft.lclM).toBeGreaterThan(1000);
        expect(parsed.aloft.levels.some((l) => l.alt > 1000)).toBeTruthy();
        expect(parsed.aloft.hasPressureWinds).toBeTruthy();
        const flight = svc.windAtAltitude(parsed, 1500);
        expect(flight.speed).toBeGreaterThan(6);
        expect(WeatherService.flightWindAltitude(parsed, null)).toBeGreaterThan(700);
        const aloft = svc.windAtAltitude(parsed, 80);
        expect(aloft.speed).toBeGreaterThan(0);
        svc.lastForecast = parsed;
        expect(svc.getStatus().ok).toBeTruthy();
        expect(svc.getStatus().hasPressureWinds).toBeTruthy();
        const url = svc.buildForecastUrl(35.4, 138.6);
        expect(url).toContain('wind_speed_850hPa');
        expect(url).toContain('wind_speed_700hPa');
    });
});
