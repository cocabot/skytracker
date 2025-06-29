// PeerJS P2P グループ共有システム
class P2PGroupManager extends GroupManager {
    constructor() {
        super();
        this.peer = null;
        this.connections = new Map();
        this.isHost = false;
        this.hostPeerId = null;
        this.peerJSLoaded = false;
        
        this.initializePeerJS();
    }

    async initializePeerJS() {
        console.log('Initializing PeerJS...');
        try {
            await this.loadPeerJS();
            console.log('PeerJS loaded successfully');
            this.setupPeer();
        } catch (error) {
            console.warn('PeerJS initialization failed, using localStorage:', error);
            this.useLocalStorage = true;
        }
    }

    loadPeerJS() {
        return new Promise((resolve, reject) => {
            if (window.Peer) {
                console.log('PeerJS already loaded');
                this.peerJSLoaded = true;
                resolve();
                return;
            }

            console.log('Loading PeerJS from CDN...');
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.5.0/dist/peerjs.min.js';
            script.onload = () => {
                console.log('PeerJS script loaded');
                this.peerJSLoaded = true;
                // 少し待ってからresolve（PeerJSの初期化時間を確保）
                setTimeout(() => {
                    if (window.Peer) {
                        console.log('Peer class available');
                        resolve();
                    } else {
                        console.error('Peer class not available after script load');
                        reject(new Error('Peer class not available'));
                    }
                }, 100);
            };
            script.onerror = (error) => {
                console.error('Failed to load PeerJS script:', error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    setupPeer() {
        if (!window.Peer) {
            this.useLocalStorage = true;
            return;
        }

        // ユニークなPeer IDを生成
        const peerId = this.generatePeerId();
        
        this.peer = new Peer(peerId, {
            host: 'peerjs-server.herokuapp.com',
            port: 443,
            path: '/peerjs',
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log('Peer connected with ID:', id);
            this.currentUser = id;
            this.showNotification('P2P接続が確立されました', 'success');
        });

        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (error) => {
            console.error('Peer error:', error);
            this.showNotification('P2P接続エラーが発生しました', 'error');
        });

        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.showNotification('P2P接続が切断されました', 'warning');
        });
    }

    generatePeerId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `sky_${timestamp}_${random}`;
    }

    async connectToGroup(groupCode) {
        this.groupCode = groupCode;
        this.isConnected = true;

        if (!this.peer || this.useLocalStorage) {
            // フォールバック: ローカルストレージ使用
            return super.connectToGroup(groupCode);
        }

        // グループコードをホストPeer IDとして使用
        this.hostPeerId = `host_${groupCode}`;
        
        try {
            // ホストに接続を試行
            await this.connectToHost();
        } catch (error) {
            // ホストが存在しない場合、自分がホストになる
            console.log('No host found, becoming host');
            this.becomeHost();
        }

        // 定期的なメンバー更新
        this.startMemberSync();
    }

    async connectToHost() {
        return new Promise((resolve, reject) => {
            const conn = this.peer.connect(this.hostPeerId);
            
            conn.on('open', () => {
                console.log('Connected to host');
                this.connections.set(this.hostPeerId, conn);
                this.setupConnectionHandlers(conn);
                
                // 自分の情報を送信
                this.sendToConnection(conn, {
                    type: 'join',
                    userId: this.currentUser,
                    userName: this.getCurrentUsername() || 'Unknown',
                    timestamp: Date.now()
                });
                
                resolve();
            });

            conn.on('error', (error) => {
                console.log('Failed to connect to host:', error);
                reject(error);
            });

            // 5秒でタイムアウト
            setTimeout(() => {
                if (conn.open !== true) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);
        });
    }

    becomeHost() {
        this.isHost = true;
        this.currentUser = this.hostPeerId;
        
        // 新しいPeerインスタンスをホストIDで作成
        if (this.peer) {
            this.peer.destroy();
        }

        this.peer = new Peer(this.hostPeerId, {
            host: 'peerjs-server.herokuapp.com',
            port: 443,
            path: '/peerjs',
            secure: true
        });

        this.peer.on('open', (id) => {
            console.log('Host peer created with ID:', id);
            this.showNotification('グループホストになりました', 'info');
        });

        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });
    }

    handleIncomingConnection(conn) {
        console.log('Incoming connection from:', conn.peer);
        
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.setupConnectionHandlers(conn);
            
            // 既存メンバー情報を新しい接続に送信
            this.sendMemberListToConnection(conn);
        });
    }

    setupConnectionHandlers(conn) {
        conn.on('data', (data) => {
            this.handleP2PMessage(data, conn);
        });

        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
            this.removeMember(conn.peer);
        });

        conn.on('error', (error) => {
            console.error('Connection error:', error);
            this.connections.delete(conn.peer);
        });
    }

    handleP2PMessage(data, conn) {
        console.log('Received P2P message:', data);

        switch (data.type) {
            case 'join':
                this.handleMemberJoin(data, conn);
                break;
            case 'position':
                this.handlePositionUpdate(data);
                break;
            case 'memberList':
                this.handleMemberList(data);
                break;
            case 'chat':
                this.handleChatMessage(data);
                break;
            case 'emergency':
                this.handleEmergencyAlert(data);
                break;
        }
    }

    handleMemberJoin(data, conn) {
        this.addMember({
            id: data.userId,
            name: data.userName,
            isCurrentUser: false
        });

        // ホストの場合、他の全メンバーに新メンバーを通知
        if (this.isHost) {
            this.broadcastToOthers({
                type: 'memberJoin',
                userId: data.userId,
                userName: data.userName
            }, conn.peer);
        }
    }

    handlePositionUpdate(data) {
        // メンバーの位置を更新
        if (this.members.has(data.userId)) {
            const member = this.members.get(data.userId);
            
            // 地図上の位置を更新
            if (window.skyTracker && window.skyTracker.mapManager) {
                window.skyTracker.mapManager.addGroupMember(
                    { id: data.userId, name: member.name },
                    data.position
                );
            }
        }

        // ホストの場合、他のメンバーに転送
        if (this.isHost) {
            this.broadcastToOthers(data, data.userId);
        }
    }

    handleMemberList(data) {
        // メンバーリストを更新
        data.members.forEach(memberData => {
            if (memberData.userId !== this.currentUser) {
                this.addMember({
                    id: memberData.userId,
                    name: memberData.userName,
                    isCurrentUser: false
                });
            }
        });
    }

    handleChatMessage(data) {
        // チャットメッセージを表示
        if (window.skyTracker && window.skyTracker.groupManager.displayChatMessage) {
            window.skyTracker.groupManager.displayChatMessage({
                id: data.messageId,
                userId: data.userId,
                userName: data.userName,
                message: data.message,
                timestamp: data.timestamp,
                type: 'text'
            });
        }

        // ホストの場合、他のメンバーに転送
        if (this.isHost) {
            this.broadcastToOthers(data, data.userId);
        }
    }

    handleEmergencyAlert(data) {
        // 緊急アラートを表示
        this.showEmergencyAlert({
            id: data.alertId,
            userId: data.userId,
            userName: data.userName,
            position: data.position,
            timestamp: data.timestamp,
            message: data.message
        });

        // ホストの場合、他のメンバーに転送
        if (this.isHost) {
            this.broadcastToOthers(data, data.userId);
        }
    }

    sharePosition(position) {
        if (!this.isConnected || !this.groupCode) {
            return;
        }

        const positionData = {
            type: 'position',
            userId: this.currentUser,
            position: position,
            timestamp: Date.now()
        };

        if (this.useLocalStorage || this.connections.size === 0) {
            // フォールバック: ローカルストレージ使用
            super.sharePosition(position);
        } else {
            // P2P経由で位置を共有
            this.broadcastToAll(positionData);
        }
    }

    sendChatMessage(message) {
        if (!this.isConnected || !message.trim()) {
            return;
        }

        const chatData = {
            type: 'chat',
            messageId: Date.now().toString(),
            userId: this.currentUser,
            userName: this.getCurrentUsername() || 'Unknown',
            message: message.trim(),
            timestamp: Date.now()
        };

        // 自分のメッセージを表示
        if (window.skyTracker && window.skyTracker.groupManager.displayChatMessage) {
            window.skyTracker.groupManager.displayChatMessage({
                ...chatData,
                type: 'text'
            });
        }

        // 他のメンバーに送信
        this.broadcastToAll(chatData);
    }

    broadcastEmergency(position, message) {
        const emergencyData = {
            type: 'emergency',
            alertId: Date.now().toString(),
            userId: this.currentUser,
            userName: this.getCurrentUsername() || 'Unknown',
            position: position,
            message: message,
            timestamp: Date.now()
        };

        this.broadcastToAll(emergencyData);
    }

    broadcastToAll(data) {
        this.connections.forEach((conn, peerId) => {
            if (conn.open) {
                this.sendToConnection(conn, data);
            }
        });
    }

    broadcastToOthers(data, excludePeerId) {
        this.connections.forEach((conn, peerId) => {
            if (conn.open && peerId !== excludePeerId) {
                this.sendToConnection(conn, data);
            }
        });
    }

    sendToConnection(conn, data) {
        try {
            conn.send(data);
        } catch (error) {
            console.error('Failed to send data:', error);
        }
    }

    sendMemberListToConnection(conn) {
        const memberList = [];
        this.members.forEach(member => {
            memberList.push({
                userId: member.id,
                userName: member.name
            });
        });

        this.sendToConnection(conn, {
            type: 'memberList',
            members: memberList
        });
    }

    startMemberSync() {
        // 定期的にメンバー情報を同期
        this.memberSyncInterval = setInterval(() => {
            if (this.isHost) {
                // ホストは接続状態をチェック
                this.checkConnections();
            }
        }, 10000); // 10秒ごと
    }

    checkConnections() {
        this.connections.forEach((conn, peerId) => {
            if (!conn.open) {
                console.log('Removing disconnected peer:', peerId);
                this.connections.delete(peerId);
                this.removeMember(peerId);
            }
        });
    }

    leaveGroup() {
        // P2P接続を切断
        if (this.connections) {
            this.connections.forEach(conn => {
                if (conn.open) {
                    conn.close();
                }
            });
            this.connections.clear();
        }

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        if (this.memberSyncInterval) {
            clearInterval(this.memberSyncInterval);
            this.memberSyncInterval = null;
        }

        this.isHost = false;
        this.hostPeerId = null;

        super.leaveGroup();
    }

    // デバッグ情報
    showDebugInfo() {
        const debugInfo = {
            mode: this.useLocalStorage ? 'ローカルストレージ' : 'P2P',
            useLocalStorage: this.useLocalStorage || false,
            isConnected: this.isConnected || false,
            groupCode: this.groupCode || 'なし',
            currentUser: this.currentUser || 'なし',
            isHost: this.isHost || false,
            connectionsCount: this.connections ? this.connections.size : 0,
            membersCount: this.members ? this.members.size : 0,
            peerJSLoaded: this.peerJSLoaded || false,
            peerId: this.peer ? this.peer.id : 'なし',
            peerOpen: this.peer ? this.peer.open : false
        };

        console.log('=== P2P Debug Info ===');
        console.table(debugInfo);
        
        if (window.skyTracker) {
            window.skyTracker.showNotification(
                `デバッグ: ${debugInfo.mode}モード, 接続数: ${debugInfo.connectionsCount}, メンバー数: ${debugInfo.membersCount}`,
                'info'
            );
        }
        
        return debugInfo;
    }

    // 接続品質の確認
    getConnectionStatus() {
        const status = {
            mode: this.useLocalStorage ? 'localStorage' : 'P2P',
            isHost: this.isHost,
            connections: this.connections.size,
            members: this.members.size,
            peerId: this.peer ? this.peer.id : null
        };

        return status;
    }
}

// 既存のGroupManagerを拡張版に置き換え
if (typeof GroupManager !== 'undefined') {
    window.P2PGroupManager = P2PGroupManager;
}