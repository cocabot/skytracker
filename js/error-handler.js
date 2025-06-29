// 統一エラーハンドリングシステム
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.errorTypes = {
            GPS_ERROR: 'GPS_ERROR',
            NETWORK_ERROR: 'NETWORK_ERROR',
            DATA_ERROR: 'DATA_ERROR',
            PERMISSION_ERROR: 'PERMISSION_ERROR',
            STORAGE_ERROR: 'STORAGE_ERROR',
            VALIDATION_ERROR: 'VALIDATION_ERROR'
        };
        
        this.init();
    }

    init() {
        // グローバルエラーハンドラーの設定
        window.addEventListener('error', (event) => {
            this.handleError(this.errorTypes.DATA_ERROR, event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Promise rejection ハンドラー
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(this.errorTypes.DATA_ERROR, event.reason, {
                type: 'unhandled_promise_rejection'
            });
        });
    }

    handleError(type, error, context = {}) {
        const errorInfo = {
            id: this.generateErrorId(),
            type: type,
            message: error?.message || error || 'Unknown error',
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // エラーログに追加
        this.addToLog(errorInfo);

        // エラータイプに応じた処理
        this.processError(errorInfo);

        // ユーザーへの通知
        this.notifyUser(errorInfo);

        // デバッグ用コンソール出力
        console.error('SkyTracker Error:', errorInfo);

        return errorInfo;
    }

    handleGPSError(error, position = null) {
        let message = 'GPS信号を取得できません。';
        let severity = 'warning';
        let suggestions = [];

        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = '位置情報の許可が拒否されました。';
                severity = 'error';
                suggestions = [
                    'ブラウザの設定で位置情報を許可してください',
                    'プライベートモードの場合は通常モードで試してください'
                ];
                break;
            case error.POSITION_UNAVAILABLE:
                message = '位置情報が利用できません。';
                suggestions = [
                    '屋外で試してください',
                    'GPS機能が有効か確認してください',
                    'しばらく待ってから再試行してください'
                ];
                break;
            case error.TIMEOUT:
                message = 'GPS信号の取得がタイムアウトしました。';
                suggestions = [
                    '電波の良い場所に移動してください',
                    'デバイスを再起動してみてください'
                ];
                break;
        }

        return this.handleError(this.errorTypes.GPS_ERROR, error, {
            gpsErrorCode: error.code,
            accuracy: position?.coords?.accuracy,
            suggestions: suggestions,
            severity: severity,
            userMessage: message
        });
    }

    handleNetworkError(error, request = null) {
        const isOnline = navigator.onLine;
        let message = 'ネットワークエラーが発生しました。';
        let suggestions = [];

        if (!isOnline) {
            message = 'インターネット接続が切断されています。';
            suggestions = [
                'インターネット接続を確認してください',
                'オフラインモードで基本機能は利用できます'
            ];
        } else {
            suggestions = [
                'しばらく待ってから再試行してください',
                'ネットワーク接続を確認してください'
            ];
        }

        return this.handleError(this.errorTypes.NETWORK_ERROR, error, {
            isOnline: isOnline,
            requestUrl: request?.url,
            requestMethod: request?.method,
            suggestions: suggestions,
            userMessage: message
        });
    }

    handleDataError(error, data = null) {
        let message = 'データ処理中にエラーが発生しました。';
        let suggestions = [
            'アプリを再起動してください',
            'データをクリアして再試行してください'
        ];

        // データ破損の検出
        if (this.isDataCorrupted(data)) {
            message = 'データが破損している可能性があります。';
            suggestions = [
                'バックアップデータから復元してください',
                'データをクリアして新しく開始してください'
            ];
        }

        return this.handleError(this.errorTypes.DATA_ERROR, error, {
            dataType: typeof data,
            dataSize: data ? JSON.stringify(data).length : 0,
            isCorrupted: this.isDataCorrupted(data),
            suggestions: suggestions,
            userMessage: message
        });
    }

    handleStorageError(error, operation = null) {
        let message = 'データの保存中にエラーが発生しました。';
        let suggestions = [];

        // ストレージ容量チェック
        if (this.isStorageFull()) {
            message = 'ストレージ容量が不足しています。';
            suggestions = [
                '不要なデータを削除してください',
                'ブラウザのキャッシュをクリアしてください'
            ];
        } else {
            suggestions = [
                'しばらく待ってから再試行してください',
                'ブラウザを再起動してください'
            ];
        }

        return this.handleError(this.errorTypes.STORAGE_ERROR, error, {
            operation: operation,
            storageUsage: this.getStorageUsage(),
            suggestions: suggestions,
            userMessage: message
        });
    }

    handleValidationError(error, field = null, value = null) {
        const message = `入力データが正しくありません: ${error.message}`;
        
        return this.handleError(this.errorTypes.VALIDATION_ERROR, error, {
            field: field,
            value: value,
            userMessage: message
        });
    }

    processError(errorInfo) {
        // エラータイプに応じた自動復旧処理
        switch (errorInfo.type) {
            case this.errorTypes.GPS_ERROR:
                this.attemptGPSRecovery(errorInfo);
                break;
            case this.errorTypes.NETWORK_ERROR:
                this.attemptNetworkRecovery(errorInfo);
                break;
            case this.errorTypes.DATA_ERROR:
                this.attemptDataRecovery(errorInfo);
                break;
            case this.errorTypes.STORAGE_ERROR:
                this.attemptStorageRecovery(errorInfo);
                break;
        }
    }

    attemptGPSRecovery(errorInfo) {
        // GPS復旧の試行
        setTimeout(() => {
            if (window.skyTracker && window.skyTracker.isTracking) {
                console.log('Attempting GPS recovery...');
                // GPS再取得を試行
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.notifyRecovery('GPS信号が復旧しました。');
                    },
                    (error) => {
                        console.log('GPS recovery failed');
                    },
                    { timeout: 10000, enableHighAccuracy: false }
                );
            }
        }, 5000);
    }

    attemptNetworkRecovery(errorInfo) {
        // ネットワーク復旧の監視
        const checkConnection = () => {
            if (navigator.onLine) {
                this.notifyRecovery('ネットワーク接続が復旧しました。');
                return;
            }
            setTimeout(checkConnection, 5000);
        };
        
        if (!navigator.onLine) {
            setTimeout(checkConnection, 5000);
        }
    }

    attemptDataRecovery(errorInfo) {
        // データ復旧の試行
        if (errorInfo.context.isCorrupted) {
            this.recoverFromBackup();
        }
    }

    attemptStorageRecovery(errorInfo) {
        // ストレージ復旧の試行
        if (this.isStorageFull()) {
            this.cleanupOldData();
        }
    }

    recoverFromBackup() {
        try {
            const backup = localStorage.getItem('skytracker_backup');
            if (backup) {
                const backupData = JSON.parse(backup);
                localStorage.setItem('skytracker_autosave', backup);
                this.notifyRecovery('バックアップデータから復旧しました。');
                return true;
            }
        } catch (error) {
            console.error('Backup recovery failed:', error);
        }
        return false;
    }

    cleanupOldData() {
        try {
            // 古いデータの削除
            const keys = Object.keys(localStorage);
            const oldKeys = keys.filter(key => {
                if (key.startsWith('skytracker_group_') || 
                    key.startsWith('skytracker_emergency_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                        return data.timestamp < weekAgo;
                    } catch {
                        return true; // 破損データは削除
                    }
                }
                return false;
            });

            oldKeys.forEach(key => localStorage.removeItem(key));
            
            if (oldKeys.length > 0) {
                this.notifyRecovery(`${oldKeys.length}件の古いデータを削除しました。`);
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }

    notifyUser(errorInfo) {
        const message = errorInfo.context.userMessage || errorInfo.message;
        const severity = errorInfo.context.severity || 'error';
        
        if (window.skyTracker && window.skyTracker.showNotification) {
            window.skyTracker.showNotification(message, severity);
            
            // 提案がある場合は追加で表示
            if (errorInfo.context.suggestions && errorInfo.context.suggestions.length > 0) {
                setTimeout(() => {
                    const suggestions = errorInfo.context.suggestions.join('\n• ');
                    window.skyTracker.showNotification(`対処法:\n• ${suggestions}`, 'info');
                }, 2000);
            }
        }
    }

    notifyRecovery(message) {
        if (window.skyTracker && window.skyTracker.showNotification) {
            window.skyTracker.showNotification(message, 'success');
        }
    }

    addToLog(errorInfo) {
        this.errorLog.unshift(errorInfo);
        
        // ログサイズ制限
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        // ローカルストレージに保存
        try {
            localStorage.setItem('skytracker_error_log', JSON.stringify(this.errorLog));
        } catch (error) {
            console.warn('Failed to save error log:', error);
        }
    }

    generateErrorId() {
        return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    isDataCorrupted(data) {
        if (!data) return false;
        
        try {
            // 基本的なデータ構造チェック
            if (Array.isArray(data)) {
                return data.some(item => {
                    return !item || typeof item !== 'object' || 
                           !item.timestamp || !item.latitude || !item.longitude;
                });
            }
            
            if (typeof data === 'object') {
                // 必須フィールドのチェック
                const requiredFields = ['timestamp', 'latitude', 'longitude'];
                return requiredFields.some(field => !(field in data));
            }
            
            return false;
        } catch (error) {
            return true;
        }
    }

    isStorageFull() {
        try {
            const testKey = 'storage_test';
            const testData = 'x'.repeat(1024); // 1KB
            localStorage.setItem(testKey, testData);
            localStorage.removeItem(testKey);
            return false;
        } catch (error) {
            return true;
        }
    }

    getStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        return {
            used: totalSize,
            usedMB: (totalSize / 1024 / 1024).toFixed(2)
        };
    }

    getErrorLog() {
        return [...this.errorLog];
    }

    clearErrorLog() {
        this.errorLog = [];
        localStorage.removeItem('skytracker_error_log');
    }

    exportErrorLog() {
        const logData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            errors: this.errorLog
        };

        const blob = new Blob([JSON.stringify(logData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `skytracker_error_log_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // デバッグ用メソッド
    getErrorStats() {
        const stats = {};
        this.errorLog.forEach(error => {
            stats[error.type] = (stats[error.type] || 0) + 1;
        });
        return stats;
    }

    getRecentErrors(minutes = 60) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return this.errorLog.filter(error => 
            new Date(error.timestamp) > cutoff
        );
    }
}

// グローバルエラーハンドラーのインスタンス作成
window.errorHandler = new ErrorHandler();