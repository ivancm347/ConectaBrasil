const CACHE_NAME = 'conecta-brasil-shell-v1';
const APP_BASE = new URL('./', self.registration.scope);
const INDEX_URL = new URL('index.html', APP_BASE).toString();

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.add(INDEX_URL); } catch (error) { /* A instalação não deve falhar por indisponibilidade temporária. */ }
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

  if (/\.(?:js|css|svg|png|webp|jpg|jpeg|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});
