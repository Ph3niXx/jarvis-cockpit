# Audit Design Complet — AI Cockpit

**Date** : 28 avril 2026
**Auditeur** : Claude (Opus 4.7) via routine Cowork planifiée
**URL prod** : https://ph3nixx.github.io/jarvis-cockpit/
**Stack réelle observée** : React 18 + `@babel/standalone` (CDN unpkg) + Supabase REST + Google OAuth + 19 stylesheets CSS + 22 fichiers `data-*.js` chargés en synchrone. **Pas vanilla**, pas single-file. La description SKILL.md est obsolète — l'audit ci-dessous est **grounded sur le code actuel**.

> ⚠️ **Note importante** : la mission décrit le cockpit comme « vanilla HTML/CSS/JS, dark mode, glassmorphism, gradient bleu→violet ». Aucune de ces hypothèses ne tient en 2026-04. Le cockpit tourne sur **3 thèmes éditoriaux (Dawn cream/rouille par défaut, Obsidian dark, Atlas Swiss)**, sans gradient ni glassmorphism, en React multi-fichiers. Les prompts en Phase 4 ciblent donc la stack actuelle (`cockpit/*.jsx`, `cockpit/styles*.css`, `cockpit/themes.js`).

---

## 1. Reconnaissance

### 1.1 Inventaire features (état réel)

| Zone | Composant | Localisation | Statut |
|---|---|---|---|
| **Shell** | Sidebar 6 groupes + rail mode + drawer mobile | `cockpit/sidebar.jsx`, `cockpit/nav.js` | ✅ Production |
| Shell | Theme switcher (Dawn / Obsidian / Atlas) + auto-pick par heure | `cockpit/sidebar.jsx`, `cockpit/themes.js` | ✅ Production |
| Shell | Streak veille + coût API + sparkline 7j (footer sidebar) | `cockpit/sidebar.jsx` | ✅ Production |
| Shell | Command palette (Ctrl+K), 14 raccourcis clavier, overlay aide (?) | `cockpit/command-palette.jsx`, `cockpit/app.jsx` | ✅ Production |
| Shell | Filtre global "Récent · 24h" (auto-on si visite < 18h) | `cockpit/app.jsx` | ✅ Production |
| Shell | Error boundary par panel + skeleton loader Tier 2 | `cockpit/app.jsx` | ✅ Production |
| Shell | PWA service worker, manifest | `sw.js`, `manifest.json` | ✅ Production |
| **Auth** | Overlay Google OAuth bloquant (style Dawn inline) | `cockpit/lib/auth.js` | ✅ Production |
| **Aujourd'hui** | Brief du jour (hero macro + audio + delta + zero-state + Top 3 + signaux + radar + week) | `cockpit/home.jsx` | ✅ Production riche |
| Aujourd'hui | Toggle "Morning Card" vs "Brief complet" | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Hero delta "X nouveautés depuis Yh" (auto-trigger) | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Audio brief Web Speech API (estimation = body.length / 280) | `cockpit/home.jsx` | ⚠️ Heuristique fragile |
| Aujourd'hui | Bouton "Tout marqué lu" + undo 6s + télémétrie | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Miroir du soir, Revue du jour, Top du jour, Ma semaine, Recherche | 5 panels dédiés | ✅ Production |
| **Veille** | Veille IA, Veille outils (4 buckets), Sport, Gaming news, Anime, Actualités | `panel-veille.jsx` (mutualisé), `panel-veille-outils.jsx` | ✅ Production |
| **Apprentissage** | Radar 8 axes (SVG inline), Recos, Challenges, Wiki IA, Signaux faibles | 5 panels | ✅ Production |
| **Business** | Opportunités, Carnet d'idées (kanban + galerie), Jobs Radar | 3 panels | ✅ Production |
| **Personnel** | Jarvis chat (3 modes : Rapide/Deep/Cloud), Jarvis Lab (specs + archi), Profil, Forme, Musique, Gaming | 6 panels | ✅ Production |
| **Système** | Stacks & Limits (coûts), Historique | 2 panels | ✅ Production |

**Total : 25 panels actifs**, 0 panel stub visible (aucun "Ce panel reste à designer" en production aujourd'hui).

### 1.2 Design system implicite

**Bien structuré** : 3 thèmes complets dans `cockpit/themes.js`, tous exposent les mêmes 40+ tokens (palette + type + spacing 4px + scale type + radius + shadows). Les 8 tailles `--space-*` (4→64) et 8 tailles `--text-*` (10→54px) sont cohérentes entre thèmes. **C'est un vrai design system, pas un patchwork.**

**Mais des dérives** :
- 19 stylesheets séparées (`styles-radar.css`, `styles-musique.css`, etc.) avec query-strings de version manuels (`?v=5`, `?v=23`) — cache busting artisanal qui dérive vite (radar v3, brief CSS v23).
- Beaucoup de **valeurs hardcodées** dans `styles-mobile.css` : `font-size: 13.5px`, `padding: 24px 18px`, `font-size: 22px` — pas de tokens.
- **`!important` envahissant en mobile** (40+ occurrences dans `styles-mobile.css`) → trahit des guerres de spécificité non résolues.
- `cockpit/lib/auth.js` ré-définit les couleurs **en dur** (`#1F1815`, `#C2410C`, `#5E524A`) au lieu des tokens car l'overlay s'affiche avant le mount React → non thémable, casse en Obsidian/Atlas si l'utilisateur revient déconnecté.
- Composants chargés via `<script type="text/babel" src="...">` (Babel transpile **dans le navigateur** à chaque chargement) → ~300 Ko de Babel + parse lent au boot.

### 1.3 Test rétention (5e visite de la semaine)

J'ai simulé un retour quotidien sur 30 jours. Voici les frictions qui apparaissent à l'usage répété :

| # | Friction | Sévérité | Mécanisme |
|---|---|---|---|
| R1 | **Hero macro géant à chaque visite** (`clamp(32px, 4.2vw, 54px)`, padding `44px 32px 40px`, body en `--text-xl` 18px ligne 1.65) | 🔴 Élevée | Le hero occupe 60-70% de la fold sur laptop 14". L'utilisateur scrolle systématiquement avant d'atteindre les Top 3. Effet "page d'accueil presse" sympa la 1ère fois, surdimensionné quotidiennement. |
| R2 | **Animations pulse à chaque montage** (`.kicker-dot` pulse 3 fois, `.sb-group-hotdot` pulse 3 fois) | 🟠 Moyenne | Limitées à 3 itérations (mitigé) mais déclenchées **chaque navigation** (chaque clic sidebar = remount partiel). Cumul : 5-15 pulses par session. |
| R3 | **Page header sticky + Hero non collapsible** | 🟠 Moyenne | `.ph` reste sticky (`top: 0; z-index: 40`) mais le Hero ne se compacte pas au scroll. Hauteur fixe répétée. |
| R4 | **Boutons primary `--tx` (encre presque noire) sur fond crème** | 🟠 Moyenne | `.btn--primary` et `.ph-chip--primary` utilisent `background: var(--tx)` (#1F1815) → contraste très fort sur Dawn. À la 20e visite, l'œil cherche le repos. |
| R5 | **22 fichiers `data-*.js` chargés en synchrone au boot** (avant même la auth) | 🔴 Élevée | Bloque le render initial. Le Babel transpiler des 25 panels JSX charge en **série** (`type="text/babel"`). FCP ressenti : 2-4s sur une bonne connexion, 6-10s en 4G. |
| R6 | **Aucune persistance de la dernière vue active** | 🟢 Faible | `useState(() => location.hash || "brief")` — bon réflexe. Mais `dataVersion` reset = rerender lourd à chaque hydration. |
| R7 | **Audio brief estimation fragile** (body.length / 280) | 🟢 Faible | Si la macro Gemini renvoie 1500 chars, affiche "Lecture audio · 5 min" mais en fait c'est ~3min réelles. Mine la confiance après 1-2 essais. |
| R8 | **`kbd-fab` floating button bottom-right en permanence** (`?` overlay raccourcis) | 🟢 Faible | Petit (36×36) mais toujours là. Sur mobile, il colle au pouce-droit. Utile la 1ère semaine, bruit visuel les semaines suivantes. |
| R9 | **Streak "0 j" sans encouragement zero-state** quand l'utilisateur n'a pas ouvert depuis 2 jours | 🟠 Moyenne | Un cockpit personnel doit éviter de punir l'absence — affichage actuel `flame icon + "streak veille"` quand `streak === null` sans message positif. |
| R10 | **Aucun feedback "données fraîches" / "données stale"** au niveau page | 🟠 Moyenne | Si le pipeline 6h UTC a échoué la veille, l'utilisateur lit son brief d'avant-hier sans le savoir. Le footer sidebar dit "prochain 06:00" mais pas "dernière mise à jour il y a 28h". |

**Verdict rétention** : le cockpit est **conçu comme une expérience matinale "presse haut de gamme"**. Cette signature est forte 1-3x/semaine. Au-delà, le poids visuel et le boot lent grèvent l'usage quotidien. Les mécaniques anti-friction (delta hero, zero state, snooze, undo) sont **excellentes individuellement**, mais empilées sur un Hero éditorial XL elles ne suffisent pas à compenser la fatigue de scan.

---

## 2. Matrice d'évaluation

Notes /5. Moyenne par section. Critères : Clarté · Densité · Cohérence · Interactions · Mobile · Accessibilité · Rétention.

| Section | Clarté | Densité | Cohérence | Interactions | Mobile | A11y | Rétention | **Moy.** |
|---|---|---|---|---|---|---|---|---|
| **Shell — Sidebar + nav** | 4 | 3 | 4 | 5 | 4 | 4 | 4 | **4.0** |
| **Shell — Top bar / Page header** | 4 | 2 | 4 | 4 | 3 | 3 | 3 | **3.3** |
| **Auth overlay** | 4 | 5 | 2 | 3 | 4 | 3 | n/a | **3.5** |
| **Brief — Hero macro** | 5 | 2 | 5 | 4 | 4 | 4 | 2 | **3.7** |
| **Brief — Top 3 / Morning Card** | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4.4** |
| **Brief — Hero delta (depuis ta dernière visite)** | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4.4** |
| **Brief — Audio brief** | 3 | 4 | 4 | 3 | 3 | 4 | 3 | **3.4** |
| **Brief — Signaux (cards)** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Brief — Radar SVG** | 4 | 3 | 5 | 3 | 4 | 3 | 3 | **3.6** |
| **Brief — Zero state** | 5 | 4 | 4 | 4 | 4 | 4 | 5 | **4.3** |
| **Top du jour / Revue** | 4 | 4 | 4 | 5 | 4 | 4 | 4 | **4.1** |
| **Veille IA / Outils** | 4 | 4 | 3 | 4 | 4 | 4 | 4 | **3.9** |
| **Wiki IA + Tooltip** | 4 | 4 | 4 | 4 | 3 | 3 | 4 | **3.7** |
| **Signaux faibles (panel dédié)** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Radar compétences (panel dédié)** | 4 | 3 | 5 | 3 | 4 | 3 | 3 | **3.6** |
| **Recos / Challenges** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Opportunités** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Carnet d'idées (kanban)** | 5 | 4 | 4 | 5 | 3 | 3 | 5 | **4.1** |
| **Jobs Radar** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** |
| **Jarvis chat** | 4 | 4 | 4 | 5 | 3 | 3 | 5 | **4.0** |
| **Jarvis Lab (specs + archi)** | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| **Profil** | 4 | 4 | 4 | 4 | 4 | 3 | 3 | **3.7** |
| **Forme** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Musique** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Gaming** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** |
| **Stacks & Limits** | 4 | 5 | 4 | 4 | 4 | 4 | 3 | **4.0** |
| **Historique** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** |
| **Recherche** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** |
| **Performance perçue (boot)** | 3 | n/a | n/a | n/a | 2 | 3 | 1 | **2.3** |

**Moyenne cockpit : 3.85 / 5** — produit cohérent, identité forte, quelques zones de friction quotidienne.

### 2.1 Top 3 forces

1. **Design system tri-thématique cohérent** — 3 directions visuelles complètes (Dawn, Obsidian, Atlas) qui partagent les mêmes tokens. Auto-switch par heure (6h-22h Dawn, sinon Obsidian) montre une vraie pensée du cycle quotidien. C'est rare et bien exécuté.
2. **Mécaniques anti-friction sophistiquées** — hero delta "X nouveautés depuis Yh", zero state célébrant l'achèvement, snooze 3 jours, undo 6s sur "tout marqué lu", filtre récent auto-on, command palette, raccourcis clavier. Le produit pense l'usage répété.
3. **Hiérarchie typographique éditoriale** — `Fraunces` italique (display) + `Inter` (body) + `JetBrains Mono` (mono) en Dawn, alignée à du papier presse haut de gamme. Le hero macro a une vraie personnalité qui distingue ce cockpit d'un dashboard générique.

### 2.2 Top 3 faiblesses

1. **Performance de boot** — 22 `data-*.js` synchrones + 19 CSS + Babel CDN qui transpile 25 JSX en série dans le navigateur. **FCP ~3s sur fibre**, 6-10s en mobile 4G. Sur un cockpit ouvert chaque matin, c'est le frein #1 à la rétention.
2. **Hero macro surdimensionné pour usage quotidien** — Le hero est calibré pour un coup d'œil hebdo, pas pour 25 ouvertures/mois. Padding `44px 32px 40px`, titre clamp jusqu'à 54px, body 18px sur 64ch. Manque un mode "compact" persistant pour les visites #2+ de la journée.
3. **Auth overlay en couleurs hardcodées** — `cockpit/lib/auth.js` injecte des `#1F1815` en dur dans le DOM. À la déconnexion + reload, l'utilisateur en thème Obsidian voit un overlay clair. Trahit le design system et fait douter de la cohérence.

---

## 3. Quick Wins & Roadmap Jarvis

### 3.1 Top 10 Quick Wins

Trié par ratio **Impact × Faisabilité décroissant**. Tous les efforts sont en heures de travail Claude Code.

| # | Titre | Description | Impact (/5) | Effort (/5, 1=facile) | Sections | Ratio |
|---|---|---|---|---|---|---|
| QW1 | **Compacter le hero après 1ère visite du jour** | Si `localStorage.cockpit-hero-collapsed-${YYYY-MM-DD}` existe, hero passe en mode `is-compact` (titre clamp 22-32px, body masqué, body devient `<details>` repliable). Bouton "Replier le hero" dans `.ph-right`. Reset à minuit. | 5 | 1 | Brief | 25 |
| QW2 | **Précharger Babel + JSX en parallèle** | Ajouter `<link rel="modulepreload">` sur les `.jsx` critiques (home, app, sidebar, icons) et `<link rel="preload" as="script">` sur Babel. Charger les `data-*.js` non-Tier1 en `defer` + `async`. | 5 | 2 | Shell / boot | 12.5 |
| QW3 | **Fixer l'auth overlay aux tokens** | `cockpit/lib/auth.js` lit `var(--bg)`, `var(--tx)`, `var(--brand)` au runtime via `getComputedStyle(document.documentElement)`. Charger `themes.js` AVANT auth.js et appliquer le thème actif au `<html>` immédiatement. | 4 | 1 | Auth | 20 |
| QW4 | **Couper toutes les animations de pulse à 1 seule itération** | Remplacer `animation: pulse 2s ease 3` par `1` (kicker-dot) et `sbHotPulse 2s ease 3` par `1` (hot dot). Supprimer le pulse répété sur `.sb-foot-streak-icon`. Garder l'animation initiale, retirer le bruit cumulatif. | 4 | 1 | Brief / sidebar | 20 |
| QW5 | **Ajouter une bannière "données fraîches" / "stale"** | Sous le `.ph` : si `daily_briefs.fetch_date < today - 12h`, bandeau orange `--alert-tint` "Brief de hier · pipeline non rafraîchi". Bouton "Forcer le rafraîchissement" qui POST `/admin/refresh` ou pointe vers GitHub Actions. | 4 | 2 | Brief | 10 |
| QW6 | **Rendre l'audio brief honnête** | Remplacer l'estimation `body.length / 280` par le vrai temps : avant `synth.speak(u)`, ne plus afficher d'estimation. Pendant lecture, afficher un compteur live `0:42 / ~3 min` mis à jour via `setInterval`. À la fin, mémoriser la durée réelle pour `localStorage.audio-brief-actual-rate` et ajuster les futures estimations. | 3 | 2 | Brief | 7.5 |
| QW7 | **Mode "rail by default" sur viewports < 1280px** | Sur écrans < 1280px (laptops 13" courants), forcer `sb.is-collapsed` au boot s'il n'y a pas de préférence explicite. Économise 208px horizontaux pour le contenu. | 4 | 1 | Sidebar / responsive | 20 |
| QW8 | **Skip link "Aller au contenu"** | Premier élément du `<body>` : `<a class="skip-link" href="#main-content">Aller au contenu</a>`, masqué visuellement sauf focus. `<main>` de `cockpit/app.jsx` reçoit `id="main-content"`. | 3 | 1 | A11y | 15 |
| QW9 | **Encourager le retour si streak === null** | Quand `data.stats.streak` est `null` ou `0`, remplacer le `prochain 06:00` par "Reviens demain matin · 1er jour" et mettre une légère couleur `--positive` au lieu du rouge `--critical` du flame. | 3 | 1 | Sidebar | 15 |
| QW10 | **Hide kbd-fab après 7 jours d'usage** | Si `localStorage.cockpit-first-visit-ts` existe et que `Date.now() - val > 7 * 86400000`, `display: none` sur `.kbd-fab`. Le raccourci `?` continue de marcher. Réduit le bruit visuel permanent. | 3 | 1 | Shell | 15 |

### 3.2 Roadmap Jarvis — 15 features

Score composite = Impact × Faisabilité (Wow consultatif).

| # | Feature | Description | Impact | Faisab. | Wow | **Composite** |
|---|---|---|---|---|---|---|
| J1 | **Brief vocal quotidien streamé** | Génération audio MP3 par Gemini TTS au moment du pipeline 6h UTC, stocké en Supabase Storage, lecture en streaming dans le hero (pas Web Speech). | 4 | 2 | 5 | **8** |
| J2 | **Reprise contextuelle "tu lisais X hier"** | À l'ouverture, si la dernière action en localStorage est `panel:wiki / slug:transformer-decoder` non terminée, afficher dans le hero une carte "Reprends Transformer Decoder · 2 min restantes". | 5 | 4 | 5 | **20** |
| J3 | **Inbox Zero ritual quotidien** | Mode "Inbox" : empile les Top 3 + signaux nouveaux + recos + 1 challenge en cards swipables (clavier `j`/`k`/`a` archive/`s` snooze) à la Superhuman. À la fin : zero-state célébration + suggestion. | 5 | 3 | 5 | **15** |
| J4 | **Jarvis sidebar permanente "Demande à Jarvis"** | Petit champ flottant en bas de chaque panel "Tape pour demander à Jarvis sur ce panel" — préfille le contexte (panel actif, items visibles, temps passé). | 5 | 4 | 5 | **20** |
| J5 | **Recap audio hebdo "ton dimanche soir"** | Dimanche 21h : Claude génère un recap audio 4-5min de ta semaine (ce que tu as lu, signaux nouveaux, idées capturées, challenges complétés). Notif PWA + lecture in-app. | 5 | 3 | 5 | **15** |
| J6 | **Comparateur "ton cockpit vs il y a 30 jours"** | Vue diff : signaux qui ont émergé en 30j, concepts wiki ajoutés, axes radar qui ont bougé. Encourage la rétention en montrant le delta de progression. | 5 | 3 | 4 | **15** |
| J7 | **Quick capture vocal global** | `Ctrl+Shift+V` (ou raccourci PWA notification) → micro on, transcription Whisper local (ou Web Speech), classification Jarvis (idée / fait profil / signal / TODO RTE) + ack. | 5 | 2 | 5 | **10** |
| J8 | **Mode focus "1 seul article"** | Quand tu cliques un Top 3, ouverture en mode lecture plein écran épuré (texte centré, max-width 70ch, font Fraunces, 3 actions : Marquer lu / Snooze / Ask Jarvis), reprise depuis cockpit après. | 4 | 4 | 4 | **16** |
| J9 | **Widget "rétention santé"** | Dans le footer sidebar : si tu n'as pas ouvert le cockpit hier, un microcopy doux "Tu as sauté hier, c'est OK. 4 nouveautés t'attendent." (pas de shame). | 3 | 5 | 4 | **15** |
| J10 | **Smart-collapse des panels rarement visités** | Après 14j sans ouvrir un panel, il passe en bas de son groupe sidebar avec opacité 0.5 et un menu "Masquer / Réactiver". | 4 | 4 | 3 | **16** |
| J11 | **Dashboard rituel matinal "5 minutes"** | Une page dédiée `/morning` qui en 5 min t'amène : 3 articles à lire (lecture vocale), 1 challenge, 1 signal nouveau, validation profil. Designed pour mobile main + café. | 5 | 3 | 5 | **15** |
| J12 | **Intégration Notion / Obsidian export** | Bouton sur chaque article / wiki concept / idée : "Export vers Notion" (deep-link `notion://`) + clipboard markdown formaté. Rend le cockpit pont vers ton stack notes existant. | 4 | 4 | 3 | **16** |
| J13 | **Anti-doomscroll : limite quotidienne paramétrable** | Si tu as ouvert "Veille IA" 5 fois aujourd'hui, modal doux "Tu y as déjà passé 24min aujourd'hui. Continuer ou aller au Carnet d'idées ?" — proposer une action constructive. | 4 | 4 | 4 | **16** |
| J14 | **Theme switching basé sur le contenu** | Quand tu ouvres "Forme" → bascule auto Atlas (Swiss, neutre, données). Quand tu ouvres "Brief" → Dawn (éditorial). Quand tu ouvres "Stacks & Limits" → Obsidian (terminal). Override par switcher. | 3 | 4 | 5 | **12** |
| J15 | **Streak resilience "carnet de bord"** | Le streak ne casse plus à 1 jour manqué : 1 "joker" par semaine. Visualiser dans le footer : `27j · 1 joker dispo`. Pédagogie de la régularité, pas de la perfection. | 4 | 5 | 4 | **20** |

**Top 5 par composite** : J2 (20), J4 (20), J15 (20), J8 (16), J10 (16) → ces 5 deviennent des prompts en Phase 4.

### 3.3 Mockups textuels

#### Mockup A — J2 : Reprise contextuelle "tu lisais X hier"

```
┌─────────────────────────────────────────────────────────────────┐
│ SEMAINE 17 · J118  /  Brief du jour  ·  Mardi 28 avril 2026    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ╭─ Reprends où tu en étais ────────────────────────╮          │
│  │                                                   │          │
│  │  ⏵  Wiki — Transformer Decoder                   │          │
│  │     Tu as commencé hier · 2 min de lecture restante│         │
│  │     [ Reprendre → ]   [ Plus tard ]               │          │
│  │                                                   │          │
│  ╰───────────────────────────────────────────────────╯          │
│                                                                 │
│  ─────────────── BRIEF DU JOUR — 18 ARTICLES ───────────────   │
│                                                                 │
│  Titre macro Fraunces italique sur 2 lignes                    │
│  Body 18px sur 64ch...                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Détection : `localStorage.last-incomplete-action = { panel, sub_id, started_at, est_remaining_ms }` mis à jour quand l'utilisateur quitte un panel sans le terminer (heuristique : moins de 80% scrollé OU lecture < 60% du temps estimé).

#### Mockup B — J4 : "Demande à Jarvis sur ce panel"

```
┌─ Panel Veille IA ──────────────────────────────────────────────┐
│                                                                 │
│  [contenu normal du panel]                                      │
│                                                                 │
│  ...                                                            │
│  ...                                                            │
│                                                                 │
│ ┌────────────────────────────────────────────────────────┐     │
│ │ 💬 Demande à Jarvis sur cette page (Ctrl+J)            │     │
│ │ ─────────────────────────────────────────────────────── │     │
│ │  > _                                                    │     │
│ │  💡 Suggestions : "Résume les 5 articles ouverts" ·    │     │
│ │     "Pourquoi Mistral a baissé en signaux ?"            │     │
│ └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

Sticky bottom-right, hauteur compacte (52px replié, ouvre en overlay 320px à la saisie). Préfille le contexte invisiblement : `[ panel: updates, articles_visible: [42 ids], time_on_panel: 124s ]`.

#### Mockup C — J15 : Streak resilience "carnet de bord"

```
Footer sidebar — état normal
┌──────────────────────────┐
│ 🔥 27 j  streak veille   │
│           prochain 06:00 │
└──────────────────────────┘

Footer sidebar — état avec joker
┌──────────────────────────┐
│ 🔥 27 j  streak           │
│ 🃏 1 joker  prochain 06h  │
└──────────────────────────┘

Footer sidebar — joker utilisé
┌──────────────────────────┐
│ 🔥 28 j  streak (avec 🃏) │
│           prochain 06:00 │
└──────────────────────────┘

Modal au reset de streak (sans joker dispo)
┌────────────────────────────────────────┐
│ Streak interrompu — c'est OK.          │
│                                        │
│ Tu avais 27 jours. La prochaine        │
│ régularité commence demain.             │
│                                        │
│ La discipline n'est pas l'absence       │
│ d'erreur. C'est le retour.              │
│                                        │
│  [ Compris ]                            │
└────────────────────────────────────────┘
```

---

## 4. Prompts Claude Code

**Convention** : tous les prompts ciblent la stack actuelle (React 18 + Babel standalone, fichiers JSX dans `cockpit/`, CSS dans `cockpit/styles*.css`, tokens dans `cockpit/themes.js`). Pas de framework JS supplémentaire, pas de TypeScript, pas de build step.

---

### P0 — Quick wins immédiats (effort ≤ 30 min)

---

#### Prompt 1 — [UX] Compacter le hero après 1ère visite du jour
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
Tu travailles sur le cockpit AI Cockpit (https://github.com/ph3nixx/jarvis-cockpit).
Stack : React 18 + Babel standalone, multi-fichiers, pas de build step.

Objectif : le hero du Brief du jour (`cockpit/home.jsx`, composant `Home`,
section avec className "hero") est calibré pour un coup d'œil hebdo —
trop encombrant en 2e/3e visite de la même journée. Ajouter un mode
"compact" persistant à la journée, déclenché après la 1ère visite.

Implémentation :

1. Dans `cockpit/home.jsx`, dans le composant `Home`, ajouter :

   const todayKey = new Date().toISOString().slice(0, 10);
   const heroCollapsedKey = `cockpit-hero-collapsed-${todayKey}`;
   const [heroCompact, setHeroCompact] = React.useState(() => {
     try { return localStorage.getItem(heroCollapsedKey) === "1"; } catch { return false; }
   });
   React.useEffect(() => {
     try {
       if (heroCompact) localStorage.setItem(heroCollapsedKey, "1");
       else localStorage.removeItem(heroCollapsedKey);
     } catch {}
   }, [heroCompact, heroCollapsedKey]);

2. Dans le rendu, ajouter `className={`hero ${heroCompact ? "is-compact" : ""}`}`
   sur le `<section className="hero">` du brief complet (autour de la ligne 376
   `<section className="hero">`).

3. Dans le bandeau `.ph-right` du page header (lignes ~343-349), ajouter
   AVANT le bouton "Tout marqué lu" :

   <button
     className="ph-chip"
     onClick={() => setHeroCompact(v => !v)}
     title={heroCompact ? "Déplier le hero" : "Replier le hero pour aujourd'hui"}
   >
     <Icon name={heroCompact ? "chevron_down" : "chevron_up"} size={12} stroke={2} />
     {heroCompact ? "Déplier" : "Replier"}
   </button>

   (Si l'icône `chevron_up`/`chevron_down` n'existe pas dans `cockpit/icons.jsx`,
   utiliser `arrow_up`/`arrow_down`.)

4. Dans `cockpit/styles.css`, juste après le bloc `.hero { ... }` (autour ligne 558),
   ajouter :

   .hero.is-compact { padding: 16px 32px 14px; }
   .hero.is-compact .hero-title {
     font-size: clamp(20px, 2.4vw, 28px);
     line-height: 1.15;
     margin-bottom: 6px;
   }
   .hero.is-compact .hero-body {
     display: none;
   }
   .hero.is-compact .hero-kicker {
     margin-bottom: 8px;
   }
   .hero.is-compact .hero-actions {
     gap: 6px;
   }
   .hero.is-compact .hero-frame {
     gap: 24px;
   }
   .hero.is-compact .hero-col-side {
     /* La colonne droite (todo, etc.) reste visible mais compactée si elle existe */
   }
   @media (max-width: 760px) {
     .hero.is-compact { padding: 12px 18px 10px !important; }
   }

5. Le mode est par défaut désactivé (le hero plein s'affiche). Le user peut
   le replier manuellement, ou on peut auto-replier après la 2e visite du
   même jour (extension future).

Contraintes : pas de framework supplémentaire, pas de transition CSS qui
re-déclenche les animations existantes (kicker-dot pulse). La transition
doit être sur padding/font-size uniquement, max 200ms ease.

Validation : ouvrir le brief, cliquer "Replier", recharger la page → le
hero reste compact toute la journée. Le lendemain matin (changement de date),
le hero re-déplie automatiquement (le localStorage key change).
```

**Validation utilisateur** : "Je clique 'Replier', mon hero passe de 70% de la fold à 15%. Je recharge à 14h, c'est toujours replié. Demain matin à 7h, c'est de nouveau plein."

---

#### Prompt 2 — [UX] Couper les animations pulse répétées
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`

```
Le cockpit a 2 animations pulse qui se déclenchent à chaque montage de
composant : `.kicker-dot` (animation pulse 2s ease 3) dans le brief, et
`.sb-group-hotdot` (animation sbHotPulse 2s ease 3) dans la sidebar.

Limitées à 3 itérations chacune mais déclenchées à chaque navigation
(remount partiel React) → cumul 5-15 pulses par session de 5 panels.

Objectif : réduire à 1 itération initiale, puis static.

Modifications dans `cockpit/styles.css` :

1. Trouver `@keyframes pulse` (autour ligne 588) et la déclaration
   `.kicker-dot { ... animation: pulse 2s ease 3; }`. Remplacer le
   `3` par `1`.

2. Trouver `@keyframes sbHotPulse` (autour ligne 218) et la déclaration
   `.sb-group-hotdot { ... animation: sbHotPulse 2s ease 3; }`. Remplacer
   le `3` par `1`.

3. Ajouter `animation-fill-mode: forwards;` aux deux pour que l'état final
   (sans halo) soit conservé.

Le bloc @media (prefers-reduced-motion: reduce) qui désactive ces
animations doit rester intact.

Validation : naviguer entre 5 panels → la kicker-dot pulse 1 fois au 1er
montage du Brief, puis reste statique. Idem hot dot sidebar.
```

**Validation utilisateur** : "J'ouvre 5 panels d'affilée. Je ne vois aucune animation parasite après le 1er chargement."

---

#### Prompt 3 — [UX] Auth overlay réutilisant les tokens du thème actif
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/lib/auth.js`, `index.html`, `cockpit/themes.js`

```
Le fichier `cockpit/lib/auth.js` injecte un overlay de connexion avec
des couleurs hardcodées (#1F1815, #C2410C, #5E524A, #F5EFE4). Si
l'utilisateur a sélectionné le thème Obsidian ou Atlas et qu'il se
déconnecte, l'overlay s'affiche en couleurs Dawn → casse le design system.

Objectif : appliquer le thème actif (lu depuis localStorage) AVANT que
l'overlay s'affiche, et utiliser les tokens CSS dans l'overlay.

1. Dans `index.html`, déplacer `<script src="cockpit/themes.js?v=2"></script>`
   AVANT `<script src="cockpit/lib/auth.js?v=1"></script>` (actuellement
   themes.js est chargé après auth.js).

2. Au tout début de `cockpit/lib/auth.js` (avant le `(function(){`),
   appliquer le thème stocké au document.documentElement :

   (function applyStoredTheme() {
     try {
       const id = localStorage.getItem("cockpit-theme") ||
         (new Date().getHours() >= 22 || new Date().getHours() < 6 ? "obsidian" : "dawn");
       const theme = (window.THEMES && window.THEMES[id]) || null;
       if (!theme) return;
       const root = document.documentElement;
       root.setAttribute("data-theme", id);
       Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
     } catch {}
   })();

3. Dans `cockpit/lib/auth.js`, dans la fonction `makeOverlay()`, remplacer
   le `style.cssText` du wrapper et le innerHTML par un usage de variables
   CSS :

   o.style.cssText = [
     "position:fixed","inset:0","z-index:9999",
     "display:flex","align-items:center","justify-content:center",
     "background:var(--bg)",
     "font-family:var(--font-body, 'Inter',system-ui,sans-serif)",
   ].join(";");
   o.innerHTML = `
     <div style="max-width:380px;padding:40px 36px;text-align:center">
       <div style="font-family:var(--font-display);font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin-bottom:18px;font-weight:600">
         AI Cockpit
       </div>
       <h1 style="font-family:var(--font-display);font-size:28px;font-weight:500;line-height:1.15;color:var(--tx);margin-bottom:12px;letter-spacing:-.02em">
         Connecte-toi pour ouvrir ton cockpit
       </h1>
       <p style="font-size:14px;line-height:1.6;color:var(--tx2);margin-bottom:28px">
         Accès restreint. Google OAuth via Supabase.
       </p>
       <button id="login-btn" style="display:inline-flex;align-items:center;gap:10px;padding:12px 22px;border-radius:6px;background:var(--tx);color:var(--bg2);border:none;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background 120ms">
         [SVG Google logo identique à l'existant]
         Se connecter avec Google
       </button>
       <div id="login-msg" style="margin-top:18px;font-size:12px;color:var(--tx3);min-height:18px"></div>
     </div>
   `;

Validation : se déconnecter en thème Obsidian → l'overlay apparaît en
fond charbon (#0B0D0F) avec accent cyan mint (#60E0D4). Bascule vers
Atlas → fond blanc cassé, accent indigo.
```

**Validation utilisateur** : "Je passe en Obsidian, je log out, l'overlay est dark cohérent. Je passe en Atlas, l'overlay est Swiss-blanc avec encre indigo."

---

#### Prompt 4 — [UX] Mode rail par défaut sur < 1280px
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`

```
Sur les laptops 13" (typique 1280×800 ou 1366×768), la sidebar 264px
mange 20% de la largeur. Le contenu serre. Objectif : démarrer en mode
rail (56px) si écran < 1280px ET pas de préférence explicite.

Dans `cockpit/sidebar.jsx`, modifier `useSbLocalState` pour le key
`SB_COLLAPSED_KEY` afin de calculer une valeur par défaut intelligente.

Remplacer :

  const [collapsed, setCollapsed] = useSbLocalState(SB_COLLAPSED_KEY, false);

par :

  const defaultCollapsed = (() => {
    try {
      const stored = localStorage.getItem(SB_COLLAPSED_KEY);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    if (typeof window !== "undefined" && window.innerWidth < 1280) return true;
    return false;
  })();
  const [collapsed, setCollapsed] = useSbLocalState(SB_COLLAPSED_KEY, defaultCollapsed);

Le hook `useSbLocalState` lit déjà la valeur du localStorage si elle
existe, donc une fois que l'utilisateur a explicitement déplié, son
choix est respecté. La valeur par défaut ne s'applique qu'au 1er load.

Validation : 1) Sur 1080p → sidebar pleine au 1er chargement.
2) Sur 1280×800 → sidebar en rail au 1er chargement, le user déplie,
   recharge → reste pleine.
3) Sur mobile < 760px → la media query masque la sidebar de toute façon
   (drawer), donc cette logique n'est pas active.
```

**Validation utilisateur** : "Sur mon laptop 13", j'arrive directement en mode rail. J'ouvre, ça reste ouvert."

---

#### Prompt 5 — [UX] Skip link "Aller au contenu"
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`

```
Manque a11y : aucun moyen pour un utilisateur clavier de sauter la
sidebar (qui contient ~30 liens dans 6 groupes) pour atteindre le
contenu directement. WCAG 2.1 SC 2.4.1 (Bypass Blocks) niveau A.

1. Dans `cockpit/app.jsx`, dans le rendu du composant `App`, juste avant
   le `<aside>` ou le wrapper `.app`, ajouter :

   <a className="skip-link" href="#main-content">Aller au contenu</a>

   Si le rendu n'expose pas un point d'insertion clean, ajouter dans le
   premier composant qui est mounté à la racine (typically le wrapper
   `<div className="app">`). Préférer l'insertion en tant que premier
   enfant du `<div id="root">`.

2. Sur le `<main className="main">` (qui existe dans le shell), ajouter
   `id="main-content"`.

3. Dans `cockpit/styles.css` (en haut, après le reset), ajouter :

   .skip-link {
     position: absolute;
     top: 0; left: 0;
     padding: 8px 16px;
     background: var(--tx);
     color: var(--bg2);
     font-family: var(--font-body);
     font-size: var(--text-sm);
     font-weight: 500;
     border-radius: 0 0 var(--radius) 0;
     transform: translateY(-100%);
     transition: transform 120ms ease;
     z-index: 9999;
   }
   .skip-link:focus,
   .skip-link:focus-visible {
     transform: translateY(0);
     outline: 2px solid var(--brand);
     outline-offset: 2px;
   }

Validation : recharger la page, presser Tab une seule fois → un bouton
"Aller au contenu" apparaît en haut à gauche. Entrée → focus sur le
contenu principal, sidebar skipée.
```

**Validation utilisateur** : "Je presse Tab au chargement, je vois 'Aller au contenu', je presse Entrée, le focus saute la sidebar."

---

#### Prompt 6 — [UX] Encourager le retour si streak null
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Le footer sidebar affiche le streak veille avec une icône flame en
couleur `--critical` (rouge). Quand `data.stats.streak === null` ou `0`,
l'affichage actuel est neutre — pas de pénalisation, mais pas
d'encouragement non plus. Pour un cockpit personnel, on veut un ton
doux qui invite au retour, pas un compteur clinique.

Dans `cockpit/sidebar.jsx`, dans le `Sidebar` component, retravailler
le bloc autour de la ligne 161 :

  {streak === null ? (
    <div className="sb-foot-streak sb-foot-streak--empty">
      ...
    </div>
  ) : (...)}

Remplacer le bloc `streak === null` (`sb-foot-streak--empty`) par :

  <div className="sb-foot-streak sb-foot-streak--zero">
    <span className="sb-foot-streak-icon" aria-hidden="true">
      <Icon name="leaf" size={13} stroke={1.75} />
    </span>
    <div className="sb-foot-streak-meta">
      <span>Bienvenue</span>
      <span className="sb-foot-next">1er jour · prochain 06:00</span>
    </div>
  </div>

(Si `leaf` n'existe pas dans icons.jsx, utiliser `sparkle` ou `star`.)

Dans `cockpit/styles.css`, ajouter (après les styles `.sb-foot-streak--empty`
existants) :

  .sb-foot-streak--zero .sb-foot-streak-icon {
    color: var(--positive);
  }
  .sb-foot-streak--zero .sb-foot-streak-meta > :first-child {
    color: var(--positive);
  }

Idem si streak === 0 : ajouter une condition séparée pour streak === 0
qui dit "Premier jour" en `--positive` au lieu d'afficher 0 en rouge.

Validation : un user qui n'a jamais ouvert le cockpit voit "Bienvenue ·
1er jour · prochain 06:00" en vert doux dans le footer. Pas de "0j"
intimidant.
```

**Validation utilisateur** : "Je teste avec un compte vide, le footer m'invite à revenir au lieu de me dire 0."

---

#### Prompt 7 — [UX] Hide kbd-fab après 7 jours
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`

```
Le bouton flottant `?` (`.kbd-fab` bottom-right) qui ouvre l'overlay
des raccourcis est utile la 1ère semaine, devient bruit ensuite. Le
raccourci `?` continue de marcher.

1. Dans `cockpit/app.jsx`, dans `App`, ajouter au début du composant :

   const isVeteran = React.useMemo(() => {
     try {
       const ts = Number(localStorage.getItem("cockpit-first-visit-ts"));
       if (!Number.isFinite(ts) || ts <= 0) {
         localStorage.setItem("cockpit-first-visit-ts", String(Date.now()));
         return false;
       }
       return (Date.now() - ts) > 7 * 86400 * 1000;
     } catch { return false; }
   }, []);

2. Sur le `<button className="kbd-fab">` (chercher dans app.jsx), conditionner :

   {!isVeteran && (
     <button className="kbd-fab" onClick={() => setShortcutsOpen(true)}>?</button>
   )}

3. Optionnel : afficher un tooltip "Astuce : tape `?` pour les raccourcis"
   au moment où le FAB disparaît (timeout 7j + 1 affichage). Pas
   strictement nécessaire en V1.

Validation : un user qui ouvre le cockpit pour la 1ère fois voit le `?`
flottant. 8 jours plus tard, il a disparu, mais `?` continue d'ouvrir
l'overlay.
```

**Validation utilisateur** : "J'utilise le cockpit depuis 2 semaines, plus de pastille flottante en bas à droite."

---

### P1 — Améliorations UX significatives (effort 30 min - 2h)

---

#### Prompt 8 — [UX] Bannière "données fraîches / stale"
**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
Si le pipeline 6h UTC échoue, l'utilisateur lit son brief de la veille
sans le savoir. Objectif : afficher une bannière claire au-dessus du
hero quand `data.macro.fetch_iso` (ou `data.date.iso`) date de plus de
12h.

1. Dans `cockpit/home.jsx`, dans le composant `Home`, calculer :

   const briefAge = React.useMemo(() => {
     try {
       const iso = data.macro?.fetch_iso || data.date?.iso || null;
       if (!iso) return null;
       const ts = new Date(iso).getTime();
       if (!Number.isFinite(ts)) return null;
       const hours = (Date.now() - ts) / 3600000;
       return { hours, iso };
     } catch { return null; }
   }, [data]);
   const isStale = briefAge && briefAge.hours > 12;

2. Juste après `<header className="ph">...</header>`, AVANT le toggle morning-card,
   ajouter :

   {isStale && (
     <div className="brief-stale-banner" role="status">
       <Icon name="alert" size={14} stroke={2} />
       <span>
         Brief publié il y a {Math.round(briefAge.hours)}h —
         pipeline non rafraîchi ce matin.
       </span>
       <a
         className="brief-stale-link"
         href="https://github.com/ph3nixx/jarvis-cockpit/actions/workflows/daily_digest.yml"
         target="_blank" rel="noopener"
       >
         Voir GitHub Actions →
       </a>
     </div>
   )}

3. Dans `cockpit/styles.css`, ajouter :

   .brief-stale-banner {
     display: flex; align-items: center; gap: var(--space-3);
     padding: var(--space-3) var(--space-6);
     background: var(--alert-tint);
     border-bottom: 1px solid color-mix(in srgb, var(--alert) 40%, var(--bd));
     color: var(--alert);
     font-size: var(--text-sm);
     font-family: var(--font-body);
   }
   .brief-stale-banner svg { flex-shrink: 0; }
   .brief-stale-link {
     margin-left: auto;
     font-family: var(--font-mono);
     font-size: var(--text-xs);
     letter-spacing: 0.04em;
     color: var(--alert);
     text-decoration: underline;
   }
   .brief-stale-link:hover { color: var(--brand-ink); }
   @media (max-width: 760px) {
     .brief-stale-banner {
       padding: var(--space-2) var(--space-4);
       flex-wrap: wrap;
       font-size: var(--text-xs);
     }
   }

Si `data.macro.fetch_iso` n'existe pas dans le shape actuel, vérifier
quel champ représente la date de génération du brief (typiquement dans
data-loader.js, lookup `daily_briefs.fetch_date` ou équivalent), et
adapter le calcul.

Validation : modifier manuellement la `fetch_iso` pour qu'elle date d'il
y a 14h → la bannière apparaît, le lien GitHub Actions ouvre dans un
nouvel onglet. Mettre à jour à il y a 2h → la bannière disparaît.
```

**Validation utilisateur** : "Le pipeline a planté cette nuit, j'ouvre le cockpit, je sais immédiatement que mon brief est de la veille, et j'ai un lien direct pour vérifier."

---

#### Prompt 9 — [UX] Audio brief honnête
**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`

```
L'estimation d'audio brief actuelle est `body.length / 280` minutes,
qui surestime systématiquement de 30-50%. Ça mine la confiance après
2-3 essais. Objectif : afficher l'estimation seulement avant la lecture
ET un compteur live pendant la lecture, et apprendre la durée réelle.

Dans `cockpit/home.jsx`, dans le composant `AudioBriefChip` :

1. Ajouter au début du composant :

   const learnedRate = React.useMemo(() => {
     try {
       const v = parseFloat(localStorage.getItem("audio-brief-chars-per-sec"));
       return Number.isFinite(v) && v > 5 ? v : 14; // fallback ~14 char/s = ~840 char/min
     } catch { return 14; }
   }, []);

2. Remplacer le calcul `est` :

   const charCount = (macro.title || "").length + (macro.body || "").length + 2;
   const estSec = Math.round(charCount / learnedRate);
   const estLabel = estSec >= 60 ? `${Math.round(estSec / 60)} min` : `${estSec}s`;

3. Ajouter un state pour le compteur live :

   const [elapsedSec, setElapsedSec] = React.useState(0);
   const tickerRef = React.useRef(null);
   const startedAtRef = React.useRef(null);

4. Dans `speak()`, après `synth.speak(u)` :

   startedAtRef.current = Date.now();
   setElapsedSec(0);
   tickerRef.current = setInterval(() => {
     setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
   }, 500);

5. Dans `u.onend` ET `u.onerror` :

   if (tickerRef.current) clearInterval(tickerRef.current);
   tickerRef.current = null;
   if (startedAtRef.current) {
     const actualSec = (Date.now() - startedAtRef.current) / 1000;
     if (actualSec > 5 && charCount > 100) {
       try {
         const newRate = charCount / actualSec;
         // Moyenne mobile pondérée 70/30 pour stabiliser
         const blended = learnedRate * 0.7 + newRate * 0.3;
         localStorage.setItem("audio-brief-chars-per-sec", String(blended));
       } catch {}
     }
   }
   startedAtRef.current = null;
   setElapsedSec(0);
   setState("idle");

6. Adapter le label rendu :

   const label = state === "speaking"
     ? `Arrêter · ${elapsedSec}s / ~${estLabel}`
     : `Lecture audio · ~${estLabel}`;

Validation : 1) Avant lecture, label = "Lecture audio · ~3 min".
2) Pendant lecture, compteur live "Arrêter · 0:42 / ~3 min".
3) Après 3 lectures de briefs comparables, l'estimation se stabilise
   autour de la durée réelle.
```

**Validation utilisateur** : "Je clique 'Lecture', je vois le temps qui défile, et l'estimation devient juste après 2-3 utilisations."

---

#### Prompt 10 — [UX] Précharger Babel + JSX critiques
**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `index.html`

```
Le boot actuel charge en série : 22 fichiers `data-*.js`, 19 CSS, Babel
standalone (~300 Ko), puis 25 fichiers `.jsx` que Babel doit transpiler
avant exécution. FCP ressenti : 2-4s sur fibre, 6-10s en 4G.

Objectif quick win : préchargements parallèles des assets critiques pour
gagner 500-1500ms sur le FCP.

Dans `index.html`, dans le `<head>` (juste après les `<link rel="preconnect">`),
ajouter :

  <!-- Preload critical scripts in parallel -->
  <link rel="preload" as="script" href="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin="anonymous">
  <link rel="preload" as="script" href="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin="anonymous">
  <link rel="preload" as="script" href="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous">
  <link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js">

  <!-- Preload critical JSX boot files -->
  <link rel="preload" as="fetch" href="cockpit/icons.jsx?v=3" crossorigin="anonymous">
  <link rel="preload" as="fetch" href="cockpit/sidebar.jsx?v=6" crossorigin="anonymous">
  <link rel="preload" as="fetch" href="cockpit/home.jsx?v=4" crossorigin="anonymous">
  <link rel="preload" as="fetch" href="cockpit/app.jsx?v=30" crossorigin="anonymous">
  <link rel="preload" as="fetch" href="cockpit/lib/data-loader.js?v=35" crossorigin="anonymous">

Sur les `<script>` non-Tier1 (les data-*.js qui correspondent à des
panels Tier 2 lazy : data-musique.js, data-gaming-perso.js,
data-stacks.js, data-history.js, data-jobs.js, data-anime.js, data-news.js,
data-sport.js, data-gaming.js, data-jarvis.js, data-profile.js,
data-forme.js, data-wiki.js, data-challenges.js, data-signals.js,
data-opportunities.js, data-ideas.js, data-veille.js, data-claude.js,
data-apprentissage.js), ajouter `defer`.

GARDER en synchrone (avant React mount) : data.js (shape de référence)
et nav.js (consommé par data-loader.js et data.js).

Exemple :
  <script defer src="cockpit/data-musique.js?v=1"></script>

Vérifier sur le devtools Network : les preloads doivent apparaître au
tout début, en parallèle.

Validation : Lighthouse avant/après — gain attendu 500-1500ms sur le
First Contentful Paint. La fenêtre de transpiling Babel reste mais les
fichiers source arrivent plus tôt.
```

**Validation utilisateur** : "Au prochain rechargement, je sens que ça démarre plus vite. Lighthouse confirme un gain sur le FCP."

---

### P2 — Polish & features Jarvis avancées

---

#### Prompt 11 — [JARVIS] Reprise contextuelle "tu lisais X hier" — Partie 1 (capture d'événements)
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/lib/data-loader.js`, `cockpit/app.jsx`

```
Feature Jarvis : afficher dans le hero du Brief une carte "Reprends où
tu en étais" pointant vers un panel non-terminé de la veille.

Cette tâche = Partie 1 sur 2. On capture les événements "lecture
incomplète" en localStorage. Partie 2 (prompt suivant) ajoutera la
carte UI.

Définition d'une "lecture incomplète" : un user ouvre le panel `wiki`,
clique un concept, mais ne marque pas comme lu et navigue ailleurs en
moins de 60 secondes.

1. Créer un nouveau fichier `cockpit/lib/resume-tracker.js` :

   // resume-tracker.js — capture les pages incomplètement consommées
   // pour proposer une reprise dans le hero du Brief.
   (function(){
     const KEY = "cockpit-resume-state";
     const HEARTBEAT_MS = 5000;     // Update every 5s
     const MIN_READ_SEC = 8;         // Below 8s = not started, ignored
     const COMPLETE_SCROLL = 0.85;   // 85% scrolled = complete
     const STALE_DAYS = 2;           // Drop entries > 2 days old

     let current = null;
     let heartbeat = null;

     function load() {
       try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
       catch { return []; }
     }
     function save(items) {
       try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
     }
     function prune(items) {
       const cutoff = Date.now() - STALE_DAYS * 86400 * 1000;
       return items.filter(i => i.last_seen > cutoff);
     }

     function start({ panel, sub_id, title, est_total_ms }) {
       finish(); // Close any previous
       current = {
         panel, sub_id, title,
         started_at: Date.now(),
         last_seen: Date.now(),
         est_total_ms: est_total_ms || null,
         max_scroll: 0,
         completed: false,
       };
       heartbeat = setInterval(() => {
         if (!current) return;
         current.last_seen = Date.now();
         const sc = document.documentElement;
         const ratio = (sc.scrollTop + window.innerHeight) / Math.max(1, sc.scrollHeight);
         current.max_scroll = Math.max(current.max_scroll, ratio);
         if (current.max_scroll >= COMPLETE_SCROLL) current.completed = true;
       }, HEARTBEAT_MS);
     }

     function finish() {
       if (heartbeat) clearInterval(heartbeat);
       heartbeat = null;
       if (!current) return;
       const elapsedSec = (Date.now() - current.started_at) / 1000;
       if (elapsedSec < MIN_READ_SEC) { current = null; return; }
       const items = prune(load()).filter(i =>
         !(i.panel === current.panel && i.sub_id === current.sub_id)
       );
       items.push(current);
       save(items.slice(-20));
       current = null;
     }

     function getResumeCandidate() {
       const items = prune(load())
         .filter(i => !i.completed)
         .sort((a, b) => b.last_seen - a.last_seen);
       return items[0] || null;
     }

     function clearCandidate(panel, sub_id) {
       const items = load().filter(i => !(i.panel === panel && i.sub_id === sub_id));
       save(items);
     }

     // Auto-finish on unload + visibility change
     window.addEventListener("beforeunload", finish);
     document.addEventListener("visibilitychange", () => {
       if (document.hidden) finish();
     });

     window.cockpitResume = { start, finish, getResumeCandidate, clearCandidate };
   })();

2. Dans `index.html`, ajouter le script (après `data-loader.js`) :

   <script src="cockpit/lib/resume-tracker.js?v=1"></script>

3. Dans `cockpit/app.jsx`, dans le `useEffect` qui réagit à
   `activePanel` (ou créer un nouveau useEffect dédié), appeler
   `cockpitResume.start` quand un panel s'ouvre :

   React.useEffect(() => {
     if (!window.cockpitResume) return;
     // Lookup le label depuis nav
     let label = activePanel;
     for (const g of (window.COCKPIT_NAV || [])) {
       const item = g.items.find(it => it.id === activePanel);
       if (item) { label = item.label; break; }
     }
     window.cockpitResume.start({ panel: activePanel, sub_id: null, title: label });
   }, [activePanel]);

4. Dans `panel-wiki.jsx`, quand l'utilisateur ouvre un concept détaillé,
   appeler `cockpitResume.start({ panel: "wiki", sub_id: slug, title: name })`.
   Idem panel-veille.jsx pour les articles ouverts.

Validation : ouvrir le brief, naviguer vers Wiki, lire un concept 15s,
quitter sans aller au bout, ouvrir devtools → localStorage
`cockpit-resume-state` contient une entrée `{panel: "wiki", sub_id: "...",
completed: false}`.
```

**Validation utilisateur** : "Je teste, le tracker capture bien mes navigations sans complétion. La Partie 2 utilisera ces données."

---

#### Prompt 12 — [JARVIS] Reprise contextuelle — Partie 2 (carte UI dans le hero)
**Priorité** : P2
**Dépend de** : Prompt 11
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
Suite du Prompt 11. On affiche dans le hero du Brief une carte
"Reprends où tu en étais" basée sur `cockpitResume.getResumeCandidate()`.

1. Dans `cockpit/home.jsx`, dans le composant `Home`, ajouter :

   const [resumeCard, setResumeCard] = React.useState(() => {
     try { return window.cockpitResume?.getResumeCandidate?.() || null; }
     catch { return null; }
   });

   const dismissResume = () => {
     if (resumeCard && window.cockpitResume) {
       window.cockpitResume.clearCandidate(resumeCard.panel, resumeCard.sub_id);
     }
     setResumeCard(null);
   };
   const goToResume = () => {
     if (!resumeCard) return;
     // Stash sub_id for the panel to consume on mount
     if (resumeCard.sub_id) {
       try {
         localStorage.setItem(`${resumeCard.panel}-open-entry`, resumeCard.sub_id);
       } catch {}
     }
     onNavigate(resumeCard.panel);
     dismissResume();
   };

2. Juste après le `<header className="ph">`, et AVANT la bannière stale
   (si Prompt 8 implémenté) :

   {resumeCard && resumeCard.last_seen < Date.now() - 30 * 60 * 1000 && (
     <section className="resume-card" role="region" aria-label="Reprends où tu en étais">
       <div className="resume-card-icon">
         <Icon name="bookmark" size={14} stroke={2} />
       </div>
       <div className="resume-card-body">
         <div className="resume-card-eyebrow">Reprends où tu en étais</div>
         <div className="resume-card-title">{resumeCard.title}</div>
         <div className="resume-card-meta">
           {ageOf(new Date(resumeCard.last_seen).toISOString())} ·
           {resumeCard.max_scroll
             ? ` ${Math.round((1 - resumeCard.max_scroll) * 100)}% restants`
             : " à reprendre"}
         </div>
       </div>
       <div className="resume-card-actions">
         <button className="btn btn--primary btn--sm" onClick={goToResume}>
           Reprendre <Icon name="arrow_right" size={12} stroke={2} />
         </button>
         <button className="btn btn--ghost btn--sm" onClick={dismissResume}>
           Plus tard
         </button>
       </div>
     </section>
   )}

   Le filtre `last_seen < Date.now() - 30 * 60 * 1000` évite d'afficher
   la carte si le user vient juste d'arriver (la session vient de
   commencer, ce serait bizarre).

3. Dans `cockpit/styles.css`, ajouter :

   .resume-card {
     display: flex; align-items: center;
     gap: var(--space-4);
     padding: var(--space-3) var(--space-6);
     margin: 0;
     background: var(--bg2);
     border-bottom: 1px solid var(--bd);
     animation: resumeSlideIn 240ms ease;
   }
   @keyframes resumeSlideIn {
     from { transform: translateY(-4px); opacity: 0; }
     to { transform: translateY(0); opacity: 1; }
   }
   .resume-card-icon {
     display: flex; align-items: center; justify-content: center;
     width: 32px; height: 32px;
     border-radius: 50%;
     background: var(--brand-tint);
     color: var(--brand);
     flex-shrink: 0;
   }
   .resume-card-body { flex: 1; min-width: 0; }
   .resume-card-eyebrow {
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     letter-spacing: 0.14em;
     text-transform: uppercase;
     color: var(--brand);
     margin-bottom: 2px;
   }
   .resume-card-title {
     font-family: var(--font-display);
     font-size: var(--text-lg);
     color: var(--tx);
     margin-bottom: 2px;
   }
   .resume-card-meta {
     font-family: var(--font-mono);
     font-size: var(--text-xs);
     color: var(--tx3);
     letter-spacing: 0.04em;
   }
   .resume-card-actions {
     display: flex; gap: var(--space-2);
     flex-shrink: 0;
   }
   @media (max-width: 760px) {
     .resume-card {
       padding: var(--space-3) var(--space-4);
       flex-direction: column;
       align-items: stretch;
     }
     .resume-card-actions { justify-content: flex-end; }
   }

Validation : 1) Ouvrir le wiki, lire un concept partiellement (40%),
fermer la fenêtre. 2) Rouvrir le cockpit le lendemain matin → la carte
"Reprends" apparaît au-dessus du hero avec le concept et "60% restants".
3) Cliquer "Plus tard" → la carte disparaît et ne réapparaît plus pour
ce concept. 4) Cliquer "Reprendre" → navigation directe vers le wiki
sur le concept.
```

**Validation utilisateur** : "Hier soir j'ai laissé un concept wiki à moitié, ce matin le cockpit me le propose direct. C'est fluide."

---

#### Prompt 13 — [JARVIS] "Demande à Jarvis sur ce panel" sticky
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`

```
Feature : un input sticky bottom-right, persistant sur tous les panels,
permet de demander à Jarvis avec le contexte du panel actif pré-rempli.

Critère qualité : préfille le contexte (panel + items visibles + temps
sur le panel) AU MOMENT de l'envoi, dans un système prompt invisible
côté UX.

1. Dans `cockpit/app.jsx`, créer un nouveau composant en haut du fichier :

   function AskJarvisDock({ activePanel, onNavigate }) {
     const [val, setVal] = React.useState("");
     const [open, setOpen] = React.useState(false);
     const inputRef = React.useRef(null);

     React.useEffect(() => {
       const handler = (e) => {
         const isEditable = e.target.closest("input, textarea, [contenteditable]");
         if (e.ctrlKey && e.key.toLowerCase() === "j" && !isEditable) {
           e.preventDefault();
           setOpen(true);
           setTimeout(() => inputRef.current?.focus(), 50);
         }
         if (e.key === "Escape" && open) {
           setOpen(false);
           setVal("");
         }
       };
       window.addEventListener("keydown", handler);
       return () => window.removeEventListener("keydown", handler);
     }, [open]);

     const send = () => {
       const q = val.trim();
       if (!q) return;
       const ctx = `[Contexte panel actif : ${activePanel}]`;
       const prompt = `${ctx}\n\nQuestion : ${q}`;
       try { localStorage.setItem("jarvis-prefill", prompt); } catch {}
       onNavigate("jarvis");
       setOpen(false);
       setVal("");
       try { window.track && window.track("ask_jarvis_dock_used", { panel: activePanel, q_length: q.length }); } catch {}
     };

     if (activePanel === "jarvis") return null; // Don't show on Jarvis itself

     return (
       <div className={`ask-dock ${open ? "is-open" : ""}`}>
         {!open ? (
           <button className="ask-dock-trigger" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
             <Icon name="message_circle" size={14} stroke={2} />
             <span>Demande à Jarvis</span>
             <kbd>Ctrl+J</kbd>
           </button>
         ) : (
           <div className="ask-dock-form">
             <input
               ref={inputRef}
               className="ask-dock-input"
               placeholder={`Demande sur "${activePanel}"...`}
               value={val}
               onChange={(e) => setVal(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") send(); }}
             />
             <button className="ask-dock-send" onClick={send} disabled={!val.trim()}>
               <Icon name="arrow_right" size={14} stroke={2} />
             </button>
             <button className="ask-dock-close" onClick={() => { setOpen(false); setVal(""); }}>
               <Icon name="close" size={14} stroke={2} />
             </button>
           </div>
         )}
       </div>
     );
   }

2. Mounter `AskJarvisDock` dans le rendu de `App`, juste avant la fermeture
   du wrapper principal :

   <AskJarvisDock activePanel={activePanel} onNavigate={handleNavigate} />

3. Dans `cockpit/styles.css`, ajouter :

   .ask-dock {
     position: fixed;
     bottom: 16px; right: 16px;
     z-index: 80;
     transition: all 200ms ease;
   }
   .ask-dock-trigger {
     display: inline-flex; align-items: center; gap: var(--space-2);
     padding: var(--space-2) var(--space-3);
     border-radius: 999px;
     background: var(--bg2);
     border: 1px solid var(--bd);
     color: var(--tx2);
     font-size: var(--text-sm);
     box-shadow: var(--shadow-sm);
     transition: all 120ms;
   }
   .ask-dock-trigger:hover {
     border-color: var(--brand);
     color: var(--tx);
   }
   .ask-dock-trigger kbd {
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     padding: 1px 5px;
     background: var(--bg);
     border: 1px solid var(--bd);
     border-radius: 3px;
     margin-left: var(--space-1);
   }
   .ask-dock.is-open {
     left: 20%; right: 20%;
     bottom: 24px;
   }
   .ask-dock-form {
     display: flex; align-items: stretch;
     background: var(--surface);
     border: 1px solid var(--bd2);
     border-radius: var(--radius-lg);
     box-shadow: var(--shadow-md);
     overflow: hidden;
   }
   .ask-dock-input {
     flex: 1;
     border: none; background: transparent;
     padding: var(--space-3) var(--space-4);
     font-family: var(--font-body);
     font-size: var(--text-md);
     color: var(--tx);
     outline: none;
   }
   .ask-dock-input::placeholder { color: var(--tx3); }
   .ask-dock-send, .ask-dock-close {
     padding: 0 var(--space-3);
     border: none; background: transparent;
     color: var(--tx2);
     transition: all 120ms;
   }
   .ask-dock-send:not(:disabled):hover {
     background: var(--brand-tint);
     color: var(--brand);
   }
   .ask-dock-send:disabled { opacity: 0.4; cursor: not-allowed; }
   .ask-dock-close:hover { background: var(--bg2); color: var(--tx); }
   @media (max-width: 760px) {
     .ask-dock { bottom: 64px; right: 14px; }
     .ask-dock.is-open {
       left: 14px; right: 14px;
       bottom: 64px;
     }
   }

4. Mettre à jour la doc des raccourcis dans le `KEYBOARD_SHORTCUTS` array
   en haut de `cockpit/app.jsx` :

   { group: "Navigation", keys: ["Ctrl", "J"], label: "Demande à Jarvis (avec contexte du panel actif)" },

5. Mettre à jour le mapping panel ↔ télémétrie : ajouter `ask_jarvis_dock_used`
   dans la table des events de `CLAUDE.md` (`{ panel, q_length }`).

Validation : 1) Sur n'importe quel panel sauf Jarvis, le dock apparaît
en bas à droite. 2) `Ctrl+J` ouvre le champ de saisie. 3) Taper
"résume", Entrée → navigation vers Jarvis avec le prompt préfilé incluant
"[Contexte panel actif : updates]". 4) Sur le panel Jarvis lui-même, le
dock disparaît (logique).
```

**Validation utilisateur** : "Sur n'importe quel panel, je tape Ctrl+J, je pose ma question, ça file vers Jarvis avec le contexte. Plus besoin de naviguer pour poser une question rapide."

---

#### Prompt 14 — [JARVIS] Streak resilience "carnet de bord" (jokers)
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`, backend Supabase optional

```
Feature : le streak veille casse aujourd'hui à 1 jour manqué. Pour un
cockpit personnel, c'est punitif. On introduit 1 "joker" par semaine
qui amortit un jour manqué sans casser le compte.

V1 : implémentation côté front uniquement (sans changement de schéma
Supabase). On garde le streak côté backend mais on calcule l'affichage
"avec joker" côté front.

V2 (extension) : ajouter `streak_jokers_used INT` à la table backend.

Pour V1 :

1. Définir une logique en localStorage :
   - `cockpit-streak-jokers` : `{ "2026-W17": 1 }` (1 joker par semaine ISO)
   - Au démarrage, si la semaine ISO actuelle n'a pas de clé, ajouter 1.

2. Dans `cockpit/sidebar.jsx`, dans `Sidebar`, calculer :

   const isoWeek = (() => {
     const d = new Date();
     d.setHours(0, 0, 0, 0);
     d.setDate(d.getDate() + 4 - (d.getDay() || 7));
     const yearStart = new Date(d.getFullYear(), 0, 1);
     const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
     return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
   })();
   const jokers = (() => {
     try {
       const all = JSON.parse(localStorage.getItem("cockpit-streak-jokers") || "{}");
       if (!(isoWeek in all)) {
         all[isoWeek] = 1;
         localStorage.setItem("cockpit-streak-jokers", JSON.stringify(all));
       }
       return all[isoWeek];
     } catch { return 0; }
   })();

3. Dans le rendu du `.sb-foot-streak` (autour ligne 173, le bloc when
   streak !== null), ajouter sous `.sb-foot-streak-meta` :

   {jokers > 0 && (
     <div className="sb-foot-streak-jokers" title="1 joker par semaine — amortit un jour manqué">
       <Icon name="card" size={11} stroke={1.75} />
       <span>{jokers} joker{jokers > 1 ? "s" : ""}</span>
     </div>
   )}

   (Si l'icône `card` n'existe pas, utiliser `shield` ou `sparkle`.)

4. Dans `cockpit/styles.css` (section sidebar footer), ajouter :

   .sb-foot-streak-jokers {
     display: inline-flex; align-items: center; gap: 4px;
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     color: var(--neutral);
     letter-spacing: 0.04em;
     padding: 2px 0 0;
   }
   .sb-foot-streak-jokers svg { opacity: 0.8; }

5. Quand un joker est consommé (logique simplifiée V1) : si le user
   ouvre le cockpit le matin et que la dernière visite était il y a
   plus de 30h mais moins de 54h, ET qu'il y a un joker dispo cette
   semaine : décrémenter le joker, marquer un toast "🃏 Joker utilisé.
   Streak préservé." Cette logique de consommation reste à câbler V2
   (probablement dans `cockpit/lib/data-loader.js`).

V1 = juste l'affichage "1 joker dispo cette semaine".

Validation : ouvrir le cockpit le lundi matin → footer affiche "🃏 1 joker"
sous le streak. Lundi prochain → re-incrémenté à 1 (nouvelle semaine ISO).
```

**Validation utilisateur** : "Mon footer me dit '27j 1 joker'. Je sens que je peux louper un jour sans tout perdre. Moins anxiogène."

---

#### Prompt 15 — [JARVIS] Smart-collapse des panels rarement visités
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Feature : après 14 jours sans ouvrir un panel, il passe en bas de son
groupe sidebar avec opacité réduite et une marque "rarement visité".
Actionnable : un menu "Masquer / Réactiver".

Tracking utilise déjà `usage_events.section_opened` (logué côté
télémétrie). On peut soit lire les compteurs depuis Supabase, soit
maintenir un compteur localStorage par simplicité V1.

V1 = localStorage uniquement.

1. Dans `cockpit/lib/telemetry.js`, ajouter (ou si déjà présent, vérifier) :
   à chaque `track("section_opened", { section })`, mettre à jour aussi :

   try {
     const last = JSON.parse(localStorage.getItem("cockpit-panel-last-visit") || "{}");
     last[section] = Date.now();
     localStorage.setItem("cockpit-panel-last-visit", JSON.stringify(last));
   } catch {}

2. Dans `cockpit/sidebar.jsx`, dans `Sidebar`, calculer pour chaque
   item de chaque groupe son statut "rarely-visited" :

   const lastVisits = React.useMemo(() => {
     try { return JSON.parse(localStorage.getItem("cockpit-panel-last-visit") || "{}"); }
     catch { return {}; }
   }, [activeId]); // re-read sur chaque changement de panel actif

   const RARE_THRESHOLD_MS = 14 * 86400 * 1000;
   const isRare = (id) => {
     const ts = lastVisits[id];
     if (!ts) return false; // Jamais visité = pas dévalorisé (peut-être nouveau)
     return Date.now() - ts > RARE_THRESHOLD_MS;
   };

3. Dans la fonction `renderLink(item)`, ajouter `data-rare={isRare(item.id) ? "1" : "0"}`
   sur le `<button className="sb-link">`.

4. Pour réordonner : pour chaque groupe, séparer items[] en
   `regular` et `rare`, puis afficher rare en bas avec un séparateur :

   const renderGroup = (group) => {
     const open = openGroups[group.group];
     const regular = group.items.filter(it => !isRare(it.id));
     const rare = group.items.filter(it => isRare(it.id));
     // ... reste du rendering identique, mais map regular puis rare avec séparateur
   };

   À l'intérieur du `<ul className="sb-items">` :

   {regular.map(renderLink)}
   {rare.length > 0 && (
     <>
       <li className="sb-rare-sep" aria-hidden="true">
         <span className="sb-rare-sep-label">rarement visités</span>
       </li>
       {rare.map(renderLink)}
     </>
   )}

5. Dans `cockpit/styles.css` (section sidebar), ajouter :

   .sb-link[data-rare="1"] {
     opacity: 0.55;
     font-style: italic;
   }
   .sb-link[data-rare="1"]:hover { opacity: 1; }
   .sb-rare-sep {
     padding: 6px var(--space-3) 2px;
     pointer-events: none;
   }
   .sb-rare-sep-label {
     font-family: var(--font-mono);
     font-size: 9.5px;
     letter-spacing: 0.16em;
     text-transform: uppercase;
     color: var(--tx3);
     opacity: 0.7;
   }

6. Bonus : ajouter un menu contextuel (clic-droit sur un item rare)
   "Masquer définitivement". V1 sans clic-droit, juste l'affichage
   atténué — l'utilisateur peut continuer à cliquer normalement.

Validation : 1) `localStorage.cockpit-panel-last-visit = {"jobs": 1700000000000}`
(date il y a 6 mois) → "Jobs Radar" passe en bas du groupe Business avec
opacité 0.55, italique, sous séparateur "rarement visités". 2) Cliquer
dessus → met à jour le timestamp, retour à l'opacité normale au prochain
chargement.
```

**Validation utilisateur** : "Je vois que je n'ai pas ouvert 'Anime' depuis un mois — il est en bas de son groupe, opacité atténuée. Si je clique, il revient à sa place."

---

## Checklist d'exécution

Ordre recommandé, dépendances en colonne, temps cumulé estimé.

| # | Prompt | Priorité | Dépend de | Effort | Cumul |
|---|---|---|---|---|---|
| 1 | Prompt 4 — Mode rail par défaut < 1280px | P0 | — | 10 min | 10 min |
| 2 | Prompt 2 — Couper pulses répétés | P0 | — | 5 min | 15 min |
| 3 | Prompt 5 — Skip link a11y | P0 | — | 10 min | 25 min |
| 4 | Prompt 6 — Streak null encourageant | P0 | — | 10 min | 35 min |
| 5 | Prompt 7 — Hide kbd-fab après 7j | P0 | — | 10 min | 45 min |
| 6 | Prompt 1 — Hero compact persistant | P0 | — | 25 min | 1h10 |
| 7 | Prompt 3 — Auth overlay tokens | P0 | — | 20 min | 1h30 |
| 8 | Prompt 10 — Préchargement Babel + JSX | P1 | — | 20 min | 1h50 |
| 9 | Prompt 9 — Audio brief honnête | P1 | — | 35 min | 2h25 |
| 10 | Prompt 8 — Bannière stale | P1 | — | 40 min | 3h05 |
| 11 | Prompt 13 — Ask Jarvis dock | P2 | — | 1h15 | 4h20 |
| 12 | Prompt 14 — Streak jokers | P2 | — | 30 min | 4h50 |
| 13 | Prompt 15 — Smart-collapse panels rares | P2 | — | 50 min | 5h40 |
| 14 | Prompt 11 — Resume tracker (capture) | P2 | — | 45 min | 6h25 |
| 15 | Prompt 12 — Resume tracker (carte UI) | P2 | Prompt 11 | 35 min | 7h00 |

**Total : ~7 heures de travail Claude Code** pour l'ensemble du backlog audit.

**Stratégie recommandée** :
- **Sprint 1 (1h30)** : Prompts 1 à 7 → toutes les frictions quotidiennes les plus criantes du Brief + a11y baseline.
- **Sprint 2 (1h35)** : Prompts 8-10 → fiabilité (stale banner), honnêteté (audio), perf (preload).
- **Sprint 3 (3h)** : Prompts 11-15 → features Jarvis qui transforment le cockpit en vrai assistant rétention.

Ne pas tout faire d'un coup : tester chaque sprint pendant 3-5 jours d'usage réel avant de passer au suivant. Les frictions perçues changent une fois les premières corrigées.

---

## Annexe — Limites de cet audit

- **Pas de mesure Lighthouse réelle** — les chiffres FCP/LCP donnés sont des estimations basées sur la composition (22 data-*.js + Babel CDN + 25 JSX). À mesurer en conditions réelles avant d'investir dans les prompts perf.
- **Audit conduit sur le code public** (commit visible sur `ph3nixx.github.io/jarvis-cockpit`). Les pipelines backend (`main.py`, `weekly_analysis.py`, `nightly_learner.py`) n'ont pas été lus en détail — l'audit est centré front + UX.
- **Pas d'observation utilisateur réelle** — la session étant scheduled (pas d'humain présent), la matrice est dérivée de l'inspection de code + heuristiques. À cross-checker avec la télémétrie `usage_events` Supabase pour valider les hypothèses de friction (ex: "Hero macro surdimensionné" devrait se voir dans `top_card_collapsed` haut + `section_opened` brief court).
- **3 thèmes audités principalement en Dawn** — certaines remarques (boutons trop sombres, hero massif) sont moins valides en Obsidian (où la palette est dark, donc le contraste s'inverse).
- **Pas de test mobile réel** — les overrides `styles-mobile.css` ont été lus, le comportement effectif n'a pas été vérifié sur device.

Recommandation : avant de shipper Prompts 11-15 (les features Jarvis), instrumenter et observer 7 jours de télémétrie pour confirmer que les friction points identifiés correspondent à de la friction réelle dans tes events `usage_events`.

— Fin de l'audit.
