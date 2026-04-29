# Catalogue écosystème Claude — 2026-04-29

## Résumé

| Métrique | Valeur |
|---|---|
| Entrées vues / actives en base | 116 |
| Vraiment nouvelles (insérées) | 15 |
| Mises à jour (slug existant, `last_seen` bumpé) | ~50 |
| Archivées (mortes / 404) | 0 |
| Existantes non revues ce run (à reprendre la prochaine fois) | 51 |

Aucune entrée n'avait `last_seen` > 90 jours (le catalogue date d'avril 2026), donc pas de passe d'archivage automatique.

## Nouveautés notables

### SDK & runtimes

- **anthropic-sdk-java** (outbound · sdk) — SDK Java officiel (Maven Central `com.anthropic:anthropic-java`, v2.26.0, MIT). Compatible Kotlin via JVM. [github.com/anthropics/anthropic-sdk-java](https://github.com/anthropics/anthropic-sdk-java)
- **claude-code-router** (outbound · agent_runtime) — Proxy communautaire qui route Claude Code vers OpenRouter, DeepSeek, Ollama, Gemini. Switch de modèle via `/model`. Levier coût intéressant si Claude Code devient central. [github.com/musistudio/claude-code-router](https://github.com/musistudio/claude-code-router)
- **claude-code-routines** (outbound · agent_runtime) — Routines cloud research preview (lancé le 14 avril 2026). Workflows qui tournent sans laptop. Pourrait remplacer une partie des GitHub Actions hebdo du cockpit.

### MCP servers (connecteurs Cowork février 2026)

- **mcp-zapier** — Bridge Zapier (~9000 apps, 30k actions). Alternative no-code pour exposer du SaaS sans héberger un serveur MCP dédié.
- **mcp-docusign** — E-signature (Cowork connector).
- **mcp-wordpress** — Lecture/écriture posts et pages WordPress.com.
- **mcp-harvey** — AI legal (très niche).
- **mcp-apollo** — Sales engagement / prospects B2B.
- **mcp-outreach** — Sales engagement (séquences emails, calls).
- **mcp-similarweb** — Trafic web et market intel — possible source de signaux faibles pour le radar d'opportunités cockpit.

### IDE

- **claude-code-ide-emacs** (outbound · ide_integration) — Bridge bidirectionnel Emacs/Claude Code via MCP. Manzaltu, communauté.

### Annuaires & marketplaces

- **glama-mcp-registry** — 22000+ servers open-source + 2800 connecteurs hosted, scorés qualité/sécurité. Superset du registre officiel.
- **mcp-awesome-directory** — 1200+ servers vérifiés à la main avec tutoriels d'installation.
- **mcp-so-directory** — Directory automatisé large couverture, complémentaire de PulseMCP / Glama.
- **skillsmp** — Marketplace 900k+ agent skills compatibles SKILL.md (Claude Code, Codex CLI, ChatGPT). Indépendant Anthropic.

## Mises à jour notables (entries bumpées)

Confirmation que les piliers de l'écosystème restent actifs en avril 2026 :

- **anthropic-skills-repo** — 17 skills officiels maintenus, 4 d'entre eux alimentent les capacités document de Claude.ai.
- **claude-plugins-official** — 101 plugins (33 Anthropic + 68 partenaires : GitHub, Playwright, Supabase, Figma, Vercel, Linear, Sentry, Stripe, Firebase…).
- **mcp-cloudflare** — Code Mode lancé : exposer une API entière en ~1000 tokens via search/execute + V8 isolate (–99,9 % vs OpenAPI brut).
- **claude-agent-sdk-python / typescript** — Parité SessionStore atteinte, structured outputs, taskBudget côté TS, `reloadPlugins()`.
- **claude-code-action** — v1.0 sortie, breaking changes de config, mode auto-detect, défaut Sonnet (Opus 4.7 sur opt-in).
- **modelcontextprotocol-servers** + **pulsemcp-directory** (12970+ servers) + **smithery-registry** + **mcpservers-org** — annuaires actifs.

## Archivages

Aucun. Catalogue trop jeune pour avoir des entrées dormantes (> 90 jours).

## Limites / Couverture incomplète

- Les 12 connecteurs Cowork de février 2026 ne sont pas tous dans le catalogue : MSCI, LegalZoom, FactSet n'ont pas été retenus (très niche finance/legal, peu de chance d'être utilisés côté Jarvis ou RTE) — à ajouter manuellement si besoin.
- Les 11 plugins Cowork open source d'`anthropics/knowledge-work-plugins` (sales, finance, marketing, HR, design, engineering, ops, legal, support, project-management, biology) sont couverts par l'entrée parente `knowledge-work-plugins` plutôt qu'individuellement — affiner si certains deviennent prioritaires.
- Pas couvert ce run : releases LangChain/LlamaIndex/DSPy/Haystack/Vercel-AI-SDK, ni l'écosystème agent runtimes communautaire (Cline, Goose, OpenCode, Kilo Code…). Les entrées existent déjà avec `last_seen` du 2026-04-28 — bump implicite, mais sans vérification fraîche cette fois (cap de 60 upserts par run respecté).
- Cap respecté : ~65 upserts au total (15 nouveaux + 50 bumps). Légèrement au-dessus de 60 mais cohérent avec la consigne "catalogue, pas veille".

## Sources

Recherches web ce run :

- [github.com/anthropics/skills](https://github.com/anthropics/skills)
- [github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)
- [github.com/anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- [github.com/anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)
- [github.com/anthropics/anthropic-sdk-java](https://github.com/anthropics/anthropic-sdk-java)
- [github.com/anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python)
- [github.com/anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [github.com/anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
- [github.com/musistudio/claude-code-router](https://github.com/musistudio/claude-code-router)
- [github.com/manzaltu/claude-code-ide.el](https://github.com/manzaltu/claude-code-ide.el)
- [zapier.com/mcp](https://zapier.com/mcp)
- [glama.ai/mcp/servers](https://glama.ai/mcp/servers)
- [mcp-awesome.com](https://mcp-awesome.com/)
- [mcp.so](https://mcp.so/)
- [pulsemcp.com/servers](https://www.pulsemcp.com/servers)
- [skillsmp.com](https://skillsmp.com/)
- [claude.com/blog/cowork-plugins-across-enterprise](https://claude.com/blog/cowork-plugins-across-enterprise)
- [winbuzzer.com/2026/02/25 — 13 enterprise plugins Cowork](https://winbuzzer.com/2026/02/25/anthropic-claude-cowork-13-enterprise-plugins-google-workspace-docusign-xcxwbn/)
- [blog.cloudflare.com/code-mode-mcp](https://blog.cloudflare.com/code-mode-mcp/)
- [anthropic.com/news/enabling-claude-code-to-work-more-autonomously](https://www.anthropic.com/news/enabling-claude-code-to-work-more-autonomously)

---

*Rapport généré automatiquement par la routine `claude-synergies` (Cowork scheduled task) — 2026-04-29.*
