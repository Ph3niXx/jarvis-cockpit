# Challenges

> Salle d'examen Jarvis : 2 modes (théorie QCM + pratique texte évalué par LM Studio), persistance des tentatives, bump radar sur premier pass ≥ 70%.

## Scope
pro

## Finalité fonctionnelle
Panel qui transforme l'apprentissage passif (lectures = recos) en validation active. Génère hebdomadairement 2 types de challenges calibrés sur les axes les plus faibles du radar :
- **Théorie** : QCM 3-10 questions, scoring auto côté front (`correctCount / total × 100`)
- **Pratique** : brief + contraintes + critères d'éval, l'utilisateur rédige une réponse ≥ 20 chars, soumet au serveur Jarvis local (LM Studio + Claude Haiku) qui note sur 4 axes (clarté / spécificité / rigueur / complétude)

Chaque tentative est persistée dans `challenge_attempts` (append-only). **Effet de bord important** : à la première tentative réussie ≥ 70 % d'un challenge, `skill_radar.score` est bumpé sur l'axe ciblé (+0.5 par défaut, cap 5). C'est le seul flux d'écriture qui fait bouger les scores radar côté utilisateur.

## Parcours utilisateur
1. Clic sidebar "Challenges" ou CTA radar "Défi cet axe" (axe pré-filtré via `localStorage.challenges-prefill-axis`).
2. **Hub** (état par défaut) : stats barre (total passés / avg score / XP cumulés / streak), 2 gros boutons mode, banner "Recommandé cette semaine" (2 cards), toolbar filtres (ouverts/recommandés/réussis/tout), grille de cards.
3. Clic sur un challenge → état **flow** :
   - Théorie : `<TheoryQuiz>` — topbar + progress dots + question + options + validation + feedback + suivant.
   - Pratique : `<PracticeExercise>` — split brief (left) + textarea + submit (right) → états "evaluating" avec étapes → affichage scores 4-axes → CTA "Voir feedback complet".
4. **Résultat** (état `completed`) : `<ResultScreen>` — hero score (Excellent ≥ 85 / Validé ≥ 70 / En cours < 70), feedback Jarvis (strengths/improvements pour pratique uniquement), 3 cards (Impact radar / XP gagnés / Prochaines étapes), CTA "Retenter" ou "Retour".
5. En fond : `recordAttempt()` POST `challenge_attempts`, rebuild local via `applyAttemptsToChallenges`, bump radar si 1er pass ≥ 70 %.

## Fonctionnalités
- **Deux modes de challenge** : Théorie (QCM de 3 à 10 questions) et Pratique (brief libre noté par Jarvis sur clarté, spécificité, rigueur, complétude), sélectionnables depuis deux gros boutons pédagogiques en haut de page.
- **Bannière « Recommandé cette semaine »** : deux challenges mis en avant par le pipeline hebdomadaire, avec l'axe radar ciblé et l'impact attendu.
- **Filtres statut** : Ouverts / Recommandés / Réussis / Tout, avec compteurs dynamiques sur chaque pill.
- **Filtre axe depuis le Radar** : arrivée par le CTA « Défi cet axe » pré-filtre automatiquement la liste sur l'axe concerné.
- **Barre de stats** : total passés, score moyen, XP cumulés, streak courante et record, calculés depuis l'historique complet des tentatives.
- **Flow Théorie** : progression en points, validation question par question avec feedback et explication, score final sur 100.
- **Flow Pratique** : brief + contraintes à gauche, zone de rédaction à droite (minimum quelques lignes), soumission à Jarvis qui évalue en quelques secondes et renvoie un commentaire détaillé avec forces et axes d'amélioration.
- **Écran résultat** : verdict (Excellent ≥ 85 / Validé ≥ 70 / En cours < 70), feedback Jarvis, trois cartes récapitulatives (Impact radar / XP gagnés / Prochaines étapes avec raccourci vers les recos de l'axe) et bouton « Retenter ».
- **Bump automatique du radar** : à la première tentative passée à 70%+, le score de l'axe ciblé monte sur le radar — seul flux utilisateur qui fait bouger les scores.
- **Mode dégradé Jarvis hors ligne** : une note heuristique locale est attribuée si le serveur Jarvis est injoignable, avec un message explicite invitant à lancer Jarvis et retenter.
- **Revoir un challenge réussi** : un bouton sur les challenges terminés relance le même flow pour rejouer.

## Front — structure UI
Fichier : [cockpit/panel-challenges.jsx](cockpit/panel-challenges.jsx) — 778 lignes, monté par [app.jsx:370](cockpit/app.jsx:370).

Structure DOM (hub) :
- `.panel-page[data-screen-label="Challenges"] > .panel-hero`
- `.chal-stats` (5 stat cards : 3 compteurs + streak + "Axe à travailler")
- `.chal-modes` (2 gros boutons théorie / pratique)
- `.chal-reco-banner` (conditionnel si recommended.length > 0)
- `.panel-toolbar` (4 pills de filtre statut)
- `.chal-cards` (grid de `<ChallengeCard>`)

Structure DOM (flow) :
- Théorie : `.panel-page--quiz > .quiz-topbar + .quiz-dots + .quiz-question{options, feedback, cta}`
- Pratique : `.panel-page--quiz > .quiz-topbar + .prac-wrap{.prac-brief + .prac-editor}`

Structure DOM (résultat) :
- `.panel-page--result > .quiz-topbar + .result-hero + .result-feedback (pratique) + .result-grid (3 cards) + .result-cta`

Route id = `"challenges"`. **Panel Tier 2** (listé dans `TIER2_PANELS`).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelChallenges({ data, onNavigate })` | Composant racine — state `mode / filter / active / completed / axisFilter / revision` | [panel-challenges.jsx:129](cockpit/panel-challenges.jsx:129) |
| `ChallengeCard({ challenge, mode, onStart })` | Card avec axis + badge (reco/done) + title + teaser + difficulty dots + duration + XP + CTA | [panel-challenges.jsx:314](cockpit/panel-challenges.jsx:314) |
| `TheoryQuiz({ challenge, onBack, onComplete })` | Flow QCM avec progress dots, feedback inline | [panel-challenges.jsx:367](cockpit/panel-challenges.jsx:367) |
| `PracticeExercise({ challenge, onBack, onComplete })` | Flow pratique : brief + textarea + eval streaming | [panel-challenges.jsx:490](cockpit/panel-challenges.jsx:490) |
| `ScoreBar({ label, value })` | Mini progress bar 4-axes pour l'éval pratique | [panel-challenges.jsx:647](cockpit/panel-challenges.jsx:647) |
| `ResultScreen({ result, onBack, onRetry })` | Screen post-challenge avec hero score + feedback + 3 cards | [panel-challenges.jsx:662](cockpit/panel-challenges.jsx:662) |
| `callJarvisEvaluate(ch, answer)` | POST au serveur Jarvis local (localhost:8765 puis tunnel), timeout 120s | [panel-challenges.jsx:20-49](cockpit/panel-challenges.jsx:20) |
| `jarvisGatewayCandidatesChal()` | Renvoie la liste ordonnée des bases URL à essayer (localhost + tunnel cloudflare) | [panel-challenges.jsx:9-18](cockpit/panel-challenges.jsx:9) |
| `persistChallengeAttempt(ch, result)` | POST `challenge_attempts` avec score + answers | [panel-challenges.jsx:51-75](cockpit/panel-challenges.jsx:51) |
| `bumpSkillRadar(ch, score, priorAttempts)` | PATCH `skill_radar` si 1er pass ≥ 70%, update optimiste du radar en mémoire | [panel-challenges.jsx:79-127](cockpit/panel-challenges.jsx:79) |
| `recordAttempt(result)` (inline) | Orchestre persist + applyAttempts local + bump radar + show result | [panel-challenges.jsx:151-173](cockpit/panel-challenges.jsx:151) |
| Effet "prefill axis" (anonyme) | Consomme `localStorage.challenges-prefill-axis` au mount | [panel-challenges.jsx:141-149](cockpit/panel-challenges.jsx:141) |
| `mapWeeklyChallengeRow(r, radarAxes)` | Loader : ligne `weekly_challenges` → shape panel (theory : questions, practice : brief+constraints+eval_criteria) | [data-loader.js:936-969](cockpit/lib/data-loader.js:936) |
| `applyAttemptsToChallenges(cd, attempts)` | Hydrate status + stats + streak depuis `challenge_attempts` | [data-loader.js:975-1050](cockpit/lib/data-loader.js:975) |
| `T2.challenges()` / `T2.challengeAttempts()` | Loaders Tier 2 | [data-loader.js:1224-1225](cockpit/lib/data-loader.js:1224) |
| `loadPanel("challenges")` case | Fetch challenges + attempts en parallèle, reconstruit theory/practice + applique attempts | [data-loader.js:4244-4272](cockpit/lib/data-loader.js:4244) |

## Back — sources de données

| Table | Colonnes | Usage |
|-------|----------|-------|
| `weekly_challenges` | `id, title, description, teaser, target_axis, mode ('theory'/'practice'), difficulty, duration_min, xp, score_reward, status ('recommended'/'open'/'completed'), content (JSONB), week_start` | **Lu** au mount (limit 20, ordre week_start desc) |
| `challenge_attempts` | `id, challenge_ref, challenge_source, mode, axis, title, difficulty, score_percent (0-100), xp_earned, answers (JSONB), completed_at` | **Lu + écrit** : tous les attempts, append-only |
| `skill_radar` | `score, history, last_assessed` | **Écrit** par `bumpSkillRadar` sur 1er pass ≥ 70% (cf. [tab-radar.md](tab-radar.md)) |

Le `content` JSONB de `weekly_challenges` contient :
- **Theory** : `{ questions: [{ q, options: [...], correct: <index>, explain: "..." }] }`
- **Practice** : `{ brief, constraints: [...], eval_criteria: "..." }`

## Back — pipelines qui alimentent
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — cron dimanche 22h UTC :
  - `generate_theory_quiz(axis_row)` : lit `skill_radar`, sélectionne axes faibles, prompte Claude Haiku pour générer 5-7 QCM sur l'axe, `POST weekly_challenges` avec `mode='theory'` + `content={questions: [...]}` ([weekly_analysis.py:405-466](weekly_analysis.py:405)).
  - `generate_practice_challenge(axis_row)` : même pattern, `mode='practice'` + `content={brief, constraints, eval_criteria}` ([weekly_analysis.py:473-538](weekly_analysis.py:473)).
- **Daily pipeline** : aucune interaction.
- **Serveur Jarvis local** ([jarvis/server.py](jarvis/server.py)) : expose `POST /evaluate-challenge` qui reçoit `{title, brief, constraints, eval_criteria, answer}` et retourne `{avg, scores: {clarte, specificite, rigueur, completude}, feedback, strengths, improvements}`. **Obligatoire pour le mode pratique** sans fallback utile.

## Appels externes
- **Supabase REST (lecture)** : `T2.challenges()` + `T2.challengeAttempts()`.
- **Supabase REST (écriture)** : `POST challenge_attempts` (chaque tentative), `PATCH skill_radar?id=eq.X` (bump).
- **Jarvis local** : `fetch('http://localhost:8765/evaluate-challenge')` puis fallback `https://*.trycloudflare.com/evaluate-challenge` si tunnel présent.
- **localStorage** : `challenges-prefill-axis` (single-use).
- **Telemetry** : `challenge_completed` (ref, mode, score), `skill_radar_bumped` (axis, reward, new_score).

## Dépendances
- **Onglets in** : `radar` (CTA "Défi cet axe" avec prefill axe), sidebar.
- **Onglets out** : `radar` (bouton "Voir mon radar" dans le ResultScreen — mais `onBack` revient aux challenges, pas au radar — cf. TODO).
- **Pipelines** : `weekly_analysis.yml` obligatoire (sinon corpus vide), `start_jarvis.bat` + tunnel Cloudflare pour le mode pratique.
- **Variables d'env / secrets** : `ANTHROPIC_API_KEY` (pipeline), `SUPABASE_SERVICE_KEY` (pipeline), `LM Studio` lancé localement (mode pratique).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2.
- **Corpus vide (`theory.length === 0` + `practice.length === 0`)** : les gros boutons mode montrent "0 challenges · 0 à faire", la zone cards est vide — pas de message d'empty state dédié.
- **Challenge sans questions (theory)** : `TheoryQuiz` affiche "Ce challenge est en cours d'écriture" avec bouton retour.
- **Jarvis injoignable (mode pratique)** : cascade 3 niveaux — localhost → tunnel → **fallback heuristique** (score = `Math.min(80, 45 + wordCount/5 + (structured ? 10 : 0))`), message "Jarvis est hors ligne" affiché.
- **Answer < 20 chars** : bouton "Soumettre" disabled, hint "Écris au moins quelques lignes".
- **POST challenge_attempts échoue** : `attempt` synthétisé localement (pas de crash), stats/streak recalculés sur cet attempt virtuel. Pas d'alert.
- **Mixed content HTTPS → HTTP localhost** : le cockpit servi sur GitHub Pages (HTTPS) ne peut pas atteindre `http://localhost:8765` (CORS bloc). `jarvisGatewayCandidatesChal` ordonne localhost en dernier pour HTTPS — le tunnel Cloudflare est alors requis pour la pratique.
- **1er pass ≥ 70% d'un challenge déjà réussi** : `bumpSkillRadar` détecte via `priorAttempts.some(a => ... score >= 70)` et skip le bump. Pas de double bump.
- **`skill_radar.score` approche le cap (5)** : `Math.min(5, ...)` clamp correctement.
- **Axis inexistant dans skill_radar** : `bumpSkillRadar` fetch échoue silencieusement (`rows[0]` undefined), pas de bump mais l'attempt est quand même persisté.
- **Retry challenge après échec** : pas de cooldown, l'utilisateur peut recommencer immédiatement. Un retry avec meilleur score devient le nouveau best pour le `applyAttemptsToChallenges` stamp.

## Limitations connues / TODO
- [x] ~~"Axe à travailler" hardcoded~~ → **dynamique** : `weakestAxis = axes.sort(score asc)[0]`, affiche le label + score + count de challenges ouverts ciblant cet axe. Fallback "Radar non initialisé" si aucun axe.
- [x] ~~ResultScreen "Prochaines étapes" hardcoded~~ → **remplacé** par un bloc dynamique : message contextualisé (passed / failed) mentionnant l'axe du challenge, + CTA "Voir les recos pour cet axe" qui navigue vers `recos` avec le prefill d'axe.
- [x] ~~Seuil "Moins de 7 bonnes réponses"~~ → **dérivé** : `passThreshold = Math.ceil(0.7 * result.total)`. Copy affiche maintenant "X/Y bonnes réponses — il en fallait Z pour valider".
- [x] ~~`onBack` → radar mal wiré~~ → **fixé** : ResultScreen reçoit `onNavigate`, le bouton "Voir mon radar" appelle `onNavigate("radar")` au lieu de `onBack`. CTA "Voir les recos pour cet axe" stashe l'axe + `onNavigate("recos")`.
- [x] ~~`impact_axis` "≥80%" vs seuil réel 70%~~ → **aligné** : `mapWeeklyChallengeRow` émet maintenant `"+X pts si ≥70%"`.
- [x] ~~Empty state corpus vide~~ → **ajouté** : `.chal-empty-inline` avec 4 branches (corpus vide / axe filtre vide / filtre "done" vide / filtre "all" vide).
- [x] ~~Feedback heuristique sans retry clair~~ → **renforcé** : bloc `.result-heuristic-warn` visible avec instructions (`start_jarvis.bat` + tunnel Cloudflare), CTA "Retenter" se relabel en "Retenter (avec Jarvis)" pour inciter à relancer après reconnexion.
- [ ] **`q.correct` = index number** : fragile — si les options sont shuffled côté pipeline, le correct index est faux. Pas de validation côté front.
- [ ] **Timeout Jarvis 120 s** pour l'éval pratique : si LM Studio est lent, l'utilisateur attend sans progress. Étapes "is-active" sont purement décoratives (3 sur 4 actives dès le début).
- [ ] **XP formula inconsistante** : `persistChallengeAttempt` calcule `xp_earned = xp * (score/100)` si ≥70%, mais le loader `transformRecos` donne des XP fixes. Les deux systèmes divergent.
- [ ] **Persistence des réponses textuelles** : le `answer` est stocké dans `challenge_attempts.answers.answer` (JSONB). Pas de limite de taille côté front — un answer de 50k chars pourrait poser problème.
- [ ] **Pas de timer / chrono** : le challenge affiche "5 min estimées" mais rien ne mesure le temps réel pris. Pourrait alimenter des stats "vitesse de résolution".
- [ ] **Impossible de sauter un challenge en cours** sans perdre les réponses : `onBack` en cours de quiz annule tout. Devrait proposer de sauvegarder comme "abandonné".

## Dernière MAJ
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — 7 fixes : weakest axis dynamique + threshold 70% aligné + empty state + ResultScreen navigate + heuristic warn (local, non pushé)
