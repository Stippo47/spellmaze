// Keeps the whole game on the phone so it opens with no signal. Bump VERSION on every release.
const VERSION = '0.11.0';
const CACHE = `spellmaze-${VERSION}`;
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/util.js', 'js/maze.js', 'js/game.js', 'js/input.js', 'js/render.js', 'js/weapons.js', 'js/modules.js', 'js/run.js', 'js/ui.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('spellmaze-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => { if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request))); });
