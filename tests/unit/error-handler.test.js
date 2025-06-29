// ErrorHandler クラスのテスト
describe('ErrorHandler', () => {
    let errorHandler;

    beforeEach(() => {
        // 各テスト前にErrorHandlerの新しいインスタンスを作成
        errorHandler = new ErrorHandler();
        errorHandler.errorLog = []; // ログをクリア
    });

    describe('基本機能', () => {
        it('ErrorHandlerインスタンスが正しく作成される', () => {
            expect(errorHandler).toBeInstanceOf(ErrorHandler);
            expect(errorHandler.errorLog).toEqual([]);
            expect(errorHandler.maxLogSize).toBe(100);
        });

        it('エラータイプが正しく定義されている', () => {
            expect(errorHandler.errorTypes.GPS_ERROR).toBe('GPS_ERROR');
            expect(errorHandler.errorTypes.NETWORK_ERROR).toBe('NETWORK_ERROR');
            expect(errorHandler.errorTypes.DATA_ERROR).toBe('DATA_ERROR');
            expect(errorHandler.errorTypes.PERMISSION_ERROR).toBe('PERMISSION_ERROR');
            expect(errorHandler.errorTypes.STORAGE_ERROR).toBe('STORAGE_ERROR');
            expect(errorHandler.errorTypes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
        });
    });

    describe('エラーハンドリング', () => {
        it('基本的なエラーを正しく処理する', () => {
            const error = new Error('Test error');
            const errorInfo = errorHandler.handleError('TEST_ERROR', error);

            expect(errorInfo.type).toBe('TEST_ERROR');
            expect(errorInfo.message).toBe('Test error');
            expect(errorInfo.timestamp).toBeTruthy();
            expect(errorInfo.id).toBeTruthy();
            expect(errorHandler.errorLog).toHaveLength(1);
        });

        it('GPSエラーを正しく処理する', () => {
            const gpsError = {
                code: 1, // PERMISSION_DENIED
                message: 'Permission denied'
            };

            const errorInfo = errorHandler.handleGPSError(gpsError);

            expect(errorInfo.type).toBe('GPS_ERROR');
            expect(errorInfo.context.gpsErrorCode).toBe(1);
            expect(errorInfo.context.severity).toBe('error');
            expect(errorInfo.context.suggestions).toContain('ブラウザの設定で位置情報を許可してください');
        });

        it('ネットワークエラーを正しく処理する', () => {
            const networkError = new Error('Network error');
            const errorInfo = errorHandler.handleNetworkError(networkError);

            expect(errorInfo.type).toBe('NETWORK_ERROR');
            expect(errorInfo.context.isOnline).toBe(navigator.onLine);
        });

        it('データエラーを正しく処理する', () => {
            const dataError = new Error('Data corruption');
            const corruptedData = { invalid: 'data' };
            
            const errorInfo = errorHandler.handleDataError(dataError, corruptedData);

            expect(errorInfo.type).toBe('DATA_ERROR');
            expect(errorInfo.context.dataType).toBe('object');
            expect(errorInfo.context.dataSize).toBeGreaterThan(0);
        });
    });

    describe('データ検証', () => {
        it('正常なデータを正しく検証する', () => {
            const validData = {
                timestamp: new Date(),
                latitude: 35.6762,
                longitude: 139.6503
            };

            expect(errorHandler.isDataCorrupted(validData)).toBe(false);
        });

        it('破損したデータを正しく検出する', () => {
            const corruptedData = {
                timestamp: null,
                latitude: 'invalid',
                longitude: undefined
            };

            expect(errorHandler.isDataCorrupted(corruptedData)).toBe(true);
        });

        it('配列データの検証が正しく動作する', () => {
            const validArray = [
                { timestamp: new Date(), latitude: 35.6762, longitude: 139.6503 },
                { timestamp: new Date(), latitude: 35.6763, longitude: 139.6504 }
            ];

            const corruptedArray = [
                { timestamp: new Date(), latitude: 35.6762, longitude: 139.6503 },
                { timestamp: null, latitude: null, longitude: null }
            ];

            expect(errorHandler.isDataCorrupted(validArray)).toBe(false);
            expect(errorHandler.isDataCorrupted(corruptedArray)).toBe(true);
        });
    });

    describe('エラーログ管理', () => {
        it('エラーログが正しく追加される', () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');

            errorHandler.handleError('TEST_ERROR', error1);
            errorHandler.handleError('TEST_ERROR', error2);

            expect(errorHandler.errorLog).toHaveLength(2);
            expect(errorHandler.errorLog[0].message).toBe('Error 2'); // 新しいエラーが先頭
            expect(errorHandler.errorLog[1].message).toBe('Error 1');
        });

        it('ログサイズ制限が正しく動作する', () => {
            errorHandler.maxLogSize = 3;

            for (let i = 0; i < 5; i++) {
                errorHandler.handleError('TEST_ERROR', new Error(`Error ${i}`));
            }

            expect(errorHandler.errorLog).toHaveLength(3);
            expect(errorHandler.errorLog[0].message).toBe('Error 4');
            expect(errorHandler.errorLog[2].message).toBe('Error 2');
        });

        it('エラーログのクリアが正しく動作する', () => {
            errorHandler.handleError('TEST_ERROR', new Error('Test'));
            expect(errorHandler.errorLog).toHaveLength(1);

            errorHandler.clearErrorLog();
            expect(errorHandler.errorLog).toHaveLength(0);
        });
    });

    describe('エラー統計', () => {
        it('エラー統計が正しく計算される', () => {
            errorHandler.handleError('GPS_ERROR', new Error('GPS Error 1'));
            errorHandler.handleError('GPS_ERROR', new Error('GPS Error 2'));
            errorHandler.handleError('NETWORK_ERROR', new Error('Network Error'));

            const stats = errorHandler.getErrorStats();

            expect(stats.GPS_ERROR).toBe(2);
            expect(stats.NETWORK_ERROR).toBe(1);
        });

        it('最近のエラーフィルタリングが正しく動作する', () => {
            // 古いエラーを追加
            const oldError = {
                id: 'old_error',
                type: 'TEST_ERROR',
                message: 'Old error',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2時間前
            };
            errorHandler.errorLog.push(oldError);

            // 新しいエラーを追加
            errorHandler.handleError('TEST_ERROR', new Error('Recent error'));

            const recentErrors = errorHandler.getRecentErrors(60); // 過去60分
            expect(recentErrors).toHaveLength(1);
            expect(recentErrors[0].message).toBe('Recent error');
        });
    });

    describe('ストレージ関連', () => {
        it('ストレージ使用量が正しく計算される', () => {
            const usage = errorHandler.getStorageUsage();
            
            expect(usage.used).toBeGreaterThan(0);
            expect(usage.usedMB).toBeTruthy();
            expect(typeof usage.usedMB).toBe('string');
        });

        it('ストレージフル検出が動作する', () => {
            // この関数は実際のストレージ操作を行うため、モックが必要
            const originalSetItem = Storage.prototype.setItem;
            const originalRemoveItem = Storage.prototype.removeItem;

            // ストレージフルをシミュレート
            Storage.prototype.setItem = () => {
                throw new Error('QuotaExceededError');
            };

            expect(errorHandler.isStorageFull()).toBe(true);

            // 正常なストレージをシミュレート
            Storage.prototype.setItem = originalSetItem;
            Storage.prototype.removeItem = originalRemoveItem;

            expect(errorHandler.isStorageFull()).toBe(false);
        });
    });

    describe('エラーID生成', () => {
        it('ユニークなエラーIDが生成される', () => {
            const id1 = errorHandler.generateErrorId();
            const id2 = errorHandler.generateErrorId();

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
        });
    });

    describe('復旧機能', () => {
        it('バックアップからの復旧が動作する', () => {
            const backupData = JSON.stringify({
                timestamp: new Date().toISOString(),
                data: [{ test: 'data' }]
            });

            localStorage.setItem('skytracker_backup', backupData);

            const result = errorHandler.recoverFromBackup();
            expect(result).toBe(true);

            // クリーンアップ
            localStorage.removeItem('skytracker_backup');
            localStorage.removeItem('skytracker_autosave');
        });

        it('バックアップが存在しない場合の復旧処理', () => {
            localStorage.removeItem('skytracker_backup');

            const result = errorHandler.recoverFromBackup();
            expect(result).toBe(false);
        });
    });
}, 'unit');