const CACHE_NAME = "rural-attendance-v2";
const CACHE_PREFIX = "rural-attendance-";
const APP_SHELL = ["/offline.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
    .then((clients) => {
      // Replace tabs that were loaded with the previous dev bundle so the new
      // server HTML and client chunks come from the same build.
      if (["localhost", "127.0.0.1"].includes(self.location.hostname)) {
        clients.forEach((client) => client.navigate(client.url));
      }
    }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Never cache pages: login and dashboard HTML can contain account-specific data.
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html"))));
    return;
  }

  // Next.js chunks must always come from the active server build. Serving old
  // hashed chunks after a deploy causes hydration errors and stale UI.
  if (url.pathname.startsWith("/_next/")) return;

  if (["/manifest.json", "/icon.svg"].includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
  }
});
