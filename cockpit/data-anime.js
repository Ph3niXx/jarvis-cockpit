// Anime / Cinéma / Séries — corpus initial : vide au démarrage
// (pipelines/anime_sync.py remplit anime_articles → loadPanel("anime") mute les champs).
// prod_cases = les 6 prochains animes de Jikan upcoming triés par date de diffusion.
window.ANIME_DATA = {
  headline: {
    kicker: "Chargement...",
    actor: "—",
    version: "Anime / Ciné / Séries",
    tagline: "Fetching des flux RSS en cours",
    body: "Les articles apparaîtront ici dès que le pipeline quotidien aura tourné.",
    metrics: [
      { label: "Articles 24h", value: "0", delta: "=" },
      { label: "Articles 7j", value: "0", delta: "=" },
      { label: "Top statut", value: "—", delta: "=" },
      { label: "Sources", value: "0", delta: "=" },
    ],
    tags: ["#anime", "#cine", "#series"],
  },

  actors: [],
  feed: [],
  prod_cases: [],
  trends: [],
};
