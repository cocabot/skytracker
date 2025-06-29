// 強化されたグループ機能
class EnhancedGroupManager extends GroupManager {
    constructor() {
        super();
        this.chatMessages = [];
        this.voiceChat = null;
        this.isVoiceChatActive = false;
        this.flightPlans = new Map();
        this.emergencyAlerts = [];
        
        this.initializeEnhancedFeatures();
    }

    initializeEnhancedFeatures() {
        this.setupChatSystem();
        this.setupVoiceChat();
        this.setupFlightPlanning();
        this.setupEmergencySystem();
        this.createEnhancedUI();
    }

    createEnhancedUI() {
        // 既存のグループパネルを拡張
        const groupPanel = document.getElementById('groupPanel');
        if (!groupPanel) return;

        // チャット機能を追加
        const chatSection = document.createElement('div');
        chatSection.className = 'chat-section';
        chatSection.innerHTML = `
            <div class="chat-header">
                <h4>グループチャット</h4>
                <div class="chat-controls">
                    <button class="btn btn-sm btn-secondary" id="voiceChatBtn">
                        <i class="fas fa-microphone"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" id="emergencyBtn">
                        <i class="fas fa-exclamation-triangle"></i>
                    </button>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <!-- チャットメッセージがここに表示される -->
            </div>
            <div class="chat-input">
                <input type="text" id="chatInput" placeholder="メッセージを入力..." maxlength="200">
                <button class="btn btn-primary btn-sm" id="sendChatBtn">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        // フライト計画セクションを追加
        const flightPlanSection = document.createElement('div');
        flightPlanSection.className = 'flight-plan-section';
        flightPlanSection.innerHTML = `
            <div class="plan-header">
                <h4>フライト計画</h4>
                <button class="btn btn-sm btn-primary" id="createPlanBtn">
                    <i class="fas fa-plus"></i> 作成
                </button>
            </div>
            <div class="flight-plans" id="flightPlans">
                <!-- フライト計画がここに表示される -->
            </div>
        `;

        // 既存のコンテンツの後に追加
        const groupContent = groupPanel.querySelector('.group-content');
        groupContent.appendChild(chatSection);
        groupContent.appendChild(flightPlanSection);

        this.bindEnhancedEvents();
        this.addEnhancedStyles();
    }

    addEnhancedStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .chat-section {
                margin-top: 20px;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                overflow: hidden;
            }

            .chat-header {
                background: var(--background-color);
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .chat-header h4 {
                margin: 0;
                font-size: 14px;
                color: var(--text-primary);
            }

            .chat-controls {
                display: flex;
                gap: 8px;
            }

            .chat-controls .btn {
                padding: 4px 8px;
                font-size: 12px;
            }

            .chat-messages {
                height: 200px;
                overflow-y: auto;
                padding: 12px;
                background: var(--surface-color);
            }

            .chat-message {
                margin-bottom: 12px;
                padding: 8px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.4;
            }

            .chat-message.own {
                background: var(--primary-color);
                color: white;
                margin-left: 20px;
            }

            .chat-message.other {
                background: var(--background-color);
                color: var(--text-primary);
                margin-right: 20px;
            }

            .chat-message.system {
                background: var(--warning-color);
                color: white;
                text-align: center;
                font-weight: 500;
            }

            .chat-message.emergency {
                background: var(--danger-color);
                color: white;
                border: 2px solid #dc2626;
                animation: pulse-emergency 1s infinite;
            }

            @keyframes pulse-emergency {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.8; }
            }

            .message-header {
                font-weight: 500;
                margin-bottom: 4px;
                opacity: 0.9;
            }

            .message-time {
                font-size: 11px;
                opacity: 0.7;
                float: right;
            }

            .chat-input {
                display: flex;
                padding: 12px;
                background: var(--background-color);
                border-top: 1px solid var(--border-color);
            }

            .chat-input input {
                flex: 1;
                padding: 8px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                font-size: 13px;
                margin-right: 8px;
            }

            .flight-plan-section {
                margin-top: 20px;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                overflow: hidden;
            }

            .plan-header {
                background: var(--background-color);
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .plan-header h4 {
                margin: 0;
                font-size: 14px;
                color: var(--text-primary);
            }

            .flight-plans {
                padding: 12px;
                max-height: 150px;
                overflow-y: auto;
            }

            .flight-plan-item {
                background: var(--background-color);
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 8px;
                border-left: 4px solid var(--primary-color);
            }

            .plan-title {
                font-weight: 500;
                font-size: 13px;
                margin-bottom: 4px;
            }

            .plan-details {
                font-size: 12px;
                color: var(--text-secondary);
                display: flex;
                justify-content: space-between;
            }

            .voice-chat-indicator {
                position: fixed;
                top: 100px;
                right: 20px;
                background: var(--success-color);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                z-index: 2000;
                animation: pulse 2s infinite;
            }

            .emergency-alert {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--danger-color);
                color: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                z-index: 3000;
                text-align: center;
                min-width: 300px;
                animation: shake 0.5s infinite;
            }

            @keyframes shake {
                0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
                25% { transform: translate(-50%, -50%) rotate(1deg); }
                75% { transform: translate(-50%, -50%) rotate(-1deg); }
            }

            .emergency-alert h3 {
                margin: 0 0 10px 0;
                font-size: 18px;
            }

            .emergency-alert .alert-actions {
                margin-top: 15px;
                display: flex;
                gap: 10px;
                justify-content: center;
            }

            .btn-sm {
                padding: 4px 8px;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    bindEnhancedEvents() {
        // チャット送信
        document.getElementById('sendChatBtn').addEventListener('click', () => {
            this.sendChatMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // ボイスチャット
        document.getElementById('voiceChatBtn').addEventListener('click', () => {
            this.toggleVoiceChat();
        });

        // 緊急ボタン
        document.getElementById('emergencyBtn').addEventListener('click', () => {
            this.triggerEmergency();
        });

        // フライト計画作成
        document.getElementById('createPlanBtn').addEventListener('click', () => {
            this.createFlightPlan();
        });
    }

    setupChatSystem() {
        // チャットメッセージの定期更新
        setInterval(() => {
            if (this.isInGroup()) {
                this.updateChatMessages();
            }
        }, 2000);
    }

    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message || !this.isInGroup()) return;

        const chatMessage = {
            id: Date.now().toString(),
            userId: this.currentUser,
            userName: this.getCurrentUsername() || 'Unknown',
            message: message,
            timestamp: Date.now(),
            type: 'text'
        };

        // ローカルストレージに保存
        this.saveChatMessage(chatMessage);
        
        // UI更新
        this.displayChatMessage(chatMessage);
        
        input.value = '';
    }

    saveChatMessage(message) {
        const chatKey = `skytracker_chat_${this.groupCode}`;
        const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
        messages.push(message);
        
        // 最新100件のみ保持
        if (messages.length > 100) {
            messages.splice(0, messages.length - 100);
        }
        
        localStorage.setItem(chatKey, JSON.stringify(messages));
    }

    updateChatMessages() {
        const chatKey = `skytracker_chat_${this.groupCode}`;
        const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
        
        // 新しいメッセージのみ表示
        const lastDisplayed = this.chatMessages.length > 0 ? 
            this.chatMessages[this.chatMessages.length - 1].timestamp : 0;
        
        const newMessages = messages.filter(msg => msg.timestamp > lastDisplayed);
        
        newMessages.forEach(message => {
            if (message.userId !== this.currentUser) {
                this.displayChatMessage(message);
            }
        });
        
        this.chatMessages = messages;
    }

    displayChatMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.userId === this.currentUser ? 'own' : 'other'} ${message.type || ''}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                ${message.userName}
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.message)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 音声通知（自分のメッセージ以外）
        if (message.userId !== this.currentUser) {
            this.playNotificationSound();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    playNotificationSound() {
        // 簡易的な通知音
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    setupVoiceChat() {
        // WebRTC音声チャットの基本設定
        this.peerConnections = new Map();
        this.localStream = null;
    }

    async toggleVoiceChat() {
        const button = document.getElementById('voiceChatBtn');
        
        if (this.isVoiceChatActive) {
            this.stopVoiceChat();
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-microphone"></i>';
        } else {
            try {
                await this.startVoiceChat();
                button.classList.add('active');
                button.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } catch (error) {
                this.showNotification('音声チャットの開始に失敗しました。', 'error');
                console.error('Voice chat error:', error);
            }
        }
    }

    async startVoiceChat() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.isVoiceChatActive = true;
            
            // 音声チャット開始の通知
            this.sendSystemMessage('音声チャットを開始しました');
            this.showVoiceChatIndicator();
            
        } catch (error) {
            throw new Error('マイクへのアクセスが拒否されました');
        }
    }

    stopVoiceChat() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.isVoiceChatActive = false;
        this.hideVoiceChatIndicator();
        this.sendSystemMessage('音声チャットを終了しました');
    }

    showVoiceChatIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'voiceChatIndicator';
        indicator.className = 'voice-chat-indicator';
        indicator.innerHTML = '<i class="fas fa-microphone"></i> 音声チャット中';
        document.body.appendChild(indicator);
    }

    hideVoiceChatIndicator() {
        const indicator = document.getElementById('voiceChatIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    sendSystemMessage(message) {
        const systemMessage = {
            id: Date.now().toString(),
            userId: 'system',
            userName: 'システム',
            message: message,
            timestamp: Date.now(),
            type: 'system'
        };

        this.saveChatMessage(systemMessage);
        this.displayChatMessage(systemMessage);
    }

    setupFlightPlanning() {
        // フライト計画の定期更新
        setInterval(() => {
            if (this.isInGroup()) {
                this.updateFlightPlans();
            }
        }, 10000);
    }

    createFlightPlan() {
        const planName = prompt('フライト計画名を入力してください:');
        if (!planName) return;

        const takeoffTime = prompt('離陸予定時刻 (HH:MM):');
        if (!takeoffTime) return;

        const landingTime = prompt('着陸予定時刻 (HH:MM):');
        if (!landingTime) return;

        const flightPlan = {
            id: Date.now().toString(),
            name: planName,
            creator: this.getCurrentUsername() || 'Unknown',
            takeoffTime: takeoffTime,
            landingTime: landingTime,
            timestamp: Date.now(),
            status: 'planned'
        };

        this.saveFlightPlan(flightPlan);
        this.displayFlightPlan(flightPlan);
        
        // チャットで通知
        this.sendSystemMessage(`${flightPlan.creator}がフライト計画「${planName}」を作成しました`);
    }

    saveFlightPlan(plan) {
        const planKey = `skytracker_plans_${this.groupCode}`;
        const plans = JSON.parse(localStorage.getItem(planKey) || '[]');
        plans.push(plan);
        localStorage.setItem(planKey, JSON.stringify(plans));
    }

    updateFlightPlans() {
        const planKey = `skytracker_plans_${this.groupCode}`;
        const plans = JSON.parse(localStorage.getItem(planKey) || '[]');
        
        const plansContainer = document.getElementById('flightPlans');
        if (!plansContainer) return;

        plansContainer.innerHTML = '';
        
        plans.forEach(plan => {
            this.displayFlightPlan(plan);
        });
    }

    displayFlightPlan(plan) {
        const plansContainer = document.getElementById('flightPlans');
        if (!plansContainer) return;

        const planDiv = document.createElement('div');
        planDiv.className = 'flight-plan-item';
        planDiv.innerHTML = `
            <div class="plan-title">${plan.name}</div>
            <div class="plan-details">
                <span>作成者: ${plan.creator}</span>
                <span>${plan.takeoffTime} - ${plan.landingTime}</span>
            </div>
        `;

        plansContainer.appendChild(planDiv);
    }

    setupEmergencySystem() {
        // 緊急アラートの監視
        setInterval(() => {
            if (this.isInGroup()) {
                this.checkEmergencyAlerts();
            }
        }, 5000);
    }

    triggerEmergency() {
        if (!this.isInGroup()) {
            this.showNotification('グループに参加していません。', 'warning');
            return;
        }

        const confirmed = confirm('緊急事態を報告しますか？\nグループメンバーに緊急アラートが送信されます。');
        if (!confirmed) return;

        const currentPosition = this.getCurrentPosition();
        if (!currentPosition) {
            this.showNotification('現在位置を取得できません。', 'error');
            return;
        }

        const emergency = {
            id: Date.now().toString(),
            userId: this.currentUser,
            userName: this.getCurrentUsername() || 'Unknown',
            position: currentPosition,
            timestamp: Date.now(),
            message: '緊急事態が発生しました',
            type: 'emergency'
        };

        this.saveEmergencyAlert(emergency);
        
        // 緊急メッセージとして送信
        const emergencyMessage = {
            id: Date.now().toString(),
            userId: this.currentUser,
            userName: this.getCurrentUsername() || 'Unknown',
            message: '🚨 緊急事態が発生しました！位置情報を確認してください。',
            timestamp: Date.now(),
            type: 'emergency'
        };

        this.saveChatMessage(emergencyMessage);
        this.displayChatMessage(emergencyMessage);
        
        this.showNotification('緊急アラートを送信しました。', 'warning');
    }

    getCurrentPosition() {
        // 現在位置を取得（SkyTrackerアプリから）
        if (window.skyTracker && window.skyTracker.lastPosition) {
            return window.skyTracker.lastPosition;
        }
        return null;
    }

    saveEmergencyAlert(emergency) {
        const emergencyKey = `skytracker_emergency_${this.groupCode}`;
        const emergencies = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
        emergencies.push(emergency);
        localStorage.setItem(emergencyKey, JSON.stringify(emergencies));
    }

    checkEmergencyAlerts() {
        const emergencyKey = `skytracker_emergency_${this.groupCode}`;
        const emergencies = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
        
        // 過去5分以内の緊急事態をチェック
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const recentEmergencies = emergencies.filter(e => 
            e.timestamp > fiveMinutesAgo && e.userId !== this.currentUser
        );

        recentEmergencies.forEach(emergency => {
            if (!this.emergencyAlerts.includes(emergency.id)) {
                this.showEmergencyAlert(emergency);
                this.emergencyAlerts.push(emergency.id);
            }
        });
    }

    showEmergencyAlert(emergency) {
        const alert = document.createElement('div');
        alert.className = 'emergency-alert';
        alert.innerHTML = `
            <h3>🚨 緊急アラート</h3>
            <p><strong>${emergency.userName}</strong>から緊急信号</p>
            <p>${emergency.message}</p>
            <p>時刻: ${new Date(emergency.timestamp).toLocaleTimeString()}</p>
            <div class="alert-actions">
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">
                    閉じる
                </button>
                <button class="btn btn-primary" onclick="window.mapExtensions.showEmergencyLocation(${emergency.position.latitude}, ${emergency.position.longitude})">
                    位置を表示
                </button>
            </div>
        `;

        document.body.appendChild(alert);

        // 緊急音を再生
        this.playEmergencySound();

        // 10秒後に自動で閉じる
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 15000);
    }

    playEmergencySound() {
        // 緊急音の再生
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            }, i * 400);
        }
    }

    // 既存のGroupManagerメソッドをオーバーライド
    joinGroup() {
        super.joinGroup().then(() => {
            // 拡張機能の初期化
            this.loadChatHistory();
            this.updateFlightPlans();
        });
    }

    loadChatHistory() {
        const chatKey = `skytracker_chat_${this.groupCode}`;
        const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
        
        // 最新20件のメッセージを表示
        const recentMessages = messages.slice(-20);
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            recentMessages.forEach(message => {
                this.displayChatMessage(message);
            });
        }
        
        this.chatMessages = messages;
    }

    leaveGroup() {
        // 音声チャットを停止
        if (this.isVoiceChatActive) {
            this.stopVoiceChat();
        }

        super.leaveGroup();
    }
}

// 既存のGroupManagerを拡張版に置き換え
if (typeof GroupManager !== 'undefined') {
    window.EnhancedGroupManager = EnhancedGroupManager;
}