# Veille écosystème Claude — 2026-09-18

## Compteurs

- **Entrées vues (upsertées)** : 59
- **Nouvelles entrées** : 2
- **Mises à jour (slug existant)** : 57
- **Archivées** : 0

Total catalogue `claude_ecosystem` : **584 lignes actives** (582 → 584).

## Nouveautés notables

### Ajouts nets (2)

- **`mcp-digital-realty-servicefabric`** (inbound / mcp_server) — Digital Realty ServiceFabric MCP, annoncé le 15 sept. 2026. Contrôle programmable AI-native sur 800+ datacenters pour environnements Private AI.
- **`mcp-registry-official-anthropic`** (inbound / other) — Managed MCP servers directement configurables depuis les settings Claude, curated par Anthropic (OAuth one-click + health checks).

### Mises à jour marquantes (extrait)

- **`claudeforce-salesforce`** (both / cowork_plugin) — Claudeforce (Anthropic + Salesforce), plugin *Salesforce in Claude* annoncé 26 août 2026, 37 skills sales prébâtis, open beta prévue sept. 2026. Pertinence RTE Vente MH : pattern de référence CRM piloté par agent.
- **`claude-finance-agents`** (both / cowork_plugin) — Claude for Financial Advisors lancé le 14 sept. 2026 sur Enterprise (partenaires : BlackRock, Schwab, Addepar, Envestnet, iCapital, Orion, Wealthbox, Wealth.com, Zocks).
- **`claude-smart-reports`** (outbound / other) — Smart Reports en beta Enterprise (sept. 2026) : usage, coût, friction, patterns skill-worthy.
- **`ant-cli`** (outbound / sdk) — v1.30.0 : `ant apply` déploie agents, environnements, skills, memory stores et deployments depuis des fichiers repo.
- **`mcp-docusign`** (inbound / mcp_server) — GA globale prévue 30 sept. 2026 après beta publique.
- **`mcp-asana`** — endpoint v1 shut down août 2026 ; migration forcée vers v2.
- **`mcp-clickup`** — public beta, ~40 outils (tasks, search, time tracking, chat, docs).
- **`mcp-spec-2026-07-28-final`** + **`mcp-spec-stateless-core`** — la spec finale du 28 juillet 2026 rend le protocole *complètement stateless* (routing sur `Mcp-Method`, plus de sticky sessions).
- **`kong-ai-gateway-mcp`** — Kong AI Gateway 2.0 GA (MCP Server Bundling, cost governance, principal-aware policies).
- **`claude-managed-agents-outcomes` / `-dreaming` / `-multiagent` / `-addins`** — 4 primitives shipped à Code with Claude 2026 (structured outputs, dreaming, multi-agent orchestration, add-ins).
- **`claude-agent-sdk-python`** — depuis 15 juin 2026, l'usage du SDK et de `claude -p` ne compte plus dans les limites d'un plan Claude (les limites restent pour l'usage interactif).
- **`superpowers-marketplace`** — plus grosse marketplace communautaire skills Claude Code (~250K stars juillet 2026).
- **`claude-code-xcode`** — Xcode 26.3 ajoute agentic coding avec Claude Agent via MCP.
- **`zed-editor`** — support Claude Code via ACP en Agent panel ; PR native pour le protocole IDE WebSocket officiel.
- **`microsoft-mcp-catalog` / `microsoft-learn-mcp`** — catalogue MCP Microsoft (Learn, M365, Azure DevOps, Power Platform, Dataverse).

Liste exhaustive des 59 slugs upsertés : cf. journal SQL Supabase du run.

## Archivages

Aucun archivage ce run. La requête `last_seen < CURRENT_DATE - 90 days` a retourné 0 lignes : le catalogue est frais (aucun item n'a dormi plus de 90 jours).

## Décisions de curation

- **Cap 60 respecté** : 59 upserts effectués (sous le seuil). Priorité donnée à ce qui a une actualité août-septembre 2026 concrète ; le reste du catalogue (582 → 584) n'a pas été touché ce run.
- **Slugs préservés** : `claude-finance-agents` a été mis à jour plutôt que dédoublonné en `claude-for-financial-advisors`. Le nom porte désormais explicitement *Claude for Financial Advisors*, aligné avec le lancement du 14 sept. 2026.
- **`user_priority`, `is_pinned`, `user_notes`, `status`** : jamais touchés dans les `INSERT ... ON CONFLICT DO UPDATE`. Les décisions utilisateur sont préservées.

## Notes / limites

- La recherche s'est appuyée sur des synthèses de résultats web (releasebot.io, blog Anthropic, blog Salesforce, blog MCP, blog Kong, github Anthropic). Aucune source paywall ni repo privé n'a été consulté.
- Les listings "awesome-*" (punkpeye, composio, quemsah, etc.) ne sont pas re-parcourus item par item ce run — ils sont eux-mêmes des entrées du catalogue et sont refreshés par leurs propres slugs.
- Certains slugs *managed-agents-** peuvent recouvrir partiellement les mêmes primitives (Outcomes vs. structured-outputs, par ex.). Fusion éventuelle à traiter dans un run de consolidation dédié, pas ici.
- Les *dead links* (repos 404, produits shutdown) n'ont pas été détectés ce run puisque zéro item avait `last_seen > 90j`. Le mécanisme d'archivage doux se déclenchera au premier run où des slugs vieilliront.

## Sources principales

- Blog Anthropic + release notes ([platform.claude.com](https://platform.claude.com/docs/en/release-notes/overview))
- Releasebot ([anthropic](https://releasebot.io/updates/anthropic), [claude-code](https://releasebot.io/updates/anthropic/claude-code), [developer-platform](https://releasebot.io/updates/anthropic/claude-developer-platform))
- Salesforce press release Claudeforce (26 août 2026)
- Blog MCP ([spec 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/))
- Kong AI Gateway 2.0 GA
- Digital Realty ServiceFabric MCP (15 sept. 2026)
- Docusign MCP (GA 30 sept. 2026)
- github.com/anthropics/{skills,claude-plugins-official,claude-plugins-community,claude-agent-sdk-*}
