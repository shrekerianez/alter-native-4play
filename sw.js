const CACHE_NAME = '4play-shell-v11';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './categories.css',
  './room.css',
  './room-qr.css',
  './room-final.css',
  './app.js',
  './room-mode.js',
  './room-qr.js',
  './room-entry.js',
  './supabase-config.js',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './data/cards.json',
  './data/relationships.json',
  './data/spicy.json',
  './data/party.json',
  './data/awkward.json',
  './data/life.json',
  './data/dark_humor.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (!response || response.status !== 200) return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
