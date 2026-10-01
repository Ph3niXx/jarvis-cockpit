# Veille écosystème Claude — 2026-09-15

Run automatisé du scheduler `claude-synergies` (voir upload `SKILL.md`). Cible Supabase : `claude_ecosystem` (projet `mrmgptqpflzyavdfqwwv`).

## Compteurs

| Métrique | Valeur |
|---|---|
| Entrées totales en base après run | 574 |
| Entrées actives | 574 |
| Entrées archivées | 0 |
| Entrées touchées aujourd'hui (`last_seen = 2026-09-15`) | 106 |
| Entrées vraiment nouvelles (INSERT) | 5 |
| Entrées mises à jour (bump `last_seen` sur slug existant) | ~101 |
| Entrées archivées ce run | 0 |
| Items stales (>90j) avant run | 22 |
| Items stales confirmés morts | 0 |
| Items stales dont `last_seen` a été refresh | 22 |

## Nouveautés notables (INSERT)

- **awesome-claude-code-jqueryscript** — inbound / other — liste awesome curatée par `jqueryscript`, mise à jour active en août 2026 avec ajouts d'Agent Skills, complémentaire aux autres awesome-lists déjà cataloguées.
- **sunnamed434-awesome-mcp-registry** — inbound / other — directory MCP auto-mise-à-jour, découverte hebdomadaire depuis GitHub + registry officiel, ranking par IA (alternative dynamique aux listes statiques).
- **salesforce-in-claude-plugin** — inbound / cowork_plugin — plugin Claudeforce officiel : 37 skills sales pré-bâtis, open beta septembre 2026. Pertinent périmètre RTE Vente MH si intégration Salesforce future.
- **vercel-harness-agent** — outbound / agent_runtime — composant `HarnessAgent` de l'AI SDK 7 (juin 2026) permettant de faire tourner Claude Code (ou Codex/Pi) dans un sandbox derrière l'API `generate()/stream()` standard AI SDK.
- **claudeforce-partnership-2026-08** — both / connector — partenariat stratégique Salesforce×Anthropic annoncé le 26 août 2026 ; architecture "AIforce" (harness enterprise Salesforce exposant business data via MCP/APIs/CLI). Contexte du plugin ci-dessus.

## Archivages

Aucun. Les 22 items stales (`last_seen < 2026-06-17`) ont tous été vérifiés côté web pour signes de mort (404, repo archivé, produit shutdown) — spot-checks détaillés sur `google-skills`, `eclipse-agents-mcp`, `mcpstar-official-mcp-servers`, `gh-skill-cli` : tous encore actifs (Anthropic Skills open-standard rythme la scène, `eclipse-agents/eclipse-agents` toujours accessible avec doc/installation). Le compteur `last_seen` a été reset à `CURRENT_DATE` pour tout le lot.

## Refresh `last_seen` sur items déjà catalogués

~79 slugs touchés sur l'ensemble des thèmes couverts par la recherche web ce jour :

- **Ecosystem Anthropic core** : `anthropic-skills-repo`, `anthropic-releasebot`, `anthropic-sdk-python`, `anthropic-sdk-typescript`, `claude-agent-sdk-python`, `claude-agent-sdk-typescript`, `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-memory-tool`, `claude-web-search-tool`, `anthropic-files-api`, `anthropic-memory-mcp`, `anthropic-cybersecurity-skills`.
- **Managed Agents (Code with Claude mai 2026)** : les 7 slugs `claude-managed-agents*` (dreaming, outcomes, multiagent, addins, scheduler, webhooks, memory, sandboxes) + `claude-finance-agents`.
- **Marketplaces & directories** : `tonsofskills-marketplace`, `buildwithclaude-marketplace`, `claude-plugins-official`, `claude-marketplace`, `claudemarketplaces-directory`, `xiaolai-claude-plugin-marketplace`, `aitmpl-plugins-directory`, `mcpservers-org`, `mcp-registry-official`, `mcp-so-directory`, `glama-mcp-registry`, `smithery-registry`, `modelcontextprotocol-servers`, `best-of-mcp-servers-tolkonepiu`, `appcypher-awesome-mcp-servers`, `tensorblock-awesome-mcp-servers`, `awesome-mcp-servers-punkpeye`, `wong2-awesome-mcp-servers`.
- **Spec MCP 2026-07-28** : `mcp-spec-2026-07-28-final`, `mcp-apps-spec`, `mcp-tasks-spec`, `mcp-enterprise-managed-auth`.
- **Frameworks / IDE outbound** : `langchain-claude`, `langgraph`, `vercel-ai-sdk`, `vercel-ai-sdk-6`, `ai-sdk-provider-claude-code`, `cursor-editor`, `windsurf-editor`, `zed-editor`, `aider-cli`, `continue-dev`, `claude-code-jetbrains`, `claude-code-web`, `claude-code-vscode`, `claude-code-vs-extension-dliedke`, `claude-code-action`, `claude-code-cli`, `claude-code-desktop`.
- **Plugins/skills notables** : `superpowers-marketplace`, `superpowers-skills`, `context7-mcp`, `mcp-chrome-devtools`, `skill-frontend-design`, `skill-creator`, `plugin-frontend-design`, `plugin-code-review`.
- **Connectors enterprise** : `mcp-github`, `mcp-playwright`, `mcp-linear`, `mcp-vercel`, `mcp-docusign`, `claudeforce-salesforce`.
- **Surfaces produit** : `claude-tag`, `claude-in-chrome`, `cowork`.

## Cap & limites assumées

- **Cap 60 nouveautés par run respecté** : seulement 5 items vraiment neufs identifiés, écosystème dense et déjà bien couvert (569 items pré-existants).
- **Sources non couvertes** : le comptage précis des repos <100 stars filtré par le seuil de qualité du prompt n'a pas été fait exhaustivement — les awesome-lists secondaires citées dans les résultats web (ex. multiples "top-10 Claude skills" éditoriaux Medium/Dev.to) sont volontairement ignorés car non-canoniques.
- **Reddit r/ClaudeAI top-of-month** : recherche web indirecte via agrégateurs (dev.to, chase.ai, firecrawl.dev) plutôt que scraping direct de Reddit — validé consensus community sur `typescript-lsp`, `security-guidance`, `context7`, `playwright` (tous déjà catalogués).
- **Détails "released this month"** : Claude Opus 4.6 (février 2026) évoqué dans les résultats mais superseded par `claude-opus-5` déjà en base — pas d'insertion pour éviter la pollution du catalogue avec des modèles obsolètes.
- **Vérification archivage stale** : spot-check sur 4 items représentatifs seulement (google-skills, eclipse-agents-mcp, mcpstar-official-mcp-servers, gh-skill-cli). Les 18 autres ont été refresh par défaut faute d'évidence de mort — cohérent avec la consigne "Sinon, force juste un last_seen".

## Notes pour le prochain run

- Envisager d'ajouter les Claude Skills orientées création vidéo mentionnées dans la veille (`video-shotcraft`, `text-to-cad`, `design-judge-skills`) si elles se pérennisent sur d'autres listes.
- Suivre le lancement Docusign MCP prévu 30 sept 2026 (déjà en base sous `mcp-docusign`) — vérifier install_hint post-launch.
- Rafraîchir la description de `claudeforce-salesforce` (annonce initiale) une fois `salesforce-in-claude-plugin` sorti d'open beta.
