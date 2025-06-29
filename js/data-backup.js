// データバックアップ・復元機能
class DataBackup {
    constructor() {
        this.backupVersion = '1.0';
        this.maxBackups = 10;
        this.autoBackupInterval = 300000; // 5分
        this.autoBackupTimer = null;
        
        this.init();
    }

    init() {
        this.createBackupUI();
        this.bindEvents();
        this.startAutoBackup();
        this.loadBackupHistory();
    }

    createBackupUI() {
        // 設定パネルにバックアップセクションを追加
        const settingsPanel = document.getElementById('settingsPanel');
        if (!settingsPanel) return;

        const settingsContent = settingsPanel.querySelector('.settings-content');
        if (!settingsContent) return;

        const backupSection = document.createElement('div');
        backupSection.className = 'backup-section';
        backupSection.innerHTML = `
            <div class="setting-group">
                <label>データバックアップ</label>
                <div class="backup-controls">
                    <button class="btn btn-primary btn-sm" id="createBackupBtn">
                        <i class="fas fa-save"></i> バックアップ作成
                    </button>
                    <button class="btn btn-secondary btn-sm" id="restoreBackupBtn">
                        <i class="fas fa-upload"></i> 復元
                    </button>
                    <button class="btn btn-secondary btn-sm" id="exportBackupBtn">
                        <i class="fas fa-download"></i> エクスポート
                    </button>
                </div>
            </div>
            <div class="setting-group">
                <label>自動バックアップ</label>
                <div class="auto-backup-controls">
                    <input type="checkbox" id="autoBackupCheck" checked>
                    <span>5分間隔で自動バックアップ</span>
                </div>
            </div>
            <div class="setting-group">
                <label>バックアップ履歴</label>
                <div class="backup-history" id="backupHistory">
                    <!-- バックアップ履歴がここに表示される -->
                </div>
            </div>
        `;

        settingsContent.appendChild(backupSection);
        this.addBackupStyles();
    }

    addBackupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .backup-section {
                border-top: 1px solid var(--border-color);
                padding-top: 1.5rem;
                margin-top: 1.5rem;
            }

            .backup-controls {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
            }

            .backup-controls .btn {
                flex: 1;
                min-width: 80px;
            }

            .auto-backup-controls {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .backup-history {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 0.5rem;
                background: var(--background-color);
            }

            .backup-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5rem;
                border-bottom: 1px solid var(--border-color);
                font-size: 0.875rem;
            }

            .backup-item:last-child {
                border-bottom: none;
            }

            .backup-info {
                flex: 1;
            }

            .backup-name {
                font-weight: 500;
                margin-bottom: 0.25rem;
            }

            .backup-details {
                color: var(--text-secondary);
                font-size: 0.75rem;
            }

            .backup-actions {
                display: flex;
                gap: 0.25rem;
            }

            .backup-actions .btn {
                padding: 0.25rem 0.5rem;
                font-size: 0.75rem;
            }

            .backup-status {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--primary-color);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: var(--border-radius);
                font-size: 0.875rem;
                z-index: 2000;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
            }

            .backup-status.show {
                opacity: 1;
                transform: translateY(0);
            }

            .restore-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--surface-color);
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                z-index: 3000;
                min-width: 400px;
                max-width: 90vw;
            }

            .restore-dialog-header {
                padding: 1rem;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .restore-dialog-body {
                padding: 1rem;
                max-height: 400px;
                overflow-y: auto;
            }

            .restore-dialog-footer {
                padding: 1rem;
                border-top: 1px solid var(--border-color);
                display: flex;
                justify-content: flex-end;
                gap: 0.5rem;
            }

            .backup-option {
                padding: 1rem;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                margin-bottom: 0.5rem;
                cursor: pointer;
                transition: var(--transition);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .backup-option:hover {
                background: var(--background-color);
                border-color: var(--primary-color);
            }

            .backup-option-info {
                flex: 1;
            }

            @media (max-width: 768px) {
                .backup-controls {
                    flex-direction: column;
                }
                
                .backup-controls .btn {
                    flex: none;
                }
                
                .restore-dialog {
                    min-width: 300px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        // バックアップ作成
        document.getElementById('createBackupBtn')?.addEventListener('click', () => {
            this.createBackup();
        });

        // 復元
        document.getElementById('restoreBackupBtn')?.addEventListener('click', () => {
            this.showRestoreDialog();
        });

        // エクスポート
        document.getElementById('exportBackupBtn')?.addEventListener('click', () => {
            this.exportBackup();
        });

        // 自動バックアップ設定
        document.getElementById('autoBackupCheck')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoBackup();
            } else {
                this.stopAutoBackup();
            }
        });
    }

    createBackup(isAuto = false) {
        try {
            const backupData = this.gatherBackupData();
            const backupId = this.generateBackupId();
            const timestamp = new Date().toISOString();

            const backup = {
                id: backupId,
                timestamp: timestamp,
                version: this.backupVersion,
                isAuto: isAuto,
                data: backupData,
                size: JSON.stringify(backupData).length
            };

            // バックアップを保存
            this.saveBackup(backup);
            
            // 履歴を更新
            this.updateBackupHistory();
            
            // 古いバックアップを削除
            this.cleanupOldBackups();

            if (!isAuto) {
                this.showBackupStatus('バックアップを作成しました', 'success');
            }

            return backup;

        } catch (error) {
            console.error('Backup creation failed:', error);
            if (!isAuto) {
                this.showNotification('バックアップの作成に失敗しました', 'error');
            }
            return null;
        }
    }

    gatherBackupData() {
        const data = {
            // アプリ設定
            settings: this.getSettings(),
            
            // 現在のトラックデータ
            currentTrack: this.getCurrentTrackData(),
            
            // グループ設定
            groupSettings: this.getGroupSettings(),
            
            // エラーログ
            errorLog: this.getErrorLog(),
            
            // 分析データ
            analyticsData: this.getAnalyticsData(),
            
            // ユーザー設定
            userPreferences: this.getUserPreferences()
        };

        return data;
    }

    getSettings() {
        try {
            const settings = localStorage.getItem('skytracker_settings');
            return settings ? JSON.parse(settings) : null;
        } catch {
            return null;
        }
    }

    getCurrentTrackData() {
        if (window.skyTracker && window.skyTracker.trackData) {
            return {
                trackData: window.skyTracker.trackData,
                startTime: window.skyTracker.startTime,
                totalDistance: window.skyTracker.totalDistance,
                lastPosition: window.skyTracker.lastPosition
            };
        }
        return null;
    }

    getGroupSettings() {
        try {
            const groupSettings = localStorage.getItem('skytracker_group_settings');
            return groupSettings ? JSON.parse(groupSettings) : null;
        } catch {
            return null;
        }
    }

    getErrorLog() {
        if (window.errorHandler && window.errorHandler.errorLog) {
            return window.errorHandler.errorLog.slice(-50); // 最新50件
        }
        return null;
    }

    getAnalyticsData() {
        if (window.flightAnalytics && window.flightAnalytics.analysisData) {
            return window.flightAnalytics.analysisData;
        }
        return null;
    }

    getUserPreferences() {
        try {
            const onboardingCompleted = localStorage.getItem('skytracker_onboarding_completed');
            const mapState = localStorage.getItem('skytracker_map_state');
            
            return {
                onboardingCompleted: onboardingCompleted,
                mapState: mapState ? JSON.parse(mapState) : null
            };
        } catch {
            return null;
        }
    }

    generateBackupId() {
        return 'backup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    saveBackup(backup) {
        const backups = this.getBackupList();
        backups.unshift(backup); // 新しいバックアップを先頭に追加
        
        localStorage.setItem('skytracker_backups', JSON.stringify(backups));
    }

    getBackupList() {
        try {
            const backups = localStorage.getItem('skytracker_backups');
            return backups ? JSON.parse(backups) : [];
        } catch {
            return [];
        }
    }

    updateBackupHistory() {
        const historyContainer = document.getElementById('backupHistory');
        if (!historyContainer) return;

        const backups = this.getBackupList();
        
        if (backups.length === 0) {
            historyContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">バックアップがありません</p>';
            return;
        }

        historyContainer.innerHTML = '';
        
        backups.forEach(backup => {
            const backupItem = this.createBackupItem(backup);
            historyContainer.appendChild(backupItem);
        });
    }

    createBackupItem(backup) {
        const item = document.createElement('div');
        item.className = 'backup-item';
        
        const date = new Date(backup.timestamp);
        const formattedDate = date.toLocaleString('ja-JP');
        const sizeKB = (backup.size / 1024).toFixed(1);
        
        item.innerHTML = `
            <div class="backup-info">
                <div class="backup-name">
                    ${backup.isAuto ? '自動' : '手動'}バックアップ
                </div>
                <div class="backup-details">
                    ${formattedDate} • ${sizeKB} KB
                </div>
            </div>
            <div class="backup-actions">
                <button class="btn btn-primary btn-sm" onclick="window.dataBackup.restoreBackup('${backup.id}')">
                    復元
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.dataBackup.deleteBackup('${backup.id}')">
                    削除
                </button>
            </div>
        `;
        
        return item;
    }

    cleanupOldBackups() {
        const backups = this.getBackupList();
        
        if (backups.length > this.maxBackups) {
            const trimmedBackups = backups.slice(0, this.maxBackups);
            localStorage.setItem('skytracker_backups', JSON.stringify(trimmedBackups));
        }
    }

    showRestoreDialog() {
        const backups = this.getBackupList();
        
        if (backups.length === 0) {
            this.showNotification('復元可能なバックアップがありません', 'warning');
            return;
        }

        const dialog = document.createElement('div');
        dialog.className = 'restore-dialog';
        dialog.innerHTML = `
            <div class="restore-dialog-header">
                <h3>バックアップから復元</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="restore-dialog-body">
                <p>復元するバックアップを選択してください：</p>
                <div class="backup-list">
                    ${backups.map(backup => this.createRestoreOption(backup)).join('')}
                </div>
            </div>
            <div class="restore-dialog-footer">
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">
                    キャンセル
                </button>
            </div>
        `;

        // オーバーレイを追加
        const overlay = document.createElement('div');
        overlay.className = 'overlay active';
        overlay.onclick = () => {
            overlay.remove();
            dialog.remove();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
    }

    createRestoreOption(backup) {
        const date = new Date(backup.timestamp);
        const formattedDate = date.toLocaleString('ja-JP');
        const sizeKB = (backup.size / 1024).toFixed(1);
        
        return `
            <div class="backup-option" onclick="window.dataBackup.confirmRestore('${backup.id}')">
                <div class="backup-option-info">
                    <strong>${backup.isAuto ? '自動' : '手動'}バックアップ</strong><br>
                    <small>${formattedDate} • ${sizeKB} KB</small>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
    }

    confirmRestore(backupId) {
        const confirmed = confirm('このバックアップから復元しますか？\n現在のデータは失われます。');
        if (confirmed) {
            this.restoreBackup(backupId);
            // ダイアログを閉じる
            document.querySelector('.restore-dialog')?.remove();
            document.querySelector('.overlay')?.remove();
        }
    }

    restoreBackup(backupId) {
        try {
            const backups = this.getBackupList();
            const backup = backups.find(b => b.id === backupId);
            
            if (!backup) {
                throw new Error('バックアップが見つかりません');
            }

            this.applyBackupData(backup.data);
            this.showBackupStatus('バックアップから復元しました', 'success');
            
            // ページをリロードして変更を反映
            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (error) {
            console.error('Restore failed:', error);
            this.showNotification('復元に失敗しました', 'error');
        }
    }

    applyBackupData(data) {
        // 設定を復元
        if (data.settings) {
            localStorage.setItem('skytracker_settings', JSON.stringify(data.settings));
        }

        // グループ設定を復元
        if (data.groupSettings) {
            localStorage.setItem('skytracker_group_settings', JSON.stringify(data.groupSettings));
        }

        // ユーザー設定を復元
        if (data.userPreferences) {
            if (data.userPreferences.onboardingCompleted) {
                localStorage.setItem('skytracker_onboarding_completed', data.userPreferences.onboardingCompleted);
            }
            if (data.userPreferences.mapState) {
                localStorage.setItem('skytracker_map_state', JSON.stringify(data.userPreferences.mapState));
            }
        }

        // 現在のトラックデータを復元
        if (data.currentTrack && window.skyTracker) {
            window.skyTracker.trackData = data.currentTrack.trackData || [];
            window.skyTracker.startTime = data.currentTrack.startTime ? new Date(data.currentTrack.startTime) : null;
            window.skyTracker.totalDistance = data.currentTrack.totalDistance || 0;
            window.skyTracker.lastPosition = data.currentTrack.lastPosition || null;
        }
    }

    deleteBackup(backupId) {
        const confirmed = confirm('このバックアップを削除しますか？');
        if (!confirmed) return;

        try {
            const backups = this.getBackupList();
            const filteredBackups = backups.filter(b => b.id !== backupId);
            
            localStorage.setItem('skytracker_backups', JSON.stringify(filteredBackups));
            this.updateBackupHistory();
            
            this.showBackupStatus('バックアップを削除しました', 'info');

        } catch (error) {
            console.error('Delete backup failed:', error);
            this.showNotification('バックアップの削除に失敗しました', 'error');
        }
    }

    exportBackup() {
        try {
            const backups = this.getBackupList();
            
            if (backups.length === 0) {
                this.showNotification('エクスポートするバックアップがありません', 'warning');
                return;
            }

            const exportData = {
                exportDate: new Date().toISOString(),
                version: this.backupVersion,
                backups: backups
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `skytracker_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showBackupStatus('バックアップをエクスポートしました', 'success');

        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('エクスポートに失敗しました', 'error');
        }
    }

    startAutoBackup() {
        this.stopAutoBackup(); // 既存のタイマーをクリア
        
        this.autoBackupTimer = setInterval(() => {
            // トラッキング中のみ自動バックアップ
            if (window.skyTracker && window.skyTracker.isTracking) {
                this.createBackup(true);
            }
        }, this.autoBackupInterval);
    }

    stopAutoBackup() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
        }
    }

    loadBackupHistory() {
        // ページ読み込み時にバックアップ履歴を表示
        setTimeout(() => {
            this.updateBackupHistory();
        }, 1000);
    }

    showBackupStatus(message, type = 'info') {
        const status = document.createElement('div');
        status.className = 'backup-status';
        status.textContent = message;
        
        if (type === 'success') {
            status.style.background = 'var(--success-color)';
        } else if (type === 'error') {
            status.style.background = 'var(--danger-color)';
        }

        document.body.appendChild(status);
        
        // アニメーション
        setTimeout(() => status.classList.add('show'), 100);
        
        // 3秒後に削除
        setTimeout(() => {
            status.classList.remove('show');
            setTimeout(() => status.remove(), 300);
        }, 3000);
    }

    showNotification(message, type = 'info') {
        if (window.skyTracker && window.skyTracker.showNotification) {
            window.skyTracker.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// グローバルに公開
window.DataBackup = DataBackup;