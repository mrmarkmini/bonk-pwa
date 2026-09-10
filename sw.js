const BUILD_VERSION = 'b70db28c10fca0a5ac573fa9f39f493598f67ef2';
const PRECACHE_PATHS = ["assets/index-D_uSFqyW.js","assets/index-DuFxtJJR.css","bonk.svg","icon-192.svg","icon-512.svg","icons/bonk-192.png","icons/bonk-512.png","index.html","manifest.webmanifest"];
const workerUrl = new URL(self.location.href);
const scopeUrl = new URL('./', self.registration.scope);
const cachePrefix = `bonk-shell-${scopeUrl.pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'}-`;
const CACHE_NAME = `${cachePrefix}${BUILD_VERSION}`;
let claimClientsAfterUpdate = false;

function isSameOriginAsset(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin &&
    url.pathname !== workerUrl.pathname &&
    !url.pathname.endsWith('/version.json');
}

self.addEventListener('install', (event) => {
  const shell = [
    scopeUrl.toString(),
    ...PRECACHE_PATHS.map((path) => new URL(path, scopeUrl).toString()),
  ];
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(shell)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(cachePrefix) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    // Claim existing pages only after the user explicitly accepted an update.
    // The initial install and background updates must not change a live match.
    if (claimClientsAfterUpdate) await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    claimClientsAfterUpdate = true;
    self.skipWaiting();
  }
});

async function cacheAndReturn(request, response) {
  if (!response.ok) return response;
  try {
    // Clone before awaiting cache operations; the response body is otherwise
    // consumed by the page before cache.put() gets a usable copy.
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  } catch {
    // A cache quota/private-mode failure should not turn a successful network
    // response into a failed page load.
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOriginAsset(request)) return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' || url.pathname.endsWith('/')) {
    event.respondWith(fetch(request)
      .then((response) => cacheAndReturn(request, response))
      .catch(() => caches.match(request).then((cached) => cached || caches.match(scopeUrl))));
    return;
  }
  event.respondWith(caches.match(request)
    .then((cached) => cached || fetch(request).then((response) => cacheAndReturn(request, response))));
});
