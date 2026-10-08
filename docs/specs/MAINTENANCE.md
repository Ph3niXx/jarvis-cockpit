# Maintenance des specs Jarvis Lab (`docs/specs/`)

Chaque onglet du cockpit a un spec dédié dans `docs/specs/tab-<slug>.md`. L'index `docs/specs/index.json` liste les 29 onglets avec leur `last_updated` (date ISO). Le panel "Jarvis Lab" consomme ces deux sources en direct pour afficher la doc dans l'app, donc **toute dérive entre code et spec devient visible pour l'utilisateur**.

## Règle cardinale

Toute modification fonctionnelle ou technique d'un onglet (fichier code qui change une fonctionnalité, un comportement, un contrat de données, un élément UI notable) **doit** entraîner la mise à jour du `docs/specs/tab-<slug>.md` correspondant **dans le même commit**, jamais en lot différé.

Couvre : `cockpit/home.jsx`, `cockpit/panel-*.jsx`, `cockpit/styles-*.css`, ainsi que les modifs de `index.html`, des pipelines (`main.py`, `weekly_analysis.py`, `pipelines/*.py`), ou des migrations Supabase qui changent la source de données d'un onglet.

Exemptions (pas d'update doc nécessaire) : refacto interne strictement iso-fonctionnel, fix cosmétique sans changement d'UX, bump de version de dépendance. Dans le doute : mettre à jour.

## Checklist par modification

1. Ouvrir `docs/specs/tab-<slug>.md` correspondant et mettre à jour les sections concernées (Fonctionnalités, Parcours utilisateur, Front — structure UI, Back — sources de données, Limitations connues / TODO).
2. Mettre à jour la section `## Dernière MAJ` en bas du fichier avec la date du jour + un court changelog (1 ligne par modif notable).
3. Bumper `last_updated` dans `docs/specs/index.json` pour l'entrée du tab (format `YYYY-MM-DD`).
4. **Nouvel onglet** : copier `docs/specs/_template.md` vers `tab-<slug>.md`, remplir toutes les sections, ajouter l'entrée dans `index.json` avec `status: "documented"` ou `"stub"`.
5. **Onglet supprimé** : déplacer le `.md` dans `docs/specs/_archive/` (créer le dossier si absent) plutôt que de le supprimer, et passer l'entrée `index.json` à `status: "archived"` (ne pas retirer du tableau — garder la trace).

## Règle éditoriale section Fonctionnalités

La section `## Fonctionnalités` de chaque spec décrit **ce que l'utilisateur voit et fait**, pas comment c'est implémenté. Les détails techniques appartiennent aux sections `Front — structure UI` et `Back — sources de données`.

**Banni dans Fonctionnalités :**
- Chemins de fichier + ligne (`home.jsx:127`, `data-loader.js:1136`)
- Noms de composants JSX (`<SignalCard>`, `<RadarSVG>`)
- Props / variables / globals (`gap=true`, `data.signals`, `COCKPIT_DATA`, `window.X_DATA`)
- Noms de colonnes DB (`brief_html`, `mention_count`, `article_id`)
- Formules / heuristiques (`body.length / 280`, `94 - i*6`)
- Endpoints / SDK (`/rest/v1/articles`, `supabase.from(...)`)

**Format cible** :

```
- **<Nom feature>** : <ce que l'utilisateur voit> + <ce qu'il peut faire> + <besoin couvert>. 1-2 phrases max, vocabulaire produit.
```

Cette règle est **vérifiée automatiquement en CI** par le workflow `lint-specs` (voir section *Garde-fous automatiques* ci-dessous) — toute PR qui introduit du vocabulaire technique dans une section Fonctionnalités est bloquée.

## Règle éditoriale section Parcours utilisateur

La section `## Parcours utilisateur` de chaque spec raconte **ce que l'utilisateur fait pas à pas** — sa séquence d'actions et ce qu'il voit en retour —, pas le code qui tourne en dessous. Mêmes interdits que pour Fonctionnalités.

**Banni dans Parcours utilisateur :**
- Chemins de fichier + ligne (`home.jsx:127`, `data-loader.js:1136`)
- Noms de composants JSX (`<SignalCard>`, `<RadarSVG>`)
- Props / variables / globals (`gap=true`, `data.signals`, `COCKPIT_DATA`, `window.X_DATA`)
- Noms de colonnes DB (`brief_html`, `mention_count`, `article_id`)
- Endpoints / SDK (`/rest/v1/articles`, `supabase.from(...)`)
- Jargon infra (`Tier 1`, `Tier 2`, `bootTier1()`, `loadPanel("x")`, `localStorage.cle-technique`, `PATCH`/`POST`/`RPC`, `useEffect`…)

**Format cible** :

```
1. <Verbe d'action à l'utilisateur> — <ce qu'il voit en retour, vocabulaire produit>.
2. <Étape suivante> — …
```

Cette règle est **vérifiée automatiquement en CI** par le même workflow `lint-specs` que Fonctionnalités — toute PR qui introduit du vocabulaire technique dans une section Parcours utilisateur est bloquée.

## Mapping panel ↔ spec

Les 6 onglets Veille (updates / claude / sport / gaming-news / anime / news) partagent `panel-veille.jsx` via des `corpus` distincts (VEILLE_DATA, CLAUDE_DATA, SPORT_DATA, GAMING_DATA, ANIME_DATA, NEWS_DATA) : une modif de ce fichier peut impliquer plusieurs specs simultanément.

| Spec | Source |
|---|---|
| tab-brief.md | home.jsx |
| tab-evening.md | panel-evening.jsx |
| tab-review.md | panel-review.jsx |
| tab-top/week/search.md | panel-top/week/search.jsx |
| tab-updates/claude/sport/gaming-news/anime/news.md | panel-veille.jsx (corpus distincts) |
| tab-veille-outils.md | panel-veille-outils.jsx |
| tab-radar/recos/challenges/wiki/signals.md | panel-radar/recos/challenges/wiki/signals.jsx |
| tab-opps/ideas/jobs.md | panel-opportunities/ideas/jobs-radar.jsx |
| tab-creator.md | panel-creator.jsx |
| tab-jarvis/jarvis-lab/profile.md | panel-jarvis/jarvis-lab/profile.jsx |
| tab-perf/music/gaming.md | panel-forme/musique/gaming.jsx |
| tab-stacks/history.md | panel-stacks/history.jsx |

## Garde-fous automatiques

- **CI `spec-drift-check`** ([.github/workflows/spec-drift-check.yml](../../.github/workflows/spec-drift-check.yml)) — sur chaque PR, compare les fichiers modifiés : si du code d'onglet a bougé sans qu'aucun `docs/specs/tab-*.md` ne soit touché, émet des annotations GitHub `::warning::` sur les fichiers concernés. **Non-bloquant** au départ (`continue-on-error: true`) — on durcira après avoir mesuré le bruit. Une PR avec le check rouge ne doit pas merger sans justification explicite (refacto cosmétique…).
- **CI `validate-spec`** ([.github/workflows/validate-spec.yml](../../.github/workflows/validate-spec.yml)) — valide structurellement `jarvis/spec.json` ET la synchro entre `jarvis/spec.json::cockpit_tabs` et `docs/specs/index.json` (bloquant en `--strict`).
- **CI `lint-specs`** ([.github/workflows/lint-specs.yml](../../.github/workflows/lint-specs.yml)) — **bloquant** : fail toute PR qui introduit du vocabulaire technique dans une section `## Fonctionnalités` OU `## Parcours utilisateur`. Règles couvertes : chemins `.jsx/.py/.css`, composants JSX, globals `data.xxx`/`window.X`/`X_DATA`, colonnes DB `xxx_id/_at/_html` + whitelist spécifique, endpoints `/rest/v1/`, SDK `supabase.x`, props `key=value`, et jargon infra propre au cockpit (`Tier 1/2`, `bootTier`, `loadPanel`, `transformXxx`, `localStorage.xxx`, hooks React `useEffect`/`useState`/…). Règle éditoriale dure : les détails d'implémentation appartiennent à `Front — structure UI` / `Front — fonctions JS` / `Back — sources de données`, pas au récit produit. Script : [scripts/lint_specs_produit.py](../../scripts/lint_specs_produit.py).
- **Template de commit** ([.gitmessage](../../.gitmessage)) — pre-rempli avec une ligne `Specs mises à jour: tab-<slug> | aucune | N/A` à renseigner. Active-le localement une fois par clone :

  ```bash
  git config commit.template .gitmessage
  ```

  Ensuite, chaque `git commit` sans `-m` ouvre l'éditeur pré-rempli avec la checklist. Laisse la ligne `Specs mises à jour:` dans le commit final comme trace.
