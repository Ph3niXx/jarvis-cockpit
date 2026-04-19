// ═══════════════════════════════════════════════════════════════
// SIGNALS_DATA — Signaux faibles enrichis
// Détecteur d'opportunités : ce qui monte avant le mainstream.
// ─────────────────────────────────────────────
// Fields per signal:
//   id, name, category, trend (rising|new|declining|stable),
//   count, delta, history[12], first_seen, jarvis_take,
//   sources[], maturity (seed|emerging|hype|plateau|declining),
//   related[] (ids of co-occurring signals),
//   alerts[] (weekly events for watchlist)
// ═══════════════════════════════════════════════════════════════

window.SIGNALS_DATA = {
  week: "S17",
  updated: "Mar 21 avr · 06h14",
  window_weeks: 12,

  signals: [

    // ═══ Agents ══════════════════════════════════════════
    {
      id: "sg1",
      name: "agent memory",
      category: "Agents",
      trend: "rising",
      count: 34, delta: +18,
      history: [2, 2, 3, 4, 5, 7, 10, 14, 19, 24, 28, 34],
      first_seen: "S11",
      maturity: "hype",
      jarvis_take: "Persistance entre sessions — condition pour passer du POC à la production.",
      sources: [
        { who: "Anthropic", what: "Claude Agent memory primitives", when: "S17", kind: "blog" },
        { who: "Replit", what: "Agent V2 — session recall", when: "S17", kind: "changelog" },
        { who: "arXiv", what: "Memory-Augmented Retrieval for Long-Horizon Agents", when: "S16", kind: "paper" },
        { who: "LangChain", what: "LangMem GA release", when: "S16", kind: "release" },
        { who: "GitHub trends", what: "mem0 crosses 18k stars", when: "S15", kind: "metric" },
      ],
      related: ["sg2", "sg3", "sg16"],
      alerts: [
        { week: "S17", text: "5 nouvelles sources détectées dont 2 papers arXiv" },
        { week: "S16", text: "Passage en phase 'hype' confirmé" },
      ],
    },
    {
      id: "sg2",
      name: "agent evals",
      category: "Agents",
      trend: "rising",
      count: 31, delta: +11,
      history: [5, 7, 9, 12, 14, 17, 19, 22, 24, 26, 28, 31],
      first_seen: "S08",
      maturity: "emerging",
      jarvis_take: "Cadres d'évaluation qui maturent — LangSmith et Braintrust deviennent la norme.",
      sources: [
        { who: "LangSmith", what: "Evals 2.0 — LLM-as-judge par défaut", when: "S17", kind: "release" },
        { who: "Braintrust", what: "Eval Templates for Agents", when: "S16", kind: "product" },
        { who: "OpenAI", what: "Evals SDK — ajout de patterns multi-turn", when: "S16", kind: "changelog" },
        { who: "arXiv", what: "AgentBench v2", when: "S15", kind: "paper" },
      ],
      related: ["sg1", "sg3", "sg15"],
      alerts: [
        { week: "S17", text: "LangSmith Evals 2.0 publié" },
      ],
    },
    {
      id: "sg3",
      name: "swarm v2",
      category: "Agents",
      trend: "new",
      count: 16, delta: null,
      history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16],
      first_seen: "S17",
      maturity: "seed",
      jarvis_take: "SDK OpenAI publié cette semaine — réponse directe à Claude Agents.",
      sources: [
        { who: "OpenAI", what: "Swarm v2 — handoffs + tracing natif", when: "S17", kind: "release" },
        { who: "Hacker News", what: "Discussion front page (412 pts)", when: "S17", kind: "community" },
        { who: "Simon Willison", what: "First impressions post", when: "S17", kind: "blog" },
      ],
      related: ["sg1", "sg2", "sg16"],
      alerts: [
        { week: "S17", text: "Premier signal détecté · nouveau" },
      ],
    },

    // ═══ RAG ═════════════════════════════════════════════
    {
      id: "sg4",
      name: "context engineering",
      category: "RAG",
      trend: "rising",
      count: 42, delta: +22,
      history: [3, 4, 6, 8, 11, 15, 20, 26, 31, 35, 38, 42],
      first_seen: "S10",
      maturity: "hype",
      jarvis_take: "Le terme qui remplace 'prompt engineering' — centré assemblage de contexte, pas phrasing.",
      sources: [
        { who: "Shopify Eng", what: "How we engineer context for Sidekick", when: "S17", kind: "blog" },
        { who: "LlamaIndex", what: "Context routing patterns", when: "S16", kind: "doc" },
        { who: "Lance Martin", what: "Series: Context Engineering 101", when: "S16", kind: "blog" },
        { who: "a16z", what: "The Context Engineering Stack", when: "S15", kind: "post" },
      ],
      related: ["sg5", "sg6", "sg7"],
      alerts: [
        { week: "S17", text: "3 articles éditoriaux cette semaine" },
      ],
    },
    {
      id: "sg5",
      name: "context cache",
      category: "RAG",
      trend: "rising",
      count: 19, delta: +8,
      history: [1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19],
      first_seen: "S11",
      maturity: "emerging",
      jarvis_take: "Cache côté provider — divise le coût des prompts longs par 10.",
      sources: [
        { who: "Anthropic", what: "Prompt caching GA + extended TTL", when: "S17", kind: "release" },
        { who: "Gemini", what: "Implicit caching on by default", when: "S16", kind: "release" },
        { who: "OpenAI", what: "Cached prompts pricing update", when: "S15", kind: "pricing" },
      ],
      related: ["sg4"],
      alerts: [
        { week: "S17", text: "Gemini active le cache implicite par défaut" },
      ],
    },
    {
      id: "sg6",
      name: "vector store",
      category: "RAG",
      trend: "declining",
      count: 19, delta: -9,
      history: [38, 36, 34, 32, 30, 28, 26, 24, 23, 22, 21, 19],
      first_seen: "S01",
      maturity: "declining",
      jarvis_take: "Perd du terrain face à 'context engineering' — devient un détail d'implémentation.",
      sources: [
        { who: "Pinecone blog", what: "Beyond vector search — hybrid retrieval", when: "S16", kind: "blog" },
        { who: "Reddit r/LocalLLaMA", what: "Débat : BM25 > dense pour code", when: "S15", kind: "community" },
      ],
      related: ["sg4", "sg5"],
      alerts: [
        { week: "S17", text: "-2 mentions vs sem. dernière" },
      ],
    },

    // ═══ Prompting ═══════════════════════════════════════
    {
      id: "sg7",
      name: "prompt chaining",
      category: "Prompting",
      trend: "declining",
      count: 12, delta: -10,
      history: [26, 25, 24, 23, 22, 21, 20, 18, 17, 15, 14, 12],
      first_seen: "S01",
      maturity: "declining",
      jarvis_take: "Pattern remplacé par les agents avec mémoire — reste utile pour les cas déterministes.",
      sources: [
        { who: "LangChain blog", what: "When not to chain — use an agent", when: "S16", kind: "blog" },
      ],
      related: ["sg4", "sg8"],
      alerts: [
        { week: "S16", text: "Déclin confirmé sur 8 sem." },
      ],
    },
    {
      id: "sg8",
      name: "constitutional prompts",
      category: "Prompting",
      trend: "new",
      count: 9, delta: null,
      history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 9],
      first_seen: "S16",
      maturity: "seed",
      jarvis_take: "Anthropic publie un guide — règles explicites plutôt que few-shot.",
      sources: [
        { who: "Anthropic", what: "Constitutional prompting guide", when: "S17", kind: "doc" },
        { who: "Lilian Weng", what: "Blog post: values-first prompting", when: "S17", kind: "blog" },
      ],
      related: ["sg4", "sg7"],
      alerts: [
        { week: "S17", text: "Guide Anthropic + post Lilian Weng" },
      ],
    },

    // ═══ Fine-tuning ═════════════════════════════════════
    {
      id: "sg9",
      name: "qwen3 fine-tune",
      category: "Fine-tuning",
      trend: "rising",
      count: 28, delta: +14,
      history: [1, 2, 3, 5, 7, 10, 13, 17, 20, 23, 26, 28],
      first_seen: "S10",
      maturity: "hype",
      jarvis_take: "Qwen3-72B devient le modèle open-weight de référence pour FT sectoriels FR.",
      sources: [
        { who: "Unsloth", what: "Qwen3 QLoRA notebooks", when: "S17", kind: "code" },
        { who: "HuggingFace", what: "Qwen3 tops FR-MT leaderboard", when: "S16", kind: "leaderboard" },
        { who: "Mistral", what: "Partenariat training infra", when: "S15", kind: "press" },
      ],
      related: ["sg10", "sg13"],
      alerts: [
        { week: "S17", text: "Qwen3 top FR-MT + Unsloth notebooks" },
      ],
    },
    {
      id: "sg10",
      name: "lora assurance",
      category: "Fine-tuning",
      trend: "rising",
      count: 14, delta: +7,
      history: [1, 1, 2, 3, 4, 5, 7, 9, 10, 12, 13, 14],
      first_seen: "S10",
      maturity: "emerging",
      jarvis_take: "FT LoRA sur corpus assurantiels FR — 3 papers arXiv cette semaine.",
      sources: [
        { who: "arXiv", what: "FR-InsurLLM: domain-adapted fine-tuning", when: "S17", kind: "paper" },
        { who: "Axa Labs", what: "Case study publié sur Medium", when: "S16", kind: "blog" },
      ],
      related: ["sg9", "sg12"],
      alerts: [
        { week: "S17", text: "Paper arXiv FR-InsurLLM" },
      ],
    },

    // ═══ Régulation ══════════════════════════════════════
    {
      id: "sg11",
      name: "ai act phase 3",
      category: "Régulation",
      trend: "new",
      count: 18, delta: null,
      history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 8, 18],
      first_seen: "S15",
      maturity: "emerging",
      jarvis_take: "Phase 3 au 1er août — systèmes à haut risque impactés, prépare un mapping compliance.",
      sources: [
        { who: "Commission EU", what: "Guidance phase 3 publiée", when: "S17", kind: "official" },
        { who: "CNIL", what: "FAQ AI Act mise à jour", when: "S17", kind: "official" },
        { who: "Les Echos", what: "Comment les banques FR s'adaptent", when: "S16", kind: "presse" },
      ],
      related: ["sg12"],
      alerts: [
        { week: "S17", text: "Guidance EU phase 3 publiée" },
        { week: "S16", text: "FAQ CNIL mise à jour" },
      ],
    },
    {
      id: "sg12",
      name: "sovereign cloud",
      category: "Régulation",
      trend: "rising",
      count: 22, delta: +5,
      history: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22],
      first_seen: "S06",
      maturity: "emerging",
      jarvis_take: "Souveraineté relancée par DGFiP + Bpifrance — OVH et Scaleway tirent profit.",
      sources: [
        { who: "OVHcloud", what: "Inference stack sovereign", when: "S17", kind: "product" },
        { who: "Scaleway", what: "Managed LLMs EU-only", when: "S16", kind: "release" },
        { who: "Bpifrance", what: "AAP Cloud de confiance", when: "S15", kind: "grant" },
      ],
      related: ["sg11", "sg10"],
      alerts: [
        { week: "S17", text: "OVHcloud lance stack sovereign" },
      ],
    },

    // ═══ LLMs ════════════════════════════════════════════
    {
      id: "sg13",
      name: "small language models",
      category: "LLMs",
      trend: "rising",
      count: 24, delta: +9,
      history: [4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 24],
      first_seen: "S07",
      maturity: "emerging",
      jarvis_take: "Phi-4, Gemma 3 — déploiement edge et coûts qui rendent le on-device crédible.",
      sources: [
        { who: "Microsoft", what: "Phi-4 mini benchmarks", when: "S17", kind: "blog" },
        { who: "Google", what: "Gemma 3 on-device kit", when: "S16", kind: "release" },
        { who: "Hugging Face", what: "SLM leaderboard launch", when: "S15", kind: "product" },
      ],
      related: ["sg14", "sg9"],
      alerts: [
        { week: "S17", text: "Phi-4 mini benchmarks publiés" },
      ],
    },
    {
      id: "sg14",
      name: "reasoning models",
      category: "LLMs",
      trend: "rising",
      count: 38, delta: +16,
      history: [8, 10, 13, 16, 20, 23, 26, 29, 32, 34, 36, 38],
      first_seen: "S08",
      maturity: "hype",
      jarvis_take: "o3, Claude Extended Thinking, DeepSeek R1 — pattern généralisé, redéfinit le pricing.",
      sources: [
        { who: "OpenAI", what: "o3 full model released", when: "S17", kind: "release" },
        { who: "Anthropic", what: "Extended thinking: controls for budget", when: "S16", kind: "release" },
        { who: "DeepSeek", what: "R1-next open weights", when: "S15", kind: "release" },
      ],
      related: ["sg13", "sg15"],
      alerts: [
        { week: "S17", text: "o3 full model GA" },
        { week: "S16", text: "DeepSeek R1-next open weights" },
      ],
    },

    // ═══ Outils / DevEx ══════════════════════════════════
    {
      id: "sg15",
      name: "claude code",
      category: "Outils",
      trend: "rising",
      count: 54, delta: +18,
      history: [12, 18, 24, 28, 32, 36, 40, 44, 46, 48, 51, 54],
      first_seen: "S05",
      maturity: "hype",
      jarvis_take: "Adoption enterprise explose après GA — très cité dans les retours dev.",
      sources: [
        { who: "Anthropic", what: "Claude Code — enterprise pricing", when: "S17", kind: "release" },
        { who: "Hacker News", what: "2 discussions front page cette sem.", when: "S17", kind: "community" },
        { who: "Thoughtworks", what: "Radar — place en Adopt", when: "S16", kind: "review" },
      ],
      related: ["sg16", "sg14"],
      alerts: [
        { week: "S17", text: "Enterprise pricing annoncé" },
      ],
    },
    {
      id: "sg16",
      name: "mcp servers",
      category: "Outils",
      trend: "rising",
      count: 27, delta: +12,
      history: [2, 3, 5, 7, 9, 12, 15, 18, 21, 23, 25, 27],
      first_seen: "S09",
      maturity: "emerging",
      jarvis_take: "Model Context Protocol — serveurs qui poussent partout, écosystème qui se standardise.",
      sources: [
        { who: "Anthropic", what: "MCP registry officiel", when: "S17", kind: "release" },
        { who: "GitHub", what: "awesome-mcp-servers : 8k stars", when: "S16", kind: "metric" },
      ],
      related: ["sg1", "sg15", "sg3"],
      alerts: [
        { week: "S17", text: "Registry officiel MCP lancé" },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════
  // Maturity spectrum — positions X on hype cycle (0 → 1)
  // Standard Gartner-ish curve: seed → emerging → hype (peak)
  //                       → plateau (slope of disillusionment / recovery)
  //                       → declining (trough)
  // ═══════════════════════════════════════════════════════
  maturity_positions: {
    seed:       0.10,
    emerging:   0.30,
    hype:       0.55,
    plateau:    0.80,
    declining:  0.92,
  },
};
