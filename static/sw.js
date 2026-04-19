var CACHE = 'site-v1';
var PRECACHE = [
  '/',
  '/fonts/inter-latin.woff2',
  '/fonts/jetbrains-mono-latin.woff2',
  '/favicon.svg'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Skip external requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET
  if (e.request.method !== 'GET') return;

  var isAsset = /\.(css|js|woff2|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname);

  if (isAsset) {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
          }
          return response;
        });
      })
    );
  } else {
    // Network-first for HTML
    e.respondWith(
      fetch(e.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
  }
});
