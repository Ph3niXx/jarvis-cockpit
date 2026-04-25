# Revue du jour

> Flow séquentiel "unread-first" : enchaîne les articles non lus un par un avec 3 actions claires, pour vider la pile en quelques minutes.

## Scope
mixte

## Finalité fonctionnelle
Quand on a 5 minutes le matin et qu'on veut traiter sa pile sans choisir, sans scroller, sans revenir en arrière. La Revue présente un seul article à la fois, plein écran, avec trois choix tranchés : passer, garder, ou transformer en idée. À la fin, écran de clôture pour la sensation de "fini".

## Parcours utilisateur
1. L'utilisateur clique "Revue du jour" dans la sidebar (groupe Grille matinale) — ou tape directement la route `#review`.
2. Le premier article non lu de la pile s'affiche en grand, avec sa source, son rubrique, son titre et son résumé.
3. L'utilisateur lit le résumé et choisit : **Passer** (l'article est marqué lu et on passe au suivant), **Garder** (idem mais avec une intention de revoir plus tard), ou **→ Idée** (basculer vers le carnet d'idées avec l'article comme inspiration).
4. Au clavier, K ou flèche droite passent, S garde, I bascule vers les idées, J ou flèche gauche reviennent à l'article précédent.
5. Un compteur "X/N" en haut indique la progression. Un bouton "Quitter" permet de retourner au brief à tout moment.
6. Lorsque tous les articles ont été traités, un écran "Tu as traité les N articles. Bien joué." propose de retourner au brief.
7. Si la pile était déjà vide à l'ouverture, un écran "Ta pile est vide. Repasse demain." s'affiche directement.

## Fonctionnalités
- **Vue séquentielle** : un seul article à la fois en grand format, sans distraction périphérique. Sources, rubrique et date affichées en métadonnée.
- **Trois actions tranchées** : Passer, Garder, → Idée. Chacune clôt l'article courant et avance la pile, sauf "→ Idée" qui bascule vers le carnet pour capturer l'intention.
- **Raccourcis clavier** : K ou → pour passer, S pour garder, I pour basculer en idée, J ou ← pour revenir en arrière. Les raccourcis sont rappelés sous chaque bouton.
- **Compteur de progression** : "X/N" en tête de page pour situer où l'on en est dans la pile.
- **Lien "Ouvrir l'article"** : chaque article propose un lien direct pour aller lire la version intégrale dans un onglet externe sans quitter la revue.
- **Écran de clôture** : message de félicitations après avoir traité toute la pile, avec bouton "Retour au brief".
- **Écran pile vide** : si rien à traiter à l'ouverture, message "Ta pile est vide. Repasse demain." pour éviter une page vide ambiguë.
- **Bouton Quitter** : permet de sortir de la revue à tout moment et de retomber sur le brief.

## Front — structure UI
Fichier : [cockpit/panel-review.jsx](cockpit/panel-review.jsx). Monté par le router dans [app.jsx](cockpit/app.jsx) sur la route `"review"` (URL hash `#review`).

Classes-racines :
- `.review` — container principal
- `.review-head` — en-tête avec compteur + bouton Quitter
- `.review-article > .review-meta + .review-title + .review-summary + .review-open`
- `.review-actions` — barre sticky avec 3 boutons `.review-action`
- `.review-empty` — écrans vide / fin avec eyebrow + titre + body + CTA

Le panel est Tier 1 (lit `data.top` et `data.week.items` déjà chargés au boot).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelReview({ data, onNavigate })` | Composant racine, gère la queue + index + raccourcis clavier | [panel-review.jsx:2](cockpit/panel-review.jsx:2) |
| `markReadAndAdvance(action)` | Écrit `read-articles[id] = { ts, action }` dans localStorage et incrémente l'index | [panel-review.jsx:18](cockpit/panel-review.jsx:18) |
| `useEffect onKey` | Écoute `keydown` global, gère K/J/S/I + flèches | [panel-review.jsx:29](cockpit/panel-review.jsx:29) |

## Back — sources de données
Aucune lecture Supabase directe dans le panel — il consomme `data.top` (3 articles construits par `buildTop()`) et `data.week.items` (corpus 30j construit par `buildWeek()`), tous deux déjà hydratés en Tier 1 par [data-loader.js](cockpit/lib/data-loader.js).

État persistant : `localStorage["read-articles"]` — map `id → { ts, action }`. Réutilise la même clé que la home et les top-cards (pas de duplication).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) → alimente `articles` dont sont extraits les top et week.
- Aucun pipeline dédié à la Revue.

## Appels externes
- `localStorage` (lecture + écriture clé `read-articles`).
- `window.track("review_action", { action, id })` — télémétrie best-effort vers `usage_events`.

## Dépendances
- **Onglets aval** : `brief` (bouton Quitter / retour), `ideas` (bouton "→ Idée").
- **Pipelines** : daily (pour avoir des articles à reviewer).

## États & edge cases
- **Pile vide** : écran "Ta pile est vide. Repasse demain." avec bouton retour.
- **Pile terminée** : écran "Tu as traité les N articles. Bien joué." avec CTA primaire.
- **localStorage indisponible** : le try/catch garde le panel fonctionnel mais sans persistance entre sessions.
- **Article sans URL** : le lien "Ouvrir l'article" est masqué.

## Limitations connues / TODO
- [ ] La queue est figée au mount (`useMemo []`) — un nouvel article fetché en cours de session n'apparaît qu'au prochain reload.
- [ ] Pas de feedback visuel de l'action choisie avant la transition (animation à ajouter).
- [ ] L'action "→ Idée" navigue mais ne pré-remplit pas le formulaire d'idée avec le contexte de l'article.
- [ ] Pas de undo après marquage : la flèche gauche revient sur l'item mais ne ré-ouvre pas le state read-articles.

## Dernière MAJ
2026-04-25 — création initiale (panel + route + entrée sidebar Grille matinale).
