# Veille IA

> Feed unifié des actualités IA : hero release + acteurs suivis + tendances transverses + chronologie filtrable + cas prod, sur 30 jours d'articles.

## Scope
pro

## Finalité fonctionnelle
Panel le plus dense du cockpit. Centralise tout ce qui tombe des flux RSS veille IA : releases de labos/éditeurs, frameworks, cas prod entreprise, papiers, deals, régulation, analyses. Transforme les 400 articles des 30 derniers jours (`T2.veille()`) en un feed navigable avec filtres triples (acteur / type / période) + filtre "tendance" cliquable.

⚠️ Ce panel **partage le composant** `PanelVeille` avec 4 autres routes (`sport`, `gaming_news`, `anime`, `news`) via un système de props/corpus. Le corpus "updates" pointe sur `window.VEILLE_DATA`.

## Parcours utilisateur
1. Clic sidebar "Veille IA" — un loader s'affiche pendant deux à trois secondes le temps de charger les 30 derniers jours d'articles.
2. La page apparaît avec le hero (dernière release mise en avant), la grille d'acteurs suivis, les tendances transverses, le feed chronologique et la grille de cas prod.
3. L'utilisateur combine les filtres : par acteur (clic sur une carte d'acteur ou une pill), par type (Release / Framework / Cas prod / Papier / Deal / Régulation / Analyse), par période (24h / 7j / 30j).
4. Clic sur une carte de tendance pour filtrer en plus le feed sur les mots-clés de la tendance.
5. Par défaut, le feed est groupé par type (sections dépliables) avec prévisualisation de cinq items et bouton "Voir les N autres" pour déplier.
6. Clic sur un item pour l'ouvrir en onglet externe — l'article est marqué lu automatiquement.
7. Actions par item : marquer lu/non-lu, archiver (masque l'item du feed), ouvrir en onglet externe.
8. Bouton "Tout marquer lu" en header du feed tant qu'il reste des non-lus dans la sélection en cours.
9. Toggle flottant en bas à droite pour basculer entre un affichage éditorial aéré et un affichage dense.

## Fonctionnalités
- **Hero release** : en tête de page, la dernière release majeure mise en avant (acteur, version, tagline, résumé et quatre benchmarks clés) pour repérer d'un coup d'œil ce qui vient de sortir.
- **Acteurs suivis** : une grille de cartes par labo/éditeur, chacune avec son momentum, son dernier contenu et une micro-courbe d'activité sur huit semaines. Un clic filtre le feed sur l'acteur.
- **Tendances transverses** : quatre à six cartes de tendances (nouvelle / en hausse / stable / débattue) avec un mini-histogramme d'activité. Un clic filtre le feed par mots-clés de la tendance.
- **Feed chronologique** : tous les articles des 30 derniers jours groupés par type (Release / Framework / Cas prod / Papier / Deal / Régulation / Analyse), triés non-lus en premier, avec prévisualisation de cinq items et bouton « Voir les N autres » pour déplier.
- **Triple filtre** : trois groupes de pills (acteur / type / période 24h-7j-30j) combinables, avec bouton de réinitialisation quand le filtre vide la vue.
- **Actions par article** : marquer lu/non-lu, archiver pour masquer définitivement, ouvrir dans un nouvel onglet. Un bouton « Tout marquer lu » vide la pile d'un coup.
- **Cas prod / Agents en production** : grille de cartes d'entreprises (domaine, échelle, modèle, impact) pour voir qui a déployé quoi le mois en cours.
- **Toggle de densité** : un flottant en bas à droite pour basculer entre un affichage éditorial aéré et un affichage dense.
- **Filtre global "Récent · 24h"** : quand le filtre du shell (en haut à droite du cockpit) est actif, le feed ne montre que les articles publiés ou récupérés depuis moins de 24 heures ; les autres se masquent silencieusement. Identique sur tous les onglets de veille (Claude, Sport, Gaming, Anime, News, Veille outils).

## Front — structure UI
Fichier : [cockpit/panel-veille.jsx](cockpit/panel-veille.jsx) — 620 lignes, monté par [app.jsx:384-385](cockpit/app.jsx:384) avec props `corpus="VEILLE_DATA"`, `title="Veille IA"`, `actorsLabel="labos + éditeurs"`, `prodSection={ kicker: "Agents en production", title: "Qui a déployé quoi, ce mois-ci" }`.

Structure DOM (`.vl-panel`) :
- `.vl-hero` (split left/right)
  - `.vl-hero-left` — kicker + actor + tagline + body + CTAs
  - `.vl-hero-right` — `.vl-hero-metrics` (4 `.vl-metric`)
- `.vl-section` **Acteurs suivis** (si `showActors=true`) — `.vl-actors-grid > .vl-actor-card × N`
- `.vl-section` **Tendances transverses** — `.vl-trends-grid > .vl-trend-card × N`
- `.vl-section` **Feed chronologique**
  - `.vl-filters > .vl-filter-group × 3` (acteur/type/période)
  - `.vl-feed-groups > <details>.vl-feed-group × N` (ou `.vl-feed > .vl-feed-item × N` si flat)
- `.vl-section` **Cas prod / Agents en production** — `.vl-prod-grid > .vl-prod-card × N` OU `<ProdTable>`
- `.vl-tone-toggle` flottant en bas à droite

Route id = `"updates"`, URL hash `#updates`. **Panel Tier 2** (listé dans `TIER2_PANELS` à [data-loader.js:4251](cockpit/lib/data-loader.js:4251)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelVeille({ data, corpus, title, actorsLabel, prodSection, showActors, categoryLabel, categories, typeLabel, prodTableMode })` | Composant racine paramétrique | [panel-veille.jsx:175](cockpit/panel-veille.jsx:175) |
| `ActorMark({ actor, size })` | Pastille d'acteur coloré avec initiale | [panel-veille.jsx:11](cockpit/panel-veille.jsx:11) |
| `PulseBars({ pulse, color })` | Mini-histogramme 8 barres (activité hebdo) | [panel-veille.jsx:23](cockpit/panel-veille.jsx:23) |
| `ProdTable({ prodSection, items })` | Table triée des sorties prévues avec filtres année+mois (mode `prodTableMode`) | [panel-veille.jsx:36](cockpit/panel-veille.jsx:36) |
| `renderItem(f)` (inline) | Rend une card `.vl-feed-item` avec actor mark + meta + title + summary + tags + actions | [panel-veille.jsx:464-516](cockpit/panel-veille.jsx:464) |
| `openArticle()` (inline) | `localStorage.read-articles[id] = {ts, kept}` + `markRead` + `window.open(url)` | [panel-veille.jsx:467-476](cockpit/panel-veille.jsx:467) |
| `markRead(id)` (inline) | Toggle `readState[id]` entre "read" et undefined | [panel-veille.jsx:218](cockpit/panel-veille.jsx:218) |
| `archive(id)` (inline) | `readState[id] = "archived"` → filtré out | [panel-veille.jsx:219](cockpit/panel-veille.jsx:219) |
| `markAllRead()` (inline) | Passe tout le feed filtré à `read` en un clic | [panel-veille.jsx:220-224](cockpit/panel-veille.jsx:220) |
| `useMemoVeille filtered` | Applique actor/type/period/trend avec matching keyword sur le label | [panel-veille.jsx:190-208](cockpit/panel-veille.jsx:190) |
| `useMemoVeille availableTypes` | Extrait `Set(feed.map(f => f.type))`, préfixe "Tous" | [panel-veille.jsx:211-214](cockpit/panel-veille.jsx:211) |
| `T2.veille()` | `GET articles?fetch_date=gte.<d-30>&order=fetch_date.desc&limit=400`, mémoïsé via `once()` | [data-loader.js:1195](cockpit/lib/data-loader.js:1195) |
| `transformVeilleFeed(articles)` | Mappe chaque article → shape feed (id, actor, type, date_h, date_label, title, summary, tags, unread, icon, url) | [data-loader.js:2880](cockpit/lib/data-loader.js:2880) |
| `loadPanel("updates")` case | Appelle `T2.veille()`, remplace `VEILLE_DATA.feed`, patch headline avec l'article le plus frais | [data-loader.js:3560-3578](cockpit/lib/data-loader.js:3560) |

Mapping section → type (hardcoded) dans [data-loader.js:2605-2614](cockpit/lib/data-loader.js:2605) :
- `updates, llm` → Release
- `agents, tools` → Framework
- `energy, biz` → Analyse
- `finserv` → Deal
- `reg` → Régulation
- `papers` → Papier
- fallback → Analyse

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `articles` | `id, title, summary, source, section, tags, url, date_published, fetch_date` | 400 lignes / 30j max |

**Données maintenant branchées** :
- `VEILLE_DATA.actors` — top 12 sources agrégées depuis `articles` sur 30j avec momentum `7d - 30d/4.3`, latest article, couleur dérivée du nom. Fallback sur le fake data-veille.js si aucun article ([data-loader.js:3593-3624](cockpit/lib/data-loader.js:3593)).
- `VEILLE_DATA.trends` — top 6 termes de `signal_tracking` (via `__COCKPIT_RAW.signals` chargé en Tier 1). Mapping status : `new → new`, `rising → rising`, `stable → stable`, `declining → debated`. Pulse dérivée de `history` JSONB ([data-loader.js:3627-3657](cockpit/lib/data-loader.js:3627)).
- `VEILLE_DATA.headline` — patch complet incluant `url` + `id` pour activer les CTAs.

**Données toujours fake** :
- `VEILLE_DATA.prod_cases` — grid des agents en prod (contenu spécifique par corpus, pas de pipeline générique).
- `VEILLE_DATA.headline.metrics` — 4 benchmarks (SWE-bench, τ-bench, prix, contexte) — difficile à auto-générer.

Le `feed` est toujours reconstruit depuis `articles` (même si vide).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — cron `0 6 * * 1-5` :
  - Fetch RSS → Gemini enrichit (extract tags, section, date_published)
  - `POST articles` par batch de 50 ([main.py:797](main.py:797))
  - La `section` détermine le `type` affiché via `SECTION_TO_TYPE` côté front
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : aucune interaction directe.
- **Jarvis (local)** : aucune.

Pas de pipeline qui alimente `actors`, `trends`, `prod_cases` — tout est du contenu curé hardcodé.

## Appels externes
- **Supabase REST** : `T2.veille()` via `q("articles", ...)`. Partagé avec `history` (même clé de cache via `once()`).
- **localStorage** : `read-articles` (persistant, pour le "lu" cross-session) et `readState` in-memory (pour "archived").
- **`window.open(url, "_blank", "noopener")`** : ouverture article.

## Dépendances
- **Onglets in** : aucune navigation entrante autre que la sidebar.
- **Onglets out** : aucune (les clics ouvrent en externe, pas en interne).
- **Panels frères** (mêmes codepath) : `sport`, `gaming_news`, `anime`, `news` via `PanelVeille` + corpus différents.
- **Pipelines** : `daily_digest.yml` obligatoire (articles).
- **Variables d'env / secrets** : aucune côté front.

## États & edge cases
- **Loading** : `<PanelLoader>` pendant `loadPanel("updates")` (Tier 2). [app.jsx:361](cockpit/app.jsx:361).
- **Corpus introuvable** : fallback `"Corpus VEILLE_DATA introuvable."` ([panel-veille.jsx:177](cockpit/panel-veille.jsx:177)) — ne devrait pas arriver car le corpus est chargé par `data-veille.js` avant le mount.
- **Empty feed après filtres** : bloc `.vl-empty` avec icône + bouton "Réinitialiser" qui remet actorFilter=all / typeFilter=Tous / period=30j ([panel-veille.jsx:454-461](cockpit/panel-veille.jsx:454)).
- **Empty après Tier 2** : si `T2.veille()` retourne `[]`, le feed reste celui du fake data (pas de fallback `feed = []`). **Bug potentiel** : la condition `if (window.VEILLE_DATA && articles.length)` signifie qu'avec 0 articles Supabase, le fake feed reste affiché ([data-loader.js:3562](cockpit/lib/data-loader.js:3562)).
- **Erreur Tier 2** : `PanelError` avec bouton Réessayer ([app.jsx:363](cockpit/app.jsx:363)).
- **Article sans URL** : la card n'a pas de `cursor: pointer` ; `openArticle` no-op mais `markRead` via le bouton marche quand même.
- **Article sans section** : `SECTION_TO_TYPE[undefined]` → fallback "Analyse".
- **Trend filter** : si le label contient uniquement des mots courts (≤3 chars), `trendKeywords` est vide → aucun filtrage effectif ([panel-veille.jsx:192](cockpit/panel-veille.jsx:192)).
- **Acteur inexistant dans actors** : `actors.find(a => a.name === f.actor)` retourne `undefined` → fallback `<span className="vl-actor-mark vl-actor-mark--neutral">` avec première lettre du source ([panel-veille.jsx:485](cockpit/panel-veille.jsx:485)).
- **Tone toggle** : reset à `"dense"` à chaque navigation vers le panel.
- **readState** : reset à `{}` à chaque navigation (in-memory only, perdu).

## Limitations connues / TODO
- [x] ~~`actors`, `trends` = fake data~~ → **fixé** : actors agrégés depuis `articles` (top 12 sources avec momentum), trends depuis `signal_tracking` (top 6 termes). `prod_cases` et `headline.metrics` restent fake (trop spécifiques).
- [x] ~~Feed reste fake si Supabase vide~~ → **fixé** : `if (window.VEILLE_DATA)` au lieu de `if (window.VEILLE_DATA && articles.length)`. Feed vide quand le corpus l'est.
- [x] ~~Bouton "Ajouter un acteur" sans onClick~~ → **remplacé** par un hint non-interactif "Auto-détecté · top 12".
- [x] ~~CTAs hero "Lire le détail" / "Sauvegarder" sans onClick~~ → **wirés** : "Lire le détail" ouvre `headline.url` + marque lu, "Sauvegarder" écrit `kept: true` dans `localStorage.read-articles[headline.id]`. Boutons `disabled` si `url/id` absents.
- [x] ~~`readState` perdu à la navigation~~ → **persisté** dans `localStorage.veille-read-state` (un seul key cross-corpus, OK car IDs viennent de tables distinctes). Lecture au mount, save à chaque changement via `useEffect`.
- [ ] **Trend filter naïf** : keyword matching via `split(/\s+/).filter(w => w.length > 3)` sur le label. Les tendances courtes (ex: "MCP", "RAG") ne filtrent rien.
- [ ] **`SECTION_TO_TYPE` hardcodé** : toute nouvelle section côté pipeline tombera dans "Analyse" par défaut ([data-loader.js:2607](cockpit/lib/data-loader.js:2607)).
- [ ] **Tone toggle non persistant** : revient à "dense" à chaque navigation.
- [ ] **`<details>` natifs pour les groupes** : bon pour l'accessibilité mais l'UX est moyen (pas de transition, indicateur basique).
- [ ] **Pas de pagination au-delà de 400 articles** : un cockpit actif depuis 2 mois perdra les articles plus anciens du corpus visible.
- [ ] **Hero ne gère pas "pas de release récente"** : `fresh = articles[0]` prend toujours le dernier, même si c'est un vieux article.
- [ ] **`prod_cases` + `headline.metrics` restent fake** — benchmarks et cas prod demandent une curation manuelle.
- [ ] **`actors_involved` des trends toujours vide** : nécessiterait une dénormalisation dans `signal_tracking` (liste des sources citant le terme).
- [ ] **Panels frères partagent le composant** : toute modif sur `updates` affecte aussi `sport`, `gaming_news`, `anime`, `news`. Les helpers `loadVeilleReadState` / `saveVeilleReadState` sont donc globaux cross-corpus.
- [ ] **Couleurs acteurs dérivées d'un hash** : conflits de couleurs possibles avec beaucoup de sources similaires. Palette de 10 couleurs.

## Dernière MAJ
2026-04-26 — feed cards exposent `data-recent="1"` quand `date_h <= 24` ; le filtre global du shell (`:root[data-filter-recent="1"]`) masque en CSS les cards `data-recent="0"`. Pas de re-fetch, pas de re-render, pure CSS.
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — acteurs/tendances dynamiques + fix feed fake + CTAs wirés + persistance readState (local, non pushé)
