// Service Worker for SkyTracker
// GitHub Pages（/skytracker/）でも Netlify ルートでも動くよう、スコープ相対でキャッシュする
const CACHE_NAME = 'skytracker-v4';
const SCOPE = self.registration.scope;
const APP_FILES = [
    './',
    './index.html',
    './styles.css',
    './styles-race.css',
    './styles-mobile.css',
    './manifest.json',
    './js/app.js',
    './js/map.js',
    './js/geo.js',
    './js/task-engine.js',
    './js/sample-tasks.js',
    './js/waypoints.js',
    './js/openair.js',
    './js/qr-import.js',
    './js/weather-service.js',
    './js/thermal-predictor.js',
    './js/wind-estimator.js',
    './js/race-computer.js',
    './js/race-ui.js',
    './js/tracking.js',
    './js/igc.js',
    './js/group.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

function scopedUrl(path) {
    return new URL(path, SCOPE).href;
}

function indexUrl() {
    return scopedUrl('./index.html');
}

function isAppCode(url) {
    if (url.origin !== self.location.origin) return false;
    const scopePath = new URL(SCOPE).pathname;
    if (!url.pathname.startsWith(scopePath)) return false;
    return url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.html') ||
        url.pathname === scopePath ||
        url.pathname === scopePath.replace(/\/?$/, '/');
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_FILES.map(scopedUrl)))
            .catch((error) => {
                console.error('Failed to cache resources:', error);
            })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (isAppCode(url)) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(indexUrl())))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response;
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                return networkResponse;
            });
        }).catch(() => {
            if (event.request.destination === 'document') {
                return caches.match(indexUrl());
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(Promise.resolve());
    }
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
