// XCTrack 互換の QR / テキスト タスク取り込み
class QRTaskImport {
    static decodePayload(raw) {
        if (raw == null) {
            throw new Error('QR の内容が空です');
        }
        let text = String(raw).trim().replace(/^\uFEFF/, '');
        if (!text) {
            throw new Error('QR の内容が空です');
        }

        if (/^XCTSK:/i.test(text)) {
            text = text.replace(/^XCTSK:/i, '').trim();
        }

        const fromJson = QRTaskImport.tryParseTask(text);
        if (fromJson) return fromJson;

        const decodedUrl = QRTaskImport.safeDecodeURI(text);
        if (decodedUrl && decodedUrl !== text) {
            const viaUrl = QRTaskImport.tryParseTask(decodedUrl.replace(/^XCTSK:/i, '').trim());
            if (viaUrl) return viaUrl;
        }

        const b64 = QRTaskImport.tryBase64(text);
        if (b64) {
            const viaB64 = QRTaskImport.tryParseTask(b64.replace(/^XCTSK:/i, '').trim());
            if (viaB64) return viaB64;
        }

        if (/^https?:\/\//i.test(text)) {
            return { kind: 'url', url: text };
        }

        throw new Error('QR からタスクを読めませんでした（.xctsk JSON を想定）');
    }

    static tryParseTask(text) {
        const trimmed = String(text || '').trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const task = TaskEngine.parseXctsk(trimmed);
                if (task && task.turnpoints && task.turnpoints.length >= 2) {
                    return { kind: 'task', task };
                }
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    static tryBase64(text) {
        const compact = String(text).replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]+=*$/.test(compact) || compact.length < 16) return null;
        try {
            if (typeof atob === 'function') {
                return atob(compact);
            }
            return Buffer.from(compact, 'base64').toString('utf8');
        } catch (e) {
            return null;
        }
    }

    static safeDecodeURI(text) {
        try {
            return decodeURIComponent(text);
        } catch (e) {
            return text;
        }
    }

    static async fetchUrl(url, fetchImpl) {
        const fetchFn = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        if (!fetchFn) throw new Error('URL を取得できません');
        const res = await fetchFn(url, { headers: { Accept: 'application/json,text/plain,*/*' } });
        if (!res.ok) throw new Error(`タスクURLの取得に失敗: ${res.status}`);
        const text = await res.text();
        const parsed = QRTaskImport.decodePayload(text);
        if (parsed.kind === 'url') {
            throw new Error('URLの先がさらにURLでした');
        }
        return parsed;
    }

    static async loadJsQR() {
        if (typeof jsQR === 'function') return jsQR;
        if (typeof document === 'undefined') {
            throw new Error('jsQR がありません');
        }
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-jsqr]');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('jsQR の読み込みに失敗')));
                return;
            }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            s.async = true;
            s.dataset.jsqr = '1';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('jsQR の読み込みに失敗'));
            document.head.appendChild(s);
        });
        if (typeof jsQR !== 'function') throw new Error('jsQR がありません');
        return jsQR;
    }

    static async decodeImageFile(file) {
        const decode = await QRTaskImport.loadJsQR();
        const bitmap = await QRTaskImport.fileToImageData(file);
        const result = decode(bitmap.data, bitmap.width, bitmap.height);
        if (!result || !result.data) {
            throw new Error('画像から QR を検出できませんでした');
        }
        return QRTaskImport.decodePayload(result.data);
    }

    static fileToImageData(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    resolve(data);
                } catch (e) {
                    URL.revokeObjectURL(url);
                    reject(e);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('画像を開けませんでした'));
            };
            img.src = url;
        });
    }
}

class QRScanner {
    constructor(overlay) {
        this.overlay = overlay;
        this.video = overlay && overlay.querySelector('video');
        this.canvas = overlay && overlay.querySelector('canvas');
        this.stream = null;
        this.timer = null;
        this.running = false;
    }

    async start() {
        if (!this.video) throw new Error('カメラ表示がありません');
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });
        this.video.srcObject = this.stream;
        this.video.setAttribute('playsinline', 'true');
        await this.video.play();
        this.running = true;
        this.overlay.classList.remove('hidden');
        return this.loop();
    }

    loop() {
        return new Promise((resolve, reject) => {
            const detector = typeof BarcodeDetector === 'function'
                ? new BarcodeDetector({ formats: ['qr_code'] })
                : null;

            const tick = async () => {
                if (!this.running) {
                    reject(new Error('スキャンを中止しました'));
                    return;
                }
                try {
                    if (detector) {
                        const codes = await detector.detect(this.video);
                        if (codes && codes[0] && codes[0].rawValue) {
                            resolve(QRTaskImport.decodePayload(codes[0].rawValue));
                            this.stop();
                            return;
                        }
                    } else if (this.canvas) {
                        const decode = await QRTaskImport.loadJsQR();
                        const w = this.video.videoWidth;
                        const h = this.video.videoHeight;
                        if (w && h) {
                            this.canvas.width = w;
                            this.canvas.height = h;
                            const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
                            ctx.drawImage(this.video, 0, 0, w, h);
                            const img = ctx.getImageData(0, 0, w, h);
                            const result = decode(img.data, w, h);
                            if (result && result.data) {
                                resolve(QRTaskImport.decodePayload(result.data));
                                this.stop();
                                return;
                            }
                        }
                    }
                } catch (e) {
                    // keep scanning
                }
                this.timer = setTimeout(tick, 220);
            };
            tick();
        });
    }

    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        if (this.overlay) this.overlay.classList.add('hidden');
    }
}

if (typeof window !== 'undefined') {
    window.QRTaskImport = QRTaskImport;
    window.QRScanner = QRScanner;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QRTaskImport, QRScanner };
}
