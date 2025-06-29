// IGCExporter クラスのテスト
describe('IGCExporter', () => {
    let igcExporter;
    let sampleTrackData;

    beforeEach(() => {
        igcExporter = new IGCExporter();
        
        // サンプルトラックデータ
        sampleTrackData = [
            {
                timestamp: new Date('2024-01-15T10:00:00Z'),
                latitude: 35.6762,
                longitude: 139.6503,
                altitude: 100,
                accuracy: 5,
                speed: 0,
                heading: 0
            },
            {
                timestamp: new Date('2024-01-15T10:01:00Z'),
                latitude: 35.6763,
                longitude: 139.6504,
                altitude: 150,
                accuracy: 5,
                speed: 5,
                heading: 45
            },
            {
                timestamp: new Date('2024-01-15T10:02:00Z'),
                latitude: 35.6764,
                longitude: 139.6505,
                altitude: 200,
                accuracy: 5,
                speed: 10,
                heading: 90
            }
        ];
    });

    describe('基本機能', () => {
        it('IGCExporterインスタンスが正しく作成される', () => {
            expect(igcExporter).toBeInstanceOf(IGCExporter);
            expect(igcExporter.manufacturer).toBe('SKY');
            expect(igcExporter.deviceId).toBe('TRK');
            expect(igcExporter.deviceType).toBe('001');
        });

        it('空のトラックデータでエラーが発生する', () => {
            expect(() => {
                igcExporter.generateIGC([]);
            }).toThrow('トラックデータが空です');

            expect(() => {
                igcExporter.generateIGC(null);
            }).toThrow('トラックデータが空です');
        });
    });

    describe('IGCファイル生成', () => {
        it('基本的なIGCファイルが正しく生成される', () => {
            const igcContent = igcExporter.generateIGC(sampleTrackData);
            const lines = igcContent.split('\n');

            // Aレコード（メーカー情報）の確認
            expect(lines[0]).toMatch(/^ASKYTRK001/);

            // Hレコード（ヘッダー情報）の確認
            const dateHeader = lines.find(line => line.startsWith('HFDTE'));
            expect(dateHeader).toBe('HFDTE150124'); // 15/01/24

            // Bレコード（フライトデータ）の確認
            const bRecords = lines.filter(line => line.startsWith('B'));
            expect(bRecords).toHaveLength(3);

            // 最初のBレコードの詳細確認
            expect(bRecords[0]).toMatch(/^B100000/); // 時刻: 10:00:00
            expect(bRecords[0]).toContain('3540572N'); // 緯度
            expect(bRecords[0]).toContain('13939018E'); // 経度
        });

        it('設定情報が正しくヘッダーに含まれる', () => {
            const settings = {
                username: 'Test Pilot'
            };

            const igcContent = igcExporter.generateIGC(sampleTrackData, settings);
            const lines = igcContent.split('\n');

            const pilotHeader = lines.find(line => line.startsWith('HFPLTTest Pilot'));
            expect(pilotHeader).toBeTruthy();
        });
    });

    describe('座標フォーマット', () => {
        it('緯度が正しくフォーマットされる', () => {
            // 北緯35.6762度
            const formatted = igcExporter.formatLatitude(35.6762);
            expect(formatted).toBe('3540572N');

            // 南緯35.6762度
            const formattedSouth = igcExporter.formatLatitude(-35.6762);
            expect(formattedSouth).toBe('3540572S');
        });

        it('経度が正しくフォーマットされる', () => {
            // 東経139.6503度
            const formatted = igcExporter.formatLongitude(139.6503);
            expect(formatted).toBe('13939018E');

            // 西経139.6503度
            const formattedWest = igcExporter.formatLongitude(-139.6503);
            expect(formattedWest).toBe('13939018W');
        });

        it('高度が正しくフォーマットされる', () => {
            expect(igcExporter.formatAltitude(100)).toBe('00100');
            expect(igcExporter.formatAltitude(1500)).toBe('01500');
            expect(igcExporter.formatAltitude(0)).toBe('00000');
        });

        it('時刻が正しくフォーマットされる', () => {
            const date = new Date('2024-01-15T14:30:45Z');
            expect(igcExporter.formatTime(date)).toBe('143045');
        });

        it('日付が正しくフォーマットされる', () => {
            const date = new Date('2024-01-15T10:00:00Z');
            expect(igcExporter.formatDate(date)).toBe('150124');
        });
    });

    describe('統計情報生成', () => {
        it('基本統計が正しく計算される', () => {
            const stats = igcExporter.generateStatistics(sampleTrackData);

            expect(stats.startTime).toEqual(sampleTrackData[0].timestamp);
            expect(stats.endTime).toEqual(sampleTrackData[2].timestamp);
            expect(stats.duration).toBe(2 * 60 * 1000); // 2分
            expect(stats.maxAltitude).toBe(200);
            expect(stats.minAltitude).toBe(100);
            expect(stats.pointCount).toBe(3);
        });

        it('距離計算が正しく動作する', () => {
            const stats = igcExporter.generateStatistics(sampleTrackData);
            expect(stats.totalDistance).toBeGreaterThan(0);
        });

        it('上昇率・下降率が正しく計算される', () => {
            const stats = igcExporter.generateStatistics(sampleTrackData);
            expect(stats.maxClimbRate).toBeGreaterThan(0);
        });
    });

    describe('IGCファイル検証', () => {
        it('有効なIGCファイルが正しく検証される', () => {
            const igcContent = igcExporter.generateIGC(sampleTrackData);
            const validation = igcExporter.validateIGC(igcContent);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('無効なIGCファイルが正しく検出される', () => {
            const invalidIGC = 'Invalid IGC content';
            const validation = igcExporter.validateIGC(invalidIGC);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        it('Aレコードが欠如している場合のエラー検出', () => {
            const igcWithoutA = 'HFDTE150124\nB100000...';
            const validation = igcExporter.validateIGC(igcWithoutA);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Aレコード（メーカー情報）が見つかりません');
        });
    });

    describe('IGCファイル解析', () => {
        it('IGCファイルから正しくデータを解析する', () => {
            const igcContent = igcExporter.generateIGC(sampleTrackData);
            const parsedData = igcExporter.parseIGC(igcContent);

            expect(parsedData).toHaveLength(3);
            expect(parsedData[0].latitude).toBeCloseTo(35.6762, 4);
            expect(parsedData[0].longitude).toBeCloseTo(139.6503, 4);
            expect(parsedData[0].altitude).toBe(100);
        });

        it('緯度解析が正しく動作する', () => {
            const lat = igcExporter.parseLatitude('3540572N');
            expect(lat).toBeCloseTo(35.6762, 4);

            const latSouth = igcExporter.parseLatitude('3540572S');
            expect(latSouth).toBeCloseTo(-35.6762, 4);
        });

        it('経度解析が正しく動作する', () => {
            const lon = igcExporter.parseLongitude('13939018E');
            expect(lon).toBeCloseTo(139.6503, 4);

            const lonWest = igcExporter.parseLongitude('13939018W');
            expect(lonWest).toBeCloseTo(-139.6503, 4);
        });
    });

    describe('プレビュー生成', () => {
        it('プレビューデータが正しく生成される', () => {
            const largeTrackData = [];
            for (let i = 0; i < 1000; i++) {
                largeTrackData.push({
                    timestamp: new Date(Date.now() + i * 1000),
                    latitude: 35.6762 + i * 0.0001,
                    longitude: 139.6503 + i * 0.0001,
                    altitude: 100 + i,
                    speed: 0
                });
            }

            const preview = igcExporter.generatePreview(largeTrackData, 50);
            expect(preview.length).toBeLessThanOrEqual(50);
            expect(preview[0]).toEqual(largeTrackData[0]);
            expect(preview[preview.length - 1]).toEqual(largeTrackData[largeTrackData.length - 1]);
        });

        it('小さなデータセットでプレビューが正しく動作する', () => {
            const preview = igcExporter.generatePreview(sampleTrackData, 100);
            expect(preview).toEqual(sampleTrackData);
        });
    });

    describe('距離計算', () => {
        it('距離計算が正しく動作する', () => {
            // 東京駅から新宿駅までの概算距離（約7km）
            const distance = igcExporter.calculateDistance(
                35.6812, 139.7671, // 東京駅
                35.6896, 139.7006  // 新宿駅
            );

            expect(distance).toBeGreaterThan(6000);
            expect(distance).toBeLessThan(8000);
        });

        it('同じ地点間の距離が0になる', () => {
            const distance = igcExporter.calculateDistance(
                35.6762, 139.6503,
                35.6762, 139.6503
            );

            expect(distance).toBeCloseTo(0, 1);
        });
    });

    describe('上昇率計算', () => {
        it('最大上昇率が正しく計算される', () => {
            const maxClimb = igcExporter.calculateMaxClimbRate(sampleTrackData);
            expect(maxClimb).toBeGreaterThan(0);
        });

        it('最大下降率が正しく計算される', () => {
            const descendingData = [
                {
                    timestamp: new Date('2024-01-15T10:00:00Z'),
                    altitude: 200
                },
                {
                    timestamp: new Date('2024-01-15T10:01:00Z'),
                    altitude: 150
                },
                {
                    timestamp: new Date('2024-01-15T10:02:00Z'),
                    altitude: 100
                }
            ];

            const maxSink = igcExporter.calculateMaxSinkRate(descendingData);
            expect(maxSink).toBeGreaterThan(0);
        });
    });

    describe('エラーハンドリング', () => {
        it('不正なデータでエラーが発生する', () => {
            expect(() => {
                igcExporter.generateIGC('invalid data');
            }).toThrow();
        });

        it('空の統計データでnullが返される', () => {
            const stats = igcExporter.generateStatistics([]);
            expect(stats).toBeNull();
        });
    });
}, 'unit');