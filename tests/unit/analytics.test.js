// FlightAnalytics クラスのテスト
describe('FlightAnalytics', () => {
    let analytics;
    let sampleTrackData;

    beforeEach(() => {
        analytics = new FlightAnalytics();
        
        // サンプルトラックデータ（30分のフライト）
        sampleTrackData = [];
        const startTime = new Date('2024-01-15T10:00:00Z');
        
        for (let i = 0; i < 30; i++) {
            const timestamp = new Date(startTime.getTime() + i * 60 * 1000); // 1分間隔
            const altitude = 1000 + Math.sin(i * 0.2) * 200 + i * 5; // 波状の上昇
            const speed = 15 + Math.random() * 10; // 15-25 km/h
            const vario = Math.sin(i * 0.3) * 3; // -3 to +3 m/s
            
            sampleTrackData.push({
                timestamp: timestamp,
                latitude: 35.6762 + i * 0.001,
                longitude: 139.6503 + i * 0.001,
                altitude: altitude,
                speed: speed / 3.6, // km/h to m/s
                vario: vario
            });
        }
    });

    describe('基本機能', () => {
        it('FlightAnalyticsインスタンスが正しく作成される', () => {
            expect(analytics).toBeInstanceOf(FlightAnalytics);
            expect(analytics.analysisData).toBeNull();
            expect(analytics.chartInstances).toBeInstanceOf(Map);
        });

        it('分析タイプが正しく定義されている', () => {
            expect(analytics.analysisTypes.ALTITUDE_PROFILE).toBe('altitude_profile');
            expect(analytics.analysisTypes.SPEED_ANALYSIS).toBe('speed_analysis');
            expect(analytics.analysisTypes.CLIMB_RATE).toBe('climb_rate');
            expect(analytics.analysisTypes.EFFICIENCY).toBe('efficiency');
            expect(analytics.analysisTypes.THERMAL_ANALYSIS).toBe('thermal_analysis');
        });
    });

    describe('基本統計計算', () => {
        it('基本統計が正しく計算される', () => {
            const analysis = analytics.analyzeFlightData(sampleTrackData);
            const basic = analysis.basic;

            expect(basic.flightTime).toBe(29 * 60 * 1000); // 29分
            expect(basic.totalDistance).toBeGreaterThan(0);
            expect(basic.maxAltitude).toBeGreaterThan(basic.minAltitude);
            expect(basic.avgAltitude).toBeGreaterThan(0);
            expect(basic.maxSpeed).toBeGreaterThan(0);
            expect(basic.avgSpeed).toBeGreaterThan(0);
        });

        it('空のデータでnullが返される', () => {
            const analysis = analytics.analyzeFlightData([]);
            expect(analysis).toBeNull();
        });

        it('距離計算が正しく動作する', () => {
            const analysis = analytics.analyzeFlightData(sampleTrackData);
            expect(analysis.basic.totalDistance).toBeGreaterThan(0);
            expect(analysis.basic.totalDistance).toBeLessThan(100); // 現実的な範囲
        });
    });

    describe('高度分析', () => {
        it('高度分析が正しく実行される', () => {
            const analysis = analytics.analyzeFlightData(sampleTrackData);
            const altitude = analysis.altitude;

            expect(altitude.totalGain).toBeGreaterThan(0);
            expect(altitude.totalLoss).toBeGreaterThan(0);
            expect(altitude.altitudeRange).toBeGreaterThan(0);
            expect(altitude.profile).toBeTruthy();
        });

        it('高度プロファイルが作成される', () => {
            const profile = analytics.createAltitudeProfile(sampleTrackData);
            expect(profile).toBeTruthy();
            // プロファイルの詳細テストは実装に依存
        });
    });

    describe('速度分析', () => {
        it('速度分析が正しく実行される', () => {
            const analysis = analytics.analyzeFlightData(sampleTrackData);
            const speed = analysis.speed;

            expect(speed.distribution).toBeTruthy();
            expect(speed.profile).toBeTruthy();
            expect(speed.speedVariability).toBeGreaterThan(0);
        });

        it('速度分布が正しく計算される', () => {
            const speeds = sampleTrackData.map(p => p.speed * 3.6); // km/h
            const distribution = analytics.calculateSpeedDistribution(speeds);

            expect(distribution).toHaveLength(6); // 6つの速度範囲
            
            const totalPercentage = distribution.reduce((sum, range) => sum + range.percentage, 0);
            expect(totalPercentage).toBeCloseTo(100, 1);
            
            distribution.forEach(range => {
                expect(range.count).toBeGreaterThanOrEqual(0);
                expect(range.percentage).toBeGreaterThanOrEqual(0);
                expect(range.label).toBeTruthy();
            });
        });
    });

    describe('効率計算', () => {
        it('効率指標が正しく計算される', () => {
            const analysis = analytics.analyzeFlightData(sampleTrackData);
            const efficiency = analysis.efficiency;

            expect(efficiency.ldRatio).toBeGreaterThanOrEqual(0);
            expect(efficiency.glideRatio).toBeGreaterThanOrEqual(0);
            expect(efficiency.thermalEfficiency).toBeGreaterThanOrEqual(0);
            expect(efficiency.thermalEfficiency).toBeLessThanOrEqual(100);
        });

        it('サーマル効率が正しく計算される', () => {
            const thermalEfficiency = analytics.calculateThermalEfficiency(sampleTrackData);
            expect(thermalEfficiency).toBeGreaterThanOrEqual(0);
            expect(thermalEfficiency).toBeLessThanOrEqual(100);
        });
    });

    describe('サーマル検出', () => {
        it('サーマルが正しく検出される', () => {
            // 明確なサーマルパターンを持つデータを作成
            const thermalData = [];
            const startTime = new Date();
            
            // 上昇フェーズ（サーマル）
            for (let i = 0; i < 10; i++) {
                thermalData.push({
                    timestamp: new Date(startTime.getTime() + i * 10000), // 10秒間隔
                    altitude: 1000 + i * 20, // 2 m/s上昇
                    vario: 2.0,
                    latitude: 35.6762,
                    longitude: 139.6503
                });
            }
            
            // 滑空フェーズ
            for (let i = 0; i < 10; i++) {
                thermalData.push({
                    timestamp: new Date(startTime.getTime() + (i + 10) * 10000),
                    altitude: 1200 - i * 5, // 0.5 m/s下降
                    vario: -0.5,
                    latitude: 35.6762,
                    longitude: 139.6503
                });
            }

            const thermals = analytics.detectThermals(thermalData);
            expect(thermals.length).toBeGreaterThan(0);
            
            if (thermals.length > 0) {
                const thermal = thermals[0];
                expect(thermal.gain).toBeGreaterThan(0);
                expect(thermal.duration).toBeGreaterThan(0);
                expect(thermal.maxClimbRate).toBeGreaterThan(0);
            }
        });

        it('サーマル分析が正しく実行される', () => {
            const analysis = analytics.analyzeFlightData(sampleTrackData);
            const thermal = analysis.thermal;

            expect(thermal.count).toBeGreaterThanOrEqual(0);
            expect(thermal.averageGain).toBeGreaterThanOrEqual(0);
            expect(thermal.averageDuration).toBeGreaterThanOrEqual(0);
            expect(thermal.thermals).toBeInstanceOf(Array);
        });
    });

    describe('距離計算', () => {
        it('距離計算が正しく動作する', () => {
            // 東京駅から新宿駅までの概算距離
            const distance = analytics.calculateDistance(
                35.6812, 139.7671, // 東京駅
                35.6896, 139.7006  // 新宿駅
            );

            expect(distance).toBeGreaterThan(6000);
            expect(distance).toBeLessThan(8000);
        });

        it('同じ地点間の距離が0になる', () => {
            const distance = analytics.calculateDistance(
                35.6762, 139.6503,
                35.6762, 139.6503
            );

            expect(distance).toBeCloseTo(0, 1);
        });
    });

    describe('変動性計算', () => {
        it('変動性が正しく計算される', () => {
            const values = [10, 12, 8, 15, 9, 11, 13, 7];
            const variability = analytics.calculateVariability(values);
            
            expect(variability).toBeGreaterThan(0);
            expect(typeof variability).toBe('number');
        });

        it('一定値の変動性が0になる', () => {
            const constantValues = [10, 10, 10, 10, 10];
            const variability = analytics.calculateVariability(constantValues);
            
            expect(variability).toBe(0);
        });
    });

    describe('時間フォーマット', () => {
        it('時間が正しくフォーマットされる', () => {
            expect(analytics.formatDuration(0)).toBe('00:00:00');
            expect(analytics.formatDuration(60000)).toBe('00:01:00'); // 1分
            expect(analytics.formatDuration(3661000)).toBe('01:01:01'); // 1時間1分1秒
        });
    });

    describe('UI操作', () => {
        it('パネルの開閉が正しく動作する', () => {
            // DOM要素が存在しない場合のテスト
            // 実際のDOM操作テストは統合テストで行う
            expect(() => {
                analytics.openPanel();
                analytics.closePanel();
            }).not.toThrow();
        });

        it('パネル状態の確認が動作する', () => {
            // DOM要素が存在しない場合はfalseを返すべき
            expect(analytics.isPanelOpen()).toBe(false);
        });
    });

    describe('分析データエクスポート', () => {
        it('分析データが正しくエクスポートされる', () => {
            analytics.analysisData = {
                basic: { flightTime: 1800000 },
                altitude: { totalGain: 500 },
                speed: { averageSpeed: 20 },
                efficiency: { ldRatio: 8.5 },
                thermal: { count: 3 }
            };

            expect(() => {
                analytics.exportAnalysis();
            }).not.toThrow();
        });

        it('分析データが存在しない場合のエクスポート', () => {
            analytics.analysisData = null;

            expect(() => {
                analytics.exportAnalysis();
            }).not.toThrow();
        });
    });

    describe('リアルタイム分析', () => {
        it('リアルタイム分析更新が動作する', () => {
            // window.skyTrackerが存在しない場合のテスト
            expect(() => {
                analytics.updateRealTimeAnalysis();
            }).not.toThrow();
        });
    });

    describe('チャート描画', () => {
        it('簡易チャート描画が動作する', () => {
            // Canvas要素を作成
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');

            const testData = [
                { value: 10 },
                { value: 15 },
                { value: 12 },
                { value: 18 },
                { value: 8 }
            ];

            expect(() => {
                analytics.drawSimpleLineChart(ctx, testData, '#2563eb', 'Test Data');
            }).not.toThrow();
        });

        it('空のデータでチャート描画が動作する', () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            expect(() => {
                analytics.drawSimpleLineChart(ctx, [], '#2563eb', 'Empty Data');
            }).not.toThrow();
        });
    });

    describe('エラーハンドリング', () => {
        it('不正なデータで例外が発生しない', () => {
            expect(() => {
                analytics.analyzeFlightData(null);
            }).not.toThrow();

            expect(() => {
                analytics.analyzeFlightData('invalid');
            }).not.toThrow();
        });

        it('部分的に不正なデータが処理される', () => {
            const partiallyInvalidData = [
                {
                    timestamp: new Date(),
                    latitude: 35.6762,
                    longitude: 139.6503,
                    altitude: 1000,
                    speed: 10,
                    vario: 1
                },
                {
                    timestamp: null, // 不正なデータ
                    latitude: 'invalid',
                    longitude: undefined,
                    altitude: 'not a number',
                    speed: null,
                    vario: NaN
                }
            ];

            expect(() => {
                analytics.analyzeFlightData(partiallyInvalidData);
            }).not.toThrow();
        });
    });
}, 'unit');