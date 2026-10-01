# Veille écosystème Claude — 2026-09-25

## Compteurs du run

- Entrées vues (touchées cette exécution) : **42**
- Ajoutées (slug vraiment nouveau) : **3**
- Mises à jour (bump `last_seen` sur slug existant) : **39**
- Archivées (`status='archived'`) : **0**
- Dormants restants (>90 j sans revue) après le run : **0**

## Nouveautés notables

### Ajouts (3)

- **unity-plugin-claude-code** — *inbound / cowork_plugin* — Plugin officiel Unity annoncé le 9 septembre 2026 : 29 skills (UI, 2D sprites, audio, monétisation, multi…) plus un MCP server qui expose l'Editor Unity au live. Peu d'usage direct pour Jarvis Cockpit (pas de dev jeu), mais pattern « éditeur + skills + MCP » à surveiller.
- **ivanmurzak-unity-mcp** — *inbound / mcp_server* — Unity-MCP communautaire (IvanMurzak). Expose n'importe quelle méthode C# comme tool MCP en une seule ligne, compatible Claude Code / Gemini / Copilot / Cursor. Intéressant surtout pour le pattern de tooling.
- **gunpal-claude-agent-sdk-dotnet** — *outbound / sdk* — Portage .NET non-officiel du Claude Agent SDK (parité avec le SDK Python : streaming, multi-turn, tool use). Utile si un back-end .NET veut piloter Claude — pertinent côté contexte MH où beaucoup d'outils Vente sont .NET.

### Bumps `last_seen` (39)

Bump uniquement (aucune modification de description ou de user_*), regroupés par famille :

- **SDK officiels Anthropic** : anthropic-sdk-typescript, anthropic-sdk-python, anthropic-sdk-go, anthropic-sdk-java, anthropic-sdk-ruby, anthropic-sdk-php, anthropic-sdk-csharp.
- **Agent SDK officiels** : claude-agent-sdk-python, claude-agent-sdk-typescript, claude-agent-sdk-go, claude-managed-agents.
- **CLI / IDE** : claude-code-cli, claude-code-vscode, claude-code-jetbrains, claude-code-xcode, cline, aider-cli, antigravity-ide, ai-sdk-provider-claude-code.
- **Marketplace et catalogues** : claude-marketplace, anthropic-skills-repo, claude-plugins-official, claude-plugins-community, knowledge-work-plugins, buildwithclaude-marketplace, xiaolai-claude-plugin-marketplace, tonsofskills-marketplace, awesome-mcp-servers-punkpeye.
- **Intégrations produit** : mcp-github, github-mcp-registry, claudeforce-salesforce, claude-tag, notion-custom-agents.
- **Sécurité / gateways** : snyk-agent-scan, mintmcp-gateway, mcp-gateway-registry-agentic-community.
- **Ressources** : claude-cookbooks, everything-claude-code, agents-md-spec.

### Étape 3 — Archivage doux

6 items étaient au-delà de 90 jours de `last_seen` avant le run :

- `mcp-gateway-registry-agentic-community` — repo `agentic-community/mcp-gateway-registry` actif (2 210 commits, releases 1.29+, roadmap 1.30/1.31). → `last_seen` bumpé.
- `mintmcp-gateway` — mintmcp.com actif (dates 2026, nouveautés Mint Guard / Slack workforce). → `last_seen` bumpé.
- `notion-custom-agents` — produit Notion actif (pricing mai 2026, MCP integrations Linear/Figma/HubSpot…). → `last_seen` bumpé.
- `snyk-agent-scan` — repo `snyk/agent-scan` actif (755 commits, package `snyk-agent-scan`). → `last_seen` bumpé.
- `github-mcp-registry` — registry github.com/mcp actif (218+ MCP servers listés). → `last_seen` bumpé.
- `everything-claude-code` — repo `affaan-m/everything-claude-code` actif (release 2.2.2 le 2026-08-31, 2 812 commits). → `last_seen` bumpé.

**Aucun archivage nécessaire ce run.**

## Notes sur le périmètre

- **Cap 60 respecté** (42 items touchés).
- **Décisions user préservées** : la stratégie UPDATE `last_seen` ne touche jamais `status`, `user_priority`, `is_pinned`, `user_notes`. L'UPSERT des 3 nouveautés utilise `ON CONFLICT DO UPDATE` mais sans écraser ces colonnes.
- **Vérité utile pour Jarvis** : côté Anthropic, la vraie annonce marchande de la semaine est **Claudeforce** (déjà catalogué comme `claudeforce-salesforce`) — pertinent RTE / Malakoff (contexte CRM). Côté outillage, la vague AGENTS.md continue (déjà catalogué comme `agents-md-spec`) et Claude Code Desktop consolide sa surface (pop-out panes, `/design`, `/skill-doctor`, `claude plugin eval`).
- **Sources parcourues** : `code.claude.com/docs/en/whats-new` (semaines 13→37), releasebot.io/updates/anthropic/claude-code, claude.com/blog/claude-marketplace, github.com/anthropics/skills, github.com/anthropics/claude-plugins-official, github.com/anthropics/knowledge-work-plugins, buildwithclaude.com, awesome-mcp-servers-* (punkpeye, appcypher), search Vercel AI SDK / LangChain / Xcode / Unity, r/ClaudeAI top plugins/skills.

## Limites assumées

- **PRs et code interne Anthropic** non lus (pas d'accès repo privé) — seules les annonces publiques et les weekly digests sont couverts.
- **Reddit r/ClaudeAI** : peu de nouveautés « outils tiers » cette semaine dans le top ; l'essentiel des liens pointe sur des articles récap déjà couverts par les autres sources.
- **Cap 60** volontairement pas atteint : le catalogue est mûr (592 items actifs avant run), la valeur marginale d'un 40e bump est faible ce jour-là.
