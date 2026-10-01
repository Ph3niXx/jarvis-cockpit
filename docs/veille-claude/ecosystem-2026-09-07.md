# Écosystème Claude — snapshot 2026-09-07

## Chiffres clés

- **Entrées existantes avant run** : 551 (toutes `status=active`, 0 `archived`).
- **Entrées vues / mises à jour dans ce run** : **60** (bump `last_seen = CURRENT_DATE`, refresh des champs textuels).
- **Vraiment nouvelles** : **2** (nouveaux `slug` insérés).
- **Mises à jour** (slug existant, refresh + last_seen) : **58**.
- **Archivées** : **0** — les 4 candidats sous les 90 jours (`last_seen < 2026-06-09`) ont été vérifiés vivants et refresh.
- **Total après run** : 553 entrées actives.

## Nouveautés notables (vraiment nouvelles ce run)

- **`claude-cookbooks-web`** — outbound / other — Version web rendue et taggée par catégorie du repo `anthropics/claude-cookbooks`, lancée le 7 janvier 2026 sur `platform.claude.com/cookbook`. Search full-text sur toutes les recettes.
- **`mcp-mongodb`** — inbound / mcp_server — Plugin officiel Claude pour MongoDB (Anthropic + MongoDB) : MCP server + skills, query / aggregations / schema inspection sur clusters. Installable via `claude-code: /plugin install mongodb`.

## Refresh notables (mises à jour de contexte fort)

- **`cowork`** — Cowork a un built-in browser depuis août 2026, rolling out Pro/Max/Team. Sur Enterprise, activation par défaut à partir du 10 septembre 2026 sauf disable préalable.
- **`claude-in-chrome`** — le side panel Chrome est désormais une session Cowork complète, avec skills, connectors et historique partagés desktop/web/mobile.
- **`anthropic-sdk-python`** — v1.0 sorti le 20 août 2026 : migration `httpx → httpx2` (fork API-compatible maintenu), min Python 3.10.
- **`claude-agent-sdk-python`** — structured outputs (validated JSON), tools option dans `ClaudeAgentOptions`, Claude Code inclus par défaut, automatic fallback model.
- **`claude-desktop`** — build courant `v2.1.232` (13 août 2026), Cowork mode + built-in browser + MCP locaux.
- **`vercel-ai-sdk-6`** — AI SDK 6 (22 déc 2025) : ToolLoopAgent, human-in-the-loop tool approval, stable MCP support.
- **`shopify-ai-toolkit`** — open-source Dev MCP (avril 2026), 7 tools pour docs Admin API + opérations live store.
- **`mcp-google-ads-official`** — MCP officiel Google (début 2026), read-only : account discovery, GAQL reporting, resource metadata.
- **`otterlyai-skill`** — Skill Claude (juin 2026) exposant visibility data AI Search (ChatGPT, Perplexity, Gemini, Copilot).
- **`superpowers-marketplace`**, **`plugin-frontend-design`** (~277k installs), **`security-guidance-plugin`** — plugins in-app confirmés très adoptés mi-2026.

## Archivages

**Aucun archivage ce run.**

Les 4 candidats avec `last_seen < 2026-06-09` avant ce run ont tous été vérifiés vivants et refresh :

| slug | statut | source vérifiée |
|---|---|---|
| `claude-ultracode-plugin` | vivant (mappé sur `hesreallyhim/ultracode-workflows`, actif) | GitHub |
| `mcp-google-ads-official` | vivant, MCP officiel Google actif | `google-marketing-solutions/google_ads_mcp` |
| `otterlyai-skill` | vivant, launch juin 2026 documenté | `docs.otterly.ai/claude-skill` |
| `shopify-ai-toolkit` | vivant, MCP open-source actif | `Shopify/dev-mcp` |

## Notes / limites de ce run

- **Cap respecté** : 60 outils touchés (limite haute déclarée dans la spec du run à 60).
- **Catalogue lourd (551 → 553)** : impossible de rescanner l'ensemble à chaque run. Ce run privilégie les têtes de gondole first-party Anthropic (skills, cookbooks, cowork, marketplace, SDKs, agent SDK, Claude Code), les MCP directement utiles au cockpit (Supabase, GitHub, Atlassian, Notion, Playwright, Firecrawl, Context7, etc.), les frameworks agents phares (LangChain, LlamaIndex, Vercel AI SDK 6, LangGraph, Pydantic AI), 3 IDE integrations vivantes (Cursor, Cline, Continue), et les 4 archival candidates. Sur les 551, les items non touchés ce run conservent leur ancien `last_seen` et repasseront candidats à review dans les runs suivants au fil du temps.
- **Sources exhaustées** : github.com/anthropics/skills · github.com/anthropics/claude-cookbooks · Anthropic help center / plugins marketplace · punkpeye/awesome-mcp-servers · modelcontextprotocol/servers · Anthropic SDK Python/TS + Agent SDK releases · LangChain, LlamaIndex, Vercel AI SDK docs · claude-code IDE integrations · Reddit / Medium "best plugins" 2026 posts · Claude Cowork & built-in browser annonces (blog claude.com).
- **Non couvert** : contenu paywall (Substack pro, medium members-only) non consulté par pudeur, corpus GitHub complet des ~9000 plugins tiers non parcouru — recommandation : run dédié sur `awesome-claude-plugins-composio` et `pulsemcp` pour extraire progressivement.
- **Points d'attention pour prochain run** :
  - Ré-évaluer `roo-code` (repo archivé 15 mai 2026, pivot vers Roomote) — dernière `last_seen` `2026-09-05` mais projet techniquement en fin de vie. Candidat à `status='archived'` dès qu'il repassera au-delà des 90 jours.
  - `aider-cli` sans commits depuis le 22 mai 2026 (dernière `last_seen` `2026-09-05` refresh light) — même surveillance.
  - Les 4 archival candidates de ce run risquent de revenir dans 90 jours si non recroisés : à replanifier explicitement dans le run T+3 mois.
