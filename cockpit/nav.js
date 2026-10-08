// cockpit/nav.js
// ─────────────────────────────────────────────────────────────────────────
// SIDEBAR — SOURCE UNIQUE DE VÉRITÉ
// ─────────────────────────────────────────────────────────────────────────
// Cette structure alimente :
//   - cockpit/data.js          → window.COCKPIT_DATA.nav (mode démo file://)
//   - cockpit/lib/data-loader.js → bootTier1 (runtime authentifié)
// Les deux la consomment via window.COCKPIT_NAV. Aucune duplication.
//
// Pour ajouter un panel :
//   1. Ajouter l'entrée { id, label, icon } dans le groupe approprié ci-dessous.
//   2. Brancher le routing dans cockpit/app.jsx (else if activePanel === "x").
//   3. Charger le composant dans index.html (<script src="cockpit/panel-x.jsx">).
//   4. Ajouter le spec produit dans docs/specs/tab-<slug>.md (template _template.md).
//   5. Référencer dans docs/specs/index.json + jarvis/spec.json::cockpit_tabs
//      (8 clés obligatoires par onglet ; validate-spec.yml bloquant ; vérif :
//      PYTHONIOENCODING=utf-8 python scripts/validate_spec.py — sans cette
//      variable le script plante en cp1252 AVANT d'imprimer son échec).
//   6. Déclarer le panel dans docs/architecture/dependencies.yaml::panels[].
//   7. Resync KNOWN_SECTIONS dans jarvis/scripts/extract_signals.py
//      (lint-known-sections.yml bloquant ; vérif : python scripts/lint_known_sections.py).
// ─────────────────────────────────────────────────────────────────────────
window.COCKPIT_NAV = [
  { group: "Aujourd'hui", items: [
    { id: "brief", label: "Brief du jour", icon: "sun" },
    { id: "evening", label: "Miroir du soir", icon: "moon" },
    { id: "review", label: "Revue du jour", icon: "play" },
    { id: "top", label: "Top du jour", icon: "star" },
    { id: "week", label: "Ma semaine", icon: "calendar" },
    { id: "search", label: "Recherche", icon: "search" },
  ]},
  { group: "Veille", items: [
    { id: "updates", label: "Veille IA", icon: "sparkles" },
    { id: "claude", label: "Claude", icon: "bot" },
    { id: "veille-outils", label: "Veille outils", icon: "toolbox" },
    { id: "sport", label: "Sport", icon: "flag" },
    { id: "gaming_news", label: "Gaming", icon: "wrench" },
    { id: "anime", label: "Anime / Ciné / Séries", icon: "star" },
    { id: "news", label: "Actualités", icon: "paper" },
    { id: "history", label: "Historique", icon: "clock" },
  ]},
  { group: "Apprentissage", items: [
    { id: "radar", label: "Radar compétences", icon: "target" },
    { id: "recos", label: "Recommandations", icon: "bookmark" },
    { id: "challenges", label: "Challenges", icon: "trophy" },
    { id: "wiki", label: "Wiki IA", icon: "book" },
    { id: "signals", label: "Signaux faibles", icon: "wave" },
    { id: "atlas", label: "Atlas", icon: "flame" },
  ]},
  { group: "Business", items: [
    { id: "opps", label: "Opportunités", icon: "lightbulb" },
    { id: "ideas", label: "Carnet d'idées", icon: "notebook" },
    { id: "jobs", label: "Jobs Radar", icon: "target" },
    { id: "creator", label: "Once Upon a Nerd", icon: "play" },
  ]},
  { group: "Personnel", items: [
    { id: "jarvis", label: "Jarvis", icon: "assistant" },
    { id: "profile", label: "Mon profil", icon: "user" },
    { id: "perf", label: "Forme", icon: "activity" },
    { id: "music", label: "Musique", icon: "music" },
    { id: "gaming", label: "Gaming", icon: "gamepad" },
    { id: "mediatheque", label: "Médiathèque", icon: "tv" },
  ]},
  // « Coulisses » (ex-« Système ») : la machine, ce qu'elle coûte, ses plans.
  // Historique en est parti — c'est une archive 60 j de la veille, pas de la
  // machinerie. Jarvis Lab y est entré — c'est du méta (roadmap, specs,
  // diagrammes), pas une fonctionnalité personnelle.
  { group: "Coulisses", items: [
    { id: "sante", label: "Santé", icon: "plug" },
    { id: "stacks", label: "Stacks & Limits", icon: "wallet" },
    { id: "jarvis-lab", label: "Jarvis Lab", icon: "chart" },
  ]},
];
