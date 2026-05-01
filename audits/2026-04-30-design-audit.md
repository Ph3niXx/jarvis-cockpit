# Audit Design Complet — AI Cockpit

**Date** : 30 avril 2026
**Auditeur** : Claude (Opus 4.7) via routine Cowork planifiée
**URL prod** : https://ph3nixx.github.io/jarvis-cockpit/
**Audit précédent** : `audits/2026-04-29-design-audit.md`
**Stack réelle observée** : React 18 + `@babel/standalone` (CDN unpkg) + Supabase REST + Google OAuth + 20 stylesheets CSS + 20 fichiers `data-*.js` chargés synchrone + 23 `panel-*.jsx` (transpilés navigateur). **Pas vanilla, pas single-file.**

> ⚠️ **Mission décrit le cockpit comme « Single-file vanilla HTML/CSS/JS, gradient bleu→violet, dark mode, glassmorphism »**. Aucune de ces hypothèses ne tient. Le cockpit tourne sur **3 thèmes éditoriaux distincts (Dawn ivoire+rouille / Obsidian charbon+cyan / Atlas bleu marin+ambre)**, sans gradient ni glassmorphism, en React multi-fichiers. Les prompts en Phase 4 ciblent la stack réelle (`cockpit/*.jsx`, `cockpit/styles*.css`, `cockpit/themes.js`, `cockpit/lib/*.js`).

> ✅ **Shipped depuis 29/04** : 2 des 3 findings critiques d'hier sont **livrés** —
> - `ee2a344` — sw.js auto-sync (script + GH Action `sw-sync.yml`) → **R11+ résolu**
> - `4dbc662` — modale React thémée Stacks (kill `window.prompt/confirm/alert`) → **R12+ résolu**
> - `5e83774`, `f215a43` — hygiène : kill data-jobs.js mock 773L + grille mock "Agents en production" → cleanup Veille IA
> Les autres prompts du backlog 29/04 (hero compact, auth overlay tokens, mode rail < 1280px, skip link, streak zéro, perf preload, audio honnête, bannière stale, FAB stacking) restent **pending**.

> 🆕 **2 nouveaux findings critiques surfacés aujourd'hui** non couverts par les audits précédents :
> - **🔴 9 animations infinies dans 9 stylesheets**, dont **18 stylesheets sans garde `prefers-reduced-motion`** — fatigue oculaire massive en usage quotidien + violation WCAG 2.3.3.
> - **🟠 27 occurrences de `#c2410c` + 13 de `#9aa3ad` + autres hex hardcodés** dans `cockpit/styles-*.css` — la promesse tri-thématique fuite : un user en Obsidian voit du Dawn rouille apparaître dans Veille outils, Jarvis, Jobs Radar.

---

## 1. Reconnaissance

### 1.1 Inventaire features (état réel — état 30/04)

| Zone | Composant | Localisation | Statut |
|---|---|---|---|
| **Shell** | Sidebar 6 groupes + rail mode + drawer mobile | `cockpit/sidebar.jsx`, `cockpit/nav.js` | ✅ Production |
| Shell | Theme switcher (Dawn / Obsidian / Atlas) + auto-pick par heure | `cockpit/sidebar.jsx`, `cockpit/themes.js` | ✅ Production |
| Shell | Streak veille + coût API + sparkline 7j (footer sidebar) | `cockpit/sidebar.jsx` | ✅ Production |
| Shell | Command palette (Ctrl+K) + 14 raccourcis + overlay aide (?) | `cockpit/command-palette.jsx`, `cockpit/app.jsx` | ✅ Production |
| Shell | Filtre global "Récent · 24h" (auto-on si visite < 18h) | `cockpit/app.jsx` | ✅ Production |
| Shell | Error boundary par panel + skeleton loader Tier 2 | `cockpit/app.jsx` | ✅ Production |
| Shell | PWA service worker, manifest | `sw.js`, `manifest.json` | **✅ Auto-sync (résolu 29/04 → 30/04)** |
| **Auth** | Overlay Google OAuth bloquant (couleurs Dawn hardcodées) | `cockpit/lib/auth.js` | ⚠️ Non thémable (inchangé) |
| **Aujourd'hui** | Brief du jour (hero macro + audio + delta + zero-state + Top 3 + signaux + radar + week) | `cockpit/home.jsx` | ✅ Production riche |
| Aujourd'hui | Toggle "Morning Card" vs "Brief complet" | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Hero delta "X nouveautés depuis Yh" (auto-trigger) | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Audio brief Web Speech API (estimation = body.length / 280) | `cockpit/home.jsx` | ⚠️ Heuristique fragile (inchangé) |
| Aujourd'hui | Bouton "Tout marqué lu" + undo 6s + télémétrie | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Miroir du soir (récap réflexif 19h), Revue, Top, Semaine, Recherche | 5 panels dédiés | ✅ Production |
| **Veille** | Veille IA, Veille outils (4 buckets), Sport, Gaming news, Anime, Actualités | `panel-veille.jsx` (mutualisé), `panel-veille-outils.jsx` | ✅ Production |
| **Apprentissage** | Radar 8 axes (SVG inline), Recos, Challenges, Wiki IA, Signaux faibles | 5 panels | ✅ Production |
| **Business** | Opportunités, Carnet d'idées (kanban + galerie), Jobs Radar | 3 panels | ✅ Production |
| **Personnel** | Jarvis chat (3 modes : Rapide/Deep/Cloud) + mémoire, Jarvis Lab, Profil, Forme, Musique, Gaming | 6 panels | ✅ Production |
| **Système** | Stacks & Limits, Historique | 2 panels | **✅ Modale React (résolu 29/04 → 30/04)** |

**Total : 23 routes JSX actives** + 5 routes `PanelVeille` mutualisées (updates, claude, sport, gaming_news, anime, news) = 28 panels visibles. La route `claude` est routée mais **absente du sidebar `nav.js`** — accessible uniquement par command palette ou URL profonde.

### 1.2 Design system implicite

`cockpit/themes.js` expose 3 thèmes complets, chacun avec ~40 tokens (palette + 8 espacements 4→64 + 9 tailles type 10→54px + radius + shadows). C'est un design system structuré, **mais des dérives persistent et s'aggravent** :

| Symptôme | Mesure 29/04 | Mesure 30/04 | Tendance |
|---|---|---|---|
| Stylesheets séparés | 21 | **20** | ↓ (mineure) |
| `data-*.js` synchrones | 22 | **20** | ↓ (kill data-jobs + data-pose mocks) |
| `!important` en mobile | 80 | **80** | — |
| Total LOC CSS | n/c | **21 116 lignes** | (nouvelle mesure) |
| Total LOC panels JSX | n/c | **16 029 lignes** | (nouvelle mesure) |
| Animations infinies | n/c | **9 distinctes dans 9 stylesheets** | 🆕 finding |
| Stylesheets sans `prefers-reduced-motion` | n/c | **18 sur 20** | 🆕 finding |
| Hex hardcodés (panels CSS) | n/c | **#c2410c × 27, #9aa3ad × 13, #141414 × 13, ...** | 🆕 finding |
| Scripts dans `index.html` | n/c | **66, sans `defer`/`async`** | 🆕 mesure dure |

### 1.3 🔴 NOUVEAU FINDING : pulses infinis sans garde `prefers-reduced-motion`

```
cockpit/styles-challenges.css:717   pulse-eval        1.6s infinite
cockpit/styles-jarvis-lab.css:153   jl-pulse          1.8s infinite
cockpit/styles-jarvis-lab.css:337   jl-feature-pulse  2.0s infinite
cockpit/styles-jarvis.css:71        jv-pulse          2.4s infinite
cockpit/styles-jobs-radar.css:99    jr-pulse          2.4s infinite
cockpit/styles-musique.css:55       mz-pulse          1.6s infinite
cockpit/styles-opportunities.css:67 opp-pulse         2.4s infinite
cockpit/styles-stacks.css:284       st-pulse          1.8s infinite
cockpit/styles-wiki.css:771         wiki-pulse        1.8s infinite
cockpit/styles.css:3466             vl-pulse          2.0s infinite
cockpit/styles.css:4371             pskShimmer        1.6s infinite (skeleton — légitime)
```

**Mécanisme du problème** : ces 9 pulses (hors skeleton) tournent **non-stop** dès qu'un panel est ouvert. En 30 jours d'usage quotidien, ce sont des milliers de cycles d'attention détournés vers des dots clignotants qui ne portent aucune information actionnable (la plupart marquent "il y a des items live" — info redondante avec le badge numérique adjacent).

**Garde `prefers-reduced-motion`** : seul `cockpit/styles.css` en a une (sur `kicker-dot` + `sb-group-hotdot`). Les **18 autres stylesheets** ont des animations OU transitions sans guard. Un user macOS/iOS qui a "Reduce motion" activé continue de voir tous les pulses ci-dessus.

**Sévérité** : 🔴 — combine fatigue oculaire chronique (rétention) + violation directe WCAG 2.3.3 Animation from Interactions (a11y).

**Principe violé** : "Don't make me think" + WCAG SC 2.3.3 Niveau AAA et SC 2.2.2 Niveau A.

### 1.4 🟠 NOUVEAU FINDING : couleurs hardcodées dans panel CSS

Ce qui dérive (top 12) :

| Hex | Occurrences | Décodage probable | Conséquence en Obsidian/Atlas |
|---|---|---|---|
| `#c2410c` | 27 | Dawn `--brand` (rouille) | Tache rouille dans un thème cyan ou ambre |
| `#737373` | 18 | Gris neutre (pas dans tokens) | Manque de cohérence inter-thème |
| `#9aa3ad` | 13 | Obsidian `--tx2` (texte secondaire) | Couleur charbon dans Dawn ivoire |
| `#141414` | 13 | Charbon (proche bg Obsidian) | Fond noir qui surface en Dawn/Atlas |
| `#fafafa` | 11 | Quasi-blanc (pas dans tokens) | Brûle l'œil en Obsidian |
| `#b43a3a` | 11 | Rouge alert custom | Alert non thémé |
| `#b3491a` | 10 | Variante rouille | Idem #c2410c |
| `#2d7a4e` | 9 | Vert positive custom | Positive non thémé |
| `#fafaf5` | 8 | Quasi-Dawn bg | Idem |
| `#13161a` | 8 | Obsidian `--bg2` | Idem |
| `#c25a3a` | 7 | Variante rouille | Idem |
| `#4a7c4a` | 7 | Variante vert | Idem |

**Sévérité** : 🟠 — la promesse tri-thématique fuite dans 8 panels. Un user en Atlas (bleu marin) voit toujours apparaître des accents orange Dawn dans Veille outils, Jarvis, Jobs Radar, Stacks. Un user en Obsidian voit du #fafafa quasi-blanc qui flash.

**Principe violé** : Single source of truth pour les tokens. Le design system existe (`cockpit/themes.js`) mais 8 panels CSS l'ignorent partiellement.

### 1.5 🟠 PERSISTANT : 66 scripts sans `defer`/`async` (R5 inchangé)

```
$ grep -cE '<script' index.html
66
$ grep -cE 'defer|async=' index.html
0
```

Au boot, le navigateur exécute en série :
1. React + ReactDOM (UMD development build, ~150 KB)
2. Babel standalone (~3 MB transpileur in-browser)
3. Supabase JS, DOMPurify, marked, js-yaml
4. `nav.js` + 8 fichiers lib (`supabase.js`, `auth.js`, `data-loader.js`, ...)
5. **20 fichiers `data-*.js` synchrones** (schémas fake)
6. `themes.js`
7. **23 fichiers `panel-*.jsx`** transpilés à la volée par Babel (en série)
8. `bootstrap.js` + `command-palette.jsx` + `app.jsx`

**FCP estimé sur fibre** : 3-5s. **FCP estimé en 4G simulée** : 6-10s. Pour un cockpit ouvert 1-3 fois/jour, ces secondes cumulent **plusieurs minutes/mois** d'attente passive avant le brief.

### 1.6 Test rétention (5e visite de la semaine, 22e du mois)

Frictions persistantes (numérotation = `R1` à `R10` audit 28/04, `R11+` audit 29/04, `R15+` audit 30/04) :

| # | Friction | Sévérité | Statut depuis 29/04 |
|---|---|---|---|
| R1 | Hero macro géant à chaque visite (`clamp(32px, 4.2vw, 54px)`, padding, body `--text-xl`) | 🔴 Élevée | Inchangé |
| R2 | Animations pulse à chaque montage (kicker-dot + sb-group-hotdot) | 🟠 Moyenne | Inchangé (mais styles.css a la garde) |
| R3 | Page header sticky + Hero non collapsible | 🟠 Moyenne | Inchangé |
| R4 | Boutons primary `--tx` (encre) sur fond crème — contraste violent en Dawn | 🟠 Moyenne | Inchangé |
| R5 | 66 scripts sans defer + Babel transpilation 23 JSX en série | 🔴 Élevée | Inchangé (impact mesuré aujourd'hui) |
| R6 | `dataVersion` reset cause rerender lourd à chaque hydration | 🟢 Faible | Inchangé |
| R7 | Audio brief estimation fragile (`body.length / 280`) | 🟢 Faible | Inchangé |
| R8 | `kbd-fab` `?` flottant bottom-right en permanence | 🟢 Faible | Inchangé |
| R9 | Streak "0 j" sans encouragement zero-state | 🟠 Moyenne | Inchangé |
| R10 | Aucun feedback "données fraîches / stale" | 🟠 Moyenne | Inchangé |
| R11+ | ~~Service worker cache drift~~ | — | ✅ **Résolu** (auto-sync `ee2a344`) |
| R12+ | ~~Modales `window.prompt/confirm` chaînées dans Stacks~~ | — | ✅ **Résolu** (`4dbc662` modale React thémée) |
| R13+ | 2 FABs empilés bottom-right (`kbd-fab` + `recent-toggle`) | 🟢 Faible | Inchangé |
| R14+ | `Stub` "panel à designer" mort dans `app.jsx` | 🟢 Faible | Inchangé (encore là, jamais atteint) |
| **R15+** | **9 animations infinies dans 9 stylesheets, 18 stylesheets sans `prefers-reduced-motion`** | 🔴 **Élevée** | **Nouveau (audit 30/04)** |
| **R16+** | **Hex hardcodés dans 8 panels CSS — fuite tri-thème** | 🟠 **Moyenne** | **Nouveau (audit 30/04)** |

**Verdict rétention 30/04** : la livraison de R11+ et R12+ entre 29/04 et 30/04 est un signal positif (vélocité réelle sur les frictions surfacées). Mais **R15+ (pulses infinis) est probablement aussi visible que R1 (hero) pour la fatigue à 30 jours** — chaque ouverture de Jarvis, Jobs Radar, Veille outils, Wiki, Opportunités, Stacks réveille un pulse cyan/rouille qui brûle de l'attention pour rien. Et R16+ révèle que la promesse tri-thème (un des 3 vrais points forts du cockpit) est **partiellement fausse** dans 8 panels.

---

## 2. Matrice d'évaluation

Notes /5. Critères : Clarté · Densité · Cohérence · Interactions · Mobile · Accessibilité · Rétention.

**Légende delta** : `↑` = amélioration depuis 29/04, `↓` = dégradation, `—` = inchangé. `·` = pas de comparable.

| Section | Clarté | Densité | Cohérence | Interactions | Mobile | A11y | Rétention | **Moy.** | **Δ vs 29/04** |
|---|---|---|---|---|---|---|---|---|---|
| **Shell — Sidebar + nav** | 4 | 3 | 4 | 5 | 4 | 4 | 4 | **4.0** | — |
| **Shell — Top bar / Page header** | 4 | 2 | 4 | 4 | 3 | 3 | 3 | **3.3** | — |
| **Shell — PWA / Service Worker** | 4 | n/a | 4 | 4 | 4 | n/a | 4 | **4.0** | **↑↑** (auto-sync shipped) |
| **Auth overlay** | 4 | 5 | 2 | 3 | 4 | 3 | n/a | **3.5** | — |
| **Brief — Hero macro** | 5 | 2 | 5 | 4 | 4 | 4 | 2 | **3.7** | — |
| **Brief — Top 3 / Morning Card** | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4.4** | — |
| **Brief — Hero delta** | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4.4** | — |
| **Brief — Audio brief** | 3 | 4 | 4 | 3 | 3 | 4 | 3 | **3.4** | — |
| **Brief — Signaux cards** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Brief — Radar SVG** | 4 | 3 | 5 | 3 | 4 | 3 | 3 | **3.6** | — |
| **Brief — Zero state** | 5 | 4 | 4 | 4 | 4 | 4 | 5 | **4.3** | — |
| **Top du jour / Revue** | 4 | 4 | 4 | 5 | 4 | 4 | 4 | **4.1** | — |
| **Miroir du soir** | 4 | 4 | 4 | 3 | 4 | 4 | 4 | **3.9** | — |
| **Veille IA / Outils** | 4 | 4 | **3** | 4 | 4 | **3** | 4 | **3.7** | **↓** (R15+ pulse + R16+ hex) |
| **Wiki IA + Tooltip** | 4 | 4 | 3 | 4 | 3 | 3 | 3 | **3.4** | **↓** (wiki-pulse infini) |
| **Signaux faibles (panel)** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Radar compétences (panel)** | 4 | 3 | 5 | 3 | 4 | 3 | 3 | **3.6** | — |
| **Recos / Challenges** | 4 | 4 | 4 | 4 | 4 | **3** | 3 | **3.7** | **↓** (pulse-eval infini sans guard) |
| **Opportunités** | 4 | 4 | **3** | 4 | 4 | **3** | 3 | **3.6** | **↓** (opp-pulse + hex hardcodé) |
| **Carnet d'idées (kanban)** | 5 | 4 | 4 | 5 | 3 | 3 | 5 | **4.1** | — |
| **Jobs Radar** | 4 | 4 | **3** | 4 | 4 | **3** | 3 | **3.6** | **↓** (jr-pulse + hex hardcodé) |
| **Jarvis chat** | 4 | 4 | **3** | 5 | 3 | **3** | 5 | **3.9** | **↓** (jv-pulse + hex hardcodé) |
| **Jarvis Lab (specs + archi)** | 3 | 3 | 3 | 3 | 3 | **2** | 3 | **2.9** | **↓** (jl-pulse × 2 + jl-feature-pulse, sans guard) |
| **Profil** | 4 | 4 | 4 | 4 | 4 | 3 | 3 | **3.7** | — |
| **Forme** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Musique** | 4 | 4 | **3** | 4 | 4 | **3** | 4 | **3.7** | **↓** (mz-pulse) |
| **Gaming** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Stacks & Limits** | 4 | 5 | **4** | **4** | **3** | **3** | 4 | **3.9** | **↑↑** (modale React shipped) |
| **Historique** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** | — |
| **Recherche** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** | — |
| **Performance perçue (boot)** | 3 | n/a | n/a | n/a | 2 | 3 | 1 | **2.3** | — |

**Moyenne cockpit : 3.78 / 5** (vs 3.78 le 29/04). Les gains PWA + Stacks sont compensés exactement par les baisses dues aux pulses + hex hardcodés. **Le delta net est nul mais la composition a bougé : 2 dettes critiques tuées, 2 dettes structurelles révélées en remplacement.**

### 2.1 Top 3 forces

1. **Design system tri-thématique cohérent à 80%** — 3 directions visuelles complètes (Dawn, Obsidian, Atlas) qui partagent les mêmes tokens. Auto-switch par heure. Rare et bien exécuté **dans `styles.css`**, mais R16+ révèle qu'il fuit dans 8 panels CSS.
2. **Mécaniques anti-friction sophistiquées** — hero delta, zero state, snooze, undo "tout marqué lu", filtre récent auto-on, command palette, raccourcis clavier, modale Stacks (nouvelle). Le produit pense l'usage répété.
3. **Hiérarchie typographique éditoriale** — Fraunces italique + Inter + JetBrains Mono. Le hero a une vraie personnalité presse haut de gamme. Inchangé.

### 2.2 Top 3 faiblesses (ré-ordonnées 30/04)

1. **🔴 Performance de boot** (R5, identifié 28/04, toujours non traité) — 66 scripts en série, 0 defer, Babel transpile 23 JSX en série, 20 `data-*.js` synchrones. **Désormais finding #1 puisque R11+ et R12+ sont livrés.**
2. **🔴 Animations infinies sans `prefers-reduced-motion`** (R15+, NOUVEAU) — 9 pulses dans 9 stylesheets, 18 stylesheets sans guard. Combine WCAG fail + fatigue oculaire chronique sur 30 jours d'usage.
3. **🟠 Hero macro surdimensionné pour usage quotidien** (R1, identifié 28/04, toujours non traité) — calibré pour un coup d'œil hebdo, pas pour 25 ouvertures/mois. Manque un mode "compact" persistant.

(R16+ hex hardcodé est un peu en-dessous mais s'attaque vite si on le couple à R15+ dans une passe d'hygiène CSS.)

---

## 3. Quick Wins & Roadmap Jarvis

### 3.1 Top 10 Quick Wins (triés par ratio impact/effort décroissant)

| # | Titre | Impact | Effort | Ratio | Sections concernées |
|---|---|---|---|---|---|
| 1 | **Garde `prefers-reduced-motion` globale** dans `styles.css` (couvre les 9 stylesheets pulses sans toucher à chacune) | 5 | 1 | **5.0** | Toutes (transversal) |
| 2 | **Couper les 9 animations pulse infinies → ease 3 fois max** (limite cycles à 3 puis arrêt forwards, comme `kicker-dot` déjà fait) | 4 | 1 | **4.0** | Veille outils, Jarvis, Jarvis Lab, Wiki, Opps, Jobs, Stacks, Musique, Challenges |
| 3 | **Hide `kbd-fab` après 7 jours d'usage** (localStorage `cockpit-first-seen`) | 3 | 1 | **3.0** | Shell (R8) |
| 4 | **Streak 0 → "Premier jour de veille — let's go"** zero-state encourageant + pictogramme | 4 | 1 | **4.0** | Sidebar footer (R9) |
| 5 | **Dépoussiérer 14 hex hardcodés dans `cockpit/styles-jarvis-lab.css`** (le panel le plus pollué) — replace par tokens | 3 | 2 | **1.5** | Jarvis Lab (R16+) |
| 6 | **Skip link a11y** ("Aller au contenu principal") dans `cockpit/app.jsx` avant la sidebar | 4 | 1 | **4.0** | Shell (a11y) |
| 7 | **Supprimer le composant `Stub`** dans `app.jsx` (jamais atteint, dette de message) — ou bien remplacer son contenu par un `404 / panel introuvable` propre si on garde la branche fallback | 2 | 1 | **2.0** | App (R14+) |
| 8 | **Tokens dans `cockpit/lib/auth.js`** (Dawn hardcodé hex → CSS variables) | 4 | 2 | **2.0** | Auth overlay (R3 secondaire) |
| 9 | **Mode "Hero compact" persistant** (toggle `cockpit-hero-compact` localStorage, hauteur fixe ~140px, body cachée par défaut) | 5 | 3 | **1.7** | Brief (R1) |
| 10 | **Bannière "données stale > 24h"** sur Brief si `daily_briefs.fetch_date` < J-1 | 4 | 2 | **2.0** | Brief (R10) |

### 3.2 Roadmap Jarvis — 15 features avancées

Score composite = Impact × Faisabilité (Wow informatif).

| # | Feature | Impact | Faisabilité | Wow | **Composite** |
|---|---|---|---|---|---|
| J1 | **Lecture immersive** (overlay article in-cockpit, J/S/Esc raccourcis) | 5 | 4 | 4 | **20** |
| J2 | **Resume tracker hebdo** : capture par Jarvis observer ce qui a été consulté/snoozé/marqué lu, restitue dimanche soir une synthèse "ta semaine en 5 thèmes" | 5 | 4 | 5 | **20** |
| J3 | **Préchargement Babel + JSX critiques en `<link rel="modulepreload">`** | 4 | 4 | 2 | **16** |
| J4 | **Ask Jarvis dock** (composant flottant Cmd+J : input + 3 réponses dernière) — disponible depuis tout panel | 5 | 3 | 5 | **15** |
| J5 | **Smart-collapse des panels rares** (si non visités depuis 14j → groupé sous "Autres" en sidebar) | 3 | 5 | 3 | **15** |
| J6 | **Streak jokers** (1 joker offert tous les 7 jours, anti-rupture si oubli un jour) | 4 | 4 | 4 | **16** |
| J7 | **Boot-mask anti-FOUC** : skeleton plein écran injecté par `bootstrap.js` AVANT le mount React, supprimé au premier render réel | 4 | 4 | 3 | **16** |
| J8 | **Recherche full-text avec highlight + filtre par section** (déjà en partie dans `panel-search.jsx`) | 4 | 4 | 3 | **16** |
| J9 | **Brief audio enrichi** : durée réelle estimée par Web Speech API (`utterance.text.length / rate.rate * factor calibré`) + bouton skip 10s | 3 | 3 | 4 | **9** |
| J10 | **Annotation contextuelle** : surlignage personnel sur un article, sauvegardé en `usage_events.payload.highlight` | 4 | 3 | 5 | **12** |
| J11 | **Mode "tableau de bord ce soir"** : à 19h, le Miroir du soir devient la home par défaut | 3 | 5 | 3 | **15** |
| J12 | **Comparateur côte-à-côte** dans Veille outils : 2 outils sélectionnés → diff side-by-side de leurs caractéristiques | 4 | 3 | 4 | **12** |
| J13 | **Heatmap d'activité** dans le panel Forme (calendrier annuel type GitHub avec couleur = sport+score) | 3 | 4 | 4 | **12** |
| J14 | **Téléchargement export brief** : bouton "Sauvegarder en .md" qui dump le brief du jour | 3 | 5 | 3 | **15** |
| J15 | **Profil "vibe"** : un bouton dans Profil qui propose 3 préréglages (Calme / Focus / Mission) qui modifient densité, animations, sons | 4 | 3 | 5 | **12** |

**Top 5 composite** : J1 (20), J2 (20), J3 (16), J6 (16), J7 (16). Ces 5-là entrent en Phase 4 prompts.

### 3.3 Mockups textuels — 3 features les plus prometteuses

#### Mockup A — J1 : Lecture immersive (overlay full-screen)

```
┌────────────────────────────────────────────────────────────────────┐
│  ╳                                                       J · S · ↗ │
│                                                                    │
│       Veille IA · 30 avril                                         │
│                                                                    │
│       Anthropic ouvre Claude Code aux                              │
│       développeurs en bêta privée                                  │
│                                                                    │
│       7 minutes · TheVerge                                         │
│                                                                    │
│       ────────────────────────────                                 │
│                                                                    │
│       Lorem ipsum dolor sit amet, consectetur adipiscing           │
│       elit. Donec a diam lectus. Sed sit amet ipsum mauris.        │
│       Maecenas congue ligula ac quam viverra nec consectetur       │
│       ante hendrerit. Donec et mollis dolor.                       │
│                                                                    │
│       Praesent et diam eget libero egestas mattis sit amet         │
│       vitae augue. Nam tincidunt congue enim, ut porta lorem       │
│       lacinia consectetur.                                         │
│                                                                    │
│       [...]                                                        │
│                                                                    │
│  ────────────────────────────────────────────────────────────────  │
│                                                                    │
│       J · marquer lu       S · snooze 3j      ↗ · ouvrir externe   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Toggle dans Profil : "Lecture immersive (Esc/J/S)". Quand activé, clic sur Top 3 → cet overlay au lieu de `target=_blank`. Garde de retention : on ne sort plus du cockpit. Garde concentration : pas de pubs, pas de sidebar de l'éditeur.

#### Mockup B — J2 : Resume tracker hebdo (Miroir du soir dimanche)

```
─────────────────────────────────────────────────────────────────
  Miroir du soir · dimanche 4 mai
─────────────────────────────────────────────────────────────────

  Ta semaine en 5 thèmes
  ──────────────────────

  ●  Agents IA orchestrés                   12 articles lus
     dont 4 marqués comme essentiels
     pic mardi (5 articles, dont 2 papers arxiv)

  ●  Régulation européenne                   7 articles lus
     dont 1 long-read EU AI Act (15 min)

  ●  Veille outils Claude                    6 articles + 4 outils ajoutés
     2 marqués "à tester" (Cline, RepoPrompt)

  ●  Performance des modèles                 5 articles lus
     focalisé sur Sonnet 4.6 vs Opus 4.7

  ●  Sport et forme                          3 séances (1 vélo, 2 course)
     -1.2 kg sur la semaine

  Action proposée pour la semaine prochaine :
  Tester Cline en local — c'est le seul outil que tu as
  marqué "à tester" 2 semaines de suite sans y aller.

      [ Marquer cette synthèse comme lue ]
```

Source : `usage_events` aggregation par section + `weekly_analysis` Claude Haiku. Pipeline existant déjà (`weekly_analysis.py`), il manque juste la vue côté front.

#### Mockup C — J4 : Ask Jarvis dock (Cmd+J flottant)

```
                                                 ┌──────────────────────────┐
                                                 │  ◉  Jarvis              ╳│
                                                 │  ──────────────────────  │
                                                 │                          │
                                                 │  > qu'est-ce que je dois │
                                                 │    revoir avant la       │
                                                 │    rétro de jeudi ?      │
                                                 │                          │
                                                 │  ┌──── Réponse ────────┐ │
                                                 │  │                     │ │
                                                 │  │ 3 items à regarder: │ │
                                                 │  │                     │ │
                                                 │  │ 1. l'article sur les│ │
                                                 │  │    OKR cross-train  │ │
                                                 │  │    (lu mardi, à     │ │
                                                 │  │    re-citer)        │ │
                                                 │  │                     │ │
                                                 │  │ 2. ta recommandation│ │
                                                 │  │    "lien CRM"  pour │ │
                                                 │  │    laquelle aucun   │ │
                                                 │  │    challenge n'a    │ │
                                                 │  │    été lancé        │ │
                                                 │  │                     │ │
                                                 │  │ 3. 2 idées dans le  │ │
                                                 │  │    carnet en        │ │
                                                 │  │    incubation > 7j  │ │
                                                 │  │                     │ │
                                                 │  └─────────────────────┘ │
                                                 │                          │
                                                 │  [ Approfondir Cloud ]   │
                                                 └──────────────────────────┘
```

Cmd+J ouvre un dock à droite, 380px large, scrollable. La réponse tape RAG sur les conversations passées + opportunités + idées + recos. Bouton "Approfondir Cloud" passe en mode Cloud (Claude Haiku, ~0.01$/req). Un seul échange visible à la fois pour rester focalisé. Esc ferme.

---

## 4. Prompts Claude Code

> Stack rappel : React 18 + Babel standalone via CDN unpkg (no build), Supabase REST, **fichiers multiples** (`cockpit/*.jsx`, `cockpit/styles*.css`, `cockpit/themes.js`, `cockpit/lib/*.js`). Pas de TypeScript, pas de bundler. Composants exposés via `window.X`. Tokens via CSS Custom Properties dans `cockpit/themes.js`. **Toute modif d'un onglet implique de mettre à jour `docs/specs/tab-<slug>.md` + `docs/specs/index.json` dans le même commit (CLI lint-specs bloquante).**

### P0 — Quick wins immédiats

#### Prompt 1 — [UX] Garde globale `prefers-reduced-motion`

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css` (ajout en fin de fichier ou dans un bloc dédié)

```
Contexte : Le cockpit (React+Babel multi-fichiers) a 9 animations infinies
réparties dans 9 stylesheets. Seul cockpit/styles.css a une garde
prefers-reduced-motion (sur .kicker-dot et .sb-group-hotdot). Les 18
autres stylesheets (toutes celles du dossier cockpit/styles-*.css) ont
des animations OU transitions sans guard. Un user macOS/iOS qui a "Reduce
motion" activé continue de voir tous les pulses tourner, ce qui viole
WCAG 2.3.3 et fatigue l'œil sur 30 jours d'usage.

Tâche : Ajouter à la fin de cockpit/styles.css un bloc "kill switch"
global qui désactive TOUTES les animations CSS quand l'utilisateur a
prefers-reduced-motion: reduce, en utilisant l'astuce `* { animation: none
!important; transition: none !important; }` ciblée dans un media query.

Code à ajouter (en fin de cockpit/styles.css) :

  /* ═══ Kill-switch global pour reduced-motion ═════════════════
     Couvre les 9 animations infinies réparties dans
     cockpit/styles-*.css. Plus besoin d'ajouter une garde dans
     chaque stylesheet — ce bloc s'applique en cascade.
     ────────────────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

Bumper la version du stylesheet : index.html doit charger
cockpit/styles.css?v=24 (incrément depuis ?v=23). Pas oublier sw.js
(GH Action sw-sync auto-bump le manifest, mais vérifier).

Spec à toucher : aucune (changement transversal a11y, pas un onglet).
Néanmoins, mentionner dans le commit "Specs mises à jour: aucune | N/A
(transversal a11y)".

Validation : Activer "Reduce motion" dans macOS / Windows / iOS Safari
DevTools → ouvrir Jarvis, Jarvis Lab, Veille outils, Wiki, Opportunités,
Jobs Radar, Stacks, Musique, Challenges. Aucun pulse ne doit clignoter.
Le skeleton loader (psk-shimmer) peut soit s'arrêter soit fonctionner —
dans tous les cas il ne doit pas tourner indéfiniment.
```

**Validation** : un user avec OS reduced-motion activé revisite le cockpit et ne voit plus aucun clignotement répétitif.

---

#### Prompt 2 — [UX] Réduire les pulses à 3 cycles + ease forwards

**Priorité** : P0
**Dépend de** : Prompt 1 (l'idéal est de shipper les 2 ensemble)
**Fichiers concernés** : `cockpit/styles-jarvis.css`, `styles-jarvis-lab.css`, `styles-jobs-radar.css`, `styles-musique.css`, `styles-opportunities.css`, `styles-stacks.css`, `styles-wiki.css`, `styles-challenges.css`, `cockpit/styles.css` (le `.vl-pulse`)

```
Contexte : Même si Prompt 1 ajoute une garde globale, les users SANS
preferred-reduced-motion (la majorité) continuent à voir 9 pulses
tourner infiniment. Sur 30 jours d'usage quotidien, c'est de la fatigue
oculaire pure : ces dots clignotants ne portent pas d'info actionnable
(le badge numérique adjacent suffit).

Pattern existant déjà appliqué dans cockpit/styles.css sur .kicker-dot :
  animation: pulse 2s ease 3;
  animation-fill-mode: forwards;
On pulse 3 fois (≈6 secondes au montage) puis on s'arrête sur la frame
finale. Suffit pour signaler "il y a du frais", sans agresser ensuite.

Tâche : Pour chacune des 9 animations infinies listées ci-dessous,
remplacer `infinite` par `3` et ajouter `animation-fill-mode: forwards;`.

Liste exacte des 9 keyframes à modifier (chercher la propriété
`animation:` qui contient `infinite`) :

  cockpit/styles-challenges.css:717   pulse-eval        → 3 fois
  cockpit/styles-jarvis-lab.css:153   jl-pulse          → 3 fois
  cockpit/styles-jarvis-lab.css:337   jl-feature-pulse  → 3 fois
  cockpit/styles-jarvis.css:71        jv-pulse          → 3 fois
  cockpit/styles-jobs-radar.css:99    jr-pulse          → 3 fois
  cockpit/styles-musique.css:55       mz-pulse          → 3 fois
  cockpit/styles-opportunities.css:67 opp-pulse         → 3 fois
  cockpit/styles-stacks.css:284       st-pulse          → 3 fois
  cockpit/styles-wiki.css:771         wiki-pulse        → 3 fois
  cockpit/styles.css:3466             vl-pulse          → 3 fois

NE PAS toucher pskShimmer (skeleton loader, légitimement infini).

Pour chaque fichier, bumper le ?v= dans index.html (et la GH Action
sw-sync se chargera de sw.js).

Spec à toucher : aucune (changement transversal). Le commit message :
"Specs mises à jour: aucune | N/A (hygiène anim CSS)".

Validation : Ouvrir chaque panel (Jarvis, Jarvis Lab, Jobs Radar,
Musique, Opps, Stacks, Wiki, Challenges, Veille outils). Le pulse
correspondant doit tourner 3 fois (~6 sec) puis s'arrêter. Recharger
le panel doit relancer 3 cycles (montage). Pas plus.
```

**Validation** : ouvrir le cockpit, attendre 10 secondes sur un panel pulsant, l'image doit être figée. Aucun cycle perpétuel.

---

#### Prompt 3 — [UX] Hide `kbd-fab` après 7 jours (lutte R8)

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx` (dans le composant App, autour de la ligne 526 où `<button className="kbd-fab">…</button>` est rendu)

```
Contexte : Le bouton flottant "?" en bas à droite (kbd-fab) ouvre
l'overlay raccourcis clavier. Utile au début, friction visuelle après
quelques jours (R8 dans les audits 28/04 et 29/04). Cumulé avec
recent-toggle juste au-dessus, ça fait 2 FABs empilés en permanence.

Tâche : Masquer le kbd-fab après 7 jours d'usage (mesurés via
localStorage "cockpit-first-seen"). Garder l'accès au raccourci ?
clavier (déjà géré, ça ne change pas). Ajouter un petit lien discret
dans la modale Profil pour "Afficher de nouveau les aides clavier".

Implémentation, dans cockpit/app.jsx, dans le composant App, AVANT le
return :

  // Hide the help FAB after 7 days of usage. The keyboard shortcut "?"
  // continues to work — only the visual nudge disappears.
  const [showKbdFab, setShowKbdFab] = useState(true);
  useEffect(() => {
    try {
      const force = localStorage.getItem("cockpit-show-kbd-fab") === "1";
      if (force) { setShowKbdFab(true); return; }
      const firstSeen = localStorage.getItem("cockpit-first-seen");
      if (!firstSeen) {
        localStorage.setItem("cockpit-first-seen", String(Date.now()));
        setShowKbdFab(true);
        return;
      }
      const days = (Date.now() - parseInt(firstSeen, 10)) / 86400000;
      setShowKbdFab(days < 7);
    } catch { setShowKbdFab(true); }
  }, []);

Puis remplacer le rendu du kbd-fab par :

  {showKbdFab && (
    <button
      className="kbd-fab"
      onClick={() => setShortcutsOpen(true)}
      title="Raccourcis clavier (?)"
      aria-label="Afficher les raccourcis clavier"
    >?</button>
  )}

Dans cockpit/panel-profile.jsx (ou la section "Préférences UI" si elle
existe), ajouter une ligne :

  <label className="prof-toggle">
    <input
      type="checkbox"
      checked={localStorage.getItem("cockpit-show-kbd-fab") === "1"}
      onChange={(e) => {
        if (e.target.checked) localStorage.setItem("cockpit-show-kbd-fab","1");
        else localStorage.removeItem("cockpit-show-kbd-fab");
      }}
    />
    Afficher l'aide clavier flottante (?)
  </label>

Bumper app.jsx ?v=31 dans index.html. Bumper panel-profile.jsx d'un cran.

Specs à toucher :
- docs/specs/tab-profile.md : ajouter la nouvelle préférence
  "Afficher l'aide clavier flottante" dans Fonctionnalités.
- docs/specs/index.json : bumper last_updated pour "profile" → 2026-04-30.

Validation : Réinitialiser localStorage. Ouvrir → fab visible. Set
`cockpit-first-seen` à 8 jours en arrière → reload → fab caché. Aller
dans Profil, cocher → reload → fab visible. Décocher → reload → caché.
La touche "?" continue de toujours fonctionner.
```

**Validation** : un nouveau visiteur voit le FAB. Un visiteur de 8+ jours ne le voit plus mais peut le rallumer dans Profil.

---

#### Prompt 4 — [UX] Streak 0 → "Premier jour de veille" zero-state

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx` (sidebar footer, fonction de rendu du streak)

```
Contexte : La sidebar footer affiche un compteur de streak ("X j de
veille consécutifs"). Quand le streak vaut 0, l'utilisateur voit
juste "0 j" sans contexte (R9). Démoralisant et zéro action invitée.

Tâche : Quand streak === 0, afficher un message zero-state encourageant
au lieu du chiffre brut.

Localiser dans cockpit/sidebar.jsx la portion qui rend la valeur du
streak (chercher "streak" et le span qui montre le nombre + unité).
Remplacer le rendu pour brancher un fallback :

  <div className="sb-streak">
    {streak > 0 ? (
      <>
        <span className="sb-streak-num">{streak}</span>
        <span className="sb-streak-unit">jour{streak > 1 ? "s" : ""} de veille</span>
      </>
    ) : (
      <>
        <span className="sb-streak-num sb-streak-zero" aria-hidden="true">·</span>
        <span className="sb-streak-unit sb-streak-zero-msg">
          Premier jour. Lis 1 article pour démarrer.
        </span>
      </>
    )}
  </div>

CSS dans cockpit/styles.css (chercher .sb-streak-num et ajouter à la
suite) :

  .sb-streak-zero { color: var(--tx3); }
  .sb-streak-zero-msg { font-size: var(--text-xs); font-style: italic; }

Bumper sidebar.jsx ?v=7 et styles.css ?v=24 dans index.html.

Specs à toucher :
- docs/specs/tab-brief.md (ou le fichier qui couvre le shell, sinon
  créer une mention dans tab-brief.md sous Fonctionnalités > Sidebar) :
  ajouter "État zero du streak : message d'encouragement quand
  l'utilisateur n'a encore rien lu aujourd'hui".
- docs/specs/index.json : bumper last_updated pour "brief" → 2026-04-30.

Validation : Forcer en console `localStorage.setItem("cockpit-streak", "0")`
et reload → la sidebar affiche "Premier jour. Lis 1 article pour
démarrer.". Marquer 1 article comme lu → recharger → "1 jour de veille".
```

**Validation** : un user qui ouvre le cockpit pour la première fois (ou après une rupture) ne voit plus un sec "0 j" qui démoralise.

---

#### Prompt 5 — [UX] Skip link a11y "Aller au contenu principal"

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx` (juste avant le `<button className="sb-mobile-trigger">`), `cockpit/styles.css`

```
Contexte : Le cockpit est accessible au clavier (Tab focus visible),
mais pas de skip link "Aller au contenu" — un user clavier ou lecteur
d'écran doit traverser tous les items de la sidebar avant d'accéder au
panel. Standard WCAG 2.4.1.

Tâche : Ajouter un skip link en tête du DOM, masqué visuellement mais
révélé au focus, qui amène au <main> du panel actif.

Dans cockpit/app.jsx, dans le return du composant App, juste après
<div className={`app ...`}> et avant <button className="sb-mobile-trigger">,
insérer :

  <a href="#main-content" className="skip-link">Aller au contenu principal</a>

Et sur l'élément <main className="main">, ajouter id="main-content" :

  <main className="main" id="main-content" tabIndex="-1">

Dans cockpit/styles.css, ajouter en début de fichier (après le
@import des fonts) :

  .skip-link {
    position: absolute;
    top: -44px;
    left: 8px;
    padding: 8px 14px;
    background: var(--tx);
    color: var(--bg);
    border-radius: var(--radius);
    text-decoration: none;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    z-index: 1000;
    transition: top 140ms;
  }
  .skip-link:focus {
    top: 8px;
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }

Bumper app.jsx et styles.css.

Specs à toucher : aucune (purement a11y, transversal). Mentionner dans
le commit "Specs mises à jour: aucune | N/A (a11y skip link)".

Validation : Ouvrir le cockpit, presser Tab dès le chargement → la 1ère
chose focussée doit être le lien "Aller au contenu principal" en
haut-gauche, visible. Enter → le focus saute dans le main. Tester
NVDA / VoiceOver : la 1ère annonce doit être le skip link.
```

**Validation** : un user clavier presse Tab à l'arrivée et voit le skip link en haut à gauche. Enter saute dans le panel.

---

#### Prompt 6 — [UX] Supprimer le composant `Stub` mort

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx` (lignes 99-112 environ, et ligne 488 environ)

```
Contexte : cockpit/app.jsx contient un composant Stub déclaré (lignes
99-112) qui rend un message "Ce panel reste à designer". Ce composant
est encore utilisé en fallback ligne ~488 (`else content = <Stub … />`),
mais TOUS les ids du sidebar (window.COCKPIT_NAV) sont désormais routés.
Le Stub n'est jamais atteint. Dette cognitive (R14+).

Tâche : Remplacer le composant Stub par un PanelNotFound minimal qui
affiche un message d'erreur sobre + bouton retour, et garder cette
branche fallback comme filet de sécurité (au cas où une URL profonde
viendrait avec un panel inconnu).

Dans cockpit/app.jsx, supprimer le composant Stub (lignes 99-112) et
le remplacer par :

  function PanelNotFound({ id, onBack }) {
    return (
      <div className="panel-not-found">
        <span className="pnf-kicker">Panel inconnu</span>
        <h2 className="pnf-title">"{id}" n'existe pas</h2>
        <p className="pnf-body">
          Cette adresse pointe vers un panel qui n'est plus dans la
          navigation actuelle. Tu peux ouvrir le Brief du jour ou
          chercher autre chose.
        </p>
        <div className="pnf-actions">
          <button className="btn btn--primary" onClick={onBack}>
            Retour au Brief
          </button>
        </div>
      </div>
    );
  }

Et remplacer la ligne `else content = <Stub …` par :

  else content = <PanelNotFound id={activePanel} onBack={() => setActivePanel("brief")} />;

Dans cockpit/styles.css, supprimer les règles .stub, .stub-kicker,
.stub-title, .stub-body, .stub-back (lignes ~1854-1881) et ajouter à
la place :

  .panel-not-found { padding: 80px 32px; max-width: 540px; margin: 0 auto; text-align: center; }
  .pnf-kicker { font-family: var(--font-mono); font-size: var(--text-2xs); letter-spacing: 0.12em; text-transform: uppercase; color: var(--tx3); display: block; margin-bottom: 12px; }
  .pnf-title { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--tx); margin-bottom: 16px; }
  .pnf-body { color: var(--tx2); line-height: 1.6; margin-bottom: 24px; }
  .pnf-actions { display: flex; justify-content: center; gap: 12px; }

Bumper app.jsx ?v=31 et styles.css ?v=24.

Specs à toucher : aucune.

Validation : Ouvrir le cockpit, taper en URL ?p=foo (ou setActivePanel
manuel en console) → écran "foo n'existe pas" + bouton retour. Cliquer
→ retour Brief. Plus de message obsolète "Ce panel reste à designer".
```

**Validation** : aucun panel actif n'affiche plus le message obsolète. Une URL parasite tombe sur une 404 panel propre.

---

### P1 — Améliorations UX significatives

#### Prompt 7 — [UX] Dépoussiérer hex hardcodés Jarvis Lab (R16+ partie 1)

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles-jarvis-lab.css` (1824 lignes)

```
Contexte : cockpit/styles-jarvis-lab.css contient ~14 occurrences de
hex codés en dur (extraits via `grep -oh '#[0-9A-Fa-f]\{6\}'`). Le panel
Jarvis Lab est le plus pollué par R16+. En Obsidian ou Atlas, ces hex
brisent la promesse tri-thème.

Tâche : Remplacer les hex hardcodés par des CSS Custom Properties
existantes dans cockpit/themes.js. Mapping recommandé (à confirmer en
relisant le contexte de chaque déclaration) :

  #c2410c → var(--brand)
  #b3491a → var(--brand-ink)
  #fbeada → var(--brand-tint)
  #1f1815 → var(--tx)
  #5e524a → var(--tx2)
  #766960 → var(--tx3)
  #f5efe4 → var(--bg)
  #ede5d6 → var(--bg2)
  #e0d5c0 → var(--bd)
  #c9bba3 → var(--bd2)
  #4d6a3a → var(--positive)
  #b54b3b → var(--alert)

Procédure :
1. Ouvrir cockpit/styles-jarvis-lab.css.
2. Pour chaque hex : déterminer son rôle (text/bg/border/accent) à
   partir du contexte, choisir le token le plus proche, remplacer.
3. Si un hex n'a aucun équivalent (ex : #737373 gris pur), conserver-le
   pour ce prompt mais ouvrir une carte d'idée "ajouter `--neutral2`
   au design system pour éviter les hex orphelins".
4. Bumper styles-jarvis-lab.css ?v=8.

Important : NE PAS toucher la sémantique (un fond ne devient pas un
texte). Si un doute, garder le hex et signaler dans le commit
"hex orphelin: <fichier>:<ligne>:<hex>".

Specs à toucher :
- docs/specs/tab-jarvis-lab.md : pas de changement fonctionnel, mais
  une ligne dans Dernière MAJ "2026-04-30 — hygiène CSS, hex hardcodés
  remplacés par tokens".
- docs/specs/index.json : bumper last_updated pour "jarvis-lab" → 2026-04-30.

Validation : Switcher entre Dawn / Obsidian / Atlas via la sidebar.
Le panel Jarvis Lab doit refléter le thème en entier (pas de tache
rouille en Obsidian, pas de fond noir en Dawn). Diff visuel : zéro
régression sur Dawn (l'œil ne doit pas voir la différence).
```

**Validation** : ouvrir Jarvis Lab dans les 3 thèmes successivement. Aucune couleur n'apparaît "out-of-theme".

---

#### Prompt 8 — [UX] Tokens dans `cockpit/lib/auth.js` (R3 secondaire)

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/lib/auth.js`

```
Contexte : L'overlay Google OAuth est rendu AVANT le mount React (donc
avant que React applique les tokens via data-theme=...). Pour éviter
d'avoir un écran noir, l'auth.js hardcode les couleurs Dawn (#F5EFE4,
#1F1815, #C2410C, #5E524A, #EDE5D6, #9A8D82). Si l'utilisateur revient
déconnecté en Obsidian/Atlas (theme stocké en localStorage), il voit un
écran Dawn → flash incohérent.

Tâche : Avant de créer l'overlay, lire localStorage.cockpit-theme et
choisir un set de variables CSS adapté. Idéalement, exposer les tokens
sur :root AVANT le mount, pour que l'overlay puisse utiliser var(--bg).

Étape 1 — exposer les tokens en JS pur, indépendamment de React :

  // En tête de cockpit/lib/auth.js, AVANT makeOverlay() :
  function applyEarlyTheme(){
    try {
      const id = localStorage.getItem("cockpit-theme") || "dawn";
      const t = (window.THEMES && window.THEMES[id]) || (window.THEMES && window.THEMES.dawn);
      if (!t || !t.vars) return;
      const root = document.documentElement;
      Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
      root.setAttribute("data-theme", id);
    } catch {}
  }

Étape 2 — Appeler applyEarlyTheme() au tout début de waitForAuth(),
avant makeOverlay().

Étape 3 — Réécrire makeOverlay pour utiliser les variables CSS plutôt
que des hex en dur :

  o.style.cssText = [
    "position:fixed","inset:0","z-index:9999",
    "display:flex","align-items:center","justify-content:center",
    "background:var(--bg)",
    "font-family:var(--font-body, 'Inter', system-ui, sans-serif)",
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
      <button id="login-btn" style="display:inline-flex;align-items:center;gap:10px;padding:12px 22px;border-radius:var(--radius);background:var(--tx);color:var(--bg);border:none;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background 120ms">
        ...
      </button>
      <div id="login-msg" style="margin-top:18px;font-size:12px;color:var(--tx3);min-height:18px"></div>
    </div>
  `;

Important : THEMES doit être chargé AVANT auth.js. Vérifier dans
index.html que <script src="cockpit/themes.js"> est bien avant
<script src="cockpit/lib/auth.js"> (sinon, déplacer themes.js avant).

Specs à toucher : aucune.

Validation : Switcher en Obsidian, se déconnecter (auth.signOut), reload.
L'écran d'auth doit être en Obsidian (charbon profond + cyan brand) — pas
en Dawn ivoire. Idem pour Atlas. La transition vers le cockpit après
login doit être imperceptible (le data-theme reste cohérent).
```

**Validation** : se déconnecter en Obsidian → recharger → écran d'auth en couleurs Obsidian, pas un flash Dawn.

---

#### Prompt 9 — [UX] Mode "Hero compact" persistant (R1)

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx` (la section <section className="hero"> ligne ~376), `cockpit/styles.css` (autour de .hero-title, ligne ~598)

```
Contexte : Le hero macro du Brief utilise font-size: clamp(32px, 4.2vw,
54px) + padding 44px 32px 40px + body en --text-xl. Calibré pour la 1ère
visite, surdimensionné après 30 jours d'usage quotidien. R1 dans tous
les audits depuis 28/04, jamais traité.

Tâche : Ajouter un toggle "Compact" sur le hero, persistant via
localStorage "cockpit-hero-compact". État compact = padding et font-size
divisés par ~1.6.

Étape 1 — Toggle dans home.jsx
Dans Home(), avant le return :

  const [heroCompact, setHeroCompact] = useState(() => {
    try { return localStorage.getItem("cockpit-hero-compact") === "1"; }
    catch { return false; }
  });
  const toggleHeroCompact = () => {
    setHeroCompact(v => {
      const next = !v;
      try { localStorage.setItem("cockpit-hero-compact", next ? "1" : "0"); } catch {}
      try { window.track && window.track("hero_compact_toggled", { state: next ? "compact" : "full" }); } catch {}
      return next;
    });
  };

Sur la <section className="hero"> ligne 376, ajouter :

  <section className={`hero ${heroCompact ? "is-compact" : ""}`}>

Et dans hero-actions ou hero-meta, ajouter le toggle :

  <button
    className="hero-compact-toggle"
    onClick={toggleHeroCompact}
    title={heroCompact ? "Hero plein format" : "Hero compact"}
    aria-label={heroCompact ? "Étendre le hero" : "Réduire le hero"}
    aria-pressed={heroCompact}
  >
    <Icon name={heroCompact ? "chevron_down" : "chevron_up"} size={12} stroke={2} />
    {heroCompact ? "Plein" : "Compact"}
  </button>

Étape 2 — CSS dans styles.css
Après .hero-body (ligne ~609) :

  .hero.is-compact .hero-frame { padding: 20px 28px 18px; }
  .hero.is-compact .hero-title { font-size: clamp(20px, 2.4vw, 28px); margin-bottom: 8px; }
  .hero.is-compact .hero-body { font-size: var(--text-md); margin-bottom: 12px; max-width: 70ch; }
  .hero.is-compact .hero-kicker { margin-bottom: 8px; }
  .hero.is-compact .hero-delta-list li { padding: 6px 10px; font-size: var(--text-sm); }
  .hero.is-compact .hero-meta { gap: 10px; padding: 10px; }
  .hero-compact-toggle {
    position: absolute; top: 12px; right: 12px;
    background: transparent; border: 1px solid var(--bd);
    padding: 4px 10px; border-radius: 999px;
    font-family: var(--font-mono); font-size: var(--text-2xs);
    color: var(--tx3); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .hero-compact-toggle:hover { color: var(--tx2); border-color: var(--bd2); }
  .hero-frame { position: relative; }

Bumper home.jsx ?v=5, styles.css ?v=24.

Specs à toucher :
- docs/specs/tab-brief.md : ajouter "Toggle compact/plein du hero"
  dans Fonctionnalités. Mention dans Parcours utilisateur "Tu peux
  réduire le hero quand tu reviens 5 fois par jour".
- docs/specs/index.json : last_updated brief → 2026-04-30.

Télémétrie : ajouter "hero_compact_toggled" {state} au tableau du
CLAUDE.md (section Télémétrie) AVANT le commit.

Validation : Cliquer "Compact" → hero rétrécit immédiatement, le titre
passe de ~50px à ~26px, padding divisé par 2. Reload → préférence
conservée. Cliquer "Plein" → revient à l'état macro initial. Mobile :
le toggle reste accessible sans recouvrir le contenu.
```

**Validation** : un retour quotidien permet d'avoir un hero rapide à scanner. Le mode plein reste disponible pour les moments où on a le temps.

---

#### Prompt 10 — [UX] Bannière "données stale > 24h" sur Brief

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
Contexte : Si un pipeline GitHub Actions échoue, l'utilisateur peut
ouvrir le cockpit et lire un brief de la veille (ou plus vieux) sans
le savoir. R10 dans les audits 28/04 et 29/04.

Tâche : Détecter si daily_briefs.fetch_date est < J-1 et afficher une
bannière sobre en tête du Brief.

Dans cockpit/home.jsx, dans Home(), juste après les useState et avant
le return, ajouter :

  // Stale data detection : compare brief date à aujourd'hui (en local).
  const briefIso = data.brief?.fetch_date || data.brief?.iso || null;
  const briefStale = (() => {
    if (!briefIso) return null;
    try {
      const briefDay = briefIso.slice(0, 10); // YYYY-MM-DD
      const today = new Date().toISOString().slice(0, 10);
      if (briefDay >= today) return null;
      const ageDays = Math.round((Date.now() - new Date(briefIso).getTime()) / 86400000);
      return ageDays > 0 ? ageDays : null;
    } catch { return null; }
  })();

Dans le return, AVANT <section className="hero">, ajouter :

  {briefStale !== null && (
    <div className="brief-stale-banner" role="alert">
      <Icon name="alert" size={14} stroke={2} />
      <span>
        Le brief affiché date d'il y a {briefStale} jour{briefStale > 1 ? "s" : ""}.
        Le pipeline quotidien n'a pas tourné aujourd'hui — un check sur
        GitHub Actions s'impose peut-être.
      </span>
      <a
        href="https://github.com/ph3nixx/jarvis-cockpit/actions/workflows/daily_digest.yml"
        target="_blank" rel="noopener"
        className="brief-stale-link"
      >Voir Actions ↗</a>
    </div>
  )}

Dans cockpit/styles.css, ajouter (avant .hero ou après .page-header) :

  .brief-stale-banner {
    margin: 16px 32px 0;
    padding: 12px 16px;
    background: var(--alert-tint);
    border: 1px solid var(--alert);
    border-radius: var(--radius);
    color: var(--tx);
    font-size: var(--text-md);
    display: flex; align-items: center; gap: 10px;
  }
  .brief-stale-banner svg { color: var(--alert); flex-shrink: 0; }
  .brief-stale-banner span { flex: 1; line-height: 1.5; }
  .brief-stale-link {
    color: var(--alert); font-weight: 500;
    text-decoration: underline;
    font-family: var(--font-mono); font-size: var(--text-xs);
    flex-shrink: 0;
  }

Bumper home.jsx et styles.css.

Specs à toucher :
- docs/specs/tab-brief.md : ajouter "Avertissement quand le brief
  affiché date de plus d'un jour" dans Fonctionnalités.
- docs/specs/index.json : bumper brief.

Validation : Manuellement, simuler un brief en J-2 (modifier
data.brief.fetch_date en console). La bannière s'affiche en alert.
Un clic sur "Voir Actions" ouvre la GH Action dans un nouvel onglet.
Si le brief est aujourd'hui → pas de bannière.
```

**Validation** : un utilisateur dont le pipeline est planté est immédiatement informé que les données sont stales et a un lien direct vers Actions.

---

### P2 — Polish + features Jarvis avancées

#### Prompt 11 — [JARVIS] Préchargement Babel + JSX critiques (R5 partie 1)

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `index.html` (uniquement le <head>)

```
Contexte : Au boot, 66 scripts chargés en série dans index.html. 0 defer,
0 async. Babel standalone (~3 MB) bloque tout, puis transpile 23 JSX en
série. FCP estimé 3-5s sur fibre, 6-10s en mobile 4G. R5 dans tous les
audits.

Solution stratégique : on ne peut pas mettre `defer` sur les JSX
(Babel doit les voir avec type="text/babel"). Mais on peut **précharger**
les fichiers critiques via <link rel="preload"> pour que le navigateur
les fetch en parallèle pendant que Babel s'initialise.

Tâche : Ajouter dans le <head> de index.html, juste après les
preconnect Google Fonts, une série de preload pour les ressources
critiques du chemin du Brief (pas tous les 23 panels — juste ceux du
boot Tier 1).

Code à ajouter (dans index.html, head, après les preconnect) :

  <!-- Preload critical path (Brief) — fetch in parallel while Babel boots -->
  <link rel="preload" href="cockpit/styles.css?v=24" as="style">
  <link rel="preload" href="cockpit/themes.js?v=2" as="script">
  <link rel="preload" href="cockpit/nav.js?v=2" as="script">
  <link rel="preload" href="cockpit/lib/supabase.js?v=1" as="script">
  <link rel="preload" href="cockpit/lib/data-loader.js?v=35" as="script">
  <link rel="preload" href="cockpit/icons.jsx?v=3" as="fetch" crossorigin="anonymous">
  <link rel="preload" href="cockpit/sidebar.jsx?v=6" as="fetch" crossorigin="anonymous">
  <link rel="preload" href="cockpit/home.jsx?v=4" as="fetch" crossorigin="anonymous">
  <link rel="preload" href="cockpit/app.jsx?v=31" as="fetch" crossorigin="anonymous">
  <!-- Preconnect Supabase pour gagner DNS+TLS pendant le boot React -->
  <link rel="preconnect" href="https://mrmgptqpflzyavdfqwwv.supabase.co" crossorigin>

Important : ne PAS précharger les 23 panels — risque de gaspiller la
bande passante mobile et de ralentir le path critique. Seulement les
fichiers nécessaires au mount initial (Brief uniquement).

Specs à toucher : aucune (perf invisible).

Validation : Lighthouse run avant/après. FCP doit baisser de ~500ms à
~1.5s sur 4G simulée. À l'œil nu : ouvrir DevTools Network, throttling
"Slow 4G", reload — les fichiers critiques apparaissent en priorité,
pas en cascade.
```

**Validation** : Lighthouse FCP gagne ≥ 500ms en condition mobile 4G simulée.

---

#### Prompt 12 — [JARVIS] J7 — Boot-mask anti-FOUC (R5 partie 2)

**Priorité** : P2
**Dépend de** : Prompt 11 (combinaison naturelle)
**Fichiers concernés** : `index.html`, `cockpit/lib/bootstrap.js`

```
Contexte : Pendant que Babel transpile les 23 JSX en série, l'utilisateur
voit un écran blanc. Sur mobile 4G, ça peut durer 6-10 secondes. Aucun
feedback "ça charge". Un boot-mask injecté DANS le HTML statique et
enlevé par bootstrap.js après mount donne la sensation d'un démarrage
rapide sans changer le temps réel.

Tâche : Injecter un mask dans le <body> de index.html (avant <div id="root">)
et le retirer dans bootstrap.js juste avant window.__cockpitMount().

Étape 1 — Mask dans index.html
Remplacer <body> ... <div id="root"></div> par :

  <body>
    <div id="boot-mask">
      <style>
        #boot-mask {
          position: fixed; inset: 0; z-index: 10000;
          background: var(--bg, #F5EFE4);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
          color: var(--tx2, #5E524A);
        }
        #boot-mask .bm-inner { text-align: center; }
        #boot-mask .bm-spin {
          width: 32px; height: 32px;
          margin: 0 auto 16px;
          border: 2px solid rgba(0,0,0,0.08);
          border-top-color: var(--brand, #C2410C);
          border-radius: 50%;
          animation: bm-spin 0.8s linear infinite;
        }
        #boot-mask .bm-text {
          font-family: 'Fraunces', serif;
          font-size: 14px; letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        @keyframes bm-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          #boot-mask .bm-spin { animation: none; border-top-color: var(--brand, #C2410C); }
        }
      </style>
      <div class="bm-inner">
        <div class="bm-spin"></div>
        <div class="bm-text">AI Cockpit · Démarrage</div>
      </div>
    </div>
    <div id="root"></div>

Étape 2 — Retrait dans bootstrap.js
Dans cockpit/lib/bootstrap.js, juste avant window.__cockpitMount() :

  // Remove the boot mask once auth + Tier 1 data are ready.
  const mask = document.getElementById("boot-mask");
  if (mask) {
    mask.style.transition = "opacity 200ms";
    mask.style.opacity = "0";
    setTimeout(() => mask.remove(), 220);
  }

Garde-fou : en cas d'erreur dans bootstrap (ex auth fail), le mask doit
quand même disparaître pour révéler l'overlay d'auth. Ajouter en début
de bootstrap, avant le try :

  // Safety: if anything below fails, the mask still hides after 8s.
  setTimeout(() => {
    const m = document.getElementById("boot-mask");
    if (m) m.remove();
  }, 8000);

Bumper bootstrap.js ?v=3.

Specs à toucher : aucune.

Validation : Throttling "Slow 4G" → on voit le spinner avec "AI Cockpit ·
Démarrage" pendant 3-6s, puis fade vers le brief. Pas d'écran blanc.
Désactiver Babel manuellement (devtools) → après 8s, le mask disparaît
et l'overlay d'auth apparaît (filet de sécurité).
```

**Validation** : sur mobile 4G simulée, l'utilisateur voit un mask soigné pendant tout le boot, jamais un écran blanc.

---

#### Prompt 13 — [JARVIS] J1 — Lecture immersive (overlay full-screen)

**Priorité** : P2
**Dépend de** : Aucun (mais bénéficie de Prompts 1+2 sur reduced-motion)
**Fichiers concernés** : `cockpit/components-ticket.jsx` (ou nouveau `cockpit/reader.jsx`), `cockpit/styles.css` (nouveau bloc dédié), `cockpit/panel-top.jsx`, `cockpit/panel-veille.jsx`, `cockpit/panel-profile.jsx`

```
Contexte : Un user qui clique un Top 3 ou un article veille quitte le
cockpit pour un onglet externe (target="_blank"). Casse la rétention :
l'onglet externe a sa propre nav, ses pubs, et le retour au cockpit
demande un alt+tab. Une lecture immersive in-cockpit garde l'utilisateur
dans le contexte (J1, score composite 20).

Tâche : Composant ReaderOverlay qui prend un article {title, source,
section, summary, url, fetch_iso} et l'affiche en plein écran. Raccourcis :
J marque lu et ferme, S snooze 3j et ferme, ↗ ouvre l'URL externe en
nouvel onglet (sans fermer), Esc ferme.

PARTIE 1 — Composant ReaderOverlay
Créer cockpit/reader.jsx (ou ajouter à components-ticket.jsx) :

  function ReaderOverlay({ article, onClose, onMarkRead, onSnooze }) {
    React.useEffect(() => {
      const onKey = (e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "j" || e.key === "J") { onMarkRead?.(article); onClose(); }
        else if (e.key === "s" || e.key === "S") { onSnooze?.(article); onClose(); }
      };
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }, [article, onClose, onMarkRead, onSnooze]);

    if (!article) return null;
    return (
      <div className="reader" role="dialog" aria-modal="true" aria-label={article.title}>
        <header className="reader-head">
          <button className="reader-close" onClick={onClose} aria-label="Fermer">✕</button>
          <div className="reader-actions">
            <button className="reader-action" onClick={() => { onMarkRead?.(article); onClose(); }}>J · marquer lu</button>
            <button className="reader-action" onClick={() => { onSnooze?.(article); onClose(); }}>S · snooze 3j</button>
            <a className="reader-action reader-ext" href={article.url} target="_blank" rel="noopener">↗ ouvrir externe</a>
          </div>
        </header>
        <article className="reader-body">
          <div className="reader-kicker">{article.section} · {new Date(article.fetch_iso || Date.now()).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>
          <h1 className="reader-title">{article.title}</h1>
          <div className="reader-meta">
            <span>{article.source}</span>
            {article.reading_time && <><span>·</span><span>{article.reading_time}</span></>}
          </div>
          <div className="reader-content" dangerouslySetInnerHTML={{ __html: window.DOMPurify.sanitize(article.summary || "") }} />
        </article>
      </div>
    );
  }
  window.ReaderOverlay = ReaderOverlay;

PARTIE 2 — CSS dans styles.css

  .reader {
    position: fixed; inset: 0; z-index: 500;
    background: var(--bg);
    overflow-y: auto;
    animation: readerFade 200ms ease;
  }
  @keyframes readerFade { from { opacity: 0; } to { opacity: 1; } }
  .reader-head {
    position: sticky; top: 0; z-index: 1;
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px;
    background: var(--bg);
    border-bottom: 1px solid var(--bd);
  }
  .reader-close {
    width: 36px; height: 36px;
    border: none; background: transparent; cursor: pointer;
    color: var(--tx2); font-size: 18px; border-radius: 50%;
  }
  .reader-close:hover { background: var(--bg2); color: var(--tx); }
  .reader-actions { display: flex; gap: 8px; }
  .reader-action {
    padding: 6px 12px; border: 1px solid var(--bd);
    background: var(--surface); color: var(--tx2);
    font-family: var(--font-mono); font-size: var(--text-xs);
    border-radius: var(--radius); cursor: pointer;
    text-decoration: none; display: inline-flex; align-items: center;
  }
  .reader-action:hover { border-color: var(--bd2); color: var(--tx); }
  .reader-ext { color: var(--brand); }
  .reader-body {
    max-width: 70ch; margin: 0 auto;
    padding: 48px 32px 80px;
  }
  .reader-kicker {
    font-family: var(--font-mono); font-size: var(--text-2xs);
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--tx3); margin-bottom: 12px;
  }
  .reader-title {
    font-family: var(--font-display);
    font-size: clamp(28px, 3.4vw, 42px);
    font-weight: 500; letter-spacing: -0.02em;
    line-height: 1.15; color: var(--tx); margin-bottom: 16px;
  }
  .reader-meta {
    display: flex; gap: 8px; align-items: center;
    color: var(--tx3); font-size: var(--text-sm);
    margin-bottom: 32px;
    padding-bottom: 16px; border-bottom: 1px solid var(--bd);
  }
  .reader-content {
    font-size: var(--text-lg); line-height: 1.75;
    color: var(--tx); font-family: var(--font-body);
  }
  @media (max-width: 760px) {
    .reader-body { padding: 24px 18px 60px; }
    .reader-actions { flex-wrap: wrap; gap: 6px; }
    .reader-action { font-size: 11px; padding: 4px 8px; }
  }

PARTIE 3 — Toggle dans Profil
Dans cockpit/panel-profile.jsx, dans la section "Préférences UI", ajouter :

  <label className="prof-toggle">
    <input
      type="checkbox"
      defaultChecked={localStorage.getItem("cockpit-immersive-reader") === "1"}
      onChange={(e) => {
        if (e.target.checked) localStorage.setItem("cockpit-immersive-reader", "1");
        else localStorage.removeItem("cockpit-immersive-reader");
      }}
    />
    Lecture immersive (J / S / Esc)
  </label>

PARTIE 4 — Wrapping dans panel-top.jsx et panel-veille.jsx
Dans chaque panel qui ouvre un article via window.open :
1. Importer/utiliser window.ReaderOverlay.
2. State local : const [readerArticle, setReaderArticle] = useState(null);
3. Wrapper l'ouverture :
   const openArticle = (art) => {
     if (localStorage.getItem("cockpit-immersive-reader") === "1") {
       setReaderArticle(art);
     } else {
       window.open(art.url || art._url, "_blank", "noopener");
     }
   };
4. Render conditionnel :
   {readerArticle && <ReaderOverlay article={readerArticle}
                       onClose={() => setReaderArticle(null)}
                       onMarkRead={(a) => { /* localStorage.read-articles update */ }}
                       onSnooze={(a) => { /* snooze.js call */ }} />}

Bumper tous les fichiers touchés.

Specs à toucher :
- docs/specs/tab-brief.md, tab-top.md, tab-updates.md, tab-veille-outils.md :
  ajouter "Lecture immersive" dans Fonctionnalités.
- docs/specs/tab-profile.md : ajouter le toggle.
- docs/specs/index.json : bumper toutes les entrées concernées.

Télémétrie nouvelle :
- "reader_opened" {section, article_id}
- "reader_action" {action: "mark_read" | "snooze" | "ext_link" | "close"}

Ajouter ces 2 events au tableau du CLAUDE.md AVANT le commit.

Validation :
1. Activer la lecture immersive dans Profil.
2. Cliquer un Top 3 → modale plein écran avec titre Fraunces 42px, body
   70ch, 3 boutons en haut.
3. J → marque lu et ferme. S → snooze 3j et ferme. Esc → ferme sans
   action. ↗ → ouvre l'article original dans un nouvel onglet
   (sans fermer la lecture immersive).
4. Désactiver le toggle → comportement legacy (open en target=_blank).
```

**Validation** : "Mes Top 3 s'ouvrent dans un mode lecture épuré au sein du cockpit. Plus besoin d'aller chercher l'onglet pour revenir."

---

#### Prompt 14 — [JARVIS] J6 — Streak jokers (anti-rupture)

**Priorité** : P2
**Dépend de** : Prompt 4 (le streak existe et a un message zero)
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`, optionnellement nouvelle table Supabase `streak_jokers` (ou simple localStorage si solo)

```
Contexte : Un streak veille est puissant pour la rétention, mais
fragile : un jour d'indisponibilité (déplacement pro, maladie) tue le
compteur. Demotivant. Solution : 1 joker offert tous les 7 jours,
utilisable manuellement pour préserver le streak quand l'utilisateur
sait qu'il sera absent.

Tâche : Implémenter un système de jokers persistés en localStorage
(KISS pour démarrer, migrable Supabase si besoin multi-device).

Données : localStorage "cockpit-streak-jokers" = { available: number,
last_earned: ISO, used: [{date, applied_to_day}] }.

Logique :
- Toutes les 7 jours de streak consécutifs, available += 1, last_earned = today.
- Cap à 3 jokers max.
- "Utiliser un joker" maintenant : marque le jour comme couvert dans
  le compteur de streak (sans avoir lu d'article).

Étape 1 — Module utilitaire (ajouter à cockpit/lib/streak-jokers.js,
nouveau fichier) :

  (function(){
    const KEY = "cockpit-streak-jokers";
    const CAP = 3;

    function load(){
      try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
      catch { return {}; }
    }
    function save(s){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

    function earnIfDue(streak){
      const s = load();
      if (typeof s.available !== "number") s.available = 0;
      const today = new Date().toISOString().slice(0,10);
      if (s.last_earned === today) return s;
      // Earn 1 every multiple of 7
      if (streak > 0 && streak % 7 === 0 && s.available < CAP) {
        s.available = Math.min(CAP, (s.available || 0) + 1);
        s.last_earned = today;
        save(s);
      }
      return s;
    }

    function consume(){
      const s = load();
      if (!s.available || s.available <= 0) return false;
      s.available -= 1;
      s.used = s.used || [];
      s.used.push({ date: new Date().toISOString(), applied_to_day: new Date().toISOString().slice(0,10) });
      save(s);
      return true;
    }

    window.streakJokers = { load, earnIfDue, consume, CAP };
  })();

L'inclure dans index.html après auth.js.

Étape 2 — UI dans sidebar.jsx
Dans la zone footer-streak, ajouter, sous le compteur :

  {jokers.available > 0 && (
    <div className="sb-jokers" title={`Tu as ${jokers.available} joker${jokers.available > 1 ? "s" : ""} pour préserver ton streak.`}>
      {Array.from({ length: jokers.available }).map((_, i) =>
        <span key={i} className="sb-joker">⊛</span>
      )}
      <button className="sb-joker-use"
        onClick={() => {
          if (window.streakJokers.consume()) {
            try { window.track && window.track("streak_joker_used", { remaining: window.streakJokers.load().available }); } catch {}
            // Re-render via state bump
            setJokers(window.streakJokers.load());
          }
        }}
        title="Utiliser 1 joker pour préserver le streak aujourd'hui"
      >Utiliser</button>
    </div>
  )}

Et au mount, appeler earnIfDue(streak) puis stocker en state.

Étape 3 — CSS dans styles.css :

  .sb-jokers { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: var(--text-xs); }
  .sb-joker { color: var(--brand); font-size: 14px; }
  .sb-joker-use {
    background: transparent; border: 1px solid var(--bd);
    padding: 2px 8px; border-radius: 999px;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--tx2); cursor: pointer; margin-left: auto;
  }
  .sb-joker-use:hover { color: var(--brand); border-color: var(--brand); }

Bumper sidebar.jsx, styles.css.

Specs à toucher :
- docs/specs/tab-brief.md (ou un éventuel tab-shell.md) : mention du
  système de jokers dans Fonctionnalités.
- docs/specs/index.json : bumper.

Télémétrie nouvelle :
- "streak_joker_earned" {streak, available_after}
- "streak_joker_used" {remaining}

Ajouter au tableau CLAUDE.md.

Validation :
1. Forcer streak à 7 dans localStorage. Reload → 1 joker apparaît
   sous le compteur.
2. Continuer 7 jours encore → 2 jokers (max 3).
3. Cliquer "Utiliser" → joker consommé, streak préservé pour le jour.
4. Tenter 4 fois consécutives → cap à 3.
```

**Validation** : un user qui sait être indisponible demain peut consommer un joker pour ne pas casser sa streak.

---

#### Prompt 15 — [JARVIS] J2 — Resume tracker hebdo (Miroir dimanche)

**Priorité** : P2
**Dépend de** : `usage_events` table (existante), `weekly_analysis.py` pipeline
**Fichiers concernés** : `cockpit/panel-evening.jsx`, `weekly_analysis.py` (ajout d'une étape dans le pipeline hebdo)

```
Contexte : Le Miroir du soir aujourd'hui est un panel quotidien réflexif.
Le dimanche, il pourrait devenir une synthèse hebdo de l'activité réelle,
construite depuis usage_events (déjà alimenté par track()) +
weekly_analysis Claude Haiku (déjà budget géré).

Tâche : Étendre weekly_analysis.py pour produire un weekly_resume
(table existante ou nouvelle) le dimanche après les autres analyses,
puis afficher cette synthèse dans panel-evening.jsx quand on est dimanche.

PARTIE 1 — Pipeline (weekly_analysis.py)

Ajouter une fonction generate_weekly_resume(client, profile, radar)
qui :
1. Query usage_events de la semaine écoulée (lundi → dimanche), groupé
   par section.
2. Compte par section : section_opened, link_clicked, top_card_collapsed,
   ideas count.
3. Identifie les 5 thèmes dominants (sections avec le plus d'opens +
   clicks).
4. Pour chaque thème, query les articles fetched cette semaine dans
   cette section et leur score d'attention (lus, snoozés, etc.).
5. Envoie tout ça à Claude Haiku avec un prompt :
   "Tu es Jarvis. Voici les 5 thèmes dominants de la semaine de Jean
   et son activité par thème. Produis une synthèse en 5 paragraphes
   courts (≤ 4 phrases chacun), en français, vouvoyant pas, ton sobre
   et précis. Termine par UNE action proposée pour la semaine
   prochaine, dérivée de la donnée."
6. Stocke en Supabase dans une table weekly_resume (ou comme entrée
   weekly_analysis avec analysis_type='weekly_resume').

Schéma table (à ajouter en migration sql/013_weekly_resume.sql) :

  CREATE TABLE weekly_resume (
    week_start DATE PRIMARY KEY,
    summary_html TEXT NOT NULL,
    themes JSONB NOT NULL, -- [{name, count, top_article}]
    action_proposed TEXT,
    tokens_used INT,
    cost_usd NUMERIC(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE weekly_resume ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "auth read" ON weekly_resume FOR SELECT TO authenticated USING (true);

PARTIE 2 — Front (panel-evening.jsx)

Au mount, fetch la dernière weekly_resume :

  useEffect(() => {
    const today = new Date();
    if (today.getDay() !== 0) return; // dimanche uniquement
    fetchJSON("/rest/v1/weekly_resume?order=week_start.desc&limit=1")
      .then(rows => rows?.[0] && setWeeklyResume(rows[0]));
  }, []);

Si weeklyResume existe et qu'on est dimanche, afficher en tête du
panel un nouveau bloc "Ta semaine en 5 thèmes" :

  {weeklyResume && (
    <section className="evening-weekly">
      <div className="evening-weekly-kicker">Synthèse hebdomadaire</div>
      <h2 className="evening-weekly-title">Ta semaine en 5 thèmes</h2>
      <ul className="evening-weekly-themes">
        {weeklyResume.themes.map((t, i) => (
          <li key={i}>
            <span className="theme-bullet" />
            <div>
              <div className="theme-name">{t.name}</div>
              <div className="theme-count">{t.count} {t.unit || "articles lus"}</div>
              {t.top_article && (
                <div className="theme-top">dont "{t.top_article}"</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {weeklyResume.action_proposed && (
        <div className="evening-action-card">
          <div className="evening-action-kicker">Action proposée</div>
          <p>{weeklyResume.action_proposed}</p>
        </div>
      )}
      <button className="btn btn--primary btn--sm"
        onClick={() => onMarkResumeRead(weeklyResume.week_start)}
      >Marquer cette synthèse comme lue</button>
    </section>
  )}

CSS approprié dans cockpit/styles-evening.css (suivre le style existant).

Bumper panel-evening.jsx, styles-evening.css.

Specs à toucher :
- docs/specs/tab-evening.md : ajouter "Synthèse hebdomadaire affichée
  le dimanche, basée sur l'activité de la semaine + LLM" en
  Fonctionnalités.
- docs/specs/index.json : bumper evening.

Architecture à toucher :
- docs/architecture/dependencies.yaml : ajouter weekly_resume dans
  tables[] (owner_pipeline=weekly_analysis, rls=authenticated, domain=apprentissage).
- docs/architecture/pipelines.yaml : weekly_analysis génère désormais
  aussi weekly_resume. Mettre à jour la description.
- docs/architecture/decisions.md : entrée "Resume tracker hebdo (J2)
  s'appuie sur usage_events + Claude Haiku, déclenché dimanche après
  weekly_analysis principal".

Validation :
1. Manuellement : changer la date locale au dimanche, marquer 10
   articles comme lus dans 5 sections différentes la semaine passée.
2. Lancer weekly_analysis.py manuellement → un row weekly_resume est créé.
3. Ouvrir le Miroir du soir → la synthèse s'affiche.
4. Lundi (changer la date), revenir → la synthèse disparaît.
5. Vérifier le coût : ≤ 0.05$ par run.
```

**Validation** : tous les dimanches, un récap hebdo personnalisé apparaît dans le Miroir du soir avec une action concrète proposée.

---

## Checklist d'exécution (ordonnée 30/04)

| # | Prompt | Source | Priorité | Dépend de | Effort | Cumul |
|---|---|---|---|---|---|---|
| 1 | **Prompt 1 — Garde globale `prefers-reduced-motion`** | 30/04 NEW | **P0 🔴** | — | 5 min | 5 min |
| 2 | **Prompt 2 — Couper 9 pulses infinis → 3 cycles** | 30/04 NEW | **P0 🔴** | — | 20 min | 25 min |
| 3 | Prompt 3 — Hide kbd-fab après 7j | 28→30/04 | P0 | — | 15 min | 40 min |
| 4 | Prompt 4 — Streak 0 zero-state encourageant | 28→30/04 | P0 | — | 15 min | 55 min |
| 5 | Prompt 5 — Skip link a11y | 28→30/04 | P0 | — | 10 min | 1h05 |
| 6 | Prompt 6 — Supprimer Stub mort | 30/04 NEW | P0 | — | 15 min | 1h20 |
| 7 | **Prompt 7 — Hex hardcodés Jarvis Lab → tokens** | 30/04 NEW | P1 | — | 35 min | 1h55 |
| 8 | Prompt 8 — Tokens dans auth.js | 28→30/04 | P1 | — | 25 min | 2h20 |
| 9 | Prompt 9 — Hero compact persistant | 28→30/04 | P1 | — | 30 min | 2h50 |
| 10 | Prompt 10 — Bannière stale | 28→30/04 | P1 | — | 35 min | 3h25 |
| 11 | Prompt 11 — Préchargement Babel + JSX | 28→30/04 | P2 | — | 20 min | 3h45 |
| 12 | Prompt 12 — Boot-mask anti-FOUC | 28→30/04 | P2 | Prompt 11 | 30 min | 4h15 |
| 13 | Prompt 13 — Lecture immersive (J1) | 28→30/04 | P2 | — | 75 min | 5h30 |
| 14 | Prompt 14 — Streak jokers (J6) | 30/04 NEW | P2 | Prompt 4 | 60 min | 6h30 |
| 15 | Prompt 15 — Resume tracker hebdo (J2) | 28→30/04 | P2 | weekly_analysis.py | 90 min | 8h00 |

**Total : ~8 heures** de travail Claude Code (vs 12h le 29/04 — l'écart vient des 2 prompts P-A et P-B livrés entre 29/04 et 30/04, plus une fusion plus serrée des findings).

**Stratégie recommandée 30/04** :

- **Sprint 1 (1h20)** : Prompts 1+2+3+4+5+6 → tue R15+ (pulses infinis), R16+ (Stub mort), R8 (FAB), R9 (streak zéro), a11y skip link. Ce sprint à lui seul fait passer la moyenne cockpit à ~3.95/5 et règle le finding #2 du Top 3 faiblesses.
- **Sprint 2 (1h05)** : Prompts 7+8 → règle R16+ partie 1 (Jarvis Lab le plus pollué) + R3 (auth overlay). Moyenne cockpit ~4.0/5.
- **Sprint 3 (1h05)** : Prompts 9+10 → règle R1 (hero compact) + R10 (stale). Moyenne ~4.1/5.
- **Sprint 4 (3h45)** : Prompts 11+12+13+14+15 → perf boot + features Jarvis. Le cockpit devient un assistant de rétention vraie.

**Ne pas tout faire d'un coup** : tester chaque sprint pendant 3-5 jours d'usage réel avant de passer au suivant. La télémétrie `usage_events` permet de valider que les frictions perçues correspondent à des deltas observables.

---

## Annexe — Limites de cet audit

- **Pas de mesure Lighthouse réelle** — chiffres FCP estimés. Avant Sprint 4, mesurer en réseau réel (fibre + 4G simulée) pour valider que Prompts 11+12 valent les 50 min d'effort.
- **Audit produit en simulation** — la routine est scheduled, donc tout vient de l'inspection code + heuristiques. À cross-checker avec `usage_events` (Supabase) pour valider les volumes de `top_card_collapsed`, `section_opened`, `error_shown`.
- **3 thèmes audités principalement en Dawn** — certaines remarques (boutons primary trop sombres, hero massif) sont moins valides en Obsidian/Atlas. R16+ reste valide partout (les hex hardcodés sont mauvais quel que soit le thème actif).
- **Pas de test mobile sur device** — l'audit Mobile a été fait sur le code (`styles-mobile.css` + `@media (max-width: 760px)`) mais pas sur hardware réel. Effort à prévoir avant de prioriser mobile P0/P1.
- **Backlog cumulé 28/04 + 29/04 + 30/04 = 15 prompts** (vs 19 hier). La capacité d'absorption Claude Code est de l'ordre de 4-5 prompts P0/jour ; le sprint 1 (1h20) est exécutable en une session, le reste demande 3-5 sessions étalées.
- **Le panel Jarvis Lab (2.9/5)** reste le maillon faible. Cet audit a creusé R15+ et R16+ qui le concernent au premier chef, mais l'auto-doc exposée (specs + architecture) demande un audit dédié — c'est un produit dans le produit.

**Recommandation forte** : avant de shipper Prompts 13-15 (features Jarvis), instrumenter et observer 7 jours de télémétrie `usage_events` post-Sprint 1 pour confirmer que les frictions identifiées sont bien des frictions vécues (taux de retour D+1 sur Brief, distribution des `section_opened` par utilisateur, fréquence du zero-state, ratio compact/full du nouveau hero).

---

*Fin du document. Audit produit autonomement par routine Cowork planifiée le 30/04/2026. Pour question ou amendement, ouvrir un Carnet d'idées dans le cockpit (`Ctrl+Shift+N` depuis n'importe où).*
