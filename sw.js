// Flow service worker — offline app shell
const CACHE = 'flow-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'Flow', body: e.data ? e.data.text() : 'Evening check-in' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Flow', {
      body: data.body || 'Time for your evening review',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'flow-review',
      data: { url: './' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls — Supabase, Anthropic, anything cross-origin
  if (url.origin !== location.origin) return;

  // Network-first for the app shell: always fresh when online, cached when offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
