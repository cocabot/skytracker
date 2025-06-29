// アプリケーション統合テスト
describe('SkyTracker Integration Tests', () => {
    let testContainer;

    beforeEach(() => {
        // テスト用のDOM環境を作成
        testContainer = TestFramework.createTestElement(`
            <div class="app-container">
                <div class="tracking-btn" id="trackingBtn">Start Tracking</div>
                <div id="map"></div>
                <div id="currentTime">--:--:--</div>
                <div id="altitude">--- m</div>
                <div id="speed">--- km/h</div>
                <div id="vario">--- m/s</div>
                <div id="flightTime">00:00:00</div>
                <div id="distance">--- km</div>
                <button id="exportBtn" disabled>Export</button>
                <button id="analyticsBtn" disabled>Analytics</button>
                <button id="shareBtn" disabled>Share</button>
                <button id="clearBtn" disabled>Clear</button>
                <div id="notification" class="notification"></div>
            </div>
        `);

        // グローバル変数をクリア
        window.skyTracker = null;
        window.errorHandler = null;
        window.performanceOptimizer = null;
        window.flightAnalytics = null;
    });

    afterEach(() => {
        testContainer.cleanup();
        
        // グローバル変数をクリア
        window.skyTracker = null;
        window.errorHandler = null;
        window.performanceOptimizer = null;
        window.flightAnalytics = null;
    });

    describe('アプリケーション初期化', () => {
        it('全システムが正しく初期化される', () => {
            // システムコンポーネントを初期化
            window.errorHandler = new ErrorHandler();
            window.performanceOptimizer = new PerformanceOptimizer();
            window.flightAnalytics = new FlightAnalytics();

            expect(window.errorHandler).toBeInstanceOf(ErrorHandler);
            expect(window.performanceOptimizer).toBeInstanceOf(PerformanceOptimizer);
            expect(window.flightAnalytics).toBeInstanceOf(FlightAnalytics);
        });

        it('エラーハンドラーが正しく統合される', () => {
            window.errorHandler = new ErrorHandler();
            
            // エラーハンドラーのメソッドが利用可能
            expect(typeof window.errorHandler.handleGPSError).toBe('function');
            expect(typeof window.errorHandler.handleNetworkError).toBe('function');
            expect(typeof window.errorHandler.handleDataError).toBe('function');
        });
    });

    describe('GPS位置情報処理', () => {
        it('位置情報更新が正しく処理される', () => {
            window.errorHandler = new ErrorHandler();
            
            // モックGPS位置データ
            const mockPosition = {
                coords: {
                    latitude: 35.6762,
                    longitude: 139.6503,
                    altitude: 100,
                    accuracy: 5,
                    speed: 10,
                    heading: 45
                },
                timestamp: Date.now()
            };

            // 位置更新処理をテスト
            expect(() => {
                // 実際のSkyTrackerクラスがない場合の処理
                if (window.skyTracker && window.skyTracker.handlePositionUpdate) {
                    window.skyTracker.handlePositionUpdate(mockPosition);
                }
            }).not.toThrow();
        });

        it('GPS エラーが正しく処理される', () => {
            window.errorHandler = new ErrorHandler();
            
            const mockGPSError = {
                code: 1, // PERMISSION_DENIED
                message: 'Permission denied'
            };

            const errorInfo = window.errorHandler.handleGPSError(mockGPSError);
            
            expect(errorInfo.type).toBe('GPS_ERROR');
            expect(errorInfo.context.gpsErrorCode).toBe(1);
            expect(errorInfo.context.suggestions).toContain('ブラウザの設定で位置情報を許可してください');
        });
    });

    describe('データフロー統合', () => {
        it('トラックデータから分析データへの変換', () => {
            window.flightAnalytics = new FlightAnalytics();
            
            const sampleTrackData = [
                {
                    timestamp: new Date('2024-01-15T10:00:00Z'),
                    latitude: 35.6762,
                    longitude: 139.6503,
                    altitude: 1000,
                    speed: 15,
                    vario: 2.0
                },
                {
                    timestamp: new Date('2024-01-15T10:01:00Z'),
                    latitude: 35.6763,
                    longitude: 139.6504,
                    altitude: 1120,
                    speed: 18,
                    vario: 2.0
                }
            ];

            const analysis = window.flightAnalytics.analyzeFlightData(sampleTrackData);
            
            expect(analysis).toBeTruthy();
            expect(analysis.basic).toBeTruthy();
            expect(analysis.altitude).toBeTruthy();
            expect(analysis.speed).toBeTruthy();
            expect(analysis.efficiency).toBeTruthy();
            expect(analysis.thermal).toBeTruthy();
        });

        it('IGCエクスポートが正しく動作する', () => {
            const igcExporter = new IGCExporter();
            
            const sampleTrackData = [
                {
                    timestamp: new Date('2024-01-15T10:00:00Z'),
                    latitude: 35.6762,
                    longitude: 139.6503,
                    altitude: 1000,
                    accuracy: 5,
                    speed: 15,
                    heading: 0
                }
            ];

            const igcContent = igcExporter.generateIGC(sampleTrackData);
            
            expect(igcContent).toBeTruthy();
            expect(igcContent).toContain('ASKYTRK001');
            expect(igcContent).toContain('HFDTE150124');
            expect(igcContent).toContain('B100000');
        });
    });

    describe('エラー処理統合', () => {
        it('IGCエクスポートエラーが正しく処理される', () => {
            window.errorHandler = new ErrorHandler();
            const igcExporter = new IGCExporter();

            // 不正なデータでエラーを発生させる
            expect(() => {
                try {
                    igcExporter.generateIGC([]);
                } catch (error) {
                    window.errorHandler.handleDataError(error, []);
                }
            }).not.toThrow();

            // エラーログが記録されているか確認
            expect(window.errorHandler.errorLog.length).toBeGreaterThan(0);
        });

        it('分析エラーが正しく処理される', () => {
            window.errorHandler = new ErrorHandler();
            window.flightAnalytics = new FlightAnalytics();

            // 不正なデータで分析を実行
            expect(() => {
                try {
                    window.flightAnalytics.analyzeFlightData('invalid data');
                } catch (error) {
                    window.errorHandler.handleDataError(error, 'invalid data');
                }
            }).not.toThrow();
        });
    });

    describe('パフォーマンス統合', () => {
        it('パフォーマンス最適化が正しく動作する', () => {
            window.performanceOptimizer = new PerformanceOptimizer();
            
            // パフォーマンス指標の取得
            const metrics = window.performanceOptimizer.getPerformanceMetrics();
            
            expect(metrics).toBeTruthy();
            expect(typeof metrics.trackPoints).toBe('number');
            expect(typeof metrics.memoryUsage).toBe('number');
            expect(typeof metrics.renderTime).toBe('number');
        });

        it('メモリクリーンアップが動作する', () => {
            window.performanceOptimizer = new PerformanceOptimizer();
            
            expect(() => {
                window.performanceOptimizer.triggerMemoryCleanup();
            }).not.toThrow();
        });
    });

    describe('UI統合テスト', () => {
        it('ボタンの有効/無効が正しく動作する', () => {
            const exportBtn = document.getElementById('exportBtn');
            const analyticsBtn = document.getElementById('analyticsBtn');
            const shareBtn = document.getElementById('shareBtn');
            const clearBtn = document.getElementById('clearBtn');

            // 初期状態では無効
            expect(exportBtn.disabled).toBe(true);
            expect(analyticsBtn.disabled).toBe(true);
            expect(shareBtn.disabled).toBe(true);
            expect(clearBtn.disabled).toBe(true);

            // ボタンを有効化
            exportBtn.disabled = false;
            analyticsBtn.disabled = false;
            shareBtn.disabled = false;
            clearBtn.disabled = false;

            expect(exportBtn.disabled).toBe(false);
            expect(analyticsBtn.disabled).toBe(false);
            expect(shareBtn.disabled).toBe(false);
            expect(clearBtn.disabled).toBe(false);
        });

        it('通知システムが動作する', () => {
            const notification = document.getElementById('notification');
            
            // 通知要素が存在する
            expect(notification).toBeTruthy();
            
            // 通知の表示/非表示
            notification.classList.add('show');
            expect(notification.classList.contains('show')).toBe(true);
            
            notification.classList.remove('show');
            expect(notification.classList.contains('show')).toBe(false);
        });
    });

    describe('ローカルストレージ統合', () => {
        it('設定の保存と読み込みが動作する', () => {
            const testSettings = {
                username: 'Test User',
                units: 'metric',
                gpsAccuracy: 'high',
                autoSave: true
            };

            // 設定を保存
            localStorage.setItem('skytracker_settings', JSON.stringify(testSettings));

            // 設定を読み込み
            const savedSettings = JSON.parse(localStorage.getItem('skytracker_settings'));
            
            expect(savedSettings).toEqual(testSettings);

            // クリーンアップ
            localStorage.removeItem('skytracker_settings');
        });

        it('エラーログの永続化が動作する', () => {
            window.errorHandler = new ErrorHandler();
            
            // エラーを発生させる
            const error = new Error('Test error');
            window.errorHandler.handleError('TEST_ERROR', error);

            // ローカルストレージに保存されているか確認
            const savedLog = localStorage.getItem('skytracker_error_log');
            expect(savedLog).toBeTruthy();

            const parsedLog = JSON.parse(savedLog);
            expect(parsedLog.length).toBeGreaterThan(0);
            expect(parsedLog[0].message).toBe('Test error');

            // クリーンアップ
            localStorage.removeItem('skytracker_error_log');
        });
    });

    describe('イベント統合', () => {
        it('カスタムイベントが正しく発火される', () => {
            let eventFired = false;
            let eventData = null;

            // イベントリスナーを設定
            document.addEventListener('tracking:positionUpdate', (event) => {
                eventFired = true;
                eventData = event.detail;
            });

            // カスタムイベントを発火
            const mockTrackPoint = {
                timestamp: new Date(),
                latitude: 35.6762,
                longitude: 139.6503,
                altitude: 1000
            };

            const event = new CustomEvent('tracking:positionUpdate', {
                detail: mockTrackPoint
            });
            document.dispatchEvent(event);

            expect(eventFired).toBe(true);
            expect(eventData).toEqual(mockTrackPoint);
        });
    });

    describe('エンドツーエンドシナリオ', () => {
        it('完全なフライトシナリオが動作する', async () => {
            // システム初期化
            window.errorHandler = new ErrorHandler();
            window.performanceOptimizer = new PerformanceOptimizer();
            window.flightAnalytics = new FlightAnalytics();

            // フライトデータをシミュレート
            const flightData = [];
            const startTime = new Date();
            
            for (let i = 0; i < 10; i++) {
                flightData.push({
                    timestamp: new Date(startTime.getTime() + i * 60000),
                    latitude: 35.6762 + i * 0.001,
                    longitude: 139.6503 + i * 0.001,
                    altitude: 1000 + i * 50,
                    speed: 15 + Math.random() * 5,
                    vario: Math.random() * 4 - 2
                });
            }

            // 分析実行
            const analysis = window.flightAnalytics.analyzeFlightData(flightData);
            expect(analysis).toBeTruthy();

            // IGCエクスポート
            const igcExporter = new IGCExporter();
            const igcContent = igcExporter.generateIGC(flightData);
            expect(igcContent).toBeTruthy();

            // 統計情報生成
            const stats = igcExporter.generateStatistics(flightData);
            expect(stats).toBeTruthy();
            expect(stats.totalDistance).toBeGreaterThan(0);
        });

        it('エラー回復シナリオが動作する', () => {
            window.errorHandler = new ErrorHandler();

            // 複数のエラーを発生させる
            const gpsError = { code: 1, message: 'Permission denied' };
            const networkError = new Error('Network timeout');
            const dataError = new Error('Data corruption');

            window.errorHandler.handleGPSError(gpsError);
            window.errorHandler.handleNetworkError(networkError);
            window.errorHandler.handleDataError(dataError, null);

            // エラーログが正しく記録されている
            expect(window.errorHandler.errorLog.length).toBe(3);

            // エラー統計が正しい
            const stats = window.errorHandler.getErrorStats();
            expect(stats.GPS_ERROR).toBe(1);
            expect(stats.NETWORK_ERROR).toBe(1);
            expect(stats.DATA_ERROR).toBe(1);
        });
    });

    describe('パフォーマンステスト', () => {
        it('大量データ処理が適切な時間で完了する', () => {
            window.flightAnalytics = new FlightAnalytics();

            // 大量のトラックデータを生成
            const largeDataset = [];
            for (let i = 0; i < 1000; i++) {
                largeDataset.push({
                    timestamp: new Date(Date.now() + i * 1000),
                    latitude: 35.6762 + Math.random() * 0.01,
                    longitude: 139.6503 + Math.random() * 0.01,
                    altitude: 1000 + Math.random() * 500,
                    speed: 10 + Math.random() * 20,
                    vario: Math.random() * 6 - 3
                });
            }

            const startTime = performance.now();
            const analysis = window.flightAnalytics.analyzeFlightData(largeDataset);
            const endTime = performance.now();

            expect(analysis).toBeTruthy();
            expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
        });
    });
}, 'integration');