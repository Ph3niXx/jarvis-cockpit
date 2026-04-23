# Actualités

> Feed actualités généralistes par zone (Paris / France / International) depuis une dizaine de sources RSS françaises + internationales francophones.

## Scope
mixte

## Finalité fonctionnelle
Dernier des 5 panels Veille. Agrège les actus non-spécialisées (Le Monde, Le Figaro, FranceInfo, Libération, 20 Minutes, Le Parisien, BFM Paris, BBC World, France 24, RFI) pour avoir un pouls de l'info générale à côté de la veille IA / sport / gaming / anime. Catégorisation **par source** (pas par regex) : chaque feed RSS a une `default_category` figée dans le pipeline. Partage `PanelVeille` avec les 4 autres routes Veille — mécanique dans [tab-updates.md](tab-updates.md), pattern zone/type dans [tab-sport.md](tab-sport.md).

## Parcours utilisateur
Identique aux autres panels Veille sans acteurs, avec :
- **Filtre Zone** (`categoryLabel="Zone"`) : Paris / France / International — auto-détectés depuis `v.categories` (populé par le loader).
- **Filtre Rubrique** (`typeLabel="Rubrique"`) : Actu / Live / Analyse / Interview / Tribune / Annonce — inféré du titre par `guessNewsType` ([data-loader.js:2786-2793](cockpit/lib/data-loader.js:2786)).
- **Pas d'"Acteurs suivis"** (`showActors={false}`), **pas de "Cas prod"** (`prodSection={null}`).

## Fonctionnalités
Identiques aux autres panels Veille, plus :
- **Normalisation source** : préfixes variants compactés — `Le Parisien` absorbe `"Le Parisien · Paris"`, idem pour `20 Minutes`, `Le Monde`, `FranceInfo`, `RFI` ([data-loader.js:2777-2784](cockpit/lib/data-loader.js:2777)).
- **Auto-typage** via regex FR : `interview/confie/témoignage → Interview`, `tribune/édito/opinion → Tribune`, `analyse/enquête/reportage → Analyse`, `direct/en direct → Live`, `annonce/confirme → Annonce`, fallback `Actu`.
- **Hero metrics dynamiques** : Articles 24h / 7j / Top zone (7j) / Sources distinctes.
- **Acteurs (avatars feed)** : 10 sources avec couleur brand curée (Le Parisien `#003594`, 20 Minutes `#00ad97`, BFM Paris `#0066cc`, Le Monde `#000`, Le Figaro `#1e3a8a`, FranceInfo `#e20613`, Libération `#d2142f`, BBC World `#bb1919`, France 24 `#d9b15e`, RFI `#cc0000`). Fallback `nameHashColor` pour les sources inconnues.
- **Trends = zones** pondérées par volume 7j. Status `rising ≥20`, `stable ≥10`, sinon `new` ([data-loader.js:4163](cockpit/lib/data-loader.js:4163)).

## Front — structure UI
Fichier : [cockpit/panel-veille.jsx](cockpit/panel-veille.jsx) (partagé). Props distinctives :
```jsx
<PanelVeille
  corpus="NEWS_DATA"
  title="Actualités"
  showActors={false}
  categoryLabel="Zone"
  typeLabel="Rubrique"
  prodSection={null}
/>
```
Pills "Zone" auto-détectées via `NEWS_DATA.categories` populé au `loadPanel`. Color-map `NEWS_CATEGORY_COLORS` côté loader.

Route id = `"news"`, URL hash `#news`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelVeille(...)` | Composant partagé — voir [tab-updates.md](tab-updates.md) | [panel-veille.jsx:175](cockpit/panel-veille.jsx:175) |
| `T2.news()` | `GET news_articles?order=date_published.desc.nullslast,date_fetched.desc&limit=200` mémoïsé sous `news_articles` | [data-loader.js](cockpit/lib/data-loader.js) |
| `transformNewsFeed(articles)` | Mappe article → shape feed (id, actor normalisé, category, type inféré, date_h, title, summary ≤260, tags, unread, url) | [data-loader.js:2795](cockpit/lib/data-loader.js:2795) |
| `normalizeNewsSource(src)` | Regroupe préfixes "Le Parisien/20 Minutes/Le Monde/FranceInfo/RFI" | [data-loader.js:2777-2784](cockpit/lib/data-loader.js:2777) |
| `guessNewsType(title)` | Regex FR → 6 types (Interview / Tribune / Analyse / Live / Annonce / Actu) | [data-loader.js:2786-2793](cockpit/lib/data-loader.js:2786) |
| `loadPanel("news")` case | Appelle `T2.news()`, remplace feed en toutes circonstances, puis enrichit headline / actors / trends / categories si articles.length>0 | [data-loader.js:4077](cockpit/lib/data-loader.js:4077) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `news_articles` | `id, title, summary, source, category, url, date_published, fetch_date` | 200 lignes max |

Table dédiée, schéma aligné sur `sport_articles` / `gaming_articles` / `anime_articles`.

## Back — pipelines qui alimentent
- **News sync** ([pipelines/news_sync.py](pipelines/news_sync.py)) — GitHub Actions cron `15 7 * * *` (quotidien 7h15 UTC) via [news-sync.yml](.github/workflows/news-sync.yml) :
  - Fetch RSS de 12 flux (3 Paris + 5 France + 4 International) — liste hardcoded dans [news_sync.py:28-46](pipelines/news_sync.py:28).
  - **Classification par source** : la `category` est déterminée par le feed d'origine, pas par regex. Plus simple mais moins précis que sport/gaming/anime.
  - Déduplication par `url` via `on_conflict=url`.
  - Max 12 articles par feed.

## Appels externes
- **Supabase REST** : `T2.news()`.
- **localStorage** : `read-articles`, `veille-read-state` (cross-corpus).
- **`window.open(url, "_blank")`** : ouverture article.

## Dépendances
- **Onglets frères** : `PanelVeille` partagé avec `updates`, `sport`, `gaming_news`, `anime`.
- **Pipelines** : `news-sync.yml` obligatoire (sinon table vide).
- **Variables d'env / secrets** : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (pipeline backend uniquement).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2.
- **Empty corpus** : OK — feed replacé par `[]` en toutes circonstances.
- **Article sans `category`** : fallback `"france"` ([data-loader.js:2803](cockpit/lib/data-loader.js:2803)).
- **Article sans `source`** : `normalizeNewsSource` retourne `"—"` → couleur via `nameHashColor("—")`.
- **Title sans mot-clé connu** : `guessNewsType` → `"Actu"`.
- **Corpus introuvable** : message `"Corpus NEWS_DATA introuvable."` si `cockpit/data-news.js` pas chargé.

## Limitations connues / TODO
- [x] ~~Palette acteurs manuelle + `#555` fallback~~ → **fixé** : 10 brands + `nameHashColor` pour le reste.
- [x] ~~Catégories hardcoded côté route~~ → **auto-détectées** depuis le corpus. `app.jsx` allégé.
- [ ] **Classification par source (pas par regex)** : si un article Le Monde parle de Paris, il est taggé `france` parce que le feed `Le Monde · À la Une` est classé `france`. Contraste avec gaming/anime qui utilisent des regex fines sur titre+summary. Trade-off : simplicité vs précision.
- [ ] **Pas de rubrique Sport / Culture / Économie** : tout est "général". Si on veut segmenter davantage, il faudrait ajouter des feeds thématiques par source (Le Monde Éco, Le Figaro Culture, etc.).
- [ ] **`guessNewsType` fragile** sur les titres courts / gros titres sans verbe. Plus un gadget qu'un vrai signal.
- [ ] **Pas de géolocalisation hors FR** : les actus internationales sont traitées en bloc. Si on voulait "US news" vs "Moyen-Orient" vs "Asie", il faudrait structurer en sous-catégories.
- [ ] **Trends seuils (20/10) pensés pour un volume FR** : si on ajoute BBC + Reuters + Al-Jazeera, le volume international grossira et le status tombera en permanence "rising".
- [ ] **`NEWS_CATEGORY_COLORS` hardcoded** : nouvelle zone côté pipeline tombe sur gris `#888`. Ajouter une entrée = 1 ligne.
- [ ] **Hero title tronqué à 120 chars** via `tagline: fresh.title`. OK pour la plupart des titres FR, peut être court pour BBC/France24 qui ont des titres longs.
- [ ] **Pas de filtre "Scope" (perso/pro)** : le panel est taggé `mixte` dans index.json mais toutes les actus sont mélangées. Si un jour on veut séparer "actu perso" de "actu pro", il faudrait structurer par tags.

## Dernière MAJ
2026-04-23 — migration news hash-colors + catégories dynamiques (local, non pushé)
