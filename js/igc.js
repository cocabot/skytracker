// IGCファイルエクスポートクラス
class IGCExporter {
    constructor() {
        this.manufacturer = 'SKY'; // 3文字のメーカーコード
        this.deviceId = 'TRK'; // デバイスID
        this.deviceType = '001'; // デバイスタイプ
    }

    generateIGC(trackData, settings = {}) {
        if (!trackData || trackData.length === 0) {
            throw new Error('トラックデータが空です');
        }

        const lines = [];
        
        // ヘッダー情報
        lines.push(...this.generateHeader(trackData, settings));
        
        // フライトレコード
        lines.push(...this.generateFlightRecords(trackData));
        
        // セキュリティレコード（オプション）
        lines.push(...this.generateSecurityRecords());

        return lines.join('\n');
    }

    generateHeader(trackData, settings) {
        const lines = [];
        const startTime = new Date(trackData[0].timestamp);
        const pilot = settings.username || 'Unknown Pilot';
        
        // A レコード: メーカーとデバイス情報
        lines.push(`A${this.manufacturer}${this.deviceId}${this.deviceType}`);
        
        // H レコード: ヘッダー情報
        lines.push(`HFDTE${this.formatDate(startTime)}`); // 日付
        lines.push(`HFPLT${pilot}`); // パイロット名
        lines.push(`HFGTY:GLIDER TYPE:SkyTracker`); // グライダータイプ
        lines.push(`HFGID:GLIDER ID:SKY001`); // グライダーID
        lines.push(`HFDTM100:DATUM:WGS-1984`); // 測地系
        lines.push(`HFRFWFIRMWAREVERSION:1.0`); // ファームウェアバージョン
        lines.push(`HFRHWHARDWAREVERSION:1.0`); // ハードウェアバージョン
        lines.push(`HFFTYFRTYPE:SkyTracker,${navigator.userAgent}`); // フライトレコーダータイプ
        lines.push(`HFGPS:GPS`); // GPS情報
        lines.push(`HFPRS:PRESS ALT SENSOR:NONE`); // 気圧高度センサー
        lines.push(`HFCID:COMPETITION ID:`); // 競技ID
        lines.push(`HFCCL:COMPETITION CLASS:`); // 競技クラス
        
        // I レコード: 拡張データの定義
        lines.push('I013638FXA3941SIU'); // 拡張データフォーマット
        
        return lines;
    }

    generateFlightRecords(trackData) {
        const lines = [];
        
        trackData.forEach(point => {
            const time = this.formatTime(new Date(point.timestamp));
            const lat = this.formatLatitude(point.latitude);
            const lon = this.formatLongitude(point.longitude);
            const validity = 'A'; // GPS有効性 (A=有効, V=無効)
            const pressureAlt = this.formatAltitude(point.altitude); // 気圧高度
            const gpsAlt = this.formatAltitude(point.altitude); // GPS高度
            
            // 拡張データ
            const fixAccuracy = this.formatFixAccuracy(point.accuracy);
            const satellites = '00'; // 衛星数（不明）
            
            // B レコード: 基本フライトレコード
            const bRecord = `B${time}${lat}${lon}${validity}${pressureAlt}${gpsAlt}${fixAccuracy}${satellites}`;
            lines.push(bRecord);
        });
        
        return lines;
    }

    generateSecurityRecords() {
        const lines = [];
        
        // G レコード: セキュリティレコード（オプション）
        // 簡単なチェックサムを生成
        const checksum = this.generateChecksum();
        lines.push(`G${checksum}`);
        
        return lines;
    }

    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        return `${day}${month}${year}`;
    }

    formatTime(date) {
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');
        return `${hours}${minutes}${seconds}`;
    }

    formatLatitude(lat) {
        const absLat = Math.abs(lat);
        const degrees = Math.floor(absLat);
        const minutes = (absLat - degrees) * 60;
        const minutesInt = Math.floor(minutes);
        const minutesFrac = Math.round((minutes - minutesInt) * 1000);
        
        const degStr = degrees.toString().padStart(2, '0');
        const minStr = minutesInt.toString().padStart(2, '0');
        const fracStr = minutesFrac.toString().padStart(3, '0');
        const hemisphere = lat >= 0 ? 'N' : 'S';
        
        return `${degStr}${minStr}${fracStr}${hemisphere}`;
    }

    formatLongitude(lon) {
        const absLon = Math.abs(lon);
        const degrees = Math.floor(absLon);
        const minutes = (absLon - degrees) * 60;
        const minutesInt = Math.floor(minutes);
        const minutesFrac = Math.round((minutes - minutesInt) * 1000);
        
        const degStr = degrees.toString().padStart(3, '0');
        const minStr = minutesInt.toString().padStart(2, '0');
        const fracStr = minutesFrac.toString().padStart(3, '0');
        const hemisphere = lon >= 0 ? 'E' : 'W';
        
        return `${degStr}${minStr}${fracStr}${hemisphere}`;
    }

    formatAltitude(altitude) {
        // 高度をメートル単位で5桁にフォーマット
        const alt = Math.round(altitude);
        return alt.toString().padStart(5, '0');
    }

    formatFixAccuracy(accuracy) {
        // GPS精度を2桁でフォーマット（メートル単位）
        if (!accuracy) return '99';
        const acc = Math.min(Math.round(accuracy), 99);
        return acc.toString().padStart(2, '0');
    }

    generateChecksum() {
        // 簡単なチェックサム生成
        const timestamp = Date.now().toString();
        let sum = 0;
        for (let i = 0; i < timestamp.length; i++) {
            sum += timestamp.charCodeAt(i);
        }
        return sum.toString(16).toUpperCase().slice(-8);
    }

    // IGCファイルの検証
    validateIGC(igcContent) {
        const lines = igcContent.split('\n');
        const errors = [];

        // 基本的な検証
        if (!lines.some(line => line.startsWith('A'))) {
            errors.push('Aレコード（メーカー情報）が見つかりません');
        }

        if (!lines.some(line => line.startsWith('HFDTE'))) {
            errors.push('日付ヘッダーが見つかりません');
        }

        const bRecords = lines.filter(line => line.startsWith('B'));
        if (bRecords.length === 0) {
            errors.push('フライトレコードが見つかりません');
        }

        // フォーマット検証
        bRecords.forEach((record, index) => {
            if (record.length < 35) {
                errors.push(`Bレコード ${index + 1} の長さが不正です`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // IGCファイルの統計情報を生成
    generateStatistics(trackData) {
        if (!trackData || trackData.length === 0) {
            return null;
        }

        const startTime = new Date(trackData[0].timestamp);
        const endTime = new Date(trackData[trackData.length - 1].timestamp);
        const duration = endTime - startTime;

        const altitudes = trackData.map(p => p.altitude);
        const speeds = trackData.map(p => p.speed || 0);

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
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            totalDistance: totalDistance,
            maxAltitude: Math.max(...altitudes),
            minAltitude: Math.min(...altitudes),
            maxSpeed: Math.max(...speeds),
            averageSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
            pointCount: trackData.length,
            maxClimbRate: this.calculateMaxClimbRate(trackData),
            maxSinkRate: this.calculateMaxSinkRate(trackData)
        };
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

    calculateMaxClimbRate(trackData) {
        let maxClimb = 0;
        for (let i = 1; i < trackData.length; i++) {
            const prev = trackData[i - 1];
            const curr = trackData[i];
            const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
            if (timeDiff > 0) {
                const climbRate = (curr.altitude - prev.altitude) / timeDiff;
                maxClimb = Math.max(maxClimb, climbRate);
            }
        }
        return maxClimb;
    }

    calculateMaxSinkRate(trackData) {
        let maxSink = 0;
        for (let i = 1; i < trackData.length; i++) {
            const prev = trackData[i - 1];
            const curr = trackData[i];
            const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
            if (timeDiff > 0) {
                const sinkRate = (prev.altitude - curr.altitude) / timeDiff;
                maxSink = Math.max(maxSink, sinkRate);
            }
        }
        return maxSink;
    }

    // IGCファイルからトラックデータを読み込み（インポート機能）
    parseIGC(igcContent) {
        const lines = igcContent.split('\n');
        const trackData = [];
        let date = null;

        lines.forEach(line => {
            line = line.trim();
            
            // 日付の取得
            if (line.startsWith('HFDTE')) {
                const dateStr = line.substring(5);
                const day = parseInt(dateStr.substring(0, 2));
                const month = parseInt(dateStr.substring(2, 4)) - 1;
                const year = 2000 + parseInt(dateStr.substring(4, 6));
                date = new Date(year, month, day);
            }
            
            // Bレコード（フライトデータ）の解析
            if (line.startsWith('B') && date) {
                try {
                    const time = line.substring(1, 7);
                    const hours = parseInt(time.substring(0, 2));
                    const minutes = parseInt(time.substring(2, 4));
                    const seconds = parseInt(time.substring(4, 6));
                    
                    const timestamp = new Date(date);
                    timestamp.setUTCHours(hours, minutes, seconds);
                    
                    const lat = this.parseLatitude(line.substring(7, 15));
                    const lon = this.parseLongitude(line.substring(15, 24));
                    const altitude = parseInt(line.substring(30, 35));
                    
                    trackData.push({
                        timestamp: timestamp,
                        latitude: lat,
                        longitude: lon,
                        altitude: altitude,
                        speed: 0, // IGCファイルには通常速度情報がない
                        accuracy: 0
                    });
                } catch (error) {
                    console.warn('Failed to parse B record:', line, error);
                }
            }
        });

        return trackData;
    }

    parseLatitude(latStr) {
        const degrees = parseInt(latStr.substring(0, 2));
        const minutes = parseInt(latStr.substring(2, 4));
        const minutesFrac = parseInt(latStr.substring(4, 7)) / 1000;
        const hemisphere = latStr.substring(7);
        
        const lat = degrees + (minutes + minutesFrac) / 60;
        return hemisphere === 'S' ? -lat : lat;
    }

    parseLongitude(lonStr) {
        const degrees = parseInt(lonStr.substring(0, 3));
        const minutes = parseInt(lonStr.substring(3, 5));
        const minutesFrac = parseInt(lonStr.substring(5, 8)) / 1000;
        const hemisphere = lonStr.substring(8);
        
        const lon = degrees + (minutes + minutesFrac) / 60;
        return hemisphere === 'W' ? -lon : lon;
    }

    // IGCファイルのプレビュー生成
    generatePreview(trackData, maxPoints = 100) {
        if (!trackData || trackData.length === 0) {
            return null;
        }

        // データを間引いてプレビュー用のポイントを生成
        const step = Math.max(1, Math.floor(trackData.length / maxPoints));
        const previewData = [];
        
        for (let i = 0; i < trackData.length; i += step) {
            previewData.push(trackData[i]);
        }

        // 最後のポイントを確実に含める
        if (previewData[previewData.length - 1] !== trackData[trackData.length - 1]) {
            previewData.push(trackData[trackData.length - 1]);
        }

        return previewData;
    }
}