// Open-Meteo 気象サービス（APIキー不要、CORS対応）
// 観測相当の current + 予報モデル（best_match / JMA MSM / GFS / ECMWF ICON）
class WeatherService {
    constructor(options = {}) {
        this.forecastBase = options.forecastBase || 'https://api.open-meteo.com/v1/forecast';
        this.elevationBase = options.elevationBase || 'https://api.open-meteo.com/v1/elevation';
        this.cacheTtlMs = options.cacheTtlMs || 5 * 60 * 1000;
        this.cache = new Map();
        this.lastForecast = null;
        this.lastGrid = null;
        this.model = options.model || 'best_match';
        this.fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        this.lastError = null;
        this.lastOkAt = null;
    }

    setModel(model) {
        this.model = model || 'best_match';
        this.cache.clear();
    }

    cacheKey(kind, payload) {
        return `${kind}:${this.model}:${JSON.stringify(payload)}`;
    }

    async getCached(key, loader) {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < this.cacheTtlMs) {
            return hit.value;
        }
        const value = await loader();
        this.cache.set(key, { at: Date.now(), value });
        return value;
    }

    async fetchJson(url) {
        if (!this.fetchImpl) {
            throw new Error('fetch が利用できません');
        }
        const res = await this.fetchImpl(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) {
            throw new Error(`気象APIエラー: ${res.status}`);
        }
        return res.json();
    }

    buildForecastUrl(lat, lon) {
        const params = new URLSearchParams({
            latitude: String(lat),
            longitude: String(lon),
            current: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'precipitation',
                'weather_code',
                'cloud_cover',
                'pressure_msl',
                'wind_speed_10m',
                'wind_direction_10m',
                'wind_gusts_10m'
            ].join(','),
            hourly: [
                'temperature_2m',
                'temperature_80m',
                'temperature_120m',
                'relative_humidity_2m',
                'dew_point_2m',
                'cloud_cover',
                'cloud_cover_low',
                'cloud_cover_mid',
                'cloud_cover_high',
                'visibility',
                'wind_speed_10m',
                'wind_speed_80m',
                'wind_speed_120m',
                'wind_speed_180m',
                'wind_direction_10m',
                'wind_direction_80m',
                'wind_direction_120m',
                'wind_direction_180m',
                'wind_gusts_10m',
                'wind_speed_925hPa',
                'wind_speed_850hPa',
                'wind_speed_800hPa',
                'wind_speed_700hPa',
                'wind_speed_600hPa',
                'wind_speed_500hPa',
                'wind_direction_925hPa',
                'wind_direction_850hPa',
                'wind_direction_800hPa',
                'wind_direction_700hPa',
                'wind_direction_600hPa',
                'wind_direction_500hPa',
                'cape',
                'lifted_index',
                'convective_inhibition',
                'boundary_layer_height',
                'shortwave_radiation',
                'direct_radiation',
                'diffuse_radiation',
                'precipitation',
                'weather_code'
            ].join(','),
            wind_speed_unit: 'ms',
            timezone: 'auto',
            forecast_days: '2',
            timeformat: 'unixtime'
        });
        if (this.model && this.model !== 'best_match') {
            params.set('models', this.model);
        }
        return `${this.forecastBase}?${params.toString()}`;
    }

    async fetchForecast(lat, lon) {
        try {
            const key = this.cacheKey('forecast', { lat: lat.toFixed(3), lon: lon.toFixed(3) });
            const data = await this.getCached(key, () => this.fetchJson(this.buildForecastUrl(lat, lon)));
            const snapshot = this.interpret(data, lat, lon);
            this.lastForecast = snapshot;
            this.lastError = null;
            this.lastOkAt = Date.now();
            return snapshot;
        } catch (error) {
            this.lastError = error;
            throw error;
        }
    }

    interpret(data, lat, lon) {
        const now = new Date();
        const current = data.current || {};
        const hourly = data.hourly || {};
        const idx = this.nearestHourIndex(hourly.time, now);
        const hour = this.hourlyAt(hourly, idx);

        const wind10 = {
            speed: Number(current.wind_speed_10m ?? hour.wind_speed_10m ?? 0),
            from: Number(current.wind_direction_10m ?? hour.wind_direction_10m ?? 0),
            gusts: Number(current.wind_gusts_10m ?? hour.wind_gusts_10m ?? 0)
        };

        const hourTime = hourly.time && hourly.time[idx] != null
            ? this.parseApiTime(hourly.time[idx])
            : now.getTime();

        return {
            lat,
            lon,
            fetchedAt: now.toISOString(),
            hourTime,
            timezone: data.timezone || 'auto',
            model: this.model,
            current: {
                temperature: Number(current.temperature_2m ?? hour.temperature_2m ?? 0),
                humidity: Number(current.relative_humidity_2m ?? hour.relative_humidity_2m ?? 0),
                apparentTemperature: Number(current.apparent_temperature ?? 0),
                precipitation: Number(current.precipitation ?? hour.precipitation ?? 0),
                weatherCode: Number(current.weather_code ?? hour.weather_code ?? 0),
                cloudCover: Number(current.cloud_cover ?? hour.cloud_cover ?? 0),
                pressure: Number(current.pressure_msl ?? 1013),
                wind: wind10
            },
            hour,
            aloft: this.buildAloft(hour, wind10),
            hourly,
            hourlyIndex: idx,
            raw: data
        };
    }

    nearestHourIndex(times, now) {
        if (!times || times.length === 0) return 0;
        const t = now.getTime();
        let best = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < times.length; i++) {
            const ts = this.parseApiTime(times[i]);
            const diff = Math.abs(ts - t);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = i;
            }
        }
        return best;
    }

    parseApiTime(value) {
        if (typeof value === 'number') {
            return value > 1e12 ? value : value * 1000;
        }
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : Date.now();
    }

    hourlyAt(hourly, index) {
        const out = { index };
        if (!hourly) return out;
        for (const [key, values] of Object.entries(hourly)) {
            if (Array.isArray(values)) {
                out[key] = values[index];
            }
        }
        return out;
    }

    buildAloft(hour, wind10) {
        const surface = [
            { alt: 10, speed: hour.wind_speed_10m ?? wind10.speed, from: hour.wind_direction_10m ?? wind10.from, label: '接地 10m', band: 'surface' },
            { alt: 80, speed: hour.wind_speed_80m, from: hour.wind_direction_80m, label: '接地層 80m', band: 'surface' }
        ];
        const pressure = WeatherService.PRESSURE_WIND_LEVELS.map((lvl) => ({
            alt: Math.round(WeatherService.isaAltitudeFromHpa(lvl.hPa)),
            speed: hour[lvl.speedKey],
            from: hour[lvl.dirKey],
            label: `${lvl.hPa} hPa`,
            band: 'flight',
            hPa: lvl.hPa
        }));
        const levels = [...surface, ...pressure]
            .filter((l) => l.speed != null && Number.isFinite(Number(l.speed)) && l.from != null && Number.isFinite(Number(l.from)))
            .map((l) => ({ ...l, speed: Number(l.speed), from: Number(l.from) }))
            .sort((a, b) => a.alt - b.alt);

        const temperature2m = Number(hour.temperature_2m ?? 0);
        const dewPoint = hour.dew_point_2m != null ? Number(hour.dew_point_2m) : null;
        const lclM = dewPoint != null ? WeatherService.lclMeters(temperature2m, dewPoint) : null;

        return {
            levels,
            cape: Number(hour.cape ?? 0),
            liftedIndex: hour.lifted_index != null ? Number(hour.lifted_index) : null,
            cin: hour.convective_inhibition != null ? Number(hour.convective_inhibition) : 0,
            blh: Number(hour.boundary_layer_height ?? 800),
            shortwave: Number(hour.shortwave_radiation ?? 0),
            directRadiation: Number(hour.direct_radiation ?? 0),
            dewPoint,
            temperature2m,
            temperature80m: hour.temperature_80m != null ? Number(hour.temperature_80m) : null,
            temperature120m: hour.temperature_120m != null ? Number(hour.temperature_120m) : null,
            cloudLow: Number(hour.cloud_cover_low ?? hour.cloud_cover ?? 0),
            cloudMid: Number(hour.cloud_cover_mid ?? 0),
            precipitation: Number(hour.precipitation ?? 0),
            lclM,
            cloudbaseM: lclM,
            hasPressureWinds: levels.some((l) => l.band === 'flight' && l.hPa)
        };
    }

    getStatus() {
        if (this.lastError) {
            return {
                ok: false,
                message: '気象未取得',
                detail: this.lastError.message || String(this.lastError)
            };
        }
        const snap = this.lastForecast;
        if (!snap) {
            return { ok: false, message: '気象未取得', detail: 'まだ取得していません' };
        }
        const tz = snap.timezone && snap.timezone !== 'auto' ? snap.timezone : 'Asia/Tokyo';
        const hour = snap.hourTime
            ? new Date(snap.hourTime).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: tz
            })
            : '--:--';
        const model = snap.model === 'best_match' ? 'Open-Meteo' : snap.model;
        const pressure = snap.aloft && snap.aloft.hasPressureWinds;
        return {
            ok: true,
            message: pressure ? `${model} ${hour}` : `${model} ${hour}（気圧面なし・接地風）`,
            snapshot: snap,
            hasPressureWinds: !!pressure
        };
    }

    static isaAltitudeFromHpa(hPa) {
        const p = Number(hPa);
        if (!Number.isFinite(p) || p <= 0) return 0;
        return 44330.77 * (1 - Math.pow(p / 1013.25, 0.190284));
    }

    static lclMeters(tempC, dewPointC) {
        return Math.max(0, 125 * (Number(tempC) - Number(dewPointC)));
    }

    /**
     * PG/HG の作業高度。接地層ではなく混合層中〜雲底付近を使う。
     */
    static flightWindAltitude(snapshot, gpsAlt) {
        if (Number.isFinite(gpsAlt) && gpsAlt >= 400) {
            return gpsAlt;
        }
        const aloft = snapshot && snapshot.aloft;
        const blh = aloft && Number(aloft.blh);
        const lcl = aloft && Number(aloft.lclM);
        const candidates = [];
        if (Number.isFinite(blh) && blh > 700) {
            candidates.push(blh * 0.65);
        }
        if (Number.isFinite(lcl) && lcl > 600) {
            candidates.push(lcl * 0.75);
        }
        if (candidates.length) {
            const mean = candidates.reduce((s, v) => s + v, 0) / candidates.length;
            return Math.max(800, Math.min(3500, mean));
        }
        return WeatherService.DEFAULT_FLIGHT_ALT;
    }

    windAtAltitude(snapshot, altitudeM) {
        const levels = (snapshot && snapshot.aloft && snapshot.aloft.levels) || [];
        if (levels.length === 0) {
            return { speed: 0, from: 0, alt: altitudeM };
        }
        if (altitudeM <= levels[0].alt) return { ...levels[0] };
        if (altitudeM >= levels[levels.length - 1].alt) return { ...levels[levels.length - 1] };

        for (let i = 1; i < levels.length; i++) {
            const lo = levels[i - 1];
            const hi = levels[i];
            if (altitudeM <= hi.alt) {
                const t = (altitudeM - lo.alt) / (hi.alt - lo.alt);
                const from = Geo.normalizeBearing(lo.from + Geo.wrapDelta(hi.from - lo.from) * t);
                return {
                    alt: altitudeM,
                    speed: lo.speed + (hi.speed - lo.speed) * t,
                    from
                };
            }
        }
        return { ...levels[levels.length - 1] };
    }

    /**
     * 地図範囲の標高グリッド。サーマル発生源（尾根・南斜面）推定に使う。
     */
    async fetchElevationGrid(bounds, rows = 8, cols = 8) {
        const south = bounds.south;
        const north = bounds.north;
        const west = bounds.west;
        const east = bounds.east;
        const lats = [];
        const lons = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                lats.push(south + (north - south) * (r / Math.max(rows - 1, 1)));
                lons.push(west + (east - west) * (c / Math.max(cols - 1, 1)));
            }
        }
        const key = this.cacheKey('elev', {
            s: south.toFixed(3), n: north.toFixed(3), w: west.toFixed(3), e: east.toFixed(3), rows, cols
        });
        const data = await this.getCached(key, () => {
            const params = new URLSearchParams({
                latitude: lats.join(','),
                longitude: lons.join(',')
            });
            return this.fetchJson(`${this.elevationBase}?${params.toString()}`);
        });

        const elevations = data.elevation || [];
        const cells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                cells.push({
                    lat: lats[i],
                    lon: lons[i],
                    elevation: elevations[i] || 0,
                    row: r,
                    col: c
                });
            }
        }
        this.lastGrid = { bounds, rows, cols, cells };
        return this.lastGrid;
    }

    weatherCodeLabel(code) {
        const map = {
            0: '快晴', 1: 'ほぼ快晴', 2: '一部曇', 3: '曇',
            45: '霧', 48: '着氷霧',
            51: '弱い霧雨', 53: '霧雨', 55: '強い霧雨',
            61: '弱い雨', 63: '雨', 65: '強い雨',
            71: '弱い雪', 73: '雪', 75: '強い雪',
            80: 'にわか雨', 81: '強いにわか雨', 82: '激しいにわか雨',
            95: '雷雨', 96: '雹を伴う雷雨', 99: '強い雹雷雨'
        };
        return map[code] || `天気コード ${code}`;
    }

    static msToKmh(ms) {
        return (ms || 0) * 3.6;
    }

    static msToKt(ms) {
        return (ms || 0) * 1.94384;
    }
}

WeatherService.DEFAULT_FLIGHT_ALT = 1500;
WeatherService.PRESSURE_WIND_LEVELS = [
    { hPa: 925, speedKey: 'wind_speed_925hPa', dirKey: 'wind_direction_925hPa' },
    { hPa: 850, speedKey: 'wind_speed_850hPa', dirKey: 'wind_direction_850hPa' },
    { hPa: 800, speedKey: 'wind_speed_800hPa', dirKey: 'wind_direction_800hPa' },
    { hPa: 700, speedKey: 'wind_speed_700hPa', dirKey: 'wind_direction_700hPa' },
    { hPa: 600, speedKey: 'wind_speed_600hPa', dirKey: 'wind_direction_600hPa' },
    { hPa: 500, speedKey: 'wind_speed_500hPa', dirKey: 'wind_direction_500hPa' }
];

if (typeof window !== 'undefined') {
    window.WeatherService = WeatherService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WeatherService };
}
