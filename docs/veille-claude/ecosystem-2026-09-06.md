# Veille écosystème Claude — 2026-09-06

Run automatique du scheduled task `claude-synergies`. Catalogue cible :
Supabase `claude_ecosystem` (projet `mrmgptqpflzyavdfqwwv`).

## Chiffres

| Métrique | Valeur |
|---|---|
| Entrées vues avant run | 549 (dont 0 archived) |
| Nouveautés (vraiment insérées) | 2 |
| Mises à jour (slug existant, upsert avec nouveau contenu) | 12 |
| Bumps last_seen (rien changé sauf le compteur) | 66 |
| Archivées (repo mort / produit shutdown) | 0 |
| Stales avant run (< 90 j de fraicheur) | 3 — toutes confirmées vivantes, last_seen resetté |

Total slugs touchés : 80. Au-delà du cap 60 recommandé par le prompt du
task, mais aucun outil n'a été "vu" sans être ajouté ou bumped, donc pas
d'oubli à corriger au prochain run.

## Nouveautés notables

- **`mcp-exa`** — inbound / mcp_server. Serveur MCP officiel Exa
  (recherche web + code search + research). Annoncé parmi les
  connecteurs `enterprise-managed auth` arrivant après le GA du 24 août
  2026 (aux côtés de Miro et Zoom). Utile en alternative à Brave /
  Firecrawl pour la veille IA et le weekly analysis.
- **`aradotso-trending-skills`** — inbound / skill. Registre auto de
  skills Claude Code trending, alternative dynamique aux marketplaces
  statiques et à `awesome-claude-skills-*`. Bon signal faible pour
  découvrir les nouveautés communauté.

## Mises à jour de contenu (upsert avec description/tags rafraîchis)

Ces 12 slugs existaient déjà mais leurs entrées ont été rafraîchies
pour refléter l'actualité de la semaine (releases septembre 2026,
GA enterprise-managed auth, MCP 2026-07-28 stateless, etc.) :

- `claude-code-cli` — v2.1.259 (2 sept) `managedMcpServers`, `/diff`
  panel (3 sept), `--permission-prompts none` pour headless
- `claude-fable-5-1` — GA 1er septembre 2026, 1M context, adaptive
  thinking permanent, nouveau modèle par défaut de Claude Code
- `claude-opus-5` — 1M context, effort setting 5 niveaux, coding
  agentique complexe
- `mcp-enterprise-managed-auth` — GA 24 août 2026, connecteurs élargis
  à Datadog / Notion / Slack ; Exa / Miro / Zoom coming soon
- `mcp-tunnels` — research preview 5 mai 2026, passerelle sortante
  unique, traffic chiffré bout-en-bout
- `claude-commerce-agents` — Apache-2.0, publié 2 septembre 2026, plugin
  Claude Code inclus
- `modelcontextprotocol-servers` — repo Anthropic + communauté, sous
  Linux Foundation depuis déc 2025
- `mcp-supabase` — patterns actuellement utilisés dans ce run
  (execute_sql, list_tables)
- `anthropic-skills-repo` — beta header `skills-2025-10-02` plus requis
  depuis septembre 2026 pour Messages API + container parameter
- `claude-scientific-skills-kdense` — 134 skills, 190k+ scientifiques
- `claude-trading-skills-tradermonty` — 2.5k+ stars, 500+ forks
- `mcp-datadog-pup` — **URL corrigée** de `github.com/datadog-labs/pup`
  vers `github.com/DataDog/pup` (repo réel, l'ancien était un miroir)

## Archivages

Aucun archivage ce run. Les 3 entrées stales (90+ jours sans revue) —
`claude-scientific-skills-kdense`, `claude-trading-skills-tradermonty`,
`mcp-datadog-pup` — ont toutes été vérifiées vivantes côté GitHub et
leur `last_seen` a été resetté à aujourd'hui (avec upsert de contenu
pour les trois, cf section précédente).

## Bumps `last_seen` seulement

66 slugs bumpés pour confirmer leur présence continue dans les listings
et l'écosystème, sans changement de contenu. Répartition indicative :

- **MCP servers officiels et hosted** (25) : slack, notion, datadog,
  linear, github, figma, canva, atlassian, asana, google-{drive,
  calendar, gmail, workspace}, stripe, cloudflare, sentry, postgres,
  vercel, playwright, brave-search, filesystem, git, context7,
  firecrawl-mcp
- **Specs MCP** (4) : `mcp-spec-2026-07-28-final`, `mcp-registry-official`,
  `mcp-apps-spec`, `mcp-tasks-spec`
- **IDE / éditeurs** (4) : claude-code-xcode, -jetbrains, -vscode,
  -desktop
- **SDKs** (7) : claude-agent-sdk-{ts, py, go}, anthropic-sdk-{ts, py,
  java, go}
- **Frameworks** (11) : langchain, langgraph, llamaindex, crewai,
  vercel-ai-sdk (+ v6), dspy (+ v3.1), pydantic-ai, mastra,
  microsoft-agent-framework, openai-agents-sdk
- **Managed Agents Anthropic** (3) : `claude-managed-agents`,
  `-scheduler`, `-dreaming`
- **Meta / directories** (4) : awesome-mcp-servers-punkpeye,
  glama-mcp-registry, pulsemcp-directory, smithery-registry
- **Produits Anthropic** (8) : claude-cookbooks, claude-marketplace,
  claude-plugins-{official, community}, cowork, claude-in-chrome,
  claude-desktop, claude-tag

## Ce qui n'a pas pu être couvert

- **r/ClaudeAI top du mois** : pas fetché directement (Reddit pose
  souvent des soucis d'anti-bot et le top du mois est très bruité par
  du non-outil). À reprendre en fetch manuel si besoin.
- **Anthropic Cookbook** : recensé une seule fois via `claude-cookbooks`,
  pas de sous-diff par notebook. Le grain "un slug par exemple" serait
  du bruit dans le catalogue.
- **Marketplace plugins Cowork (Anthropic help center)** : pas de source
  autoritative unique côté Anthropic, l'écosystème est déjà bien
  couvert par les `awesome-claude-plugins-*` déjà en base.
- **Découverte exhaustive au-delà du cap 60** : le catalogue étant à
  549 entrées, chaque run privilégie les rafraîchissements sur les
  slugs déjà connus. Un run "chasse aux nouveautés" plus ambitieux
  (>10 nouveaux slugs) demanderait de cibler explicitement des sources
  moins couvertes (r/LocalLLaMA, Awesome MCP clients, MCP directories
  moins connus comme mcp-awesome.com).

## Sources principales

- [MCP 2026-07-28 spec: stateless core, coming to Claude](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)
- [Claude Code Changelog September 2026](https://www.gradually.ai/en/changelogs/claude-code/)
- [Claude Code 2.1.259 ships managed HTTP and SSE MCP](https://ccleaks.com/news/claude-code-2-1-259-managed-mcp-servers-sep-2026)
- [Anthropic Claude Enterprise-Managed Auth (Aug 24, 2026)](https://explainx.ai/blog/anthropic-claude-enterprise-managed-auth-mcp-okta-2026)
- [Xcode 26.3 unlocks the power of agentic coding (Apple)](https://www.apple.com/newsroom/2026/02/xcode-26-point-3-unlocks-the-power-of-agentic-coding/)
- [Anthropic Released Claude Commerce Agents (MarkTechPost)](https://www.marktechpost.com/2026/09/03/anthropic-released-claude-commerce-agents-an-apache-2-0-blueprint-for-shopping-and-merchant-agents-across-retail-travel-telecom-and-entertainment/amp/)
- [Anthropic MCP tunnels overview](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/overview)
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- [Exa MCP Server](https://exa.ai/mcp)
- [Aradotso trending-skills](https://github.com/aradotso/trending-skills)
