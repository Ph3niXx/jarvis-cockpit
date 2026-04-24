# Jarvis Lab

> Roadmap auto-affichée du projet Jarvis (6 phases, 15 features) + catalogue des 25 onglets du cockpit + **lecteur Markdown des specs détaillées** (`docs/specs/*.md`). Le panel agrège trois sources : `jarvis/spec.json` (roadmap + catalogue), `docs/specs/index.json` (sommaire specs) et `docs/specs/tab-<slug>.md` (corps de la spec, rendu à la demande).

## Scope
perso

## Finalité fonctionnelle
Panel **méta** : visualiser l'avancement du projet Jarvis et l'architecture du cockpit sans quitter l'app. Le fichier `jarvis/spec.json` (615 lignes, éditable à la main par Claude Code) contient deux structures :
1. **`phases[]`** — 6 phases de build (Inférence locale, RAG, Mémoire structurée, Orchestrateur, Boucle nocturne, Observation), chacune décomposée en features (15 au total) avec `status`, `scope`, `progress`, `description`, `implementation` (files/deps/decisions), `depends_on`, `metrics`, `next_steps`.
2. **`cockpit_tabs.groups[]`** — catalogue auto-descriptif des 25 onglets du cockpit (par groupe) avec `panel_file`, `data_sources`, `frequency`, `update_details`.

Le panel fetch le JSON une fois (cache mémoire module-level), affiche une roadmap cliquable sur les 6 phases, une grille filtrable des features de la phase sélectionnée (par `status` × `scope`), un drawer latéral avec tous les détails (Impl / Deps / Decisions / Metrics / Next steps), et le catalogue complet des onglets groupé. La validation structurelle du spec tourne en CI à chaque push sur le fichier (`.github/workflows/validate-spec.yml`).

## Parcours utilisateur
1. Clic sidebar "Jarvis Lab" (groupe **Personnel**, juste après "Jarvis") — `activePanel === "jarvis-lab"` à [app.jsx:407](cockpit/app.jsx:407).
2. **Pas un panel Tier 2** : pas de `loadPanel` case, pas de loader générique. Fetch interne `./jarvis/spec.json` au premier mount, cache dans `__jarvisLabSpecCache` (module-scope).
3. Header : "JARVIS LAB · Source : jarvis/spec.json · Dernière MAJ : {meta.updated_at}".
4. Roadmap horizontale de 6 chips P1..P6 — clic sur une phase → `setSelectedPhaseId(id)`. La phase par défaut est : `in_progress` si existe, sinon dernier `done`, sinon premier du tableau.
5. Résumé phase : `{done}/{total} features done · {wip} in progress · {backlog} backlog · {blocked} blocked`.
6. Barre de filtres 2 groupes (Statut × Scope) : `all/done/in_progress/backlog/blocked` × `all/perso/pro`. Filtres in-memory (pas de persistance).
7. Grille de cards features : chaque card affiche le badge status avec point coloré, scope + progress, nom, description, barre de progression (rouge si `blocked`), nb `files · deps · decisions`, `Updated {date}`. Clic sur une card → ouvre le drawer.
8. **Drawer latéral** (aria-modal, body-scroll-lock, Escape pour fermer, focus sur close button) :
   - Breadcrumb "PHASE N · NOM"
   - Nom + badges status/scope/progress + barre progression
   - Description
   - Section **Implementation** : sous-sections Files (mono), Dependencies, Key decisions
   - Section **Depends on** : liste cliquable — chaque `phase.feature` est un bouton `JLDependencyLink` qui navigue vers la feature cible (re-open drawer avec nouveau data)
   - Section **Metrics** (optionnelle) : grille clé/valeur
   - Section **Next steps** (optionnelle) : liste
   - Footer "Updated {date}"
9. Section **Catalogue cockpit** (au milieu) — groupes d'onglets rendus en cards. **Clic sur le corps de la card** → `focusSpec(tab.id)` : scroll vers la section "Specs détaillées" plus bas + sélection automatique du spec correspondant (mapping `tab.id.replace("_", "-")` pour gérer `gaming_news` ↔ `gaming-news`). **Bouton "Ouvrir ↗"** dans le pied de card → `onNavigate(tab.id)` (navigation vers le vrai onglet, quitte Jarvis Lab). Le clic sur la card et celui sur le bouton sont distincts grâce à `e.stopPropagation()` sur le bouton.
10. Section **Specs détaillées** (tout en bas) — lecteur Markdown 3 colonnes :
    - **Sidebar gauche** : liste des onglets groupés par `scope` (Pro / Perso / Mixte), ordre `order` croissant, stubs en fin de groupe avec badge `todo`. Sélection = bouton `<button class="jl-specs-nav-item is-active">`, border-left vert accent (warning orange si stub sélectionné).
    - **Document central** : header (badge scope + badge status "documentée"/"à documenter" + date MAJ + bouton "Ouvrir l'onglet →"), corps = `docs/specs/tab-<slug>.md` rendu via `marked` 11.2 + DOMPurify. Les H2 reçoivent un `id` slugifié (même algo que [panel-wiki.jsx](cockpit/panel-wiki.jsx)). Les H2 commençant par "Limitations" reçoivent un style border-left warning orange automatique.
    - **TOC droite collante** : liste des H2 du document, clic → `scrollIntoView({ behavior: "smooth" })`. Masquée sous 1100px de largeur.
    - **Empty state** si rien sélectionné : "Choisis un onglet dans la colonne de gauche pour lire sa spec détaillée."
    - **Stub state** : bloc warning orange "Cette spec est un stub. Le fichier `docs/specs/tab-<slug>.md` n'a pas encore été rédigé". Pas de fetch de .md.
    - **Mobile** (<880px) : sidebar remplacée par `<select>`, TOC masquée, doc padding réduit.

## Fonctionnalités
- **Fetch + cache module-level** : `__fetchJarvisSpec()` fait `fetch("./jarvis/spec.json", { cache: "no-store" })` puis stocke dans `__jarvisLabSpecCache`. Un seul fetch par session ; `cache: no-store` contourne le cache HTTP mais pas le cache JS.
- **Auto-sélection intelligente** : premier mount sélectionne la phase `in_progress` (priorité 1), puis la dernière `done` (priorité 2), puis la première (fallback).
- **Filtrage client** : 2 axes (status × scope) = 5 × 3 = 15 combinaisons possibles. Filtrage pure-function via `array.filter`.
- **Drawer navigation inter-features** : `JLDependencyLink` permet de suivre une dépendance (ex. `phase-2.pgvector-setup`) → clic ouvre le drawer de la feature cible **sans recharger la page** ni fermer le drawer. Focus management : `closeRef.focus()` sur chaque changement de data.
- **Body scroll lock + Escape** : drawer accessibilité-friendly (aria-modal, aria-label dynamique).
- **Restore focus on close** : la `lastOpenerRef` capture l'élément cliqué à l'ouverture ; `closeDrawer` restaure le focus dessus pour rester clavier-navigable.
- **Catalogue cockpit auto-affiché** : tous les onglets listés dans `spec.cockpit_tabs.groups[]` sont rendus en bas — utile pour parcourir "ce que fait l'app" sans naviguer onglet par onglet.
- **Validation CI** : `scripts/validate_spec.py` vérifie la cohérence structurelle (ids uniques, `status` dans l'enum, `progress` cohérent avec `status` — done→100, backlog→0 —, `depends_on` pointent vers des features existantes, `updated_at` ISO valide). Le workflow tourne sur tout push ou PR modifiant `jarvis/spec.json`, `scripts/validate_spec.py` ou son `.yml`.
- **Lecteur Markdown** : `__parseSpecMd(src)` lexe via `window.marked.lexer`, extrait les H2 pour la TOC, réinjecte des `id` stables dans tous les headings post-parsing, sanitize via `window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`. Deux caches module-level : `__jlSpecsIndexCache` (1 entrée pour `index.json`), `__jlSpecsMdCache` (1 entrée par slug visité — chaque spec est fetch une fois par session).
- **Tri intelligent de la sidebar** : les onglets `stub` sont relégués en fin de leur groupe de scope, les `documented` triés par `order` croissant. Scope order forcé : Pro → Perso → Mixte.

## Front — structure UI
Fichier : [cockpit/panel-jarvis-lab.jsx](cockpit/panel-jarvis-lab.jsx) — 620 lignes, monté à [app.jsx:407](cockpit/app.jsx:407). Stylesheet : [cockpit/styles-jarvis-lab.css](cockpit/styles-jarvis-lab.css) — 796 lignes, préfixe `.jl-*`.

Structure DOM :
- `<section id="jarvis-lab" class="jl-root">` — racine (même container pour états loading/error/ready)
  - `.jl-header` — titre + sub "Source : jarvis/spec.json · Dernière MAJ : {date}"
  - `.jl-roadmap > .jl-roadmap-line + .jl-roadmap-nodes` — ligne horizontale + 6 chips
    - `.jl-node.jl-node--{status}.is-selected` — chip phase (dot + "PN" + status)
  - `.jl-summary` — compteurs
  - `<div id="jarvis-lab-features">`
    - `.jl-filter-bar` — filtres status × scope
    - `.jl-features-grid > .jl-feature-card[data-status][data-phase-id][data-feature-id]` — grille (grid auto-fit)
  - `.jl-specs` — catalogue cockpit
    - `.jl-specs-head` — eyebrow + titre + sub
    - Pour chaque groupe : `.jl-tab-group > .jl-tab-group-header + .jl-tab-grid > .jl-tab-card`
  - `<JLDrawer>` (sibling de `#jarvis-lab-features`)
    - `.jl-overlay.is-open` — click-to-close
    - `.jl-drawer.is-open[role="dialog"][aria-modal]` — content drawer

**Panel non-Tier 2** : absent de `TIER2_PANELS` à [data-loader.js:4465-4469](cockpit/lib/data-loader.js:4465). Pas de loader générique — le panel gère son propre loading/error via la logique fetch interne.

## Front — fonctions JS
| Fonction / Composant | Rôle | Fichier/ligne |
|----------------------|------|---------------|
| `__fetchJarvisSpec()` | Fetch `./jarvis/spec.json` avec cache module-level + `cache: "no-store"` | [panel-jarvis-lab.jsx:12-19](cockpit/panel-jarvis-lab.jsx:12) |
| `PanelJarvisLab()` | Composant racine — fetch, states, auto-select phase, drawer | [panel-jarvis-lab.jsx:448](cockpit/panel-jarvis-lab.jsx:448) |
| `JLRoadmapNode({ phase, selected, onClick })` | Chip phase cliquable | [panel-jarvis-lab.jsx:21](cockpit/panel-jarvis-lab.jsx:21) |
| `JLPhaseSummary({ phase })` | Compteurs par statut | [panel-jarvis-lab.jsx:37](cockpit/panel-jarvis-lab.jsx:37) |
| `JLFeatureCard({ phase, feature, onFeatureClick })` | Card feature (button) avec badge + progression | [panel-jarvis-lab.jsx:57](cockpit/panel-jarvis-lab.jsx:57) |
| `JLFilterChip({ active, label, onClick })` | Chip de filtre | [panel-jarvis-lab.jsx:113](cockpit/panel-jarvis-lab.jsx:113) |
| `JLFilterBar({ statusFilter, scopeFilter, onStatusChange, onScopeChange })` | Double groupe de filtres (status × scope) | [panel-jarvis-lab.jsx:125](cockpit/panel-jarvis-lab.jsx:125) |
| `JLCockpitTabCard({ tab, onNavigate })` | Card d'onglet cockpit, cliquable via `onNavigate(tab.id)` | [panel-jarvis-lab.jsx:167](cockpit/panel-jarvis-lab.jsx:167) |
| `JLCockpitSpecs({ spec })` | Section catalogue (groupes × cards) | [panel-jarvis-lab.jsx:184](cockpit/panel-jarvis-lab.jsx:184) |
| `JLFeaturesGrid({ phase, statusFilter, scopeFilter, onFeatureClick })` | Grille filtrée, empty state "Aucune feature…" | [panel-jarvis-lab.jsx:215](cockpit/panel-jarvis-lab.jsx:215) |
| `JLBadges({ feature })` | Chips status/scope/progress | [panel-jarvis-lab.jsx:240](cockpit/panel-jarvis-lab.jsx:240) |
| `JLDependencyLink({ refStr, spec, onNavigate })` | Lien cliquable vers feature (pattern `phase.feature`) ou "ref manquante" | [panel-jarvis-lab.jsx:254](cockpit/panel-jarvis-lab.jsx:254) |
| `JLDrawerContent({ data, spec, onNavigate, closeRef })` | Contenu du drawer (5 sections + footer) | [panel-jarvis-lab.jsx:273](cockpit/panel-jarvis-lab.jsx:273) |
| `JLDrawer({ data, spec, open, onClose, onNavigate })` | Shell drawer — overlay, body-scroll-lock, Escape, focus close button via `requestAnimationFrame` | [panel-jarvis-lab.jsx:392](cockpit/panel-jarvis-lab.jsx:392) |
| `openFeature(phaseId, featureId, opener)` (inline) | Capture `lastOpenerRef` + set drawerRef + open + switch phase | [panel-jarvis-lab.jsx:482-487](cockpit/panel-jarvis-lab.jsx:482) |
| `closeDrawer()` (inline) | Ferme + restaure focus sur `lastOpenerRef.current` | [panel-jarvis-lab.jsx:489-495](cockpit/panel-jarvis-lab.jsx:489) |
| `useJLEffect` spec loader | Fetch si pas en cache, `cancelled` guard pour unmount | [panel-jarvis-lab.jsx:458-470](cockpit/panel-jarvis-lab.jsx:458) |
| `useJLEffect` auto-select phase | Sélection intelligente (wip → last done → first) | [panel-jarvis-lab.jsx:472-480](cockpit/panel-jarvis-lab.jsx:472) |
| `useJLEffect` body scroll lock | `document.body.style.overflow = "hidden"` tant que drawer ouvert | [panel-jarvis-lab.jsx:396-401](cockpit/panel-jarvis-lab.jsx:396) |
| `useJLEffect` Escape handler | `keydown` listener conditionnel | [panel-jarvis-lab.jsx:404-409](cockpit/panel-jarvis-lab.jsx:404) |
| `useJLEffect` focus management | `closeRef.focus()` sur ouverture ET sur changement de `data` | [panel-jarvis-lab.jsx:413-422](cockpit/panel-jarvis-lab.jsx:413) |
| Navigation sidebar vers jarvis-lab | Item `{ id: "jarvis-lab", label: "Jarvis Lab", icon: "chart" }` dans groupe Personnel | [data-loader.js:1213](cockpit/lib/data-loader.js:1213) + [data.js:109](cockpit/data.js:109) |

## Back — sources de données

| Source | Type | Volumétrie |
|--------|------|------------|
| [jarvis/spec.json](jarvis/spec.json) | Fichier JSON statique servi par GitHub Pages / dev server | 615 lignes · 6 phases · 15 features · 6 cockpit groups · 25 cockpit tabs (snapshot au 2026-04-24) |
| Cache navigateur | `__jarvisLabSpecCache` module-level | 1 entrée par session (invalidé au reload) |

**Aucune table Supabase**. Aucun appel API externe. Le panel est read-only.

Format spec.json (haut niveau) :
```json
{
  "meta": { "version", "updated_at", "description" },
  "phases": [
    {
      "id", "name", "status", "order",
      "features": [
        {
          "id", "name", "status", "scope", "progress",
          "description",
          "implementation": { "files", "dependencies", "key_decisions" },
          "depends_on": ["phase-id.feature-id", ...],
          "metrics": { "key": "value", ... },  // optionnel
          "next_steps": ["...", ...],           // optionnel
          "updated_at"
        }
      ]
    }
  ],
  "cockpit_tabs": {
    "summary": "...",  // optionnel
    "groups": [
      {
        "id", "label",
        "tabs": [
          { "id", "label", "icon", "description", "panel_file", "data_sources", "frequency", "update_details" }
        ]
      }
    ]
  }
}
```

## Back — pipelines qui alimentent
- **Aucun pipeline automatique**. Le fichier `jarvis/spec.json` est **édité à la main** (par l'utilisateur ou par Claude Code lors des refactors). Le champ `meta.description` précise : *"Source de vérité du projet Jarvis : phases de build + catalogue des onglets du cockpit. Tenu à jour par Claude Code à chaque modification."*
- **CI — validation structurelle** : `.github/workflows/validate-spec.yml` lance `scripts/validate_spec.py` sur tout push ou PR modifiant `jarvis/spec.json`, `scripts/validate_spec.py` ou son `.yml`. Le script vérifie :
  - Métadonnées (`version`, `updated_at` ISO)
  - `phases[]` : ids uniques, `status` ∈ `{done, in_progress, backlog, blocked}`, `order` int unique
  - `features[]` : champs requis (`id, name, status, scope, progress, description, implementation, depends_on, updated_at`), `progress` int ∈ [0,100], cohérence `status=done→progress=100` et `status=backlog→progress=0`, `implementation.{files, dependencies, key_decisions}` présents et arrays, `depends_on[]` pointent vers des refs `phase.feature` existantes
  - `cockpit_tabs.groups[]` (si présent) : ids uniques, `frequency` ∈ enum, `data_sources` non vide
- **Daily / Weekly pipelines backend** : aucun d'eux ne touche `spec.json`.
- **Jarvis (local)** : aucun.

## Appels externes
- `fetch("./jarvis/spec.json", { cache: "no-store" })` — un seul appel par session (cache module).
- Aucune écriture. Aucun endpoint Supabase. Aucune télémétrie.

## Dépendances
- **Onglets in** : sidebar group "Personnel" uniquement.
- **Onglets out** : le catalogue cockpit — `JLCockpitTabCard` est un `<button>` qui appelle `onNavigate(tab.id)`, permettant de sauter vers n'importe quel onglet listé dans `cockpit_tabs.groups[]`.
- **Pipelines** : aucun requis.
- **Variables d'env / secrets** : aucun — 100% client-side.
- **Fichiers dépendances** : [jarvis/spec.json](jarvis/spec.json) (obligatoire) ; [scripts/validate_spec.py](scripts/validate_spec.py) + workflow CI (pour garantir l'intégrité).

## États & edge cases
- **Loading** : `{!spec}` → `<div class="jl-loading">Chargement de spec.json…</div>`.
- **Erreur fetch** (404, JSON invalide, CORS, etc.) : `setErr(e)` + log `[jarvis-lab] spec load failed` → `<div class="jl-error">Impossible de charger spec.json — vérifie que le fichier existe et que le serveur est en cours d'exécution.</div>`.
- **Aucune feature après filtrage** : `<div class="jl-empty">Aucune feature ne correspond aux filtres.</div>`.
- **Phase sans features** : `phase.features = []` → `JLPhaseSummary` affiche "0/0 features done · 0 in progress · 0 backlog" ; `JLFeaturesGrid` affiche l'empty state (car tous les filtres → 0).
- **`cockpit_tabs` absent** : la section catalogue ne rend rien (`return null` dans `JLCockpitSpecs`).
- **`depends_on` pointant vers une ref inexistante** : `JLDependencyLink` rend `<span class="jl-dep-missing">→ phase-X.feature-Y [ref manquante]</span>`. Filet de sécurité vs la CI validate-spec qui devrait rejeter ce cas.
- **Unmount pendant fetch** : `cancelled = true` garde bloque le `setSpec` / `setErr`.
- **Navigation rapide drawer → drawer (via dépendance)** : `lastOpenerRef` n'est pas mis à jour (opener=null passé), donc le focus post-close restaure l'opener initial du drawer. ⚠️ Edge case : si l'utilisateur ouvre le drawer via card, suit 3 dépendances, puis ferme, le focus revient sur la card initiale — comportement discutable mais volontaire (`opener` = null empêche l'écrasement).
- **Refresh manuel du spec.json** : pas de bouton "rafraîchir". Le cache module-level survit aux remounts du panel mais pas à `window.location.reload()`.
- **`meta.updated_at` absent** : header affiche "Dernière MAJ : —".
- **Filtres non persistés** : changement d'onglet → filtres reset. Pas de `localStorage`.
- **Pas d'auth requise** : `spec.json` est livré avec le build GitHub Pages, accessible sans session.

## Limitations connues / TODO
- [x] ~~**Duplication spec.json ↔ docs/specs/**~~ → **fixé (2026-04-24)** : nouveau [`scripts/sync_specs.py`](scripts/sync_specs.py) synchronise `docs/specs/index.json` depuis `jarvis/spec.json::cockpit_tabs` en préservant `status`, `last_updated`, `scope` (métadonnées propres à la rétrodoc). Le workflow CI [.github/workflows/validate-spec.yml](.github/workflows/validate-spec.yml) fail désormais en `--strict` si les deux fichiers divergent. Mapping : `slug = tab.id.replace("_","-")`, `dom_id = tab.id`, `order` réattribué dans l'ordre d'apparition des groupes.
- [x] ~~**Spec.json édité à la main**~~ → **fixé partiellement (2026-04-24)** : nouveau [`scripts/spec_drift_check.py`](scripts/spec_drift_check.py) détecte 4 règles de dérive (`implementation.files[]` qui pointe sur un fichier inexistant, feature `in_progress` sans MAJ > 30 jours = *stalled*, `meta.updated_at` > 30 jours = spec obsolète, cohérence `status`↔`progress`). Branché en CI en `continue-on-error: true` → log les warnings sans faire fail le build. **Reste manuel** : le contenu éditorial (description, key_decisions, metrics, next_steps) — par design, nécessite du jugement humain.
- [x] ~~**`cockpit_tabs` tabs non cliquables**~~ → **fixé (2026-04-24)** : `JLCockpitTabCard` passe de `<div>` à `<button type="button">` avec `onClick={() => onNavigate(tab.id)}`. `PanelJarvisLab` accepte désormais le prop `onNavigate` (cascade via `JLCockpitSpecs`). Focus-visible + hover lift ajoutés côté CSS.
- [x] ~~**Pas de refresh manuel**~~ → **fixé (2026-04-24)** : bouton "Rafraîchir" dans le header (`.jl-refresh-btn`). Vide `__jarvisLabSpecCache` + refetch + update state. Disabled pendant le fetch, label switch vers "Rechargement…".
- [ ] **Pas de recherche / tri** dans le catalogue cockpit : 25 cards, pas de filtre par `frequency` ni par `data_source`.
- [ ] **Drawer nav "back"** inexistante : suivre une dépendance est aller-simple. Il faut fermer puis rouvrir l'original pour revenir.
- [ ] **Filtres non persistés** (pas de `localStorage`). Décision possiblement volontaire (panel consultatif).
- [ ] **Cache module-level non invalidable** : `__jarvisLabSpecCache` n'est pas exposé sur `window` — impossible de le vider depuis la console sans reload.
- [ ] **Pas de version check** : si `spec.meta.version` bouge, le panel charge mais ne signale rien.
- [ ] **Aria-live absent** sur le drawer — VoiceOver/NVDA ne sont pas notifiés du changement de contenu sur navigation dep-link.
- [ ] **Aucune télémétrie** : impossible de savoir si quelqu'un consulte vraiment les `key_decisions` ou les `metrics`. Potentiellement OK (panel de confort).
- [ ] **`scope` binaire perso/pro** : le CLAUDE.md note que beaucoup d'onglets sont "mixte" — le spec.json (validé par `VALID_SCOPE = {"perso", "pro"}`) force à choisir. Les features mixtes sont rangées en "perso" par défaut.

## Dernière MAJ
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour :
- [scripts/sync_specs.py](scripts/sync_specs.py) — sync auto `docs/specs/index.json` ← `jarvis/spec.json::cockpit_tabs` (dry-run / --write / --strict).
- [scripts/spec_drift_check.py](scripts/spec_drift_check.py) — détection dérives (files manquants, features stalled, spec obsolète).
- [.github/workflows/validate-spec.yml](.github/workflows/validate-spec.yml) — nouvelles étapes CI (strict sync + warn drift).
- [cockpit/panel-jarvis-lab.jsx](cockpit/panel-jarvis-lab.jsx) — `JLCockpitTabCard` cliquable (cascade `onNavigate`) + bouton "Rafraîchir" dans le header.
- [cockpit/styles-jarvis-lab.css](cockpit/styles-jarvis-lab.css) — `.jl-refresh-btn`, `.jl-header-main`, reset button pour `.jl-tab-card`.

