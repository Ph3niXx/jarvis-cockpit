// Fake but realistic data for the AI Cockpit redesign
window.COCKPIT_DATA = {
  user: {
    name: "Alexis",
    role: "RTE — Train Vente · Malakoff Humanis",
    greeting_morning: "Bonjour Alexis",
    greeting_afternoon: "Bon retour Alexis",
  },
  date: {
    long: "Mardi 21 avril 2026",
    iso: "2026-04-21",
    week: "S17",
    day_of_year: "J+111",
  },
  stats: {
    articles_today: 47,
    signals_rising: 6,
    unread: 23,
    streak: 14,
    next_brief: "demain 06:00",
    cost_month: "2,41 €",
    cost_budget: "3 €",
    cost_history_7d: [0.28, 0.31, 0.42, 0.38, 0.34, 0.36, 0.32], // €/jour
  },
  // Hero / macro — le paragraphe d'ouverture
  macro: {
    kicker: "Synthèse du matin",
    title: "La bataille des agents passe en phase industrielle",
    body: "Anthropic ouvre Claude Agents en GA aux entreprises, OpenAI riposte avec un SDK Swarm v2 et Mistral annonce un partenariat BNP Paribas. Trois signaux convergents : les assureurs français commencent à sortir de la phase POC. Côté régulation, l'AI Act entre en phase 3 — obligations renforcées pour les systèmes à haut risque, ce qui touche directement les outils d'aide à la souscription.",
    reading_time: "4 min",
    articles_summarized: 47,
  },
  // Top 3 incontournables
  top: [
    {
      rank: 1,
      source: "Anthropic",
      section: "Agents",
      date: "il y a 2h",
      score: 94,
      title: "Claude Agents GA — mémoire persistante et orchestration multi-outils en natif",
      summary: "Disponibilité générale de l'API agents avec une mémoire de contexte de 1M tokens, un routage automatique entre outils et un SDK Python/TypeScript. Pricing aligné sur Haiku 4.5 pour les tâches de routine.",
      tags: ["#agents", "#anthropic", "#enterprise"],
      related: ["Swarm v2 OpenAI", "AWS Bedrock Agents"],
      unread: true,
    },
    {
      rank: 2,
      source: "Les Échos",
      section: "FinServ",
      date: "il y a 4h",
      score: 88,
      title: "BNP Paribas industrialise 140 cas d'usage IA avec Mistral",
      summary: "La banque déploie Mistral Large 2 en production sur son cloud souverain, dont 40 cas d'usage en assurance. Focus sur l'aide à la souscription, la relation conseiller et le traitement documentaire.",
      tags: ["#finserv", "#mistral", "#souveraineté"],
      related: ["Axa IA Claims", "Societe Generale Agora"],
      unread: true,
    },
    {
      rank: 3,
      source: "Commission européenne",
      section: "Régulation",
      date: "il y a 6h",
      score: 81,
      title: "AI Act phase 3 — obligations renforcées pour haut risque au 1er août",
      summary: "Guide d'application publié. Les systèmes d'aide à la souscription, au scoring et au pricing entrent explicitement dans le scope. Documentation technique, registre, supervision humaine obligatoires.",
      tags: ["#régulation", "#ai-act", "#assurance"],
      related: ["Guide CNIL IA", "Référentiel ACPR"],
      unread: false,
    },
  ],
  // Signaux faibles — avec historique 8 semaines pour sparkline
  signals: [
    { name: "agent memory", count: 23, delta: +14, trend: "rising", history: [2,3,4,6,8,12,18,23], category: "Agents", context: "Mémoire persistante entre sessions, cité par Anthropic + Replit cette semaine." },
    { name: "small language models", count: 18, delta: +9, trend: "rising", history: [1,2,3,5,7,10,14,18], category: "LLMs", context: "Phi-4, Gemma 3, modèles < 10B en forte hausse. Déploiement edge." },
    { name: "ai act phase 3", count: 12, delta: null, trend: "new", history: [0,0,0,0,0,0,0,12], category: "Régulation", context: "Guide d'application Commission publié le 17/04. Systèmes haut risque impactés." },
    { name: "context engineering", count: 9, delta: +6, trend: "rising", history: [0,1,1,2,3,4,6,9], category: "Prompting", context: "Terme qui remplace 'prompt engineering'. Focus sur l'orchestration du contexte." },
    { name: "mcp", count: 41, delta: +2, trend: "stable", history: [38,42,40,39,41,43,39,41], category: "Agents", context: "Model Context Protocol, standard d'Anthropic. Maintenant stabilisé." },
    { name: "copilot", count: 28, delta: -8, trend: "declining", history: [45,42,40,38,36,34,30,28], category: "Outils", context: "Mentions en baisse au profit de Cursor et Claude Code." },
  ],
  // Sections du cockpit — sidebar
  nav: [
    { group: "Aujourd'hui", items: [
      { id: "brief", label: "Brief du jour", icon: "sun", count: 47, active: true },
      { id: "top", label: "Top du jour", icon: "star", count: 8 },
      { id: "week", label: "Ma semaine", icon: "calendar" },
      { id: "search", label: "Recherche", icon: "search" },
    ]},
    { group: "Veille", items: [
      { id: "updates", label: "Veille IA", icon: "sparkles", count: 12 },
      { id: "sport", label: "Sport", icon: "flag", count: 12 },
      { id: "gaming_news", label: "Gaming", icon: "wrench", count: 12 },
      { id: "anime", label: "Anime / Ciné / Séries", icon: "star", count: 12 },
      { id: "news", label: "Actualités", icon: "paper", count: 12 },
    ]},
    { group: "Apprentissage", items: [
      { id: "radar", label: "Radar compétences", icon: "target" },
      { id: "recos", label: "Recommandations", icon: "bookmark", count: 4, unread: 2 },
      { id: "challenges", label: "Challenges", icon: "trophy", count: 3, unread: 1 },
      { id: "wiki", label: "Wiki IA", icon: "book", count: 142 },
      { id: "signals", label: "Signaux faibles", icon: "wave", count: 6 },
    ]},
    { group: "Business", items: [
      { id: "opps", label: "Opportunités", icon: "lightbulb", count: 11, unread: 3 },
      { id: "ideas", label: "Carnet d'idées", icon: "notebook", count: 7 },
    ]},
    { group: "Personnel", items: [
      { id: "jarvis", label: "Jarvis", icon: "assistant" },
      { id: "jarvis-lab", label: "Jarvis Lab", icon: "chart" },
      { id: "profile", label: "Mon profil", icon: "user" },
      { id: "perf", label: "Forme", icon: "activity" },
      { id: "music", label: "Musique", icon: "music" },
      { id: "gaming", label: "Gaming", icon: "gamepad" },
    ]},
    { group: "Système", items: [
      { id: "stacks", label: "Stacks & Limits", icon: "wallet" },
      { id: "history", label: "Historique", icon: "clock" },
    ]},
  ],
  // Radar compétences
  radar: {
    axes: [
      { name: "Prompting", score: 82, gap: false },
      { name: "Agents & outils", score: 64, gap: false },
      { name: "RAG / vectoriel", score: 71, gap: false },
      { name: "Fine-tuning", score: 38, gap: true },
      { name: "Éval & bench", score: 45, gap: true },
      { name: "Régulation", score: 69, gap: false },
      { name: "Archi / coûts", score: 77, gap: false },
      { name: "Business cases", score: 74, gap: false },
    ],
    next_gap: {
      axis: "Fine-tuning",
      reason: "Le score sur fine-tuning est bloqué à 38 depuis 6 semaines alors que 4 articles cette semaine pointent des techniques LoRA accessibles. C'est ton plus gros delta avec le niveau \"expert\".",
      action: "Faire le challenge LoRA de la semaine (2h)",
    },
  },
  // Ma semaine — élargi (veille + perso)
  week: {
    days: [
      { day: "Lun", read: 12, bars: 12, workout: 1, music_min: 45, gaming_min: 0, notes: 2 },
      { day: "Mar", read: 8, bars: 8, workout: 0, music_min: 72, gaming_min: 30, notes: 1 },
      { day: "Mer", read: 14, bars: 14, workout: 1, music_min: 30, gaming_min: 0, notes: 3 },
      { day: "Jeu", read: 11, bars: 11, workout: 1, music_min: 85, gaming_min: 45, notes: 1 },
      { day: "Ven", read: 7, bars: 7, workout: 0, music_min: 40, gaming_min: 90, notes: 0 },
      { day: "Sam", read: 3, bars: 3, workout: 1, music_min: 110, gaming_min: 180, notes: 0 },
      { day: "Dim", read: 5, bars: 5, workout: 0, music_min: 60, gaming_min: 120, notes: 1 },
    ],
    total_read: 60,
    total_marked: 14,
    streak: 14,
    reading_time_min: 187,
    // Synthèse IA — 3 points de la semaine
    ai_summary: [
      { kicker: "Thème IA dominant", text: "Ta semaine a été focus agents — 40% de tes lectures, +12 pts sur l'axe radar. Le papier Claude Agents GA est celui que tu as gardé le plus longtemps ouvert." },
      { kicker: "Momentum perso", text: "3 séances de sport, au-dessus de ton objectif (2). Ton streak veille atteint 14 jours, ton meilleur depuis janvier." },
      { kicker: "Point d'attention", text: "Tu as fini la semaine sur +85% temps gaming vs ta moyenne. Peut-être lever le pied ce weekend — tu as un challenge LoRA qui attend." },
    ],
    // Themes extraits des lectures
    themes: [
      { label: "agents", weight: 40, color: "brand" },
      { label: "régulation", weight: 18, color: "neutral" },
      { label: "mistral", weight: 15, color: "neutral" },
      { label: "llms open source", weight: 12, color: "neutral" },
      { label: "mcp", weight: 10, color: "neutral" },
      { label: "fine-tuning", weight: 5, color: "alert" },
    ],
    // Articles marquants lus cette semaine
    top_read: [
      { title: "Claude Agents GA — mémoire persistante", source: "Anthropic", day: "Mar", time_min: 14 },
      { title: "BNP Paribas industrialise 140 cas d'usage IA", source: "Les Échos", day: "Mer", time_min: 9 },
      { title: "AI Act phase 3 — obligations renforcées", source: "Commission EU", day: "Lun", time_min: 12 },
      { title: "Phi-4 mini publié — 3.8B paramètres", source: "Hugging Face", day: "Jeu", time_min: 7 },
    ],
    // Vie perso (élargi)
    personal: {
      workouts: { done: 3, target: 4, label: "Séances sport" },
      music: { total_min: 442, top_artist: "Tame Impala", sessions: 11 },
      gaming: { total_min: 465, top_game: "Elden Ring Nightreign" },
      sleep_avg_h: 7.2,
      notes_count: 8,
    },
    // Comparaison vs semaine dernière
    compare_last: {
      read: { this: 60, last: 48 },
      signals_spotted: { this: 6, last: 4 },
      workouts: { this: 3, last: 2 },
      notes: { this: 8, last: 12 },
    },
  },
  // Recommandations
  recos: [
    {
      title: "Construire un agent avec mémoire persistante",
      source: "Anthropic Cookbook",
      duration: "45 min",
      level: "Intermédiaire",
      gap: "Agents & outils",
      unread: true,
    },
    {
      title: "LoRA fine-tuning sur RTX : guide pratique",
      source: "Hugging Face",
      duration: "2h",
      level: "Intermédiaire",
      gap: "Fine-tuning",
      unread: true,
    },
    {
      title: "Éval d'un système RAG en production",
      source: "Chip Huyen — blog",
      duration: "30 min",
      level: "Avancé",
      gap: "Éval & bench",
      unread: false,
    },
  ],
  // Challenges
  challenges: [
    {
      title: "Déployer un RAG sur tes mails",
      description: "Indexe ta boîte Outlook avec Jarvis + pgvector, pose 3 questions qui demandent du contexte de la semaine.",
      duration: "2h",
      xp: 150,
      status: "in-progress",
      progress: 60,
    },
    {
      title: "Fine-tune Qwen3 sur tes notes RTE",
      description: "LoRA 8-bit sur tes notes de cérémonies SAFe pour qu'il propose des formulations de risque.",
      duration: "3h",
      xp: 200,
      status: "open",
    },
  ],
};
