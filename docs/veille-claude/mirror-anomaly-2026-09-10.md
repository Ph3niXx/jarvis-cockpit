# Anomalie Miroir du Soir — 2026-09-10

**Signal** : 3 jours consécutifs (2026-09-08, 2026-09-09, 2026-09-10) avec
activité cockpit réelle (`section_opened` : 5, 3 puis 4 événements ;
`games_brief_shown` présent chaque jour) mais **zéro action créatrice**
sur toute la fenêtre : aucun `link_clicked`, `search_performed`,
`idea_moved`, idée créée dans `business_ideas`, `challenge_completed`,
`skill_radar_bumped` ni `wiki_shared`.

Ce n'est pas un jour creux (il y a de la visite), c'est un régime : Jean
ouvre le cockpit, consulte le brief et parfois Jobs Radar, puis repart
sans jamais transformer la visite en action.

## Détail par jour

| Jour | `section_opened` | Sections notables | Action créatrice |
|---|---|---|---|
| 2026-09-08 | 5 | `jobs_action` ×1, `games_brief_shown` ×3 | aucune |
| 2026-09-09 | 3 | `jp_band_shown` ×1, `recent_filter_auto_on` ×1 | aucune |
| 2026-09-10 | 4 | `brief` ×3, `jobs` ×1, `zero_state_shown` ×2 | aucune |

## Requête de vérification

```sql
SELECT (ts AT TIME ZONE 'Europe/Paris')::date AS day, event_type, COUNT(*)
FROM usage_events
WHERE (ts AT TIME ZONE 'Europe/Paris')::date IN ('2026-09-08','2026-09-09','2026-09-10')
GROUP BY 1,2 ORDER BY 1,2;
```

## Piste (non tranchée)

Trois jours ne suffisent pas à conclure, mais si le rythme se poursuit
demain, ça vaut le coup de regarder si un onglet en particulier (idées,
challenges, wiki) est devenu plus friction-heavy récemment, ou si c'est
simplement une semaine chargée côté RTE.

_Généré automatiquement par le Miroir du Soir — pas d'action requise,
note de suivi uniquement._
