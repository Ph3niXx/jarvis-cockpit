# Veille écosystème Claude — 2026-09-29

_Table Supabase `claude_ecosystem` (projet `jarvis-cockpit`)._
_Run automatique de la routine "Claude synergies" (trigger `trig_01WrJYZhwzF1FALF2iT8Lfxi`) — fired 2026-09-29 09:11 UTC (schedule 07:10 UTC)._

## Compteurs

- **Entrées vues ce run** : 56
- **Vraiment ajoutées** (nouveaux slugs) : 15
- **Mises à jour** (bump `last_seen` sur slug existant) : 41
- **Archivées** (`status → archived`) : 0
- **Stock total en base** : 635 (avant : 620)

## Nouveautés notables

### Skills tiers émergents (7)

Vague de skills marketplace mise en avant par les guides d'installation Claude Code de septembre 2026 (Firecrawl "14 Best Skills", Medium "9 Powerful Plugins", claudemarketplaces.com featured).

- `skill-grill-me` (inbound / skill, Matt Pocock) — grille l'utilisateur avant de coder pour figer scope et done-criteria (896k+ installs). Sources : [skills.sh/mattpocock/skills/grill-me](https://www.skills.sh/mattpocock/skills/grill-me), [firecrawl best-claude-code-skills](https://www.firecrawl.dev/blog/best-claude-code-skills).
- `skill-karpathy-guidelines` (inbound / skill, multica-ai) — encode 4 principes anti-échec LLM à la Karpathy ; distinct de `karpathy-claude-md` (write-up statique). Source : [skills.sh/multica-ai/andrej-karpathy-skills](https://skills.sh/multica-ai/andrej-karpathy-skills).
- `skill-handoff` (inbound / skill, aihero.dev) — compresse une session Claude Code en handoff markdown pour reprise par un autre agent. Source : [aihero.dev/skills-handoff](https://www.aihero.dev/skills-handoff).
- `skill-improve` (inbound / skill) — audit codebase niveau senior, plan advisory sans edit direct. Source : [claudemarketplaces.com](https://claudemarketplaces.com/).
- `skill-systematic-debugging` (inbound / skill) — méthode reproduce → isoler → hypothèse → vérifier pour bugs et tests qui échouent. Source : [claudemarketplaces.com](https://claudemarketplaces.com/).
- `skill-find-skills` (inbound / skill) — meta-skill de discovery, 3M+ installs sur les marketplaces. Source : [claudemarketplaces.com](https://claudemarketplaces.com/).
- `skill-context-mode` (inbound / skill, mksglu) — filtre le bruit shell et restore l'état de session après reset. Source : [github.com/mksglu/context-mode](https://github.com/mksglu/context-mode).

### Skills officiels et bundles vendor (3)

- `skill-webapp-testing` (inbound / skill, Anthropic) — skill officiel Playwright pour piloter une webapp locale. Source : [skills.sh/anthropics/skills/webapp-testing](https://skills.sh/anthropics/skills/webapp-testing).
- `vercel-labs-agent-skills` (inbound / skill, Vercel) — bundle web-design-guidelines + react-best-practices + composition-patterns. Source : [skills.sh/vercel-labs/agent-skills](https://skills.sh/vercel-labs/agent-skills).
- `skill-trailofbits-security` (inbound / skill, Trail of Bits) — CodeQL + Semgrep, rulesets pro. Source : [skills.sh/trailofbits/skills](https://skills.sh/trailofbits/skills).

### MCP servers vendor (3)

- `mcp-grafana` (inbound / mcp_server, Grafana Labs) — MCP officiel Grafana : dashboards, alerts, datasources. Source : [github.com/grafana/mcp-grafana](https://github.com/grafana/mcp-grafana).
- `mcp-pubmed` (inbound / mcp_server) — recherche articles PubMed via MCP. Source : [claudemarketplaces.com](https://claudemarketplaces.com/).
- `mcp-clinicaltrials` (inbound / mcp_server) — ClinicalTrials.gov via MCP (études cliniques, patient-matching). Source : [claudemarketplaces.com](https://claudemarketplaces.com/).

### Plateforme & directories (2)

- `claude-platform-playground` (outbound / other, Anthropic) — remplace Anthropic Workbench (Aug 18, 2026) ; template gallery, session viewer redesigné, Inspector panel. Source : [platform.claude.com/playground](https://platform.claude.com/playground).
- `skills-sh-marketplace` (inbound / other) — directory/package manager tiers pour skills Claude Code : agrège Anthropic, Vercel Labs, Trail of Bits, Matt Pocock, communauté. Source : [www.skills.sh](https://www.skills.sh/).

## Bumps de veille (last_seen = 2026-09-29)

41 slugs canoniques ré-affirmés après vérif via release notes plateforme (Sonnet 5.5, Opus 5.5, ant CLI v1.32, Playground, Claude Code v2.1.278+) et via les guides marketplace/skills de septembre 2026 :

SDKs officiels — `anthropic-sdk-python` (v1.0 httpx2, Aug 20), `anthropic-sdk-typescript` (v0.122.0), `anthropic-sdk-go` (v1.68.0), `anthropic-sdk-java` (v2.59.0), `anthropic-sdk-csharp` (v12.44.0), `anthropic-sdk-ruby` (v1.67.0), `anthropic-sdk-php`.

Agent SDK — `claude-agent-sdk-python`, `claude-agent-sdk-typescript`, `claude-agent-sdk-go`.

IDE/CLI — `claude-code-cli` (v2.1.278+ AGENTS.md, auto-mode classifier), `claude-code-vscode`, `claude-code-jetbrains`, `cursor-editor`, `zed-editor` (ACP), `continue-dev`, `aider-cli`, `windsurf-editor`, `cline`, `claudecode-nvim`.

Frameworks — `vercel-ai-sdk-6` (harness adapters), `langchain-claude`, `llamaindex-claude`, `crewai-claude`, `pydantic-ai`, `mastra`, `goose` (Block).

MCP servers canoniques — `context7-mcp` (Upstash), `mcp-supabase` (utilisé par cette routine), `mcp-github`, `mcp-notion`, `mcp-linear`, `mcp-atlassian` (Teamwork Graph, launch partner Sept 2026), `mcp-postgres`, `mcp-playwright` (Microsoft), `mcp-figma`, `firecrawl-mcp`, `exa-mcp`, `mcp-sentry`.

Protocole & registry — `agent-client-protocol` (Zed), `mcp-registry-official-anthropic` (preview → production Sept 2026).

## Archivages

Aucun. Requête `WHERE status='active' AND last_seen < CURRENT_DATE - 90 days` → 0 lignes. Les 31 entrées entre 60 et 90 jours (le tampon des runs précédents) sont toujours actives selon leurs sources canoniques ; elles resteront candidates au prochain run si non touchées.

## Contexte plateforme (non-catalogués)

Éléments release-notes plateforme observés ce run mais qui ne sont pas des "tools qui se pluggent" au sens de la table (donc laissés hors catalogue) :

- **Claude Sonnet 5.5** (2026-09-28) — modèle nouveau, +30% vitesse / -30% coût vs Sonnet 5. Modèle, pas outil. Déjà présent en base : `claude-sonnet-5` (bumper au prochain run).
- **Mid-conversation inline tools** (beta `inline-tools-2026-09-15`, 2026-09-22) — feature Messages API, pas un tool.
- **Compaction on demand** (beta `compact-2026-09-04`, 2026-09-14) — feature API.
- **Permission policies `auto` mode** (Managed Agents, 2026-09-10) — feature agents.
- **Session budgets** (Managed Agents, 2026-08-07) — feature agents.
- **Data residency `inference_geo`** (2026-08-07) — feature agents.
- **Browser Use tool** (`browser_toolset_20260801`, out of beta 2026-08-19) — déjà en base sous `browser-use-harness` (bumper au prochain run).
- **Computer Use tool** (`computer_toolset_20260801`, out of beta 2026-08-19) — feature API, pas un outil third-party à cataloguer.
- **Files API out of beta** (2026-08-19) — déjà tracé via `anthropic-files-api`.
- **AGENTS.md support** dans Claude Code v2.1.277 (2026-09-18) — spec déjà en base sous `agents-md-spec`.

## Points non couverts

- **README de `punkpeye/awesome-mcp-servers`** : WebFetch renvoie la métadonnée du repo sans le README (comme au run précédent). Le pointeur `awesome-mcp-servers-punkpeye` reste à confiance sur son activité.
- **Repo `anthropics/claude-plugins-official/plugins/`** : bloqué par robots.txt sur le WebFetch de `/tree/main/plugins`. Les plugins officiels connus (`plugin-frontend-design`, `plugin-code-review`, `plugin-create`, `plugin-feature-dev`, `plugin-connect-apps`, `plugin-42crunch`, `plugin-coderabbit`, `plugin-gitlab-official`, `security-guidance-plugin`, `pr-review-toolkit`) sont déjà en base — pas de nouvel item détecté ce run côté officiel.
- **r/ClaudeAI top du mois** : le search n'a pas surfacé de tool tiers émergent qui passe les seuils qualité (≥100 stars, activité 6 mois) et qui ne soit pas déjà en base.
- **Skills.sh directory** : ajouté cette run (`skills-sh-marketplace`). Prochain run devrait parcourir son API/listing pour cataloguer davantage de skills auteur-par-auteur.
- **Firecrawl Developer Index** (mentionné par firecrawl.dev/blog) et **Remotion Best Practices** : le premier chevauche `firecrawl-mcp` (déjà bumpé), le second chevauche `remotion-skill` (déjà en base). Non redoublés.
- **Modèles nouveaux (Sonnet 5.5, Opus 5.5)** : hors périmètre "tools" mais à surveiller. La table `claude_ecosystem` catalogue les outils qui se pluggent, pas les modèles eux-mêmes ; les modèles vivent naturellement en base pour référence historique (`claude-opus-5-5`, `claude-fable-5-1`, etc.) mais on ne les traite pas comme des additions du run.
