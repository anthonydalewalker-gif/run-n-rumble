// Run N Rumble moved to https://www.etingi.com/run-n-rumble/ (rnr-v20-moved).
// This worker clears old caches, unregisters itself and sends open tabs to the new home.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) {
      const u = new URL(c.url);
      c.navigate('https://www.etingi.com/run-n-rumble/' + u.search + u.hash).catch(() => {});
    }
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') e.respondWith(Response.redirect('https://www.etingi.com/run-n-rumble/' + new URL(e.request.url).search, 302));
});
