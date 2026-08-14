// サンプル パイロンレース（デモ + 実在エリア風）
const SampleTasks = {
    tokyoDemo: {
        name: '東京デモ パイロンレース',
        taskType: 'RACE',
        turnpoints: [
            { name: 'TKOF 皇居', lat: 35.6850, lon: 139.7530, altitude: 20, radius: 400, type: 'TAKEOFF' },
            { name: 'SSS', lat: 35.6850, lon: 139.7530, altitude: 20, radius: 2000, type: 'SSS' },
            { name: 'TP1 上野', lat: 35.7148, lon: 139.7774, altitude: 20, radius: 400, type: 'TURNPOINT' },
            { name: 'TP2 東京スカイツリー', lat: 35.7101, lon: 139.8107, altitude: 20, radius: 400, type: 'TURNPOINT' },
            { name: 'TP3 お台場', lat: 35.6269, lon: 139.7720, altitude: 10, radius: 400, type: 'TURNPOINT' },
            { name: 'ESS 代々木', lat: 35.6717, lon: 139.6950, altitude: 30, radius: 1000, type: 'ESS' },
            { name: 'GOAL 代々木', lat: 35.6717, lon: 139.6950, altitude: 30, radius: 400, type: 'GOAL' }
        ],
        sss: { direction: 'EXIT', timeGates: [] },
        goal: { type: 'CYLINDER' }
    },

    asagiriClassic: {
        name: '朝霧高原クラシック',
        taskType: 'RACE',
        turnpoints: [
            { name: '朝霧TK', lat: 35.3917, lon: 138.5869, altitude: 900, radius: 400, type: 'TAKEOFF' },
            { name: 'SSS 朝霧', lat: 35.3917, lon: 138.5869, altitude: 900, radius: 2000, type: 'SSS' },
            { name: '天子岳', lat: 35.3605, lon: 138.5340, altitude: 1300, radius: 400, type: 'TURNPOINT' },
            { name: '白糸の滝', lat: 35.3132, lon: 138.5885, altitude: 580, radius: 400, type: 'TURNPOINT' },
            { name: 'ESS 富士川', lat: 35.1610, lon: 138.6215, altitude: 40, radius: 1000, type: 'ESS' },
            { name: 'GOAL 富士川', lat: 35.1610, lon: 138.6215, altitude: 40, radius: 400, type: 'GOAL' }
        ],
        sss: { direction: 'EXIT', timeGates: [] },
        goal: { type: 'CYLINDER' }
    },

    shortTriangle: {
        name: 'ショートトライアングル',
        taskType: 'RACE',
        turnpoints: [
            { name: 'Start', lat: 35.6762, lon: 139.6503, altitude: 40, radius: 400, type: 'TAKEOFF' },
            { name: 'SSS', lat: 35.6762, lon: 139.6503, altitude: 40, radius: 1500, type: 'SSS' },
            { name: '北パイロン', lat: 35.7200, lon: 139.6503, altitude: 40, radius: 400, type: 'TURNPOINT' },
            { name: '東パイロン', lat: 35.6980, lon: 139.7100, altitude: 40, radius: 400, type: 'TURNPOINT' },
            { name: 'ESS/GOAL', lat: 35.6762, lon: 139.6503, altitude: 40, radius: 400, type: 'GOAL' }
        ],
        sss: { direction: 'EXIT', timeGates: [] },
        goal: { type: 'CYLINDER' }
    }
};

if (typeof window !== 'undefined') {
    window.SampleTasks = SampleTasks;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SampleTasks };
}
