# Veille écosystème Claude — 2026-09-24

## Chiffres du run

- **Entrées vues** : 67 (62 bumps + 5 vraiment nouvelles)
- **Ajoutées** : 5
- **Mises à jour (bump `last_seen`)** : 62
- **Archivées** : 0 (les 2 items dormants >90j ont été re-vérifiés vivants et bumpés)
- **Total table `claude_ecosystem`** après run : 592 (contre 587 au démarrage)

## Nouveautés notables

### `claude-opus-5-5` — outbound / other
Nouveau modèle Anthropic lancé le 22 septembre 2026. Premier de la famille Claude 5.5. Performance au niveau de Fable 5.1, 40% moins cher qu'Opus 5, sortie 30% plus rapide. Prix input/output 4/20 $/MTok. Dispo sur API Claude, Bedrock, Vertex AI, Foundry. Candidat direct pour remplacer Haiku 4.5 dans `weekly_analysis.py` si besoin de plus de finesse d'analyse.

### `anthropic-launch-your-agent` — inbound / skill
Skill Claude Code officielle qui guide un fondateur de zéro jusqu'à un Claude Managed Agent live et noté, dans une seule session (interview → scope → deploy → grade → schedule). Cloner `github.com/anthropics/launch-your-agent`, puis `/launch-your-agent` dans Claude Code. Utile pour prototyper des agents métier RTE (recap PI, digest engagements) sans dev sur mesure.

### `messages-api-compaction` — outbound / other
Beta `compact-2026-09-04` de la Messages API (annoncée mi-septembre) : compaction on-demand d'une conversation via un bloc signé qui remplace l'historique. Choix du moment de compaction, exécution en background possible, derniers tours conservés mot pour mot avec leur thinking préservé. À brancher dans Jarvis local si les prompts longs font exploser le `CostTracker`.

### `claude-managed-agents-auto-permissions` — inbound / agent_runtime
Nouveau mode de permission `auto` pour Claude Managed Agents (10 septembre 2026) : le serveur évalue chaque appel d'outil / MCP puis l'exécute, le refuse ou le met en pause pour validation humaine. Intermédiaire entre `always_allow` et `always_ask`. Les events `agent.tool_use` et `agent.mcp_tool_use` reportent maintenant un champ `evaluation`. Modèle de gouvernance intéressant pour un agent d'assistance RTE qui manipulerait Jira Malakoff.

### `notion-mcp-2-5` — inbound / mcp_server
Serveur MCP officiel Notion (`makenotion/notion-mcp-server`), 4 500+ stars, 22 outils, npm v2.5.1 (juillet 2026). Requiert Notion API version 2026-03-11. Notion 3.5 apporte 91 % d'efficacité token, Meeting Notes + block comments dans MCP, PAT et External Agents API alpha. Pas d'usage direct Jarvis aujourd'hui (pas de Notion dans le stack) mais utile si carnet d'idées / wiki migrent vers Notion plus tard.

## Archivages

Aucun. Les deux items >90 jours (`databricks-genie-mcp` last_seen 2026-06-24, `awesome-claude-code-hesreallyhim` last_seen 2026-06-24) ont été re-vérifiés côté web :

- **`databricks-genie-mcp`** : repo `alexxx-db/databricks-genie-mcp` toujours vivant, expose l'API Databricks Genie comme outils MCP. `last_seen` reseté.
- **`awesome-claude-code-hesreallyhim`** : repo `hesreallyhim/awesome-claude-code` actif, dernière MAJ août 2026. `last_seen` reseté.

## Ce qui n'a pas pu être couvert

- **r/ClaudeAI top du mois** : pas de source structurée récupérable côté web search en une passe, échantillon trop bruité pour un catalogue stable. À faire manuellement.
- **Marketplace Cowork exhaustif** : la Claude Marketplace annonce 2 000+ plugins/connecteurs au lancement du 23 septembre 2026 — impossible d'énumérer tout sans un scrape dédié. Les gros connecteurs déjà en base ont été bumpés (Atlassian, Notion, Linear, Slack) ; le reste attend un run dédié.
- **Google Cloud Next 2026 (déjà `google-cloud-next-2026` en base)** : les annonces Vertex AI × Claude Opus 5.5 datent du 22 septembre 2026 mais n'ont pas généré de nouveaux slugs distincts, le modèle 5.5 est déjà couvert par `claude-opus-5-5`.
- **Skills SAP / Salesforce** : `sap-business-ai-platform-claude` et `salesforce-in-claude-plugin` déjà en base, pas de nouveauté isolable ce mois-ci.

## Notes pour le prochain run

- Regarder la sortie annoncée de Sonnet 5.5 et Haiku 5.5 « dans les semaines » qui suivent Opus 5.5 → nouveaux slugs `claude-sonnet-5-5`, `claude-haiku-5-5` probables.
- Vérifier si la Claude Marketplace expose un endpoint JSON parsable pour un inventaire de masse ; sinon un run manuel ciblé « nouveautés du mois » suffit.
- L'écosystème MCP dépasse maintenant 950 serveurs listés côté Claude et 10 000+ en production ; les prochains ajouts doivent rester sélectifs (partenaires officiels, hits >1k stars, ou usage clair pour Jarvis).
