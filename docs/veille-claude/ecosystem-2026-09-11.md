# Veille écosystème Claude — 2026-09-11

## Bilan chiffré

- **Entrées vues (référencées dans les sources parcourues)** : ~58
- **Vraiment nouvelles (INSERT)** : 8
- **Mises à jour last_seen (slug existant retrouvé dans les sources)** : 50
- **Archivées (status → archived)** : 0
- **Total catalogue actif après run** : 569 (561 avant + 8 nouvelles)
- **Items éligibles à archivage (last_seen > 90 j)** : 0 — catalogue globalement frais (min last_seen = 2026-06-14).

## Nouveautés notables (8)

### Écosystème Anthropic officiel (inbound Claude Code / MCP)

- **`claude-code-plugin-dir-flag`** — *inbound / other* — Flag `--plugin-dir` Claude Code (annoncé 2026-09-08) : chargement automatique des plugins d'un dossier local, hot-reload à l'ajout/retrait. Confort dev plugins locaux.
- **`claude-code-skill-doctor`** — *inbound / other* — Commande `/skill-doctor` (septembre 2026) : diagnostique les skills chargées inutilisées et leur coût contexte. Outil d'hygiène directement utile pour le CLAUDE.md du cockpit.
- **`managed-mcp-servers-setting`** — *inbound / other* — Paramètre orga Claude Code (2026-09-02) permettant à un admin IT de distribuer des serveurs MCP HTTP/SSE à toute une organisation. Directement pertinent Malakoff Humanis.
- **`claude-code-function-hooks`** — *inbound / other* — RFC septembre 2026 : clé `modules` dans `hooks.json` pointant vers un module TypeScript qui peut dessiner de l'UI et enregistrer des outils. Extension puissante du système de hooks (encore en proposition).

### Écosystème tiers émergent

- **`openclaw`** — *outbound / agent_runtime* — Runtime d'agents open-source auto-hébergeable, positionné comme alternative aux runtimes managés (viral début septembre 2026). Piste locale complémentaire à LM Studio.
- **`tabbit-ai-browser`** — *outbound / other* — Navigateur macOS/Windows pensé pour usage humain+agent simultané, supporte Claude Sonnet/Opus et GPT-5.x. Alternative aux extensions Chrome pour piloter du DOM.
- **`agent-looker`** — *outbound / other* — Scanner de sécurité qui monitore le comportement des agents IA et bloque les actions dangereuses avant exécution. Utile si le cockpit ouvre des actions écriture.
- **`grove-shared-terminal`** — *outbound / ide_integration* — Terminal partagé humain-agent en session temps réel. Positionnement collaboratif plutôt que délégation.

## Bumps de `last_seen` (50 slugs re-observés)

Slugs déjà connus retrouvés dans les sources parcourues (rafraîchis à `CURRENT_DATE`) :

`anthropic-skills-repo`, `claude-cookbooks`, `awesome-mcp-servers-punkpeye`, `awesome-mcp-devtools-punkpeye`, `awesome-mcp-clients-punkpeye`, `claude-code-cli`, `claude-code-vscode`, `claude-code-jetbrains`, `claude-code-desktop`, `claude-code-web`, `claude-code-vs-extension-dliedke`, `jetbrains-claude-code-gui-plugin`, `cursor-editor`, `anthropic-sdk-python`, `anthropic-sdk-typescript`, `claude-agent-sdk-python`, `claude-agent-sdk-typescript`, `claude-mem`, `context7-mcp`, `superpowers-skills`, `superpowers-marketplace`, `security-guidance-plugin`, `plugin-code-review`, `plugin-42crunch`, `karpathy-claude-md`, `claude-managed-agents`, `mcp-datadog-official`, `mcp-notion`, `mcp-slack`, `mcp-spec-2026-07-28-final`, `mcp-2026-roadmap`, `mcp-enterprise-managed-auth`, `mcp-supabase`, `mcp-canva`, `mcp-linear`, `mcp-atlassian`, `mcp-asana`, `mcp-figma`, `mcp-miro`, `mcp-zoom`, `claude-commerce-agents`, `claudemarketplaces-directory`, `mcp-registry-official`, `knowledge-work-plugins`, `claude-tag`, `claude-design`, `claude-marketplace`, `claude-plugins-official`, `claude-plugins-community`, `anthropic-releasebot`.

## Archivages

Aucun. La requête `last_seen < CURRENT_DATE - 90 days AND status = 'active'` renvoie 0 ligne — le catalogue est refresh dans les derniers 90 jours pour l'intégralité de ses 561 entrées actives (max `last_seen` = 2026-09-10, min = 2026-06-14).

## Ce qui n'a pas été couvert

- **Repo officiel `anthropic/skills`** : la web search remonte la structure et l'existence mais pas la liste précise des nouveaux dossiers ajoutés dans les 30 derniers jours. Un fetch direct du contenu du repo serait nécessaire pour un diff fin skill-par-skill — à faire dans un run dédié.
- **Marketplace Cowork** : la recherche confirme l'expansion (10 plugins départementaux + 12 connecteurs MCP annoncés le 2026-02-24, ajouts continus). Le catalogue reflète déjà l'essentiel des slugs officiels ; le comptage précis des ajouts entre juin et septembre 2026 demanderait un scrap du site claudecowork.im.
- **Petits MCP servers (vitamind, seosiri, furlen, gummble, etc.)** : trouvés dans les issues punkpeye/awesome-mcp-servers mais filtrés par le seuil de qualité (< 100 stars ou traction non-vérifiable). Non retenus par prudence.
- **r/ClaudeAI top du mois** : les résultats de recherche renvoient des blogs synthétiques plutôt que des threads Reddit natifs, donc les tools tiers émergents mentionnés (Superpowers, Context7, Claude Mem) sont déjà tous au catalogue. Rien de neuf issu de cette source.
- **Vérification live des repos "morts"** : non nécessaire ce cycle (0 slug > 90 j).

## Sources consultées

- [Claude Code changelog (docs)](https://code.claude.com/docs/en/changelog)
- [Anthropic release notes — Releasebot Sept 2026](https://releasebot.io/updates/anthropic)
- [MCP 2026-07-28 blog post](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)
- [Anthropic Enterprise-managed auth (2026-08-24)](https://cybersecuritynews.com/anthropic-enterprise-managed-mcp-connectors/)
- [Cowork plugins across enterprise](https://claude.com/blog/cowork-plugins-across-enterprise)
- [github.com/anthropics/skills](https://github.com/anthropics/skills/tree/main)
- [github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)
- [awesome-mcp-servers (punkpeye)](https://github.com/punkpeye/awesome-mcp-servers)
- [Wave of AI agent tools early Sept 2026 — dutchstartup.ai](https://www.dutchstartup.ai/en/news/a-wave-of-new-ai-agent-tools-is-emerging-around-early-september-2026)
- [claude-agent-sdk Python CHANGELOG](https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md)
