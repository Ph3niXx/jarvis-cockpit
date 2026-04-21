// ═══════════════════════════════════════════════════════════════
// JARVIS_DATA — shell initial. Chat + mémoire sont hydratés par
// data-loader.js::loadPanel("jarvis") depuis Supabase :
//   - messages  ← jarvis_conversations
//   - memory    ← profile_facts (superseded_by IS NULL)
//   - meta/stats ← calculés depuis ces rows
// Seuls quick_prompts restent statiques (suggestions UI).
// ═══════════════════════════════════════════════════════════════

window.JARVIS_DATA = {
  meta: {
    first_conversation: null,
    total_messages: 0,
    total_hours: 0,
    last_active: "—",
  },

  memory: [],
  messages: [],

  quick_prompts: [
    "Résume-moi la semaine",
    "Quels signaux ont bougé ?",
    "Qu'est-ce que tu sais de mon pilote Malakoff ?",
    "Challenge cette idée :",
    "Rédige un mail à…",
  ],

  stats: {
    messages_today: 0,
    messages_week: 0,
    memory_items: 0,
    memory_pinned: 0,
    cost_today_eur: 0,
    cost_budget_eur: 3.0,
  },
};
