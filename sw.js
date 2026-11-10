/* يخزّن ملفات التجربة لتشتغل بدون إنترنت بعد أول فتح */
const CACHE = 'nabdak-v6-naqla';
const FILES = [
  './',
  'index.html',
  'p.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/style.css',
  'js/config.js',
  'js/water.js',
  'js/artwork.js',
  'js/qr.js',
  'js/export.js',
  'js/app.js',
  'assets/brand/naqla-white.svg',
  'assets/brand/naqla-white.png',
  'assets/brand/rowad-white.png',
  'assets/brand/logo-data.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/fonts/thmanyahsans-light.woff2',
  'assets/fonts/thmanyahsans-regular.woff2',
  'assets/fonts/thmanyahsans-medium.woff2'
];

// خلفيات المزاج: نخزن الموجود منها بأي صيغة (ما نوقف التثبيت لو ناقص)
importScripts('js/config.js');
const ART_EXT = ((self.NABDAK_CONFIG || {}).artExt || 'png').replace('.', '');
const ART = ['calm', 'breeze', 'rose', 'energy'].map(n => 'assets/art/' + n + '.' + ART_EXT);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES).then(() => Promise.all(ART.map(u => c.add(u).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الشبكة أولًا (عشان التحديثات توصل)، وإذا ما فيه إنترنت نرجع للنسخة المخزنة
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
