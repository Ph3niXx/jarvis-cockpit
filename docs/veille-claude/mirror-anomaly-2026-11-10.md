# Miroir du soir — anomalie du 2026-11-10

Note écrite par la routine Miroir du Soir (ÉTAPE 5, signal fort). Première note de ce type.

## Signal 1 — 8 jours consécutifs sans action créatrice

Du 2026-11-03 au 2026-11-10, `usage_events` ne contient aucun `idea_moved`, `challenge_completed`, `skill_radar_bumped` ni `wiki_shared`, et aucune ligne n'a été créée dans `business_ideas`.

| Jour | Events | Actions créatrices |
|---|---|---|
| 11-03 | 36 | 0 |
| 11-04 | 3 | 0 |
| 11-05 | 8 | 0 |
| 11-06 | 11 | 0 |
| 11-07 | 2 | 0 |
| 11-08 | 2 | 0 |
| 11-09 | 4 | 0 |
| 11-10 | 13 | 0 |

Le seuil de la routine (3 jours) est dépassé depuis le 11-05. L'usage se résume à un aller-retour `brief` → `creator`, sans clic sur un article ni recherche depuis le 11-06. Dernière idée créée dans le carnet : 2026-04-14.

## Signal 2 — données perso figées (cause à vérifier)

- `strava_activities` : dernière activité et dernière synchro le 2026-06-30.
- `withings_measurements` : dernière mesure le 2026-04-23.

Le miroir écrit donc chaque soir « ni sport ni pesée » sans pouvoir distinguer un arrêt réel d'une synchro en panne. Non diagnostiqué ici (hors périmètre de la routine).

## Signal 3 — le prompt de la routine référence deux colonnes inexistantes

- `strava_activities.start_date_local` n'existe pas, la colonne est `start_date`.
- `daily_briefs.brief_date` n'existe pas, la colonne est `date`.

Le run du jour a utilisé les vrais noms. Le prompt stocké est à corriger, sinon ces deux requêtes échouent telles qu'écrites.
