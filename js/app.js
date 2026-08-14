// メインアプリケーションクラス
class SkyTracker {
    constructor() {
        this.isTracking = false;
        this.trackData = [];
        this.startTime = null;
        this.lastPosition = null;
        this.totalDistance = 0;
        this.settings = this.loadSettings();
        this.groupManager = this.createGroupManager();
        this.wakeLock = null;
        this.sheetExpanded = false;
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.initializeMap();
        this.startTimeUpdate();
        this.loadUserSettings();
        
        // 位置情報の許可を確認
        this.checkGeolocationPermission();
    }

    initializeElements() {
        // DOM要素の取得
        this.elements = {
            trackingBtn: document.getElementById('trackingBtn'),
            trackingStatus: document.getElementById('trackingStatus'),
            currentTime: document.getElementById('currentTime'),
            altitude: document.getElementById('altitude'),
            speed: document.getElementById('speed'),
            vario: document.getElementById('vario'),
            flightTime: document.getElementById('flightTime'),
            distance: document.getElementById('distance'),
            exportBtn: document.getElementById('exportBtn'),
            analyticsBtn: document.getElementById('analyticsBtn'),
            shareBtn: document.getElementById('shareBtn'),
            clearBtn: document.getElementById('clearBtn'),
            groupBtn: document.getElementById('groupBtn'),
            raceBtn: document.getElementById('raceBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            groupPanel: document.getElementById('groupPanel'),
            settingsPanel: document.getElementById('settingsPanel'),
            overlay: document.getElementById('overlay'),
            notification: document.getElementById('notification'),
            centerBtn: document.getElementById('centerBtn'),
            layerBtn: document.getElementById('layerBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            infoPanel: document.getElementById('infoPanel'),
            flightDeck: document.getElementById('flightDeck'),
            fdAlt: document.getElementById('fdAlt'),
            fdVario: document.getElementById('fdVario'),
            fdGs: document.getElementById('fdGs'),
            fdHdg: document.getElementById('fdHdg'),
            dockRec: document.getElementById('dockRec'),
            flightDock: document.getElementById('flightDock'),
            menuSheet: document.getElementById('menuSheet')
        };
        this.bindFieldControls();
    }

    bindFieldControls() {
        document.getElementById('sheetHandle')?.addEventListener('click', () => this.toggleSheet());
        document.getElementById('dockRec')?.addEventListener('click', () => this.toggleTracking());
        document.getElementById('dockLocate')?.addEventListener('click', () => {
            this.settings.follow = true;
            if (this.mapManager) this.mapManager.followPosition = true;
            const follow = document.getElementById('followCheck');
            if (follow) follow.checked = true;
            const raceFollow = document.getElementById('toggleFollowRace');
            if (raceFollow) raceFollow.checked = true;
            this.mapManager?.centerOnCurrentPosition();
        });
        document.getElementById('dockDeck')?.addEventListener('click', () => this.toggleSheet());
        document.getElementById('dockRace')?.addEventListener('click', () => {
            this.closeMenuSheet();
            this.togglePanel('race');
        });
        document.getElementById('dockMenu')?.addEventListener('click', () => this.toggleMenuSheet());
        document.getElementById('menuGroupBtn')?.addEventListener('click', () => {
            this.closeMenuSheet();
            this.togglePanel('group');
        });
        document.getElementById('menuSettingsBtn')?.addEventListener('click', () => {
            this.closeMenuSheet();
            this.togglePanel('settings');
        });
        document.getElementById('menuExportBtn')?.addEventListener('click', () => {
            this.closeMenuSheet();
            this.exportIGC();
        });
        document.getElementById('menuFullscreenBtn')?.addEventListener('click', () => {
            this.closeMenuSheet();
            this.toggleFullscreen();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isTracking && this.settings.wakeLock) {
                this.requestWakeLock();
            }
        });
    }

    toggleSheet() {
        this.sheetExpanded = !this.sheetExpanded;
        this.elements.infoPanel?.classList.toggle('expanded', this.sheetExpanded);
        document.getElementById('dockDeck')?.classList.toggle('active', this.sheetExpanded);
    }

    toggleMenuSheet() {
        const sheet = this.elements.menuSheet;
        if (!sheet) return;
        sheet.classList.toggle('open');
        document.getElementById('dockMenu')?.classList.toggle('active', sheet.classList.contains('open'));
    }

    closeMenuSheet() {
        this.elements.menuSheet?.classList.remove('open');
        document.getElementById('dockMenu')?.classList.remove('active');
    }

    async requestWakeLock() {
        if (!this.settings.wakeLock || !navigator.wakeLock) return;
        try {
            this.releaseWakeLock();
            this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (error) {
            console.warn('Wake Lock failed', error);
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release().catch(() => {});
            this.wakeLock = null;
        }
    }

    bindEvents() {
        // トラッキングボタン
        this.elements.trackingBtn.addEventListener('click', () => {
            this.toggleTracking();
        });

        // エクスポートボタン
        this.elements.exportBtn.addEventListener('click', () => {
            this.exportIGC();
        });

        // 分析ボタン
        this.elements.analyticsBtn.addEventListener('click', () => {
            this.showAnalysis();
        });

        // 共有ボタン
        this.elements.shareBtn.addEventListener('click', () => {
            this.shareTrack();
        });

        // クリアボタン
        this.elements.clearBtn.addEventListener('click', () => {
            this.clearTrack();
        });

        // レースボタン
        if (this.elements.raceBtn) {
            this.elements.raceBtn.addEventListener('click', () => {
                this.togglePanel('race');
            });
        }

        // グループボタン
        this.elements.groupBtn.addEventListener('click', () => {
            this.togglePanel('group');
        });

        // 設定ボタン
        this.elements.settingsBtn.addEventListener('click', () => {
            this.togglePanel('settings');
        });

        // パネルクローズボタン
        document.getElementById('closeGroupPanel').addEventListener('click', () => {
            this.closePanel('group');
        });

        document.getElementById('closeSettingsPanel').addEventListener('click', () => {
            this.closePanel('settings');
        });

        document.getElementById('addTestMembersBtn')?.addEventListener('click', () => {
            this.groupManager.addTestMembers?.();
        });
        document.getElementById('groupDebugBtn')?.addEventListener('click', () => {
            this.groupManager.showDebugInfo?.();
        });

        // オーバーレイクリック
        this.elements.overlay.addEventListener('click', () => {
            this.closeAllPanels();
        });

        // 地図コントロール
        this.elements.centerBtn.addEventListener('click', () => {
            this.mapManager.centerOnCurrentPosition();
        });

        this.elements.layerBtn.addEventListener('click', () => {
            this.mapManager.toggleLayer();
        });

        this.elements.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 設定変更
        document.getElementById('usernameInput').addEventListener('change', (e) => {
            this.settings.username = e.target.value;
            this.saveSettings();
        });

        document.getElementById('unitSelect').addEventListener('change', (e) => {
            this.settings.units = e.target.value;
            this.saveSettings();
            this.updateDisplay();
        });

        document.getElementById('gpsAccuracySelect').addEventListener('change', (e) => {
            this.settings.gpsAccuracy = e.target.value;
            this.saveSettings();
        });

        document.getElementById('autoSaveCheck').addEventListener('change', (e) => {
            this.settings.autoSave = e.target.checked;
            this.saveSettings();
        });
        document.getElementById('wakeLockCheck')?.addEventListener('change', (e) => {
            this.settings.wakeLock = e.target.checked;
            this.saveSettings();
            if (this.isTracking && this.settings.wakeLock) this.requestWakeLock();
            else this.releaseWakeLock();
        });
        document.getElementById('followCheck')?.addEventListener('change', (e) => {
            this.settings.follow = e.target.checked;
            this.saveSettings();
            if (this.mapManager) this.mapManager.followPosition = e.target.checked;
            const raceFollow = document.getElementById('toggleFollowRace');
            if (raceFollow) raceFollow.checked = e.target.checked;
        });

        // 通知クローズ
        document.querySelector('.notification-close').addEventListener('click', () => {
            this.hideNotification();
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllPanels();
            } else if (e.key === ' ' && e.ctrlKey) {
                e.preventDefault();
                this.toggleTracking();
            }
        });
    }

    initializeMap() {
        this.mapManager = new MapManager('map');
        
        // 地図拡張機能を初期化
        if (window.MapExtensions) {
            this.mapExtensions = new MapExtensions(this.mapManager);
            window.mapExtensions = this.mapExtensions; // グローバルアクセス用
        }

        // データインポート機能を初期化
        if (window.DataImporter) {
            this.dataImporter = new DataImporter();
        }

        // データバックアップ機能を初期化
        if (window.DataBackup) {
            this.dataBackup = new DataBackup();
            window.dataBackup = this.dataBackup;
        }

        if (window.RaceUI) {
            this.raceUI = new RaceUI(this);
            this.raceUI.startAutoRefresh();
            this.raceUI.refreshWeather(true);
        }
    }

    async checkGeolocationPermission() {
        if (!navigator.geolocation) {
            this.showNotification('このブラウザは位置情報をサポートしていません。', 'error');
            return;
        }

        try {
            const permission = await navigator.permissions.query({name: 'geolocation'});
            if (permission.state === 'denied') {
                this.showNotification('位置情報の許可が必要です。ブラウザの設定を確認してください。', 'warning');
            }
        } catch (error) {
            console.warn('Permission API not supported');
        }
    }

    toggleTracking() {
        if (this.isTracking) {
            this.stopTracking();
        } else {
            this.startTracking();
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            this.showNotification('位置情報がサポートされていません。', 'error');
            return;
        }

        this.isTracking = true;
        this.startTime = new Date();
        this.trackData = [];
        this.totalDistance = 0;
        this.lastPosition = null;

        // UI更新
        this.updateTrackingUI();
        this.enableButtons();

        // 位置情報の監視開始
        const options = {
            enableHighAccuracy: this.settings.gpsAccuracy === 'high',
            timeout: 10000,
            maximumAge: this.settings.gpsAccuracy === 'high' ? 0 : 30000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handlePositionError(error),
            options
        );

        this.showNotification('トラッキングを開始しました。', 'success');
        this.requestWakeLock();
        this.elements.dockRec?.classList.add('recording');
    }

    stopTracking() {
        this.isTracking = false;

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // UI更新
        this.updateTrackingUI();

        // 自動保存
        if (this.settings.autoSave && this.trackData.length > 0) {
            this.autoSaveTrack();
        }

        this.showNotification('トラッキングを停止しました。', 'info');
        this.releaseWakeLock();
        this.elements.dockRec?.classList.remove('recording');
    }

    handlePositionUpdate(position) {
        const coords = position.coords;
        const timestamp = new Date(position.timestamp);

        const trackPoint = {
            timestamp: timestamp,
            latitude: coords.latitude,
            longitude: coords.longitude,
            altitude: coords.altitude || 0,
            accuracy: coords.accuracy,
            speed: coords.speed || 0,
            heading: coords.heading || 0
        };

        // 上昇率計算
        if (this.lastPosition) {
            const timeDiff = (timestamp - this.lastPosition.timestamp) / 1000; // 秒
            const altDiff = trackPoint.altitude - this.lastPosition.altitude;
            trackPoint.vario = timeDiff > 0 ? altDiff / timeDiff : 0;

            // 距離計算
            const distance = this.calculateDistance(
                this.lastPosition.latitude,
                this.lastPosition.longitude,
                trackPoint.latitude,
                trackPoint.longitude
            );
            this.totalDistance += distance;
        } else {
            trackPoint.vario = 0;
        }

        this.trackData.push(trackPoint);
        this.lastPosition = trackPoint;

        // 地図更新
        this.mapManager.addTrackPoint(trackPoint);
        this.mapManager.updateCurrentPosition(trackPoint);

        // 表示更新
        this.updateFlightInfo(trackPoint);

        // グループ共有
        if (this.groupManager.isInGroup()) {
            this.groupManager.sharePosition(trackPoint);
        }

        // 飛行制限チェック
        if (this.mapExtensions) {
            this.mapExtensions.checkFlightRestrictions({
                lat: trackPoint.latitude,
                lng: trackPoint.longitude
            });
        }

        if (this.raceUI) {
            this.raceUI.onPosition(trackPoint, this.trackData);
        }
    }

    handlePositionError(error) {
        // 統一エラーハンドラーを使用
        if (window.errorHandler) {
            window.errorHandler.handleGPSError(error);
        } else {
            // フォールバック処理
            let message = 'GPS信号を取得できません。';
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = '位置情報の許可が拒否されました。';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = '位置情報が利用できません。';
                    break;
                case error.TIMEOUT:
                    message = 'GPS信号の取得がタイムアウトしました。';
                    break;
            }

            this.showNotification(message, 'error');
        }
        console.error('Geolocation error:', error);
    }

    updateTrackingUI() {
        const btn = this.elements.trackingBtn;
        const status = this.elements.trackingStatus;
        const statusIndicator = status.querySelector('.status-indicator');
        const statusText = status.querySelector('.status-text');

        if (this.isTracking) {
            btn.innerHTML = '<i class="fas fa-stop"></i><span>トラッキング停止</span>';
            btn.classList.add('active');
            statusIndicator.classList.add('active');
            statusText.textContent = 'トラッキング中';
        } else {
            btn.innerHTML = '<i class="fas fa-play"></i><span>トラッキング開始</span>';
            btn.classList.remove('active');
            statusIndicator.classList.remove('active');
            statusText.textContent = '待機中';
        }
    }

    updateFlightInfo(trackPoint) {
        // 高度
        const altitude = this.convertAltitude(trackPoint.altitude);
        this.elements.altitude.textContent = `${altitude.toFixed(0)} ${this.getAltitudeUnit()}`;

        // スピード
        const speed = this.convertSpeed(trackPoint.speed * 3.6); // m/s to km/h
        this.elements.speed.textContent = `${speed.toFixed(1)} ${this.getSpeedUnit()}`;

        // 上昇率
        const vario = this.convertVario(trackPoint.vario);
        this.elements.vario.textContent = `${vario >= 0 ? '+' : ''}${vario.toFixed(1)} ${this.getVarioUnit()}`;

        // 飛行時間
        if (this.startTime) {
            const flightTime = new Date() - this.startTime;
            this.elements.flightTime.textContent = this.formatDuration(flightTime);
        }

        // 距離
        const distance = this.convertDistance(this.totalDistance);
        this.elements.distance.textContent = `${distance.toFixed(2)} ${this.getDistanceUnit()}`;
        this.updateFlightDeck(trackPoint, altitude, speed, vario);
    }

    updateFlightDeck(trackPoint, altitude, speed, vario) {
        if (this.elements.fdAlt) {
            this.elements.fdAlt.textContent = `${altitude.toFixed(0)}`;
        }
        if (this.elements.fdVario) {
            this.elements.fdVario.textContent = `${vario >= 0 ? '+' : ''}${vario.toFixed(1)}`;
            this.elements.fdVario.parentElement?.classList.toggle('up', vario >= 0.3);
            this.elements.fdVario.parentElement?.classList.toggle('down', vario <= -0.3);
        }
        if (this.elements.fdGs) {
            this.elements.fdGs.textContent = `${speed.toFixed(0)}`;
        }
        if (this.elements.fdHdg) {
            const hdg = Number(trackPoint.heading);
            this.elements.fdHdg.textContent = Number.isFinite(hdg) && hdg >= 0 ? `${hdg.toFixed(0)}°` : '---';
        }
    }

    startTimeUpdate() {
        setInterval(() => {
            const now = new Date();
            this.elements.currentTime.textContent = now.toLocaleTimeString('ja-JP');
        }, 1000);
    }

    enableButtons() {
        this.elements.exportBtn.disabled = false;
        this.elements.analyticsBtn.disabled = false;
        this.elements.shareBtn.disabled = false;
        this.elements.clearBtn.disabled = false;
    }

    disableButtons() {
        this.elements.exportBtn.disabled = true;
        this.elements.analyticsBtn.disabled = true;
        this.elements.shareBtn.disabled = true;
        this.elements.clearBtn.disabled = true;
    }

    exportIGC() {
        if (this.trackData.length === 0) {
            this.showNotification('エクスポートするトラックデータがありません。', 'warning');
            return;
        }

        try {
            const igcExporter = new IGCExporter();
            const igcContent = igcExporter.generateIGC(this.trackData, this.settings);
            
            const blob = new Blob([igcContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `skytracker_${new Date().toISOString().split('T')[0]}.igc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('IGCファイルをダウンロードしました。', 'success');
        } catch (error) {
            if (window.errorHandler) {
                window.errorHandler.handleDataError(error, this.trackData);
            } else {
                this.showNotification('IGCファイルの生成に失敗しました。', 'error');
                console.error('IGC export error:', error);
            }
        }
    }

    showAnalysis() {
        if (this.trackData.length === 0) {
            this.showNotification('分析するトラックデータがありません。', 'warning');
            return;
        }

        if (window.flightAnalytics) {
            window.flightAnalytics.showAnalysis(this.trackData);
        } else {
            this.showNotification('分析機能が利用できません。', 'error');
        }
    }

    shareTrack() {
        if (this.trackData.length === 0) {
            this.showNotification('共有するトラックデータがありません。', 'warning');
            return;
        }

        // Web Share API対応チェック
        if (navigator.share) {
            const trackSummary = this.generateTrackSummary();
            navigator.share({
                title: 'SkyTracker フライトログ',
                text: trackSummary,
                url: window.location.href
            }).catch(console.error);
        } else {
            // フォールバック: クリップボードにコピー
            const trackSummary = this.generateTrackSummary();
            navigator.clipboard.writeText(trackSummary).then(() => {
                this.showNotification('フライト情報をクリップボードにコピーしました。', 'success');
            }).catch(() => {
                this.showNotification('共有に失敗しました。', 'error');
            });
        }
    }

    generateTrackSummary() {
        const duration = this.startTime ? new Date() - this.startTime : 0;
        const maxAltitude = Math.max(...this.trackData.map(p => p.altitude));
        const distance = this.convertDistance(this.totalDistance);
        
        return `SkyTracker フライトログ
飛行時間: ${this.formatDuration(duration)}
最高高度: ${this.convertAltitude(maxAltitude).toFixed(0)} ${this.getAltitudeUnit()}
飛行距離: ${distance.toFixed(2)} ${this.getDistanceUnit()}
ポイント数: ${this.trackData.length}`;
    }

    clearTrack() {
        if (this.isTracking) {
            this.stopTracking();
        }

        this.trackData = [];
        this.totalDistance = 0;
        this.lastPosition = null;
        this.startTime = null;

        // 地図クリア
        this.mapManager.clearTrack();

        // UI リセット
        this.elements.altitude.textContent = '--- m';
        this.elements.speed.textContent = '--- km/h';
        this.elements.vario.textContent = '--- m/s';
        this.elements.flightTime.textContent = '00:00:00';
        this.elements.distance.textContent = '--- km';

        this.disableButtons();
        this.showNotification('トラックデータをクリアしました。', 'info');
    }

    autoSaveTrack() {
        const trackData = {
            timestamp: new Date().toISOString(),
            data: this.trackData,
            settings: this.settings
        };
        
        localStorage.setItem('skytracker_autosave', JSON.stringify(trackData));
    }

    loadAutoSavedTrack() {
        const saved = localStorage.getItem('skytracker_autosave');
        if (saved) {
            try {
                const trackData = JSON.parse(saved);
                // 自動保存されたデータの復元処理
                this.showNotification('前回のトラックデータを復元しますか？', 'info');
            } catch (error) {
                console.error('Failed to load auto-saved track:', error);
            }
        }
    }

    createGroupManager() {
        if (typeof P2PGroupManager === 'function') {
            return new P2PGroupManager();
        }
        if (typeof EnhancedGroupManager === 'function') {
            return new EnhancedGroupManager();
        }
        if (typeof GroupManager === 'function') {
            return new GroupManager();
        }
        return { isInGroup: () => false, sharePosition() {}, addTestMembers() {}, showDebugInfo() {} };
    }

    getPanel(panelType) {
        if (panelType === 'group') return this.elements.groupPanel;
        if (panelType === 'settings') return this.elements.settingsPanel;
        if (panelType === 'race') return document.getElementById('racePanel');
        return null;
    }

    togglePanel(panelType) {
        const panel = this.getPanel(panelType);
        if (!panel) return;
        const isOpen = panel.classList.contains('open');

        this.closeAllPanels();

        if (!isOpen) {
            panel.classList.add('open');
            this.elements.overlay.classList.add('active');
        }
    }

    closePanel(panelType) {
        const panel = this.getPanel(panelType);
        if (panel) panel.classList.remove('open');
        this.elements.overlay.classList.remove('active');
    }

    closeAllPanels() {
        this.elements.groupPanel.classList.remove('open');
        this.elements.settingsPanel.classList.remove('open');
        document.getElementById('racePanel')?.classList.remove('open');
        this.closeMenuSheet();
        this.elements.overlay.classList.remove('active');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    }

    showNotification(message, type = 'info') {
        const notification = this.elements.notification;
        const text = notification.querySelector('.notification-text');
        
        text.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        this.elements.notification.classList.remove('show');
    }

    // ユーティリティメソッド
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

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 単位変換メソッド
    convertAltitude(meters) {
        return this.settings.units === 'imperial' ? meters * 3.28084 : meters;
    }

    convertSpeed(kmh) {
        return this.settings.units === 'imperial' ? kmh * 0.621371 : kmh;
    }

    convertDistance(meters) {
        const km = meters / 1000;
        return this.settings.units === 'imperial' ? km * 0.621371 : km;
    }

    convertVario(ms) {
        return this.settings.units === 'imperial' ? ms * 3.28084 : ms;
    }

    getAltitudeUnit() {
        return this.settings.units === 'imperial' ? 'ft' : 'm';
    }

    getSpeedUnit() {
        return this.settings.units === 'imperial' ? 'mph' : 'km/h';
    }

    getDistanceUnit() {
        return this.settings.units === 'imperial' ? 'mi' : 'km';
    }

    getVarioUnit() {
        return this.settings.units === 'imperial' ? 'ft/s' : 'm/s';
    }

    // 設定管理
    loadSettings() {
        const defaultSettings = {
            username: '',
            units: 'metric',
            gpsAccuracy: 'high',
            autoSave: true,
            wakeLock: true,
            follow: false
        };

        try {
            const saved = localStorage.getItem('skytracker_settings');
            if (saved) {
                const parsedSettings = JSON.parse(saved);
                return { ...defaultSettings, ...parsedSettings };
            }
            return defaultSettings;
        } catch (error) {
            if (window.errorHandler) {
                window.errorHandler.handleStorageError(error, 'load_settings');
            } else {
                console.error('Settings load error:', error);
            }
            return defaultSettings;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('skytracker_settings', JSON.stringify(this.settings));
        } catch (error) {
            if (window.errorHandler) {
                window.errorHandler.handleStorageError(error, 'save_settings');
            } else {
                this.showNotification('設定の保存に失敗しました。', 'error');
                console.error('Settings save error:', error);
            }
        }
    }

    loadUserSettings() {
        document.getElementById('usernameInput').value = this.settings.username;
        document.getElementById('unitSelect').value = this.settings.units;
        document.getElementById('gpsAccuracySelect').value = this.settings.gpsAccuracy;
        document.getElementById('autoSaveCheck').checked = this.settings.autoSave;
        const wake = document.getElementById('wakeLockCheck');
        if (wake) wake.checked = this.settings.wakeLock !== false;
        const follow = document.getElementById('followCheck');
        if (follow) follow.checked = !!this.settings.follow;
        if (this.mapManager) this.mapManager.followPosition = !!this.settings.follow;
    }

    updateDisplay() {
        if (this.lastPosition) {
            this.updateFlightInfo(this.lastPosition);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    window.skyTracker = new SkyTracker();
});