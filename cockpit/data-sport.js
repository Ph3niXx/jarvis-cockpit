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

  // Événements majeurs à venir — tenu à la main, pas d'API gratuite stable.
  prod_cases: [
    { company: "Tour de France 2026", logo_mark: "TF", color: "#ffce00", scale: "21 étapes · 3 semaines", model: "Départ Barcelone", domain: "Cyclisme", when: "4 juillet 2026", headline: "Parcours dévoilé : 7 étapes de montagne, Ventoux + Galibier + Tourmalet.", impact: "Favori : Pogačar" },
    { company: "Roland-Garros 2026", logo_mark: "RG", color: "#b3491a", scale: "2 semaines · Grand Chelem", model: "Paris · terre battue", domain: "Tennis", when: "24 mai - 7 juin 2026", headline: "Alcaraz tenant du titre, Sinner favori annoncé, Djokovic en outsider.", impact: "Focus Français : Fils, Mpetshi Perricard" },
    { company: "Mondiaux Natation 2026", logo_mark: "MN", color: "#0077be", scale: "2 semaines · Budapest", model: "FINA World Champs", domain: "Natation", when: "Juillet 2026", headline: "Marchand visera 5 médailles d'or après sa domination des JO Paris.", impact: "Test majeur avant LA28" },
    { company: "Euro 2028", logo_mark: "UE", color: "#1e4fa5", scale: "24 nations · Royaume-Uni + Irlande", model: "24 équipes", domain: "Football", when: "Juin-juillet 2028", headline: "France dans un groupe abordable : Suède, Pays-Bas, Albanie.", impact: "Objectif demi-finale" },
    { company: "Worlds 2026 LoL", logo_mark: "W", color: "#c89b3c", scale: "24 équipes · Paris", model: "Riot Games", domain: "E-sport", when: "Octobre 2026", headline: "KC qualifié en tant que 1er seed LEC. Format double-élim dès les play-ins.", impact: "Premier Worlds à Paris" },
    { company: "Coupe du Monde Rugby 2027", logo_mark: "CM", color: "#1a3a6c", scale: "20 équipes · Australie", model: "World Rugby", domain: "Rugby", when: "Octobre-novembre 2027", headline: "XV de France tenant du titre 2023, équipe renouvelée autour de Dupont.", impact: "Objectif doublé historique" },
  ],

  trends: [],
};
