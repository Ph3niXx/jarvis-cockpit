# Program Board local

Petit outil web autonome pour visualiser et manipuler à la main un program board (features + US réparties par sprint sur un incrément, avec dépendances), sans installation, sans envoi de données.

## Pourquoi

L'extraction Jira (Excel) liste les features, US et leurs dépendances. Cet outil permet de :
- visualiser le board d'un PI (features et US groupées par sprint),
- déplacer des items d'un sprint à un autre par drag-and-drop,
- ajouter / supprimer des dépendances à la main,
- générer un compte-rendu (`.md` ou `.csv`) des modifications, à reporter ensuite dans Jira manuellement (l'API n'étant pas accessible).

## Ce qu'on n'envoie nulle part

Le fichier Excel est lu **côté navigateur** (lib SheetJS, embarquée). Aucune requête réseau, aucune télémétrie. Les modifications sont sauvegardées en `localStorage` du navigateur (clé `programBoard.v1`).

## Démarrer

1. Copier le dossier `program-board/` sur la machine cible (clé USB / partage / mail).
2. Double-cliquer sur `index.html` (s'ouvre dans le navigateur par défaut).
3. Cliquer sur **📁 Charger Excel** (ou glisser-déposer le `.xlsx` sur la zone d'accueil).

> **Note Chrome / Edge** : le double-clic sur un fichier `.html` local fonctionne — `localStorage` est par origine `file://` et persiste entre les sessions sur la même machine. Pour une isolation parfaite par profil, conseiller à chaque utilisateur de poser le dossier dans son propre `Downloads`.

## Format Excel attendu

L'app lit les feuilles suivantes (telles que produites par l'extraction actuelle) :

| Feuille | Colonnes utilisées |
|---|---|
| `Features` | `Projet`, `Type de ticket`, `Clé`, `Résumé`, `Personne assignée`, `Rapporteur`, `Priorité`, `État`, `Résolution`, `Création`, `Mise à jour`, `Date d'échéance`, `Tickets liés.issueKey`, `Tickets liés.linkType`, `Sprint`, `Incrément` |
| `US` | `Projet`, `Type de ticket`, `Clé`, `Résumé`, `Personne assignée`, `Rapporteur`, `État`, `Date d'échéance`, `Tickets liés.issueKey`, `Tickets liés.linkType`, `Sprint`, `Incrément` |
| `CONFIG_Squads` | `Projet`, `Squad` (mapping projet→squad) |

Une feuille `Dépendances_Synthèse` peut exister mais elle n'est **pas utilisée** : les liens sont reconstruits directement depuis les colonnes `Tickets liés.*` de Features et US (plus fiable, immune au problème de formules non recalculées dans certains exports).

### Multi-valeurs

- `Sprint` : peut contenir plusieurs sprints séparés par `;`. L'item est positionné dans le sprint **le plus récent** par numéro (ex. `MH.com | Sprint 24.1;MH.com | Sprint 24.2` → colonne `24.2`). Un badge `⊞ N sprints` apparaît sur la card pour signaler le débordement.
- `Incrément` : pareil (ex. `PI23;PI24`). L'item est inclus dans le filtre PI dès qu'il contient le PI sélectionné.

### Numéros de sprint

L'app extrait `(\d+)\.(\d+)` du nom de sprint pour normaliser. Donc :
- `MH.com | Sprint 24.1` → colonne `24.1`
- `Pulse - Sprint 23.7 IP` → colonne `23.7`
- `Backlog Technique`, `EVOL TECHNIQUES`, vides → colonne `📋 Backlog / Sans sprint`

## Ce qu'on peut faire

### Navigation canvas (style Figma / Miro)

| Action | Comment |
|---|---|
| **Pan** (déplacer la vue) | Scroll molette, ou drag du fond avec le clic gauche |
| **Zoom** | `Ctrl + scroll` (ou pinch trackpad), boutons `−` / `+` en bas à gauche, ou `+` / `−` au clavier |
| **Fit à l'écran** | Bouton **⛶ Fit** ou touche `F` |
| **Zoom 100%** | Bouton `1:1` ou touche `0` |

### Manipulation du board

| Action | Comment |
|---|---|
| Filtrer par incrément (PI) | Dropdown `PI` (par défaut le plus récent) |
| Filtrer par projet / squad / type | Dropdowns dans la barre |
| Rechercher un item | Champ de recherche (clé, résumé, assigné) |
| Voir le détail d'un item | Cliquer sur la card → panneau latéral droit |
| Déplacer une card de sprint | Drag-and-drop sur une autre cellule (squad × sprint) |
| **Créer une dépendance visuellement** | Survoler une card → poignée bleue 🔵 sur le bord droit → drag jusqu'à la cible → choisir le type de lien |
| Ajouter une dépendance par recherche | Panneau détail → bloc *Ajouter une dépendance* (typeahead) |
| Supprimer une dépendance | Panneau détail → ✕ à côté du lien |
| Voir les dépendances d'une card | Survoler la card : flèches mises en évidence, autres atténuées |
| Voir les items en débordement | Cellule très chargée → badge **+N de plus** → modale liste cliquable |
| Annuler les modifs sur un item | Panneau détail → *↺ Annuler les modifs sur XYZ* |
| Voir le journal des modifs | Bouton **📜 Modifs** (raccourci `L`) |
| Exporter le compte-rendu | **.md** (table lisible) ou **.csv** (machine) |
| Tout réinitialiser | **🗑 Reset** (modifs + journal) |

### Lecture du board

- **Lignes (horizontales)** = squads (équipes), label à gauche.
- **Colonnes (verticales)** = sprints, label en haut.
- Première colonne = `📋 Backlog` (items sans sprint reconnu).
- Sprint surligné en bleu = **sprint en cours** (déduit : le plus récent contenant des items en construction/recette/revue).
- **Cards violettes** = Features (Epics) ; **cards classiques** = US (Stories).
- **Cellules limitées à 8 cards** : au-delà, badge `+N de plus…` (clic pour voir la liste complète et y naviguer).

### Lecture des flèches

- **Gris uni** : lien neutre (`est liée à`, `lie`).
- **Rouge** : lien bloquant (`bloque`, `est bloquée par`).
- **Violet pointillé** : implémentation (`is implemented by`, `implémente`).
- **Trait orange** : dépendance **TENDU** (la cible est dans un sprint plus tardif que la source).
- **Pointillé clair** : cible hors export ou hors PI.

## Codes couleur des cards

Bordure gauche = état de l'item :
- gris : Backlog
- bleu : Cadrage / Affinage / Prêt pour développement
- orange : En développement / En construction
- violet : En revue de code
- jaune : Prêt pour recette / En recette / Validation fonctionnelle
- cyan : En attente de livraison
- vert : Fermée
- rouge : Bloquée
- gris foncé : Abandonnée

Badges :
- 🔗 *N* : nombre de dépendances sortantes (rouge si au moins une est `bloque`)
- ⊞ *N* : item taggé sur plusieurs sprints (le plus récent est utilisé pour le placement)
- ✎ (en haut à droite de la card) : item modifié localement
- card teintée violet : **Feature** (Epic) — sinon c'est une US (Story)

## Compte-rendu exporté

Le `.md` est groupé par type d'action (déplacements de sprint, liens ajoutés, liens supprimés) avec des tables prêtes à coller dans Confluence / un mail / un ticket. Le `.csv` est destiné à du tooling.

Exemple (`.md`) :

```markdown
## ⇄ Déplacements de sprint (1)

| Date | Clé | Projet | Sprint avant | Sprint après | Résumé |
|------|-----|--------|--------------|--------------|--------|
| 27/04/2026 14:32 | `RBOP-6989` | Refonte Back Office PULSE | Pulse - Sprint 24.3 | Pulse - Sprint 24.5 | [PROJETS/VISION FINE]... |

## ➕ Liens ajoutés (1)

| Date | Source | Type | Cible | Résumé source |
|------|--------|------|-------|---------------|
| 27/04/2026 14:33 | `RBOP-6989` | bloque | `SLG-2248` | [PROJETS/VISION FINE]... |
```

## Limitations connues

- Pas de synchronisation Jira (volontaire, vu les contraintes API client) — c'est un outil de **planification offline**, le compte-rendu doit être reporté à la main ou via un script Jira.
- Le rattachement Epic ↔ US n'est pas affiché : il n'est pas dans l'export actuel. Si une colonne `Epic Link` est ajoutée, on pourra hiérarchiser les cards (US sous leur feature parente).
- Pas de flèches SVG entre les cards (seulement des badges et le panneau détail) — peut être ajouté en V2.
- Le sprint en cours est *deviné* (le plus récent ayant des items en construction/recette/revue). Si un champ « sprint actif » est ajouté à l'export, la détection sera plus fiable.

## Structure du dossier

```
program-board/
├── index.html              ← l'app (à ouvrir dans un navigateur)
├── lib/
│   └── xlsx.full.min.js    ← SheetJS (parser Excel offline)
├── README.md               ← ce fichier
└── .claude/                ← uniquement pour le dev local (à ignorer)
```

## Dépannage

| Symptôme | Cause / fix |
|---|---|
| Rien ne s'affiche après chargement | Ouvrir la console du navigateur (`F12` → Console) — chercher l'erreur |
| Les liens sont vides dans le panneau | Probable export sans la feuille `Dépendances_Synthèse` (normal) — l'app reconstruit depuis `Tickets liés.*` |
| Les modifs ont disparu | localStorage est par profil utilisateur ET par dossier. Si le dossier a été déplacé, l'origine `file://` change → données invisibles. Garder le dossier au même endroit |
| Sprint inattendu après drag-drop | L'app conserve le préfixe projet (`Pulse - Sprint `, `MH.com | Sprint `) à partir d'un échantillon. Si aucun item du même projet n'a un sprint normé, fallback `Sprint <num>` |
