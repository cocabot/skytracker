// 詳細統計分析システム
class FlightAnalytics {
    constructor() {
        this.analysisData = null;
        this.chartInstances = new Map();
        this.analysisTypes = {
            ALTITUDE_PROFILE: 'altitude_profile',
            SPEED_ANALYSIS: 'speed_analysis',
            CLIMB_RATE: 'climb_rate',
            EFFICIENCY: 'efficiency',
            THERMAL_ANALYSIS: 'thermal_analysis'
        };
        
        this.init();
    }

    init() {
        this.createAnalyticsPanel();
        this.bindEvents();
    }

    createAnalyticsPanel() {
        // 統計パネルをHTMLに追加
        const analyticsPanel = document.createElement('div');
        analyticsPanel.id = 'analytics-panel';
        analyticsPanel.className = 'analytics-panel';
        analyticsPanel.innerHTML = `
            <div class="panel-header">
                <h3>フライト分析</h3>
                <button class="close-btn" id="closeAnalyticsPanel">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="analytics-content">
                <div class="analysis-tabs">
                    <button class="tab-btn active" data-tab="overview">概要</button>
                    <button class="tab-btn" data-tab="altitude">高度</button>
                    <button class="tab-btn" data-tab="speed">速度</button>
                    <button class="tab-btn" data-tab="thermal">サーマル</button>
                </div>
                <div class="analysis-content">
                    <div class="tab-content active" id="overview-tab">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-label">飛行時間</div>
                                <div class="stat-value" id="total-flight-time">--:--:--</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">総距離</div>
                                <div class="stat-value" id="total-distance">-- km</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">最高高度</div>
                                <div class="stat-value" id="max-altitude">-- m</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">最高速度</div>
                                <div class="stat-value" id="max-speed">-- km/h</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">平均速度</div>
                                <div class="stat-value" id="avg-speed">-- km/h</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">最大上昇率</div>
                                <div class="stat-value" id="max-climb">-- m/s</div>
                            </div>
                        </div>
                        <div class="efficiency-metrics">
                            <h4>飛行効率</h4>
                            <div class="efficiency-item">
                                <span>L/D比（推定）</span>
                                <span id="ld-ratio">--</span>
                            </div>
                            <div class="efficiency-item">
                                <span>滑空比</span>
                                <span id="glide-ratio">--</span>
                            </div>
                            <div class="efficiency-item">
                                <span>サーマル効率</span>
                                <span id="thermal-efficiency">--%</span>
                            </div>
                        </div>
                    </div>
                    <div class="tab-content" id="altitude-tab">
                        <canvas id="altitude-chart" width="400" height="200"></canvas>
                        <div class="altitude-stats">
                            <div class="altitude-stat">
                                <span>高度獲得</span>
                                <span id="altitude-gain">-- m</span>
                            </div>
                            <div class="altitude-stat">
                                <span>高度損失</span>
                                <span id="altitude-loss">-- m</span>
                            </div>
                            <div class="altitude-stat">
                                <span>平均高度</span>
                                <span id="avg-altitude">-- m</span>
                            </div>
                        </div>
                    </div>
                    <div class="tab-content" id="speed-tab">
                        <canvas id="speed-chart" width="400" height="200"></canvas>
                        <div class="speed-distribution">
                            <h4>速度分布</h4>
                            <div class="speed-ranges" id="speed-ranges">
                                <!-- 速度範囲の分布が表示される -->
                            </div>
                        </div>
                    </div>
                    <div class="tab-content" id="thermal-tab">
                        <div class="thermal-analysis">
                            <h4>サーマル分析</h4>
                            <div class="thermal-stats" id="thermal-stats">
                                <!-- サーマル統計が表示される -->
                            </div>
                            <canvas id="thermal-chart" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(analyticsPanel);
        this.addAnalyticsStyles();
    }

    addAnalyticsStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .analytics-panel {
                position: fixed;
                top: 0;
                right: -500px;
                width: 500px;
                height: 100vh;
                background: var(--surface-color);
                border-left: 1px solid var(--border-color);
                box-shadow: var(--shadow-lg);
                transition: var(--transition);
                z-index: 2000;
                display: flex;
                flex-direction: column;
            }

            .analytics-panel.open {
                right: 0;
            }

            .analytics-content {
                flex: 1;
                overflow-y: auto;
                padding: 0;
            }

            .analysis-tabs {
                display: flex;
                border-bottom: 1px solid var(--border-color);
                background: var(--background-color);
            }

            .tab-btn {
                flex: 1;
                padding: 12px 8px;
                border: none;
                background: none;
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: var(--transition);
                border-bottom: 2px solid transparent;
            }

            .tab-btn.active {
                color: var(--primary-color);
                border-bottom-color: var(--primary-color);
                background: var(--surface-color);
            }

            .tab-btn:hover:not(.active) {
                color: var(--text-primary);
                background: var(--surface-color);
            }

            .tab-content {
                display: none;
                padding: 20px;
            }

            .tab-content.active {
                display: block;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 24px;
            }

            .stat-card {
                background: var(--background-color);
                padding: 12px;
                border-radius: var(--border-radius);
                text-align: center;
            }

            .stat-label {
                font-size: 11px;
                color: var(--text-secondary);
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .stat-value {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
            }

            .efficiency-metrics {
                background: var(--background-color);
                padding: 16px;
                border-radius: var(--border-radius);
            }

            .efficiency-metrics h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: var(--text-primary);
            }

            .efficiency-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 13px;
            }

            .efficiency-item span:first-child {
                color: var(--text-secondary);
            }

            .efficiency-item span:last-child {
                color: var(--text-primary);
                font-weight: 500;
            }

            .altitude-stats, .speed-distribution {
                margin-top: 16px;
                background: var(--background-color);
                padding: 16px;
                border-radius: var(--border-radius);
            }

            .altitude-stat {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 13px;
            }

            .speed-ranges {
                margin-top: 12px;
            }

            .speed-range {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 12px;
            }

            .speed-range-bar {
                flex: 1;
                height: 8px;
                background: var(--border-color);
                border-radius: 4px;
                margin: 0 8px;
                overflow: hidden;
            }

            .speed-range-fill {
                height: 100%;
                background: var(--primary-color);
                transition: width 0.3s ease;
            }

            .thermal-analysis {
                background: var(--background-color);
                padding: 16px;
                border-radius: var(--border-radius);
            }

            .thermal-stats {
                margin-bottom: 16px;
            }

            .thermal-stat {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 13px;
            }

            canvas {
                width: 100%;
                height: 200px;
                border-radius: var(--border-radius);
                background: var(--surface-color);
            }

            @media (max-width: 768px) {
                .analytics-panel {
                    width: 100%;
                    right: -100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        // 分析パネルの開閉
        document.addEventListener('click', (e) => {
            if (e.target.id === 'closeAnalyticsPanel') {
                this.closePanel();
            }
        });

        // タブ切り替え
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // フライトデータ更新時の分析
        document.addEventListener('tracking:positionUpdate', () => {
            if (this.isPanelOpen()) {
                this.updateRealTimeAnalysis();
            }
        });
    }

    analyzeFlightData(trackData) {
        if (!trackData || trackData.length === 0) {
            return null;
        }

        this.analysisData = {
            basic: this.calculateBasicStats(trackData),
            altitude: this.analyzeAltitude(trackData),
            speed: this.analyzeSpeed(trackData),
            efficiency: this.calculateEfficiency(trackData),
            thermal: this.analyzeThermals(trackData)
        };

        return this.analysisData;
    }

    calculateBasicStats(trackData) {
        const startTime = new Date(trackData[0].timestamp);
        const endTime = new Date(trackData[trackData.length - 1].timestamp);
        const flightTime = endTime - startTime;

        const altitudes = trackData.map(p => p.altitude);
        const speeds = trackData.map(p => p.speed * 3.6); // m/s to km/h

        let totalDistance = 0;
        for (let i = 1; i < trackData.length; i++) {
            const prev = trackData[i - 1];
            const curr = trackData[i];
            totalDistance += this.calculateDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
        }

        return {
            flightTime: flightTime,
            totalDistance: totalDistance / 1000, // km
            maxAltitude: Math.max(...altitudes),
            minAltitude: Math.min(...altitudes),
            avgAltitude: altitudes.reduce((a, b) => a + b, 0) / altitudes.length,
            maxSpeed: Math.max(...speeds),
            avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
            maxClimbRate: this.calculateMaxClimbRate(trackData),
            maxSinkRate: this.calculateMaxSinkRate(trackData)
        };
    }

    analyzeAltitude(trackData) {
        const altitudes = trackData.map(p => p.altitude);
        const times = trackData.map(p => new Date(p.timestamp));
        
        let totalGain = 0;
        let totalLoss = 0;
        
        for (let i = 1; i < trackData.length; i++) {
            const altDiff = trackData[i].altitude - trackData[i - 1].altitude;
            if (altDiff > 0) {
                totalGain += altDiff;
            } else {
                totalLoss += Math.abs(altDiff);
            }
        }

        return {
            profile: this.createAltitudeProfile(trackData),
            totalGain: totalGain,
            totalLoss: totalLoss,
            altitudeRange: Math.max(...altitudes) - Math.min(...altitudes)
        };
    }

    analyzeSpeed(trackData) {
        const speeds = trackData.map(p => p.speed * 3.6); // km/h
        const distribution = this.calculateSpeedDistribution(speeds);
        
        return {
            distribution: distribution,
            profile: this.createSpeedProfile(trackData),
            speedVariability: this.calculateVariability(speeds)
        };
    }

    calculateEfficiency(trackData) {
        // L/D比の推定（簡易計算）
        let totalHorizontalDistance = 0;
        let totalAltitudeLoss = 0;
        
        for (let i = 1; i < trackData.length; i++) {
            const prev = trackData[i - 1];
            const curr = trackData[i];
            
            const horizontalDist = this.calculateDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
            const altDiff = prev.altitude - curr.altitude;
            
            if (altDiff > 0) { // 下降時のみ
                totalHorizontalDistance += horizontalDist;
                totalAltitudeLoss += altDiff;
            }
        }
        
        const ldRatio = totalAltitudeLoss > 0 ? totalHorizontalDistance / totalAltitudeLoss : 0;
        const glideRatio = ldRatio;
        
        return {
            ldRatio: ldRatio,
            glideRatio: glideRatio,
            thermalEfficiency: this.calculateThermalEfficiency(trackData)
        };
    }

    analyzeThermals(trackData) {
        const thermals = this.detectThermals(trackData);
        
        return {
            count: thermals.length,
            averageGain: thermals.length > 0 ? 
                thermals.reduce((sum, t) => sum + t.gain, 0) / thermals.length : 0,
            averageDuration: thermals.length > 0 ?
                thermals.reduce((sum, t) => sum + t.duration, 0) / thermals.length : 0,
            thermals: thermals
        };
    }

    detectThermals(trackData) {
        const thermals = [];
        let currentThermal = null;
        const minClimbRate = 0.5; // m/s
        const minDuration = 30000; // 30秒
        
        for (let i = 1; i < trackData.length; i++) {
            const point = trackData[i];
            const vario = point.vario || 0;
            
            if (vario > minClimbRate) {
                if (!currentThermal) {
                    currentThermal = {
                        startTime: new Date(point.timestamp),
                        startAltitude: point.altitude,
                        maxClimbRate: vario,
                        points: [point]
                    };
                } else {
                    currentThermal.points.push(point);
                    currentThermal.maxClimbRate = Math.max(currentThermal.maxClimbRate, vario);
                }
            } else {
                if (currentThermal) {
                    const endTime = new Date(trackData[i - 1].timestamp);
                    const duration = endTime - currentThermal.startTime;
                    
                    if (duration >= minDuration) {
                        currentThermal.endTime = endTime;
                        currentThermal.endAltitude = trackData[i - 1].altitude;
                        currentThermal.duration = duration;
                        currentThermal.gain = currentThermal.endAltitude - currentThermal.startAltitude;
                        
                        thermals.push(currentThermal);
                    }
                    
                    currentThermal = null;
                }
            }
        }
        
        return thermals;
    }

    calculateSpeedDistribution(speeds) {
        const ranges = [
            { min: 0, max: 10, label: '0-10 km/h' },
            { min: 10, max: 20, label: '10-20 km/h' },
            { min: 20, max: 30, label: '20-30 km/h' },
            { min: 30, max: 40, label: '30-40 km/h' },
            { min: 40, max: 50, label: '40-50 km/h' },
            { min: 50, max: Infinity, label: '50+ km/h' }
        ];
        
        const distribution = ranges.map(range => {
            const count = speeds.filter(speed => speed >= range.min && speed < range.max).length;
            return {
                ...range,
                count: count,
                percentage: (count / speeds.length) * 100
            };
        });
        
        return distribution;
    }

    calculateThermalEfficiency(trackData) {
        const thermals = this.detectThermals(trackData);
        if (thermals.length === 0) return 0;
        
        const totalThermalTime = thermals.reduce((sum, t) => sum + t.duration, 0);
        const totalFlightTime = new Date(trackData[trackData.length - 1].timestamp) - 
                               new Date(trackData[0].timestamp);
        
        return (totalThermalTime / totalFlightTime) * 100;
    }

    showAnalysis(trackData) {
        const analysis = this.analyzeFlightData(trackData);
        if (!analysis) return;
        
        this.openPanel();
        this.updateAnalysisDisplay(analysis);
    }

    updateAnalysisDisplay(analysis) {
        // 基本統計の更新
        this.updateBasicStats(analysis.basic);
        
        // 高度分析の更新
        this.updateAltitudeAnalysis(analysis.altitude);
        
        // 速度分析の更新
        this.updateSpeedAnalysis(analysis.speed);
        
        // サーマル分析の更新
        this.updateThermalAnalysis(analysis.thermal);
        
        // 効率指標の更新
        this.updateEfficiencyMetrics(analysis.efficiency);
    }

    updateBasicStats(basic) {
        document.getElementById('total-flight-time').textContent = 
            this.formatDuration(basic.flightTime);
        document.getElementById('total-distance').textContent = 
            `${basic.totalDistance.toFixed(2)} km`;
        document.getElementById('max-altitude').textContent = 
            `${basic.maxAltitude.toFixed(0)} m`;
        document.getElementById('max-speed').textContent = 
            `${basic.maxSpeed.toFixed(1)} km/h`;
        document.getElementById('avg-speed').textContent = 
            `${basic.avgSpeed.toFixed(1)} km/h`;
        document.getElementById('max-climb').textContent = 
            `${basic.maxClimbRate.toFixed(1)} m/s`;
    }

    updateEfficiencyMetrics(efficiency) {
        document.getElementById('ld-ratio').textContent = 
            efficiency.ldRatio.toFixed(1);
        document.getElementById('glide-ratio').textContent = 
            `1:${efficiency.glideRatio.toFixed(1)}`;
        document.getElementById('thermal-efficiency').textContent = 
            `${efficiency.thermalEfficiency.toFixed(1)}%`;
    }

    updateAltitudeAnalysis(altitude) {
        document.getElementById('altitude-gain').textContent = 
            `${altitude.totalGain.toFixed(0)} m`;
        document.getElementById('altitude-loss').textContent = 
            `${altitude.totalLoss.toFixed(0)} m`;
        
        // 高度チャートの描画
        this.drawAltitudeChart(altitude.profile);
    }

    updateSpeedAnalysis(speed) {
        // 速度分布の表示
        const rangesContainer = document.getElementById('speed-ranges');
        rangesContainer.innerHTML = '';
        
        speed.distribution.forEach(range => {
            const rangeElement = document.createElement('div');
            rangeElement.className = 'speed-range';
            rangeElement.innerHTML = `
                <span>${range.label}</span>
                <div class="speed-range-bar">
                    <div class="speed-range-fill" style="width: ${range.percentage}%"></div>
                </div>
                <span>${range.percentage.toFixed(1)}%</span>
            `;
            rangesContainer.appendChild(rangeElement);
        });
        
        // 速度チャートの描画
        this.drawSpeedChart(speed.profile);
    }

    updateThermalAnalysis(thermal) {
        const statsContainer = document.getElementById('thermal-stats');
        statsContainer.innerHTML = `
            <div class="thermal-stat">
                <span>サーマル数</span>
                <span>${thermal.count}</span>
            </div>
            <div class="thermal-stat">
                <span>平均上昇量</span>
                <span>${thermal.averageGain.toFixed(0)} m</span>
            </div>
            <div class="thermal-stat">
                <span>平均時間</span>
                <span>${this.formatDuration(thermal.averageDuration)}</span>
            </div>
        `;
        
        // サーマルチャートの描画
        this.drawThermalChart(thermal.thermals);
    }

    drawAltitudeChart(profile) {
        const canvas = document.getElementById('altitude-chart');
        const ctx = canvas.getContext('2d');
        
        // 簡易チャート描画（実際の実装ではChart.jsなどを使用）
        this.drawSimpleLineChart(ctx, profile, '#2563eb', 'Altitude (m)');
    }

    drawSpeedChart(profile) {
        const canvas = document.getElementById('speed-chart');
        const ctx = canvas.getContext('2d');
        
        this.drawSimpleLineChart(ctx, profile, '#10b981', 'Speed (km/h)');
    }

    drawThermalChart(thermals) {
        const canvas = document.getElementById('thermal-chart');
        const ctx = canvas.getContext('2d');
        
        // サーマルの可視化
        this.drawThermalVisualization(ctx, thermals);
    }

    drawSimpleLineChart(ctx, data, color, label) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        if (!data || data.length === 0) return;
        
        const values = data.map(d => d.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((point.value - minValue) / range) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }

    // ユーティリティメソッド
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
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

    switchTab(tabName) {
        // タブボタンの更新
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // タブコンテンツの更新
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    openPanel() {
        document.getElementById('analytics-panel').classList.add('open');
    }

    closePanel() {
        document.getElementById('analytics-panel').classList.remove('open');
    }

    isPanelOpen() {
        return document.getElementById('analytics-panel').classList.contains('open');
    }

    updateRealTimeAnalysis() {
        // リアルタイム分析の更新（パフォーマンスを考慮して制限）
        if (window.skyTracker && window.skyTracker.trackData) {
            const analysis = this.analyzeFlightData(window.skyTracker.trackData);
            if (analysis) {
                this.updateBasicStats(analysis.basic);
            }
        }
    }

    exportAnalysis() {
        if (!this.analysisData) return;
        
        const exportData = {
            timestamp: new Date().toISOString(),
            analysis: this.analysisData,
            metadata: {
                version: '1.0',
                generator: 'SkyTracker Analytics'
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `skytracker_analysis_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// グローバル分析システムのインスタンス作成
window.flightAnalytics = new FlightAnalytics();