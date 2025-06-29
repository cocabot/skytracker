// パフォーマンス最適化システム
class PerformanceOptimizer {
    constructor() {
        this.metrics = {
            trackPoints: 0,
            memoryUsage: 0,
            renderTime: 0,
            gpsUpdateInterval: 1000
        };
        
        this.thresholds = {
            maxTrackPoints: 5000,
            maxMemoryMB: 100,
            maxRenderTime: 16, // 60fps = 16ms per frame
            minGpsInterval: 500,
            maxGpsInterval: 10000
        };
        
        this.optimizations = {
            trackPointThinning: false,
            memoryCleanup: false,
            adaptiveGpsInterval: true,
            lazyRendering: true
        };
        
        this.init();
    }

    init() {
        // パフォーマンス監視の開始
        this.startPerformanceMonitoring();
        
        // 適応的最適化の開始
        this.startAdaptiveOptimization();
        
        // バッテリー状態の監視
        this.monitorBatteryStatus();
        
        // ネットワーク状態の監視
        this.monitorNetworkStatus();
    }

    startPerformanceMonitoring() {
        // メモリ使用量の監視
        setInterval(() => {
            this.updateMemoryMetrics();
        }, 5000);

        // レンダリングパフォーマンスの監視
        this.setupRenderingMonitor();
        
        // GPS更新頻度の監視
        this.setupGpsMonitor();
    }

    updateMemoryMetrics() {
        if ('memory' in performance) {
            const memory = performance.memory;
            this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
            
            if (this.metrics.memoryUsage > this.thresholds.maxMemoryMB) {
                this.triggerMemoryCleanup();
            }
        }
    }

    setupRenderingMonitor() {
        let lastFrameTime = performance.now();
        
        const measureFrame = () => {
            const currentTime = performance.now();
            this.metrics.renderTime = currentTime - lastFrameTime;
            lastFrameTime = currentTime;
            
            if (this.metrics.renderTime > this.thresholds.maxRenderTime) {
                this.optimizeRendering();
            }
            
            requestAnimationFrame(measureFrame);
        };
        
        requestAnimationFrame(measureFrame);
    }

    setupGpsMonitor() {
        // GPS更新頻度の動的調整
        document.addEventListener('tracking:positionUpdate', () => {
            this.metrics.trackPoints++;
            this.optimizeGpsInterval();
        });
    }

    startAdaptiveOptimization() {
        setInterval(() => {
            this.performAdaptiveOptimization();
        }, 10000); // 10秒ごとに最適化チェック
    }

    performAdaptiveOptimization() {
        // トラックポイント数の最適化
        if (this.metrics.trackPoints > this.thresholds.maxTrackPoints) {
            this.optimizeTrackPoints();
        }
        
        // メモリ使用量の最適化
        if (this.metrics.memoryUsage > this.thresholds.maxMemoryMB * 0.8) {
            this.triggerMemoryCleanup();
        }
        
        // レンダリングの最適化
        if (this.metrics.renderTime > this.thresholds.maxRenderTime) {
            this.optimizeRendering();
        }
    }

    optimizeTrackPoints() {
        if (!this.optimizations.trackPointThinning) {
            this.optimizations.trackPointThinning = true;
            
            // トラックポイントの間引き
            if (window.skyTracker && window.skyTracker.trackData) {
                const originalLength = window.skyTracker.trackData.length;
                window.skyTracker.trackData = this.thinTrackPoints(
                    window.skyTracker.trackData, 
                    this.thresholds.maxTrackPoints * 0.8
                );
                
                const newLength = window.skyTracker.trackData.length;
                console.log(`Track points optimized: ${originalLength} -> ${newLength}`);
                
                // 地図の更新
                if (window.skyTracker.mapManager) {
                    window.skyTracker.mapManager.clearTrack();
                    window.skyTracker.trackData.forEach(point => {
                        window.skyTracker.mapManager.addTrackPoint(point);
                    });
                }
            }
        }
    }

    thinTrackPoints(points, maxPoints) {
        if (points.length <= maxPoints) {
            return points;
        }
        
        // Douglas-Peucker アルゴリズムの簡易版
        const step = Math.ceil(points.length / maxPoints);
        const thinned = [];
        
        for (let i = 0; i < points.length; i += step) {
            thinned.push(points[i]);
        }
        
        // 最後のポイントを確実に含める
        if (thinned[thinned.length - 1] !== points[points.length - 1]) {
            thinned.push(points[points.length - 1]);
        }
        
        return thinned;
    }

    triggerMemoryCleanup() {
        if (!this.optimizations.memoryCleanup) {
            this.optimizations.memoryCleanup = true;
            
            // 不要なデータの削除
            this.cleanupOldData();
            
            // ガベージコレクションの促進
            if (window.gc) {
                window.gc();
            }
            
            setTimeout(() => {
                this.optimizations.memoryCleanup = false;
            }, 30000);
        }
    }

    cleanupOldData() {
        try {
            // 古いエラーログの削除
            if (window.errorHandler) {
                const recentErrors = window.errorHandler.getRecentErrors(30);
                window.errorHandler.errorLog = recentErrors;
            }
            
            // 古いグループデータの削除
            const keys = Object.keys(localStorage);
            const oldKeys = keys.filter(key => {
                if (key.startsWith('skytracker_group_') || 
                    key.startsWith('skytracker_emergency_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        const hourAgo = Date.now() - (60 * 60 * 1000);
                        return data.timestamp < hourAgo;
                    } catch {
                        return true;
                    }
                }
                return false;
            });
            
            oldKeys.forEach(key => localStorage.removeItem(key));
            
            console.log(`Memory cleanup: removed ${oldKeys.length} old entries`);
        } catch (error) {
            console.error('Memory cleanup failed:', error);
        }
    }

    optimizeRendering() {
        if (this.optimizations.lazyRendering) {
            // レンダリング頻度の調整
            if (window.skyTracker && window.skyTracker.mapManager) {
                // 地図更新の間引き
                this.throttleMapUpdates();
            }
        }
    }

    throttleMapUpdates() {
        if (!this.mapUpdateThrottle) {
            this.mapUpdateThrottle = true;
            
            // 地図更新を500msに制限
            setTimeout(() => {
                this.mapUpdateThrottle = false;
            }, 500);
        }
    }

    optimizeGpsInterval() {
        if (!this.optimizations.adaptiveGpsInterval) {
            return;
        }
        
        // 移動速度に基づく間隔調整
        if (window.skyTracker && window.skyTracker.lastPosition) {
            const speed = window.skyTracker.lastPosition.speed || 0;
            let newInterval;
            
            if (speed < 1) { // 静止時
                newInterval = 5000;
            } else if (speed < 5) { // 低速移動
                newInterval = 2000;
            } else if (speed < 15) { // 中速移動
                newInterval = 1000;
            } else { // 高速移動
                newInterval = 500;
            }
            
            // バッテリー状態による調整
            if (this.batteryLevel < 0.2) {
                newInterval *= 2; // バッテリー低下時は間隔を倍に
            }
            
            this.metrics.gpsUpdateInterval = newInterval;
        }
    }

    monitorBatteryStatus() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then((battery) => {
                this.batteryLevel = battery.level;
                this.isCharging = battery.charging;
                
                // バッテリーレベルに応じた最適化
                this.optimizeForBattery();
                
                // バッテリー状態変更の監視
                battery.addEventListener('levelchange', () => {
                    this.batteryLevel = battery.level;
                    this.optimizeForBattery();
                });
                
                battery.addEventListener('chargingchange', () => {
                    this.isCharging = battery.charging;
                    this.optimizeForBattery();
                });
            });
        }
    }

    optimizeForBattery() {
        if (this.batteryLevel < 0.1 && !this.isCharging) {
            // 緊急省電力モード
            this.enablePowerSavingMode();
        } else if (this.batteryLevel < 0.2 && !this.isCharging) {
            // 省電力モード
            this.enableLowPowerMode();
        } else {
            // 通常モード
            this.enableNormalMode();
        }
    }

    enablePowerSavingMode() {
        console.log('Enabling emergency power saving mode');
        
        // GPS更新間隔を大幅に延長
        this.metrics.gpsUpdateInterval = 10000;
        
        // 地図更新を停止
        this.optimizations.lazyRendering = true;
        
        // 不要な機能を無効化
        if (window.skyTracker) {
            window.skyTracker.showNotification(
                'バッテリー残量が少ないため、省電力モードに切り替えました。', 
                'warning'
            );
        }
    }

    enableLowPowerMode() {
        console.log('Enabling low power mode');
        
        // GPS更新間隔を延長
        this.metrics.gpsUpdateInterval = 5000;
        
        // レンダリング最適化を有効化
        this.optimizations.lazyRendering = true;
    }

    enableNormalMode() {
        // 通常の設定に戻す
        this.metrics.gpsUpdateInterval = 1000;
        this.optimizations.lazyRendering = false;
    }

    monitorNetworkStatus() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            this.networkType = connection.effectiveType;
            
            this.optimizeForNetwork();
            
            connection.addEventListener('change', () => {
                this.networkType = connection.effectiveType;
                this.optimizeForNetwork();
            });
        }
        
        // オンライン/オフライン状態の監視
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.optimizeForNetwork();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.optimizeForNetwork();
        });
    }

    optimizeForNetwork() {
        if (!this.isOnline) {
            // オフライン時の最適化
            this.enableOfflineMode();
        } else if (this.networkType === 'slow-2g' || this.networkType === '2g') {
            // 低速回線時の最適化
            this.enableLowBandwidthMode();
        } else {
            // 通常モード
            this.enableNormalNetworkMode();
        }
    }

    enableOfflineMode() {
        console.log('Enabling offline mode optimizations');
        
        // 地図タイルの読み込みを停止
        if (window.skyTracker && window.skyTracker.mapManager) {
            // キャッシュされたタイルのみ使用
        }
    }

    enableLowBandwidthMode() {
        console.log('Enabling low bandwidth mode');
        
        // 地図品質を下げる
        // グループ更新頻度を下げる
    }

    enableNormalNetworkMode() {
        // 通常の設定に戻す
    }

    // パフォーマンス指標の取得
    getPerformanceMetrics() {
        return {
            ...this.metrics,
            batteryLevel: this.batteryLevel,
            isCharging: this.isCharging,
            networkType: this.networkType,
            isOnline: this.isOnline,
            optimizations: { ...this.optimizations }
        };
    }

    // 最適化設定の更新
    updateOptimizations(newOptimizations) {
        this.optimizations = { ...this.optimizations, ...newOptimizations };
    }

    // 閾値の更新
    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }

    // パフォーマンスレポートの生成
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.getPerformanceMetrics(),
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.memoryUsage > this.thresholds.maxMemoryMB * 0.8) {
            recommendations.push('メモリ使用量が高いです。古いデータの削除を検討してください。');
        }
        
        if (this.metrics.trackPoints > this.thresholds.maxTrackPoints * 0.8) {
            recommendations.push('トラックポイント数が多いです。データの間引きを検討してください。');
        }
        
        if (this.metrics.renderTime > this.thresholds.maxRenderTime) {
            recommendations.push('レンダリングが重いです。表示設定の調整を検討してください。');
        }
        
        if (this.batteryLevel < 0.2) {
            recommendations.push('バッテリー残量が少ないです。省電力モードの使用を検討してください。');
        }
        
        return recommendations;
    }

    // デバッグ用メソッド
    logPerformanceStats() {
        console.table(this.getPerformanceMetrics());
    }

    exportPerformanceData() {
        const data = this.generatePerformanceReport();
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `skytracker_performance_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// グローバルパフォーマンス最適化システムのインスタンス作成
window.performanceOptimizer = new PerformanceOptimizer();