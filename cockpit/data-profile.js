// ═══════════════════════════════════════════════════════════════
// PROFILE_DATA — v3 · branché sur Supabase
// ─────────────────────────────────────────────
// Zones (toutes branchées sur vraies tables) :
//  1. Contexte Claude : vraies user_profile rows (avec mission exclusions)
//  2. Faits appris par Jarvis : profile_facts (nightly_learner)
//  3. Entités détectées : entities (personnes/outils/projets)
//  4. Éditeur : drawer avec save sur user_profile
// ═══════════════════════════════════════════════════════════════

// Clés user_profile exclues du contexte "mission" dans weekly_analysis.py :
// voir get_user_context() dans weekly_analysis.py
window.PROFILE_MISSION_EXCLUDED = ["current_role", "company_context", "current_projects"];

// Clés techniques / config que l'utilisateur n'a pas envie de voir en édition.
window.PROFILE_HIDDEN_KEYS = [
  "__audit_test_deleteme__",
  "jarvis_tunnel_url",
  "lastfm_api_key",
  "lastfm_username",
];

// Labels FR pour les champs connus.
window.PROFILE_FIELD_LABELS = {
  identity: "Identité",
  current_role: "Rôle actuel",
  company_context: "Contexte entreprise",
  ambitions: "Ambitions",
  interests: "Intérêts",
  current_projects: "Projets en cours",
  what_excites_me: "Ce qui m'excite",
  what_frustrates_me: "Ce qui me frustre",
  sectors_of_interest: "Secteurs d'intérêt",
  learning_style: "Style d'apprentissage",
  weekly_notes: "Notes hebdo",
  target_salary_range: "Fourchette salaire cible",
};

// Labels FR pour profile_facts.fact_type
window.PROFILE_FACT_TYPE_LABELS = {
  context: "Contexte",
  preference: "Préférence",
  goal: "Objectif",
  skill: "Compétence",
  opinion: "Opinion",
  constraint: "Contrainte",
  interest: "Intérêt",
};

// Labels FR pour statut commitment
window.PROFILE_COMMITMENT_STATUS_LABELS = {
  "on-track": "En cours",
  "at-risk": "À risque",
  "stale": "Bloqué",
  "done": "Terminé",
  "cancelled": "Abandonné",
};

// Shell minimal — tout le contenu vient de l'hydratation Supabase.
window.PROFILE_DATA = {
  _raw: [],           // rows user_profile
  _values: {},        // {key: value}
  _facts: [],         // profile_facts rows (non superseded)
  _entities: [],      // entities rows
  _history: [],       // user_profile_history rows (append-only)
  _commitments: [],   // commitments rows (non archivés)
  _uqs: [],           // uncomfortable_questions rows
  _lastUpdated: null,
};
