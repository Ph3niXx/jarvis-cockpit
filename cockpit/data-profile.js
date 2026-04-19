// ═══════════════════════════════════════════════════════════════
// PROFILE_DATA — v2 · Contrat système
// ─────────────────────────────────────────────
// Philosophie : c'est le contrat entre toi et le pipeline hebdo.
// Pas un CV vivant. Quatre zones :
//   1. contract : ce que get_user_context() injecte dans Claude
//   2. triangulation : déclaré vs observé (Jarvis + footprint)
//   3. commitments : table actionnable (deadline, next_action, last_movement)
//   4. profile_fields + history : éditeur + append-only log
// ═══════════════════════════════════════════════════════════════

window.PROFILE_DATA = {
  identity: {
    name: "Anthony",
    role: "RTE · Malakoff Humanis",
    age: 34,
    location: "Paris 11e",
    profile_version: "v47",
    last_edit_at: "il y a 47 jours",
    last_edit_field: "ambitions",
    next_injection_at: "dimanche 03:00",
    energy: { level: 0.72, mood: "focus" },
  },

  // Dernière uncomfortable question posée par le pipeline hebdo
  uncomfortable_last: {
    date: "dimanche 20 avril · 09:14",
    field_target: "interests.learning",
    question: "Tu dis apprendre Rust depuis janvier. Tes conversations Jarvis n'en parlent plus depuis 92 jours et ton watch time YouTube est à 80 % TFT. Est-ce que c'est encore un objectif ou est-ce que tu devrais le retirer du profil ?",
    answer: "Retirer. J'ai pas la bande passante. Je garde le principe \"apprendre un langage systèmes\" sans date.",
    resolution: "ambitions.learn_rust → archivé · replaced by learn_systems_lang (no deadline)",
  },

  // ═══ ZONE 1 — CONTRAT d'injection ═══════════════════
  // Exactement ce que Claude voit dimanche 03:00
  contract: {
    next_run_at: "dimanche 03:00 · dans 4 jours",
    last_run_at: "dimanche 20 avril · 03:00",
    total_tokens: 1247,
    general_context: [
      { field: "name", value: "Anthony, 34, Paris 11e", tokens: 18, updated_at: "2024-11-08", fresh: "stable" },
      { field: "role", value: "Release Train Engineer (RTE) sur le train Vente chez Malakoff Humanis — 4 équipes SAFe, ~45 personnes, PI planning trimestriel.", tokens: 52, updated_at: "2024-11-08", fresh: "stable" },
      { field: "contexts", value: "Malakoff Humanis (55%), conseil side-project (20%), Prompt Club (15%), perso (10%)", tokens: 42, updated_at: "il y a 12j", fresh: "fresh" },
      { field: "values", value: "Utilité > élégance · pensée longue · humain dans la boucle · clarté > exhaustivité · transparence des erreurs · équilibre pro/perso non négociable.", tokens: 78, updated_at: "il y a 47j", fresh: "stable" },
      { field: "ambitions", value: "Générer 25k€ de side-revenue en 2026 · monter une offre conseil IA mutuelles/assurance à 3 ans · transition 60% side / 40% salarié à 3 ans.", tokens: 66, updated_at: "il y a 47j", fresh: "stable" },
      { field: "interests.learning", value: "Fine-tuning LoRA, context engineering avancé, vente B2B. (Rust retiré le 20 avril.)", tokens: 38, updated_at: "il y a 3j", fresh: "fresh" },
      { field: "communication_prefs", value: "Tutoiement. Direct, sans préambule. Court par défaut. Challenge les idées faibles. Cite source + date pour toute info externe.", tokens: 58, updated_at: "il y a 38j", fresh: "stable" },
      { field: "refuse_topics", value: "Crypto, Web3, métavers, astrologie.", tokens: 16, updated_at: "il y a 89j", fresh: "stale" },
      { field: "deep_work_hours", value: "8h-11h meilleur créneau. Pas de meetings avant 10h ni après 17h.", tokens: 28, updated_at: "2024-11-08", fresh: "stable" },
      { field: "current_projects", value: "POC agent souscription Malakoff (phase 2, retour direction fin mai) · Offre workshop AI Act COMEX (promo externe à lancer) · Prompt Club session mai.", tokens: 68, updated_at: "il y a 4j", fresh: "fresh" },
      { field: "weekend_rule", value: "Aucun travail salarié le week-end. Side-projects OK samedi matin 2h max.", tokens: 26, updated_at: "2024-11-08", fresh: "stable" },
    ],
    // Ce que get_user_context(mission="weekly_reflection") retire
    mission_excluded: [
      "deep_work_hours",
      "weekend_rule",
      "current_projects",
    ],
    mission_specific: {
      mission: "weekly_reflection",
      note: "Dimanche, on retire les champs opérationnels pour laisser place à la réflexion long terme.",
      excluded_tokens: 122,
      final_tokens: 1125,
    },
  },

  // ═══ ZONE 2 — TRIANGULATION ═══════════════════════
  // déclaré vs observé (Jarvis nightly_learner) vs observé (footprint)
  triangulation: {
    last_nightly_run: "02:47",
    divergences_critical: 2,
    divergences_drift: 3,
    rows: [
      {
        field: "interests.learning · Rust",
        declared: "Apprendre Rust — priorité 2026",
        declared_age: "90j",
        jarvis: "0 conversation Rust depuis 92j",
        footprint: "YouTube : 80 % TFT, 0 tuto Rust",
        level: "critical",
        action: "Champ archivé le 20 avril suite à question hebdo. ✓",
        resolved: true,
      },
      {
        field: "values · deep work",
        declared: "Deep work prioritaire · 8h-11h",
        declared_age: "164j",
        jarvis: "Sessions moy. 14 min cette semaine (vs déclaré 2-3h)",
        footprint: "Calendar : 6 meetings 8h-11h semaine dernière",
        level: "critical",
        action: "Proposer uncomfortable question dimanche prochain",
      },
      {
        field: "sleep · cible 23h00",
        declared: "Couché 23h00 max",
        declared_age: "180j",
        jarvis: "—",
        footprint: "Oura : moyenne 00:47 sur 30j (17/30 soirs après minuit)",
        level: "drift",
        action: "Proposer ajustement du champ → 00:00",
      },
      {
        field: "side-revenue · 25k€",
        declared: "25 000 € en 2026",
        declared_age: "47j",
        jarvis: "6 800 € facturés · aucun deal mentionné depuis 11j",
        footprint: "LinkedIn : 0 post 2026, dernière prospection avril",
        level: "drift",
        action: "Commitment stale — décider pour action S18 ?",
      },
      {
        field: "fine-tuning LoRA",
        declared: "En cours d'apprentissage",
        declared_age: "80j",
        jarvis: "2 démarrages mentionnés, 0 résultat. Dernière mention 8j.",
        footprint: "HuggingFace : 1 notebook créé il y a 11 sem., 0 commit",
        level: "drift",
        action: "Uncomfortable question candidate",
      },
      {
        field: "communication_prefs · court",
        declared: "Court par défaut",
        declared_age: "38j",
        jarvis: "Confirmé · 78 % messages < 4 lignes",
        footprint: "—",
        level: "aligned",
        action: "—",
      },
      {
        field: "Prompt Club · régulier",
        declared: "Co-animateur, ~1 rencontre/mois",
        declared_age: "12j",
        jarvis: "Confirmé · 3 sessions mentionnées derniers 90j",
        footprint: "Meetup.com : 3 events hostés (janv, fév, mars)",
        level: "aligned",
        action: "—",
      },
      {
        field: "refuse_topics · crypto",
        declared: "Pas sur mon radar",
        declared_age: "89j",
        jarvis: "Confirmé · 0 requête crypto 90j",
        footprint: "—",
        level: "aligned",
        action: "—",
      },
    ],
  },

  // ═══ ZONE 3 — COMMITMENTS ═══════════════════════════
  // Table actionnable séparée de user_profile
  commitments: [
    {
      id: "c1",
      label: "Livrer POC souscription Malakoff",
      deadline: "2026-05-31",
      deadline_fmt: "31 mai · dans 34j",
      next_action: "Brief PO Sophie sur scope phase 2 avant vendredi",
      last_movement: "hier · commit repo POC",
      movement_days: 1,
      status: "on-track",
    },
    {
      id: "c2",
      label: "Vendre 2 workshops AI Act externes",
      deadline: "2026-06-30",
      deadline_fmt: "30 juin · dans 64j",
      next_action: "Relancer Thomas Lenoir + poster teaser LinkedIn cette semaine",
      last_movement: "il y a 11j · email prospect",
      movement_days: 11,
      status: "at-risk",
    },
    {
      id: "c3",
      label: "Finir fine-tuning LoRA perso",
      deadline: "2026-05-31",
      deadline_fmt: "31 mai · dans 34j",
      next_action: "Reprendre notebook HuggingFace · bloquer 2h samedi",
      last_movement: "il y a 28j · 2 démarrages non finis",
      movement_days: 28,
      status: "stale",
    },
    {
      id: "c4",
      label: "Publier 1er article blog perso",
      deadline: "2026-12-31",
      deadline_fmt: "fin d'année · dans 247j",
      next_action: "Choisir sujet · soit agents supervisés soit retour POC",
      last_movement: "il y a 22j · draft v2",
      movement_days: 22,
      status: "stale",
    },
    {
      id: "c5",
      label: "Session Prompt Club mai",
      deadline: "2026-05-22",
      deadline_fmt: "22 mai · dans 25j",
      next_action: "Briefer 2 invités · envoyer invitation Meetup",
      last_movement: "il y a 4j · thème défini",
      movement_days: 4,
      status: "on-track",
    },
    {
      id: "c6",
      label: "Promotion Agile Coach (Malakoff)",
      deadline: "2026-12-31",
      deadline_fmt: "fin d'année · dans 247j",
      next_action: "Demander entretien à Marc Duval (DSI)",
      last_movement: "il y a 67j · discussion informelle",
      movement_days: 67,
      status: "stale",
    },
    {
      id: "c7",
      label: "Newsletter perso — lancer ou abandonner",
      deadline: "2026-05-15",
      deadline_fmt: "15 mai · dans 18j",
      next_action: "Décision binaire · ne pas rester en incubation",
      last_movement: "il y a 12j · mention carnet",
      movement_days: 12,
      status: "at-risk",
    },
  ],

  // ═══ ZONE 4 — PROFILE FIELDS (edit drawer) ═══════════
  profile_fields: [
    { key: "name", value: "Anthony", type: "text", updated: "2024-11-08" },
    { key: "age", value: 34, type: "number", updated: "2024-11-08" },
    { key: "location", value: "Paris 11e", type: "text", updated: "il y a 6 mois" },
    { key: "role", value: "RTE · Malakoff Humanis", type: "text", updated: "2024-11-08" },
    { key: "contexts", value: "malakoff (55%), conseil (20%), promptclub (15%), perso (10%)", type: "textarea", updated: "il y a 12j" },
    { key: "values", value: "Utilité > élégance · pensée longue · humain dans la boucle · clarté > exhaustivité · transparence des erreurs · équilibre non-négociable", type: "textarea", updated: "il y a 47j" },
    { key: "ambitions", value: "25k€ side-revenue 2026 · offre conseil IA mutuelles à 3 ans · 60/40 side/salarié", type: "textarea", updated: "il y a 47j" },
    { key: "interests.learning", value: "Fine-tuning LoRA · context engineering · vente B2B", type: "textarea", updated: "il y a 3j" },
    { key: "communication_prefs", value: "Tutoiement · direct · court par défaut · challenge actif · citations avec lien+date", type: "textarea", updated: "il y a 38j" },
    { key: "refuse_topics", value: "Crypto, Web3, métavers, astrologie", type: "textarea", updated: "il y a 89j" },
    { key: "deep_work_hours", value: "8h-11h · pas meetings avant 10h ni après 17h", type: "text", updated: "2024-11-08" },
  ],

  // ═══ HISTORY — append-only ═════════════════════════
  history: [
    { date: "2026-04-27", date_fmt: "il y a 3j", field: "interests.learning", diff_from: "Fine-tuning LoRA · Rust · context engineering", diff_to: "Fine-tuning LoRA · context engineering · vente B2B", source: "self", trigger: "uncomfortable_question#47" },
    { date: "2026-04-20", date_fmt: "il y a 10j", field: "ambitions.learn_rust", diff_from: "Apprendre Rust priorité 2026", diff_to: "[archivé]", source: "self", trigger: "weekly_reflection" },
    { date: "2026-04-17", date_fmt: "il y a 13j", field: "contexts", diff_from: "malakoff (60%), conseil (15%), promptclub (15%), perso (10%)", diff_to: "malakoff (55%), conseil (20%), promptclub (15%), perso (10%)", source: "nightly_learner", trigger: "context_drift_detected" },
    { date: "2026-03-14", date_fmt: "il y a 47j", field: "values", diff_from: "Utilité > élégance · pensée longue · humain dans la boucle", diff_to: "Utilité > élégance · pensée longue · humain dans la boucle · clarté > exhaustivité · transparence des erreurs · équilibre non-négociable", source: "self", trigger: "manual_edit" },
    { date: "2026-03-14", date_fmt: "il y a 47j", field: "ambitions", diff_from: "20k€ side-revenue 2026", diff_to: "25k€ side-revenue 2026 · offre conseil IA mutuelles à 3 ans · 60/40 side/salarié", source: "self", trigger: "manual_edit" },
    { date: "2026-03-23", date_fmt: "il y a 38j", field: "communication_prefs", diff_from: "Tutoiement · direct · court par défaut · challenge actif", diff_to: "+ citations avec lien+date", source: "nightly_learner", trigger: "pattern_observed" },
    { date: "2026-01-31", date_fmt: "il y a 89j", field: "refuse_topics", diff_from: "Crypto, Web3, métavers", diff_to: "+ astrologie", source: "self", trigger: "manual_edit" },
    { date: "2026-01-22", date_fmt: "il y a 98j", field: "contexts", diff_from: "malakoff (70%), conseil (15%), promptclub (15%)", diff_to: "malakoff (60%), conseil (15%), promptclub (15%), perso (10%)", source: "self", trigger: "manual_edit" },
    { date: "2025-11-08", date_fmt: "il y a 6 mois", field: "location", diff_from: "Lille", diff_to: "Paris 11e", source: "self", trigger: "manual_edit" },
  ],
};
