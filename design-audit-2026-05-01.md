# Audit Design Complet — AI Cockpit

**Date** : 1er mai 2026
**Auditeur** : Senior design (UX, UI, design system, a11y, rétention)
**Cible** : https://ph3nixx.github.io/jarvis-cockpit/ + repo `jarvis-cockpit`
**Méthode** : audit source code + tentative crawl live (page chargée mais l'app
est gated derrière Google OAuth — je n'ai pas pu valider en pixel les états
post-login, l'audit s'appuie donc sur le code rendu, les CSS de référence,
les styles mobiles, les data fixtures, et les specs `docs/specs/`).

---

## 0. Note préalable — Contradiction stack

Le brief mission décrit la stack comme « single-file vanilla HTML/CSS/JS,
gradient bleu→violet, glassmorphism, dark mode ». **La réalité du repo est
différente** :

- Stack réelle : **React 18 + `@babel/standalone` via CDN** (no build step,
  c'est correct), **77 fichiers** dans `cockpit/` (`*.jsx` + `*.css` éclatés
  par domaine), `index.html` n'est qu'une coquille de 80 lignes qui charge
  les scripts.
- Identité visuelle réelle : **3 thèmes finis et cohérents**, **aucun
  gradient bleu→violet**, **aucun glassmorphism** —
   - **Dawn** = ivoire crémeux + accent rouille (presse éditoriale)
   - **Obsidian** = charbon + accent cyan-mint (terminal mission control)
   - **Atlas** = blanc Swiss + accent indigo (bureau d'études)
- Persistance : Supabase (REST + JWT) ; helpers `fetchJSON / postJSON /
  patchJSON` dans `cockpit/lib/supabase.js`.

**Implication pour les prompts Claude Code** : les prompts ciblent les vrais
fichiers (`cockpit/panel-*.jsx`, `cockpit/styles*.css`), pas un mythique
`index.html` monolithe. Toute consigne « code vanilla JS » est traduite
en « JSX-via-Babel sans framework de build ».

---

## 1. Reconnaissance

### 1.1 Inventaire des panels (baseline)

| ID panel       | Fichier                       | Tier | Source données                            |
|----------------|-------------------------------|------|--------------------------------------------|
| brief (Home)   | home.jsx                      | T1   | daily_briefs + activity_briefs + radar     |
| top            | panel-top.jsx                 | T1   | articles (rank ≤ 3..N)                     |
| review         | panel-review.jsx              | T1   | articles (filtre lu/non-lu)                |
| evening        | panel-evening.jsx             | T1   | brief soir + signaux                       |
| signals        | panel-signals.jsx             | T1   | signal_tracking + weekly_analysis          |
| radar          | panel-radar.jsx               | T1   | skill_radar (8 axes)                       |
| recos          | panel-recos.jsx               | T2   | learning_recommendations                   |
| challenges     | panel-challenges.jsx          | T2   | weekly_challenges                          |
| wiki           | panel-wiki.jsx                | T2   | wiki_concepts                              |
| opps           | panel-opportunities.jsx       | T2   | weekly_opportunities                       |
| ideas          | panel-ideas.jsx               | T2   | business_ideas                             |
| veille-outils  | panel-veille-outils.jsx       | T2   | claude_veille + claude_ecosystem           |
| jobs           | panel-jobs-radar.jsx          | T2   | jobs.json (radar emploi)                   |
| week           | panel-week.jsx                | T1   | articles + localStorage (read/streak)      |
| jarvis         | panel-jarvis.jsx              | T1   | jarvis_conversations + /chat               |
| jarvis-lab     | panel-jarvis-lab.jsx          | T2   | docs/specs/* + project_status.yaml         |
| profile        | panel-profile.jsx             | T2   | user_profile (key/value)                   |
| perf           | panel-forme.jsx               | T2   | strava_activities + withings_measurements  |
| music          | panel-musique.jsx             | T2   | music_scrobbles + music_top_weekly         |
| gaming         | panel-gaming.jsx              | T2   | steam_games_snapshot + gaming_stats        |
| stacks         | panel-stacks.jsx              | T2   | data-stacks.js (références)                |
| history        | panel-history.jsx             | T2   | articles (groupés par fetch_date)          |
| search         | panel-search.jsx              | T1   | articles (full-text Supabase)              |
| veille (×5)    | panel-veille.jsx (corpus param)| T2   | articles filtré par section                |
| sidebar        | sidebar.jsx                   | —    | nav.js + stats footer                      |
| command-palette| command-palette.jsx           | —    | nav + recherche + Jarvis                   |
| ticket modal   | components-ticket.jsx         | —    | ideas (création / édition)                 |

**Observations** :

1. **25 panels**. Surface fonctionnelle énorme pour un usage perso quotidien.
2. **Le composant `panel-veille.jsx` est paramétré par corpus** (`updates`,
   `claude`, `sport`, `gaming_news`, `anime`, `news`) — c'est une bonne
   factorisation et le seul vrai pattern réutilisable côté panels.
3. **20 fichiers CSS séparés** (`styles.css` + `styles-*.css`). Risque de
   drift élevé : la règle `.delta--up` est dans `styles.css`, mais
   `styles-signals.css` peut redéfinir le même style ailleurs sans qu'on
   le voie. Pas de tooling de cohérence.

### 1.2 Design system implicite

**Tokens CSS Custom Properties** (3 thèmes complets, parfaitement
parallèles dans `themes.js`) :

- **Couleurs** : `--bg`, `--bg2`, `--bg3`, `--surface`, `--tx`, `--tx2`,
  `--tx3`, `--bd`, `--bd2`, `--brand`, `--brand-ink`, `--brand-tint`,
  `--positive`, `--positive-tint`, `--alert`, `--alert-tint`, `--neutral`.
- **Typo** : 4 familles (`--font-display`, `--font-body`, `--font-mono`,
  `--font-serif`) ; échelle 9 niveaux (`--text-2xs` 10px → `--text-display`
  54px).
- **Espacement** : échelle 4px sur 8 niveaux (`--space-1` 4px → `--space-8`
  64px). Cohérent.
- **Rayons** : `--radius`, `--radius-lg` (varient par thème).
- **Ombres** : `--shadow-sm/md/lg` (varient par thème — Atlas presque plat).
- **Vibe par thème** : `density`, `dividerStyle`, `accentShape`, `cardStyle`
  exposés en dataset — pour conditionner certains styles sans dupliquer
  les composants.

**Design system score** : **4/5** sur l'intention, **2.5/5** sur l'exécution.
Tokens propres mais appliqués de façon hétérogène — beaucoup de valeurs
hardcodées subsistent (`font-size: 13.5px`, `padding: 22px`, `margin: 26px`
dans `styles.css`).

**Drifts repérés (échantillon, ligne approximative dans `styles.css`)** :

| Hardcoded                       | Devrait être              | Endroit                  |
|---------------------------------|---------------------------|--------------------------|
| `font-size: 13.5px`             | `var(--text-md)` (13)     | `.top-summary`, `.sig-card-context` |
| `padding: 44px 32px 40px`       | `var(--space-7) var(--space-6)` | `.hero` |
| `font-size: 19px`               | `var(--text-xl)` (18)     | `.top-title` |
| `margin-bottom: 26px`           | `var(--space-5/6)`        | `.hero-body` |
| `gap: 56px`                     | `var(--space-8)` (64)     | `.hero-frame` |
| `font-size: 16px`               | `var(--text-lg)` (15)     | `.tk-input--title`, `.tk-metadata-value--big` |
| `font-size: 26px`               | `var(--text-3xl)` (28)    | `.section-title`, `.kbd-title` |
| `box-shadow: 0 24px 60px ...`   | `var(--shadow-lg)`        | `.tk-panel`, `.kbd-panel` |
| `padding: 7px 12px`             | `var(--space-2) var(--space-3)` | `.btn--sm` |
| `font-size: 10.5px`             | `var(--text-2xs)` (10)    | omniprésent dans `.tk-*` et `.kbd-*` |

→ **Un sweep de tokens harmoniserait au moins une cinquantaine de valeurs
en moins d'une heure de travail dirigé**.

### 1.3 Test rétention — visiteur 5e fois cette semaine

Simulation d'un usage matinal récurrent (06:30, café, scan rapide) :

**Ce qui aide à revenir** :
1. **Hero delta « X nouveautés depuis Yh »** (home.jsx:421) — excellent.
   Donne une raison concrète d'ouvrir, dispense de scanner.
2. **Streak 🔥 dans le footer sidebar** — accroche bien connue, fonctionne.
3. **Mode `recentOnly` auto-on** quand visite récente 30min-18h (app.jsx:206)
   — réduit la fatigue de scan sur les jours répétés.
4. **Zero state « Tu as fait le tour. Bravo. »** (home.jsx:506) — un des
   meilleurs moments du cockpit. Récompense la complétude.
5. **Top card collapse on read** (`.top-card.is-read { max-height: 56px }`,
   styles.css:1276) — état terminé visible mais non envahissant.

**Ce qui fatigue à la 5e fois** :
1. **Hover transform `translateY(-2px)` sur `.top-card`** (styles.css:1268).
   Charmant à la première visite, irritant en scan rapide. Sur trackpad
   ça « danse » sous le curseur. **Désactiver après J7**, ou réserver au
   thème Dawn uniquement.
2. **`animation: pulse 2s ease 3` sur `.kicker-dot` et `.sb-group-hotdot`**
   — animation 3 cycles puis arrêt, ok. Mais réapparaît à chaque mount
   de panel. **L'utilisateur quotidien voit cette animation 25× par
   semaine sur la même page.** Borner à « première visite du jour ».
3. **Sidebar à 9 groupes pliables** (selon `nav.js`) — chaque session,
   ouvrir / refermer. La persistance `cockpit-sb-open-groups` aide, mais
   **la friction décisionnelle de « où trouver Wiki ? »** subsiste.
   La command palette `Ctrl+K` (présente) règle ça pour les power-users
   mais doit être **plus visible**.
4. **`--text-md: 13px` pour le body des cards** — dense en présentiel sur
   un 27 pouces, **fatigant pour lecture quotidienne**, surtout sur
   `.top-summary` (`13.5px`, line-height 1.55, max-width pas explicite,
   peut s'étirer à 90+ caractères/ligne sur grand écran).
5. **3 paliers de lecture (`text-xs`, `text-sm`, `text-md`) sur la même
   card top** : meta en `10px`, summary en `13.5px`, title en `19px`.
   Sur grand écran, l'œil saute trop. Réduire à 2 paliers visuels
   sur la card.
6. **Switch thème automatique 22h↔06h** — bon principe, mais le **flash
   visuel à 22:00 pile** est brutal. Soit transition CSS sur les vars,
   soit rampe progressive 21h45 → 22h15.
7. **Footer info dense** (streak + cost + theme switcher + Ctrl+K) — bien
   pensé mais **chaque ligne demande un coup d'œil quotidien** alors
   que la moitié n'évolue pas (cost, theme, kbd hint). Possible de
   collapser en rail mode dès J3.

### 1.4 Quoi marche très bien (à ne pas casser)

- **Architecture data Tier1/Tier2** : la home s'affiche sans flash de
  fake data. Excellent pour la perception de fluidité.
- **Skip-link, focus-visible, ARIA, prefers-reduced-motion** : la base
  accessibilité est en place. **Au-dessus de la moyenne du web**.
- **Mobile drawer** + breakpoint 380px tighten — pensée mobile présente.
- **Command palette `Ctrl+K`** + raccourcis `Ctrl+1..8` — power user-friendly.
- **Snooze + Undo toast** sur Top du jour — comportement professionnel.
- **Audio brief** via Web Speech API — feature gratuite et utile.
- **Error boundary par panel** + retry, **pas de freeze global** — solide.

---

## 2. Matrice d'évaluation (sections × 7 critères)

Notation : 1 (problématique) → 5 (excellent). « Rétention » = ce panel
soutient-il un usage quotidien sur 30 jours ?

| Section / Panel       | Clarté | Densité | Cohérence | Interactions | Mobile | A11y | Rétention | Moyenne |
|-----------------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Sidebar               | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| Brief / Home          | 4 | 3 | 4 | 5 | 4 | 4 | 5 | **4.1** |
| Top                   | 4 | 4 | 4 | 4 | 3 | 4 | 4 | **3.9** |
| Review                | 3 | 3 | 3 | 4 | 3 | 4 | 3 | **3.3** |
| Evening               | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| Signals               | 4 | 3 | 4 | 4 | 4 | 4 | 4 | **3.7** |
| Radar                 | 4 | 3 | 4 | 3 | 3 | 3 | 4 | **3.4** |
| Recos                 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| Challenges            | 3 | 3 | 3 | 2 | 3 | 3 | 2 | **2.7** |
| Wiki                  | 3 | 3 | 4 | 4 | 2 | 4 | 4 | **3.4** |
| Opportunities         | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| Ideas (Carnet)        | 4 | 3 | 4 | 4 | 3 | 4 | 4 | **3.7** |
| Veille outils         | 3 | 4 | 3 | 3 | 3 | 3 | 4 | **3.3** |
| Jobs Radar            | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| Week                  | 4 | 3 | 4 | 3 | 3 | 3 | 4 | **3.4** |
| Jarvis chat           | 4 | 4 | 4 | 4 | 2 | 3 | 5 | **3.7** |
| Jarvis Lab            | 3 | 4 | 4 | 3 | 3 | 3 | 3 | **3.3** |
| Profile               | 3 | 3 | 3 | 3 | 3 | 3 | 2 | **2.9** |
| Perf (Forme)          | 3 | 4 | 3 | 3 | 3 | 3 | 4 | **3.3** |
| Music                 | 3 | 4 | 3 | 3 | 3 | 3 | 4 | **3.3** |
| Gaming                | 3 | 4 | 3 | 3 | 3 | 3 | 3 | **3.1** |
| Stacks                | 3 | 3 | 3 | 3 | 3 | 3 | 2 | **2.9** |
| History               | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| Search                | 4 | 3 | 4 | 4 | 4 | 4 | 3 | **3.7** |
| Veille (×5 corpus)    | 4 | 4 | 4 | 4 | 3 | 4 | 4 | **3.9** |
| **MOYENNE GLOBALE**   | **3.4** | **3.3** | **3.5** | **3.4** | **3.1** | **3.4** | **3.4** | **3.4** |

### 2.1 Top 3 forces

1. **Système de thèmes mature et cohérent.** Trois directions distinctes
   (éditorial / terminal / Swiss), pas trois variantes du même.
   Les vibe tokens (`displayWeight`, `density`, `accentShape`) sont une
   vraie bonne idée — peu de design systems perso vont aussi loin.
2. **Architecture de données Tier1/Tier2 + error boundary par panel.**
   La perception de chargement est excellente, l'app ne s'effondre
   jamais. C'est un travail de qualité production, rare en projet perso.
3. **Vocabulaire de rétention déjà câblé.** Streak, snooze, undo, zero
   state, recent toggle, hero delta « depuis ta dernière visite »,
   hero compact toggle, télémétrie 18 events typés. La couche
   comportementale est plus avancée que 90 % des dashboards perso.

### 2.2 Top 3 faiblesses

1. **Drift de tokens et fragmentation CSS.** 20 stylesheets séparés, des
   dizaines de valeurs hardcodées (13.5px, 22px, 26px) au lieu de
   tokens. La cohérence se dégrade panel par panel — Challenges et
   Opportunities semblent moins polis que Brief / Top.
2. **Mobile à deux vitesses.** Le drawer fonctionne, mais Wiki et Jarvis
   chat masquent leurs sidebars (`display:none` dans
   `styles-mobile.css`) — features perdues sans alternative pensée.
   Touch targets <44px sur les filtres `.vl-filter-pill`. La densité
   font reste desktop-grade (12-13px) sur des écrans 380px.
3. **Surface fonctionnelle qui dilue la rétention quotidienne.**
   25 panels = trop de portes d'entrée. Le brief ne devrait pas se
   perdre derrière l'arborescence sidebar. Profile, Stacks, Jarvis Lab,
   History sont des sections **outils** que l'utilisateur ne visite
   qu'une fois par semaine — elles devraient être en footer ou
   reléguées à la command palette.

---

## 3. Quick Wins & Roadmap Jarvis

### 3.1 Top 10 Quick Wins (triés par impact/effort décroissant)

| # | Titre                                              | Impact | Effort | Sections concernées          | Ratio |
|---|----------------------------------------------------|:---:|:---:|------------------------------|:--:|
| 1 | **Désactiver `translateY` hover sur cards après J7** | 4 | 1 | Top, Veille, Signaux, Opps   | 4.0 |
| 2 | **Token sweep `styles.css` (50 hardcodes → CSS vars)** | 4 | 2 | Toutes                       | 2.0 |
| 3 | **Réduire animation `pulse` à 1×/jour** (localStorage) | 3 | 1 | Home, Sidebar                | 3.0 |
| 4 | **Transition CSS sur `:root` vars pour switch thème** | 3 | 1 | Global (theme switch)        | 3.0 |
| 5 | **Repenser groupes sidebar : 4 groupes max + footer perso** | 5 | 2 | Sidebar, Nav                 | 2.5 |
| 6 | **`max-width: 70ch` sur tous les `.summary` / `.body`** | 4 | 1 | Top, Veille, Wiki, Brief    | 4.0 |
| 7 | **Touch targets ≥ 44px sur `.vl-filter-pill` mobile** | 4 | 1 | Veille (×6 corpus), Jarvis   | 4.0 |
| 8 | **Couleurs `--alert` / `--positive` avec contraste WCAG AA** | 5 | 1 | Toutes                       | 5.0 |
| 9 | **Streak meaningful : « X jours, record Y »** | 3 | 1 | Sidebar footer               | 3.0 |
|10 | **`Ctrl+K` mis en évidence J0-J3 (microcopy + halo)** | 4 | 1 | Sidebar footer + Home        | 4.0 |

**Note Win #1** : `translateY(-2px)` au hover déstabilise la grille au scan.
Cf. Fitts : la cible bouge ↔ moins facile à cliquer. Aussi mauvais sur
trackpad. → Conserver `border-color`, supprimer le transform.

**Note Win #2** : Le token sweep n'est pas cosmétique. Quand un thème ajoute
une 4e variante (ex. « editor », « ascii »), chaque hardcode est une
exception à corriger à la main.

**Note Win #8** : Vérifier le contraste WCAG AA sur les 3 thèmes :
- Dawn : `--alert: #B54B3B` sur `--bg: #F5EFE4` ≈ ratio 5.2 (AA OK).
  Mais `--alert: #B54B3B` sur `--alert-tint: #F4DDD6` ≈ ratio 3.4
  (en-dessous du AA pour text). Si on l'utilise pour du texte, fail.
- Obsidian : `--alert: #F97366` sur `--bg: #0B0D0F` ≈ ratio 5.7 (OK).
- Atlas : `--alert: #C53030` sur `--bg: #F4F4F1` ≈ ratio 5.0 (OK).
- À revérifier panel par panel — le code utilise `--alert` parfois sur
  `--alert-tint` (ex. `.delta--down`), ce qui peut faillir AA.

### 3.2 Roadmap Jarvis — 15 features avancées

Tri par composite **Impact × Faisabilité**, secondairement Wow.

| # | Feature                                       | Imp | Fais | Wow | I×F |
|---|-----------------------------------------------|:--:|:--:|:--:|:--:|
| 1 | **Brief audio matinal automatique** (ElevenLabs/Gemini Live, 90s, lien deep) | 5 | 4 | 5 | 20 |
| 2 | **« Why this ranks #1 » expansible** sur Top cards (1 phrase IA expliquant le score) | 5 | 4 | 4 | 20 |
| 3 | **Snooze intelligent** (« Réveille-moi quand X bouge » → re-surface conditionnelle) | 5 | 4 | 5 | 20 |
| 4 | **Spec drift indicator dans Jarvis Lab** (warning si code panel ≠ doc) | 4 | 5 | 3 | 20 |
| 5 | **Search → save query → digest hebdo** (« newsletter perso ») | 5 | 4 | 4 | 20 |
| 6 | **Ideas → Opportunities matchmaking** (la même IA suggère un lien quand un signal résonne avec une idée dormante) | 5 | 3 | 5 | 15 |
| 7 | **Streak « pardon » 1×/mois** (1 jour raté n'efface pas la streak) | 4 | 5 | 3 | 20 |
| 8 | **Hero summary dictée** (parler 30s à Jarvis le matin, il l'archive comme contexte de la journée) | 4 | 4 | 5 | 16 |
| 9 | **Read time réel** (mesure JS du temps passé sur l'article ouvert, ajusté pour rétention) | 4 | 4 | 4 | 16 |
|10 | **Profil dynamique** : Jarvis pose 1 question/jour pour enrichir `user_profile` (max 1, dismissible) | 5 | 3 | 4 | 15 |
|11 | **Hot-reload soft des panels** (toast « new data, reload »  sans perdre le scroll) | 3 | 5 | 3 | 15 |
|12 | **Brief hebdo PDF** (export shippable du résumé veille S-1, avec graphes signals) | 4 | 4 | 4 | 16 |
|13 | **Carte des concepts wiki** (force-directed graph des `wiki_concepts` reliés via `mentions`) | 3 | 3 | 5 | 9 |
|14 | **Mode « pomodoro lecture »** (25 min lecture, Jarvis annonce « pause », streak +1) | 3 | 4 | 4 | 12 |
|15 | **Cockpit voice mode** (Web Speech API + Jarvis local : « Lis-moi le top 1 », « Marque comme lu ») | 4 | 3 | 5 | 12 |

### 3.3 Mockups textuels

**Mockup A — Win #1 + Win #6 + Win #10 — la home revue**

```
┌─────────────────────────────────────────────────────────────────┐
│ S18 · J122 / Brief du jour · vendredi 1er mai                   │
│                                  [▶ Lecture audio · 4 min] [✓]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ● DEPUIS TA DERNIÈRE VISITE — 14H                               │
│   · 6 nouveaux articles · 89 au total                           │
│                                                                 │
│ 6 nouveautés depuis 14h.                                        │
│                                                                 │
│ ┌────────────────────────────────────────────────────────┐     │
│ │ TECHCRUNCH · OpenAI publie GPT-5.5...        92        │     │
│ │ ARXIV     · Mixture of Reasoners...           87        │     │
│ │ HUGGING…  · Nouveau modèle vision...          84        │     │
│ │ + 3 plus                                                │     │
│ └────────────────────────────────────────────────────────┘     │
│                                                                 │
│ Synthèse : OpenAI accélère sur le raisonnement…                 │
│ (max 70ch, font-size 15px, line-height 1.65)                    │
│                                                                 │
│ [Lire les 4 nouveautés →]   [Parcourir les 89 articles]         │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐  À TRAITER│
│  │ ▼ Voir le brief macro complet (replié)           │  ┌─────┐  │
│  └──────────────────────────────────────────────────┘  │  6  │  │
│                                                        │ art.│  │
│                                                        │ +2🔥 │  │
│                                                        └─────┘  │
└─────────────────────────────────────────────────────────────────┘

Différences vs actuel :
- Hover translateY supprimé (cards stables au scan)
- max-width 70ch sur le body
- Badge « +2🔥 » dans la todo card = signaux émergents
- Plus de pulse à chaque mount, juste à la 1ère visite du jour
```

**Mockup B — Feature roadmap #2 « Why this ranks #1 »**

```
┌──────────────────────────────────────────────────────┐
│ 01     OPENAI · 4 min · #1                            │
│  ▮▮▮▮▮ 92                                              │
│        OpenAI publie GPT-5.5 avec raisonnement       │
│        symbolique intégré                             │
│                                                       │
│        Une avancée majeure sur le multi-step          │
│        reasoning, avec 23% de gain sur GSM8K…        │
│                                                       │
│        [▼ Pourquoi ce classement ?]                   │
│        ╔═══════════════════════════════════════╗      │
│        ║ Score 92/100 — 3 raisons :            ║      │
│        ║ • Aligné avec ton gap « Reasoning »   ║      │
│        ║ • Cité 4× dans le top des signaux S18 ║      │
│        ║ • Source critique pour ta mission RTE ║      │
│        ║                       — Jarvis        ║      │
│        ╚═══════════════════════════════════════╝      │
│                                                       │
│        gpt-5  reasoning  benchmark      🔖 💬 ⏰      │
└──────────────────────────────────────────────────────┘

Click expand → fetch /chat?prompt=explain_rank&article_id=…
réponse cachée 24h en localStorage (1 appel max/article/jour).
```

**Mockup C — Feature roadmap #6 « Ideas ↔ Opportunities matchmaking »**

```
┌──────────────────────────────────────────────────────────┐
│ 💡 CARNET D'IDÉES · vue pipeline                         │
│ ┌──────────┬──────────┬──────────┬──────────┐          │
│ │ Capture  │ Incub.   │ Mature   │ En cours │          │
│ ├──────────┼──────────┼──────────┼──────────┤          │
│ │          │ ✦ Coach  │          │          │          │
│ │ Idée 12  │   pdf    │ MCP RTE  │ Cockpit  │          │
│ │          │   ↑42j   │ Jarvis…  │ live     │          │
│ │          │  ┌─────┐ │          │          │          │
│ │          │  │ 🔥  │ │          │          │          │
│ │          │  │NEW  │ │          │          │          │
│ │          │  └─────┘ │          │          │          │
│ │          │          │          │          │          │
│ └──────────┴──────────┴──────────┴──────────┘          │
│                                                          │
│ 🔥 = Jarvis a vu un signal cette semaine qui résonne    │
│      avec cette idée. Cliquer pour voir le lien.        │
│                                                          │
│ ┌────────────────────────────────────────────────┐      │
│ │ "Coach pdf personnalisé"                        │      │
│ │   ↗ Signal S18 : "RAG sur PDF" mention +180%    │      │
│ │   ↗ Article : Anthropic publie Document Tools   │      │
│ │   → Tu hibernes cette idée depuis 42 jours.     │      │
│ │     Jarvis pense que c'est le moment.           │      │
│ │                                                  │      │
│ │   [Réveiller l'idée]   [Snooze 7 jours]          │      │
│ └────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘

Backend : un cron hebdo Claude Haiku qui croise IDEAS_DATA
×  signal_tracking + articles. Score → flag boolean
business_ideas.has_signal_match.
```

---

## 4. Prompts Claude Code

### Format général

Chaque prompt est auto-suffisant. Claude Code peut l'exécuter sans avoir
lu le reste de l'audit. Les prompts citent les fichiers réels du repo
(pas le mythe « index.html monolithe »). Tag `[UX]` pour quick wins, `[JARVIS]`
pour features avancées.

---

### Prompt 1 — [UX] Désactiver hover translateY sur cards après J7

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css` (section TOP CARDS, ligne ~1265)

```
Tu travailles dans le repo `jarvis-cockpit` (React 18 via @babel/standalone,
no build, CSS Custom Properties 3 thèmes).

CONTEXTE : Les cards de l'accueil (`.top-card`) ont actuellement un effet
hover qui les soulève de 2px (`transform: translateY(-2px)`) +
`box-shadow: var(--shadow-md)`. C'est charmant à la première visite mais
fatigant en scan rapide quotidien — la grille « danse » sous le curseur.

OBJECTIF : Désactiver le translateY après 7 jours d'usage, conserver
seulement le changement de border-color qui suffit comme feedback visuel.

INSTRUCTIONS :

1. Dans `cockpit/styles.css`, repérer le bloc `.top-card:hover` (autour
   de la ligne 1265). Actuellement :

   .top-card:hover {
     border-color: var(--bd2);
     box-shadow: var(--shadow-md);
     transform: translateY(-2px);
   }

2. Modifier ce bloc pour conditionner le transform à un attribut :

   .top-card:hover {
     border-color: var(--bd2);
     box-shadow: var(--shadow-md);
   }
   :root[data-bling="full"] .top-card:hover {
     transform: translateY(-2px);
   }

3. Dans `cockpit/app.jsx` (autour de la ligne 410, dans le useEffect
   qui gère `cockpit-first-seen`), ajouter une logique pour calculer
   l'attribut data-bling :

   useEffect(() => {
     try {
       const firstSeen = localStorage.getItem("cockpit-first-seen");
       const days = firstSeen ? (Date.now() - parseInt(firstSeen, 10)) / 86400000 : 0;
       const bling = days < 7 ? "full" : "calm";
       document.documentElement.dataset.bling = bling;
     } catch { document.documentElement.dataset.bling = "calm"; }
   }, []);

4. Appliquer la même règle aux autres cards qui ont le même effet :
   - `.sig-card` dans `cockpit/styles-signals.css` (chercher `transform`)
   - `.opp-card` dans `cockpit/styles-opportunities.css`
   - `.idea-card` dans `cockpit/styles-ideas.css`
   - `.vl-feed-item` dans `cockpit/styles.css` ou `styles-veille.css`

CONTRAINTES :
- Vanilla CSS + tokens existants. Pas de framework.
- Préserver les transitions (`transition: all 160ms`).
- Pas de migration de données.
- Le user peut forcer le mode "full" en posant `localStorage.setItem("cockpit-bling", "full")`.

VALIDATION :
- Survoler une top card avant J7 → soulèvement subtil + ombre.
- Survoler après J7 (ou en passant `localStorage.setItem("cockpit-first-seen", "0")`)
  → seulement border + shadow, pas de mouvement vertical.
- Vérifier visuellement sur les 3 thèmes (Dawn / Obsidian / Atlas).
```

---

### Prompt 2 — [UX] Token sweep — remplacer 50 valeurs hardcodées par les CSS vars

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css` principalement

```
Tu travailles dans le repo `jarvis-cockpit`. Le projet utilise un design
system à base de CSS Custom Properties (3 thèmes Dawn / Obsidian / Atlas
définis dans `cockpit/themes.js`). De nombreuses valeurs sont hardcodées
dans `cockpit/styles.css` au lieu d'utiliser les tokens.

OBJECTIF : Faire une passe de remplacement systématique pour augmenter la
cohérence cross-thèmes et simplifier l'ajout d'un 4e thème.

TABLE DE CORRESPONDANCE À APPLIQUER :

  font-size: 13.5px       → font-size: var(--text-md)         /* 13 */
  font-size: 16px         → font-size: var(--text-lg)         /* 15 */
  font-size: 19px         → font-size: var(--text-xl)         /* 18 */
  font-size: 22px         → font-size: var(--text-2xl)        /* 22 */
  font-size: 26px         → font-size: var(--text-3xl)        /* 28 */
  font-size: 10.5px       → font-size: var(--text-2xs)        /* 10 */
  font-size: 11px         → font-size: var(--text-xs)         /* 11 */
  font-size: 12.5px       → font-size: var(--text-sm)         /* 12 */
  font-size: 13px         → font-size: var(--text-md)
  font-size: 14px         → font-size: var(--text-md)         /* arbitrer */
  font-size: 15px         → font-size: var(--text-lg)
  font-size: 18px         → font-size: var(--text-xl)
  font-size: 20px         → font-size: var(--text-2xl)        /* arbitrer */
  padding: 22px           → padding: var(--space-5)            /* 24 */
  padding: 24px           → padding: var(--space-5)
  padding: 28px           → padding: var(--space-6)            /* 32 */
  padding: 32px           → padding: var(--space-6)
  padding: 40px           → padding: var(--space-7)            /* 48 */
  padding: 44px           → padding: var(--space-7)            /* arbitrer */
  margin-bottom: 26px     → margin-bottom: var(--space-5)
  gap: 56px               → gap: var(--space-8)                /* 64 */

INSTRUCTIONS :

1. Ouvrir `cockpit/styles.css`.
2. Pour chaque hardcode listé, vérifier les occurrences :
   - Si la valeur est très proche d'un token (<=2px d'écart), remplacer.
   - Si la valeur est arbitraire (ex. 22px, où le token le plus proche
     est 24px), remplacer par le token le plus proche **sauf** si la
     règle est dans un mockup spécifique (ex. modal width 640px).
3. Faire la même passe sur les fichiers à fort volume :
   - `cockpit/styles-signals.css`
   - `cockpit/styles-opportunities.css`
   - `cockpit/styles-veille-outils.css`
   - `cockpit/styles-radar.css`
4. Ne PAS toucher aux valeurs <= 4px ou >= 80px (cas particuliers).
5. Ne PAS modifier `cockpit/styles-mobile.css` qui utilise `!important`
   pour des overrides précis.

CONTRAINTES :
- Pas de modification de comportement, seulement substitution.
- Si une valeur n'a pas de token équivalent, la laisser et ajouter un
  commentaire `/* TODO: token ? */` au-dessus.
- Diff bien lisible (un commit, un fichier par section logique).

VALIDATION :
- `git diff --stat cockpit/styles.css` doit montrer ~50 lignes modifiées.
- Charger l'app sur les 3 thèmes : aucune régression visuelle.
- Tester en switchant le `--text-md` à 14px dans `themes.js` → l'écart
  doit se propager partout (preuve que la substitution a marché).
```

---

### Prompt 3 — [UX] Calmer les animations pulse à 1×/jour

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`, `cockpit/home.jsx`,
`cockpit/sidebar.jsx`

```
Tu travailles dans le repo `jarvis-cockpit` (React via @babel/standalone).

CONTEXTE : Les éléments `.kicker-dot` et `.sb-group-hotdot` ont une
animation `pulse 2s ease 3` (3 cycles puis arrêt) qui se relance à
chaque mount du composant. Sur un usage quotidien (le user revient
~5×/jour), l'animation joue 35×/semaine sur les mêmes éléments — soit
au-dessus du seuil de fatigue visuelle (cf. WCAG 2.3.3, "animation
caused by interaction"). Anthropic a identifié que les utilisateurs
manager/RTE en ouverture matinale fréquente ressentent ces effets
comme du bruit.

OBJECTIF : Limiter le pulse à la première visite calendaire du jour.

INSTRUCTIONS :

1. Dans `cockpit/styles.css`, repérer la règle `.kicker-dot` (autour de
   la ligne 611) et `.sb-group-hotdot` (ligne 230). Les animations
   actuelles :

   .kicker-dot { animation: pulse 2s ease 3; animation-fill-mode: forwards; }
   .sb-group-hotdot { animation: sbHotPulse 2s ease 3; animation-fill-mode: forwards; }

2. Conditionner via un attribut `data-pulse` sur `:root` :

   :root[data-pulse="on"] .kicker-dot { animation: pulse 2s ease 3; animation-fill-mode: forwards; }
   :root[data-pulse="on"] .sb-group-hotdot { animation: sbHotPulse 2s ease 3; animation-fill-mode: forwards; }

   (Ne plus déclencher l'animation par défaut.)

3. Dans `cockpit/app.jsx` (avant le mount React, ou dans un useEffect
   au début du composant App), ajouter cette logique :

   useEffect(() => {
     try {
       const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
       const lastPulseDay = localStorage.getItem("cockpit-pulse-day");
       if (lastPulseDay !== todayKey) {
         document.documentElement.dataset.pulse = "on";
         localStorage.setItem("cockpit-pulse-day", todayKey);
       } else {
         document.documentElement.dataset.pulse = "off";
       }
     } catch { document.documentElement.dataset.pulse = "off"; }
   }, []);

4. **Ne pas casser le respect de `prefers-reduced-motion`** déjà en
   place (styles.css:621). Vérifier que la règle est conservée :

   @media (prefers-reduced-motion: reduce) {
     .kicker-dot, .sb-group-hotdot { animation: none; }
   }

CONTRAINTES :
- L'animation reste possible le matin (1ère visite du jour).
- Si l'user reload la page 4× dans la même journée, pas de pulse.
- Pas de migration localStorage : la clé `cockpit-pulse-day` est créée
  à la volée.

VALIDATION :
- Ouvrir l'app le matin → kicker-dot pulse 3 fois.
- Reload → pas de pulse.
- Le lendemain (ou en posant `localStorage.removeItem("cockpit-pulse-day")`),
  pulse à nouveau.
- Activer `prefers-reduced-motion` dans le système → jamais de pulse.
- Confirmer que telemetry track "first_pulse_today" si tu veux mesurer.
```

---

### Prompt 4 — [UX] Transition CSS sur switch thème

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`

```
Tu travailles dans le repo `jarvis-cockpit`. L'app utilise un système de
3 thèmes (Dawn / Obsidian / Atlas) qui s'applique en muant les CSS
Custom Properties sur `:root`. Le switch automatique 22h ↔ 06h donne
un flash brutal car aucune transition n'est définie sur les vars.

OBJECTIF : Adoucir la transition de thème sans pénaliser les autres
animations.

INSTRUCTIONS :

1. Ajouter en début de `cockpit/styles.css` (juste après le reset, vers
   la ligne 30) :

   /* Smooth theme transitions on the most visible vars */
   :root {
     transition:
       background-color 280ms ease,
       color 280ms ease;
   }
   body {
     transition:
       background-color 280ms ease,
       color 280ms ease;
   }
   /* Surfaces, borders, accents */
   .sb,
   .top-card,
   .sig-card,
   .opp-card,
   .idea-card,
   .vl-feed-item,
   .hero,
   .block,
   .btn,
   .card-action,
   .kbd-panel,
   .tk-panel,
   .ph,
   .hwk-wrap {
     transition:
       background-color 280ms ease,
       border-color 280ms ease,
       color 280ms ease;
   }

2. **Important** : ne pas mettre `transition: all` (pénaliserait les
   hover transforms et les anims de scroll).

3. Respecter prefers-reduced-motion :

   @media (prefers-reduced-motion: reduce) {
     :root, body, .sb, .top-card, .sig-card, .opp-card, .idea-card,
     .vl-feed-item, .hero, .block, .btn, .card-action, .kbd-panel,
     .tk-panel, .ph, .hwk-wrap {
       transition: none;
     }
   }

4. **Bonus optionnel** : décorrélée de cette tâche, mais à signaler —
   le switch auto à 22:00 dans `cockpit/app.jsx:248` pourrait être
   adouci en rampe progressive sur 30min (21h45 → 22h15 transition
   linéaire des `--bg`, `--tx` entre Dawn et Obsidian). Pas implémenter
   tout de suite mais documenter en TODO.

CONTRAINTES :
- 280ms = sweet spot perceptible/rapide.
- Pas de cascade `*` qui ralentirait tout.
- Respect WCAG 2.3.3 (reduced-motion).

VALIDATION :
- Cliquer manuellement sur les boutons thème dans la sidebar
  (Dawn/Obsidian/Atlas) : transition fluide, pas de flash.
- Tester avec prefers-reduced-motion → switch instantané.
```

---

### Prompt 5 — [UX] Largeur de lecture confortable (max-width 70ch)

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`, peut-être `styles-veille-outils.css`

```
Tu travailles dans le repo `jarvis-cockpit`. Sur grand écran (≥1440px),
les paragraphes s'étirent au-delà de 90 caractères/ligne, ce qui dégrade
la lisibilité (cf. The Elements of Typographic Style — 45 à 75 ch
optimal). En particulier, `.top-summary`, `.hero-body`, `.opp-body`,
`.wiki-body` sont impactés.

OBJECTIF : Imposer une largeur de lecture confortable sur les blocs
prose, sans casser les grilles.

INSTRUCTIONS :

1. Dans `cockpit/styles.css`, modifier ou ajouter :

   .hero-body { max-width: 64ch; }   /* déjà en place — vérifier */
   .top-summary { max-width: 60ch; }
   .top-title { max-width: 26ch; }   /* texte titre = plus court */
   .hero-title { max-width: 18ch; }  /* déjà très court par design */
   .section-title { max-width: 26ch; }

2. Dans `cockpit/styles-opportunities.css`, ajouter :

   .opp-body { max-width: 70ch; }
   .opp-title { max-width: 28ch; }

3. Dans `cockpit/styles-wiki.css`, ajouter :

   .wiki-body, .wiki-description { max-width: 70ch; }

4. Dans `cockpit/styles-signals.css`, ajouter :

   .sig-card-context { max-width: 50ch; }

5. Pour les feeds Veille (`.vl-item-summary`, `.vl-item-title`),
   ajouter dans `cockpit/styles.css` ou le fichier dédié :

   .vl-item-summary { max-width: 70ch; }
   .vl-item-title { max-width: 36ch; }

CONTRAINTES :
- Pas de `max-width` sur les conteneurs grid/flex (casserait les colonnes).
- Texte center reste full-width.
- Sur mobile (≤760px), `max-width` n'a pas d'effet visible
  (l'écran est plus étroit), pas besoin d'override.

VALIDATION :
- Sur écran 27 pouces, ouvrir le brief : les paragraphes ne dépassent
  pas 70ch même quand la card a 1200px de large.
- Vérifier que le scan vertical est plus rapide sur les 3 incontournables.
- Mesurer le ratio « ch par ligne » dans devtools (env. 60).
```

---

### Prompt 6 — [UX] Touch targets ≥44px sur tous les filtres mobile

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles-mobile.css`

```
Tu travailles dans le repo `jarvis-cockpit`. WCAG 2.5.5 Target Size
(Level AAA) recommande des cibles tactiles de 44×44px minimum. Plusieurs
filtres et chips dans `cockpit/styles-mobile.css` sont à 28-32px de
hauteur, ce qui rend les filtres frustrants au pouce sur iOS/Android.

OBJECTIF : Bumper toutes les cibles tactiles à 44px sur mobile, tout en
préservant la densité visuelle desktop.

INSTRUCTIONS :

1. Dans `cockpit/styles-mobile.css`, dans le bloc `@media (max-width: 760px)`,
   ajouter ou modifier :

   .vl-filter-pill,
   .vl-prod-filter {
     min-height: 44px;
     padding: 10px 14px !important;
     font-size: 13px !important;  /* léger up vs desktop */
   }

2. Pour les boutons de raccourcis sur la home (toggle, recent), vérifier :

   .home-toggle-btn,
   .recent-toggle {
     min-height: 44px;
     padding: var(--space-3) var(--space-4);
   }

3. Pour les chips de filtre sur Wiki, Opportunities, Ideas :

   .wiki-filter-chip,
   .opp-filter-chip,
   .ideas-filter-chip {
     min-height: 44px;
     padding: 10px 14px;
   }

4. Pour les card-action déjà bumpées (lignes 279-287 actuelles) qui ont
   width:44px / height:44px, vérifier qu'elles ont aussi `min-height:44px`
   (pas que `height`) pour iOS Safari.

5. Boutons de pagination, retry buttons : appliquer la règle.

CONTRAINTES :
- N'affecte que ≤ 760px viewport.
- Ne pas casser la densité desktop.
- Si un bouton est dans un row scrollable horizontal (filter chips),
  veiller à ce que `flex-wrap: wrap` reste actif pour éviter le scroll
  horizontal forcé.

VALIDATION :
- Émulation iPhone 14 dans Chrome devtools.
- Tap sur chaque filtre : pas de mistap, pas besoin de zoomer.
- Mesurer dans devtools : computedStyle.height ≥ 44px.
- Test rapide sur appareil réel si possible.
```

---

### Prompt 7 — [UX] Streak meaningful (record + microcopy)

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Tu travailles dans le repo `jarvis-cockpit`. La sidebar footer affiche
le streak ("X jours d'affilée") mais ne donne pas de contexte
historique. Sans repère, la motivation s'érode après 30 jours.

OBJECTIF : Ajouter un champ "record personnel" calculé en localStorage
+ microcopy variable selon le moment.

INSTRUCTIONS :

1. Dans `cockpit/sidebar.jsx`, juste avant le rendu du Streak (ligne ~160),
   calculer :

   const streak = Number.isFinite(data.stats.streak) ? data.stats.streak : null;
   const record = React.useMemo(() => {
     try {
       const r = parseInt(localStorage.getItem("cockpit-streak-record") || "0", 10);
       const next = streak !== null && streak > r ? streak : r;
       if (next !== r) localStorage.setItem("cockpit-streak-record", String(next));
       return next;
     } catch { return 0; }
   }, [streak]);

   const streakKicker = React.useMemo(() => {
     if (streak === null || streak === 0) return "streak veille";
     if (streak === record) return "🏆 record !";
     if (record - streak <= 3 && record > 5) return `record à ${record}`;
     return `record perso ${record}j`;
   }, [streak, record]);

2. Remplacer dans le rendu du composant Streak :

   <span>streak veille</span>
   <span className="sb-foot-next">prochain 06:00</span>

   par :

   <span>{streakKicker}</span>
   <span className="sb-foot-next">prochain 06:00</span>

3. Si `streak === record && record > 1`, ajouter une classe spéciale au
   conteneur :

   <div className={`sb-foot-streak ${streak === record && record > 1 ? "is-record" : ""}`}>

4. Dans `cockpit/styles.css`, ajouter :

   .sb-foot-streak.is-record {
     background: var(--brand-tint);
     border-color: var(--brand);
   }
   .sb-foot-streak.is-record .sb-foot-streak-num {
     color: var(--brand);
   }

5. Optionnel : tracker "streak_record_hit" dans la télémétrie (le jour
   où le user touche son record).

CONTRAINTES :
- localStorage seulement, pas de migration backend.
- Si Supabase reset (auth), le record reste local — ok pour usage perso.
- Quand `streak < record`, ne pas dramatiser (juste afficher discret).

VALIDATION :
- Forcer streak = 0 → "streak veille"
- Forcer streak = 5 et record = 5 → "🏆 record !" + fond brand-tint
- Forcer streak = 12 et record = 14 → "record à 14"
- Forcer streak = 20 et record = 14 → record auto-update à 20.
```

---

### Prompt 8 — [UX] Mise en évidence du Ctrl+K à J0-J3

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Tu travailles dans le repo `jarvis-cockpit`. La command palette `Ctrl+K`
existe (`cockpit/command-palette.jsx`) mais n'est visible que dans le
footer sidebar comme un petit kbd hint. Les nouveaux users la découvrent
rarement avant J7. Elle est pourtant la solution la plus rapide pour
naviguer entre 25 panels.

OBJECTIF : Rendre la command palette découvrable en J0-J3.

INSTRUCTIONS :

1. Dans `cockpit/sidebar.jsx`, juste avant `<div className="sb-foot-bottom">`
   (ligne ~210), insérer un nudge initial conditionnel :

   const [nudgeOpen, setNudgeOpen] = React.useState(() => {
     try {
       const seenCount = parseInt(localStorage.getItem("cockpit-cp-nudge-seen") || "0", 10);
       const dismissed = localStorage.getItem("cockpit-cp-nudge-dismissed") === "1";
       return !dismissed && seenCount < 3;
     } catch { return false; }
   });
   React.useEffect(() => {
     if (nudgeOpen) {
       try {
         const seenCount = parseInt(localStorage.getItem("cockpit-cp-nudge-seen") || "0", 10);
         localStorage.setItem("cockpit-cp-nudge-seen", String(seenCount + 1));
       } catch {}
     }
   }, [nudgeOpen]);

   {nudgeOpen && (
     <div className="sb-foot-nudge" role="status">
       <div className="sb-foot-nudge-body">
         <span className="sb-foot-nudge-icon">⌘</span>
         <div>
           <strong>Astuce</strong>
           <p>Tape <kbd>{kbdSym}</kbd>+<kbd>K</kbd> pour tout chercher.</p>
         </div>
       </div>
       <button
         className="sb-foot-nudge-x"
         onClick={() => {
           try { localStorage.setItem("cockpit-cp-nudge-dismissed", "1"); } catch {}
           setNudgeOpen(false);
         }}
         aria-label="Masquer l'astuce"
       >×</button>
     </div>
   )}

2. Dans `cockpit/styles.css`, ajouter :

   .sb-foot-nudge {
     display: flex;
     align-items: flex-start;
     gap: var(--space-2);
     padding: var(--space-3);
     background: var(--brand-tint);
     border: 1px solid var(--brand);
     border-radius: var(--radius);
     position: relative;
     animation: sbNudgeIn 320ms ease-out;
   }
   @keyframes sbNudgeIn {
     from { opacity: 0; transform: translateY(8px); }
     to { opacity: 1; transform: translateY(0); }
   }
   .sb-foot-nudge-icon {
     font-family: var(--font-mono);
     font-size: var(--text-xl);
     color: var(--brand);
     line-height: 1;
   }
   .sb-foot-nudge strong {
     display: block;
     font-size: var(--text-sm);
     font-weight: 600;
     color: var(--tx);
     margin-bottom: 2px;
   }
   .sb-foot-nudge p {
     font-size: var(--text-xs);
     color: var(--tx2);
     line-height: 1.4;
   }
   .sb-foot-nudge p kbd {
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     padding: 1px 5px;
     background: var(--surface);
     border: 1px solid var(--bd);
     border-radius: 3px;
   }
   .sb-foot-nudge-x {
     position: absolute;
     top: 6px; right: 8px;
     background: none;
     border: none;
     color: var(--tx3);
     font-size: var(--text-lg);
     cursor: pointer;
     line-height: 1;
   }
   .sb-foot-nudge-x:hover { color: var(--tx); }
   .sb.is-collapsed .sb-foot-nudge { display: none; }

3. Tracker la dismiss dans la télémétrie pour mesurer l'adoption :

   try { window.track && window.track("cp_nudge_dismissed", { seen_count: ... }); } catch {}

CONTRAINTES :
- Apparaît max 3 fois (limit à `seenCount < 3`).
- Disparaît à la dismiss explicite (croix).
- Caché en rail mode (sidebar collapsed).
- Respecte les 3 thèmes (utilise `--brand-tint` qui change par thème).

VALIDATION :
- Première session sans localStorage → nudge visible.
- Cliquer la croix → ne réapparaît plus.
- 3 sessions sans dismiss → ne réapparaît plus à partir de la 4e.
- Tester sur Dawn / Obsidian / Atlas.
```

---

### Prompt 9 — [UX] Sidebar 4 groupes max + sections perso en footer

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/nav.js` (existe déjà), `cockpit/sidebar.jsx`,
`cockpit/styles.css`

```
Tu travailles dans le repo `jarvis-cockpit`. La sidebar a actuellement
~9 groupes pliables (Grille matinale, Veille, Apprentissage, Idées,
Outils, Vie perso, Système, etc.). Cela force le user à plier/déplier
ou à scroller verticalement pour atteindre des panels secondaires.
Surface fonctionnelle = 25 panels — trop pour une nav linéaire confortable.

OBJECTIF : Restructurer en 4 groupes principaux + un tiroir "Outils" qui
regroupe les sections rares.

INSTRUCTIONS :

1. Ouvrir `cockpit/nav.js` (source unique). Examiner la structure actuelle
   `window.COCKPIT_NAV = [{group, items}, ...]`.

2. Réorganiser en 4 groupes principaux :

   - **« Aujourd'hui »** : brief, top, review, signals, evening
   - **« Veille »** : updates, claude, sport, gaming_news, anime, news,
     veille-outils, history
   - **« Réflexion »** : ideas, opps, jobs, radar, recos, challenges, wiki
   - **« Vie perso »** : perf, music, gaming
   - **« Outils »** (compact / dernier groupe pliable, fermé par défaut) :
     jarvis, jarvis-lab, profile, stacks, search

3. Dans `cockpit/sidebar.jsx`, le composant lit déjà `data.nav` — pas de
   changement de logique. Juste mettre à jour `nav.js`.

4. Optionnel : ajouter une affordance "favoris épinglés" en haut. Mais
   ce groupe existe déjà via `sb-group--pinned` (styles.css:199). Vérifier
   son utilisation.

5. **Important** : mettre à jour `docs/specs/index.json` si la
   réorganisation impacte des labels d'onglet visibles à l'utilisateur
   (chaque tab a un spec correspondant).

6. Mettre à jour le test rétention dans le code des KEYBOARD_SHORTCUTS
   (`cockpit/app.jsx:6-21`) :

   - Le raccourci "Ctrl+1..8" pointe sur QUICK_PANELS = ["brief", "top",
     "updates", "signals", "opps", "ideas", "radar", "jarvis"]
   - Le réordonner pour qu'il colle à la nouvelle hiérarchie :
     ["brief", "top", "review", "updates", "signals", "ideas", "opps",
     "radar"]

CONTRAINTES :
- Les IDs panel ne changent PAS (deeplinks #wiki/slug-x doivent encore
  marcher).
- Les `cockpit-sb-open-groups` legacy (localStorage) doivent gracefully
  ignore les groupes inconnus — pas de migration nécessaire.

VALIDATION :
- Sidebar : 4 groupes principaux + 1 tiroir Outils (fermé par défaut).
- Hauteur sidebar à 1080px : tout visible sans scroll.
- Hauteur 720px : scroll uniquement sur le contenu des groupes ouverts.
- Deeplink `#stacks` fonctionne (panel atteignable même si pas dans le
  groupe principal — la command palette `Ctrl+K` reste la voie rapide).
- Mettre à jour `docs/specs/index.json` (selon CLAUDE.md règles spec).
```

---

### Prompt 10 — [UX] Audit contraste WCAG AA cross-thèmes

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/themes.js`, `cockpit/styles.css`

```
Tu travailles dans le repo `jarvis-cockpit`. Plusieurs combinaisons de
couleurs token sur les 3 thèmes risquent de tomber sous le seuil WCAG
AA (4.5:1 pour le texte normal, 3:1 pour le texte large ≥18px ou
≥14px gras).

OBJECTIF : Vérifier toutes les combinaisons critiques et corriger les fails.

INSTRUCTIONS :

1. Calcule le ratio de contraste pour les paires suivantes sur chaque
   thème (Dawn, Obsidian, Atlas) :

   - `--tx` sur `--bg` (corps de texte principal)
   - `--tx2` sur `--bg` (texte secondaire)
   - `--tx3` sur `--bg` (méta, kicker — texte petit)
   - `--brand` sur `--brand-tint` (badge accent)
   - `--alert` sur `--alert-tint` (deltas négatifs)
   - `--positive` sur `--positive-tint` (deltas positifs)
   - `--bg2` sur `--bg` (cards subtle distinction — niveau 3:1 ok)
   - `--tx` sur `--surface`

2. Pour chaque pair < 4.5:1 sur du texte normal :

   - Si c'est du texte large (≥18px gras ou ≥24px), seuil 3:1 acceptable.
   - Sinon, ajuster le token concerné dans `cockpit/themes.js`.

3. Cas typiquement problématiques à scruter en priorité :

   - **Dawn** : `--tx3: #766960` sur `--bg: #F5EFE4` → ratio ≈ 4.0
     (à vérifier — possiblement fail pour text < 14px). Si fail,
     foncer à `#5E524A` (qui est `--tx2`) ou à `#6B5E54` intermédiaire.
   - **Dawn** : `--alert: #B54B3B` sur `--alert-tint: #F4DDD6` ≈ 3.4
     (fail pour body, pass pour large bold).
   - **Obsidian** : `--tx3: #5C6670` sur `--bg: #0B0D0F` ≈ 4.7 (pass).
   - **Atlas** : `--tx3: #6B7075` sur `--bg: #F4F4F1` ≈ 4.0 (à vérifier).

4. Ajouter dans le repo un script de check :

   `scripts/check_contrast.mjs` :

   ```js
   // Run with: node scripts/check_contrast.mjs
   // Computes WCAG ratios for all theme combinations.
   // Imports themes.js and prints a table of pass/fail.
   import { THEMES } from "../cockpit/themes.js"; // Adapter à un export commonjs si besoin

   function rgb(hex) {
     const h = hex.replace("#", "");
     return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
   }
   function rel(c) {
     const v = c / 255;
     return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
   }
   function lum([r,g,b]) {
     return 0.2126*rel(r) + 0.7152*rel(g) + 0.0722*rel(b);
   }
   function ratio(a, b) {
     const la = lum(rgb(a));
     const lb = lum(rgb(b));
     return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
   }

   const PAIRS = [
     ["tx", "bg"],
     ["tx2", "bg"],
     ["tx3", "bg"],
     ["brand", "brand-tint"],
     ["alert", "alert-tint"],
     ["positive", "positive-tint"],
     ["tx", "surface"],
   ];
   for (const themeId of Object.keys(THEMES)) {
     const v = THEMES[themeId].vars;
     console.log("\n=== " + themeId + " ===");
     for (const [a, b] of PAIRS) {
       const fg = v["--" + a]; const bg = v["--" + b];
       if (!fg || !bg || fg.startsWith("rgba")) continue;
       const r = ratio(fg, bg);
       const status = r >= 4.5 ? "AA✓" : r >= 3 ? "AA-large✓" : "FAIL";
       console.log(`  ${a} on ${b} = ${r.toFixed(2)} ${status}`);
     }
   }
   ```

5. Exécuter le script, copier la sortie dans un fichier de log
   `docs/contrast-audit-{date}.md`, et corriger les fails dans
   `themes.js`.

CONTRAINTES :
- Ne casser aucun thème. Si un changement compromet l'identité visuelle
  (ex. Dawn ne peut pas perdre ses tons chauds), choisir un compromis
  (ex. ne pas utiliser `--tx3` pour du body text, le réserver aux meta
   très petites où une exception WCAG 1.4.3 s'applique aux "incidental"
   contenus).
- Documenter les exceptions dans le code (commentaire au-dessus du token).

VALIDATION :
- Le script imprime au moins une ligne FAIL avant correction.
- Après correction, plus aucune ligne FAIL pour les usages text body.
- Pas de régression visuelle perceptible (max ±10% de luminosité par token).
```

---

### Prompt 11 — [JARVIS] Brief audio matinal automatique 90 secondes

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `weekly_analysis.py` ou
`main.py` selon où on persiste l'audio.

```
Tu travailles dans le repo `jarvis-cockpit`. Un chip `AudioBriefChip`
existe (`cockpit/home.jsx:7`) qui utilise Web Speech API pour lire le
brief. La voix française locale est OK mais robotique. Anthropic a
identifié que l'utilisateur écoute le brief en faisant son café — un
brief de 30 secondes condensant uniquement les 3 points-clés serait plus
adapté qu'une lecture mot à mot du texte HTML.

OBJECTIF : Générer côté backend un brief audio de 60-90s synthétisé par
ElevenLabs (voix premium) ou TTS Gemini, et le servir au front via une
URL audio MP3.

DÉCISION ARCHITECTURE : 2 options.

Option A : Web Speech API + résumé dédié (faible coût, qualité moyenne).
  - main.py génère un champ `daily_briefs.audio_summary_text` (60-90s
    de prose, 3 phrases max, optimisé pour la lecture vocale).
  - Le front lit ce texte avec Web Speech API (existant).
  - Pas de coût audio. Voix robotique mais contrôlée.

Option B : ElevenLabs (~0.30 €/jour, voix excellente).
  - main.py génère le résumé court (idem A).
  - Appelle ElevenLabs API → MP3.
  - Upload sur Supabase Storage `briefs-audio/YYYY-MM-DD.mp3`.
  - Le champ `daily_briefs.audio_url` pointe sur l'URL signée.
  - Front : `<audio src={audio_url} controls />`.

→ **Implémenter Option A en priorité** (pas de surcoût). Documenter
  Option B en TODO pour plus tard.

INSTRUCTIONS POUR OPTION A :

1. Migration Supabase : ajouter une colonne `audio_summary_text TEXT`
   à `daily_briefs`. Fichier `sql/013_audio_brief.sql` :

   ALTER TABLE daily_briefs
     ADD COLUMN IF NOT EXISTS audio_summary_text TEXT;

2. Dans `main.py` (pipeline Gemini quotidien), après la génération du
   brief HTML, ajouter une étape :

   AUDIO_PROMPT = """
   Tu es un présentateur de morning brief sur l'IA pour Jean (manager
   transformation digitale). Voici la synthèse complète du brief du jour :

   {brief_html_text}

   Réécris ce brief sous forme audio :
   - 60 à 90 secondes de lecture (160-220 mots)
   - 3 phrases courtes max
   - Pas de titres, pas de listes
   - Ton direct et chaleureux, pas trop formel
   - Mentionne UNIQUEMENT les 2-3 points les plus saillants
   - Commence par "Salut Jean," et termine par "Bonne journée."
   """

   audio_text = call_gemini(AUDIO_PROMPT.format(...))
   supabase.table("daily_briefs").update({"audio_summary_text": audio_text}).eq("date", today).execute()

3. Dans `cockpit/lib/data-loader.js`, étendre `bootTier1` pour exposer
   `data.macro.audio_text` depuis `daily_briefs.audio_summary_text`.

4. Dans `cockpit/home.jsx::AudioBriefChip`, modifier `speak()` pour
   lire `audio_text` si présent, sinon fallback sur `title + body` :

   const text = (macro.audio_text && macro.audio_text.trim()) ||
                ((macro.title ? macro.title + ". " : "") + (macro.body || ""));

5. Mettre à jour le label : `\`Lecture audio · ${est} min\`` calcul
   reste mais avec `text.length / 1100` pour mieux refléter 90s.

6. Mettre à jour `docs/specs/tab-brief.md` avec la nouvelle feature
   audio (cf. CLAUDE.md règles spec).

7. Ajouter un event télémétrie :

   try { window.track && window.track("audio_brief_played", { duration_est_s: est * 60 }); } catch {}

CONTRAINTES :
- Le pipeline `main.py` tourne quotidiennement à 06h UTC ; le champ
  `audio_summary_text` doit être prêt à 6h05 max.
- Coût : 0€ (Gemini Flash-Lite gratuit).
- Si `audio_summary_text` est null, fallback sur le texte complet
  (comportement actuel).
- Pas de stockage audio binaire en option A.

VALIDATION :
- Lancer manuellement le pipeline `python main.py` → vérifier que le
  champ est rempli en base.
- Recharger la home → cliquer le chip audio → la voix lit le résumé court.
- Mesurer la durée : entre 50 et 100 secondes (cible 60-90).
```

---

### Prompt 12 — [JARVIS] « Why this ranks #1 » expansible (avec cache 24h)

**Priorité** : P2
**Dépend de** : Prompt 11 optionnel (utilise même endpoint Jarvis)
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/panel-top.jsx`,
`cockpit/styles.css`, `cockpit/lib/supabase.js`

```
Tu travailles dans le repo `jarvis-cockpit`. Sur la home et le panel
"top", chaque card affiche un score (0-100) sans explication. Le score
provient du pipeline Gemini quotidien. L'utilisateur n'a aucun moyen
de comprendre pourquoi un article est #1 plutôt que #2.

OBJECTIF : Ajouter une révélation à la demande — un click sur un bouton
"Pourquoi ce classement ?" déploie 2-3 phrases d'explication générées
par Jarvis local (ou Claude Haiku en fallback). Cache localStorage
24h pour éviter les appels répétés.

INSTRUCTIONS :

1. Dans `cockpit/home.jsx`, à l'intérieur du rendu d'une `top-card`
   (lignes ~559-621), juste avant `.top-card-foot`, ajouter :

   <RankExplanation
     article={t}
     userProfile={data.user}
     radar={data.radar}
   />

2. Créer le composant `RankExplanation` dans `cockpit/home.jsx` ou
   un fichier séparé `cockpit/components-rank-explanation.jsx` :

   function RankExplanation({ article, userProfile, radar }) {
     const [open, setOpen] = React.useState(false);
     const [reason, setReason] = React.useState(() => {
       try {
         const cache = JSON.parse(localStorage.getItem("rank-explanations") || "{}");
         const id = article._id || article.id;
         const entry = cache[id];
         if (entry && Date.now() - entry.ts < 86400000) return entry.text;
       } catch {}
       return null;
     });
     const [loading, setLoading] = React.useState(false);

     const fetchReason = async () => {
       if (reason || loading) return;
       setLoading(true);
       try {
         const prompt = `Article #${article.rank} (score ${article.score}/100) :
"${article.title}" — ${article.summary}

Profil user : ${userProfile?.role || "RTE"} chez ${userProfile?.company || "Malakoff Humanis"}.
Lacunes radar prioritaires : ${(radar?.next_gap?.axis) || "Reasoning"}.

Explique en 2-3 phrases courtes pourquoi cet article mérite ce classement
pour ce user (pertinence métier + alignement avec ses lacunes/intérêts).
Ton direct, pas de bullet points, max 220 caractères.`;

         const res = await fetch((window.JARVIS_URL || "http://localhost:8765") + "/chat", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             prompt,
             mode: "rapide",   // local Jarvis, pas de RAG
             max_tokens: 200,
           }),
         });
         if (!res.ok) throw new Error("HTTP " + res.status);
         const data = await res.json();
         const text = (data.response || "").trim();
         setReason(text);
         try {
           const cache = JSON.parse(localStorage.getItem("rank-explanations") || "{}");
           cache[article._id || article.id] = { ts: Date.now(), text };
           localStorage.setItem("rank-explanations", JSON.stringify(cache));
         } catch {}
       } catch (e) {
         setReason("Impossible de générer l'explication. Vérifie que Jarvis tourne en local.");
       } finally {
         setLoading(false);
       }
     };

     return (
       <div className="rank-exp">
         <button
           className="rank-exp-toggle"
           onClick={(e) => {
             e.stopPropagation();
             setOpen(v => !v);
             if (!reason && !loading) fetchReason();
             try { window.track && window.track("rank_explained", { rank: article.rank, cached: !!reason }); } catch {}
           }}
           aria-expanded={open}
         >
           {open ? "▼" : "▶"} Pourquoi ce classement ?
         </button>
         {open && (
           <div className="rank-exp-body" role="region">
             {loading && <span className="rank-exp-loading">Jarvis réfléchit…</span>}
             {!loading && reason && <p className="rank-exp-text">{reason}</p>}
           </div>
         )}
       </div>
     );
   }
   window.RankExplanation = RankExplanation;

3. Dans `cockpit/styles.css`, ajouter :

   .rank-exp {
     padding: var(--space-2) 0;
     border-top: 1px dashed var(--bd);
     margin-top: var(--space-2);
   }
   .rank-exp-toggle {
     font-family: var(--font-mono);
     font-size: var(--text-xs);
     letter-spacing: 0.04em;
     color: var(--tx3);
     padding: 0;
   }
   .rank-exp-toggle:hover { color: var(--brand); }
   .rank-exp-body {
     margin-top: var(--space-2);
     padding: var(--space-3);
     background: var(--brand-tint);
     border-left: 2px solid var(--brand);
     border-radius: var(--radius);
     animation: rankExpIn 220ms ease;
   }
   @keyframes rankExpIn {
     from { opacity: 0; transform: translateY(-4px); }
     to { opacity: 1; transform: translateY(0); }
   }
   .rank-exp-text {
     font-size: var(--text-sm);
     color: var(--tx);
     line-height: 1.55;
     font-style: italic;
   }
   .rank-exp-loading {
     font-family: var(--font-mono);
     font-size: var(--text-xs);
     color: var(--tx3);
   }
   @media (prefers-reduced-motion: reduce) {
     .rank-exp-body { animation: none; }
   }

4. Faire la même intégration dans `cockpit/panel-top.jsx`.

5. Enrichir le tracking : event "rank_explained" déjà câblé. Ajouter
   l'event_type dans le tableau de CLAUDE.md (cf. règle « ajouter un
   nouvel event_type »).

6. Mettre à jour `docs/specs/tab-brief.md` et `tab-top.md`.

CONTRAINTES :
- 1 appel /chat max par article et par 24h (cache localStorage).
- Si Jarvis local n'est pas joignable, fallback texte d'erreur amical.
- Pas d'appel automatique, seulement à la demande user (économie tokens).
- Le clic sur le toggle ne doit PAS ouvrir l'article (e.stopPropagation).

VALIDATION :
- Cliquer "Pourquoi ce classement ?" → spinner pendant ~2s → réponse en 2-3 phrases.
- Cliquer une 2e fois sur la même card dans la session → réponse instantanée (cache).
- Vider le cache localStorage et recliquer le lendemain → nouveau fetch.
- Désactiver Jarvis local → message d'erreur lisible.
- a11y : `aria-expanded` correct, focus-visible OK.
```

---

### Prompt 13 — [JARVIS] Snooze conditionnel (« Réveille-moi quand X bouge »)

**Priorité** : P2
**Dépend de** : Aucun, mais étend la fonction snooze existante
(`cockpit/lib/snooze.js`)
**Fichiers concernés** : `cockpit/lib/snooze.js`, `cockpit/home.jsx`,
`cockpit/panel-top.jsx`, `cockpit/styles.css`, peut-être nouveau cron.

```
Tu travailles dans le repo `jarvis-cockpit`. Le snooze actuel
(`cockpit/lib/snooze.js`) est temporel uniquement (3 jours, 7 jours).
L'utilisateur veut parfois snoozer "jusqu'à ce qu'il y ait du nouveau" —
ex. snooze un signal jusqu'à ce que sa courbe d'évolution dépasse +30%,
ou snooze un article jusqu'à ce qu'un follow-up soit publié.

OBJECTIF : Étendre snooze avec des conditions logiques — on revérifie
au prochain run du pipeline quotidien et on ré-affiche l'item si la
condition est remplie.

INSTRUCTIONS (option simple) :

1. Étendre `cockpit/lib/snooze.js` :

   const SNOOZE_KEY = "snooze-state-v2";  // bump version pour migration safe

   window.snooze = {
     // ... existant ...
     addConditional(itemId, condition) {
       // condition = { kind: "signal_delta", target_id, threshold }
       //           | { kind: "trend_change", from, to }
       //           | { kind: "topic_match", topic }
       try {
         const state = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
         state[itemId] = {
           kind: "conditional",
           condition,
           added_at: Date.now(),
         };
         localStorage.setItem(SNOOZE_KEY, JSON.stringify(state));
       } catch {}
     },
     evaluateConditional(itemId, currentData) {
       try {
         const state = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
         const entry = state[itemId];
         if (!entry || entry.kind !== "conditional") return false; // not snoozed
         const { condition } = entry;
         if (condition.kind === "signal_delta") {
           const sig = (currentData.signals || []).find(s => s.name === condition.target_id);
           if (!sig) return true; // still snoozed
           if (Math.abs(sig.delta || 0) >= condition.threshold) {
             // Trigger : remove snooze
             delete state[itemId];
             localStorage.setItem(SNOOZE_KEY, JSON.stringify(state));
             return false;
           }
         }
         // Add other condition kinds as needed
         return true;
       } catch { return false; }
     },
   };

2. Dans `cockpit/home.jsx`, ajouter un bouton secondaire à côté du
   snooze classique sur chaque top card :

   <button
     className="card-action card-action--snooze-cond"
     aria-label="Snooze conditionnel"
     title="Réveille-moi quand un signal lié bouge"
     onClick={(e) => {
       e.stopPropagation();
       // Open a tiny modal / picker
       const sigName = prompt("Snooze jusqu'à ce que le signal change ? Tape son nom (ou cancel)");
       if (!sigName) return;
       window.snooze.addConditional(t._id || t.id, {
         kind: "signal_delta",
         target_id: sigName,
         threshold: 30,
       });
       // Visual feedback
     }}
   >
     <Icon name="bell_off" size={12} stroke={2} />
   </button>

   (Le `prompt()` natif est un MVP — version polie : modal avec
    autocomplétion sur les noms de signaux, sliders pour le seuil.)

3. Dans la boucle de rendu des cards, ajouter un check :

   const isCondSnoozed = window.snooze && window.snooze.evaluateConditional(
     t._id || t.id,
     data
   );
   if (isCondSnoozed) return null; // ou afficher avec un badge "snoozé"

4. Au prochain mount de la home, le snooze conditionnel est
   automatiquement réévalué — si la condition est remplie, l'item
   ré-apparaît. Aucun cron backend nécessaire pour l'option simple.

CONTRAINTES :
- localStorage uniquement.
- 1 condition à la fois par item (pas de combinaisons booléennes
  complexes — les éviter pour MVP).
- L'UI initiale peut utiliser `prompt()` natif. Modal polie en P3.
- Tracker `snooze_conditional_added` et `snooze_conditional_triggered`.

VALIDATION :
- Snoozer un article avec condition signal "GPT-5" delta > 30.
- Reload la page → l'article est masqué.
- Modifier `signals[i].delta` à 35 (ou attendre que le pipeline le mette
  à jour) → reload → l'article réapparaît.
- Vérifier que le snooze classique (`add(id, days)`) marche toujours.
```

---

### Prompt 14 — [UX] Footer info — collapse à J3+ pour réduire le bruit

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Tu travailles dans le repo `jarvis-cockpit`. Le footer de la sidebar
contient 4 informations (streak, cost API, theme switcher, kbd hint).
Sur usage quotidien, seule la streak évolue. Les 3 autres deviennent
du bruit visuel.

OBJECTIF : Après J3, collapser automatiquement le footer en mode "rail"
(streak + un dot indiquant la dispo des autres infos sur clic).
Toujours expandable manuellement.

INSTRUCTIONS :

1. Dans `cockpit/sidebar.jsx`, ajouter en haut de la fonction Sidebar :

   const [footExpanded, setFootExpanded] = useSbLocalState("cockpit-foot-expanded", null);
   const computedFootExpanded = React.useMemo(() => {
     if (footExpanded !== null) return footExpanded;
     try {
       const firstSeen = parseInt(localStorage.getItem("cockpit-first-seen") || "0", 10);
       const days = firstSeen ? (Date.now() - firstSeen) / 86400000 : 0;
       return days < 3;
     } catch { return true; }
   }, [footExpanded]);

2. Conditionner le rendu :

   <div className={`sb-foot ${computedFootExpanded ? "is-expanded" : "is-collapsed-info"}`}>
     {/* Streak — toujours visible */}
     ...

     {computedFootExpanded ? (
       <>
         {/* Cost API */}
         {/* Theme toggle */}
         {/* Kbd hint */}
       </>
     ) : (
       <button
         className="sb-foot-show-more"
         onClick={() => setFootExpanded(true)}
         aria-expanded="false"
       >
         <Icon name="chevron_up" size={11} stroke={2} />
         <span>Plus d'info</span>
       </button>
     )}
     {computedFootExpanded && (
       <button
         className="sb-foot-show-less"
         onClick={() => setFootExpanded(false)}
         aria-expanded="true"
       >Moins</button>
     )}
   </div>

3. Dans `cockpit/styles.css`, ajouter :

   .sb-foot.is-collapsed-info {
     padding-top: var(--space-2);
     padding-bottom: var(--space-2);
   }
   .sb-foot-show-more,
   .sb-foot-show-less {
     display: inline-flex; align-items: center; gap: var(--space-1);
     padding: var(--space-1) var(--space-2);
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     letter-spacing: 0.08em;
     text-transform: uppercase;
     color: var(--tx3);
     border-radius: 999px;
     transition: color 120ms;
   }
   .sb-foot-show-more:hover,
   .sb-foot-show-less:hover { color: var(--tx); }
   .sb-foot-show-less {
     align-self: flex-end;
     margin-top: -8px;
   }

4. **Alternative** plus simple : dérouler au survol pendant 0.4s avant
   masquage. Mais cassée pour mobile/clavier — préférer le toggle explicite.

CONTRAINTES :
- L'utilisateur peut toujours expanded/collapsed manuellement (override).
- Le rail mode (sidebar collapsed entièrement) reste prioritaire — les
  règles `.sb.is-collapsed .sb-foot-cost { display: none; }` etc. ne
  changent pas.

VALIDATION :
- Première semaine : footer expanded par défaut.
- Après J3 : footer collapsed en "Plus d'info".
- Cliquer "Plus d'info" → tout s'affiche.
- Cliquer "Moins" → re-collapse.
```

---

### Prompt 15 — [JARVIS] Spec drift indicator dans Jarvis Lab

**Priorité** : P2
**Dépend de** : Aucun, mais utilise la CI `spec-drift-check` existante.
**Fichiers concernés** : `cockpit/panel-jarvis-lab.jsx`,
`docs/specs/index.json`, peut-être nouveau script.

```
Tu travailles dans le repo `jarvis-cockpit`. Le projet a une discipline
forte : chaque panel a un spec dans `docs/specs/tab-<slug>.md` mis à
jour quand le code du panel change. Une CI `spec-drift-check` détecte
les dérives mais reste warning-only.

OBJECTIF : Exposer dans Jarvis Lab un indicateur visuel des panels dont
le spec est obsolète par rapport au code (calculé en buildtime ou via
l'API GitHub).

INSTRUCTIONS :

1. Créer un script Node `scripts/spec_freshness.mjs` qui :
   - Lit `docs/specs/index.json` (chaque entrée a un champ `last_updated`
     "YYYY-MM-DD").
   - Pour chaque panel, détermine via `git log -1 --format=%ci -- <code_path>`
     la date du dernier commit touchant le code source associé
     (ex. `cockpit/panel-radar.jsx` pour `tab-radar.md`).
   - Compare les 2 dates : si le code est plus récent que le spec de
     plus de 7 jours, marque comme "drift".
   - Écrit le résultat dans `docs/specs/freshness.json` :

     {
       "generated_at": "2026-05-01T12:00:00Z",
       "items": [
         { "tab": "radar", "spec_age_days": 12, "code_age_days": 3, "drift": true },
         { "tab": "brief", "spec_age_days": 1, "code_age_days": 1, "drift": false },
         ...
       ]
     }

2. Lancer ce script dans la CI (workflow `.github/workflows/lint-specs.yml`
   ou nouveau `.github/workflows/spec-freshness.yml`) avec
   `actions/upload-artifact` ou commit-back via PR.

3. Dans `cockpit/panel-jarvis-lab.jsx`, fetch ce JSON :

   const [freshness, setFreshness] = useState(null);
   useEffect(() => {
     fetch("/docs/specs/freshness.json")
       .then(r => r.json())
       .then(setFreshness)
       .catch(() => setFreshness({ items: [] }));
   }, []);

4. Ajouter une section "Drift specs" en haut du panel Jarvis Lab :

   <section className="jl-drift">
     <div className="jl-drift-head">
       <h3>Spec drift — onglets potentiellement obsolètes</h3>
       <span className="jl-drift-count">
         {freshness?.items.filter(i => i.drift).length || 0} drifts
       </span>
     </div>
     <ul className="jl-drift-list">
       {freshness?.items.filter(i => i.drift).map(i => (
         <li key={i.tab}>
           <strong>tab-{i.tab}</strong>
           <span>code +{i.code_age_days}j · spec +{i.spec_age_days}j</span>
           <a href={`https://github.com/ph3nixx/jarvis-cockpit/blob/main/docs/specs/tab-${i.tab}.md`}>Ouvrir le spec</a>
         </li>
       ))}
     </ul>
   </section>

5. Style minimal dans `cockpit/styles-jarvis-lab.css` :

   .jl-drift { padding: var(--space-5); border: 1px solid var(--alert); border-left: 4px solid var(--alert); border-radius: var(--radius); background: var(--alert-tint); margin-bottom: var(--space-5); }
   .jl-drift-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-3); }
   .jl-drift-count { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--alert); }
   .jl-drift-list li { padding: var(--space-2) 0; border-bottom: 1px dashed var(--bd); display: flex; gap: var(--space-3); align-items: baseline; }
   .jl-drift-list li:last-child { border-bottom: none; }
   .jl-drift-list strong { font-size: var(--text-md); }
   .jl-drift-list span { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--tx3); }

6. Si freshness.items est vide ou null, afficher "✅ Tous les specs sont
   à jour".

CONTRAINTES :
- Le script Node tourne en CI ; le résultat est statique sur GitHub
  Pages (pas d'appel API live nécessaire).
- Tolérance par défaut : 7 jours.
- Le panel Jarvis Lab ne doit pas crasher si freshness.json est absent.

VALIDATION :
- Lancer `node scripts/spec_freshness.mjs` localement → freshness.json
  généré.
- Inspecter `docs/specs/freshness.json` : structure correcte.
- Modifier `cockpit/panel-radar.jsx` (ajouter un commentaire), commit,
  ne pas toucher tab-radar.md → relancer le script → "drift": true.
- Vérifier l'affichage dans Jarvis Lab.
```

---

### Checklist d'exécution

Ordre recommandé pour minimiser les conflits de merge et maximiser
l'impact rapide. Temps estimés indicatifs (Claude Code agent autonome,
PR-by-PR).

| Ordre | Prompt | Tag       | Effort | Dépendances | Cumul |
|:--:|----|----------|:--:|--------|:--:|
| 1 | P0 — Prompt 1 (hover translateY) | UX | 0.5h | — | 0.5h |
| 2 | P0 — Prompt 5 (max-width 70ch)   | UX | 0.5h | — | 1.0h |
| 3 | P0 — Prompt 3 (pulse 1×/jour)    | UX | 0.5h | — | 1.5h |
| 4 | P0 — Prompt 8 (Ctrl+K nudge)     | UX | 0.5h | — | 2.0h |
| 5 | P0 — Prompt 10 (audit contraste WCAG) | UX | 1.5h | — | 3.5h |
| 6 | P1 — Prompt 4 (transition thème) | UX | 0.5h | — | 4.0h |
| 7 | P1 — Prompt 6 (touch targets 44px) | UX | 0.5h | — | 4.5h |
| 8 | P1 — Prompt 2 (token sweep CSS)  | UX | 1.5h | — | 6.0h |
| 9 | P1 — Prompt 9 (4 groupes sidebar) | UX | 1.5h | — | 7.5h |
| 10 | P2 — Prompt 7 (streak record)   | UX | 0.5h | — | 8.0h |
| 11 | P2 — Prompt 14 (footer collapsé) | UX | 0.5h | — | 8.5h |
| 12 | P2 — Prompt 11 (audio brief 90s) | JARVIS | 2.0h | main.py | 10.5h |
| 13 | P2 — Prompt 12 (Why ranks)       | JARVIS | 2.0h | Jarvis local actif | 12.5h |
| 14 | P2 — Prompt 13 (snooze conditionnel) | JARVIS | 1.5h | snooze.js v2 | 14.0h |
| 15 | P2 — Prompt 15 (spec drift Jarvis Lab) | JARVIS | 1.5h | git log accès | 15.5h |

**Total estimé** : ~15 heures de travail Claude Code autonome.
**Wave 1 critique (P0, 3.5h)** : à exécuter d'un trait pour un effet
immédiat sur la rétention. Les 4 premiers prompts indépendants peuvent
être batched dans une même session.

---

## Annexe A — Justifications principielles

| Décision | Principe |
|---|---|
| Désactiver hover translateY | Loi de Fitts (cible mobile = plus dur à cliquer), fatigue de scan |
| Token sweep | DRY + design system theory (separation concept/value) |
| Pulse 1×/jour | WCAG 2.3.3 + habituation visuelle (Bourassa, 2014) |
| Transition thème CSS | Loi de Hick (changement abrupt = surcharge cognitive) |
| max-width 70ch | Bringhurst, *Elements of Typographic Style*, p.26 |
| Touch ≥44px | WCAG 2.5.5 + Apple HIG |
| Streak record | Self-Determination Theory (compétence) |
| Ctrl+K nudge | Affordance discovery J0-J7 (Norman, *Design of Everyday Things*) |
| 4 groupes sidebar | Miller's law 7±2 (mais 4 = scan instantané, 9 = cognitive load) |
| Audit contraste WCAG AA | Loi française accessibilité (RGAA), inclusion daltoniens |
| Brief audio 90s | Charge cognitive matinale + contexte (douche/café = pas de visuel) |
| Why this ranks | Norman *visibility of system status* + reasoning transparency |
| Snooze conditionnel | Reward intermittent + agency user (vs notifications push) |
| Footer collapsed J3+ | Density-progressive disclosure (Tognazzini) |
| Spec drift indicator | Eat your own dogfood + code/doc consistency |

---

## Annexe B — Ce que l'audit n'a PAS pu vérifier

- **Pixel-perfect render post-login** : la home, les panels Tier 2 et le
  Jarvis chat nécessitent OAuth Google — non accessible en automate.
  Les évaluations sont basées sur le code rendu et les CSS, pas sur
  l'expérience visuelle finale. **Recommandation** : faire valider les
  prompts P0 en captures d'écran avant/après par le user.
- **Performance réelle** : pas de Lighthouse / Core Web Vitals mesurés.
  Le pattern React+Babel-via-CDN n'est pas optimal en TTI mais c'est un
  choix assumé.
- **Comportement TFT panel** (`stacks` réfère probablement TFT) : non
  exploré en détail, score moyen affecté par défaut.
- **Service worker (sw.js)** : la stratégie cache-first est mentionnée
  dans CLAUDE.md mais pas auditée.

---

## Annexe C — Notes de scope

- L'audit cible **la rétention quotidienne sur 30 jours**, pas la
  conversion 1ère visite.
- Les prompts sont écrits pour Claude Code (agent autonome). Chacun
  est self-contained ; lis-en un, exécute-le, valide, passe au suivant.
- Le dossier `docs/specs/` doit être maintenu en parallèle de chaque
  changement de panel (CLAUDE.md règle cardinale). Plusieurs prompts
  rappellent cette règle.
- Aucun prompt n'introduit de nouvelle dépendance npm (le repo n'a pas
  de build step). Tout reste vanilla JSX-via-Babel + CSS Custom Properties.

---

*Fin de l'audit. Document généré le 1er mai 2026 pour le projet
`jarvis-cockpit` de Jean Lakomsky.*
