# S1 — Réparer `get_chunks_count()` dans `status_generator.py`

> Audit source : [2026-04-29v21-audit.md](../../2026-04-29v21-audit.md)
> Effort estimé : XS (~30 min)
> North Star : solder les 3 dettes d'erreurs visibles (Jarvis Lab Chunks=0, Jobs WebSocket, indexer 409).

---

```
Contexte projet : `status_generator.py::get_chunks_count()` retourne 0 alors que
`memories_vectors` contient 1000+ lignes. Bug confirmé sur `last_status_gen.log`
("Chunks: 0", "Snapshot genere: Chunks: 0"). Pattern PostgREST cassé : `?limit=0`
+ `Prefer: count=exact` ne renvoie pas toujours `Content-Range` exploitable. Le
panel Jarvis Lab (4e panel le plus consulté, 27 ouvertures/sem) affiche un chiffre
faux.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, écris un rapport ~20 lignes après ces
vérifications :

1. Lis `jarvis/status_generator.py` lignes 105-135 EN ENTIER. Tu dois identifier :
   (a) la requête HTTP courante (URL, headers, params),
   (b) la logique de parsing de `Content-Range`,
   (c) le fallback retournant 0.

2. Vérifie qu'aucun autre appelant n'utilise `get_chunks_count()` en dehors de
   `status_generator.py` :
   `grep -rn "get_chunks_count" jarvis/ scripts/`

3. Vérifie le comportement attendu côté Supabase REST en lisant
   https://docs.postgrest.org/en/v12/references/api/pagination_and_order.html
   (section "Exact Count") — tu dois confirmer que le pattern canonique est
   `Range: 0-0` (HEADER) + `Prefer: count=exact` plutôt que `?limit=0` (query).

4. Lis `last_status_gen.log` (les 30 dernières lignes) pour confirmer le symptôme :
   `Chunks indexes: 0`. Et lis `jarvis/intel/2026-04-29-signals.md` ligne
   "Vecteurs Supabase : 1000" pour confirmer le vrai compte.

Écris un rapport et ATTENDS ma validation explicite.

Objectif : `get_chunks_count()` retourne le vrai compte (≥ 1000) au lieu de 0.

Fichiers concernés :
- jarvis/status_generator.py (modification, lignes 107-132)

Étapes (après validation Phase 0) :
1. Remplacer le pattern actuel par :
   - URL : `{SUPABASE_URL}/rest/v1/memories_vectors?select=id`
   - Headers : `apikey`, `Authorization`, `Range: 0-0`, `Range-Unit: items`,
     `Prefer: count=exact`
   - Lire `Content-Range` (format `0-0/N` attendu).
2. Garder un fallback robuste : si `Content-Range` absent OU non-numérique,
   essayer un 2e appel avec `?select=id&limit=10000` et retourner `len(rows)`.
3. Logger un WARNING explicite si fallback déclenché.

Contraintes :
- Pas de nouvelle dépendance Python (utiliser `requests` déjà présent).
- Pas de timeout > 10s.
- Backward compatible : signature inchangée (`get_chunks_count() -> int`).
- Pas de modification de `status_generator.py` hors de cette fonction (pas de
  refacto opportuniste).

Validation (lance ces commandes après modification) :
- `python jarvis/status_generator.py 2>&1 | tail -10` → doit afficher
  `Chunks: N` ou `Chunks indexes: N` avec N ≥ 1000.
- `cat jarvis_data/last_status_gen.log | grep "Chunks"` → idem.
- Si N == 0 : la fonction n'est pas réparée, NE PAS commit.

Ne fais PAS :
- Ne refactore pas `sb_read()` ni `_headers()` ni la fonction `main()`.
- N'ajoute pas de retry exponentiel, de cache mémoire, ou de logging structuré.
- Ne touche pas à `memories_vectors` côté SQL (RLS, index).
- Ne push pas après commit (Jean fait la revue).

Quand c'est fait : montre le diff complet AVANT git add. git commit avec message
`fix(jarvis): status_generator — get_chunks_count via Range header (1000+ → vrai compte)`.
PAS de push.
```
