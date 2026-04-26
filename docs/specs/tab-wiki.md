# Wiki IA

> Bibliothèque vivante 3-états (hub / détail / création) alimentée automatiquement par la détection de concepts dans les articles + enrichissement hebdo Claude, avec création de nouvelles entrées via le prompt Jarvis.

## Scope
pro

## Finalité fonctionnelle
Glossaire auto-maintenu du vocabulaire IA qui apparaît dans la veille. Chaque article passé par `main.py` déclenche la détection de concepts (regex + LLM) qui upsert des slugs dans `wiki_concepts` avec `mention_count`, sources, et `related_concepts`. Le dimanche, `weekly_analysis.py` repasse sur les concepts sans description et fait rédiger 3 niveaux de synthèse par Claude Haiku (`summary_beginner` / `summary_intermediate` / `summary_expert`). Le panel front offre une recherche cliente full-text sur le corpus chargé, trois filtres (catégorie / kind / sort), vue détail avec TOC + related/backlinks, et un flow "créer une entrée" qui stash un prompt dans `localStorage.jarvis-prefill-input` puis redirige vers le panel Jarvis.

## Parcours utilisateur
1. Clic sidebar "Wiki IA" — le panel charge les 200 concepts les plus mentionnés.
2. État **Hub** : hero compact avec stats (total / auto-alimentés / mis à jour cette semaine), barre de recherche, filtres (catégorie / source / tri), section "Épinglées" (visible quand aucun filtre n'est actif), liste éditoriale dense des entrées.
3. Saisie dans la barre de recherche — le filtrage est instantané et local sur titre, extrait et tags.
4. Clic sur une entrée pour ouvrir la vue détail : topbar avec boutons Épingler / Partager, article principal au rendu markdown riche, colonne latérale avec table des matières auto-générée, liens associés, citations retour, bouton "Demander à Jarvis".
5. Clic sur "Demander à Jarvis" dans la vue détail pour basculer vers l'assistant avec un prompt contextualisé sur l'entrée en cours.
6. Clic sur "Demander à Jarvis" depuis le hub pour ouvrir le formulaire de création : sujet, catégorie, sources à cocher, profondeur — soumission qui bascule vers Jarvis avec un prompt de synthèse complet.
7. Épinglage d'une entrée via le bouton dédié — elle apparaît ensuite en accès rapide en tête de page.
8. Partage d'une entrée via le bouton Partager : l'URL générée, si collée ailleurs, rouvre directement l'entrée à la prochaine visite du cockpit.

## Fonctionnalités
- **Recherche live** : barre de recherche qui filtre instantanément le corpus sur titre, extrait et tags, avec surlignage des termes trouvés dans les résultats.
- **Trois filtres combinables** : catégorie (détectée automatiquement depuis les concepts), source (Tout / auto-détectée / mes notes perso) et tri (Récent / Plus lus / A-Z).
- **Épinglage persistant** : bouton pour épingler une entrée, les épinglées apparaissent en accès rapide en tête de page quand aucun filtre n'est actif.
- **Vue détail avec markdown riche** : rendu propre du contenu — titres, listes, citations, blocs de code, liens, images, tables — pour une lecture agréable.
- **Table des matières auto** : liens cliquables générés automatiquement depuis les titres du document, avec scroll fluide vers la section choisie.
- **Liens associés et citations** : deux sections latérales montrent ce que l'entrée cite et qui la cite, pour naviguer par proximité conceptuelle.
- **Demander à Jarvis** : bouton qui envoie à Jarvis un prompt pré-rempli avec le titre de l'entrée en cours, pour poser une question contextualisée.
- **Créer une entrée** : formulaire à deux branches — « Demande à Jarvis » (sujet + sources + profondeur, délégué à l'assistant) ou « J'écris ma note » (zone markdown + tags, sauvegarde directe dans le wiki en tant que note perso).
- **Partage d'URL** : bouton Partager qui copie ou partage un lien direct rouvrant l'entrée quand on revient dessus.
- **Tooltip au survol dans le reste du cockpit** : quand un terme du wiki apparaît dans un texte ailleurs dans l'app (brief du jour, contexte des signaux, réponses de Jarvis), il est souligné en pointillés. Au survol, un tooltip de 2 lignes affiche la définition courte et un lien direct vers la fiche complète.

## Front — structure UI
Fichier : [cockpit/panel-wiki.jsx](cockpit/panel-wiki.jsx) — 660 lignes, monté par [app.jsx:371](cockpit/app.jsx:371).

Structure DOM (hub) :
- `.panel-page[data-screen-label="Wiki IA"] > .panel-hero.panel-hero--compact`
- `.wiki-searchbar` (input focus auto + CTA "Demander à Jarvis")
- `.wiki-filters > .wiki-filter-group` (catégorie), `.wiki-filter-row-bottom` (source + sort + count)
- `.wiki-pinned` (conditionnel)
- `.wiki-list > .wiki-item × N` OU `.wiki-empty` (aucun résultat)

Structure DOM (detail) :
- `.panel-page--wiki-detail > .quiz-topbar.wiki-detail-topbar` (back + badges + actions Épingler/Partager)
- `.wiki-detail-wrap` split :
  - `.wiki-detail-article > .wiki-detail-header + .wiki-detail-content + .wiki-detail-foot-auto`
  - `.wiki-detail-aside > .wiki-aside-section × 4` (TOC, Articles liés, Cité par, Demander à Jarvis)

Structure DOM (create) :
- `.panel-page--quiz > .quiz-topbar + .wiki-create` (brief form avec 4 fields)
- Intermédiaires `step === "generating"` et `step === "review"` sont **dead code** (cf. limitations).

Route id = `"wiki"`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelWiki({ data, onNavigate })` | Composant racine — 3 états (hub/detail/create) | [panel-wiki.jsx:5](cockpit/panel-wiki.jsx:5) |
| `WikiListItem({ entry, onOpen, query })` | Item de la liste avec highlight de la query | [panel-wiki.jsx:165](cockpit/panel-wiki.jsx:165) |
| `WikiDetail({ entry, allEntries, ... })` | Vue détail avec markdown parser + TOC + related/backlinks | [panel-wiki.jsx:215](cockpit/panel-wiki.jsx:215) |
| `WikiCreate({ onBack, onDone, onNavigate })` | Formulaire de création — délègue à Jarvis via prompt prefill | [panel-wiki.jsx:459](cockpit/panel-wiki.jsx:459) |
| `wikiPinKey()` / `getPinnedIds()` / `togglePinnedId(id)` | Helpers localStorage `wiki-pinned-ids` | [panel-wiki.jsx:203-213](cockpit/panel-wiki.jsx:203) |
| `formatDate(s)` | ISO date → "21 avril 2026" FR | [panel-wiki.jsx:447](cockpit/panel-wiki.jsx:447) |
| `parts` useMemo (inline) | Parser markdown-lite : segmente en h1/h2/p/quote/list/br | [panel-wiki.jsx:246-284](cockpit/panel-wiki.jsx:246) |
| `renderInline(t)` (inline) | Rendu inline **bold** et *italic* avec tokenisation simple | [panel-wiki.jsx:287-308](cockpit/panel-wiki.jsx:287) |
| `handleAsk()` (inline) | Stash prompt contextualisé + navigate jarvis (depuis détail) | [panel-wiki.jsx:239-243](cockpit/panel-wiki.jsx:239) |
| `handleShare()` (inline) | navigator.share ou clipboard avec URL `#wiki/{id}` | [panel-wiki.jsx:226-238](cockpit/panel-wiki.jsx:226) |
| `handleGenerate()` (inline) | Stash prompt de synthèse markdown + navigate jarvis | [panel-wiki.jsx:470-488](cockpit/panel-wiki.jsx:470) |
| `T2.wiki()` | `GET wiki_concepts?order=mention_count.desc&limit=200` mémoïsé | [data-loader.js:1222](cockpit/lib/data-loader.js:1222) |
| `buildWikiFromConcepts(concepts)` | Loader → WIKI_DATA {entries[], categories[], stats} + backlinks calculés | [data-loader.js:370-440](cockpit/lib/data-loader.js:370) |
| `buildWikiContent(r)` | Compose le contenu markdown depuis les 3 `summary_*` (beginner / intermediate / expert) | [data-loader.js](cockpit/lib/data-loader.js) |
| `wikiCategoryLabel(cat)` | Map slug catégorie → label FR | [data-loader.js](cockpit/lib/data-loader.js) |
| `wikiRelativeUpdated(iso)` | ISO → "aujourd'hui" / "hier" / "il y a N jours" | [data-loader.js](cockpit/lib/data-loader.js) |
| `loadPanel("wiki")` case | Appelle `T2.wiki()` + rebuild `WIKI_DATA` via `buildWikiFromConcepts` | [data-loader.js:4215-4222](cockpit/lib/data-loader.js:4215) |
| `wiki-tooltip.js` (IIFE) | Auto-link contextuel : scanne `.top-summary, .hero-body, .sig-card-context, .jv-bubble` toutes les 1.5s, enveloppe les termes du trie (titres ≤ 30 chars + slug + tags, hors stopwords) dans `<span class="wiki-decorated" data-wiki=…>`. Au mouseover affiche un tooltip 300px avec titre + excerpt 140 chars + lien `#wiki/{slug}` | [cockpit/lib/wiki-tooltip.js](cockpit/lib/wiki-tooltip.js) |

## Back — sources de données

| Table | Colonnes | Usage |
|-------|----------|-------|
| `wiki_concepts` | `id, slug, name, category, first_seen, last_mentioned, mention_count, sources (JSONB), related_concepts (JSONB), summary_beginner, summary_intermediate, summary_expert, created_at, updated_at` | **Lu** au mount (limit 200, ordre `mention_count.desc`) |

Le front n'écrit **jamais** dans `wiki_concepts`. Toutes les créations/mises à jour passent par les pipelines backend.

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — cron `0 6 * * 1-5` :
  - Détection de concepts IA dans chaque article via regex + LLM (section "Extraction de concepts IA").
  - Upsert dans `wiki_concepts` : si le slug existe, bump `mention_count` + ajout à `sources` ([main.py:617-631](main.py:617)). Sinon insert avec `mention_count: 1` ([main.py:660-667](main.py:660)).
  - Ne touche pas aux descriptions (`summary_*` reste null jusqu'à enrichissement).
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — dimanche 22h UTC :
  - `sb_get("wiki_concepts", "summary_beginner=is.null&order=mention_count.desc&limit=10")` — sélectionne les 10 concepts les plus mentionnés mais non encore enrichis ([weekly_analysis.py:227](weekly_analysis.py:227)).
  - Claude Haiku rédige 3 niveaux (beginner / intermediate / expert).
  - `sb_patch("wiki_concepts", "slug=eq.<slug>", { summary_beginner, summary_intermediate, summary_expert })` ([weekly_analysis.py:266-268](weekly_analysis.py:266)).
- **Jarvis (local)** : la création d'entrées est **délégée au panel Jarvis** via le prompt prefill — le panel `jarvis` écrit la réponse dans `jarvis_conversations` mais **pas** dans `wiki_concepts` automatiquement. L'utilisateur doit copier-coller manuellement le résultat pour qu'il devienne une entrée wiki (pas encore automatisé).

## Appels externes
- **Supabase REST** : `T2.wiki()` via `q("wiki_concepts", ...)`. Pas d'écriture front.
- **localStorage** : `wiki-pinned-ids` (persistant), `jarvis-prefill-input` (single-use, stashé au clic "Demander à Jarvis" ou "Lancer Jarvis" en create flow).
- **`navigator.share`** / **`navigator.clipboard.writeText`** : partage de l'URL `#wiki/{id}`.
- **Telemetry** : `wiki_pin_toggled`, `wiki_shared`.

## Dépendances
- **Onglets in** : sidebar uniquement.
- **Onglets out** : `jarvis` (depuis le bouton "Demander à Jarvis" détail ou create).
- **Pipelines** : `daily_digest.yml` (détection, wiki_concepts bump), `weekly_analysis.yml` (enrichissement descriptions).
- **Variables d'env / secrets** : aucune côté front. Backend : `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`.

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant `T2.wiki()`.
- **Corpus vide** : `buildWikiFromConcepts([])` retourne `null`, le panel n'hydrate pas `WIKI_DATA` → les données fake (du fichier `cockpit/data-wiki.js`) restent affichées.
- **Concept sans `summary_*`** : `excerpt` fallback sur `r.summary_intermediate || r.summary_beginner`. Si les deux sont null, `excerpt = ""` → item rendu avec une ligne vide sous le titre.
- **Related sur un slug absent** du corpus chargé : filtré via `bySlug.has(s)` dans le loader — pas de lien mort affiché.
- **Aucun résultat de recherche** : `<WikiEmpty>` avec message "Rien dans la bibliothèque sur « query »" + CTA vers le create flow.
- **URL share** : `#wiki/{id}` est parsée par le router ([app.jsx:153](cockpit/app.jsx:153)) qui stash le slug dans `localStorage.wiki-open-entry`. Le panel consomme ce stash au mount et ouvre directement le détail. Fonctionne aussi sur `hashchange` (navigation back/forward).
- **navigator.share non supporté** : fallback silencieux vers clipboard. Pas d'alerte.
- **Detail view après suppression du concept** : `active` pointe sur l'entrée, mais un reload vide WIKI_DATA et l'utilisateur retombe au hub. Pas de deep-link gardé.
- **Markdown avec code blocks / images / links** : ignorés par le parser custom. Les caractères ``\``` restent affichés en brut.
- **Créer une entrée** : le flow génère un prompt qui part vers `jarvis`. La réponse de Jarvis **ne persiste pas** dans `wiki_concepts` automatiquement. L'utilisateur doit faire un copy-paste manuel (ou attendre que le pipeline daily détecte le concept dans un article).
- **kind filter "perso"** : les notes créées via le flow `<WikiCreate>` → "J'écris ma note" sont stockées avec `source_type='perso'` et apparaissent dans ce filtre. Aucun résultat si la colonne n'a pas encore été migrée (`sql/007_wiki_source_type.sql`) — liste vide silencieuse.

## Limitations connues / TODO
- [x] ~~Filter "Mes notes" (perso) factice~~ → **fixé** : nouvelle colonne `source_type` dans `wiki_concepts` (SQL `sql/007_wiki_source_type.sql` à exécuter une fois). Loader lit `r.source_type`, le panel affiche correctement les notes perso. Stats `auto` et `perso` calculées depuis le corpus réel.
- [x] ~~Create flow dead code~~ → **supprimé** (steps `generating`/`review` enlevés, ~60 lignes). `<WikiCreate>` reste pur contrôleur du brief.
- [x] ~~Pas de persistance des entrées perso~~ → **flow ajouté** : dans `<WikiCreate>`, un toggle "Demande à Jarvis / J'écris ma note" révèle une textarea markdown + champ tags. Submit → `persistPersoWikiEntry()` POST `wiki_concepts` avec `source_type='perso'`, upsert via `on_conflict=slug`, insert optimiste dans `WIKI_DATA.entries` pour affichage immédiat. L'utilisateur atterrit sur le détail de la note via `onDone(newEntry)`.
- [x] ~~Partage URL `#wiki/{id}` inactif~~ → **router fixé** : [app.jsx:149-171](cockpit/app.jsx:149) parse les hashs composés `#wiki/{slug}`, stash dans `localStorage.wiki-open-entry`, et le panel consomme au mount pour ouvrir le détail automatiquement. Marche aussi sur hashchange (navigation back/forward).
- [x] ~~Markdown parser limité~~ → **migré sur marked.js + DOMPurify** (CDN jsdelivr, déjà whitelist CSP). Supporte code blocks, liens, images, tables, blockquotes complets, toute la GFM. Parser custom supprimé (80+ lignes).
- [x] ~~Parser fragile `***`~~ → **réglé** par marked (gestion robuste des emphases).
- [ ] **Sources counts dans le brief Jarvis** : "340 articles / 44 notes" sont encore des copy hardcodés non-liés aux vraies stats.
- [ ] **Slug collision** : `wikiSlugify("Fine-tuning")` et `wikiSlugify("Fine Tuning")` collide. Le upsert `on_conflict=slug` écrase l'entrée existante, y compris celle que le pipeline aurait créée. À gérer : soit refuser la création, soit suffixer `-2` si le slug existe déjà côté front.
- [ ] **Perso write va écrire `summary_intermediate`** (pas de colonne "body" dédiée) : le loader fallback sur `summary_beginner || summary_intermediate` pour l'excerpt. OK mais mélange "summary" et "full content" dans la même colonne.
- [ ] **TOC extraction limité aux H1-H3** : H4+ toujours ignorés (intentionnel pour une TOC lisible).
- [ ] **Pas de rich editor** pour la textarea perso : éditeur brut, l'utilisateur doit connaître la syntaxe markdown. Un preview split-view serait un plus.
- [ ] **Pas de recherche fuzzy** : la recherche est stricte `includes`. Une entrée "Fine-tuning" ne matche pas "finetuning".
- [ ] **Backlinks calcul O(N²)** : pour 200 entrées = 40 000 itérations au mount. Scale mal au-delà de 1000 concepts.
- [ ] **TOC ne gère pas plus de 2 niveaux** : H3+ ne sont pas dans la TOC (ignorés par le parser).
- [ ] **`read_count` = `mention_count`** : affiché "lu {count}×" mais c'est en fait le nombre de fois où le concept apparaît dans le corpus, pas un compteur de lectures utilisateur. Wording trompeur.
- [ ] **Sélecteur de profondeur (quick/standard/deep)** contrôle le prompt mais pas le résultat — Claude / Jarvis peut ignorer la cible. Les sorties "~500 mots" sont indicatives.
- [ ] **Catégories hardcoded dans `wikiCategoryLabel`** : ajouter une nouvelle catégorie pipeline → passe dans "(non catégorisé)" si pas dans le map.
- [ ] **Aucun breadcrumb / fil d'Ariane** dans le detail : juste "Retour au Wiki" sans contexte catégorie.
- [ ] **Pas de versioning** : quand Claude réécrit les `summary_*` à une nouvelle exécution hebdo, l'ancienne version est écrasée. Aucun historique pour rollback.

## Dernière MAJ
2026-04-26 — ajout tooltip wiki au survol dans Brief / Signaux / chat Jarvis (auto-link `wiki-tooltip.js` + deep-link `#wiki/{slug}`).
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — source_type + marked/DOMPurify + deep-link + flow perso (local, non pushé)
