/* Semáforo de Clase — Service worker
   Guarda la app en caché para que abra y funcione sin conexión, pero
   siempre intenta primero la versión más nueva por red: así, cada vez
   que se publica un cambio, quien ya había abierto la app lo recibe
   en la siguiente carga en vez de quedarse con una copia vieja guardada.
   Las llamadas a /api/* nunca se guardan: siempre van a la red. */
const CACHE = 'sdc-v2';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './assets/logo.svg'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(APP_SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // nunca cachear la API

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
