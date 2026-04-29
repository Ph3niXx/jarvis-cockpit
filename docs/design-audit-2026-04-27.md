# Audit Design Complet — AI Cockpit

**Date** : 27 avril 2026
**Auditeur** : design senior (UX, UI, design system, accessibilité, rétention)
**Scope** : <https://ph3nixx.github.io/jarvis-cockpit/> + code source `cockpit/*` + `index.html`
**Objectif prioritaire** : rétention quotidienne sur 30+ jours d'usage.

---

## Note de méthode (lis avant tout)

Le brief joint décrit une stack **vanilla single-file `index.html`** avec une identité **gradient bleu→violet, glassmorphism**. La réalité du code (sur `main` à l'instant T) est **React 18 + `@babel/standalone`, no build step**, multi-fichiers, avec **3 thèmes complets** (Dawn éditorial, Obsidian terminal, Atlas swiss) — aucun gradient ni glassmorphism.

J'ai donc **adapté chaque prompt à la stack réelle** : chemins `cockpit/panel-*.jsx`, conventions `window.X = X` (pas d'`import` ES modules — incompatible Babel standalone), tokens `var(--brand)`, helpers `window.sb.query/postJSON/patchJSON` et `window.track`. Suivre le brief littéralement aurait donné des prompts inexécutables.

**Ce livrable est une suite de [`docs/design-audit-2026-04-26.md`](design-audit-2026-04-26.md).** Beaucoup de quick wins de la veille ont été shippés en 24h (cf. `jarvis/upgrades/2026-04-26-audit.md` : 39 commits, dont focus-visible, spacing tokens, Morning Card, command palette, Revue du jour, hero delta, état zéro positif, animations finitisées, token `--neutral`, hover `color-mix`). **Je ne réaudite pas ces points** — j'audite **ce qui reste** et **ce qui a été ajouté** (nouveaux panels Veille outils, Claude, Évening, Jarvis Lab, command palette, Morning Card).

Le site live est gaté par Google OAuth (le `<div id="root">` reste vide tant que `cockpitAuth.waitForAuth()` n'a pas résolu). L'audit visuel est donc fait depuis le code, qui est de toute façon la source de vérité — ce qui est en prod = ce qui est dans `main`.

---

## 1. Reconnaissance

### 1.1 Inventaire features — delta vs J-1

**Shipped depuis l'audit du 26/04 (état J-1 → J)** :

| Quick win J-1 | État au 27/04 | Localisation |
|---|---|---|
| Hero delta visite récurrente (P1) | **Shipped** | `home.jsx:289-447` (`useDeltaHero`, `newSinceVisit`, `newTopItems`) |
| Filtre "Récent · 24h" auto-on (P2) | **Shipped** | `app.jsx:195-215` (auto-on entre 30 min et 18h après dernière visite) |
| Animations infinies → 3 boucles (P3) | **Shipped** | `styles.css:585` (`animation: pulse 2s ease 3` puis `forwards`) |
| Token `--neutral` pour `#b8956a` (P4) | **Shipped (Dawn)** | `themes.js:31, 105, 178` — tokens `--neutral` et `--neutral-tint` présents dans les 3 thèmes |
| Hover en `color-mix` (P5) | **Partiel** | À vérifier panel par panel — `styles-signals.css` toujours en `rgba(0,0,0,...)` à plusieurs endroits |
| État zéro positif (P6) | **Shipped** | `home.jsx:316-330, 479-504` (zero-state + idées dormantes) |
| Cards lues collapsent (P7) | **Shipped** | `home.jsx:215-221, top-card.is-read` + telemetry `top_card_collapsed` |
| Reading time tag (P8) | **Shipped** | `home.jsx:44-49, 555` (`estimateReadingTime`) |
| Morning Card hero | **Shipped** (nouveau) | `home.jsx:178-209, 352-372` |
| Command palette Ctrl+K | **Shipped** (nouveau) | `command-palette.jsx` |
| Revue du jour | **Shipped** (nouveau) | `panel-review.jsx` |
| Quiet mode auto Obsidian 22h-6h | **Shipped** | `app.jsx:241-257` |

**Nouveaux panels ajoutés depuis 6 semaines** (à auditer pour la première fois) :

| Panel | Fichier | Stylesheet | Notes |
|---|---|---|---|
| Veille outils (catalogue Claude) | `panel-veille-outils.jsx` (965 l.) | `styles-veille-outils.css` (894 l.) | 4 buckets `claude_veille` + `claude_ecosystem` |
| Jarvis Lab | `panel-jarvis-lab.jsx` (1585 l.) | `styles-jarvis-lab.css` (1824 l.) | **Le plus gros panel du cockpit** — specs + architecture + diagrammes |
| Soirée (Miroir du soir) | `panel-evening.jsx` (122 l.) | `styles-evening.css` (104 l.) | Lit `daily_mirror`, en attente après 19h |
| Stacks (catalogue outils) | `panel-stacks.jsx` (503 l.) | `styles-stacks.css` (603 l.) | — |

**Volume total** : 25 panels — la home doit rester centrale, mais 4 panels neufs ont été ajoutés en 6 semaines. Le risque de **dérive entre panels** s'aggrave : 19 stylesheets dédiés × 700-1800 lignes = **~17 000 lignes de CSS panel-spécifique**. Sans mécanisme de partage explicite, chaque panel finit par redéclarer son propre kicker, sa propre card, ses propres pills.

### 1.2 Design system — état J

**Tokens étendus depuis J-1** : `--neutral` et `--neutral-tint` sont maintenant définis dans les 3 thèmes (`themes.js`), avec une couleur cohérente (`#b8956a` Dawn, `#D4A572` Obsidian, `#9C7B45` Atlas). Bien.

**Dérives résiduelles à éliminer** :

- **`!important` × 98 occurrences** (`grep -rn '!important' cockpit/styles*.css | wc -l`) — concentrées dans `styles-mobile.css` (toute la stratégie mobile fonctionne par override `!important` sur les grilles desktop). C'est **viable mais fragile** : un changement de grille desktop demande un override correspondant, sinon le mobile dérive en silence. Voir QW#3 ci-dessous.
- **22 keyframes** dont seules **5 respectent `prefers-reduced-motion: reduce`** (`grep prefers-reduced-motion cockpit/`). Les pulses jarvis-lab, opportunities, wiki, sidebar hot-dot, jobs-radar, opps-pulse, st-pulse continuent même quand l'utilisateur a demandé moins d'animation. **Impact rétention** : visible dès la 3e visite quotidienne pour les utilisateurs sensibles au mouvement. Voir QW#1.
- **Avatar Jarvis (`JvIcon`)** : duplication d'icônes signalée le 26/04 — toujours présente (`grep -n 'JvIcon' cockpit/panel-jarvis*.jsx`). Voir QW#7.
- **Bordures dérivantes sur `data-recent="1"`** : la règle `[data-recent="1"]` apparaît sur `top-card`, `sig-card`, `vl-item` mais avec des styles différents (épaisseur, couleur, position). 3 expressions visuelles pour le même concept "récent" — incohérence subtile mais persistante.
- **5+ tailles de bouton** (constat J-1) : **non résolu**. `.btn` (10px 16px), `.btn--sm` (7px 12px), `.ph-chip`, `.card-action`, `.sb-link`, `.btn-jarvis`, `.recent-toggle`, `.kbd-fab` — chaque panel ajoute sa variante. Voir QW#4.

### 1.3 Test rétention — visite #20 (et non #5)

Yesterday's audit testait la visite #5. À la **visite #20**, après 3 semaines d'usage quotidien, ce qui fatigue change :

1. **Le streak devient de la pression** — la sidebar montre `flame · 21j` en permanence. Si je rate un jour (vacances, oubli), ce compteur se reset et je perds 3 semaines symboliques. **Une fois passé un seuil**, le streak décourage le retour après une absence. À reconsidérer : freeze le streak après 1 jour manqué (mode "pause"), ou afficher la moyenne 30j à la place.

2. **Le command palette est sous-équipé** — `command-palette.jsx:34` n'implémente que `Enter` sur le premier résultat. Pas de flèches ↑↓ pour naviguer dans la liste, pas de `Tab`/`Shift+Tab`. Un power user qui essaie de filtrer puis sélectionner le 3e résultat doit forcément utiliser la souris. **Friction quotidienne** sur le raccourci le plus annoncé du produit.

3. **La sidebar a 6 groupes pliables** — à la 20e visite, la mémoire musculaire connaît les chemins, mais l'arborescence reste statique. **Les sections jamais ouvertes** (`claude`, `review` cités dans l'audit J-1 au 25/04) devraient se dégrader visuellement, ou se ranger sous un "Plus" automatique. Voir J5 (Smart sidebar dans la roadmap).

4. **Aucune surface "qu'est-ce qui a changé ce mois-ci"** — la home delta ne couvre que les nouveautés depuis ta dernière visite (24h max). Sur 30j, je n'ai aucune surface pour repérer les **tendances inter-semaines** : ce signal qui montait depuis 5 semaines, ce concept wiki que je cite de plus en plus dans Jarvis, cette opportunité qui revient de jour en jour. C'est typiquement le rôle d'un **digest mensuel passif** que le produit devrait pousser sans demander. Voir J6.

5. **Trop de panels pour un usage quotidien** — Brief, Top, Signaux, Radar, Jarvis sont visités 28-47 fois sur la dernière semaine (cf. signals 25/04). Les 20 autres panels ont des courbes de fréquentation très tassées. **Sans hiérarchie comportementale dans la sidebar**, le cockpit force le scan complet de 25 entrées à chaque visite — alors qu'on en utilise réellement 5-8.

6. **L'audio brief n'a pas mémoire** — je peux lire le brief en audio mais la chip `Lecture audio · X min` se réinitialise à chaque visite. Pas de "reprendre où tu t'es arrêté", pas de queue audio multi-articles. Pour un manager qui veut écouter 3 articles dans le métro, l'expérience est manuelle. Voir J7.

7. **Le footer "API X / Y ce mois" est anxiogène** — `0.43 / 1.00$` rappelle un budget à chaque page. Pour un produit personnel à coût ridicule (< 3€/mois), cette friction quotidienne est disproportionnée. Voir QW#9.

---

## 2. Matrice d'évaluation

### 2.1 Sections principales — scores J

Note 1-5. Moyenne arrondie à 0.1. Les scores qui ont **changé depuis J-1** sont marqués `↑` ou `↓`.

| Section | Clarté | Densité | Cohérence | Interactions | Mobile | A11y | Rétention | Moy. |
|---|---|---|---|---|---|---|---|---|
| **Brief du jour (home)** | 5 ↑ | 4 ↑ | 4 | 5 ↑ | 4 | 4 | 5 ↑ | **4.4** ↑ |
| Top du jour | 4 | 5 ↑ | 4 | 4 | 4 | 4 | 4 ↑ | 4.1 ↑ |
| Ma semaine | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 3.7 |
| Recherche | 3 | 3 | 4 | 3 | 4 | 4 | 3 | 3.4 |
| Revue du jour (nouveau) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.7 |
| Soirée / Miroir | 3 | 4 | 3 | 2 | 4 | 3 | 3 | 3.1 |
| Veille IA / Claude / Sport / Gaming / Anime / News | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 3.1 |
| Veille outils (nouveau) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.7 |
| Wiki IA | 4 | 3 | 4 | 3 | 3 | 3 | 4 | 3.4 |
| Signaux faibles | 4 | 3 | 4 | 4 | 4 | 3 | 4 | 3.7 |
| Opportunités | 4 | 3 | 3 | 3 | 4 | 3 | 4 | 3.4 |
| Carnet d'idées | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 3.7 |
| Radar compétences | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 3.6 |
| Recommandations | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 3.4 |
| Challenges | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 3.4 |
| Jarvis (chat) | 4 | 4 | 3 | 4 | 2 | 3 | 5 | 3.6 |
| Jarvis Lab | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 2.9 |
| Profil | 4 | 3 | 4 | 4 | 3 | 4 | 3 | 3.6 |
| Forme | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 3.6 |
| Musique | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.7 |
| Gaming perso | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 3.4 |
| Stacks | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 3.1 |
| Historique | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 3.1 |
| Jobs Radar | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 3.6 |
| **Sidebar** | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4.1 |

**Moyenne globale : 3.55 / 5** (vs 3.61 le 26/04).

La baisse de moyenne globale **n'est pas une régression** : elle reflète l'arrivée de Jarvis Lab (2.9), Soirée (3.1), Stacks (3.1) — 3 panels neufs qui n'ont pas encore reçu de passe d'affinage. La home, le top et la sidebar ont **progressé** sur 4 critères grâce aux quick wins shippés.

### 2.2 Tableau d'évolution vs J-1

| Section | Moy. J-1 | Moy. J | Δ |
|---|---|---|---|
| Brief du jour | 4.0 | 4.4 | **+0.4** |
| Top du jour | 3.9 | 4.1 | **+0.2** |
| Sidebar | 4.0 | 4.1 | +0.1 |
| Signaux faibles | 3.6 | 3.7 | +0.1 |
| Carnet d'idées | 3.7 | 3.7 | 0 |
| **Nouveaux panels** | — | 2.9-3.7 | n/a |
| **Moyenne globale** | 3.61 | 3.55 | -0.06 (effet de mix) |

### 2.3 Top 3 forces

1. **La discipline tokens est devenue un standard** — les 24h écoulées montrent que l'équipe (toi + Claude Code) sait opérer **un pattern de fix qui scale** : ajouter un token aux 3 thèmes, remplacer les valeurs hardcodées, bumper le `?v=N` du CSS. Les mêmes outils ont été utilisés 8 fois en 24h. Très bon signal.
2. **La home est devenue le centre de gravité** — entre le hero delta, l'état zéro positif, le Morning Card, les cards qui collapsent et l'undo "tout marqué lu", la home offre **3 modes de consommation distincts** (focus rapide, lecture profonde, état stable) sans redirection. C'est rare pour un produit personnel.
3. **La télémétrie permet de mesurer ce qui compte** — le tableau d'événements dans `CLAUDE.md` est exhaustif, les events nouveaux (`hero_delta_shown`, `recent_filter_auto_on`, `zero_state_shown`, `top_card_collapsed`) sont déjà branchés, les `usage_events` en base permettent un audit comportemental avec le SQL. Ça change la nature des audits suivants : on mesure plus, on devine moins.

### 2.4 Top 3 faiblesses

1. **Le command palette est faussement utile** — c'est la "promesse Ctrl+K" mais sans navigation clavier dans la liste, sans recherche full-corpus, sans recent commands, c'est une *modale de recherche pauvre* avec un raccourci puissant. À la visite #20, le power user le délaisse. Voir QW#2.
2. **Jarvis Lab est devenu un mini-cockpit dans le cockpit** — 1585 lignes de JSX et 1824 lignes de CSS pour un panel d'introspection. Ce n'est pas faux en soi, mais sans hiérarchie de hauteur dans le panel, l'utilisateur scrolle dans 4 sections (specs / architecture / diagrammes / etc.) sans repère. **À sortir en sous-onglets** ou à découper en panels distincts. Voir J3.
3. **Le `prefers-reduced-motion` n'est pas systématique** — sur 22 keyframes, 17 ne respectent pas la requête utilisateur. C'est un manquement WCAG 2.3.3 et un irritant invisible qui pèse sur la rétention des utilisateurs sensibles aux animations infinies. Voir QW#1.

---

## 3. Quick Wins & Roadmap Jarvis

### 3.1 Top 10 Quick Wins — calibrés pour un sprint de 90 minutes

Trié par ratio impact / effort décroissant.

| # | Titre | Impact | Effort | Ratio | Sections concernées |
|---|---|---|---|---|---|
| QW#1 | `prefers-reduced-motion` global pour les 17 keyframes restantes | 4 | 1 | 4.0 | tous panels |
| QW#2 | Command palette — nav clavier ↑↓ + sélection multi-résultat | 5 | 2 | 2.5 | command-palette |
| QW#3 | Mobile — supprimer les `!important` en favorisant `@media` dans chaque stylesheet panel | 3 | 2 | 1.5 | tous styles |
| QW#4 | Système de tailles de bouton — 3 paliers `--btn-h-sm/md/lg` | 4 | 2 | 2.0 | styles.css |
| QW#5 | Streak "freeze" — afficher `21j (pause 1)` au lieu de reset à 0 | 4 | 1 | 4.0 | sidebar.jsx |
| QW#6 | `[data-recent="1"]` — règle commune partagée entre top-card / sig-card / vl-item | 3 | 1 | 3.0 | styles.css + 3 panels |
| QW#7 | `JvIcon` → utilise `<Icon>` du système commun | 3 | 2 | 1.5 | panel-jarvis*.jsx |
| QW#8 | Footer cost — afficher en mode discret (texte gris + budget en tooltip) | 3 | 1 | 3.0 | sidebar.jsx |
| QW#9 | Sidebar — sections "claude", "review", "stacks" → ranger sous "Plus" si zero usage 14j | 4 | 2 | 2.0 | sidebar.jsx + nav.js |
| QW#10 | Audio brief — chip persistante footer + queue multi-articles | 4 | 3 | 1.3 | home.jsx + globalAudioPlayer |

**Effort total ~17 unités** (1 unité ≈ 10-15 min). Sprint réaliste sur 2 sessions de travail.

### 3.2 Roadmap Jarvis — 15 features avancées

Trié par score composite (Impact × Faisabilité). Wow score est indicatif (sert à départager).

| # | Feature | Impact | Faisabilité | Wow | Composite |
|---|---|---|---|---|---|
| J1 | Smart sidebar — items avec `unread > 0` ou edited récemment remontent | 5 | 5 | 3 | **25** |
| J2 | Brief monthly digest — page unique 1er du mois, top 5 signaux, top 3 wiki cités, top 3 challenges complétés | 5 | 4 | 4 | **20** |
| J3 | Jarvis Lab → 3 sous-onglets (Specs / Architecture / Health) avec hash routes | 4 | 5 | 2 | **20** |
| J4 | Streak avec mode "freeze" (1 jour manqué = pause, pas reset) + "freeze pass" mensuel | 4 | 5 | 4 | **20** |
| J5 | Audio queue multi-articles + chip persistante footer (lecteur global) | 4 | 4 | 4 | **16** |
| J6 | "Ce qui a bougé en S-1" — surface hebdo automatique le lundi avec deltas signaux/wiki/recos | 5 | 3 | 4 | **15** |
| J7 | Command palette — `>` pour commandes (toggle thème, ouvrir spec, marquer tout lu...) | 4 | 4 | 4 | **16** |
| J8 | Jarvis chat — `@` pour mention de panel ("@radar mon prochain gap c'est quoi") | 4 | 4 | 5 | **16** |
| J9 | Tour guidé — 1ère ouverture après reset auth, 5 spots clés en 60s | 3 | 4 | 4 | **12** |
| J10 | Modèle de coût formalisé — `weekly_analysis_costs` table avec breakdown par feature, dashboard dédié | 3 | 4 | 2 | **12** |
| J11 | Mode "weekend" auto — sidebar masque updates / claude / signals samedi/dimanche | 4 | 3 | 3 | **12** |
| J12 | "Replay 90s" — synthèse audio hebdo lundi matin générée par Claude Haiku + Web Speech | 5 | 2 | 5 | **10** |
| J13 | Daily Action — Jarvis pousse 1 micro-action par jour (lis ça, complète tel challenge, contacte X), notif optin | 5 | 2 | 5 | **10** |
| J14 | Public share token — page lecture seule du brief du jour pour partager à un collègue | 3 | 3 | 4 | **9** |
| J15 | Cockpit "history mode" — slider pour voir le brief tel qu'il était il y a N jours, comparer | 3 | 3 | 5 | **9** |

### 3.3 Mockups textuels — 3 features à plus haut composite

#### Mockup 1 — J1 Smart sidebar (composite 25)

```
┌──────────────────────────────────────┐
│ ✦ Jarvis                  ←          │
│ Jean L. · RTE Vente · ●              │
├──────────────────────────────────────┤
│ ÉPINGLÉ                              │
│ ◆ Brief du jour            ●5  ←     │  ← unread badge active
│                                      │
│ AUJOURD'HUI                          │  ← libellé dynamique S-1
│ ▸ Top du jour              ●3        │  ← top items rerun
│ ▸ Signaux faibles          ●2        │
│ ▸ Jarvis                             │
│                                      │
│ CETTE SEMAINE                        │
│ ▸ Radar                              │
│ ▸ Recos                    ●1        │
│ ▸ Challenges               2/3       │
│ ▸ Carnet d'idées                     │
│                                      │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│ ◇ Plus (12) ▾                        │  ← cluster auto si zero usage 14j
│   ▸ Claude  ▸ Stacks  ▸ Review …     │
├──────────────────────────────────────┤
│ 🔥 21j  · prochain 06:00             │
│ API · 0.43 / 1.00 ╱╲╱╲              │  ← discret par défaut
│ ☀ ◑ ◼ ◷                       ⌘K     │
└──────────────────────────────────────┘
```

Logique : `nav.js` calcule les groupes dynamiquement à partir de `usage_events` (sum events par section sur 7j et 30j). Le groupe "Plus" agrège tout ce qui a `0` event sur 14 jours.

#### Mockup 2 — J6 "Ce qui a bougé en S-1"

```
┌────────────────────────────────────────────────────────────┐
│  S-1 · LE LUNDI MATIN                                      │
│                                                            │
│  Ta veille a bougé.                                        │
│  6 deltas notables sur la semaine 16 (8-14 avr).           │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SIGNAUX                                              │  │
│  │                                                       │  │
│  │  ↑ Agentic SDK   12 → 28  (+133%)   2 nouveaux outils│  │
│  │  ↑ Claude Skills  4 → 19  (+375%)   surge sur Anthropic│
│  │  ↓ AutoGPT       8 →  3   (-62%)    abandon en cours │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WIKI                                                 │  │
│  │                                                       │  │
│  │  ◆ MCP        cité 14× cette sem (vs 3× S-2)         │  │
│  │  ◆ RAG        cité  9× (-25%)                        │  │
│  │  + 2 nouvelles entrées : "tool use", "context window"│  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  RECOS / CHALLENGES                                   │  │
│  │                                                       │  │
│  │  ✓ Challenge "Build a tool with the Agent SDK" complété│ │
│  │    → score axe Agents passé de 35 à 48               │  │
│  │  → 1 nouvelle reco : "Tester Strudel pour music"     │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [Ouvrir le récap complet]   [Marquer la semaine vue]      │
└────────────────────────────────────────────────────────────┘
```

Apparaît automatiquement le lundi entre 6h et 12h, masquée jusqu'à dimanche prochain après lecture. Stockée dans `weekly_review` table, alimentée par `weekly_analysis.py`.

#### Mockup 3 — J5 Audio brief queue + lecteur footer

```
┌─────────────────────────────────────────────────────────┐
│   …                                                     │
│   [contenu cockpit normal]                              │
│   …                                                     │
│ ╓─────────────────────────────────────────────────────╖ │
│ ║  ⏵ ⏸  ▮▮▮▮▮▮▮▮▯▯▯▯  3:41 / 5:12                    ║ │
│ ║                                                     ║ │
│ ║  Brief du jour · Anthropic publie Claude Haiku 4.6  ║ │
│ ║                                                     ║ │
│ ║  Suivants : +3   Vitesse : 1.0×   Sortir 🗙        ║ │
│ ╙─────────────────────────────────────────────────────╜ │
└─────────────────────────────────────────────────────────┘
```

Lecteur sticky bottom (footer global), pas un overlay. Persiste en navigation entre panels (le speech continue), reprend à la position quand on revient sur la home. État stocké dans `window.__audioQueue`. La chip `Lecture audio · X min` du header devient un raccourci "ajouter à la file".

---

## 4. Prompts Claude Code

### Conventions transversales (s'appliquent à TOUS les prompts)

- **Stack réelle** : React 18 + Babel standalone, exposition `window.X = X`, **pas d'ES modules**.
- **Helpers Supabase existants** : `window.sb.query(table, qs)`, `window.sb.postJSON(...)`, `window.sb.patchJSON(...)`. Pas de SDK direct.
- **Telemetry obligatoire** : `window.track("event_type", { payload })` à chaque interaction notable. Mettre à jour le tableau dans `CLAUDE.md` AVANT le commit (CI `lint-specs` bloque sinon).
- **Specs** : toute modif fonctionnelle d'un onglet → update `docs/specs/tab-<slug>.md` + bump `last_updated` dans `docs/specs/index.json`.
- **3 thèmes** : tester chaque modif visuelle dans Dawn, Obsidian, Atlas (toggle sidebar bas).
- **Bumper le cache** : ajouter `?v=N+1` sur le `<script>` correspondant dans `index.html`.

---

### P0 — Quick Wins immédiats (effort < 30 min)

#### Prompt 1 — [UX] `prefers-reduced-motion` global

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles.css` (section finale)

```
Contexte : 22 @keyframes définis dans cockpit/styles*.css ; seules 5 respectent
prefers-reduced-motion: reduce. Les utilisateurs avec le réglage OS "réduire le
mouvement" voient quand même les pulses jarvis-lab, opportunities, wiki, sidebar
hot-dot, jobs-radar, opps-pulse, st-pulse — c'est un manquement WCAG 2.3.3 et un
irritant à la 3e visite du jour.

Tâche : ajouter une règle CSS en toute fin de cockpit/styles.css qui désactive
TOUTES les animations infinies pour les utilisateurs prefers-reduced-motion: reduce.

Règle à ajouter (après la dernière règle existante du fichier) :

   /* ═══ A11y — réduire les animations infinies pour tous ═══ */
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

Bumper styles.css à v=24 dans index.html (chercher "styles.css?v=23").

Validation :
1. Système → Accessibilité → Réduire les animations (macOS) ou Settings →
   Accessibility → Display → Reduce motion (Windows).
2. Recharger le cockpit, naviguer vers Wiki, Opportunités, Jarvis Lab.
3. Aucun pulse/respiration ne doit être visible.
4. Les transitions 200ms (sidebar collapse, hover) doivent rester quasi-instantanées.
```

**Validation** : visite avec OS reduced-motion ON → aucun pulse visible sur les panels Wiki, Opps, Jarvis Lab, Jobs Radar, Stacks, Sidebar.

---

#### Prompt 2 — [UX] Command palette — navigation clavier ↑↓

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/command-palette.jsx`, `cockpit/styles.css`

```
Contexte : cockpit/command-palette.jsx:34 ne gère que Enter sur le PREMIER
résultat. Pas de flèches ↑↓ pour naviguer, pas de Tab. C'est la "promesse Ctrl+K"
mais elle est creuse : un power user qui filtre puis veut sélectionner le 3e
résultat doit reprendre la souris.

Tâche : refactor cockpit/command-palette.jsx pour ajouter une navigation clavier
↑↓ + Enter sur l'item sélectionné. Item sélectionné stylé via .cp-item.is-active.

Modifications :

1. Ajouter un état React activeIdx (number) initialisé à 0.

2. Reset activeIdx à 0 quand query change (useEffect sur query).

3. Dans onKey :
   - ArrowDown : e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1));
   - ArrowUp   : e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0));
   - Enter     : e.preventDefault(); if (flat[activeIdx]) flat[activeIdx].action(); onClose();
   - Escape    : (déjà existant)

4. Dans le rendu, passer un index global (à incrémenter) à chaque .cp-item et
   ajouter className `is-active` quand index === activeIdx :

   const sectionsWithIdx = (() => {
     let counter = 0;
     return allSections.map(s => ({
       ...s,
       items: s.items.map(it => ({ ...it, _idx: counter++ }))
     }));
   })();

   {sectionsWithIdx.map(s => ...
     {s.items.map((it, i) => (
       <li key={i}>
         <button
           className={`cp-item ${it._idx === activeIdx ? "is-active" : ""}`}
           onMouseEnter={() => setActiveIdx(it._idx)}
           onClick={...}
         > ... </button>

5. Ajouter dans cockpit/styles.css après les règles .cp-item existantes :

   .cp-item.is-active,
   .cp-item:focus-visible {
     background: var(--brand-tint);
     color: var(--tx);
   }
   .cp-item.is-active .cp-item-hint { color: var(--brand); }

6. Mettre à jour le footer cp-foot pour mentionner les flèches :
   <kbd>↑↓</kbd> naviguer · <kbd>Enter</kbd> ouvrir · <kbd>Esc</kbd> fermer

7. Bumper cockpit/command-palette.jsx?v=2 dans index.html.

8. Tracker l'usage : ajouter window.track("command_palette_navigated", {direction})
   dans ArrowDown/ArrowUp. Mettre à jour le tableau telemetry de CLAUDE.md.

Validation :
- Ctrl+K → tape "rad" → ↓↓ pour aller au 3e résultat → Enter ouvre Radar.
- Le hover souris met aussi en surbrillance le bon item.
- Le scroll ne décroche pas le focus quand activeIdx dépasse la fenêtre visible
  (ajouter scrollIntoView({block: "nearest"}) dans un useEffect sur activeIdx).
```

**Validation** : Ctrl+K → recherche → ↓↓↓ → Enter sur le 4e résultat sans toucher la souris.

---

#### Prompt 3 — [UX] Streak "freeze pass"

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Contexte : la sidebar affiche `flame · 21j` mais si Jean rate un jour (vacances,
weekend off), le compteur reset à 0. À la 20e visite, le streak devient une
PRESSION qui décourage le retour après absence. Solution : une journée manquée
n'est pas un reset, c'est un "freeze" — le streak passe en mode pause.

Tâche : modifier l'affichage du streak dans sidebar.jsx pour afficher un état
"pause" (icône flocon/pause) plutôt qu'un reset à 0 quand 1 jour est manqué.

Modifications :

1. Dans sidebar.jsx, après la lecture de streak (ligne ~102), récupérer aussi
   data.stats.streak_status (string : "active" | "pause" | "broken") :

   const streak = Number.isFinite(data.stats.streak) ? data.stats.streak : null;
   const streakStatus = data.stats.streak_status || "active";

2. Adapter le rendu .sb-foot-streak pour 3 cas :

   if (streak === null || streakStatus === "broken") → rendu actuel (empty state)

   if (streakStatus === "pause") :
     <div className="sb-foot-streak sb-foot-streak--pause">
       <div className="sb-foot-streak-main">
         <span className="sb-foot-streak-icon">
           <Icon name="snowflake" size={13} stroke={1.75} />
         </span>
         <span className="sb-foot-streak-num">{streak}</span>
         <span className="sb-foot-streak-unit">j</span>
       </div>
       <div className="sb-foot-streak-meta">
         <span>streak · pause</span>
         <span className="sb-foot-next">reprends demain</span>
       </div>
     </div>

   else (streakStatus === "active") → rendu existant.

3. Ajouter l'icône snowflake dans cockpit/icons.jsx si absente
   (cf. Lucide snowflake — viewBox 24, simple flocon SVG).

4. Styles dans cockpit/styles.css :
   .sb-foot-streak--pause .sb-foot-streak-icon { color: var(--neutral); }
   .sb-foot-streak--pause .sb-foot-streak-num { opacity: 0.7; }

5. Côté data : c'est à data-loader.js de calculer streak_status. Pour ce
   prompt, on stub : ajouter dans cockpit/lib/data-loader.js (proche du calcul
   de streak existant) :

   // Pause = streak intact mais aucun read aujourd'hui ET la dernière lecture
   // est d'hier. Reset = >24h sans lecture.
   const lastReadIso = ...; // déjà calculé
   const hoursSinceLast = (Date.now() - new Date(lastReadIso).getTime()) / 3600000;
   stats.streak_status =
     hoursSinceLast < 6 ? "active" :
     hoursSinceLast < 36 ? "pause" :
     "broken";

6. Bumper sidebar.jsx?v=7 et data-loader.js?v=36 dans index.html.

Validation :
- Ne lis rien aujourd'hui jusqu'à demain matin → streak passe en "pause" avec
  flocon (ne reset pas à 0).
- Reprends la lecture demain → repasse en "active".
- 36h+ sans lecture → reset normal (broken).
```

**Validation** : la valeur du streak ne décourage plus l'absence d'1 jour ; affiche flocon + "reprends demain".

---

#### Prompt 4 — [UX] Footer cost — discret par défaut

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```
Contexte : le footer sidebar affiche en permanence `API · 0.43 / 1.00` (cost_month
sur cost_budget). À 0.43€/mois, c'est anxiogène pour rien. Pour un produit
personnel à coût ridicule, on peut afficher juste le sparkline 7j et révéler le
chiffre au hover/tap. La rétention quotidienne ne mérite pas ce rappel
budgétaire.

Tâche : dans sidebar.jsx, masquer le label texte du coût par défaut, ne révéler
le chiffre qu'au hover du bloc .sb-foot-cost.

Modifications :

1. Dans sidebar.jsx, simplifier le bloc .sb-foot-cost :

   <div className="sb-foot-cost" title={`${costMonth} / ${costBudget} ce mois`}>
     <SbSparkline values={costHist} />
     <span className="sb-foot-cost-val sb-foot-cost-val--muted">{costMonth}</span>
   </div>

2. Dans cockpit/styles.css, dans les règles .sb-foot-cost-* :

   .sb-foot-cost-val--muted {
     font-family: var(--font-mono);
     font-size: var(--text-2xs);
     letter-spacing: 0.06em;
     color: var(--tx3);
     opacity: 0.55;
     transition: opacity 120ms;
     margin-left: 6px;
   }
   .sb-foot-cost:hover .sb-foot-cost-val--muted { opacity: 1; }
   .sb-foot-cost { cursor: help; }

3. Supprimer .sb-foot-cost-label (le mot "API") et .sb-foot-cost-budget (le
   "/budget"). Le tooltip natif (title=) restitue le contexte au survol.

4. Bumper sidebar.jsx?v=8.

Validation :
- En usage normal, on voit juste un sparkline minuscule + un nombre gris pâle.
- Hover → le nombre passe en plein contraste.
- Le tooltip natif "0.43 / 1.00 ce mois" apparaît après 800ms de hover.
```

**Validation** : le coût n'est plus une présence visuelle constante.

---

#### Prompt 5 — [UX] Token `--btn-h-{sm,md,lg}` pour hauteurs de bouton

**Priorité** : P0
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/themes.js`, `cockpit/styles.css`

```
Contexte : .btn (10px 16px → ~38px haut), .btn--sm (~30px), .ph-chip (~28px),
.card-action (~24px), .sb-link (~30px), .recent-toggle (~32px), .kbd-fab (~36px).
7 hauteurs de bouton sans système. Un design system mature standardise sur 3
paliers : sm 28, md 36, lg 44.

Tâche :
1. Ajouter 3 tokens de hauteur de bouton à chaque thème dans cockpit/themes.js :
   "--btn-h-sm": "28px",
   "--btn-h-md": "36px",
   "--btn-h-lg": "44px",   // touch target a11y mobile

2. Dans cockpit/styles.css, refactor :
   .btn { min-height: var(--btn-h-md); padding: 0 16px; ... }
   .btn--sm { min-height: var(--btn-h-sm); padding: 0 12px; ... }
   .btn--lg { min-height: var(--btn-h-lg); padding: 0 20px; ... }
   .ph-chip { min-height: var(--btn-h-sm); padding: 0 var(--space-3); ... }
   .card-action { min-width: var(--btn-h-sm); min-height: var(--btn-h-sm); ... }
   .sb-link { min-height: var(--btn-h-md); ... }
   .recent-toggle { min-height: var(--btn-h-sm); ... }

3. Tester chaque variant — la hauteur DOIT rester pixel-équivalente à
   aujourd'hui (sinon les rythmes verticaux des panels cassent).

4. Sur mobile (≤760px), forcer .card-action à --btn-h-lg dans styles-mobile.css
   (déjà partiellement fait à 44px).

5. Bumper styles.css?v=25 et themes.js?v=3.

Validation :
- Visuellement, AUCUN changement.
- Mais grep sur styles*.css : aucune valeur "10px 16px" ou "7px 12px" hardcodée
  pour des paddings de bouton.
```

**Validation** : refactor invisible mais tokens propres. Permet de futurs ajustements globaux d'un seul endroit.

---

### P1 — Améliorations significatives (effort 30 min - 2h)

#### Prompt 6 — [UX] Mobile — `!important` → `@media` dans chaque stylesheet panel

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/styles-mobile.css`, tous les `cockpit/styles-*.css`

```
Contexte : cockpit/styles-mobile.css contient ~100 !important pour overrider
les grilles desktop. C'est viable mais fragile. Une modification de grille
desktop demande un override correspondant, sinon le mobile dérive en silence.
Pattern correct : chaque stylesheet panel intègre son @media (max-width: 760px)
au plus près des règles.

Tâche : migrer progressivement les règles mobile-only de styles-mobile.css vers
les stylesheets de panel correspondants, en supprimant les !important.

Approche par lot (1 panel à la fois pour limiter le risque de régression) :

LOT 1 — panels les plus visités (priorité) :
  - styles-forme.css : ajouter à la fin un bloc @media (max-width: 760px) {
    .forme-hero, .forme-kpis, .forme-kpi-row, .forme-split { grid-template-columns: 1fr; gap: 12px; } .forme-hero { padding: 22px 18px; } }
    Puis SUPPRIMER les règles correspondantes de styles-mobile.css.

  - styles-musique.css : idem pour .music-hero, .music-kpis, etc.
  - styles-gaming.css : idem pour .gaming-hero, .gaming-kpis, etc.
  - styles-jarvis.css : idem pour .jrv-layout, .jrv-panel-left, .jrv-message.
  - styles-wiki.css : idem pour .wiki-layout, .wiki-sidebar.

LOT 2 — panels moins critiques (à faire en sprint suivant) : opportunities,
profile, jobs-radar, history, search, ideas, stacks, recos, challenges, signals.

LOT 3 — règles génériques (panel-page, vl-section, etc.) → rester dans
styles-mobile.css car partagées entre panels Veille.

Convention :
- Bloc @media en FIN de fichier panel.
- Pas de !important — les sélecteurs panel suffisent à gagner la spécificité.
- Tester sur Chrome DevTools mobile après chaque lot.

Bumper la version du stylesheet migré (?v=N+1) dans index.html.

Validation :
- styles-mobile.css passe de ~300 à ~100 lignes.
- Chrome DevTools 375px : tous les panels migrés rendent identiquement.
- Aucun !important dans les blocs migrés.
```

**Validation** : mobile reste pixel-identique, mais styles-mobile.css est divisé par 3.

---

#### Prompt 7 — [UX] `JvIcon` → `<Icon>` du système commun

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/panel-jarvis.jsx`, `cockpit/panel-jarvis-lab.jsx`, `cockpit/icons.jsx`

```
Contexte : panel-jarvis.jsx et panel-jarvis-lab.jsx déclarent leur propre composant
JvIcon qui réimplémente une partie des icônes au lieu de réutiliser <Icon> de
cockpit/icons.jsx. Duplication = dérive future garantie (déjà 2 instances
diffèrent entre les 2 panels).

Tâche :
1. Lister les icônes utilisées par JvIcon dans panel-jarvis.jsx et
   panel-jarvis-lab.jsx (grep "JvIcon name=" sur les 2 fichiers).
2. Pour chaque icône absente de cockpit/icons.jsx, l'ajouter au registre
   ICONS de icons.jsx (suivre le pattern existant des autres icônes Lucide).
3. Remplacer chaque <JvIcon name="X" .../> par <Icon name="X" .../>.
4. Supprimer la déclaration de JvIcon des deux panels.
5. Bumper panel-jarvis.jsx?v=4 et panel-jarvis-lab.jsx?v=8 dans index.html.

Validation :
- Aucun <JvIcon /> ne reste dans le codebase (grep "JvIcon" cockpit/ doit
  retourner 0 résultat).
- Les icônes des panels Jarvis et Jarvis Lab restent visuellement
  identiques.
- Bonus : les 3 thèmes (test sidebar bas droit) gardent les bonnes couleurs
  d'icônes.
```

**Validation** : grep `JvIcon` → 0 résultat ; visuellement identique.

---

#### Prompt 8 — [UX] Sidebar — cluster "Plus" auto pour panels zero usage 14j

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/lib/data-loader.js`, `cockpit/nav.js`

```
Contexte : sur 25 entrées sidebar, seules ~8 sont visitées plus de 5 fois/semaine
(cf. usage_events table). Les autres restent visibles en permanence et alourdissent
le scan visuel à chaque visite. Pattern Notion / Linear : ranger automatiquement
sous "Plus" les sections inactives.

Tâche : dans sidebar.jsx, agréger les items dont usage_events 14j == 0 sous un
groupe pliable "Plus".

Modifications :

1. Dans cockpit/lib/data-loader.js (bootTier1), ajouter une requête supplémentaire :

   const usageRows = await sb.query(
     "usage_events",
     `event_type=eq.section_opened&ts=gte.${twoWeeksAgo}&select=payload`
   );
   const usageBySection = {};
   usageRows.forEach(r => {
     const s = r.payload?.section;
     if (s) usageBySection[s] = (usageBySection[s] || 0) + 1;
   });
   COCKPIT_DATA.stats.usage_by_section = usageBySection;

2. Dans sidebar.jsx, après le calcul du nav, post-processer pour clusterer :

   const usage = data.stats.usage_by_section || {};
   const PIN_LIST = ["brief", "top", "jarvis", "ideas"]; // toujours visible
   const dynamicNav = data.nav.map(g => {
     // Pour les groupes "Lecture" et "Apprentissage", déplacer les items
     // 0-usage 14j vers un groupe "Plus" virtuel.
     const active = g.items.filter(it =>
       PIN_LIST.includes(it.id) || (usage[it.id] || 0) > 0
     );
     const dormant = g.items.filter(it =>
       !PIN_LIST.includes(it.id) && (usage[it.id] || 0) === 0
     );
     return { ...g, items: active, dormant };
   });
   const allDormant = dynamicNav.flatMap(g => g.dormant);

3. Rendre un groupe virtuel "Plus" en fin de nav :
   {allDormant.length > 0 && (
     <div className="sb-group sb-group--plus">
       <button className="sb-group-label sb-group-label--plus" ...>
         <span>Plus ({allDormant.length})</span>
       </button>
       {plusOpen && <ul>...allDormant.map(renderLink)</ul>}
     </div>
   )}

4. Telemetry : ajouter window.track("plus_cluster_opened", {count}) au clic,
   et window.track("plus_cluster_item_opened", {section}) sur les liens.
   Mettre à jour CLAUDE.md.

5. Style dans cockpit/styles.css :
   .sb-group--plus .sb-group-label { color: var(--tx3); }
   .sb-group--plus .sb-group-label:hover { color: var(--tx2); }

6. Bumper sidebar.jsx?v=9 et data-loader.js?v=37.

Validation :
- Premier login après 14 jours d'absence sur Stacks/Review → ces items
  apparaissent sous "Plus".
- Cliquer Stacks puis revenir le lendemain → Stacks remonte au groupe d'origine
  (l'event section_opened a été enregistré).
```

**Validation** : sidebar plus propre ; le scan visuel se concentre sur 8-10 items réellement utilisés.

---

#### Prompt 9 — [JARVIS] J5 Audio queue + lecteur footer global — Partie 1 : structure

**Priorité** : P1
**Dépend de** : Aucun
**Fichiers concernés** : `cockpit/lib/audio-queue.js` (nouveau), `index.html`, `cockpit/styles.css`

```
Contexte : aujourd'hui, la chip "Lecture audio" du brief réinitialise le speech
à chaque démarrage. Pas de file, pas de progress, pas de continuité entre panels.
Pour un cockpit consommé en marche, c'est la fonctionnalité qui transforme le
produit. Cf. mockup 3 du livrable d'audit.

Tâche partie 1 : créer le module global audio-queue.js qui expose :

   window.cockpitAudio = {
     enqueue({ id, label, text }),  // ajoute un item à la file
     play(),                         // lance la lecture
     pause(),
     resume(),
     skip(),                         // passe au suivant
     setRate(r),
     getState(),                     // { state, queue, current, progress }
     subscribe(fn)                   // pour le footer UI
   };

Fichier nouveau cockpit/lib/audio-queue.js :

(function(){
  const state = { state: "idle", queue: [], current: null, rate: 1.0, progress: 0 };
  const subs = new Set();
  const notify = () => subs.forEach(fn => { try { fn(state); } catch {} });
  let utterance = null;

  function speak(item){
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    utterance = new SpeechSynthesisUtterance((item.label ? item.label + ". " : "") + item.text);
    utterance.lang = "fr-FR";
    utterance.rate = state.rate;
    utterance.onend = () => { state.current = null; state.progress = 0; nextOrIdle(); };
    utterance.onerror = () => { state.current = null; nextOrIdle(); };
    utterance.onboundary = (e) => {
      const total = (item.text || "").length;
      state.progress = total ? Math.min(1, e.charIndex / total) : 0;
      notify();
    };
    state.current = item;
    state.state = "playing";
    synth.speak(utterance);
    notify();
  }
  function nextOrIdle(){
    if (state.queue.length){
      const item = state.queue.shift();
      speak(item);
    } else { state.state = "idle"; notify(); }
  }
  window.cockpitAudio = {
    enqueue(item){
      state.queue.push(item);
      if (state.state === "idle") nextOrIdle(); else notify();
    },
    play(){ if (state.state === "paused") { speechSynthesis.resume(); state.state = "playing"; notify(); } },
    pause(){ if (state.state === "playing") { speechSynthesis.pause(); state.state = "paused"; notify(); } },
    skip(){ speechSynthesis.cancel(); state.current = null; nextOrIdle(); },
    setRate(r){ state.rate = r; if (utterance) utterance.rate = r; notify(); },
    getState(){ return { ...state }; },
    subscribe(fn){ subs.add(fn); fn(state); return () => subs.delete(fn); }
  };
})();

Charger le script dans index.html APRÈS bootstrap.js et AVANT app.jsx :
   <script src="cockpit/lib/audio-queue.js?v=1"></script>

Validation partie 1 :
- console.log(window.cockpitAudio.getState()) → { state: "idle", queue: [], ... }
- window.cockpitAudio.enqueue({ id: "test", label: "Test", text: "Hello world" })
  → la voix lit "Test. Hello world" et l'état repasse à idle.
- window.cockpitAudio.subscribe(s => console.log(s.state)) puis enqueue 2 items
  → on voit "playing" → "playing" → "idle".
```

**Validation** : moteur audio global fonctionnel, testable depuis la console.

---

#### Prompt 10 — [JARVIS] J5 Audio queue — Partie 2 : surface UI + chip home

**Priorité** : P1
**Dépend de** : Prompt 9
**Fichiers concernés** : `cockpit/components-audio-player.jsx` (nouveau), `cockpit/home.jsx`, `cockpit/app.jsx`, `cockpit/styles.css`, `index.html`

```
Contexte : suite du prompt 9. Maintenant que le moteur audio existe, surface
visuelle = un chip footer global qui affiche l'état + permet pause/skip/rate +
disparaît quand idle.

Tâche partie 2 :

1. Créer cockpit/components-audio-player.jsx :

   function AudioFooterPlayer(){
     const [state, setState] = React.useState(window.cockpitAudio.getState());
     React.useEffect(() => window.cockpitAudio.subscribe(setState), []);
     if (state.state === "idle" || !state.current) return null;
     const c = state.current;
     return (
       <div className="audio-footer" role="status" aria-live="polite">
         <button className="audio-btn" onClick={state.state === "playing"
           ? () => window.cockpitAudio.pause()
           : () => window.cockpitAudio.play()}>
           <Icon name={state.state === "playing" ? "pause" : "play"} size={14} />
         </button>
         <div className="audio-meta">
           <span className="audio-label">{c.label}</span>
           <div className="audio-progress">
             <div className="audio-progress-fill" style={{ width: `${state.progress * 100}%` }} />
           </div>
         </div>
         {state.queue.length > 0 && <span className="audio-next">+{state.queue.length} en file</span>}
         <button className="audio-btn" onClick={() => window.cockpitAudio.skip()} title="Suivant">
           <Icon name="skip" size={14} />
         </button>
         <select className="audio-rate" onChange={(e) => window.cockpitAudio.setRate(Number(e.target.value))} defaultValue="1">
           <option value="0.85">0.85×</option><option value="1">1×</option>
           <option value="1.2">1.2×</option><option value="1.5">1.5×</option>
         </select>
         <button className="audio-btn audio-btn--close" onClick={() => { window.cockpitAudio.skip(); state.queue.length = 0; }} title="Fermer">×</button>
       </div>
     );
   }
   window.AudioFooterPlayer = AudioFooterPlayer;

2. Dans cockpit/app.jsx, juste avant </main> ou en racine de l'App, ajouter :
   <AudioFooterPlayer />

3. Dans cockpit/home.jsx, modifier AudioBriefChip pour utiliser l'API queue :
   - Au clic → window.cockpitAudio.enqueue({ id: "macro", label: macro.title, text: macro.body })
   - Plus de gestion locale d'état, on lit window.cockpitAudio.getState() via subscribe.

4. Ajouter un chip "Ajouter à la file audio" sur chaque top-card et item Veille
   (si t.summary && t.summary.length > 200) :
   <button className="card-action" onClick={(e) => {
     e.stopPropagation();
     window.cockpitAudio.enqueue({
       id: t._id || t.id, label: t.source + " · " + t.title, text: t.summary
     });
   }}><Icon name="play" size={12} /></button>

5. Styles cockpit/styles.css :

   .audio-footer {
     position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
     z-index: 200;
     display: flex; align-items: center; gap: 12px;
     padding: 10px 14px;
     background: var(--surface); border: 1px solid var(--bd);
     border-radius: 999px;
     box-shadow: var(--shadow-lg);
     max-width: 640px; min-width: 320px;
   }
   .audio-meta { flex: 1; min-width: 0; }
   .audio-label {
     font-size: var(--text-sm); color: var(--tx);
     white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
     display: block;
   }
   .audio-progress {
     height: 2px; background: var(--bg2); margin-top: 4px;
     border-radius: 2px; overflow: hidden;
   }
   .audio-progress-fill {
     height: 100%; background: var(--brand); transition: width 200ms linear;
   }
   .audio-btn {
     width: 32px; height: 32px; border-radius: 50%;
     display: flex; align-items: center; justify-content: center;
     color: var(--tx); background: var(--bg2);
     border: 1px solid var(--bd);
   }
   .audio-btn:hover { background: var(--brand-tint); }
   .audio-rate {
     font-family: var(--font-mono); font-size: var(--text-xs);
     background: var(--bg2); border: 1px solid var(--bd);
     border-radius: 6px; padding: 4px 6px;
   }
   .audio-next {
     font-family: var(--font-mono); font-size: var(--text-2xs);
     letter-spacing: 0.08em; text-transform: uppercase;
     color: var(--tx3);
   }

   @media (max-width: 760px) {
     .audio-footer { left: 14px; right: 14px; transform: none;
       max-width: none; min-width: 0; }
     .audio-rate { display: none; }
   }

6. Bumper home.jsx?v=5, app.jsx?v=31, styles.css?v=26.

7. Telemetry events : `audio_enqueued` { source }, `audio_skipped`, `audio_rate_changed` { rate }.
   Mettre à jour CLAUDE.md.

Validation :
- Cliquer le chip "Lecture audio" du brief → la voix démarre + le footer player apparaît.
- Naviguer vers Top → la voix continue + le player reste visible.
- Cliquer "+ ajouter à la file" sur 2 articles → la file montre +2.
- Skip → passe au suivant ; idle quand vide → player disparaît.
- Mobile 375px : le player tient sur toute la largeur.
```

**Validation** : audio queue cross-panel, lecture continue navigation, file visible, accessible mobile.

---

### P2 — Polish et features Jarvis avancées

#### Prompt 11 — [JARVIS] J1 Smart sidebar — items remontent au sommet par activité

**Priorité** : P2
**Dépend de** : Prompt 8 (recommandé)
**Fichiers concernés** : `cockpit/sidebar.jsx`, `cockpit/lib/data-loader.js`

```
Contexte : suite logique du Prompt 8. Une fois les items dormants rangés sous
"Plus", on peut aussi RÉORDONNER les items actifs par activité récente :
items avec unread > 0 OU edited dans les 24h en haut de leur groupe.

Tâche : dans sidebar.jsx, sortir les items de chaque groupe (hors PIN_LIST)
par score d'activité décroissant.

Score :
- +100 si item.unread > 0
- +50 si l'item a été ouvert dans les dernières 24h
- +10 par event section_opened sur les 7 derniers jours

Modifications :

1. Dans data-loader.js (à la suite du Prompt 8), enrichir avec usage 24h :
   const usage24h = ... // requête supplémentaire usage_events ts > now-24h

2. Dans sidebar.jsx, post-processer chaque groupe :
   const PIN_LIST = ["brief"];
   const score = (it) => {
     let s = 0;
     if (it.unread > 0) s += 100;
     if ((usage24h[it.id] || 0) > 0) s += 50;
     s += (usage[it.id] || 0) * 10;
     return s;
   };
   const sortedNav = dynamicNav.map(g => ({
     ...g,
     items: [...g.items].sort((a, b) => {
       if (PIN_LIST.includes(a.id)) return -1;
       if (PIN_LIST.includes(b.id)) return 1;
       return score(b) - score(a);
     })
   }));

3. Animation : pour éviter le sapin de Noël à chaque visite, persister l'ordre
   en localStorage avec une clé "sidebar-order-day" = aujourd'hui.iso. Tant que
   la clé est de today, on ne réordonne pas. Au reload demain matin, on recalcule.

4. Bumper sidebar.jsx?v=10.

5. Telemetry : `sidebar_reorder_applied` { items_changed: number }.

Validation :
- Visite J1 : 5 articles non-lus dans Top → Top remonte tout en haut de
  "Aujourd'hui" même si Brief est fixé en pin.
- Visite J1 le soir : 0 unread → Top redescend à sa place naturelle au prochain
  reload demain matin.
- L'ordre ne change PAS entre 2 navigations le même jour (stable).
```

**Validation** : la sidebar pousse vers ce qui est nouveau sans être instable.

---

#### Prompt 12 — [JARVIS] J2 Brief monthly digest — 1er du mois

**Priorité** : P2
**Dépend de** : Aucun
**Fichiers concernés** : `weekly_analysis.py`, nouveau migration SQL, `cockpit/home.jsx` (banner)

```
Contexte : la home delta couvre 24h. À 30 jours d'usage, l'utilisateur n'a aucune
surface pour repérer les TENDANCES inter-semaines : signaux qui montent depuis 5
semaines, concept wiki qui revient dans Jarvis, opportunité récurrente. Il faut
un digest mensuel automatique.

Tâche partie 1 :

1. Créer la migration sql/013_monthly_digest.sql :

   CREATE TABLE monthly_digest (
     month_start DATE PRIMARY KEY,
     digest_html TEXT NOT NULL,
     stats JSONB NOT NULL DEFAULT '{}',
     generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ALTER TABLE monthly_digest ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "monthly_digest_select_authenticated"
     ON monthly_digest FOR SELECT TO authenticated USING (true);
   CREATE POLICY "monthly_digest_insert_service"
     ON monthly_digest FOR INSERT TO service_role WITH CHECK (true);

2. Dans weekly_analysis.py, ajouter une étape "monthly_digest" qui ne tourne
   QUE le 1er du mois :

   if datetime.now().day == 1:
       prompt = build_monthly_digest_prompt(
           articles_30d=fetch_articles_last_30_days(),
           signals_compare=fetch_signals_4_weeks(),
           wiki_top_cited=fetch_wiki_top_cited_this_month(),
           challenges_done=fetch_challenges_completed_last_month(),
           ideas_status_changes=fetch_ideas_status_changes_30d(),
       )
       digest_html = call_claude_haiku(prompt, max_tokens=2000)
       sb_post("monthly_digest", {
           "month_start": last_month_first_day_iso,
           "digest_html": digest_html,
           "stats": { ... }
       })

3. Côté front (Prompt 13 partie 2 ci-dessous) — séparé pour atomicité.

Validation partie 1 :
- python weekly_analysis.py --force-monthly → la table monthly_digest contient
  une ligne pour le mois précédent.
- Le digest_html est un récap structuré : signaux delta 4 semaines, wiki cités,
  challenges, idées.
```

**Validation** : la table existe, peut être remplie manuellement le 1er du mois, prête à être surfacée côté front.

---

#### Prompt 13 — [JARVIS] J2 Brief monthly digest — Partie 2 : banner home

**Priorité** : P2
**Dépend de** : Prompt 12
**Fichiers concernés** : `cockpit/home.jsx`, `cockpit/styles.css`

```
Contexte : suite du prompt 12. Le digest existe en base. Il faut le surfacer au
premier visite après le 1er du mois, jusqu'à acquittement.

Tâche partie 2 :

1. Dans home.jsx, ajouter un useEffect qui charge le digest du mois précédent :

   const [monthlyDigest, setMonthlyDigest] = React.useState(null);
   const [digestDismissed, setDigestDismissed] = React.useState(() => {
     try { return localStorage.getItem("monthly-digest-dismissed") || ""; }
     catch { return ""; }
   });
   React.useEffect(() => {
     (async () => {
       const lastMonth = ... // 1er jour du mois précédent au format YYYY-MM-DD
       if (digestDismissed === lastMonth) return;
       try {
         const rows = await window.sb.query(
           "monthly_digest", `month_start=eq.${lastMonth}&select=*&limit=1`
         );
         if (rows && rows[0]) setMonthlyDigest(rows[0]);
       } catch {}
     })();
   }, []);

2. Rendre un banner en haut du Home (au-dessus du PageHeader) si monthlyDigest :

   {monthlyDigest && (
     <div className="monthly-banner">
       <div className="monthly-banner-eyebrow">Digest mensuel · {monthLabel}</div>
       <h2 className="monthly-banner-title">Ton mois écoulé en un coup d'œil</h2>
       <div className="monthly-banner-actions">
         <button className="btn btn--primary btn--sm" onClick={() => onNavigate("monthly")}>
           Lire le digest <Icon name="arrow_right" size={12} />
         </button>
         <button className="btn btn--ghost btn--sm" onClick={() => {
           localStorage.setItem("monthly-digest-dismissed", monthlyDigest.month_start);
           setDigestDismissed(monthlyDigest.month_start);
         }}>
           Marquer comme vu
         </button>
       </div>
     </div>
   )}

3. Créer panel-monthly.jsx + ajouter à app.jsx (ou réutiliser un panel
   existant). Affiche digest_html via DOMPurify.

4. Style :
   .monthly-banner {
     padding: 24px 32px;
     background: linear-gradient(135deg, var(--brand-tint), var(--bg3));
     border: 1px solid var(--bd);
     border-radius: var(--radius-lg);
     margin-bottom: var(--space-5);
   }
   .monthly-banner-title { font-family: var(--font-display);
     font-size: var(--text-2xl); margin: 6px 0 14px; }

5. Bumper home.jsx?v=6 + nouveau panel + styles.

6. Telemetry : `monthly_digest_shown` { month }, `monthly_digest_dismissed` { month },
   `monthly_digest_opened` { month }. Mettre à jour CLAUDE.md.

Validation :
- 1er du mois après que le pipeline ait tourné : home affiche le banner en
  premier.
- Cliquer "Lire le digest" → ouvre le panel dédié avec le HTML rendu.
- Cliquer "Marquer comme vu" → le banner disparaît jusqu'au prochain mois.
```

**Validation** : surface mensuelle visible sans submerger le quotidien.

---

#### Prompt 14 — [JARVIS] J7 Command palette — préfixe `>` pour commandes

**Priorité** : P2
**Dépend de** : Prompt 2
**Fichiers concernés** : `cockpit/command-palette.jsx`

```
Contexte : la palette Ctrl+K est aujourd'hui une recherche pauvre. Les éditeurs
modernes (VS Code, Linear) utilisent `>` pour basculer en mode "commandes" :
toggle thème, marquer tout lu, ouvrir spec, créer idée vide, etc.

Tâche : ajouter une section "Commandes" qui s'active dès que la query commence
par `>`.

Modifications dans cockpit/command-palette.jsx :

1. Définir une registry de commandes :

   const COMMANDS = [
     { id: "theme.dawn",    label: "Thème → Dawn",    action: () => setTheme("dawn") },
     { id: "theme.obsidian", label: "Thème → Obsidian", action: () => setTheme("obsidian") },
     { id: "theme.atlas",   label: "Thème → Atlas",   action: () => setTheme("atlas") },
     { id: "mark.all",      label: "Marquer tout lu (top)", action: () => window.__markAllRead && window.__markAllRead() },
     { id: "idea.new",      label: "Créer une idée vide", action: () => onNavigate("ideas") },
     { id: "spec.open",     label: "Ouvrir Jarvis Lab → Specs", action: () => onNavigate("jarvis-lab") },
     { id: "audio.play",    label: "Lire le brief en audio", action: () => window.__audioPlayBrief && window.__audioPlayBrief() },
     { id: "audio.skip",    label: "Suivant (audio queue)", action: () => window.cockpitAudio?.skip() },
     { id: "search.open",   label: "Recherche dédiée", action: () => onNavigate("search") },
   ];

2. Modifier la logique de filtrage : si q.startsWith(">"), les sections
   articles/idée disparaissent et seule la section "Commandes" est rendue.

   const isCommandMode = q.startsWith(">");
   const cmdQ = isCommandMode ? q.slice(1).trim() : "";
   const commandMatches = isCommandMode
     ? COMMANDS.filter(c => !cmdQ || c.label.toLowerCase().includes(cmdQ))
     : [];

   if (isCommandMode) {
     allSections = [{ title: "Commandes", items: commandMatches.map(c => ({ ... })) }]
   }

3. Au clic / Enter sur une commande, exécuter l'action puis fermer :
   it.action(); onClose();

4. Pour les commandes thème, exposer setTheme via window depuis app.jsx.
   Pour markAllRead, exposer __markAllRead depuis home.jsx.

5. Mettre à jour le placeholder input :
   "Chercher, naviguer, > pour commandes, demander à Jarvis…"

6. Telemetry : `command_executed` { id }. Mettre à jour CLAUDE.md.

7. Bumper command-palette.jsx?v=3.

Validation :
- Ctrl+K → tape ">" → la liste passe en mode commandes (théo, marquer, idée…).
- Ctrl+K → ">theme dawn" → Enter → bascule sur Dawn.
- Ctrl+K → ">audio" → liste les 2 commandes audio.
- Sortie du mode commandes en supprimant le > → revient au mode recherche
  normal.
```

**Validation** : palette devient un vrai launcher type VS Code pour power user.

---

## 5. Checklist d'exécution

Ordre recommandé. Effort en unités de 10-15 min.

### Sprint 1 — P0 (≤ 1h45)

| # | Prompt | Effort | Cumul | Dépend de |
|---|---|---|---|---|
| 1 | P1 `prefers-reduced-motion` global | 1u | 15 min | — |
| 2 | P3 Streak freeze | 2u | 45 min | — |
| 3 | P4 Footer cost discret | 1u | 1h00 | — |
| 4 | P2 Command palette nav clavier | 2u | 1h30 | — |
| 5 | P5 Tokens hauteurs bouton | 2u | 1h45 (= cumul) — peut être parallèle | — |

**Critère sprint 1** : friction quotidienne réduite (animations, anxiété coût, streak), command palette devient utilisable en clavier-seul.

### Sprint 2 — P1 (cumul ~3h)

| # | Prompt | Effort | Dépend de |
|---|---|---|---|
| 6 | P6 Mobile sans !important (lot 1) | 4u | — |
| 7 | P7 JvIcon → Icon | 2u | — |
| 8 | P8 Sidebar cluster Plus | 4u | — |
| 9 | P9 Audio queue moteur | 3u | — |
| 10 | P10 Audio queue UI footer | 4u | P9 |

**Critère sprint 2** : sidebar plus claire, audio cross-panel, mobile robuste.

### Sprint 3 — P2 (features Jarvis avancées, cumul ~4h)

| # | Prompt | Effort | Dépend de |
|---|---|---|---|
| 11 | P11 Smart sidebar reorder | 3u | P8 |
| 12 | P12 Monthly digest backend | 4u | — |
| 13 | P13 Monthly digest banner home | 3u | P12 |
| 14 | P14 Command palette commandes `>` | 2u | P2 |

**Critère sprint 3** : la sidebar pousse vers le neuf, le 1er du mois ouvre une rétrospective passive, la palette devient un vrai launcher.

---

## 6. Dépendances et invariants à préserver

Tous les prompts respectent les invariants suivants — à ne pas casser :

- **CSP** : pas d'`<iframe>`, pas d'`object`, pas de chargement de domaine non whitelist (cf. `index.html` meta CSP).
- **No build step** : pas d'`import`/`export` ES modules, exposition via `window.X = X`.
- **DOMPurify obligatoire** sur tout `dangerouslySetInnerHTML` venant de la base (notamment digest_html du prompt 13).
- **localStorage en `try {} catch {}`** (Safari ITP).
- **Telemetry table** : ajouter chaque nouvel `event_type` dans le tableau de la section *Télémétrie* du `CLAUDE.md` AVANT le commit.
- **Specs panels** : toute modif fonctionnelle d'un onglet → update `docs/specs/tab-<slug>.md` + bump `last_updated` dans `docs/specs/index.json`. La CI `lint-specs` bloque le merge sinon.
- **Architecture** : nouveau pipeline / nouvelle table / nouveau panel → update `docs/architecture/` correspondant. La CI `validate-arch` bloque sinon. Le prompt 12 (monthly_digest) impose une mise à jour de `docs/architecture/dependencies.yaml::tables[]`.
- **3 thèmes** : tester chaque modif visuelle dans Dawn, Obsidian, Atlas (toggle sidebar bas).

---

## 7. Hors scope (à creuser plus tard)

- **Jarvis Lab à découper** (J3) — le panel de 1585 lignes mérite un sprint dédié, pas un quick win. Sous-onglets Specs/Architecture/Health avec hash routes.
- **Performance perçue** — `@babel/standalone` parse 38 000 lignes de JSX au load, sans cache HTTP forcé sur certains scripts. Audit Lighthouse + migration progressive vers ESM build serait une transformation, pas un fix.
- **Audit a11y rigoureux** — Axe DevTools sur chaque panel avec auth, contraste WCAG AA sur les 3 thèmes (Atlas radius 2px sur cards photographiques Steam à valider notamment), navigation clavier exhaustive panel par panel.
- **Mode "weekend"** (J11) — sidebar masque updates/claude/signals samedi/dimanche. Demande des règles UX précises (et si je veux quand même y aller le dimanche soir ?). À spec'er avant d'implémenter.
- **Replay 90s** (J12) et **Daily Action push** (J13) — features wow mais demandent des budgets Claude récurrents et un design conversationnel. À traiter en chantier produit, pas en quick win.

---

## Conclusion

Le 26/04 a transformé le cockpit en **24 h d'exécution dense** : la home est passée d'un 4.0 à un 4.4 sur 5, le sidebar à 4.1, et le delta visite récurrente est en place — soit la preuve qu'on peut shipper un audit.

L'audit de J apporte **3 leviers nouveaux** :

1. **Le command palette est un faux positif** — il est annoncé comme power tool mais sans nav clavier, c'est un raccourci creux. Le Prompt 2 le répare en 30 minutes et débloque le pattern `>` pour les commandes (Prompt 14).
2. **Le streak doit pardonner** — passer en "pause" plutôt qu'en reset brutal après 1 jour manqué. À 30 jours d'usage, c'est ce qui sépare un produit qui retient d'un produit qui culpabilise.
3. **L'audio doit traverser les panels** — la chip actuelle est limitée au brief macro et meurt à la navigation. Un lecteur global avec file ouvre l'usage "cockpit en marche" qui change la nature du produit.

L'écart entre "cockpit qui informe" et "cockpit qui retient" se gagne en moins de **8 heures cumulées d'exécution** sur les 14 prompts du livrable. Le sprint 1 (P0) à lui seul (1h45) fait basculer 4 critères. Bonne route.

---

**Annexe — Comparaison J-1 / J en chiffres**

| Mesure | J-1 (26/04) | J (27/04) | Δ |
|---|---|---|---|
| Panels | 23 | 25 | +2 (veille-outils, claude sub-tab) |
| Stylesheets dédiés | 17 | 19 | +2 |
| Lignes CSS panel-spécifique | ~14 800 | ~16 800 | +13 % |
| `@keyframes` total | 22 | 22 | 0 |
| `@keyframes` qui respectent reduced-motion | 5 | 5 | 0 (gap toujours présent) |
| `!important` dans cockpit/styles*.css | 100 | 98 | -2 |
| Tokens définis par thème | 35 | 37 | +2 (`--neutral`, `--neutral-tint`) |
| Score moyen cockpit | 3.61 | 3.55 | -0.06 (effet de mix) |
| Score Brief du jour | 4.0 | 4.4 | +0.4 |
| Score Sidebar | 4.0 | 4.1 | +0.1 |
| Quick wins ouverts (P0) | 8 | 5 | -3 (5 shippés, 5 nouveaux ouverts) |
| Features Jarvis (roadmap) | 15 | 15 | recalibré (J1-J15 reformulés) |
