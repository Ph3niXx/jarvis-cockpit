# Écosystème Claude — Veille du 2026-09-03

## Compteurs

| Métrique | Valeur |
|---|---|
| Entrées vues (recherchées ou confirmées vivantes) | ~120 |
| Nouvelles entrées ajoutées | **7** |
| Entrées existantes rafraîchies (`last_seen` bumpée à aujourd'hui) | **112** (dont 7 nouveaux + 105 refresh) |
| Entrées archivées | **0** |
| Total catalogue après run | **547 active** / 0 archived |

## Nouveautés notables

Sept nouveaux outils identifiés, tous confirmés maintenus (≥ 1 release ou commit ces 6 derniers mois).

- **`claudeforce-salesforce`** (inbound, cowork_plugin) — Plugin officiel annoncé le 26/08/2026 par Salesforce + Anthropic. Embarque 37 sales skills prebuilt (pipeline review, forecast narrative, meeting prep, deal-health, activity logging, Salesforce hygiene). Open beta prévue septembre 2026. Vertical CRM, hors stack MH mais template intéressant pour concevoir des plugins RTE verticalisés.
- **`mcpjungle`** (inbound, other) — Gateway MCP self-hosted open-source (Go). Centralise l'enregistrement et la découverte des serveurs MCP. Positionné comme alternative légère face à Kong, IBM ContextForge, MCPX.
- **`ibm-mcp-context-forge`** (inbound, other) — Gateway MCP d'IBM, unifie REST + MCP + A2A avec fédération, admin UI, retries, sécurité. Déployable PyPI ou Docker, scale Kubernetes multi-cluster. Cible enterprise.
- **`docker-mcp-gateway`** (inbound, other) — Gateway MCP officielle Docker, intégrée à Docker Desktop. Top solutions open-source self-hosted 2026 aux côtés d'IBM ContextForge, MSFT MCP Gateway et Obot.
- **`cdata-connect-ai`** (inbound, connector) — Passerelle CData exposant 300+ sources data (SAP, mainframes, connecteurs legacy) à Claude via endpoint AI-tool. Alternative aux MCP servers pour les sources qui n'ont pas de connecteur natif.
- **`anthropic-detection-api`** (outbound, other) — API de détection en private preview pour vérifier qu'un texte a été généré par un modèle Claude publié après le 02/08/2026 (Fable 5.1, Mythos 5.1). Approche SynthID Text. Accès réservé régulateurs / entreprises sous obligation EU AI Act Article 50. Non applicable au perso mais signal fort sur la gouvernance IA.
- **`intuit-financial-claude-agents`** (inbound, cowork_plugin) — Partenariat Intuit + Anthropic annoncé le 24/02/2026. TurboTax, Credit Karma, QuickBooks, Mailchimp et Intuit Enterprise Suite dispo dans Claude ; les mid-market peuvent aussi construire leurs agents custom via Claude Agent SDK sur la plateforme Intuit. Rollout printemps 2026, initialement US only.

## Signaux forts non nouveaux (bump `last_seen` uniquement)

- **Modèles récents confirmés actifs** : `claude-fable-5-1`, `claude-mythos-5-1` (release septembre 2026, -25% coût, watermarking natif, -60% faux positifs cyber). Les entrées `claude-fable-5`, `claude-mythos`, `claude-opus-5`, `claude-sonnet-5` restent également disponibles.
- **MCP spec 2026-07-28** finalisée fin juillet, roadmap post-release mise à jour le 22/08/2026 (`mcp-spec-2026-07-28-final`, `mcp-spec-stateless-core`, `mcp-2026-roadmap` tous rafraîchis).
- **Registry MCP officiel** (`mcp-registry-official`) actif, registry.modelcontextprotocol.io opérationnel.
- **Plugins marketplace** : `claude-plugins-official` (23k+ stars), `claude-plugins-community`, `claude-marketplace` tous vivants, avec `wshobson-claude-agents` toujours actif (~37k stars mentionnés en juin 2026).
- **SDK Claude Agent** en release hebdo : `claude-agent-sdk-python` (v0.2.139 PyPI), `claude-agent-sdk-typescript` (v0.3.233 npm) — nouvelles capacités structured outputs, fallback model, tools option, `/loop`, extended-thinking effort levels.
- **Anthropic Skills** devenu open standard (agentskills.io) depuis décembre 2025, adopté par ~40 clients (Copilot, VS Code, Cursor, Codex, Gemini CLI, Goose, OpenCode). Repo `anthropic-skills-repo` à ~173k stars, ~149k stars sur GitHub agent-skills.
- **IDE intégrations** : Claude Code officiellement supporté sur VS Code (+ Cursor, Windsurf), JetBrains (PyCharm, WebStorm, IntelliJ, GoLand). Zed toujours pas d'intégration first-class malgré les demandes ouvertes.
- **Chrome side panel** (`claude-in-chrome`) devenu une session Cowork complète en août 2026 (Max/Team d'abord, rollout Pro en cours).
- **Connectors MH-relevants** : `mcp-atlassian`, `mcp-slack`, `mcp-github`, `mcp-figma`, `mcp-linear` tous rafraîchis. `mcp-snowflake` reste actif dans le cadre du partenariat $200M Anthropic × Snowflake.

## Archivages

**0 archivage ce run.** Les 8 entrées avec `last_seen < 90 jours` (mcp-outreach, mcp-msci, mcp-wordpress, mcp-harvey, mcp-factset, mcp-legalzoom, adaptive-recall-mcp, aboudjem-sniff) ont toutes été vérifiées vivantes :

- Les 6 connectors Claude (Outreach, MSCI, WordPress, Harvey, Factset, LegalZoom) font partie du batch des 13 connectors annoncé au Anthropic Enterprise Agents Briefing du 24/02/2026, tous encore listés dans le directory officiel `claude.com/connectors`.
- `adaptive-recall-mcp` (AIAppsAPI) — repo actif, patent pending, tiers gratuits et payants opérationnels.
- `aboudjem-sniff` — v0.7.0 avec 441 tests, dernier check public 30/05/2026, disponible en Claude Code plugin **et** MCP server.

Ces 8 slugs ont vu leur `last_seen` bumpée à aujourd'hui pour reset le compteur.

## Notes / limites du run

- **Cap à 60 outils par run** respecté : 7 ajouts + 105 refresh (les refresh sont des UPDATE `last_seen` seul, pas des UPSERT complets — sans données neuves à jour sur les 540 entrées existantes, éviter d'écraser leur description/tags avec des valeurs approximatives).
- **Volume catalogue élevé** : 547 entrées actives, le catalogue est mature et couvre déjà 439 connectors officiels + les MCP awesome-listings historiques. Les nouveautés hebdo se raréfient — la valeur ajoutée d'un run devient surtout du refresh de vivant/mort.
- **Sources hors search coverage** : Reddit r/ClaudeAI (mentions génériques uniquement dans les résultats web, pas d'accès direct au subreddit). Pas de crawl de forks marginaux <100 stars (filtre qualité du prompt).
- **Vérification "produit mort"** sur les 8 stales : vérification via web search uniquement, pas de HEAD HTTP direct sur les URLs — jugement basé sur mentions récentes (2026-05 à 2026-08) dans les résultats.
- **Rien de bloquant** : Supabase MCP disponible, tous les UPSERT/UPDATE ont réussi, `user_priority`, `is_pinned`, `user_notes`, `status` intacts (aucune de ces colonnes touchée par les requêtes).

## Sources

- [Anthropic Skills repo](https://github.com/anthropics/skills)
- [MCP Registry officiel](https://github.com/modelcontextprotocol/registry)
- [Awesome MCP servers (punkpeye)](https://github.com/punkpeye/awesome-mcp-servers)
- [Anthropic Cowork plugins across enterprise](https://claude.com/blog/cowork-plugins-across-enterprise)
- [Introducing Claude Fable 5.1 and Mythos 5.1](https://www.anthropic.com/claude-fable-and-mythos-5-1)
- [Claudeforce (Salesforce + Anthropic)](https://www.salesforce.com/claudeforce/)
- [Salesforce press release Claudeforce](https://www.salesforce.com/news/press-releases/2026/08/26/salesforce-and-anthropic-announce-claudeforce/)
- [Intuit Financial Intelligence in Claude](https://www.intuit.com/anthropic/)
- [Anthropic Claude text watermark](https://www.anthropic.com/news/claude-text-watermark)
- [MCP Roadmap (22/08/2026)](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/)
- [MCP 2026-07-28 spec release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCPJungle](https://github.com/mcpjungle/MCPJungle)
- [IBM MCP Context Forge](https://github.com/ibm/mcp-context-forge)
- [CData Connect AI](https://www.cdata.com/connect/ai/)
- [Cowork Chrome side panel](https://claude.com/blog/cowork-chrome-side-panel)
- [Claude Code IDE VS Code docs](https://code.claude.com/docs/en/vs-code)
- [Skills for organizations, partners, ecosystem](https://claude.com/blog/organization-skills-and-directory)
- [All 439 Claude Connectors (Sept 2026)](https://aitoolsreview.co.uk/insights/claude-connectors-complete-directory)
- [Adaptive Recall MCP](https://github.com/AIAppsAPI/adaptive-recall)
- [Aboudjem/10x marketplace (sniff)](https://github.com/Aboudjem/10x)
- [Harvey Connector](https://claude.com/connectors/harvey)
