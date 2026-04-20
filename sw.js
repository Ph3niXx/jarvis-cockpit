// AI Cockpit service worker
// Cache-first for static shell (cockpit/* + CDN libs pinned by SRI),
// network-first for Supabase/API calls — so the app stays installable
// and fast offline while always preferring fresh data when online.
const CACHE = "cockpit-v11";

const STATIC = [
  "/",
  "/index.html",
  "/manifest.json",
  "/cockpit/styles.css?v=22",
  "/cockpit/styles-recos.css?v=2",
  "/cockpit/styles-radar.css?v=2",
  "/cockpit/styles-challenges.css?v=1",
  "/cockpit/styles-wiki.css?v=4",
  "/cockpit/styles-signals.css?v=4",
  "/cockpit/styles-opportunities.css?v=1",
  "/cockpit/styles-ideas.css?v=1",
  "/cockpit/styles-jarvis.css?v=3",
  "/cockpit/styles-profile.css?v=3",
  "/cockpit/styles-forme.css?v=1",
  "/cockpit/styles-musique.css?v=1",
  "/cockpit/styles-gaming.css?v=1",
  "/cockpit/styles-stacks.css?v=1",
  "/cockpit/styles-history.css?v=1",
  "/cockpit/themes.js?v=2",
  "/cockpit/data.js",
  "/cockpit/data-veille.js?v=2",
  "/cockpit/data-sport.js?v=2",
  "/cockpit/data-gaming.js?v=2",
  "/cockpit/data-anime.js?v=2",
  "/cockpit/data-news.js?v=3",
  "/cockpit/data-apprentissage.js?v=1",
  "/cockpit/data-challenges.js?v=1",
  "/cockpit/data-wiki.js?v=1",
  "/cockpit/data-signals.js?v=2",
  "/cockpit/data-opportunities.js?v=1",
  "/cockpit/data-ideas.js?v=1",
  "/cockpit/data-jarvis.js?v=1",
  "/cockpit/data-profile.js?v=1",
  "/cockpit/data-forme.js?v=2",
  "/cockpit/data-musique.js?v=1",
  "/cockpit/data-gaming-perso.js?v=1",
  "/cockpit/data-stacks.js?v=1",
  "/cockpit/data-history.js?v=3",
  "/cockpit/icons.jsx?v=3",
  "/cockpit/sidebar.jsx?v=6",
  "/cockpit/home.jsx?v=4",
  "/cockpit/app.jsx?v=22",
  "/cockpit/panel-top.jsx",
  "/cockpit/panel-signals.jsx?v=6",
  "/cockpit/panel-radar.jsx?v=4",
  "/cockpit/panel-week.jsx",
  "/cockpit/panel-search.jsx",
  "/cockpit/panel-veille.jsx?v=7",
  "/cockpit/panel-recos.jsx?v=2",
  "/cockpit/panel-challenges.jsx?v=1",
  "/cockpit/panel-wiki.jsx?v=1",
  "/cockpit/panel-opportunities.jsx?v=1",
  "/cockpit/panel-ideas.jsx?v=1",
  "/cockpit/panel-jarvis.jsx?v=1",
  "/cockpit/panel-profile.jsx?v=1",
  "/cockpit/panel-forme.jsx?v=2",
  "/cockpit/panel-musique.jsx?v=2",
  "/cockpit/panel-gaming.jsx?v=1",
  "/cockpit/panel-stacks.jsx?v=1",
  "/cockpit/panel-history.jsx?v=3",
  "/cockpit/lib/supabase.js?v=1",
  "/cockpit/lib/telemetry.js?v=1",
  "/cockpit/lib/auth.js?v=1",
  "/cockpit/lib/data-loader.js?v=4",
  "/cockpit/lib/bootstrap.js?v=1",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Supabase & external APIs: network-only (never cache stale data).
  if (url.hostname.includes("supabase.co") ||
      url.hostname.includes("trycloudflare.com") ||
      url.hostname.includes("audioscrobbler.com") ||
      url.hostname === "localhost") {
    return; // Let the browser handle it.
  }
  // Static shell & fonts & CDN libs: cache-first, fall back to network.
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        // Don't cache opaque redirects or non-OK responses.
        if (!resp || !resp.ok || resp.type === "opaque") return resp;
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached);
    })
  );
});
