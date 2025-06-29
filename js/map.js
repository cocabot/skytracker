// 地図管理クラス
class MapManager {
    constructor(mapId) {
        this.mapId = mapId;
        this.currentLayer = 'osm';
        this.trackPolyline = null;
        this.currentPositionMarker = null;
        this.groupMarkers = new Map();
        this.trackPoints = [];
        
        this.initializeMap();
        this.setupLayers();
    }

    initializeMap() {
        // 地図の初期化（東京を中心に設定）
        this.map = L.map(this.mapId, {
            center: [35.6762, 139.6503],
            zoom: 10,
            zoomControl: false
        });

        // ズームコントロールを右下に配置
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // スケールコントロール
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);

        // レイヤーを初期化してから追加
        this.setupLayers();
        this.addDefaultLayer();

        // 地図イベント
        this.map.on('locationfound', (e) => {
            this.onLocationFound(e);
        });

        this.map.on('locationerror', (e) => {
            this.onLocationError(e);
        });

        // 地図の読み込み完了後に位置取得
        this.map.whenReady(() => {
            // 現在位置の取得を試行
            this.map.locate({
                setView: true,
                maxZoom: 16,
                enableHighAccuracy: true
            });
        });
    }

    setupLayers() {
        // 利用可能な地図レイヤー
        this.layers = {
            osm: {
                name: 'OpenStreetMap',
                layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                })
            },
            satellite: {
                name: '衛星画像',
                layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles © Esri',
                    maxZoom: 19
                })
            },
            terrain: {
                name: '地形図',
                layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
                    maxZoom: 17
                })
            }
        };

        this.currentLayerObj = this.layers[this.currentLayer].layer;
    }

    addDefaultLayer() {
        if (this.layers && this.layers.osm) {
            this.currentLayerObj = this.layers.osm.layer;
            this.currentLayerObj.addTo(this.map);
        }
    }

    toggleLayer() {
        const layerKeys = Object.keys(this.layers);
        const currentIndex = layerKeys.indexOf(this.currentLayer);
        const nextIndex = (currentIndex + 1) % layerKeys.length;
        const nextLayer = layerKeys[nextIndex];

        // 現在のレイヤーを削除
        this.map.removeLayer(this.currentLayerObj);

        // 新しいレイヤーを追加
        this.currentLayer = nextLayer;
        this.currentLayerObj = this.layers[nextLayer].layer;
        this.currentLayerObj.addTo(this.map);

        // 通知
        this.showLayerNotification(this.layers[nextLayer].name);
    }

    showLayerNotification(layerName) {
        // 簡単な通知表示
        const notification = document.createElement('div');
        notification.className = 'layer-notification';
        notification.textContent = `地図: ${layerName}`;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            transition: opacity 0.3s;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    onLocationFound(e) {
        const radius = e.accuracy / 2;

        // 現在位置マーカーを更新
        if (this.currentPositionMarker) {
            this.map.removeLayer(this.currentPositionMarker);
        }

        this.currentPositionMarker = L.marker(e.latlng, {
            icon: this.createCurrentPositionIcon()
        }).addTo(this.map);

        // 精度円を表示
        L.circle(e.latlng, radius, {
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.map);
    }

    onLocationError(e) {
        console.warn('Location error:', e.message);
    }

    createCurrentPositionIcon() {
        return L.divIcon({
            className: 'current-position-marker',
            html: '<div class="position-dot"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }

    createGroupMemberIcon(member) {
        const color = this.getColorForMember(member.id);
        return L.divIcon({
            className: 'group-member-marker',
            html: `
                <div class="member-dot" style="background-color: ${color};">
                    <span>${member.name.charAt(0).toUpperCase()}</span>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    getColorForMember(memberId) {
        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];
        const hash = memberId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }

    addTrackPoint(trackPoint) {
        this.trackPoints.push([trackPoint.latitude, trackPoint.longitude]);

        if (this.trackPolyline) {
            this.map.removeLayer(this.trackPolyline);
        }

        // トラックラインを描画
        this.trackPolyline = L.polyline(this.trackPoints, {
            color: '#2563eb',
            weight: 3,
            opacity: 0.8,
            smoothFactor: 1
        }).addTo(this.map);

        // 高度に基づく色分け（オプション）
        if (this.trackPoints.length > 1) {
            this.updateTrackColorByAltitude();
        }
    }

    updateTrackColorByAltitude() {
        // 高度データがある場合、高度に基づいてトラックの色を変更
        // 実装は複雑になるため、基本版では単色のまま
    }

    updateCurrentPosition(trackPoint) {
        const latlng = [trackPoint.latitude, trackPoint.longitude];

        if (this.currentPositionMarker) {
            this.currentPositionMarker.setLatLng(latlng);
        } else {
            this.currentPositionMarker = L.marker(latlng, {
                icon: this.createCurrentPositionIcon()
            }).addTo(this.map);
        }

        // 地図の中心を現在位置に移動（オプション）
        if (this.shouldFollowPosition()) {
            this.map.panTo(latlng);
        }
    }

    shouldFollowPosition() {
        // 地図が手動で移動されていない場合のみ追従
        // 簡単な実装として、常にfalseを返す（手動制御）
        return false;
    }

    centerOnCurrentPosition() {
        if (this.currentPositionMarker) {
            this.map.setView(this.currentPositionMarker.getLatLng(), this.map.getZoom());
        } else {
            // 現在位置を再取得
            this.map.locate({
                setView: true,
                maxZoom: 16,
                enableHighAccuracy: true
            });
        }
    }

    fitTrackBounds() {
        if (this.trackPolyline && this.trackPoints.length > 1) {
            this.map.fitBounds(this.trackPolyline.getBounds(), {
                padding: [20, 20]
            });
        }
    }

    addGroupMember(member, position) {
        const latlng = [position.latitude, position.longitude];
        
        if (this.groupMarkers.has(member.id)) {
            // 既存マーカーの位置を更新
            this.groupMarkers.get(member.id).setLatLng(latlng);
        } else {
            // 新しいマーカーを作成
            const marker = L.marker(latlng, {
                icon: this.createGroupMemberIcon(member)
            }).addTo(this.map);

            // ポップアップを追加
            marker.bindPopup(`
                <div class="member-popup">
                    <strong>${member.name}</strong><br>
                    高度: ${position.altitude.toFixed(0)}m<br>
                    速度: ${(position.speed * 3.6).toFixed(1)}km/h<br>
                    時刻: ${new Date(position.timestamp).toLocaleTimeString()}
                </div>
            `);

            this.groupMarkers.set(member.id, marker);
        }
    }

    removeGroupMember(memberId) {
        if (this.groupMarkers.has(memberId)) {
            this.map.removeLayer(this.groupMarkers.get(memberId));
            this.groupMarkers.delete(memberId);
        }
    }

    clearTrack() {
        // トラックラインを削除
        if (this.trackPolyline) {
            this.map.removeLayer(this.trackPolyline);
            this.trackPolyline = null;
        }

        // トラックポイントをクリア
        this.trackPoints = [];

        // 現在位置マーカーは保持
    }

    clearAllMarkers() {
        // 全てのマーカーを削除
        if (this.currentPositionMarker) {
            this.map.removeLayer(this.currentPositionMarker);
            this.currentPositionMarker = null;
        }

        // グループマーカーを削除
        this.groupMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.groupMarkers.clear();
    }

    exportMapImage() {
        // 地図の画像エクスポート（基本的な実装）
        return new Promise((resolve) => {
            // Leafletの地図をCanvasに変換する処理
            // 実際の実装は複雑になるため、プレースホルダー
            resolve(null);
        });
    }

    // 地図の状態を保存/復元
    saveMapState() {
        const state = {
            center: this.map.getCenter(),
            zoom: this.map.getZoom(),
            layer: this.currentLayer
        };
        localStorage.setItem('skytracker_map_state', JSON.stringify(state));
    }

    restoreMapState() {
        const saved = localStorage.getItem('skytracker_map_state');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.map.setView([state.center.lat, state.center.lng], state.zoom);
                
                if (state.layer && this.layers[state.layer]) {
                    this.currentLayer = state.layer;
                    this.map.removeLayer(this.currentLayerObj);
                    this.currentLayerObj = this.layers[state.layer].layer;
                    this.currentLayerObj.addTo(this.map);
                }
            } catch (error) {
                console.error('Failed to restore map state:', error);
            }
        }
    }

    // 地図イベントハンドラー
    onMapMove() {
        this.saveMapState();
    }

    onMapZoom() {
        this.saveMapState();
    }

    // 測定ツール（距離・面積）
    enableMeasureTool() {
        // 距離測定ツールの実装
        // 複雑な機能のため、基本版では省略
    }

    disableMeasureTool() {
        // 測定ツールの無効化
    }
}

// カスタムマーカー用のCSS
const markerStyles = `
.current-position-marker {
    background: transparent;
    border: none;
}

.position-dot {
    width: 20px;
    height: 20px;
    background: #2563eb;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    animation: pulse-position 2s infinite;
}

@keyframes pulse-position {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.7;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.group-member-marker {
    background: transparent;
    border: none;
}

.member-dot {
    width: 30px;
    height: 30px;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.member-popup {
    font-size: 12px;
    line-height: 1.4;
}

.emergency-marker {
    background: transparent;
    border: none;
}

.emergency-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    animation: emergency-pulse 1s infinite;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

@keyframes emergency-pulse {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.2);
    }
}

.emergency-popup h4 {
    color: #ef4444;
    margin: 0 0 8px 0;
}

.leaflet-popup-content-wrapper {
    border-radius: 8px;
}

.leaflet-popup-content {
    margin: 8px 12px;
}
`;

// スタイルを追加
if (!document.getElementById('map-marker-styles')) {
    const style = document.createElement('style');
    style.id = 'map-marker-styles';
    style.textContent = markerStyles;
    document.head.appendChild(style);
}