/*
 * Pramāṇa service worker: offline study, nothing else.
 *
 * - Pages: only /learn (and the home page) are kept for offline use, network
 *   first, so a fresh copy is used whenever there is a connection.
 * - Data: only GET /api/study/due (the cards due over the next days).
 * - Assets: /_next/static, icons and the manifest, so the kept pages can run.
 * - Never cached: any request that is not a GET (answers, server actions),
 *   /review, /audit, other /api routes, and React Server Component requests.
 *   Answers made offline are queued by the page itself (IndexedDB) and sent
 *   to /api/study/reviews when the connection returns.
 * - No push, no background sync, no requests to other origins.
 */
const VERSION = "pramana-study-v1";
const DEV = new URL(self.location.href).searchParams.get("mode") === "dev";
const PAGES = new Set(["/learn", "/"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) =>
        c.addAll(["/learn", "/manifest.webmanifest", "/icon.svg"]).catch(() => undefined),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pramana-study-") && k !== VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#171c33;background:#f3f2ed">
<h1 style="font-weight:500">You are offline</h1><p>This page has not been saved for offline reading. Your reviews have:
<a href="/learn" style="color:#2c3b8e">go to Learn</a>. Answers you give offline are kept on this device and sent when you are back online.</p></body></html>`;

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic")
      await cache.put(cacheKey ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey ?? request, { ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  // React Server Component payloads and the live-update stream are never kept.
  if (
    request.headers.get("RSC") ||
    url.searchParams.has("_rsc") ||
    request.headers.get("accept")?.includes("text/event-stream")
  )
    return;
  if (path.startsWith("/review") || path.startsWith("/audit")) return;

  if (request.mode === "navigate") {
    if (PAGES.has(path))
      // One copy per page, whatever the query string (?era=…).
      event.respondWith(
        networkFirst(request, path).catch(
          () =>
            new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
        ),
      );
    else
      event.respondWith(
        fetch(request).catch(
          () =>
            new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
        ),
      );
    return;
  }
  if (path === "/api/study/due") {
    event.respondWith(networkFirst(request, "/api/study/due"));
    return;
  }
  if (path.startsWith("/api/")) return;
  if (
    path.startsWith("/_next/static/") ||
    path === "/manifest.webmanifest" ||
    /^\/icon[\w-]*\.svg$/.test(path)
  ) {
    // Production assets are content-hashed, so the cache can answer first; in development they change in place.
    event.respondWith(DEV ? networkFirst(request) : cacheFirst(request));
  }
});
