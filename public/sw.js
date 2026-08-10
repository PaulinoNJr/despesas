const CACHE = 'conta-certa-v1'
const ASSETS = ['/', '/manifest.webmanifest', '/icon.svg']
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
))
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys
    .filter(key => (key.startsWith('conta-clara-') || key.startsWith('conta-certa-')) && key !== CACHE)
    .map(key => caches.delete(key))
  )).then(() => self.clients.claim())
))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone()
      if (response.ok) caches.open(CACHE).then(cache => cache.put('/', copy))
      return response
    }).catch(() => caches.match('/')))
    return
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone()
    if (response.ok && new URL(event.request.url).origin === location.origin) caches.open(CACHE).then(cache => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match('/'))))
})
