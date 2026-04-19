// cockpit/lib/data-loader.js
// Replaces cockpit/data-*.js fake corpora with real Supabase data.
// Keeps the exact object SHAPES the React panels consume.
//
// Strategy: two tiers.
//   Tier 1 (blocking, before React mounts): Home needs — articles today,
//     daily_briefs, skill_radar, signal_tracking, user_profile.
//   Tier 2 (lazy, triggered on panel navigation): the rest.
//
// All loaders are memoised — each corpus is only fetched once per session.
(function(){
  const SB = () => window.SUPABASE_URL;
  const q = (t, s) => window.sb.query(t, s);

  const cache = {};
  function once(key, loader){
    if (!(key in cache)) cache[key] = loader();
    return cache[key];
  }

  // ── Helpers ──────────────────────────────────────────────
  function isoToday(){ return new Date().toISOString().split("T")[0]; }
  function isoWeek(d){
    const date = new Date(d.valueOf());
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const wk1 = new Date(date.getFullYear(), 0, 4);
    return Math.round(((date - wk1) / 86400000 - 3 + ((wk1.getDay() + 6) % 7)) / 7) + 1;
  }
  function dayOfYear(d){
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }
  function relTime(iso){
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.round(diff / 3600000);
    if (h < 1) return "à l'instant";
    if (h < 24) return "il y a " + h + "h";
    const d = Math.round(h / 24);
    if (d < 7) return "il y a " + d + "j";
    return "il y a " + Math.round(d / 7) + "sem";
  }
  function stripHtml(s){
    if (!s) return "";
    const d = document.createElement("div");
    d.innerHTML = String(s);
    return (d.textContent || d.innerText || "").replace(/\s+/g, " ").trim();
  }
  function getReadMap(){
    try { return JSON.parse(localStorage.getItem("read-articles") || "{}"); } catch { return {}; }
  }
  function computeStreak(){
    const rm = getReadMap();
    const days = new Set();
    Object.values(rm).forEach(v => {
      const t = typeof v === "number" ? v : (v && v.ts ? v.ts : null);
      if (!t) return;
      days.add(new Date(t).toISOString().split("T")[0]);
    });
    if (!days.size) return 0;
    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 400; i++){
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (days.has(d.toISOString().split("T")[0])) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  // ── Tier 1 loaders ───────────────────────────────────────
  async function loadArticlesToday(){
    const date = isoToday();
    return q("articles", `fetch_date=eq.${date}&order=date_fetched.desc&limit=100`);
  }
  async function loadDailyBrief(){
    const rows = await q("daily_briefs", "order=created_at.desc&limit=1");
    return rows[0] || null;
  }
  async function loadSignals(){
    return q("signal_tracking", "order=mention_count.desc&limit=60");
  }
  async function loadRadar(){
    return q("skill_radar", "order=axis");
  }
  async function loadUserProfile(){
    return q("user_profile", "order=key");
  }
  async function loadWeeklyAnalysis(limit){
    return q("weekly_analysis", `order=week_start.desc&limit=${limit || 4}`);
  }

  // Articles for the past N days — used by Brief stats + Week panel
  async function loadRecentArticles(days){
    const d = new Date(); d.setDate(d.getDate() - (days || 7));
    const from = d.toISOString().split("T")[0];
    return q("articles", `fetch_date=gte.${from}&order=fetch_date.desc&limit=400`);
  }

  // ── Shape builders ───────────────────────────────────────
  function buildDateShape(){
    const now = new Date();
    const long = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return {
      long: long.charAt(0).toUpperCase() + long.slice(1),
      iso: isoToday(),
      week: "S" + String(isoWeek(now)).padStart(2, "0"),
      day_of_year: "J+" + dayOfYear(now),
    };
  }

  function buildStats(articles, signals){
    const rm = getReadMap();
    const unread = articles.filter(a => !rm[a.id]).length;
    const rising = (signals || []).filter(s => s.trend === "rising" || s.trend === "new").length;
    const now = new Date();
    const beforeBrief = now.getUTCHours() < 6;
    return {
      articles_today: articles.length,
      signals_rising: rising,
      unread,
      streak: computeStreak(),
      next_brief: beforeBrief ? "aujourd'hui 06:00" : "demain 06:00",
      cost_month: null,        // filled by Tier 2 loadCost() if needed
      cost_budget: "3 €",
      cost_history_7d: [],     // filled by Tier 2
    };
  }

  function buildMacro(articles, brief){
    if (!articles.length && !brief) {
      return {
        kicker: "Synthèse du matin",
        title: "Pas encore de brief aujourd'hui",
        body: "Le pipeline quotidien tourne à 06:00 UTC. Reviens dans quelques heures — ou consulte l'historique.",
        reading_time: "—",
        articles_summarized: 0,
      };
    }
    const top = articles[0];
    const title = brief?.title || top?.title || "Brief du jour";
    const body = stripHtml(brief?.summary || brief?.body_html || top?.summary || "").slice(0, 420);
    return {
      kicker: "Synthèse du matin",
      title,
      body,
      reading_time: Math.max(1, Math.round(articles.length * 1.5)) + " min",
      articles_summarized: articles.length,
    };
  }

  function buildTop(articles){
    const rm = getReadMap();
    return articles.slice(0, 3).map((a, i) => ({
      rank: i + 1,
      source: a.source || "—",
      section: (a.section || "").toUpperCase(),
      date: relTime(a.date_published),
      score: Math.max(60, 94 - i * 6),
      title: a.title || "",
      summary: stripHtml(a.summary || "").slice(0, 280),
      tags: (a.tags || []).slice(0, 3).map(t => "#" + String(t).replace(/^#/, "")),
      related: [],
      unread: !rm[a.id],
      _id: a.id,
      _url: a.url,
    }));
  }

  function buildSignals(rows){
    // Dedupe by term (keep latest week_start)
    const byTerm = {};
    (rows || []).forEach(s => {
      if (!byTerm[s.term] || (byTerm[s.term].week_start || "") < (s.week_start || "")) byTerm[s.term] = s;
    });
    return Object.values(byTerm).slice(0, 20).map(s => {
      const hist = Array.isArray(s.history) ? s.history
        : typeof s.history === "string" ? (JSON.parse(s.history || "[]")) : [s.mention_count || 0];
      return {
        name: s.term,
        count: s.mention_count || 0,
        delta: s.delta != null ? s.delta : (hist.length > 1 ? hist[hist.length - 1] - hist[hist.length - 2] : 0),
        trend: s.trend || "stable",
        history: hist.length ? hist : [0,0,0,0,0,0,0, s.mention_count || 0],
        category: s.category || "Autres",
        context: s.context || "",
      };
    });
  }

  function buildRadar(rows){
    if (!rows || !rows.length) return { axes: [], next_gap: null };
    const norm = r => {
      const s = Number(r.score || 0);
      return s <= 10 ? s * 10 : Math.min(100, s);
    };
    const axes = rows.map(r => ({
      id: r.axis,
      name: r.axis_label || r.axis,
      score: Math.round(norm(r)),
      gap: norm(r) < 50,
      target: Number(r.target || 85),
      delta_30d: 0,
      axis: r.axis,
      axis_label: r.axis_label || r.axis,
      strengths: r.strengths || "",
      gaps: r.gaps || "",
      level: norm(r) >= 75 ? "Avancé" : norm(r) >= 50 ? "Intermédiaire" : "Débutant",
      note: r.gaps || r.strengths || "",
    }));
    const lowest = axes.slice().sort((a, b) => a.score - b.score)[0];
    return {
      axes,
      next_gap: lowest ? {
        axis: lowest.name,
        reason: lowest.gaps || `Score bloqué à ${lowest.score}/100. C'est ton plus gros delta avec l'expert — prochain pas recommandé.`,
        action: "Faire un challenge de la semaine",
      } : null,
      summary: {
        avg: Math.round(axes.reduce((s, a) => s + a.score, 0) / Math.max(1, axes.length)),
        strongest: axes.slice().sort((a, b) => b.score - a.score)[0]?.id,
        weakest: lowest?.id,
        level_global: "Intermédiaire +",
        position_peers: "Top 12% de ton réseau pro",
      },
    };
  }

  function buildWeek(recentArticles){
    const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    const today = new Date(); today.setHours(0,0,0,0);
    const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const counts = new Array(7).fill(0);
    const byDay = Array.from({length: 7}, () => []);
    (recentArticles || []).forEach(a => {
      if (!a.fetch_date) return;
      const d = new Date(a.fetch_date);
      const diff = Math.round((d - mon) / 86400000);
      if (diff >= 0 && diff < 7) {
        counts[diff]++;
        byDay[diff].push(a);
      }
    });
    const rm = getReadMap();
    const total_read = (recentArticles || []).filter(a => rm[a.id]).length;
    return {
      days: days.map((d, i) => ({
        day: d,
        read: counts[i],
        bars: counts[i],
        workout: 0,
        music_min: 0,
        gaming_min: 0,
        notes: 0,
      })),
      total_read,
      total_marked: total_read,
      streak: computeStreak(),
      reading_time_min: total_read * 3,
      ai_summary: [],
      themes: [],
      top_read: (recentArticles || []).filter(a => rm[a.id]).slice(0, 4).map(a => ({
        title: a.title || "",
        source: a.source || "—",
        day: days[(new Date(a.fetch_date).getDay() + 6) % 7],
        time_min: Math.max(2, Math.round((a.title?.length || 120) / 30)),
      })),
      personal: {
        workouts: { done: 0, target: 3, label: "Séances sport" },
        music: { total_min: 0, top_artist: "—", sessions: 0 },
        gaming: { total_min: 0, top_game: "—" },
        sleep_avg_h: 0,
        notes_count: 0,
      },
      compare_last: {
        read: { this: total_read, last: 0 },
        signals_spotted: { this: 0, last: 0 },
        workouts: { this: 0, last: 0 },
        notes: { this: 0, last: 0 },
      },
    };
  }

  function buildUser(profileRows){
    const kv = {};
    (profileRows || []).forEach(r => { if (r.key) kv[r.key] = r.value; });
    return {
      name: kv.name || "Jean",
      role: kv.role || "RTE · Train Vente · Malakoff Humanis",
      greeting_morning: "Bonjour " + (kv.name || "Jean"),
      greeting_afternoon: "Bon retour " + (kv.name || "Jean"),
    };
  }

  // Nav (matches design's COCKPIT_DATA.nav exactly, minus dropped panels
  // per migration decisions: no rte/tft/jarvis-project/costs).
  const NAV = [
    { group: "Aujourd'hui", items: [
      { id: "brief", label: "Brief du jour", icon: "sun" },
      { id: "top", label: "Top du jour", icon: "star" },
      { id: "week", label: "Ma semaine", icon: "calendar" },
      { id: "search", label: "Recherche", icon: "search" },
    ]},
    { group: "Veille", items: [
      { id: "updates", label: "Veille IA", icon: "sparkles" },
      { id: "sport", label: "Sport", icon: "flag" },
      { id: "gaming_news", label: "Gaming", icon: "wrench" },
      { id: "anime", label: "Anime / Ciné / Séries", icon: "star" },
      { id: "news", label: "Actualités", icon: "paper" },
    ]},
    { group: "Apprentissage", items: [
      { id: "radar", label: "Radar compétences", icon: "target" },
      { id: "recos", label: "Recommandations", icon: "bookmark" },
      { id: "challenges", label: "Challenges", icon: "trophy" },
      { id: "wiki", label: "Wiki IA", icon: "book" },
      { id: "signals", label: "Signaux faibles", icon: "wave" },
    ]},
    { group: "Business", items: [
      { id: "opps", label: "Opportunités", icon: "lightbulb" },
      { id: "ideas", label: "Carnet d'idées", icon: "notebook" },
    ]},
    { group: "Personnel", items: [
      { id: "jarvis", label: "Jarvis", icon: "assistant" },
      { id: "profile", label: "Mon profil", icon: "user" },
      { id: "perf", label: "Forme", icon: "activity" },
      { id: "music", label: "Musique", icon: "music" },
      { id: "gaming", label: "Gaming", icon: "gamepad" },
    ]},
    { group: "Système", items: [
      { id: "stacks", label: "Stacks & Limits", icon: "wallet" },
      { id: "history", label: "Historique", icon: "clock" },
    ]},
  ];

  // ── Tier 1 boot — runs BEFORE <App/> mounts ──────────────
  async function bootTier1(){
    const [articlesToday, brief, signals, radarRows, profileRows, recent, weeklyAnalysis] = await Promise.all([
      once("articles_today", loadArticlesToday).catch(() => []),
      once("daily_brief", loadDailyBrief).catch(() => null),
      once("signals", loadSignals).catch(() => []),
      once("radar", loadRadar).catch(() => []),
      once("user_profile", loadUserProfile).catch(() => []),
      once("recent_articles", () => loadRecentArticles(30)).catch(() => []),
      once("weekly_analysis", () => loadWeeklyAnalysis(8)).catch(() => []),
    ]);

    const stats = buildStats(articlesToday, signals);
    // Cost history (last 8 weeks) — best effort
    try {
      const hist = (weeklyAnalysis || []).slice(0, 7).map(r => Number(r.cost_eur || 0)).reverse();
      stats.cost_history_7d = hist;
      const now = new Date();
      const monthKey = now.toISOString().slice(0, 7);
      const monthCost = (weeklyAnalysis || [])
        .filter(r => (r.created_at || r.week_start || "").slice(0, 7) === monthKey)
        .reduce((s, r) => s + Number(r.cost_eur || 0), 0);
      stats.cost_month = monthCost.toFixed(2).replace(".", ",") + " €";
    } catch {}

    const data = {
      user: buildUser(profileRows),
      date: buildDateShape(),
      stats,
      macro: buildMacro(articlesToday, brief),
      top: buildTop(articlesToday),
      signals: buildSignals(signals),
      nav: NAV,
      radar: buildRadar(radarRows),
      week: buildWeek(recent),
      recos: [],       // Tier 2
      challenges: [],  // Tier 2
    };

    // Expose raw tables for tier-2 loaders that may want them
    window.__COCKPIT_RAW = {
      articlesToday, brief, signals, radarRows, profileRows, recent, weeklyAnalysis,
    };

    // Shape exposed as window.COCKPIT_DATA — panels read from it directly.
    window.COCKPIT_DATA = data;
    return data;
  }

  // ── Tier 2 loaders — lazy, per panel ─────────────────────
  const T2 = {
    async veille(){ return once("veille_articles", () => loadRecentArticles(30)); },
    async wiki(){ return once("wiki_concepts", () => q("wiki_concepts", "order=mention_count.desc&limit=200")); },
    async recos(){ return once("recos", () => q("learning_recommendations", "order=week_start.desc,target_axis&limit=30")); },
    async challenges(){ return once("challenges", () => q("weekly_challenges", "order=week_start.desc&limit=20")); },
    async opps(){ return once("opps", () => q("weekly_opportunities", "order=week_start.desc&limit=40")); },
    async ideas(){ return once("ideas", () => q("business_ideas", "order=created_at.desc&limit=100")); },
    async strava(){ return once("strava", () => q("strava_activities", "order=start_date.desc&limit=300")); },
    async music_scrobbles(){ return once("music_scrobbles", () => q("music_scrobbles", "order=scrobbled_at.desc&limit=200")); },
    async music_stats(){ return once("music_stats", () => q("music_stats_daily", "order=stat_date.desc&limit=90")); },
    async music_top(){ return once("music_top", () => q("music_top_weekly", "order=week_start.desc&limit=120")); },
    async music_loved(){ return once("music_loved", () => q("music_loved_tracks", "order=loved_at.desc&limit=40")); },
    async music_genres(){ return once("music_genres", () => q("music_genre_weekly", "order=week_start.desc&limit=120")); },
    async music_insights(){ return once("music_insights", () => q("music_insights_weekly", "order=week_start.desc&limit=12")); },
    async steam_snapshot(){
      const today = isoToday();
      return once("steam_snapshot_" + today, () => q("steam_games_snapshot", `snapshot_date=eq.${today}&order=playtime_2weeks_minutes.desc&limit=500`));
    },
    async steam_stats(){ return once("steam_stats", () => q("gaming_stats_daily", "order=stat_date.desc&limit=90")); },
    async steam_achievements(){ return once("steam_achievements", () => q("steam_achievements", "order=unlocked_at.desc&limit=50")); },
    async weekly_analysis(){ return once("weekly_analysis_all", () => loadWeeklyAnalysis(30)); },
  };

  // Lazy panel data — returns the raw rows so panels can reshape as needed.
  async function loadPanel(id){
    switch (id) {
      case "updates":
      case "sport":
      case "gaming_news":
      case "anime":
      case "news":
        return { articles: await T2.veille() };
      case "wiki":
        return { concepts: await T2.wiki() };
      case "recos":
        return { recos: await T2.recos() };
      case "challenges":
        return { challenges: await T2.challenges() };
      case "opps":
        return { opportunities: await T2.opps() };
      case "ideas":
        return { ideas: await T2.ideas() };
      case "perf":
        return { activities: await T2.strava() };
      case "music":
        return {
          scrobbles: await T2.music_scrobbles(),
          stats: await T2.music_stats(),
          top: await T2.music_top(),
          loved: await T2.music_loved(),
          genres: await T2.music_genres(),
          insights: await T2.music_insights(),
        };
      case "gaming":
        return {
          snapshot: await T2.steam_snapshot(),
          stats: await T2.steam_stats(),
          achievements: await T2.steam_achievements(),
        };
      case "stacks":
        return { weekly_analysis: await T2.weekly_analysis() };
      case "history":
        return { recent: await T2.veille() };
      default:
        return {};
    }
  }

  window.cockpitDataLoader = {
    bootTier1,
    loadPanel,
    T2,
    cache,
    // shape builders re-exported for panels that want to rebuild parts live
    buildSignals, buildRadar, buildTop, buildMacro, buildWeek, buildStats, buildDateShape, buildUser,
    // helpers
    isoWeek, dayOfYear, relTime, stripHtml, getReadMap, computeStreak,
  };
})();
