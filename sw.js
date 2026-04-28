/* Minimal offline shell: network-first for HTML; cache static assets only.
   Do not precache index.html — stale cache was serving old JS and breaking taps. */
const CACHE = 'stillness-shell-v5';
const SHELL = [
  '/manifest.json',
  '/icon.svg',
  '/sw.js',
  '/assets/peaceful/buddha-moss-garden.jpg',
  '/assets/peaceful/misty-forest-path.jpg',
  '/assets/peaceful/still-lake-dawn.jpg',
  '/assets/peaceful/lotus-water.jpg',
  '/assets/peaceful/rain-leaves.jpg',
  '/assets/peaceful/candle-meditation-corner.jpg',
  '/assets/peaceful/river-stones-stream.jpg',
  '/assets/peaceful/moonlit-pine-forest.jpg',
  '/assets/peaceful/tea-open-journal.jpg',
  '/assets/peaceful/sunrise-bamboo.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const u = new URL(request.url);
  if (u.origin !== self.location.origin) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const c = res.clone();
          caches.open(CACHE).then((cache) => {
            if (u.pathname === '/' || u.pathname === '/index.html') {
              cache.put('/index.html', c.clone());
            } else {
              cache.put(request, c);
            }
          });
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(
          (r) =>
            r ||
            (u.pathname === '/' ? caches.match('/index.html') : null)
        )
      )
  );
});
