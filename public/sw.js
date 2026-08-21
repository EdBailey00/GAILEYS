// Minimal service worker: makes the app installable and opens instantly
// offline once visited. Network-first so a deploy is picked up next visit;
// cache serves when the signal is gone.
const CACHE = 'brag-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // version.json is the app asking which push the server is on. A cached
  // answer to that question is worse than no answer, so it never goes in.
  if (new URL(event.request.url).pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request));
    return;
  }
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
