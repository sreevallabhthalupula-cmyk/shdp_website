/* SHDP service worker: offline shell + installable app.
   - Pages, scripts, styles and data/*.json: network first (fresh content after every deploy),
     falling back to the cached copy only when offline.
   - Images: cached, refreshed in the background (stale-while-revalidate).
   Bump VERSION when the list of core files changes. The site works normally without this file. */
const VERSION = "shdp-2026-10-08-2";
const CORE = [
  "./",
  "index.html",
  "css/styles.css",
  "js/i18n.js", "js/data.js", "js/core.js", "js/share.js", "js/calendar.js", "js/events.js",
  "js/programmes.js", "js/timeline.js", "js/media.js", "js/books.js", "js/search.js", "js/atmosphere.js", "js/supabase-config.js", "js/community.js", "js/main.js",
  "data/site.json", "data/quotes.json", "data/events.json", "data/programmes.json",
  "data/timeline.json", "data/videos.json", "data/books.json", "data/gallery.json", "data/community.json",
  "manifest.webmanifest",
  "assets/img/logo.jpg", "assets/img/favicon.png", "assets/img/icon-192.png",
  "assets/img/guruji-hero-1000.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => null)))) // one missing file must not block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(request, copy)); }
      return res;
    })
    .catch(() => caches.match(request, { ignoreSearch: true })
      .then(hit => hit || (request.mode === "navigate" ? caches.match("index.html") : Response.error())));
}

function staleWhileRevalidate(request) {
  return caches.open(VERSION).then(cache => cache.match(request).then(hit => {
    const refresh = fetch(request).then(res => { if (res && res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
    return hit || refresh;
  }));
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // CDNs, fonts, YouTube: browser default
  if (url.pathname.endsWith("/sw.js")) return;
  if (url.pathname.includes("/admin/")) return; // operator dashboard: always straight from the network, never cached
  if (req.mode === "navigate" || /\.(html|js|css|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/")) {
    event.respondWith(networkFirst(req));
  } else if (/\.(png|jpe?g|webp|avif|gif|svg|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
