// データインポート機能
class DataImporter {
    constructor() {
        this.supportedFormats = ['igc', 'gpx', 'kml'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        
        this.init();
    }

    init() {
        this.createImportUI();
        this.bindEvents();
    }

    createImportUI() {
        // インポートボタンをアクションボタンエリアに追加
        const actionButtons = document.querySelector('.action-buttons');
        if (!actionButtons) return;

        const importBtn = document.createElement('button');
        importBtn.className = 'btn btn-secondary';
        importBtn.id = 'importBtn';
        importBtn.innerHTML = '<i class="fas fa-upload"></i> インポート';
        
        // エクスポートボタンの後に挿入
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.parentNode.insertBefore(importBtn, exportBtn.nextSibling);
        } else {
            actionButtons.appendChild(importBtn);
        }

        // 隠しファイル入力要素を作成
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileInput';
        fileInput.accept = '.igc,.gpx,.kml';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    bindEvents() {
        // インポートボタンクリック
        document.getElementById('importBtn')?.addEventListener('click', () => {
            this.openFileDialog();
        });

        // ファイル選択
        document.getElementById('fileInput')?.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // ドラッグ&ドロップ
        this.setupDragAndDrop();
    }

    openFileDialog() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    handleFileSelect(event) {
        const files = event.target.files;
        if (files.length === 0) return;

        const file = files[0];
        this.processFile(file);
    }

    async processFile(file) {
        try {
            // ファイルサイズチェック
            if (file.size > this.maxFileSize) {
                throw new Error('ファイルサイズが大きすぎます（最大10MB）');
            }

            // ファイル形式チェック
            const extension = this.getFileExtension(file.name);
            if (!this.supportedFormats.includes(extension)) {
                throw new Error('サポートされていないファイル形式です');
            }

            // ファイル読み込み
            const content = await this.readFile(file);
            
            // 形式に応じて解析
            let trackData;
            switch (extension) {
                case 'igc':
                    trackData = this.parseIGC(content);
                    break;
                case 'gpx':
                    trackData = this.parseGPX(content);
                    break;
                case 'kml':
                    trackData = this.parseKML(content);
                    break;
                default:
                    throw new Error('未対応の形式です');
            }

            // データを適用
            this.applyImportedData(trackData, file.name);
            
            this.showNotification(`${file.name} を正常にインポートしました`, 'success');

        } catch (error) {
            this.showNotification(`インポートエラー: ${error.message}`, 'error');
            console.error('Import error:', error);
        }
    }

    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('ファイル読み込みエラー'));
            reader.readAsText(file);
        });
    }

    parseIGC(content) {
        // IGCExporterクラスのparseIGCメソッドを使用
        if (window.IGCExporter) {
            const exporter = new IGCExporter();
            return exporter.parseIGC(content);
        }
        throw new Error('IGC解析機能が利用できません');
    }

    parseGPX(content) {
        // 基本的なGPX解析
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        const trackPoints = [];
        const trkpts = xmlDoc.getElementsByTagName('trkpt');
        
        for (let i = 0; i < trkpts.length; i++) {
            const trkpt = trkpts[i];
            const lat = parseFloat(trkpt.getAttribute('lat'));
            const lon = parseFloat(trkpt.getAttribute('lon'));
            
            const eleElement = trkpt.getElementsByTagName('ele')[0];
            const timeElement = trkpt.getElementsByTagName('time')[0];
            
            const altitude = eleElement ? parseFloat(eleElement.textContent) : 0;
            const timestamp = timeElement ? new Date(timeElement.textContent) : new Date();
            
            trackPoints.push({
                timestamp: timestamp,
                latitude: lat,
                longitude: lon,
                altitude: altitude,
                speed: 0,
                accuracy: 5
            });
        }
        
        return trackPoints;
    }

    parseKML(content) {
        // 基本的なKML解析
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        const trackPoints = [];
        const coordinates = xmlDoc.getElementsByTagName('coordinates');
        
        if (coordinates.length > 0) {
            const coordText = coordinates[0].textContent.trim();
            const coordLines = coordText.split(/\s+/);
            
            coordLines.forEach((line, index) => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const lon = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    const alt = parts.length > 2 ? parseFloat(parts[2]) : 0;
                    
                    trackPoints.push({
                        timestamp: new Date(Date.now() + index * 1000),
                        latitude: lat,
                        longitude: lon,
                        altitude: alt,
                        speed: 0,
                        accuracy: 5
                    });
                }
            });
        }
        
        return trackPoints;
    }

    applyImportedData(trackData, filename) {
        if (!trackData || trackData.length === 0) {
            throw new Error('有効なトラックデータが見つかりません');
        }

        // 既存のトラッキングを停止
        if (window.skyTracker && window.skyTracker.isTracking) {
            window.skyTracker.stopTracking();
        }

        // インポートしたデータを適用
        if (window.skyTracker) {
            window.skyTracker.trackData = trackData;
            window.skyTracker.startTime = trackData[0].timestamp;
            window.skyTracker.lastPosition = trackData[trackData.length - 1];
            
            // 距離を再計算
            window.skyTracker.totalDistance = this.calculateTotalDistance(trackData);
            
            // 地図を更新
            this.updateMapWithImportedData(trackData);
            
            // UI更新
            this.updateUIWithImportedData(trackData);
            
            // ボタンを有効化
            window.skyTracker.enableButtons();
        }
    }

    calculateTotalDistance(trackData) {
        let totalDistance = 0;
        for (let i = 1; i < trackData.length; i++) {
            const prev = trackData[i - 1];
            const curr = trackData[i];
            totalDistance += this.calculateDistance(
                prev.latitude, prev.longitude,
                curr.latitude, curr.longitude
            );
        }
        return totalDistance;
    }

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

    updateMapWithImportedData(trackData) {
        if (!window.skyTracker || !window.skyTracker.mapManager) return;

        const mapManager = window.skyTracker.mapManager;
        
        // 既存のトラックをクリア
        mapManager.clearTrack();
        
        // 新しいトラックを描画
        trackData.forEach(point => {
            mapManager.addTrackPoint(point);
        });
        
        // 最後の位置を現在位置として設定
        const lastPoint = trackData[trackData.length - 1];
        mapManager.updateCurrentPosition(lastPoint);
        
        // 地図をトラック全体に合わせる
        mapManager.fitTrackBounds();
    }

    updateUIWithImportedData(trackData) {
        if (!trackData || trackData.length === 0) return;

        const lastPoint = trackData[trackData.length - 1];
        const firstPoint = trackData[0];
        const flightTime = new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp);
        
        // フライト情報を更新
        if (window.skyTracker) {
            const elements = window.skyTracker.elements;
            
            if (elements.altitude) {
                elements.altitude.textContent = `${lastPoint.altitude.toFixed(0)} m`;
            }
            
            if (elements.flightTime) {
                elements.flightTime.textContent = this.formatDuration(flightTime);
            }
            
            if (elements.distance) {
                const distance = window.skyTracker.totalDistance / 1000;
                elements.distance.textContent = `${distance.toFixed(2)} km`;
            }
        }
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    setupDragAndDrop() {
        const mapContainer = document.querySelector('.map-container');
        if (!mapContainer) return;

        // ドラッグオーバー時のスタイル
        const dragOverlay = document.createElement('div');
        dragOverlay.className = 'drag-overlay';
        dragOverlay.innerHTML = `
            <div class="drag-content">
                <i class="fas fa-upload fa-3x"></i>
                <h3>ファイルをドロップしてインポート</h3>
                <p>IGC, GPX, KMLファイルに対応</p>
            </div>
        `;
        dragOverlay.style.display = 'none';
        mapContainer.appendChild(dragOverlay);

        // ドラッグイベント
        mapContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragOverlay.style.display = 'flex';
        });

        mapContainer.addEventListener('dragleave', (e) => {
            if (!mapContainer.contains(e.relatedTarget)) {
                dragOverlay.style.display = 'none';
            }
        });

        mapContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            dragOverlay.style.display = 'none';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFile(files[0]);
            }
        });

        // ドラッグオーバーレイのスタイル
        this.addDragDropStyles();
    }

    addDragDropStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .drag-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(37, 99, 235, 0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                pointer-events: none;
            }

            .drag-content {
                text-align: center;
                padding: 2rem;
            }

            .drag-content i {
                margin-bottom: 1rem;
                opacity: 0.8;
            }

            .drag-content h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.5rem;
                font-weight: 600;
            }

            .drag-content p {
                margin: 0;
                opacity: 0.8;
                font-size: 1rem;
            }
        `;
        document.head.appendChild(style);
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
window.DataImporter = DataImporter;