// ═══════════════════════════════════════════════════════════════
// GAMING_DATA — Steam + PSN + Xbox + Riot (TFT)
// ─────────────────────────────────────────────
// Profil : gros joueur, stratégie / tactique / JRPG / MOBA.
// ═══════════════════════════════════════════════════════════════

(function () {
  const TODAY = new Date("2026-04-27");

  // ── Profils plateformes ────────────────────────────────────────
  const profiles = [
    {
      platform: "Steam",
      id: "steam",
      handle: "j4rvis_",
      color: "#1b2838",
      accent: "#66c0f4",
      games_owned: 847,
      games_played: 312,
      hours_total: 4281,
      achievements: 6847,
      level: 42,
      since: "2012",
    },
    {
      platform: "PlayStation",
      id: "psn",
      handle: "Jarvis_Oma",
      color: "#003087",
      accent: "#0070cc",
      games_owned: 127,
      games_played: 89,
      hours_total: 1842,
      trophies: { platinum: 18, gold: 142, silver: 287, bronze: 621 },
      level: 287,
      since: "2020",
    },
    {
      platform: "Xbox",
      id: "xbox",
      handle: "Jarvis OM",
      color: "#107c10",
      accent: "#9bf00b",
      games_owned: 84,
      games_played: 41,
      hours_total: 687,
      achievements: 1287,
      gamerscore: 28740,
      level: null,
      since: "2019",
    },
    {
      platform: "Riot (TFT)",
      id: "riot",
      handle: "Jarvis#EUW",
      color: "#151921",
      accent: "#c89b3c",
      games_owned: 1,
      games_played: 1,
      hours_total: 1247,
      rank: "Master",
      lp: 147,
      games_season: 412,
      top4_rate: 0.58,
      win_rate: 0.21,
      level: null,
      since: "2019",
    },
  ];

  // ── En cours ───────────────────────────────────────────────────
  const in_progress = [
    {
      title: "Persona 5 Royal",
      platform: "PS5",
      platform_id: "psn",
      genre: "JRPG",
      cover: "#0a0a0a",
      cover_accent: "#ff1e3c",
      played_h: 67,
      hltb_main: 103,
      hltb_completionist: 136,
      progress_pct: 0.47,
      last_session: "hier soir · 01:40",
      note: "Palais 5 en cours. Tu calibres slow burn — plan : 2 soirées/semaine jusqu'à la fin.",
      status: "active",
    },
    {
      title: "TFT (Ranked)",
      platform: "PC",
      platform_id: "riot",
      genre: "Auto-battler",
      cover: "#151921",
      cover_accent: "#c89b3c",
      played_h: 1247,
      hltb_main: null,
      progress_pct: null,
      rank: "Master 147 LP",
      delta_lp_week: +83,
      last_session: "il y a 2h · top 2",
      note: "Set 14 'Cyber City'. Master atteint semaine dernière, objectif GM avant fin de set (35j).",
      status: "active",
      ongoing: true,
    },
    {
      title: "Baldur's Gate 3",
      platform: "PC",
      platform_id: "steam",
      genre: "CRPG",
      cover: "#1a1410",
      cover_accent: "#c89b3c",
      played_h: 42,
      hltb_main: 75,
      hltb_completionist: 140,
      progress_pct: 0.33,
      last_session: "il y a 5j",
      note: "Acte 2 commencé. Campagne tactician avec Shadowheart tank. Tu ralentis — trop long en parallèle de P5R ?",
      status: "stalled",
    },
    {
      title: "Balatro",
      platform: "PC",
      platform_id: "steam",
      genre: "Roguelike",
      cover: "#2a1e3a",
      cover_accent: "#e94560",
      played_h: 38,
      hltb_main: 25,
      progress_pct: 0.82,
      last_session: "il y a 12j",
      note: "Gold Stake → 6/15 decks platinum. Tu y reviens 20 min le midi quand tu veux du sucre.",
      status: "active",
      comfort: true,
    },
  ];

  // ── Backlog priorisé ───────────────────────────────────────────
  const backlog = [
    {
      title: "Metaphor: ReFantazio",
      platform: "PS5",
      platform_id: "psn",
      genre: "JRPG",
      cover: "#2a1810",
      cover_accent: "#e94b1c",
      hltb: 91,
      acquired: "déc. 2024",
      acquired_how: "PSN · −40%",
      hype: 9,
      reason: "Même équipe Persona. Tu as platiné P5R, logique de continuer.",
      priority: "next",
    },
    {
      title: "Dragon's Dogma 2",
      platform: "PC",
      platform_id: "steam",
      genre: "Action-RPG",
      cover: "#3a1a0a",
      cover_accent: "#c89b3c",
      hltb: 45,
      acquired: "nov. 2024",
      acquired_how: "Steam · sale −50%",
      hype: 7,
      reason: "Attendu depuis DD1. Tu repousses depuis 6 mois.",
      priority: "next",
    },
    {
      title: "Final Fantasy VII Rebirth",
      platform: "PS5",
      platform_id: "psn",
      genre: "JRPG",
      cover: "#0a2840",
      cover_accent: "#00a8e8",
      hltb: 81,
      acquired: "janv. 2026",
      acquired_how: "physique · day-one",
      hype: 10,
      reason: "Jamais ouvert. Tu attends d'avoir fini P5R.",
      priority: "high",
    },
    {
      title: "Unicorn Overlord",
      platform: "Switch → PC",
      platform_id: "steam",
      genre: "Tactical-RPG",
      cover: "#1a2a3a",
      cover_accent: "#ffb347",
      hltb: 67,
      acquired: "mars 2025",
      acquired_how: "Steam · sale −35%",
      hype: 8,
      reason: "Vanillaware + tactical. Exactement ton créneau — pourquoi pas encore lancé ?",
      priority: "high",
    },
    {
      title: "Shogun Showdown",
      platform: "PC",
      platform_id: "steam",
      genre: "Roguelike tactique",
      cover: "#3a1a1a",
      cover_accent: "#e94560",
      hltb: 15,
      acquired: "févr. 2026",
      acquired_how: "Steam · day-one",
      hype: 7,
      reason: "Mini roguelike tactical. Parfait pour sessions 30 min.",
      priority: "medium",
    },
    {
      title: "Dave the Diver",
      platform: "PC",
      platform_id: "steam",
      genre: "Aventure-gestion",
      cover: "#0a2a3a",
      cover_accent: "#00c2a8",
      hltb: 26,
      acquired: "oct. 2024",
      acquired_how: "Steam · sale −40%",
      hype: 6,
      reason: "Recommandation appuyée. Reste bloqué en backlog depuis 6 mois.",
      priority: "medium",
    },
    {
      title: "Citizen Sleeper 2",
      platform: "PC",
      platform_id: "steam",
      genre: "Narratif",
      cover: "#1a1028",
      cover_accent: "#ff6ba8",
      hltb: 16,
      acquired: "févr. 2026",
      acquired_how: "Steam · day-one",
      hype: 8,
      reason: "Adoré le 1er. Session courte = facile à caser.",
      priority: "medium",
    },
    {
      title: "Disco Elysium",
      platform: "PC",
      platform_id: "steam",
      genre: "CRPG narratif",
      cover: "#1a2820",
      cover_accent: "#d4a017",
      hltb: 30,
      acquired: "2021",
      acquired_how: "Steam · bundle",
      hype: 9,
      reason: "Tu l'as acheté 3 fois (Steam, PSN, GOG). Jamais fini. Honte.",
      priority: "shame",
      shame_years: 5,
    },
  ];

  // ── Wishlist (lien avec Veille gaming) ─────────────────────────
  const wishlist = [
    { title: "Hollow Knight: Silksong", platform: "PC", release: "2026-09-??", hype: 10, price_target: 30, days_out: 135, on_radar: true },
    { title: "Clair Obscur: Expedition 33", platform: "PC", release: "2025-11-20", hype: 10, price_target: null, already_released: true, bought: false, note: "sorti — à acheter à la prochaine soldes", days_out: -158 },
    { title: "Elden Ring: Nightreign", platform: "PC", release: "2025-05-30", hype: 8, price_target: 40, already_released: true, bought: false, note: "co-op roguelike — attend retours" },
    { title: "Monster Hunter Wilds", platform: "PC", release: "2025-02-28", hype: 9, price_target: 40, already_released: true, bought: false, note: "offert par un pote → à récupérer" },
    { title: "Dune: Awakening", platform: "PC", release: "2026-06-??", hype: 7, price_target: 50, days_out: 45 },
    { title: "Hades 2 (1.0)", platform: "PC", release: "2026-??-??", hype: 9, days_out: null, note: "en early access, tu attends la 1.0" },
  ];

  // ── Sessions 180j (heatmap + courbe) ───────────────────────────
  const DAYS = 180;
  const daily_sessions = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const dow = d.getDay();
    // base soir 1-2h, week-end 3-5h
    let h = 0.5 + Math.random() * 1.5;
    if (dow === 0 || dow === 6) h = 3 + Math.random() * 2.5;
    if (dow === 5) h = 2 + Math.random() * 2;
    // 2-3 jours off aléatoires
    if (Math.random() < 0.12) h = 0;
    // boost weekends récents (P5R crunch)
    if (i > 140 && (dow === 0 || dow === 6)) h += 1.2;
    daily_sessions.push({
      date: d.toISOString().slice(0, 10),
      hours: +h.toFixed(1),
    });
  }

  const total7 = daily_sessions.slice(-7).reduce((a, x) => a + x.hours, 0);
  const total30 = daily_sessions.slice(-30).reduce((a, x) => a + x.hours, 0);
  const totalYTD = daily_sessions.filter((d) => d.date >= "2026-01-01").reduce((a, x) => a + x.hours, 0);

  // Heatmap 7×24
  const heatmap = [];
  for (let dow = 0; dow < 7; dow++) {
    const row = [];
    for (let h = 0; h < 24; h++) {
      let v = 0;
      if (h >= 20 && h <= 23) v = 6 + Math.random() * 3;
      else if (h === 19 || h === 0) v = 3 + Math.random() * 2;
      else if (h >= 1 && h <= 2) v = 1 + Math.random();
      else if (h >= 12 && h <= 13) v = 1.5 + Math.random();
      else if (h >= 14 && h <= 17 && (dow === 0 || dow === 6)) v = 4 + Math.random() * 2;
      else v = 0;
      if ((dow === 0 || dow === 6) && h >= 20 && h <= 23) v += 2;
      row.push(+v.toFixed(1));
    }
    heatmap.push(row);
  }

  // ── Répartition genres (30j heures) ────────────────────────────
  const genres_30d = [
    { label: "JRPG", share: 0.38, color: "#3a1e2e", hours: Math.round(total30 * 0.38) },
    { label: "Auto-battler (TFT)", share: 0.27, color: "#2a1e38", hours: Math.round(total30 * 0.27) },
    { label: "CRPG", share: 0.15, color: "#2a3d2e", hours: Math.round(total30 * 0.15) },
    { label: "Roguelike", share: 0.09, color: "#3a2a1a", hours: Math.round(total30 * 0.09) },
    { label: "Tactical-RPG", share: 0.06, color: "#1a2a3a", hours: Math.round(total30 * 0.06) },
    { label: "Narratif", share: 0.03, color: "#2a1e2e", hours: Math.round(total30 * 0.03) },
    { label: "Autres", share: 0.02, color: "#555", hours: Math.round(total30 * 0.02) },
  ];

  // ── Top jeux all-time (heures) ─────────────────────────────────
  const top_alltime = [
    { rank: 1, title: "Team Fight Tactics", platform: "riot", hours: 1247, sessions: 2847, since: "2019" },
    { rank: 2, title: "Dota 2", platform: "steam", hours: 842, sessions: 612, since: "2014" },
    { rank: 3, title: "Civilization VI", platform: "steam", hours: 487, sessions: 187, since: "2017" },
    { rank: 4, title: "Baldur's Gate 3", platform: "steam", hours: 418, sessions: 142, since: "2023" },
    { rank: 5, title: "Persona 5 Royal", platform: "psn", hours: 287, sessions: 98, since: "2024" },
    { rank: 6, title: "Monster Hunter: World", platform: "steam", hours: 267, sessions: 187, since: "2018" },
    { rank: 7, title: "The Witcher 3", platform: "steam", hours: 234, sessions: 87, since: "2016" },
    { rank: 8, title: "Stellaris", platform: "steam", hours: 198, sessions: 78, since: "2018" },
    { rank: 9, title: "Elden Ring", platform: "steam", hours: 187, sessions: 92, since: "2022" },
    { rank: 10, title: "XCOM 2", platform: "steam", hours: 167, sessions: 87, since: "2017" },
  ];

  // ── Achievements / trophées récents ────────────────────────────
  const recent_achievements = [
    { game: "Persona 5 Royal", platform: "psn", label: "Un cœur sans scrupules", type: "silver", rarity: 14.2, date: "il y a 2j" },
    { game: "TFT", platform: "riot", label: "Master atteint — Set 14", type: "rank", rarity: null, date: "il y a 6j" },
    { game: "Balatro", platform: "steam", label: "Challenge accepté", type: "gold", rarity: 8.7, date: "il y a 9j" },
    { game: "Baldur's Gate 3", platform: "steam", label: "Acte II", type: "regular", rarity: 52.1, date: "il y a 14j" },
    { game: "Persona 5 Royal", platform: "psn", label: "Palais 4 nettoyé", type: "bronze", rarity: 34.8, date: "il y a 18j" },
    { game: "Balatro", platform: "steam", label: "Platinum Stake · Deck standard", type: "platinum", rarity: 2.3, date: "il y a 22j" },
  ];

  // ── Stats agrégées ─────────────────────────────────────────────
  const totals = {
    hours_total: profiles.reduce((a, p) => a + p.hours_total, 0),
    games_owned: profiles.reduce((a, p) => a + p.games_owned, 0),
    games_played: profiles.reduce((a, p) => a + p.games_played, 0),
    backlog_count: backlog.length,
    wishlist_count: wishlist.length,
    last7: total7,
    last30: total30,
    ytd: totalYTD,
    completion_rate: Math.round((profiles.reduce((a, p) => a + p.games_played, 0) / profiles.reduce((a, p) => a + p.games_owned, 0)) * 100),
  };

  // ── Milestones 2026 ────────────────────────────────────────────
  const milestones = [
    { label: "Heures de jeu 2026", value: `${Math.round(totalYTD)}h`, sub: `~${(totalYTD / 116).toFixed(1)}h/jour · 116 jours`, progress: Math.min(1, totalYTD / 900) },
    { label: "Jeux terminés 2026", value: "7", sub: "objectif 15 jeux" },
    { label: "Platines / 100%", value: "2", sub: "Balatro · Pentiment" },
    { label: "Backlog nettoyé", value: "−4", sub: "4 jeux finis vs 8 achetés" },
    { label: "TFT · best rank", value: "Master", sub: "+147 LP · top 0.8% EUW" },
    { label: "Spend 2026", value: "178 €", sub: "budget 400€/an · 44%" },
  ];

  window.GAMING_PERSO_DATA = {
    profiles,
    totals,
    in_progress,
    backlog,
    wishlist,
    daily_sessions,
    heatmap,
    genres_30d,
    top_alltime,
    recent_achievements,
    milestones,
  };
})();
