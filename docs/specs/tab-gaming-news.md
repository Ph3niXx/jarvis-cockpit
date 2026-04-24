# Gaming (news)

> Feed éditorial actualités gaming : sorties, à venir, e-sport, industrie. Même composant que Veille IA/Sport, corpus dédié `GAMING_DATA`.

## Scope
perso

## Finalité fonctionnelle
Prolongement gaming du système de feed unifié. Actualités jeux vidéo fetchées via RSS sur des sources spécialisées (JeuxVideo.com, Gamekult, IGN, Eurogamer, PC Gamer, Dexerto, GamesIndustry.biz, etc.). Partage `PanelVeille` avec toutes les routes Veille — voir [tab-updates.md](tab-updates.md) pour la mécanique, [tab-sport.md](tab-sport.md) pour le pattern "panel sans acteurs suivis + catégories".

## Parcours utilisateur
Identique à Sport (loader, hero, feed filtrable, actions par article) avec :
- Filtre principal par **Rubrique** : Sorties récentes / À venir / E-sport / Industrie.
- Filtre secondaire par **Format** : Critique / Patch / Trailer / Interview / Rumeur / Deal / Sortie / Annonce / Actu, détecté automatiquement depuis le titre.
- Pas de section "Acteurs suivis" — les sources sont fondues dans la pastille de chaque item.
- Pas de section "Cas prod" — l'onglet gaming n'a pas de grille de cas prod.

## Fonctionnalités
Identiques à Sport (hero + tendances + feed filtrable), plus les spécificités gaming :
- **Filtre Rubrique** : un bandeau de pills (Sorties récentes / À venir / E-sport / Industrie) pour cibler un type de contenu d'un clic.
- **Filtre Format** : un deuxième bandeau (Critique / Patch / Trailer / Rumeur / Deal / Sortie / Annonce / Actu) déduit automatiquement du titre.
- **Regroupement E-sport L'Équipe** : les sous-marques L'Équipe orientées gaming sont fusionnées sous un seul acteur « L'Équipe E-sport ».
- **Tableau de bord rubrique** : quatre indicateurs en tête de page — articles sur 24h, articles sur 7j, rubrique la plus active cette semaine, nombre de sources distinctes.
- **Couleurs de marque curées** : JeuxVideo.com, Gamekult, ActuGaming, IGN, Eurogamer, PC Gamer, GamesIndustry.biz, Dexerto et L'Équipe E-sport gardent leur couleur brand dans les pastilles ; les autres sources sont coloriées automatiquement.
- **Tendances par rubrique** : chaque rubrique est remontée en carte de tendance selon son volume de la semaine, pour voir si l'industrie supplante les sorties.

## Front — structure UI
Fichier : [cockpit/panel-veille.jsx](cockpit/panel-veille.jsx) (partagé). Props distinctives :
```jsx
<PanelVeille
  corpus="GAMING_DATA"
  title="Gaming"
  showActors={false}
  categoryLabel="Rubrique"
  typeLabel="Format"
  prodSection={null}
/>
```
Les pills "Rubrique" viennent désormais de `GAMING_DATA.categories` (populé par le loader). Color-map `GAMING_CATEGORY_COLORS` gardé côté loader pour les 4 rubriques connues (`releases #3a2a1a`, `upcoming #006fcd`, `esport #d13639`, `industry #555`).
Route id = `"gaming_news"`, URL hash `#gaming_news`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelVeille(...)` | Composant partagé — voir [tab-updates.md](tab-updates.md) | [panel-veille.jsx:175](cockpit/panel-veille.jsx:175) |
| `T2.gaming_news()` | `GET gaming_articles?order=date_published.desc.nullslast,date_fetched.desc&limit=200` mémoïsé sous `gaming_articles` | [data-loader.js:1243](cockpit/lib/data-loader.js:1243) |
| `transformGamingFeed(articles)` | Mappe article → shape feed (id, actor normalisé, category, type inféré, date_h, title, summary ≤260, tags, unread, url) | [data-loader.js:2690](cockpit/lib/data-loader.js:2690) |
| `normalizeGamingSource(src)` | Regroupe "L'Equipe/L'Équipe" sous "L'Équipe E-sport" | [data-loader.js:2673-2677](cockpit/lib/data-loader.js:2673) |
| `guessGamingType(title)` | Regex FR+EN sur le titre → 8 types possibles | [data-loader.js:2678-2689](cockpit/lib/data-loader.js:2678) |
| `loadPanel("gaming_news")` case | Appelle `T2.gaming_news()`, remplace feed en toutes circonstances puis enrichit headline + actors + trends si articles.length>0 | [data-loader.js:3771-3857](cockpit/lib/data-loader.js:3771) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `gaming_articles` | `id, title, summary, source, category, url, date_published, fetch_date` | 200 lignes max |

Table dédiée, schéma aligné sur `sport_articles`.

## Back — pipelines qui alimentent
- **Gaming sync** ([pipelines/gaming_sync.py](pipelines/gaming_sync.py)) — GitHub Actions cron `45 6 * * *` (quotidien 6h45 UTC) via [gaming-sync.yml](.github/workflows/gaming-sync.yml) :
  - Fetch RSS des sources gaming spécialisées
  - Classification par `category` côté pipeline (releases / upcoming / esport / industry selon le feed ou heuristique)
  - Déduplication par `url` via `on_conflict=url`
  - Upsert dans `gaming_articles`
- **Aucune interaction** avec les autres pipelines.

## Appels externes
- **Supabase REST** : `T2.gaming_news()` via `q("gaming_articles", ...)`. Mémoïsé sous la clé `gaming_articles`.
- **localStorage** : `read-articles`, `veille-read-state` (cross-corpus).
- **`window.open(url, "_blank")`** : ouverture article.

## Dépendances
- **Onglets frères** : `PanelVeille` partagé avec `updates`, `sport`, `anime`, `news`.
- **Pipelines** : `gaming-sync.yml` obligatoire (sinon table vide).
- **Variables d'env / secrets** : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (côté pipeline uniquement).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2.
- **Empty corpus** : OK depuis le fix `208774d` — feed replacé par `[]`, pas de fake stale.
- **Article sans `category`** : fallback `"releases"` dans `transformGamingFeed` ([data-loader.js:2698](cockpit/lib/data-loader.js:2698)).
- **Article sans `source`** : `normalizeGamingSource` retourne `"—"`, acteur `—` avec couleur `#555` par défaut.
- **`guessGamingType` titre étranger** : regex FR+EN couvre `review` et `critique`, mais un titre purement JP ou DE tombe sur `Actu`.
- **Corpus introuvable** : `"Corpus GAMING_DATA introuvable."` si `cockpit/data-gaming.js` pas chargé.

## Limitations connues / TODO
- [x] ~~Palette acteurs encore manuelle~~ → **fixé** : 9 sources gardent leur couleur brand, le reste via `nameHashColor` (partagé avec Veille IA + Sport). Plus de gris `#555` monotone.
- [x] ~~Catégories hardcoded côté route~~ → **auto-détectées** depuis le corpus. `GAMING_CATEGORY_COLORS` vit côté loader, la liste se remplit dynamiquement depuis `article.category`. `app.jsx` ne passe plus `categories={...}`.
- [x] ~~Pas de "Sorties à venir" en table~~ → **décision logique** : on garde `prodSection={null}`. Les dates de sortie gaming sont trop fuzzy ("Summer 2025", "Q3 2026", "TBD") pour alimenter un `ProdTable` utile. Le filtre rubrique "À venir" fait le job.
- [ ] **`guessGamingType`** : pas de type "E-sport" explicite (seulement via la catégorie). Un titre "G2 gagne les worlds" tombe sur `Actu` faute de mot-clé.
- [ ] **Trends seuils** : `rising ≥15`, `stable ≥8` — pensé sur le volume quotidien. À ajuster si les sources ralentissent.
- [ ] **`tags` non calculés** : `transformGamingFeed` construit `tags: ["#" + (a.category || "releases")]` — une seule tag, monotone. Pas de vraies tags thématiques.
- [ ] **Pas de distinction E-sport équipe vs jeu** : "G2 vs T1" et "LoL patch 14.3" ont la même rubrique "esport" ou "releases", peu utile pour filtrer.
- [ ] **Trends construits sur `catCounts7d`** (7 jours) alors que `categories` utilise `byCategoryAll` (30 jours). Divergence possible — à uniformiser selon l'intention (trends = momentum récent, categories = volume total).
- [ ] **`GAMING_CATEGORY_COLORS` hardcoded** : nouvelle catégorie du pipeline (ex: "retro") tombe sur gris `#888`. Ajouter une entrée au map = 1 ligne.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — migration gaming_news vers hash-colors + catégories dynamiques + vérif pipeline classification (local, non pushé)
