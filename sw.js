/* case os service worker: opens offline. Network first (online = newest deploy), cached copy when offline.
   Never touches the data in localStorage. Bump VERSION only if the cache layout changes. */
'use strict';
const VERSION = 'caseos-v1';
const CACHE = VERSION + '-files';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'assets/app.css', 'assets/app.js', 'assets/logic.js', 'assets/data.js',
  'assets/favicon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(async p => { try { const r = await fetch(p, { cache: 'no-cache' }); if (r.ok) await c.put(p, r); } catch (_) {} }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) if (n.startsWith('caseos-') && n !== CACHE) await caches.delete(n);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    } catch (_) {
      return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('index.html') : Response.error());
    }
  })());
});
