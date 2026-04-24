# Architecture — source de vérité

Ce dossier contient la description **déclarative** de l'architecture du cockpit. Il est consommé en lecture par l'onglet *Jarvis Lab → Architecture* (rendu SVG côté client) et par la CI (`validate-arch`, `arch-drift-check`).

**Règle cardinale** : toute PR qui touche un chemin à impact architectural (pipeline, panel, workflow cron, migration SQL, service local) **doit** mettre à jour le ou les fichiers de ce dossier dans le **même commit**. La CI `arch-drift-check` émet un warning si elle détecte une dérive (non-bloquant au départ ; durci après observation). La CI `validate-arch` fail si le schéma des YAML est cassé ou si un ID référencé n'existe pas.

## Fichiers

| Fichier | Rôle | Format |
|---|---|---|
| [layers.yaml](layers.yaml) | Vue macro en trois couches Front / Middle / Back avec boîtes + arêtes typées. Source du diagramme principal. | YAML |
| [pipelines.yaml](pipelines.yaml) | Catalogue des crons GitHub Actions : id, cron, workflow, input API, output tables, durée, budget. Source de la timeline 24h. | YAML |
| [dependencies.yaml](dependencies.yaml) | Matrice panel ↔ table : qui lit quoi, qui écrit quoi, RLS par table. Source de la vue dépendances. | YAML |
| [flows/](flows/) | Un YAML par domaine fonctionnel (veille-ia, jarvis-rag, perso-strava…). Source des diagrammes linéaires par domaine. | YAML |
| [decisions.md](decisions.md) | ADR léger des décisions d'architecture (Contexte → Décision → Conséquences). | Markdown |

## Règle de routage des diagrammes en couches

Pour garantir la lisibilité de la vue *Couches* (et empêcher les diagrammes de redevenir illisibles à chaque nouveau composant ajouté), le renderer côté cockpit applique **une grammaire stricte** — à respecter aussi quand on édite `layers.yaml`.

**Trois couches empilées**, séparées par deux couloirs horizontaux (*gutters*). Chaque couche a une bande de fond et un label vertical écrit à gauche, pas à l'intérieur de la bande.

**Colonnes alignées** : les composants qui se parlent directement doivent partager une colonne verticale. Concrètement : `panels` (front), `jarvis_api` (middle) et `supabase` (back) sont sur la colonne 1 pour que leurs arêtes restent droites dans le couloir correspondant.

**Trois types d'arêtes, trois couloirs** — c'est l'invariant clé :

| Type d'arête (`type:`) | Couloir | Tracé |
|---|---|---|
| `adjacent` | Couloir vertical entre deux couches voisines | Segment droit dans le gutter, virages à 90° |
| `intra_layer` | Bande interne de la couche | Flèche horizontale courte entre deux boîtes adjacentes |
| `cross_layer` | Rail vertical à droite (x ≈ 955), **hors** des layer-bg | L-shape par-dessus, couleur accent orange |

**Interdits** :
- Pas de diagonales. Jamais.
- Pas de texte horizontal dans les layer-bg (ça collide avec les arêtes).
- Pas d'arête `cross_layer` qui passe à travers une couche intermédiaire — elle DOIT emprunter le rail de droite.
- Pas d'arête sans `label` visible (via `<rect edge-label-bg>` opaque derrière le texte).

**Légende** attendue en bas du diagramme :
- Rail orange = saut de couche (`cross_layer`).
- Traits gris = appel interne (`adjacent`, `intra_layer`).
- Bord orange d'une boîte = composant pivot (`accent: true`).

**Positions** : le YAML ne spécifie pas les x/y. Le renderer distribue les boîtes d'une couche uniformément sur la largeur, en respectant l'ordre dans la liste `boxes:`. Ajouter une cinquième boîte à une couche redistribue automatiquement les colonnes.

## Checklist : modifier un type d'objet

| Type de modif | Fichiers à éditer dans le même commit |
|---|---|
| Nouveau pipeline (script + workflow + cron) | `pipelines.yaml` + `flows/<domaine>.yaml` + `dependencies.yaml` (si nouvelles tables) + `decisions.md` si choix structurant |
| Nouveau panel | `dependencies.yaml` + `layers.yaml` si impact topologique (rare) + spec `docs/specs/tab-<slug>.md` |
| Nouvelle table Supabase | `dependencies.yaml` (owner_pipeline + RLS) + `flows/<domaine>.yaml` (branche écriture) |
| Nouveau secret / variable d'env | `decisions.md` entrée dédiée + mention dans `CLAUDE.md` § Secrets |
| Nouveau service local (ex : 2e modèle LM Studio) | `layers.yaml` (couche middle) + `decisions.md` |
| Suppression d'un panel ou pipeline | Retirer de `dependencies.yaml` + `pipelines.yaml` + archiver le flow concerné en `status: archived` |
| Refacto cosmétique / iso-fonctionnel | Aucun fichier archi à toucher |

## Pourquoi pas Mermaid ?

Mermaid gère mal trois contraintes qu'on a ici :
1. Diagrammes en couches horizontales avec labels verticaux sur la gauche → Mermaid ne sait pas faire proprement.
2. Discipline de routage stricte (rails dédiés par type d'arête) → Mermaid pose les arêtes où il veut.
3. Support multi-thèmes via CSS variables (Dawn / Obsidian / Atlas) → Mermaid dépend de son propre thème.

On rend donc en SVG React natif, avec positions calculées depuis le YAML et couleurs héritées des CSS variables du cockpit (`--acc`, `--tx3`, `--tx2`, etc.).
