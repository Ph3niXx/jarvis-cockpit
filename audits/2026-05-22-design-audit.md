# Audit Design Complet — AI Cockpit — 22/05

**Date** : 22 mai 2026 (vendredi)
**Auditeur** : Claude (claude-opus-4-7), audit interactif demandé par Jean (≠ tâche planifiée)
**HEAD audité** : `2cbc3c7` (Merge Jobs Radar — masquage offres clôturées)
**Méthode** : audit code (3 agents parallèles sur les 24 panels métier + lecture directe du design system, des ancres historiques et des gardes a11y). Live derrière OAuth → code-only.

---

## 0. Cadrage — le repo a redémarré

Les 14 audits du 30/04 → 13/05 étaient **gelés sur `6600b64`** (repo figé, matrice immuable à 4.02/5) et avaient fini par recommander la suspension de la routine. **Ce diagnostic est caduc** : il y a eu **36 commits depuis `6600b64`** — slim CLAUDE.md (611→100 lignes) et surtout un gros chantier **Jobs Radar** (vote multi-raison, calibrage par feedback, offres clôturées, migrations 014/015). Le canal d'exécution fonctionne. Cet audit repart donc de zéro sur du code qui a réellement bougé, sans réimprimer la matrice gelée.

**Verdict global** : design system **mature et non-générique** (rare pour un projet perso), mais une **dette de tokenisation systémique** mine la promesse tri-thème. Moyenne fraîche : **~3.75/5** (vs 4.02 figé) — la baisse vient d'un regard neuf qui a trouvé les tokens fantômes, pas d'une régression.

---

## 1. Ce qui est excellent (à préserver)

1. **Design system tri-thème authentique** — `cockpit/themes.js` : 3 directions complètes (Dawn éditorial chaleureux / Obsidian terminal sombre / Atlas Swiss), chacune avec sa typo (Fraunces / Inter / Instrument Serif), son échelle de radius, ses ombres, et un objet `vibe` (densité, style de carte, forme d'accent). Échelle d'espacement 4px et échelle typo tokenisées. Ce n'est **pas** de l'AI-slop : c'est un vrai système de design avec un point de vue.
2. **Accessibilité de base solide** — skip link WCAG 2.4.1 (styles.css:33), `:focus-visible` global tokenisé, et surtout un **kill-switch `prefers-reduced-motion` global** (styles.css:4657) qui neutralise en cascade les 9 animations infinies de tous les stylesheets. Bien pensé.
3. **Patterns d'état exemplaires** quand ils sont faits : `panel-evening.jsx` (4 états distincts + microcopie différenciée avant/après 19h), la **modale + toast de Stacks** (`panel-stacks.jsx:32-150`, focus trap, Esc, `aria-modal`, `role=status`), le **delta-hero + undo toast de Home** (`home.jsx:284-317`).
4. **Visualisations SVG tri-thème natives** — spider radar (`panel-radar.jsx`), hype cycle + graphe de co-occurrences (`panel-signals.jsx`), score chip Jobs Radar : du SVG complexe entièrement piloté par `currentColor` + tokens, qui se re-colorise proprement sur les 3 thèmes.

---

## 2. Problèmes transverses (le vrai sujet)

### 🔴 P0 — Tokens fantômes : la promesse tri-thème est cassée par endroits

Plusieurs panels consomment des variables CSS **qui ne sont définies dans aucun thème** (`themes.js` définit `--tx/--tx2/--tx3`, `--bg/--bg2/--bg3`, `--alert`, `--positive`, `--neutral` — jamais les noms ci-dessous). Le navigateur applique alors le **fallback en dur**, identique sur les 3 thèmes, ou rien.

| Token fantôme | Devrait être | Où | Impact |
|---|---|---|---|
| `--fg`, `--fg-muted`, `--fg-dim`, `--bg-soft` | `--tx`, `--tx2`, `--tx3`, `--bg2` | **`styles-challenges.css` (~78 occurrences)** | Tout le panel Challenges est sous-tokenisé : textes sans couleur explicite, fonds transparents |
| `--negative` | `--alert` | `panel-jobs-radar.jsx:1347`, `panel-ideas.jsx:1003`, `styles-veille-outils.css` (~10×) | Boutons "down"/danger toujours sur hex de secours, jamais sur la palette du thème |
| `--warn` | (créer un token, ou `--neutral`) | `styles.css:3133` `.day-card-row-fill[data-color=warn]{#E89B3A}` | Barre Gaming de Ma Semaine orange en dur sur les 3 thèmes |
| `--div` | `--bd` | `panel-search.jsx:221` | Séparateur gris en dur |
| `--target-pos` | (jamais setté par le JSX) | `styles-radar.css:304` | Label "Cible" de la légende collé à 50% en permanence |

**Challenges = note 2.5/5**, le plus faible du cockpit, presque entièrement à cause de ça (+ hex vert/rouge en dur, voir ci-dessous). C'est le chantier de tokenisation le plus rentable.

### 🟠 P1 — Couleurs hex/oklch codées en dur hors palette de thème

Le pattern récurrent : une couleur d'accent figée qui ne suit pas `--brand` (rouille en Dawn / cyan en Obsidian / indigo en Atlas).

- **Jarvis Lab** — accent **vert néon `rgba(0,255,157,…)`** codé en dur partout (focus, badges, liens, hover, `@keyframes jl-pulse`) : `styles-jarvis-lab.css:166,188,867,1079,1106,1180,1244` + `#8a74ff` violet ligne 771. **Clashe dans les 3 thèmes.** C'est ce qui fait de Jarvis Lab le panel le plus incohérent (2.5/5) — confirmé vs l'audit historique.
- **`rgba(217,119,87,…)`** = la valeur brand de Dawn hard-codée → reste orange en Atlas/Obsidian : `styles-wiki.css:177,299,461,683…`, `styles-challenges.css:138,225,715`.
- **`oklch()` en dur** pour les niveaux/types : `styles-radar.css:275,403`, `styles-recos.css:164` → pas d'override sombre, fond clair forcé en Obsidian.
- **`#c57455`** (closing) répété 6× dans `styles-opportunities.css`, **`CAT_COLOR`** 5 hex inline dans `panel-ideas.jsx:20`, **heatmaps rust `rgba(168,74,34)`** en dur dans musique/gaming.

→ Remède générique : `color-mix(in srgb, var(--brand) X%, transparent)` ou les tokens `--alert/--positive/--neutral`. Le carnet d'idées le fait déjà bien (`panel-ideas.jsx` D&D en `color-mix`).

### 🟠 P1 — Boutons morts (fausse affordance)

- `home.jsx:591` — `card-action--bookmark` ("Garder cet article") : **aucun `onClick`**. Signalé depuis le 28/04, toujours là.
- `panel-jarvis.jsx:796-797` — paperclip ("Joindre un fichier") + micro ("Dicter") : **aucun `onClick`**, ne font rien. À brancher ou passer `disabled` + tooltip "bientôt".
- `cockpit/styles.css:62-103` — bloc `.variant-bar` **mort** (0 usage JSX), 42 lignes de CSS avec 7 hex hors tokens. Signalé 4× depuis le 08/05, jamais supprimé.

### 🟡 P1 — `alert()` / `confirm()` / `prompt()` natifs hors design system

Stacks a migré vers toast/modale ; **Profile et Jarvis sont restés aux dialogues navigateur** : `panel-profile.jsx:309,316,323,353,360,399` (alert + confirm), `panel-jarvis.jsx:584,602`, `panel-search.jsx:64` (`window.prompt`), `panel-history.jsx:310`. Incohérence UX visible et rupture du langage visuel.

### 🟡 P1 — Accessibilité : boutons icône sans `aria-label`

Plusieurs boutons icône-seule n'ont qu'un `title` (insuffisant pour lecteur d'écran) : `panel-jarvis.jsx:644,796-800` (search/settings/paperclip/mic/send), `panel-veille.jsx:597-606` (lu/archiver/ouvrir), `panel-signals.jsx:169,259`, `panel-wiki.jsx:95` (clear `×`). Home le fait bien (aria-label présent) → incohérence interne facile à résoudre.

### 🟡 P2 — Dettes diverses

- **`styles-mobile.css` : 80 `!important`** — la feuille mobile se bat contre la spécificité au lieu d'être structurée par cascade/`@layer`. Fragile à maintenir.
- **Styles inline massifs** bypassant le DS : `panel-search.jsx`, `panel-opportunities.jsx` (8 props inline répétées), `panel-ideas.jsx`, `panel-signals.jsx` (TweaksPanel entier en inline).
- **Valeurs/dates codées en dur** : `panel-week.jsx:56` `todayIdx=1` (Mardi figé, la surbrillance "aujourd'hui" ne suit pas la vraie date), `panel-opportunities.jsx:356` `new Date("2026-04-21")` (timeline figée), `panel-musique.jsx:299` KPI `"+8%"` **en dur** (donnée potentiellement mensongère).
- **Incohérence typo titres** : Jobs Radar utilise `--font-display` pour les titres éditoriaux, Opportunités/Idées utilisent `--font-serif` pour le même rôle.
- **Jobs Radar hors gabarit** : padding propre `40px 48px` + `max-width:1440px` (`styles-jobs-radar.css:7`) alors que les autres panels suivent `.panel-page`. Rupture de gabarit (volontaire mais notable).
- **`scrollIntoView({behavior:"smooth"})`** en JS (`panel-signals.jsx:761,795`) échappe au kill-switch reduced-motion (le CSS `scroll-behavior` ne peut pas neutraliser un smooth JS explicite).

---

## 3. Matrice fraîche (24 panels métier)

Note /5, regard neuf au HEAD `2cbc3c7`. Critères : cohérence DS · densité · interaction · a11y · mobile.

| Panel | Note | Note principale |
|---|---|---|
| Home (Brief) | 4.5 | Pièce maîtresse ; `card-action--bookmark` mort |
| Miroir du soir | 4.5 | États exemplaires |
| Stacks & Limits | 4.5 | Modale/toast/a11y modèle |
| Forme | 4.5 | Hero composition + empty states honnêtes |
| Jobs Radar | 4.5 | Le plus récent et abouti ; `--negative` fantôme, hors gabarit |
| Radar compétences | 4.0 | Spider SVG tokenisé ; `oklch` en dur, `--target-pos` mort |
| Recherche | 4.0 | Command-K abouti ; styles inline, `--div` fantôme |
| Signaux faibles | 4.0 | 3 vues SVG ambitieuses ; inline + smooth-scroll JS |
| Musique | 4.0 | Now-playing live ; heatmap rust + KPI "+8%" en dur |
| Gaming (perso+TFT) | 4.0 | Riche ; hex statuts/Steam en dur |
| History | 4.0 | Archive soignée ; `alert()`, drawer sans `aria-modal` |
| Veille IA | 3.5 | Très complet ; `#888` en dur, iconbtn sans aria-label |
| Veille outils | 3.5 | Workflow propre ; `--negative` fantôme massif |
| Ma semaine | 3.5 | Lisible ; `todayIdx` figé, barre `warn` en dur |
| Top du jour | 4.0 | Layout magazine ; empty state inline |
| Revue du jour | 4.0 | Flow clavier net ; pas d'état error |
| Wiki IA | 3.5 | Solide ; `rgba(217,119,87)` brand en dur, clear sans label |
| Recos | 3.5 | Hiérarchie claire ; `oklch` en dur, variante morte |
| Jarvis (chat) | 3.5 | Chat élégant ; paperclip/mic morts + sans aria-label |
| Mon profil | 3.5 | Ambitieux ; `alert/confirm` partout, terminal hors-thème |
| Opportunités | 3.0 | Triple vue ; `#c57455` répété, inline lourd, timeline figée |
| Carnet d'idées | 3.0 | D&D propre ; `CAT_COLOR` hex en dur, très inline |
| Jarvis Lab | 2.5 | Riche mais accent **vert néon en dur** → clashe 3 thèmes |
| Challenges | 2.5 | Flow complet mais **~78 tokens fantômes** → quasi non-thémé |

**Forces** : Home, Soir, Stacks, Forme, Jobs Radar. **À traiter en priorité** : Challenges (P0 tokens), Jarvis Lab (P1 accent), Jarvis (boutons morts + a11y).

---

## 4. Propositions d'amélioration — priorisées (Impact × Effort)

| # | Action | Impact | Effort | Fichiers |
|---|---|---|---|---|
| **1** | **Re-tokeniser `styles-challenges.css`** : `--fg→--tx`, `--fg-muted→--tx2`, `--fg-dim→--tx3`, `--bg-soft→--bg2` ; hex vert/rouge → `--positive`/`--alert` | 🟢🟢🟢 | moyen | `styles-challenges.css` |
| **2** | **Mapper `--negative` → `--alert`** partout (token inexistant) | 🟢🟢🟢 | faible | jobs-radar.jsx, ideas.jsx, veille-outils.css |
| **3** | **Tokeniser l'accent Jarvis Lab** : `rgba(0,255,157)` + `#8a74ff` → `var(--brand)` / `color-mix` | 🟢🟢🟢 | moyen | `styles-jarvis-lab.css` |
| **4** | **Brancher ou désactiver les boutons morts** : `card-action--bookmark`, paperclip, mic | 🟢🟢 | faible | home.jsx, panel-jarvis.jsx |
| **5** | **Supprimer le dead code `.variant-bar`** (-42 lignes) | 🟢 | très faible | styles.css:62-103 |
| **6** | **Ajouter `aria-label`** aux boutons icône (jarvis, veille, signals, wiki) | 🟢🟢 | faible | 4 panels |
| **7** | **Migrer `alert/confirm/prompt` → toast/modale** (réutiliser le pattern Stacks) | 🟢🟢 | moyen | profile.jsx, jarvis.jsx, search.jsx |
| **8** | **Remplacer les hex brand/oklch en dur** par `--brand`/`color-mix` | 🟢🟢 | moyen | wiki, recos, radar, opportunities, ideas |
| **9** | **Dériver `todayIdx` / dates de la vraie date** + KPI musique des vraies données | 🟢🟢 | faible | week.jsx, opportunities.jsx, musique.jsx |
| **10** | **Auditer/restructurer les 80 `!important`** de mobile (cascade `@layer`) | 🟢 | élevé | styles-mobile.css |

**Trois quick-wins à ratio impact/effort maximal** : #2 (mapper `--negative`), #5 (supprimer variant-bar), #4 (boutons morts). Tous < 30 min, 0 risque de régression, et prouvent un canal d'exécution sain après le redémarrage du repo.

---

## 5. Prompt prêt-à-coller — Quick-win #2 (token `--negative` fantôme)

```
Dans jarvis-cockpit, le token CSS --negative est utilisé en fallback mais
n'est défini dans AUCUN thème de cockpit/themes.js (qui définit --alert pour
le rouge/danger). Résultat : les éléments concernés tombent toujours sur le
hex de secours, jamais sur la palette du thème actif.

Remplace toutes les occurrences de var(--negative, <hex>) par var(--alert) :
  - cockpit/panel-jobs-radar.jsx (vote "down", ~ligne 1347)
  - cockpit/panel-ideas.jsx (~ligne 1003)
  - cockpit/styles-veille-outils.css (toutes les occurrences --negative)

Vérifie d'abord l'inventaire :
  grep -rn "\-\-negative" cockpit/

Après édition : grep -rn "\-\-negative" cockpit/ doit retourner 0.
Teste visuellement les 3 thèmes (Dawn/Obsidian/Atlas) sur Jobs Radar (vote 👎),
Carnet d'idées et Veille outils : le rouge doit suivre --alert de chaque thème.

Specs : aucune modif fonctionnelle → pas de MAJ docs/specs/.
CLAUDE.md : aucune. Migration : aucune.
Bump sw.js : oui si un .css/.jsx listé dans STATIC[] change → node scripts/sync-sw.mjs

Commit : git commit -m "fix(themes): mappe le token fantome --negative vers --alert"
```

---

## Dernière MAJ

**2026-05-22** : audit frais au HEAD `2cbc3c7` (repo redémarré, 36 commits depuis l'état gelé `6600b64`). Matrice ré-évaluée panel par panel (moyenne ~3.75/5, différenciée). Découverte centrale : **tokens fantômes** (`--fg*`, `--negative`, `--warn`, `--div`, `--bg-soft`) qui cassent la promesse tri-thème, surtout sur Challenges (P0) et Jarvis Lab (accent vert néon en dur, P1). 10 propositions priorisées + 1 prompt prêt-à-coller pour le quick-win le plus rentable.
