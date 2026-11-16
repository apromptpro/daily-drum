// Keeps a copy of the app on the device so it opens fast, and without internet.
// Pictures never change under the same name, so the saved copy is used at once (no waiting for the network).
// The pages and the code are fetched fresh, but if the network is slow the saved copy is used after 3 seconds.
const CACHE = 'drum-coach-20';
const FILES = ['./', 'index.html', 'style.css', 'app.css', 'facts.js', 'ui.js', 'art/logo-s.png', 'art/b0-idle.png', 'art/b1-idle.png', 'art/b0-blink.png', 'art/b1-blink.png', 'art/studio.jpg', 'art/s1.jpg', 'lessons.js', 'audio.js', 'track.js', 'game.js', 'track2.js', 'tour.js', 'config.js', 'online.js', 'app.js', 'worklet.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const keep = (r, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); } return res; };
self.addEventListener('fetch', (e) => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== self.location.origin) return;
  const saved = () => caches.match(r, { ignoreSearch: true });
  // pictures: the saved copy first
  if (/\.(png|jpe?g|webp|svg|gif)$/i.test(url.pathname)) {
    e.respondWith(saved().then(m => m || fetch(r).then(res => keep(r, res))));
    return;
  }
  // pages and code: the newest from the network; the saved copy when the network fails or takes too long
  e.respondWith(new Promise((done) => {
    let settled = false;
    const finish = (res) => { if (!settled && res) { settled = true; done(res); } };
    const fallback = () => saved().then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
    const timer = setTimeout(() => fallback().then(finish), 3000);
    fetch(r).then(res => { clearTimeout(timer); keep(r, res); finish(res); })
      .catch(() => { clearTimeout(timer); fallback().then(m => { if (!settled) { settled = true; done(m || Response.error()); } }); });
  }));
});
