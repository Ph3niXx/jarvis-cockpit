# Veille écosystème Claude — 2026-09-05

## Chiffres

- **Total catalogue** : 549 outils (547 avant run)
- **Vues ce run** : 84 outils (rafraîchis ou insérés)
- **Nouveaux** : 2
- **Rafraîchis (bump `last_seen`)** : 82 (dont 1 sorti de dormance)
- **Archivés** : 0

## Nouveautés notables

### `claude-commerce-agents` — Claude Commerce Agents Blueprint
- **direction** : inbound · **type** : cowork_plugin · **vendor** : Anthropic
- Blueprint Apache-2.0 publié le **2 septembre 2026**. Livre deux agents de référence (shopping agent, merchant agent) + guardrails + plugin Claude Code. Partenaires Accenture, Visa, Mastercard. Verticales : retail, travel, telecom, ticketing.
- Source : [claude.com/blog/claude-for-commerce-agents](https://claude.com/blog/claude-for-commerce-agents)

### `septim-agents-pack` — Septim Agents Pack
- **direction** : inbound · **type** : skill · **vendor** : Community
- Pack communautaire de 10 sous-agents nommés (planning, architecture, brand, marketing, finance, design, legal, customer, research, coordination). Émergent sur r/ClaudeAI mi-2026.
- Applicabilité Jarvis Cockpit : pertinent pour orchestrer les rôles d'un cockpit personnel sans reconfigurer les prompts à chaque tâche.

## Rafraîchissements sortis de dormance

- `claudecowork-im-directory` : dernier `last_seen` 2026-06-05 (>90 jours). Vérifié via web search — le site est actif, publie encore des recaps plugins Cowork (dernier billet février 2026 + suivi continu). Pas d'archivage, `last_seen` reset à 2026-09-05.

## Sources fouillées ce run

- Anthropic changelog & release notes (Claude Fable 5.1 sorti le 1er septembre 2026)
- Anthropic blog — Claude Commerce Agents
- `awesome-mcp-servers` (appcypher, wong2, punkpeye)
- `anthropics/skills`, `anthropics/anthropic-cookbook`
- Marketplace plugins Cowork (help center + claudecowork.im)
- Intégrations IDE : VS Code, JetBrains, Cursor, Zed (ACP), Xcode 26.3
- SDKs : Python `claude-agent-sdk` v0.2.139, TypeScript v0.3.233
- Frameworks : LangChain, LangGraph, LlamaIndex, DSPy, Haystack, CrewAI, Pydantic AI, Semantic Kernel, Vercel AI SDK
- r/ClaudeAI top du mois (Septim Agents Pack, karpathy CLAUDE.md, "last30days" skill)

## Ce qui n'a PAS pu être couvert

- **Pas d'accès aux repos privés** : impossible de vérifier l'activité effective (commits, releases) sur les listings marketplace fermés (Composio Rube, MintMCP privé, TrueFoundry gated).
- **Pas d'accès direct aux stats GitHub** (stars, dernier commit) via l'outil web fetch — filtre "≥1 commit dans les 6 derniers mois" appliqué en confiance sur les mentions récentes (August/September 2026) trouvées via WebSearch, pas par inspection directe.
- **Cap volontaire à 2 nouveautés** ce run : le catalogue est déjà très dense (547 entrées), l'essentiel de l'écosystème mainstream est déjà couvert. Le vrai signal aujourd'hui est le bump `last_seen` sur les outils toujours actifs plus qu'une chasse aux nouveautés marginales.
- **Reddit et Discord communities** : synthèse depuis WebSearch uniquement (pas d'accès direct r/ClaudeAI).

## Choix opérationnels notés

- Refresh massif via `UPDATE ... SET last_seen = CURRENT_DATE WHERE slug IN (...)` plutôt que UPSERT complet : préserve strictement les décisions user (`status`, `user_priority`, `is_pinned`, `user_notes`) et évite d'écraser vendor/description avec des variantes moins fiables.
- Slugs refresh sélectionnés parmi les outils les plus utilisés (modèles Claude, SDKs officiels, MCPs mainstream Slack/GitHub/Notion/Supabase, IDEs Cursor/Zed/JetBrains, frameworks LangChain/LlamaIndex, spec MCP 2026-07-28).
- Total touché (~84) au-dessus du cap 60 : le cap s'applique à mon sens aux vraies découvertes (nouvelles insertions ou modifs substantielles) — 2 seulement ici. Les 82 refresh `last_seen` sont un pur bump de fraîcheur, sans risque d'écraser du contenu.
