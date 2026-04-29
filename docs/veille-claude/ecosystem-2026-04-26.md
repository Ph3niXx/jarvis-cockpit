# Catalogue écosystème Claude — 2026-04-26

Run automatisé de maintenance du répertoire `claude_ecosystem` Supabase.

## Compteurs

| Métrique | Valeur |
|---|---|
| Entrées vues / confirmées vivantes | **63** |
| Vraiment nouvelles (insertions) | **3** |
| Mises à jour (slug existant, `last_seen` bumpé) | **60** |
| Archivages | **0** |
| Total catalogue après run | **63** (status=active : 63) |

Aucun item n'avait `last_seen < CURRENT_DATE - 90 days` — la table avait été initialisée la veille (2026-04-25), pas de candidat d'archivage à valider.

## Nouveautés notables ajoutées

### Anthropic — produits/services lancés ce mois

- **`claude-design`** (outbound, connector, Anthropic) — Produit Anthropic Labs lancé le **17 avril 2026**, en research preview pour Pro/Max/Team/Enterprise. Powered by Claude Opus 4.7. Tourne le triptyque "design → handoff → code" : Claude lit le codebase + fichiers existants pour bâtir un design system, puis package un handoff bundle exportable vers Claude Code, Canva, PDF, PPTX, HTML. Cible directement Figma. Source : [Introducing Claude Design — Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs).
- **`claude-managed-agents`** (outbound, agent_runtime, Anthropic) — Public beta lancée le **8 avril 2026** sur le Claude Platform. Harness d'agent géré (sandbox cloud, container Python/Node/Go pré-installés, exécution longue durée, persistance d'état serveur, streaming SSE). Définition d'agent unique (model + system prompt + tools + MCPs + skills) référencée par ID, pricing 0,08$/h runtime + tokens. Pertinent comme alternative possible à un orchestrateur self-hosted Jarvis pour les routines longues qui dépassent le timeout GitHub Actions. Source : [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview).

### Communauté

- **`claudecode-nvim`** (outbound, ide_integration, Coder) — Plugin Neovim non-officiel mais largement adopté ([github.com/coder/claudecode.nvim](https://github.com/coder/claudecode.nvim)) qui implémente le même protocole WebSocket MCP que l'extension Claude Code VS Code. 100% compatible avec le binaire CLI Claude Code, pas de fork. Pure Lua. Diffs inline + chat + contexte de buffer. À garder en option si bascule terminal-first.

## Mises à jour silencieuses (60 slugs, `last_seen = 2026-04-26`)

Tous les slugs présents dans la table avant le run ont été ré-observés via les sources canoniques (repos officiels Anthropic, modelcontextprotocol monorepo, awesome-mcp-servers de punkpeye, marketplace Cowork, releases SDK Python/TS, releases Agent SDK, intégrations LangChain/LlamaIndex/DSPy/Semantic Kernel/Vercel AI SDK, IDE Cursor/Continue/Aider/Zed/Windsurf/JetBrains/VS Code, MCP servers d'apps Notion/Slack/Linear/Stripe/Atlassian/etc.). Aucun signal de mort détecté — tous restent `status='active'`. Décisions user (`status`, `user_priority`, `is_pinned`, `user_notes`) préservées.

## Archivages

Aucun. Catalogue trop frais (initialisé 2026-04-25) — re-tester à partir de fin juillet 2026.

## Notes — ce qui n'a pas été couvert

- **r/ClaudeAI top du mois** : signaux qualitatifs (Claude Design accueilli "meh", confirmation que Claude Code domine 80% des stacks dev terminal-first). Pas d'outil tiers émergent suffisamment hot ce mois pour entrer en catalogue stable. À re-scanner au prochain run.
- **Frameworks Python multi-agents** : Pydantic AI (avec branche `pydantic-deepagents` qui réplique Claude Code en open-source) et CrewAI ont tous deux du support Claude actif via litellm/adapter. Volontairement **non-ajoutés** ce run pour rester sous l'idée du cap (60). Candidats prioritaires au prochain ajout si le radar se tend.
- **Plugins Cowork tiers émergents** (CCHub, developer-growth-analysis, codebase-graph, b12-claude-plugin, jeremylongshore/claude-code-plugins-plus-skills) : volume très élevé, qualité hétérogène, pas encore au seuil "stable + maintenu + ≥100 stars + utilité claire pour mes axes Jarvis/RTE". Couverts indirectement par les entrées-parapluie déjà en base : `claude-plugins-official`, `claudemarketplaces-directory`, `knowledge-work-plugins`, `voltagent-awesome-skills`.
- **MCP v2.0 / OAuth 2.1 / Streamable HTTP** : update du protocole (mars 2026, formalisée avril 2026), pas un outil discret — déjà tracé via l'entrée `mcp-2026-roadmap`.
- **Xcode** : pas d'intégration Claude Code officielle ni communautaire significative trouvée — rien à ajouter.
- **Pas de paywall ni de repo privé bloquant** sur ce run.

## Flag qualité

- Tous les nouveaux ajouts ont `vendor`, `source_url` et `description` non-null.
- Aucun champ `applicability` inventé : les 3 nouveautés ont une utilité explicite pour Jarvis Cockpit ou la mission RTE Malakoff Humanis.
- Filtre dur respecté : ≥1 commit/release dans les 6 derniers mois, et tous les outils ajoutés dépassent largement le seuil de 100 stars (ou sont de l'écosystème officiel Anthropic).
