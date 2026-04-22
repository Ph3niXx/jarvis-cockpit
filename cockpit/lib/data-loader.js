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
    // 30-day delta from the per-axis history JSONB (written by the
    // diagnostic + weekly scoring). Falls back to 0 if the axis has no
    // point older than 30 days.
    const CUTOFF_MS = Date.now() - 30 * 86400000;
    function delta30(rawHistory, currentScore){
      let hist = rawHistory;
      if (typeof hist === "string") {
        try { hist = JSON.parse(hist); } catch { return 0; }
      }
      if (!Array.isArray(hist) || hist.length < 2) return 0;
      const older = hist
        .map(h => ({ t: new Date(h.date).getTime(), s: Number(h.score) }))
        .filter(h => !Number.isNaN(h.t) && h.t <= CUTOFF_MS)
        .sort((a, b) => b.t - a.t)[0];
      if (!older) return 0;
      const oldNorm = older.s <= 10 ? older.s * 10 : Math.min(100, older.s);
      return Math.round(currentScore - oldNorm);
    }
    const axes = rows.map(r => {
      const label = r.axis_label || r.axis;
      const score = Math.round(norm(r));
      return {
        id: r.axis,
        // Keep BOTH name and label — home.jsx/RadarSVG reads .name,
        // panel-radar.jsx reads .label. Same value, both aliases.
        name: label,
        label: label,
        score,
        gap: score < 50,
        target: Number(r.target || 85),
        delta_30d: delta30(r.history, score),
        axis: r.axis,
        axis_label: label,
        strengths: r.strengths || "",
        gaps: r.gaps || "",
        level: score >= 75 ? "Avancé" : score >= 50 ? "Intermédiaire" : "Débutant",
        note: r.gaps || r.strengths || "",
      };
    });
    const lowest = axes.slice().sort((a, b) => a.score - b.score)[0];
    const avg = Math.round(axes.reduce((s, a) => s + a.score, 0) / Math.max(1, axes.length));
    const levelGlobal = avg >= 75 ? "Niveau avancé" : avg >= 50 ? "Niveau intermédiaire" : avg >= 20 ? "Niveau débutant" : "À démarrer";
    return {
      axes,
      next_gap: lowest ? {
        axis: lowest.name,
        reason: lowest.gaps || `Score bloqué à ${lowest.score}/100. C'est ton plus gros delta avec l'expert — prochain pas recommandé.`,
        action: "Faire un challenge de la semaine",
      } : EMPTY_GAP,
      summary: {
        avg,
        strongest: axes.slice().sort((a, b) => b.score - a.score)[0]?.id,
        weakest: lowest?.id,
        level_global: levelGlobal,
        // position_peers intentionally omitted — we have no peer data.
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // Wiki IA : transforme les concepts Supabase en entrées cockpit
  // ─────────────────────────────────────────────────────────
  const WIKI_CATEGORY_LABELS = {
    agents: "Agents",
    rag: "RAG",
    architecture: "Architecture",
    prompting: "Prompting",
    finetuning: "Fine-tuning",
    fine_tuning: "Fine-tuning",
    regulation: "Régulation",
    ethics: "Éthique",
    metier: "Métier",
    coding: "Code",
    code: "Code",
    fondamentaux: "Fondamentaux",
    general: "Fondamentaux",
    idees: "Idées",
    mlops: "MLOps",
    llm: "LLM",
    models: "Modèles",
    business: "Business",
    evaluation: "Évaluation",
    security: "Sécurité",
  };
  function wikiCategoryLabel(cat){
    if (!cat) return "Fondamentaux";
    const c = String(cat).toLowerCase().trim();
    if (WIKI_CATEGORY_LABELS[c]) return WIKI_CATEGORY_LABELS[c];
    return c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ");
  }

  function buildWikiContent(c){
    // Stitch summary_beginner/intermediate/advanced into markdown content.
    // If only one level is available, use it as the whole body.
    const parts = [];
    if (c.summary_beginner) {
      parts.push("## Vue d'ensemble\n\n" + c.summary_beginner);
    }
    if (c.summary_intermediate) {
      parts.push("## Pour aller plus loin\n\n" + c.summary_intermediate);
    }
    if (c.summary_advanced) {
      parts.push("## En profondeur\n\n" + c.summary_advanced);
    }
    return parts.join("\n\n");
  }

  function wikiRelativeUpdated(iso){
    // "hier", "il y a 3j", "12 avr" pour les cartes.
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(d); target.setHours(0,0,0,0);
    const diffDays = Math.round((today - target) / 86400000);
    if (diffDays <= 0) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return d.toLocaleDateString("fr", { day: "numeric", month: "short" });
  }

  function buildWikiFromConcepts(concepts){
    const rows = Array.isArray(concepts) ? concepts : [];
    if (!rows.length) return null;

    // Index by slug for related resolution
    const bySlug = new Map(rows.map(r => [r.slug, r]));
    // Reverse map slug → id (entries id = slug for stability)
    const entries = rows.map(r => {
      const content = buildWikiContent(r);
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const excerpt = (r.summary_intermediate || r.summary_beginner || "").split(/\n/)[0].slice(0, 220);
      const related = (r.related_concepts || []).filter(s => bySlug.has(s));
      const catLabel = wikiCategoryLabel(r.category);
      return {
        id: r.slug || r.id,
        slug: r.slug,
        kind: "auto",  // Toutes les entrées DB sont maintenues par Jarvis
        category: (r.category || "general").toLowerCase(),
        category_label: catLabel,
        title: r.name || r.slug || "(sans titre)",
        excerpt,
        updated: wikiRelativeUpdated(r.last_mentioned || r.updated_at),
        updated_iso: r.last_mentioned || r.updated_at || null,
        created: r.first_seen || r.created_at || null,
        word_count: wordCount,
        read_count: Number(r.mention_count || 0),
        read_time: Math.max(1, Math.round(wordCount / 200)),
        tags: [r.category, ...(r.related_concepts || []).slice(0, 3)].filter(Boolean),
        related,
        backlinks: [],  // Computed below
        pinned: false,
        content,
        mention_count: Number(r.mention_count || 0),
      };
    });

    // Compute backlinks: entry X is backlink of Y if X.related contains Y.slug
    const bySlugEntry = new Map(entries.map(e => [e.slug, e]));
    entries.forEach(e => {
      entries.forEach(other => {
        if (other.id !== e.id && (other.related || []).includes(e.slug)) {
          e.backlinks.push(other.id);
        }
      });
    });

    // Categories : "all" + toutes celles présentes, triées alpha
    const catSet = new Set(entries.map(e => e.category));
    const categories = [{ id: "all", label: "Tout" }];
    Array.from(catSet).sort().forEach(cid => {
      categories.push({ id: cid, label: wikiCategoryLabel(cid) });
    });

    // Stats: réels vs fake. Pas de distinction auto/perso en DB → tout en auto.
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const updatedThisWeek = entries.filter(e => {
      const t = e.updated_iso ? new Date(e.updated_iso).getTime() : 0;
      return t >= sevenDaysAgo;
    }).length;
    const createdThisWeek = entries.filter(e => {
      const t = e.created ? new Date(e.created).getTime() : 0;
      return t >= sevenDaysAgo;
    }).length;
    const mostRead = entries.slice().sort((a, b) => b.mention_count - a.mention_count)[0];

    return {
      entries,
      categories,
      stats: {
        total: entries.length,
        auto: entries.length,
        perso: 0,
        created_this_week: createdThisWeek,
        updated_this_week: updatedThisWeek,
        most_read: mostRead?.title || "",
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // Signaux faibles : transforme signal_tracking → shape riche panel
  // ─────────────────────────────────────────────────────────
  const SIG_CATEGORY_MAP = {
    // wiki_concepts.category → label panel
    agents: "Agents",
    rag: "RAG",
    architecture: "Architecture",
    prompting: "Prompting",
    finetuning: "Fine-tuning",
    fine_tuning: "Fine-tuning",
    regulation: "Régulation",
    ethics: "Éthique",
    coding: "Code",
    code: "Code",
    general: "Fondamentaux",
    fondamentaux: "Fondamentaux",
    models: "LLMs",
    llm: "LLMs",
    evaluation: "Évaluation",
    mlops: "MLOps",
    business: "Business",
    security: "Sécurité",
  };
  function signalCategoryLabel(cat){
    if (!cat) return "Autres";
    const c = String(cat).toLowerCase().trim();
    return SIG_CATEGORY_MAP[c] || (c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " "));
  }

  function weekNumFromISO(iso){
    if (!iso) return null;
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d.getTime())) return null;
    // ISO 8601 week number
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  }
  function weekLabel(iso){
    const n = weekNumFromISO(iso);
    return n ? "S" + String(n).padStart(2, "0") : (iso || "—");
  }

  function slugifySignal(s){
    return String(s || "").toLowerCase().trim()
      .replace(/\([^)]*\)/g, "")  // strip parenthetical annotations
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildSignalsFromDB(rows, wikiConcepts){
    const signals = Array.isArray(rows) ? rows : [];
    if (!signals.length) return null;

    // Group by term, keep all weeks
    const byTerm = new Map();
    signals.forEach(r => {
      if (!r || !r.term) return;
      const arr = byTerm.get(r.term) || [];
      arr.push(r);
      byTerm.set(r.term, arr);
    });

    // Index wiki_concepts by normalised slug for category lookup
    const wikiBySlug = new Map();
    (wikiConcepts || []).forEach(w => {
      if (w.slug) wikiBySlug.set(w.slug, w);
    });

    const result = [];
    byTerm.forEach((weeks, term) => {
      const sorted = weeks.slice().sort((a, b) => String(a.week_start || "").localeCompare(String(b.week_start || "")));
      const latest = sorted[sorted.length - 1];
      const history = sorted.map(r => Number(r.mention_count || 0));
      // Pad history to at least 12 weeks (zeros at start)
      while (history.length < 12) history.unshift(0);
      const last4Sum = history.slice(-4).reduce((s, n) => s + n, 0);
      const prev4Sum = history.slice(-8, -4).reduce((s, n) => s + n, 0);
      const delta4w = latest.trend === "new" ? null : (last4Sum - prev4Sum);

      // Category via wiki_concepts (slug matching)
      const slug = slugifySignal(term);
      const wikiMatch = wikiBySlug.get(slug) ||
        // Fuzzy match : slug begins with or is begun-by
        Array.from(wikiBySlug.values()).find(w => slug.startsWith(w.slug) || w.slug.startsWith(slug));
      const categoryRaw = wikiMatch?.category || "Autres";
      const category = signalCategoryLabel(categoryRaw);

      // Maturity heuristic
      const count = Number(latest.mention_count || 0);
      const trend = latest.trend || "stable";
      let maturity = "plateau";
      if (trend === "new") maturity = "seed";
      else if (trend === "rising") maturity = count > 15 ? "hype" : "emerging";
      else if (trend === "declining") maturity = count > 10 ? "plateau" : "declining";
      else if (trend === "stable" && count > 20) maturity = "plateau";
      else if (trend === "stable" && count < 5) maturity = "declining";

      // Sources : DB sources[] is text[] of raw strings → transform
      const sourcesList = Array.isArray(latest.sources) ? latest.sources : [];
      const sourcesObj = sourcesList.slice(0, 8).map((src) => {
        const s = String(src);
        // Best-effort parsing : "Anthropic — blog" / "arXiv"
        const m = s.match(/^([^—\-:(]+?)(?:\s*[—\-:]\s*(.+))?$/);
        return {
          who: m ? m[1].trim() : s,
          what: m && m[2] ? m[2].trim() : "",
          when: weekLabel(latest.week_start),
          kind: "source",
        };
      });

      // Related : terms with ≥2 source overlap
      const latestSourceSet = new Set((latest.sources || []).map(String));
      const related = [];

      result.push({
        id: "sg-" + slug || "sg-" + result.length,
        slug,
        name: term,
        category,
        trend,
        count,
        delta: delta4w,
        delta_4w: delta4w,
        history: history.slice(-12),
        first_seen: weekLabel(sorted[0].week_start),
        last_seen: weekLabel(latest.week_start),
        maturity,
        jarvis_take: "",  // À remplir par le pipeline hebdo (brique future)
        sources: sourcesObj,
        _sourceSet: latestSourceSet,
        related,
        alerts: [],
        mention_count: count,
      });
    });

    // Compute related (co-occurrence on sources)
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j];
        let overlap = 0;
        a._sourceSet.forEach(s => { if (b._sourceSet.has(s)) overlap++; });
        if (overlap >= 2) {
          a.related.push(b.id);
          b.related.push(a.id);
        }
      }
    }
    // Cleanup internal field
    result.forEach(s => { delete s._sourceSet; });

    // Sort by count desc
    result.sort((a, b) => b.count - a.count);

    return {
      week: weekLabel(signals[0].week_start),
      updated: new Date().toLocaleString("fr", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      window_weeks: 12,
      signals: result,
      maturity_positions: {
        seed: 0.12,
        emerging: 0.35,
        hype: 0.55,
        plateau: 0.92,
        declining: 0.78,
      },
    };
  }

  // Transforme une ligne weekly_challenges (mode='theory'|'practice', content jsonb)
  // vers la shape attendue par panel-challenges.jsx.
  function mapWeeklyChallengeRow(r, radarAxes){
    const axisId = r.target_axis;
    const radarAx = (radarAxes || []).find(a => (a.axis || a.id) === axisId);
    const axisLabel = radarAx ? (radarAx.axis_label || radarAx.label || axisId) : axisId;
    const content = (r && r.content) || {};
    const isTheory = r.mode === "theory";
    const impactPts = Math.max(1, Math.round(Number(r.score_reward || 0.5) * 6));
    const base = {
      id: r.id,
      axis: axisId,
      axis_label: axisLabel,
      title: r.title || "(sans titre)",
      teaser: r.teaser || r.description || "",
      difficulty: r.difficulty || "Moyen",
      duration_min: Number(r.duration_min || 0) || (isTheory ? 5 : 45),
      xp: Number(r.xp || 0) || (isTheory ? 50 : 100),
      status: r.status === "recommended" ? "recommended"
            : r.status === "completed"   ? "done"
            : "open",
      impact_axis: `+${impactPts} pts si ≥80%`,
      score_reward: Number(r.score_reward || 0.5),
    };
    if (isTheory) {
      const questions = Array.isArray(content.questions) ? content.questions.filter(q => q && Array.isArray(q.options)) : [];
      return { ...base, questions };
    }
    const constraints = Array.isArray(content.constraints) ? content.constraints.map(String) : [];
    return {
      ...base,
      brief: content.brief || r.description || "",
      constraints,
      eval_criteria: content.eval_criteria || "",
    };
  }

  // Hydrate CHALLENGES_DATA from challenge_attempts.
  // - Per-challenge: best attempt -> status="done" if >= 70, score, last_attempt_at
  // - Global stats: total_taken (all attempts), avg_score, total_xp (sum of best xp per unique ref)
  // - Streak: consecutive distinct days with >=1 attempt ending today or yesterday
  function applyAttemptsToChallenges(cd, attempts){
    if (!cd) return;
    const byRef = new Map();
    for (const a of attempts || []) {
      const ref = a.challenge_ref;
      if (!ref) continue;
      const prev = byRef.get(ref);
      if (!prev || Number(a.score_percent || 0) > Number(prev.score_percent || 0)) {
        byRef.set(ref, a);
      }
    }
    const stamp = (ch) => {
      const best = byRef.get(ch.id);
      if (!best) return ch;
      const score = Math.round(Number(best.score_percent || 0));
      return {
        ...ch,
        status: score >= 70 ? "done" : (ch.status === "recommended" ? "recommended" : "open"),
        score,
        last_attempt_at: best.completed_at,
      };
    };
    if (Array.isArray(cd.theory))   cd.theory   = cd.theory.map(stamp);
    if (Array.isArray(cd.practice)) cd.practice = cd.practice.map(stamp);

    // Stats: one row per attempt (total_taken), mean over best-per-ref (avg_score),
    // sum of best xp per ref (total_xp — avoids double counting retries).
    const totalTaken = (attempts || []).length;
    if (totalTaken > 0) {
      const bests = Array.from(byRef.values());
      const avgScore = Math.round(bests.reduce((s, a) => s + Number(a.score_percent || 0), 0) / bests.length);
      const totalXP = bests.reduce((s, a) => s + Number(a.xp_earned || 0), 0);
      cd.stats = {
        ...(cd.stats || {}),
        total_taken: totalTaken,
        avg_score: avgScore,
        total_xp: totalXP,
      };
    }

    // Streak: distinct YYYY-MM-DD values from attempts, consecutive tail ending today/yesterday.
    // Tout en UTC pour éviter les décalages fuseau horaire.
    const toUtcDay = (ts) => {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    };
    const dayUtcMs = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    const days = new Set();
    (attempts || []).forEach(a => {
      if (!a.completed_at) return;
      const key = toUtcDay(a.completed_at);
      if (key) days.add(key);
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    let cursorMs = dayUtcMs(todayIso);
    if (!days.has(new Date(cursorMs).toISOString().slice(0, 10))) {
      cursorMs -= 86400000;
    }
    let current = 0;
    while (days.has(new Date(cursorMs).toISOString().slice(0, 10))) {
      current++;
      cursorMs -= 86400000;
    }
    const sorted = Array.from(days).sort();
    let best = 0, run = 0, prev = null;
    for (const d of sorted) {
      const dt = dayUtcMs(d);
      if (prev !== null && dt - prev === 86400000) run++;
      else run = 1;
      if (run > best) best = run;
      prev = dt;
    }
    cd.streak = {
      ...(cd.streak || {}),
      current,
      best: Math.max(best, Number(cd.streak?.best || 0), current),
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
    async challengeAttempts(){ return once("challenge_attempts", () => q("challenge_attempts", "order=completed_at.desc&limit=500")); },
    async opps(){ return once("opps", () => q("weekly_opportunities", "order=week_start.desc&limit=40")); },
    async ideas(){ return once("ideas", () => q("business_ideas", "order=created_at.desc&limit=100")); },
    async strava(){ return once("strava", () => q("strava_activities", "order=start_date.desc&limit=300")); },
    async music_scrobbles(){ return once("music_scrobbles", () => q("music_scrobbles", "order=scrobbled_at.desc&limit=200")); },
    async music_stats(){ return once("music_stats", () => q("music_stats_daily", "order=stat_date.desc&limit=400")); },
    async music_top(){ return once("music_top", () => q("music_top_weekly", "order=week_start.desc&limit=1000")); },
    async music_loved(){ return once("music_loved", () => q("music_loved_tracks", "order=loved_at.desc&limit=40")); },
    async music_genres(){ return once("music_genres", () => q("music_genre_weekly", "order=week_start.desc&limit=120")); },
    async music_insights(){ return once("music_insights", () => q("music_insights_weekly", "order=week_start.desc&limit=12")); },
    async music_discoveries(){
      return once("music_discoveries", () =>
        window.sb.rpc("music_discoveries", { p_window_days: 90, p_recent_days: 30 })
          .catch((err) => {
            console.error("[T2.music_discoveries] RPC failed:", err);
            return [];
          })
      );
    },
    async steam_snapshot(){
      const today = isoToday();
      return once("steam_snapshot_" + today, () => q("steam_games_snapshot", `snapshot_date=eq.${today}&order=playtime_2weeks_minutes.desc&limit=500`));
    },
    async steam_stats(){ return once("steam_stats", () => q("gaming_stats_daily", "order=stat_date.desc&limit=90")); },
    async steam_achievements(){ return once("steam_achievements", () => q("steam_achievements", "order=unlocked_at.desc&limit=50")); },
    async weekly_analysis(){ return once("weekly_analysis_all", () => loadWeeklyAnalysis(30)); },
    async jobs_all(){ return once("jobs_all", () => q("jobs", "select=*&order=score_total.desc.nullslast&limit=300")); },
    async sport(){ return once("sport_articles", () => q("sport_articles", "order=date_published.desc.nullslast,date_fetched.desc&limit=200")); },
    async gaming_news(){ return once("gaming_articles", () => q("gaming_articles", "order=date_published.desc.nullslast,date_fetched.desc&limit=200")); },
    async anime(){ return once("anime_articles", () => q("anime_articles", "order=date_published.desc.nullslast,date_fetched.desc&limit=200")); },
    async news(){ return once("news_articles", () => q("news_articles", "order=date_published.desc.nullslast,date_fetched.desc&limit=200")); },
    async jarvis_messages(){ return once("jarvis_messages", () => q("jarvis_conversations", "order=created_at.desc&limit=200")); },
    async jarvis_facts(){ return once("jarvis_facts", () => q("profile_facts", "superseded_by=is.null&order=created_at.desc&limit=200")); },
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

  // Deep merge: recursively copy source fields into target, preserving
  // the target fields the transformer doesn't produce. Used by the
  // partial-transform panels (Forme, Gaming) where some sections have
  // no real-data counterpart yet. For panels with complete transformers
  // (Music), prefer `replaceShape` below — it overwrites wholesale, so
  // an empty real result doesn't leak fake data.
  function mergeInto(target, source){
    if (!target || !source || typeof source !== "object") return target;
    Object.keys(source).forEach(k => {
      const sv = source[k];
      const tv = target[k];
      if (sv === null || sv === undefined) return;
      if (Array.isArray(sv)) { target[k] = sv; return; }
      if (Array.isArray(tv)) { target[k] = sv; return; }
      if (typeof sv === "object" && typeof tv === "object" && !(sv instanceof Date)) {
        mergeInto(tv, sv);
        return;
      }
      target[k] = sv;
    });
    return target;
  }

  // Shallow replace: overwrite every top-level key of `target` with the
  // matching key from `source`. Use this when the transformer produces
  // the complete shape the panel reads — fake fields left over from
  // data-*.js get replaced, not merged.
  function replaceShape(target, source){
    if (!target || !source || typeof source !== "object") return target;
    Object.keys(source).forEach(k => { target[k] = source[k]; });
    return target;
  }

  // The Claude pipeline writes target_axis as a free-form slug
  // (e.g. "agents_automation") that doesn't always match skill_radar.axis
  // ("agents"). Canonicalise here so the sidebar filter actually works.
  const RECO_AXIS_ALIASES = {
    agents_automation: "agents",
    agents_et_automatisation: "agents",
    business_strategie: "business",
    business_et_strategie: "business",
    ethique_regulation: "ethics",
    ethique_et_regulation: "ethics",
    fondamentaux_llm: "llm_fundamentals",
    fondamentaux_des_llm: "llm_fundamentals",
    integration_code: "code_integration",
    code_et_integration: "code_integration",
    mlops_et_production: "mlops",
    production_mlops: "mlops",
    rag_et_donnees: "rag_data",
    prompting: "prompt_engineering",
    prompt_eng: "prompt_engineering",
  };
  function resolveAxisId(rawId, axesList){
    if (!rawId) return rawId;
    const normalised = String(rawId).toLowerCase().trim();
    if ((axesList || []).some(a => a.id === normalised)) return normalised;
    if (RECO_AXIS_ALIASES[normalised]) return RECO_AXIS_ALIASES[normalised];
    // Fallback: longest-prefix match (e.g. "agents_foo" -> "agents").
    const firstToken = normalised.split(/[_\s-]+/)[0];
    const fuzzy = (axesList || []).find(a => a.id && (
      a.id === firstToken || a.id.startsWith(firstToken) || firstToken.startsWith(a.id)
    ));
    return fuzzy ? fuzzy.id : normalised;
  }

  function transformRecos(rows, axes){
    return (rows || []).map((r, i) => {
      const rawAxisId = r.target_axis || r.axis || "prompting";
      const axisId = resolveAxisId(rawAxisId, axes);
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

  // Build MUSIC_DATA shape from real Last.fm tables.
  // Sources: music_scrobbles, music_stats_daily, music_top_weekly,
  // music_loved_tracks, music_genre_weekly.
  function transformMusic({ scrobbles, stats, top, loved, genres, newArtists }){
    const now = new Date(); now.setHours(0,0,0,0);
    const dayMs = 24 * 3600 * 1000;
    const today = now.toISOString().slice(0, 10);
    const inRange = (d, days) => {
      const t = new Date(d + "T00:00:00").getTime();
      return t >= (now.getTime() - days * dayMs);
    };

    // ── totals ─────────────────────────────
    const statsArr = stats || [];
    const sumScrobbles = (filter) => statsArr
      .filter(s => filter(s.stat_date))
      .reduce((a, s) => a + (Number(s.scrobble_count) || 0), 0);
    const sumMinutes = (filter) => statsArr
      .filter(s => filter(s.stat_date))
      .reduce((a, s) => a + (Number(s.listening_minutes) || 0), 0);
    const last7 = sumScrobbles(d => inRange(d, 7));
    const last30 = sumScrobbles(d => inRange(d, 30));
    const last180 = sumScrobbles(d => inRange(d, 180));
    const todayStats = statsArr.find(s => s.stat_date === today);
    const hours_today = Math.round(((todayStats?.listening_minutes || 0) / 60) * 10) / 10;
    const hours_week = Math.round((sumMinutes(d => inRange(d, 7)) / 60) * 10) / 10;
    const ytd_start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const ytd = statsArr
      .filter(s => s.stat_date >= ytd_start)
      .reduce((a, s) => a + (Number(s.scrobble_count) || 0), 0);

    // ── streak ─────────────────────────────
    // Consecutive days with scrobbles ending on today.
    const dateSet = new Set(statsArr.filter(s => (s.scrobble_count || 0) > 0).map(s => s.stat_date));
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (dateSet.has(iso)) streak++;
      else if (i > 0) break;
    }
    // Longest streak across the full series.
    let longest = 0, run = 0;
    const sortedDates = statsArr.map(s => s.stat_date).filter(Boolean).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0 || (new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / dayMs === 1) run++;
      else run = 1;
      if (run > longest) longest = run;
    }

    // ── top artists / tracks / albums ──────
    // music_top_weekly categories: "artist", "track", "album".
    const byCat = { artist: [], track: [], album: [] };
    (top || []).forEach(r => {
      const cat = r.category;
      if (byCat[cat]) byCat[cat].push(r);
    });
    // music_top_weekly columns: week_start, category, item_name,
    // secondary_name (artist for track/album rows), play_count, rank,
    // image_url (added in migration 009, may be null on older rows).
    const aggregateTop = (rows, weeks) => {
      const cutoff = new Date(now); cutoff.setDate(now.getDate() - weeks * 7);
      const cutoffIso = cutoff.toISOString().slice(0, 10);
      const tally = {};
      const imageByKey = {};
      rows.filter(r => (r.week_start || "") >= cutoffIso).forEach(r => {
        const key = r.item_name + "\u0001" + (r.secondary_name || "");
        tally[key] = (tally[key] || 0) + (Number(r.play_count) || 0);
        if (r.image_url && !imageByKey[key]) imageByKey[key] = r.image_url;
      });
      return Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([key, count], i) => {
          const [name, secondary] = key.split("\u0001");
          return {
            name, secondary, scrobbles: count, rank: i + 1, delta: 0,
            image_url: imageByKey[key] || null,
          };
        });
    };

    // Fallback artists from raw scrobbles when weekly rollup is empty.
    const scrobbleArtistTally = {};
    (scrobbles || []).forEach(sc => {
      const n = sc.artist_name;
      if (n) scrobbleArtistTally[n] = (scrobbleArtistTally[n] || 0) + 1;
    });
    const scrobbleArtistsTop = Object.entries(scrobbleArtistTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count], i) => ({ name, scrobbles: count, rank: i + 1, delta: 0 }));
    const pickArtists = (weeks) => {
      const fromWeekly = aggregateTop(byCat.artist, weeks);
      return fromWeekly.length ? fromWeekly : scrobbleArtistsTop;
    };
    const artistsAllTime = aggregateTop(byCat.artist, 999);
    const top_artists = {
      "7d":  pickArtists(1),
      "30d": pickArtists(4),
      "6m":  pickArtists(26),
      "all": artistsAllTime.length ? artistsAllTime : scrobbleArtistsTop,
    };

    // ── Deterministic color from a string ──
    // Same artist/album always maps to the same pleasing dark tone, so
    // album tiles look distinct even when cover art is missing.
    const hashStr = (s) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    const tintFor = (s) => {
      const h = hashStr(s || "x") % 360;
      return `hsl(${h}, 38%, 22%)`;
    };

    // Build a track→image_url lookup from raw scrobbles (pipeline writes
    // image_url per scrobble). Key is "track\u0001artist".
    const scrobbleImages = {};
    (scrobbles || []).forEach(sc => {
      if (!sc.image_url) return;
      const key = (sc.track_name || "") + "\u0001" + (sc.artist_name || "");
      if (!scrobbleImages[key]) scrobbleImages[key] = sc.image_url;
      // Also index by album+artist for album cover lookup.
      if (sc.album_name) {
        const aKey = "album\u0001" + sc.album_name + "\u0001" + (sc.artist_name || "");
        if (!scrobbleImages[aKey]) scrobbleImages[aKey] = sc.image_url;
      }
    });

    // Tracks — weekly rollup first, fallback on raw scrobbles.
    const tracksFromWeekly = aggregateTop(byCat.track, 4).map((t, i) => ({
      rank: i + 1,
      title: t.name,
      artist: t.secondary || "—",
      plays: t.scrobbles,
      duration: "",
      image_url: t.image_url || scrobbleImages[(t.name || "") + "\u0001" + (t.secondary || "")] || null,
    }));
    const scrobbleTrackTally = {};
    (scrobbles || []).forEach(sc => {
      if (!sc.track_name) return;
      const key = sc.track_name + "\u0001" + (sc.artist_name || "");
      scrobbleTrackTally[key] = (scrobbleTrackTally[key] || 0) + 1;
    });
    const tracksFromScrobbles = Object.entries(scrobbleTrackTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k, count], i) => {
        const [title, artist] = k.split("\u0001");
        return {
          rank: i + 1,
          title,
          artist: artist || "—",
          plays: count,
          duration: "",
          image_url: scrobbleImages[k] || null,
        };
      });
    const top_tracks = tracksFromWeekly.length ? tracksFromWeekly : tracksFromScrobbles;

    // Albums — weekly rollup, fallback on raw scrobbles with album_name.
    const albumsFromWeekly = aggregateTop(byCat.album, 4).map((t, i) => ({
      rank: i + 1,
      title: t.name,
      artist: t.secondary || "—",
      plays: t.scrobbles,
      year: "",
      bg: tintFor((t.name || "") + (t.secondary || "")),
      image_url: t.image_url || scrobbleImages["album\u0001" + (t.name || "") + "\u0001" + (t.secondary || "")] || null,
    }));
    const scrobbleAlbumTally = {};
    (scrobbles || []).forEach(sc => {
      if (!sc.album_name) return;
      const key = sc.album_name + "\u0001" + (sc.artist_name || "");
      scrobbleAlbumTally[key] = (scrobbleAlbumTally[key] || 0) + 1;
    });
    const albumsFromScrobbles = Object.entries(scrobbleAlbumTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k, count], i) => {
        const [title, artist] = k.split("\u0001");
        return {
          rank: i + 1,
          title,
          artist: artist || "—",
          plays: count,
          year: "",
          bg: tintFor(title + artist),
          image_url: scrobbleImages["album\u0001" + k] || null,
        };
      });
    const top_albums = albumsFromWeekly.length ? albumsFromWeekly : albumsFromScrobbles;

    // ── daily_series ───────────────────────
    // Chart: last 90 days, each day = { date, scrobbles, moving_avg }.
    const daily90 = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const s = statsArr.find(x => x.stat_date === iso);
      daily90.push({ date: iso, scrobbles: s?.scrobble_count || 0 });
    }
    for (let i = 0; i < daily90.length; i++) {
      const from = Math.max(0, i - 6);
      const slice = daily90.slice(from, i + 1);
      const avg = slice.reduce((a, x) => a + x.scrobbles, 0) / slice.length;
      daily90[i].moving_avg = Math.round(avg);
    }

    // ── heatmap (hour × weekday) ───────────
    // Panel expects grid[0]=Sunday (it reorders [1..6,0] → Mon first).
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    (scrobbles || []).forEach(sc => {
      if (!sc.scrobbled_at) return;
      const d = new Date(sc.scrobbled_at);
      const dow = d.getDay(); // 0=Sunday, 1=Monday…
      const hr = d.getHours();
      grid[dow][hr] += 1;
    });

    // ── genres_30d ─────────────────────────
    // Panel shape (panel-musique.jsx): { label, share 0..1, color, change }.
    // We also emit `name` as an alias — the hero line reads g.name.
    const cutoff30 = new Date(now); cutoff30.setDate(now.getDate() - 30);
    const cutoff30Iso = cutoff30.toISOString().slice(0, 10);
    const genreTally = {};
    (genres || []).filter(g => (g.week_start || "") >= cutoff30Iso).forEach(g => {
      const key = g.genre || g.top_tag || "autres";
      genreTally[key] = (genreTally[key] || 0) + (Number(g.scrobble_count) || 0);
    });
    const genreTotal = Object.values(genreTally).reduce((a, b) => a + b, 0) || 1;
    const GENRE_COLORS = ["#3a1e2e","#2a3d2e","#1a2438","#1a2a2a","#3a2e1a","#2a1e38","#2e2a1e","#1e2e3a"];
    const genres_30d = Object.entries(genreTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count], i) => ({
        name,
        label: name,
        scrobbles: count,
        share: count / genreTotal,
        pct: Math.round((count / genreTotal) * 100),
        color: GENRE_COLORS[i % GENRE_COLORS.length],
        change: 0,
      }));

    // ── now_playing ────────────────────────
    // Always emit a safe placeholder so the hero never crashes on
    // D.now_playing.album_art_hint when the DB is empty.
    const latest = (scrobbles || [])[0];
    let now_playing = {
      track: "—",
      artist: "—",
      album: "",
      ago: "",
      started_at: "",
      scrobble_count_track: 0,
      scrobble_count_artist: 0,
      loved: false,
      image_url: null,
      album_art_hint: "var(--tx)",
      is_live: false,
    };
    if (latest) {
      // Count total plays of this exact track + total plays of this artist
      // across the 200-scrobble window we fetched.
      let trackPlays = 0, artistPlays = 0;
      (scrobbles || []).forEach(sc => {
        if (sc.artist_name === latest.artist_name) artistPlays++;
        if (sc.track_name === latest.track_name && sc.artist_name === latest.artist_name) trackPlays++;
      });
      const isLoved = (loved || []).some(l =>
        (l.track_name || "").toLowerCase() === (latest.track_name || "").toLowerCase() &&
        (l.artist_name || "").toLowerCase() === (latest.artist_name || "").toLowerCase()
      );
      // is_live left false by default — the frontend polling hook
      // (useLiveNowPlaying) flips it to true when Last.fm reports the
      // user as actively scrobbling right now.
      const ageMs = Date.now() - new Date(latest.scrobbled_at).getTime();
      now_playing = {
        track: latest.track_name || "—",
        artist: latest.artist_name || "—",
        album: latest.album_name || "",
        ago: relTime(latest.scrobbled_at),
        started_at: relTime(latest.scrobbled_at),
        scrobble_count_track: trackPlays,
        scrobble_count_artist: artistPlays,
        loved: isLoved,
        image_url: latest.image_url || null,
        album_art_hint: tintFor((latest.album_name || "") + (latest.artist_name || "x")),
        is_live: ageMs < 6 * 60 * 1000, // optimistic — confirmed/overridden by live poll
      };
    }

    // ── discoveries (nouveaux artistes 90 derniers jours) ──
    // Panel shape: { artist, scrobbles, first_scrobble, genre, verdict, note }.
    // Data source is the `music_discoveries` Supabase RPC which aggregates
    // music_scrobbles server-side to find artists whose FIRST scrobble
    // landed in the last 90 days. `newArtists` = RPC rows:
    // { artist_name, first_scrobble, scrobbles_recent, scrobbles_total, image_url }.
    const classifyVerdict = (plays) =>
      plays >= 50 ? "accroché" : plays >= 15 ? "à creuser" : "abandonné";
    const rpcDiscoveries = Array.isArray(newArtists) ? newArtists : [];
    const discoveriesFromRpc = rpcDiscoveries.slice(0, 12).map(r => {
      const first = r.first_scrobble ? new Date(r.first_scrobble) : null;
      const daysAgo = first ? Math.max(1, Math.round((now.getTime() - first.getTime()) / dayMs)) : null;
      const plays = Number(r.scrobbles_recent) || 0;
      return {
        artist: r.artist_name || "—",
        scrobbles: plays,
        first_scrobble: daysAgo != null ? `il y a ${daysAgo}j` : "—",
        genre: "",
        verdict: classifyVerdict(plays),
        note: r.scrobbles_total && r.scrobbles_total > plays
          ? `${r.scrobbles_total} plays au total`
          : "",
      };
    });

    // Fallback: if the RPC returned nothing (brand new DB, or pre-migration),
    // use loved tracks so the section is at least meaningful.
    const discoveriesFinal = discoveriesFromRpc.length ? discoveriesFromRpc : (loved || []).slice(0, 8).map(l => ({
      artist: l.artist_name || l.artist || "—",
      scrobbles: 0,
      first_scrobble: relTime(l.loved_at),
      genre: "",
      verdict: "accroché",
      note: l.track_name ? `Loved : ${l.track_name}` : "",
    }));

    // ── milestones (2026 YTD) ──
    // Panel shape: { label, value, sub, progress? }.
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const statsYtd = statsArr.filter(s => s.stat_date >= yearStart);
    const scrobblesYtd = statsYtd.reduce((a, s) => a + (Number(s.scrobble_count) || 0), 0);
    const minutesYtd = statsYtd.reduce((a, s) => a + (Number(s.listening_minutes) || 0), 0);
    const hoursYtd = Math.round(minutesYtd / 60);
    const daysElapsed = Math.max(1, Math.round((now.getTime() - new Date(yearStart + "T00:00:00").getTime()) / dayMs));
    const avgHoursDay = (minutesYtd / 60 / daysElapsed);
    // Unique artists YTD — approximated from weekly tops + raw scrobbles union.
    const ytdArtists = new Set();
    (byCat.artist || []).filter(r => (r.week_start || "") >= yearStart).forEach(r => r.item_name && ytdArtists.add(r.item_name));
    (scrobbles || []).forEach(sc => { if (sc.artist_name) ytdArtists.add(sc.artist_name); });
    // Albums played ≥5× — count distinct album_name in music_top_weekly with max play_count >= 5.
    const albumMaxPlays = {};
    (byCat.album || []).filter(r => (r.week_start || "") >= yearStart).forEach(r => {
      const n = r.item_name;
      if (!n) return;
      const p = Number(r.play_count) || 0;
      if (!(n in albumMaxPlays) || p > albumMaxPlays[n]) albumMaxPlays[n] = p;
    });
    const albumsMin5 = Object.values(albumMaxPlays).filter(p => p >= 5).length;
    const topGenre = genres_30d[0]?.label || null;
    const topGenrePct = genres_30d[0] ? Math.round(genres_30d[0].share * 100) : null;
    const YTD_TARGET = 35000;
    const milestones = [
      {
        label: "Scrobbles " + now.getFullYear(),
        value: scrobblesYtd.toLocaleString("fr-FR"),
        sub: `objectif ${YTD_TARGET.toLocaleString("fr-FR")}`,
        progress: Math.min(1, scrobblesYtd / YTD_TARGET),
      },
      { label: "Artistes uniques", value: ytdArtists.size.toLocaleString("fr-FR"), sub: "YTD" },
      { label: "Nouvelles découvertes", value: String(discoveriesFinal.length), sub: "nouveaux artistes" },
      { label: "Albums écoutés ≥5×", value: String(albumsMin5), sub: "sur l'année" },
      { label: "Heure d'écoute estimée", value: `${hoursYtd.toLocaleString("fr-FR")} h`, sub: `~${avgHoursDay.toFixed(1)}h / jour` },
      topGenre
        ? { label: "Genre dominant", value: topGenre, sub: `${topGenrePct}% du temps` }
        : { label: "Genre dominant", value: "—", sub: "" },
    ];

    return {
      now_playing,
      totals: { last7, last30, last180: last180, all180: last180, ytd, hours_today, hours_week },
      streaks: { current_daily: streak, longest_daily: longest, current_top_artist_weeks: 0 },
      top_artists,
      top_tracks,
      top_albums,
      daily_series: daily90,
      heatmap: grid,
      genres_30d,
      discoveries: discoveriesFinal,
      milestones,
    };
  }

  // Build FORME_DATA shape from strava_activities.
  function transformForme(activities){
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const acts = (activities || []).slice();
    const inLastN = (iso, n) => iso && (now - new Date(iso).getTime()) <= n * dayMs;
    const last7 = acts.filter(a => inLastN(a.start_date, 7));
    const last30 = acts.filter(a => inLastN(a.start_date, 30));
    const last365 = acts.filter(a => inLastN(a.start_date, 365));
    const sumKm = rows => rows.reduce((s, a) => s + (Number(a.distance_m) || 0) / 1000, 0);
    const sumMin = rows => rows.reduce((s, a) => s + (Number(a.moving_time_s) || 0) / 60, 0);
    const sumHours = rows => sumMin(rows) / 60;

    // Week-by-week training load for the chart (last 12 weeks).
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
      const to = new Date(now - w * 7 * dayMs);
      const from = new Date(now - (w + 1) * 7 * dayMs);
      const acsWk = acts.filter(a => {
        const t = new Date(a.start_date).getTime();
        return t >= from.getTime() && t < to.getTime();
      });
      weeks.push({
        week_start: from.toISOString().slice(0, 10),
        sessions: acsWk.length,
        km: Math.round(sumKm(acsWk)),
        minutes: Math.round(sumMin(acsWk)),
        suffer: acsWk.reduce((s, a) => s + (Number(a.suffer_score) || 0), 0),
      });
    }

    // Journal: last 20 activities.
    const journal = acts.slice(0, 20).map(a => ({
      id: a.id,
      date: (a.start_date || "").slice(0, 10),
      sport_type: a.sport_type || "—",
      name: a.name || a.sport_type || "Activité",
      distance_km: Math.round((Number(a.distance_m) || 0) / 100) / 10,
      moving_min: Math.round((Number(a.moving_time_s) || 0) / 60),
      avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
      calories: a.calories || null,
      suffer: a.suffer_score || null,
    }));

    return {
      totals: {
        sessions_7d: last7.length,
        sessions_30d: last30.length,
        km_7d: Math.round(sumKm(last7)),
        km_30d: Math.round(sumKm(last30)),
        minutes_7d: Math.round(sumMin(last7)),
        hours_30d: Math.round(sumHours(last30)),
        km_ytd: Math.round(sumKm(last365.filter(a => a.start_date.startsWith(new Date(now).getFullYear())))),
      },
      weeks,
      journal,
      latest: acts[0] || null,
    };
  }

  // Build GAMING_PERSO_DATA shape from Steam tables.
  function transformGaming({ snapshot, stats, achievements }){
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const statsArr = stats || [];
    const snap = snapshot || [];
    const ach = achievements || [];
    const inRange = (d, days) => d && (new Date(d + "T00:00:00").getTime() >= now - days * dayMs);

    const minutes_7d = statsArr.filter(s => inRange(s.stat_date, 7)).reduce((a, s) => a + (Number(s.total_playtime_minutes) || 0), 0);
    const minutes_30d = statsArr.filter(s => inRange(s.stat_date, 30)).reduce((a, s) => a + (Number(s.total_playtime_minutes) || 0), 0);

    // Daily chart last 30 days.
    const daily30 = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * dayMs);
      const iso = d.toISOString().slice(0, 10);
      const s = statsArr.find(x => x.stat_date === iso);
      daily30.push({ date: iso, minutes: s?.total_playtime_minutes || 0 });
    }

    const top_games = snap.slice(0, 10).map(g => ({
      name: g.name || "—",
      playtime_minutes: g.playtime_forever_minutes || 0,
      playtime_2weeks: g.playtime_2weeks_minutes || 0,
      header: g.img_icon_url,
    }));

    return {
      totals: {
        library_size: snap.length,
        minutes_7d,
        minutes_30d,
        hours_30d: Math.round(minutes_30d / 60),
        achievements_total: ach.length,
      },
      top_games,
      recent_achievements: ach.slice(0, 20).map(a => ({
        game: a.appid || "—",
        name: a.display_name || a.api_name || "—",
        when: relTime(a.unlocked_at),
      })),
      daily_series: daily30,
      now_playing: snap.find(g => (g.playtime_2weeks_minutes || 0) > 0) || null,
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
  // Sport feed transformer — same shape as veille, but category-first
  // (no "section" column on sport_articles, so we colour by discipline).
  const SPORT_CATEGORY_LABELS = {
    foot: "Football", rugby: "Rugby", cyclisme: "Cyclisme",
    tennis: "Tennis", natation: "Natation", esport: "E-sport",
  };
  const SPORT_CATEGORY_ICONS = {
    foot: "flag", rugby: "flag", cyclisme: "sparkles",
    tennis: "flag", natation: "sparkles", esport: "bot",
  };
  function normalizeSportSource(src){
    if (!src) return "—";
    if (src.startsWith("L'Equipe") || src.startsWith("L'Équipe")) return "L'Équipe";
    if (src.startsWith("RMC")) return "RMC Sport";
    return src;
  }
  function guessSportType(title){
    const t = (title || "").toLowerCase();
    if (/transfert|mercato|signe|signé|rejoint|quitt|prolonge/.test(t)) return "Transfert";
    if (/interview|confie|déclar|explique/.test(t)) return "Interview";
    if (/record|victoire|remporte|s['’]impose|bat\s|gagne|triomphe/.test(t)) return "Match";
    if (/bless|forfait|absent/.test(t)) return "Blessure";
    if (/analyse|décrypt|tactique/.test(t)) return "Analyse";
    return "Actu";
  }
  function transformSportFeed(articles){
    const readMap = getReadMap();
    return (articles || []).map(a => {
      const when = a.date_published || a.date_fetched || Date.now();
      const dateH = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 3600000));
      return {
        id: a.id,
        actor: normalizeSportSource(a.source),
        category: a.category || "autre",
        type: guessSportType(a.title),
        date_h: dateH,
        date_label: relTime(when),
        title: a.title || "",
        summary: stripHtml(a.summary || "").slice(0, 260),
        tags: ["#" + (a.category || "sport")],
        unread: !readMap[a.id],
        starred: false,
        icon: SPORT_CATEGORY_ICONS[a.category] || "flag",
        url: a.url,
      };
    });
  }

  // Gaming feed transformer — same contract as transformSportFeed but with
  // gaming-specific category labels and icons.
  const GAMING_CATEGORY_LABELS = {
    releases: "Sorties récentes", upcoming: "À venir",
    esport: "E-sport", industry: "Industrie",
  };
  const GAMING_CATEGORY_ICONS = {
    releases: "sparkles", upcoming: "flag",
    esport: "bot", industry: "wrench",
  };
  function normalizeGamingSource(src){
    if (!src) return "—";
    if (src.startsWith("L'Equipe") || src.startsWith("L'Équipe")) return "L'Équipe E-sport";
    return src;
  }
  function guessGamingType(title){
    const t = (title || "").toLowerCase();
    if (/review|critique|test|verdict|note/.test(t)) return "Critique";
    if (/patch|update|mise à jour|hotfix/.test(t)) return "Patch";
    if (/trailer|teaser|showcase|direct/.test(t)) return "Trailer";
    if (/interview|explique|confie/.test(t)) return "Interview";
    if (/leak|leaked|fuite|rumeur|rumour/.test(t)) return "Rumeur";
    if (/acquires|acquisition|racheté|layoff|licenc/.test(t)) return "Deal";
    if (/sortie|release|launch|disponible|out now/.test(t)) return "Sortie";
    if (/annonce|announce|reveal|révél/.test(t)) return "Annonce";
    return "Actu";
  }
  function transformGamingFeed(articles){
    const readMap = getReadMap();
    return (articles || []).map(a => {
      const when = a.date_published || a.date_fetched || Date.now();
      const dateH = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 3600000));
      return {
        id: a.id,
        actor: normalizeGamingSource(a.source),
        category: a.category || "releases",
        type: guessGamingType(a.title),
        date_h: dateH,
        date_label: relTime(when),
        title: a.title || "",
        summary: stripHtml(a.summary || "").slice(0, 260),
        tags: ["#" + (a.category || "gaming")],
        unread: !readMap[a.id],
        starred: false,
        icon: GAMING_CATEGORY_ICONS[a.category] || "flag",
        url: a.url,
      };
    });
  }

  // Anime / Cinéma / Séries feed transformer
  const ANIME_CATEGORY_LABELS = {
    released: "Sorties récentes", upcoming: "À venir prochainement",
    industry: "Industrie",
  };
  const ANIME_CATEGORY_ICONS = {
    released: "sparkles", upcoming: "flag", industry: "wrench",
  };
  function normalizeAnimeSource(src){
    if (!src) return "—";
    if (src.startsWith("AlloCiné")) return "AlloCiné";
    return src;
  }
  function guessAnimeType(title){
    const t = (title || "").toLowerCase();
    if (/review|critique|our verdict|test|recap/.test(t)) return "Critique";
    if (/trailer|teaser|bande[- ]annonce|first look/.test(t)) return "Trailer";
    if (/interview|confie|explique/.test(t)) return "Interview";
    if (/box[- ]office|audiences?|ratings|viewership/.test(t)) return "Audience";
    if (/acquires|acquisition|racheté|layoff|fermeture/.test(t)) return "Deal";
    if (/premiere|premiered|premier épisode|finale|episode \d+|épisode \d+/.test(t)) return "Diffusion";
    if (/announced|annonce|révélé|greenlit|renewed|delayed/.test(t)) return "Annonce";
    if (/sortie|release|launch|disponible|premieres|streaming now/.test(t)) return "Sortie";
    return "Actu";
  }
  function transformAnimeFeed(articles){
    const readMap = getReadMap();
    return (articles || []).map(a => {
      const when = a.date_published || a.date_fetched || Date.now();
      const dateH = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 3600000));
      return {
        id: a.id,
        actor: normalizeAnimeSource(a.source),
        category: a.category || "released",
        type: guessAnimeType(a.title),
        date_h: dateH,
        date_label: relTime(when),
        title: a.title || "",
        summary: stripHtml(a.summary || "").slice(0, 260),
        tags: ["#" + (a.category || "anime")],
        unread: !readMap[a.id],
        starred: false,
        icon: ANIME_CATEGORY_ICONS[a.category] || "flag",
        url: a.url,
      };
    });
  }

  // News (actualités) feed transformer
  const NEWS_CATEGORY_LABELS = {
    paris: "Paris", france: "France", international: "International",
  };
  const NEWS_CATEGORY_ICONS = {
    paris: "flag", france: "flag", international: "sparkles",
  };
  function normalizeNewsSource(src){
    if (!src) return "—";
    if (src.startsWith("Le Parisien")) return "Le Parisien";
    if (src.startsWith("20 Minutes")) return "20 Minutes";
    if (src.startsWith("Le Monde")) return "Le Monde";
    if (src.startsWith("FranceInfo")) return "FranceInfo";
    if (src.startsWith("RFI")) return "RFI";
    return src;
  }
  function guessNewsType(title){
    const t = (title || "").toLowerCase();
    if (/interview|confie|explique|témoignage/.test(t)) return "Interview";
    if (/tribune|édito|éditorial|opinion|point de vue/.test(t)) return "Tribune";
    if (/analyse|décrypt|enquête|reportage/.test(t)) return "Analyse";
    if (/direct|en direct|suivez|minute par minute/.test(t)) return "Live";
    if (/annonce|déclare|confirme|assure/.test(t)) return "Annonce";
    return "Actu";
  }
  function transformNewsFeed(articles){
    const readMap = getReadMap();
    return (articles || []).map(a => {
      const when = a.date_published || a.date_fetched || Date.now();
      const dateH = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 3600000));
      return {
        id: a.id,
        actor: normalizeNewsSource(a.source),
        category: a.category || "france",
        type: guessNewsType(a.title),
        date_h: dateH,
        date_label: relTime(when),
        title: a.title || "",
        summary: stripHtml(a.summary || "").slice(0, 260),
        tags: ["#" + (a.category || "actu")],
        unread: !readMap[a.id],
        starred: false,
        icon: NEWS_CATEGORY_ICONS[a.category] || "flag",
        url: a.url,
      };
    });
  }

  // ─── Jarvis transformers ──────────────────────────────────
  // Conversations are stored oldest→newest chronologically but the
  // query returns desc; we reverse and inject day-level "stamp" entries
  // so the UI's existing stamp component keeps working.
  function transformJarvisMessages(rows){
    if (!rows || !rows.length) return [];
    const chrono = rows.slice().reverse();
    const out = [];
    let lastStamp = null;
    const DAY = 86400000;
    chrono.forEach(r => {
      const d = r.created_at ? new Date(r.created_at) : new Date();
      const dayKey = d.toISOString().slice(0, 10);
      if (dayKey !== lastStamp) {
        const daysAgo = Math.floor((Date.now() - d.getTime()) / DAY);
        const label = daysAgo === 0 ? "Aujourd'hui"
          : daysAgo === 1 ? "Hier"
          : daysAgo < 7 ? `Il y a ${daysAgo} jours`
          : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        out.push({ kind: "stamp", label });
        lastStamp = dayKey;
      }
      out.push({
        kind: r.role === "user" ? "user" : "jarvis",
        text: r.content || "",
        ts: d.getTime(),
        mode: r.mode || null,
        id: r.id,
      });
    });
    return out;
  }

  // fact_type → category mapping for the memory column.
  const FACT_CATEGORY = {
    context: "profil",
    profile: "profil",
    skill: "profil",
    preference: "préférences",
    opinion: "positions",
    position: "positions",
    goal: "projets",
    project: "projets",
    constraint: "contraintes",
    interest: "intérêts",
  };
  function transformJarvisFacts(rows){
    const pinned = (() => {
      try { return JSON.parse(localStorage.getItem("jarvis-fact-pinned") || "{}"); }
      catch { return {}; }
    })();
    return (rows || []).map(f => {
      const category = FACT_CATEGORY[f.fact_type] || "profil";
      const text = f.fact_text || "";
      const label = (f.fact_type || "fait").replace(/^\w/, c => c.toUpperCase());
      const learnedDate = f.created_at ? relTime(f.created_at) : "—";
      const strength = f.confidence >= 0.85 ? "strong" : f.confidence >= 0.6 ? "medium" : "weak";
      return {
        id: f.id,
        category,
        label,
        value: text.length > 240 ? text.slice(0, 240) + "…" : text,
        source: f.source || "conversation",
        learned: learnedDate,
        strength,
        pinned: !!pinned[f.id],
        editable: true,
      };
    });
  }

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
      case "sport": {
        const articles = await T2.sport();
        if (window.SPORT_DATA && articles.length) {
          window.SPORT_DATA.feed = transformSportFeed(articles);
          const fresh = articles[0];
          // KPIs: volume 24h / 7j, top discipline (7j), distinct sources.
          const now = Date.now();
          const ageH = a => {
            const t = new Date(a.date_published || a.date_fetched || 0).getTime();
            return (now - t) / 3600000;
          };
          const last24h = articles.filter(a => ageH(a) <= 24).length;
          const last7d = articles.filter(a => ageH(a) <= 24 * 7);
          const catCounts7d = {};
          last7d.forEach(a => {
            const k = a.category || "autre";
            catCounts7d[k] = (catCounts7d[k] || 0) + 1;
          });
          const topCatEntry = Object.entries(catCounts7d).sort((a, b) => b[1] - a[1])[0];
          const topCat = topCatEntry ? (SPORT_CATEGORY_LABELS[topCatEntry[0]] || topCatEntry[0]) : "—";
          const topCatCount = topCatEntry ? topCatEntry[1] : 0;
          const sourcesN = new Set(articles.map(a => normalizeSportSource(a.source))).size;
          if (fresh) {
            const freshLabel = SPORT_CATEGORY_LABELS[fresh.category] || fresh.category || "Sport";
            window.SPORT_DATA.headline = {
              ...(window.SPORT_DATA.headline || {}),
              kicker: freshLabel + " · " + (relTime(fresh.date_published || fresh.date_fetched) || "récent"),
              actor: normalizeSportSource(fresh.source),
              version: freshLabel,
              tagline: fresh.title || "",
              body: stripHtml(fresh.summary || "").slice(0, 320) || fresh.title || "",
              metrics: [
                { label: "Articles 24h", value: String(last24h), delta: last24h ? "+" + last24h : "=" },
                { label: "Articles 7j", value: String(last7d.length), delta: "=" },
                { label: "Top discipline", value: topCat, delta: topCatCount ? "+" + topCatCount : "=" },
                { label: "Sources", value: String(sourcesN), delta: "=" },
              ],
              tags: ["#sport", "#" + (fresh.category || "actu")],
            };
          }
          // Build actors from unique normalised sources (used for ActorMark + color).
          const sourceColors = {
            "L'Équipe": "#e4002b",
            "RMC Sport": "#004080",
            "Millenium": "#ff6600",
            "Cyclism'Actu": "#0a8a4c",
          };
          const srcMap = new Map();
          articles.forEach(a => {
            const name = normalizeSportSource(a.source);
            if (!srcMap.has(name)) {
              srcMap.set(name, {
                id: name.toLowerCase().replace(/\W+/g, "-"),
                name,
                mark: name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase(),
                color: sourceColors[name] || "#555",
                followed: true,
                last_activity: relTime(a.date_published || a.date_fetched),
                last_title: a.title || "",
                momentum: "",
                pulse: [0, 0, 0, 0, 0, 0, 0, 0],
                note: "",
              });
            }
            const actor = srcMap.get(name);
            actor.pulse[7] = (actor.pulse[7] || 0) + 1;
          });
          window.SPORT_DATA.actors = Array.from(srcMap.values());
          // Trends = one pseudo-trend per discipline, weighted by volume.
          const byCategory = {};
          articles.forEach(a => {
            const k = a.category || "autre";
            byCategory[k] = (byCategory[k] || 0) + 1;
          });
          window.SPORT_DATA.trends = Object.entries(byCategory)
            .map(([cat, count]) => ({
              id: "tsp-" + cat,
              label: SPORT_CATEGORY_LABELS[cat] || cat,
              kicker: "Discipline",
              momentum: count + " articles · 30j",
              pulse: [0, 0, 0, 0, 0, 0, 0, count],
              articles_count: count,
              summary: count + " articles récents en " + (SPORT_CATEGORY_LABELS[cat] || cat) + ".",
              actors_involved: [],
              status: count >= 20 ? "rising" : count >= 10 ? "stable" : "new",
            }))
            .sort((a, b) => b.articles_count - a.articles_count);
        }
        return { articles };
      }
      case "gaming_news": {
        const articles = await T2.gaming_news();
        if (window.GAMING_DATA && articles.length) {
          window.GAMING_DATA.feed = transformGamingFeed(articles);
          const fresh = articles[0];
          const now = Date.now();
          const ageH = a => {
            const t = new Date(a.date_published || a.date_fetched || 0).getTime();
            return (now - t) / 3600000;
          };
          const last24h = articles.filter(a => ageH(a) <= 24).length;
          const last7d = articles.filter(a => ageH(a) <= 24 * 7);
          const catCounts7d = {};
          last7d.forEach(a => {
            const k = a.category || "releases";
            catCounts7d[k] = (catCounts7d[k] || 0) + 1;
          });
          const topCatEntry = Object.entries(catCounts7d).sort((a, b) => b[1] - a[1])[0];
          const topCat = topCatEntry ? (GAMING_CATEGORY_LABELS[topCatEntry[0]] || topCatEntry[0]) : "—";
          const topCatCount = topCatEntry ? topCatEntry[1] : 0;
          const sourcesN = new Set(articles.map(a => normalizeGamingSource(a.source))).size;
          if (fresh) {
            const freshLabel = GAMING_CATEGORY_LABELS[fresh.category] || fresh.category || "Gaming";
            window.GAMING_DATA.headline = {
              ...(window.GAMING_DATA.headline || {}),
              kicker: freshLabel + " · " + (relTime(fresh.date_published || fresh.date_fetched) || "récent"),
              actor: normalizeGamingSource(fresh.source),
              version: freshLabel,
              tagline: fresh.title || "",
              body: stripHtml(fresh.summary || "").slice(0, 320) || fresh.title || "",
              metrics: [
                { label: "Articles 24h", value: String(last24h), delta: last24h ? "+" + last24h : "=" },
                { label: "Articles 7j", value: String(last7d.length), delta: "=" },
                { label: "Top rubrique", value: topCat, delta: topCatCount ? "+" + topCatCount : "=" },
                { label: "Sources", value: String(sourcesN), delta: "=" },
              ],
              tags: ["#gaming", "#" + (fresh.category || "actu")],
            };
          }
          // Actors = sources (Dexerto, IGN, PC Gamer…)
          const sourceColors = {
            "JeuxVideo.com": "#e60000",
            "Gamekult": "#f26522",
            "ActuGaming": "#2d9cdb",
            "IGN": "#bf1e2d",
            "Eurogamer": "#7700bb",
            "PC Gamer": "#af1e23",
            "GamesIndustry.biz": "#222",
            "Dexerto": "#ff6600",
            "L'Équipe E-sport": "#e4002b",
          };
          const srcMap = new Map();
          articles.forEach(a => {
            const name = normalizeGamingSource(a.source);
            if (!srcMap.has(name)) {
              srcMap.set(name, {
                id: name.toLowerCase().replace(/\W+/g, "-"),
                name,
                mark: name.split(/[\s.]/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase(),
                color: sourceColors[name] || "#555",
                followed: true,
                last_activity: relTime(a.date_published || a.date_fetched),
                last_title: a.title || "",
                momentum: "",
                pulse: [0, 0, 0, 0, 0, 0, 0, 0],
                note: "",
              });
            }
            srcMap.get(name).pulse[7]++;
          });
          window.GAMING_DATA.actors = Array.from(srcMap.values());
          // Trends = one per rubrique.
          window.GAMING_DATA.trends = Object.entries(catCounts7d)
            .map(([cat, count]) => ({
              id: "tg-" + cat,
              label: GAMING_CATEGORY_LABELS[cat] || cat,
              kicker: "Rubrique",
              momentum: count + " articles · 7j",
              pulse: [0, 0, 0, 0, 0, 0, 0, count],
              articles_count: count,
              summary: count + " articles récents en " + (GAMING_CATEGORY_LABELS[cat] || cat) + ".",
              actors_involved: [],
              status: count >= 15 ? "rising" : count >= 8 ? "stable" : "new",
            }))
            .sort((a, b) => b.articles_count - a.articles_count);
        }
        return { articles };
      }
      case "anime": {
        const articles = await T2.anime();
        if (window.ANIME_DATA && articles.length) {
          window.ANIME_DATA.feed = transformAnimeFeed(articles);
          const fresh = articles[0];
          const now = Date.now();
          const ageH = a => {
            const t = new Date(a.date_published || a.date_fetched || 0).getTime();
            return (now - t) / 3600000;
          };
          const last24h = articles.filter(a => ageH(a) <= 24).length;
          const last7d = articles.filter(a => ageH(a) <= 24 * 7);
          const catCounts7d = {};
          last7d.forEach(a => {
            const k = a.category || "released";
            catCounts7d[k] = (catCounts7d[k] || 0) + 1;
          });
          const topCatEntry = Object.entries(catCounts7d).sort((a, b) => b[1] - a[1])[0];
          const topCat = topCatEntry ? (ANIME_CATEGORY_LABELS[topCatEntry[0]] || topCatEntry[0]) : "—";
          const topCatCount = topCatEntry ? topCatEntry[1] : 0;
          const sourcesN = new Set(articles.map(a => normalizeAnimeSource(a.source))).size;
          if (fresh) {
            const freshLabel = ANIME_CATEGORY_LABELS[fresh.category] || fresh.category || "Actu";
            window.ANIME_DATA.headline = {
              ...(window.ANIME_DATA.headline || {}),
              kicker: freshLabel + " · " + (relTime(fresh.date_published || fresh.date_fetched) || "récent"),
              actor: normalizeAnimeSource(fresh.source),
              version: freshLabel,
              tagline: fresh.title || "",
              body: stripHtml(fresh.summary || "").slice(0, 320) || fresh.title || "",
              metrics: [
                { label: "Articles 24h", value: String(last24h), delta: last24h ? "+" + last24h : "=" },
                { label: "Articles 7j", value: String(last7d.length), delta: "=" },
                { label: "Top statut", value: topCat, delta: topCatCount ? "+" + topCatCount : "=" },
                { label: "Sources", value: String(sourcesN), delta: "=" },
              ],
              tags: ["#anime", "#" + (fresh.category || "actu")],
            };
          }
          // Actors = sources
          const sourceColors = {
            "AlloCiné": "#fec300",
            "Première": "#000000",
            "Écran Large": "#c62828",
            "Anime News Network": "#265a8f",
            "MyAnimeList": "#2e51a2",
            "Deadline": "#d50000",
            "Variety": "#003c71",
            "Hollywood Reporter": "#bf1a1a",
            "IndieWire": "#2e6a4f",
          };
          const srcMap = new Map();
          articles.forEach(a => {
            const name = normalizeAnimeSource(a.source);
            if (!srcMap.has(name)) {
              srcMap.set(name, {
                id: name.toLowerCase().replace(/\W+/g, "-"),
                name,
                mark: name.split(/[\s.]/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase(),
                color: sourceColors[name] || "#555",
                followed: true,
                last_activity: relTime(a.date_published || a.date_fetched),
                last_title: a.title || "",
                momentum: "",
                pulse: [0, 0, 0, 0, 0, 0, 0, 0],
                note: "",
              });
            }
            srcMap.get(name).pulse[7]++;
          });
          window.ANIME_DATA.actors = Array.from(srcMap.values());
          // Trends
          window.ANIME_DATA.trends = Object.entries(catCounts7d)
            .map(([cat, count]) => ({
              id: "ta-" + cat,
              label: ANIME_CATEGORY_LABELS[cat] || cat,
              kicker: "Statut",
              momentum: count + " articles · 7j",
              pulse: [0, 0, 0, 0, 0, 0, 0, count],
              articles_count: count,
              summary: count + " articles récents en " + (ANIME_CATEGORY_LABELS[cat] || cat) + ".",
              actors_involved: [],
              status: count >= 15 ? "rising" : count >= 8 ? "stable" : "new",
            }))
            .sort((a, b) => b.articles_count - a.articles_count);
          // prod_cases = tous les animes Jikan upcoming triés par date de diffusion asc.
          // Le panel affiche ces données en mode tableau + filtre 3 prochains mois.
          const MONTHS_FR = ["janv.","févr.","mars","avril","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
          const jikanUpcoming = articles
            .filter(a => a.source === "MyAnimeList" && a.category === "upcoming" && a.date_published)
            .sort((a, b) => new Date(a.date_published) - new Date(b.date_published));
          window.ANIME_DATA.prod_cases = jikanUpcoming.map(a => {
            const dt = new Date(a.date_published);
            const isoValid = !isNaN(dt);
            const whenLabel = isoValid ? `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}` : "—";
            const typeMatch = (a.title || "").match(/^\[(TV|Movie|OVA|Special|ONA)\]\s*/i);
            const cleanTitle = (a.title || "").replace(/^\[[^\]]+\]\s*/, "");
            const atype = typeMatch ? typeMatch[1] : "Anime";
            const studioMatch = (a.summary || "").match(/Studio\s*:\s*([^·]+?)(?:\s*·|$)/);
            const studio = studioMatch ? studioMatch[1].trim() : "";
            const mark = cleanTitle.split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 3).toUpperCase();
            return {
              company: cleanTitle.slice(0, 80),
              logo_mark: mark || "??",
              color: "#2e51a2",
              scale: studio || "MyAnimeList",
              model: studio || "MAL",
              domain: atype,
              when: whenLabel,
              air_iso: isoValid ? dt.toISOString() : null,
              headline: (a.summary || "").replace(/^Studio\s*:[^·]+·\s*(?:[^·]+·\s*)?/, "").slice(0, 200) || "À paraître prochainement.",
              impact: `Diffusion ${whenLabel}`,
              url: a.url,
            };
          });
        }
        return { articles };
      }
      case "jarvis": {
        const [rawMessages, rawFacts] = await Promise.all([T2.jarvis_messages(), T2.jarvis_facts()]);
        if (window.JARVIS_DATA) {
          if (rawMessages.length) {
            window.JARVIS_DATA.messages = transformJarvisMessages(rawMessages);
            const first = rawMessages[rawMessages.length - 1]; // oldest after desc fetch
            const last = rawMessages[0];
            const totalMs = first && last ? (new Date(last.created_at) - new Date(first.created_at)) : 0;
            window.JARVIS_DATA.meta = {
              ...(window.JARVIS_DATA.meta || {}),
              first_conversation: first?.created_at?.slice(0, 10) || window.JARVIS_DATA.meta?.first_conversation,
              total_messages: rawMessages.length,
              total_hours: Math.max(1, Math.round(totalMs / 3600000)),
              last_active: last?.created_at ? relTime(last.created_at) : "—",
            };
            const today = isoToday();
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            const costToday = rawMessages
              .filter(r => (r.created_at || "").slice(0, 10) === today)
              .reduce((s, r) => s + (r.mode === "cloud" ? (r.tokens_used || 0) * 0.000004 : 0), 0);
            window.JARVIS_DATA.stats = {
              ...(window.JARVIS_DATA.stats || {}),
              messages_today: rawMessages.filter(r => (r.created_at || "").slice(0, 10) === today).length,
              messages_week: rawMessages.filter(r => (r.created_at || "") >= weekAgo).length,
              cost_today_eur: Math.round(costToday * 100) / 100,
              cost_budget_eur: window.JARVIS_DATA.stats?.cost_budget_eur ?? 3,
            };
          }
          if (rawFacts.length) {
            window.JARVIS_DATA.memory = transformJarvisFacts(rawFacts);
            if (window.JARVIS_DATA.stats) {
              window.JARVIS_DATA.stats.memory_items = rawFacts.length;
              window.JARVIS_DATA.stats.memory_pinned = window.JARVIS_DATA.memory.filter(m => m.pinned).length;
            }
          }
        }
        return { messages: rawMessages, facts: rawFacts };
      }
      case "news": {
        const articles = await T2.news();
        if (window.NEWS_DATA && articles.length) {
          window.NEWS_DATA.feed = transformNewsFeed(articles);
          const fresh = articles[0];
          const now = Date.now();
          const ageH = a => {
            const t = new Date(a.date_published || a.date_fetched || 0).getTime();
            return (now - t) / 3600000;
          };
          const last24h = articles.filter(a => ageH(a) <= 24).length;
          const last7d = articles.filter(a => ageH(a) <= 24 * 7);
          const catCounts7d = {};
          last7d.forEach(a => {
            const k = a.category || "france";
            catCounts7d[k] = (catCounts7d[k] || 0) + 1;
          });
          const topCatEntry = Object.entries(catCounts7d).sort((a, b) => b[1] - a[1])[0];
          const topCat = topCatEntry ? (NEWS_CATEGORY_LABELS[topCatEntry[0]] || topCatEntry[0]) : "—";
          const topCatCount = topCatEntry ? topCatEntry[1] : 0;
          const sourcesN = new Set(articles.map(a => normalizeNewsSource(a.source))).size;
          if (fresh) {
            const freshLabel = NEWS_CATEGORY_LABELS[fresh.category] || fresh.category || "Actu";
            window.NEWS_DATA.headline = {
              ...(window.NEWS_DATA.headline || {}),
              kicker: freshLabel + " · " + (relTime(fresh.date_published || fresh.date_fetched) || "récent"),
              actor: normalizeNewsSource(fresh.source),
              version: freshLabel,
              tagline: fresh.title || "",
              body: stripHtml(fresh.summary || "").slice(0, 320) || fresh.title || "",
              metrics: [
                { label: "Articles 24h", value: String(last24h), delta: last24h ? "+" + last24h : "=" },
                { label: "Articles 7j", value: String(last7d.length), delta: "=" },
                { label: "Top zone", value: topCat, delta: topCatCount ? "+" + topCatCount : "=" },
                { label: "Sources", value: String(sourcesN), delta: "=" },
              ],
              tags: ["#actu", "#" + (fresh.category || "france")],
            };
          }
          // Actors = sources
          const sourceColors = {
            "Le Parisien": "#003594",
            "20 Minutes": "#00ad97",
            "BFM Paris": "#0066cc",
            "Le Monde": "#000000",
            "Le Figaro": "#1e3a8a",
            "FranceInfo": "#e20613",
            "Libération": "#d2142f",
            "BBC World": "#bb1919",
            "France 24": "#d9b15e",
            "RFI": "#cc0000",
          };
          const srcMap = new Map();
          articles.forEach(a => {
            const name = normalizeNewsSource(a.source);
            if (!srcMap.has(name)) {
              srcMap.set(name, {
                id: name.toLowerCase().replace(/\W+/g, "-"),
                name,
                mark: name.split(/[\s.]/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase(),
                color: sourceColors[name] || "#555",
                followed: true,
                last_activity: relTime(a.date_published || a.date_fetched),
                last_title: a.title || "",
                momentum: "",
                pulse: [0, 0, 0, 0, 0, 0, 0, 0],
                note: "",
              });
            }
            srcMap.get(name).pulse[7]++;
          });
          window.NEWS_DATA.actors = Array.from(srcMap.values());
          // Trends = one per zone
          window.NEWS_DATA.trends = Object.entries(catCounts7d)
            .map(([cat, count]) => ({
              id: "tn-" + cat,
              label: NEWS_CATEGORY_LABELS[cat] || cat,
              kicker: "Zone",
              momentum: count + " articles · 7j",
              pulse: [0, 0, 0, 0, 0, 0, 0, count],
              articles_count: count,
              summary: count + " articles récents pour " + (NEWS_CATEGORY_LABELS[cat] || cat) + ".",
              actors_involved: [],
              status: count >= 20 ? "rising" : count >= 10 ? "stable" : "new",
            }))
            .sort((a, b) => b.articles_count - a.articles_count);
        }
        return { articles };
      }
      case "wiki": {
        const concepts = await T2.wiki();
        if (window.WIKI_DATA) {
          window.WIKI_DATA._raw = concepts;
          const built = buildWikiFromConcepts(concepts);
          if (built) {
            // Remplace la fake data par le contenu réel
            window.WIKI_DATA.entries = built.entries;
            window.WIKI_DATA.categories = built.categories;
            window.WIKI_DATA.stats = built.stats;
          }
        }
        return { concepts };
      }
      case "signals": {
        // Fetch full signal_tracking history (Tier 1 ne garde que le top courant)
        // + wiki_concepts pour résoudre les catégories.
        const [sigRows, wikiRows] = await Promise.all([
          once("signals_full", () => q("signal_tracking", "order=week_start.desc,mention_count.desc&limit=500")),
          T2.wiki().catch(() => []),
        ]);
        if (window.SIGNALS_DATA) {
          window.SIGNALS_DATA._raw = sigRows;
          const built = buildSignalsFromDB(sigRows, wikiRows);
          if (built) Object.assign(window.SIGNALS_DATA, built);
        }
        return { signals: sigRows, wiki: wikiRows };
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
        const [challenges, attempts] = await Promise.all([
          T2.challenges(),
          T2.challengeAttempts().catch(() => []),
        ]);
        if (window.CHALLENGES_DATA) {
          window.CHALLENGES_DATA._raw = challenges;
          window.CHALLENGES_DATA._attempts = attempts || [];
          // Si la pipeline a écrit des challenges riches (mode + content),
          // on remplace la fake data par le contenu réel (mode par mode).
          // Sinon on garde la fake data comme fallback visuel.
          const axes = (window.APPRENTISSAGE_DATA && window.APPRENTISSAGE_DATA.radar && window.APPRENTISSAGE_DATA.radar.axes) || [];
          const theoryDB = (challenges || []).filter(c => c.mode === "theory" && c.content).map(r => mapWeeklyChallengeRow(r, axes));
          const practiceDB = (challenges || []).filter(c => c.mode === "practice" && c.content).map(r => mapWeeklyChallengeRow(r, axes));
          if (theoryDB.length)   window.CHALLENGES_DATA.theory   = theoryDB;
          if (practiceDB.length) window.CHALLENGES_DATA.practice = practiceDB;
          applyAttemptsToChallenges(window.CHALLENGES_DATA, attempts || []);
        }
        return { challenges, attempts };
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
          const shape = transformForme(activities);
          // Deep-merge: real data overrides matching keys, unknown fake
          // keys (weight_series, today.*, sessions[], etc.) stay so the
          // panel never reads undefined on fields we can't produce yet.
          mergeInto(window.FORME_DATA, shape);
          window.FORME_DATA._raw = activities;
        }
        return { activities };
      }
      case "music": {
        // Fail-hard version: if any of the 7 fetches throws, let the
        // caller see it so the UI can surface an error instead of
        // silently keeping the fake data.
        const [scrobbles, stats, top, loved, genres, insights, newArtists] = await Promise.all([
          T2.music_scrobbles(), T2.music_stats(), T2.music_top(),
          T2.music_loved(), T2.music_genres(), T2.music_insights(),
          T2.music_discoveries(),
        ]);
        // Always run the transformer. Even with every source empty, it
        // produces a complete shape with zeros / empty arrays — that's
        // the honest state of the DB. Leaving fake in place would lie.
        const shape = transformMusic({ scrobbles, stats, top, loved, genres, newArtists });
        if (window.MUSIC_DATA) {
          replaceShape(window.MUSIC_DATA, shape);
          window.MUSIC_DATA._raw = { scrobbles, stats, top, loved, genres, insights, newArtists };
        }
        return { scrobbles, stats, top, loved, genres, insights, newArtists };
      }
      case "gaming": {
        const [snapshot, stats, achievements] = await Promise.all([
          T2.steam_snapshot(), T2.steam_stats(), T2.steam_achievements(),
        ]);
        if (window.GAMING_PERSO_DATA && (snapshot || []).length) {
          const shape = transformGaming({ snapshot, stats, achievements });
          mergeInto(window.GAMING_PERSO_DATA, shape);
          window.GAMING_PERSO_DATA._raw = { snapshot, stats, achievements };
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
        // No Tier 2 work for this panel — return null so the App effect
        // can skip the dataVersion bump (avoids a cosmetic re-mount on
        // Tier 1-only panels like brief/top/week/jarvis/search).
        return null;
    }
  }

  // Panels that mutate a window.*_DATA global when their loadPanel case
  // runs. The App-level effect uses this to decide whether to bump
  // dataVersion after loadPanel resolves.
  const TIER2_PANELS = new Set([
    "updates", "wiki", "radar", "recos", "challenges", "opps", "ideas",
    "profile", "perf", "music", "gaming", "stacks", "history", "jobs",
    "sport", "gaming_news", "anime", "news", "jarvis", "signals",
  ]);

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
      window.SIGNALS_DATA._raw = raw.signals;
      // Merge DB signals into the rich panel shape.
      // wiki_concepts est lazy (Tier 2) — hydratation partielle ici, sera
      // re-remplacée par le case "signals" si l'utilisateur visite le panel.
      const built = buildSignalsFromDB(raw.signals, window.WIKI_DATA?._raw || []);
      if (built) {
        Object.assign(window.SIGNALS_DATA, built);
      }
    }
  }

  window.cockpitDataLoader = {
    bootTier1,
    loadPanel,
    hydrateGlobalsFromTier1,
    TIER2_PANELS,
    T2,
    cache,
    // shape builders re-exported for panels that want to rebuild parts live
    buildSignals, buildRadar, buildTop, buildMacro, buildWeek, buildStats, buildDateShape, buildUser,
    applyAttemptsToChallenges, mapWeeklyChallengeRow, buildWikiFromConcepts, buildSignalsFromDB,
    // helpers
    isoWeek, dayOfYear, relTime, stripHtml, getReadMap, computeStreak,
  };
})();
