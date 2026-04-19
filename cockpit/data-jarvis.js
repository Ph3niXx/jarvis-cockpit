// ═══════════════════════════════════════════════════════════════
// JARVIS_DATA — Conversation unique + mémoire de toi
// ─────────────────────────────────────────────
// Modèle : ChatGPT en mode default (pas de threads), mais avec
// un panneau "Ce que je sais de toi" (mémoire structurée, éditable)
// à droite. Le chat est infini, segmenté par séparateurs temporels.
// ═══════════════════════════════════════════════════════════════

window.JARVIS_DATA = {
  meta: {
    first_conversation: "2024-11-08",
    total_messages: 4287,
    total_hours: 142,
    last_active: "Il y a 3 minutes",
  },

  // Mémoire structurée : ce que Jarvis sait de toi
  // Chaque fait a une source (comment il l'a appris) et un timestamp
  memory: [
    // ─── Identité & contexte pro ──────────────
    { id: "m1", category: "profil", label: "Rôle", value: "RTE (Release Train Engineer) sur le train Vente chez Malakoff Humanis", pinned: true, source: "profil", learned: "2024-11-08", strength: "strong", editable: false },
    { id: "m2", category: "profil", label: "Ancienneté poste", value: "18 mois", source: "conversation 4 avr", learned: "2026-04-04", strength: "strong", editable: true },
    { id: "m3", category: "profil", label: "Équipe", value: "4 équipes SAFe, ~45 personnes, PI planning trimestriel", source: "conversation 12 mar", learned: "2026-03-12", strength: "strong", editable: true },
    { id: "m4", category: "profil", label: "Stack IA perso", value: "Claude Pro + Cursor + quelques MCPs (Outlook, Notion)", source: "conversation 18 avr", learned: "2026-04-18", strength: "medium", editable: true },

    // ─── Préférences de travail ───────────────
    { id: "m10", category: "préférences", label: "Style de réponse", value: "Direct, sans préambule, exemples concrets. Tu détestes les intros du type \"Excellente question\".", pinned: true, source: "conversation 3 déc", learned: "2024-12-03", strength: "strong", editable: true },
    { id: "m11", category: "préférences", label: "Format long vs court", value: "Court par défaut. Long seulement si tu demandes explicitement \"creuse\" ou \"détaille\".", source: "conversation 19 jan", learned: "2026-01-19", strength: "strong", editable: true },
    { id: "m12", category: "préférences", label: "Tutoiement", value: "Toujours. \"Vous\" te paraît froid.", source: "config initiale", learned: "2024-11-08", strength: "strong", editable: true },
    { id: "m13", category: "préférences", label: "Citations de sources", value: "Quand tu cites un article, mettre lien + date. Pas de \"selon des experts\".", source: "conversation 7 fév", learned: "2026-02-07", strength: "medium", editable: true },
    { id: "m14", category: "préférences", label: "Ton", value: "Tu apprécies que je challenge les idées faibles. Pas de flatterie.", source: "conversation 14 mar", learned: "2026-03-14", strength: "strong", editable: true },

    // ─── Sujets d'intérêt suivis ──────────────
    { id: "m20", category: "intérêts", label: "Veille IA", value: "Agents, RAG, context caching, MCPs, AI Act. Tu suis 47 sources dont Anthropic, Hugging Face, LatentSpace, Simon Willison.", pinned: true, source: "signaux + historique lecture", learned: "en continu", strength: "strong", editable: true },
    { id: "m21", category: "intérêts", label: "Signaux actifs", value: "agent memory, small language models, context engineering, ai act phase 3", source: "panel Signaux faibles", learned: "en continu", strength: "strong", editable: true },
    { id: "m22", category: "intérêts", label: "Hors IA", value: "Anime / ciné / séries (Frieren, Succession), gaming (Elden Ring Nightreign), musique (Tame Impala)", source: "panels perso", learned: "en continu", strength: "medium", editable: true },
    { id: "m23", category: "intérêts", label: "Non intéressé par", value: "Crypto, Web3, métavers. Tu as explicitement dit \"pas sur mon radar\" 3 fois.", source: "conversation 22 jan", learned: "2026-01-22", strength: "strong", editable: true },

    // ─── Positions exprimées ──────────────────
    { id: "m30", category: "positions", label: "Sur les agents autonomes", value: "Sceptique à court terme — tu penses que la fiabilité n'y est pas. Tu crois aux \"agents supervisés\" : humain dans la boucle sur les décisions métier.", source: "conversation 11 avr", learned: "2026-04-11", strength: "strong", editable: true },
    { id: "m31", category: "positions", label: "Sur AI Act", value: "Plutôt favorable au principe, inquiet de l'exécution. Ton angle : \"obligation de moyens vs résultats\".", source: "conversation 9 avr", learned: "2026-04-09", strength: "medium", editable: true },
    { id: "m32", category: "positions", label: "Sur fine-tuning", value: "Tu estimes que LoRA sur tes notes pro serait utile, mais tu manques de temps. Tu m'as demandé 2× de t'aider à démarrer.", source: "conversations 28 mar + 14 avr", learned: "2026-04-14", strength: "medium", editable: true },
    { id: "m33", category: "positions", label: "Sur Claude vs ChatGPT", value: "Claude pour l'écrit et le code, ChatGPT pour la recherche web. Tu as migré vers Claude en février 2025.", source: "conversation 2 fév", learned: "2026-02-02", strength: "strong", editable: true },

    // ─── Projets en cours ─────────────────────
    { id: "m40", category: "projets", label: "Offre AI Act décideurs", value: "Tu travailles sur une offre de workshop 4-6k€ pour COMEX mutuelles. 4 ateliers internes déjà animés. Objectif : le promouvoir en mai.", source: "panel Opportunités + conversation 18 avr", learned: "2026-04-18", strength: "strong", pinned: true, editable: true },
    { id: "m41", category: "projets", label: "Pilote agent souscription Malakoff", value: "POC interne phase 2 — retour à la direction prévu fin mai. Stack : Claude Haiku + Supabase + MCP métier.", source: "conversation 15 avr", learned: "2026-04-15", strength: "strong", editable: true },
    { id: "m42", category: "projets", label: "Newsletter perso", value: "Idée en incubation depuis 3 semaines. Tu hésites sur la fréquence (hebdo ou bi-mensuelle).", source: "carnet d'idées", learned: "2026-03-29", strength: "weak", editable: true },

    // ─── Contraintes & contextes ──────────────
    { id: "m50", category: "contraintes", label: "Disponibilité", value: "Journées PI planning (trimestrielles) = injoignable. Tu préfères que je mette en file d'attente plutôt que de te relancer.", source: "conversation 5 fév", learned: "2026-02-05", strength: "strong", editable: true },
    { id: "m51", category: "contraintes", label: "Budget API", value: "3 €/jour max sur toi + les agents de veille. Au-delà je dois demander.", source: "config + conversation 1 avr", learned: "2026-04-01", strength: "strong", editable: true },
    { id: "m52", category: "contraintes", label: "Vie perso", value: "Conjointe : Sophie (plan congés à déposer avant mi-mai). Pas d'enfants. Habitent Paris.", source: "conversation 20 mar", learned: "2026-03-20", strength: "medium", editable: true },
  ],

  // Timeline de messages — conversation continue sur plusieurs jours
  // Ordre chronologique. Chaque "stamp" marque un séparateur (nouveau jour / plus tard)
  // Timestamps implicites par rapport à "aujourd'hui = mardi 21 avril 2026, 6h14"
  messages: [
    // ─── Il y a 3 semaines (jalon) ─────────────
    { kind: "stamp", label: "Il y a 3 semaines · lundi 31 mars" },
    { kind: "user", text: "Si je veux push un workshop AI Act pour les COMEX mutuelles, tu penses que c'est trop tôt ou la fenêtre est maintenant ?" },
    { kind: "jarvis", text: "Maintenant. Trois raisons : la Commission publie le guide d'application phase 3 ce mois-ci (obligations haut risque), les mutuelles sont en cycle budgétaire mai-juin, et aucun concurrent direct n'a encore une offre formatée pour décideurs — tout le monde vend du technique.\n\nAngle fort : tu as déjà animé 4 ateliers internes. Le contenu existe à 70%. La friction est le packaging.", cites: [{ kind: "signal", label: "ai act phase 3", id: "ai act phase 3" }] },
    { kind: "user", text: "OK. Je mets ça en idée pour l'instant." },
    { kind: "jarvis", text: "Noté. Je garde l'idée \"Offre AI Act décideurs assurance — workshop 4-6k€\" dans ton carnet. Je t'alerte quand la fenêtre se resserre — tu as ~6 semaines avant que les budgets soient arbitrés.", cites: [{ kind: "idea", label: "Offre AI Act décideurs assurance", id: "id15" }] },

    // ─── Il y a 1 semaine ──────────────────────
    { kind: "stamp", label: "Il y a 1 semaine · lundi 14 avril" },
    { kind: "user", text: "J'ai zappé encore une fois la veille hier. Faut qu'on change quelque chose." },
    { kind: "jarvis", text: "Regardons les chiffres. Sur les 8 dernières semaines, tu as ouvert le Brief du jour 5,2/7 fois en moyenne — mais le dimanche c'est 1,8/7. C'est le jour qui casse la routine.\n\nDeux hypothèses :\n1. Dimanche tu coupes volontairement — c'est sain.\n2. Dimanche tu procrastines et la lecture s'étale au lundi — tu prends du retard.\n\nQuelle des deux ?" },
    { kind: "user", text: "La 2 clairement. Lundi matin c'est la cata parce que je rattrape le week-end." },
    { kind: "jarvis", text: "Alors deux options. Soit je décale le Brief dominical au samedi matin (plus dispo). Soit je le condense sur le weekend en \"digest 48h\" lundi à 6h. Laquelle ?" },
    { kind: "user", text: "Le digest 48h lundi matin. On essaie 4 semaines." },
    { kind: "jarvis", text: "Activé. Le prochain Brief du lundi 28 avril sera un format \"digest weekend\". Je mesure ton taux d'ouverture sur 4 semaines et on recalibre." },

    // ─── Il y a 3 jours ────────────────────────
    { kind: "stamp", label: "Il y a 3 jours · samedi 18 avril" },
    { kind: "user", text: "Regarde ça : https://anthropic.com/news/claude-agents-ga — c'est gros ?" },
    { kind: "jarvis", text: "Oui, gros. Trois éléments :\n\n1. **Mémoire persistante native** — plus besoin de MCP custom pour l'état long terme. Direct impact sur ton POC Malakoff, tu peux enlever ~2 semaines de dev.\n\n2. **Orchestration multi-outils** — le SDK gère les boucles d'agent, retries, budgets tokens. Ce que tu bricolais à la main.\n\n3. **Tarification** — +18% vs Sonnet classique. Sur ton budget 3€/jour, tu dois arbitrer : agent ou simple chat.\n\nTu veux que je crée une note wiki avec l'impact concret sur ton pilote ?", cites: [{ kind: "article", label: "Claude Agents GA — Anthropic", id: "a_claude_ga" }] },
    { kind: "user", text: "Oui. Et prévois-moi 30 min mercredi pour creuser." },
    { kind: "jarvis", text: "Fait. Note wiki \"Claude Agents GA — impact pilote Malakoff\" créée (backlinks : pilote souscription, agent memory, MCP). Créneau posé mercredi 23 avril, 14h-14h30, salle rouge (bloquée à ton calendrier)." },

    // ─── Hier ──────────────────────────────────
    { kind: "stamp", label: "Hier · lundi 20 avril" },
    { kind: "user", text: "Tu me résumes la semaine en 3 lignes ?" },
    { kind: "jarvis", text: "**Ta semaine S16 en 3 lignes :**\n\n1. **Ton** — Anthropic a annoncé Claude Agents en GA ; ça accélère ton POC souscription Malakoff de ~2 semaines.\n\n2. **Marché** — Mistral signe BNP Paribas (140 cas d'usage). Tu n'es plus dans la phase \"faut-il y aller\" mais \"comment on industrialise\". Argumentaire à réutiliser pour ton offre AI Act décideurs.\n\n3. **Perso** — 3/4 séances sport. 1 nouveau signal faible (orchestration multi-agents, +9 cette semaine). Sophie t'a demandé où tu en es sur le plan vacances." },
    { kind: "user", text: "Merde, j'ai oublié de répondre à Sophie pour les vacances." },
    { kind: "jarvis", text: "Je te pose un rappel ce soir à 19h ? Ou tu préfères que je draft une réponse maintenant avec les dates qu'on avait évoquées — 8-22 août Bretagne ?", cites: [{ kind: "opp", label: "Bloquer 2 semaines off en août", id: "opp_vacances" }] },
    { kind: "user", text: "Rappel 19h. Je lui parle en rentrant." },
    { kind: "jarvis", text: "OK. Rappel posé : mardi 19h \"Parler vacances Sophie\"." },

    // ─── Ce matin ──────────────────────────────
    { kind: "stamp", label: "Ce matin · mardi 21 avril, 6h14" },
    { kind: "jarvis", kind_aside: true, text: "☀ Brief du jour S17 prêt — 47 articles synthétisés, 3 incontournables, 1 signal en hausse forte (agent memory +14). Lecture 4 min.", cites: [{ kind: "brief", label: "Brief du jour · S17", id: "brief_s17" }] },
    { kind: "user", text: "Avant le brief : j'ai réfléchi cette nuit, l'offre AI Act décideurs je la lance ou pas ?" },
    { kind: "jarvis", text: "On en a parlé 3 fois ces 4 dernières semaines et on a toujours fini par reporter. Je te redemande : qu'est-ce qui te bloque réellement ?\n\nSi c'est la peur de mal vendre → on peut builder ton pitch en 1h aujourd'hui.\nSi c'est le temps → on décale explicitement à juin et on arrête d'en parler.\nSi c'est l'envie → dis-le, et on parque l'idée proprement.\n\nLaquelle des trois ?", challenging: true },
  ],

  // Actions rapides suggérées au composer
  quick_prompts: [
    "Résume-moi la semaine",
    "Quels signaux ont bougé ?",
    "Qu'est-ce que tu sais de mon pilote Malakoff ?",
    "Challenge cette idée :",
    "Rédige un mail à…",
  ],

  // Stats rapides pour le header
  stats: {
    messages_today: 14,
    messages_week: 89,
    memory_items: 34,
    memory_pinned: 4,
    cost_today_eur: 2.41,
    cost_budget_eur: 3.0,
  },
};
