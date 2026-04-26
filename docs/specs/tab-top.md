# Top du jour

> Magazine éditorial : les 3 articles du jour présentés en hero + side cards, filtrables par section et exportables en markdown.

## Scope
mixte

## Finalité fonctionnelle
Prolongement du Brief pour qui veut plus que les 3 incontournables de la home et souhaite : (1) les relire dans une vue typo magazine, (2) filtrer par section (LLMs, Agents, Régulation…), (3) exporter la sélection en markdown (copie presse-papier) pour Slack / notes. Le panel est Tier 1 (data pré-chargée au boot, aucun fetch propre).

## Parcours utilisateur
1. Clic sidebar "Top du jour" (ou raccourci "Lire les 3 incontournables" depuis le Brief).
2. La vue apparaît immédiatement — les articles du jour sont déjà en mémoire.
3. Lecture du titre éditorial "Les N lectures incontournables, triées par impact métier" et de sa sous-ligne explicative.
4. Clic sur une pill de section pour filtrer le top (LLMs / Agents / Régulation…) — chaque pill affiche son compteur d'articles.
5. Layout magazine : carte 01 en hero à gauche, cartes 02 et 03 en secondaires à droite. Clic sur une carte pour ouvrir l'article en onglet externe (marqué lu automatiquement).
6. Parcours de la suite du classement en liste dense quand il y a plus de trois articles disponibles.
7. Clic sur "Exporter" pour copier la sélection formatée en markdown dans le presse-papiers — feedback "Copié !" pendant environ deux secondes, prêt à coller dans Slack ou un carnet de notes.

## Fonctionnalités
- **Titre daté** : en tête de page, la mention "Top du jour · semaine S… · date du jour en toutes lettres" pour situer la sélection en un coup d'œil.
- **Filtre par section** : une barre de pills (Tous / LLMs / Agents / Régulation…) générée automatiquement à partir des sections présentes, avec le nombre d'articles inscrit sur chaque pill.
- **Layout magazine 1-2-3** : le premier article en grande carte hero avec son score sur 100, les deuxième et troisième en cartes secondaires plus compactes à droite.
- **Suite du classement** : liste dense (rang, source, titre, section, date) en dessous pour parcourir les articles suivants quand il y en a plus de trois.
- **Export markdown** : un bouton qui copie la sélection du jour au format markdown dans le presse-papiers (titre daté + liste de liens), prêt à coller dans Slack ou un carnet de notes, avec un feedback "Copié !" visuel.
- **Message vide** : quand un filtre ne retourne aucun article, un message explicite invite à élargir la sélection.
- **Tag temps de lecture** : sur chaque carte (hero + side), un petit badge mono "X min" estime le temps de lecture à 230 mots/minute (titre + résumé), pour permettre de doser une session matinale en un coup d'œil.

## Front — structure UI
Fichier : [cockpit/panel-top.jsx](cockpit/panel-top.jsx) — 183 lignes, monté par [app.jsx:366](cockpit/app.jsx:366).

Structure DOM :
- `.panel-page` (wrapper)
- `.panel-hero` — eyebrow + h1 + sub
- `.panel-toolbar` — label + `.panel-toolbar-group` (pills filtre) + export button aligné à droite via `margin-left: auto`
- `.top-list-wrap`
  - `.top-list-feat` — conteneur flex/grid
    - `.top-feat-main` (feat1) — rank 01 + meta + titre + summary + score + CTA
    - `.top-feat-side` × 2 (feat2, feat3) — layout plus compact
  - `.top-rest-title` + `.top-rest-list` — activés seulement si `rest.length > 0`

Pas d'id HTML stable. Route id = `"top"`, URL hash `#top`, panel Tier 1.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelTop({ data, onNavigate })` | Composant racine — lit `data.top` | [panel-top.jsx:44](cockpit/panel-top.jsx:44) |
| `isoWeekTop(d)` | Numéro de semaine ISO 8601 local pour l'eyebrow | [panel-top.jsx:4](cockpit/panel-top.jsx:4) |
| `openArticleTop(t)` | Ouvre `t._url` en `_blank` + marque lu dans `localStorage.read-articles` | [panel-top.jsx:12](cockpit/panel-top.jsx:12) |
| `exportTopAsMarkdown(items)` | Formate un markdown avec titre + liste numérotée → clipboard (API moderne ou fallback) | [panel-top.jsx:26](cockpit/panel-top.jsx:26) |
| `handleExport()` (inline) | Déclenche export + état visuel "Copié !" pendant 1,8 s | [panel-top.jsx:56-60](cockpit/panel-top.jsx:56) |
| `buildTop(articles)` | Mappe les 3 premiers articles du jour en cards (rank / score hardcodé / tags / source) | [data-loader.js:167](cockpit/lib/data-loader.js:167) |
| `loadArticlesToday()` | `GET articles?fetch_date=eq.<today>&order=date_fetched.desc&limit=100` — Tier 1 | [data-loader.js:73](cockpit/lib/data-loader.js:73) |

**Pas d'écouteur d'événement global** : seuls les `onClick` inline sur cards et pills.

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `articles` | `id, title, summary, source, section, tags, url, date_published, fetch_date` | 100 lignes/jour (limit Tier 1) mais `buildTop` ne garde que les **3 premières** |

Aucun autre table. Pas de fetch propre au panel (Tier 1 only).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — cron `0 6 * * 1-5` dans [daily_digest.yml](.github/workflows/daily_digest.yml) :
  - Fetch RSS → enrichissement Gemini → `POST articles` par batch de 50 ([main.py:797](main.py:797))
  - L'ordre d'insertion détermine le top puisque `buildTop` lit `articles.slice(0, 3)` sur `order=date_fetched.desc` — c'est donc les **3 derniers articles fetchés** et pas un vrai score d'impact.
- **Weekly pipeline** : aucune interaction avec ce panel.
- **Jarvis (local)** : aucune interaction.

## Appels externes
- **Supabase REST** : partagé avec la Home via `loadArticlesToday()` — aucun appel dédié au panel Top.
- **Clipboard API** : `navigator.clipboard.writeText(md)` avec fallback `document.execCommand('copy')` sur `<textarea>` temporaire ([panel-top.jsx:34-41](cockpit/panel-top.jsx:34)).
- **`window.open(url, "_blank", "noopener")`** : ouverture articles externes.
- **localStorage** : lecture/écriture `read-articles` pour marquer lu.

## Dépendances
- **Onglets** : consomme la même donnée Tier 1 que la Home (`data.top`). Aucune navigation out-going depuis ce panel.
- **Pipelines** : `daily_digest.yml` obligatoire (sinon table `articles` vide → hero dégradé + export vide).
- **Variables d'env / secrets** : aucune côté front. Backend même config que Brief.

## États & edge cases
- **Loading** : pas de skeleton dédié. Data déjà là via Tier 1 (panel non listé dans `TIER2_PANELS` à [data-loader.js:4248](cockpit/lib/data-loader.js:4248)) donc le rendu est immédiat.
- **Empty state (`allTop.length === 0`)** : titre hero bascule sur "Aucun top disponible pour aujourd'hui" ([panel-top.jsx:69](cockpit/panel-top.jsx:69)) ; toolbar rend quand même les pills (mais `sections = ["all"]`) ; `feat1` undefined → rien ne rend.
- **Empty filtré (`filtered.length === 0`)** : message centré `"Pas encore d'articles pour ce filtre."` ([panel-top.jsx:102](cockpit/panel-top.jsx:102)). Bouton export disabled.
- **Articles sans `section`** : exclus de la liste des pills grâce au `.filter(Boolean)` mais restent dans `allTop`.
- **Articles sans `_url`** : cartes rendues sans cursor:pointer, `openArticleTop` no-op ; export markdown affiche le titre en texte brut au lieu d'un lien.
- **Clipboard API refusée** (permissions, non-HTTPS) : fallback `document.execCommand("copy")` sur `<textarea>` temporaire ; silencieux en cas d'échec.
- **Erreur réseau Tier 1** : pas de gestion propre à ce panel — `data.top = []` via le `.catch(() => [])` en amont ([data-loader.js:1138](cockpit/lib/data-loader.js:1138)).
- **RLS 401** : identique au Brief — fallback empty silencieux.

## Limitations connues / TODO
- [ ] **Décalage UI/data majeur** : le panel UI est conçu pour afficher un **top N** (feat1/2/3 + "La suite du classement" en liste), mais `buildTop` ne retourne jamais que **3 articles** ([data-loader.js:169](cockpit/lib/data-loader.js:169)). Le bloc `rest` est donc toujours vide. Soit relever la limite à 10-15 dans `buildTop`, soit ajouter un `case "top"` Tier 2 qui charge plus d'articles.
- [ ] **Score hardcodé** : `94 - i*6` ([data-loader.js:174](cockpit/lib/data-loader.js:174)) — 94, 88, 82 par rang. Pas de vrai score d'impact métier malgré le tagline "Score calculé sur la pertinence pour ton rôle (RTE, assurance), la fraîcheur…" ([panel-top.jsx:72](cockpit/panel-top.jsx:72)). Claim marketing > réalité.
- [ ] **Filtre par section** peu utile : avec seulement 3 items, filtrer vide presque toujours la vue.
- [ ] **Aucun "Garder" / bookmark** : la home a un bouton "Garder" ([home.jsx:303](cockpit/home.jsx:303)) mais aucun équivalent ici. Le seul état persistant est "lu".
- [ ] **Pas de tri manuel** : l'ordre est figé par `date_fetched.desc` — pas d'options "par score" (même simulé) ni "par source".
- [ ] **Export markdown invisible** : aucune modal/preview — on copie direct, l'utilisateur doit coller ailleurs pour voir. Un aperçu serait utile.
- [ ] **`isoWeekTop` dupliqué** : même logique d'ISO week que dans [data-loader.js:40-50](cockpit/lib/data-loader.js:40) environ — à mutualiser dans `cockpit/lib/`.

## Dernière MAJ
2026-04-26 — tag temps de lecture estimé "X min" (230 mots/min, titre + résumé) sur chaque carte feat hero et side. Helper `estimateReadingTime` partagé via `window` depuis home.jsx.
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — d752b79
