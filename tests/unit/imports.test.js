describe('WaypointLibrary', () => {
    it('CUP をタスク化せずライブラリにする', () => {
        const cup = [
            'name,code,country,lat,lon,elev,style,rwdir,rwlen,freq,desc',
            '"朝霧TK","ASG",JP,3523.502N,13835.214E,900.0m,1,,,,',
            '"天子岳","TEN",JP,3521.630N,13832.040E,1335.0m,1,,,,',
            '"富士川GL","FJW",JP,3509.660N,13837.290E,40.0m,1,,,,'
        ].join('\n');
        const list = WaypointLibrary.parseCup(cup);
        expect(list).toHaveLength(3);
        expect(list[0].name).toBe('朝霧TK');
        expect(list[0].lat).toBeGreaterThan(35.38);
        expect(list[0].lat).toBeLessThan(35.40);
    });

    it('GPX ウェイポイントを読む', () => {
        const gpx = `<?xml version="1.0"?>
        <gpx><wpt lat="35.3917" lon="138.5869"><name>ASG</name><ele>900</ele></wpt>
        <wpt lat="35.1610" lon="138.6215"><name>GOAL</name><ele>40</ele></wpt></gpx>`;
        const list = WaypointLibrary.parseGpx(gpx);
        expect(list).toHaveLength(2);
        expect(list[0].name).toBe('ASG');
        expect(list[1].altitude).toBe(40);
    });

    it('選択WPから CIVL 円筒タスクを作る', () => {
        const lib = new WaypointLibrary();
        lib.addMany([
            { name: 'TK', lat: 35.39, lon: 138.58, altitude: 900 },
            { name: 'SSS', lat: 35.39, lon: 138.58, altitude: 900 },
            { name: 'TP', lat: 35.36, lon: 138.53, altitude: 1300 },
            { name: 'ESS', lat: 35.16, lon: 138.62, altitude: 40 },
            { name: 'GL', lat: 35.16, lon: 138.62, altitude: 40 }
        ]);
        [0, 1, 2, 3, 4].forEach((i) => lib.toggleSelected(i));
        const task = lib.toRaceTask();
        expect(task.turnpoints[0].type).toBe('TAKEOFF');
        expect(task.turnpoints[1].type).toBe('SSS');
        expect(task.turnpoints[1].radius).toBe(1000);
        expect(task.turnpoints[3].type).toBe('ESS');
        expect(task.turnpoints[4].type).toBe('GOAL');
        expect(task.sss.direction).toBe('EXIT');
    });
});

describe('OpenAirParser', () => {
    it('円筒 CTR とポリゴン制限空域を読む', () => {
        const txt = [
            'AC C',
            'AN TOKYO CTR',
            'AL SFC',
            'AH FL200',
            'V X=35:33:00 N 139:47:00 E',
            'DC 9',
            '',
            'AC R',
            'AN TEST R',
            'AL 1000ft',
            'AH 3000m',
            'DP 35:50:00 N 139:10:00 E',
            'DP 35:50:00 N 139:35:00 E',
            'DP 35:35:00 N 139:35:00 E',
            'DP 35:35:00 N 139:10:00 E'
        ].join('\n');
        const zones = OpenAirParser.parse(txt);
        expect(zones.length).toBe(2);
        expect(zones[0].circle).toBeTruthy();
        expect(zones[0].circle.radiusM).toBeGreaterThan(16000);
        expect(zones[0].ceiling.meters).toBeGreaterThan(5000);
        expect(zones[1].points.length).toBe(4);
        expect(zones[1].floor.meters).toBeGreaterThan(250);
        expect(OpenAirParser.pointInPolygon(35.70, 139.22, zones[1].points)).toBe(true);
        expect(OpenAirParser.pointInPolygon(36.0, 140.0, zones[1].points)).toBe(false);
    });
});

describe('QRTaskImport', () => {
    const sample = {
        taskType: 'RACE',
        name: 'QRデモ',
        turnpoints: [
            { radius: 400, type: 'TAKEOFF', waypoint: { name: 'A', lat: 35.0, lon: 139.0, altSmoothed: 10 } },
            { radius: 1000, type: 'SSS', waypoint: { name: 'S', lat: 35.0, lon: 139.0, altSmoothed: 10 } },
            { radius: 400, type: 'GOAL', waypoint: { name: 'B', lat: 35.1, lon: 139.1, altSmoothed: 10 } }
        ],
        sss: { direction: 'EXIT', timeGates: [] }
    };

    it('XCTSK JSON をデコードする', () => {
        const decoded = QRTaskImport.decodePayload('XCTSK:' + JSON.stringify(sample));
        expect(decoded.kind).toBe('task');
        expect(decoded.task.turnpoints.length).toBe(3);
        expect(decoded.task.turnpoints[0].name).toBe('A');
    });

    it('Base64 の xctsk をデコードする', () => {
        const json = JSON.stringify(sample);
        const b64 = (typeof btoa === 'function')
            ? btoa(json)
            : Buffer.from(json, 'utf8').toString('base64');
        const decoded = QRTaskImport.decodePayload(b64);
        expect(decoded.kind).toBe('task');
        expect(decoded.task.name).toBe('QRデモ');
    });
});
