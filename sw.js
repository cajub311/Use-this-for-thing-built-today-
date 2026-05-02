/* Minimal offline shell: network-first for HTML; cache static assets only.
   Do not precache index.html — stale cache was serving old JS and breaking taps. */
const CACHE = 'stillness-shell-v50-theravada-chants';
const SHELL = [
  '/manifest.json',
  '/icon.svg',
  '/visual-polish.css',
  '/calm-redesign.css',
  '/polish-v2.css',
  '/minimal-meditation.css',
  '/forest-monastery.css',
  '/forest-monastery.js',
  '/data/chant-sources.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
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
  '/assets/peaceful/sunrise-bamboo.jpg',
  '/assets/peaceful/morning-window-plants.jpg',
  '/assets/peaceful/evening-tea-lamp.jpg',
  '/assets/peaceful/stone-path-garden-gate.jpg',
  '/assets/peaceful/quiet-desk-insights.jpg',
  '/assets/peaceful/wildflower-memory-cards.jpg',
  '/assets/peaceful/meditation-room-morning.jpg',
  '/assets/peaceful/forest-cairn-mist.jpg',
  '/assets/peaceful/lotus-stones-sunrise.jpg',
  '/assets/peaceful/buddhist-garden-altar.jpg',
  '/assets/peaceful/rain-window-winddown.jpg',
  '/assets/generated/forest-monastery-sanctuary.png',
  '/assets/generated/practice-hall-bowl.png',
  '/assets/sounds/rain.ogg',
  '/assets/sounds/forest-ambience.ogg',
  '/assets/sounds/singing-bowl.ogg',
  '/assets/sounds/chant-refuge.oga',
  '/assets/sounds/chant-veneration.mp3',
  '/assets/sounds/chant-five-recollections.mp3',
  '/assets/sounds/chant-karaniya-metta.mp3'
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
        if (res.ok && u.pathname !== '/' && u.pathname !== '/index.html') {
          const c = res.clone();
          caches.open(CACHE).then((cache) => {
            cache.put(request, c);
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
