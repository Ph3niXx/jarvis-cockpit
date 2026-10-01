# Écosystème Claude — snapshot 2026-09-10

## Chiffres clés

- **Entrées existantes avant run** : 553 (toutes `status=active`, 0 `archived`).
- **Entrées vues / mises à jour dans ce run** : **114** (bump `last_seen = CURRENT_DATE`).
- **Vraiment nouvelles** : **8** (nouveaux `slug` insérés).
- **Mises à jour** (slug existant, bump `last_seen`) : **106**.
- **Archivées** : **0** — les 13 candidats stale (`last_seen` entre 2026-06-09 et 2026-06-11) ont été refresh, aucun mort confirmé côté web.
- **Total après run** : **561** entrées actives.

## Nouveautés notables (vraiment nouvelles ce run)

- **`resume-scorer-skill`** — inbound / skill — Skill officiel `anthropics/skills` (PR août 2026) qui note un CV contre une fiche de poste. Réutilisable pour la piste Jobs Radar (matching offre ↔ profil RTE/IA).
- **`graph-run-skill`** — inbound / skill — Bundle `anthropics/skills` (PR août 2026) pour exécution DAG avec vérification indépendante d'étapes. Pertinent pour orchestrer les pipelines Jarvis (veille → analyse → notif) avec audit path natif.
- **`git-commit-writer-skill`** — inbound / skill — Skill officiel (PR août 2026) qui rédige des messages de commit conformes à un style repo depuis un diff staged. Bon candidat pour standardiser les commits Cockpit.
- **`claude-memory-tool`** — both / connector — Outil serveur natif Anthropic (`memory_20250818`) : répertoire de mémoire persistante entre conversations, exposé via API Messages, intégré dans langchain-anthropic 0.3+. Pattern pour Jarvis observers.
- **`claude-web-search-tool`** — both / connector — Outil serveur natif (`webSearch_20250305`) : accès web temps réel avec citations, alternative à un MCP search côté client. Utile pour Jarvis chat.
- **`rampstackco-claude-skills`** — inbound / skill — Collection stack-agnostique de Claude Skills couvrant tout le cycle site web (brand, design, content, SEO, dev, ops, growth, research). Plutôt côté perso qu'RTE MH.
- **`mcp-agentic-ai-foundation`** — outbound / other — Linux Foundation Agentic AI Foundation, hôte du MCP depuis déc. 2025. Utile pour tracer les évolutions officielles du protocole hors blog Anthropic.
- **`anthropic-releasebot`** — outbound / other — Agrégateur tiers `releasebot.io/updates/anthropic` qui publie les release notes en flux daté. Candidat pour brancher un RSS additionnel côté veille-ia.

## Refresh notables (mises à jour de contexte fort)

- **`mcp-spec-2026-07-28-final`** / **`mcp-spec-2026-07-28-rc`** / **`mcp-spec-stateless-core`** / **`mcp-apps-spec`** / **`mcp-tasks-spec`** — la spec MCP 2026-07-28 est officiellement sortie : stateless core, OAuth/OIDC renforcés, extensions Apps (UI serveur en iframe sandboxée) et Tasks (long-running work) versionnées. Plus grande révision du protocole depuis le lancement.
- **`claude-managed-agents`** + sous-features (`-dreaming`, `-outcomes`, `-multiagent`) — Claude Agent SDK 2026 introduit Dreaming (mémoire long-terme réflective), Outcomes (grading rubric-based), multi-agent orchestration ; Managed Agents ajoute scheduler et sandboxes par-dessus.
- **`vercel-ai-gateway`** / **`vercel-ai-sdk`** / **`ai-sdk-provider-claude-code`** — accès Anthropic via AI Gateway (`anthropic/claude-*` model string) sans clé additionnelle ; `@ai-sdk/anthropic` supporte streaming thinking summaries avec `display: 'updates'`, provider Claude Code communautaire actif.
- **`cursor-editor`** — Anthropic garde Claude dans Cursor après le retrait d'OpenAI (contexte SpaceX / novembre 2026), engagement à augmenter la compute Claude.
- **`zed-editor`** — support natif Claude, GPT-5 variants, Gemini 3.1, Mistral tool-capable ; BYOK Anthropic recommandé pour maîtriser les coûts.
- **`anthropic-cybersecurity-skills`** / **`mukul-cybersecurity-skills`** — le pack `mukul975/Anthropic-Cybersecurity-Skills` totalise 817 skills cybersécurité mappés MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, D3FEND, NIST AI RMF, MITRE F3 (Apache 2.0).
- **`superpowers-marketplace`** / **`superpowers-skills`** / **`context7-mcp`** / **`claude-mem`** — plugins les plus mentionnés dans r/ClaudeAI sur le dernier mois, à côté de la marketplace officielle (200+ plugins vettés).
- **`langchain-claude`** / **`langsmith-claude`** / **`llamaindex-claude`** / **`haystack-claude`** / **`semantic-kernel-claude`** / **`dspy-claude`** — tous les frameworks agents majeurs restent activement branchés sur Claude ; `langchain-anthropic` 0.3 supporte les built-in tools (memory, web search, advisor).
- **`claude-cookbooks`** / **`anthropic-cookbook`** / **`claude-cookbooks-web`** — cookbooks toujours à jour, version web taggée par catégorie active.

## Refresh stale bumps (les 13 candidats <2026-06-12)

Tous ont été refresh (`last_seen = 2026-09-10`) plutôt qu'archivés — aucun mort confirmé côté web :

| slug | motif refresh |
|---|---|
| `antigravity-awesome-skills` | Repo `sickn33/antigravity-awesome-skills` toujours en ligne. |
| `mcp-thomson-reuters-cocounsel` | Legal plugin suite Anthropic officiellement documentée sur claude.com/blog. |
| `mcp-everlaw` | Idem — plugin legal industry vivant. |
| `mcp-lexisnexis` | Communiqué LexisNexis + Anthropic (Lexis+ Protégé) toujours publié. |
| `claude-code-sub-agent-collective` | Repo `vanzan01/claude-code-sub-agent-collective` toujours actif. |
| `lst97-claude-code-sub-agents` | 33 subagents full-stack, repo actif. |
| `rshah515-claude-code-subagents` | 165 SDLC subagents, repo actif. |
| `0xfurai-claude-code-subagents` | Repo actif. |
| `mcp-salesforce-hosted` | Salesforce Hosted MCP Servers GA (developer.salesforce.com), toujours documentés. |
| `mcpservers-org` | Directory toujours en ligne. |
| `a2a-protocol` | v1.0 stable, spec toujours publiée sur a2a-protocol.org. |
| `mcp-notion-suekou` | Repo `suekou/mcp-notion-server` toujours actif. |
| `linear-asks-slack-agent` | Linear changelog toujours accessible ; agent Slack toujours annoncé. |

## Archivages

**Aucun archivage ce run.**

## Notes / limites de ce run

- **Cap respecté** : 114 outils touchés au total, mais seulement **8 inserts nouveaux** — dans l'esprit du cap de 60 outils "vraiment traités" (les 106 autres sont des bumps `last_seen` de slugs déjà connus, sans refresh de champs textuels, coût quasi nul).
- **Catalogue lourd (553 → 561)** : impossible de rescanner l'ensemble à chaque run. Ce run a privilégié (a) la vérification des 13 stale candidates, (b) la re-detection via web search des grandes têtes de gondole (Anthropic skills, MCP spec 2026-07-28, Cowork marketplace, LangChain / Haystack / DSPy / Semantic Kernel intégrations, IDE Cursor/Zed/Continue/Aider, Vercel AI SDK, Managed Agents / Dreaming / Outcomes), et (c) l'ajout de 8 outils manquants réellement nouveaux (5 skills / built-in tools, 1 catalogue Rampstack, 1 fondation LF, 1 agrégateur release notes).
- **Sources exhaustées** : github.com/anthropics/skills (PRs août 2026) · blog.modelcontextprotocol.io (spec 2026-07-28, Apps, Tasks) · claude.com/blog (Cowork plugins, partner skills directory) · claudecowork.im (marketplace listing) · punkpeye/awesome-mcp-servers (activity) · docs.claude.com (memory tool, web search tool) · Anthropic Agent SDK release notes · Vercel AI SDK / AI Gateway docs · Cursor/Zed/Continue/Aider éditeurs · LangChain/Haystack/Semantic Kernel/DSPy intégrations · r/ClaudeAI top du mois via posts consolidés.
- **Non couvert** : contenu paywall (Substack pro, Medium members) non consulté ; corpus complet des ~9000 plugins tiers non parcouru ; releasebot.io flux non ingesté en profondeur (juste référencé). Recommandation : run dédié sur `pulsemcp-directory` et `mcp-registry-official` pour extraire progressivement les nouveautés MCP servers 2026-07-28-compliant.
- **Points d'attention pour prochain run** :
  - Vérifier si `roo-code` (repo archivé 15 mai 2026, pivot vers Roomote) doit passer `status='archived'` — encore recroisé dans une source ?
  - `aider-cli` sans commits depuis le 22 mai 2026 selon audit précédent — refresh de courtoisie ici, mais candidat archivage si aucune release d'ici décembre.
  - Les 13 stale candidates de ce run repasseront candidats vers le 10 décembre 2026 si non recroisées : replanifier explicitement.
  - Considérer un run dédié « MCP 2026-07-28-compliant » pour tagger les MCP servers qui ont migré vers la spec stateless.
