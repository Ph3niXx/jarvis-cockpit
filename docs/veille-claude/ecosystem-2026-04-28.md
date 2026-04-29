# Catalogue écosystème Claude — 2026-04-28

## Résumé

- **Entrées vues** : 100 (84 existantes + 16 nouvelles)
- **Ajoutées (vraiment nouvelles)** : 16
- **Mises à jour (slug existant)** : 84 (`last_seen` bumpé à 2026-04-28)
- **Archivées** : 0 (aucun item ne dépasse 90j sans refresh — le catalogue date du 27/04, soit J-1)

## Nouveautés ajoutées

### Annuaires & registres MCP

- **smithery-registry** (inbound · other) — Smithery hébergerait 7 000+ serveurs MCP en avril 2026, avec déploiement managé. Source : https://smithery.ai
- **pulsemcp-directory** (inbound · other) — Annuaire MCP daily-updated revendiquant 12 970+ entrées. Filtres tag/catégorie/hosted-vs-local.
- **mcpservers-org** (inbound · other) — Front-end web alternatif à awesome-mcp-servers (punkpeye), recherche tabulaire.

### Serveurs MCP officiels nouvellement listés

- **mcp-vercel** (inbound · mcp_server) — Officiel Vercel : déploiements, logs build, domaines.
- **mcp-firebase** (inbound · mcp_server) — Officiel Google : Firestore, Realtime DB, Auth, Storage, Functions via CLI Firebase.
- **mcp-playwright** (inbound · mcp_server) — Officiel Microsoft : contrôle navigateur headless pour E2E et scraping.

### Plugins Cowork partenaires

- **plugin-connect-apps** (inbound · cowork_plugin) — Composio en back-end, accès à 500+ SaaS via un seul plugin.
- **plugin-42crunch** (inbound · cowork_plugin) — Audit sécurité OWASP API Top 10 (utile RTE quand le train Vente expose des APIs).
- **plugin-coderabbit** (inbound · cowork_plugin) — Code review AI avec 40+ static analyzers.
- **plugin-frontend-design** (inbound · cowork_plugin) — Anthropic Labs, génère UI front production-grade non-générique.

### Skills & catalogues plugins

- **skill-claude-api** (inbound · skill) — Skill officiel Anthropic pour bonnes pratiques API Claude (tool use, streaming, prompt caching, extended thinking).
- **agentskills-spec** (inbound · framework) — Standard ouvert agentskills.io pour les SKILL.md universels (Claude, Cursor, Gemini CLI, Codex CLI, Antigravity).
- **claude-skills-alirezarezvani** (inbound · skill) — 232+ skills business/engineering/marketing/compliance multi-agents.
- **awesome-claude-plugins-composio** (inbound · cowork_plugin) — Liste curatée Composio des plugins Claude Code/Cowork.
- **awesome-claude-plugins-quemsah** (inbound · cowork_plugin) — Adoption metrics plugins via n8n (signal d'adoption réelle).

### IDE compatible standard skills

- **antigravity-ide** (outbound · ide_integration) — IDE Google premier non-Anthropic à supporter le format SKILL.md universel.

## Archivages

Aucun. Tous les items sont récents (catalogue créé le 27/04/2026).

## Notes & limitations

- **Nombre d'entrées NEW conservateur** : la veille couvrant le même horizon temporel (~1 jour après la création initiale du catalogue), peu de vraies nouveautés à signaler. Les 16 ajouts ressortent pour la plupart d'angles complémentaires (annuaires alternatifs, plugins partenaires non-listés à la création, spec ouverte agentskills.io, IDE Google).
- **Filtre dur appliqué** : exclu les serveurs MCP < 100 stars (Penfield, InstaDomain, mcp-trust-guard, evmcp, FCPXML, Entroly, Aiqbee Brain, SkillBoss MCP, Headless Oracle — tous repérés via awesome-mcp-servers mais sans signal d'adoption suffisant).
- **Doublons potentiels surveillés** : `awesome-claude-plugins-composio`, `awesome-claude-plugins-quemsah` et `claudemarketplaces-directory` couvrent des angles voisins (curation vs métriques vs annuaire web) — gardés distincts car méthodologies différentes.
- **Cap respecté** : 16 nouvelles entrées, bien en deçà du plafond de 60/run.
- **Sources paywall non couvertes** : aucune dans cette passe — toutes les sources consultées étaient publiques (GitHub, blogs Anthropic/MCP, articles tech).
- **Décisions user préservées** : aucun champ `status`, `user_priority`, `is_pinned`, `user_notes` modifié — uniquement `last_seen` bumpé sur les existantes et INSERT pour les nouvelles.

## Sources principales consultées

- github.com/anthropics/skills (skill-creator, claude-api, document-skills, theme-factory…)
- github.com/anthropics/claude-cookbooks (skills cookbook section)
- github.com/anthropics/claude-plugins-official + github.com/anthropics/knowledge-work-plugins
- github.com/punkpeye/awesome-mcp-servers + github.com/modelcontextprotocol/servers
- claude.com/plugins (marketplace officiel — 101 plugins, 33 Anthropic + 68 partenaires)
- platform.claude.com/docs (release notes API, skills, computer use, remote MCP servers)
- code.claude.com/docs (release notes Claude Code, MCP integration)
- blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ (MCP Apps spec)
- agentclientprotocol.com (ACP spec, clients/servers)
- support.claude.com (release notes Cowork, Excel, Chrome)
- claudemarketplaces.com + mcp.so + smithery.ai + pulsemcp.com (annuaires tiers)
