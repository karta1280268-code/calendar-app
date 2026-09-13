const CACHE_NAME = 'calendar-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Always fetch from network first for the API to ensure fresh data
  if (event.request.url.includes('kvdb.io')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        });
        return response || fetchPromise;
      })
  );
});
