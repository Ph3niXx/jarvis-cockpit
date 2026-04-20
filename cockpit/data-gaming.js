// Gaming — corpus initial : vide au démarrage, hydraté par data-loader au clic sidebar
// (pipelines/gaming_sync.py remplit gaming_articles → loadPanel("gaming_news") mute les champs).
window.GAMING_DATA = {
  headline: {
    kicker: "Chargement...",
    actor: "—",
    version: "Gaming",
    tagline: "Fetching des flux RSS gaming en cours",
    body: "Les articles apparaîtront ici dès que le pipeline quotidien aura tourné.",
    metrics: [
      { label: "Articles 24h", value: "0", delta: "=" },
      { label: "Articles 7j", value: "0", delta: "=" },
      { label: "Top rubrique", value: "—", delta: "=" },
      { label: "Sources", value: "0", delta: "=" },
    ],
    tags: ["#gaming"],
  },

  actors: [],

  feed: [],

  // pas de section "À venir" : pas d'API gratuite stable pour les calendriers de sortie
  prod_cases: [],

  trends: [],
};
