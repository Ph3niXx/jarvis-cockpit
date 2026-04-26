# Miroir du soir

> Récap réflexif quotidien 19h : "voici comment tu as pensé aujourd'hui". Contrepartie du brief Gemini du matin ("voici ce qu'il faut penser").

## Scope
mixte

## Finalité fonctionnelle
Boucler la journée par un retour sur l'usage réel du cockpit — sections visitées, articles lus, idées créées ou déplacées, recherches lancées, sport, poids — pour transformer la consommation passive en apprentissage actif. Le matin trace l'intention, le soir constate ce qui a vraiment occupé la pensée. L'écart entre les deux devient un signal réflexif.

## Parcours utilisateur
1. En fin de journée (après 19h), l'utilisateur clique "Miroir du soir" dans la sidebar (groupe Aujourd'hui, juste sous "Brief du jour") — ou tape directement la route `#evening`.
2. Le miroir s'ouvre sur un récap court de 3 à 4 paragraphes : focus thématique du jour, momentum personnel (action vs consommation), élément notable, et éventuellement un angle pour demain.
3. L'utilisateur lit le récap. Le ton est familier-direct, opinionated mais jamais flagorneur.
4. Deux boutons en bas : "← Brief du matin" pour comparer avec ce qu'il devait penser ce matin, "Demander à Jarvis" pour creuser un point précis.
5. Si la routine n'a pas encore tourné (avant 19h, ou retard), l'écran affiche "Pas encore de miroir aujourd'hui — reviens après 19h", avec les mêmes deux boutons.

## Fonctionnalités
- **Récap réflexif quotidien** : un texte court (3-4 paragraphes, max 280 mots) généré chaque soir par une routine Claude qui croise sections visitées, articles lus, idées dynamiques, recherches, sport, poids, brief du matin. L'utilisateur reçoit un retour sur sa journée sans avoir à faire le travail.
- **Vocabulaire produit, ton tutoyé** : pas un tableau de bord, pas une liste de KPIs — un paragraphe écrit qui dit honnêtement ce qui s'est passé, y compris quand la journée a été creuse.
- **Lien vers le matin** : un bouton ramène au brief du jour pour confronter intention et réalité.
- **Relai vers Jarvis** : un bouton bascule vers l'assistant pour creuser un point ("explique-moi pourquoi tu m'as dit X ce soir").
- **État d'attente clair** : avant 19h ou si la routine a sauté, message explicite plutôt qu'écran vide.

## Front — structure UI
Fichier : [cockpit/panel-evening.jsx](cockpit/panel-evening.jsx). Monté par le router dans [app.jsx](cockpit/app.jsx) sur la route `"evening"` (URL hash `#evening`). Styles dans [cockpit/styles-evening.css](cockpit/styles-evening.css).

Classes-racines :
- `.evening` — container principal (max-width 720px, padding généreux, fond `bg2`)
- `.evening-head > .evening-eyebrow + .evening-title + .evening-sub`
- `.evening-body` — corps HTML purifié via DOMPurify (whitelist `<p>`, `<strong>`, `<em>`, `<br>`)
- `.evening-foot` — barre footer avec 2 boutons ghost
- `.evening--loading` / `.evening--empty` — variants pour les états transitoires

Le panel est Tier 1 (fetch direct dans `useEffect` au mount, pas via le data-loader).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelEvening({ data, onNavigate })` | Composant racine, fetch + render des 4 états | [panel-evening.jsx:4](cockpit/panel-evening.jsx:4) |
| `formatDateLong(iso)` | Formate la date en français long ("samedi 26 avril 2026") | [panel-evening.jsx:106](cockpit/panel-evening.jsx:106) |
| `formatGeneratedAt(ts)` | Formate l'heure de génération ("19:03") | [panel-evening.jsx:115](cockpit/panel-evening.jsx:115) |

## Back — sources de données
Table `daily_mirror` — 1 ligne par jour, PK `mirror_date` :
- `summary_html` text — corps HTML du récap (<p>, <strong>)
- `stats` jsonb — métriques d'usage agrégées (sections_visited, links_clicked_count, ideas_*, strava, withings, morning_brief_present)
- `generated_at` timestamptz — horodatage de la génération

RLS : SELECT pour `authenticated`, INSERT/UPDATE pour `service_role` uniquement (la routine Cowork écrit via MCP).

## Back — pipelines qui alimentent
- **Routine Cowork "Miroir du soir cockpit"** (cadence quotidienne, 19h Paris, sandbox cloud Anthropic, modèle Claude Haiku 4.5) → lit `usage_events`, `articles`, `business_ideas`, `weekly_challenges`, `strava_activities`, `withings_measurements`, `daily_briefs` du jour ; UPSERT dans `daily_mirror`. Doc : [docs/cowork-routines/daily-mirror.md](docs/cowork-routines/daily-mirror.md).
- Aucun pipeline Python local — best-effort cloud assumé.

## Appels externes
- `window.sb.query("daily_mirror", "mirror_date=eq.YYYY-MM-DD&limit=1")` — fetch REST Supabase authentifié.
- `window.DOMPurify.sanitize()` — sanitization HTML côté front.

## Dépendances
- **Onglets aval** : `brief` (bouton retour), `jarvis` (creuser un point).
- **Pipelines** : routine Cowork "Miroir du soir cockpit".
- **Variables d'env / secrets** : Cowork connecté au MCP Supabase avec service_role.

## États & edge cases
- **Loading** : `.evening--loading` avec eyebrow + "Chargement…".
- **Empty avant 19h** : "Le récap quotidien est généré chaque jour à 19h. Reviens après."
- **Empty après 19h sans ligne** : "La routine n'a pas encore tourné — soit elle est en retard, soit elle a sauté ce soir."
- **Erreur fetch** : `.evening--empty` avec message d'erreur générique + bouton retour brief.
- **Journée silencieuse** : la routine insère quand même une ligne avec un seul paragraphe assumant le silence — donc l'utilisateur ne tombe jamais sur un écran vide ambigu un jour de vraie inactivité.
- **HTML hostile** : DOMPurify strip tout sauf `<p>`, `<strong>`, `<em>`, `<br>`.

## Limitations connues / TODO
- [ ] Pas de navigation vers les miroirs des jours précédents (V2 : carrousel ou date picker).
- [ ] Pas de notification push à 19h05 quand le miroir est généré.
- [ ] Pas de "miroir hebdo" agrégé sur 7 jours.
- [ ] Pas d'édition manuelle du miroir depuis le front (lecture seule).
- [ ] Si la routine Cowork tombe plusieurs jours d'affilée, aucune alerte — il faut ouvrir Cowork pour le voir.

## Dernière MAJ
2026-04-26 — création initiale (panel + route + entrée sidebar Aujourd'hui, table `daily_mirror`, doc routine Cowork) ; alignement groupe sur le runtime suite au refacto NAV en source unique.
