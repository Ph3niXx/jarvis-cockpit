# Sport

> Feed éditorial sport multi-disciplines (foot, e-sport, rugby, cyclisme, tennis, natation) basé sur le même composant que Veille IA, corpus dédié.

## Scope
perso

## Finalité fonctionnelle
Consolider la veille sport du matin : actualités RSS par discipline, transferts, matchs, blessures, interviews. Partage entièrement le composant `PanelVeille` ([cockpit/panel-veille.jsx](cockpit/panel-veille.jsx)) avec le panel Veille IA (→ voir [tab-updates.md](tab-updates.md) pour la mécanique de base). Ce doc ne couvre que ce qui est spécifique au corpus `SPORT_DATA`.

## Parcours utilisateur
Identique à Veille IA, avec quelques différences visibles :
- **Pas de section "Acteurs suivis"** (`showActors={false}` dans [app.jsx:388](cockpit/app.jsx:388)) — les sources sont fondues dans l'avatar de chaque item du feed.
- **Filtre principal = Discipline** (catégories explicites : Football / E-sport / Rugby / Cyclisme / Tennis / Natation) avec couleur définie côté route ([app.jsx:388-395](cockpit/app.jsx:388)).
- **Filtre secondaire = Format** : Transfert / Interview / Match / Blessure / Analyse / Actu — inféré du titre par `guessSportType` ([data-loader.js:2631-2639](cockpit/lib/data-loader.js:2631)).
- **Pas de section "Agents en production"** (`prodSection={null}`).

## Fonctionnalités
Identiques à Veille IA, plus :
- **Normalisation des sources** : "L'Equipe" / "L'Équipe" / "L'Équipe XX" → "L'Équipe" ; "RMC …" → "RMC Sport" ([data-loader.js:2625-2630](cockpit/lib/data-loader.js:2625)).
- **Auto-typage** depuis les mots du titre via regex : transfert/mercato/signé → Transfert ; victoire/remporte → Match ; bless/forfait → Blessure ; etc.
- **Hero metrics dynamiques** : Articles 24h / Articles 7j / Top discipline (7j) / Sources distinctes ([data-loader.js:3691-3697](cockpit/lib/data-loader.js:3691)).
- **Acteurs (latéraux du feed)** : construits depuis les sources normalisées avec palette manuelle (`L'Équipe #e4002b`, `RMC Sport #004080`, …). Acteurs non-mappés reçoivent `#555`.
- **Trends = disciplines** : une pseudo-tendance par `category` pondérée par volume. Status = `rising` si ≥20 articles, `stable` ≥10, `new` sinon ([data-loader.js:3744](cockpit/lib/data-loader.js:3744)).

## Front — structure UI
Fichier : [cockpit/panel-veille.jsx](cockpit/panel-veille.jsx) (partagé). Props distinctives :
```jsx
<PanelVeille
  corpus="SPORT_DATA"
  title="Sport"
  showActors={false}
  categoryLabel="Discipline"
  typeLabel="Format"
  categories={[
    { id: "foot", label: "Football", color: "#004170" },
    { id: "esport", label: "E-sport", color: "#0ac7ff" },
    { id: "rugby", label: "Rugby", color: "#1a3a6c" },
    { id: "cyclisme", label: "Cyclisme", color: "#d8a93a" },
    { id: "tennis", label: "Tennis", color: "#b3491a" },
    { id: "natation", label: "Natation", color: "#e67040" },
  ]}
  prodSection={null}
/>
```
Route id = `"sport"`, URL hash `#sport`. **Panel Tier 2** (dans `TIER2_PANELS` à [data-loader.js:4251](cockpit/lib/data-loader.js:4251)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelVeille(...)` | Composant partagé avec Veille IA — voir [tab-updates.md](tab-updates.md) | [panel-veille.jsx:175](cockpit/panel-veille.jsx:175) |
| `T2.sport()` | `GET sport_articles?order=date_published.desc.nullslast,date_fetched.desc&limit=200` mémoïsé | [data-loader.js:1242](cockpit/lib/data-loader.js:1242) |
| `transformSportFeed(articles)` | Mappe article → shape feed (id, actor normalisé, category, type inféré, date_h, title, summary ≤260, tags, unread, url) | [data-loader.js:2640-2661](cockpit/lib/data-loader.js:2640) |
| `normalizeSportSource(src)` | Regroupe "L'Equipe" / "RMC …" | [data-loader.js:2625-2630](cockpit/lib/data-loader.js:2625) |
| `guessSportType(title)` | Regex FR sur le titre → Transfert / Match / Interview / Blessure / Analyse / Actu | [data-loader.js:2631-2639](cockpit/lib/data-loader.js:2631) |
| `loadPanel("sport")` case | Appelle `T2.sport()`, remplace feed + construit actors (palette manuelle) + trends (par discipline) + headline avec KPIs computed | [data-loader.js:3660-3748](cockpit/lib/data-loader.js:3660) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `sport_articles` | `id, title, summary, source, category, url, date_published, fetch_date` | 200 lignes max |

Table dédiée (séparée de `articles`), schéma proche mais avec une colonne `category` explicite (discipline) et pas de `section`.

## Back — pipelines qui alimentent
- **Sport sync** ([pipelines/sport_sync.py](pipelines/sport_sync.py)) — GitHub Actions cron `30 6 * * *` (quotidien 6h30 UTC, juste après le pipeline IA) via [sport-sync.yml](.github/workflows/sport-sync.yml) :
  - Fetch RSS des flux sport (L'Équipe par discipline + RMC Sport + Millenium e-sport + Cyclism'Actu + autres)
  - Groupement par discipline (classification côté pipeline sur le feed URL)
  - Déduplication par `url` via `on_conflict=url`
  - Upsert dans `sport_articles`
- **Pipelines daily/weekly/Jarvis** : aucune interaction.

## Appels externes
- **Supabase REST** : `T2.sport()` via `q("sport_articles", ...)`. Mémoïsé par `once("sport_articles")`.
- **localStorage** : `read-articles` (partagé avec tous les panels Veille), `veille-read-state` (partagé cross-corpus).
- **`window.open(url, "_blank")`** : ouverture article externe.

## Dépendances
- **Onglets frères** : partage `PanelVeille` avec `updates`, `gaming_news`, `anime`, `news`. Les `loadVeilleReadState` / `saveVeilleReadState` sont cross-corpus.
- **Pipelines** : `sport-sync.yml` obligatoire (sinon table vide).
- **Variables d'env / secrets** : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (côté backend uniquement).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant `T2.sport()`.
- **Empty corpus** : **bug** — `if (window.SPORT_DATA && articles.length)` ([data-loader.js:3662](cockpit/lib/data-loader.js:3662)) garde le fake (data-sport.js) quand le corpus est vide. Même pattern que celui déjà fixé pour Veille IA.
- **Article sans `category`** : fallback `"autre"` dans `catCounts7d` / `byCategory` mais pas de pill dans `categories` côté route → filtre invisible.
- **Article sans `source`** : `normalizeSportSource` retourne `"—"`, un acteur `"—"` est créé avec la couleur par défaut `#555`.
- **Title sans mots-clés connus** : `guessSportType` tombe sur `"Actu"` par défaut.
- **Corpus introuvable** : `"Corpus SPORT_DATA introuvable."` si `cockpit/data-sport.js` n'est pas chargé.
- **Trend filter** : naïf sur le label (découpe whitespace). Pour "E-sport" qui fait 7 chars le filtre matche. Pour "Rugby" (5 chars) aussi. OK.
- **`readState` persistant** : cross-corpus (cf. Veille IA) — un article archivé en Sport ne bloque pas d'article en Veille IA car les IDs viennent de tables distinctes (`sport_articles` vs `articles`).

## Limitations connues / TODO
- [x] ~~Bug feed-fake-fallback non corrigé pour sport~~ → **fixé** : `if (window.SPORT_DATA)` remplace désormais `feed` en toutes circonstances. Les autres blocs (headline / actors / trends / categories) restent gardés par `articles.length`.
- [x] ~~Même bug sur les 3 autres panels Veille~~ → **fixé pour `gaming_news`, `anime`, `news`** (même pattern minimaliste appliqué).
- [x] ~~Palette couleurs acteurs limitée~~ → **fixé** : 4 sources gardent leur couleur brand (L'Équipe rouge, RMC bleu, Millenium orange, Cyclism'Actu vert) ; le reste est colorié par hash du nom sur une palette de 10 couleurs.
- [x] ~~Catégories hardcoded côté route~~ → **auto-détectées** : le loader populate `SPORT_DATA.categories` depuis les `article.category` uniques. Le panel utilise `effectiveCategories = prop || v.categories`. app.jsx ne passe plus la prop `categories` pour sport — seul le color-map est conservé côté loader (`SPORT_CATEGORY_COLORS`).
- [ ] **Hero metrics hardcoded labels** : "Articles 24h / 7j / Top discipline / Sources" — pas customisables par discipline.
- [ ] **`guessSportType` par regex FR** : fragile sur les titres anglais ou formulations originales ("Prolonge" matche mais "sign his new contract" non). À revoir pour e-sport notamment.
- [ ] **Pas de tri par discipline au sein du feed** : tout est mélangé chronologiquement après filtre. Un "groupe par discipline" comme les types de Veille IA serait utile.
- [ ] **Pas de `prod_cases` / cas prod** : `prodSection={null}` côté route. Si on voulait ajouter "Calendrier des matchs à venir", il faudrait un nouveau pipeline.
- [ ] **Nouvelles disciplines sans couleur** : tombent sur gris `#888` dans les pills. À étendre `SPORT_CATEGORY_COLORS` si un nouveau sport apparaît.
- [ ] **Label des disciplines dépend encore de `SPORT_CATEGORY_LABELS`** hardcoded côté loader. Ajouter `handball` requiert d'étendre les deux maps (labels + couleurs).
- [ ] **CTAs hero** : les CTAs "Lire le détail" / "Sauvegarder" fonctionnent automatiquement (via le fix `updates`) puisque le même code path patche `headline.url` + `id`. À vérifier visuellement.
- [ ] **Gaming/anime/news gardent encore la palette manuelle + catégories hardcoded** : pourra être migré sur le même pattern `v.categories` + hash fallback quand on y passera.

## Dernière MAJ
2026-04-23 — fix feed-fake sur 4 panels + hash-colors sport + catégories dynamiques (local, non pushé)
