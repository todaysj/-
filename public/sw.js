const CACHE_NAME = 'j-planner-offline-v2';

// Initial core assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/leaflet.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some assets failed to precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests or chrome-extension schemes
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return;
  }

  // CRITICAL: NEVER intercept Firestore, Firebase, or external API endpoints!
  // This allows real-time Firestore sync and cross-device syncing to work seamlessly.
  if (
    requestUrl.hostname.includes('firestore.googleapis.com') ||
    requestUrl.hostname.includes('firebase') ||
    requestUrl.hostname.includes('googleapis.com') ||
    requestUrl.protocol.startsWith('ws') ||
    requestUrl.origin !== self.location.origin
  ) {
    return;
  }

  // Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          // If offline, return cached page or fallback to cached /index.html
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Static assets & runtime caching (Stale-While-Revalidate with Cache Fallback)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // If offline and not in cache, fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
