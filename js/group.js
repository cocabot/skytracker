// グループ管理クラス
class GroupManager {
    constructor() {
        this.groupCode = null;
        this.members = new Map();
        this.isConnected = false;
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.currentUser = this.generateUserId();
        
        this.initializeUI();
        this.loadSavedGroup();
    }

    initializeUI() {
        // グループ参加ボタン
        document.getElementById('joinGroupBtn').addEventListener('click', () => {
            this.joinGroup();
        });

        // グループコード入力でEnterキー
        document.getElementById('groupCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinGroup();
            }
        });
    }

    generateUserId() {
        // ユニークなユーザーIDを生成
        return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    async joinGroup() {
        const groupCodeInput = document.getElementById('groupCodeInput');
        const code = groupCodeInput.value.trim().toUpperCase();
        
        if (!code) {
            this.showNotification('グループコードを入力してください。', 'warning');
            return;
        }

        if (code.length < 4 || code.length > 8) {
            this.showNotification('グループコードは4-8文字で入力してください。', 'warning');
            return;
        }

        try {
            await this.connectToGroup(code);
            this.groupCode = code;
            this.saveGroupSettings();
            groupCodeInput.value = '';
            
            // 即座に自分の情報を共有
            this.shareInitialPosition();
            
            // メンバーリストを更新
            this.updateGroupMembers();
            
            this.showNotification(`グループ "${code}" に参加しました。`, 'success');
        } catch (error) {
            this.showNotification('グループへの参加に失敗しました。', 'error');
            console.error('Group join error:', error);
        }
    }

    async connectToGroup(groupCode) {
        // WebSocketサーバーへの接続をシミュレート
        // 実際の実装では、WebSocketサーバーまたはWebRTCを使用
        return new Promise((resolve, reject) => {
            try {
                // ローカルストレージを使用したシミュレーション
                this.setupLocalGroupSimulation(groupCode);
                this.isConnected = true;
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    setupLocalGroupSimulation(groupCode) {
        // ローカルストレージを使用してグループ機能をシミュレート
        this.groupCode = groupCode;
        
        // 定期的に他のメンバーの位置を確認
        this.groupUpdateInterval = setInterval(() => {
            this.updateGroupMembers();
        }, 5000);

        // 現在のユーザーを追加
        const username = this.getCurrentUsername();
        this.addMember({
            id: this.currentUser,
            name: username || 'あなた',
            isCurrentUser: true
        });
    }

    getCurrentUsername() {
        const settings = JSON.parse(localStorage.getItem('skytracker_settings') || '{}');
        return settings.username || '';
    }

    updateGroupMembers() {
        if (!this.groupCode) return;
        
        // ローカルストレージから他のメンバーの情報を取得
        const groupKey = `skytracker_group_${this.groupCode}`;
        const groupData = JSON.parse(localStorage.getItem(groupKey) || '{}');
        
        // 現在時刻から10分以内のメンバーのみ表示（時間を延長）
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        
        // デバッグ情報
        console.log('Group data:', groupData);
        console.log('Current user:', this.currentUser);
        
        Object.keys(groupData).forEach(memberId => {
            const memberData = groupData[memberId];
            console.log(`Checking member ${memberId}:`, memberData);
            
            if (memberData && memberData.lastUpdate > tenMinutesAgo && memberId !== this.currentUser) {
                this.addMember({
                    id: memberId,
                    name: memberData.name || 'Unknown User',
                    isCurrentUser: false
                });

                // 地図上にメンバーの位置を表示
                if (memberData.position && window.skyTracker && window.skyTracker.mapManager) {
                    window.skyTracker.mapManager.addGroupMember(
                        { id: memberId, name: memberData.name || 'Unknown User' },
                        memberData.position
                    );
                }
            }
        });
        
        // 自分自身も表示
        if (!this.members.has(this.currentUser)) {
            this.addMember({
                id: this.currentUser,
                name: this.getCurrentUsername() || 'あなた',
                isCurrentUser: true
            });
        }
    }

    sharePosition(position) {
        if (!this.isConnected || !this.groupCode) {
            return;
        }

        const groupKey = `skytracker_group_${this.groupCode}`;
        const groupData = JSON.parse(localStorage.getItem(groupKey) || '{}');
        
        const username = this.getCurrentUsername();
        groupData[this.currentUser] = {
            name: username || 'Unknown',
            position: position,
            lastUpdate: Date.now()
        };

        localStorage.setItem(groupKey, JSON.stringify(groupData));
        console.log('Position shared:', groupData[this.currentUser]);
    }

    shareInitialPosition() {
        // 現在位置または仮の位置を共有
        let position = null;
        
        if (window.skyTracker && window.skyTracker.lastPosition) {
            position = window.skyTracker.lastPosition;
        } else {
            // 仮の位置（東京駅）
            position = {
                latitude: 35.6812,
                longitude: 139.7671,
                altitude: 100,
                timestamp: Date.now()
            };
        }
        
        this.sharePosition(position);
    }

    addMember(member) {
        if (!this.members.has(member.id)) {
            this.members.set(member.id, member);
            this.updateMembersDisplay();
        }
    }

    removeMember(memberId) {
        if (this.members.has(memberId)) {
            this.members.delete(memberId);
            this.updateMembersDisplay();
            
            // 地図からメンバーを削除
            if (window.skyTracker && window.skyTracker.mapManager) {
                window.skyTracker.mapManager.removeGroupMember(memberId);
            }
        }
    }

    updateMembersDisplay() {
        const membersContainer = document.getElementById('groupMembers');
        membersContainer.innerHTML = '';

        if (this.members.size === 0) {
            membersContainer.innerHTML = '<p class="no-members">グループメンバーがいません</p>';
            return;
        }

        this.members.forEach(member => {
            const memberElement = this.createMemberElement(member);
            membersContainer.appendChild(memberElement);
        });
    }

    createMemberElement(member) {
        const div = document.createElement('div');
        div.className = 'member-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'member-avatar';
        avatar.textContent = member.name.charAt(0).toUpperCase();
        
        const info = document.createElement('div');
        info.className = 'member-info';
        
        const name = document.createElement('div');
        name.className = 'member-name';
        name.textContent = member.name + (member.isCurrentUser ? ' (あなた)' : '');
        
        const status = document.createElement('div');
        status.className = 'member-status';
        status.textContent = member.isCurrentUser ? 'オンライン' : this.getMemberStatus(member);
        
        info.appendChild(name);
        info.appendChild(status);
        
        div.appendChild(avatar);
        div.appendChild(info);

        // メンバーをクリックして地図上の位置を表示
        if (!member.isCurrentUser) {
            div.style.cursor = 'pointer';
            div.addEventListener('click', () => {
                this.focusOnMember(member);
            });
        }

        return div;
    }

    getMemberStatus(member) {
        // メンバーの最終更新時刻に基づいてステータスを決定
        const groupKey = `skytracker_group_${this.groupCode}`;
        const groupData = JSON.parse(localStorage.getItem(groupKey) || '{}');
        const memberData = groupData[member.id];
        
        if (!memberData) {
            return 'オフライン';
        }

        const lastUpdate = memberData.lastUpdate;
        const now = Date.now();
        const timeDiff = now - lastUpdate;

        if (timeDiff < 30000) { // 30秒以内
            return 'オンライン';
        } else if (timeDiff < 300000) { // 5分以内
            return '最近アクティブ';
        } else {
            return 'オフライン';
        }
    }

    focusOnMember(member) {
        const groupKey = `skytracker_group_${this.groupCode}`;
        const groupData = JSON.parse(localStorage.getItem(groupKey) || '{}');
        const memberData = groupData[member.id];
        
        if (memberData && memberData.position && window.skyTracker && window.skyTracker.mapManager) {
            const position = memberData.position;
            window.skyTracker.mapManager.map.setView(
                [position.latitude, position.longitude],
                16
            );
            
            this.showNotification(`${member.name}の位置に移動しました。`, 'info');
        }
    }

    leaveGroup() {
        if (!this.isConnected) {
            return;
        }

        // グループから退出
        this.isConnected = false;
        this.groupCode = null;
        this.members.clear();
        
        if (this.groupUpdateInterval) {
            clearInterval(this.groupUpdateInterval);
            this.groupUpdateInterval = null;
        }

        // 地図上のグループメンバーを削除
        if (window.skyTracker && window.skyTracker.mapManager) {
            window.skyTracker.mapManager.groupMarkers.forEach((marker, memberId) => {
                window.skyTracker.mapManager.removeGroupMember(memberId);
            });
        }

        this.updateMembersDisplay();
        this.clearGroupSettings();
        this.showNotification('グループから退出しました。', 'info');
    }

    isInGroup() {
        return this.isConnected && this.groupCode;
    }

    generateGroupCode() {
        // 新しいグループコードを生成
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // テスト用：ダミーメンバーを追加
    addTestMembers() {
        if (!this.groupCode) {
            this.showNotification('まずグループに参加してください。', 'warning');
            return;
        }

        const testMembers = [
            { name: 'パイロット田中', lat: 35.6762, lng: 139.6503 },
            { name: 'フライヤー佐藤', lat: 35.6863, lng: 139.6604 },
            { name: 'スカイ山田', lat: 35.6662, lng: 139.6403 }
        ];

        const groupKey = `skytracker_group_${this.groupCode}`;
        const groupData = JSON.parse(localStorage.getItem(groupKey) || '{}');

        testMembers.forEach((member, index) => {
            const memberId = `test_user_${index + 1}`;
            groupData[memberId] = {
                name: member.name,
                position: {
                    latitude: member.lat,
                    longitude: member.lng,
                    altitude: 1000 + Math.random() * 500,
                    timestamp: Date.now()
                },
                lastUpdate: Date.now()
            };
        });

        localStorage.setItem(groupKey, JSON.stringify(groupData));
        this.updateGroupMembers();
        this.showNotification('テストメンバーを追加しました。', 'success');
    }

    createNewGroup() {
        const newCode = this.generateGroupCode();
        document.getElementById('groupCodeInput').value = newCode;
        this.showNotification(`新しいグループコード "${newCode}" を生成しました。`, 'info');
    }

    // 緊急時の位置共有
    shareEmergencyLocation(position) {
        if (!this.isInGroup()) {
            return;
        }

        const emergencyData = {
            type: 'emergency',
            userId: this.currentUser,
            userName: this.getCurrentUsername(),
            position: position,
            timestamp: Date.now(),
            message: '緊急事態が発生しました'
        };

        // 緊急データを保存
        const emergencyKey = `skytracker_emergency_${this.groupCode}`;
        const emergencies = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
        emergencies.push(emergencyData);
        localStorage.setItem(emergencyKey, JSON.stringify(emergencies));

        this.showNotification('緊急位置を共有しました。', 'warning');
    }

    checkEmergencies() {
        if (!this.isInGroup()) {
            return;
        }

        const emergencyKey = `skytracker_emergency_${this.groupCode}`;
        const emergencies = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
        
        // 過去1時間の緊急事態をチェック
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentEmergencies = emergencies.filter(e => e.timestamp > oneHourAgo);

        recentEmergencies.forEach(emergency => {
            if (emergency.userId !== this.currentUser) {
                this.showEmergencyAlert(emergency);
            }
        });
    }

    showEmergencyAlert(emergency) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'emergency-alert';
        alertDiv.innerHTML = `
            <div class="alert-content">
                <h4>🚨 緊急事態</h4>
                <p><strong>${emergency.userName}</strong>から緊急信号</p>
                <p>${emergency.message}</p>
                <div class="alert-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()">閉じる</button>
                    <button onclick="window.skyTracker.mapManager.map.setView([${emergency.position.latitude}, ${emergency.position.longitude}], 16)">位置を表示</button>
                </div>
            </div>
        `;
        
        alertDiv.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #fee2e2;
            border: 2px solid #ef4444;
            border-radius: 8px;
            padding: 16px;
            max-width: 300px;
            z-index: 3000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

        document.body.appendChild(alertDiv);

        // 10秒後に自動で閉じる
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 10000);
    }

    // 設定の保存と読み込み
    saveGroupSettings() {
        const settings = {
            groupCode: this.groupCode,
            userId: this.currentUser
        };
        localStorage.setItem('skytracker_group_settings', JSON.stringify(settings));
    }

    loadSavedGroup() {
        const saved = localStorage.getItem('skytracker_group_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.groupCode) {
                    document.getElementById('groupCodeInput').value = settings.groupCode;
                }
                if (settings.userId) {
                    this.currentUser = settings.userId;
                }
            } catch (error) {
                console.error('Failed to load group settings:', error);
            }
        }
    }

    clearGroupSettings() {
        localStorage.removeItem('skytracker_group_settings');
    }

    // 通知表示（メインアプリの通知システムを使用）
    showNotification(message, type = 'info') {
        if (window.skyTracker && window.skyTracker.showNotification) {
            window.skyTracker.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // グループチャット機能（基本版）
    sendMessage(message) {
        if (!this.isInGroup() || !message.trim()) {
            return;
        }

        const chatMessage = {
            id: Date.now().toString(),
            userId: this.currentUser,
            userName: this.getCurrentUsername(),
            message: message.trim(),
            timestamp: Date.now()
        };

        const chatKey = `skytracker_chat_${this.groupCode}`;
        const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
        messages.push(chatMessage);
        
        // 最新100件のメッセージのみ保持
        if (messages.length > 100) {
            messages.splice(0, messages.length - 100);
        }
        
        localStorage.setItem(chatKey, JSON.stringify(messages));
    }

    getMessages() {
        if (!this.isInGroup()) {
            return [];
        }

        const chatKey = `skytracker_chat_${this.groupCode}`;
        return JSON.parse(localStorage.getItem(chatKey) || '[]');
    }

    // データクリーンアップ
    cleanupOldData() {
        // 古いグループデータを削除（7日以上前）
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('skytracker_group_') || 
                key.startsWith('skytracker_emergency_') || 
                key.startsWith('skytracker_chat_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (Array.isArray(data)) {
                        const filtered = data.filter(item => item.timestamp > sevenDaysAgo);
                        if (filtered.length !== data.length) {
                            localStorage.setItem(key, JSON.stringify(filtered));
                        }
                    } else if (typeof data === 'object') {
                        let hasChanges = false;
                        Object.keys(data).forEach(subKey => {
                            if (data[subKey].lastUpdate && data[subKey].lastUpdate < sevenDaysAgo) {
                                delete data[subKey];
                                hasChanges = true;
                            }
                        });
                        if (hasChanges) {
                            localStorage.setItem(key, JSON.stringify(data));
                        }
                    }
                } catch (error) {
                    console.warn('Failed to cleanup data for key:', key, error);
                }
            }
        });
    }
}

// 定期的なデータクリーンアップ
setInterval(() => {
    if (window.skyTracker && window.skyTracker.groupManager) {
        window.skyTracker.groupManager.cleanupOldData();
    }
}, 60 * 60 * 1000); // 1時間ごと