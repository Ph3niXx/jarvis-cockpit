# Once Upon a Nerd

> La tour de contrôle de la chaîne : vues, interactions et abonnés de chaque post TikTok, YouTube et Instagram, épisode par épisode, relevés chaque jour via Buffer.

## Scope
perso

## Finalité fonctionnelle
La chaîne publie un épisode par jour sur trois réseaux, programmés dans Buffer. Chaque appli montre ses propres chiffres, post par post, sans jamais dire si la chaîne décolle ni sur quel réseau. Cet onglet réunit tout au même endroit pour piloter : combien de vues au total et par réseau, quel épisode démarre mieux que les autres au même âge, ce qui retient (engagement, part de la vidéo regardée), et si la file de publication arrive au bout.

## Parcours utilisateur
1. Clic sidebar "Once Upon a Nerd" (groupe Business) — l'en-tête dit de quand datent le dernier relevé Buffer et la dernière collecte.
2. Lecture des alertes s'il y en a : un post en échec ou supprimé de Buffer, une collecte qui ne tourne plus, une file de publication qui se termine dans deux jours ou moins.
3. Lecture des chiffres clés : les vues tous réseaux avec leur progression sur 24 h et la courbe des quinze derniers jours, puis une tuile par réseau (vues, part du total, progression, abonnés, engagement, part regardée).
4. Choix d'un réseau dans le filtre (Tous, TikTok, YouTube, Instagram) — les graphiques et le tableau se recalculent pour ce réseau seul. Le choix est retenu d'une visite à l'autre.
5. Lecture des vues gagnées par jour, empilées par réseau ; survol d'une colonne pour le détail du jour, ou bascule en tableau.
6. Lecture du démarrage des épisodes : le dernier épisode en couleur, les autres en gris, tous alignés sur leur âge depuis la mise en ligne. Survol d'une courbe pour comparer les épisodes au même âge, ou bascule en tableau (vues à J+1, J+3, J+7, J+14, J+30).
7. Tri du tableau des épisodes par colonne (date, total, réseau, engagement, part regardée), clic sur un épisode pour déplier le détail de ses trois posts : statut, chiffres du dernier relevé, lien vers le post.
8. Lecture de la programmation : les prochains jours, l'heure de chaque post, et la date du dernier épisode programmé.

## Fonctionnalités
- **Fraîcheur affichée** : l'en-tête donne l'heure des derniers compteurs publics et du dernier relevé Buffer, pour savoir si les chiffres sont ceux de la veille ou d'il y a trois jours.
- **Compteurs publics** : les vues et j'aime des posts TikTok et YouTube des deux dernières semaines sont relus sur leur page à chaque collecte, sans attendre le passage quotidien de Buffer. Pour un même chiffre, l'onglet garde le plus haut des deux sources : un compteur ne recule jamais à l'écran.
- **Alertes** : un post en échec de publication ou supprimé de Buffer, une collecte arrêtée depuis plus de 36 heures, une file de publication qui s'arrête dans deux jours ou moins. Chacune nomme l'épisode et le réseau concernés.
- **Chiffres clés** : vues tous réseaux, gain sur 24 h, courbe des quinze derniers jours, posts en ligne sur le total programmé, engagement, part regardée, j'aime, commentaires, partages et enregistrements.
- **Une tuile par réseau** : vues, part du total, gain sur 24 h, abonnés et leur évolution sur 7 jours, engagement, part regardée. Tant qu'un réseau n'a rien publié, la tuile donne l'heure de son premier post.
- **Filtre par réseau** : recalcule graphiques et tableau pour TikTok, YouTube ou Instagram seul, avec la même couleur par réseau partout.
- **Vues gagnées par jour** : colonnes empilées par réseau sur les 30 derniers jours, détail au survol, version tableau à un clic.
- **Démarrage des épisodes** : vues cumulées depuis la mise en ligne, épisode par épisode, pour comparer un démarrage à ceux d'avant au même âge plutôt qu'à des épisodes plus vieux. Version tableau aux étapes J+1, J+3, J+7, J+14, J+30.
- **Tableau des épisodes** : vues par réseau, total avec sa répartition, engagement et part regardée, triable ; un épisode se déplie pour montrer le détail de chacun de ses posts et ouvrir le post sur son réseau.
- **Programmation** : les prochains jours avec l'heure de chaque post, l'état de ceux déjà partis, et le dernier épisode programmé avec le nombre de jours restants.

## Front — structure UI
En-tête (accroche, titre, fraîcheur), bandeau d'alertes, rangée de tuiles (une grande tuile globale avec sparkline, trois tuiles réseau avec jauge de part), filtre segmenté par réseau, deux cartes graphiques côte à côte (colonnes empilées SVG, courbes SVG avec curseur et tooltip, bascule tableau sur chacune), carte tableau des épisodes (en-têtes triables, lignes dépliables vers trois cartes de détail), carte programmation (jours en défilement horizontal), notes de lecture. Les graphiques sont dessinés à la largeur réelle du conteneur (`ResizeObserver`). Le filtre est persisté dans `localStorage` sous la clé `cockpit-creator-net`. Couleurs de réseau : palette catégorielle validée pour le daltonisme, une valeur claire (Dawn, Atlas) et une valeur sombre (Obsidian), réservées aux marques des graphiques. En mode `file://`, `cockpit/data-creator.js` fournit une démo signalée dans l'en-tête.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelCreator()` | Composant racine : en-tête, alertes, filtre, cartes | `cockpit/panel-creator.jsx` |
| `CrKpis()` | Tuile globale et tuiles réseau | `cockpit/panel-creator.jsx` |
| `CrDaily()` | Colonnes empilées des vues gagnées par jour | `cockpit/panel-creator.jsx` |
| `CrLaunch()` | Courbes de démarrage, curseur clavier et souris | `cockpit/panel-creator.jsx` |
| `CrEpisodes()` | Tableau triable et détail par post | `cockpit/panel-creator.jsx` |
| `CrProgramme()` | Jours à venir et fin de file | `cockpit/panel-creator.jsx` |
| `creatorView.build()` | Lignes des quatre tables → épisodes avec leurs posts et relevés | `cockpit/lib/creator-view.js` |
| `creatorView.daily()` | Vues gagnées par jour local, écart entre fins de journée | `cockpit/lib/creator-view.js` |
| `creatorView.curves()` | Vues cumulées par âge du post, interpolées par quart de jour | `cockpit/lib/creator-view.js` |
| `creatorView.agg()` | Vues, engagement, part regardée pondérée par les vues | `cockpit/lib/creator-view.js` |
| `creatorView.alerts()` | Échecs, posts supprimés, collecte arrêtée, file qui s'épuise | `cockpit/lib/creator-view.js` |

## Back — sources de données
Quatre tables (`sql/037_creator_tower.sql`, RLS lecture `authenticated`, écriture `service_role`) :
- `creator_episodes` — un épisode par dossier du dépôt youtuber : numéro, titre YouTube, durée de la vidéo.
- `creator_posts` — un post Buffer : réseau, statut, dates prévue et réelle, lien, erreur ; `updated_at` touché à chaque collecte (sonde de fraîcheur).
- `creator_post_readings` — un relevé par passage de Buffer, clé (post, instant du relevé), chiffres cumulés depuis la publication. Le front lit 400 jours, par pages de 1000 lignes.
- `creator_public_readings` — compteurs publics (vues, j'aime ; commentaires, partages et favoris pour TikTok) des posts TikTok et YouTube des 14 derniers jours, un relevé par collecte (`sql/038`). `creatorView.points()` les mêle aux relevés Buffer en gardant le maximum courant, `creatorView.lastReading()` prend le plus haut des deux chiffre par chiffre.
- `creator_audience` — abonnés lus sur les pages publiques, un relevé par jour de Paris et par réseau.

## Back — pipelines qui alimentent
- `pipelines/creator_sync.py` (workflow `.github/workflows/creator-sync.yml`, 06:40 et 21:40 UTC) → lit tous les posts Buffer et leurs métriques (API GraphQL), retrouve l'épisode de chaque post (URL de la vidéo hébergée, puis ce que la base sait déjà, puis un post frère du même jour à New York), écrit les quatre tables ; relit les compteurs publics des posts TikTok et YouTube des 14 derniers jours (`creator_public_readings`) ; lit les abonnés TikTok et YouTube sur leurs pages publiques.

## Appels externes
- API GraphQL Buffer (`https://api.buffer.com`), clé `BUFFER_API_KEY`, deux fois par jour, côté pipeline uniquement.
- Pages publiques TikTok et YouTube de la chaîne et des posts des 14 derniers jours, deux fois par jour, sans authentification.

## Dépendances
- Onglets : aucun.
- Pipelines : `creator_sync`.
- Variables d'env / secrets : `BUFFER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

## États & edge cases
- Aucune donnée : l'onglet le dit et explique qu'il se remplit à la première collecte.
- Post publié sans relevé : la cellule affiche « … » et le détail annonce les premiers chiffres au prochain relevé Buffer.
- Relevé Buffer antérieur à la publication (Buffer garde la date de son dernier passage) : ignoré par le pipeline.
- Relevé tout à zéro après de vrais chiffres (Buffer a cessé de relire le post) : ignoré, pour ne pas dessiner un effondrement qui n'a pas eu lieu.
- Post reprogrammé après un échec : l'ancien reste en base, l'épisode garde le post le plus avancé.
- Abonnés illisibles (Instagram refuse sans connexion, YouTube masque le compteur tant que la chaîne n'en a pas, une IP de runner bloquée) : tuile à « — ».
- Compteur public illisible (page bloquée, format changé) : le post garde ses relevés Buffer, sans erreur.
- Relevé Buffer plus bas qu'un compteur public plus ancien (Buffer a jusqu'à un jour de retard) : la courbe et les totaux gardent le plus haut.
- Démo en `file://` : chiffres inventés, signalés dans l'en-tête.

## Limitations connues / TODO
- [ ] Buffer relit chaque réseau une fois par jour : les chiffres ont jusqu'à 24 h de retard sur les applis.
- [ ] Offre gratuite de Buffer : statistiques limitées aux 31 derniers jours ; un post plus ancien garde ses derniers chiffres.
- [ ] Pas d'abonnés Instagram.
- [ ] Les vues d'un jour sans collecte s'ajoutent au jour suivant.

## Dernière MAJ
2026-10-08 — compteurs publics TikTok et YouTube relus à chaque collecte (ADR-55) : le Short #1 avait 32 vues pendant que Buffer en annonçait 0.
2026-10-08 — création de l'onglet (ADR-54) : pipeline Buffer biquotidien, quatre tables, vues par jour, démarrage des épisodes, tableau dépliable, programmation et alertes.
