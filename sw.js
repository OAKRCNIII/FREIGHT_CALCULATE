/* Freight Calculator — Service Worker
 * Cache HTML + manifest + icons so app loads offline / faster
 * Supabase API calls always go through network (not cached) */

const CACHE_NAME = 'freight-calc-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/apple-touch-icon-180.png',
  './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-152.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Never cache Supabase API — always go through network */
  if (url.hostname.endsWith('supabase.co')) {
    return; /* default network behavior */
  }

  /* Never cache cross-origin (e.g. supabase-js CDN, Google Fonts) — go through network */
  if (url.origin !== self.location.origin) {
    return;
  }

  /* App shell: network-first, fallback to cache (so updates appear when online) */
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        /* update cache with fresh copy */
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
