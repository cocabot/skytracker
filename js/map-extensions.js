// 地図機能拡張システム
class MapExtensions {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.weatherLayer = null;
        this.airspaceLayer = null;
        this.terrainLayer = null;
        this.restrictedAreas = [];
        this.weatherData = null;
        this.is3DMode = false;
        
        this.init();
    }

    init() {
        this.setupAdditionalLayers();
        this.createMapControls();
        this.loadAirspaceData();
        this.setupWeatherSystem();
    }

    setupAdditionalLayers() {
        // 航空図レイヤーの追加
        this.mapManager.layers.aeronautical = {
            name: '航空図',
            layer: L.tileLayer('https://tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=demo', {
                attribution: '© OpenAIP',
                maxZoom: 14,
                opacity: 0.7
            })
        };

        // 地形図レイヤーの強化
        this.mapManager.layers.terrain_detailed = {
            name: '詳細地形図',
            layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
                maxZoom: 17
            })
        };

        // 衛星画像の高解像度版
        this.mapManager.layers.satellite_hd = {
            name: '高解像度衛星画像',
            layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 19
            })
        };
    }

    createMapControls() {
        // 拡張地図コントロールパネルを作成
        const extendedControls = document.createElement('div');
        extendedControls.className = 'extended-map-controls';
        extendedControls.innerHTML = `
            <div class="control-group">
                <button class="map-control-btn" id="weatherToggle" title="気象情報">
                    <i class="fas fa-cloud"></i>
                </button>
                <button class="map-control-btn" id="airspaceToggle" title="空域情報">
                    <i class="fas fa-plane"></i>
                </button>
                <button class="map-control-btn" id="terrainToggle" title="地形情報">
                    <i class="fas fa-mountain"></i>
                </button>
                <button class="map-control-btn" id="3dToggle" title="3D表示">
                    <i class="fas fa-cube"></i>
                </button>
            </div>
            <div class="layer-selector">
                <select id="layerSelect" class="layer-select">
                    <option value="osm">標準地図</option>
                    <option value="satellite">衛星画像</option>
                    <option value="satellite_hd">高解像度衛星</option>
                    <option value="terrain">地形図</option>
                    <option value="terrain_detailed">詳細地形図</option>
                    <option value="aeronautical">航空図</option>
                </select>
            </div>
        `;

        // 既存の地図コントロールの隣に追加
        const mapContainer = document.querySelector('.map-container');
        mapContainer.appendChild(extendedControls);

        this.bindExtendedControls();
        this.addExtendedControlsStyles();
    }

    bindExtendedControls() {
        // 気象情報トグル
        document.getElementById('weatherToggle').addEventListener('click', () => {
            this.toggleWeatherLayer();
        });

        // 空域情報トグル
        document.getElementById('airspaceToggle').addEventListener('click', () => {
            this.toggleAirspaceLayer();
        });

        // 地形情報トグル
        document.getElementById('terrainToggle').addEventListener('click', () => {
            this.toggleTerrainLayer();
        });

        // 3D表示トグル
        document.getElementById('3dToggle').addEventListener('click', () => {
            this.toggle3DMode();
        });

        // レイヤー選択
        document.getElementById('layerSelect').addEventListener('change', (e) => {
            this.switchToLayer(e.target.value);
        });
    }

    addExtendedControlsStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .extended-map-controls {
                position: absolute;
                top: 70px;
                right: 1rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                z-index: 1000;
            }

            .control-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                background: rgba(255, 255, 255, 0.9);
                padding: 0.5rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-md);
            }

            .layer-selector {
                background: rgba(255, 255, 255, 0.9);
                padding: 0.5rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-md);
            }

            .layer-select {
                width: 100%;
                padding: 0.25rem;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                font-size: 12px;
                background: white;
            }

            .map-control-btn.active {
                background: var(--primary-color);
                color: white;
            }

            .weather-overlay {
                position: absolute;
                top: 1rem;
                left: 1rem;
                background: rgba(255, 255, 255, 0.95);
                padding: 1rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-md);
                z-index: 1000;
                min-width: 200px;
            }

            .weather-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
                font-size: 14px;
            }

            .weather-item:last-child {
                margin-bottom: 0;
            }

            .airspace-warning {
                position: absolute;
                bottom: 1rem;
                left: 1rem;
                background: #fef2f2;
                border: 2px solid #ef4444;
                color: #991b1b;
                padding: 1rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-md);
                z-index: 1000;
                max-width: 300px;
            }

            .airspace-warning h4 {
                margin: 0 0 0.5rem 0;
                color: #ef4444;
            }

            @media (max-width: 768px) {
                .extended-map-controls {
                    top: 60px;
                    right: 0.5rem;
                }
                
                .control-group {
                    flex-direction: row;
                    flex-wrap: wrap;
                }
                
                .layer-select {
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    switchToLayer(layerKey) {
        if (!this.mapManager.layers[layerKey]) {
            console.warn(`Layer ${layerKey} not found`);
            return;
        }

        // 現在のレイヤーを削除
        if (this.mapManager.currentLayerObj) {
            this.mapManager.map.removeLayer(this.mapManager.currentLayerObj);
        }

        // 新しいレイヤーを追加
        this.mapManager.currentLayer = layerKey;
        this.mapManager.currentLayerObj = this.mapManager.layers[layerKey].layer;
        this.mapManager.currentLayerObj.addTo(this.mapManager.map);

        // 通知
        this.mapManager.showLayerNotification(this.mapManager.layers[layerKey].name);
    }

    setupWeatherSystem() {
        // 模擬気象データ（実際の実装では気象APIを使用）
        this.weatherData = {
            wind: {
                speed: 15, // km/h
                direction: 270, // 度
                gusts: 25
            },
            temperature: 22, // 摂氏
            humidity: 65, // %
            pressure: 1013, // hPa
            visibility: 10, // km
            cloudCover: 30, // %
            thermalStrength: 'moderate'
        };

        // 定期的な気象データ更新（実際の実装では外部APIから取得）
        setInterval(() => {
            this.updateWeatherData();
        }, 300000); // 5分ごと
    }

    updateWeatherData() {
        // 模擬的な気象データ更新
        this.weatherData.wind.speed += (Math.random() - 0.5) * 5;
        this.weatherData.wind.direction += (Math.random() - 0.5) * 20;
        this.weatherData.temperature += (Math.random() - 0.5) * 2;
        
        // 範囲制限
        this.weatherData.wind.speed = Math.max(0, Math.min(50, this.weatherData.wind.speed));
        this.weatherData.wind.direction = (this.weatherData.wind.direction + 360) % 360;
        this.weatherData.temperature = Math.max(-10, Math.min(40, this.weatherData.temperature));

        // 気象レイヤーが表示されている場合は更新
        if (this.weatherLayer) {
            this.updateWeatherDisplay();
        }
    }

    toggleWeatherLayer() {
        const button = document.getElementById('weatherToggle');
        
        if (this.weatherLayer) {
            document.querySelector('.weather-overlay')?.remove();
            this.clearWindArrows();
            this.weatherLayer = null;
            button.classList.remove('active');
        } else {
            this.syncWeatherFromRace();
            this.showWeatherOverlay();
            this.weatherLayer = true;
            button.classList.add('active');
        }
    }

    syncWeatherFromRace() {
        const snapshot = window.skyTracker && window.skyTracker.raceUI && window.skyTracker.raceUI.snapshot;
        if (!snapshot || !snapshot.current) return;
        const c = snapshot.current;
        this.weatherData = {
            wind: {
                speed: WeatherService ? WeatherService.msToKmh(c.wind.speed) : c.wind.speed * 3.6,
                direction: c.wind.from,
                gusts: WeatherService ? WeatherService.msToKmh(c.wind.gusts) : c.wind.gusts * 3.6
            },
            temperature: c.temperature,
            humidity: c.humidity,
            pressure: c.pressure,
            visibility: 10,
            cloudCover: c.cloudCover,
            thermalStrength: (window.skyTracker.raceUI.prediction && window.skyTracker.raceUI.prediction.meteo.trigger) || 'unknown'
        };
    }

    showWeatherOverlay() {
        const weatherOverlay = document.createElement('div');
        weatherOverlay.className = 'weather-overlay';
        weatherOverlay.innerHTML = `
            <h4><i class="fas fa-cloud"></i> 気象情報</h4>
            <div class="weather-item">
                <span>風速:</span>
                <span id="wind-speed">${this.weatherData.wind.speed.toFixed(1)} km/h</span>
            </div>
            <div class="weather-item">
                <span>風向:</span>
                <span id="wind-direction">${this.weatherData.wind.direction.toFixed(0)}°</span>
            </div>
            <div class="weather-item">
                <span>突風:</span>
                <span id="wind-gusts">${this.weatherData.wind.gusts.toFixed(1)} km/h</span>
            </div>
            <div class="weather-item">
                <span>気温:</span>
                <span id="temperature">${this.weatherData.temperature.toFixed(1)}°C</span>
            </div>
            <div class="weather-item">
                <span>湿度:</span>
                <span id="humidity">${this.weatherData.humidity}%</span>
            </div>
            <div class="weather-item">
                <span>気圧:</span>
                <span id="pressure">${this.weatherData.pressure} hPa</span>
            </div>
            <div class="weather-item">
                <span>視程:</span>
                <span id="visibility">${this.weatherData.visibility} km</span>
            </div>
            <div class="weather-item">
                <span>雲量:</span>
                <span id="cloud-cover">${this.weatherData.cloudCover}%</span>
            </div>
        `;

        document.querySelector('.map-container').appendChild(weatherOverlay);
        this.addWindArrows();
    }

    updateWeatherDisplay() {
        document.getElementById('wind-speed').textContent = `${this.weatherData.wind.speed.toFixed(1)} km/h`;
        document.getElementById('wind-direction').textContent = `${this.weatherData.wind.direction.toFixed(0)}°`;
        document.getElementById('wind-gusts').textContent = `${this.weatherData.wind.gusts.toFixed(1)} km/h`;
        document.getElementById('temperature').textContent = `${this.weatherData.temperature.toFixed(1)}°C`;
        document.getElementById('humidity').textContent = `${this.weatherData.humidity}%`;
        document.getElementById('pressure').textContent = `${this.weatherData.pressure} hPa`;
        document.getElementById('visibility').textContent = `${this.weatherData.visibility} km`;
        document.getElementById('cloud-cover').textContent = `${this.weatherData.cloudCover}%`;
    }

    addWindArrows() {
        this.clearWindArrows();
        this.windMarkers = [];

        const windIcon = L.divIcon({
            className: 'wind-arrow',
            html: `<div class="arrow" style="transform: rotate(${this.weatherData.wind.direction}deg);">→</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const bounds = this.mapManager.map.getBounds();
        const center = bounds.getCenter();
        const spanLat = Math.max(0.02, (bounds.getNorth() - bounds.getSouth()) / 3);
        const spanLng = Math.max(0.02, (bounds.getEast() - bounds.getWest()) / 3);

        for (let i = 0; i < 4; i++) {
            const lat = center.lat + (i % 2 === 0 ? -spanLat / 2 : spanLat / 2);
            const lng = center.lng + (i < 2 ? -spanLng / 2 : spanLng / 2);
            const marker = L.marker([lat, lng], { icon: windIcon });
            marker.addTo(this.mapManager.map);
            this.windMarkers.push(marker);
        }
    }

    clearWindArrows() {
        if (!this.windMarkers) return;
        this.windMarkers.forEach((marker) => {
            this.mapManager.map.removeLayer(marker);
        });
        this.windMarkers = [];
    }

    loadAirspaceData() {
        // 模擬的な空域データ（実際の実装では航空局データを使用）
        this.restrictedAreas = [
            {
                id: 'restricted_1',
                name: '羽田空港管制圏',
                type: 'airport_control',
                coordinates: [
                    [35.5494, 139.7798],
                    [35.5494, 139.8098],
                    [35.5794, 139.8098],
                    [35.5794, 139.7798]
                ],
                altitude: { min: 0, max: 1500 },
                warning: '管制圏内での飛行は許可が必要です'
            },
            {
                id: 'restricted_2',
                name: '成田空港管制圏',
                type: 'airport_control',
                coordinates: [
                    [35.7647, 140.3864],
                    [35.7647, 140.4164],
                    [35.7947, 140.4164],
                    [35.7947, 140.3864]
                ],
                altitude: { min: 0, max: 2000 },
                warning: '管制圏内での飛行は許可が必要です'
            },
            {
                id: 'restricted_3',
                name: '自衛隊訓練空域',
                type: 'military',
                coordinates: [
                    [35.6000, 139.5000],
                    [35.6000, 139.6000],
                    [35.7000, 139.6000],
                    [35.7000, 139.5000]
                ],
                altitude: { min: 500, max: 3000 },
                warning: '軍事訓練空域のため飛行注意'
            }
        ];
    }

    toggleAirspaceLayer() {
        const button = document.getElementById('airspaceToggle');
        
        if (this.airspaceLayer) {
            // 空域レイヤーを非表示
            this.mapManager.map.removeLayer(this.airspaceLayer);
            this.airspaceLayer = null;
            button.classList.remove('active');
            document.querySelector('.airspace-warning')?.remove();
        } else {
            // 空域レイヤーを表示
            this.showAirspaceLayer();
            button.classList.add('active');
            this.checkAirspaceProximity();
        }
    }

    showAirspaceLayer() {
        this.airspaceLayer = L.layerGroup();

        this.restrictedAreas.forEach(area => {
            const color = this.getAirspaceColor(area.type);
            const polygon = L.polygon(area.coordinates, {
                color: color,
                fillColor: color,
                fillOpacity: 0.3,
                weight: 2
            });

            polygon.bindPopup(`
                <div class="airspace-popup">
                    <h4>${area.name}</h4>
                    <p><strong>種類:</strong> ${this.getAirspaceTypeName(area.type)}</p>
                    <p><strong>高度:</strong> ${area.altitude.min}m - ${area.altitude.max}m</p>
                    <p><strong>注意:</strong> ${area.warning}</p>
                </div>
            `);

            this.airspaceLayer.addLayer(polygon);
        });

        this.airspaceLayer.addTo(this.mapManager.map);
    }

    getAirspaceColor(type) {
        const colors = {
            'airport_control': '#ef4444',
            'military': '#f59e0b',
            'restricted': '#dc2626',
            'danger': '#991b1b'
        };
        return colors[type] || '#64748b';
    }

    getAirspaceTypeName(type) {
        const names = {
            'airport_control': '空港管制圏',
            'military': '軍事空域',
            'restricted': '制限空域',
            'danger': '危険空域'
        };
        return names[type] || '不明';
    }

    checkAirspaceProximity() {
        if (!this.mapManager.currentPositionMarker) return;

        const currentPos = this.mapManager.currentPositionMarker.getLatLng();
        
        this.restrictedAreas.forEach(area => {
            const polygon = L.polygon(area.coordinates);
            const distance = this.calculateDistanceToPolygon(currentPos, polygon);
            
            if (distance < 1000) { // 1km以内
                this.showAirspaceWarning(area);
            }
        });
    }

    calculateDistanceToPolygon(point, polygon) {
        // 簡易的な距離計算（実際の実装ではより正確な計算が必要）
        const bounds = polygon.getBounds();
        const center = bounds.getCenter();
        
        return this.mapManager.map.distance(point, center);
    }

    showAirspaceWarning(area) {
        // 既存の警告を削除
        document.querySelector('.airspace-warning')?.remove();

        const warning = document.createElement('div');
        warning.className = 'airspace-warning';
        warning.innerHTML = `
            <h4><i class="fas fa-exclamation-triangle"></i> 空域警告</h4>
            <p><strong>${area.name}</strong>に接近しています</p>
            <p>${area.warning}</p>
            <button onclick="this.parentElement.remove()" class="btn btn-sm btn-secondary">
                閉じる
            </button>
        `;

        document.querySelector('.map-container').appendChild(warning);

        // 5秒後に自動で閉じる
        setTimeout(() => {
            warning.remove();
        }, 10000);
    }

    toggleTerrainLayer() {
        const button = document.getElementById('terrainToggle');
        
        if (this.terrainLayer) {
            // 地形レイヤーを非表示
            this.mapManager.map.removeLayer(this.terrainLayer);
            this.terrainLayer = null;
            button.classList.remove('active');
        } else {
            // 地形レイヤーを表示
            this.showTerrainLayer();
            button.classList.add('active');
        }
    }

    showTerrainLayer() {
        // 等高線レイヤーを追加
        this.terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
            opacity: 0.6,
            maxZoom: 17
        });

        this.terrainLayer.addTo(this.mapManager.map);
    }

    toggle3DMode() {
        const button = document.getElementById('3dToggle');
        
        if (this.is3DMode) {
            // 3Dモードを無効化
            this.disable3DMode();
            button.classList.remove('active');
            this.is3DMode = false;
        } else {
            // 3Dモードを有効化
            this.enable3DMode();
            button.classList.add('active');
            this.is3DMode = true;
        }
    }

    enable3DMode() {
        // 3D表示の実装（基本的な傾斜表示）
        this.mapManager.map.getContainer().style.transform = 'perspective(1000px) rotateX(45deg)';
        this.mapManager.map.getContainer().style.transformOrigin = 'center bottom';
        
        // 3D効果のための追加スタイル
        const style = document.createElement('style');
        style.id = '3d-mode-styles';
        style.textContent = `
            .leaflet-container.mode-3d {
                transform: perspective(1000px) rotateX(45deg);
                transform-origin: center bottom;
            }
            
            .leaflet-marker-icon {
                transform: rotateX(-45deg);
            }
        `;
        document.head.appendChild(style);
        
        this.mapManager.map.getContainer().classList.add('mode-3d');
    }

    disable3DMode() {
        // 3Dモードを無効化
        this.mapManager.map.getContainer().style.transform = '';
        this.mapManager.map.getContainer().style.transformOrigin = '';
        this.mapManager.map.getContainer().classList.remove('mode-3d');
        
        // 3D用スタイルを削除
        const style = document.getElementById('3d-mode-styles');
        if (style) {
            style.remove();
        }
    }

    // 高度プロファイル表示
    showAltitudeProfile(trackData) {
        if (!trackData || trackData.length === 0) return;

        const profileContainer = document.createElement('div');
        profileContainer.className = 'altitude-profile';
        profileContainer.innerHTML = `
            <div class="profile-header">
                <h4>高度プロファイル</h4>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <canvas id="altitude-profile-chart" width="400" height="150"></canvas>
        `;

        document.querySelector('.map-container').appendChild(profileContainer);
        this.drawAltitudeProfile(trackData);
    }

    drawAltitudeProfile(trackData) {
        const canvas = document.getElementById('altitude-profile-chart');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // データの準備
        const altitudes = trackData.map(p => p.altitude);
        const minAlt = Math.min(...altitudes);
        const maxAlt = Math.max(...altitudes);
        const altRange = maxAlt - minAlt;

        // 背景をクリア
        ctx.clearRect(0, 0, width, height);

        // グリッド描画
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 高度プロファイル描画
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();

        trackData.forEach((point, index) => {
            const x = (index / (trackData.length - 1)) * width;
            const y = height - ((point.altitude - minAlt) / altRange) * height;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // 高度ラベル
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Inter';
        ctx.fillText(`${maxAlt.toFixed(0)}m`, 5, 15);
        ctx.fillText(`${minAlt.toFixed(0)}m`, 5, height - 5);
    }

    // 測定ツール
    enableMeasureTool() {
        this.measureMode = true;
        this.measurePoints = [];
        
        this.mapManager.map.getContainer().style.cursor = 'crosshair';
        
        this.mapManager.map.on('click', this.onMeasureClick.bind(this));
    }

    onMeasureClick(e) {
        if (!this.measureMode) return;

        this.measurePoints.push(e.latlng);

        // マーカーを追加
        L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'measure-marker',
                html: `<div class="measure-dot">${this.measurePoints.length}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.mapManager.map);

        // 2点以上ある場合は距離を計算
        if (this.measurePoints.length >= 2) {
            this.showMeasureResult();
        }
    }

    showMeasureResult() {
        let totalDistance = 0;
        
        for (let i = 1; i < this.measurePoints.length; i++) {
            const prev = this.measurePoints[i - 1];
            const curr = this.measurePoints[i];
            totalDistance += this.mapManager.map.distance(prev, curr);
        }

        const popup = L.popup()
            .setLatLng(this.measurePoints[this.measurePoints.length - 1])
            .setContent(`
                <div class="measure-result">
                    <strong>測定結果</strong><br>
                    距離: ${(totalDistance / 1000).toFixed(2)} km<br>
                    <button onclick="window.mapExtensions.clearMeasure()">クリア</button>
                </div>
            `)
            .openOn(this.mapManager.map);
    }

    clearMeasure() {
        this.measureMode = false;
        this.measurePoints = [];
        this.mapManager.map.getContainer().style.cursor = '';
        this.mapManager.map.off('click', this.onMeasureClick);
        
        // 測定マーカーを削除
        this.mapManager.map.eachLayer(layer => {
            if (layer.options && layer.options.icon && 
                layer.options.icon.options.className === 'measure-marker') {
                this.mapManager.map.removeLayer(layer);
            }
        });
    }

    // 飛行禁止区域の警告
    checkFlightRestrictions(position) {
        this.restrictedAreas.forEach(area => {
            if (this.isPointInPolygon(position, area.coordinates)) {
                this.showFlightRestrictionWarning(area);
            }
        });
    }

    isPointInPolygon(point, polygon) {
        // 簡易的なポイント・イン・ポリゴン判定
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i][0] > point.lat) !== (polygon[j][0] > point.lat)) &&
                (point.lng < (polygon[j][1] - polygon[i][1]) * (point.lat - polygon[i][0]) / 
                (polygon[j][0] - polygon[i][0]) + polygon[i][1])) {
                inside = !inside;
            }
        }
        return inside;
    }

    showFlightRestrictionWarning(area) {
        if (window.skyTracker) {
            window.skyTracker.showNotification(
                `警告: ${area.name}内での飛行が検出されました。${area.warning}`,
                'warning'
            );
        }
    }

    // 緊急位置表示
    showEmergencyLocation(lat, lng) {
        // 緊急位置にマーカーを追加
        const emergencyIcon = L.divIcon({
            className: 'emergency-marker',
            html: '<div class="emergency-icon">🚨</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const emergencyMarker = L.marker([lat, lng], { icon: emergencyIcon })
            .addTo(this.mapManager.map);

        emergencyMarker.bindPopup(`
            <div class="emergency-popup">
                <h4>🚨 緊急事態</h4>
                <p>緊急アラートの発信位置</p>
                <p>座標: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
            </div>
        `).openPopup();

        // 地図を緊急位置に移動
        this.mapManager.map.setView([lat, lng], 16);

        // 5分後にマーカーを削除
        setTimeout(() => {
            this.mapManager.map.removeLayer(emergencyMarker);
        }, 300000);
    }
}

// グローバルに公開
window.MapExtensions = MapExtensions;