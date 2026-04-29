# Audit Design Complet — AI Cockpit

**Date** : 29 avril 2026
**Auditeur** : Claude (Opus 4.7) via routine Cowork planifiée
**URL prod** : https://ph3nixx.github.io/jarvis-cockpit/
**Audit précédent** : `audits/2026-04-28-design-audit.md`
**Stack réelle observée** : React 18 + `@babel/standalone` (CDN unpkg) + Supabase REST + Google OAuth + 21 stylesheets CSS + 21 fichiers `data-*.js` chargés synchrone + 24 `panel-*.jsx` (transpilés navigateur). **Pas vanilla**, pas single-file.

> ⚠️ **Mission décrit le cockpit comme « vanilla HTML/CSS/JS, single-file, gradient bleu→violet, glassmorphism »**. Aucune de ces hypothèses ne tient en 2026-04. Le cockpit tourne sur **3 thèmes éditoriaux (Dawn / Obsidian / Atlas)**, sans gradient ni glassmorphism, en React multi-fichiers. Les prompts en Phase 4 ciblent la stack actuelle (`cockpit/*.jsx`, `cockpit/styles*.css`, `cockpit/themes.js`, `cockpit/lib/*.js`).

> ℹ️ **Évolution depuis 28/04** : aucun commit poussé entre l'audit du 28 et celui d'aujourd'hui (dernier commit `75d4ced 2026-04-26`). Le backlog du 28/04 (15 prompts, 7h) reste **intégralement pending**. Cet audit ré-évalue à froid + introduit 3 findings critiques que l'audit du 28 n'avait pas surfacés (PWA drift, modales `window.prompt`, FAB stacking) et propose une nouvelle ordonnance des priorités.

---

## 1. Reconnaissance

### 1.1 Inventaire features (état réel — inchangé depuis 28/04)

| Zone | Composant | Localisation | Statut |
|---|---|---|---|
| **Shell** | Sidebar 6 groupes + rail mode + drawer mobile | `cockpit/sidebar.jsx`, `cockpit/nav.js` | ✅ Production |
| Shell | Theme switcher (Dawn / Obsidian / Atlas) + auto-pick par heure | `cockpit/sidebar.jsx`, `cockpit/themes.js` | ✅ Production |
| Shell | Streak veille + coût API + sparkline 7j (footer sidebar) | `cockpit/sidebar.jsx` | ✅ Production |
| Shell | Command palette (Ctrl+K) + 14 raccourcis + overlay aide (?) | `cockpit/command-palette.jsx`, `cockpit/app.jsx` | ✅ Production |
| Shell | Filtre global "Récent · 24h" (auto-on si visite < 18h) | `cockpit/app.jsx` | ✅ Production |
| Shell | Error boundary par panel + skeleton loader Tier 2 | `cockpit/app.jsx` | ✅ Production |
| Shell | PWA service worker, manifest | `sw.js`, `manifest.json` | 🔴 **Drift cache (voir §1.4)** |
| **Auth** | Overlay Google OAuth bloquant (couleurs Dawn hardcodées) | `cockpit/lib/auth.js` | ⚠️ Non thémable |
| **Aujourd'hui** | Brief du jour (hero macro + audio + delta + zero-state + Top 3 + signaux + radar + week) | `cockpit/home.jsx` | ✅ Production riche |
| Aujourd'hui | Toggle "Morning Card" vs "Brief complet" | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Hero delta "X nouveautés depuis Yh" (auto-trigger) | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Audio brief Web Speech API (estimation = body.length / 280) | `cockpit/home.jsx` | ⚠️ Heuristique fragile |
| Aujourd'hui | Bouton "Tout marqué lu" + undo 6s + télémétrie | `cockpit/home.jsx` | ✅ Production |
| Aujourd'hui | Miroir du soir (récap réflexif 19h), Revue, Top, Semaine, Recherche | 5 panels dédiés | ✅ Production |
| **Veille** | Veille IA, Veille outils (4 buckets), Sport, Gaming news, Anime, Actualités | `panel-veille.jsx` (mutualisé), `panel-veille-outils.jsx` | ✅ Production |
| **Apprentissage** | Radar 8 axes (SVG inline), Recos, Challenges, Wiki IA, Signaux faibles | 5 panels | ✅ Production |
| **Business** | Opportunités, Carnet d'idées (kanban + galerie), Jobs Radar | 3 panels | ✅ Production |
| **Personnel** | Jarvis chat (3 modes : Rapide/Deep/Cloud) + mémoire, Jarvis Lab, Profil, Forme, Musique, Gaming | 6 panels | ✅ Production |
| **Système** | Stacks & Limits, Historique | 2 panels | 🟠 **Stacks utilise `window.prompt` (voir §1.5)** |

**Total : 25 panels actifs** + 1 panel "Miroir du soir" récent. 0 stub visible en production.

### 1.2 Design system implicite (inchangé depuis 28/04)

`cockpit/themes.js` expose 3 thèmes complets, chacun avec ~40 tokens (palette + 8 espacements 4→64 + 9 tailles type 10→54px + radius + shadows). C'est un design system structuré, pas un patchwork. Mais des dérives persistent :

- **21 stylesheets séparées** avec query-strings de version manuels (`?v=23`, `?v=10`) — cache busting artisanal qui dérive vite.
- **`!important` envahissant en mobile** : **80 occurrences** dans `styles-mobile.css` (mesuré aujourd'hui via `grep -c`). Trahit des guerres de spécificité non résolues.
- **`auth.js` hardcode `#1F1815` / `#C2410C` / `#5E524A` / `#F5EFE4`** au lieu des tokens, car l'overlay s'affiche avant le mount React → casse en Obsidian/Atlas si l'utilisateur revient déconnecté. **Aucun changement depuis 28/04.**
- **22 `data-*.js` synchrones** + 21 CSS + Babel CDN qui transpile 24 JSX en série dans le navigateur. Aucun preload, aucun `defer`. **Aucun changement depuis 28/04.**

### 1.3 Test rétention (5e visite de la semaine, 22e du mois)

J'ai re-simulé un retour quotidien sur 30 jours — angle complémentaire à la matrice du 28/04. Frictions persistantes (numérotation = `R1` à `R10` de l'audit du 28/04 ; nouveau code `Rn+`) :

| # | Friction | Sévérité | Statut depuis 28/04 |
|---|---|---|---|
| R1 | Hero macro géant à chaque visite (`clamp(32px, 4.2vw, 54px)`, padding `44px 32px 40px`, body `--text-xl`) | 🔴 Élevée | Inchangé |
| R2 | Animations pulse à chaque montage (kicker-dot + sb-group-hotdot, `animation: pulse 2s ease 3`) | 🟠 Moyenne | Inchangé |
| R3 | Page header sticky + Hero non collapsible | 🟠 Moyenne | Inchangé |
| R4 | Boutons primary `--tx` (encre) sur fond crème — contraste violent en Dawn | 🟠 Moyenne | Inchangé |
| R5 | 22 `data-*.js` synchrones au boot + Babel transpilation 24 JSX en série | 🔴 Élevée | Inchangé |
| R6 | `dataVersion` reset cause rerender lourd à chaque hydration | 🟢 Faible | Inchangé |
| R7 | Audio brief estimation fragile (`body.length / 280`) | 🟢 Faible | Inchangé |
| R8 | `kbd-fab` `?` flottant bottom-right en permanence | 🟢 Faible | Inchangé |
| R9 | Streak "0 j" sans encouragement zero-state | 🟠 Moyenne | Inchangé |
| R10 | Aucun feedback "données fraîches / stale" | 🟠 Moyenne | Inchangé |
| **R11+** | **Service worker cache drift (voir §1.4)** | 🔴 **Élevée** | **Nouveau (audit 29/04)** |
| **R12+** | **Modales `window.prompt/confirm` natives dans Stacks** | 🟠 **Moyenne** | **Nouveau (audit 29/04)** |
| **R13+** | **2 FABs empilés bottom-right (`kbd-fab` + `recent-toggle`)** | 🟢 **Faible** | **Nouveau (audit 29/04)** |
| **R14+** | **`Stub` "panel à designer" mort dans `app.jsx`** (le composant existe encore, jamais atteint, mais persiste comme dette de message) | 🟢 **Faible** | **Nouveau (audit 29/04)** |

**Verdict rétention** : la signature éditoriale du Brief reste forte. Les frictions identifiées le 28/04 demeurent intactes (aucun commit n'a été poussé). **Trois nouvelles frictions surfacent à l'audit 29/04** détaillées ci-dessous.

### 1.4 🔴 NOUVEAU FINDING : Service Worker cache drift

`sw.js` (cache-first sur le shell) référence des fichiers avec des **query-strings de version périmés** ou **manque entièrement** des fichiers ajoutés depuis :

| Catégorie | Fichier | Version `index.html` | Version `sw.js` | Impact |
|---|---|---|---|---|
| **Manquants dans SW (12 fichiers)** | `panel-evening.jsx` | `?v=1` | absent | Panel Miroir du soir cassé hors-ligne |
| | `panel-review.jsx` | `?v=1` | absent | Panel Revue cassé hors-ligne |
| | `panel-jarvis-lab.jsx` | `?v=7` | absent | Jarvis Lab cassé hors-ligne |
| | `panel-veille-outils.jsx` | `?v=2` | absent | Veille outils cassé hors-ligne |
| | `panel-jobs-radar.jsx` | `?v=3` | absent | Jobs Radar cassé hors-ligne |
| | `data-claude.js`, `data-jobs.js` | `?v=1`, `?v=1` | absents | Schémas fake fallback indispo |
| | `styles-evening.css`, `styles-jarvis-lab.css`, `styles-jobs-radar.css`, `styles-mobile.css`, `styles-veille-outils.css` | actuels | absents | Mobile non stylé hors-ligne |
| **Stales (versions périmées dans SW)** | `styles.css` | `?v=23` | `?v=22` | Styles obsolètes servis depuis cache |
| | `app.jsx` | `?v=30` | `?v=23` | Routing partial (panels neufs absents) |
| | `data-loader.js` | `?v=35` | `?v=15` | Loader logique périmée |
| | `panel-recos.jsx` | `?v=4` | `?v=2` | UI recos périmée |
| | `panel-veille.jsx` | `?v=10` | `?v=7` | Panel veille périmé |
| | `panel-radar.jsx` | `?v=5` | `?v=4` | Radar SVG périmé |
| | `panel-challenges.jsx` | `?v=5` | `?v=3` | Challenges périmés |
| | `panel-wiki.jsx` | `?v=4` | `?v=2` | Wiki tooltip absent |
| | `panel-opportunities.jsx` | `?v=4` | `?v=3` | Opps périmé |
| | `panel-ideas.jsx` | `?v=4` | `?v=2` | Idées kanban périmées |
| | `panel-gaming.jsx` | `?v=5` | `?v=1` | Gaming périmé |
| | `panel-history.jsx` | `?v=3` | `?v=3` | OK |

**Mécanisme** : la stratégie cache-first (`caches.match` puis `fetch` fallback réseau) sert le contenu local en priorité. Pour un utilisateur PWA installé sur mobile (manifest.json présent, `start_url: /`) qui revisite sans connexion, le cockpit affichera **l'ancienne version + erreurs `Failed to load <new file>`** sur les panels neufs.

**Sévérité** : 🔴 critique pour la rétention installée — un user mobile PWA peut littéralement se retrouver coincé sur la version d'il y a 2-3 semaines, sans le savoir.

### 1.5 🟠 NOUVEAU FINDING : Modales `window.prompt/confirm` chaînées dans Stacks

`cockpit/panel-stacks.jsx` utilise `window.prompt` et `window.confirm` natifs pour la saisie manuelle de plusieurs valeurs en cascade :

```js
// stEditClaudeBalance — 3 prompts natifs en chaîne
const balance = window.prompt("Solde Anthropic restant (USD) ?…", cur.usd);
const credit  = window.prompt("Crédit initial (USD)…", cur.credit_usd);
const expires = window.prompt("Date d'expiration (YYYY-MM-DD)…", cur.credit_expires);

// stEditGeminiRateLimit — 1 confirm + 3 prompts
const hit   = window.confirm("Rate limit Gemini atteint actuellement ?\n\nOK = oui (critical), Annuler = non");
const model = window.prompt("Modèle concerné (ex : Gemini 2.5 Flash Lite) :", cur.model_limited);
const peak  = window.prompt("Pic RPM observé (requêtes/min) :", cur.peak_rpm);
const limit = window.prompt("Limite officielle (RPM) :", cur.limit_rpm);
```

**Problèmes** :
1. **Hostile à l'UX** — chaque prompt bloque tout le thread, casse le flow visuel, ignore les tokens du thème (modale browser native blanche/grise même en Obsidian).
2. **Accessibilité** — les prompts natifs n'héritent pas du focus management de l'app, ne supportent pas la nav clavier custom, et n'apparaissent pas dans le shadow DOM des screen readers de la même manière que les modales custom.
3. **Format-libre dangereux** — `peak_rpm` parse `Number(peak)`, mais aucune validation : un user qui tape "11rpm" envoie `NaN` à Supabase. Le `cur.usd != null ? String(cur.usd) : ""` en valeur par défaut est défensif mais ne sauve pas les inputs invalides.
4. **Workflow cassé** — si l'utilisateur abandonne au prompt 2/3, l'opération est partiellement appliquée sans rollback (les Promise.all ne tournent qu'après les 3 prompts validés, mais la logique mentale "j'ai annulé donc rien n'est sauvegardé" n'est pas garantie).
5. **window.alert ligne 349** pour les erreurs — même reproche.

**Contraste vs reste du cockpit** : tous les autres formulaires (carnet d'idées, profil, jarvis composer) utilisent des inputs custom thémables avec validation inline. Stacks est l'exception qui détonne.

**Sévérité** : 🟠 moyenne. C'est le panel le moins fréquenté (système, peu d'écritures), mais c'est la dette UX la plus criante du cockpit.

### 1.6 🟢 NOUVEAU FINDING : 2 FABs empilés en bottom-right

Inspection de `cockpit/app.jsx:513-530` : à la racine de l'app, **deux** floating buttons sont positionnés bottom-right (via `cockpit/styles.css`) :

```jsx
<button className={`recent-toggle ${recentOnly ? "is-active" : ""}`}>…</button>
<button className="kbd-fab" onClick={() => setShortcutsOpen(true)}>?</button>
```

- `.recent-toggle` (filtre Récent · 24h) : `bottom: 18px; right: 18px;` (pillule, ~110×30px).
- `.kbd-fab` (overlay raccourcis) : `bottom: 16px; right: 70px;` (rond 36×36).

Sur **mobile (< 760px)** ces deux FABs partagent la zone du pouce-droit avec le hamburger drawer (top-left) et le composer Jarvis (sticky bottom dans le panel jarvis). À la 5e ouverture, l'œil cherche **où est passé le 'tout' du Brief** entre les deux pills.

Sur **laptop 13" (1280×800)**, les FABs ne dérangent pas, mais ils participent à un sentiment "interface cockpit aérospatial chargé" qui devient bruit quotidien.

**Sévérité** : 🟢 faible isolément, mais cumulé avec R8 (kbd-fab inchangé) et R3 (page header sticky), le quart bottom-right du viewport mobile commence à saturer.

---

## 2. Matrice d'évaluation

Notes /5. Critères : Clarté · Densité · Cohérence · Interactions · Mobile · Accessibilité · Rétention.

**Légende delta** : `↑` = amélioration depuis 28/04, `↓` = dégradation, `—` = inchangé (aucun commit). `·` = pas de comparable.

| Section | Clarté | Densité | Cohérence | Interactions | Mobile | A11y | Rétention | **Moy.** | **Δ vs 28/04** |
|---|---|---|---|---|---|---|---|---|---|
| **Shell — Sidebar + nav** | 4 | 3 | 4 | 5 | 4 | 4 | 4 | **4.0** | — |
| **Shell — Top bar / Page header** | 4 | 2 | 4 | 4 | 3 | 3 | 3 | **3.3** | — |
| **Shell — PWA / Service Worker** | 3 | n/a | 2 | 3 | 2 | n/a | **1** | **2.2** | **↓ (audit profond)** |
| **Auth overlay** | 4 | 5 | 2 | 3 | 4 | 3 | n/a | **3.5** | — |
| **Brief — Hero macro** | 5 | 2 | 5 | 4 | 4 | 4 | 2 | **3.7** | — |
| **Brief — Top 3 / Morning Card** | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4.4** | — |
| **Brief — Hero delta** | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **4.4** | — |
| **Brief — Audio brief** | 3 | 4 | 4 | 3 | 3 | 4 | 3 | **3.4** | — |
| **Brief — Signaux cards** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Brief — Radar SVG** | 4 | 3 | 5 | 3 | 4 | 3 | 3 | **3.6** | — |
| **Brief — Zero state** | 5 | 4 | 4 | 4 | 4 | 4 | 5 | **4.3** | — |
| **Top du jour / Revue** | 4 | 4 | 4 | 5 | 4 | 4 | 4 | **4.1** | — |
| **Miroir du soir** | 4 | 4 | 4 | 3 | 4 | 4 | 4 | **3.9** | · (non scoré 28/04) |
| **Veille IA / Outils** | 4 | 4 | 3 | 4 | 4 | 4 | 4 | **3.9** | — |
| **Wiki IA + Tooltip auto-link** | 4 | 4 | 4 | 4 | 3 | 3 | 4 | **3.7** | — |
| **Signaux faibles (panel dédié)** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Radar compétences (panel dédié)** | 4 | 3 | 5 | 3 | 4 | 3 | 3 | **3.6** | — |
| **Recos / Challenges** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Opportunités** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Carnet d'idées (kanban)** | 5 | 4 | 4 | 5 | 3 | 3 | 5 | **4.1** | — |
| **Jobs Radar** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** | — |
| **Jarvis chat** | 4 | 4 | 4 | 5 | 3 | 3 | 5 | **4.0** | — |
| **Jarvis Lab (specs + archi)** | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** | — |
| **Profil** | 4 | 4 | 4 | 4 | 4 | 3 | 3 | **3.7** | — |
| **Forme** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Musique** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Gaming** | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **4.0** | — |
| **Stacks & Limits** | 4 | 5 | **2** | **2** | **2** | **2** | 3 | **2.9** | **↓ (audit profond — `window.prompt`)** |
| **Historique** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** | — |
| **Recherche** | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **3.9** | — |
| **Performance perçue (boot)** | 3 | n/a | n/a | n/a | 2 | 3 | 1 | **2.3** | — |

**Moyenne cockpit : 3.78 / 5** (vs 3.85 le 28/04). La baisse vient de l'audit profond du Service Worker (2.2/5) et de Stacks après inspection des `window.prompt` (2.9/5 vs 4.0 le 28/04). Aucun code n'a régressé — l'œil a regardé plus en détail.

### 2.1 Top 3 forces (inchangées)

1. **Design system tri-thématique cohérent** — 3 directions visuelles complètes (Dawn, Obsidian, Atlas) qui partagent les mêmes tokens. Auto-switch par heure. Rare et bien exécuté.
2. **Mécaniques anti-friction sophistiquées** — hero delta, zero state, snooze, undo "tout marqué lu", filtre récent auto-on, command palette, raccourcis clavier. Le produit pense l'usage répété.
3. **Hiérarchie typographique éditoriale** — Fraunces italique + Inter + JetBrains Mono. Le hero a une vraie personnalité presse haut de gamme.

### 2.2 Top 3 faiblesses (ré-ordonnées 29/04)

1. **🔴 PWA cache drift** (NOUVEAU) — `sw.js` est désynchronisé : 12 fichiers absents du cache, 14+ versions stales. Pour un user mobile PWA installé, c'est une bombe à retardement : il peut se retrouver coincé hors-ligne sur une version périmée avec des panels brisés.
2. **🔴 Performance de boot** (déjà identifié 28/04, toujours non traité) — 22 `data-*.js` synchrones + 21 CSS + Babel CDN qui transpile 24 JSX en série. FCP estimé 3-5s sur fibre, 6-10s en mobile 4G.
3. **🟠 Hero macro surdimensionné pour usage quotidien** (déjà identifié 28/04, toujours non traité) — calibré pour un coup d'œil hebdo, pas pour 25 ouvertures/mois. Manque un mode "compact" persistant.

(L'auth overlay hardcodé reste une faiblesse, mais déclassée en #4 — moins critique que le cache drift PWA qui peut casser le cockpit mobile installé.)

---

## 3. Quick Wins & Roadmap Jarvis

### 3.1 Top 10 Quick Wins (ré-ordonnés 29/04)

Trié par ratio **Impact × (1 / Effort)** décroissant. Effort 1 = facile. **NEW** = nouveau quick win, **CARRY** = porté de l'audit 28/04.

| # | Titre | Impact | Effort | Sections | Ratio | Statut |
|---|---|---|---|---|---|---|
| **QW-A** | **Stratégie Service Worker cache : passer en network-first pour le shell** OU régénérer auto-`STATIC[]` à partir des balises `<script>`/`<link>` du HTML au build (script Node ou GitHub Action) | 5 | 2 | PWA / sw.js | 12.5 | **NEW 🔴** |
| QW1 | Compacter le hero après 1ère visite du jour (mode `is-compact` persistant via `localStorage.cockpit-hero-collapsed-${YYYY-MM-DD}`) | 5 | 1 | Brief | 25 | CARRY |
| **QW-B** | **Remplacer les 3 `window.prompt` chaînés de Stacks par une modale unique** (formulaire à 3 champs avec validation inline + tokens du thème) | 4 | 2 | Stacks | 10 | **NEW** |
| QW7 | Mode "rail by default" sur viewports < 1280px | 4 | 1 | Sidebar | 20 | CARRY |
| QW4 | Couper toutes les animations pulse à 1 seule itération (kicker-dot, sb-group-hotdot) | 4 | 1 | Brief / sidebar | 20 | CARRY |
| QW3 | Fixer l'auth overlay aux tokens du thème actif | 4 | 1 | Auth | 20 | CARRY |
| QW8 | Skip link "Aller au contenu" | 3 | 1 | A11y | 15 | CARRY |
| QW9 | Encourager le retour si streak === null | 3 | 1 | Sidebar | 15 | CARRY |
| QW10 | Hide kbd-fab après 7 jours d'usage | 3 | 1 | Shell | 15 | CARRY |
| **QW-C** | **Fusionner `recent-toggle` + `kbd-fab` en un seul cluster bottom-right** (pill avec icône horloge à gauche, séparateur, icône `?` à droite) ou déplacer `recent-toggle` dans le `.ph` du Brief uniquement | 3 | 2 | Shell / Brief | 7.5 | **NEW** |
| QW2 | Précharger Babel + JSX critiques en parallèle | 5 | 2 | Boot | 12.5 | CARRY |
| QW5 | Bannière "données fraîches / stale" si `daily_briefs.fetch_date < today - 12h` | 4 | 2 | Brief | 10 | CARRY |
| QW6 | Audio brief honnête (compteur live + auto-calibration `chars-per-sec`) | 3 | 2 | Brief | 7.5 | CARRY |

**Top 5 actionnables ce sprint (P0)** : QW-A · QW1 · QW7 · QW4 · QW-B. Détaillés en Phase 4.

### 3.2 Roadmap Jarvis — 15 features (composite Impact × Faisabilité)

Conservation du backlog 28/04 (J1→J15) avec **3 features remaniées 29/04** pour traiter les nouvelles frictions :

| # | Feature | Impact | Faisab. | Wow | **Composite** | Statut |
|---|---|---|---|---|---|---|
| J1 | Brief vocal quotidien streamé (Gemini TTS → Supabase Storage → audio inline) | 4 | 2 | 5 | **8** | CARRY |
| J2 | Reprise contextuelle "tu lisais X hier" | 5 | 4 | 5 | **20** | CARRY ⭐ |
| J3 | Inbox Zero ritual quotidien (cards swipables clavier `j`/`k`/`a`/`s`) | 5 | 3 | 5 | **15** | CARRY |
| J4 | Jarvis sidebar permanente "Demande à Jarvis" (Ctrl+J + contexte panel) | 5 | 4 | 5 | **20** | CARRY ⭐ |
| J5 | Recap audio hebdo "ton dimanche soir" | 5 | 3 | 5 | **15** | CARRY |
| J6 | Comparateur "ton cockpit vs il y a 30 jours" | 5 | 3 | 4 | **15** | CARRY |
| J7 | Quick capture vocal global (Ctrl+Shift+V → Whisper local → classification Jarvis) | 5 | 2 | 5 | **10** | CARRY |
| J8 | Mode focus "1 seul article" (lecture plein écran épuré) | 4 | 4 | 4 | **16** | CARRY |
| J9 | Widget "rétention santé" (microcopy doux après absence) | 3 | 5 | 4 | **15** | CARRY |
| J10 | Smart-collapse panels rarement visités | 4 | 4 | 3 | **16** | CARRY |
| J11 | Dashboard rituel matinal "5 minutes" (page `/morning` mobile-first) | 5 | 3 | 5 | **15** | CARRY |
| J12 | Intégration Notion / Obsidian export | 4 | 4 | 3 | **16** | CARRY |
| J13 | Anti-doomscroll : limite quotidienne paramétrable | 4 | 4 | 4 | **16** | CARRY |
| **J14′** | **Service Worker auto-régénéré + bump du build hash dans `index.html` à chaque commit** (au lieu du theme-switch-by-content de l'audit 28/04) | 5 | 4 | 3 | **20** | **NEW 29/04** ⭐ |
| J15 | Streak resilience "carnet de bord" (1 joker/sem) | 4 | 5 | 4 | **20** | CARRY ⭐ |

**Top 5 par composite** : J2 (20), J4 (20), J14′ (20), J15 (20), J8 (16) → ces 5 deviennent prompts P2 en Phase 4. J14′ remplace J14 (theme-by-content) car la PWA drift est plus critique pour la rétention que le confort esthétique du theme contextuel.

### 3.3 Mockups textuels (3)

#### Mockup A — QW-B : Modale unique pour Stacks (vs `window.prompt` chaînés)

```
   ┌─ Modifier le solde Anthropic ──────────────────────────────────╮
   │                                                                 │
   │   Vu sur console.anthropic.com — copie tes valeurs ici :        │
   │                                                                 │
   │   Solde restant (USD) *                                         │
   │   ┌──────────────────────────────────┐                          │
   │   │  4.41                              │  $                     │
   │   └──────────────────────────────────┘                          │
   │   Format : nombre, ex 4.41                                      │
   │                                                                 │
   │   Crédit initial (USD)              Expiration (YYYY-MM-DD)     │
   │   ┌─────────────────┐               ┌─────────────────┐         │
   │   │  10.00           │               │  2026-12-31      │        │
   │   └─────────────────┘               └─────────────────┘         │
   │   Optionnel                          Optionnel                  │
   │                                                                 │
   │                          [ Annuler ]    [ Enregistrer →]       │
   │                                                                 │
   ╰─────────────────────────────────────────────────────────────────╯
```

Single modal, validation inline (regex sur le solde, date ISO sur expiration), tokens du thème, focus trap, Esc pour annuler, Ctrl+Entrée pour valider. Plus de stack de 3 prompts navigateur.

#### Mockup B — QW-A v2 : SW auto-régénéré (vue diff CI)

```
   GitHub Action — sw-sync
   ─────────────────────────────────────────────────
   ✓  index.html scanned : 24 jsx + 21 css + 22 js
   ✓  sw.js current STATIC[] : 38 entries
   ⚠  Drift detected :
      + panel-evening.jsx?v=1
      + panel-review.jsx?v=1
      + panel-jarvis-lab.jsx?v=7
      + panel-veille-outils.jsx?v=2
      + panel-jobs-radar.jsx?v=3
      + 7 stylesheets (evening, jarvis-lab, jobs-radar, mobile, …)
      ~ 14 entries with stale ?v=N

   ✓  Regenerated sw.js (CACHE bumped to "cockpit-v28")
   ✓  Committed back to PR : "chore(sw): auto-sync cache manifest"
```

Hook : à chaque PR qui touche `index.html`, `cockpit/**.jsx`, `cockpit/**.css`, ou `cockpit/data-*.js`, une GH Action lit le HTML, génère le `STATIC[]`, bump le `CACHE` const, et commit. Plus jamais de drift manuel.

#### Mockup C — J4 : "Demande à Jarvis sur ce panel" (rappel 28/04)

```
   ┌─ Panel Veille IA ──────────────────────────────────────────────┐
   │                                                                 │
   │  [contenu normal du panel]                                      │
   │                                                                 │
   │  ...                                                            │
   │                                                                 │
   │ ┌────────────────────────────────────────────────────────┐     │
   │ │ ⌘  Demande à Jarvis sur cette page (Ctrl+J)            │     │
   │ │ ─────────────────────────────────────────────────────── │     │
   │ │  > _                                                    │     │
   │ │  Suggestions : "Résume les 5 articles ouverts" ·        │     │
   │ │     "Pourquoi Mistral a baissé en signaux ?"            │     │
   │ └────────────────────────────────────────────────────────┘     │
   └─────────────────────────────────────────────────────────────────┘
```

Repris de l'audit 28/04 (mockup B) — toujours dans le top 5.

---

## 4. Prompts Claude Code

**Convention** : tous les prompts ciblent la stack actuelle (React 18 + Babel standalone, fichiers JSX dans `cockpit/`, CSS dans `cockpit/styles*.css`, tokens dans `cockpit/themes.js`). Pas de framework JS supplémentaire, pas de TypeScript, pas de build step côté front.

> ℹ️ **Continuité 28/04** : les Prompts 1 à 15 du backlog 28/04 restent valides et **non implémentés**. Cet audit ajoute **3 nouveaux prompts** (P-A, P-B, P-C) ciblant les findings 29/04 + **1 prompt P-J14′** qui remplace l'ancien J14. La numérotation de cet audit est indépendante de celle du 28/04 — la checklist en fin de document précise l'ordre fusionné.

---

### P0 — Quick wins immédiats (effort ≤ 30 min)

---

#### Prompt P-A — [UX/PWA] Synchroniser le Service Worker avec `index.html`
**Priorité** : P0 🔴
**Dépend de** : Aucun
**Fichiers concernés** : `sw.js`, `scripts/sync-sw.mjs` (nouveau), `.github/workflows/sw-sync.yml` (nouveau, optionnel)

```
Tu travailles sur le cockpit AI Cockpit (https://github.com/ph3nixx/jarvis-cockpit).
Stack : React 18 + Babel standalone, multi-fichiers, GitHub Pages, pas de build step côté front.

Problème : `sw.js` (cache-first sur le shell) référence des fichiers avec
des query-strings de version périmés (styles.css?v=22 alors que index.html
utilise ?v=23, app.jsx?v=23 vs ?v=30, data-loader.js?v=15 vs ?v=35) ET il
manque 12 fichiers ajoutés depuis (panel-evening.jsx, panel-review.jsx,
panel-jarvis-lab.jsx, panel-veille-outils.jsx, panel-jobs-radar.jsx,
data-claude.js, data-jobs.js, styles-evening.css, styles-jarvis-lab.css,
styles-jobs-radar.css, styles-mobile.css, styles-veille-outils.css).

Conséquence : un user mobile PWA installé peut se retrouver coincé
hors-ligne sur une version périmée avec des panels brisés.

Objectif : synchroniser automatiquement le `STATIC[]` de `sw.js` avec ce
qui est référencé dans `index.html`, et bumper la const `CACHE` à chaque
sync pour forcer l'invalidation côté client.

Solution choisie (la plus légère, pas de build) : un script Node.js
exécuté manuellement (`node scripts/sync-sw.mjs`) ou via une GitHub
Action sur PR.

Étapes :

1. Créer `scripts/sync-sw.mjs` avec ce contenu :

```js
// Auto-sync sw.js STATIC[] from index.html script/link tags.
// Run: node scripts/sync-sw.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SW_PATH = path.join(ROOT, "sw.js");
const SW = fs.readFileSync(SW_PATH, "utf8");

// Match: <link href="cockpit/styles*.css?v=N">, <script src="cockpit/*.js[x]?v=N">
const re = /(?:href|src)="(cockpit\/[^"]+|sw\.js|manifest\.json)"/g;
const found = new Set();
let m;
while ((m = re.exec(HTML))) found.add(m[1]);

// Always include the html shell + manifest
const STATIC = [
  "/",
  "/index.html",
  "/manifest.json",
  ...[...found].filter(p => !p.startsWith("manifest")).map(p => "/" + p),
].sort();

// Bump CACHE version
const cacheMatch = SW.match(/const CACHE = "cockpit-v(\d+)";/);
const newVersion = cacheMatch ? Number(cacheMatch[1]) + 1 : 1;

const newStatic = "const STATIC = [\n" +
  STATIC.map(p => `  ${JSON.stringify(p)},`).join("\n") + "\n];";

let next = SW.replace(/const CACHE = "cockpit-v\d+";/,
  `const CACHE = "cockpit-v${newVersion}";`);
next = next.replace(/const STATIC = \[[\s\S]*?\];/, newStatic);

fs.writeFileSync(SW_PATH, next, "utf8");
console.log(`[sync-sw] CACHE → cockpit-v${newVersion}, STATIC → ${STATIC.length} entries`);
```

2. Lancer le script une fois manuellement : `node scripts/sync-sw.mjs`.
   Vérifier que `sw.js` a bien :
   - `CACHE = "cockpit-v28"` (ou v29 selon où on en était)
   - `STATIC[]` contient les 12 fichiers manquants + les versions à jour.

3. (Optionnel mais recommandé) Créer `.github/workflows/sw-sync.yml` :

```yaml
name: sw-sync
on:
  pull_request:
    paths:
      - "index.html"
      - "cockpit/**"
permissions:
  contents: write
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ github.head_ref }} }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Sync sw.js
        run: node scripts/sync-sw.mjs
      - name: Commit if changed
        run: |
          if [[ -n "$(git status --porcelain sw.js)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add sw.js
            git commit -m "chore(sw): auto-sync cache manifest"
            git push
          fi
```

4. Documenter dans `CLAUDE.md` (section Conventions) :
   "Ne jamais éditer le STATIC[] de sw.js à la main. Lancer
   `node scripts/sync-sw.mjs` ou laisser la GH Action sw-sync s'en
   occuper."

Validation :
- `node scripts/sync-sw.mjs` génère un `sw.js` qui contient les 12
  fichiers absents. Diff visible : +12 entries, ~14 versions bumpées,
  CACHE bumpé d'1 unité.
- Recharger le cockpit, ouvrir DevTools → Application → Service Worker :
  voir le SW reset, le cache `cockpit-v28` (nouveau) populé avec les
  bons fichiers.
- Couper le réseau (DevTools → Network → Offline), recharger : le
  cockpit reste fonctionnel, panels Miroir du soir / Jarvis Lab /
  Veille outils / Jobs Radar / Revue accessibles.
```

**Validation utilisateur** : "J'installe le cockpit en PWA sur mobile, je coupe la 4G, j'ouvre les 25 panels — tous chargent sans erreur. Avant ce fix, 5 d'entre eux affichaient des erreurs `Failed to fetch`."

---

#### Prompt P-B — [UX] Remplacer les `window.prompt` chaînés de Stacks par une modale unique
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/panel-stacks.jsx`, `cockpit/styles-stacks.css`

```
Le panel Stacks (`cockpit/panel-stacks.jsx`) utilise `window.prompt` natif
3 fois en chaîne (lignes 134-145 pour Claude balance, lignes 171-185 pour
Gemini rate limit) + `window.alert` ligne 349. Hostile UX, pas thémable,
pas accessible, pas de validation, abandon mid-chain laisse l'état
incohérent.

Objectif : remplacer chaque chaîne par une modale unique avec inputs
groupés, validation inline, tokens du thème, focus trap, Esc pour
annuler, Ctrl+Entrée pour valider.

1. En haut de `panel-stacks.jsx`, créer un composant `StModal` réutilisable :

   function StModal({ title, subtitle, fields, onCancel, onSubmit, submitLabel = "Enregistrer" }) {
     const firstInputRef = React.useRef(null);
     const [values, setValues] = React.useState(() =>
       Object.fromEntries(fields.map(f => [f.key, f.initial ?? ""]))
     );
     const [errors, setErrors] = React.useState({});
     const [submitting, setSubmitting] = React.useState(false);

     React.useEffect(() => {
       firstInputRef.current?.focus();
       const onKey = (e) => {
         if (e.key === "Escape") { e.preventDefault(); onCancel(); }
         if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
           e.preventDefault(); handleSubmit();
         }
       };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, []);

     const validate = () => {
       const errs = {};
       for (const f of fields) {
         const v = String(values[f.key] || "").trim();
         if (f.required && !v) errs[f.key] = "Requis";
         else if (v && f.validate) {
           const r = f.validate(v);
           if (r) errs[f.key] = r;
         }
       }
       setErrors(errs);
       return Object.keys(errs).length === 0;
     };

     const handleSubmit = async () => {
       if (!validate()) return;
       setSubmitting(true);
       try {
         await onSubmit(values);
       } catch (e) {
         setErrors({ _form: String(e.message || e).slice(0, 120) });
         setSubmitting(false);
       }
     };

     return (
       <div className="st-modal-backdrop" onClick={onCancel}>
         <div className="st-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
           <div className="st-modal-head">
             <h2>{title}</h2>
             {subtitle && <p>{subtitle}</p>}
           </div>
           <div className="st-modal-body">
             {fields.map((f, i) => (
               <label key={f.key} className="st-modal-field">
                 <span>{f.label}{f.required && " *"}</span>
                 <input
                   ref={i === 0 ? firstInputRef : null}
                   type={f.type || "text"}
                   value={values[f.key] || ""}
                   onChange={(e) => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                   placeholder={f.placeholder}
                   inputMode={f.inputMode}
                 />
                 {f.hint && !errors[f.key] && <small>{f.hint}</small>}
                 {errors[f.key] && <small className="is-error">{errors[f.key]}</small>}
               </label>
             ))}
             {errors._form && <p className="st-modal-formerror">{errors._form}</p>}
           </div>
           <div className="st-modal-foot">
             <button className="btn btn--ghost" onClick={onCancel} disabled={submitting}>Annuler</button>
             <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
               {submitting ? "Enregistrement…" : submitLabel}
             </button>
           </div>
         </div>
       </div>
     );
   }

2. Dans `PanelStacks`, ajouter un state pour la modale active :

   const [modalState, setModalState] = React.useState(null);
   // shape: { kind: "claude-balance" | "gemini-rate-limit", initial: {...} }

3. Remplacer `stEditClaudeBalance` par une simple ouverture de modale :

   const openClaudeBalanceModal = () => {
     const cur = (window.STACKS_DATA?.services?.find(x => x.id === "claude")?.manual_balance) || {};
     setModalState({
       kind: "claude-balance",
       initial: {
         balance: cur.usd != null ? String(cur.usd) : "",
         credit: cur.credit_usd != null ? String(cur.credit_usd) : "",
         expires: cur.credit_expires || "",
       }
     });
   };

   const handleSubmitClaudeBalance = async (values) => {
     const today = new Date().toISOString().slice(0, 10);
     const updates = [
       stUpsertProfile("stacks.anthropic_balance_usd", String(Number(values.balance))),
       stUpsertProfile("stacks.anthropic_balance_updated_at", today),
     ];
     if (values.credit) updates.push(stUpsertProfile("stacks.anthropic_credit_usd", String(Number(values.credit))));
     if (values.expires) updates.push(stUpsertProfile("stacks.anthropic_credit_expires", values.expires.trim()));
     await Promise.all(updates);
     setModalState(null);
     // Refresh data
     if (window.cockpitDataLoader) {
       window.cockpitDataLoader.invalidateCache("user_profile");
       window.cockpitDataLoader.invalidateCache("stacks_");
       const fresh = await window.sb.query("user_profile", "order=key");
       if (window.__COCKPIT_RAW) window.__COCKPIT_RAW.profileRows = fresh;
       await window.cockpitDataLoader.loadPanel("stacks");
     }
   };

4. Dans le rendu de PanelStacks, ajouter à la fin du return :

   {modalState?.kind === "claude-balance" && (
     <StModal
       title="Modifier le solde Anthropic"
       subtitle="Vu sur console.anthropic.com — copie tes valeurs ici"
       fields={[
         {
           key: "balance", label: "Solde restant (USD)",
           required: true, initial: modalState.initial.balance,
           inputMode: "decimal", placeholder: "4.41",
           hint: "Format : nombre, ex 4.41",
           validate: (v) => isNaN(Number(v)) ? "Nombre invalide" : null,
         },
         {
           key: "credit", label: "Crédit initial (USD)",
           initial: modalState.initial.credit,
           inputMode: "decimal", placeholder: "10.00",
           hint: "Optionnel",
           validate: (v) => v && isNaN(Number(v)) ? "Nombre invalide" : null,
         },
         {
           key: "expires", label: "Expiration du crédit",
           initial: modalState.initial.expires,
           placeholder: "2026-12-31",
           hint: "Format YYYY-MM-DD, optionnel",
           validate: (v) => v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? "Format YYYY-MM-DD" : null,
         },
       ]}
       onCancel={() => setModalState(null)}
       onSubmit={handleSubmitClaudeBalance}
     />
   )}

5. Faire de même pour Gemini rate limit (modal "gemini-rate-limit") avec
   un toggle (checkbox stylé) au lieu du `window.confirm`.

6. Remplacer `window.alert("Erreur : " + …)` ligne 349 par un toast
   inline (réutiliser le système de toast existant si présent dans le
   cockpit, sinon un simple `<div className="st-toast st-toast--error">`).

7. Dans `cockpit/styles-stacks.css`, ajouter à la fin :

   .st-modal-backdrop {
     position: fixed; inset: 0; z-index: 9000;
     background: color-mix(in srgb, var(--tx) 40%, transparent);
     display: flex; align-items: center; justify-content: center;
     animation: stModalFade 120ms ease;
   }
   @keyframes stModalFade { from { opacity: 0; } to { opacity: 1; } }
   .st-modal {
     background: var(--bg2);
     border: 1px solid var(--bd);
     border-radius: var(--radius-lg);
     box-shadow: var(--shadow-lg);
     width: min(480px, calc(100vw - 32px));
     max-height: calc(100vh - 64px);
     display: flex; flex-direction: column;
     font-family: var(--font-body);
   }
   .st-modal-head { padding: var(--space-5) var(--space-5) var(--space-3); }
   .st-modal-head h2 {
     font-family: var(--font-display);
     font-size: var(--text-xl);
     font-weight: 500;
     color: var(--tx);
     margin: 0 0 6px;
   }
   .st-modal-head p {
     font-size: var(--text-sm);
     color: var(--tx2);
     margin: 0;
   }
   .st-modal-body {
     padding: var(--space-3) var(--space-5);
     overflow-y: auto;
   }
   .st-modal-field { display: block; margin-bottom: var(--space-3); }
   .st-modal-field > span {
     display: block;
     font-size: var(--text-xs);
     letter-spacing: 0.04em;
     text-transform: uppercase;
     color: var(--tx2);
     margin-bottom: 4px;
   }
   .st-modal-field input {
     width: 100%;
     padding: 8px 12px;
     background: var(--surface);
     color: var(--tx);
     border: 1px solid var(--bd);
     border-radius: var(--radius);
     font-family: inherit;
     font-size: var(--text-md);
   }
   .st-modal-field input:focus-visible {
     outline: 2px solid var(--brand);
     outline-offset: -1px;
     border-color: var(--brand);
   }
   .st-modal-field small {
     display: block;
     font-size: var(--text-2xs);
     color: var(--tx3);
     margin-top: 4px;
   }
   .st-modal-field small.is-error { color: var(--alert); }
   .st-modal-formerror {
     margin: var(--space-3) 0 0;
     padding: 8px 12px;
     background: var(--alert-tint);
     color: var(--alert);
     border-radius: var(--radius);
     font-size: var(--text-sm);
   }
   .st-modal-foot {
     padding: var(--space-3) var(--space-5) var(--space-5);
     display: flex; justify-content: flex-end; gap: var(--space-2);
   }

8. Câbler la nouvelle modale aux boutons existants ("Modifier le solde",
   "Mettre à jour le rate limit", etc.) — remplacer `onClick={() => stEditClaudeBalance(…)}`
   par `onClick={openClaudeBalanceModal}`.

Validation :
- Cliquer "Modifier le solde Anthropic" → modale apparaît avec 3 champs
  alignés, focus auto sur le premier, Esc ferme, Ctrl+Entrée valide.
- Saisir "abc" dans solde → erreur "Nombre invalide" inline, bouton
  Enregistrer reste actif mais click bloque.
- Saisir "4.41", crédit "10", expires "2026-13-99" → erreur "Format
  YYYY-MM-DD" sur expires.
- Saisir tout valide, valider → loader sur le bouton, modale ferme,
  données du panel se rafraîchissent.
- Tester en thèmes Dawn / Obsidian / Atlas → modale prend les couleurs
  du thème actif (vs `window.prompt` qui restait gris/blanc browser).
```

**Validation utilisateur** : "Quand je modifie mon solde Claude, j'ai une vraie modale du cockpit. Plus jamais ces 3 prompts navigateur agaçants en cascade."

---

#### Prompt P-C — [UX] Cluster bottom-right : fusionner `recent-toggle` et `kbd-fab`
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`

```
Aujourd'hui le cockpit a 2 FABs en bottom-right : `.recent-toggle`
(filtre 24h, pillule) et `.kbd-fab` (overlay raccourcis, rond). Sur
mobile ils saturent la zone du pouce, sur laptop ils participent au
"bruit cockpit aérospatial". Les fusionner en un cluster unique horizontal.

1. Dans `cockpit/app.jsx`, retravailler la fin du `return` de App :

Remplacer :

  <button
    className={`recent-toggle ${recentOnly ? "is-active" : ""}`}
    onClick={() => { setRecentOnly(v => !v); … }}
    …
  >
    <Icon name="clock" size={12} stroke={1.75} />
    {recentOnly ? "Récent · 24h" : "Tout"}
  </button>
  <button
    className="kbd-fab"
    onClick={() => setShortcutsOpen(true)}
    …
  >?</button>

par :

  <div className="bottom-cluster" role="toolbar" aria-label="Outils du cockpit">
    <button
      className={`bc-pill bc-pill--filter ${recentOnly ? "is-active" : ""}`}
      onClick={() => {
        setRecentOnly(v => !v);
        try { localStorage.setItem("cockpit-recent-explicit", String(Date.now())); } catch {}
      }}
      title={recentOnly ? "Voir tout" : "Voir seulement ce qui a changé depuis hier"}
      aria-pressed={recentOnly}
    >
      <Icon name="clock" size={12} stroke={1.75} />
      <span className="bc-pill-label">{recentOnly ? "Récent · 24h" : "Tout"}</span>
    </button>
    <span className="bc-divider" aria-hidden="true" />
    <button
      className="bc-pill bc-pill--help"
      onClick={() => setShortcutsOpen(true)}
      title="Raccourcis clavier (?)"
      aria-label="Afficher les raccourcis clavier"
    >?</button>
  </div>

2. Dans `cockpit/styles.css`, retirer (ou mettre en commentaire) les
   blocs `.recent-toggle` et `.kbd-fab` existants. Ajouter :

   .bottom-cluster {
     position: fixed;
     bottom: 16px; right: 16px;
     z-index: 50;
     display: inline-flex; align-items: stretch;
     background: var(--bg2);
     border: 1px solid var(--bd);
     border-radius: 999px;
     box-shadow: var(--shadow-md);
     overflow: hidden;
     font-family: var(--font-body);
   }
   .bc-pill {
     display: inline-flex; align-items: center; gap: 6px;
     padding: 6px 14px;
     min-height: 32px;
     background: transparent;
     color: var(--tx2);
     border: none;
     font-size: var(--text-sm);
     font-weight: 500;
     cursor: pointer;
     transition: background 100ms, color 100ms;
   }
   .bc-pill:hover, .bc-pill:focus-visible {
     background: var(--bg3);
     color: var(--tx);
     outline: none;
   }
   .bc-pill.is-active {
     background: var(--brand-tint);
     color: var(--brand-ink);
   }
   .bc-pill--help {
     padding: 6px 12px;
     font-family: var(--font-mono);
     font-size: var(--text-md);
     min-width: 32px; justify-content: center;
   }
   .bc-divider {
     width: 1px;
     background: var(--bd);
     margin: 6px 0;
   }
   /* Touch targets en mobile */
   @media (max-width: 760px) {
     .bottom-cluster { bottom: 14px; right: 14px; }
     .bc-pill { min-height: 36px; }
     .bc-pill--help { min-width: 36px; }
     .bc-pill-label { display: none; } /* icône clock seule sur mobile */
   }

3. Préserver la condition d'auto-hide après 7 jours (Prompt 7 de l'audit
   28/04, à appliquer en parallèle si pas encore fait) sur la moitié
   `.bc-pill--help` uniquement — pas sur le filtre Récent.

Validation :
- Bottom-right contient maintenant un seul cluster pillule arrondi avec
  filtre récent à gauche, séparateur 1px, bouton ? à droite.
- Cliquer le filtre récent → toggle visible (background brand-tint).
- Cliquer ? → overlay raccourcis s'ouvre.
- Sur mobile (< 760px), le label "Récent · 24h" disparaît, on voit juste
  l'icône horloge + ? — le cluster reste compact, ne mange pas la zone du
  pouce-droit.
- Test thèmes : Dawn (rouille), Obsidian (cyan), Atlas (indigo) — le
  background, les couleurs hover et l'état actif s'adaptent via tokens.
```

**Validation utilisateur** : "Le quart bottom-right de mon écran ne déborde plus de petits boutons. J'ai un seul cluster propre, le filtre et l'aide cohabitent."

---

#### Prompt 1 (CARRY 28/04) — [UX] Compacter le hero après 1ère visite du jour
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 1, lignes 263-353.
Toujours valide, non implémenté. Effort estimé 25 min.]

Synthèse exécutable :
1. Dans Home, ajouter `heroCompact` state + persistance dans
   `localStorage.cockpit-hero-collapsed-${todayKey}`.
2. Bouton "Replier / Déplier" dans `.ph-right` du Brief.
3. CSS `.hero.is-compact` : padding 16px 32px 14px, hero-title
   clamp(20px,2.4vw,28px), hero-body display:none.
4. Reset auto à minuit (la clé localStorage change avec le todayKey).
```

**Validation utilisateur** : "Je clique 'Replier' à 9h, recharge à 14h, hero reste compact. Demain matin à 7h, hero plein de nouveau."

---

#### Prompt 2 (CARRY 28/04) — [UX] Couper les animations pulse répétées
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 2, lignes 357-393.
Toujours valide, non implémenté. Effort estimé 5 min.]

Synthèse exécutable :
- `.kicker-dot { animation: pulse 2s ease 3 }` → remplacer `3` par `1`.
- `.sb-group-hotdot { animation: sbHotPulse 2s ease 3 }` → remplacer `3` par `1`.
- Ajouter `animation-fill-mode: forwards;` aux deux.
- Garder le bloc `@media (prefers-reduced-motion: reduce)` intact.
```

**Validation utilisateur** : "5 panels d'affilée → aucune animation parasite après 1er chargement."

---

#### Prompt 3 (CARRY 28/04) — [UX] Auth overlay aux tokens du thème actif
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/lib/auth.js`, `index.html`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 3, lignes 396-463.
Toujours valide, non implémenté. Effort estimé 20 min.]

Synthèse exécutable :
1. Dans index.html, charger themes.js AVANT auth.js (réordonner).
2. En tête de auth.js, fonction IIFE qui lit
   `localStorage.cockpit-theme` (fallback Obsidian 22h-6h, sinon Dawn),
   applique les vars du thème sur document.documentElement.
3. Dans `makeOverlay()`, remplacer toutes les couleurs hardcodées
   (#1F1815, #C2410C, #5E524A, #F5EFE4, #EDE5D6, #9A8D82) par
   `var(--bg)`, `var(--brand)`, `var(--tx)`, `var(--tx2)`, `var(--bg2)`,
   `var(--tx3)` respectivement.
```

**Validation utilisateur** : "Je passe en Obsidian, log out, l'overlay est dark cohérent. Pareil en Atlas."

---

#### Prompt 4 (CARRY 28/04) — [UX] Mode rail par défaut sur < 1280px
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 4, lignes 467-507.
Toujours valide, non implémenté. Effort estimé 10 min.]

Synthèse exécutable :
- Modifier l'init de `useSbLocalState(SB_COLLAPSED_KEY, …)` :
  défaut = (localStorage stored si présent) sinon (window.innerWidth < 1280).
- Sur > 1280px : sidebar pleine. Sur < 1280px sans préférence : rail.
- Si user a une préférence explicite, elle gagne toujours.
```

**Validation utilisateur** : "Sur laptop 13'', sidebar arrive en rail. J'ouvre, ça reste ouvert."

---

#### Prompt 5 (CARRY 28/04) — [A11y] Skip link "Aller au contenu"
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 5, lignes 511-562.
Toujours valide, non implémenté. Effort estimé 10 min.]

Synthèse exécutable :
- Ajouter `<a className="skip-link" href="#main-content">Aller au contenu</a>`
  comme premier enfant du `<div className="app">` dans App.
- Ajouter `id="main-content"` sur `<main className="main">`.
- CSS `.skip-link` masqué via translateY(-100%), visible au :focus.
```

**Validation utilisateur** : "Je presse Tab au chargement, je vois 'Aller au contenu', Entrée saute la sidebar."

---

#### Prompt 6 (CARRY 28/04) — [UX] Streak null encourageant
**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 6, lignes 566-619.
Toujours valide, non implémenté. Effort estimé 10 min.]

Synthèse exécutable :
- Quand `streak === null` ou `streak === 0`, afficher "Bienvenue · 1er
  jour · prochain 06:00" en `--positive` au lieu du flame neutre.
- Icône `leaf` ou `sparkle` (pas `flame` rouge).
```

**Validation utilisateur** : "Compte vide, footer m'invite à revenir. Pas de '0j' clinique."

---

#### Prompt 7 (CARRY 28/04) — [UX] Hide kbd-fab après 7 jours
**Priorité** : P0
**Dépend de** : Prompt P-C (si implémenté, kbd-fab est devenu `.bc-pill--help` dans le cluster)
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 7, lignes 623-662.
Adapté au refactor du Prompt P-C : si P-C est appliqué, hider la moitié
`.bc-pill--help` du cluster (pas le filtre récent).]

Synthèse exécutable :
- En tête de App : `isVeteran` mémo qui set `cockpit-first-visit-ts` au
  1er load et retourne true après 7j.
- Dans le cluster bottom-right (P-C) ou la kbd-fab seule (sans P-C) :
  conditionnel `{!isVeteran && <button className="bc-pill bc-pill--help">…</button>}`.
- Le raccourci `?` continue de marcher.
```

**Validation utilisateur** : "8 jours d'usage, plus de pastille `?` flottante. `?` continue d'ouvrir l'overlay."

---

### P1 — Améliorations UX significatives (effort 30 min - 2h)

---

#### Prompt 8 (CARRY 28/04) — [UX] Bannière "données fraîches / stale"
**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 8, lignes 669-754.
Toujours valide, non implémenté. Effort estimé 40 min.]

Synthèse : si `data.macro.fetch_iso` (ou `data.date.iso`) date de + 12h,
bannière `--alert-tint` au-dessus du Hero avec lien vers GitHub Actions.
```

**Validation utilisateur** : "Pipeline planté la nuit, je sais immédiatement que mon brief est de la veille."

---

#### Prompt 9 (CARRY 28/04) — [UX] Audio brief honnête
**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/home.jsx`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 9, lignes 758-830.
Toujours valide, non implémenté. Effort estimé 35 min.]

Synthèse : compteur live `0:42 / ~3 min` pendant lecture, auto-calibration
`localStorage.audio-brief-chars-per-sec` après chaque écoute.
```

**Validation utilisateur** : "Compteur live + estimation calibrée après 2-3 lectures."

---

#### Prompt 10 (CARRY 28/04) — [Perf] Précharger Babel + JSX critiques
**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `index.html`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 10, lignes 834-885.
Toujours valide, non implémenté. Effort estimé 20 min.]

Synthèse : `<link rel="preload">` parallèles sur React, ReactDOM, Babel,
Supabase + JSX critiques (icons, sidebar, home, app, data-loader).
`defer` sur tous les data-*.js Tier 2 lazy.
```

**Validation utilisateur** : "Lighthouse FCP : -500ms à -1500ms vs avant."

---

#### Prompt P-D (NEW 29/04) — [Perf] Inliner un loader CSS minimal pour éviter le FOUC
**Priorité** : P1
**Dépend de** : Aucun (synergie avec Prompt 10)
**Fichiers concernés** : `index.html`

```
Symptôme observé : pendant que les 21 stylesheets chargent en parallèle,
l'utilisateur voit brièvement le HTML brut (~200-400ms FCP, encore pire
en 4G). Pas critique mais grève la perception de qualité d'un produit
qui se présente "presse haut de gamme".

Objectif : inliner dans `<head>` un loader visuel minimal (logo +
fond Dawn par défaut + spinner discret) qui couvre le FOUC le temps
que React monte. Ce loader est masqué par CSS dès que `#root` a un
enfant.

1. Dans `index.html`, juste avant la première stylesheet `<link>`,
   ajouter un `<style>` inline :

   <style>
     :root {
       --bg-boot: #F5EFE4;
       --tx-boot: #1F1815;
       --brand-boot: #C2410C;
     }
     html, body { background: var(--bg-boot); margin: 0; min-height: 100vh; }
     #boot-mask {
       position: fixed; inset: 0; z-index: 10000;
       display: flex; flex-direction: column;
       align-items: center; justify-content: center;
       background: var(--bg-boot);
       transition: opacity 200ms ease 60ms;
       pointer-events: none;
     }
     #boot-mask.is-hidden { opacity: 0; }
     .boot-logo {
       font-family: 'Fraunces', Times, serif;
       font-style: italic;
       font-size: 28px;
       color: var(--brand-boot);
       letter-spacing: -0.02em;
       margin-bottom: 8px;
     }
     .boot-tag {
       font-family: 'JetBrains Mono', monospace;
       font-size: 10px;
       color: var(--tx-boot);
       letter-spacing: 0.16em;
       text-transform: uppercase;
       opacity: 0.55;
     }
     .boot-spinner {
       width: 18px; height: 18px;
       margin-top: 24px;
       border: 1.5px solid rgba(31, 24, 21, 0.12);
       border-top-color: var(--brand-boot);
       border-radius: 50%;
       animation: bootSpin 700ms linear infinite;
     }
     @keyframes bootSpin { to { transform: rotate(360deg); } }
     /* Auto-hide once React mounted: any direct child in #root */
     #root:not(:empty) ~ #boot-mask { opacity: 0; pointer-events: none; }
     @media (prefers-color-scheme: dark) {
       :root {
         --bg-boot: #0B0D0F;
         --tx-boot: #E8E3D8;
         --brand-boot: #60E0D4;
       }
     }
   </style>

2. Juste après `<div id="root"></div>` dans `<body>`, ajouter :

   <div id="boot-mask" aria-hidden="true">
     <div class="boot-logo">jarvis</div>
     <div class="boot-tag">cockpit · ouverture</div>
     <div class="boot-spinner"></div>
   </div>

3. Dans `cockpit/lib/bootstrap.js`, après `window.__cockpitMount();`,
   masquer le boot-mask :

   queueMicrotask(() => {
     const mask = document.getElementById("boot-mask");
     if (mask) {
       mask.classList.add("is-hidden");
       setTimeout(() => mask.remove(), 250);
     }
   });

Validation :
- Hard reload sur fibre : entre le clic et le mount, l'utilisateur voit
  un fond crème + "jarvis" italique + spinner. Pas de flash blanc, pas
  de HTML brut.
- Couper la connexion mid-load : le boot-mask reste visible jusqu'à ce
  que la connexion revienne, l'utilisateur n'est pas projeté dans une
  page partiellement rendue.
- En mode prefers-color-scheme: dark, le mask s'affiche en charbon avec
  accent cyan (cohérent Obsidian).
- Throttle 4G dans DevTools → le mask compense les ~3-5s de boot avec
  un visuel digne du reste du cockpit.
```

**Validation utilisateur** : "Au reload, plus jamais de flash blanc. Le cockpit a un visuel d'ouverture cohérent avec son ton."

---

### P2 — Polish & features Jarvis avancées

---

#### Prompt P-E (NEW 29/04, remplace J14) — [JARVIS] Service Worker auto-régénéré + bump auto à chaque commit
**Priorité** : P2
**Dépend de** : Prompt P-A (le sw-sync script doit déjà exister)
**Fichiers concernés** : `.github/workflows/sw-sync.yml`, `scripts/sync-sw.mjs` (déjà créé par P-A), `package.json` (optionnel)

```
[Composite : Impact 5 × Faisabilité 4 = 20.]

Suite de Prompt P-A. Le script sync-sw.mjs existe et fonctionne en
manuel. Cette tâche P2 le rend automatique :

1. Le workflow `.github/workflows/sw-sync.yml` (créé optionnellement
   dans P-A) tourne sur chaque PR qui touche `index.html`, `cockpit/**`,
   ou `sw.js` lui-même.

2. Étendre la GH Action pour :
   - Détecter si un commit dans la PR a bumpé une version `?v=N` dans
     index.html : si oui, sw.js doit refléter ces nouvelles versions.
   - Détecter l'ajout d'un nouveau fichier dans `cockpit/` qui apparaît
     dans index.html mais pas dans sw.js : auto-ajouter au STATIC[].
   - Bumper `CACHE = "cockpit-vN+1"` à chaque diff.
   - Commiter avec message standard : `chore(sw): auto-sync cache
     manifest (vN → vN+1)`.

3. Ajouter une vérif locale en pre-commit hook (optionnel, via
   `.husky/pre-commit` si tu utilises husky, sinon en commande npm) :

   "scripts": {
     "sw:check": "node scripts/sync-sw.mjs --check",
     "sw:sync": "node scripts/sync-sw.mjs"
   }

   Le mode `--check` lit, calcule le diff attendu, si différence > 0
   exit code 1 avec message "sw.js drift detected, run npm run sw:sync".

4. Documenter dans CLAUDE.md (section Conventions) :
   "Service Worker : ne jamais éditer sw.js à la main. Le STATIC[] est
   généré par scripts/sync-sw.mjs et la GH Action sw-sync s'en occupe à
   chaque PR."

Validation :
- Bumper `index.html` `cockpit/styles.css?v=23` → `?v=24`, push une PR.
- La GH Action détecte le drift, commit `chore(sw): auto-sync cache
  manifest (v28 → v29)` automatiquement sur la branche.
- Localement, `npm run sw:check` exit 1 avec message clair si on a
  oublié de sync.
- Aucun risque manuel résiduel : 100% des commits qui touchent les
  assets cockpit synchronisent le SW.
```

**Validation utilisateur** : "Je n'ai plus à penser au cache PWA. Chaque commit qui ajoute un panel ou bump un asset déclenche un sync auto."

---

#### Prompt P-J2 (CARRY 28/04 ⭐ composite 20) — [JARVIS] Reprise contextuelle "tu lisais X hier" — Partie 1 + 2
**Priorité** : P2
**Dépend de** : Aucun (la Partie 2 dépend de la Partie 1)
**Fichiers concernés** : `cockpit/lib/resume-tracker.js` (nouveau), `cockpit/app.jsx`, `cockpit/home.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompts 11+12, lignes 893-1131.
Toujours valide, non implémenté. Effort estimé Partie 1+2 = 80 min.]

Synthèse :
- Nouveau fichier `cockpit/lib/resume-tracker.js` : capture des sessions
  incomplètes (heartbeat 5s, scroll ratio, last_seen) en localStorage
  `cockpit-resume-state` (max 20 entries, TTL 2 jours).
- `app.jsx` appelle `cockpitResume.start()` à chaque navigation.
- `home.jsx` affiche dans le hero (si last_seen > 30min) une carte
  "Reprends où tu en étais" avec titre + % restants + actions
  Reprendre/Plus tard.
```

**Validation utilisateur** : "J'ai zappé un wiki concept hier soir, ce matin le brief me propose de reprendre."

---

#### Prompt P-J4 (CARRY 28/04 ⭐ composite 20) — [JARVIS] Dock "Demande à Jarvis sur ce panel"
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/app.jsx`, `cockpit/styles.css`, `cockpit/panel-jarvis.jsx`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 13, lignes 1135-1336.
Toujours valide, non implémenté. Effort estimé 75 min.]

Synthèse :
- Composant `<AskJarvisDock>` sticky bottom-right (sauf sur panel jarvis)
  avec champ replié 52px, ouvert 320px à la saisie.
- Ctrl+J ouvre le focus.
- À la submission, navigation vers `jarvis` avec contexte préfilé
  `[Contexte panel actif : <activePanel>]\n<question>`.
- Suggestions dynamiques selon le panel actif.
```

**Validation utilisateur** : "Sur n'importe quel panel, Ctrl+J, ma question, ça file vers Jarvis avec le contexte."

---

#### Prompt P-J15 (CARRY 28/04 ⭐ composite 20) — [JARVIS] Streak resilience "carnet de bord" (jokers)
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
[Voir audits/2026-04-28-design-audit.md, Prompt 14, lignes 1340-1419.
Toujours valide, non implémenté. Effort estimé 30 min.]

Synthèse :
- 1 joker / semaine ISO en `localStorage.cockpit-streak-jokers`.
- Affichage "🔥 27 j · 🃏 1 joker" dans le footer sidebar.
- Logique de consommation V1 : si dernière visite > 30h et < 54h ET
  joker dispo, décrémenter + toast "Joker utilisé".
```

**Validation utilisateur** : "Footer me dit '27j · 1 joker'. Je peux louper un jour sans tout perdre."

---

#### Prompt P-J8 (CARRY 28/04 composite 16) — [JARVIS] Mode focus "1 seul article"
**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/panel-veille.jsx`, `cockpit/panel-top.jsx`, nouveau `cockpit/components-reader.jsx`, `cockpit/styles.css`

```
Composite : Impact 4 × Faisabilité 4 = 16.

Feature : quand l'utilisateur clique un Top 3 ou un article du flux veille,
ouvrir une vue plein écran épurée (texte centré max-width 70ch, font
Fraunces, 3 actions : Marquer lu / Snooze / Ask Jarvis), au lieu d'ouvrir
l'URL externe en target=_blank. L'URL externe reste accessible via un
bouton "Lire la source" mais l'expérience par défaut devient lecture
au sein du cockpit.

V1 : opt-in via toggle "Lecture immersive" dans le profil. V2 :
par défaut une fois validé.

1. Créer `cockpit/components-reader.jsx` :

   function ReaderModal({ article, onClose, onMarkRead, onSnooze, onAskJarvis }) {
     React.useEffect(() => {
       const onKey = (e) => {
         if (e.key === "Escape") onClose();
         if (e.key === "j") onMarkRead();
         if (e.key === "s") onSnooze();
       };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, [article]);

     const safe = window.DOMPurify
       ? window.DOMPurify.sanitize(article.summary || article.body || "", {
           ALLOWED_TAGS: ["p", "strong", "em", "br", "a", "h2", "h3", "ul", "ol", "li", "blockquote"],
           ALLOWED_ATTR: ["href"],
         })
       : (article.summary || "");

     return (
       <div className="reader-overlay" onClick={onClose}>
         <article className="reader" onClick={(e) => e.stopPropagation()}>
           <header className="reader-head">
             <span className="reader-source">{article.source}</span>
             <button className="reader-close" onClick={onClose} aria-label="Fermer">×</button>
           </header>
           <h1 className="reader-title">{article.title}</h1>
           <div className="reader-meta">
             {article.fetch_iso && <time>{new Date(article.fetch_iso).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</time>}
             {article.reading_time && <span>{article.reading_time}</span>}
           </div>
           <div className="reader-body" dangerouslySetInnerHTML={{ __html: safe }} />
           <footer className="reader-foot">
             <button className="btn btn--primary" onClick={onMarkRead}>
               Marquer lu (J)
             </button>
             <button className="btn btn--ghost" onClick={onSnooze}>
               Snooze 3 jours (S)
             </button>
             <button className="btn btn--ghost" onClick={onAskJarvis}>
               Demander à Jarvis
             </button>
             {article.url && (
               <a className="btn btn--ghost" href={article.url} target="_blank" rel="noopener">
                 Lire la source ↗
               </a>
             )}
           </footer>
         </article>
       </div>
     );
   }
   window.ReaderModal = ReaderModal;

2. Charger ce fichier dans `index.html` (avec `type="text/babel"`) :

   <script type="text/babel" src="cockpit/components-reader.jsx?v=1"></script>

3. CSS dans `cockpit/styles.css` :

   .reader-overlay {
     position: fixed; inset: 0; z-index: 8000;
     background: color-mix(in srgb, var(--bg) 92%, transparent);
     overflow-y: auto;
     padding: 32px 16px;
   }
   .reader {
     max-width: 70ch;
     margin: 0 auto;
     background: var(--bg2);
     border: 1px solid var(--bd);
     border-radius: var(--radius-lg);
     padding: var(--space-7) var(--space-6);
     font-family: var(--font-body);
     line-height: 1.65;
   }
   .reader-head {
     display: flex; justify-content: space-between; align-items: center;
     margin-bottom: 24px;
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     letter-spacing: 0.14em;
     text-transform: uppercase;
     color: var(--tx3);
   }
   .reader-close {
     background: transparent; border: none;
     font-size: 24px; line-height: 1;
     color: var(--tx2); cursor: pointer;
     padding: 0 8px;
   }
   .reader-close:hover { color: var(--tx); }
   .reader-title {
     font-family: var(--font-display);
     font-size: clamp(28px, 3.5vw, 42px);
     font-weight: 500;
     line-height: 1.15;
     letter-spacing: -0.02em;
     color: var(--tx);
     margin: 0 0 var(--space-3);
     text-wrap: balance;
   }
   .reader-meta {
     display: flex; gap: 12px;
     font-size: var(--text-sm);
     color: var(--tx3);
     margin-bottom: var(--space-6);
   }
   .reader-body {
     font-size: var(--text-lg);
     color: var(--tx);
   }
   .reader-body p { margin: 0 0 1.2em; }
   .reader-body a { color: var(--brand); text-decoration: underline; }
   .reader-foot {
     display: flex; gap: var(--space-2); flex-wrap: wrap;
     padding-top: var(--space-5);
     margin-top: var(--space-6);
     border-top: 1px solid var(--bd);
   }
   @media (max-width: 760px) {
     .reader { padding: var(--space-5) var(--space-4); }
     .reader-foot { gap: 6px; }
   }

4. Dans `panel-veille.jsx` (et `panel-top.jsx`), wrapper l'ouverture
   d'article : si `localStorage.cockpit-immersive-reader === "1"`,
   `setReaderOpen(article)` au lieu de `window.open(url)`.

5. Toggle dans Profil : `<label><input type="checkbox" /> Lecture immersive
   (Esc pour quitter, J marque lu, S snooze)</label>`.

Validation :
- Activer la lecture immersive dans le profil.
- Cliquer un Top 3 → modale plein écran avec titre Fraunces 42px,
  body 70ch, 4 boutons en bas.
- J → marque lu et ferme. S → snooze 3j et ferme. Esc → ferme sans
  action. Lien externe → ouvre l'article original dans un nouvel onglet.
- Désactiver → comportement legacy (open en target=_blank).
```

**Validation utilisateur** : "Mes Top 3 s'ouvrent dans un mode lecture épuré au sein du cockpit. Plus besoin d'aller chercher l'onglet pour revenir."

---

## Checklist d'exécution (ordonnée 29/04)

Ordre recommandé pour exécuter le backlog complet (audit 28/04 + nouvelles entrées 29/04). Les **NEW** sont prioritisés en P0 quand ils débloquent de la rétention installée (P-A) ou suppriment de la dette UX criante (P-B).

| # | Prompt | Source audit | Priorité | Dépend de | Effort | Cumul |
|---|---|---|---|---|---|---|
| 1 | **P-A — Sync sw.js avec index.html (script + GH Action)** | 29/04 NEW | **P0 🔴** | — | 25 min | 25 min |
| 2 | Prompt 4 — Mode rail < 1280px | 28/04 | P0 | — | 10 min | 35 min |
| 3 | Prompt 2 — Couper pulses répétés | 28/04 | P0 | — | 5 min | 40 min |
| 4 | Prompt 5 — Skip link a11y | 28/04 | P0 | — | 10 min | 50 min |
| 5 | Prompt 6 — Streak null encourageant | 28/04 | P0 | — | 10 min | 1h00 |
| 6 | **P-C — Cluster bottom-right (recent-toggle + kbd-fab)** | 29/04 NEW | P0 | — | 25 min | 1h25 |
| 7 | Prompt 7 — Hide kbd-fab après 7j | 28/04 | P0 | P-C | 10 min | 1h35 |
| 8 | Prompt 1 — Hero compact persistant | 28/04 | P0 | — | 25 min | 2h00 |
| 9 | Prompt 3 — Auth overlay tokens | 28/04 | P0 | — | 20 min | 2h20 |
| 10 | **P-B — Modale unique pour Stacks (vs window.prompt)** | 29/04 NEW | P0 | — | 90 min | 3h50 |
| 11 | Prompt 10 — Préchargement Babel + JSX | 28/04 | P1 | — | 20 min | 4h10 |
| 12 | **P-D — Boot mask anti-FOUC** | 29/04 NEW | P1 | Prompt 10 | 25 min | 4h35 |
| 13 | Prompt 9 — Audio brief honnête | 28/04 | P1 | — | 35 min | 5h10 |
| 14 | Prompt 8 — Bannière stale | 28/04 | P1 | — | 40 min | 5h50 |
| 15 | **P-E — SW auto-régénéré CI/CD complète** | 29/04 NEW | P2 | P-A | 50 min | 6h40 |
| 16 | P-J4 — Ask Jarvis dock | 28/04 | P2 | — | 75 min | 7h55 |
| 17 | P-J15 — Streak jokers | 28/04 | P2 | — | 30 min | 8h25 |
| 18 | P-J2 — Resume tracker (capture + UI) | 28/04 | P2 | — | 80 min | 9h45 |
| 19 | **P-J8 — Mode focus "1 seul article" (lecture immersive)** | 29/04 NEW | P2 | — | 70 min | 10h55 |
| (J10) | Smart-collapse panels rares | 28/04 | P2 | — | 50 min | 11h45 |

**Total : ~12 heures de travail Claude Code** pour l'ensemble du backlog fusionné (vs 7h le 28/04 — l'écart vient des 4 nouveaux prompts P-A, P-B, P-C, P-D, P-E + P-J8).

**Stratégie recommandée 29/04** :

- **Sprint 1 (1h35)** : P-A + Prompts 4, 2, 5, 6, P-C → tue la PWA drift critique + toutes les frictions UI < 30 min. Ce sprint à lui seul fait passer la moyenne cockpit à ~3.95/5.
- **Sprint 2 (2h45)** : Prompt 7, 1, 3, P-B → polish quotidien (hero compact, streak, auth) + élimine la dette `window.prompt`. Moyenne cockpit ~4.05/5.
- **Sprint 3 (1h45)** : Prompts 10, P-D, 9, 8 → perf + fiabilité (preload + boot-mask + audio + stale banner). FCP gagne 500-1500ms perçus.
- **Sprint 4 (5h+)** : P-E + features Jarvis (J4, J15, J2, J8) → transforme le cockpit en assistant de rétention vraie.

**Ne pas tout faire d'un coup** : tester chaque sprint pendant 3-5 jours d'usage réel avant de passer au suivant. Et **mesurer** entre chaque sprint via la télémétrie `usage_events` (la table existe, exploite-la pour valider que les frictions perçues correspondent à des deltas observables : durée moyenne sur Brief, taux de retour D+1, fréquence des `error_shown`).

---

## Annexe — Limites de cet audit

- **Pas de mesure Lighthouse réelle** — chiffres FCP estimés. Avant d'investir dans Prompts 10 + P-D, mesurer en réseau réel (fibre + 4G simulée).
- **Pas de session utilisateur réelle** — la routine est scheduled, donc tout vient de l'inspection code + heuristiques. À cross-checker avec `usage_events` (Supabase) pour valider que `top_card_collapsed` et `section_opened` brief court existent bien dans les volumes attendus.
- **3 thèmes audités principalement en Dawn** — certaines remarques (boutons primary trop sombres, hero massif) sont moins valides en Obsidian/Atlas où les palettes inversent les contrastes.
- **Pas de test mobile sur device** — le drift PWA est confirmé par lecture du SW + HTML mais l'expérience effective hors-ligne n'a pas été reproduite.
- **Audit 28/04 + 29/04 cumulés = 19 prompts** → backlog substantiel. La capacité d'absorption Claude Code est de l'ordre de 4-5 prompts P0/jour ; le sprint 1 (1h35) est exécutable en une session, le reste demande 3-5 sessions étalées.
- **Le panel Jarvis Lab (3.0/5)** reste le maillon faible. Cet audit ne l'a pas creusé profondément — un audit dédié à ce panel serait utile (l'auto-doc exposée à l'utilisateur est un produit dans le produit).

Recommandation : avant de shipper P-J2/P-J4/P-J8/P-J15, instrumenter et observer 7 jours de télémétrie `usage_events` pour confirmer que les frictions identifiées correspondent à de la friction réelle dans tes events (taux de retour D+1, distribution des `section_opened` par utilisateur, fréquence du zero-state).

---

*Fin du document. Audit produit autonomement par routine Cowork planifiée. Pour question ou amendement, ouvrir un Carnet d'idées dans le cockpit (`Ctrl+Shift+N` depuis n'importe où).*
