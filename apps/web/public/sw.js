const CACHE_NAME = 'rosovia-shell-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/explore',
  '/offline.html',
];

// Service Worker Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Warm cache with core assets
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Activate Event
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

// Fetch Interception
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Handle navigate requests (HTML page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback to cached offline page
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Handle other asset requests (Stale-While-Revalidate caching pattern)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { /* ignore background sync errors */ });
          
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache media assets, stylesheets, scripts or web fonts dynamically
        const url = event.request.url;
        const isCachable = 
          url.includes('/_next/static/') ||
          url.includes('/fonts/') ||
          url.endsWith('.css') ||
          url.endsWith('.js') ||
          url.endsWith('.png') ||
          url.endsWith('.jpg') ||
          url.endsWith('.svg');

        if (networkResponse.status === 200 && isCachable) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for image requests if network is offline
        if (event.request.destination === 'image') {
          // Return raw fallback SVG or similar placeholder
          return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#202030"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#505070" font-family="sans-serif" font-size="12">Offline</text></svg>`,
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      });
    })
  );
});
