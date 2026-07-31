const CACHE_NAME = 'kissanai-v7';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.json',
  'styles.css',
  'app.js'
];

// Install Event: Cache Core Static Assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting(); // Activate new SW immediately
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Cache-First for local files, bypass APIs
self.addEventListener('fetch', (e) => {
  // Never attempt to cache live API endpoints
  if (e.request.url.includes('api.plant.id') || e.request.url.includes('cohere.ai')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});