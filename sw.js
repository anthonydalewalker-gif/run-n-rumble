// Offline cache for Run N Rumble. Bump VERSION when files change.
const VERSION = 'rnr-v15';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './js/audio.js', './js/input.js', './js/draw.js', './js/art.js', './js/friends.js', './js/art2.js', './js/levels.js', './js/game.js',
  './audio/music.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates show up), falling back to cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok && res.type === 'basic' && !e.request.headers.has('range')) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
