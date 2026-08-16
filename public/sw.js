// Minimal service worker: makes the app installable and opens instantly
// offline once visited. Network-first so a deploy is picked up next visit;
// cache serves when the signal is gone.
const CACHE = 'brag-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then(hit => hit ?? Response.error())),
  );
});
