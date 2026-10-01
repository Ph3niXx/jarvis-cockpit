# Veille écosystème Claude — 2026-09-19

## Compteurs

- **Entrées vues (upsertées)** : 53
- **Nouvelles entrées** : 3
- **Mises à jour (slug existant)** : 50
- **Archivées** : 0

Total catalogue `claude_ecosystem` : **587 lignes actives** (584 → 587).

## Nouveautés notables

### Ajouts nets (3)

- **`vibe-prospecting-plugin`** (inbound / cowork_plugin) — Plugin officiel Anthropic publié par Explorium (août 2026). Sept skills GTM sur 150M+ companies : lead lists, enrichment CRM, research accounts. Marche depuis Claude Code, Cowork, Chat et OpenAI Codex. Applicability directe pour la mission RTE train Vente (Malakoff Humanis).
- **`linkedin-mcp-stickerdaniel`** (both / mcp_server) — Serveur MCP open-source LinkedIn (profils, entreprises, jobs, messages) largement forké en 2026 (dean815, Taste4458, rimonhanna). Piste concrète pour muscler le Jobs Radar du cockpit — à valider côté TOS LinkedIn avant intégration.
- **`oh-my-claudecode`** (inbound / other) — Multi-agent orchestration teams-first pour Claude Code. 39.1k stars en septembre 2026, un des plus gros repos de la vague AI-agent tooling en trend GitHub (vs. wshobson/agents à 36.7k).

### Mises à jour marquantes (extrait)

- **`anthropic-sdk-python`** — Passage à v1.0 en septembre 2026 : httpx2, Python 3.10+, `code_execution_20260120` avec REPL persistant, drop des APIs dépréciées. Pertinence directe pour les pipelines Jarvis (main.py, weekly_analysis.py).
- **`anthropic-sdk-{typescript,go,java,ruby,php,csharp}`** — Toute la famille SDK aligne `agent-memory-2026-07-22` et `code_execution_20260120`. Le SDK C# rejoint le lot officiellement.
- **`claude-agent-sdk-{python,typescript,go}`** — Runtime officiel réutilisant le harness Claude Code (sandbox shell, MCP tools natifs, sessions). Piste sérieuse pour Jarvis local.
- **`claude-fable-5-1` / `claude-mythos-5-1`** — Sortis 1er septembre 2026. Même prix par token que Fable/Mythos 5 mais cache reads à un quart du tarif standard des autres modèles Claude — argument pour repartir vers ces modèles sur les longs contextes.
- **`claude-commerce-agents`** — Blueprint open-source Apache-2.0 lancé le 2 septembre 2026 (shopping + merchant, retail/travel/telecom/ticketing). Résultats mesurés chez Shopify/Priceline/Visa/Mastercard : +35% basket, +60% checkout.
- **`claude-managed-agents`** — Ajoute budget controls, advisor support, geo-pinned inference, GitHub-loaded skills, allowed_domains/blocked_domains sur `web_search`/`web_fetch`.
- **`mcp-spec-2026-07-28-final`** — Version stable de la spec MCP (28 juillet 2026) : bascule stateful → request/response stateless, déploiement serverless/edge, MCP Apps & Tasks via framework versionné, OAuth 2.0/OIDC natif.
- **`mcp-registry-official-anthropic`** — Connectors directory Claude à 950+ serveurs. Ecosystème MCP à 400M downloads SDK mensuels (x4 sur l''année).
- **`claude-tag`** — Remplacement officiel de l''app Slack Claude depuis 3 août 2026, running sur Opus 4.8, un Claude partagé par canal.
- **`claude-code-channels`** — Plugin natif pour piloter une session Claude Code depuis Telegram/Discord sans exposer le code. Piste séduisante pour Jarvis (RTX 5070).
- **`claude-code-action`** — GitHub Action v1 GA : auto-detect mode, skills integration, `@v1` CLI passthrough clean.
- **`claudeforce-salesforce`** + **`claudeforce-partnership-2026-08`** — Partenariat officialisé 26 août 2026 avec 37 sales skills prébâtis. Pattern de référence CRM piloté par agent, très proche du contexte train Vente.
- **`anthropic-cybersecurity-skills`** — 817 skills mappés MITRE ATT&CK/NIST CSF 2.0/MITRE ATLAS/D3FEND/NIST AI RMF/MITRE F3.
- **`wshobson-claude-agents`** (36.7k stars) + **`voltagent-awesome-claude-code-subagents`** (100+ subagents) — les deux plus grosses collections de subagents Claude Code 2026.
- **Skills récentes du repo `anthropics/skills`** : `resume-scorer-skill`, `graph-run-skill`, `paper-explainer-video-skill`, `git-commit-writer-skill` (PRs juillet-août 2026).
- **`claude-sonnet-5`** — Prix introductoire $2/$10 par MTok devenu prix standard depuis 10 août 2026 (bonne nouvelle pour le budget cockpit si migration Haiku → Sonnet 5).
- **`claude-smart-reports`** — Beta Enterprise (sept. 2026) : analyse d''usage Claude d''une équipe, coûts, frictions, patterns skill-worthy.
- **`vercel-ai-sdk-6`** + **`mastra`** (v1.0 janv. 2026) + **`langgraph`** + **`openai-agents-sdk`** — Le tier 1 des frameworks agents 2026 aux côtés du Claude Agent SDK.
- **`mcp-databricks` / `mcp-snowflake` / `mcp-salesforce`** — Trio des connecteurs data managés les plus pertinents pour l''entreprise (Malakoff Humanis inclus).

Liste exhaustive des 53 slugs upsertés : cf. journal SQL Supabase du run.

## Archivages

Aucun archivage ce run. La requête `last_seen < CURRENT_DATE - 90 days` a retourné 0 lignes : le catalogue reste frais (aucun item n''a dormi plus de 90 jours — cohérent avec les runs quotidiens des dernières semaines).

## Décisions de curation

- **Cap 60 respecté** : 53 upserts effectués (sous le seuil). Priorité donnée aux items ayant une actualité août-septembre 2026 documentée (releases officielles, partenariats, PR merged), plus 3 découvertes nettes.
- **Slugs préservés** : les 3 nouveaux slugs sont bien inédits (vérifié via `SELECT slug FROM claude_ecosystem WHERE slug IN (...)` avant insertion).
- **`user_priority`, `is_pinned`, `user_notes`, `status`** : jamais touchés dans les `INSERT ... ON CONFLICT DO UPDATE`. Les décisions utilisateur sont préservées.
- **`type` pour les nouveaux items** : `cowork_plugin` pour Vibe Prospecting (marketplace officielle), `mcp_server` pour LinkedIn MCP (canonique), `other` pour oh-my-claudecode (outil multi-agent orchestrator au-delà d''une simple skill/plugin).

## Notes / limites

- La recherche s''est appuyée sur des synthèses de résultats web (releasebot.io, blog Anthropic, blog MCP, blog Salesforce, docs Explorium, github repos publics). Aucune source paywall ni repo privé n''a été consulté.
- Les listings *awesome-** ne sont pas re-parcourus item par item ce run — ils vivent comme entrées séparées et sont refreshés par leurs propres slugs.
- Le catalogue est déjà très dense (587 items). Les runs suivants gagneront à concentrer les upserts sur (a) les items > 60j de dernière vue (pas encore atteints), (b) les nouvelles PR merged dans `anthropics/skills`, (c) les nouveaux plugins officiels de la marketplace Anthropic.
- Aucun *dead link* détecté ce run puisque aucun item n''avait `last_seen > 90j`. Le mécanisme d''archivage doux se déclenchera au premier run où des slugs vieilliront.

## Sources principales

- Blog Anthropic + release notes ([platform.claude.com](https://platform.claude.com/docs/en/release-notes/overview))
- Releasebot ([anthropic](https://releasebot.io/updates/anthropic), [claude-code](https://releasebot.io/updates/anthropic/claude-code), [developer-platform](https://releasebot.io/updates/anthropic/claude-developer-platform))
- Blog MCP ([spec 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/))
- Salesforce press release Claudeforce (26 août 2026)
- github.com/anthropics/{skills,claude-plugins-official,claude-plugins-community,claude-code-action,claude-agent-sdk-*}
- github.com/explorium-ai/vibeprospecting-plugin
- github.com/stickerdaniel/linkedin-mcp-server
- github.com/ooptsd/oh-my-claudecode (et variantes)
- claude.com/blog + code.claude.com/docs
