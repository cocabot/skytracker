// オンボーディング・ユーザビリティ改善システム
class OnboardingManager {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.hasCompletedOnboarding = this.checkOnboardingStatus();
        this.steps = [
            {
                target: '.tracking-btn',
                title: 'フライトトラッキング',
                content: 'このボタンでGPS追跡を開始・停止できます。フライト前にタップして記録を開始しましょう。',
                position: 'bottom'
            },
            {
                target: '#map',
                title: '地図表示',
                content: '現在位置とフライトルートがリアルタイムで表示されます。地図をドラッグして移動、ピンチでズームできます。',
                position: 'center'
            },
            {
                target: '.info-grid',
                title: 'フライト情報',
                content: '高度、速度、上昇率などの重要な情報がリアルタイムで表示されます。',
                position: 'top'
            },
            {
                target: '.map-controls',
                title: '地図コントロール',
                content: '現在位置への移動、地図レイヤーの切り替え、フルスクリーン表示ができます。',
                position: 'left'
            },
            {
                target: '#groupBtn',
                title: 'グループ機能',
                content: '他のパイロットと位置を共有できます。グループコードを共有して一緒にフライトを楽しみましょう。',
                position: 'bottom'
            },
            {
                target: '#exportBtn',
                title: 'データエクスポート',
                content: 'フライトデータをIGCファイルとして保存できます。他のソフトウェアで詳細分析が可能です。',
                position: 'top'
            }
        ];
        
        this.init();
    }

    init() {
        this.createOnboardingElements();
        this.bindEvents();
        
        // 初回起動時にオンボーディングを表示
        if (!this.hasCompletedOnboarding) {
            setTimeout(() => {
                this.startOnboarding();
            }, 2000);
        }
    }

    createOnboardingElements() {
        // オンボーディングオーバーレイ
        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'onboarding-overlay';
        overlay.innerHTML = `
            <div class="onboarding-spotlight"></div>
            <div class="onboarding-tooltip">
                <div class="tooltip-header">
                    <h3 class="tooltip-title"></h3>
                    <button class="tooltip-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="tooltip-content"></div>
                <div class="tooltip-footer">
                    <div class="step-indicator">
                        <span class="current-step">1</span> / <span class="total-steps">6</span>
                    </div>
                    <div class="tooltip-actions">
                        <button class="btn btn-secondary" id="onboarding-skip">スキップ</button>
                        <button class="btn btn-secondary" id="onboarding-prev" style="display: none;">戻る</button>
                        <button class="btn btn-primary" id="onboarding-next">次へ</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // ヘルプボタンを追加
        const helpButton = document.createElement('button');
        helpButton.id = 'help-button';
        helpButton.className = 'help-button';
        helpButton.innerHTML = '<i class="fas fa-question-circle"></i>';
        helpButton.title = 'ヘルプ・チュートリアル';
        document.querySelector('.header-controls').appendChild(helpButton);

        // ツールチップ用スタイル
        this.addOnboardingStyles();
    }

    addOnboardingStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .onboarding-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                display: none;
                pointer-events: none;
            }

            .onboarding-overlay.active {
                display: block;
            }

            .onboarding-spotlight {
                position: absolute;
                border: 3px solid #2563eb;
                border-radius: 8px;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
                pointer-events: none;
                transition: all 0.3s ease;
            }

            .onboarding-tooltip {
                position: absolute;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                max-width: 320px;
                min-width: 280px;
                pointer-events: auto;
                z-index: 10000;
            }

            .tooltip-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px 0;
            }

            .tooltip-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
                margin: 0;
            }

            .tooltip-close {
                background: none;
                border: none;
                font-size: 16px;
                color: #64748b;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }

            .tooltip-close:hover {
                background: #f1f5f9;
            }

            .tooltip-content {
                padding: 12px 20px;
                color: #475569;
                line-height: 1.6;
                font-size: 14px;
            }

            .tooltip-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-top: 1px solid #e2e8f0;
            }

            .step-indicator {
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
            }

            .current-step {
                color: #2563eb;
                font-weight: 600;
            }

            .tooltip-actions {
                display: flex;
                gap: 8px;
            }

            .tooltip-actions .btn {
                padding: 6px 12px;
                font-size: 12px;
            }

            .help-button {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #2563eb;
                color: white;
                border: none;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .help-button:hover {
                background: #1d4ed8;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }

            .feature-highlight {
                position: relative;
                z-index: 10001;
            }

            .feature-highlight::after {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border: 2px solid #2563eb;
                border-radius: 8px;
                pointer-events: none;
                animation: pulse-highlight 2s infinite;
            }

            @keyframes pulse-highlight {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.02); }
            }

            .contextual-help {
                position: absolute;
                background: #1e293b;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
            }

            .contextual-help.show {
                opacity: 1;
                transform: translateY(0);
            }

            .contextual-help::after {
                content: '';
                position: absolute;
                top: -4px;
                left: 50%;
                transform: translateX(-50%);
                border: 4px solid transparent;
                border-bottom-color: #1e293b;
            }

            @media (max-width: 768px) {
                .onboarding-tooltip {
                    max-width: 280px;
                    min-width: 260px;
                }
                
                .tooltip-title {
                    font-size: 16px;
                }
                
                .tooltip-content {
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        // オンボーディングコントロール
        document.addEventListener('click', (e) => {
            if (e.target.id === 'onboarding-next') {
                this.nextStep();
            } else if (e.target.id === 'onboarding-prev') {
                this.prevStep();
            } else if (e.target.id === 'onboarding-skip' || e.target.classList.contains('tooltip-close')) {
                this.skipOnboarding();
            } else if (e.target.id === 'help-button') {
                this.showHelp();
            }
        });

        // ESCキーでオンボーディング終了
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.skipOnboarding();
            }
        });

        // コンテキストヘルプの表示
        this.setupContextualHelp();
    }

    setupContextualHelp() {
        const helpTargets = [
            { selector: '.tracking-btn', text: 'クリックでトラッキング開始' },
            { selector: '#centerBtn', text: '現在位置に移動' },
            { selector: '#layerBtn', text: '地図レイヤー切り替え' },
            { selector: '#fullscreenBtn', text: 'フルスクリーン表示' },
            { selector: '#exportBtn', text: 'IGCファイルをダウンロード' },
            { selector: '#shareBtn', text: 'フライト情報を共有' },
            { selector: '#groupBtn', text: 'グループ機能' },
            { selector: '#settingsBtn', text: '設定' }
        ];

        helpTargets.forEach(({ selector, text }) => {
            const element = document.querySelector(selector);
            if (element) {
                this.addContextualHelp(element, text);
            }
        });
    }

    addContextualHelp(element, text) {
        let helpTooltip = null;

        element.addEventListener('mouseenter', () => {
            if (this.isActive) return; // オンボーディング中は表示しない

            helpTooltip = document.createElement('div');
            helpTooltip.className = 'contextual-help';
            helpTooltip.textContent = text;
            
            document.body.appendChild(helpTooltip);
            
            const rect = element.getBoundingClientRect();
            helpTooltip.style.left = rect.left + (rect.width / 2) - (helpTooltip.offsetWidth / 2) + 'px';
            helpTooltip.style.top = rect.bottom + 8 + 'px';
            
            setTimeout(() => helpTooltip.classList.add('show'), 10);
        });

        element.addEventListener('mouseleave', () => {
            if (helpTooltip) {
                helpTooltip.classList.remove('show');
                setTimeout(() => {
                    if (helpTooltip && helpTooltip.parentNode) {
                        helpTooltip.parentNode.removeChild(helpTooltip);
                    }
                }, 300);
            }
        });
    }

    startOnboarding() {
        this.isActive = true;
        this.currentStep = 0;
        
        const overlay = document.getElementById('onboarding-overlay');
        overlay.classList.add('active');
        
        this.showStep(this.currentStep);
    }

    showStep(stepIndex) {
        const step = this.steps[stepIndex];
        if (!step) return;

        const target = document.querySelector(step.target);
        if (!target) {
            console.warn(`Onboarding target not found: ${step.target}`);
            this.nextStep();
            return;
        }

        // スポットライトの位置設定
        this.positionSpotlight(target);
        
        // ツールチップの位置設定
        this.positionTooltip(target, step);
        
        // コンテンツ更新
        this.updateTooltipContent(step);
        
        // ステップインジケーター更新
        this.updateStepIndicator();
        
        // ボタン状態更新
        this.updateNavigationButtons();
    }

    positionSpotlight(target) {
        const spotlight = document.querySelector('.onboarding-spotlight');
        const rect = target.getBoundingClientRect();
        
        spotlight.style.left = (rect.left - 8) + 'px';
        spotlight.style.top = (rect.top - 8) + 'px';
        spotlight.style.width = (rect.width + 16) + 'px';
        spotlight.style.height = (rect.height + 16) + 'px';
    }

    positionTooltip(target, step) {
        const tooltip = document.querySelector('.onboarding-tooltip');
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left, top;
        
        switch (step.position) {
            case 'top':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.top - tooltipRect.height - 20;
                break;
            case 'bottom':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.bottom + 20;
                break;
            case 'left':
                left = rect.left - tooltipRect.width - 20;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'right':
                left = rect.right + 20;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'center':
            default:
                left = (window.innerWidth / 2) - (tooltipRect.width / 2);
                top = (window.innerHeight / 2) - (tooltipRect.height / 2);
                break;
        }
        
        // 画面外に出ないよう調整
        left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));
        top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    updateTooltipContent(step) {
        document.querySelector('.tooltip-title').textContent = step.title;
        document.querySelector('.tooltip-content').textContent = step.content;
    }

    updateStepIndicator() {
        document.querySelector('.current-step').textContent = this.currentStep + 1;
        document.querySelector('.total-steps').textContent = this.steps.length;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('onboarding-prev');
        const nextBtn = document.getElementById('onboarding-next');
        
        prevBtn.style.display = this.currentStep > 0 ? 'block' : 'none';
        nextBtn.textContent = this.currentStep === this.steps.length - 1 ? '完了' : '次へ';
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.completeOnboarding();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    skipOnboarding() {
        this.completeOnboarding();
    }

    completeOnboarding() {
        this.isActive = false;
        
        const overlay = document.getElementById('onboarding-overlay');
        overlay.classList.remove('active');
        
        // オンボーディング完了をマーク
        localStorage.setItem('skytracker_onboarding_completed', 'true');
        
        if (window.skyTracker) {
            window.skyTracker.showNotification('チュートリアルが完了しました！安全なフライトをお楽しみください。', 'success');
        }
    }

    showHelp() {
        // ヘルプダイアログの表示
        this.showHelpDialog();
    }

    showHelpDialog() {
        const helpDialog = document.createElement('div');
        helpDialog.className = 'help-dialog';
        helpDialog.innerHTML = `
            <div class="help-dialog-overlay"></div>
            <div class="help-dialog-content">
                <div class="help-header">
                    <h2>SkyTracker ヘルプ</h2>
                    <button class="help-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="help-body">
                    <div class="help-section">
                        <h3>基本操作</h3>
                        <ul>
                            <li><strong>トラッキング開始</strong>: 青いボタンをタップしてGPS追跡を開始</li>
                            <li><strong>地図操作</strong>: ドラッグで移動、ピンチでズーム</li>
                            <li><strong>現在位置</strong>: 右上の十字ボタンで現在位置に移動</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h3>グループ機能</h3>
                        <ul>
                            <li><strong>参加方法</strong>: グループボタンからコードを入力</li>
                            <li><strong>位置共有</strong>: トラッキング中は自動で位置が共有される</li>
                            <li><strong>メンバー確認</strong>: 地図上で他のメンバーの位置を確認</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h3>データエクスポート</h3>
                        <ul>
                            <li><strong>IGCファイル</strong>: 国際標準形式でフライトデータを保存</li>
                            <li><strong>共有機能</strong>: フライト情報を簡単に共有</li>
                            <li><strong>統計情報</strong>: 最高高度、飛行距離などを確認</li>
                        </ul>
                    </div>
                </div>
                <div class="help-footer">
                    <button class="btn btn-primary" id="restart-tutorial">チュートリアルを再開</button>
                    <button class="btn btn-secondary help-close">閉じる</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(helpDialog);
        
        // ヘルプダイアログのスタイル
        this.addHelpDialogStyles();
        
        // イベントリスナー
        helpDialog.addEventListener('click', (e) => {
            if (e.target.classList.contains('help-close') || 
                e.target.classList.contains('help-dialog-overlay')) {
                this.closeHelpDialog(helpDialog);
            } else if (e.target.id === 'restart-tutorial') {
                this.closeHelpDialog(helpDialog);
                this.startOnboarding();
            }
        });
    }

    addHelpDialogStyles() {
        if (document.getElementById('help-dialog-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'help-dialog-styles';
        style.textContent = `
            .help-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .help-dialog-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
            }

            .help-dialog-content {
                position: relative;
                background: white;
                border-radius: 12px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }

            .help-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
            }

            .help-header h2 {
                margin: 0;
                color: #1e293b;
            }

            .help-close {
                background: none;
                border: none;
                font-size: 18px;
                color: #64748b;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
            }

            .help-close:hover {
                background: #f1f5f9;
            }

            .help-body {
                padding: 20px;
            }

            .help-section {
                margin-bottom: 24px;
            }

            .help-section h3 {
                color: #2563eb;
                margin-bottom: 12px;
                font-size: 16px;
            }

            .help-section ul {
                margin: 0;
                padding-left: 20px;
            }

            .help-section li {
                margin-bottom: 8px;
                line-height: 1.5;
                color: #475569;
            }

            .help-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                padding: 20px;
                border-top: 1px solid #e2e8f0;
            }

            @media (max-width: 768px) {
                .help-dialog-content {
                    margin: 20px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    closeHelpDialog(dialog) {
        dialog.remove();
    }

    checkOnboardingStatus() {
        return localStorage.getItem('skytracker_onboarding_completed') === 'true';
    }

    resetOnboarding() {
        localStorage.removeItem('skytracker_onboarding_completed');
        this.hasCompletedOnboarding = false;
    }

    // 機能別ヘルプの表示
    showFeatureHelp(feature) {
        const helpTexts = {
            tracking: 'GPS追跡を開始するには青いボタンをタップしてください。位置情報の許可が必要です。',
            map: '地図をドラッグして移動、ピンチでズームできます。右上のボタンで現在位置に戻れます。',
            export: 'フライト後にIGCボタンをタップしてデータをダウンロードできます。',
            group: 'グループコードを共有して他のパイロットと位置を共有できます。'
        };

        const text = helpTexts[feature];
        if (text && window.skyTracker) {
            window.skyTracker.showNotification(text, 'info');
        }
    }
}

// グローバルオンボーディングマネージャーのインスタンス作成
window.onboardingManager = new OnboardingManager();