// ═══════════════════════════════════════════════════════════════
// HISTORY_DATA — archive temporelle 60 jours
// Briefs passés avec macro / top / signaux / stats cohérents
// ═══════════════════════════════════════════════════════════════

(function () {
  const TODAY_ISO = "2026-04-21";

  // Seedable RNG pour stabilité entre recharges
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  function formatLong(d) {
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ─ Briefs types (pool) ─────────────────────────────
  const MACRO_POOL = [
    { title: "La bataille des agents passe en phase industrielle", body: "Anthropic ouvre Claude Agents en GA, OpenAI riposte avec Swarm v2, Mistral annonce BNP Paribas. Trois signaux convergents pour l'entreprise.", tag: "agents" },
    { title: "Nouvelle vague de modèles open-weight en Europe", body: "Mistral publie Mixtral 3, Aleph Alpha sort Pharia 2. L'Europe mise sur la souveraineté technique.", tag: "open-source" },
    { title: "L'AI Act entre en phase 3 — le grand ménage", body: "Guide d'application Commission publié. Les systèmes haut risque en scope, focus sur les assureurs et banques.", tag: "régulation" },
    { title: "Les SLM (petits modèles) reprennent la main", body: "Phi-4, Gemma 3, modèles < 10B en forte hausse. Déploiement edge et on-device au cœur des annonces.", tag: "slm" },
    { title: "Journée calme — peu de signaux forts", body: "Weekend ou jour férié. Veille passive, quelques communiqués entreprise sans surprise.", tag: "calme" },
    { title: "Incident OpenAI — 4h d'interruption mondiale", body: "GPT-5 et l'API inaccessibles entre 10h et 14h UTC. Reprise progressive, cause non communiquée.", tag: "incident" },
    { title: "Google I/O — Gemini 3 et nouveau SDK agent", body: "Annonce de Gemini 3 (5M tokens context), SDK agent natif, et pricing agressif pour contrer Anthropic.", tag: "google" },
    { title: "Context engineering — le terme qui remplace prompt engineering", body: "Nouveau buzzword du mois. Focus sur l'orchestration et la mémoire plutôt que la rédaction de prompts.", tag: "prompting" },
    { title: "Cursor et Claude Code cannibalisent Copilot", body: "Mentions GitHub Copilot en baisse. Les IDEs agentiques deviennent le standard développeur.", tag: "outils" },
    { title: "Apple Intelligence 2 — intégration Claude confirmée", body: "Rumeurs confirmées : Apple s'appuie sur Anthropic pour les requêtes complexes on-cloud. OpenAI écarté.", tag: "apple" },
    { title: "MCP devient le standard de facto", body: "Le Model Context Protocol d'Anthropic adopté par OpenAI et Google. Convergence rapide sur l'interop agents.", tag: "mcp" },
    { title: "Nvidia annonce Rubin — architecture successeur Blackwell", body: "Nouvelle génération de GPU data center, 4× perf / watt. Livraisons Q1 2027.", tag: "hardware" },
    { title: "Scandale données — 15 millions de convos ChatGPT fuitées", body: "Fuite massive sur le dark web, CNIL saisie, OpenAI en crise. Impact sur l'adoption entreprise.", tag: "incident" },
    { title: "DeepMind publie Gemini Ultra 2 — coding dominant", body: "SOTA sur SWE-bench Verified (78%). Benchmark closed, disponibilité progressive.", tag: "modèles" },
    { title: "France 2030 — 2Md€ supplémentaires sur l'IA", body: "Annonce Matignon. Focus sur les modèles souverains, le hardware et la formation.", tag: "france" },
  ];

  const SIGNALS_POOL = [
    "agent memory", "small language models", "ai act phase 3", "context engineering",
    "mcp", "copilot", "rag evaluation", "multi-agent systems", "long context",
    "on-device inference", "openai swarm", "anthropic claude agents", "gemini 3",
    "llm observability", "prompt caching", "structured outputs", "fine-tuning",
    "guardrails", "agent orchestration", "ai safety"
  ];

  const TOP_POOL = [
    { source: "Anthropic", section: "Agents", title: "Claude Agents GA — mémoire persistante et orchestration natives" },
    { source: "Les Échos", section: "FinServ", title: "BNP Paribas industrialise 140 cas d'usage IA avec Mistral" },
    { source: "Commission européenne", section: "Régulation", title: "AI Act phase 3 — obligations renforcées pour haut risque" },
    { source: "OpenAI", section: "Agents", title: "SDK Swarm v2 disponible en bêta publique" },
    { source: "Mistral AI", section: "Modèles", title: "Mixtral 3 — open-weight, 12B actifs, contexte 256K" },
    { source: "Google", section: "Modèles", title: "Gemini 3 annoncé — 5M tokens context et pricing agressif" },
    { source: "Apple", section: "Intégration", title: "Apple Intelligence 2 s'appuie sur Claude pour le cloud" },
    { source: "Nvidia", section: "Hardware", title: "Rubin succéde à Blackwell — 4× perf/watt" },
    { source: "ACPR", section: "Régulation", title: "Nouveau référentiel IA pour le secteur assurance" },
    { source: "Financial Times", section: "Market", title: "Valorisations IA — correction de 15% cette semaine" },
    { source: "The Verge", section: "Produits", title: "Cursor 2.0 — mode Composer devient standard" },
    { source: "ArXiv", section: "Recherche", title: "Papier MIT — scaling laws revisités pour SLMs" },
    { source: "Hacker News", section: "Communauté", title: "Post viral : ‘J'ai remplacé mon équipe par des agents'" },
    { source: "Anthropic", section: "Sécurité", title: "Constitution AI 2.0 — nouveau cadre d'alignement" },
    { source: "Meta", section: "Open", title: "Llama 4 Behemoth — previews chercheurs" },
    { source: "AWS", section: "Infra", title: "Bedrock Agents passe en GA, support MCP natif" },
    { source: "CNIL", section: "Régulation", title: "Fiche pratique — DPIA pour systèmes IA génératifs" },
    { source: "Le Monde", section: "Politique", title: "Le gouvernement veut un « Mistral souverain » pour l'administration" },
  ];

  // ─ Génère un brief pour un jour donné ──────────────
  function genBrief(daysAgo) {
    const d = new Date(TODAY_ISO);
    d.setDate(d.getDate() - daysAgo);
    const iso = d.toISOString().slice(0, 10);
    const rng = mulberry32(parseInt(iso.replace(/-/g, ""), 10));

    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;

    // Intensité du jour
    let intensity;
    if (isWeekend) intensity = rng() < 0.6 ? "calme" : "normal";
    else intensity = rng() < 0.2 ? "pic" : rng() < 0.6 ? "normal" : "calme";

    const articles =
      intensity === "pic" ? 60 + Math.floor(rng() * 25) :
      intensity === "calme" ? 8 + Math.floor(rng() * 12) :
      30 + Math.floor(rng() * 20);

    const signalsRising = intensity === "pic" ? 8 + Math.floor(rng() * 4) :
                          intensity === "calme" ? Math.floor(rng() * 2) :
                          3 + Math.floor(rng() * 4);

    // Choix macro
    const macroIdx = intensity === "calme" ? 4 : Math.floor(rng() * MACRO_POOL.length);
    const macro = MACRO_POOL[macroIdx];

    // Top 3 (pour briefs actifs)
    const topCount = intensity === "calme" ? 1 : 3;
    const topIndices = new Set();
    while (topIndices.size < topCount) topIndices.add(Math.floor(rng() * TOP_POOL.length));
    const top = Array.from(topIndices).map((i, rank) => ({
      ...TOP_POOL[i],
      rank: rank + 1,
      score: 70 + Math.floor(rng() * 28),
    }));

    // Signaux actifs
    const sigCount = intensity === "pic" ? 6 : intensity === "calme" ? 2 : 4;
    const sigIndices = new Set();
    while (sigIndices.size < sigCount) sigIndices.add(Math.floor(rng() * SIGNALS_POOL.length));
    const signals = Array.from(sigIndices).map((i) => ({
      name: SIGNALS_POOL[i],
      count: 3 + Math.floor(rng() * 30),
      delta: Math.floor((rng() - 0.5) * 20),
    }));

    // Décisions / actions faites ce jour (qq jours aléatoires)
    const actions = [];
    if (rng() < 0.4) {
      const actionTypes = [
        "Opp lue → mise en follow",
        "Signal ajouté en watchlist",
        "Article bookmarké",
        "Idée consignée dans Idées",
        "Challenge complété",
      ];
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        actions.push(actionTypes[Math.floor(rng() * actionTypes.length)]);
      }
    }

    // Jarvis usage
    const jarvisCalls = intensity === "pic" ? 12 + Math.floor(rng() * 18)
      : intensity === "calme" ? Math.floor(rng() * 3)
      : 4 + Math.floor(rng() * 10);

    return {
      iso,
      long: formatLong(d),
      day_label: `${DAYS[dow]} ${d.getDate()} ${MONTHS[d.getMonth()]}`,
      short_label: `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}.`,
      dow,
      is_weekend: isWeekend,
      days_ago: daysAgo,
      intensity,
      articles,
      signals_rising: signalsRising,
      macro,
      top,
      signals,
      actions,
      jarvis_calls: jarvisCalls,
      reading_time: intensity === "pic" ? "6 min" : intensity === "calme" ? "1 min" : "4 min",
    };
  }

  // ─ Génère 60 jours ─────────────────────────────────
  const days = [];
  for (let i = 0; i <= 60; i++) days.push(genBrief(i));

  // ─ Moments épinglés (quelques highlights) ──────────
  const pinned_isos = new Set([
    days.find((d) => d.macro.tag === "incident")?.iso,
    days.find((d) => d.macro.tag === "apple")?.iso,
    days.find((d) => d.macro.tag === "google")?.iso,
  ].filter(Boolean));
  days.forEach((d) => { d.pinned = pinned_isos.has(d.iso); });

  // ─ Totaux ──────────────────────────────────────────
  const totals = {
    total_days: days.length,
    total_articles: days.reduce((a, d) => a + d.articles, 0),
    total_jarvis_calls: days.reduce((a, d) => a + d.jarvis_calls, 0),
    total_actions: days.reduce((a, d) => a + d.actions.length, 0),
    peak_day: days.reduce((best, d) => d.articles > best.articles ? d : best, days[0]),
    streak_days: 14,
  };

  // ─ Jours groupés par semaine pour affichage ────────
  function getWeek(iso) {
    const d = new Date(iso);
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const jan4 = new Date(thursday.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((thursday - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return `S${weekNum}`;
  }
  days.forEach((d) => { d.week = getWeek(d.iso); });

  const weekGroups = {};
  days.forEach((d) => {
    if (!weekGroups[d.week]) weekGroups[d.week] = [];
    weekGroups[d.week].push(d);
  });

  window.HISTORY_DATA = {
    today_iso: TODAY_ISO,
    days,
    week_groups: weekGroups,
    totals,
  };
})();
