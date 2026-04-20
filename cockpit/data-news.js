// Actualités — corpus initial : vide au démarrage
// (pipelines/news_sync.py remplit news_articles → loadPanel("news") mute les champs).
window.NEWS_DATA = {
  headline: {
    kicker: "Chargement...",
    actor: "—",
    version: "Actualités",
    tagline: "Fetching des flux RSS actu en cours",
    body: "Les articles apparaîtront ici dès que le pipeline quotidien aura tourné.",
    metrics: [
      { label: "Articles 24h", value: "0", delta: "=" },
      { label: "Articles 7j", value: "0", delta: "=" },
      { label: "Top zone", value: "—", delta: "=" },
      { label: "Sources", value: "0", delta: "=" },
    ],
    tags: ["#actu"],
  },

  actors: [],
  feed: [],
  prod_cases: [],
  trends: [],
};
