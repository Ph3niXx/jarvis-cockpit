# Atlas

> Porte d'entrée vers Atlas, l'app de révisions personnelle : un clic pour ouvrir la séance du jour, le parcours d'un sujet ou les progrès.

## Scope
mixte

## Finalité fonctionnelle
Atlas est l'app de révisions de l'utilisateur (japonais, leasing auto, MILES, direction de programme…), hébergée à part avec sa propre connexion. Le cockpit étant le point d'entrée quotidien, l'onglet évite d'avoir à retrouver l'adresse d'Atlas : il le range avec le reste de l'apprentissage et y mène en un clic.

## Parcours utilisateur
1. L'utilisateur clique "Atlas" dans la sidebar (groupe Apprentissage).
2. Une carte rappelle ce qu'on trouve dans Atlas : flashcards, quiz, examens blancs et une séance du jour qui mêle les sujets actifs.
3. Il clique "Ouvrir Atlas" : Atlas s'ouvre dans un nouvel onglet du navigateur, sur sa page d'accueil.
4. Ou il va droit au but avec un des raccourcis : Séance du jour, Parcours ou Progrès.
5. À la première visite, Atlas demande sa propre connexion (Google ou mot de passe), puis la mémorise.

## Fonctionnalités
- **Bouton Ouvrir Atlas** : ouvre Atlas dans un nouvel onglet, sans quitter le cockpit.
- **Raccourcis** : trois liens mènent directement à la séance du jour, à la liste des parcours ou à la page Progrès d'Atlas.
- **Rappel du contenu** : une phrase dit ce qu'Atlas propose et prévient qu'il a sa propre connexion, pour qu'un écran de connexion ne surprenne pas.

## Front — structure UI
Fichier : [cockpit/panel-atlas.jsx](cockpit/panel-atlas.jsx). Monté par le router dans [app.jsx](cockpit/app.jsx) sur la route `"atlas"` (URL hash `#atlas`).

Réutilise les classes de l'écran vide de la Revue (`.review-empty`, `-eyebrow`, `-title`, `-body`) et les boutons `.btn--primary` / `.btn--ghost`. Les liens ont `target="_blank"` : le suivi global `link_clicked` les compte déjà, aucun nouvel `event_type`.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelAtlas()` | Carte + bouton + raccourcis vers Atlas | `cockpit/panel-atlas.jsx` |

## Back — sources de données
Aucune. Le panel est statique (pas de Tier 2, `loadPanel` retourne `null`).

## Back — pipelines qui alimentent
- Daily pipeline → aucun
- Weekly pipeline → aucun
- Jarvis (local) → aucun

## Appels externes
Aucun appel : de simples liens vers `https://atlas-orpin-eight.vercel.app` (app Vercel + Supabase séparée, dépôt Ph3niXx/atlas). Pas d'iframe : la CSP du cockpit interdit `frame-src`, et Atlas refuse d'être encadré (`X-Frame-Options: DENY`).

## Dépendances
- Onglets : aucun
- Pipelines : aucun
- Variables d'env / secrets : aucun

## États & edge cases
Pas d'état de chargement ni d'erreur : la carte est toujours affichée. Si Atlas est indisponible, c'est le nouvel onglet qui le montre, pas le cockpit.

## Limitations connues / TODO
- [ ] Afficher la série et l'objectif du jour d'Atlas dans la carte demanderait une API Atlas ouverte au cockpit (CORS + jeton) : pas fait, volontairement.

## Dernière MAJ
2026-10-05 — ajout de l'onglet
