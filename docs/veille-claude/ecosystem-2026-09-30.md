# Veille écosystème Claude — 2026-09-30

## Métriques du run

- **Entrées vues aujourd'hui** : 45
- **Nouvelles entrées** : 8
- **Entrées mises à jour** (bump `last_seen`) : 37
- **Entrées archivées** : 0
- **Total catalogue actif** : 643 (avant : 635)
- **Items > 90 jours (`stale`)** : 0

Catalogue déjà très étoffé (635 entrées avant ce run, la plupart vues dans les 30 derniers jours). Le focus a été mis sur les sorties de la dernière semaine (22-29 septembre 2026).

## Nouveautés notables

### Modèle
- **claude-sonnet-5-5** *(outbound, agent_runtime, Anthropic)* — Sortie le 28 sept, ~30% plus rapide que Sonnet 5, pricing inchangé ($2/$10 par million tokens). Disponible sur Claude API, Bedrock, GCP, Microsoft Foundry. Pourrait challenger Gemini Flash-Lite sur le pipeline volume de la veille IA — à comparer côté coût.

### Plateforme Anthropic
- **claude-plugin-directory-portal** *(both, other, Anthropic)* — Portail lancé le 25 sept pour soumettre plugins et connecteurs MCP au directory officiel. Auto-validation, safety scanning, analytics. Voie officielle si un skill Jarvis stable veut être publié.
- **claude-inline-tools** *(outbound, other, Anthropic, beta)* — API du 22 sept permettant de définir des tools au milieu d'une conversation (tool_addition blocks). Pourrait servir aux observers Jarvis pour injecter dynamiquement des tools contextuels.

### Serveurs MCP tiers
- **mcp-elementor** *(inbound, mcp_server, Elementor)* — Elementor WordPress transformé en serveur MCP (500+ tools). Beta ouverte pour Claude, Codex, Cursor. Peu pertinent Jarvis (pas de WordPress).
- **mcp-tradingview** *(inbound, mcp_server, TradingView)* — Serveur MCP officiel TradingView (beta paid plans). Charts, market data, analyses techniques. Benchmark utile pour un futur MCP finance.
- **mcp-canvas-lms** *(inbound, mcp_server, communauté)* — Canvas LMS avec ~102 tools et 8 agent skills. Patron intéressant pour un futur MCP LMS interne Malakoff.

### Enterprise / sécurité
- **salt-claude-connect** *(outbound, connector, Salt Security)* — Sortie le 29 sept. Visibilité continue sur les serveurs MCP connectés à Claude Enterprise, cartographie la surface d'attaque agentic. Pertinent uniquement si Malakoff adopte Claude Enterprise.

### Marketplace
- **augmentclaude-marketplace** *(both, other)* — Marketplace annoncée à 800+ skills gratuits. Source de veille pour inspirer les skills Jarvis (docs, RAG, veille).

## Archivage

Aucun item n'a franchi le seuil de 90 jours sans revue — le catalogue tourne rapidement. Aucun archivage ce run.

## Angles non couverts

- **r/ClaudeAI top du mois** : pas ouvert en direct (nécessite un scraping ciblé, la web search de Reddit est bruitée). Prochain run à envisager avec `apify-reddit-mcp` si les indices confirment l'utilité.
- **GHLists/new-mcp-servers** : parcouru mais la majorité des 20 serveurs récents listés sont des projets solo à <100 stars ou niche (finance perso, fashion) — filtre qualité appliqué.
- **Anthropic Cookbook** : pas de nouveauté notable détectée par rapport aux entrées existantes du catalogue.
- **Claude Code releases 2.1.282→2.1.285** : traitées comme itérations du même produit (`claude-code-cli`, `claude-code-desktop`, `claude-code-vscode` déjà catalogués, `last_seen` bumpé).

## Cibles pour le prochain run

- Vérifier apparition d'un `claude-fable-5-2` ou `claude-mythos-5-2` post Sonnet 5.5.
- Guetter les nouveaux MCP finance / audit qui feraient écho à un usage RTE (Jira, Confluence Cloud, Miro déjà catalogués — mais Miro seulement au niveau `mcp-miro`, sans skill dédiée).
- Chercher activement des skills Anthropic officielles autour de la conformité ou du reporting SAFe qui n'existent pas encore côté catalogue.
