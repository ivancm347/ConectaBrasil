const CACHE_NAME = 'conecta-brasil-shell-v4';
const APP_BASE = new URL('./', self.registration.scope);
const INDEX_URL = new URL('index.html', APP_BASE).toString();
const APP_ASSETS = [
  INDEX_URL,
  new URL('manifest.webmanifest', APP_BASE).toString(),
  new URL('icon.svg', APP_BASE).toString()
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_ASSETS.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('conecta-brasil-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(INDEX_URL)) || Response.error();
      }
    })());
    return;
  }

  if (/\.(?:js|css|svg|png|webp|jpg|jpeg|avif|ico|woff2?|webmanifest)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);
      if (cached) {
        // Entrega o recurso em cache rapidamente e atualiza a cópia em segundo plano.
        event.waitUntil(refresh);
        return cached;
      }
      const fresh = await refresh;
      return fresh || Response.error();
    })());
  }
});
