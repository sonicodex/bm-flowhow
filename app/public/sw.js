// FlowHow's service worker (SPEC §9, Architecture: "manifest plus a
// service worker that caches the app shell only. No offline data"; phase
// 6.10).
//
// The shell is the static files every page is drawn with: styles, fonts,
// logo and isotype, icons, the browser modules and the "sin conexión" page.
// Nothing a server-rendered page says is ever cached: pages carry the user's flows,
// progress and session, and always come from the network.
//
// Shell files are fetched from the network first and the cache is only the
// fallback, because they are not fingerprinted: serving a stale core.js
// against a newer server would break the tour. The cache makes the shell
// available when the network is not; it does not make anything faster.
// Bump VERSION when the list changes.
const VERSION = 'flowhow-shell-3';

// The "sin conexión" page is public/offline.html, which the assets serve at
// /offline (they redirect the .html address, and a redirected response
// cannot answer a navigation).
const SHELL = [
  '/offline',
  '/theme.css',
  '/app.css',
  '/flowhow_logotype.svg',
  '/loading_isotype.svg',
  '/fonts/ibrand.woff',
  '/icons/alert.svg',
  '/icons/back.svg',
  '/icons/close.svg',
  '/icons/done.svg',
  '/icons/hold_on.svg',
  '/icons/in_progress.svg',
  '/icons/link.svg',
  '/icons/pending.svg',
  '/icons/subprocess.svg',
  '/icons/zoom.svg',
  '/js/core.js',
  '/js/diagram-layout.js',
  '/js/diagram.js',
  '/js/editor.js',
  '/js/grid-edit.js',
  '/js/import-form.js',
  '/js/table-scroll.js',
  '/js/tour-log.js',
  '/js/report.js',
  '/js/splash.js',
  '/js/sw-register.js',
  '/js/viewer.js',
  '/js/xlsx-write.js',
  '/js/xlsx.js',
];
const IN_SHELL = new Set(SHELL);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only this site's GETs; forms, the tour's JSON and other sites go by.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // A page: always the network. Without one, the "sin conexión" page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline')));
    return;
  }
  if (!IN_SHELL.has(url.pathname)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(VERSION).then((cache) => cache.put(url.pathname, copy)));
        }
        return response;
      })
      .catch(() => caches.match(url.pathname).then((cached) => cached || Response.error())),
  );
});
