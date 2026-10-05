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
6. Si l'adresse d'Atlas manque dans son profil, la carte le dit et explique comment l'ajouter.

## Fonctionnalités
- **Bouton Ouvrir Atlas** : ouvre Atlas dans un nouvel onglet, sans quitter le cockpit.
- **Raccourcis** : trois liens mènent directement à la séance du jour, à la liste des parcours ou à la page Progrès d'Atlas.
- **Rappel du contenu** : une phrase dit ce qu'Atlas propose et prévient qu'il a sa propre connexion, pour qu'un écran de connexion ne surprenne pas.
- **Adresse privée** : l'adresse d'Atlas vient du profil de l'utilisateur, visible seulement une fois connecté ; si elle manque, la carte explique quoi ajouter.

## Front — structure UI
Fichier : [cockpit/panel-atlas.jsx](cockpit/panel-atlas.jsx). Monté par le router dans [app.jsx](cockpit/app.jsx) sur la route `"atlas"` (URL hash `#atlas`).

Réutilise les classes de l'écran vide de la Revue (`.review-empty`, `-eyebrow`, `-title`, `-body`) et les boutons `.btn--primary` / `.btn--ghost`. Ce sont des `<button>` qui appellent `window.open(…, "_blank", "noopener,noreferrer")`, pas des `<a target="_blank">` : le suivi global `link_clicked` enregistre l'URL des liens externes dans `usage_events`, et l'adresse d'Atlas n'a pas à s'y retrouver. Aucun `event_type`.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelAtlas()` | Carte + bouton + raccourcis vers Atlas, ou carte « adresse introuvable » | `cockpit/panel-atlas.jsx` |
| `atlasBaseUrl()` | Lit `PROFILE_DATA._values.atlas_url`, n'accepte qu'une origine `https:` | `cockpit/panel-atlas.jsx` |
| `openAtlas()` | Ouvre Atlas (ou un de ses écrans) dans un nouvel onglet, sans referrer | `cockpit/panel-atlas.jsx` |

## Back — sources de données
| Table | Clé | Rôle |
|-------|-----|------|
| `user_profile` | `atlas_url` | Adresse d'Atlas (origine https). Chargée en Tier 1 avec le reste du profil, RLS `authenticated` : invisible sans connexion. Masquée de l'onglet Profil et de son export Claude via `PROFILE_HIDDEN_KEYS` (comme `jarvis_tunnel_url`). |

Pas de Tier 2 : `loadPanel("atlas")` retourne `null`.

**Pourquoi pas dans le code** : le dépôt est public, Atlas ne l'est pas. Garder son adresse dans le profil évite de la publier.

## Back — pipelines qui alimentent
- Daily pipeline → aucun
- Weekly pipeline → aucun
- Jarvis (local) → aucun

## Appels externes
Aucun appel : un nouvel onglet vers l'adresse lue dans `user_profile.atlas_url` (Atlas est une app séparée, Vercel + Supabase, dépôt privé). Pas d'iframe : la CSP du cockpit interdit `frame-src`, et Atlas refuse d'être encadré (`X-Frame-Options: DENY`).

## Dépendances
- Onglets : aucun
- Pipelines : aucun
- Variables d'env / secrets : aucun (l'adresse est une donnée du profil, pas un secret d'Actions)

## États & edge cases
Pas d'état de chargement : le profil est déjà chargé au boot. Clé `atlas_url` absente ou adresse qui n'est pas en https : carte « Adresse d'Atlas introuvable » qui explique quoi ajouter. Si Atlas est indisponible, c'est le nouvel onglet qui le montre, pas le cockpit.

## Limitations connues / TODO
- [ ] Afficher la série et l'objectif du jour d'Atlas dans la carte demanderait une API Atlas ouverte au cockpit (CORS + jeton) : pas fait, volontairement.

## Dernière MAJ
2026-10-05 — adresse d'Atlas déplacée du code vers `user_profile.atlas_url`
