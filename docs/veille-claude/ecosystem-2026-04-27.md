# Veille catalogue écosystème Claude — 2026-04-27

## Synthèse

| Métrique | Valeur |
|---|---|
| Entrées vues (snapshot avant run) | 63 |
| Entrées dans le catalogue après run | 85 |
| Vraiment nouvelles (INSERT) | 22 |
| Mises à jour (UPDATE last_seen sur slugs existants) | 63 |
| Archivées ce run | 0 |
| Stale > 90 j détectées | 0 (toutes étaient à 2026-04-26) |

Run via la routine catalogue-ecosystem (mensuelle). Tous les slugs existants ont vu leur `last_seen` poussé à `CURRENT_DATE`. Aucun produit confirmé mort, donc aucun statut archivé. Les décisions user (`status`, `user_priority`, `is_pinned`, `user_notes`) sont restées intactes — le UPSERT ne touche jamais ces colonnes.

## Nouveautés notables ajoutées

### Anthropic / écosystème officiel

- **mcp-apps-spec** — `inbound` / `framework`. Extension officielle MCP (26 jan 2026) qui permet à un serveur MCP de retourner des composants UI interactifs rendus dans la conversation Claude (dashboards, formulaires, viz). 9 partenaires de lancement (Amplitude, Asana, Box, Canva, Clay, Figma, Hex, Monday.com, Slack). Sandbox iframe + JSON-RPC.
- **anthropic-memory-mcp** — `inbound` / `mcp_server`. Serveur MCP officiel Anthropic (publié 18 avr 2026) : graphe de connaissances persistant pour mémoire long-terme entre sessions. Référence pour memory-as-a-service.
- **claude-code-action** — `outbound` / `connector`. Action GitHub officielle pour Claude Code : @claude mentions sur PRs/issues, review automatique, fixes/features. v1.0 supporte API directe + Bedrock + Vertex + Foundry.

### Agents alternatifs (outbound)

- **goose** — `outbound` / `agent_runtime`. Agent open-source (Block puis AAIF / Linux Foundation), ~29K stars, 70+ extensions, 3000+ MCP servers. Reference implementation MCP avec elicitations / sampling / MCP Apps.
- **cline** — `outbound` / `ide_integration`. Extension VS Code BYOM, ~5M installs, philosophie "approve everything".
- **opencode** — `outbound` / `agent_runtime`. Agent terminal-first, ~95K stars, 2.5M devs/mois, 75+ providers.
- **kilo-code** — `outbound` / `ide_integration`. Superset de Cline (Memory Bank, browser automation, visual app builder), 302B tokens/jour.

### Serveurs MCP officiels (inbound)

Vague forte fév-avr 2026 :

- **mcp-smartsheet** — Hosted (mcp.smartsheet.com), GA 24 mars 2026.
- **mcp-wrike** — Hosted (mcp.wrike.com).
- **mcp-shortcut** — Project management.
- **mcp-plane** — Project management open-source.
- **mcp-clickup** — Étendu de 6 à ~49 tools en 2026.
- **mcp-todoist** — Doist officiel (toolkit todoist-ai, 99 releases).
- **mcp-hubspot** — Remote production CRM.
- **mcp-sentry** — Remote production observability.
- **mcp-neon** — Remote production Postgres serverless.
- **mcp-cloudflare** — Catalog 2500+ endpoints CF + Code Mode (avr 2026).
- **mcp-google-workspace** — Support officiel Google (Gmail, Drive, Calendar, Docs, Sheets).

### Skills (inbound)

- **awesome-claude-skills-travisvn** — Liste curated (~11.5k stars, 1.2k forks), focus Claude Code, refuse skills purement commerciaux.
- **anthropic-cybersecurity-skills** — 754 skills cybersecurity (mukul975), mappés MITRE ATT&CK / NIST CSF 2.0 / MITRE ATLAS / D3FEND / NIST AI RMF, Apache 2.0.

### SDKs communautaires

- **claude-agent-sdk-go** — Wrapper Go autour de Claude Code CLI (partio-io, publié 26 mars 2026).
- **claude-sdk-rust** — SDK Rust type-safe, async-first (bredmond1019). Plusieurs alternatives sur crates.io ; pas de SDK officiel Anthropic en Rust à date.

## Archivages

Aucun ce run.

Tous les slugs avaient `last_seen = 2026-04-26` au démarrage (snapshot très récent). La règle des 90 j ne s'applique donc à personne. Le run UPDATE les a tous remontés à `2026-04-27`.

## Décisions et notes

- Cap respecté : 22 ajouts, 85 entrées totales (sous le seuil de 60 *par run* pour les nouveautés et bien sous tout plafond raisonnable de catalogue).
- Privilégié les produits avec >100 stars OU vendor officiel maintenu en 2026.
- Pour les serveurs MCP project management (Smartsheet, Wrike, Shortcut, Plane), je n'ai pas trouvé de source URL canonique distincte du site vendor — j'ai mis le site principal et noté la doc dans `install_hint`.
- `applicability` rempli uniquement quand un lien direct avec Jarvis Cockpit ou la mission RTE Malakoff Humanis était évident, sinon `NULL` (consigne respectée).

## Couverture incomplète

- **r/ClaudeAI top du mois** : la requête `site:reddit.com r/ClaudeAI tools 2026` n'a pas retourné de résultats indexés. Les communautés Reddit restent un angle mort de cette routine — à recompléter manuellement si besoin.
- **Marketplace Cowork interne** : pas d'inventaire exhaustif accessible côté web search ; je m'appuie sur `claude-plugins-official` et `claudemarketplaces-directory` qui restent les meilleurs proxies.
- **Forks et expérimentations** : volontairement skip pour respecter le filtre dur "≥100 stars + maintenance ≤6 mois".
- **Bots Discord/Telegram/iMessage** : Claude Code supporte ces canaux (mars 2026) mais ce sont des extensions du produit Claude Code, pas des outils autonomes — j'ai préféré ne pas créer de slugs dédiés tant que ça reste des "modes" de Claude Code lui-même.
- **Kiro / Antigravity / Codex** : compétiteurs IDE évoqués dans les comparatifs 2026 mais ils n'ont pas Claude comme intégration *first-class* (Codex = OpenAI ; Kiro = AWS), donc hors scope catalogue Claude.
