# AI Cockpit — Contexte projet

## Vue d'ensemble

Cockpit IA personnel pour un manager en transformation digitale qui veut :
1. Se tenir à jour sur les évolutions IA (veille quotidienne automatisée)
2. Monter en compétence IA de manière mesurable (radar, challenges, recommandations)
3. Identifier des opportunités business (incubateur, radar d'opportunités)
4. Optimiser sa mission actuelle avec l'IA (RTE Toolbox)

## Utilisateur

- **Rôle actuel** : Release Train Engineer (RTE) du train Vente chez Malakoff Humanis (mutuelle/assurance)
- **Contexte SAFe** : pilote un train avec des équipes CRM, outils d'aide à la vente, portail d'accès
- **Background** : Manager PwC Digital
- **Ambition** : devenir expert IA, potentiellement créer sa boîte — pas encore d'idée précise
- **Profil complet** : stocké dans Supabase table `user_profile` (key/value)
- **Compétences IA** : stockées dans Supabase table `skill_radar` (8 axes avec scores, forces, lacunes)

## Architecture technique

### Stack
- **Site** : GitHub Pages (HTML/CSS/JS vanilla, un seul `index.html`)
- **Base de données** : Supabase PostgreSQL (free tier, projet `mrmgptqpflzyavdfqwwv`)
- **Pipeline quotidien** : `main.py` via GitHub Actions (cron lun-ven 6h UTC)
  - Gemini 2.5 Flash-Lite (gratuit) pour RSS + web search + brief
- **Pipeline hebdomadaire** : `weekly_analysis.py` via GitHub Actions (dimanche 22h UTC)
  - Claude Haiku 4.5 (~0.03$/run) pour wiki, signaux, recommandations, challenges, opportunités, RTE
- **Email** : Gmail SMTP notification quotidienne

### Repo structure
```
main.py                              # Pipeline quotidien Gemini
weekly_analysis.py                   # Pipeline hebdomadaire Claude
index.html                           # Site cockpit complet (vanilla JS)
requirements.txt                     # feedparser, google-generativeai, requests
.github/workflows/daily_digest.yml   # Cron quotidien
.github/workflows/weekly_analysis.yml # Cron hebdomadaire
CLAUDE.md                            # Ce fichier
```

### GitHub Secrets
```
GEMINI_API_KEY      # Google AI Studio
GMAIL_ADDRESS       # Email expéditeur
GMAIL_APP_PASSWORD  # Mot de passe d'app Gmail
RECIPIENT_EMAIL     # Email destinataire
SUPABASE_URL        # https://mrmgptqpflzyavdfqwwv.supabase.co
SUPABASE_KEY        # Publishable key (sb_publishable_...)
ANTHROPIC_API_KEY   # Claude API
```

### Base de données Supabase

Tables existantes :
- `articles` — articles RSS quotidiens (source, title, url, summary, section, fetch_date)
- `daily_briefs` — brief HTML quotidien généré par Gemini
- `wiki_concepts` — glossaire IA auto-alimenté (slug, name, category, 3 niveaux de description, mentions)
- `signal_tracking` — termes IA trackés par semaine (term, week_start, mention_count, trend)
- `skill_radar` — 8 axes de compétence (score, strengths, gaps, goals, context, history)
- `learning_recommendations` — recommandations hebdo ciblées sur les lacunes du radar
- `weekly_challenges` — mini-défis gamifiés calibrés sur le profil
- `weekly_opportunities` — use cases et opportunités business détectés dans l'actualité
- `business_ideas` — carnet d'idées incubateur (éditable depuis le front)
- `rte_usecases` — 12 use cases IA pour la mission RTE (Jira, Excel, SAFe, Confluence, Slack)
- `weekly_analysis` — logs des runs Claude (tokens, coûts, résultats)
- `user_profile` — profil personnel key/value (identité, ambitions, intérêts, notes)
- `usecase_maturity` — ancienne table de scoring statique (dépréciée, remplacée par weekly_opportunities)

RLS : toutes les tables ont SELECT + INSERT + UPDATE public via publishable key.

### Sections du cockpit (sidebar)

| Section | Source de données | Fréquence |
|---|---|---|
| Brief du jour | daily_briefs | Quotidien (Gemini) |
| Nouveautés IA | articles (section=updates) | Quotidien |
| LLMs / Agents / Énergie / FinServ / Outils / Business / Régulation / Arxiv | articles (par section) | Quotidien |
| Wiki IA | wiki_concepts | Quotidien (détection) + Hebdo (enrichissement Claude) |
| Signaux faibles | signal_tracking + weekly_analysis.signals_summary | Quotidien (comptage) + Hebdo (analyse Claude) |
| Opportunités | weekly_opportunities | Hebdomadaire (Claude) |
| Radar compétences | skill_radar | Manuel (diagnostic) + Hebdo (challenges) |
| Recommandations | learning_recommendations | Hebdomadaire (Claude) |
| Challenges | weekly_challenges | Hebdomadaire (Claude) |
| Carnet d'idées | business_ideas | Manuel (depuis le front) |
| RTE Toolbox | rte_usecases | Hebdomadaire (enrichissement Claude) |
| Mon profil | user_profile | Manuel (depuis le front) |
| Coûts API | weekly_analysis.tokens_used | Hebdomadaire (auto-loggé) |
| Recherche | articles (full-text ilike) | Temps réel |
| Historique | articles (groupé par fetch_date) | Quotidien |

## Conventions

- Le `index.html` est un fichier unique vanilla JS — pas de framework, pas de build
- La publishable key Supabase est en dur dans `index.html` (c'est une clé publique)
- Les appels Supabase côté front utilisent l'API REST directe (pas de SDK)
- Le main.py utilise Gemini Flash-Lite (gratuit, 1000 req/jour)
- Le weekly_analysis.py utilise Claude Haiku 4.5 avec un budget max de 1$/run
- Le CostTracker dans weekly_analysis.py arrête le pipeline si le budget est dépassé
- Le `user_profile` et le `skill_radar` sont injectés comme contexte dans tous les prompts Claude

## Décisions de design

- **Pas de max-width sur le contenu** — le cockpit utilise toute la largeur disponible
- **Gemini pour le volume, Claude pour l'intelligence** — architecture hybride pour minimiser les coûts
- **Opportunités vs Maturité** — on a remplacé la grille statique de maturité par un radar d'opportunités dynamique alimenté par l'actualité
- **Profil qualitatif** — le radar stocke des forces/lacunes textuelles en plus des scores numériques
- **Signaux groupés par tendance** — rising/new en haut (à surveiller), stable au milieu, declining en bas

## Bugs connus / Améliorations possibles

- Certains RSS ne publient pas quotidiennement (LLMs, Énergie souvent à 0)
- Le HTML brut dans les summaries est strippé côté JS mais pas toujours côté Python (anciens articles)
- Le diagnostic du radar ne peut être refait qu'en remettant les scores à 0 en base
- Les challenges n'ont pas encore de bouton "Marquer comme complété" côté front
- La carte des concepts (graphe de relations entre concepts wiki) n'est pas encore implémentée
