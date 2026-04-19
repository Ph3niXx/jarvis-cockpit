// Wiki IA — bibliothèque vivante : entrées auto (Jarvis) + perso mêlées
window.WIKI_DATA = {
  stats: {
    total: 142,
    auto: 98,
    perso: 44,
    created_this_week: 6,
    updated_this_week: 23,
    most_read: "Pattern : Agent avec mémoire persistante",
  },

  categories: [
    { id: "all", label: "Tout" },
    { id: "agents", label: "Agents" },
    { id: "rag", label: "RAG" },
    { id: "prompting", label: "Prompting" },
    { id: "finetuning", label: "Fine-tuning" },
    { id: "regulation", label: "Régulation" },
    { id: "architecture", label: "Architecture" },
    { id: "metier", label: "Métier RTE" },
    { id: "idees", label: "Idées" },
    { id: "fondamentaux", label: "Fondamentaux" },
  ],

  entries: [
    {
      id: "w1",
      kind: "auto",
      category: "agents",
      category_label: "Agents",
      title: "Pattern : Agent avec mémoire persistante (RAG + context cache)",
      excerpt: "Combiner retrieval sur notes passées + Claude context caching pour agents qui se souviennent entre sessions.",
      updated: "12 avr",
      created: "3 avr",
      word_count: 1420,
      read_count: 3,
      read_time: 7,
      tags: ["agents", "memory", "rag", "claude"],
      related: ["w7", "w17", "w3"],
      backlinks: ["w2", "w8"],
      pinned: true,
      content: `Un agent avec mémoire persistante doit résoudre trois problèmes : **retrouver** ce qui a été dit/fait avant, **filtrer** ce qui est pertinent à la question courante, et **l'injecter** dans le contexte sans exploser le coût.

## Architecture de référence

La combinaison qui fonctionne aujourd'hui repose sur trois briques :

1. **Stockage** — chaque tour de conversation est sérialisé en note courte (< 200 tokens), avec timestamp, identifiant de session, et tags extraits automatiquement.
2. **Retrieval** — à chaque nouveau tour, une requête hybride (vecteur + BM25) ramène 5 à 10 notes pertinentes. Un reranker (Cohere ou Voyage) affine.
3. **Context caching** — les notes retrouvées sont insérées dans un bloc de prompt stable, cacheable. Anthropic facture l'écriture à +25% et la lecture à 10%.

## Points de vigilance

Le piège classique : ne pas dédupliquer les notes similaires. Un agent qui a discuté 200 fois du même sujet va ramener 10 versions quasi-identiques et polluer son contexte. Ajouter une étape de **clustering** avant retrieval résout 80% du problème.

Autre piège : la fraîcheur. Les notes de 6 mois ont rarement le même poids qu'une note d'hier. Appliquer un **decay exponentiel** sur le score de similarité.

## Comparatif avec alternatives

- **Summarization récursive** — simple mais perte d'info progressive. À éviter sur sessions longues.
- **Chain-of-memory** — stocke tout dans un unique document qu'on grossit. Scale mal au-delà de 50k tokens.
- **RAG + cache (cette solution)** — plus complexe à mettre en place, mais tient la charge.

## À retenir

→ Hybrid search est plus important que l'embedding utilisé.
→ Le cache est rentable à partir de 3 réutilisations.
→ Penser dédup + decay dès la première ligne de code.`,
    },
    {
      id: "w2",
      kind: "perso",
      category: "metier",
      category_label: "Métier RTE",
      title: "Mes notes — cérémonies SAFe RTE Vente",
      excerpt: "Structure PI planning, system demo, inspect & adapt. Rituels qui marchent vs ceux qui ne marchent pas chez nous.",
      updated: "18 avr",
      created: "2023-09-12",
      word_count: 2300,
      read_count: 8,
      read_time: 11,
      tags: ["safe", "rte", "métier", "pi-planning"],
      related: ["w6", "w8"],
      backlinks: ["w1"],
      pinned: true,
      content: `Notes prises sur 18 mois de RTE sur le train Vente Malakoff. Ce qui a tenu, ce qui s'est effondré.

## Ce qui marche

**PI Planning en présentiel, 2 jours complets.** Pas de format hybride qui fonctionne sur 150 personnes. Les retros hybrides qu'on a tentées ont toutes produit des backlogs incohérents.

**Scrum of Scrums hebdo, 30 min max, avec scribe.** Sans scribe tournant, le rituel dérive en réunion sans actions.

**System Demo tous les 2 sprints.** Tous les sprints c'est trop (les équipes trichent), jamais c'est pire.

## Ce qui ne marche pas chez nous

**Inspect & Adapt en fin de PI sur une journée entière.** Personne ne reste concentré, les décisions prises le soir sont rarement tenues. On a passé à 2x 2h sur 2 jours.

**Scrum Masters en rotation sur les équipes.** Idée théoriquement séduisante, en pratique les équipes perdent leur dynamique.

## Métriques qui comptent vraiment

Après avoir essayé tous les KPI SAFe, seuls 3 nous ont servi :
- Predictability (% de stories engagées livrées par sprint)
- Feature Lead Time (de backlog à prod)
- NPS équipe en fin de PI

Le reste (vélocité, burndown, etc.) informe au mieux, pollue au pire.`,
    },
    {
      id: "w3",
      kind: "auto",
      category: "regulation",
      category_label: "Régulation",
      title: "AI Act par catégorie de risque — guide pratique 2026",
      excerpt: "Les 4 catégories, les obligations concrètes, ce qui change en phase 3. Synthèse maintenue par Jarvis.",
      updated: "15 avr",
      created: "2025-12-01",
      word_count: 3100,
      read_count: 12,
      read_time: 14,
      tags: ["ai-act", "compliance", "régulation"],
      related: ["w11", "w7"],
      backlinks: [],
      pinned: false,
      content: `L'AI Act distingue 4 niveaux de risque avec des obligations très asymétriques. Cette entrée synthétise ce qui s'applique concrètement selon ton rôle (utilisateur, déployeur, fournisseur).

## Les 4 catégories

**Risque inacceptable — interdit.** Social scoring à la chinoise, manipulation subliminale, identification biométrique en temps réel dans l'espace public (avec exceptions). Applicable depuis février 2025.

**Haut risque — obligations étendues.** Systèmes listés en annexe III : recrutement, éducation, crédit, justice, infrastructures critiques. Obligations : gestion des risques, documentation technique, qualité des données, supervision humaine, robustesse, cybersécurité.

**Risque limité — transparence.** Chatbots, systèmes de reconnaissance d'émotions, deepfakes. Obligation : informer l'utilisateur qu'il interagit avec une IA.

**Risque minimal — pas d'obligation légale.** La majorité des systèmes.

## Phase 3 (août 2026)

Entrée en vigueur des obligations GPAI (providers de modèles à usage général). Les fournisseurs Claude, GPT, Gemini, Mistral doivent publier :
- Une documentation technique (capacités, limitations, données d'entraînement de haut niveau)
- Une politique de respect du droit d'auteur
- Un résumé détaillé des données utilisées pour l'entraînement

Pour les "modèles présentant un risque systémique" (seuil à 10^25 FLOPs), obligations supplémentaires : évaluation, red teaming, reporting d'incidents.

## Ce qui te concerne en tant que RTE chez Malakoff

Malakoff est *déployeur* sur les systèmes internes. En haut risque (tous les outils RH/candidatures/décisions financières) : tenir le registre, journaliser, supervision humaine active.`,
    },
    {
      id: "w4",
      kind: "perso",
      category: "prompting",
      category_label: "Prompting",
      title: "Snippets — prompts RAG custom que j'utilise vraiment",
      excerpt: "12 prompts que j'utilise vraiment pour du RAG. Gardés par versions avec les résultats obtenus.",
      updated: "20 avr",
      created: "2025-11-15",
      word_count: 850,
      read_count: 5,
      read_time: 4,
      tags: ["prompting", "rag", "snippets"],
      related: ["w7", "w1"],
      backlinks: [],
      pinned: false,
      content: `Collection vivante. Je consigne les prompts que j'utilise pour de vrai, pas ceux qu'on trouve dans les articles.

## Prompt "Cite ou dis-moi que tu sais pas"

Le plus utile pour limiter les hallucinations en RAG :

> "Réponds à la question uniquement à partir des passages fournis. Pour chaque affirmation, cite le passage source entre crochets. Si aucun passage ne permet de répondre, écris 'Je n'ai pas l'information dans les passages fournis' et arrête."

Résultat : -80% d'hallucinations mesurées sur notre POC Malakoff.

## Prompt "Réécris la question d'abord"

Pour les queries floues utilisateur :

> "Avant de répondre, reformule la question en 1-2 phrases en explicitant ce qu'il faudrait chercher. Puis réponds."

Gain surtout sur les questions conversationnelles type "et ça, ça marche comment ?".

## Prompt "3 angles"

Quand l'utilisateur cherche à comprendre plutôt qu'à obtenir un fait :

> "Propose 3 angles d'analyse de la question. Pour chaque angle, extrait du contexte, et conclusion partielle. Termine par une synthèse des 3 angles."`,
    },
    {
      id: "w5",
      kind: "auto",
      category: "architecture",
      category_label: "Architecture",
      title: "Benchmark LLMs — tableau comparatif maintenu à jour",
      excerpt: "Claude, GPT, Gemini, Llama, Qwen, Mistral — scores MMLU, GSM8K, HumanEval, prix, contexte, latence. Actualisé auto.",
      updated: "hier",
      created: "2025-06-20",
      word_count: 1200,
      read_count: 4,
      read_time: 5,
      tags: ["benchmarks", "llms", "comparatif"],
      related: ["w9"],
      backlinks: [],
      pinned: true,
      content: `Tableau mis à jour automatiquement chaque semaine à partir des publications officielles et benchmarks indépendants (LMSYS, Hugging Face Open LLM Leaderboard, Vellum).

## État des forces — avril 2026

**Raisonnement (MMLU-Pro, GPQA)** — Claude Opus 4.1 et GPT-5 sont au coude-à-coude. Gemini 2.5 Ultra rattrape rapidement depuis janvier. Les modèles open (Qwen3, Llama 4 405B) restent 6-8 points derrière.

**Code (HumanEval, SWE-Bench)** — Claude Sonnet 4.5 domine SWE-Bench Verified à 68%. GPT-5 à 62%. Gemini 2.5 à 58%. DeepSeek V3 monte à 51% en open.

**Prix / performance** — Claude Haiku 4.5 offre le meilleur rapport coût/MMLU. Gemini Flash pousse fort sur le segment économique. Llama 4 70B self-hosted bat GPT-4 Turbo sur la plupart des tâches à 1/10ᵉ du prix.

**Latence (TTFT + tokens/s)** — Groq reste imbattable sur les modèles open (Llama 70B à 800 tok/s). Claude Haiku ~200 tok/s, suffisant pour la plupart des usages production.

**Context window** — 200k-1M tokens est devenu standard. Gemini pousse à 2M. Au-delà de 500k, la qualité du recall s'effondre sur tous les modèles (needle-in-haystack ne dit pas tout).`,
    },
    {
      id: "w6",
      kind: "perso",
      category: "idees",
      category_label: "Idées",
      title: "Idée : agent de veille brevets pour train Vente",
      excerpt: "Un agent qui scan l'INPI + Google Patents sur nos mots-clés et nous fait une synthèse hebdo.",
      updated: "17 avr",
      created: "2026-04-05",
      word_count: 420,
      read_count: 2,
      read_time: 2,
      tags: ["idées", "veille", "rte", "brevets"],
      related: ["w2"],
      backlinks: [],
      pinned: false,
      content: `**Le besoin** : notre train Vente travaille sur des fonctionnalités où la concurrence dépose régulièrement des brevets. On rate souvent l'info jusqu'à ce que ça sorte en presse.

**L'idée** : un agent qui :
1. Scrape INPI, EPO, USPTO, Google Patents sur 30 mots-clés métier
2. Filtre par pertinence (LLM judge avec prompt métier)
3. Synthèse hebdo le lundi matin
4. Alerte immédiate si un brevet concurrent touche notre backlog

**Stack envisagée** : Claude Haiku en agent, embeddings Voyage pour clustering, Supabase pour stockage, CRON weekly.

**Budget estimé** : 15€/mois. Effort dev : 2 jours.

**Décideur** : il faut pousser ça au Product Director du train. Rendez-vous pris pour le 28 avril.`,
    },
    {
      id: "w7",
      kind: "auto",
      category: "rag",
      category_label: "RAG",
      title: "RAG patterns — 12 architectures classées",
      excerpt: "Du naive RAG au corrective RAG, avec les cas d'usage et les métriques d'évaluation associées.",
      updated: "8 avr",
      created: "2025-10-02",
      word_count: 2800,
      read_count: 7,
      read_time: 13,
      tags: ["rag", "patterns", "architecture"],
      related: ["w1", "w4"],
      backlinks: ["w1", "w3", "w4"],
      pinned: false,
      content: `Classement pragmatique des patterns RAG du plus simple au plus sophistiqué, avec leur coût, leur gain, et quand les utiliser.

## 1. Naive RAG

Embed → top-k → stuff dans prompt. Suffit dans 60% des cas. Ne pas sur-architecturer avant de mesurer les limites.

## 2. RAG + reranker

Ajoute un reranker (Cohere, Voyage) entre retrieval et génération. Gain mesuré : +15 points de précision sur notre POC. Coût : +30ms de latence.

## 3. Hybrid search (vecteur + BM25)

Pondère résultats sémantiques et lexicaux. Indispensable dès que ton corpus contient du vocabulaire métier spécifique (codes produit, acronymes).

## 4. Query rewriting

LLM réécrit la question avant retrieval. Essentiel pour les questions conversationnelles et les follow-ups.

## 5. HyDE (Hypothetical Document Embeddings)

Génère une réponse hypothétique puis embed celle-ci pour retrieval. Meilleur que la question pure pour des corpus techniques.

## 6. Multi-query RAG

Génère N variantes de la question et aggrège les résultats. Coût × 3-5, gain marginal sauf sur queries ambigües.

## 7. Corrective RAG

Vérifie la pertinence des documents retrouvés, relance si faible. Le pattern le plus robuste actuellement.`,
    },
    {
      id: "w8",
      kind: "perso",
      category: "metier",
      category_label: "Métier RTE",
      title: "REX — pilote RAG Malakoff (3 mois)",
      excerpt: "Ce qui a marché, ce qui a foiré, ce qu'on a dû jeter. Lessons learned après 3 mois de POC.",
      updated: "14 avr",
      created: "2026-01-20",
      word_count: 1600,
      read_count: 6,
      read_time: 7,
      tags: ["rex", "rag", "malakoff"],
      related: ["w2", "w1"],
      backlinks: [],
      pinned: false,
      content: `POC RAG sur la doc juridique Malakoff. 3 mois, 2 dev + moi en lead.

## Ce qui a marché

**Scope hyper serré** — on a démarré sur 1 seul type de document (conventions collectives). Pas sur "toute la doc RH". Ça a permis de livrer en 4 semaines.

**Hybrid search dès le départ** — on a évité de se dire "on mettra du BM25 plus tard". Bonne décision, corpus trop technique pour du pur sémantique.

**Interface minimaliste** — chatbot simple, liens vers les documents cités. Pas de gadget. Adoption forte.

## Ce qui a foiré

**Chunking trop grossier** — on a commencé à 800 tokens. Pourri pour les conventions. On est passés à 300 avec overlap 60. Nuit et jour.

**On a sous-estimé l'anonymisation** — 3 semaines de retard. À la prochaine, anonymisation **avant** embedding, pas après.

**Trop d'énergie sur l'éval, pas assez sur l'UX** — 6 semaines à construire un gold set de 200 questions. Au final, le feedback utilisateur direct a été plus utile. Leçon : commencer avec 30 questions max, itérer.

## Ce qu'on a jeté

- Custom reranker entraîné — Cohere faisait mieux, pour moins cher
- Classification des questions (RAG vs FAQ) — l'utilisateur ne voyait pas la différence
- Dashboard admin — personne ne l'a jamais ouvert`,
    },
    {
      id: "w9",
      kind: "auto",
      category: "fondamentaux",
      category_label: "Fondamentaux",
      title: "Glossaire IA — 150 termes",
      excerpt: "Tous les termes qui reviennent, expliqués en 2-3 phrases. De 'attention' à 'zero-shot'.",
      updated: "10 avr",
      created: "2025-08-01",
      word_count: 4200,
      read_count: 15,
      read_time: 20,
      tags: ["glossaire", "fondamentaux"],
      related: [],
      backlinks: ["w1", "w7"],
      pinned: false,
      content: `Glossaire maintenu par Jarvis. Mis à jour à chaque nouveau terme rencontré dans les lectures hebdomadaires.

## A — extrait

**Attention** — Mécanisme où chaque token d'une séquence peut "regarder" tous les autres pour se représenter. Base des Transformers (Vaswani et al., 2017).

**Agent (IA)** — Système LLM qui peut appeler des outils, prendre des décisions en boucle, et atteindre un but sur plusieurs étapes. Se distingue du chatbot par sa capacité à agir.

**Alignement** — Ensemble des techniques pour faire que le modèle se comporte comme l'humain le souhaite. RLHF, DPO, Constitutional AI sont des méthodes d'alignement.

## C — extrait

**Context caching** — Mise en cache d'une partie du prompt côté fournisseur pour réduire coût et latence sur les appels suivants. Anthropic, OpenAI proposent ce mécanisme.

**Chain of thought (CoT)** — Technique consistant à demander au modèle de raisonner étape par étape avant de répondre. Améliore fortement les tâches de raisonnement complexe.

## Z — extrait

**Zero-shot** — Capacité d'un modèle à effectuer une tâche sans aucun exemple dans le prompt, juste l'instruction.`,
    },
    {
      id: "w10",
      kind: "auto",
      category: "agents",
      category_label: "Agents",
      title: "Tool use : design d'une interface agent efficace",
      excerpt: "Comment décrire un outil pour qu'un LLM l'utilise bien. Schema, exemples, erreurs fréquentes.",
      updated: "5 avr",
      created: "2025-11-30",
      word_count: 1800,
      read_count: 9,
      read_time: 9,
      tags: ["agents", "tool-use", "design"],
      related: ["w1", "w17"],
      backlinks: ["w1"],
      pinned: false,
      content: `Sujet sous-estimé. Un bon schéma d'outil peut augmenter la réussite d'un agent de 30 à 90%. Voici les règles qui fonctionnent.

## Règle 1 — nom explicite et verbal

\`search_customer_orders\` > \`orders_api\`.

## Règle 2 — description orientée cas d'usage, pas technique

Mauvaise : "Endpoint GET /orders/{id}"
Bonne : "Récupère la liste des commandes d'un client sur les 90 derniers jours. À utiliser quand l'utilisateur demande l'historique d'achat."

## Règle 3 — exemples dans la description

2-3 exemples de prompts utilisateur qui déclenchent l'outil. Efficacité mesurée : +20 points.

## Règle 4 — erreurs typées

Retourner des erreurs distinctes (pas_trouvé, non_autorisé, limite_dépassée) pour que l'agent puisse réagir différemment.`,
    },
    {
      id: "w11",
      kind: "auto",
      category: "regulation",
      category_label: "Régulation",
      title: "Registre AI Act : que faut-il vraiment consigner ?",
      excerpt: "Template minimal pour documenter un système haut risque — sans tomber dans la paperasse.",
      updated: "28 mars",
      created: "2026-02-10",
      word_count: 1100,
      read_count: 8,
      read_time: 5,
      tags: ["ai-act", "compliance", "documentation"],
      related: ["w3"],
      backlinks: ["w3"],
      pinned: false,
      content: `La tentation est de rédiger 80 pages de doc pour être tranquille. Inutile — le texte demande précis mais synthétique.

## Ce que le registre doit contenir (obligation stricte)

- Description du système, version, provider
- Finalité et contexte de déploiement
- Méthode de supervision humaine
- Journalisation activée, rétention
- Analyse d'impact (DPIA si données perso)

## Ce que tu peux garder court

La "description technique" : 2-3 pages de vraie substance valent mieux que 40 pages de generic. Focus sur les choix de design spécifiques à ton contexte.

## Ce qui n'est PAS dans le registre

- Les prompts (secret industriel acceptable)
- Les poids du modèle
- Le détail des données d'entraînement (mais résumé oui)`,
    },
    {
      id: "w12",
      kind: "perso",
      category: "idees",
      category_label: "Idées",
      title: "Idée : assistant de revue de PR avec contexte métier",
      excerpt: "LLM qui review les PRs en comprenant les règles métier Malakoff, pas juste le code.",
      updated: "10 avr",
      created: "2026-04-01",
      word_count: 380,
      read_count: 1,
      read_time: 2,
      tags: ["idées", "dev", "agents"],
      related: [],
      backlinks: [],
      pinned: false,
      content: `**Constat** — nos seniors revoient des PRs et disent souvent "ça ne respecte pas la règle métier X". Règle écrite nulle part formellement.

**Idée** — corpus de règles métier en markdown, LLM qui les connaît, annote chaque PR sur GitHub avec les risques métier (pas les style checks — il y a déjà ESLint pour ça).

**Pas simple** — les règles ne sont jamais clairement écrites. Il faudrait un travail amont d'extraction (et Jarvis peut aider ici).

**À tester** — pilote sur le repo de conventions collectives, 1 mois.`,
    },
    {
      id: "w13",
      kind: "auto",
      category: "prompting",
      category_label: "Prompting",
      title: "Prompt engineering en 2026 : ce qui a changé",
      excerpt: "Ce qui ne sert plus (chain-of-thought explicite), ce qui compte maintenant (context engineering).",
      updated: "2 avr",
      created: "2026-03-10",
      word_count: 2100,
      read_count: 11,
      read_time: 10,
      tags: ["prompting", "2026", "context-engineering"],
      related: ["w4"],
      backlinks: [],
      pinned: false,
      content: `La discipline a changé depuis 2023. Ce qui compte en 2026.

## Ce qui n'est plus nécessaire

**"Let's think step by step"** — les modèles raisonnent automatiquement sur les tâches complexes. Explicit CoT est devenu du bruit sur Claude 4, GPT-5, Gemini 2.5.

**Few-shot examples génériques** — remplacés par du RAG dynamique. Insérer les exemples les plus proches de la query courante, pas une liste fixe.

**Formatting tricks (XML, JSON-in-prompt)** — les modèles suivent bien les instructions textuelles. Garder XML uniquement quand la sortie doit être parsée strictement.

## Ce qui compte maintenant

**Context engineering** — terme popularisé par Karpathy fin mars 2026. L'art de choisir quoi mettre dans le contexte, dans quel ordre, à quelle granularité.

**Prompt caching** — structurer ses prompts pour maximiser le cache hit rate. Stable en haut, variable en bas.

**Meta-prompting** — demander au modèle d'écrire son propre prompt à partir d'exemples. Efficace sur des tâches répétitives.`,
    },
    {
      id: "w14",
      kind: "auto",
      category: "finetuning",
      category_label: "Fine-tuning",
      title: "LoRA 8-bit sur Qwen3 — guide pratique",
      excerpt: "Setup, dataset, hyperparamètres. De 0 à un modèle fine-tuné en 4h sur une L4.",
      updated: "30 mars",
      created: "2026-03-20",
      word_count: 1950,
      read_count: 4,
      read_time: 9,
      tags: ["lora", "qwen", "fine-tuning"],
      related: [],
      backlinks: [],
      pinned: false,
      content: `Guide pour fine-tuner Qwen3-7B avec LoRA 8-bit sur une seule GPU consumer (L4 / 4090).

## Environnement

- \`transformers\` ≥ 4.45
- \`peft\` ≥ 0.13
- \`bitsandbytes\`
- \`trl\` pour le trainer SFT
- GPU 24Go VRAM minimum

## Dataset — format

JSONL avec \`{"instruction": ..., "input": ..., "output": ...}\`. Taille minimale exploitable : 200 exemples, idéal 1000+.

## Hyperparamètres qui marchent

- \`r = 16\`
- \`lora_alpha = 32\`
- \`learning_rate = 2e-4\`
- \`num_epochs = 3\`
- \`batch_size = 4\` avec gradient accumulation = 4

## Pièges

- Ne pas oublier \`target_modules\` sur les attention projections ET MLP. Juste attention = résultats médiocres.
- Warmup de 5% des steps. Sans, explosion du gradient au début.`,
    },
    {
      id: "w15",
      kind: "auto",
      category: "architecture",
      category_label: "Architecture",
      title: "Architecture typique d'un chatbot métier en production",
      excerpt: "Stack de référence : load balancer → gateway → agents → outils → observabilité.",
      updated: "25 mars",
      created: "2026-02-15",
      word_count: 1400,
      read_count: 6,
      read_time: 7,
      tags: ["architecture", "production", "chatbot"],
      related: ["w5"],
      backlinks: [],
      pinned: false,
      content: `Stack qui tient en production pour un chatbot métier B2B, testée sur 3 projets Malakoff.

## Couches

**Frontend** — React, stream SSE, état local minimal (les conversations sont serveur-owned).

**Gateway** — FastAPI ou Hono. Auth, rate limit, routing vers les bons agents selon le type de demande.

**Agent layer** — Claude / GPT en fonction de la tâche. Router simple au départ, on n'introduit les agents que quand une tâche simple n'y arrive pas.

**Tools layer** — APIs internes (base produit, CRM, RH). Chaque outil a son propre timeout et retry.

**Observabilité** — LangSmith pour les traces, Datadog pour métriques, PagerDuty pour alertes. Essentiel de capturer le TTFT (time to first token) séparément du TTLT (total).`,
    },
    {
      id: "w16",
      kind: "perso",
      category: "fondamentaux",
      category_label: "Fondamentaux",
      title: "Mes reprises — concepts que je dois consolider",
      excerpt: "Liste de concepts que j'utilise sans vraiment maîtriser. À retravailler.",
      updated: "16 avr",
      created: "2026-03-01",
      word_count: 420,
      read_count: 3,
      read_time: 2,
      tags: ["révisions", "perso"],
      related: [],
      backlinks: [],
      pinned: false,
      content: `Liste vivante. J'y ajoute à chaque fois que je me rends compte que j'utilise un terme sans le maîtriser.

- Flash attention — comment ça marche réellement
- Mixture of experts — pourquoi activer quels experts
- DPO vs PPO — différences concrètes d'implémentation
- vLLM paged attention — intérêt vs batching classique
- Reward hacking — exemples concrets hors papers`,
    },
    {
      id: "w17",
      kind: "auto",
      category: "agents",
      category_label: "Agents",
      title: "Agent orchestration : workflows vs autonomes",
      excerpt: "Quand imposer un workflow rigide, quand laisser l'agent décider. Trade-offs.",
      updated: "22 mars",
      created: "2026-01-10",
      word_count: 1700,
      read_count: 5,
      read_time: 8,
      tags: ["agents", "orchestration", "workflows"],
      related: ["w1", "w10"],
      backlinks: ["w1", "w10"],
      pinned: false,
      content: `Anthropic distingue *workflows* (séquences pré-définies avec LLM embarqué) et *agents* (LLM qui décident des étapes en boucle). Chacun a sa place.

## Workflows

Bon pour : tâches reproductibles, volumes importants, coûts contrôlés, prédictibilité métier.
Exemples : extraction de données sur documents, classification de tickets, génération de contenu templaté.

## Agents autonomes

Bon pour : tâches ouvertes, debug, recherche, développement logiciel.
Coût plus élevé, latence plus élevée, prédictibilité plus faible — compenser par des garde-fous (budget max, outils filtrés, validation humaine).

## Règle pragmatique

Commencer *toujours* par un workflow. Passer à agent autonome uniquement si la tâche résiste au workflow — souvent ça signifie qu'elle n'est pas bien définie en amont.`,
    },
    {
      id: "w18",
      kind: "auto",
      category: "fondamentaux",
      category_label: "Fondamentaux",
      title: "Transformers — le minimum pour comprendre",
      excerpt: "Attention, embeddings, MLP. Expliqué sans équations mais avec précision.",
      updated: "18 mars",
      created: "2025-12-05",
      word_count: 2400,
      read_count: 10,
      read_time: 11,
      tags: ["transformers", "fondamentaux"],
      related: ["w9"],
      backlinks: [],
      pinned: false,
      content: `Synthèse qui t'emmène jusqu'au niveau "je comprends ce qui se passe" sans pré-requis math lourd.

## 3 composants

**Embedding** — chaque token (morceau de mot) devient un vecteur dense (4096 dimensions chez Claude). Ce vecteur capture le sens du token dans un espace continu.

**Attention** — chaque token regarde tous les autres tokens de la séquence et se construit une nouvelle représentation pondérée. C'est comme ça que "il" sait à quoi il se réfère dans "Le chat a mangé la souris, il était affamé".

**MLP (feed-forward)** — réseau dense qui "traite" la représentation enrichie par l'attention. C'est là que l'essentiel du "savoir" du modèle est stocké.

## Empilement

Un Transformer empile N fois ces blocs (96 pour GPT-4, 80+ pour Claude Opus). Chaque couche affine la représentation.

## Sortie

À la fin, chaque position prédit le token suivant (ou une probabilité sur tout le vocabulaire). Le modèle est entraîné à maximiser la vraisemblance du prochain token sur des billions de mots.`,
    },
  ],
};
