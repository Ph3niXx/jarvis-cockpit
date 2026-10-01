# Veille écosystème Claude — 2026-09-02

## Chiffres

- **Entrées vues (retenues web) :** 48
- **Ajoutées (nouveaux slugs) :** 5
- **Mises à jour (last_seen bumpé) :** 43
- **Archivées :** 0 (aucun item avec `last_seen < CURRENT_DATE - 90d` en base — le catalogue est déjà à jour)
- **Total en base après run :** 540 items actifs

## Nouveautés notables

| Slug | Direction | Type | 1 ligne |
|---|---|---|---|
| `claude-fable-5-1` | outbound | model (other) | Nouveau modèle phare Anthropic (1er sept. 2026), contexte 1M, cache reads -75% vs Fable 5, même prix. |
| `claude-mythos-5-1` | outbound | model (other) | Variante restreinte de Fable 5.1 pour orgs vetted (cybersécu / life sciences). |
| `mcp-syncro` | inbound | mcp_server | Serveur MCP Syncro (MSP/IT), GA 11 août 2026, entre au Claude Connector Directory. |
| `mcp-miro` | inbound | connector | Connecteur MCP Miro pour Claude ; enterprise-managed auth annoncée à venir (avec Exa et Zoom). |
| `addyosmani-agent-skills` | inbound | skill | Repo ~50k stars, 22 skills engineering + meta-skill, distribué comme plugin Claude Code / Cursor / Codex / Copilot. |

## Rafraîchissements (extraits)

Bumpés à `last_seen = 2026-09-02` : modèles récents (Fable 5, Mythos, Opus 5, Sonnet 5), Claude Code CLI (2.1.257/258 le 1er sept.), Claude in Chrome, Cowork, Anthropic Skills repo, MCP Registry officiel, Enterprise-Managed Auth (élargi Datadog/Notion/Slack le 24 août), SDKs (Python, TS, Agent SDK Python/TS), cookbooks, awesome-mcp-servers-punkpeye, vercel-skills-cli, IDE integrations (JetBrains, VS Code), core connectors (Atlassian, Supabase, GitHub, Linear, Slack, Figma, Notion, Google Workspace, Datadog, Zoom), frameworks (LangChain, LlamaIndex, Vercel AI SDK, FastMCP, CrewAI, Semantic Kernel, Haystack, Microsoft Agent Framework, Google ADK, DSPy 3.1), Voltagent awesome skills, Composio awesome Claude skills. (43 items au total.)

## Archivages

Aucun. Requête `status='active' AND last_seen < CURRENT_DATE - 90d` a retourné **0 lignes** — le run précédent a laissé le catalogue frais.

## Ce qui n'a pas pu être couvert

- **Pas de sweep exhaustif des 535 slugs déjà connus** : refresh ciblé sur ~40 entrées core (modèles, SDKs, IDEs, connecteurs enterprise, frameworks majeurs, marketplaces phares). Le reste garde son `last_seen` antérieur et sera revu au prochain run (ou plus tôt si un item déborde la fenêtre des 90j).
- **Sources fermées ou payantes** non consultables : release notes internes MSP/vendors, docs privées d'entreprise.
- **r/ClaudeAI top month** : pas exploitable via WebSearch en API (résultats agrégés côté indexation). Signaux ecosystem captés via awesome-lists, changelogs officiels et blogs indépendants.
- **Cap 60 respecté** : 48 items touchés, marge conservée pour ne pas transformer le catalogue en veille brute.
- **Slug `claude-haiku-4-5`** : présent en dur dans le prompt système mais absent de la table — à vérifier au prochain run (probablement stocké sous un autre slug, ou à ajouter).

## Notes méthode

- Ordre exécuté : snapshot → recherche → UPSERT (5 lignes, `xmax=0` confirme insertion) → UPDATE last_seen ciblé (43 lignes) → check stale (0) → rapport.
- Champs `status`, `user_priority`, `is_pinned`, `user_notes` intacts (jamais touchés dans les statements).
- Sources principales : anthropic.com, releasebot.io, blog.modelcontextprotocol.io, github.com (repos officiels), syncrosecure.com, vercel.com/changelog.
