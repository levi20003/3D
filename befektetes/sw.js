/* Offline működés: az app fájljai gyorsítótárból, az árfolyam-API-k mindig a hálózatról. */
const CACHE = 'befektetes-v15';
const SHELL = ['./', 'index.html', 'app.js', 'engine.js', 'parser.js', 'csv.js', 'demo.js', 'i18n.js', 'i18n-en.js', 'manifest.webmanifest', 'manifest-en.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || /twelvedata|frankfurter/.test(u.hostname)) return;
  if (u.origin === location.origin) {
    // saját fájlok: hálózat először (frissítés), hiba esetén gyorsítótár
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })));
  }
});
