// Service Worker for SkyTracker
const CACHE_NAME = 'skytracker-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/app.js',
    '/js/map.js',
    '/js/tracking.js',
    '/js/igc.js',
    '/js/group.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// インストール時のキャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Failed to cache resources:', error);
            })
    );
});

// フェッチイベントの処理
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにある場合はそれを返す
                if (response) {
                    return response;
                }

                // ネットワークから取得
                return fetch(event.request).then((response) => {
                    // 有効なレスポンスかチェック
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // レスポンスをクローンしてキャッシュに保存
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
            .catch(() => {
                // オフライン時のフォールバック
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});

// アクティベート時の古いキャッシュ削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // バックグラウンドでの位置情報同期処理
        console.log('Background sync triggered');
        
        // 保存されたトラックデータを取得
        const trackData = await getStoredTrackData();
        if (trackData && trackData.length > 0) {
            // サーバーに同期（実装に応じて）
            await syncTrackData(trackData);
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

async function getStoredTrackData() {
    // IndexedDBまたはlocalStorageからデータを取得
    return new Promise((resolve) => {
        // 簡単な実装例
        resolve([]);
    });
}

async function syncTrackData(data) {
    // サーバーとの同期処理
    console.log('Syncing track data:', data.length, 'points');
}

// プッシュ通知の処理
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'SkyTrackerからの通知',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: '開く',
                icon: '/icon-explore.png'
            },
            {
                action: 'close',
                title: '閉じる',
                icon: '/icon-close.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('SkyTracker', options)
    );
});

// 通知クリックの処理
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        // アプリを開く
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // 何もしない（通知を閉じるだけ）
    } else {
        // デフォルトアクション
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// メッセージ処理
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 位置情報の定期取得（バックグラウンド）
let backgroundGeolocation = null;

self.addEventListener('message', (event) => {
    if (event.data.type === 'START_BACKGROUND_TRACKING') {
        startBackgroundTracking();
    } else if (event.data.type === 'STOP_BACKGROUND_TRACKING') {
        stopBackgroundTracking();
    }
});

function startBackgroundTracking() {
    if (backgroundGeolocation) {
        return;
    }

    // 定期的な位置取得（制限あり）
    backgroundGeolocation = setInterval(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // 位置情報を保存
                    savePositionToStorage(position);
                },
                (error) => {
                    console.error('Background geolocation error:', error);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 30000,
                    maximumAge: 60000
                }
            );
        }
    }, 60000); // 1分間隔
}

function stopBackgroundTracking() {
    if (backgroundGeolocation) {
        clearInterval(backgroundGeolocation);
        backgroundGeolocation = null;
    }
}

function savePositionToStorage(position) {
    // 位置情報をIndexedDBに保存
    const positionData = {
        timestamp: Date.now(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy
    };

    // 簡単な実装（実際にはIndexedDBを使用）
    console.log('Background position saved:', positionData);
}

// エラーハンドリング
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('SkyTracker Service Worker loaded');