# Anomalie Miroir du Soir — 2026-09-25

## Signal détecté

3 jours consécutifs (2026-09-23, 2026-09-24, 2026-09-25) sans aucune action
créatrice enregistrée dans `usage_events` / `business_ideas` :

| Date | idées créées | idées déplacées | challenges complétés | partages wiki |
|---|---|---|---|---|
| 2026-09-23 | 0 | 0 | 0 | 0 |
| 2026-09-24 | 0 | 0 | 0 | 0 |
| 2026-09-25 | 0 | 0 | 0 | 0 |

Le 2026-09-25, l'usage se limite à des ouvertures de sections
(`brief` ×6, `jobs` ×2, `mediatheque` ×1), sans clic d'article, sans
recherche, sans bump de skill radar, sans Strava/Withings.

## Contexte possiblement lié

Le brief Gemini du matin du 2026-09-25 a échoué en génération
(`brief_html` = erreur `503 UNAVAILABLE` côté Gemini, "high demand").
Les 6 visites répétées sur l'onglet "brief" le même jour suggèrent que
Jean cherchait un brief qui ne s'est jamais régénéré — sans lien de
causalité établi avec l'absence d'action créatrice sur les 2 jours
précédents, mais un facteur aggravant possible pour la journée du 25.

## À vérifier

- Le pipeline `main.py` (Gemini Flash-Lite) a-t-il un retry ou un
  fallback quand l'API répond 503 ? Sinon, une panne côté fournisseur
  bloque le brief du jour sans rattrapage.
- Confirmer si l'absence d'action créatrice sur 3 jours reflète une
  vraie pause (déplacement pro/perso) ou un décrochage du cockpit à
  surveiller sur les prochains jours.
