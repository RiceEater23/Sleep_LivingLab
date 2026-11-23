const cacheName = 'sleep-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable');
    const body = await response.clone().text();
    const files = [...body.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m => m[1]);
    if (!files.length) throw new Error('Production assets unavailable');
    const cache = await caches.open(cacheName);
    await cache.addAll([...new Set([...files, '/sleep.webmanifest', '/sleep-icon.svg', '/sleep-192.png', '/sleep-512.png'])]);
    await cache.put('/', response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('sleep-shell-') && key !== cacheName) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || request.method !== 'GET') return;
  if (request.mode === 'navigate' && ['/', '/dashboard','/settings','/checklist'].includes(url.pathname)) {
    event.respondWith((async () => {
      try { const r = await fetch(request); if (r.ok) return r; } catch { /* offline */ }
      return (await caches.match('/')) || Response.error();
    })());
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/sleep-') || url.pathname==='/sleep.webmanifest') {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const r = await fetch(request);
      if (r.ok) await (await caches.open(cacheName)).put(request, r.clone());
      return r;
    })());
  }
});
