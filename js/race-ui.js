// パイロンレース UI：HUD・円筒・最適化ルート・風・サーマルオーバーレイ
class RaceUI {
    constructor(app) {
        this.app = app;
        this.mapManager = app.mapManager;
        this.taskEngine = new TaskEngine();
        this.weather = new WeatherService();
        this.thermals = new ThermalPredictor();
        this.wind = new WindEstimator();
        this.computer = new RaceComputer(this.taskEngine, this.wind);
        this.overlays = {
            wind: true,
            thermals: true,
            streets: true,
            route: true,
            follow: false
        };
        this.layers = {};
        this.snapshot = null;
        this.prediction = null;
        this.instruments = null;
        this.refreshTimer = null;
        this.lastWeatherCenter = null;

        this.injectUI();
        this.bindUI();
        this.createLayers();
        this.taskEngine.on((type, detail) => this.onTaskEvent(type, detail));
    }

    injectUI() {
        if (!document.getElementById('raceHud')) {
            const hud = document.createElement('div');
            hud.id = 'raceHud';
            hud.className = 'race-hud hidden';
            hud.innerHTML = `
                <div class="race-hud-row race-hud-primary">
                    <div class="race-hud-tp">
                        <span class="race-hud-label" id="raceHudPhase">待機</span>
                        <strong id="raceHudNext">タスク未読込</strong>
                    </div>
                    <div class="race-hud-metric">
                        <span class="race-hud-label">次パイロン</span>
                        <strong id="raceHudDist">-- km</strong>
                    </div>
                    <div class="race-hud-metric">
                        <span class="race-hud-label">方位</span>
                        <strong id="raceHudBrg">---°</strong>
                    </div>
                </div>
                <div class="race-hud-row">
                    <div class="race-hud-metric">
                        <span class="race-hud-label">残距離</span>
                        <strong id="raceHudRemain">-- km</strong>
                    </div>
                    <div class="race-hud-metric">
                        <span class="race-hud-label">到着余高</span>
                        <strong id="raceHudMargin">-- m</strong>
                    </div>
                    <div class="race-hud-metric">
                        <span class="race-hud-label">STF / MC</span>
                        <strong id="raceHudStf">-- km/h</strong>
                    </div>
                    <div class="race-hud-metric">
                        <span class="race-hud-label">風</span>
                        <strong id="raceHudWind">--</strong>
                    </div>
                </div>
            `;
            document.querySelector('.map-container').appendChild(hud);
        }

        if (!document.getElementById('racePanel')) {
            const panel = document.createElement('div');
            panel.id = 'racePanel';
            panel.className = 'race-panel';
            panel.innerHTML = `
                <div class="panel-header">
                    <h3>パイロンレース</h3>
                    <button class="close-btn" id="closeRacePanel" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="race-panel-content">
                    <div class="setting-group">
                        <label>サンプルタスク</label>
                        <select id="sampleTaskSelect">
                            <option value="tokyoDemo">東京デモ パイロンレース</option>
                            <option value="shortTriangle">ショートトライアングル</option>
                            <option value="asagiriClassic">朝霧高原クラシック</option>
                        </select>
                        <div class="race-panel-actions">
                            <button class="btn btn-primary" id="loadSampleTaskBtn" type="button">読込</button>
                            <button class="btn btn-secondary" id="importTaskBtn" type="button">CUP / XCTSK</button>
                            <input type="file" id="taskFileInput" accept=".cup,.xctsk,.json,application/json" hidden>
                        </div>
                    </div>
                    <div class="setting-group">
                        <label>レース制御</label>
                        <div class="race-panel-actions">
                            <button class="btn btn-primary" id="armRaceBtn" type="button">スタート待機</button>
                            <button class="btn btn-secondary" id="resetRaceBtn" type="button">リセット</button>
                        </div>
                    </div>
                    <div class="setting-group">
                        <label>マッククリーディ <span id="mcValueLabel">1.2</span> m/s</label>
                        <input type="range" id="mcSlider" min="0" max="4" step="0.1" value="1.2">
                    </div>
                    <div class="setting-group">
                        <label>気象モデル</label>
                        <select id="weatherModelSelect">
                            <option value="best_match">自動（地域最適）</option>
                            <option value="jma_msm">JMA MSM（日本・高解像度）</option>
                            <option value="gfs_global">GFS</option>
                            <option value="ecmwf_ifs">ECMWF IFS</option>
                            <option value="icon_global">ICON</option>
                        </select>
                        <button class="btn btn-secondary" id="refreshWeatherBtn" type="button" style="margin-top:0.5rem;width:100%">
                            <i class="fas fa-cloud-sun"></i> 気象・サーマルを更新
                        </button>
                    </div>
                    <div class="setting-group race-toggles">
                        <label><input type="checkbox" id="toggleWindOverlay" checked> 風ベクトル</label>
                        <label><input type="checkbox" id="toggleThermalOverlay" checked> サーマル予測</label>
                        <label><input type="checkbox" id="toggleStreetOverlay" checked> クラウドストリート</label>
                        <label><input type="checkbox" id="toggleRouteOverlay" checked> 最適化ルート</label>
                        <label><input type="checkbox" id="toggleFollowRace"> 位置追従</label>
                    </div>
                    <div id="raceWeatherCard" class="race-weather-card">
                        <h4>気象・対流</h4>
                        <div id="raceWeatherBody">地図中心の気象を取得してください。</div>
                    </div>
                    <div id="raceTaskList" class="race-task-list"></div>
                    <div id="raceAloft" class="race-aloft"></div>
                </div>
            `;
            document.body.appendChild(panel);
        }
    }

    bindUI() {
        document.getElementById('closeRacePanel')?.addEventListener('click', () => {
            this.app.closePanel('race');
        });
        document.getElementById('loadSampleTaskBtn')?.addEventListener('click', () => {
            const key = document.getElementById('sampleTaskSelect').value;
            this.loadSample(key);
        });
        document.getElementById('importTaskBtn')?.addEventListener('click', () => {
            document.getElementById('taskFileInput').click();
        });
        document.getElementById('taskFileInput')?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.importTaskFile(file);
            e.target.value = '';
        });
        document.getElementById('armRaceBtn')?.addEventListener('click', () => this.armRace());
        document.getElementById('resetRaceBtn')?.addEventListener('click', () => this.resetRace());
        document.getElementById('mcSlider')?.addEventListener('input', (e) => {
            const v = Number(e.target.value);
            this.computer.setMacCready(v);
            document.getElementById('mcValueLabel').textContent = v.toFixed(1);
            this.refreshInstruments();
        });
        document.getElementById('weatherModelSelect')?.addEventListener('change', (e) => {
            this.weather.setModel(e.target.value);
            this.refreshWeather(true);
        });
        document.getElementById('refreshWeatherBtn')?.addEventListener('click', () => this.refreshWeather(true));
        document.getElementById('toggleWindOverlay')?.addEventListener('change', (e) => {
            this.overlays.wind = e.target.checked;
            this.renderOverlays();
        });
        document.getElementById('toggleThermalOverlay')?.addEventListener('change', (e) => {
            this.overlays.thermals = e.target.checked;
            this.renderOverlays();
        });
        document.getElementById('toggleStreetOverlay')?.addEventListener('change', (e) => {
            this.overlays.streets = e.target.checked;
            this.renderOverlays();
        });
        document.getElementById('toggleRouteOverlay')?.addEventListener('change', (e) => {
            this.overlays.route = e.target.checked;
            this.renderOverlays();
        });
        document.getElementById('toggleFollowRace')?.addEventListener('change', (e) => {
            this.overlays.follow = e.target.checked;
            if (this.mapManager) this.mapManager.followPosition = e.target.checked;
        });

        this.mapManager.map.on('moveend', () => {
            this.scheduleWeatherRefresh();
        });
    }

    createLayers() {
        const map = this.mapManager.map;
        this.layers.task = L.layerGroup().addTo(map);
        this.layers.route = L.layerGroup().addTo(map);
        this.layers.thermals = L.layerGroup().addTo(map);
        this.layers.streets = L.layerGroup().addTo(map);
        this.layers.wind = L.layerGroup().addTo(map);
        this.layers.live = L.layerGroup().addTo(map);
        this.layers.nav = L.layerGroup().addTo(map);
    }

    loadSample(key) {
        const task = SampleTasks[key];
        if (!task) {
            this.app.showNotification('サンプルタスクが見つかりません。', 'error');
            return;
        }
        this.applyTask(task);
    }

    async importTaskFile(file) {
        try {
            const text = await file.text();
            const parsed = TaskEngine.parseAuto(text, file.name);
            this.applyTask(parsed);
            this.app.showNotification(`${parsed.name} を読み込みました。`, 'success');
        } catch (error) {
            console.error(error);
            this.app.showNotification(error.message || 'タスクの読み込みに失敗しました。', 'error');
        }
    }

    applyTask(task) {
        this.taskEngine.loadTask(task);
        this.taskEngine.armStart();
        this.renderTask();
        this.updateTaskList();
        this.showHud(true);
        this.refreshInstruments();
        this.fitTask();
        this.refreshWeather(true);
        this.app.showNotification(`${this.taskEngine.task.name} をセットしました。スタート円筒を出てレース開始。`, 'success');
    }

    armRace() {
        if (!this.taskEngine.task) {
            this.loadSample(document.getElementById('sampleTaskSelect').value);
            return;
        }
        this.taskEngine.armStart();
        this.app.showNotification('スタート待機にしました。SSS 円筒を EXIT するとレース開始です。', 'info');
        this.refreshInstruments();
    }

    resetRace() {
        this.taskEngine.resetRace();
        this.taskEngine.armStart();
        this.renderTask();
        this.refreshInstruments();
        this.app.showNotification('レースをリセットしました。', 'info');
    }

    fitTask() {
        const tps = this.taskEngine.getTurnpoints();
        if (tps.length === 0) return;
        const bounds = L.latLngBounds(tps.map((tp) => [tp.lat, tp.lon]));
        this.mapManager.map.fitBounds(bounds.pad(0.25));
    }

    showHud(show) {
        document.getElementById('raceHud')?.classList.toggle('hidden', !show);
    }

    onTaskEvent(type) {
        if (type === 'started') {
            this.app.showNotification('レーススタート！', 'success');
        } else if (type === 'tagged') {
            this.app.showNotification('パイロン取得', 'success');
        } else if (type === 'finished') {
            this.app.showNotification('ゴールイン！', 'success');
        }
        this.renderTask();
        this.updateTaskList();
    }

    onPosition(trackPoint, trackData) {
        if (!this.taskEngine.task) return;
        this.taskEngine.updatePosition(trackPoint);
        this.wind.updateFromTrack(trackData || this.app.trackData);
        this.instruments = this.computer.compute(trackPoint);
        this.updateHud(this.instruments);
        this.renderNav(this.instruments);
        this.renderLiveThermals(trackData || this.app.trackData);
        if (this.overlays.follow && this.mapManager.followPosition) {
            this.mapManager.map.panTo([trackPoint.latitude, trackPoint.longitude]);
        }
    }

    refreshInstruments() {
        const pos = this.app.lastPosition;
        if (pos) {
            this.instruments = this.computer.compute(pos);
            this.updateHud(this.instruments);
            this.renderNav(this.instruments);
        } else if (this.taskEngine.task) {
            this.showHud(true);
            document.getElementById('raceHudNext').textContent = this.taskEngine.task.name;
        }
    }

    updateHud(inst) {
        this.showHud(true);
        if (!inst || !inst.progress) return;
        const p = inst.progress;
        const phaseMap = {
            IDLE: '待機',
            ARMED: 'スタート待機',
            PRESTART: 'スタート前',
            RACING: 'レース中',
            ESS: 'ESS通過',
            FINISHED: 'ゴール'
        };
        document.getElementById('raceHudPhase').textContent = phaseMap[p.phase] || p.phase;
        document.getElementById('raceHudNext').textContent = p.nextTurnpoint
            ? `${p.nextTurnpoint.name} (${p.nextTurnpoint.type})`
            : this.taskEngine.task.name;
        document.getElementById('raceHudDist').textContent = p.distanceToCylinderM != null
            ? `${(p.distanceToCylinderM / 1000).toFixed(2)} km`
            : '-- km';
        document.getElementById('raceHudBrg').textContent = p.bearing != null
            ? `${p.bearing.toFixed(0)}° ${Geo.cardinal(p.bearing)}`
            : '---°';
        document.getElementById('raceHudRemain').textContent = `${p.remainingKm.toFixed(2)} km`;

        const marginEl = document.getElementById('raceHudMargin');
        if (inst.ready) {
            const m = inst.altitudeMargin;
            marginEl.textContent = `${m >= 0 ? '+' : ''}${m.toFixed(0)} m`;
            marginEl.classList.toggle('positive', m >= 80);
            marginEl.classList.toggle('warning', m < 80 && m >= 0);
            marginEl.classList.toggle('danger', m < 0);
            document.getElementById('raceHudStf').textContent =
                `${inst.speedToFlyKmh.toFixed(0)} / MC ${inst.mc.toFixed(1)}`;
        } else {
            marginEl.textContent = '-- m';
        }

        const w = inst.wind;
        document.getElementById('raceHudWind').textContent = w
            ? `${Geo.cardinal(w.from)} ${WeatherService.msToKmh(w.speed).toFixed(0)} km/h`
            : '--';
    }

    updateTaskList() {
        const el = document.getElementById('raceTaskList');
        if (!el || !this.taskEngine.task) {
            if (el) el.innerHTML = '';
            return;
        }
        const optKm = this.taskEngine.optimized
            ? this.taskEngine.optimized.totalDistanceKm.toFixed(2)
            : '--';
        el.innerHTML = `
            <h4>${this.taskEngine.task.name}</h4>
            <p class="race-opt-dist">最適化距離 ${optKm} km</p>
            <ol class="race-tp-ol">
                ${this.taskEngine.task.turnpoints.map((tp, i) => {
                    const tagged = this.taskEngine.state.tagged[i];
                    const next = this.taskEngine.state.nextIndex === i;
                    return `<li class="${tagged ? 'tagged' : ''} ${next ? 'next' : ''}">
                        <span>${tp.name}</span>
                        <small>${tp.type} · R${tp.radius}m</small>
                    </li>`;
                }).join('')}
            </ol>
        `;
    }

    renderTask() {
        this.layers.task.clearLayers();
        this.layers.route.clearLayers();
        if (!this.taskEngine.task) return;

        this.taskEngine.task.turnpoints.forEach((tp, i) => {
            const tagged = !!this.taskEngine.state.tagged[i];
            const next = this.taskEngine.state.nextIndex === i && this.taskEngine.state.phase !== 'FINISHED';
            const color = this.tpColor(tp.type, tagged, next);
            L.circle([tp.lat, tp.lon], {
                radius: tp.radius,
                color,
                weight: next ? 3 : 2,
                fillColor: color,
                fillOpacity: tagged ? 0.08 : 0.16,
                dashArray: tp.type === 'SSS' ? '8 6' : null
            }).bindPopup(`<strong>${tp.name}</strong><br>${tp.type}<br>半径 ${tp.radius}m / ${tp.altitude}m`).addTo(this.layers.task);

            L.marker([tp.lat, tp.lon], {
                icon: L.divIcon({
                    className: 'race-tp-label',
                    html: `<div class="race-tp-chip ${tp.type.toLowerCase()}">${i + 1}. ${tp.name}</div>`,
                    iconSize: [120, 24],
                    iconAnchor: [60, 12]
                })
            }).addTo(this.layers.task);
        });

        if (this.overlays.route && this.taskEngine.optimized) {
            const latlngs = this.taskEngine.optimized.points.map((p) => [p.lat, p.lon]);
            L.polyline(latlngs, {
                color: '#e11d48',
                weight: 3,
                opacity: 0.9,
                dashArray: '10 6'
            }).addTo(this.layers.route);
            this.taskEngine.optimized.points.forEach((p) => {
                L.circleMarker([p.lat, p.lon], {
                    radius: 5,
                    color: '#e11d48',
                    fillColor: '#fff',
                    fillOpacity: 1,
                    weight: 2
                }).addTo(this.layers.route);
            });
        }
    }

    tpColor(type, tagged, next) {
        if (tagged) return '#10b981';
        if (next) return '#f59e0b';
        const map = {
            TAKEOFF: '#64748b',
            SSS: '#2563eb',
            TURNPOINT: '#7c3aed',
            ESS: '#ea580c',
            GOAL: '#dc2626'
        };
        return map[type] || '#2563eb';
    }

    renderNav(inst) {
        this.layers.nav.clearLayers();
        if (!inst || !inst.ready || !this.app.lastPosition) return;
        const here = [this.app.lastPosition.latitude, this.app.lastPosition.longitude];
        const to = [inst.nextOpt.lat, inst.nextOpt.lon];
        L.polyline([here, to], {
            color: '#38bdf8',
            weight: 2,
            opacity: 0.85
        }).addTo(this.layers.nav);
    }

    renderLiveThermals(trackData) {
        this.layers.live.clearLayers();
        const live = this.thermals.extractLiveThermals(trackData || []);
        const core = this.thermals.estimateCore(trackData || []);
        live.forEach((t) => {
            L.circle([t.lat, t.lon], {
                radius: 180,
                color: '#16a34a',
                fillColor: '#22c55e',
                fillOpacity: 0.25,
                weight: 2
            }).bindPopup(`実測サーマル ${t.climbMs.toFixed(1)} m/s`).addTo(this.layers.live);
        });
        if (core) {
            L.circleMarker([core.coreLat, core.coreLon], {
                radius: 8,
                color: '#15803d',
                fillColor: '#4ade80',
                fillOpacity: 1,
                weight: 2
            }).bindPopup(`サーマルコア ${core.climbMs.toFixed(1)} m/s`).addTo(this.layers.live);
            L.circle([core.lat, core.lon], {
                radius: 120,
                color: '#86efac',
                weight: 1,
                fillOpacity: 0.05
            }).addTo(this.layers.live);
        }
        if (this.app.groupManager && typeof this.app.groupManager.getMembers === 'function') {
            const members = this.app.groupManager.getMembers();
            (members || []).forEach((m) => {
                const pos = m.position || m;
                if ((pos.vario || 0) >= 1.2) {
                    L.circle([pos.latitude, pos.longitude], {
                        radius: 200,
                        color: '#0ea5e9',
                        fillOpacity: 0.2
                    }).bindPopup(`${m.name || 'メンバー'} 上昇 ${pos.vario.toFixed(1)} m/s`).addTo(this.layers.live);
                }
            });
        }
    }

    scheduleWeatherRefresh() {
        clearTimeout(this._wxMoveTimer);
        this._wxMoveTimer = setTimeout(() => this.refreshWeather(false), 1200);
    }

    async refreshWeather(force) {
        const center = this.mapManager.map.getCenter();
        if (!force && this.lastWeatherCenter) {
            const moved = Geo.distance(center.lat, center.lng, this.lastWeatherCenter.lat, this.lastWeatherCenter.lng);
            if (moved < 2500 && this.snapshot) {
                this.renderOverlays();
                return;
            }
        }
        const btn = document.getElementById('refreshWeatherBtn');
        if (btn) btn.disabled = true;
        try {
            const snapshot = await this.weather.fetchForecast(center.lat, center.lng);
            this.snapshot = snapshot;
            this.lastWeatherCenter = { lat: center.lat, lng: center.lng };
            this.wind.updateFromWeather(snapshot, this.app.lastPosition ? this.app.lastPosition.altitude : 80);

            const b = this.mapManager.map.getBounds();
            const grid = await this.weather.fetchElevationGrid({
                south: b.getSouth(),
                north: b.getNorth(),
                west: b.getWest(),
                east: b.getEast()
            }, 7, 7);

            const live = this.thermals.extractLiveThermals(this.app.trackData || []);
            this.prediction = this.thermals.predict(snapshot, grid, live);
            this.renderWeatherCard();
            this.renderOverlays();
            this.refreshInstruments();
        } catch (error) {
            console.warn('Weather refresh failed', error);
            this.app.showNotification('気象データの取得に失敗しました。オフラインかモデル制限の可能性があります。', 'warning');
            this.renderWeatherCard(error);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    renderWeatherCard(error) {
        const body = document.getElementById('raceWeatherBody');
        const aloftEl = document.getElementById('raceAloft');
        if (!body) return;
        if (error) {
            body.textContent = error.message || '気象を取得できませんでした。';
            return;
        }
        if (!this.snapshot) return;
        const c = this.snapshot.current;
        const a = this.snapshot.aloft;
        const meteo = this.prediction ? this.prediction.meteo : null;
        const fused = this.wind.getFused();
        body.innerHTML = `
            <div class="weather-item"><span>観測風 10m</span><span>${Geo.cardinal(c.wind.from)} ${WeatherService.msToKmh(c.wind.speed).toFixed(0)} km/h ガスト ${WeatherService.msToKmh(c.wind.gusts).toFixed(0)}</span></div>
            <div class="weather-item"><span>融合風</span><span>${Geo.cardinal(fused.from)} ${WeatherService.msToKmh(fused.speed).toFixed(0)} km/h (${fused.source})</span></div>
            <div class="weather-item"><span>気温 / 雲量</span><span>${c.temperature.toFixed(0)}°C / ${c.cloudCover.toFixed(0)}% ${this.weather.weatherCodeLabel(c.weatherCode)}</span></div>
            <div class="weather-item"><span>CAPE / LI</span><span>${a.cape.toFixed(0)} J/kg / ${a.liftedIndex == null ? '--' : a.liftedIndex.toFixed(1)}</span></div>
            <div class="weather-item"><span>混合層 / 日射</span><span>${a.blh.toFixed(0)} m / ${a.shortwave.toFixed(0)} W/m²</span></div>
            <div class="weather-item"><span>サーマル見込み</span><span>${meteo ? `${meteo.trigger} / ${meteo.climbMs.toFixed(1)} m/s / 天井 ${meteo.maxAlt.toFixed(0)} m` : '--'}</span></div>
        `;
        if (aloftEl) {
            aloftEl.innerHTML = `<h4>高度別の風</h4>` + a.levels.map((l) =>
                `<div class="weather-item"><span>${l.alt} m</span><span>${Geo.cardinal(l.from)} ${WeatherService.msToKmh(l.speed).toFixed(0)} km/h</span></div>`
            ).join('');
        }
    }

    renderOverlays() {
        this.renderWind();
        this.renderThermals();
        this.renderStreets();
        this.renderTask();
    }

    renderWind() {
        this.layers.wind.clearLayers();
        if (!this.overlays.wind) return;
        const wind = this.wind.getFused();
        if (!wind || wind.source === 'none') return;
        const bounds = this.mapManager.map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const rows = 4;
        const cols = 4;
        for (let r = 1; r < rows; r++) {
            for (let c = 1; c < cols; c++) {
                const lat = sw.lat + (ne.lat - sw.lat) * (r / rows);
                const lng = sw.lng + (ne.lng - sw.lng) * (c / cols);
                const icon = L.divIcon({
                    className: 'wind-vector',
                    html: `<div class="wind-vector-inner" style="transform:rotate(${wind.to}deg)">
                        <span class="wind-shaft"></span>
                    </div>
                    <small>${WeatherService.msToKmh(wind.speed).toFixed(0)}</small>`,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18]
                });
                L.marker([lat, lng], { icon, interactive: false }).addTo(this.layers.wind);
            }
        }
    }

    renderThermals() {
        this.layers.thermals.clearLayers();
        if (!this.overlays.thermals || !this.prediction) return;
        this.prediction.sources.forEach((s) => {
            const color = s.kind === 'live' ? '#16a34a' : this.thermalColor(s.climbMs);
            L.circle([s.lat, s.lon], {
                radius: 220 + s.climbMs * 80,
                color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.18 + Math.min(0.25, s.strength * 0.25)
            }).bindPopup(`
                <strong>${s.kind === 'live' ? '実測' : '予測'}サーマル</strong><br>
                上昇 ${s.climbMs.toFixed(1)} m/s<br>
                天井 約 ${s.maxAlt.toFixed(0)} m<br>
                ${s.kind}
            `).addTo(this.layers.thermals);

            if (s.driftLat && (s.driftLat !== s.lat || s.driftLon !== s.lon)) {
                L.polyline([[s.lat, s.lon], [s.driftLat, s.driftLon]], {
                    color,
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '4 4'
                }).addTo(this.layers.thermals);
            }

            L.marker([s.lat, s.lon], {
                icon: L.divIcon({
                    className: 'thermal-label',
                    html: `<div class="thermal-chip">${s.climbMs.toFixed(1)}</div>`,
                    iconSize: [36, 20],
                    iconAnchor: [18, 10]
                })
            }).addTo(this.layers.thermals);
        });
    }

    thermalColor(climb) {
        if (climb >= 3.2) return '#dc2626';
        if (climb >= 2.2) return '#ea580c';
        if (climb >= 1.4) return '#ca8a04';
        return '#2563eb';
    }

    renderStreets() {
        this.layers.streets.clearLayers();
        if (!this.overlays.streets || !this.prediction) return;
        this.prediction.streets.forEach((street) => {
            const latlngs = street.points.map((p) => [p.lat, p.lon]);
            if (latlngs.length >= 2) {
                L.polyline(latlngs, {
                    color: '#94a3b8',
                    weight: 6,
                    opacity: 0.35
                }).bindPopup(`クラウドストリート 平均 ${street.climbMs.toFixed(1)} m/s`).addTo(this.layers.streets);
            }
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshTimer = setInterval(() => this.refreshWeather(true), 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.RaceUI = RaceUI;
}
