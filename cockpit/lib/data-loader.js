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
    // daily_briefs columns: date, brief_html, article_count, created_at
    const rows = await q("daily_briefs", "order=date.desc&limit=1");
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
    // daily_briefs has one column brief_html (Gemini-generated). Derive
    // title from its <h1>/<h2> if present, else fall back on the top
    // article title; body is the first paragraph-ish chunk.
    const html = brief?.brief_html || "";
    let briefTitle = null, briefBody = null;
    if (html) {
      const titleMatch = html.match(/<(?:h1|h2)[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i);
      if (titleMatch) briefTitle = stripHtml(titleMatch[1]).trim();
      const paraMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (paraMatch) briefBody = stripHtml(paraMatch[1]).trim();
      // Fallback: strip all HTML and take first 420 chars
      if (!briefBody) briefBody = stripHtml(html).slice(0, 420);
    }
    const title = briefTitle || top?.title || "Brief du jour";
    const body = (briefBody || stripHtml(top?.summary || "")).slice(0, 420);
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
    const EMPTY_GAP = {
      axis: "Radar à initialiser",
      reason: "Fais le diagnostic radar pour identifier ton prochain gap à combler.",
      action: "Ouvrir le radar",
    };
    if (!rows || !rows.length) {
      return {
        axes: [],
        next_gap: EMPTY_GAP,
        summary: { avg: 0, strongest: null, weakest: null, level_global: "—", position_peers: "—" },
      };
    }
    const norm = r => {
      const s = Number(r.score || 0);
      return s <= 10 ? s * 10 : Math.min(100, s);
    };
    const axes = rows.map(r => {
      const label = r.axis_label || r.axis;
      return {
        id: r.axis,
        // Keep BOTH name and label — home.jsx/RadarSVG reads .name,
        // panel-radar.jsx reads .label. Same value, both aliases.
        name: label,
        label: label,
        score: Math.round(norm(r)),
        gap: norm(r) < 50,
        target: Number(r.target || 85),
        delta_30d: 0,
        axis: r.axis,
        axis_label: label,
        strengths: r.strengths || "",
        gaps: r.gaps || "",
        level: norm(r) >= 75 ? "Avancé" : norm(r) >= 50 ? "Intermédiaire" : "Débutant",
        note: r.gaps || r.strengths || "",
      };
    });
    const lowest = axes.slice().sort((a, b) => a.score - b.score)[0];
    return {
      axes,
      next_gap: lowest ? {
        axis: lowest.name,
        reason: lowest.gaps || `Score bloqué à ${lowest.score}/100. C'est ton plus gros delta avec l'expert — prochain pas recommandé.`,
        action: "Faire un challenge de la semaine",
      } : EMPTY_GAP,
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
      { id: "jobs", label: "Jobs Radar", icon: "target" },
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
    async jobs_all(){ return once("jobs_all", () => q("jobs", "select=*&order=score_total.desc.nullslast&limit=300")); },
    async jobs_scan_today(){
      const today = isoToday();
      return once("jobs_scan_" + today, async () => {
        const rows = await q("job_scans", `scan_date=eq.${today}&select=*`);
        return rows[0] || null;
      });
    },
    async jobs_scans_7d(){
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return once("jobs_scans_7d", () => q("job_scans", `scan_date=gte.${from}&select=*&order=scan_date.desc&limit=14`));
    },
  };

  // ── Tier 2 transformers — rebuild window.*_DATA globals ──
  // Each transformer MERGES real data over the fake shape so the panel
  // never loses the fields its JSX depends on.
  function patchObject(target, partial){
    if (!target || typeof target !== "object") return partial;
    Object.assign(target, partial);
    return target;
  }

  function transformRecos(rows, axes){
    return (rows || []).map((r, i) => {
      const axisId = r.target_axis || r.axis || "prompting";
      const ax = (axes || []).find(a => (a.axis || a.id) === axisId);
      const duration_min = r.duration_min || (r.resource_type === "course" ? 240 : r.resource_type === "video" ? 45 : r.resource_type === "paper" ? 30 : 15);
      const lvl = (r.difficulty || r.level || "intermediate").toLowerCase();
      const level = lvl.startsWith("avance") || lvl === "advanced" ? "Avancé" : lvl.startsWith("debu") || lvl === "beginner" ? "Débutant" : "Intermédiaire";
      const why = r.why || r.description || "";
      return {
        id: r.id || ("r" + i),
        type: r.resource_type || r.type || "article",
        priority: r.priority || (ax && Number(ax.score || 0) < 50 ? "must" : ax && Number(ax.score || 0) < 70 ? "should" : "nice"),
        title: r.title || "",
        source: r.source || r.resource_source || "—",
        date_label: r.date_label || relTime(r.created_at) || "—",
        date_h: r.date_h || 6,
        duration_min,
        level,
        axis: axisId,
        axis_label: ax ? (ax.axis_label || ax.label || axisId) : axisId,
        why,
        why_short: r.why_short || (why ? stripHtml(why).slice(0, 120) : ""),
        xp: r.xp || Math.max(40, Math.min(200, duration_min * 3)),
        tags: r.tags || [],
        unread: !r.completed,
        momentum: r.momentum || "standard",
        url: r.resource_url || r.url || null,
      };
    });
  }

  function transformChallenges(rows){
    return (rows || []).map((c, i) => ({
      id: c.id || ("c" + i),
      status: c.status === "completed" ? "done" : (c.status === "open" ? "open" : "recommended"),
      title: c.title || "",
      description: c.description || "",
      axis: c.target_axis || "prompting",
      axis_label: c.target_axis || "Défi",
      difficulty: c.difficulty || "Intermédiaire",
      duration: c.duration || "~1h",
      xp: c.score_reward || 100,
      score_percent: c.score_percent || null,
      questions: c.questions || [],
    }));
  }

  function transformWiki(rows){
    const entries = (rows || []).map(c => ({
      id: c.slug || c.id,
      slug: c.slug,
      title: c.name || c.slug,
      category: c.category || "Autres",
      kind: c.source && c.source.includes("perso") ? "perso" : "auto",
      pinned: false,
      tags: c.tags || [],
      excerpt: stripHtml(c.summary_beginner || c.summary_intermediate || "").slice(0, 180),
      updated: relTime(c.last_mentioned || c.updated_at),
      read_count: c.mention_count || 0,
      content_md: c.summary_intermediate || c.summary_beginner || "",
    }));
    const auto = entries.filter(e => e.kind === "auto").length;
    const perso = entries.length - auto;
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const updated_this_week = (rows || []).filter(c => {
      const d = new Date(c.last_mentioned || c.updated_at || 0).getTime();
      return d && d >= weekAgo;
    }).length;
    return {
      entries,
      stats: { total: entries.length, auto, perso, updated_this_week },
    };
  }

  function transformOpportunities(rows){
    return (rows || []).map((o, i) => ({
      id: o.id || ("o" + i),
      title: o.usecase_title || o.title || "",
      description: o.description || "",
      scope: o.scope || "business",
      urgency: o.urgency || "right_time",
      effort: o.effort || "1m",
      competition: o.competition || "med",
      window: o.closes_at ? { closes_iso: o.closes_at, closes_in: relTime(o.closes_at) } : null,
      followed: !!o.followed,
      actor: o.source_actor || null,
      next_step: o.next_step || "",
      score: o.score || 0,
      sources: o.sources || [],
    }));
  }

  function transformIdeas(rows){
    return (rows || []).map((i, idx) => ({
      id: i.id || ("idea" + idx),
      title: i.title || "",
      description: i.description || "",
      stage: i.stage || "seed",
      category: i.sector || i.category || "business",
      captured_at: i.created_at || new Date().toISOString(),
      signals: i.signals || [],
      notes: i.notes || "",
    }));
  }

  function transformProfile(rows){
    const kv = {};
    (rows || []).forEach(r => { if (r.key) kv[r.key] = r.value; });
    return kv;
  }

  // ── Jobs Radar transforms ────────────────────────────────
  function daysSinceDate(dateStr){
    if (!dateStr) return 0;
    const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.max(0, Math.round((today - d) / 86400000));
  }

  function transformJobRubric(rubric){
    if (!rubric) return [];
    if (Array.isArray(rubric)) return rubric;
    return [
      { axis: "Séniorité", text: rubric.seniority || "" },
      { axis: "Secteur",   text: rubric.sector    || "" },
      { axis: "Impact",    text: rubric.impact    || "" },
    ].filter(r => r.text);
  }

  function transformJobIntel(intel){
    if (!intel || typeof intel !== "object") return null;
    // Accept both the Supabase shape (signaux_boite / lead_identifie /
    // reseau_warm / angle_approche / maturite_safe) and the panel shape
    // (company_signals / lead / warm_network / angle / safe_maturity) —
    // so mock data keeps working.
    const signals = intel.company_signals || intel.signaux_boite || [];
    const leadSrc = intel.lead || intel.lead_identifie;
    const lead = leadSrc ? {
      name:     leadSrc.name  || "",
      role:     leadSrc.role  || leadSrc.title || "",
      linkedin: leadSrc.linkedin || leadSrc.linkedin_url || "",
      notes:    leadSrc.notes || leadSrc.background || "",
    } : null;
    const warmSrc = intel.warm_network || intel.reseau_warm || [];
    const warm_network = warmSrc.map(w => ({
      name:     w.name || "",
      degree:   Number(w.degree) === 1 ? 1 : 2,
      relation: w.relation || [w.current_title, w.context].filter(Boolean).join(" — "),
    }));
    const safe = intel.safe_maturity || intel.maturite_safe || null;
    return {
      company_signals: signals,
      lead,
      warm_network,
      safe_maturity: typeof safe === "string" ? safe : (safe ? JSON.stringify(safe) : null),
      angle: intel.angle || intel.angle_approche || "",
    };
  }

  function transformJobRow(row){
    return {
      id: row.id,
      title: row.title || "",
      company: row.company || "",
      url: row.url || "",
      posted_days_ago: daysSinceDate(row.posted_date || row.first_seen_date),
      role_category: row.role_category || "produit",
      company_stage: row.company_stage || "C",
      pitch: row.pitch || "",
      compensation: row.compensation || "",
      score_total: Number(row.score_total) || 0,
      score_seniority: Number(row.score_seniority) || 0,
      score_sector: Number(row.score_sector) || 0,
      score_impact: Number(row.score_impact) || 0,
      score_bonus: Number(row.score_bonus) || 0,
      rubric_justif: transformJobRubric(row.rubric_justif),
      cv_recommended: row.cv_recommended || "pdf",
      cv_reason: row.cv_reason || "",
      intel: transformJobIntel(row.intel),
      intel_depth: row.intel_depth || "none",
      status: row.status || "new",
      first_seen_date: row.first_seen_date,
      last_seen_date: row.last_seen_date,
      user_notes: row.user_notes || "",
    };
  }

  function transformJobScan(todayScan, last7Scans, allJobs){
    const MONTHS_FR_SCAN = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    const DAYS_FR_SCAN   = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
    const today = new Date();
    // 7-day volumes Mon→Sun for the current ISO week
    const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
    const monday = new Date(today); monday.setHours(0,0,0,0);
    monday.setDate(today.getDate() - dayOfWeek);
    const byDate = {};
    (last7Scans || []).forEach(s => { if (s.scan_date) byDate[s.scan_date] = s; });
    const volumes_7d = [];
    for (let i = 0; i < 7; i++){
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      volumes_7d.push(Number(byDate[iso]?.processed_count || 0));
    }

    // Category ratios from active jobs (new + to_apply + applied)
    const activeJobs = (allJobs || []).filter(j => j.status !== "archived" && j.status !== "snoozed");
    const totalActive = activeJobs.length || 1;
    const CAT_DEF = [
      { id: "produit", label: "Produit" },
      { id: "rte",     label: "RTE" },
      { id: "pgm",     label: "PgM" },
      { id: "pjm",     label: "PjM" },
      { id: "cos",     label: "CoS" },
    ];
    const ratios_category = CAT_DEF.map(c => {
      const count = activeJobs.filter(j => (j.role_category || "").toLowerCase() === c.id).length;
      return { id: c.id, label: c.label, pct: Math.round(count / totalActive * 100) };
    });

    // CV signal — PDF/DOCX ratio on last 30 days of jobs
    const thirty = Date.now() - 30 * 86400000;
    const recent = (allJobs || []).filter(j => j.first_seen_date && new Date(j.first_seen_date + "T00:00:00").getTime() >= thirty);
    const pdfCount  = recent.filter(j => j.cv_recommended === "pdf").length;
    const docxCount = recent.filter(j => j.cv_recommended === "docx").length;
    const sumCv = pdfCount + docxCount || 1;
    const pdf_pct  = Math.round(pdfCount  / sumCv * 100);
    const docx_pct = 100 - pdf_pct;
    const signalCvFromScan = todayScan && todayScan.signal_cv && typeof todayScan.signal_cv === "object" ? todayScan.signal_cv : null;

    // Date label in French
    const dLabel = `${DAYS_FR_SCAN[today.getDay()]} ${today.getDate()} ${MONTHS_FR_SCAN[today.getMonth()]}`;

    // Actions — fall back to a computed reminder when the scan doesn't carry any
    let actions = (todayScan && Array.isArray(todayScan.actions)) ? todayScan.actions : [];
    if (!actions.length) {
      const staleApplied = (allJobs || []).filter(j => j.status === "applied" && daysSinceDate(j.last_seen_date) >= 10).slice(0, 2);
      actions = staleApplied.map(j => ({
        id: "relance-" + j.id,
        kind: "apply",
        label: `Relancer ${j.company} — ${j.title} (candidaté il y a ${daysSinceDate(j.last_seen_date)}j)`,
        cta: "Relancer",
      }));
    }

    return {
      date_label: dLabel.charAt(0).toUpperCase() + dLabel.slice(1),
      raw_count: Number(todayScan?.raw_count || 0),
      processed_count: Number(todayScan?.processed_count || activeJobs.length),
      hot_leads_count: Number(todayScan?.hot_leads_count || activeJobs.filter(j => Number(j.score_total) >= 7).length),
      tendances: {
        volumes_7d,
        ratios_category,
      },
      signal_cv: signalCvFromScan ? {
        pdf_pct:  Number(signalCvFromScan.pdf_pct  ?? pdf_pct),
        docx_pct: Number(signalCvFromScan.docx_pct ?? docx_pct),
        window_days: Number(signalCvFromScan.window_days ?? 30),
        insight: signalCvFromScan.insight || (pdfCount >= docxCount ? "Les offres récentes recommandent majoritairement le PDF." : "Le DOCX reste dominant sur la période — garde les deux versions à jour."),
      } : {
        pdf_pct, docx_pct, window_days: 30,
        insight: sumCv <= 1
          ? "Pas encore assez d'offres pour tirer un signal CV."
          : (pdfCount >= docxCount ? "Les offres récentes recommandent majoritairement le PDF." : "Le DOCX reste dominant sur la période."),
      },
      actions,
    };
  }

  // Build VEILLE_DATA.feed from real articles. Keeps headline/actors/
  // prod_cases/trends from the fake (AI-curated content, no backend
  // pipeline yet). Feed is the main list users scan, so it MUST be real.
  const SECTION_TO_TYPE = {
    updates: "Release", llm: "Release", agents: "Framework",
    energy: "Analyse", finserv: "Deal", tools: "Framework",
    biz: "Analyse", reg: "Régulation", papers: "Papier",
  };
  const SECTION_TO_ICON = {
    updates: "sparkles", llm: "sparkles", agents: "bot",
    energy: "sparkles", finserv: "bank", tools: "wrench",
    biz: "sparkles", reg: "scale", papers: "book",
  };
  function transformVeilleFeed(articles){
    const readMap = getReadMap();
    return (articles || []).map(a => {
      const dateH = Math.max(0, Math.round((Date.now() - new Date(a.date_published || a.date_fetched || Date.now()).getTime()) / 3600000));
      return {
        id: a.id,
        actor: a.source || "—",
        type: SECTION_TO_TYPE[a.section] || "Analyse",
        date_h: dateH,
        date_label: relTime(a.date_published || a.date_fetched),
        title: a.title || "",
        summary: stripHtml(a.summary || "").slice(0, 260),
        tags: (a.tags || []).map(t => "#" + String(t).replace(/^#/, "")),
        unread: !readMap[a.id],
        starred: false,
        icon: SECTION_TO_ICON[a.section] || "sparkles",
        url: a.url,
      };
    });
  }

  // Build HISTORY_DATA.days + totals from real articles + daily_briefs.
  // Shape: { days: [{ iso, days_ago, day_label, week, articles, signals_rising,
  // jarvis_calls, intensity, pinned, macro, top, signals }], totals: {...} }
  function transformHistory(articles, briefs){
    const DAYS_FR = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
    const MONTHS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    // Group by date
    const byDate = {};
    (articles || []).forEach(a => {
      const d = a.fetch_date;
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(a);
    });
    const briefByDate = {};
    (briefs || []).forEach(b => {
      const d = (b.date || b.created_at || "").slice(0, 10);
      if (d) briefByDate[d] = b;
    });
    const today = new Date(); today.setHours(0,0,0,0);
    const isoToday = today.toISOString().slice(0,10);
    // Last 60 days
    const days = [];
    let streak = 0, stillStreak = true, totalArticles = 0;
    let peak = { iso: isoToday, articles: 0, day_label: "—" };
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      const arts = byDate[iso] || [];
      const count = arts.length;
      totalArticles += count;
      if (stillStreak) { if (count > 0) streak++; else if (i > 0) stillStreak = false; }
      if (count > peak.articles) peak = { iso, articles: count, day_label: DAYS_FR[d.getDay()] + " " + d.getDate() + " " + MONTHS_FR[d.getMonth()] };
      const brief = briefByDate[iso];
      const top = arts.slice(0, 3).map((a, idx) => ({
        rank: idx + 1,
        source: a.source || "—",
        section: a.section || "",
        title: a.title || "",
        score: 100 - idx * 6,
        url: a.url,
        _id: a.id,
      }));
      days.push({
        iso,
        days_ago: i,
        day_label: DAYS_FR[d.getDay()] + " " + d.getDate() + " " + MONTHS_FR[d.getMonth()] + " " + d.getFullYear(),
        week: "S" + String(isoWeek(d)).padStart(2, "0"),
        articles: count,
        signals_rising: 0, // signal_tracking is keyed per week, not per day
        jarvis_calls: 0,   // needs usage_events aggregation — skip for now
        intensity: count >= 12 ? 3 : count >= 6 ? 2 : count >= 1 ? 1 : 0,
        pinned: false,
        macro: (function(){
          // daily_briefs stores the full synthesis in brief_html.
          let t = top[0]?.title || "Pas de brief pour ce jour";
          let b = arts.length ? arts.length + " articles ce jour-là." : "";
          if (brief?.brief_html) {
            const h = brief.brief_html;
            const tm = h.match(/<(?:h1|h2)[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i);
            if (tm) t = stripHtml(tm[1]).trim();
            const pm = h.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            if (pm) b = stripHtml(pm[1]).trim().slice(0, 280);
          }
          return { title: t, body: b, tag: top[0]?.section || "veille" };
        })(),
        top,
        signals: [],
      });
    }
    return {
      days,
      totals: {
        total_articles: totalArticles,
        streak_days: streak,
        peak_day: peak,
      },
    };
  }

  // Lazy panel data — returns the raw rows AND mutates the matching
  // window.*_DATA global so the React panel sees real data on render.
  async function loadPanel(id){
    const raw = window.__COCKPIT_RAW || {};
    switch (id) {
      case "updates": {
        const articles = await T2.veille();
        if (window.VEILLE_DATA && articles.length) {
          window.VEILLE_DATA.feed = transformVeilleFeed(articles);
          // Update hero headline with the freshest article
          const fresh = articles[0];
          if (fresh) {
            window.VEILLE_DATA.headline = {
              ...(window.VEILLE_DATA.headline || {}),
              kicker: "Release · " + relTime(fresh.date_published),
              actor: fresh.source || "—",
              version: fresh.title || "",
              tagline: stripHtml(fresh.summary || "").slice(0, 120),
              body: stripHtml(fresh.summary || "").slice(0, 320),
              tags: (fresh.tags || []).map(t => "#" + String(t).replace(/^#/, "")),
            };
          }
        }
        return { articles };
      }
      case "sport":
      case "gaming_news":
      case "anime":
      case "news": {
        // Non-AI verticals need articles.domain column + dedicated
        // pipelines. Keep fake VEILLE_DATA corpora for now.
        return { articles: [] };
      }
      case "wiki": {
        const concepts = await T2.wiki();
        // Expose real rows under _raw without overwriting the rich
        // fake WIKI_DATA shape (categories, entries with content_md,
        // etc.) that panel-wiki.jsx depends on.
        if (window.WIKI_DATA) window.WIKI_DATA._raw = concepts;
        return { concepts };
      }
      case "radar":
      case "recos": {
        const [recos] = await Promise.all([T2.recos()]);
        const axes = raw.radarRows || [];
        if (window.APPRENTISSAGE_DATA) {
          if (axes.length) window.APPRENTISSAGE_DATA.radar = buildRadar(axes);
          if (recos.length) {
            window.APPRENTISSAGE_DATA.recos = transformRecos(recos, axes);
          }
        }
        return { recos, axes };
      }
      case "challenges": {
        const challenges = await T2.challenges();
        // TheoryQuiz/PracticeExercise components read rich inner fields
        // (questions[].choices[], brief_md, eval_criteria) that the
        // weekly_challenges table doesn't carry. Keep fake shape, just
        // update stats from real done challenges when present.
        if (window.CHALLENGES_DATA) {
          window.CHALLENGES_DATA._raw = challenges;
          const done = (challenges || []).filter(c => c.status === "completed");
          if (done.length) {
            window.CHALLENGES_DATA.stats = {
              ...(window.CHALLENGES_DATA.stats || {}),
              total_taken: done.length,
              avg_score: Math.round(done.reduce((s,c)=>s+Number(c.score_percent||70),0)/done.length),
              total_xp: done.reduce((s,c)=>s+Number(c.score_reward||0),0),
            };
          }
        }
        return { challenges };
      }
      case "opps": {
        const opps = await T2.opps();
        // Expose real rows under _raw — OPPORTUNITIES_DATA has a very
        // rich shape (week/updated + opportunities with nested window
        // objects, urgency, opens, closes_iso, closes_in…) that the
        // weekly_opportunities table can't reproduce 1:1 without a
        // dedicated pipeline.
        if (window.OPPORTUNITIES_DATA) window.OPPORTUNITIES_DATA._raw = opps;
        return { opportunities: opps };
      }
      case "ideas": {
        const ideas = await T2.ideas();
        // Same pattern — IDEAS_DATA expects Kanban stages, signals,
        // category colors. Keep fake shape, expose real rows under _raw.
        if (window.IDEAS_DATA) window.IDEAS_DATA._raw = ideas;
        return { ideas };
      }
      case "profile": {
        const rows = raw.profileRows || await q("user_profile", "order=key");
        // PROFILE_DATA has identity/commitments/contract/uncomfortable_last
        // — too structured to reproduce from a flat user_profile kv table.
        // Expose real kv under _values; keep fake rendering intact.
        if (window.PROFILE_DATA) {
          window.PROFILE_DATA._values = transformProfile(rows);
          window.PROFILE_DATA._raw = rows;
        }
        return { profile: rows };
      }
      case "perf": {
        const activities = await T2.strava();
        if (window.FORME_DATA && activities.length) {
          const now = Date.now();
          const seven = now - 7 * 24 * 3600 * 1000;
          const thirty = now - 30 * 24 * 3600 * 1000;
          const inRange = (iso, from) => new Date(iso).getTime() >= from;
          const last7 = activities.filter(a => inRange(a.start_date, seven));
          const last30 = activities.filter(a => inRange(a.start_date, thirty));
          const sumKm = rows => rows.reduce((s, a) => s + (Number(a.distance_m) || 0) / 1000, 0);
          const sumMin = rows => rows.reduce((s, a) => s + (Number(a.moving_time_s) || 0) / 60, 0);
          window.FORME_DATA._raw = activities;
          window.FORME_DATA._live = {
            count_7d: last7.length,
            count_30d: last30.length,
            km_7d: Math.round(sumKm(last7)),
            km_30d: Math.round(sumKm(last30)),
            minutes_7d: Math.round(sumMin(last7)),
            minutes_30d: Math.round(sumMin(last30)),
            latest: activities[0] || null,
          };
        }
        return { activities };
      }
      case "music": {
        const [scrobbles, stats, top, loved, genres, insights] = await Promise.all([
          T2.music_scrobbles(), T2.music_stats(), T2.music_top(),
          T2.music_loved(), T2.music_genres(), T2.music_insights(),
        ]);
        if (window.MUSIC_DATA && (stats || []).length) {
          const now = Date.now();
          const seven = now - 7 * 24 * 3600 * 1000;
          const thirty = now - 30 * 24 * 3600 * 1000;
          const inRange = (d, from) => new Date(d + "T00:00:00").getTime() >= from;
          const total7 = (stats || []).filter(s => inRange(s.stat_date, seven)).reduce((a, s) => a + (Number(s.scrobble_count) || 0), 0);
          const total30 = (stats || []).filter(s => inRange(s.stat_date, thirty)).reduce((a, s) => a + (Number(s.scrobble_count) || 0), 0);
          const totalAll = (stats || []).reduce((a, s) => a + (Number(s.scrobble_count) || 0), 0);
          if (window.MUSIC_DATA.totals) {
            window.MUSIC_DATA.totals.last7 = total7;
            window.MUSIC_DATA.totals.last30 = total30;
            window.MUSIC_DATA.totals.all180 = totalAll;
          }
          window.MUSIC_DATA._raw = { scrobbles, stats, top, loved, genres, insights };
        }
        return { scrobbles, stats, top, loved, genres, insights };
      }
      case "gaming": {
        const [snapshot, stats, achievements] = await Promise.all([
          T2.steam_snapshot(), T2.steam_stats(), T2.steam_achievements(),
        ]);
        if (window.GAMING_PERSO_DATA && snapshot) {
          const now = Date.now();
          const thirty = now - 30 * 24 * 3600 * 1000;
          const totalMinutes30 = (stats || [])
            .filter(s => new Date(s.stat_date + "T00:00:00").getTime() >= thirty)
            .reduce((a, s) => a + (Number(s.total_playtime_minutes) || 0), 0);
          const topGame = snapshot && snapshot[0] ? snapshot[0].name : null;
          window.GAMING_PERSO_DATA._raw = { snapshot, stats, achievements };
          window.GAMING_PERSO_DATA._live = {
            library_size: (snapshot || []).length,
            playtime_minutes_30d: totalMinutes30,
            top_game: topGame,
            achievements_recent: (achievements || []).slice(0, 10),
          };
        }
        return { snapshot, stats, achievements };
      }
      case "stacks": {
        const rows = await T2.weekly_analysis();
        const now = new Date();
        const monthKey = now.toISOString().slice(0, 7);
        const monthCost = (rows || [])
          .filter(r => (r.created_at || r.week_start || "").slice(0, 7) === monthKey)
          .reduce((s, r) => s + Number(r.cost_eur || 0), 0);
        // Project cost for full month
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projected = dayOfMonth > 0 ? (monthCost / dayOfMonth) * daysInMonth : monthCost;
        if (window.STACKS_DATA && window.STACKS_DATA.totals) {
          window.STACKS_DATA.totals.cost_mtd = monthCost;
          window.STACKS_DATA.totals.cost_projected = projected;
          window.STACKS_DATA.day_of_month = dayOfMonth;
          window.STACKS_DATA.days_in_month = daysInMonth;
          window.STACKS_DATA._raw = rows;
        }
        return { weekly_analysis: rows };
      }
      case "history": {
        // 60-day window of articles + daily briefs → rebuild HISTORY_DATA
        const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const fromDate = sixtyDaysAgo.toISOString().split("T")[0];
        const [arts60, briefs] = await Promise.all([
          q("articles", `fetch_date=gte.${fromDate}&select=id,title,fetch_date,section,source,url,summary&order=fetch_date.desc&limit=2000`).catch(() => []),
          q("daily_briefs", `date=gte.${fromDate}&select=date,brief_html,article_count&order=date.desc&limit=60`).catch(() => []),
        ]);
        if (window.HISTORY_DATA && arts60.length) {
          const shape = transformHistory(arts60, briefs);
          window.HISTORY_DATA.days = shape.days;
          window.HISTORY_DATA.totals = shape.totals;
        }
        return { articles: arts60, briefs };
      }
      case "signals": {
        // SIGNALS_DATA may not exist; COCKPIT_DATA.signals holds Tier 1 data
        return { signals: raw.signals || [] };
      }
      case "jobs": {
        const [allJobs, todayScan, last7Scans] = await Promise.all([
          T2.jobs_all().catch(() => []),
          T2.jobs_scan_today().catch(() => null),
          T2.jobs_scans_7d().catch(() => []),
        ]);
        // Fall back to mock JOBS_DATA when the table is empty (first-run UX).
        if (window.JOBS_DATA && (allJobs?.length || todayScan)) {
          const offers = (allJobs || []).map(transformJobRow);
          window.JOBS_DATA.offers = offers;
          window.JOBS_DATA.scan = transformJobScan(todayScan, last7Scans, offers);
          window.JOBS_DATA._raw = { jobs: allJobs, todayScan, last7Scans };
        }
        return { jobs: allJobs, todayScan, last7Scans };
      }
      default:
        return {};
    }
  }

  // Hydrate globals with real data on boot (Tier 1 already fetched the
  // radar rows, profile rows, signals — use them to seed the globals
  // so the first render never shows fake data when real is available).
  //
  // For rich-shape globals (PROFILE_DATA), we DON'T overwrite the fake
  // — we store real rows under _raw / _values so panels can access them
  // without us having to reproduce every nested field the React panel
  // reads. Only shapes we fully own (radar) get replaced wholesale.
  function hydrateGlobalsFromTier1(){
    const raw = window.__COCKPIT_RAW || {};
    if (window.APPRENTISSAGE_DATA && raw.radarRows?.length) {
      window.APPRENTISSAGE_DATA.radar = buildRadar(raw.radarRows);
    }
    if (window.PROFILE_DATA && raw.profileRows?.length) {
      const kv = transformProfile(raw.profileRows);
      window.PROFILE_DATA._values = kv;
      window.PROFILE_DATA._raw = raw.profileRows;
      // Non-destructive merge of a few headline fields the panel reads.
      if (window.PROFILE_DATA.identity) {
        if (kv.name) window.PROFILE_DATA.identity.name = kv.name;
        if (kv.role || kv.current_role) window.PROFILE_DATA.identity.role = kv.role || kv.current_role;
        if (kv.location) window.PROFILE_DATA.identity.location = kv.location;
      }
    }
    if (window.SIGNALS_DATA && raw.signals?.length) {
      // SIGNALS_DATA may have a richer shape too — expose real under _raw
      window.SIGNALS_DATA._raw = raw.signals;
    }
  }

  window.cockpitDataLoader = {
    bootTier1,
    loadPanel,
    hydrateGlobalsFromTier1,
    T2,
    cache,
    // shape builders re-exported for panels that want to rebuild parts live
    buildSignals, buildRadar, buildTop, buildMacro, buildWeek, buildStats, buildDateShape, buildUser,
    // helpers
    isoWeek, dayOfYear, relTime, stripHtml, getReadMap, computeStreak,
  };
})();
