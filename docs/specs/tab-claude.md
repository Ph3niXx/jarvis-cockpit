# Claude

> Section dédiée Anthropic — modèles, Claude Code, SDK Python/TypeScript, Agent SDK et nouveaux skills officiels, agrégés depuis 6 flux RSS.

## Scope
pro

## Finalité fonctionnelle
Sous-section Veille spécialisée Anthropic. Sépare le bruit "veille IA généraliste" (OpenAI, Google, Mistral, etc.) des sorties Claude pour suivre précisément ce qui change côté modèles, outils et skills officiels — utile à un manager qui veut rester à jour sur la stack Claude qu'il utilise au quotidien (cockpit, Jarvis, RTE Toolbox).

⚠️ Ce panel **partage le composant** `PanelVeille` avec 5 autres routes (`updates`, `sport`, `gaming_news`, `anime`, `news`). Le corpus pointe sur `window.CLAUDE_DATA`. Voir [tab-updates.md](tab-updates.md) pour la mécanique commune.

## Parcours utilisateur
1. Clic sidebar « Claude » dans le groupe Veille — un loader s'affiche le temps de récupérer les dernières releases Anthropic.
2. La page apparaît avec le hero (release Anthropic la plus récente — version, date, résumé), la grille des canaux suivis, les tendances par source et le feed chronologique.
3. L'utilisateur combine les filtres : par canal (anthropic.com / Claude Code / SDK Python / SDK TS / Agent SDK / Skills), par type (Release / Framework / Analyse), par période (24h / 7j / 30j).
4. Clic sur une carte de tendance pour filtrer le feed sur les sorties d'un canal précis.
5. Clic sur un item pour ouvrir la note de release ou l'annonce dans un onglet externe — l'item est marqué lu automatiquement.
6. Actions par item : marquer lu/non-lu, archiver, ouvrir en onglet externe.
7. Toggle de densité en bas à droite pour passer en lecture aérée ou compacte.

## Fonctionnalités
- **Hero release Anthropic** : en tête de page, la dernière sortie mise en avant (canal, version, résumé) pour repérer ce qui vient de tomber côté Claude.
- **Canaux suivis** : une carte par source officielle Anthropic (annonces, Claude Code, SDK Python, SDK TypeScript, Agent SDK, skills) avec son rythme de release sur 7 jours et son dernier contenu.
- **Tendances par canal** : cartes montrant quel canal a publié le plus cette semaine pour voir où Anthropic concentre son énergie (modèles, outillage dev, skills).
- **Feed chronologique** : toutes les releases et annonces des 30 derniers jours, triées non-lues en premier, avec prévisualisation et bouton « Voir les autres » pour déplier.
- **Triple filtre** : pills combinables canal / type / période avec bouton de réinitialisation quand le filtre vide la vue.
- **Actions par release** : marquer lu/non-lu, archiver, ouvrir dans un nouvel onglet, et bouton « Tout marquer lu » global.
- **KPIs en tête** : quatre indicateurs — releases sur 24h, releases sur 7j, canal le plus actif cette semaine, nombre de canaux distincts.

## Front — structure UI
Fichier : [cockpit/panel-veille.jsx](cockpit/panel-veille.jsx) (partagé). Props distinctives :
```jsx
<PanelVeille
  corpus="CLAUDE_DATA"
  title="Claude"
  actorsLabel="canaux Anthropic"
  categoryLabel="Source"
  typeLabel="Format"
  prodSection={null}
/>
```

Route id = `"claude"`, URL hash `#claude`. **Panel Tier 2** (listé dans `TIER2_PANELS` à [data-loader.js](cockpit/lib/data-loader.js)).

Schéma fake d'amorçage : [cockpit/data-claude.js](cockpit/data-claude.js) — `headline` placeholder + tableaux vides remplis au `loadPanel("claude")`.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelVeille(...)` | Composant partagé — voir [tab-updates.md](tab-updates.md) | [panel-veille.jsx:233](cockpit/panel-veille.jsx:233) |
| `T2.claude()` | `GET articles?section=eq.claude&order=date_published.desc.nullslast,date_fetched.desc&limit=200` mémoïsé sous `claude_articles` | [data-loader.js:1256](cockpit/lib/data-loader.js:1256) |
| `transformVeilleFeed(articles)` | Mappe article → shape feed (id, actor=source, type, date_h, title, summary, tags, unread, url) — partagé avec `updates` | [data-loader.js:2949](cockpit/lib/data-loader.js:2949) |
| `loadPanel("claude")` case | Appelle `T2.claude()`, remplace `CLAUDE_DATA.feed`, recalcule headline + KPIs + actors (1 par source) + trends (volume 7j par source) | [data-loader.js:3728](cockpit/lib/data-loader.js:3728) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `articles` | `id, title, summary, source, section, tags, url, date_published, fetch_date` | 200 lignes max, filtrées sur `section='claude'` |

Pas de table dédiée — réutilise la table `articles` partagée avec les 9 autres sections du pipeline daily, avec un filtre serveur sur `section=eq.claude`.

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — cron `0 6 * * 1-5` :
  - Fetch RSS sur 6 sources estampillées `section="claude"` :
    - `Anthropic News` → https://www.anthropic.com/rss.xml
    - `Claude Code Releases` → https://github.com/anthropics/claude-code/releases.atom
    - `Anthropic SDK Python` → https://github.com/anthropics/anthropic-sdk-python/releases.atom
    - `Anthropic SDK TS` → https://github.com/anthropics/anthropic-sdk-typescript/releases.atom
    - `Claude Agent SDK` → https://github.com/anthropics/claude-agent-sdk-python/releases.atom
    - `Anthropic Skills` → https://github.com/anthropics/skills/commits/main.atom
  - Gemini enrichit (extract tags, classifie) et `POST articles` par batch de 50.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : aucune interaction directe (les signaux faibles sont calculés cross-sections).
- **Jarvis (local)** : aucune.

## Appels externes
- **Supabase REST** : `T2.claude()` via `q("articles", "section=eq.claude...")`.
- **localStorage** : `veille-read-state` (partagé cross-corpus avec les autres panels Veille).
- **`window.open(url, "_blank", "noopener")`** : ouverture release/annonce.

## Dépendances
- **Onglets in** : sidebar uniquement.
- **Onglets out** : aucune (clics externes only).
- **Panels frères** (mêmes codepath) : `updates`, `sport`, `gaming_news`, `anime`, `news` via `PanelVeille`.
- **Pipelines** : `daily_digest.yml` obligatoire (sinon corpus vide).
- **Variables d'env / secrets** : aucune côté front.

## États & edge cases
- **Loading** : `<PanelLoader>` pendant `loadPanel("claude")`.
- **Empty corpus initial** : avant le premier run du pipeline avec la nouvelle section, le panel affiche le headline placeholder + feed vide. Se résoud au prochain cron daily.
- **Empty après filtres** : bloc `.vl-empty` avec bouton « Réinitialiser ».
- **GitHub atom feeds occasionnellement vides** : un repo sans nouvelle release sur 36h ne contribue rien — c'est OK, les autres canaux compensent.
- **Anthropic Skills via commits/main.atom** : remonte tous les commits, pas seulement les nouveaux skills. Le résumé Gemini doit aider à distinguer "ajout de skill" de "fix typo doc". À surveiller : si trop de bruit, basculer sur `releases.atom` quand le repo en aura.

## Limitations connues / TODO
- [ ] **Anthropic Skills via commits** : pas de filtre côté pipeline pour ne garder que les vrais ajouts de skills. À évaluer après quelques jours d'observation.
- [ ] **Pas de classification "type de release"** : on ne distingue pas une bump patch (`v2.1.119` → `v2.1.120`) d'une feature majeure. À envisager : parser le changelog côté Gemini pour extraire `breaking / feature / fix`.
- [ ] **Couleurs des canaux dérivées d'un hash** : pas de palette curée comme dans `news`. Les 6 sources Anthropic finissent avec des couleurs aléatoires.
- [ ] **`headline.metrics` génériques** : on affiche releases 24h / 7j / top source / nombre de sources, pas de benchmarks modèles. Difficile à automatiser sans curation.
- [ ] **Panels frères partagent le composant** : toute modif sur `claude` affecte aussi `updates` et les autres panels Veille.

## Dernière MAJ
2026-04-25 — création de l'onglet : 6 flux RSS Anthropic dédiés (anthropic.com + 5 repos GitHub), corpus `CLAUDE_DATA`, route `/claude`, sidebar group Veille.
