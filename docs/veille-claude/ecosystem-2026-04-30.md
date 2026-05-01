# Catalogue écosystème Claude — 2026-04-30

Run automatisé du catalogue stable `claude_ecosystem` (Supabase). Snapshot inbound (outils qui se pluggent à Claude — MCP, skills, plugins) + outbound (où Claude se plugge — SDKs, IDE, frameworks, intégrations).

## Synthèse chiffrée

| Indicateur | Valeur |
|---|---|
| Entrées vues ce run | 47 |
| Entrées **ajoutées** (vraiment nouvelles) | 10 |
| Entrées **mises à jour** (bump `last_seen` sur slug existant) | 37 |
| Entrées **archivées** | 0 |
| Total catalogue après run | 126 |
| Total `active` | 126 |
| Inbound / Outbound | 82 / 44 |

Aucune entrée avec `last_seen` > 90 jours, donc pas d'étape archivage déclenchée. Le catalogue avait déjà été refresh massivement les 28-29 avril, ce run se concentre sur les vraies nouveautés ecosystem fin avril 2026.

## Nouveautés notables

| Slug | Direction | Type | 1 ligne |
|---|---|---|---|
| `claude-code-channels` | outbound | connector | Plugin officiel pour piloter Claude Code depuis Telegram, Discord ou iMessage (MCP server two-way). |
| `mcp-azure-devops` | inbound | mcp_server | Serveur MCP officiel Microsoft pour Azure DevOps (work items, PR, builds) — local stdio + remote HTTP en preview. |
| `superpowers-skills` | inbound | skill | Framework de méthodologie agentique (obra) : brainstorming, plans courts, TDD strict, subagent-driven dev. |
| `vercel-skills-cli` | inbound | skill | CLI `npx skills` + directory `skills.sh` — gestion cross-agent des skills (Claude Code, Cursor, Copilot…). |
| `mcp-server-dev-plugin` | inbound | cowork_plugin | Plugin Cowork officiel Anthropic qui guide la création de MCP servers (stdio, HTTP, MCPB desktop extensions). |
| `mcp-snowflake` | inbound | mcp_server | Serveur MCP managed Snowflake — Cortex Analyst, Cortex Search, gestion d'objets, orchestration SQL. |
| `mcp-bigquery` | inbound | mcp_server | Serveur MCP managed Google Cloud BigQuery — depuis 17 mars 2026 plus besoin d'enablement séparé. |
| `mcp-databricks` | inbound | mcp_server | Serveurs MCP managed Databricks (Unity Catalog, Vector Search, Genie spaces) — public preview depuis 10 fév 2026. |
| `claude-managed-agents-memory` | outbound | framework | Couche mémoire persistante filesystem-based pour Claude Managed Agents — public beta depuis le 23 avril 2026. |
| `agentforce-vibes` | outbound | ide_integration | IDE cloud-hosted Salesforce (VS Code) avec Claude Sonnet 4.5 par défaut + Salesforce Hosted MCP Servers. |

## Mises à jour `last_seen` (existants confirmés actifs)

37 slugs bumpés à `2026-04-30` après vérification des sources web (releases ou docs récentes). Highlights :

- **Remote MCP endpoints confirmés actifs** (vague de migration STDIO → Streamable HTTP en cours, deadline Atlassian 30 juin 2026 pour fin SSE) : `mcp-atlassian`, `mcp-hubspot`, `mcp-linear`, `mcp-slack`, `mcp-sentry`, `mcp-neon`, `mcp-vercel`.
- **Anthropic core** : `claude-managed-agents` (lancé 8 avril 2026), `claude-code-cli`, `claude-agent-sdk-python` (SessionStore + skills option), `claude-agent-sdk-typescript`, `anthropic-skills-repo`, `claude-plugins-official`, `claude-cookbooks`.
- **MCP officiels confirmés** : `mcp-github`, `mcp-google-workspace`, `mcp-google-drive`, `mcp-figma`, `mcp-asana`, `mcp-canva`, `mcp-monday`, `mcp-notion`, `mcp-stripe`.
- **IDE / agents outbound** : `cursor-editor`, `windsurf-editor`, `claude-code-vscode`, `claude-code-jetbrains`.
- **Frameworks outbound** : `langchain-claude`, `llamaindex-claude`, `dspy-claude`, `vercel-ai-sdk`.
- **Directories communautaires** : `skillsmp`, `voltagent-awesome-skills`, `awesome-claude-skills-travisvn`.
- **Specs / standards** : `mcp-2026-roadmap`, `mcp-apps-spec` (interactive UI extension confirmée), `agentskills-spec`.

## Archivages

Aucun. Le catalogue ayant été refresh il y a 1-2 jours, aucune entrée ne dépasse les 90 jours sans visite — le filtre n'a rien produit.

## Notes méthodo / limites

- **Cap de 60 outils respecté** : 47 touches (10 inserts + 37 bumps), sous le seuil. Le run reste catalogue stable, pas veille de fond.
- **Sources non couvertes** : r/ClaudeAI top du mois (paywall partiel selon les threads), repos privés/payants, certains MCP servers en early access non documentés publiquement (ex : ServiceNow, SAP).
- **Décisions user préservées** : aucun `UPDATE` n'a touché `status`, `user_priority`, `is_pinned`, `user_notes` (clause `ON CONFLICT DO UPDATE` ciblée sur les colonnes catalogue uniquement).
- **Contrainte `direction = 'both'`** non utilisée ce run — aucun outil retenu n'est strictement bidirectionnel.
- **Doublons potentiels à surveiller** : `mcp-server-dev-plugin` (cowork_plugin) ressemble fonctionnellement à `claude-cookbooks` côté tutoring MCP, mais reste un plugin distinct dans le marketplace officiel — pas de fusion.

## Tendances ecosystem repérées (avril 2026)

1. **Migration STDIO → Streamable HTTP** sur les MCP officiels : Atlassian, HubSpot, Linear, Slack, Sentry, Neon, Vercel ont basculé. SSE deprecated.
2. **OAuth 2.1 dans la spec MCP** (avril 2026) avec consentement de scope incrémental.
3. **Vague data-warehouse managed MCP** : Snowflake, BigQuery, Databricks tous en managed offerings — Teradata aurait rejoint le mouvement (à confirmer next run).
4. **Mémoire persistante côté Claude Platform** : feature critique (Managed Agents Memory en public beta). Concurrence directe avec les patterns RAG/vector store custom.
5. **Vibe coding cloud IDE** : Salesforce Agentforce Vibes positionne Claude comme moteur d'IDE org-aware — pattern à surveiller chez d'autres SaaS verticals.

---
*Généré automatiquement via la routine Cowork "claude-synergies" (catalogue-ecosystem). Source : table Supabase `claude_ecosystem`.*
