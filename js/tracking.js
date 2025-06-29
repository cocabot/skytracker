// トラッキング機能の詳細実装
class TrackingManager {
    constructor() {
        this.isTracking = false;
        this.watchId = null;
        this.trackPoints = [];
        this.currentPosition = null;
        this.startTime = null;
        this.lastUpdateTime = null;
        this.totalDistance = 0;
        this.maxAltitude = 0;
        this.minAltitude = Infinity;
        this.maxSpeed = 0;
        this.maxClimbRate = 0;
        this.maxSinkRate = 0;
        
        // フィルタリング設定
        this.minAccuracy = 50; // メートル
        this.minTimeInterval = 1000; // ミリ秒
        this.minDistanceInterval = 5; // メートル
        
        // 平滑化設定
        this.altitudeBuffer = [];
        this.speedBuffer = [];
        this.bufferSize = 5;
        
        this.initializeTracking();
    }

    initializeTracking() {
        // 位置情報の精度設定
        this.geoOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        };

        // バックグラウンドでの位置追跡設定
        this.setupBackgroundTracking();
    }

    setupBackgroundTracking() {
        // Page Visibility APIを使用してバックグラウンド処理を管理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onPageHidden();
            } else {
                this.onPageVisible();
            }
        });

        // Service Workerでのバックグラウンド追跡（対応ブラウザのみ）
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
    }

    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
        } catch (error) {
            console.warn('Service Worker registration failed:', error);
        }
    }

    onPageHidden() {
        if (this.isTracking) {
            // バックグラウンドでの追跡設定を調整
            this.geoOptions.timeout = 30000;
            this.geoOptions.maximumAge = 10000;
        }
    }

    onPageVisible() {
        if (this.isTracking) {
            // フォアグラウンドでの高精度追跡に戻す
            this.geoOptions.timeout = 15000;
            this.geoOptions.maximumAge = 0;
        }
    }

    startTracking() {
        if (this.isTracking) {
            return false;
        }

        if (!navigator.geolocation) {
            throw new Error('このブラウザは位置情報をサポートしていません。');
        }

        this.isTracking = true;
        this.startTime = new Date();
        this.lastUpdateTime = this.startTime;
        this.trackPoints = [];
        this.totalDistance = 0;
        this.maxAltitude = 0;
        this.minAltitude = Infinity;
        this.maxSpeed = 0;
        this.maxClimbRate = 0;
        this.maxSinkRate = 0;

        // 位置監視開始
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionSuccess(position),
            (error) => this.handlePositionError(error),
            this.geoOptions
        );

        // 定期的な統計更新
        this.statsInterval = setInterval(() => {
            this.updateStatistics();
        }, 1000);

        return true;
    }

    stopTracking() {
        if (!this.isTracking) {
            return false;
        }

        this.isTracking = false;

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        return true;
    }

    handlePositionSuccess(position) {
        const coords = position.coords;
        const timestamp = new Date(position.timestamp);

        // 精度チェック
        if (coords.accuracy > this.minAccuracy) {
            console.warn('Low accuracy position ignored:', coords.accuracy);
            return;
        }

        // 時間間隔チェック
        if (this.lastUpdateTime && (timestamp - this.lastUpdateTime) < this.minTimeInterval) {
            return;
        }

        const trackPoint = {
            timestamp: timestamp,
            latitude: coords.latitude,
            longitude: coords.longitude,
            altitude: coords.altitude || 0,
            accuracy: coords.accuracy,
            speed: coords.speed || 0,
            heading: coords.heading || 0
        };

        // 距離間隔チェック
        if (this.currentPosition) {
            const distance = this.calculateDistance(
                this.currentPosition.latitude,
                this.currentPosition.longitude,
                trackPoint.latitude,
                trackPoint.longitude
            );

            if (distance < this.minDistanceInterval) {
                return;
            }

            this.totalDistance += distance;
        }

        // 高度と速度の平滑化
        this.smoothTrackPoint(trackPoint);

        // 上昇率計算
        this.calculateVario(trackPoint);

        // 統計更新
        this.updateTrackStatistics(trackPoint);

        // トラックポイントを追加
        this.trackPoints.push(trackPoint);
        this.currentPosition = trackPoint;
        this.lastUpdateTime = timestamp;

        // イベント発火
        this.dispatchTrackingEvent('positionUpdate', trackPoint);
    }

    handlePositionError(error) {
        let errorMessage = 'GPS信号を取得できません。';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = '位置情報の許可が拒否されました。';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = '位置情報が利用できません。';
                break;
            case error.TIMEOUT:
                errorMessage = 'GPS信号の取得がタイムアウトしました。';
                break;
        }

        this.dispatchTrackingEvent('positionError', { error, message: errorMessage });
    }

    smoothTrackPoint(trackPoint) {
        // 高度の平滑化
        this.altitudeBuffer.push(trackPoint.altitude);
        if (this.altitudeBuffer.length > this.bufferSize) {
            this.altitudeBuffer.shift();
        }
        trackPoint.smoothedAltitude = this.calculateAverage(this.altitudeBuffer);

        // 速度の平滑化
        this.speedBuffer.push(trackPoint.speed);
        if (this.speedBuffer.length > this.bufferSize) {
            this.speedBuffer.shift();
        }
        trackPoint.smoothedSpeed = this.calculateAverage(this.speedBuffer);
    }

    calculateVario(trackPoint) {
        if (!this.currentPosition) {
            trackPoint.vario = 0;
            return;
        }

        const timeDiff = (trackPoint.timestamp - this.currentPosition.timestamp) / 1000; // 秒
        const altDiff = trackPoint.smoothedAltitude - this.currentPosition.smoothedAltitude;
        
        trackPoint.vario = timeDiff > 0 ? altDiff / timeDiff : 0;

        // 異常値フィルタリング
        if (Math.abs(trackPoint.vario) > 20) { // 20m/s以上の変化は異常値として除外
            trackPoint.vario = this.currentPosition.vario || 0;
        }
    }

    updateTrackStatistics(trackPoint) {
        // 最大・最小高度
        this.maxAltitude = Math.max(this.maxAltitude, trackPoint.smoothedAltitude);
        this.minAltitude = Math.min(this.minAltitude, trackPoint.smoothedAltitude);

        // 最大速度
        this.maxSpeed = Math.max(this.maxSpeed, trackPoint.smoothedSpeed);

        // 最大上昇・下降率
        if (trackPoint.vario > 0) {
            this.maxClimbRate = Math.max(this.maxClimbRate, trackPoint.vario);
        } else {
            this.maxSinkRate = Math.max(this.maxSinkRate, Math.abs(trackPoint.vario));
        }
    }

    updateStatistics() {
        if (!this.isTracking || !this.startTime) {
            return;
        }

        const now = new Date();
        const flightTime = now - this.startTime;
        
        const stats = {
            flightTime: flightTime,
            totalDistance: this.totalDistance,
            maxAltitude: this.maxAltitude,
            minAltitude: this.minAltitude === Infinity ? 0 : this.minAltitude,
            maxSpeed: this.maxSpeed,
            maxClimbRate: this.maxClimbRate,
            maxSinkRate: this.maxSinkRate,
            averageSpeed: this.calculateAverageSpeed(),
            pointCount: this.trackPoints.length
        };

        this.dispatchTrackingEvent('statisticsUpdate', stats);
    }

    calculateAverageSpeed() {
        if (this.trackPoints.length === 0) {
            return 0;
        }

        const totalSpeed = this.trackPoints.reduce((sum, point) => sum + point.smoothedSpeed, 0);
        return totalSpeed / this.trackPoints.length;
    }

    calculateAverage(array) {
        if (array.length === 0) return 0;
        return array.reduce((sum, value) => sum + value, 0) / array.length;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // 地球の半径（メートル）
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // イベント管理
    dispatchTrackingEvent(type, data) {
        const event = new CustomEvent(`tracking:${type}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    // トラックデータの取得
    getTrackData() {
        return {
            points: [...this.trackPoints],
            startTime: this.startTime,
            totalDistance: this.totalDistance,
            statistics: {
                maxAltitude: this.maxAltitude,
                minAltitude: this.minAltitude === Infinity ? 0 : this.minAltitude,
                maxSpeed: this.maxSpeed,
                maxClimbRate: this.maxClimbRate,
                maxSinkRate: this.maxSinkRate,
                averageSpeed: this.calculateAverageSpeed(),
                pointCount: this.trackPoints.length
            }
        };
    }

    // トラックデータのクリア
    clearTrackData() {
        this.trackPoints = [];
        this.currentPosition = null;
        this.startTime = null;
        this.lastUpdateTime = null;
        this.totalDistance = 0;
        this.maxAltitude = 0;
        this.minAltitude = Infinity;
        this.maxSpeed = 0;
        this.maxClimbRate = 0;
        this.maxSinkRate = 0;
        this.altitudeBuffer = [];
        this.speedBuffer = [];
    }

    // 設定の更新
    updateSettings(settings) {
        if (settings.minAccuracy !== undefined) {
            this.minAccuracy = settings.minAccuracy;
        }
        if (settings.minTimeInterval !== undefined) {
            this.minTimeInterval = settings.minTimeInterval;
        }
        if (settings.minDistanceInterval !== undefined) {
            this.minDistanceInterval = settings.minDistanceInterval;
        }
        if (settings.bufferSize !== undefined) {
            this.bufferSize = settings.bufferSize;
        }
    }

    // 自動保存機能
    enableAutoSave(interval = 30000) { // 30秒間隔
        this.autoSaveInterval = setInterval(() => {
            if (this.isTracking && this.trackPoints.length > 0) {
                this.saveTrackData();
            }
        }, interval);
    }

    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    saveTrackData() {
        const trackData = this.getTrackData();
        const saveData = {
            ...trackData,
            savedAt: new Date().toISOString()
        };
        
        localStorage.setItem('skytracker_autosave_track', JSON.stringify(saveData));
    }

    loadTrackData() {
        const saved = localStorage.getItem('skytracker_autosave_track');
        if (saved) {
            try {
                const trackData = JSON.parse(saved);
                return trackData;
            } catch (error) {
                console.error('Failed to load track data:', error);
                return null;
            }
        }
        return null;
    }

    // バッテリー最適化
    optimizeForBattery() {
        // バッテリー残量に応じて追跡精度を調整
        if ('getBattery' in navigator) {
            navigator.getBattery().then((battery) => {
                if (battery.level < 0.2) { // 20%以下
                    this.geoOptions.timeout = 30000;
                    this.geoOptions.maximumAge = 15000;
                    this.minTimeInterval = 5000;
                } else if (battery.level < 0.5) { // 50%以下
                    this.geoOptions.timeout = 20000;
                    this.geoOptions.maximumAge = 5000;
                    this.minTimeInterval = 2000;
                }
            });
        }
    }

    // ネットワーク状態に応じた最適化
    optimizeForNetwork() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                // 低速回線では更新頻度を下げる
                this.minTimeInterval = 10000;
            } else if (connection.effectiveType === '3g') {
                this.minTimeInterval = 5000;
            }
        }
    }

    // 位置精度の動的調整
    adjustAccuracyBasedOnMovement() {
        if (this.trackPoints.length < 2) {
            return;
        }

        const recentPoints = this.trackPoints.slice(-5);
        const speeds = recentPoints.map(p => p.smoothedSpeed);
        const avgSpeed = this.calculateAverage(speeds);

        if (avgSpeed < 1) { // 1m/s以下（ほぼ静止）
            this.minAccuracy = 20; // 高精度要求
            this.minTimeInterval = 5000; // 更新頻度を下げる
        } else if (avgSpeed > 10) { // 10m/s以上（高速移動）
            this.minAccuracy = 100; // 精度要求を緩和
            this.minTimeInterval = 1000; // 高頻度更新
        } else {
            this.minAccuracy = 50; // 標準精度
            this.minTimeInterval = 2000; // 標準更新頻度
        }
    }

    // デバッグ情報の取得
    getDebugInfo() {
        return {
            isTracking: this.isTracking,
            watchId: this.watchId,
            trackPointsCount: this.trackPoints.length,
            currentPosition: this.currentPosition,
            totalDistance: this.totalDistance,
            geoOptions: this.geoOptions,
            bufferSizes: {
                altitude: this.altitudeBuffer.length,
                speed: this.speedBuffer.length
            }
        };
    }
}