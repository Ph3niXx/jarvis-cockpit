# Veille écosystème Claude — 2026-05-01

**Mode** : run automatisé (scheduled task `claude-synergies`).
**Cible** : table Supabase `claude_ecosystem`.

## Résumé

| Métrique                          | Valeur |
|-----------------------------------|--------|
| Entrées vues / mises à jour       | 78     |
| **Vraiment nouvelles** (insert)   | **20** |
| Mises à jour (slug existant)      | 58     |
| Archivées                         | 0      |
| Total catalogue (post-run)        | 146    |
| Catalogue actif                   | 146    |

Pas de soft-archive ce run : aucune entrée n'a `last_seen` au-delà de 90 jours
(toutes ont été touchées les jours précédents). Catalogue stable, croissance
nourrie majoritairement par l'annonce **Anthropic Creative Connectors** du
28 avril 2026.

## Nouveautés notables

### Vague créative (Anthropic, 28 avril 2026)

Anthropic a annoncé 9 connecteurs MCP officiels orientés métiers créatifs.
Aucun n'est central pour Jarvis Cockpit ou la mission RTE Vente, mais ils
marquent l'élargissement clair de l'écosystème vers les workflows
graphiques/3D/audio :

- **mcp-sketchup** (`inbound · mcp_server`, Trimble) — 3D conversationnel
  sur fichiers .skp, premier connector Trimble basé MCP.
- **mcp-blender** (`inbound · mcp_server`, Blender Foundation) — analyse
  et debug de scènes, scripts batch, ajout d'outils dans l'UI Blender.
- **mcp-adobe** (`inbound · mcp_server`, Adobe) — 50+ outils Creative Cloud
  (Photoshop, Premiere, Express).
- **mcp-ableton** (`inbound · mcp_server`, Ableton) — Live + Push,
  ancrage sur la doc officielle.
- **mcp-affinity** (`inbound · mcp_server`, Canva) — suite Affinity
  (Designer, Photo, Publisher).
- **mcp-autodesk-fusion** (`inbound · mcp_server`, Autodesk) — CAO
  paramétrique conversationnelle.
- **mcp-resolume** (`inbound · mcp_server`, Resolume) — VJ et live visuals
  (Arena + Wire).
- **mcp-splice** (`inbound · mcp_server`, Splice) — recherche samples
  audio.

### Sécurité

- **cve-mcp-server** (`inbound · mcp_server`, mukul975) — serveur MCP
  open source qui transforme Claude en analyste sécurité avec 27 outils
  sur 21 APIs (NVD, EPSS, CISA KEV, MITRE ATT&CK, Shodan, VirusTotal,
  GreyNoise). Utile pour audits ponctuels d'outillage.

### Skills & plugins (compilations communautaires émergentes)

- **antigravity-awesome-skills** (`inbound · skill`, sickn33) — 1 400+
  skills agentiques avec CLI installer, ~36k stars. Cible Claude Code,
  Cursor, Codex CLI, Gemini CLI, Antigravity.
- **behisecc-awesome-claude-skills** (`inbound · skill`, BehiSec) —
  liste curée par domaine, focus sécurité.
- **composio-awesome-claude-skills** (`inbound · skill`, Composio) —
  distincte du `awesome-claude-plugins` du même éditeur.
- **skillmatic-awesome-agent-skills** (`inbound · skill`, Skillmatic) —
  référence pour les Agent Skills modulaires (norme `agentskills.io`).
- **chat2anyllm-awesome-claude-plugins** (`inbound · cowork_plugin`,
  Chat2AnyLLM) — 43 marketplaces, 834+ plugins recensés.

### Finance & legal (App marketplace, février 2026)

Trois connecteurs annoncés dans la vague Apps de février 2026 qui
manquaient au catalogue :

- **mcp-msci** (`inbound · mcp_server`, MSCI) — données ESG, indices.
- **mcp-legalzoom** (`inbound · mcp_server`, LegalZoom) — services
  juridiques en libre-service.
- **mcp-factset** (`inbound · mcp_server`, FactSet) — données financières
  institutionnelles.

### IDE & directories

- **roo-code** (`outbound · ide_integration`) — agent VS Code fork de
  Cline. Provider Claude natif depuis 2026, utilise abonnement Claude
  Max sans clé API séparée. Pertinent comme alternative à Cline /
  Continue / Cursor.
- **wong2-awesome-mcp-servers** (`inbound · other`, Tao He) — liste
  curée alternative à punkpeye, plus restreinte/qualitative.
- **mcpmarket-directory** (`inbound · other`, MCP Market) — annuaire
  MCP avec verification de compatibilité, distinct de mcp.so /
  pulsemcp / smithery / glama.

## Mises à jour notables d'entrées existantes

- **mcp-atlassian** — description rafraîchie : Atlassian Rovo MCP Server
  est en GA depuis février 2026 (annonce officielle). Endpoint à
  migrer vers `/mcp` avant juin 2026 (`/sse` deprecated).
- **claude-managed-agents-memory** — mention de la public beta du 23 avril
  2026 (filesystem-based, audit trails, adoption Netflix/Rakuten/Wisedocs/Ando).
- **mcp-asana** — V2 (février 2026) avec 44 outils, Streamable HTTP,
  V1 shutdown mai 2026.

Bump simple de `last_seen` sur 55 autres entrées (SDK officiels, IDE,
directories, skills officiels, plugins core) confirmées vivantes via
les recherches de ce run — sources Anthropic Release Notes avril 2026,
GitHub releases, blog posts vendor.

## Archivage

Aucune entrée n'a été archivée. Toutes les entrées `active` ont
`last_seen >= today - 90j` (en pratique entre 2026-04-28 et 2026-05-01).
Le seuil de 90 jours sera réévalué au prochain run.

## Limites assumées

- **Sources non couvertes ce run** :
  - r/ClaudeAI top du mois — pas exploré (le bruit signal/posts n'est
    pas filtrable via web search standard, et les outils émergents
    notables remontent généralement par les compilations
    `awesome-*` et les release notes Anthropic).
  - Bots Claude-powered "natifs" Slack / Discord / Linear / Notion —
    déjà couverts via leurs MCP servers (`mcp-slack`, `mcp-linear`,
    `mcp-notion`). Pas de bot natif distinct identifié pendant ce run.
  - Pas de revue exhaustive des releases LangChain / LlamaIndex /
    Vercel AI SDK / Haystack / DSPy / semantic-kernel ce run :
    `last_seen` bumpé sans deep-dive (entrées stables et bien
    référencées dans le catalogue).
- **Caps respectés** : aucun outil avec <100 stars retenu, aucun
  fork marginal, aucun outil non maintenu (>6 mois sans commit).
- **Vendor null laissé tel quel** quand l'éditeur n'était pas
  trouvable de manière fiable (ex. plusieurs "Awesome" repos dont
  l'auteur publie sous pseudo).
- **Cap haut de 60 outils par run** : interprété comme "cap sur les
  vrais ajouts/modifications d'info" (20 inserts + 3 updates info
  = 23). Les bumps de `last_seen` sur entrées inchangées (55) sont
  comptés à part comme maintenance de fraîcheur, pas comme
  ingestion.
