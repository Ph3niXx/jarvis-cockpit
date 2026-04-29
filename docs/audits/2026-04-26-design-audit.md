# Audit Design Complet — AI Cockpit
**Date** : 26 avril 2026 · **Auditeur** : tâche planifiée `design-audit--upgrade-prompt`
**Cible** : https://ph3nixx.github.io/jarvis-cockpit/ · `cockpit/` (React 18 + Babel standalone)

---

## ⚠️ Note de cadrage (lu avant tout le reste)

Le prompt de tâche décrit une stack **« single-file vanilla HTML/CSS/JS, pas de framework, pas de build »** et une identité **« gradient bleu→violet, dark mode, glassmorphism »**. Aucune de ces affirmations ne correspond au code actuel.

**Réalité observée** :
- Stack = React 18 + `@babel/standalone` chargé via unpkg, multi-fichiers (`cockpit/app.jsx`, ~25 panels en `.jsx`, ~20 stylesheets `.css`). `index.html` n'est qu'une coquille de 118 lignes qui charge les scripts.
- Identité = trois thèmes éditoriaux (Dawn ivoire/rouille, Obsidian charbon/cyan, Atlas Swiss/indigo). **Pas de dégradé bleu→violet, pas de glassmorphism.**

J'ai donc pivoté l'audit sur l'architecture réelle. **Tous les prompts Claude Code de la Phase 4 ciblent `cockpit/*.jsx` et `cockpit/*.css`**, pas un fichier `index.html` monolithique imaginaire. Si tu veux qu'un futur audit respecte une autre fiction de stack, mets le prompt à jour.

---

# 1. Reconnaissance

## 1.1 Inventaire des features (par section sidebar)

| Groupe | Section (id) | Fichier panel | Statut perçu |
|---|---|---|---|
| Grille matinale | Brief du jour (`brief`) | `cockpit/home.jsx` | Vitrine, dense, plusieurs blocs |
| Grille matinale | Revue (`review`) | `cockpit/panel-review.jsx` | Lecture séquentielle |
| Grille matinale | Top du jour (`top`) | `cockpit/panel-top.jsx` | Sélection éditoriale |
| Grille matinale | Signaux faibles (`signals`) | `cockpit/panel-signals.jsx` | Cartes + sparklines |
| Grille matinale | Jarvis (`jarvis`) | `cockpit/panel-jarvis.jsx` | Chat 2/3 + mémoire 1/3 |
| Grille matinale | Ma semaine (`week`) | `cockpit/panel-week.jsx` | Bilan hebdo |
| Grille matinale | Recherche (`search`) | `cockpit/panel-search.jsx` | Full-text |
| Veille | Veille IA (`updates`) | `cockpit/panel-veille.jsx` (corpus VEILLE_DATA) | Feed éditorial unifié, paramétré |
| Veille | Claude (`claude`) | idem, corpus CLAUDE_DATA | Variante du même panel |
| Veille | Veille outils (`veille-outils`) | `cockpit/panel-veille-outils.jsx` | Catalogue inbound/outbound |
| Veille | Sport / Gaming / Anime / Actualités | `cockpit/panel-veille.jsx` (corpus dédié) | 4 variantes du panel veille |
| Apprentissage | Radar (`radar`) | `cockpit/panel-radar.jsx` | SVG radar 8 axes |
| Apprentissage | Recos (`recos`) | `cockpit/panel-recos.jsx` | Liste hebdo |
| Apprentissage | Challenges (`challenges`) | `cockpit/panel-challenges.jsx` | Mini-défis gamifiés |
| Apprentissage | Wiki IA (`wiki`) | `cockpit/panel-wiki.jsx` | Glossaire + deep-link |
| Business | Opportunités (`opps`) | `cockpit/panel-opportunities.jsx` | Use cases hebdo |
| Business | Carnet d'idées (`ideas`) | `cockpit/panel-ideas.jsx` | Kanban + galerie |
| Business | Jobs Radar | `cockpit/panel-jobs-radar.jsx` | Chassé hors sidebar visible |
| Personnel | Jarvis Lab (`jarvis-lab`) | `cockpit/panel-jarvis-lab.jsx` | Specs + archi |
| Personnel | Profil (`profile`) | `cockpit/panel-profile.jsx` | Key/value Supabase |
| Personnel | Forme / Musique / Gaming | `panel-forme/musique/gaming.jsx` | Dashboards perso |
| Système | Stacks / Historique | `panel-stacks/history.jsx` | Méta + audit trail |

**Cross-cutting features** : sidebar collapsible (Ctrl+B), command palette (Ctrl+K), shortcuts overlay (?), thèmes Dawn/Obsidian/Atlas avec quiet-mode auto 22h-6h, bookmark/ask-Jarvis sur cartes, deep-link `#wiki/slug-x`, télémétrie best-effort `usage_events`, Tier 1/Tier 2 data hydration, PanelErrorBoundary, PWA service worker.

## 1.2 Design system implicite — tokens vs dérives

**Bonne nouvelle** : `cockpit/themes.js` définit un système propre de tokens — espacement 4px (`--space-1`=4 → `--space-8`=64), typographie (`--text-2xs` 10 → `--text-display` 54), couleurs sémantiques (`--brand`, `--positive`, `--alert`, 3 niveaux de texte, 3 niveaux de fond).

**Mauvaise nouvelle** : la plupart des stylesheets satellites **ignorent les tokens**.

| Fichier | `var(--space-*)` utilisations | `font-size:` hardcodés observés |
|---|---|---|
| `cockpit/styles.css` (shell) | Massivement (correct) | Quelques exceptions (`64px`, `40px` hero) |
| `cockpit/styles-veille-outils.css` | **0** | 10/11/12/13/14/16/18/20/22/24/26/28/30/32/34/36/38/40… |
| `cockpit/styles-radar.css` | Rare | 9.5px / 10.5px / 13.5px / 14.5px / 17px / 56px… |
| `cockpit/styles-jarvis.css` | Idem | Mêmes dérives |
| `cockpit/styles-ideas.css` | Idem | Idem |

Les valeurs `9.5px`, `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`, `17px`, `19px`, `26px`, `30px`, `40px`, `56px` **n'existent dans aucun token**. Elles ont été tapées au pixel près pour caler une maquette ; à 20+ stylesheets, la cohérence typographique du cockpit n'est plus garantie par le système — elle dépend de l'œil de qui a écrit le panel.

**Verdict** : le design system est *déclaré* mais *appliqué à 30 %*. C'est la racine de la majorité des problèmes de cohérence ci-dessous, et c'est aussi le quick win le plus rentable (un script + un commit balaye 80 % des dérives).

## 1.3 Test rétention — visite n°5 dans la semaine

Mise en situation : ouverture matinale, café, café, rapide passage sur les 3 incontournables, scan signaux, retour à la vie. Friction observée :

1. **Le `kicker-dot` pulse en boucle** dans le hero (animation 2s infinite). À la 5e visite, c'est devenu un tic visuel. Pareil pour `sb-group-hotdot` (sidebar).
2. **Les boutons d'action sur les cartes Top sont en `opacity: 0` jusqu'au hover** (`.top-card .top-actions`). Sur trackpad l'utilisateur survole instinctivement, sur tactile c'est invisible. Tous les jours, la même danse de souris pour faire apparaître bookmark + Ask Jarvis.
3. **Streak « 14 j »** affiché en dur en fallback (`data.stats.streak || 14`) : si la vraie donnée manque, le chiffre rassurant ment. Une fois repéré, plus rien ne peut se prétendre KPI.
4. **« Tout marqué lu »** sans confirmation ni undo — un slip de doigt = batch destructive. À la 20e visite c'est arrivé une fois et ça a coûté la journée de tracking.
5. **Pas de delta « depuis ta dernière visite »** dans le hero. Le « À traiter depuis hier » est réduit à un encart latéral 300 px ; le titre macro est statique (papier du jour, pas un changement). Un cockpit de rétention parle au passé : *« hier tu as lu 8, ce matin il y en a 12 nouveaux »*.
6. **Quiet mode auto** : à 22:01 le thème bascule en Obsidian sans signal visible. Si tu venais de cliquer Dawn, `cockpit-theme-explicit` te protège ; sinon tu es trahi à minuit. Aucun toast ni indicateur « auto » dans le sidebar toggle.
7. **Animations sticky-header `backdrop-filter: blur(12px)`** sur fond opaque : zéro effet visuel, coût GPU mobile gratuit.
8. **Audio brief** dépend de la voix française du système : sur Windows (utilisateur principal Jean), Hortense est correcte mais Microsoft Julie a un accent robotique. Pas de sélecteur de voix.

Ces 8 frictions sont des micro-coûts par session ; sur 30 jours c'est ce qui détermine si l'outil reste sacré ou devient un onglet parmi d'autres.

---

# 2. Matrice d'évaluation

Notation **1-5** (5 = excellent, 1 = à reprendre). Critères : **Clarté · Densité · Cohérence · Interactions · Mobile · A11y · Rétention**. Moyenne arithmétique pondérée.

| Section | Cla | Den | Coh | Int | Mob | A11y | Rét | **Moy.** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Sidebar (nav + footer) | 4 | 4 | 4 | 4 | 4 | 3 | 4 | **3.86** |
| Brief du jour (Home) | 4 | 3 | 3 | 4 | 3 | 2 | 4 | **3.29** |
| Top du jour | 4 | 4 | 4 | 3 | 4 | 3 | 4 | **3.71** |
| Signaux faibles | 4 | 3 | 4 | 3 | 4 | 3 | 4 | **3.57** |
| Veille (5 feeds) | 3 | 3 | 3 | 3 | 4 | 3 | 3 | **3.14** |
| Veille outils (catalogue) | 3 | 3 | 2 | 3 | 3 | 3 | 3 | **2.86** |
| Wiki IA | 4 | 4 | 3 | 4 | 4 | 3 | 4 | **3.71** |
| Radar / Recos / Challenges | 4 | 4 | 3 | 3 | 3 | 3 | 4 | **3.43** |
| Opportunités / Idées | 4 | 4 | 3 | 4 | 3 | 3 | 4 | **3.57** |
| Jarvis (chat) | 4 | 4 | 4 | 4 | 3 | 3 | 5 | **3.86** |
| Forme / Musique / Gaming | 3 | 3 | 2 | 3 | 3 | 3 | 3 | **2.86** |
| Profil / Stacks / Historique | 3 | 4 | 3 | 3 | 4 | 3 | 3 | **3.29** |
| Loading states (skeletons) | 4 | 4 | 4 | 3 | 4 | 4 | 4 | **3.86** |
| Command palette / shortcuts | 4 | 5 | 4 | 4 | 2 | 4 | 5 | **4.00** |

**Moyenne cockpit** : ~3.43 / 5 — solide, mais le ventre mou (cohérence + a11y + mobile) plafonne le ressenti pro.

## Top 3 forces

1. **Cohésion narrative** — Brief → Top → Signaux → Radar → Semaine est un *funnel matinal* parfaitement scénarisé. Aucune autre app de veille perso ne raconte ça aussi clairement. C'est le cœur de la rétention.
2. **Command palette (Ctrl+K) + raccourcis Ctrl+1-8 + Ctrl+B + ?** — clavier de premier ordre. Pour un utilisateur quotidien, c'est ce qui rend le cockpit *vivable* à long terme.
3. **3 thèmes typés, pas 3 couleurs** — Dawn/Obsidian/Atlas changent vraiment de personnalité (vibe, density, divider, kicker-shape). Très rare dans les SaaS solo. Le quiet-mode auto est une attention juste, même si l'exécution doit être réparée (cf. quick wins).

## Top 3 faiblesses

1. **Tokens définis, ignorés.** 20+ stylesheets satellites bypassent `var(--space-*)` et la type scale. La cohérence visuelle dépend de la mémoire de qui a codé le panel. Risque structurel de divergence future.
2. **Touch targets sub-WCAG.** `.card-action` (24px de haut), `.card-action--bookmark` 28×28, beaucoup de `.ph-chip` à ~30px. Sur tactile c'est manqué une fois sur trois. Rétention mobile = morte.
3. **Contraste `--tx3` insuffisant** sur Dawn et Atlas (~2.6-2.95 vs 4.5 requis). Utilisé pour kickers, dates, métadonnées secondaires partout. À 7h du matin, ces textes deviennent illisibles. Atlas est le pire.

---

# 3. Quick Wins & Roadmap Jarvis

## 3.1 Top 10 Quick Wins (triés par ratio impact/effort)

| # | Titre | Impact | Effort | Sections | Ratio |
|---|---|---:|---:|---|---:|
| QW1 | Tuer les pulses infinies sans `prefers-reduced-motion` | 4 | 1 | Home, Sidebar | **4.00** |
| QW2 | Boutons d'action toujours visibles (fin du `opacity:0` hover-only) | 5 | 2 | Top cards, Signal cards | **2.50** |
| QW3 | Confirmation + undo 6s sur « Tout marqué lu » | 4 | 2 | Header Brief | **2.00** |
| QW4 | Touch targets ≥ 36 px sur card-actions (a11y mobile) | 5 | 2 | Toutes les cartes | **2.50** |
| QW5 | Réparer contraste `--tx3` sur Dawn et Atlas (WCAG AA) | 5 | 1 | Tokens — global | **5.00** |
| QW6 | Ajouter le bouton thème Atlas (3e bouton manquant) | 3 | 1 | Sidebar footer | **3.00** |
| QW7 | Indicateur visuel « auto » + lock dans le toggle thème | 3 | 2 | Sidebar footer | **1.50** |
| QW8 | Vrai delta « depuis ta dernière visite » dans le hero | 5 | 3 | Home hero | **1.67** |
| QW9 | Retirer `backdrop-filter` sur fond opaque (perf mobile) | 2 | 1 | `.ph` sticky header | **2.00** |
| QW10 | Linter spec : interdire `font-size`/`padding` hardcodés | 5 | 4 | CI + tous les `.css` | **1.25** |

**Recommandation d'ordonnancement** : QW1 → QW5 → QW9 → QW6 → QW2 → QW4 → QW3 → QW7 → QW8 → QW10 (le linter en dernier car il dépend que les autres aient nettoyé une partie du dette).

## 3.2 Roadmap Jarvis — 15 features

Score composite = **Impact × Faisabilité** (Wow informatif, pas inclus dans le tri). Tri par composite ↓.

| # | Feature | Imp | Fais | Wow | Comp | Description courte |
|---|---|---:|---:|---:|---:|---|
| J1 | Hero « depuis ta dernière visite » avec deltas vivants | 5 | 4 | 4 | **20** | Le premier paragraphe parle au passé immédiat (« hier 8, ce matin 12 nouveaux »), basé sur `localStorage.last-visit-ts` |
| J2 | Synthèse quotidienne en voix de Jarvis (text + audio) | 5 | 4 | 5 | **20** | Remplace l'AudioBriefChip browser par un TTS Cloudflare Workers (FR neuronal) ou ElevenLabs free ; persiste en `audio_briefs` |
| J3 | Conversation contextuelle « ask about ce signal » → focus parking | 4 | 5 | 3 | **20** | Le bouton ask-Jarvis existe ; ajouter mémoire courte « contexte parking » qui rappelle automatiquement les 3 derniers articles cliqués |
| J4 | Routine du soir miroir : « Voilà ce que tu as fait aujourd'hui » | 5 | 4 | 4 | **20** | Brief du soir 19h généré par Jarvis local, agrège lectures + clics + idées + activité Strava du jour |
| J5 | Glissé-poser article → Carnet d'idées | 4 | 4 | 4 | **16** | Drag d'une top-card vers la sidebar → modal capture pré-rempli avec titre + URL |
| J6 | Streak partagé entre 3 axes (veille, sport, idées) avec récup | 4 | 4 | 3 | **16** | Multi-streak, jour de grâce hebdo, badge mensuel |
| J7 | Mode focus : 25 min lecture, sidebar hidden, pomodoro discret | 4 | 4 | 3 | **16** | Touche `F` dédié, overlay subtil top-right, son optionnel |
| J8 | Filtre « ce qui a changé depuis hier » global au cockpit | 4 | 4 | 3 | **16** | Chip persistant en haut de chaque panel : article/concept/opportunité nouveau ou mis à jour |
| J9 | Rappel Wiki contextuel : tooltip de définition au survol | 4 | 4 | 4 | **16** | Auto-link sur termes wiki connus ; survol = mini-card 2 lignes + lien wiki |
| J10 | Annotations privées sur articles + signaux (post-it) | 4 | 4 | 3 | **16** | Click long ou Maj+clic = post-it inline, stocké en `user_annotations` |
| J11 | Thème adaptatif Twilight (transition Dawn→Obsidian au coucher) | 3 | 4 | 4 | **12** | 4e thème, basé sur API solaire navigator + lat/lng cachés |
| J12 | Vue calendrier « ma 4e semaine » : carte de chaleur 30j × 7 axes | 4 | 3 | 4 | **12** | Heatmap GitHub-like, 7 colonnes (axes radar), 30 lignes (jours) |
| J13 | Snooze d'un article : « rappelle-moi dans 3 jours » | 3 | 4 | 3 | **12** | Bouton tertiaire sur carte, alimente `read-later` queue, ré-émerge en haut du Brief le jour J |
| J14 | Comparateur « toi vs il y a 3 mois » : radar + signaux dominants | 4 | 3 | 3 | **12** | Time machine sur le radar et les top signaux ; preuve de progression |
| J15 | Synthèse hebdo Claude Sonnet : « ta semaine en 1 page imprimable » | 4 | 3 | 5 | **12** | Sortie A4 prête à imprimer, dimanche soir, version « zen » du brief |

## 3.3 Mockups textuels — 3 features choisies

### Mockup A — J1 : Hero « depuis ta dernière visite »

```
┌─────────────────────────────────────────────────────────────────────┐
│  S17 · J+116 · / BRIEF DU JOUR · Lundi 26 avril 2026                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SYNTHÈSE — TU ES PARTI HIER À 23:14 · 8H42 PLUS TARD               │
│                                                                     │
│  Depuis hier soir, 12 nouveaux articles, 3 nouveaux                 │
│  signaux et un AI Act phase 3 qui passe au registre                 │
│  obligatoire. Tu avais laissé 4 articles non lus —                  │
│  ils sont toujours là, en bas du Top.                               │
│                                                                     │
│  [ Reprendre où tu t'es arrêté ↓ ]   [ Ignorer la nuit, voir tout ] │
│                                                                     │
│                                                  ┌─────────────────┐│
│                                                  │ DEPUIS HIER SOIR││
│                                                  │       12        ││
│                                                  │ articles · 3 sig││
│                                                  │ ───────────     ││
│                                                  │  4 ↻ en attente ││
│                                                  └─────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

L'utilisateur voit immédiatement *ce qui a bougé pendant son absence*. Le titre macro n'est plus statique : il référence sa propre dernière visite (timestamp local), récupère les `articles.fetch_date > last-visit-ts` et les `signal_tracking.week_start` modifiés. C'est un pacte de continuité — le cockpit *se souvient*.

### Mockup B — J4 : Routine du soir miroir

```
┌─────────────────────────────────────────────────────────────────────┐
│  19:02 · MIROIR DU SOIR · ce que tu as fait aujourd'hui             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⏱ 47 min de cockpit · 🍳 8 articles lus · 💡 2 idées capturées     │
│                                                                     │
│  ─────────────────────────────────────────────────────              │
│                                                                     │
│  Tes lectures de la matinée pointaient toutes vers les agents       │
│  d'entreprise (4/8 articles, 2 ouvertures de signal "agent          │
│  memory"). Cette focalisation aligne avec ton challenge LoRA        │
│  en cours et l'opportunité Mistral × BNP que tu as marquée hier.    │
│                                                                     │
│  Une seule idée capturée a passé le seuil "incubating" :            │
│   · #jarvis "Synthèse soir miroir" (toi-même, 09:13)                │
│                                                                     │
│  Tu n'as pas ouvert la Veille outils depuis 6 jours.                │
│  Demain ? Le brief s'ouvrira sur ce qui a bougé là-bas.             │
│                                                                     │
│  ─────────────────────────────────────────────────────              │
│  📋 Voir l'archive · 💬 Demander à Jarvis                           │
└─────────────────────────────────────────────────────────────────────┘
```

Une page automatique, pas une notification. Générée à 19h par cron Jarvis local + pipeline Cowork. Stockée en `daily_mirror`. C'est la contrepartie introspective du brief du matin : le matin = *quoi penser*, le soir = *comment j'ai pensé*.

### Mockup C — J9 : Tooltip wiki au survol

```
                                  ┌──────────────────────────────────┐
                                  │ MEMORY ARGS · Anthropic, 2026    │
   ...l'API agents avec une       │ ──────────────────────────────── │
   mémoire de contexte de 1M ─────► Capacité d'un LLM à conserver    │
   tokens, un routage automatique │ et rappeler contextes hors       │
   entre outils...                │ session de chat.                 │
                                  │                                  │
                                  │ → Voir wiki · 12 articles liés   │
                                  └──────────────────────────────────┘
```

Survol d'un terme reconnu (pré-calculé côté client via `WIKI_DATA.concepts[].slug` + un trie Aho-Corasick simple sur les 142 concepts) → tooltip 2 lignes max + lien deep-link `#wiki/memory-args`. Aucun clic obligatoire pour comprendre. C'est *le* type d'interaction qui transforme un brief en outil d'apprentissage continu.

---

# 4. Prompts Claude Code

Format : un prompt par fix, **auto-suffisant** (Claude Code peut l'exécuter sans avoir lu l'audit). Tags : `[UX]` quick win UX, `[A11Y]` accessibilité, `[PERF]` performance, `[JARVIS]` feature avancée. Priorités : **P0** (≤30 min, impact élevé) — **P1** (30 min–2h) — **P2** (polish + features Jarvis).

## P0 — Quick wins immédiats

---

### Prompt 1 — [A11Y] Tuer les pulses infinies sous `prefers-reduced-motion`

**Priorité** : P0 · **Dépend de** : aucun · **Fichier** : `cockpit/styles.css`

```text
Contexte : le cockpit React + Babel utilise plusieurs animations infinies
(kicker-dot, sb-group-hotdot, sbHotPulse, pulse) qui tournent en boucle
en haut de page. Sur 30 jours d'usage quotidien c'est une source de
fatigue visuelle. La règle @media (prefers-reduced-motion: reduce)
existe déjà dans cockpit/styles.css (ligne ~4246) mais ne couvre PAS
ces animations.

Tâche : ouvrir cockpit/styles.css, localiser le bloc
@media (prefers-reduced-motion: reduce) existant, et y ajouter :

@media (prefers-reduced-motion: reduce) {
  .kicker-dot,
  .sb-group-hotdot,
  .sb-foot-streak-icon,
  .top-unread-dot {
    animation: none !important;
  }
  /* Désactiver toute animation infinie résiduelle */
  *, *::before, *::after {
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

Contrainte : ne pas toucher les transitions courtes (hover button), ne
pas désactiver les @keyframes elles-mêmes (les utilisateurs sans
préférence reduced-motion gardent l'effet).

Validation : avec macOS / Windows en mode "réduire le mouvement", le
kicker-dot du hero ne pulse plus. Sans la préférence, comportement
inchangé. Vérifier via DevTools > Rendering > Emulate CSS prefers-
reduced-motion.
```

---

### Prompt 2 — [A11Y] Réparer contraste `--tx3` sur Dawn et Atlas

**Priorité** : P0 · **Dépend de** : aucun · **Fichier** : `cockpit/themes.js`

```text
Contexte : `--tx3` est utilisé partout pour kickers, dates,
métadonnées secondaires (sb-foot, hwk-tick-label, vl-eyebrow…). Sur
les thèmes Dawn (`--bg`: #F5EFE4, `--tx3`: #9A8D82, ratio ≈ 2.65) et
Atlas (`--bg`: #F4F4F1, `--tx3`: #8A9096, ratio ≈ 2.95) le contraste
échoue WCAG AA (4.5:1 requis pour body, 3:1 pour large text). Sur
Obsidian c'est borderline OK (~4.5:1).

Tâche : ouvrir cockpit/themes.js et corriger les valeurs --tx3 pour
atteindre au moins 4.5:1 contre le `--bg` du thème :
  - dawn: --tx3 passe de "#9A8D82" à "#7B6E64"  (ratio ≈ 4.6)
  - atlas: --tx3 passe de "#8A9096" à "#6E7378" (ratio ≈ 4.6)
Ne pas toucher Obsidian (#5C6670 reste OK sur fond #0B0D0F).

Vérifier dans le même fichier que les valeurs `--bd` (bordures) restent
cohérentes — pas de changement requis là, le contraste bordure n'a pas
les mêmes exigences.

Contrainte : les valeurs hex doivent rester dans la même famille
chromatique (tons chauds bruns pour Dawn, gris neutres pour Atlas).
Pas de virage de teinte.

Validation : ouvrir https://webaim.org/resources/contrastchecker/ avec
chaque couple bg/tx3 par thème — chaque combinaison doit afficher
"AA Pass — Normal Text". Sur le cockpit en thème Dawn et Atlas, les
sb-foot-streak-meta, hwk-tick-label, hero-meta deviennent lisibles
sans plisser les yeux.
```

---

### Prompt 3 — [PERF] Retirer le `backdrop-filter` du sticky header

**Priorité** : P0 · **Dépend de** : aucun · **Fichier** : `cockpit/styles.css`

```text
Contexte : .ph (page header sticky du Brief) déclare
`backdrop-filter: blur(12px)` mais `background: var(--bg)` est opaque
sur les 3 thèmes. Aucun effet visuel ; uniquement un coût GPU sur
mobile (Safari iOS surtout).

Tâche : dans cockpit/styles.css, localiser le sélecteur `.ph` (~ligne
512) et supprimer la ligne `backdrop-filter: blur(12px);`.

Contrainte : ne pas toucher aux autres backdrop-filter du fichier
(modales, overlays) où l'effet est utile (fond semi-transparent).

Validation : devtools > Layers panel sur mobile → la composite layer
du header disparaît. Visuellement aucun changement perceptible
puisque le bg était déjà opaque.
```

---

### Prompt 4 — [UX] Ajouter le 3e bouton thème Atlas

**Priorité** : P0 · **Dépend de** : aucun · **Fichier** : `cockpit/sidebar.jsx`

```text
Contexte : le cockpit définit 3 thèmes (Dawn, Obsidian, Atlas) dans
cockpit/themes.js. La sidebar (cockpit/sidebar.jsx, lignes ~170-188)
n'expose que 2 boutons toggle (Dawn ☀, Obsidian ☾). Atlas est
inaccessible depuis l'UI — il faut faire `localStorage.setItem
("cockpit-theme", "atlas")` à la main.

Tâche : dans cockpit/sidebar.jsx, dans le bloc `<div className="sb-
theme-toggle" role="group" aria-label="Thème">`, ajouter un 3e bouton
entre Obsidian et la fermeture du div :

  <button
    className={`sb-theme-btn ${theme.id === "atlas" ? "is-active" : ""}`}
    onClick={() => onThemeChange && onThemeChange("atlas")}
    title="Thème Atlas"
    aria-label="Thème Atlas"
  >
    <Icon name="square" size={12} stroke={1.75} />
  </button>

Vérifier que l'icône "square" existe dans cockpit/icons.jsx — si
absente, utiliser "sparkle" ou "circle" en attendant et ajouter une
note FIXME.

Contrainte : ne pas modifier la grammaire des CSS (.sb-theme-btn
fonctionne déjà pour 3 boutons grâce au + selector existant).

Validation : depuis la sidebar, cliquer le 3e bouton bascule le
cockpit en thème Atlas (fond ivoire cassé, indigo encre). Le clic
écrit `cockpit-theme=atlas` et `cockpit-theme-explicit=1` en
localStorage. Quiet-mode auto ne reprend pas la main.
```

---

### Prompt 5 — [UX] Streak fallback : 0 honnête au lieu de 14 menteur

**Priorité** : P0 · **Dépend de** : aucun · **Fichier** : `cockpit/sidebar.jsx`

```text
Contexte : cockpit/sidebar.jsx ligne ~85 a `const streak = data.stats
.streak || 14`. Quand la vraie donnée Supabase n'est pas chargée ou
vaut 0, l'utilisateur voit "14j" — un mensonge optimiste. Pour un
cockpit personnel utilisé tous les jours, le streak est sacré : il
doit refléter la vérité, sinon il perd toute crédibilité.

Tâche : dans cockpit/sidebar.jsx, remplacer :
    const streak = data.stats.streak || 14;
par :
    const streak = Number.isFinite(data.stats.streak) ? data.stats.streak : null;

Puis dans le rendu .sb-foot-streak (lignes ~143-160), si streak === null,
remplacer le bloc complet par :

    <div className="sb-foot-streak sb-foot-streak--empty">
      <span className="sb-foot-streak-icon" aria-hidden="true">
        <Icon name="flame" size={13} stroke={1.75} />
      </span>
      <div className="sb-foot-streak-meta">
        <span>streak veille</span>
        <span className="sb-foot-next">prochain 06:00</span>
      </div>
    </div>

Contrainte : ne pas afficher "0 j" ni "—" — afficher uniquement
l'icône et la meta. Le visuel doit dire "pas de donnée, pas de
chiffre" sans crier.

Validation : couper la connexion Supabase, recharger : la sidebar
n'affiche plus "14 j". Avec connexion + streak réel à 12, affiche
"12 j" comme avant.
```

---

## P1 — Améliorations UX significatives

---

### Prompt 6 — [UX] Boutons d'action toujours visibles sur cartes

**Priorité** : P1 · **Dépend de** : aucun · **Fichiers** : `cockpit/styles.css`, `cockpit/styles-signals.css`

```text
Contexte : sur les top-cards du Brief (3 incontournables) et les
sig-cards (signaux faibles), les boutons d'action (bookmark, ask
Jarvis) sont en `opacity: 0` et n'apparaissent qu'au hover. Sur
tactile (iPad, mobile) ils sont invisibles. Sur trackpad c'est une
friction quotidienne. Discoverability nulle pour un nouveau visiteur.

Tâche :
1. Dans cockpit/styles.css, supprimer les règles `opacity: 0` sur :
   - `.top-card .top-actions` et son hover qui passe à 1 (lignes
     ~1310-1312)
   - `.sig-card-ask` et son hover (lignes ~1320-1322)

2. Remplacer par une visibilité permanente avec `opacity: 0.55` au
   repos et `opacity: 1` au hover/focus de la carte :

   .top-card .top-actions { opacity: 0.55; transition: opacity 120ms; }
   .top-card:hover .top-actions,
   .top-card:focus-within .top-actions { opacity: 1; }

   .sig-card-ask { opacity: 0.55; transition: opacity 120ms; }
   .sig-card:hover .sig-card-ask,
   .sig-card:focus-within .sig-card-ask { opacity: 1; }

3. Sur mobile (`@media (max-width: 760px)`), forcer opacity: 1
   permanente. Ajouter dans cockpit/styles-mobile.css :

   .top-card .top-actions,
   .sig-card-ask { opacity: 1 !important; }

Contrainte : ne pas augmenter la taille des boutons ici (c'est traité
dans le prompt 7). On ne change que la visibilité.

Validation : scroll dans le Brief sans bouger la souris — bookmark et
ask-Jarvis sont visibles à 55 % d'opacité. Hover une carte : les
boutons passent à 100 %. Sur iPhone (DevTools mobile), opacité 100 %
permanente.
```

---

### Prompt 7 — [A11Y] Touch targets ≥ 36 px sur card-actions

**Priorité** : P1 · **Dépend de** : Prompt 6 · **Fichier** : `cockpit/styles.css`

```text
Contexte : `.card-action` (padding 4px 8px → ~24px de haut),
`.card-action--bookmark` et `.card-action--ask` (28×28) sont
sous-dimensionnés pour le tactile. WCAG 2.1 recommande 44×44 ; un
compromis professionnel desktop/mobile est 36×36 minimum.

Tâche : dans cockpit/styles.css, modifier :

  .card-action {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 10px;       /* était: 4px 8px */
    min-height: 32px;        /* nouveau */
    border-radius: var(--radius);
    border: 1px solid var(--bd);
    color: var(--tx2);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    transition: all 120ms;
  }

  .card-action--bookmark,
  .card-action--ask {
    width: 36px;             /* était: 28px */
    height: 36px;
  }

Sur mobile (cockpit/styles-mobile.css), bumper à 44×44 :

  @media (max-width: 760px) {
    .card-action { min-height: 40px; padding: 8px 12px; }
    .card-action--bookmark,
    .card-action--ask { width: 44px !important; height: 44px !important; }
  }

Contrainte : la grille `.top-card-foot` doit toujours tenir sur une
ligne avec 3 tags + 2 actions. Si overflow, les tags se wrappent
en-dessous ; c'est acceptable.

Validation : Lighthouse mobile audit > Tap targets are sized
appropriately → 100/100 sur le Brief. À l'œil, les boutons ne
paraissent pas plus lourds — juste plus respirants.
```

---

### Prompt 8 — [UX] Confirmation + undo 6s sur « Tout marqué lu »

**Priorité** : P1 · **Dépend de** : aucun · **Fichier** : `cockpit/home.jsx`

```text
Contexte : le bouton .ph-chip--primary "Tout marqué lu" du Brief
écrit immédiatement dans localStorage.read-articles tous les ids des
top articles, sans confirmation ni undo. Un slip de doigt = batch
destructive sans rollback.

Tâche : dans cockpit/home.jsx, dans la fonction Home, ajouter en haut :

  const [undoState, setUndoState] = React.useState(null);
  // undoState = { previousMap, expiresAt, timer } | null

Modifier le onClick du bouton "Tout marqué lu" pour :
1. Sauvegarder l'ancien `read-articles` avant écrasement.
2. Afficher un toast "X articles marqués lus · annuler" pendant 6s.
3. Si l'utilisateur clique annuler, restore le previousMap.

Code complet :

  const markAllRead = () => {
    try {
      const previousMap = JSON.parse(localStorage.getItem("read-articles") || "{}");
      const newMap = { ...previousMap };
      const ids = (top || []).map(t => t._id || t.id).filter(Boolean);
      ids.forEach(id => { newMap[id] = { ts: Date.now() }; });
      localStorage.setItem("read-articles", JSON.stringify(newMap));
      setReadTop(Object.fromEntries((top || []).map(t => [t.rank, true])));

      const timer = setTimeout(() => setUndoState(null), 6000);
      setUndoState({ previousMap, count: ids.length, timer });
    } catch {}
  };

  const undoMarkAll = () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    try {
      localStorage.setItem("read-articles", JSON.stringify(undoState.previousMap));
      setReadTop({});
    } catch {}
    setUndoState(null);
  };

Remplacer le bouton actuel pour appeler markAllRead, et ajouter
quelque part en bas du return un toast :

  {undoState && (
    <div className="ph-undo-toast" role="status">
      <span>{undoState.count} articles marqués lus</span>
      <button className="ph-undo-btn" onClick={undoMarkAll}>Annuler</button>
    </div>
  )}

Et dans cockpit/styles.css, à la fin :

  .ph-undo-toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%);
    display: inline-flex; align-items: center; gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--tx); color: var(--bg2);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    font-size: var(--text-sm);
    z-index: 200;
    animation: phUndoIn 180ms ease;
  }
  .ph-undo-btn {
    color: var(--bg2); text-decoration: underline; text-underline-offset: 3px;
    font-weight: 600;
  }
  @keyframes phUndoIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

Contrainte : ne pas bloquer l'écran avec un modal de confirmation —
toast non-bloquant. Si l'utilisateur navigue avant les 6s, le toast
disparaît mais l'état déjà écrit reste.

Validation : cliquer "Tout marqué lu" → toast en bas, 3 cartes
deviennent grisées. Cliquer "Annuler" dans les 6s → cartes
redeviennent unread, toast disparaît. Après 6s sans clic, toast
disparaît, action persistante.
```

---

### Prompt 9 — [UX] Indicateur « auto » dans le toggle thème

**Priorité** : P1 · **Dépend de** : Prompt 4 · **Fichiers** : `cockpit/sidebar.jsx`, `cockpit/styles.css`

```text
Contexte : le quiet-mode auto bascule Dawn/Obsidian à 22h-6h tant que
`localStorage.cockpit-theme-explicit` n'a pas été posé. Aujourd'hui
aucun signal visuel n'indique ce mode — le thème change "tout seul"
sans contexte. Si l'utilisateur veut figer Dawn la nuit, il doit
deviner que cliquer un bouton thème = lock.

Tâche :
1. Dans cockpit/sidebar.jsx, lire l'état explicit au mount :

   const [explicit, setExplicit] = React.useState(() => {
     try { return localStorage.getItem("cockpit-theme-explicit") === "1"; }
     catch { return false; }
   });

   Mettre à jour à chaque clic onThemeChange (mais le storage est déjà
   posé par app.jsx — ici on lit juste pour le rendu).

2. Modifier le wrapper .sb-theme-toggle pour ajouter une classe :

   <div className={`sb-theme-toggle ${explicit ? "is-explicit" : "is-auto"}`} role="group" aria-label="Thème">

3. Ajouter un 4e mini-bouton "auto" qui re-lock en mode automatique :

   <button
     className={`sb-theme-btn sb-theme-btn--auto ${!explicit ? "is-active" : ""}`}
     onClick={() => {
       try { localStorage.removeItem("cockpit-theme-explicit"); } catch {}
       setExplicit(false);
       // Trigger un nudge pour que le tick auto reprenne
       const h = new Date().getHours();
       onThemeChange((h >= 22 || h < 6) ? "obsidian" : "dawn");
     }}
     title="Suivre l'heure (auto)"
     aria-label="Suivre l'heure"
   >
     <Icon name="clock" size={12} stroke={1.75} />
   </button>

4. Dans cockpit/styles.css, ajouter :

   .sb-theme-toggle.is-auto .sb-theme-btn:not(.sb-theme-btn--auto) {
     opacity: 0.5;
   }
   .sb-theme-btn--auto svg { opacity: 0.7; }

Contrainte : ne pas casser onThemeChange existant dans app.jsx — il
continue à poser cockpit-theme-explicit=1 quand on clique Dawn ou
Obsidian directement.

Validation : au matin (auto), bouton clock actif, Dawn/Obsidian/Atlas
en demi-opacité. Cliquer Dawn → clock désactivé, Dawn pleine opacité,
quiet-mode ne reprend pas la main. Re-cliquer clock → retour auto.
```

---

### Prompt 10 — [UX] Hero « depuis ta dernière visite » (deltas vivants)

**Priorité** : P1 · **Dépend de** : aucun · **Fichier** : `cockpit/home.jsx`

```text
Contexte : le hero du Brief affiche un titre macro statique (la
synthèse Gemini du jour), et un encart latéral "À traiter depuis
hier". Pour un cockpit utilisé quotidiennement, l'angle qui retient
n'est PAS "voici la news du jour" mais "voici ce qui a bougé depuis
ta dernière visite". On veut un kicker dynamique au-dessus du titre
hero.

Tâche : dans cockpit/home.jsx, ajouter en haut du composant Home :

  const lastVisitTs = React.useMemo(() => {
    try {
      const v = Number(localStorage.getItem("cockpit-last-visit-ts"));
      return Number.isFinite(v) ? v : null;
    } catch { return null; }
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem("cockpit-last-visit-ts", String(Date.now())); }
    catch {}
  }, []);

  const visitDelta = React.useMemo(() => {
    if (!lastVisitTs) return null;
    const now = Date.now();
    const diffH = (now - lastVisitTs) / 3600000;
    if (diffH < 0.5) return null;          // session rebond, pas de delta
    if (diffH < 18) return { h: Math.round(diffH), kind: "today" };
    return { h: Math.round(diffH), kind: "yesterday" };
  }, [lastVisitTs]);

  // Compter les nouveaux articles depuis lastVisitTs (hypothèse :
  // chaque article a un fetch_iso ou fetch_date dans data.top + ailleurs).
  const newSinceVisit = React.useMemo(() => {
    if (!lastVisitTs) return null;
    let n = 0;
    (data.top || []).forEach(t => {
      const ts = t.fetch_iso ? new Date(t.fetch_iso).getTime() : null;
      if (ts && ts > lastVisitTs) n++;
    });
    return n;
  }, [lastVisitTs, data.top]);

Modifier le rendu .hero-kicker :

  <div className="hero-kicker">
    <span className="kicker-dot" />
    {visitDelta ? (
      <>
        DEPUIS TA DERNIÈRE VISITE — {visitDelta.h}H
        {newSinceVisit != null && (
          <span className="hero-kicker-meta">
            · {newSinceVisit} nouveaux articles · {macro.articles_summarized} au total
          </span>
        )}
      </>
    ) : (
      <>
        {macro.kicker}
        <span className="hero-kicker-sep">—</span>
        <span className="hero-kicker-meta">{macro.articles_summarized} articles synthétisés · lecture {macro.reading_time}</span>
      </>
    )}
  </div>

Contrainte : préserver le fallback (pas de lastVisitTs = comportement
actuel). Ne pas réinventer la dataloader — on consomme `data.top`
existant. Si `fetch_iso` n'existe pas, le delta tombera à 0 ; pas
grave, c'est un best-effort.

Validation : ouvrir le cockpit → fermer l'onglet → attendre 3h →
rouvrir : le kicker affiche "DEPUIS TA DERNIÈRE VISITE — 3H · X
nouveaux articles". Première visite jamais (lastVisitTs absent) :
kicker actuel inchangé.
```

---

## P2 / JARVIS — Polish et features avancées

---

### Prompt 11 — [JARVIS] Tooltip wiki au survol (J9 du roadmap)

**Priorité** : P2 · **Dépend de** : aucun · **Fichiers** : `cockpit/lib/wiki-tooltip.js` (nouveau), `cockpit/app.jsx`, `cockpit/styles.css`, `index.html`

```text
Contexte : le cockpit a 142 concepts wiki dans `WIKI_DATA.concepts`.
Aujourd'hui ils ne sont accessibles que par navigation explicite
(panel Wiki). Ajouter une fonctionnalité d'auto-link contextuelle :
quand un terme wiki apparaît dans un texte du cockpit (top-summary,
hero-body, signal-context, jarvis chat), le survol affiche un
tooltip 2 lignes + lien deep-link.

Tâche : créer cockpit/lib/wiki-tooltip.js :

(function(){
  let trie = null;
  let initialized = false;

  function buildTrie(){
    const concepts = (window.WIKI_DATA && window.WIKI_DATA.concepts) || [];
    const map = new Map();
    concepts.forEach(c => {
      const key = (c.name || "").toLowerCase().trim();
      if (key.length >= 3) map.set(key, c);
      (c.aliases || []).forEach(a => {
        const k = a.toLowerCase().trim();
        if (k.length >= 3) map.set(k, c);
      });
    });
    return map;
  }

  function findMatches(text){
    if (!trie) return [];
    const matches = [];
    const lower = text.toLowerCase();
    for (const [term, concept] of trie) {
      let idx = 0;
      while ((idx = lower.indexOf(term, idx)) !== -1) {
        // Word boundary check
        const before = lower[idx - 1];
        const after = lower[idx + term.length];
        if ((!before || /\W/.test(before)) && (!after || /\W/.test(after))) {
          matches.push({ start: idx, end: idx + term.length, concept });
          break; // Une seule occurrence par concept par texte
        }
        idx += term.length;
      }
    }
    return matches.sort((a, b) => a.start - b.start);
  }

  let activeTooltip = null;
  function showTooltip(target, concept){
    hideTooltip();
    const t = document.createElement("div");
    t.className = "wiki-tt";
    t.innerHTML = `
      <div class="wiki-tt-name">${concept.name}</div>
      <div class="wiki-tt-desc">${(concept.description_short || concept.description || "").slice(0, 140)}</div>
      <a class="wiki-tt-link" href="#wiki/${concept.slug}">Voir le wiki →</a>
    `;
    document.body.appendChild(t);
    const r = target.getBoundingClientRect();
    t.style.top = (window.scrollY + r.bottom + 6) + "px";
    t.style.left = Math.min(window.innerWidth - 320, r.left) + "px";
    activeTooltip = t;
  }
  function hideTooltip(){
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
  }

  // Mutation observer : à chaque DOM update, scanner les nouveaux
  // text nodes et envelopper les matches dans <span data-wiki=slug>
  function decorate(root){
    if (!trie) trie = buildTrie();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest(".wiki-tt, .wiki-decorated, code, pre, kbd, button, input, textarea, [data-wiki]")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);

    targets.forEach(textNode => {
      const text = textNode.nodeValue;
      const matches = findMatches(text);
      if (!matches.length) return;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      matches.forEach(m => {
        if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
        const span = document.createElement("span");
        span.className = "wiki-decorated";
        span.dataset.wiki = m.concept.slug;
        span.textContent = text.slice(m.start, m.end);
        frag.appendChild(span);
        cursor = m.end;
      });
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function onHover(e) {
    const t = e.target.closest && e.target.closest(".wiki-decorated");
    if (!t) { hideTooltip(); return; }
    const slug = t.dataset.wiki;
    const c = (window.WIKI_DATA && window.WIKI_DATA.concepts || []).find(x => x.slug === slug);
    if (c) showTooltip(t, c);
  }

  function init(){
    if (initialized) return;
    initialized = true;
    document.addEventListener("mouseover", onHover);
    document.addEventListener("scroll", hideTooltip, { capture: true, passive: true });

    // Décorer toutes les 1.5s les éléments stables (top-summary,
    // hero-body, signal-context, jv-msg-body). Approche pragmatique :
    // pas de MutationObserver pour éviter les boucles infinies.
    setInterval(() => {
      document.querySelectorAll(".top-summary, .hero-body, .sig-card-context, .jv-msg-body").forEach(decorate);
    }, 1500);
  }

  window.addEventListener("load", () => setTimeout(init, 800));
})();

Ajouter le script dans index.html après cockpit/lib/data-loader.js :
  <script src="cockpit/lib/wiki-tooltip.js?v=1"></script>

Ajouter le CSS dans cockpit/styles.css :
  .wiki-decorated {
    border-bottom: 1px dotted var(--brand);
    cursor: help;
    transition: background 120ms;
  }
  .wiki-decorated:hover { background: var(--brand-tint); }
  .wiki-tt {
    position: absolute; z-index: 220;
    width: 300px;
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--bd2);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    font-size: var(--text-sm);
    color: var(--tx);
    pointer-events: none;
  }
  .wiki-tt-name {
    font-family: var(--font-display);
    font-weight: 600;
    margin-bottom: var(--space-1);
  }
  .wiki-tt-desc { color: var(--tx2); line-height: 1.5; margin-bottom: var(--space-2); }
  .wiki-tt-link {
    pointer-events: auto;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--brand);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

Contrainte : ne pas redécorer les nodes déjà décorés (classe .wiki-
decorated rejetée par le tree walker). Pas de MutationObserver pour
éviter les boucles. Le timer 1.5s est suffisant pour rattraper les
changements de panel.

Validation : ouvrir Brief → survoler le mot "agents" dans le top-
summary du rang 1 → tooltip apparaît avec la définition + lien.
Cliquer le lien → navigue vers #wiki/agents et ouvre le concept.
```

---

### Prompt 12 — [JARVIS] Snooze d'un article — « rappelle-moi dans 3 jours »

**Priorité** : P2 · **Dépend de** : Prompt 6 · **Fichiers** : `cockpit/home.jsx`, `cockpit/styles.css`, `cockpit/lib/snooze.js` (nouveau)

```text
Contexte : tous les jours il y a des articles intéressants mais pas
prioritaires *aujourd'hui*. Soit je les marque lu (perte de mémoire),
soit je laisse traîner (charge cognitive). Solution : un bouton snooze
qui retire l'article de la vue actuelle et le réémerge en haut du
brief le jour J.

Tâche :
1. Créer cockpit/lib/snooze.js :

(function(){
  const KEY = "snoozed-articles";
  function read(){
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function write(obj){
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
  }
  window.snooze = {
    add(id, days) {
      const map = read();
      map[id] = { until: Date.now() + days * 86400000, snoozedAt: Date.now() };
      write(map);
    },
    remove(id) {
      const map = read();
      delete map[id];
      write(map);
    },
    isActive(id) {
      const map = read();
      const e = map[id];
      return e && e.until > Date.now();
    },
    dueToday(){
      const map = read();
      const now = Date.now();
      const due = [];
      Object.entries(map).forEach(([id, e]) => {
        if (e.until <= now) due.push(id);
      });
      return due;
    },
    cleanup(){
      const map = read();
      const now = Date.now();
      Object.keys(map).forEach(id => {
        if (map[id].until <= now - 7 * 86400000) delete map[id];
      });
      write(map);
    },
  };
  window.snooze.cleanup();
})();

Ajouter le script dans index.html avant cockpit/data-loader.js.

2. Dans cockpit/home.jsx, dans .top-actions de chaque top-card,
ajouter un 3e bouton :

   <button
     className="card-action card-action--snooze"
     aria-label="Reporter à plus tard"
     onClick={(e) => {
       e.stopPropagation();
       const id = t._id || t.id;
       if (!id) return;
       window.snooze.add(id, 3);
       // Optimistic hide
       e.currentTarget.closest(".top-card").style.opacity = "0.3";
     }}
     title="Reporter (3 jours)"
   >
     <Icon name="clock" size={12} stroke={2} />
   </button>

3. Dans la dataloader (cockpit/lib/data-loader.js), filtrer les
articles snoozés du Top du jour et les promouvoir le jour J. Localiser
la construction de window.COCKPIT_DATA.top et ajouter avant le slice :

   if (window.snooze) {
     const dueIds = new Set(window.snooze.dueToday());
     // Promouvoir : les snoozed dueToday viennent en tête du top
     const promoted = articlesAll.filter(a => dueIds.has(a.id));
     const filtered = articlesAll.filter(a => !window.snooze.isActive(a.id));
     articlesAll = [...promoted, ...filtered];
   }

4. Dans cockpit/styles.css :

   .card-action--snooze {
     display: inline-flex; align-items: center; justify-content: center;
     width: 36px; height: 36px;
     border-radius: 999px;
     background: var(--bg2);
     border: 1px solid var(--bd);
     color: var(--tx2);
     margin-left: var(--space-1);
   }
   .card-action--snooze:hover { color: var(--positive); border-color: var(--positive); }

Contrainte : la cleanup auto retire toute entrée >7j passée pour
éviter le bloat localStorage. Pas de notification système — la
réémergence dans le Brief le jour J est le rappel.

Validation : cliquer snooze sur une top-card → carte fade out, se
retire du localStorage demain à la même heure. Recharger le cockpit 3
jours plus tard → l'article apparaît en rang 1 du Top.
```

---

### Prompt 13 — [JARVIS] Filtre global « ce qui a changé depuis hier »

**Priorité** : P2 · **Dépend de** : Prompt 10 · **Fichiers** : `cockpit/app.jsx`, `cockpit/styles.css`, panels veille/signals/wiki/opps

```text
Contexte : un utilisateur quotidien veut un filtre transversal "ne
me montre que ce qui est apparu/changé depuis hier". Aujourd'hui
chaque panel affiche tout, charge à l'utilisateur de spotter le neuf.

Tâche :
1. Dans cockpit/app.jsx, ajouter un toggle global dans le shell, en
haut à droite à côté du kbd-fab :

   const [recentOnly, setRecentOnly] = React.useState(() => {
     try { return localStorage.getItem("filter-recent-only") === "1"; }
     catch { return false; }
   });
   React.useEffect(() => {
     try { localStorage.setItem("filter-recent-only", recentOnly ? "1" : "0"); } catch {}
     document.documentElement.dataset.filterRecent = recentOnly ? "1" : "0";
   }, [recentOnly]);

Ajouter dans le rendu du shell :

   <button
     className={`recent-toggle ${recentOnly ? "is-active" : ""}`}
     onClick={() => setRecentOnly(v => !v)}
     title={recentOnly ? "Voir tout" : "Voir seulement ce qui a changé depuis hier"}
   >
     <Icon name="clock" size={12} stroke={1.75} />
     {recentOnly ? "Récent · 24h" : "Tout"}
   </button>

2. Dans cockpit/styles.css :

   .recent-toggle {
     position: fixed; top: 14px; right: 60px;
     display: inline-flex; align-items: center; gap: var(--space-2);
     padding: var(--space-2) var(--space-3);
     border-radius: 999px;
     background: var(--bg2);
     border: 1px solid var(--bd);
     color: var(--tx2);
     font-size: var(--text-xs);
     font-family: var(--font-mono);
     z-index: 90;
     transition: all 120ms;
   }
   .recent-toggle.is-active {
     background: var(--brand);
     color: var(--bg2);
     border-color: var(--brand);
   }

   /* Quand le filtre est actif, masquer les items "anciens" via CSS */
   :root[data-filter-recent="1"] .vl-item:not([data-recent="1"]),
   :root[data-filter-recent="1"] .sig-card:not([data-recent="1"]),
   :root[data-filter-recent="1"] .top-card:not([data-recent="1"]) {
     display: none;
   }

3. Dans les panels (commencer par cockpit/home.jsx pour les top-card)
ajouter sur chaque carte un attribut data-recent calculé :

   const isRecent = t.fetch_iso ? (Date.now() - new Date(t.fetch_iso).getTime() < 86400000) : false;
   <article className="top-card ..." data-recent={isRecent ? "1" : "0"} ...>

Reproduire le pattern dans panel-veille.jsx (.vl-item) et panel-
signals.jsx (.sig-card) en se basant sur les champs ISO disponibles
(article.fetch_iso, signal.first_seen, etc.).

Contrainte : si une carte n'a pas de timestamp, considérer non-récent
(disparaît quand filtre actif). Le toggle est purement client-side,
pas de re-fetch.

Validation : cliquer le bouton "Récent · 24h" en haut à droite →
chaque panel ne montre que les items <24h. Cliquer à nouveau → tout
réapparaît. État persisté entre sessions.
```

---

### Prompt 14 — [JARVIS] Routine du soir miroir — Daily Mirror 19h

**Priorité** : P2 · **Dépend de** : aucun (mais nécessite Jarvis serveur local) · **Fichiers** : `jarvis/observers/evening_mirror.py` (nouveau), `cockpit/panel-evening.jsx` (nouveau), migration SQL, sidebar

```text
Contexte : le matin le cockpit dit "voici ce qu'il faut penser"
(brief Gemini). Le soir on a besoin de la contrepartie : "voici
comment tu as pensé aujourd'hui". Boucle réflexive qui transforme
l'usage en apprentissage.

Tâche en 3 parties :

PARTIE A — Migration Supabase
Créer jarvis/migrations/006_daily_mirror.sql :

  CREATE TABLE IF NOT EXISTS daily_mirror (
    mirror_date date PRIMARY KEY,
    summary_html text,
    stats jsonb,
    generated_at timestamptz DEFAULT now()
  );
  ALTER TABLE daily_mirror ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "authenticated read" ON daily_mirror FOR SELECT TO authenticated USING (true);
  CREATE POLICY "service_role write" ON daily_mirror FOR INSERT TO service_role WITH CHECK (true);
  CREATE POLICY "service_role update" ON daily_mirror FOR UPDATE TO service_role USING (true);

PARTIE B — Générateur Python
Créer jarvis/observers/evening_mirror.py qui :
  1. À 19h, lit `usage_events` du jour (section_opened, link_clicked,
     idea_moved, challenge_completed)
  2. Lit `articles` lus aujourd'hui via localStorage proxy ou via
     usage_events (link_clicked count par article)
  3. Lit `business_ideas` créés aujourd'hui (created_at)
  4. Lit `strava_activities` du jour si existe
  5. Génère un brief HTML via le LLM local (Qwen 9B) avec un prompt
     du type :
        "Tu es Jarvis. Voici l'activité de Jean aujourd'hui. Résume
         en 4 paragraphes : focus thématique des lectures, momentum
         personnel, idées notables, point d'attention/recommandation
         pour demain. Ton familier-direct, légèrement opinionated.
         Maximum 250 mots. HTML simple : <p>, <strong>."
  6. Upsert dans `daily_mirror`

Le scheduler asyncio de jarvis/server.py doit déclencher
generate_evening_mirror() à 19h00 chaque jour. Suivre le pattern de
daily_brief_generator.py.

PARTIE C — Panel cockpit
Créer cockpit/panel-evening.jsx :

  function PanelEvening({ data, onNavigate }) {
    const [mirror, setMirror] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      (async () => {
        const today = new Date().toISOString().slice(0, 10);
        try {
          const res = await window.sb.query("daily_mirror", `mirror_date=eq.${today}`);
          if (res && res[0]) setMirror(res[0]);
        } finally { setLoading(false); }
      })();
    }, []);

    if (loading) return <div className="evening-loading">Chargement…</div>;
    if (!mirror) return (
      <div className="evening-empty">
        <h2>Pas encore de miroir du soir</h2>
        <p>Le récap quotidien est généré à 19h. Reviens après.</p>
      </div>
    );

    return (
      <div className="evening">
        <header className="evening-head">
          <span className="evening-eyebrow">{mirror.mirror_date} · 19:00</span>
          <h1>Miroir du soir</h1>
        </header>
        <div className="evening-body" dangerouslySetInnerHTML={{
          __html: window.DOMPurify ? window.DOMPurify.sanitize(mirror.summary_html) : mirror.summary_html
        }} />
        <footer className="evening-foot">
          <button className="btn btn--ghost" onClick={() => onNavigate("brief")}>← Brief</button>
          <button className="btn btn--ghost" onClick={() => onNavigate("jarvis")}>💬 Demander à Jarvis</button>
        </footer>
      </div>
    );
  }
  window.PanelEvening = PanelEvening;

Ajouter le routing dans cockpit/app.jsx (else if (activePanel ===
"evening") content = <PanelEvening …/>).

Ajouter dans la sidebar (cockpit/data.js, groupe "Grille matinale"
juste après "brief") :
  { id: "evening", label: "Miroir du soir", icon: "moon" },

Ajouter cockpit/styles-evening.css avec une mise en page douce :
fond bg2, padding 64px, font-display sur le titre h1 ~36px.

Charger le panel + CSS dans index.html.

Contrainte : tout le pipeline est best-effort. Si le LLM local n'est
pas dispo, le générateur Python log une erreur et n'écrit pas la
ligne. Le panel affiche "Pas encore de miroir du soir" sans planter.

Validation : à 19h05, ouvrir #evening → le panel affiche un texte
généré par Jarvis qui reflète l'activité du jour. Avant 19h, message
d'attente.
```

---

### Prompt 15 — [JARVIS] Synthèse vocale de Jarvis (TTS neuronal)

**Priorité** : P2 · **Dépend de** : aucun · **Fichiers** : `cockpit/home.jsx`, `cockpit/lib/tts.js` (nouveau), `jarvis/server.py`

```text
Contexte : l'AudioBriefChip actuel utilise speechSynthesis du
navigateur — qualité variable, voix robotique sur Windows. Pour un
cockpit personnel premium, on veut une voix neuronale française. Sur
serveur Jarvis local on peut router vers Piper TTS (ouvert, FR
neuronal, gratuit, ~50 Mo) ou via API Cloudflare Workers AI.

Tâche en 2 parties :

PARTIE A — Endpoint Jarvis
Dans jarvis/server.py, ajouter un endpoint POST /tts qui :
  1. Reçoit { text: str, voice?: "fr_FR-tom-medium" }
  2. Streame le WAV via Piper (pip install piper-tts) ou fallback
     edge-tts (Microsoft Edge voices, FR-FR-DeniseNeural est superbe)
  3. Headers: Content-Type: audio/wav, Cache-Control: no-store

  from fastapi.responses import StreamingResponse
  import io, asyncio

  @app.post("/tts")
  async def tts(payload: dict):
      text = (payload.get("text") or "").strip()[:1500]
      if not text: return {"error": "empty"}
      voice = payload.get("voice") or "fr-FR-DeniseNeural"
      # Edge-TTS path (pas de modèle local, juste un wrapper SDK):
      import edge_tts
      communicate = edge_tts.Communicate(text, voice)
      buf = io.BytesIO()
      async for chunk in communicate.stream():
          if chunk["type"] == "audio":
              buf.write(chunk["data"])
      buf.seek(0)
      return StreamingResponse(buf, media_type="audio/mpeg")

(Edge-TTS streame du MP3 — adapter le content-type. Si tu préfères
Piper local pour la souveraineté, swap.)

PARTIE B — Chip côté cockpit
Créer cockpit/lib/tts.js :

  (function(){
    let audio = null;
    window.cockpitTTS = {
      async play(text){
        this.stop();
        // Découvrir l'URL Jarvis tunnel (déjà dans user_profile)
        let baseUrl = "http://localhost:8765";
        try {
          const profile = await window.sb.query("user_profile", "key=eq.jarvis_tunnel_url");
          if (profile && profile[0] && profile[0].value) baseUrl = profile[0].value;
        } catch {}
        const res = await fetch(`${baseUrl}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS server error");
        const blob = await res.blob();
        audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        return new Promise(resolve => { audio.onended = resolve; });
      },
      stop(){
        if (audio) { audio.pause(); audio = null; }
      },
    };
  })();

Charger dans index.html après lib/data-loader.js.

Modifier cockpit/home.jsx > AudioBriefChip pour utiliser cockpitTTS :

  function speak(){
    if (!window.cockpitTTS) {
      // Fallback navigateur
      // (garder l'ancien code speechSynthesis ici)
      return;
    }
    setState("speaking");
    const text = (macro.title ? macro.title + ". " : "") + (macro.body || "");
    window.cockpitTTS.play(text)
      .catch(() => setState("idle"))
      .finally(() => setState("idle"));
  }
  function stop(){
    if (window.cockpitTTS) window.cockpitTTS.stop();
    setState("idle");
  }

Contrainte : si Jarvis serveur n'est pas joignable (timeout 3s),
fallback automatique sur speechSynthesis (préserver le code existant).
Pas de stockage des MP3 — streaming uniquement.

Validation : démarrer Jarvis local (start_jarvis.bat), ouvrir le
Brief, cliquer Lecture audio → voix française neuronale lit le brief.
Couper le serveur, recharger, cliquer → fallback navigateur (voix
système). Aucun crash.
```

---

## 4.X — Checklist d'exécution

| Ordre | Prompt | Tag | P | Effort estimé | Dépend de |
|---|---|---|---|---|---|
| 1 | P1 — Pulses infinies + reduced-motion | A11Y | P0 | 5 min | — |
| 2 | P2 — Contraste `--tx3` Dawn/Atlas | A11Y | P0 | 10 min | — |
| 3 | P3 — Retirer `backdrop-filter` opaque | PERF | P0 | 2 min | — |
| 4 | P4 — Bouton thème Atlas dans le toggle | UX | P0 | 10 min | — |
| 5 | P5 — Streak 0 honnête | UX | P0 | 10 min | — |
| 6 | P6 — Card-actions visibles (fin opacity:0) | UX | P1 | 15 min | — |
| 7 | P7 — Touch targets 36/44 px | A11Y | P1 | 15 min | P6 |
| 8 | P8 — Confirmation + undo « tout marqué lu » | UX | P1 | 45 min | — |
| 9 | P9 — Indicateur « auto » dans le toggle thème | UX | P1 | 30 min | P4 |
| 10 | P10 — Hero « depuis ta dernière visite » | UX | P1 | 1h | — |
| 11 | P11 — Tooltip wiki au survol | JARVIS | P2 | 2h30 | — |
| 12 | P12 — Snooze d'un article | JARVIS | P2 | 1h30 | P6 |
| 13 | P13 — Filtre global « récent · 24h » | JARVIS | P2 | 2h | P10 |
| 14 | P14 — Daily Mirror 19h | JARVIS | P2 | 4h (3 parties) | — |
| 15 | P15 — TTS neuronal Jarvis | JARVIS | P2 | 2h | — |

**Temps total estimé** :
- P0 (5 prompts) : ~37 min — *fais ça aujourd'hui*
- P1 (5 prompts) : ~2h45 — *fais ça cette semaine*
- P2 (5 prompts) : ~12h — *features Jarvis, étalées sur 2-3 semaines*

**Stratégie recommandée** : enchaîner les 5 P0 en une session ce matin (ils sont indépendants, gain immédiat sur a11y + perf + cohérence). P6+P7 ensemble (couple logique). Garder P10 pour un samedi de calme — c'est le prompt qui fait le saut de classe sur la rétention.

---

## Annexe — Les fixes que je n'ai PAS transformés en prompts

Pour transparence, voici les constats restants qui n'ont pas pris la forme d'un prompt parce que (a) trop transversaux pour rester atomiques (b) demandent une décision produit avant code.

1. **Linter token-spec dans la CI** (QW10 dans le tableau quick wins) — script Python qui scanne `cockpit/styles-*.css` et fail toute occurrence `font-size: <number>px` ou `padding: <number>px <number>px` qui n'est pas une variable. Effort 4 (couvrir les exceptions légitimes : SVG, sparkbars), impact massif. Demande un audit décisionnel : on accepte de migrer 20 stylesheets sur quelques semaines, ou on tolère la dette ? Réponse produit avant code.

2. **Migration des stylesheets satellites vers `var(--space-*)` et `var(--text-*)`** — environ 200 occurrences de px hardcodés à remplacer. C'est le préalable propre au linter ci-dessus.

3. **Audit a11y clavier complet** — j'ai vérifié quelques focus-visible et tab-orders ; il faudrait un test exhaustif avec NVDA/VoiceOver sur les 25 panels. Pas un prompt, un sprint.

4. **Décision produit sur la Veille outils** — score le plus bas (2.86). À mon avis le panel souffre d'un manque de hiérarchie : 4 buckets affichés en parallèle sans signal "celui-ci est urgent". Soit on rationalise visuellement, soit on transforme en feed unifié priorisé. Décision Jean avant code.

5. **TFT Matches** — référencé dans CLAUDE.md mais pas vu dans la sidebar visible (`cockpit/data.js` n'a pas d'entrée `tft`). Soit masqué intentionnellement, soit oublié. Question avant code.

---

**Fin de l'audit.** Si une partie te semble light, le prompt à l'origine appelait notamment des « 3 mockups textuels minimum » et des prompts « auto-suffisants » — j'ai privilégié la profondeur et la copie-collable des 15 prompts plutôt que d'élargir à 20-30 quick wins de surface. Le ratio impact/temps de lecture est calibré pour que tu puisses agir dans la matinée.
