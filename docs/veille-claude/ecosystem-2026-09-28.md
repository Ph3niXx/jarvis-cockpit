# Veille écosystème Claude — 2026-09-28

_Table Supabase `claude_ecosystem` (projet `jarvis-cockpit`)._
_Run automatique de la routine "Claude synergies" (trigger `trig_01WrJYZhwzF1FALF2iT8Lfxi`) — fired 2026-09-28 07:20 UTC._

## Compteurs

- **Entrées vues ce run** : 80
- **Vraiment ajoutées** (nouveaux slugs) : 25
- **Mises à jour** (bump `last_seen` sur slug existant) : 55
- **Archivées** (`status → archived`) : 0
- **Stock total en base** : 620 (avant : 595)

## Nouveautés notables

### Plugins Cowork officiels Anthropic (annoncés le 2026-09-23)
Blog source : [cowork-plugins-across-enterprise](https://claude.com/blog/cowork-plugins-across-enterprise).

- `cowork-plugin-hr` (inbound / cowork_plugin) — RH end-to-end (offres, revues, cycle employé).
- `cowork-plugin-design` (inbound / cowork_plugin) — critique frameworks + audits accessibilité.
- `cowork-plugin-engineering` (inbound / cowork_plugin) — standup summaries, incident response, code reviews.
- `cowork-plugin-operations` (inbound / cowork_plugin) — process, vendors, runbooks.
- `cowork-plugin-brand-voice` (inbound / cowork_plugin) — Tribe AI, distille la voix de marque.
- `cowork-plugin-financial-analysis` (inbound / cowork_plugin) — market research + modeling.
- `cowork-plugin-investment-banking` (inbound / cowork_plugin) — deal workflows IB.
- `cowork-plugin-equity-research` (inbound / cowork_plugin) — parse d'earnings + notes.
- `cowork-plugin-private-equity` (inbound / cowork_plugin) — sourcing + DD.
- `cowork-plugin-wealth-management` (inbound / cowork_plugin) — portefeuille + rebalancing.

### Marketplace Claude — nouveaux produits & partenaires (2026-09-23)
Blog source : [claude-marketplace](https://claude.com/blog/claude-marketplace).

- `legora-legal-ai` (both / other) — legal operations aOS.
- `hebbia-financial-agent` (both / other) — reasoning engine investissement.
- `lovable-app-builder` (outbound / other) — générateur fullstack via prompts.
- `thoughtspot-analytics-agent` (both / other) — analytics + NLQ sur data warehouses.
- `crowdstrike-falcon-claude` (both / other) — AI-native security.
- `bcg-claude-service-partner` (outbound / other) — consulting integrator.
- `accenture-claude-service-partner` (outbound / other) — idem.
- `deloitte-claude-service-partner` (outbound / other) — idem.
- `power-digital-service-partner` (outbound / other) — services digitaux/marketing.

### Plateforme & connecteurs

- `anthropic-compliance-api-cowork` (outbound / other) — extension Compliance API à Cowork & Claude Code. Blog : [compliance-api-cowork-and-claude-code](https://claude.com/blog/compliance-api-cowork-and-claude-code).
- `claude-tag-personal-connectors` (both / connector) — Claude Tag Slack laisse invoquer les connecteurs perso dans un canal (2026-09-24). Blog : [claude-tag-now-supports-personal-connectors-in-channels](https://claude.com/blog/claude-tag-now-supports-personal-connectors-in-channels).
- `mantle-bedrock-provider` (outbound / connector) — provider "mantle" ajouté comme upstream Bedrock dans Claude Code (whats-new v2.1.28x).

### SDK / veille

- `claude-agent-sdk-elixir-stordco` (outbound / sdk) — SDK Elixir tiers actif.
- `bighatgroup-claude-weekly` (inbound / other) — newsletter hebdo indépendante.
- `releasepad-changelog-mcp` (inbound / mcp_server) — MCP qui expose le changelog d'un SaaS à Claude.

## Bumps de veille (last_seen = 2026-09-28)

50 slugs bumpés après vérif via les sources canoniques (Anthropic release notes, Claude Code changelog, Claude marketplace, releasebot) :
`anthropic-claude-timeline`, `anthropic-releasebot`, `claude-marketplace`, `claude-tag`,
`claude-opus-5-5`, `claude-code-cli`, `claudeforce-salesforce`, `mcp-lseg`, `mcp-sp-global-kensho`,
`mcp-apollo`, `mcp-common-room`, `mcp-clay`, `mcp-outreach`, `mcp-similarweb`, `mcp-msci`,
`mcp-legalzoom`, `mcp-factset`, `mcp-wordpress`, `mcp-harvey`, `mcp-docusign`,
`mcp-google-calendar`, `mcp-google-drive`, `mcp-gmail`, `claude-for-excel`, `claude-for-powerpoint`,
`claude-plugin-eval`, `claude-code-desktop`, `claude-code-skill-doctor`, `claude-fable-5-1`,
`agents-md-spec`, `claude-plugins-official`, `claude-plugins-community`,
`awesome-mcp-servers-punkpeye`, `buildwithclaude-marketplace`, `mcp-registry-official`,
`claude-security`, `security-guidance-plugin`, `everything-claude-code`, `anthropic-skills-repo`,
`best-of-mcp-servers-tolkonepiu`, `appcypher-awesome-mcp-servers`, `wong2-awesome-mcp-servers`,
`claude-cookbooks`, `anthropic-sdk-python`, `anthropic-sdk-typescript`, `claude-agent-sdk-python`,
`claude-agent-sdk-typescript`, `anthropic-sdk-go`, `anthropic-sdk-java`, `anthropic-sdk-ruby`.

## Archivages

Aucun. Les 5 entrées avec `last_seen < CURRENT_DATE - 90 days` (`mcp-ableton`, `mcp-autodesk-fusion`, `mcp-splice`, `mcp-adobe`, `claude-code-toolbox-jetbrains`) restent actives : les domaines correspondants ont toujours de multiples repos maintenus côté GitHub (vérif via WebSearch). `last_seen` bumpé à 2026-09-28 pour reset le compteur.

## Points non couverts

- Impossible de lister exhaustivement les commits récents de `github.com/punkpeye/awesome-mcp-servers` sans clone : WebFetch renvoie la métadonnée du repo sans le README. Les grands directories (`punkpeye`, `wong2`, `appcypher`, `tolkonepiu`) restent bumpés en confiance sur leur activité connue.
- r/ClaudeAI top-mois : recherche pas conclusive sur des tools tiers vraiment nouveaux dépassant les seuils qualité (≥100 stars, activité 6 mois) qui ne soient pas déjà en base.
- SDK Rust / .NET / Elixir : plusieurs alternatives existent (nshkrdotcom, guess, louloulin) mais elles doublonnent avec `claude-sdk-rust`, `gunpal-claude-agent-sdk-dotnet` déjà en base ; seul `stordco` (Elixir) a été retenu comme le plus mainstream.
- Aucun accès aux repos privés Anthropic (releases fermées) — la couverture se limite au public.

## Sources consultées

- [Claude Marketplace (blog Anthropic)](https://claude.com/blog/claude-marketplace)
- [Cowork plugins across enterprise (blog Anthropic)](https://claude.com/blog/cowork-plugins-across-enterprise)
- [Claude Tag personal connectors (blog Anthropic)](https://claude.com/blog/claude-tag-now-supports-personal-connectors-in-channels)
- [Compliance API coverage (blog Anthropic)](https://claude.com/blog/compliance-api-cowork-and-claude-code)
- [Anthropic release notes Sept 2026 (Releasebot)](https://releasebot.io/updates/anthropic)
- [Claude Code weekly digests](https://code.claude.com/docs/en/whats-new)
- [anthropics/skills GitHub](https://github.com/anthropics/skills)
- [punkpeye/awesome-mcp-servers GitHub](https://github.com/punkpeye/awesome-mcp-servers)
- [Big Hat Group — Claude Weekly 2026-09-21](https://www.bighatgroup.com/blog/claude-weekly-2026-09-21/)
- [ReleasePad MCP server](https://www.releasepad.io/features/mcp-server/)
- [stordco/claude-agent-sdk-elixir GitHub](https://github.com/stordco/claude-agent-sdk-elixir)
