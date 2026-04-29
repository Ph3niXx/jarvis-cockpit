# Catalogue écosystème Claude — 2026-04-25

## Résumé

| Métrique | Valeur |
|---|---|
| Entrées vues ce run | 60 (cap atteint) |
| Entrées vraiment nouvelles (UPSERT inserted) | 47 |
| Entrées existantes rafraîchies (last_seen bumpé) | 13 |
| Entrées archivées (mortes confirmées) | 0 |

Snapshot de départ : 13 entrées actives. Snapshot final : 60 entrées actives. Cap de 60 atteint sur ce run — la prochaine itération devra arbitrer pour ajouter de nouveaux outils.

## Répartition par direction × type

| Direction | Type | Count |
|---|---|---|
| inbound | mcp_server | 23 |
| inbound | skill | 6 |
| inbound | cowork_plugin | 2 |
| inbound | other (registries / roadmap) | 3 |
| outbound | framework | 8 |
| outbound | agent_runtime | 6 |
| outbound | ide_integration | 6 |
| outbound | sdk | 3 |
| outbound | connector | 2 |
| outbound | other | 1 |

## Nouveautés notables

### Inbound — MCP servers (officiels & MCP Apps)

- **mcp-atlassian** (mcp_server) — serveur MCP remote officiel Atlassian (Jira + Confluence). Critique pour la mission RTE.
- **mcp-slack** (mcp_server) — serveur MCP officiel Slack (47 outils). Déjà branché dans cette session Cowork.
- **mcp-notion** (mcp_server) — serveur MCP officiel Notion, considéré référence stabilité/sécurité.
- **mcp-linear** (mcp_server) — serveur MCP officiel Linear pour issues / projects / cycles.
- **mcp-google-drive** / **mcp-puppeteer** / **mcp-git** (mcp_server) — serveurs de référence du monorepo `modelcontextprotocol/servers`.
- **mcp-chrome-devtools** (mcp_server) — serveur officiel Chrome DevTools pour debugging frontend.
- **mcp-stripe** (mcp_server) — serveur MCP officiel Stripe (paiements en mode test).
- **MCP Apps lancés le 26/01/2026** : mcp-asana, mcp-box, mcp-canva, mcp-figma, mcp-amplitude, mcp-hex, mcp-monday, mcp-clay — chacun avec rendu UI inline dans Claude.
- **mcp-salesforce** (mcp_server) — annoncé pour suivre les MCP Apps de janvier ; à surveiller pour la mission RTE Vente.

### Inbound — Skills & plugins repos

- **anthropic-skills-repo** (skill) — repo officiel ~17 skills de référence (pdf, docx, xlsx, pptx, skill-creator, mcp-builder, frontend-design, brand-guidelines).
- **skill-creator** (skill) — skill méta pour créer / optimiser des skills custom (utile pour scaffolder une skill MH-RTE).
- **claude-plugins-official** (cowork_plugin) — directory officiel Anthropic, 55+ plugins curatés, section /external_plugins pour partenaires (Supabase, Firebase, Discord, Telegram).
- **knowledge-work-plugins** (cowork_plugin) — repo open-source des 11 plugins lancés avec Cowork (productivité, sales, marketing, finance, legal, customer support, product mgmt, biology, enterprise search). Templates exploitables pour un plugin "rte" maison.
- **voltagent-awesome-skills** (skill) — registre communautaire de 1000+ skills standardisées agentskills.io.

### Inbound — Registries / roadmap

- **awesome-mcp-servers-punkpeye** (other) — référence n°1 quand on cherche un serveur MCP existant avant de coder.
- **modelcontextprotocol-servers** (mcp_server) — monorepo officiel ; donné à la Linux Foundation en décembre 2025.
- **mcp-2026-roadmap** (other) — roadmap officielle 2026 du protocole : streamable HTTP, .well-known metadata, audit trails enterprise.
- **claudemarketplaces-directory** (other) — annuaire indépendant de 43 marketplaces / 834+ plugins.

### Outbound — SDK & runtimes Anthropic

- **claude-agent-sdk-typescript** (agent_runtime) — parité fonctionnelle avec le SDK Python : MCP servers, hooks, structured outputs, terminal_reason, taskBudget, agentProgressSummaries, AskUserQuestion.
- **claude-code-cli** (agent_runtime) — l'outil quotidien du projet ; complément naturel de Cowork pour tout ce qui est code.
- **claude-code-jetbrains** (ide_integration) — plugin pour IntelliJ / PyCharm / WebStorm.
- **claude-in-chrome** (connector) — extension navigateur (Pro = Haiku 4.5 only).
- **claude-for-excel** (connector) — add-in Excel GA pour Pro depuis janvier 2026, sidebar avec switch Sonnet 4.5 / Opus 4.6, intégrations FactSet / MSCI / DocuSign.
- **cowork** (agent_runtime) — runtime de cette session ; research preview lancée janvier 2026.
- **claude-desktop** (agent_runtime) — application desktop officielle (Mac / Windows / Linux), base technique de Cowork.

### Outbound — IDE integrations tierces

- **cursor-editor** (ide_integration) — toujours fort, mais critiqué pour pricing crédits.
- **windsurf-editor** (ide_integration) — Wave 13 avec Plan Mode + Arena Mode (comparaison aveugle de modèles).
- **continue-dev** (ide_integration) — agent open-source VS Code / JetBrains, supporte modèles locaux (match l'esprit hybride local/cloud de Jarvis).
- **zed-editor** (ide_integration) — éditeur Rust ultra-rapide, intégration Claude Code via ACP.
- **agent-client-protocol** (framework) — protocole ouvert Zed × JetBrains lancé en janvier 2026, à surveiller comme standard d'interop des agents IDE.

### Outbound — Frameworks AI

- **vercel-ai-sdk** (sdk) — adapter @ai-sdk/langchain rewritten pour LangGraph en 2026.
- **llamaindex-claude** (framework) — alternative au RAG maison de Jarvis (chunking smart, query routing, sub-question planner).
- **haystack-claude** (framework) — Haystack 2.x mature, tool calling natif, pipelines production-grade.
- **dspy-claude** (framework) — DSPy 3.1.2 (janvier 2026) avec multi-model optimization (Haiku pour module A, GPT-4.1 pour module B).
- **semantic-kernel-claude** (framework) — orchestration Microsoft, peu pertinent vu la stack Python du projet.
- **langgraph** (framework) — graphes d'agents stateful, candidat pour faire évoluer le routeur Jarvis.
- **promptfoo** (framework) — eval / red-team avec provider Claude Agent SDK natif (utile pour comparer Qwen local vs Claude Haiku cloud).

### Outbound — Cookbooks

- **claude-cookbooks** (other) — collection officielle ~41k stars de notebooks (tool use, agents, MCP, extended thinking, RAG, vision, prompt caching).

## Archivages

Aucun. Toutes les 13 entrées préexistantes ont été rafraîchies à `last_seen = 2026-04-25` (présence confirmée sur web). 0 item au-delà du seuil 90 jours.

## Limites & couverture

- **Cap de 60 atteint** — la prochaine itération devra arbitrer. Candidats à considérer pour les runs futurs : MCP Stripe variant Test/Live, MCP Shopify, MCP MongoDB, MCP Sentry, MCP Cloudflare, plugins Harvey/GitLab pour Cowork (annoncés mars 2026), Codex CLI (concurrent OpenAI), Aider Cloud (variante hébergée), wshobson/agents marketplace, AI Studio Plugins, Open Interpreter avec Claude provider.
- **Sources non couvertes** : r/ClaudeAI deep dive (résultats généralistes seulement, pas de threads top-of-month exploitables), private enterprise marketplaces (paywall), MCP Apps Salesforce (annoncé mais date GA non confirmée par les sources).
- **Choix de granularité** : l'entrée `mcp-atlassian` couvre Jira + Confluence comme un seul connecteur (alignement sur la réalité du connecteur Cowork unifié) — ne pas dédoubler dans les prochains runs.
- **Décision sur la finance** : MCP MSCI / FactSet / DocuSign non insérés individuellement (niche finance, pas pertinent direct projet) — mentionnés via la description de `claude-for-excel`. À reconsidérer si la mission RTE bascule vers un train Finance.

## Sanity check

Total entrées actives : 60 (cap respecté). Direction : 34 inbound / 26 outbound. Pas de doublon détecté. Aucun champ user_* (status, user_priority, is_pinned, user_notes) n'a été touché — décisions user préservées.
