# Anime / Ciné / Séries

> Feed actualités anime + ciné + séries, doublé d'un calendrier "Prochaines sorties anime" alimenté par MyAnimeList (Jikan API). Seul panel Veille à utiliser le mode `ProdTable`.

## Scope
perso

## Finalité fonctionnelle
Veille loisirs vidéo : actualités RSS (AlloCiné, Première, Écran Large, Anime News Network, Deadline, Variety, Hollywood Reporter, IndieWire, etc.) + **calendrier des animes à venir** issu de l'API publique Jikan v4. Le panel mélange un feed éditorial classique (release / upcoming / industry) et une table sortable filtrable par année + mois pour planifier les visionnages. Partage `PanelVeille` avec les 4 autres routes Veille — mécanique de base dans [tab-updates.md](tab-updates.md).

## Parcours utilisateur
Identique à Sport / Gaming pour le feed, plus :
- **Filtre Statut** (`categoryLabel="Statut"`) : Sorties récentes / À venir prochainement / Industrie ([app.jsx:407-411](cockpit/app.jsx:407)).
- **Filtre Format** : Critique / Trailer / Interview / Audience / Deal / Diffusion / Annonce / Sortie / Actu — inféré du titre par `guessAnimeType` ([data-loader.js:2735-2746](cockpit/lib/data-loader.js:2735)).
- **Section "Prochaines sorties anime"** en bas : table sortable par date avec filtres année + mois ([panel-veille.jsx:36-173](cockpit/panel-veille.jsx:36)). Source = articles `MyAnimeList` `category=upcoming` triés par `date_published` ascendant. Affiche titre nettoyé (sans le préfixe `[TV]/[Movie]/[OVA]/[Special]/[ONA]`), studio extrait du summary via regex `Studio\s*:\s*(...)`, lien direct MAL.

## Fonctionnalités
Identiques à Veille IA (hero actu + tendances + feed filtrable), plus les spécificités anime/ciné/séries :
- **Filtre Statut** : un bandeau de pills (Sorties récentes / À venir prochainement / Industrie) pour cibler le type de contenu.
- **Filtre Format** : un deuxième bandeau (Critique / Trailer / Interview / Audience / Deal / Diffusion / Annonce / Sortie / Actu) déduit automatiquement du titre.
- **Regroupement AlloCiné** : les sous-marques éditoriales (« AlloCiné Cinéma », « AlloCiné Séries »…) sont fusionnées sous un seul acteur pour éviter les doublons.
- **Tableau de bord statut** : quatre indicateurs en tête de page — articles sur 24h, articles sur 7j, statut le plus actif cette semaine, nombre de sources distinctes.
- **Couleurs de marque curées** : AlloCiné, Première, Écran Large, Anime News Network, MyAnimeList, TMDB, Deadline, Variety, Hollywood Reporter et IndieWire gardent leur couleur brand dans les pastilles ; les autres sources sont coloriées automatiquement.
- **Calendrier « Prochaines sorties »** : en bas de page, une table dédiée aux animes/films/séries à venir, triée par date, avec trois filtres Année / Mois / Type (TV / Movie / OVA / Special / ONA / Anime). Studio ou producteur affichés à côté du titre, lien direct vers la fiche MyAnimeList ou TMDB. Message explicite quand aucune sortie ne tombe sur la période.

## Front — structure UI
Fichier : [cockpit/panel-veille.jsx](cockpit/panel-veille.jsx) (partagé). Props distinctives :
```jsx
<PanelVeille
  corpus="ANIME_DATA"
  title="Anime / Ciné / Séries"
  showActors={false}
  categoryLabel="Statut"
  typeLabel="Format"
  prodSection={{ kicker: "Prochaines sorties", title: "Animes + films + séries à venir" }}
  prodTableMode={true}
/>
```
Pills "Statut" viennent désormais de `ANIME_DATA.categories` (populé par le loader). Color-map `ANIME_CATEGORY_COLORS` côté loader.
Route id = `"anime"`, URL hash `#anime`. **Panel Tier 2**.

Le composant `<ProdTable>` (sous-component de panel-veille.jsx) rend :
- Filtres année (auto-détectés depuis `air_iso`, "Tout" + une pill par année)
- Filtres mois (auto-détectés selon l'année sélectionnée, en français)
- **Filtres Type** (auto-détectés : TV / Movie / OVA / Special / ONA / Anime) — row caché si ≤ 1 type présent
- Table 5 colonnes : Date / Titre / Type / Label / Lien (label adaptatif : "MAL ↗" pour MyAnimeList, "TMDB ↗" pour TMDB, "↗" par défaut)
- Empty state "Aucune sortie prévue sur cette période."

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelVeille(...)` | Composant partagé — voir [tab-updates.md](tab-updates.md) | [panel-veille.jsx:175](cockpit/panel-veille.jsx:175) |
| `ProdTable({ prodSection, items })` | Table des sorties à venir avec filtres année/mois en cascade | [panel-veille.jsx:36](cockpit/panel-veille.jsx:36) |
| `T2.anime()` | `GET anime_articles?order=date_published.desc.nullslast,date_fetched.desc&limit=200` mémoïsé | [data-loader.js:1244](cockpit/lib/data-loader.js:1244) |
| `transformAnimeFeed(articles)` | Mappe article → shape feed | [data-loader.js:2747](cockpit/lib/data-loader.js:2747) |
| `normalizeAnimeSource(src)` | Regroupe les variantes "AlloCiné" | [data-loader.js:2730-2734](cockpit/lib/data-loader.js:2730) |
| `guessAnimeType(title)` | Regex FR+EN sur le titre → 9 types (Diffusion, Audience, etc.) | [data-loader.js:2735-2746](cockpit/lib/data-loader.js:2735) |
| `loadPanel("anime")` case | Feed + headline + actors + trends + **prod_cases** depuis filtre `MyAnimeList + upcoming` | [data-loader.js:3889-4007](cockpit/lib/data-loader.js:3889) |
| Construction `prod_cases` (inline) | Filtre **source-agnostique** `category === "upcoming" && date_published` (accepte Jikan + TMDB + tout futur pipeline), parse `[TV]/[Movie]` du titre, extrait studio/producteur par regex `(Studio|Producteur)\s*:\s*(...)`, color row selon source (MAL `#2e51a2` / TMDB `#0d253f` / neutre `#555`) | [data-loader.js](cockpit/lib/data-loader.js) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `anime_articles` | `id, title, summary, source, category, url, date_published, fetch_date` | 200 lignes max — mélange RSS + Jikan upcoming |

Pas de table dédiée pour les sorties futures : elles cohabitent dans `anime_articles` avec `category="upcoming"`, toutes sources confondues. Le tri + enrichissement `prod_cases` est fait côté front au moment du `loadPanel`. Sources actuellement reconnues : `MyAnimeList` (via `anime_sync.py` → Jikan), `TMDB` (via `tmdb_sync.py` — stub, nécessite `TMDB_API_KEY`).

## Back — pipelines qui alimentent
- **Anime sync** ([pipelines/anime_sync.py](pipelines/anime_sync.py)) — GitHub Actions cron `0 7 * * *` (quotidien 7h UTC) via [anime-sync.yml](.github/workflows/anime-sync.yml) :
  - Fetch RSS des sources cinéma/séries (AlloCiné, Première, ANN, Deadline, Variety, etc.)
  - Classification par regex sur title+source (released / upcoming / industry)
  - **Fetch Jikan v4** : `GET https://api.jikan.moe/v4/seasons/upcoming` ([anime_sync.py:53,187,286](pipelines/anime_sync.py:53))
  - Pour chaque anime upcoming Jikan : ligne avec `source="MyAnimeList"`, `category="upcoming"`, `title="[TV] Nom de l'anime"`, `summary="Studio: Nom · Genres: ..."`, `date_published=date de diffusion`, `url=lien MAL`
  - Déduplication par `url` via `on_conflict=url`
  - Upsert dans `anime_articles`
- **TMDB sync** ([pipelines/tmdb_sync.py](pipelines/tmdb_sync.py)) — **scaffold livré, pipeline non actif** (pas de workflow YAML). Pour activer :
  1. S'inscrire sur https://developer.themoviedb.org/ et obtenir une `TMDB_API_KEY`
  2. Ajouter la clé aux secrets du repo GitHub
  3. Créer `.github/workflows/tmdb-sync.yml` (cron suggéré `15 7 * * *`)
  - Endpoints utilisés : `/movie/upcoming` (films à venir, région FR) + `/tv/on_the_air` (séries en diffusion)
  - Horizon : 180 jours en avant (`UPCOMING_DAYS_AHEAD`), max 5 pages × 20 lignes = 100 rows par endpoint
  - Format des lignes : `source="TMDB"`, `category="upcoming"`, `title="[Movie|TV] Nom"`, `summary="Producteur: TMDB · Genres: ... · overview"`, `url=themoviedb.org/movie|tv/{id}`
  - Dépendances : `pipelines/requirements-tmdb.txt` (requests uniquement)
  - Le script no-op gracieusement si `TMDB_API_KEY` absent — safe à exécuter sans config.

## Appels externes
- **Supabase REST** : `T2.anime()` via `q("anime_articles", ...)`. Mémoïsé sous `anime_articles`.
- **Jikan API** (côté pipeline backend, pas frontend) : public, pas de clé requise. Rate limit 3 req/s.
- **localStorage** : `read-articles`, `veille-read-state` (cross-corpus).
- **`window.open(url, "_blank")`** : articles + lien "MAL ↗" dans la table.

## Dépendances
- **Onglets frères** : `PanelVeille` partagé avec `updates`, `sport`, `gaming_news`, `news`.
- **Pipelines** : `anime-sync.yml` obligatoire pour le feed et la table.
- **Variables d'env / secrets** : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (côté pipeline). Pas de clé Jikan.

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2.
- **Empty corpus** : OK depuis le fix `208774d` — feed remplacé par `[]`, plus de fake stale.
- **Empty `prod_cases`** : si aucun upcoming Jikan n'est dans le corpus, `<ProdTable>` rend l'empty state "Aucune sortie prévue sur cette période."
- **Article Jikan sans date_published valide** : `air_iso=null` dans `prod_cases`, exclus du filtrage par année/mois (filtre `if (!p.air_iso) return false` à [panel-veille.jsx:75](cockpit/panel-veille.jsx:75)).
- **Préfixe `[TV]/[Movie]` absent du titre Jikan** : `atype` tombe sur `"Anime"` par défaut.
- **Studio extraction échoue** (pas de pattern `Studio:` dans le summary) : `studio=""`, et `model="MAL"` + `scale="MyAnimeList"` en fallback.
- **Article sans `category`** : fallback `"released"` dans `transformAnimeFeed`.
- **Article sans `source`** : `normalizeAnimeSource` retourne `"—"` → acteur `—` couleur `#555`.
- **Année courante non dans `years`** : `defaultYear = years[0] || currentYear`. Si pas de `years` (table vide), default = année courante mais aucun bouton ne sera actif.
- **Changement d'année** : `useEffect(() => setMonthFilter("all"), [yearFilter])` reset le filtre mois — évite "mai 2025 + 2026" qui ne matche rien.

## Limitations connues / TODO
- [x] ~~Palette acteurs encore manuelle~~ → **fixé** : 10 brands mappées + fallback `nameHashColor` pour les sources inconnues.
- [x] ~~Catégories hardcoded côté route~~ → **auto-détectées** : `ANIME_DATA.categories` populé depuis le corpus, `app.jsx` ne passe plus `categories={...}`.
- [x] ~~Pas de filtre par type~~ → **ajouté** : 3e ligne de filtre dans `<ProdTable>` (TV/Movie/OVA/Special/ONA/Anime). Masquée si un seul type détecté.
- [x] ~~`prod_cases` limité à MyAnimeList~~ → **source-agnostique** : le filtre accepte maintenant n'importe quel `category === "upcoming" && date_published`. TMDB pipeline scaffolded mais pas activé (cf. Back — pipelines).
- [ ] **Extraction studio/producteur par regex** fragile : si le pipeline change le format de summary, ça casse silencieusement (`studio=""`). Le regex accepte maintenant "Studio:" (Jikan) et "Producteur:" (TMDB).
- [ ] **Filter year/month UI sur mobile** : peut prendre beaucoup de hauteur (1 pill par année passée). Pas de mode compact.
- [ ] **Pas de tri par titre** : tri fixe par `air_iso` ascendant. Pas d'option "alphabétique" ou "studio".
- [ ] **Pas de cache image** : la table ne montre pas les jaquettes (Jikan et TMDB fournissent `images` mais les pipelines ne les stockent pas).
- [ ] **Trends utilisent `catCounts7d`** alors que `categories` utilise le 30j — divergence à arbitrer si le sens diverge.
- [ ] **TMDB workflow YAML absent** : pipeline prêt mais ne tourne pas en CI. À créer quand `TMDB_API_KEY` sera configurée.
- [ ] **Genres TMDB = IDs numériques** : le pipeline stocke `genre_ids` bruts (ex. `28, 12, 878`) au lieu des labels texte. Nécessite un call `/genre/movie/list` + `/genre/tv/list` au démarrage pour mapper. À faire dans une itération pipeline dédiée.
- [ ] **TMDB `/tv/on_the_air` est "en cours de diffusion"**, pas "épisodes à venir". Si on veut précisément les prochains épisodes d'une série, il faut passer par `/tv/{id}/season/{n}` et filtrer les `air_date` futures — plus lourd.
- [ ] **Pas de table dédiée `tv_releases`** : Jikan + TMDB cohabitent dans `anime_articles`. OK pour l'instant, mais si le volume TMDB devient gros (100+ rows/jour), penser à séparer.

## Dernière MAJ
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — migration anime hash-colors + catégories dynamiques + filtre Type + TMDB scaffold (local, non pushé)
