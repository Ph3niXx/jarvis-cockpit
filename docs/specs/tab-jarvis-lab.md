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
1. Clic sidebar "Jarvis Lab" (groupe Personnel, juste après "Jarvis") — le panel charge la roadmap du projet.
2. Lecture du header : source de la spec + date de dernière mise à jour.
3. Clic sur un des six chips P1..P6 de la roadmap horizontale pour sélectionner une phase. La phase en cours est pré-sélectionnée par défaut (sinon la dernière terminée, sinon la première).
4. Lecture du résumé de phase : compteurs done / in progress / backlog / blocked pour la phase active.
5. Utilisation de la barre de filtres à deux groupes (Statut × Scope) pour réduire la grille de features aux cartes pertinentes.
6. Lecture de la grille de features : chaque carte affiche le badge statut, le scope, la progression, le nom, la description, les compteurs de fichiers/dépendances/décisions et la date de mise à jour.
7. Clic sur une carte pour ouvrir le drawer latéral détaillé : breadcrumb phase, description complète, section Implementation (fichiers, dépendances, décisions clés), section Dépendances cliquables vers d'autres features, section Metrics optionnelle, section Next steps optionnelle. Échap ferme le drawer.
8. Lecture du catalogue cockpit au milieu de page : onglets groupés (Aujourd'hui / Veille / Apprentissage / Business / Personnel / Système) avec sources de données et fréquences. Clic sur le corps d'une carte amène au lecteur de spec tout en bas ; clic sur "Ouvrir ↗" quitte Jarvis Lab pour basculer sur le vrai onglet.
9. Lecture des specs détaillées en pied de page : sidebar gauche avec les onglets groupés par scope (Pro / Perso / Mixte), document central en rendu Markdown riche, table des matières à droite avec scroll fluide vers chaque section au clic.
10. Clic sur "Rafraîchir" dans le header pour vider le cache local et recharger la spec sans recharger la page.

## Fonctionnalités
- **Roadmap 6 phases** : six chips en tête de page (Inférence locale, RAG, Mémoire, Orchestrateur, Boucle nocturne, Observation) avec leur statut coloré. Clic sur une phase ouvre la grille de ses features.
- **Auto-sélection intelligente** : au chargement, la phase en cours est sélectionnée par défaut (ou la dernière terminée, ou la première).
- **Résumé de phase** : compteurs par statut — done, in progress, backlog, blocked — pour la phase active.
- **Grille de features filtrable** : cartes avec badge statut, scope, progression, description et compteurs de fichiers/dépendances/décisions. Deux groupes de filtres combinables (Statut × Scope).
- **Drawer latéral de feature** : clic sur une carte ouvre un panneau latéral avec description complète, Implementation (fichiers, dépendances, décisions clés), Dépendances cliquables vers les autres features, Metrics et Next steps.
- **Catalogue des onglets du cockpit** : section dédiée qui liste les 25 onglets groupés (Aujourd'hui / Veille / Apprentissage / Business / Personnel / Système), chaque carte indiquant les sources de données et la fréquence de mise à jour. Clic sur le corps amène au lecteur de spec ; bouton « Ouvrir ↗ » navigue vers le vrai onglet.
- **Lecteur Markdown des specs** : en bas de page, un lecteur trois colonnes — sidebar gauche (liste par scope Pro / Perso / Mixte, stubs relégués en fin de groupe), document central (rendu Markdown sécurisé), table des matières collante à droite avec scroll fluide vers chaque section.
- **Badge de statut des specs** : indique clairement si l'onglet est « documenté » ou si le spec est encore un stub (un message explicite remplace le contenu dans ce dernier cas).
- **Bouton « Rafraîchir »** : en header, vide le cache local et recharge la spec pour voir immédiatement les modifications récentes sans recharger la page.
- **Accessibilité clavier** : drawer navigable au clavier avec Escape pour fermer et restauration automatique du focus sur l'élément déclencheur.

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
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour :
- [scripts/sync_specs.py](scripts/sync_specs.py) — sync auto `docs/specs/index.json` ← `jarvis/spec.json::cockpit_tabs` (dry-run / --write / --strict).
- [scripts/spec_drift_check.py](scripts/spec_drift_check.py) — détection dérives (files manquants, features stalled, spec obsolète).
- [.github/workflows/validate-spec.yml](.github/workflows/validate-spec.yml) — nouvelles étapes CI (strict sync + warn drift).
- [cockpit/panel-jarvis-lab.jsx](cockpit/panel-jarvis-lab.jsx) — `JLCockpitTabCard` cliquable (cascade `onNavigate`) + bouton "Rafraîchir" dans le header.
- [cockpit/styles-jarvis-lab.css](cockpit/styles-jarvis-lab.css) — `.jl-refresh-btn`, `.jl-header-main`, reset button pour `.jl-tab-card`.

