// AI Cockpit service worker
// Cache-first for static shell (cockpit/* + CDN libs pinned by SRI),
// network-first for Supabase/API calls — so the app stays installable
// and fast offline while always preferring fresh data when online.
const CACHE = "cockpit-v150";

const STATIC = [
  "/jarvis-cockpit/",
  "/jarvis-cockpit/assets/icon-cockpit-180.png",
  "/jarvis-cockpit/assets/icon-mediatheque-180.png",
  "/jarvis-cockpit/cockpit/app.jsx?v=34",
  "/jarvis-cockpit/cockpit/command-palette.jsx?v=1",
  "/jarvis-cockpit/cockpit/components-mobile.jsx?v=2",
  "/jarvis-cockpit/cockpit/components-ticket.jsx?v=2",
  "/jarvis-cockpit/cockpit/data-anime.js?v=2",
  "/jarvis-cockpit/cockpit/data-apprentissage.js?v=1",
  "/jarvis-cockpit/cockpit/data-challenges.js?v=1",
  "/jarvis-cockpit/cockpit/data-claude.js?v=1",
  "/jarvis-cockpit/cockpit/data-forme.js?v=2",
  "/jarvis-cockpit/cockpit/data-gaming-perso.js?v=3",
  "/jarvis-cockpit/cockpit/data-gaming.js?v=2",
  "/jarvis-cockpit/cockpit/data-history.js?v=3",
  "/jarvis-cockpit/cockpit/data-ideas.js?v=1",
  "/jarvis-cockpit/cockpit/data-jarvis.js?v=1",
  "/jarvis-cockpit/cockpit/data-mediatheque.js?v=1",
  "/jarvis-cockpit/cockpit/data-musique.js?v=1",
  "/jarvis-cockpit/cockpit/data-news.js?v=3",
  "/jarvis-cockpit/cockpit/data-opportunities.js?v=2",
  "/jarvis-cockpit/cockpit/data-profile.js?v=2",
  "/jarvis-cockpit/cockpit/data-signals.js?v=2",
  "/jarvis-cockpit/cockpit/data-sport.js?v=2",
  "/jarvis-cockpit/cockpit/data-stacks.js?v=1",
  "/jarvis-cockpit/cockpit/data-veille.js?v=2",
  "/jarvis-cockpit/cockpit/data-wiki.js?v=1",
  "/jarvis-cockpit/cockpit/data.js",
  "/jarvis-cockpit/cockpit/home.jsx?v=13",
  "/jarvis-cockpit/cockpit/icons.jsx?v=3",
  "/jarvis-cockpit/cockpit/lib/anilist.js?v=2",
  "/jarvis-cockpit/cockpit/lib/auth.js?v=2",
  "/jarvis-cockpit/cockpit/lib/boot-mediatheque.js?v=4",
  "/jarvis-cockpit/cockpit/lib/bootstrap.js?v=3",
  "/jarvis-cockpit/cockpit/lib/data-loader.js?v=44",
  "/jarvis-cockpit/cockpit/lib/dialog.js?v=1",
  "/jarvis-cockpit/cockpit/lib/games-view.js?v=3",
  "/jarvis-cockpit/cockpit/lib/jobs-view.js?v=1",
  "/jarvis-cockpit/cockpit/lib/mediatheque-view.js?v=3",
  "/jarvis-cockpit/cockpit/lib/mobile-view.js?v=1",
  "/jarvis-cockpit/cockpit/lib/sante-view.js?v=1",
  "/jarvis-cockpit/cockpit/lib/snooze.js?v=1",
  "/jarvis-cockpit/cockpit/lib/supabase.js?v=1",
  "/jarvis-cockpit/cockpit/lib/telemetry.js?v=2",
  "/jarvis-cockpit/cockpit/lib/tmdb.js?v=1",
  "/jarvis-cockpit/cockpit/lib/wiki-tooltip.js?v=2",
  "/jarvis-cockpit/cockpit/nav.js?v=2",
  "/jarvis-cockpit/cockpit/panel-challenges.jsx?v=5",
  "/jarvis-cockpit/cockpit/panel-evening.jsx?v=1",
  "/jarvis-cockpit/cockpit/panel-forme.jsx?v=4",
  "/jarvis-cockpit/cockpit/panel-gaming.jsx?v=21",
  "/jarvis-cockpit/cockpit/panel-history.jsx?v=5",
  "/jarvis-cockpit/cockpit/panel-ideas.jsx?v=7",
  "/jarvis-cockpit/cockpit/panel-jarvis-lab.jsx?v=7",
  "/jarvis-cockpit/cockpit/panel-jarvis.jsx?v=5",
  "/jarvis-cockpit/cockpit/panel-jobs-radar.jsx?v=7",
  "/jarvis-cockpit/cockpit/panel-mediatheque.jsx?v=13",
  "/jarvis-cockpit/cockpit/panel-musique.jsx?v=6",
  "/jarvis-cockpit/cockpit/panel-opportunities.jsx?v=6",
  "/jarvis-cockpit/cockpit/panel-profile.jsx?v=4",
  "/jarvis-cockpit/cockpit/panel-radar.jsx?v=5",
  "/jarvis-cockpit/cockpit/panel-recos.jsx?v=5",
  "/jarvis-cockpit/cockpit/panel-review.jsx?v=1",
  "/jarvis-cockpit/cockpit/panel-sante.jsx?v=1",
  "/jarvis-cockpit/cockpit/panel-search.jsx?v=5",
  "/jarvis-cockpit/cockpit/panel-signals.jsx?v=9",
  "/jarvis-cockpit/cockpit/panel-stacks.jsx?v=3",
  "/jarvis-cockpit/cockpit/panel-top.jsx?v=1",
  "/jarvis-cockpit/cockpit/panel-veille-outils.jsx?v=3",
  "/jarvis-cockpit/cockpit/panel-veille.jsx?v=11",
  "/jarvis-cockpit/cockpit/panel-week.jsx?v=1",
  "/jarvis-cockpit/cockpit/panel-wiki.jsx?v=6",
  "/jarvis-cockpit/cockpit/sidebar.jsx?v=7",
  "/jarvis-cockpit/cockpit/styles-challenges.css?v=5",
  "/jarvis-cockpit/cockpit/styles-evening.css?v=1",
  "/jarvis-cockpit/cockpit/styles-forme.css?v=2",
  "/jarvis-cockpit/cockpit/styles-gaming.css?v=13",
  "/jarvis-cockpit/cockpit/styles-history.css?v=1",
  "/jarvis-cockpit/cockpit/styles-ideas.css?v=2",
  "/jarvis-cockpit/cockpit/styles-jarvis-lab.css?v=11",
  "/jarvis-cockpit/cockpit/styles-jarvis.css?v=7",
  "/jarvis-cockpit/cockpit/styles-jobs-radar.css?v=7",
  "/jarvis-cockpit/cockpit/styles-mediatheque.css?v=9",
  "/jarvis-cockpit/cockpit/styles-mobile.css?v=5",
  "/jarvis-cockpit/cockpit/styles-musique.css?v=2",
  "/jarvis-cockpit/cockpit/styles-opportunities.css?v=5",
  "/jarvis-cockpit/cockpit/styles-profile.css?v=5",
  "/jarvis-cockpit/cockpit/styles-radar.css?v=4",
  "/jarvis-cockpit/cockpit/styles-recos.css?v=4",
  "/jarvis-cockpit/cockpit/styles-sante.css?v=1",
  "/jarvis-cockpit/cockpit/styles-signals.css?v=4",
  "/jarvis-cockpit/cockpit/styles-stacks.css?v=5",
  "/jarvis-cockpit/cockpit/styles-veille-outils.css?v=4",
  "/jarvis-cockpit/cockpit/styles-wiki.css?v=7",
  "/jarvis-cockpit/cockpit/styles.css?v=35",
  "/jarvis-cockpit/cockpit/themes.js?v=2",
  "/jarvis-cockpit/index.html",
  "/jarvis-cockpit/manifest-mediatheque.json",
  "/jarvis-cockpit/manifest.json",
  "/jarvis-cockpit/mediatheque.html",
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
