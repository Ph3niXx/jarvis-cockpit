// Sport — corpus initial : vide au démarrage, hydraté par data-loader au clic sidebar
// (pipelines/sport_sync.py remplit sport_articles → loadPanel("sport") mute les champs).
// Seuls prod_cases (événements calendar) restent statiques — pas d'API gratuite fiable.
window.SPORT_DATA = {
  headline: {
    kicker: "Chargement...",
    actor: "—",
    version: "Sport",
    tagline: "Fetching des flux RSS sport en cours",
    body: "Les articles apparaîtront ici dès que le pipeline quotidien aura tourné.",
    metrics: [
      { label: "Discipline", value: "—", delta: "=" },
      { label: "Source", value: "—", delta: "=" },
      { label: "Publié", value: "—", delta: "=" },
      { label: "Articles", value: "0", delta: "=" },
    ],
    tags: ["#sport"],
  },

  actors: [],

  feed: [],

  // prod_cases = "À la une par discipline" — hydraté dynamiquement par loadPanel("sport").
  prod_cases: [],

  trends: [],
};
