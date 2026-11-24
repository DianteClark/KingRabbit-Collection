// Offline cache for the KingRabbit Collection.
//  - Built game files in /assets/ have the content hash in their name, so they never change:
//    serve them from the cache first (instant opens, works offline), fetching once.
//  - Pages and everything else: try the network first (so updates always arrive), fall back to
//    the cached copy when offline or when the network takes too long.
const CACHE = 'kingrabbit-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), 6000)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return fetch(req); // nothing cached: let the browser keep waiting on the network
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/assets/')) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req));
});
