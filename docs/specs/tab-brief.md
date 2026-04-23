# Brief du jour

> Page d'atterrissage matinale : synthèse IA du jour + top 3 + signaux faibles + radar gap + semaine en cours, en une seule page de consultation.

## Scope
mixte

## Finalité fonctionnelle
C'est le premier écran à l'ouverture du cockpit (route `"brief"`, panel par défaut dans [app.jsx:154](cockpit/app.jsx:154)). Il rassemble quatre vues synthétiques pour décider quoi lire en priorité ce matin sans scroller 20 onglets : **hero** (paragraphe de synthèse + stats macro), **top 3 incontournables**, **4 signaux faibles** (new/rising en priorité), **radar compétences** avec le prochain gap à combler, et **bilan de la semaine** en heatmap barres.

## Parcours utilisateur
1. À l'ouverture du cockpit, la page charge en Tier 1 (bloquant avant le mount React) — `bootTier1()` dans [data-loader.js:1136](cockpit/lib/data-loader.js:1136).
2. L'utilisateur lit le paragraphe hero (synthèse générée par Gemini à 06:00 UTC).
3. Option : clic sur **Lecture audio** ([home.jsx:7-42](cockpit/home.jsx:7)) pour une version TTS via `window.speechSynthesis` (voix française).
4. Clic sur "Lire les 3 incontournables" → navigation `top`, ou clic sur une carte du top 3 pour ouvrir l'article en onglet externe et marquer lu en localStorage.
5. Scan des signaux faibles (carte par tendance : NEW / EN HAUSSE / STABLE / EN BAISSE).
6. Vérification du radar : "Ton prochain gap à combler" suggère un axe + action (clic → panel `challenges`).
7. Coup d'œil final sur la heatmap semaine (articles lus par jour avec moyenne).
8. Bouton "Tout marqué lu" ([home.jsx:176-188](cockpit/home.jsx:176)) → écrit tous les top ids dans `localStorage.read-articles`.

## Fonctionnalités
- **Hero synthèse** : kicker + titre + paragraphe (420 chars max), extrait du `brief_html` Gemini ou fallback sur le top article. 2 CTA : top articles / veille complète.
- **Audio brief** : Web Speech API native (fr-FR), estimation durée `body.length / 280` min.
- **Stats macro** : 4 tuiles (articles du jour, signaux en hausse, streak veille, prochain brief auto).
- **Top 3 cards** : rank + score bar (descendant 94→82) + source/section/date + title + summary + tags + actions (marquer lu, garder). Ouverture article au clic de la carte entière.
- **Signaux grid** : 4 premiers de `data.signals` via `<SignalCard>` ([home.jsx:127](cockpit/home.jsx:127)), chacun avec sparkline SVG 8 semaines + delta.
- **Radar SVG** : polygone à N axes ([home.jsx:59-99](cockpit/home.jsx:59)), labels, points `gap=true` (score <50) grossis.
- **Next gap** : bloc accent à droite du radar avec raison + CTA challenge.
- **Heatmap semaine** : 7 colonnes Lun→Dim (compte articles par jour), KPIs agrégés (articles lus, gardés, streak).
- **Footer** : signature "Brief Gemini Flash-Lite · hebdo Claude Haiku" + coût mensuel / budget 3 €.

## Front — structure UI
Fichier : [cockpit/home.jsx](cockpit/home.jsx) — 424 lignes, monté par le router dans [app.jsx:365](cockpit/app.jsx:365).

Classes-racines :
- `.home` (wrapper, reçoit `data-theme-vibe={theme.id}`)
- `.ph` — page header (eyebrow semaine + titre + date + chips actions)
- `.hero > .hero-frame` (2 cols : `.hero-col-main` / `.hero-col-side`)
- `.block` — sections génériques ; `.block--two` pour la 2-col Signaux+Radar
- `.top-grid` — 3 cards top
- `.sig-grid` — 4 signaux
- `.radar-box > .radar-svg-wrap + .radar-next`
- `.hwk-wrap > .hwk + .hwk-kpi` — heatmap semaine + KPIs

Pas d'id HTML stable sur le container ; l'identifiant de route est `"brief"` (dans `activePanel`, URL hash `#brief`). Le panel est Tier 1 (non listé dans `TIER2_PANELS` de [data-loader.js:4248](cockpit/lib/data-loader.js:4248)) — data pré-chargée avant mount.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `Home({ theme, data, onNavigate })` | Composant racine, lit `data.{macro,top,signals,stats,date,user,radar,week}` | [home.jsx:158](cockpit/home.jsx:158) |
| `AudioBriefChip({ macro })` | Bouton TTS Web Speech API (fr-FR, voix auto) | [home.jsx:7](cockpit/home.jsx:7) |
| `TrendArrow({ trend, delta })` | Pastille NEW / flèche ↑↓ / — selon tendance signal | [home.jsx:44](cockpit/home.jsx:44) |
| `RadarSVG({ axes, size })` | Polygone radar SVG à N axes, 4 anneaux, points grossis si `gap=true` | [home.jsx:59](cockpit/home.jsx:59) |
| `Sparkbar({ values, max })` | Barres compactes (inutilisée dans Home actuel, conservée pour future widget) | [home.jsx:101](cockpit/home.jsx:101) |
| `Sparkline({ values, trend })` | Ligne SVG 8 points + point final, classe CSS selon tendance | [home.jsx:112](cockpit/home.jsx:112) |
| `SignalCard({ signal, rank })` | Carte signal : rank + badge trend + categorie + context + count + sparkline + delta | [home.jsx:127](cockpit/home.jsx:127) |
| `toggleRead(rank)` (inline) | État local des top lus ; conjoint avec `localStorage.read-articles` | [home.jsx:161](cockpit/home.jsx:161) |
| `openArticle()` (inline) | Écrit l'id dans `read-articles` et ouvre `t._url` en nouvel onglet | [home.jsx:256-269](cockpit/home.jsx:256) |
| `bootTier1()` | Orchestre les 7 fetches Tier 1 avant le mount React | [data-loader.js:1136](cockpit/lib/data-loader.js:1136) |
| `loadArticlesToday()` | `GET articles?fetch_date=eq.<today>&order=date_fetched.desc&limit=100` | [data-loader.js:73](cockpit/lib/data-loader.js:73) |
| `loadDailyBrief()` | `GET daily_briefs?order=date.desc&limit=1` | [data-loader.js:77](cockpit/lib/data-loader.js:77) |
| `loadSignals()` | `GET signal_tracking?order=mention_count.desc&limit=60` | [data-loader.js:82](cockpit/lib/data-loader.js:82) |
| `loadRadar()` | `GET skill_radar?order=axis` | [data-loader.js:85](cockpit/lib/data-loader.js:85) |
| `loadRecentArticles(30)` | `GET articles?fetch_date=gte.<d-30>&order=fetch_date.desc&limit=400` — nourrit Week | [data-loader.js:96](cockpit/lib/data-loader.js:96) |
| `loadWeeklyAnalysis(8)` | `GET weekly_analysis?order=week_start.desc&limit=8` — historique coûts | [data-loader.js:91](cockpit/lib/data-loader.js:91) |
| `buildMacro(articles, brief)` | Extrait `<h1/h2>` + `<p>` du `brief_html`, fallback top article | [data-loader.js:132](cockpit/lib/data-loader.js:132) |
| `buildStats(articles, signals)` | Calcule `articles_today`, `signals_rising`, `unread`, `streak`, `next_brief` | [data-loader.js:114](cockpit/lib/data-loader.js:114) |
| `buildTop(articles)` | Mappe 3 premiers articles en cards (rank/score/tags/source) | [data-loader.js:167](cockpit/lib/data-loader.js:167) |
| `buildSignals(rows)` | Dédoublonne par term (max week_start), reconstruit history[] | [data-loader.js:185](cockpit/lib/data-loader.js:185) |
| `buildRadar(rows)` | Normalise scores 0-10→0-100, calcule `delta_30d`, `next_gap` = axe le plus bas | [data-loader.js:206](cockpit/lib/data-loader.js:206) |
| `buildWeek(recent)` | Compte articles par jour Lun→Dim, streak, KPIs week | [data-loader.js:1028](cockpit/lib/data-loader.js:1028) |
| `computeStreak()` | Scan localStorage `read-articles` jusqu'à 400j en arrière | [data-loader.js:58-70](cockpit/lib/data-loader.js:58) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `articles` | `id, title, summary, source, section, tags, url, date_published, fetch_date` | 100 lignes/jour (limit) — corpus du jour ; 400 lignes/30j pour Week |
| `daily_briefs` | `date, brief_html, article_count, created_at` | 1 ligne/jour, lecture `limit=1` |
| `signal_tracking` | `term, mention_count, trend, history (JSONB), delta, category, context, week_start` | ~60 lignes/semaine |
| `skill_radar` | `axis, axis_label, score, strengths, gaps, target, history (JSONB)` | 8 axes, update manuel + par `weekly_analysis` |
| `weekly_analysis` | `week_start, tokens_used (JSONB avec cost_usd)` | 8 dernières semaines, sert uniquement au sparkline coût dans le footer |
| `user_profile` | `key, value` | ~15 paires, sert à construire `user.name` / `user.role` |

Table **non lue malgré mention dans spec.json** : `activity_briefs` — écrite par [jarvis/observers/daily_brief_generator.py:251](jarvis/observers/daily_brief_generator.py:251) mais pas consommée par la home (voir TODO).

## Back — pipelines qui alimentent

- **Daily pipeline** ([main.py](main.py)) — GitHub Actions cron `0 6 * * 1-5` ([daily_digest.yml](.github/workflows/daily_digest.yml)), samedi `0 10 * * 6` (ping anti-pause uniquement) :
  - Fetch RSS → `POST articles` par batch de 50 ([main.py:797](main.py:797))
  - `generate_brief()` via Gemini 2.5 Flash-Lite → `POST daily_briefs` ([main.py:886](main.py:886))
  - Détection + comptage termes → `POST/PATCH signal_tracking` par (term, week_start) avec calcul trend ([main.py:695-769](main.py:695))
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — GitHub Actions dimanche 22h UTC :
  - **Lit** `skill_radar` pour calibrer les challenges/recos (pas d'écriture vers les tables du Brief)
  - Log coûts → `POST weekly_analysis` qui nourrit le footer
- **Jarvis (local)** — la boucle nocturne n'écrit pas vers les tables du Brief. `activity_briefs` (observer 18h) reste pour l'instant un silo non branché à la home.

## Appels externes
- **Supabase REST** via `q(table, query)` dans `cockpit/lib/supabase.js` — 7 appels Tier 1 en parallèle au boot (`Promise.all`).
- **Web Speech API** native du navigateur — `window.speechSynthesis.speak(...)` pour la lecture audio ([home.jsx:28](cockpit/home.jsx:28)). Pas de clé, pas de réseau.
- **Gemini API** : appelée par le pipeline daily côté backend, jamais depuis le front.
- **localStorage** : clé `read-articles` (map `id → {ts}`), lue+écrite pour le streak et le "marqué lu".

## Dépendances
- **Onglets aval** (via CTA) : `top` (3 incontournables), `updates` (parcourir tous), `signals` (tous les signaux), `challenges` (gap action), `week` (ouvrir ma semaine).
- **Pipelines** : `daily_digest.yml` (obligatoire pour `articles` + `daily_briefs` + `signal_tracking`), `weekly_analysis.yml` (secondaire, pour les coûts du footer et la calibration radar indirecte).
- **Variables d'env / secrets** : aucune côté front. Pipeline backend requiert `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GMAIL_*`.

## États & edge cases
- **Loading** : Tier 1 bloque le mount React ; le screen affiche un loader provenant de la phase auth (voir `cockpit/lib/auth.js`). Pas de skeleton dédié à la Home.
- **Empty state (pas de brief aujourd'hui)** : `buildMacro` fallback avec titre "Pas encore de brief aujourd'hui" + body "Le pipeline quotidien tourne à 06:00 UTC. Reviens dans quelques heures — ou consulte l'historique." ([data-loader.js:133-141](cockpit/lib/data-loader.js:133)).
- **Empty radar** : `buildRadar` retourne `axes: []` + `next_gap.axis = "Radar à initialiser"` avec CTA "Ouvrir le radar" ([data-loader.js:212-218](cockpit/lib/data-loader.js:212)).
- **Empty signals** : `data.signals.slice(0,4)` rend 0 cards sans warning.
- **Empty week** : heatmap avec `counts = [0,0,0,0,0,0,0]`, KPIs à 0.
- **Erreur réseau Tier 1** : chaque loader est wrappé en `.catch(() => [])` ou `(() => null)` dans `Promise.all` ([data-loader.js:1138-1145](cockpit/lib/data-loader.js:1138)) → la page se monte quand même avec des tableaux vides (dégradation silencieuse).
- **Speech API non supportée** : `AudioBriefChip.speak()` no-op si `"speechSynthesis" in window === false`.
- **RLS** : toutes les tables exigent `authenticated` ; si le JWT expire, les fetches retournent 401 → fallback empty silencieux. Pas d'alerte UX actuellement.

## Limitations connues / TODO
- [ ] **`activity_briefs` non wiré à la Home** : la table existe et est remplie par `jarvis/observers/daily_brief_generator.py` mais aucun fetch côté front. À brancher si on veut un résumé activité perso sur la home.
- [ ] **Pas de skeleton dédié** pendant Tier 1 ; l'utilisateur voit d'abord le loader auth.
- [ ] **Aucune gestion d'erreur visible** côté Home — les 401/500 Tier 1 dégradent en empty state sans feedback UI.
- [ ] **`reading_time` est heuristique** (`articles.length * 1.5`, [data-loader.js:162](cockpit/lib/data-loader.js:162)) — pas une vraie estimation.
- [ ] **`cost_month` et `cost_history_7d`** sont remplis *après* le shape initial, dans un bloc `try/catch` Tier 1 optionnel ([data-loader.js:1150-1166](cockpit/lib/data-loader.js:1150)). Si le parse échoue, le footer affiche `null / 3 €`.
- [ ] **Articles "gardés"** : la carte KPI "Gardés" de la semaine affiche `total_marked = total_read` ([data-loader.js:1056](cockpit/lib/data-loader.js:1056)) — pas de distinction entre lu et bookmarké côté backend.
- [ ] **`next_brief` statique** : calcul basé uniquement sur l'heure UTC vs 06:00 ; ne reflète pas le jour férié ni le samedi (cron `1-5` uniquement, samedi `0 10 * * 6` est un ping ≠ un brief complet).
- [ ] **`signals_rising` compte "rising" + "new"** ([data-loader.js:117](cockpit/lib/data-loader.js:117)) — pas de séparation UI.
- [ ] **`<inconnu>` : seuils de score Top** — les scores 94/88/82 sont dérivés de `94 - i*6` ([data-loader.js:174](cockpit/lib/data-loader.js:174)), donc toujours les mêmes 3 valeurs selon le rang, **pas** un vrai score d'impact côté backend. À confirmer : est-ce intentionnel ou est-ce qu'un vrai score existe ailleurs ?

## Dernière MAJ
2026-04-23 — d752b79
