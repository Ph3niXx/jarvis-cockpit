# S3 — Ajouter `on_conflict` au helper `sb_post()` + l'utiliser dans `indexer.py` et `daily_brief_generator.py`

> Audit source : [2026-04-29v21-audit.md](../../2026-04-29v21-audit.md)
> Effort estimé : S (~1h)
> North Star : solder les 3 dettes d'erreurs visibles (Jarvis Lab Chunks=0, Jobs WebSocket, indexer 409).

---

```
Contexte projet : 4 erreurs 409/run cumulées sur 2 sites :
- `last_indexer.log` : 3x sur `memories_vectors` (P21, sous seuil isolé).
- `last_activity_brief.log` : 1x sur `activity_briefs`, clé date.
Cause unique : `Prefer: resolution=merge-duplicates` envoyé SANS query param
`?on_conflict=col1,col2` à l'URL. PostgREST sans hint replie sur INSERT brut →
409 sur conflit unique.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, écris un rapport ~30 lignes après ces
vérifications :

1. Lis `jarvis/supabase_client.py:31-50` EN ENTIER. Note la signature actuelle
   de `sb_post(table, data, upsert=False)` et le format des headers `Prefer`.

2. Liste TOUS les sites d'appel à `sb_post`:
   `grep -rn "sb_post\b" jarvis/ scripts/`
   Pour chacun, note le nom de la table cible. Tu dois trouver au moins :
   - `jarvis/indexer.py` (×2 → memories_vectors)
   - `jarvis/nightly_learner.py` (vérifier les tables)
   - `jarvis/observers/*` (vérifier)
   - autres modules qui en dépendent.

3. Pour `memories_vectors`, lis le DDL :
   `grep -rn "memories_vectors" jarvis/migrations/*.sql sql/` puis
   ouvre le fichier qui crée la table. Note la liste exacte des colonnes
   de la contrainte unique (probablement
   `(source_table, source_id, chunk_index)`).

4. Lis `jarvis/observers/daily_brief_generator.py:240-265`. Note que ce site
   appelle `requests.post` directement (pas `sb_post`) avec son propre header.
   Décide : (a) le faire passer par `sb_post` avec `on_conflict="date"`, OU
   (b) ajouter le query param `?on_conflict=date` directement à l'URL en place.
   Recommandation : option (b) si le site fait des choses spécifiques (custom
   headers, payload shape), sinon option (a) pour mutualiser.

5. Vérifie qu'aucune table n'utilise actuellement `merge-duplicates` SUR LA
   PRIMARY KEY (vs sur une UNIQUE constraint dédiée) — PostgREST `on_conflict`
   doit pointer une contrainte unique nommée, pas le PK implicite.
   `grep -rn "PRIMARY KEY\|UNIQUE" jarvis/migrations/*.sql sql/ | head -50`.

Écris un rapport et ATTENDS ma validation explicite (notamment sur le choix
(a) vs (b) pour daily_brief_generator).

Objectif : éliminer les erreurs 409 dans `last_indexer.log` et
`last_activity_brief.log` sans changer la sémantique des autres appels.

Fichiers concernés :
- jarvis/supabase_client.py (modification — ajouter param `on_conflict`)
- jarvis/indexer.py (modification — passer `on_conflict` aux 2 sites d'appel)
- jarvis/observers/daily_brief_generator.py (modification — selon choix Phase 0)

Étapes (après validation Phase 0) :
1. Modifier `sb_post(table, data, upsert=False, on_conflict=None)`. Si
   `on_conflict` est défini, l'ajouter comme query param `?on_conflict=<value>`
   à l'URL. Compatibilité descendante : `on_conflict=None` → comportement
   actuel inchangé.
2. Dans `jarvis/indexer.py`, identifier les 2 appels `sb_post("memories_vectors",
   batch, upsert=True)` et passer
   `on_conflict="source_table,source_id,chunk_index"` (à confirmer via Phase 0).
3. Dans `jarvis/observers/daily_brief_generator.py:248-261`, appliquer le
   choix (a) ou (b) validé en Phase 0.
4. Aucune autre modification.

Contraintes :
- Pas de modification du DDL Supabase (tables, indexes, RLS).
- Pas de nouvelle dépendance Python.
- Backward compatible : tous les autres appelants de `sb_post` sans
  `on_conflict` passent par la même branche que dans le code actuel.
- Pas de refacto opportuniste de `_headers()` ou `sb_read()`.
- Si `urllib.parse.quote` est nécessaire pour échapper la valeur d'`on_conflict`,
  l'utiliser, mais ne pas créer de helper d'encoding générique.

Validation (lance ces commandes après modification) :
- `python jarvis/indexer.py 2>&1 | grep -c "ERROR"` → doit retourner 0
  (au lieu de ≥3 actuellement).
- `python -m jarvis.observers.daily_brief_generator --date 2026-04-29 2>&1 |
  grep -c "Upsert failed"` → doit retourner 0 (au lieu de ≥1 sur les jours
  où la ligne existe déjà).
- `cat jarvis_data/last_indexer.log | grep "ERROR"` → vide après le run de
  validation.
- Le grep doit cibler le run JUSTE après ta modif (vérifier le timestamp).

Ne fais PAS :
- Ne fix pas les autres bugs des logs (Chunks=0, jarvis:gateway, panel:wiki)
  — ils ont leurs propres SHIPs ou PARKs.
- Ne touche pas à `nightly_learner.py` sauf si Phase 0 démontre qu'il est aussi
  affecté par 409.
- N'introduis pas de retry exponentiel dans `sb_post`.
- Ne push pas après commit.

Quand c'est fait : montre le diff complet AVANT git add. git commit avec message
`fix(jarvis): sb_post on_conflict — tue 409/run sur memories_vectors et
activity_briefs`.
PAS de push.
```
