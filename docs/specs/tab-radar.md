# Radar compétences

> Vue 8-axes du niveau IA avec spider chart, narratif calculé depuis les vraies données, détail par axe et navigation vers recos/challenges.

## Scope
pro

## Finalité fonctionnelle
Affiche un radar spider à N axes (par défaut 8) représentant le niveau de compétence IA de l'utilisateur sur différents sous-domaines. Chaque axe porte : un **score actuel** (0-100), une **cible 12 mois**, un **delta 30j** calculé depuis l'historique, un **niveau** (Débutant / Intermédiaire / Avancé), et une **note** pédagogique. Le panel est **consommateur** de `skill_radar` — il ne modifie pas les scores directement. Les scores bougent via : (1) challenges complétés ≥70% (voir [tab-challenges.md](tab-challenges.md)) qui bump +0.5/+1 sur l'axe ciblé, (2) édition manuelle en base (pas d'interface front).

## Parcours utilisateur
1. Clic sidebar "Radar compétences" — la vue s'affiche quasi-immédiatement car les axes sont déjà en mémoire.
2. Lecture du hero : moyenne générale + niveau global (exemple : "72/100 — Niveau intermédiaire").
3. Scan de la toolbar en haut : moyenne générale, axe en plus forte progression 30 jours, axe le plus faible.
4. Lecture du spider chart central : polygone coloré = niveau actuel, polygone pointillé = cible 12 mois.
5. Clic sur un point du radar ou sur un axe dans la liste de droite pour basculer en vue détail — score géant, jauge vs cible, variation 30 jours, note pédagogique, mini-courbe 12 semaines et deux raccourcis ("Voir recos" / "Défi cet axe").
6. Lecture de la colonne "Ce que dit ton radar" (à gauche) : quatre pavés calculés — point fort, angle mort, vague qui monte, cap atteint ou alerte régression.

## Fonctionnalités
- **Spider chart central** : un radar circulaire à quatre anneaux de graduation, une branche par axe IA, et deux polygones superposés — niveau actuel rempli et cible 12 mois en pointillé — pour visualiser l'écart au but en un coup d'œil.
- **Narratif « Ce que dit ton radar »** : quatre pavés calculés depuis les vraies données (point fort, angle mort, vague qui monte, cap atteint ou alerte régression) pour raconter le radar sans avoir à comparer les chiffres.
- **Toolbar 3 indicateurs** : moyenne générale, axe qui a le plus progressé sur 30 jours, axe le plus faible, pour situer le radar d'entrée de page.
- **Vue liste des axes** : huit cartes compactes à droite, chacune avec sa barre de progression, un marqueur de cible et la variation 30 jours avec flèche.
- **Vue détail axe** : au clic sur un axe, le panneau droit bascule en vue détail avec score géant, jauge vs cible, delta 30j, note pédagogique, mini-courbe d'historique sur 12 semaines et deux raccourcis vers les recos ou challenges ciblés.
- **Titres longs sur deux lignes** : les labels « Prompting & RAG » ou « Agents / Orchestration » sont coupés automatiquement pour éviter le chevauchement sur le radar.
- **Message vide** : quand le radar n'est pas encore initialisé, un message explique que les scores montent quand on complète des challenges à 70%+.

## Front — structure UI
Fichier : [cockpit/panel-radar.jsx](cockpit/panel-radar.jsx) — 351 lignes, monté par [app.jsx:368](cockpit/app.jsx:368).

Structure DOM :
- `.panel-page > .panel-hero` — eyebrow (semaine ISO) + h1 (`<em class="serif-italic">axe par axe</em>`) + sub
- `.panel-toolbar > .radar-toolbar-stats` — 3 chips (Moyenne / Plus forte progression / Axe le plus faible)
- `<RadarSpider>` :
  - `.radar-wrap.radar-wrap--spider` (3 cols)
  - `.radar-aside--left` — narratif "Ce que dit ton radar" en 4 blocs
  - `.radar-center > svg.radar-svg + .radar-legend`
  - `.radar-aside--right` — `<AxisList>` OU `<AxisDetail>` selon `selectedAxis`

Pas d'id stable. Route id = `"radar"`. **Panel Tier 2** ; les données principales (axes) proviennent cependant de Tier 1.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelRadar({ data, onNavigate })` | Composant racine — lit `window.APPRENTISSAGE_DATA.radar` (PAS `data.radar`) | [panel-radar.jsx:12](cockpit/panel-radar.jsx:12) |
| `RadarSpider({ axes, ... })` | Spider SVG 680×520, 2 polygones + N points + narratif | [panel-radar.jsx:85](cockpit/panel-radar.jsx:85) |
| `AxisList({ axes, onSelect })` | Vue par défaut de la colonne droite : 8 cards compactes | [panel-radar.jsx:255](cockpit/panel-radar.jsx:255) |
| `AxisDetail({ axis, onClose, onNavigate })` | Vue drill-down d'un axe avec 2 CTAs | [panel-radar.jsx:292](cockpit/panel-radar.jsx:292) |
| `isoWeekRadar(d)` | Numéro de semaine ISO 8601 pour l'eyebrow | [panel-radar.jsx:4](cockpit/panel-radar.jsx:4) |
| `loadRadar()` | `GET skill_radar?order=axis` — Tier 1 | [data-loader.js:85](cockpit/lib/data-loader.js:85) |
| `buildRadar(rows)` | Normalise scores 0-5 → 0-100, calcule `delta_30d` via `history` JSONB, construit `summary` + `next_gap` | [data-loader.js:206](cockpit/lib/data-loader.js:206) |
| `loadPanel("radar")` case | Partagé avec "recos" : recharge `T2.recos()` + rebuild `APPRENTISSAGE_DATA.radar` depuis `raw.radarRows` | [data-loader.js:4217-4228](cockpit/lib/data-loader.js:4217) |
| `bumpSkillRadar(ch, score, priorAttempts)` (côté challenges) | Écriture : au 1er pass ≥70% d'un challenge, PATCH `skill_radar` ciblé + append `history` entry | [panel-challenges.jsx:79-128](cockpit/panel-challenges.jsx:79) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `skill_radar` | `id, axis, axis_label, score (0-5), target (0-100), history (JSONB), strengths, gaps, last_assessed` | 8 lignes (une par axe) |

`buildRadar` normalise `score ≤ 10` par `× 10` (donc 0-5 en DB → 0-100 à l'écran). Le reste est passthrough.

**Historique `history`** : tableau JSONB de `{date: "YYYY-MM-DD", score: 0-5, reason: "..."}`. Utilisé pour calculer `delta_30d` (diff score actuel vs score le plus récent datant de >30j).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) : aucune écriture vers `skill_radar`.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : **lit** `skill_radar` pour calibrer challenges + recos, mais **n'écrit pas**. Voir [weekly_analysis.py:193, 316, 549](weekly_analysis.py:193).
- **Jarvis (local)** : aucune écriture.
- **Front** ([panel-challenges.jsx:79-128](cockpit/panel-challenges.jsx:79)) : **seule** écriture effective. Bump `score += score_reward` (par défaut 0.5, capped à 5) quand un challenge est passé ≥70% la première fois. Ajoute aussi une entrée à `history`.

Édition initiale / seeding : manuel en base Supabase ou via Jarvis (aucune UI dédiée).

## Appels externes
- **Supabase REST (lecture)** : `loadRadar()` via `q("skill_radar", ...)` — Tier 1.
- **Supabase REST (écriture)** : `PATCH /rest/v1/skill_radar?id=eq.{id}` depuis `bumpSkillRadar` (dans le panel challenges).
- **localStorage** : aucune — radar est stateless côté front hormis la sélection d'axe.
- **Telemetry** : `window.track("skill_radar_bumped", { axis, reward, new_score })`.

## Dépendances
- **Onglets in** : CTA depuis la Home ("Ton prochain gap à combler" → challenges). Navigation aussi depuis Challenges (succès d'un challenge → mise à jour optimiste du radar).
- **Onglets out** : `recos` (bouton "Voir recos"), `challenges` (bouton "Défi cet axe").
- **Pipelines** : `weekly_analysis.py` alimente les **recos** et **challenges** basés sur le radar, mais n'alimente pas le radar lui-même.
- **Variables d'env / secrets** : aucune.

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 (même si la donnée est déjà Tier 1, le loader attend le T2 pour re-render).
- **Empty (`axes.length === 0`)** : `buildRadar` retourne `axes: []` + `next_gap.axis = "Radar à initialiser"`. Le panel affiche "Radar non initialisé — lance le diagnostic" (mais **aucun bouton diagnostic** n'existe, cf. Limitations).
- **Axe sans `history`** : `delta_30d = 0`. Les 4 narratifs restent corrects ("Pas encore assez d'historique pour détecter une tendance sur 30 jours").
- **Axe avec `delta_30d < 0`** : le bloc "Attention" remplace "Cap atteint" avec l'axe en régression.
- **Score > 100** : `buildRadar` cap à 100 via `Math.min(100, s)`.
- **Score < 50** : marqué `gap: true` — affichage avec point grossi.
- **Challenge passe `score_reward = 0.5`** : bump passe de `score × 20` à `(score + 0.5) × 20 = +10 points` à l'écran.
- **Corpus introuvable** : `APPRENTISSAGE_DATA` manquant → crash au mount (`window.APPRENTISSAGE_DATA.radar.axes` ne peut pas être lu). À mitiger.

## Limitations connues / TODO
- [x] ~~Claim "Lancer le diagnostic" orphelin~~ → **reformulé** : "Les scores bougent quand tu complètes des challenges IA (+0,5 pt par challenge passé à 70%+)" + l'empty state "Radar vide — complète un premier challenge pour lancer ton historique".
- [x] ~~Pas de graphe historique par axe~~ → **ajouté** : `<AxisSparkline>` dans `AxisDetail` rend un SVG polyline des 12 derniers points de `history_12w`. Masqué si < 2 points (pas de signal). `buildRadar` expose désormais `history_12w` : tableau normalisé `{date, score}` trié asc, scores convertis en 0-100.
- [x] ~~CTA "Défi cet axe" sans prefill~~ → **fixé** : le CTA stashe l'axe dans `localStorage.challenges-prefill-axis`, le panel Challenges le consomme au mount + applique un filtre d'axe dans la liste. Même pattern pour "Voir recos" → `localStorage.recos-prefill-axis` (panel Recos avait déjà l'état `axisFilter`, juste ajouté l'useEffect de consommation).
- [x] ~~Conversion ×10 vs ×20 incohérente~~ → **unifié en ×20** dans `buildRadar.norm` et `delta30` pour matcher `bumpSkillRadar`. Un score DB de 5 affiche maintenant 100/100 (avant : 50/100 — bug latent). Les valeurs DB déjà ≥ 6 restent passthrough (forward-compat).
- [ ] **Migration DB future possible** : pour sortir définitivement de la double échelle 0-5 / 0-100, une seule SQL `UPDATE skill_radar SET score = LEAST(score * 20, 100) WHERE score <= 5` (à exécuter une fois) + simplification de `norm` en `Math.min(100, s)`. Non critique, forward-compat OK.
- [ ] **Mise à jour optimiste après challenge** ne recalcule pas `delta_30d` (reste figé à la valeur Tier 1). Le narratif "plus forte progression" peut refléter l'ancien topGainer pendant la session.
- [ ] **Pas d'édition `strengths/gaps/goals`** depuis le front : tout est en base.
- [ ] **`next_gap` de `buildRadar` ne tient pas compte de `target`** : l'axe le plus bas en absolu est choisi, même si un autre axe a un plus grand gap vers sa cible.
- [ ] **Hardcoded "8 axes"** : le panel scale au nombre d'axes du DB, mais le titre dans l'admin / docs parle de "8 axes". Si un jour on ajoute "Sécurité IA" ou "Alignment" → doc à mettre à jour.
- [ ] **Pas de persistance de l'axe sélectionné** : reset à la navigation.
- [ ] **Sparkline utilise `history` brut** : si l'historique contient des entrées `{date, score}` avec `score = 0` (ex: reset), la ligne touche le bas. Pas de lissage / détection d'anomalie.
- [ ] **Panel monté sans gate d'auth explicite** : si RLS rejette le fetch, `APPRENTISSAGE_DATA.radar.axes` reste vide et le rendu se dégrade silencieusement. Pas de message d'erreur UI.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — reformuler copy + sparkline 12w + prefill axe + fix conversion (local, non pushé)
