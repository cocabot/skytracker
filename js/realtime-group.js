// リアルタイムグループ共有システム
class RealtimeGroupManager extends GroupManager {
    constructor() {
        super();
        this.firebaseConfig = {
            // 無料のFirebase Realtime Database設定
            databaseURL: "https://skytracker-demo-default-rtdb.firebaseio.com/"
        };
        this.database = null;
        this.groupRef = null;
        this.initializeFirebase();
    }

    async initializeFirebase() {
        try {
            // Firebase SDKを動的に読み込み
            await this.loadFirebaseSDK();
            
            // Firebase初期化
            if (typeof firebase !== 'undefined') {
                firebase.initializeApp(this.firebaseConfig);
                this.database = firebase.database();
                console.log('Firebase initialized successfully');
            } else {
                console.warn('Firebase not available, falling back to localStorage');
                this.useLocalStorage = true;
            }
        } catch (error) {
            console.warn('Firebase initialization failed, using localStorage:', error);
            this.useLocalStorage = true;
        }
    }

    async loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // Firebase App SDK
            const appScript = document.createElement('script');
            appScript.src = 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js';
            appScript.onload = () => {
                // Firebase Database SDK
                const dbScript = document.createElement('script');
                dbScript.src = 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database-compat.js';
                dbScript.onload = resolve;
                dbScript.onerror = reject;
                document.head.appendChild(dbScript);
            };
            appScript.onerror = reject;
            document.head.appendChild(appScript);
        });
    }

    async connectToGroup(groupCode) {
        await super.connectToGroup(groupCode);
        
        if (!this.useLocalStorage && this.database) {
            // Firebase Realtime Database接続
            this.groupRef = this.database.ref(`groups/${groupCode}`);
            
            // リアルタイムリスナー設定
            this.groupRef.on('value', (snapshot) => {
                const groupData = snapshot.val() || {};
                this.handleRealtimeUpdate(groupData);
            });
            
            // 接続状態監視
            this.database.ref('.info/connected').on('value', (snapshot) => {
                if (snapshot.val() === true) {
                    console.log('Connected to Firebase');
                    this.showNotification('リアルタイム同期が有効になりました', 'success');
                } else {
                    console.log('Disconnected from Firebase');
                    this.showNotification('オフラインモードに切り替わりました', 'warning');
                }
            });
        }
    }

    handleRealtimeUpdate(groupData) {
        console.log('Realtime update received:', groupData);
        
        // メンバーリストをクリア
        this.members.clear();
        
        // 現在時刻から10分以内のメンバーのみ表示
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        
        Object.keys(groupData).forEach(memberId => {
            const memberData = groupData[memberId];
            
            if (memberData && memberData.lastUpdate > tenMinutesAgo) {
                this.addMember({
                    id: memberId,
                    name: memberData.name || 'Unknown User',
                    isCurrentUser: memberId === this.currentUser
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
        
        this.updateMembersDisplay();
    }

    sharePosition(position) {
        if (!this.isConnected || !this.groupCode) {
            return;
        }

        const username = this.getCurrentUsername();
        const memberData = {
            name: username || 'Unknown',
            position: position,
            lastUpdate: Date.now(),
            userAgent: navigator.userAgent.substring(0, 50) // デバイス識別用
        };

        if (!this.useLocalStorage && this.groupRef) {
            // Firebase Realtime Databaseに保存
            this.groupRef.child(this.currentUser).set(memberData)
                .then(() => {
                    console.log('Position shared to Firebase:', memberData);
                })
                .catch((error) => {
                    console.error('Failed to share position to Firebase:', error);
                    // フォールバックとしてローカルストレージを使用
                    super.sharePosition(position);
                });
        } else {
            // ローカルストレージにフォールバック
            super.sharePosition(position);
        }
    }

    leaveGroup() {
        if (this.groupRef) {
            // Firebase接続を切断
            this.groupRef.off();
            
            // 自分の情報を削除
            this.groupRef.child(this.currentUser).remove()
                .then(() => {
                    console.log('Left group successfully');
                })
                .catch((error) => {
                    console.error('Failed to leave group:', error);
                });
            
            this.groupRef = null;
        }
        
        super.leaveGroup();
    }

    // オンライン状態の管理
    setOnlineStatus(isOnline) {
        if (!this.useLocalStorage && this.groupRef && this.currentUser) {
            this.groupRef.child(this.currentUser).child('online').set(isOnline);
        }
    }

    // グループメンバーの詳細情報取得
    getMemberDetails(memberId) {
        if (!this.useLocalStorage && this.groupRef) {
            return this.groupRef.child(memberId).once('value').then(snapshot => {
                return snapshot.val();
            });
        } else {
            // ローカルストレージから取得
            const groupKey = `skytracker_group_${this.groupCode}`;
            const groupData = JSON.parse(localStorage.getItem(groupKey) || '{}');
            return Promise.resolve(groupData[memberId]);
        }
    }

    // グループ統計情報
    getGroupStats() {
        const stats = {
            totalMembers: this.members.size,
            onlineMembers: 0,
            lastActivity: 0
        };

        this.members.forEach(member => {
            if (!member.isCurrentUser) {
                stats.onlineMembers++;
            }
        });

        return stats;
    }

    // 緊急アラートの強化
    async broadcastEmergency(position, message) {
        const emergencyData = {
            userId: this.currentUser,
            userName: this.getCurrentUsername() || 'Unknown',
            position: position,
            message: message,
            timestamp: Date.now(),
            type: 'emergency'
        };

        if (!this.useLocalStorage && this.database) {
            // Firebase経由で緊急アラートを送信
            const emergencyRef = this.database.ref(`emergencies/${this.groupCode}`).push();
            await emergencyRef.set(emergencyData);
            
            // 5分後に自動削除
            setTimeout(() => {
                emergencyRef.remove();
            }, 5 * 60 * 1000);
        } else {
            // ローカルストレージにフォールバック
            super.saveEmergencyAlert(emergencyData);
        }
    }

    // 接続品質の監視
    monitorConnectionQuality() {
        if (!this.useLocalStorage && this.database) {
            let lastPingTime = Date.now();
            
            const pingRef = this.database.ref(`ping/${this.currentUser}`);
            
            setInterval(() => {
                const pingData = {
                    timestamp: Date.now(),
                    latency: Date.now() - lastPingTime
                };
                
                pingRef.set(pingData);
                lastPingTime = Date.now();
            }, 30000); // 30秒ごと
        }
    }

    // デバッグ情報の表示
    showDebugInfo() {
        const debugInfo = {
            useLocalStorage: this.useLocalStorage,
            isConnected: this.isConnected,
            groupCode: this.groupCode,
            currentUser: this.currentUser,
            membersCount: this.members.size,
            firebaseConnected: !this.useLocalStorage && this.database !== null
        };

        console.table(debugInfo);
        
        if (window.skyTracker) {
            window.skyTracker.showNotification(
                `デバッグ: ${debugInfo.firebaseConnected ? 'Firebase' : 'ローカル'}モード, メンバー数: ${debugInfo.membersCount}`,
                'info'
            );
        }
    }
}

// 既存のGroupManagerを拡張版に置き換え
if (typeof GroupManager !== 'undefined') {
    window.RealtimeGroupManager = RealtimeGroupManager;
}