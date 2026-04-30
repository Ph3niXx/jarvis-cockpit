// AI Cockpit service worker
// Cache-first for static shell (cockpit/* + CDN libs pinned by SRI),
// network-first for Supabase/API calls — so the app stays installable
// and fast offline while always preferring fresh data when online.
const CACHE = "cockpit-v30";

const STATIC = [
  "/",
  "/cockpit/app.jsx?v=30",
  "/cockpit/command-palette.jsx?v=1",
  "/cockpit/components-ticket.jsx?v=2",
  "/cockpit/data-anime.js?v=2",
  "/cockpit/data-apprentissage.js?v=1",
  "/cockpit/data-challenges.js?v=1",
  "/cockpit/data-claude.js?v=1",
  "/cockpit/data-forme.js?v=2",
  "/cockpit/data-gaming-perso.js?v=2",
  "/cockpit/data-gaming.js?v=2",
  "/cockpit/data-history.js?v=3",
  "/cockpit/data-ideas.js?v=1",
  "/cockpit/data-jarvis.js?v=1",
  "/cockpit/data-musique.js?v=1",
  "/cockpit/data-news.js?v=3",
  "/cockpit/data-opportunities.js?v=2",
  "/cockpit/data-profile.js?v=1",
  "/cockpit/data-signals.js?v=2",
  "/cockpit/data-sport.js?v=2",
  "/cockpit/data-stacks.js?v=1",
  "/cockpit/data-veille.js?v=2",
  "/cockpit/data-wiki.js?v=1",
  "/cockpit/data.js",
  "/cockpit/home.jsx?v=4",
  "/cockpit/icons.jsx?v=3",
  "/cockpit/lib/auth.js?v=1",
  "/cockpit/lib/bootstrap.js?v=2",
  "/cockpit/lib/data-loader.js?v=35",
  "/cockpit/lib/snooze.js?v=1",
  "/cockpit/lib/supabase.js?v=1",
  "/cockpit/lib/telemetry.js?v=1",
  "/cockpit/lib/wiki-tooltip.js?v=2",
  "/cockpit/nav.js?v=2",
  "/cockpit/panel-challenges.jsx?v=5",
  "/cockpit/panel-evening.jsx?v=1",
  "/cockpit/panel-forme.jsx?v=4",
  "/cockpit/panel-gaming.jsx?v=5",
  "/cockpit/panel-history.jsx?v=3",
  "/cockpit/panel-ideas.jsx?v=4",
  "/cockpit/panel-jarvis-lab.jsx?v=7",
  "/cockpit/panel-jarvis.jsx?v=3",
  "/cockpit/panel-jobs-radar.jsx?v=3",
  "/cockpit/panel-musique.jsx?v=4",
  "/cockpit/panel-opportunities.jsx?v=4",
  "/cockpit/panel-profile.jsx?v=2",
  "/cockpit/panel-radar.jsx?v=5",
  "/cockpit/panel-recos.jsx?v=4",
  "/cockpit/panel-review.jsx?v=1",
  "/cockpit/panel-search.jsx?v=3",
  "/cockpit/panel-signals.jsx?v=8",
  "/cockpit/panel-stacks.jsx?v=2",
  "/cockpit/panel-top.jsx",
  "/cockpit/panel-veille-outils.jsx?v=2",
  "/cockpit/panel-veille.jsx?v=10",
  "/cockpit/panel-week.jsx",
  "/cockpit/panel-wiki.jsx?v=4",
  "/cockpit/sidebar.jsx?v=6",
  "/cockpit/styles-challenges.css?v=3",
  "/cockpit/styles-evening.css?v=1",
  "/cockpit/styles-forme.css?v=2",
  "/cockpit/styles-gaming.css?v=5",
  "/cockpit/styles-history.css?v=1",
  "/cockpit/styles-ideas.css?v=1",
  "/cockpit/styles-jarvis-lab.css?v=7",
  "/cockpit/styles-jarvis.css?v=5",
  "/cockpit/styles-jobs-radar.css?v=3",
  "/cockpit/styles-mobile.css?v=1",
  "/cockpit/styles-musique.css?v=1",
  "/cockpit/styles-opportunities.css?v=3",
  "/cockpit/styles-profile.css?v=4",
  "/cockpit/styles-radar.css?v=3",
  "/cockpit/styles-recos.css?v=2",
  "/cockpit/styles-signals.css?v=4",
  "/cockpit/styles-stacks.css?v=2",
  "/cockpit/styles-veille-outils.css?v=2",
  "/cockpit/styles-wiki.css?v=5",
  "/cockpit/styles.css?v=24",
  "/cockpit/themes.js?v=2",
  "/index.html",
  "/manifest.json",
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
