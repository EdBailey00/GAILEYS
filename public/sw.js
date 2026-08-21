// Minimal service worker: makes the app installable and opens instantly
// offline once visited.
//
// Network-first, so a deploy is picked up rather than a stale copy served
// back. The catch is that fetch() goes through the browser's own http cache,
// and GitHub Pages sends max-age=600 on everything - so for the two requests
// where staleness actually matters, the page itself and the version file,
// the http cache is skipped entirely. Ten minutes of "which build am I on"
// being wrong is ten minutes too many.
const CACHE = 'brag-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event =>
  event.waitUntil(
    (async () => {
      // Anything left by an older worker is a copy of a build nobody wants.
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  ),
);

/** The requests that must never come out of the browser's http cache. */
function mustBeFresh(request) {
  return request.mode === 'navigate' || new URL(request.url).pathname.endsWith('/version.json');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  let request = event.request;
  if (mustBeFresh(request)) {
    try {
      request = new Request(request, { cache: 'reload' });
    } catch {
      // Older browsers will not take the option. Network-first still applies.
    }
  }

  event.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then(hit => hit ?? Response.error())),
  );
});
