const CACHE_NAME = "leagueforge-shell-v2";
const APP_SHELL = ["/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      try {
        const response = await fetch("/", { cache: "no-store" });
        const cacheControl = response.headers.get("cache-control") || "";
        if (response.ok && !/private|no-store/i.test(cacheControl)) await cache.put("/", response);
      } catch {}
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("leagueforge-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cacheControl = response.headers.get("cache-control") || "";
          if (url.pathname === "/" && response.ok && !/private|no-store/i.test(cacheControl)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline.html")) || Response.error())
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone before returning: `return response` hands the body to the
          // page, so cloning inside the async `caches.open(...).then(...)`
          // below always raced it and threw "body is already used".
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
            );
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error())
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "A match has been updated." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "LeagueForge match update", {
      body: payload.body || "A match has been updated.",
      icon: payload.icon || "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "leagueforge-match-update",
      renotify: true,
      // Android only raises a heads-up banner for a fresh tag, and it needs an
      // explicit non-silent alert to vibrate. Keep both set here.
      silent: false,
      vibrate: [200, 120, 200, 120, 200],
      timestamp: payload.timestamp || Date.now(),
      actions: [{ action: "view", title: "View match" }],
      data: { url: payload.url || "/public" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/public", self.location.origin);
  if (destination.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).pathname === destination.pathname);
      if (existing) return existing.focus();
      return self.clients.openWindow(destination.href);
    })
  );
});
