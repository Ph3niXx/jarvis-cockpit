# Audit Design Complet — AI Cockpit

**Date** : 26 avril 2026
**Auditeur** : design senior (UX, UI, design system, accessibilité, rétention)
**Scope** : <https://ph3nixx.github.io/jarvis-cockpit/> + code source `cockpit/*` + `index.html`
**Objectif prioritaire** : rétention quotidienne sur 30 jours d'usage.

---

## Note de méthode (lis avant tout)

Le brief joint décrit une stack **vanilla single-file `index.html`**. La réalité du code est **React 18 + `@babel/standalone` via CDN, no build step**, avec une architecture modulaire dans `cockpit/` :

- `cockpit/app.jsx` (router + theme switcher + raccourcis globaux)
- `cockpit/sidebar.jsx`, `cockpit/home.jsx`, **23 `panel-*.jsx`**
- 1 stylesheet de base `cockpit/styles.css` (~3 500 lignes) + **19 stylesheets dédiés** par panel + `styles-mobile.css`
- `cockpit/themes.js` : 3 systèmes complets (Dawn, Obsidian, Atlas) injectés via CSS Custom Properties sur `<html>` au mount
- 22 fichiers `data-*.js` qui exposent des `window.X_DATA` comme baselines (Tier 2 mute ces globals après fetch)
- `cockpit/lib/` : `supabase.js`, `auth.js` (Google OAuth), `data-loader.js` (Tier 1/Tier 2), `bootstrap.js`, `telemetry.js`, `snooze.js`

**J'ai donc adapté tous les prompts Claude Code à la stack réelle** — chemins `cockpit/panel-*.jsx`, conventions `window.*`, pas d'`import` ES modules (incompatible Babel standalone), tokens `var(--brand)` etc. Si je suivais le brief littéralement, les prompts seraient inexécutables.

Le site live est gaté par Google OAuth (le `<div id="root">` reste vide tant que `cockpitAuth.waitForAuth()` n'a pas résolu) — l'audit visuel est donc fait depuis le code, qui est de toute façon la source de vérité. Ce qui est en prod = ce qui est dans `main`.

---

## 1. Reconnaissance

### 1.1 Inventaire features (baseline)

| Section | Panel (fichier) | Stylesheet | Tier data | Statut |
|---|---|---|---|---|
| Brief du jour | `home.jsx` | `styles.css` | Tier 1 (sync) | Stable |
| Top du jour | `panel-top.jsx` | `styles.css` | Tier 1 | Stable |
| Ma semaine | `panel-week.jsx` | `styles.css` | Tier 1 | Stable |
| Recherche | `panel-search.jsx` | `styles.css` | Tier 1 | Stable |
| Revue (read & advance) | `panel-review.jsx` | `styles.css` | Tier 1 | Stable |
| Soirée (debrief) | `panel-evening.jsx` | `styles-evening.css` | Tier 1 | Récent |
| Veille IA / Claude / Sport / Gaming news / Anime / News | `panel-veille.jsx` (mutualisé) | `styles.css` | Tier 1 | Stable, complexe |
| Veille outils | `panel-veille-outils.jsx` | `styles-veille-outils.css` | Tier 2 | Stable |
| Wiki IA | `panel-wiki.jsx` | `styles-wiki.css` | Tier 2 | Stable |
| Signaux faibles | `panel-signals.jsx` | `styles-signals.css` | Tier 1 | Stable, dense |
| Opportunités | `panel-opportunities.jsx` | `styles-opportunities.css` | Tier 2 | Stable |
| Carnet d'idées | `panel-ideas.jsx` | `styles-ideas.css` | Tier 2 | Stable, drag&drop |
| Radar compétences | `panel-radar.jsx` | `styles-radar.css` | Tier 1 | Stable |
| Recommandations | `panel-recos.jsx` | `styles-recos.css` | Tier 2 | Stable |
| Challenges | `panel-challenges.jsx` | `styles-challenges.css` | Tier 2 | Stable |
| Jarvis (chat) | `panel-jarvis.jsx` | `styles-jarvis.css` | Tier 1 | Stable |
| Jarvis Lab | `panel-jarvis-lab.jsx` | `styles-jarvis-lab.css` | Tier 2 | Récent |
| Profil | `panel-profile.jsx` | `styles-profile.css` | Tier 2 | Stable, dense |
| Forme (Strava + Withings) | `panel-forme.jsx` | `styles-forme.css` | Tier 2 | Stable |
| Musique (Last.fm) | `panel-musique.jsx` | `styles-musique.css` | Tier 2 | Stable |
| Gaming perso (Steam) | `panel-gaming.jsx` | `styles-gaming.css` | Tier 2 | Stable |
| Stacks | `panel-stacks.jsx` | `styles-stacks.css` | Tier 2 | Récent |
| Historique | `panel-history.jsx` | `styles-history.css` | Tier 2 | Stable |
| Jobs Radar | `panel-jobs-radar.jsx` | `styles-jobs-radar.css` | Tier 2 | Stable |

**Volume** : 23 panels — c'est beaucoup. Le risque rétention n°1 est l'**érosion de la home** au profit de panels exploratoires que l'utilisateur ne visite jamais. Cf. règle de priorité ci-dessous.

### 1.2 Design system implicite

#### Cohérent (tokens respectés)

- **Espacements** : échelle 4px stricte (`--space-1` à `--space-8`). Bien.
- **Type scale** : 9 paliers (`--text-2xs` 10px → `--text-display` 54px). Bien dimensionné.
- **3 thèmes complets** avec mêmes clés : `--bg`, `--bg2`, `--bg3`, `--surface`, `--tx`, `--tx2`, `--tx3`, `--bd`, `--bd2`, `--brand`, `--brand-ink`, `--brand-tint`, `--positive`, `--positive-tint`, `--alert`, `--alert-tint`. Bonne discipline.
- **Auto theme** : Obsidian 22h-6h, Dawn ensuite, sauf override explicite (`cockpit-theme-explicit` localStorage). Subtil et bien fait.
- **Focus visible** : règle globale `:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }`. Solide pour la navigation clavier.

#### Dérives (valeurs hardcodées ou variantes one-off)

- **Couleur dérivée codée en dur** : `#b8956a` (brun "declining" pour signaux) répétée dans `styles-signals.css` au lieu d'un token (`--declining` ou `--neutral`). Présent dans 12+ règles. Casse les 3 thèmes de manière subtile.
- **Couleurs `rgba(0,0,0,0.02)` à `rgba(0,0,0,0.04)`** : utilisées comme hover pour les rangées de signaux et idées. En thème Obsidian (fond noir), ce noir-sur-noir devient invisible — il aurait fallu `color-mix(in srgb, var(--tx) 4%, transparent)`.
- **Avatar Jarvis** : `JvIcon` réimplémente toutes les icônes au lieu de réutiliser `<Icon>` de `cockpit/icons.jsx`. Duplication, dérive future garantie.
- **Tailles de bouton** : `.btn` (10px 16px), `.btn--sm` (7px 12px), `.ph-chip` (`--space-2` `--space-3`), `.card-action` (6px 10px), `.sb-link` (7px), `.btn-jarvis` (cf. `styles-jarvis.css`). 5+ tailles de bouton qui se croisent — pas de système d'échelle clair.
- **Card radius** : `var(--radius)` = 6/4/2 selon thème, mais Atlas radius 2px crée des coins quasi vifs sur cards photographiques (Steam game cards) qui auraient mérité `--radius-lg`.
- **Boutons "ask Jarvis"** : `.card-action--ask` redéclaré 3 fois (top-card, sig-card, dans les feeds). Style légèrement différent à chaque fois.

#### Densité visuelle observée

- Sur Home en thème Dawn : Hero 340px de haut, Top 3 en cards 280px, Signaux + Radar 380px, Semaine 280px, footer 50px. **~1700 px vertical** pour la home. Au-dessus du fold sur 13" : Hero seul. Sur 27" : Hero + Top 3.
- 28 paliers d'opacité différents dans le CSS (de 0.04 à 1). Trop. 4 paliers (`--text-1` 100%, `--text-2` 70%, `--text-3` 45%, `--text-disabled` 25%) suffiraient.

### 1.3 Test rétention — visite #5 de la semaine

Simulation d'un Jean qui revient mardi matin pour la 5e fois cette semaine, café à la main, 90s pour se mettre au courant.

**Friction observée :**

1. **Le Hero est statique** : "La bataille des agents passe en phase industrielle" est un titre éditorial parfait au jour 1, mais au jour 5 l'utilisateur a déjà lu cette synthèse hier. Il faut un **mode "delta depuis ta dernière visite"**. La logique existe (`visitDelta`, `newSinceVisit` dans `home.jsx:258-274`) mais elle est noyée dans le kicker — pas mise en hero.
2. **Animations à la répétition** :
   - `.kicker-dot` pulse infiniment (2s loop) — fatigant après la 3e visite
   - `.sb-group-hotdot` pulse infiniment (2s loop) dans la sidebar
   - `.hero-todo-num` est en `var(--text-display)` 64px orange brûlé — au jour 5, ce gros chiffre crie "ALARME" même quand c'est juste 8 articles routine
3. **Le Top 3 ne sait pas que tu as déjà lu** : `localStorage.read-articles` track les lus (`home.jsx:222`), mais la card lue passe à `opacity: 0.5` — ce qui veut dire qu'**elle reste visible et prend la place d'une card non-lue**. Alors que la priorité quotidienne est : voir uniquement ce qui est nouveau depuis hier.
4. **Sidebar trop dense** : 6 groupes × 3-5 items = 25 entrées de nav. La discipline open/closed par groupe (`openGroups` localStorage) atténue, mais au démarrage on retombe sur l'état stocké. Pas de "vue smart" qui montre les sections où il y a réellement du nouveau.
5. **Le bouton "Tout marqué lu"** est génial (`home.jsx:220`) avec son toast undo 6s — c'est exactement ce qu'il faut. Mais il efface le top du jour ; à la prochaine visite, qu'est-ce qui apparaît à la place ? La logique de "next 3" n'est pas évidente.
6. **Pas d'écran "rien à voir aujourd'hui"** : si l'utilisateur a tout lu et tout snoozé, le cockpit affiche probablement les mêmes cards en `is-read` — c'est démotivant. Il faut un **état zéro positif** ("Bravo, tu es à jour. Voilà 3 idées à creuser au lieu.")
7. **Audio brief existe** (`AudioBriefChip` via `speechSynthesis`) — bonne idée, sous-exploitée. Pas de chip persistante "12 min restantes" si on l'a démarrée puis quittée.
8. **Filtre "Récent · 24h"** (FAB en haut à droite, `app.jsx:496`) — superbe idée mais peu visible. Il devrait être l'**état par défaut** au-delà de la 3e visite quotidienne (heuristique : si `Date.now() - cockpit-last-visit-ts < 18h`, activer recent par défaut).

**Forces rétention déjà en place (à préserver) :**

- Streak veille en sidebar (icône flame, animation discrète)
- Compteur d'articles non-lus par groupe (`sb-unread`)
- Coût API live en sidebar (sentinel)
- Theme auto (sombre la nuit)
- Raccourcis clavier (Ctrl+K, Ctrl+1-8) et FAB d'aide
- Command palette (Ctrl+K) — le bon réflexe power user
- Snooze 3j sur cards (`home.jsx:210`)

---

## 2. Matrice d'évaluation

Échelle 1-5 (5 = excellent, 1 = à corriger urgent).

### 2.1 Sections principales

| Section | Clarté | Densité | Cohérence | Interactions | Mobile | A11y | Rétention | **Moy.** |
|---|---|---|---|---|---|---|---|---|
| Brief du jour | 4 | 4 | 4 | 4 | 4 | 4 | **3** | 3.86 |
| Top du jour | 5 | 4 | 4 | 4 | 4 | 4 | 3 | 4.00 |
| Ma semaine | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 3.71 |
| Sidebar | 4 | 3 | 4 | 4 | 4 | 4 | **3** | 3.71 |
| Veille IA (mutualisée 6 onglets) | 3 | **2** | 4 | 4 | 3 | 3 | 3 | 3.14 |
| Signaux faibles | 4 | 3 | 4 | 4 | 3 | 3 | 4 | 3.57 |
| Opportunités | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3.14 |
| Carnet d'idées | 4 | 4 | 4 | **5** | 3 | 3 | 4 | 3.86 |
| Radar compétences | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.71 |
| Recos / Challenges | 3 | 3 | 4 | 3 | 4 | 4 | 3 | 3.43 |
| Wiki IA | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 3.57 |
| Jarvis (chat) | 4 | 4 | 3 | 4 | **2** | 3 | 4 | 3.43 |
| Jarvis Lab | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 |
| Profil | 3 | **2** | 3 | 4 | 4 | 4 | 4 | 3.43 |
| Forme | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.71 |
| Musique | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.71 |
| Gaming | 4 | 4 | 4 | 3 | 4 | 3 | 3 | 3.57 |
| Stacks | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 3.14 |
| Historique | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3.86 |
| Recherche | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.00 |
| Jobs Radar | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 3.43 |
| Évening (debrief) | 3 | 4 | 3 | 3 | 4 | 3 | **5** | 3.57 |
| Revue (read & advance) | 5 | 5 | 4 | 4 | 4 | 4 | 5 | 4.43 |

**Moyenne globale : 3.61 / 5** — produit professionnellement abouti avec quelques zones critiques (densité Veille, mobile Jarvis, rétention Brief).

### 2.2 Tableau d'évolution

Pas d'audit antérieur fourni. Pour la prochaine itération, je recommande de comparer ce score moyen aux mêmes sections à 3 mois.

### 2.3 Top 3 forces

1. **Système de thèmes triple** — Dawn, Obsidian, Atlas sont 3 *vraies* directions cohérentes (pas 3 versions du même), et le switch automatique nuit/jour est subtil. Très peu de produits perso vont aussi loin. Préserve ça.
2. **Architecture data Tier 1 / Tier 2** — la home se rend en synchrone avant React mount, les autres panels lazy-load avec loader puis remount via `dataVersion`. C'est exactement la bonne logique pour un cockpit qui doit ouvrir vite. Le `PanelErrorBoundary` finit le travail.
3. **Telemetry append-only + RLS authenticated** — on a un produit perso qui se mesure, et qui n'expose rien. Beaucoup de cockpits "perso" finissent en YOLO sécurité.

### 2.4 Top 3 faiblesses

1. **Brief du jour n'a pas de mode "delta"** — au jour 5, l'utilisateur revoit le même hero. La logique `visitDelta` existe mais ne pilote pas la mise en page. C'est *le* point #1 de rétention 30j.
2. **Densité Veille IA** — `panel-veille.jsx` mutualise 6 onglets différents (Updates, Claude, Sport, Gaming, Anime, News) avec des filtres complexes (année, mois, type). Au quotidien, on cherche "qu'est-ce qui est nouveau dans Claude ?" et on doit configurer 3 filtres pour le savoir. Cf. QW#3 et QW#5.
3. **Mobile Jarvis cassé** — `styles-mobile.css:222` masque la colonne mémoire (`.jrv-panel-left { display: none !important }`) sur mobile. Du coup sur téléphone Jarvis perd son contexte visible et ne sait plus citer. C'est le canal le plus utilisé en mobilité — ça doit être traité.

---

## 3. Quick Wins & Roadmap Jarvis

### 3.1 Top 10 Quick Wins

Trié par ratio impact/effort décroissant (impact ÷ effort).

| # | Titre | Impact (1-5) | Effort (1-5) | Ratio | Sections | Description courte |
|---|---|---|---|---|---|---|
| 1 | **Hero "delta" en mode visite récurrente** | 5 | 2 | 2.50 | Home | Quand `visitDelta < 18h` ET `newSinceVisit > 0`, remplace le titre macro statique par "X nouveautés depuis hier" + 3 mini-cards des nouveaux. Le brief macro Gemini reste accessible mais en collapse. |
| 2 | **Filtre "Récent · 24h" auto-on en visite récurrente** | 4 | 1 | 4.00 | Global | Si `visitDelta < 18h`, mettre `recentOnly = true` par défaut au mount. Ajouter un microcopy `"Mode récent — voir tout"` plus visible que la pill actuelle. |
| 3 | **Animations infinies → en pulse de 1er rendu uniquement** | 4 | 1 | 4.00 | Sidebar, Home | `kicker-dot` et `sb-group-hotdot` pulse 3 fois max puis arrêt (`animation-iteration-count: 3`). Réduit la fatigue visuelle au jour 5. |
| 4 | **Cards lues "out of the way"** | 4 | 2 | 2.00 | Top, Veille | Cards lues collapsent automatiquement à hauteur 56px (titre seul) au lieu de rester opacity 0.5 et prendre 220px. Bouton "rouvrir" au clic. |
| 5 | **État zéro positif "Bravo, tu es à jour"** | 4 | 2 | 2.00 | Home | Quand 0 article non-lu ET 0 signal hot, afficher une mini-celebration + 2 idées à creuser depuis le carnet. |
| 6 | **Token `--neutral` pour remplacer `#b8956a`** | 3 | 1 | 3.00 | Signaux | Ajouter `--neutral`, `--neutral-tint` aux 3 thèmes. Replace-all dans `styles-signals.css`. |
| 7 | **Hover des rangées en `color-mix` au lieu de `rgba(0,0,0,...)`** | 3 | 1 | 3.00 | Signaux, Idées | Replace `rgba(0,0,0,0.02)` → `color-mix(in srgb, var(--tx) 3%, transparent)`. Devient invisible-on-dark au lieu de noir-sur-noir. |
| 8 | **Audio brief — chip persistante avec progression** | 3 | 2 | 1.50 | Home | Quand on quitte la home en lecture, garder une mini-chip floating avec waveform + reprendre + skip. |
| 9 | **Mobile Jarvis — drawer mémoire au lieu de masquage** | 4 | 3 | 1.33 | Jarvis | Sur mobile, transformer `.jrv-panel-left` en drawer accessible via un bouton "?" en haut, au lieu de `display: none`. |
| 10 | **Brief du jour — Reading time tag par card** | 3 | 2 | 1.50 | Top, Veille | Afficher `2 min · garde 14 mots-clés` sur chaque card pour aider à doser la session. |

### 3.2 Roadmap Jarvis — 15 features

Score composite = Impact × Faisabilité (Wow donné en bonus). Trié par composite décroissant.

| # | Titre | Impact | Faisabilité | Wow | **Composite** | Description |
|---|---|---|---|---|---|---|
| J1 | **Brief en 90 secondes "Spotify Wrapped" quotidien** | 5 | 4 | 5 | **20** | Animation de 8 cards qui défilent en 90s avec audio TTS : "Tu as lu 12 articles cette semaine · top thème = agents · ton signal à surveiller = AI Act phase 3 · ton challenge expire dans 2 jours". Pause possible. Mode preferé sur mobile. |
| J2 | **Daily replay — "qu'est-ce qui a bougé hier soir"** | 5 | 4 | 4 | **20** | Au mount le matin, 5s d'animation showing les nouveaux articles glissant dans le top, les anciens basculant en archives, le streak qui s'incrémente. Une seule fois par session. |
| J3 | **Smart sidebar — items qui ont du nouveau remontent** | 4 | 5 | 3 | **20** | Réordonne dynamiquement les items dans chaque groupe : ceux avec `unread > 0` en haut. Les groupes vides collapsent. Persiste l'ordre user si modif manuelle. |
| J4 | **Inbox Zero pour Veille — "marquer comme triés"** | 5 | 4 | 3 | **20** | Mode batch : montre articles 1 par 1 plein écran, 4 actions (lire / garder / parquer / oublier) au clavier (j/k/g/h). Sortie auto quand 0 restant. |
| J5 | **Jarvis Daily Action — 1 micro-tâche IA poussée chaque matin** | 5 | 3 | 5 | **15** | Jarvis propose **une** action de 5 min : "Étends ton skill Fine-tuning de +2 — fais ce mini-quiz", "Promeus l'idée X qui dort depuis 14j", "Réponds à cette uncomfortable question". Skip = 24h, Done = streak +1. |
| J6 | **Carnet d'idées — auto-tag par signal proche** | 4 | 4 | 3 | **16** | Quand on capture une idée, calcule similarité texte avec les `signals` actifs et propose 1 chip "lié à #agent-memory" par défaut. Accepter en Tab. |
| J7 | **Brief audio mode "voiture" — sortie en MP3** | 4 | 4 | 4 | **16** | Bouton "exporter le brief audio" qui génère un MP3 via Web Audio API recording de `speechSynthesis`. Téléchargeable, pour écoute en voiture. |
| J8 | **Radar — projection 12 mois "où tu seras si tu fais le challenge X"** | 4 | 3 | 4 | **12** | Au survol d'un challenge, afficher en transparence sur le radar la nouvelle silhouette estimée si on le complète. Slider "réalisme : aggressif/réaliste/conservateur". |
| J9 | **Wiki IA — graphe de relations cliquable** | 4 | 3 | 4 | **12** | Force-directed graph (D3) entre concepts wiki avec edges = co-occurrences dans articles. Click = ouvrir la fiche. Filtre par catégorie. |
| J10 | **Jobs Radar — score "fit Jean" expliqué** | 4 | 3 | 3 | **12** | Sur chaque offre hot, expansion qui montre le breakdown : "+2 RTE +1 SAFe +1 IA -1 stage Série A vs ta préf scaleup = 7/10". Click sur chaque ligne = pourquoi. |
| J11 | **Cockpit "weekend mode"** | 3 | 4 | 4 | **12** | Sam-Dim, masque par défaut Veille IA + RTE, met en avant Forme/Musique/Gaming/Idées. Toggle pour repasser. |
| J12 | **Mode "présentation" pour Jarvis** | 3 | 4 | 5 | **12** | Layout 3 colonnes plein écran : à gauche le contexte (mémoire), au centre la conversation, à droite les sources. Mode kiosque pour démos / partage écran. |
| J13 | **Idée → opportunité → projet, vue chronologique** | 4 | 3 | 3 | **12** | Une seule timeline horizontale qui montre les idées de leur capture à leur promotion, avec les jalons (`touched_count`, status changes). Aide à voir lesquelles stagnent. |
| J14 | **"Ask Jarvis" inline avec suggestion de 3 questions** | 4 | 3 | 3 | **12** | Sur chaque card (article, signal, opp), au survol affiche 3 questions pré-rédigées que Jarvis sait répondre depuis le RAG. Click = ouvre Jarvis avec la question prefill. |
| J15 | **Cockpit "morning briefing video" généré** | 4 | 2 | 5 | **8** | Génération hebdo d'une vidéo MP4 de 30s avec voiceover, animations CSS captées via headless Chrome, à partager en story Slack/Teams. |

### 3.3 Mockups textuels (Top 3 features)

#### Mockup 1 — Hero delta (QW#1)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ S17 · J+111  /  BRIEF DU JOUR  ·  Mardi 21 avril 2026                    │
│                                          [▶ Audio · 4 min]  [✓ Tout lu] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ⏱  DEPUIS HIER 19H — 4 NOUVEAUX                                          │
│                                                                          │
│ 4 nouveautés.                                                            │
│ ─────────────                                                            │
│                                                                          │
│ Anthropic ouvre Claude Sonnet 4.7. La régulation accélère.               │
│ Vincent Bolloré annonce un partenariat IA. Mistral pivote sur l'edge.    │
│                                                                          │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌─────────┐    │
│ │ Anthropic   2h │ │ Les Échos   3h │ │ HuggingFace 6h │ │ +1 plus │    │
│ │ Claude 4.7 GA  │ │ Bolloré IA     │ │ Mistral edge   │ │         │    │
│ │ score 92       │ │ score 88       │ │ score 81       │ │         │    │
│ └────────────────┘ └────────────────┘ └────────────────┘ └─────────┘    │
│                                                                          │
│ [ Lire les 4 nouveautés → ]    [ Voir le brief macro complet ▾ ]        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Au lieu d'imposer le titre éditorial du matin (parfait au jour 1, redondant au jour 5), on parle directement à l'utilisateur : "voilà ce qui a bougé pendant que tu n'étais pas là". Le brief macro reste accessible, en collapse — pour la première visite de la journée OU si l'utilisateur veut un récap large.

#### Mockup 2 — Inbox Zero Veille (J4)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TRI EN LOT · 12 articles non lus dans Veille IA                         │
│                                                       [Échap pour quitter]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  3 / 12                                                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ANTHROPIC · AGENTS · il y a 4h                                     │  │
│  │                                                                    │  │
│  │ Claude Agents GA — mémoire persistante et orchestration            │  │
│  │ multi-outils en natif                                              │  │
│  │                                                                    │  │
│  │ Disponibilité générale de l'API agents avec une mémoire de         │  │
│  │ contexte de 1M tokens, un routage automatique entre outils et un  │  │
│  │ SDK Python/TypeScript.                                             │  │
│  │                                                                    │  │
│  │ #agents  #anthropic  #enterprise                                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   [ J ] LIRE                  [ G ] GARDER                               │
│   [ K ] PARQUER (3j)          [ H ] OUBLIER                              │
│                                                                          │
│   ───── Progression : ▓▓▓░░░░░░░░░ 3/12 ─────                            │
└──────────────────────────────────────────────────────────────────────────┘
```

Mode plein écran, navigation 100% clavier. À la sortie, une mini-stat : "Tu as triés 12 articles en 2 min 43 — soir 13 sec/article". Dopamine de productivité.

#### Mockup 3 — Jarvis Daily Action (J5)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ MARDI 21 AVRIL · 09:14                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ✨ TON ACTION DU JOUR                            ⏱ ~5 min               │
│                                                                          │
│   « Tu as une idée parquée depuis 14 jours :                             │
│     "Coach IA pour les rétros SAFe".                                     │
│     Soit tu la promeus en opportunité (j'ai 3 angles),                   │
│     soit tu l'archives. À toi.»                                          │
│                                                                          │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────┐       │
│   │  Coach IA pour les rétros SAFe                               │       │
│   │  Capturée le 7 avril · touchée 2 fois · stage: incubating    │       │
│   │  Impact 4 · Effort 3 · Alignement 5                          │       │
│   └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
│   [ Promouvoir → ]   [ Archiver ]   [ Plus tard (24h) ]                  │
│                                                                          │
│   ─────                                                                  │
│   Streak action :  🔥 8 jours    ·    record : 14                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Une seule action par jour, pré-mâchée par Jarvis depuis l'état du cockpit (idées qui dorment, gaps radar, signaux pas adressés, uncomfortable questions). Skip = report 24h. Compléter = streak +1. C'est la pédagogie des apps de méditation appliquée à un cockpit pro.

---

## 4. Prompts Claude Code

**Ces prompts sont prêts à copier-coller dans Claude Code (le terminal CLI)** depuis `C:\Users\johnb\jarvis-cockpit`. Chaque prompt est auto-suffisant : il dit où chercher, ce qui existe, et ce qu'il faut produire.

**Conventions communes à tous les prompts** (à savoir une fois) :

- Stack : React 18 + `@babel/standalone` (no build step). Pas d'`import`/`export` ES modules — tous les composants s'exposent via `window.X = X`.
- Tokens CSS Custom Properties uniquement (`var(--brand)`, `var(--tx)`, `var(--space-3)`). Ne jamais hardcoder de couleur.
- Persistance state utilisateur : `localStorage` avec un prefixe lisible (`cockpit-...`).
- Persistance state serveur : Supabase via les helpers `window.sb.fetchJSON / postJSON / patchJSON`.
- Telemetry : `window.track && window.track("event_name", { ...payload })` à chaque action utilisateur notable. Mettre à jour la table d'events dans `CLAUDE.md` (section *Télémétrie*) si nouveau type.
- Ne jamais retirer les `try {} catch {}` autour des accès `localStorage` (Safari ITP).
- `cockpit/styles*.css` est le seul endroit où vivent les styles ; les `style={{...}}` inline sont tolérés pour les radar/SVG dynamiques.
- **Toute modif fonctionnelle d'un onglet** → mise à jour du `docs/specs/tab-<slug>.md` correspondant + bump `last_updated` dans `docs/specs/index.json`. La CI lint-specs bloque sinon.

---

### P0 — Quick Wins (impact élevé, < 30 min)

#### Prompt 1 — [UX] Hero "delta" mode visite récurrente

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`, `docs/specs/tab-brief.md`

```
Contexte : sur la home (cockpit/home.jsx), le Hero affiche actuellement un
titre macro statique généré par Gemini ("La bataille des agents passe en
phase industrielle"). Au jour 1 de la semaine c'est parfait, mais à la
visite #5 l'utilisateur a déjà lu la même synthèse hier soir. Il faut un
mode "delta" qui prend le dessus quand l'utilisateur revient < 18h après.

La logique est déjà calculée dans home.jsx (variables `visitDelta` et
`newSinceVisit`, lignes ~249-274) mais elle est juste affichée dans le
kicker, pas dans le titre.

Tâche :
1. Dans cockpit/home.jsx, juste avant le `return`, calcule un boolean
   `useDeltaHero = visitDelta && visitDelta.h < 18 && newSinceVisit > 0`.
2. Si `useDeltaHero === true` :
   - Le `<h1 className="hero-title">` affiche `${newSinceVisit} nouveautés
     depuis ${visitDelta.h}h.` (pluriel/singulier selon `newSinceVisit`).
   - Le `<p className="hero-body">` reste, mais préfixé d'un nouvel élément
     <ul className="hero-delta-list"> qui liste les `newSinceVisit` premiers
     `top` items (titre tronqué 60 chars + source + score). Max 4 items + un
     "+ X plus" si débordement.
   - Le bouton "Lire les 3 incontournables" devient "Lire les
     ${Math.min(newSinceVisit, 4)} nouveautés" et navigue vers `top`.
   - Sous les actions, ajouter un disclosure `<details className="hero-macro-collapse">`
     avec `<summary>Voir le brief macro complet</summary>` qui contient
     l'ancien `<h1>` + `<p>` macro standard.
3. Si `useDeltaHero === false` : comportement actuel inchangé.

Styles à ajouter dans cockpit/styles.css (juste après .hero-body, ~ligne 610) :
   .hero-delta-list { list-style: none; padding: 0; margin: 16px 0 24px;
     display: flex; flex-direction: column; gap: 8px; }
   .hero-delta-list li { padding: 10px 14px; background: var(--surface);
     border: 1px solid var(--bd); border-radius: var(--radius);
     display: flex; gap: 12px; align-items: baseline;
     font-size: var(--text-md); }
   .hero-delta-list li .src { font-family: var(--font-mono);
     font-size: var(--text-2xs); letter-spacing: 0.08em;
     text-transform: uppercase; color: var(--tx3); flex-shrink: 0; }
   .hero-delta-list li .score { margin-left: auto; font-family: var(--font-mono);
     font-size: var(--text-xs); color: var(--brand); }
   .hero-macro-collapse { margin-top: 20px; }
   .hero-macro-collapse summary { font-family: var(--font-mono);
     font-size: var(--text-xs); letter-spacing: 0.08em; text-transform: uppercase;
     color: var(--tx3); cursor: pointer; padding: 8px 0; }
   .hero-macro-collapse[open] summary { color: var(--tx2); }
   .hero-macro-collapse .hero-title { font-size: clamp(24px, 3vw, 36px); }

Telemetry : ajouter `track("hero_delta_shown", { newSinceVisit, hours: visitDelta.h })`
dans un useEffect qui se déclenche quand `useDeltaHero` devient true.

Specs : mettre à jour docs/specs/tab-brief.md section "Fonctionnalités" et
"Parcours utilisateur" (rappel : vocabulaire produit, pas de jargon technique
— interdit par la CI lint-specs). Bumper docs/specs/index.json::last_updated.
```

**Validation** :
- Vide localStorage `cockpit-last-visit-ts`, recharge → mode macro classique (visite #1).
- Recharge dans la même heure → `useDeltaHero` doit basculer à true et le titre devient "X nouveautés depuis Yh".
- Le `<details>` se déplie sur clic et révèle le titre macro Gemini.
- En thème Obsidian + Atlas, les bordures `--bd` restent lisibles.

---

#### Prompt 2 — [UX] Filtre "Récent · 24h" auto-on en visite récurrente

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`

```
Contexte : `cockpit/app.jsx` (ligne ~195) initialise `recentOnly` depuis
localStorage uniquement. Mais en visite récurrente (< 18h après la dernière),
l'utilisateur veut par défaut voir uniquement ce qui a changé.

Tâche : modifier l'initialisation de `recentOnly` pour appliquer la règle :

1. Si l'utilisateur a explicitement cliqué sur le toggle dans la dernière
   heure (`localStorage.cockpit-recent-explicit` < 1h), respecter sa préférence
   stockée.
2. Sinon, calcule `lastVisit = Number(localStorage.cockpit-last-visit-ts)` :
   - Si `Date.now() - lastVisit < 18 * 3600 * 1000` ET `> 30 * 60 * 1000`
     (entre 30 min et 18h), default = `true`.
   - Sinon default = `false`.
3. Quand l'utilisateur clique le toggle (ligne ~498), set
   `localStorage.cockpit-recent-explicit = String(Date.now())` en plus de la
   pref existante.

Visuellement, quand `recentOnly === true` ET `useDeltaHero === false`
(càd visite récurrente sans nouveautés), afficher un microcopy juste sous
le hero :
  "Mode récent · seuls les articles < 24h sont visibles. [Voir tout]"

Le bouton "Voir tout" appelle `setRecentOnly(false)`.

Telemetry : `track("recent_filter_auto_on", { reason: "recent_visit" })`
quand le default kick in (uniquement la première fois par session).
```

**Validation** :
- Première visite du jour : `recentOnly = false`, comportement actuel.
- Recharge 1h après : `recentOnly = true` automatiquement.
- Click manuel sur le toggle : la prochaine visite respecte le choix pendant 1h.

---

#### Prompt 3 — [UX] Animations infinies → 3 boucles puis stop

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`

```
Contexte : trois animations CSS tournent à l'infini et fatiguent à la
3e visite quotidienne :
- `.kicker-dot` (cockpit/styles.css ~ligne 581) : pulse 2s infinite
- `.sb-group-hotdot` (~ligne 215) : sbHotPulse 2s infinite
- (à vérifier) `.kbd-fab` n'a pas d'animation infinie — OK.

Tâche : pour chaque animation infinie, remplacer
   `animation: pulse 2s ease infinite;`
par
   `animation: pulse 2s ease 3;`

Et ajouter une règle CSS qui maintient le state final (le dot reste visible
mais sans pulse) :
   .kicker-dot { animation-fill-mode: forwards; }
   .sb-group-hotdot { animation-fill-mode: forwards; }

Honour `prefers-reduced-motion` :
   @media (prefers-reduced-motion: reduce) {
     .kicker-dot, .sb-group-hotdot { animation: none; }
   }
```

**Validation** :
- Chargement de la page → dot pulse 3 fois (~6s) puis reste statique (couleur visible mais sans halo animé).
- Navigation vers un autre panel et retour → l'animation se rejoue 3 fois.
- Avec `prefers-reduced-motion: reduce` (DevTools > Rendering > Emulate CSS media), aucune animation.

---

#### Prompt 4 — [UX] Token `--neutral` pour remplacer `#b8956a`

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/themes.js`, `cockpit/styles-signals.css`

```
Contexte : la couleur "declining" `#b8956a` (brun moutarde) est hardcodée
dans 12+ règles de cockpit/styles-signals.css. Elle n'est pas dans les 3
thèmes — donc le visuel d'un signal "en baisse" est identique en Dawn,
Obsidian et Atlas, ce qui casse la cohérence du design system.

Tâche en 2 temps :

1. Dans cockpit/themes.js, ajouter à chaque thème (dawn, obsidian, atlas)
   les variables suivantes (placées juste après --alert / --alert-tint) :
   - dawn :
       "--neutral": "#b8956a",
       "--neutral-tint": "#F5EBDF",
   - obsidian :
       "--neutral": "#D4A572",
       "--neutral-tint": "rgba(212, 165, 114, 0.12)",
   - atlas :
       "--neutral": "#9C7B45",
       "--neutral-tint": "#F0E8D4",

2. Dans cockpit/styles-signals.css, replace-all `#b8956a` par `var(--neutral)`.
   Vérifier qu'il n'y a pas d'autres fichiers concernés :
   `grep -rn "#b8956a" cockpit/` → ne devrait rien retourner après modif.

Aucune modif fonctionnelle, c'est de la cohérence pure.
```

**Validation** :
- En thème Dawn, l'apparence d'un signal "declining" est inchangée.
- En thème Obsidian, le brun devient un beige plus chaud (lisible sur fond noir).
- `grep -rn "#b8956a" cockpit/` ne retourne plus rien.

---

#### Prompt 5 — [UX] Hover des rangées en `color-mix`

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles-signals.css`, `cockpit/styles-ideas.css`, autres fichiers où `rgba(0,0,0,...)` est utilisé pour un hover.

```
Contexte : plusieurs hovers utilisent `rgba(0,0,0,0.02)` ou `rgba(0,0,0,0.04)`
ce qui devient invisible en thème Obsidian (fond noir → noir-sur-noir).

Tâche : remplacer toutes les occurrences de la forme
   background: rgba(0,0,0, X)
ou
   background: rgba(0, 0, 0, X)
par
   background: color-mix(in srgb, var(--tx) Y%, transparent)
où Y = X * 100 (ex: 0.02 → 2%).

Vérifier qu'on ne touche QUE les hovers/focus/states, pas les overlays
modales (qui doivent rester du noir réel pour un dim sombre cohérent
sur tous thèmes — ex: .tk-overlay, .kbd-overlay).

Lister les fichiers concernés :
  grep -rn "rgba(0,0,0," cockpit/ | grep -v overlay | grep -v shadow

Procéder fichier par fichier en confirmant qu'on ne touche pas à un shadow
ou un overlay.
```

**Validation** :
- En thème Dawn, les hovers ont la même teinte qu'avant (à 1px près).
- En thème Obsidian, les hovers deviennent visibles (subtle teinte plus claire).
- En thème Atlas, idem.

---

#### Prompt 6 — [UX] État zéro positif "Bravo, tu es à jour"

**Priorité** : P0
**Dépend de** : Prompt 1 (recommandé)
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`, `docs/specs/tab-brief.md`

```
Contexte : quand l'utilisateur a tout lu et tout snoozé, la home affiche
les mêmes cards en grisé. Démotivant. Il faut un état zéro positif.

Tâche : dans cockpit/home.jsx, juste après le calcul de `useDeltaHero`,
calculer :
  const allRead = (data.top || []).every(t => readTop[t.rank] || snoozedTop[t.rank]);
  const noUnreadGlobal = (data.stats.unread_total ?? data.stats.articles_today) === 0;
  const isZeroState = allRead && noUnreadGlobal;

Si `isZeroState === true`, remplacer la section TOP 3 (juste la `<section className="block">` qui contient `top-grid`) par :

<section className="block block--zero">
  <div className="zero-state">
    <div className="zero-state-eyebrow">À jour</div>
    <h2 className="zero-state-title">Tu as fait le tour. Bravo.</h2>
    <p className="zero-state-body">
      Pendant que tu attends le brief de demain matin, voilà 2 idées qui
      dorment dans ton carnet — peut-être le bon moment pour les creuser.
    </p>
    <div className="zero-state-ideas">
      {(window.IDEAS_DATA?.ideas || [])
        .filter(i => i.status === "incubating" || i.status === "maturing")
        .sort((a, b) => new Date(a.last_touched) - new Date(b.last_touched))
        .slice(0, 2)
        .map(i => (
          <button key={i.id} className="zero-idea" onClick={() => onNavigate("ideas")}>
            <span className="zero-idea-kicker">{i.kicker || "Idée"}</span>
            <span className="zero-idea-title">{i.title}</span>
            <span className="zero-idea-age">en incubation depuis {ageOf(i.captured_at)}</span>
          </button>
        ))}
    </div>
    <div className="zero-state-actions">
      <button className="btn btn--ghost btn--sm" onClick={() => onNavigate("ideas")}>
        Ouvrir le carnet → 
      </button>
    </div>
  </div>
</section>

Helper `ageOf(iso)` : reproduire la logique `ageLabel` de panel-ideas.jsx,
ou import via window.__ideasAgeLabel si on l'expose.

Styles dans cockpit/styles.css :
   .block--zero { padding: 60px 32px; text-align: center; }
   .zero-state { max-width: 560px; margin: 0 auto; }
   .zero-state-eyebrow { font-family: var(--font-mono);
     font-size: var(--text-2xs); letter-spacing: 0.14em;
     text-transform: uppercase; color: var(--positive);
     margin-bottom: var(--space-2); }
   .zero-state-title { font-family: var(--font-display);
     font-size: var(--text-3xl); margin-bottom: var(--space-3); }
   .zero-state-body { font-size: var(--text-md); color: var(--tx2);
     line-height: 1.6; margin-bottom: var(--space-5); }
   .zero-state-ideas { display: grid; grid-template-columns: 1fr 1fr;
     gap: var(--space-3); margin-bottom: var(--space-4); }
   @media (max-width: 760px) { .zero-state-ideas { grid-template-columns: 1fr; } }
   .zero-idea { display: flex; flex-direction: column;
     align-items: flex-start; gap: 4px; padding: var(--space-3) var(--space-4);
     background: var(--surface); border: 1px solid var(--bd);
     border-radius: var(--radius); transition: all 120ms; cursor: pointer;
     text-align: left; }
   .zero-idea:hover { border-color: var(--brand); }
   .zero-idea-kicker { font-family: var(--font-mono); font-size: var(--text-2xs);
     letter-spacing: 0.1em; text-transform: uppercase; color: var(--tx3); }
   .zero-idea-title { font-size: var(--text-md); color: var(--tx); font-weight: 500; }
   .zero-idea-age { font-size: var(--text-xs); color: var(--tx3); margin-top: 2px; }

Telemetry : `track("zero_state_shown", { ideas_count: shownIdeas.length })`.

Specs : mettre à jour docs/specs/tab-brief.md.
```

**Validation** :
- Quand on coche "Tout marqué lu" et qu'`unread_total = 0`, l'état zéro apparaît à la place du Top 3.
- Le clic sur une "zero-idea" navigue vers le carnet d'idées.
- Pas plus de 2 idées affichées même si plus de 5 sont incubating.

---

#### Prompt 7 — [UX] Cards lues collapsent au lieu d'opacity 0.5

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`, `cockpit/home.jsx`

```
Contexte : `.top-card.is-read { opacity: 0.5 }` (cockpit/styles.css ~ligne 1145)
laisse les cards lues à pleine taille. Sur la home, ça gaspille de l'espace
au-dessus du fold.

Tâche : transformer le state `is-read` en collapse animé.

1. Dans cockpit/styles.css, remplacer la règle existante :
       .top-card.is-read { opacity: 0.5; }
   par :
       .top-card.is-read {
         opacity: 0.55;
         max-height: 56px;
         overflow: hidden;
         padding: 12px 22px;
         transition: max-height 220ms ease, padding 220ms ease, opacity 220ms ease;
       }
       .top-card.is-read .top-card-rail { display: none; }
       .top-card.is-read .top-summary,
       .top-card.is-read .top-meta,
       .top-card.is-read .top-card-foot { display: none; }
       .top-card.is-read .top-title {
         font-size: var(--text-md);
         margin: 0;
         white-space: nowrap;
         overflow: hidden;
         text-overflow: ellipsis;
       }
       .top-card.is-read::after {
         content: "✓ Lu";
         font-family: var(--font-mono);
         font-size: var(--text-2xs);
         letter-spacing: 0.08em;
         text-transform: uppercase;
         color: var(--positive);
         margin-left: auto;
         flex-shrink: 0;
       }
       .top-card.is-read:hover { opacity: 0.85; }

2. Garder le `cursor: pointer` et le `onClick={openArticle}` existants —
   relire ouvre l'article dans un nouvel onglet (pas un toggle).

3. Pour permettre la "remise en non-lu", ajouter un long-press / right-click :
   dans home.jsx, sur l'`<article className="top-card">`, ajouter
   `onContextMenu={(e) => { e.preventDefault(); toggleRead(t.rank); }}`
   et un `title="clic-droit pour marquer comme non-lu"` quand `is-read`.

Telemetry : `track("top_card_collapsed", { rank })` quand une card passe en is-read.
```

**Validation** :
- Marquer un Top 1 comme lu → la card collapse à ~56px en 220ms.
- 3 cards lues prennent 168px au lieu de ~660px.
- Clic-droit sur une card lue → repasse non-lue (+ animation inverse).
- Sur mobile, le contexte menu fait un appui long natif.

---

#### Prompt 8 — [UX] Reading time tag par card

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/panel-top.jsx`, `cockpit/styles.css`

```
Contexte : aucune card n'indique un temps de lecture estimé. C'est un
signal majeur pour doser une session matinale courte.

Tâche : ajouter une fonction `estimateReadingTime(text)` dans
cockpit/home.jsx (en haut, juste après la déclaration de `AudioBriefChip`) :

   function estimateReadingTime(text) {
     const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
     const minutes = Math.max(1, Math.round(words / 230));
     return `${minutes} min`;
   }
   window.estimateReadingTime = estimateReadingTime; // panel-top.jsx s'en sert

Dans `home.jsx` à l'intérieur de `<div className="top-meta">` (~ligne 421),
juste avant `<span className="top-source">`, ajouter :

   <span className="top-reading">
     {estimateReadingTime((t.summary || "") + " " + (t.title || ""))}
   </span>

Idem dans cockpit/panel-top.jsx pour le rendu plein écran (chercher la
struct `top-meta` équivalente).

Styles dans cockpit/styles.css (juste après `.top-section`, ~ligne 1198) :
   .top-reading {
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     letter-spacing: 0.06em;
     color: var(--tx2);
     padding: 1px 6px;
     background: var(--bg2);
     border-radius: 3px;
   }
```

**Validation** :
- Chaque top-card affiche "2 min" ou "3 min" en font-mono dans le header.
- Le calcul est ~230 mots/minute (lecture pro).
- Les cards lues (collapsed) cachent le tag (cohérent avec le prompt 7).

---

### P1 — Améliorations significatives (30 min - 2h)

#### Prompt 9 — [UX] Audio brief — chip persistante avec progression

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/app.jsx`, `cockpit/styles.css`

```
Contexte : `AudioBriefChip` (cockpit/home.jsx ~ligne 7) joue le brief via
SpeechSynthesis quand on est sur la home. Mais si l'utilisateur navigue
vers un autre panel, l'audio s'arrête (cleanup useEffect ~ligne 35).
On veut au contraire :
- L'audio continue
- Une mini-chip floating persistante apparaît en bas-droit avec
  progression + reprendre/pause + fermer

Tâche en 3 étapes :

1. Promouvoir la state audio en singleton global dans cockpit/lib/.
   Crée un nouveau fichier cockpit/lib/audio-brief.js (chargé après
   bootstrap.js dans index.html) :

   (function(){
     const state = { speaking: false, text: "", title: "", progress: 0,
                     listeners: new Set() };
     function notify() { state.listeners.forEach(l => l(state)); }
     function subscribe(fn) { state.listeners.add(fn); fn(state); return () => state.listeners.delete(fn); }
     function play(title, body) {
       if (!("speechSynthesis" in window)) return;
       const synth = window.speechSynthesis;
       synth.cancel();
       state.text = body || ""; state.title = title || ""; state.progress = 0;
       const u = new SpeechSynthesisUtterance(((title?title+". ":"") + body));
       u.lang = "fr-FR"; u.rate = 1.02;
       const fr = synth.getVoices().find(v => /^fr/i.test(v.lang));
       if (fr) u.voice = fr;
       u.onboundary = (e) => {
         state.progress = Math.min(1, e.charIndex / Math.max(1, u.text.length));
         notify();
       };
       u.onend = () => { state.speaking = false; state.progress = 1; notify(); };
       u.onerror = () => { state.speaking = false; notify(); };
       synth.speak(u);
       state.speaking = true; notify();
     }
     function stop() { window.speechSynthesis?.cancel(); state.speaking = false; notify(); }
     window.audioBrief = { state, subscribe, play, stop };
   })();

2. Dans cockpit/home.jsx, remplacer la logique interne de `AudioBriefChip`
   pour utiliser `window.audioBrief.play(macro.title, macro.body)` /
   `window.audioBrief.stop()`. Le state local devient un useState alimenté
   par `useEffect` qui s'abonne via `audioBrief.subscribe(setState)`.

3. Dans cockpit/app.jsx, à l'intérieur du composant App, ajouter (juste
   avant le return) :

   const [audioState, setAudioState] = useState(null);
   useEffect(() => {
     if (!window.audioBrief) return;
     return window.audioBrief.subscribe(setAudioState);
   }, []);

   Et dans le JSX, ajouter (à la fin, juste avant le </div> de .app) :

   {audioState && audioState.speaking && (
     <div className="audio-floating-chip" role="status">
       <button className="afc-btn" onClick={() => window.audioBrief.stop()}
               aria-label="Arrêter">
         <Icon name="check" size={12} />
       </button>
       <div className="afc-meta">
         <div className="afc-title">{audioState.title.slice(0, 40)}…</div>
         <div className="afc-progress">
           <div className="afc-progress-fill"
                style={{ width: `${(audioState.progress*100).toFixed(0)}%` }} />
         </div>
       </div>
     </div>
   )}

Styles dans cockpit/styles.css :
   .audio-floating-chip {
     position: fixed; bottom: 60px; right: 16px;
     display: flex; align-items: center; gap: var(--space-3);
     padding: var(--space-2) var(--space-3); padding-right: var(--space-4);
     background: var(--surface); border: 1px solid var(--bd);
     border-radius: 999px; box-shadow: var(--shadow-md);
     z-index: 95; min-width: 240px; max-width: 320px;
     animation: afcSlide 200ms ease;
   }
   @keyframes afcSlide { from { transform: translateY(20px); opacity: 0; }
                         to { transform: translateY(0); opacity: 1; } }
   .afc-btn { display: inline-flex; align-items: center; justify-content: center;
     width: 28px; height: 28px; border-radius: 50%;
     background: var(--brand); color: var(--bg2); border: none;
     cursor: pointer; flex-shrink: 0; }
   .afc-meta { flex: 1; min-width: 0; }
   .afc-title { font-size: var(--text-sm); color: var(--tx);
     overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
   .afc-progress { height: 3px; background: var(--bd); border-radius: 2px;
     margin-top: 4px; overflow: hidden; }
   .afc-progress-fill { height: 100%; background: var(--brand);
     transition: width 200ms; border-radius: 2px; }

Specs : ajouter une mention dans docs/specs/tab-brief.md "Le brief audio
continue à jouer si tu changes de panel — une chip de progression
apparaît en bas à droite avec un bouton stop."

Telemetry : `track("audio_brief_persisted", { from: activePanel })` quand
la chip apparaît parce qu'on a quitté la home en lecture.
```

**Validation** :
- Lance le brief audio sur la home → navigue vers Signaux → la chip apparaît en bas-droit, le son continue.
- Le bouton check dans la chip arrête l'audio et fait disparaître la chip.
- La barre de progression avance en sync avec la lecture (test à 50% : `audioBrief.state.progress > 0.4 && < 0.6`).

---

#### Prompt 10 — [UX] Mobile Jarvis — drawer mémoire

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles-jarvis.css`, `cockpit/styles-mobile.css`, `cockpit/panel-jarvis.jsx`

```
Contexte : sur mobile, la colonne mémoire de Jarvis est masquée
(cockpit/styles-mobile.css:222 — `.jrv-panel-left { display: none !important }`).
Mais Jarvis cite ces faits dans ses réponses, donc l'utilisateur perd le
contexte visible. Il faut une drawer accessible.

Tâche en 4 étapes :

1. Dans cockpit/panel-jarvis.jsx, ajouter un state `memDrawerOpen` (false par défaut).
   Et un bouton trigger qui n'apparaît qu'au format mobile via classname dédiée :

   <button
     className="jrv-mem-trigger"
     onClick={() => setMemDrawerOpen(true)}
     aria-label="Voir la mémoire de Jarvis"
   >
     <Icon name="brain" size={14} stroke={1.75} />
     <span>Mémoire</span>
   </button>

   À placer dans le header du chat (à côté du titre "Jarvis"), juste à
   gauche du composer si plus simple.

2. Wrapper la `<aside className="jrv-panel-left">` dans une logique
   conditionnelle :

   <aside className={`jrv-panel-left ${memDrawerOpen ? "is-mobile-open" : ""}`}>

3. Ajouter un backdrop juste avant qui ferme la drawer :

   {memDrawerOpen && (
     <div className="jrv-mem-backdrop" onClick={() => setMemDrawerOpen(false)} />
   )}

4. Dans cockpit/styles-mobile.css, REMPLACER la règle ligne 222 :
       .jrv-panel-left { display: none !important; }
   par :
       /* Mobile: mémoire devient drawer right-slide */
       .jrv-panel-left {
         position: fixed !important;
         top: 0; right: 0; bottom: 0;
         width: min(85vw, 360px) !important;
         z-index: 96;
         transform: translateX(105%);
         transition: transform 220ms ease;
         box-shadow: -2px 0 16px rgba(0, 0, 0, 0.18);
         overflow-y: auto;
       }
       .jrv-panel-left.is-mobile-open {
         transform: translateX(0);
       }
       .jrv-mem-backdrop {
         position: fixed; inset: 0;
         background: rgba(0, 0, 0, 0.4);
         z-index: 95;
       }
       .jrv-mem-trigger {
         display: inline-flex; align-items: center; gap: 6px;
         padding: 6px 10px; border: 1px solid var(--bd);
         border-radius: 999px; background: var(--surface);
         color: var(--tx2); font-size: var(--text-xs);
       }

   Et hors @media : cacher `.jrv-mem-trigger` et `.jrv-mem-backdrop`.

Telemetry : `track("jarvis_memory_drawer_opened", {})`.
```

**Validation** :
- Sur viewport ≤ 760px, le bouton "Mémoire" apparaît dans le header.
- Click sur le bouton → drawer slide depuis la droite, backdrop assombri.
- Click backdrop ou Échap → ferme.
- Sur desktop ≥ 760px, comportement inchangé (colonne fixe à gauche).

---

#### Prompt 11 — [JARVIS] Smart sidebar — items qui ont du nouveau remontent (J3)

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/nav.js`

```
Contexte : la sidebar a 6 groupes × 25 items, ordonnés par groupe statique.
Quand un item a `unread > 0`, il est égal à ses voisins. On veut le
remonter en tête de groupe pour faciliter le scan.

Tâche : dans cockpit/sidebar.jsx, à l'intérieur de `Sidebar()`, ajouter
juste avant le `return` :

   const sortedNav = React.useMemo(() => {
     return data.nav.map(group => ({
       ...group,
       items: [...group.items].sort((a, b) => {
         const ua = a.unread || 0, ub = b.unread || 0;
         if (ua !== ub) return ub - ua; // unread first
         return 0; // stable sinon
       }),
     }));
   }, [data.nav]);

Puis remplacer `data.nav.map((group) => ...` par `sortedNav.map((group) => ...`.

Ajouter un toggle utilisateur en sidebar footer (juste sous .sb-foot-bottom)
avec un bouton "Tri auto / manuel" qui stocke `cockpit-sb-smart-sort` en
localStorage. Si désactivé, retomber sur l'ordre `data.nav` original.

Visuellement, les items sortés "remontés" gagnent un mini indicateur :
ajouter dans renderLink (juste après la conditionnelle item.unread):

   {item.unread > 0 && (
     <span
       className="sb-link-fresh-dot"
       title="Mis à jour récemment"
     />
   )}

Styles dans cockpit/styles.css (après .sb-link.is-active, ~ligne 240) :
   .sb-link-fresh-dot {
     position: absolute; left: 6px; top: 50%;
     transform: translateY(-50%);
     width: 4px; height: 4px;
     border-radius: 50%;
     background: var(--brand);
   }

Telemetry : `track("sidebar_smart_sort_toggle", { enabled: boolean })`.
```

**Validation** :
- Au chargement avec smart sort activé, les groupes "Veille" et "Apprentissage" voient leurs items unread monter en tête.
- L'ordre stable est préservé pour ceux à 0 unread (pas de réordonnancement aléatoire).
- Toggle off → ordre original récupéré.

---

#### Prompt 12 — [UX] "Ask Jarvis" inline avec 3 questions suggérées

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
Contexte : sur chaque card (top-card, sig-card), il y a déjà un bouton
"Ask Jarvis" (`.card-action--ask`). Mais l'utilisateur doit formuler la
question lui-même. On veut, au survol, suggérer 3 questions pré-rédigées
basées sur le contenu.

Tâche : créer un sub-composant `AskJarvisDropdown` dans cockpit/home.jsx
juste avant la définition de `SignalCard` :

   function AskJarvisDropdown({ context, onNavigate, onClose }) {
     const questions = useMemoJv(() => {
       const base = String(context).slice(0, 200);
       return [
         `Pourquoi c'est important pour moi ? (en 1 paragraphe)`,
         `Quelles sont les 3 questions à poser à mon équipe sur ce sujet ?`,
         `Donne-moi un angle business pour le secteur assurance.`,
       ];
     }, [context]);
     return (
       <div className="ask-pop" role="menu" onClick={(e) => e.stopPropagation()}>
         <div className="ask-pop-head">Demande à Jarvis</div>
         {questions.map((q, i) => (
           <button key={i} className="ask-pop-item"
             onClick={() => {
               try { localStorage.setItem("jarvis-prefill",
                 `${context}\nQuestion : ${q}`); } catch {}
               onNavigate("jarvis");
               onClose();
             }}>
             {q}
           </button>
         ))}
       </div>
     );
   }

Modifier le bouton existant (.card-action--ask sur top-card et sig-card)
pour ouvrir ce popover à la place du jump direct :

   const [askOpen, setAskOpen] = React.useState(null); // rank ou signal.name
   ...
   onClick={(e) => {
     e.stopPropagation();
     setAskOpen(t.rank); // ou signal.name pour SignalCard
   }}

Et conditionner :
   {askOpen === t.rank && (
     <AskJarvisDropdown
       context={`Article : ${t.title} (${t.source}). ${t.summary}`}
       onNavigate={onNavigate}
       onClose={() => setAskOpen(null)}
     />
   )}

Click outside : ajouter un useEffect dans Home qui écoute `mousedown` et
ferme askOpen si target n'est pas .ask-pop ni .card-action--ask.

Styles dans cockpit/styles.css :
   .ask-pop {
     position: absolute; right: 0; top: calc(100% + 4px);
     width: 280px;
     background: var(--surface); border: 1px solid var(--bd);
     border-radius: var(--radius); box-shadow: var(--shadow-md);
     padding: var(--space-2);
     z-index: 50;
     animation: askPopIn 140ms;
   }
   @keyframes askPopIn { from { opacity: 0; transform: translateY(-4px); }
                         to { opacity: 1; transform: translateY(0); } }
   .ask-pop-head { font-family: var(--font-mono); font-size: var(--text-2xs);
     letter-spacing: 0.1em; text-transform: uppercase; color: var(--tx3);
     padding: 6px 8px 4px; }
   .ask-pop-item { display: block; width: 100%; text-align: left;
     padding: 8px 10px; font-size: var(--text-sm); color: var(--tx2);
     background: transparent; border: none; border-radius: 4px;
     cursor: pointer; transition: background 100ms; }
   .ask-pop-item:hover { background: var(--bg2); color: var(--tx); }

Faire en sorte que `.top-actions` ait `position: relative` pour que le
popover se positionne correctement.

Telemetry : `track("ask_jarvis_pop_question_picked", { question_idx })`.
```

**Validation** :
- Click sur le bouton "Ask Jarvis" d'une top-card → popover apparaît à droite avec 3 questions.
- Click sur une question → navigation vers Jarvis avec le prefill rempli.
- Click ailleurs → ferme.

---

#### Prompt 13 — [JARVIS] Inbox Zero pour Veille (J4) — Partie 1 : structure

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/panel-veille.jsx`, `cockpit/styles.css`

```
Contexte : panel-veille.jsx affiche un feed scrollable. On veut un mode
"tri en lot" plein écran : un article à la fois, 4 actions clavier.

Tâche partie 1 (structure HTML + state) :

Dans cockpit/panel-veille.jsx, dans le composant principal, ajouter au
début :

   const [batchMode, setBatchMode] = React.useState(false);
   const [batchIdx, setBatchIdx] = React.useState(0);

Le bouton qui active le mode batch va dans le header du panel (à côté
des autres boutons d'action) :

   <button className="vl-batch-trigger" onClick={() => { setBatchMode(true);
     setBatchIdx(0); }}>
     <Icon name="layers" size={13} /> Tri en lot
   </button>

Création du composant `VeilleBatch` (juste avant le return) :

   function VeilleBatch({ items, idx, total, onAction, onClose }) {
     const item = items[idx];
     if (!item) return null;
     return (
       <div className="vb-overlay" role="dialog" aria-label="Tri en lot">
         <div className="vb-progress">
           <span>{idx + 1} / {total}</span>
           <button className="vb-close" onClick={onClose}
             aria-label="Quitter">×</button>
         </div>
         <div className="vb-card">
           <div className="vb-meta">
             <span>{item.source}</span>
             <span>·</span>
             <span>{item.section}</span>
             <span>·</span>
             <span>{item.date}</span>
           </div>
           <h2 className="vb-title">{item.title}</h2>
           <p className="vb-body">{item.summary}</p>
           {item.tags && (
             <div className="vb-tags">
               {item.tags.map(t => <span key={t} className="vb-tag">{t}</span>)}
             </div>
           )}
         </div>
         <div className="vb-actions">
           <button className="vb-btn vb-btn--read" onClick={() => onAction("read")}>
             <kbd>J</kbd> LIRE
           </button>
           <button className="vb-btn vb-btn--keep" onClick={() => onAction("keep")}>
             <kbd>G</kbd> GARDER
           </button>
           <button className="vb-btn vb-btn--snooze" onClick={() => onAction("snooze")}>
             <kbd>K</kbd> PARQUER
           </button>
           <button className="vb-btn vb-btn--forget" onClick={() => onAction("forget")}>
             <kbd>H</kbd> OUBLIER
           </button>
         </div>
       </div>
     );
   }

Rendre le composant si batchMode :

   {batchMode && (
     <VeilleBatch
       items={feedItems}  // dépend de la variable du composant
       idx={batchIdx}
       total={feedItems.length}
       onAction={handleBatchAction}
       onClose={() => setBatchMode(false)}
     />
   )}

`feedItems` = la liste actuelle filtrée du panel (à identifier dans
panel-veille.jsx ; passer la même que celle utilisée par le feed).

handleBatchAction(action) sera implémenté en partie 2.
```

**Validation** :
- Click sur "Tri en lot" → overlay plein écran avec article 1/N.
- Les 4 boutons sont visibles, clavier J/G/K/H pas encore actif (partie 2).
- Click sur × → quitte.

---

#### Prompt 14 — [JARVIS] Inbox Zero pour Veille (J4) — Partie 2 : raccourcis clavier + actions

**Priorité** : P1
**Dépend de** : Prompt 13
**Fichiers concernés** : `cockpit/panel-veille.jsx`

```
Contexte : suite du prompt 13.

Tâche : implémenter handleBatchAction et les raccourcis clavier.

1. handleBatchAction (dans le composant principal panel-veille.jsx) :

   const handleBatchAction = React.useCallback((action) => {
     const item = feedItems[batchIdx];
     if (!item) return;
     try { window.track && window.track("veille_batch_action",
       { action, idx: batchIdx, total: feedItems.length }); } catch {}

     if (action === "read") {
       // Marquer comme lu (réutilise loadVeilleReadState/saveVeilleReadState)
       const state = loadVeilleReadState();
       state[item.id] = { read: true, ts: Date.now() };
       saveVeilleReadState(state);
       if (item.url) window.open(item.url, "_blank", "noopener");
     } else if (action === "keep") {
       const state = loadVeilleReadState();
       state[item.id] = { kept: true, ts: Date.now() };
       saveVeilleReadState(state);
     } else if (action === "snooze") {
       window.snooze && window.snooze.add(item.id, 3);
     } else if (action === "forget") {
       const state = loadVeilleReadState();
       state[item.id] = { forgotten: true, ts: Date.now() };
       saveVeilleReadState(state);
     }
     // Avancer
     if (batchIdx + 1 >= feedItems.length) {
       setBatchMode(false);
       try { window.track && window.track("veille_batch_complete",
         { processed: feedItems.length }); } catch {}
     } else {
       setBatchIdx(i => i + 1);
     }
   }, [batchIdx, feedItems]);

2. Raccourcis clavier (uniquement quand batchMode) :

   useEffect(() => {
     if (!batchMode) return;
     const onKey = (e) => {
       if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
       if (e.key === "j" || e.key === "J") { e.preventDefault(); handleBatchAction("read"); }
       else if (e.key === "g" || e.key === "G") { e.preventDefault(); handleBatchAction("keep"); }
       else if (e.key === "k" || e.key === "K") { e.preventDefault(); handleBatchAction("snooze"); }
       else if (e.key === "h" || e.key === "H") { e.preventDefault(); handleBatchAction("forget"); }
       else if (e.key === "Escape") setBatchMode(false);
     };
     window.addEventListener("keydown", onKey);
     return () => window.removeEventListener("keydown", onKey);
   }, [batchMode, handleBatchAction]);

3. Styles dans cockpit/styles.css (juste après .recent-toggle, ~ligne 870) :
   .vb-overlay {
     position: fixed; inset: 0;
     background: var(--bg);
     z-index: 200;
     display: flex; flex-direction: column;
     align-items: center; justify-content: center;
     padding: var(--space-5) var(--space-6);
     animation: vbFadeIn 200ms;
   }
   @keyframes vbFadeIn { from { opacity: 0; } to { opacity: 1; } }
   .vb-progress { position: absolute; top: var(--space-4); left: var(--space-5);
     right: var(--space-5); display: flex; justify-content: space-between;
     align-items: center; font-family: var(--font-mono);
     font-size: var(--text-sm); color: var(--tx2); }
   .vb-close { width: 32px; height: 32px; border-radius: 50%;
     border: 1px solid var(--bd); background: var(--surface);
     color: var(--tx2); font-size: 18px; cursor: pointer; }
   .vb-close:hover { color: var(--tx); border-color: var(--tx2); }
   .vb-card { max-width: 720px; width: 100%; padding: var(--space-6);
     background: var(--surface); border: 1px solid var(--bd);
     border-radius: var(--radius-lg); }
   .vb-meta { font-family: var(--font-mono); font-size: var(--text-2xs);
     letter-spacing: 0.1em; text-transform: uppercase; color: var(--tx3);
     margin-bottom: var(--space-3); display: flex; gap: var(--space-2); }
   .vb-title { font-family: var(--font-display); font-size: var(--text-2xl);
     margin-bottom: var(--space-3); line-height: 1.2; }
   .vb-body { font-size: var(--text-md); line-height: 1.6; color: var(--tx2);
     margin-bottom: var(--space-4); }
   .vb-tags { display: flex; gap: 4px; flex-wrap: wrap; }
   .vb-tag { font-family: var(--font-mono); font-size: var(--text-2xs);
     color: var(--tx3); }
   .vb-actions { display: grid; grid-template-columns: repeat(4, 1fr);
     gap: var(--space-3); margin-top: var(--space-5);
     max-width: 720px; width: 100%; }
   .vb-btn { padding: var(--space-3) var(--space-4);
     background: var(--surface); border: 1px solid var(--bd);
     border-radius: var(--radius); cursor: pointer;
     font-family: var(--font-mono); font-size: var(--text-sm);
     letter-spacing: 0.08em; color: var(--tx); transition: all 120ms;
     display: flex; align-items: center; justify-content: center; gap: 8px; }
   .vb-btn kbd { background: var(--bg); border: 1px solid var(--bd);
     padding: 2px 6px; border-radius: 3px; font-size: 11px; }
   .vb-btn--read:hover { border-color: var(--brand); color: var(--brand); }
   .vb-btn--keep:hover { border-color: var(--positive); color: var(--positive); }
   .vb-btn--snooze:hover { border-color: var(--tx2); }
   .vb-btn--forget:hover { border-color: var(--alert); color: var(--alert); }
   @media (max-width: 760px) {
     .vb-actions { grid-template-columns: repeat(2, 1fr); }
   }

4. Specs : mettre à jour docs/specs/tab-updates.md (et tab-claude.md, tab-news.md…
   suivant lesquels onglets utilisent panel-veille.jsx).
```

**Validation** :
- Lance le mode batch sur Veille → la 1ère card apparaît plein écran.
- Touche J → ouvre l'article + avance à la 2e card.
- Touche K → snooze + avance.
- Toutes les cards triées → modal se ferme automatiquement, message console.
- Touche Échap → quitte sans rien marquer.

---

#### Prompt 15 — [JARVIS] Jarvis Daily Action — Partie 1 : table Supabase + génération

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `sql/013_daily_actions.sql` (nouveau), `weekly_analysis.py`, `docs/architecture/dependencies.yaml`

```
Contexte : on veut qu'au mount de la home le matin, Jarvis pousse UNE
micro-action de 5 min basée sur l'état du cockpit (idée qui dort, gap
radar, signal pas adressé, uncomfortable_question). Skip = report 24h,
done = streak +1.

Tâche partie 1 (DB + génération nocturne) :

1. Créer sql/013_daily_actions.sql :

   create table if not exists daily_actions (
     id uuid primary key default gen_random_uuid(),
     date date not null,
     kind text not null check (kind in ('idea_promote', 'gap_close',
       'signal_address', 'uncomfortable_question', 'fact_validate')),
     title text not null,
     body text not null,
     prompt text,
     ref_table text,        -- 'business_ideas', 'skill_radar', etc.
     ref_id text,
     created_at timestamptz default now(),
     skipped_at timestamptz,
     completed_at timestamptz,
     skipped_until date,    -- pour les skip 24h
     unique(date, kind)
   );

   alter table daily_actions enable row level security;
   create policy "auth read" on daily_actions for select to authenticated using (true);
   create policy "auth update" on daily_actions for update to authenticated using (true);
   create policy "service role insert" on daily_actions for insert to service_role with check (true);

2. Dans weekly_analysis.py, ajouter une étape après la génération
   d'opportunités :

   def generate_daily_action(claude_client, profile, radar, ideas, signals, uncomfortables):
       """Picks ONE actionable nudge for tomorrow morning."""
       prompt = build_daily_action_prompt(profile, radar, ideas, signals, uncomfortables)
       resp = claude_client.messages.create(
           model="claude-haiku-4-5", max_tokens=400,
           messages=[{"role": "user", "content": prompt}],
       )
       return parse_daily_action(resp.content[0].text)
       # → {"kind": "...", "title": "...", "body": "...",
       #    "ref_table": "business_ideas", "ref_id": "..."}

   Le prompt système doit demander à Claude de choisir parmi :
   - La plus vieille idée en stage incubating ou maturing (>14j)
   - L'axe radar avec score < 50 ET non touché ces 30j
   - Le signal "rising" ou "new" pas encore consulté (pas dans signal_tracking_views)
   - Une uncomfortable_question pas encore répondue
   - Un fact "ancien" (>180j) qui mérite re-validation

   Sortie JSON strict avec un schéma validé Python.

3. Insertion dans Supabase :

   sb_post("daily_actions", {
       "date": tomorrow.isoformat(),
       "kind": action["kind"],
       "title": action["title"],
       "body": action["body"],
       "prompt": action.get("prompt"),
       "ref_table": action.get("ref_table"),
       "ref_id": action.get("ref_id"),
   })

   Idempotent grâce à `unique(date, kind)` — si on relance, le pipeline
   doit catch l'erreur unique et passer au kind suivant.

4. docs/architecture/dependencies.yaml : ajouter la table dans tables[]
   avec owner_pipeline = weekly_analysis. La CI validate-arch va vérifier.

5. CLAUDE.md : ajouter une mention de la table dans la section
   "Base de données Supabase".
```

**Validation** :
- Migration appliquée : `\d daily_actions` retourne le schéma attendu.
- Run weekly_analysis.py en local → 1 ligne insérée pour `tomorrow`.
- Re-run même jour → exception unique, gérée gracefully.

---

#### Prompt 16 — [JARVIS] Jarvis Daily Action — Partie 2 : surface front home

**Priorité** : P2
**Dépend de** : Prompt 15
**Fichiers concernés** : `cockpit/lib/data-loader.js`, `cockpit/home.jsx`, `cockpit/styles.css`, `docs/specs/tab-brief.md`

```
Contexte : table daily_actions remplie. Maintenant on l'affiche en tête
de home, juste sous le PageHeader, avant le hero.

Tâche :

1. Dans cockpit/lib/data-loader.js, dans bootTier1, ajouter un fetch
   parallèle :
       sb.fetchJSON(SUPABASE_URL + "/rest/v1/daily_actions?date=eq."
         + todayISO + "&order=created_at.desc&limit=1")
   et attacher le résultat sur `COCKPIT_DATA.daily_action = result[0] || null`.

2. Dans cockpit/home.jsx, dans Home(), juste après les déclarations
   des states existants, ajouter :

   const [dailyAction, setDailyAction] = React.useState(data.daily_action);
   const [actionPending, setActionPending] = React.useState(false);

   const completeAction = async () => {
     if (!dailyAction) return;
     setActionPending(true);
     try {
       await window.sb.patchJSON(
         window.SUPABASE_URL + "/rest/v1/daily_actions?id=eq." + dailyAction.id,
         { completed_at: new Date().toISOString() }
       );
       try { window.track && window.track("daily_action_completed",
         { kind: dailyAction.kind }); } catch {}
       // Increment streak in localStorage
       const cur = Number(localStorage.getItem("cockpit-action-streak") || "0");
       localStorage.setItem("cockpit-action-streak", String(cur + 1));
       localStorage.setItem("cockpit-action-streak-last",
         new Date().toISOString().slice(0, 10));
       setDailyAction(null);
     } catch (e) { console.error(e); }
     setActionPending(false);
   };

   const skipAction = async () => {
     if (!dailyAction) return;
     setActionPending(true);
     try {
       const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
       await window.sb.patchJSON(
         window.SUPABASE_URL + "/rest/v1/daily_actions?id=eq." + dailyAction.id,
         { skipped_at: new Date().toISOString(), skipped_until: tomorrow }
       );
       try { window.track && window.track("daily_action_skipped",
         { kind: dailyAction.kind }); } catch {}
       setDailyAction(null);
     } catch (e) { console.error(e); }
     setActionPending(false);
   };

3. Rendu : juste après `<header className="ph">…</header>` et avant
   le toggle morning/full, ajouter :

   {dailyAction && (
     <section className="daily-action" role="region" aria-label="Action du jour">
       <div className="da-eyebrow">
         <Icon name="sparkle" size={12} stroke={1.75} />
         Ton action du jour · ~5 min
       </div>
       <h2 className="da-title">{dailyAction.title}</h2>
       <p className="da-body">{dailyAction.body}</p>
       <div className="da-actions">
         {dailyAction.ref_table && dailyAction.ref_id && (
           <button className="btn btn--primary" disabled={actionPending}
             onClick={() => {
               // Navigate to the relevant panel
               const map = { business_ideas: "ideas", skill_radar: "radar",
                             signal_tracking: "signals", uncomfortable_questions: "profile",
                             profile_facts: "profile" };
               onNavigate(map[dailyAction.ref_table] || "brief");
             }}>
             Y aller →
           </button>
         )}
         <button className="btn btn--ghost btn--sm" disabled={actionPending}
           onClick={completeAction}>Fait</button>
         <button className="btn btn--ghost btn--sm" disabled={actionPending}
           onClick={skipAction}>Plus tard (24h)</button>
       </div>
       <div className="da-streak">
         🔥 {Number(localStorage.getItem("cockpit-action-streak") || "0")} jours d'affilée
       </div>
     </section>
   )}

4. Styles dans cockpit/styles.css :

   .daily-action {
     padding: var(--space-5) var(--space-6);
     background: linear-gradient(135deg,
       color-mix(in srgb, var(--brand) 8%, var(--surface)),
       var(--surface));
     border-bottom: 1px solid var(--bd);
     position: relative;
   }
   .da-eyebrow {
     display: inline-flex; align-items: center; gap: 6px;
     font-family: var(--font-mono); font-size: var(--text-xs);
     letter-spacing: 0.12em; text-transform: uppercase;
     color: var(--brand); margin-bottom: var(--space-2);
   }
   .da-title {
     font-family: var(--font-display); font-size: var(--text-2xl);
     line-height: 1.2; margin-bottom: var(--space-3);
   }
   .da-body { font-size: var(--text-md); color: var(--tx2);
     line-height: 1.6; max-width: 64ch; margin-bottom: var(--space-4); }
   .da-actions { display: flex; gap: var(--space-2); flex-wrap: wrap;
     margin-bottom: var(--space-3); }
   .da-streak { font-family: var(--font-mono); font-size: var(--text-xs);
     color: var(--tx3); }

5. Specs : créer ou mettre à jour docs/specs/tab-brief.md section
   "Fonctionnalités" : "Action du jour — Jarvis te pousse une seule
   micro-action chaque matin (idée qui dort, gap radar à combler,
   signal à creuser). Trois choix : faire, reporter à demain, y aller
   directement. Ton streak se cumule chaque jour."
```

**Validation** :
- Avec une ligne dans daily_actions pour aujourd'hui, la section apparaît en haut de home.
- Click "Fait" → la section disparaît, streak +1 visible.
- Click "Plus tard 24h" → la section disparaît, daily_actions row updated.
- Sans daily_actions row → la section ne rend rien.

---

### P2 — Polish et features Jarvis avancées

#### Prompt 17 — [JARVIS] Brief en 90 secondes (J1) — Partie 1 : structure

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/components-replay.jsx` (nouveau), `index.html`, `cockpit/styles-replay.css` (nouveau)

```
Contexte : on veut un mode "Spotify Wrapped quotidien" — animation de
8 cards qui défilent en 90s, audio TTS narratif, partageable.

Tâche partie 1 (squelette + cards) :

1. Créer cockpit/components-replay.jsx :

   // ═══════════════════════════════════════════════════════════════
   // REPLAY DAILY — Animation 90s plein écran
   // ─────────────────────────────────────────────
   // 8 cards séquentielles, chaque card 11-12s, transition 500ms.
   // Audio TTS narre chaque card en parallèle.
   // ═══════════════════════════════════════════════════════════════
   const { useState: useStateRp, useEffect: useEffectRp, useRef: useRefRp } = React;

   const REPLAY_CARD_DURATION_MS = 11000;
   const REPLAY_TRANSITION_MS = 500;

   function ReplayDaily({ data, onClose }) {
     const [idx, setIdx] = useStateRp(0);
     const [paused, setPaused] = useStateRp(false);
     const cards = useMemoRp(() => buildCards(data), [data]);
     const total = cards.length;

     useEffectRp(() => {
       if (paused) return;
       const t = setTimeout(() => {
         if (idx + 1 >= total) {
           // End: navigate back home
           onClose();
         } else {
           setIdx(i => i + 1);
         }
       }, REPLAY_CARD_DURATION_MS);
       return () => clearTimeout(t);
     }, [idx, paused, total, onClose]);

     useEffectRp(() => {
       const card = cards[idx];
       if (!card || paused) return;
       const u = new SpeechSynthesisUtterance(card.narration);
       u.lang = "fr-FR"; u.rate = 1.05;
       const fr = window.speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang));
       if (fr) u.voice = fr;
       window.speechSynthesis.cancel();
       window.speechSynthesis.speak(u);
       return () => window.speechSynthesis.cancel();
     }, [idx, paused]);

     useEffectRp(() => {
       const onKey = (e) => {
         if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
         else if (e.key === "Escape") onClose();
         else if (e.key === "ArrowRight") setIdx(i => Math.min(i+1, total-1));
         else if (e.key === "ArrowLeft") setIdx(i => Math.max(i-1, 0));
       };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, [total, onClose]);

     const card = cards[idx];

     return (
       <div className="rp-overlay">
         <div className="rp-progress">
           {cards.map((_, i) => (
             <div key={i} className={`rp-bar ${i < idx ? "is-done" :
                                              i === idx ? "is-active" : ""}`}>
               <div className="rp-bar-fill" />
             </div>
           ))}
         </div>
         <button className="rp-close" onClick={onClose}>×</button>
         <div className={`rp-card rp-card--${card.kind}`} key={idx}>
           <div className="rp-eyebrow">{card.eyebrow}</div>
           <div className="rp-headline">{card.headline}</div>
           {card.body && <div className="rp-body">{card.body}</div>}
           {card.stat && <div className="rp-stat">{card.stat}</div>}
         </div>
         <div className="rp-foot">
           <span>{idx + 1} / {total}</span>
           <button onClick={() => setPaused(p => !p)}>
             {paused ? "▶ Reprendre" : "⏸ Pause"}
           </button>
         </div>
       </div>
     );
   }

   function buildCards(data) {
     const week = data.week || {};
     const macro = data.macro || {};
     const top = (data.top || [])[0] || {};
     const radar = data.radar || {};
     return [
       { kind: "intro", eyebrow: "Mardi 21 avril", headline: "Voilà ta semaine.",
         body: "En 90 secondes.",
         narration: "Bonjour. Voilà ta semaine, en 90 secondes." },
       { kind: "stat", eyebrow: "Articles lus", stat: week.total_read || 0,
         body: `streak veille : ${week.streak} jours`,
         narration: `Tu as lu ${week.total_read} articles cette semaine, ton streak veille atteint ${week.streak} jours.` },
       { kind: "theme", eyebrow: "Top thème", headline: macro.title,
         narration: macro.title },
       { kind: "top", eyebrow: "Article le plus marquant",
         headline: top.title || "—", body: top.source,
         narration: `Article qui t'a marqué : ${top.title}, sur ${top.source}.` },
       { kind: "radar", eyebrow: "Ton gap prioritaire",
         headline: radar.next_gap?.axis || "—",
         body: radar.next_gap?.reason,
         narration: `Ton gap prioritaire reste ${radar.next_gap?.axis}.` },
       { kind: "signal", eyebrow: "Signal à surveiller",
         headline: (data.signals || [])[0]?.name || "—",
         narration: `Le signal à surveiller : ${(data.signals || [])[0]?.name}.` },
       { kind: "perso", eyebrow: "Hors veille",
         headline: `${week.personal?.workouts?.done || 0} séances sport, ${Math.round((week.personal?.music?.total_min || 0) / 60)}h de musique`,
         narration: `Côté perso : ${week.personal?.workouts?.done} séances sport, ${Math.round((week.personal?.music?.total_min || 0) / 60)} heures de musique.` },
       { kind: "outro", eyebrow: "À demain", headline: "Bonne journée, Jean.",
         narration: "À demain. Bonne journée." },
     ];
   }

   window.ReplayDaily = ReplayDaily;

2. Dans index.html, ajouter le script Replay juste avant app.jsx :
       <script type="text/babel" src="cockpit/components-replay.jsx?v=1"></script>
       <link rel="stylesheet" href="cockpit/styles-replay.css?v=1">

3. Dans cockpit/styles-replay.css (nouveau fichier) :

   .rp-overlay { position: fixed; inset: 0; z-index: 250;
     background: var(--bg); display: flex; flex-direction: column;
     align-items: center; justify-content: center;
     animation: rpFade 200ms; }
   @keyframes rpFade { from { opacity: 0; } to { opacity: 1; } }
   .rp-progress { position: absolute; top: 0; left: 0; right: 0;
     display: flex; gap: 4px; padding: 12px 16px; }
   .rp-bar { flex: 1; height: 3px; background: var(--bd);
     border-radius: 2px; overflow: hidden; }
   .rp-bar-fill { height: 100%; background: var(--brand);
     transform-origin: left; transform: scaleX(0); }
   .rp-bar.is-active .rp-bar-fill {
     animation: rpBar 11s linear forwards; }
   .rp-bar.is-done .rp-bar-fill { transform: scaleX(1); }
   @keyframes rpBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
   .rp-close { position: absolute; top: 24px; right: 24px;
     width: 36px; height: 36px; border-radius: 50%;
     background: var(--surface); border: 1px solid var(--bd);
     color: var(--tx); font-size: 22px; cursor: pointer;
     z-index: 1; }
   .rp-card { max-width: 720px; padding: var(--space-7); text-align: center;
     animation: rpCardIn 600ms cubic-bezier(.2,.8,.2,1); }
   @keyframes rpCardIn { from { opacity: 0; transform: translateY(40px); }
                          to { opacity: 1; transform: translateY(0); } }
   .rp-eyebrow { font-family: var(--font-mono); font-size: var(--text-xs);
     letter-spacing: 0.16em; text-transform: uppercase;
     color: var(--brand); margin-bottom: var(--space-4); }
   .rp-headline { font-family: var(--font-display); font-size: clamp(40px, 6vw, 80px);
     line-height: 1.05; letter-spacing: -0.03em; color: var(--tx);
     margin-bottom: var(--space-4); text-wrap: balance; }
   .rp-body { font-size: var(--text-xl); color: var(--tx2);
     line-height: 1.5; max-width: 64ch; margin: 0 auto; }
   .rp-stat { font-family: var(--font-display); font-size: clamp(80px, 12vw, 180px);
     line-height: 1; color: var(--brand); font-variant-numeric: tabular-nums; }
   .rp-foot { position: absolute; bottom: 32px; display: flex;
     gap: var(--space-3); align-items: center; font-family: var(--font-mono);
     font-size: var(--text-sm); color: var(--tx2); }
   .rp-foot button { padding: 6px 14px; border: 1px solid var(--bd);
     border-radius: 999px; background: var(--surface); color: var(--tx);
     cursor: pointer; }
```

**Validation** :
- Implémenter le bouton trigger sera dans le prompt 18.
- Pour test isolé : dans la console, `ReactDOM.createRoot(document.body.appendChild(document.createElement('div'))).render(React.createElement(ReplayDaily, {data: COCKPIT_DATA, onClose: () => {}}))`. Doit jouer les 8 cards en 88s avec narration audio.

---

#### Prompt 18 — [JARVIS] Brief en 90 secondes (J1) — Partie 2 : trigger

**Priorité** : P2
**Dépend de** : Prompt 17
**Fichiers concernés** : `cockpit/home.jsx`

```
Contexte : suite du prompt 17. Le composant ReplayDaily existe. Il faut
maintenant un trigger.

Tâche : dans cockpit/home.jsx, dans Home() :

1. Ajouter le state :
   const [replayOpen, setReplayOpen] = React.useState(false);

2. Dans le ph-right (header), ajouter un bouton :
   <button className="ph-chip" onClick={() => setReplayOpen(true)}>
     <Icon name="play_circle" size={13} stroke={2} /> Replay 90s
   </button>

3. Au-dessus du return final, conditionner :
   {replayOpen && (
     <ReplayDaily data={data} onClose={() => {
       setReplayOpen(false);
       try { window.track && window.track("replay_completed", {}); } catch {}
     }} />
   )}

4. Auto-trigger lundi matin si jamais lancé pour cette semaine :

   React.useEffect(() => {
     try {
       const dow = new Date().getDay(); // 1 = lundi
       const hour = new Date().getHours();
       const week = data.date?.week || "";
       const lastReplay = localStorage.getItem("cockpit-replay-last-week");
       if (dow === 1 && hour < 11 && lastReplay !== week) {
         localStorage.setItem("cockpit-replay-last-week", week);
         setReplayOpen(true);
       }
     } catch {}
   }, [data.date?.week]);

Telemetry : `track("replay_started", { trigger: "auto"|"manual" })`.
```

**Validation** :
- Lundi matin, ouverture de la home → replay se déclenche auto une fois.
- Bouton "Replay 90s" dans le header, click → relance.
- Échap pendant la lecture → ferme proprement.

---

#### Prompt 19 — [JARVIS] Cockpit "weekend mode" (J11)

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/app.jsx`

```
Contexte : le samedi-dimanche, l'utilisateur veut moins de Veille IA et
plus de Forme/Musique/Gaming/Idées. On veut un mode automatique avec
override.

Tâche :

1. Dans cockpit/app.jsx, ajouter un state weekendMode :

   const [weekendMode, setWeekendMode] = React.useState(() => {
     try {
       const explicit = localStorage.getItem("cockpit-weekend-explicit");
       if (explicit) return explicit === "1";
       const dow = new Date().getDay();
       return dow === 0 || dow === 6;
     } catch { return false; }
   });

2. Passer la prop `weekendMode` au Sidebar :
   <Sidebar … weekendMode={weekendMode} onWeekendToggle={(v) => {
     localStorage.setItem("cockpit-weekend-explicit", v ? "1" : "0");
     setWeekendMode(v);
   }} />

3. Dans cockpit/sidebar.jsx, dans Sidebar(), ajouter logique de filtrage
   conditionnel :

   const visibleNav = React.useMemo(() => {
     if (!weekendMode) return data.nav;
     // En mode weekend, demote 'Veille' et 'RTE Toolbox', promote 'Vie perso'
     // et 'Carnet'.
     const WEEKEND_DEMOTE = new Set(["updates", "claude", "signals",
       "wiki", "veille-outils"]);
     return data.nav
       .map(group => ({
         ...group,
         items: group.items.filter(it => !WEEKEND_DEMOTE.has(it.id)),
       }))
       .filter(g => g.items.length > 0);
   }, [data.nav, weekendMode]);

   Et utiliser `visibleNav` à la place de `sortedNav` (ou combiner les deux
   si Prompt 11 est déjà appliqué).

4. Ajouter un toggle dans le footer sidebar (juste sous .sb-foot-bottom) :

   <div className="sb-foot-weekend">
     <label>
       <input type="checkbox" checked={weekendMode}
              onChange={(e) => onWeekendToggle(e.target.checked)} />
       <span>Mode weekend</span>
     </label>
   </div>

5. Styles dans cockpit/styles.css :
   .sb-foot-weekend { padding: 6px var(--space-3);
     font-family: var(--font-mono); font-size: var(--text-2xs);
     color: var(--tx2); }
   .sb-foot-weekend label { display: flex; gap: 6px; align-items: center;
     cursor: pointer; }
```

**Validation** :
- Samedi : sidebar n'affiche plus updates/claude/signals/wiki par défaut.
- Toggle off : retombe sur l'ordre normal.
- Lundi : bascule auto en mode normal sauf si l'utilisateur a forcé.

---

#### Prompt 20 — [UX] Hover sur cards lues 0.85 transition (cleanup)

**Priorité** : P2
**Dépend de** : Prompt 7
**Fichiers concernés** : `cockpit/styles.css`

```
Contexte : suite du prompt 7. Les cards lues collapse à 56px mais le
hover à 0.85 opacity peut surprendre. Ajout d'une bordure d'accent
au hover pour signaler l'interaction "réouvrir".

Tâche : dans cockpit/styles.css, ajouter à la suite des règles de prompt 7 :

   .top-card.is-read:hover {
     opacity: 0.85;
     border-color: var(--bd2);
     padding-left: 26px;
   }
   .top-card.is-read:hover::before {
     content: "↺ rouvrir";
     position: absolute;
     left: 8px; top: 50%;
     transform: translateY(-50%);
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     letter-spacing: 0.08em;
     color: var(--tx3);
   }
   .top-card.is-read { padding-left: 22px; transition-property:
     max-height, padding, opacity, padding-left; }
```

**Validation** : hover sur une card lue → la card révèle "↺ rouvrir" et l'opacity remonte à 0.85.

---

## 5. Checklist d'exécution

Ordre recommandé. Chaque prompt s'exécute indépendamment sauf mention explicite.

### Sprint 1 — P0 (≤ 2h cumul)

| # | Prompt | Effort | Cumul | Dépend de |
|---|---|---|---|---|
| 1 | P3. Animations infinies → 3 boucles | 5 min | 5 min | — |
| 2 | P4. Token `--neutral` | 10 min | 15 min | — |
| 3 | P5. Hover en `color-mix` | 10 min | 25 min | — |
| 4 | P2. Filtre `Récent · 24h` auto-on | 10 min | 35 min | — |
| 5 | P1. Hero "delta" mode visite récurrente | 25 min | 1h | — |
| 6 | P7. Cards lues collapse | 15 min | 1h15 | — |
| 7 | P6. État zéro positif | 20 min | 1h35 | P1 |
| 8 | P8. Reading time tag | 10 min | 1h45 | — |

**Critère sprint 1** : retour quotidien fluide, animations apaisées, état zéro qui motive. Mesurable via `usage_events` : `daily_active_minutes` doit augmenter ou rester stable, `bounce_rate` (visite < 30s) doit chuter.

### Sprint 2 — P1 (effort 30 min - 2h)

| # | Prompt | Effort | Dépend de |
|---|---|---|---|
| 9 | P9. Audio brief chip persistante | 1h | — |
| 10 | P10. Mobile Jarvis drawer | 45 min | — |
| 11 | P11. Smart sidebar reorder | 30 min | — |
| 12 | P12. Ask Jarvis dropdown 3 questions | 1h | — |
| 13 | P13. Inbox Zero — partie 1 | 45 min | — |
| 14 | P14. Inbox Zero — partie 2 | 45 min | P13 |

**Critère sprint 2** : améliorations mobiles + power user. Mesurable : `veille_batch_complete` events > 0, `jarvis_memory_drawer_opened` events sur mobile, taux d'usage Ask-Jarvis × 2.

### Sprint 3 — P2 (features Jarvis avancées)

| # | Prompt | Effort | Dépend de |
|---|---|---|---|
| 15 | P15. Daily Action — DB + génération | 1h | — |
| 16 | P16. Daily Action — surface front | 45 min | P15 |
| 17 | P17. Replay 90s — structure | 1h30 | — |
| 18 | P18. Replay 90s — trigger | 15 min | P17 |
| 19 | P19. Weekend mode | 30 min | P11 (recommandé) |
| 20 | P20. Hover cards lues cleanup | 5 min | P7 |

**Critère sprint 3** : l'app devient "vivante" — Jarvis pousse, le replay rend le rituel hebdomadaire mémorable. Mesurable : `daily_action_completed` events, `replay_completed` events ≥ 1×/semaine, NPS auto-déclaratif si on ajoute un widget.

---

## 6. Dépendances et invariants à préserver

Tous les prompts respectent les invariants suivants — à ne pas casser :

- **CSP** : pas d'`<iframe>`, pas d'`object`, pas de chargement de domaine non whitelist (cf. `index.html:6`).
- **No build step** : pas de `import`/`export` ES modules, exposition via `window.X = X`.
- **DOMPurify obligatoire** sur tout `dangerouslySetInnerHTML` venant de la base.
- **localStorage en `try {} catch {}`** (Safari ITP).
- **Telemetry table** : ajouter le nouvel `event_type` dans le tableau de la section *Télémétrie* du `CLAUDE.md` AVANT le commit.
- **Specs panels** : toute modif fonctionnelle d'un onglet → update `docs/specs/tab-<slug>.md` + bump `last_updated` dans `docs/specs/index.json`. La CI `lint-specs` bloque le merge sinon.
- **Architecture** : nouveau pipeline / nouvelle table / nouveau panel → update `docs/architecture/` correspondant. La CI `validate-arch` bloque sinon.
- **3 thèmes** : tester chaque modif visuelle dans Dawn, Obsidian et Atlas. Le bouton Ctrl+B (sidebar collapse) + le toggle thème sont les 2 raccourcis les plus fréquents — surveiller leur intégrité.

---

## 7. Points hors scope (à creuser plus tard)

Ces sujets méritent un audit dédié, pas couverts ici :

- **Performance perçue** : audit Lighthouse + Web Vitals + impact du `@babel/standalone` (parser un JSX au load coûte 200-400ms sur mobile bas-de-gamme). Migration graduelle vers ESM build pourrait diviser le first paint par 2.
- **Sécurité Supabase** : revue approfondie des RLS row-level — sont-elles vraiment iso entre `authenticated` et `service_role` ? Aucune escalade possible ?
- **Coût Claude Haiku** : le `weekly_analysis.py` est budgété 1$/run, mais avec 23 panels qui pourraient tous générer des recos hebdo, ça peut grimper. Modèle de coût à formaliser.
- **Audit a11y rigoureux** : passer un Axe DevTools sur chaque panel après auth, mesurer contraste WCAG AA sur les 3 thèmes, navigation clavier exhaustive, lecteurs d'écran.

---

## Conclusion

Le cockpit est **un produit personnel d'une qualité rare** — design system tri-thème abouti, archi data Tier 1/Tier 2 bien pensée, télémétrie en place, sécurité sérieuse. Le score global de 3.61/5 reflète un projet à un palier de maturité avancé.

**Le levier de rétention 30 jours #1 reste le mode "delta" sur la home** (Prompt 1) : tant que le hero reste statique, l'utilisateur va s'épuiser à chercher ce qui a changé. Une fois cette douleur résolue, les Sprint 2/3 ouvrent la voie à un **cockpit qui pousse** au lieu d'attendre — c'est ce qui transforme un outil personnel en une habitude quotidienne.

L'écart entre "cockpit qui informe" et "cockpit qui guide" se gagne en 3 sprints de 2-4h chacun. Bonne route.
