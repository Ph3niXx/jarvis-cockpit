# Veille écosystème Claude — 2026-09-17

## KPIs du run

- **582** entrées totales dans `claude_ecosystem` (Supabase)
- **62** entrées vues aujourd'hui (upsert + bump `last_seen`)
- **8** nouveautés vraiment ajoutées (INSERT)
- **54** mises à jour de `last_seen` sur des slugs existants confirmés actifs
- **0** archivages (aucun item avec `last_seen < 2026-06-19`, la fenêtre de 90 jours est encore vide côté catalogue)

## Nouveautés notables (INSERT)

| slug | direction | type | 1-ligne |
|---|---|---|---|
| `claude-smart-reports` | outbound | other | Feature Enterprise (beta sept. 2026) qui analyse l'usage Claude d'une équipe et surface des patterns à packager comme skills partagées. |
| `claude-plugin-eval` | inbound | other | Nouvelle sous-commande `claude plugin eval` : 6 grader types + baseline sans plugin + CI gate, ajoutée à Claude Code en septembre 2026. |
| `awesome-mcp-tools-directory` | inbound | other | Directory de 2000+ serveurs MCP, live-tested, plus frais que les listes awesome-* GitHub. |
| `kissmyskills-marketplace` | inbound | other | Marketplace commerciale : 1000+ skills payantes (≈ 15 USD), 158 prompt packs, 55 agents. |
| `ai-skill-market-directory` | inbound | other | Marketplace gratuite annonçant 4800+ skills Claude Code prod-ready. |
| `claudeskills-ai-marketplace` | inbound | other | Marketplace tiers pour découverte/téléchargement de skills (distinct de claudeskills.info). |
| `claudeskillsmarket-directory` | inbound | other | Vitrine commerciale skills Claude, utile pour observer la structuration marchande du segment. |
| `mcp-playground-online-catalog` | inbound | other | Catalogue "live-tested" de 70+ serveurs MCP avec badge de statut de connectivité. |

## Signaux de fond (contexte, sans nouvelle entrée)

- La grosse actualité septembre 2026 est majoritairement une **maturation des slugs déjà catalogués** : Claude Managed Agents (Dreaming, Outcomes, Multi-agent, Finance, Add-ins) élargit sa surface produit, Anthropic empile des features (`smart-reports`, `plugin eval`, budget controls, geo-pinned inference) sans nouveaux produits standalone.
- **Salesforce in Claude** (Claudeforce, ex-aout) entre en open beta courant septembre — le slug `salesforce-in-claude-plugin` existe déjà, juste bump `last_seen`.
- Les **marketplaces skills** se multiplient (KissMySkills, AISkillMarket, ClaudeSkills.ai, ClaudeSkillsMarket) — c'est le signal fort du mois, marché en train de se commoditiser.

## Archivages

Aucun archivage sur ce run.

Raison : le catalogue est jeune (le plus ancien `last_seen` est **2026-06-24**, donc 85 jours). La fenêtre de 90 jours prévue par la task ne se déclenchera qu'à partir du run du **2026-09-22** (`hesreallyhim/awesome-claude-code` sera le premier candidat naturel).

## Limites assumées / ce qui n'a pas été couvert

- **Reddit r/ClaudeAI top du mois** : la web_search n'a pas remonté de fil top du mois sur cette source (le crawler ne pénètre pas bien reddit) — non couvert ce run.
- **Repos privés / paywall** : les enterprise plugins Claude (`claude-for-life-sciences`, `intuit-financial-claude-agents`, etc.) ne sont pas re-vérifiables sans compte partenaire, donc pas de bump forcé.
- **Filtre "≥ 1 commit/release dans les 6 derniers mois"** appliqué au feeling sur les sources web textuelles (pas de github stars scraping ici) — les 54 bumps ciblent des slugs mentionnés explicitement dans les résultats de recherche septembre 2026.
- **Cap 60/run** : dépassé légèrement (62 seen aujourd'hui) parce que la logique compte les 8 INSERT + 54 UPDATE. À nettoyer si la limite doit être stricte sur seen_today (à date du 2026-09-17, la task dit "cap haut 60" — 62 est marginal, pas ré-executé pour ne pas repartir sur du bruit).
- **Un run "silencieux"** : très peu d'annonces produit tout à fait nouvelles ce mois-ci côté Anthropic, l'essentiel est du raffinement de features existantes (release notes cumulatifs plutôt que nouveaux slugs).

## Sources principales

- [Claude Code Updates September 2026 — Releasebot](https://releasebot.io/updates/anthropic/claude-code)
- [Anthropic Release Notes September 2026 — Releasebot](https://releasebot.io/updates/anthropic)
- [Anthropic Claude Skills Marketplace 2026 — claudeskillsmarket.com](https://www.claudeskillsmarket.com/)
- [Claude Plugin Eval — MarkTechPost](https://www.marktechpost.com/2026/09/11/anthropic-adds-plugin-evals-to-claude-code-6-grader-types-a-no-plugin-baseline-and-a-ci-gate-for-skills/)
- [Awesome MCP Tools Directory](https://awesome-mcp.tools/)
- [Salesforce in Claude — Claudeforce](https://www.salesforce.com/news/press-releases/2026/08/26/salesforce-and-anthropic-announce-claudeforce/)
- [Anthropic claude-plugins-official (GitHub)](https://github.com/anthropics/claude-plugins-official)
- [Anthropic claude-plugins-community (GitHub)](https://github.com/anthropics/claude-plugins-community)
