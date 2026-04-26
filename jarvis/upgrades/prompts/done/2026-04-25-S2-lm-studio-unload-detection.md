# S2 — Détection LM Studio "model unloaded" mid-run dans `_sync_call`

> Audit source : [2026-04-25-audit.md](../../2026-04-25-audit.md)
> Effort estimé : S (1.5-2h)
> North Star : Le diagnostic hebdo de Jarvis doit redevenir fiable — un échec LM Studio mid-run ne doit plus brûler 55 minutes en silence.

---

```
Contexte projet : Le 24/04, 3 timeouts consécutifs LM Studio (1108s × 3 = 55 min) ont 
brûlé en silence. Cause : LM Studio a déchargé le modèle après le préflight, et la 
boucle retry dans llm_client._sync_call attend 120s × 3 sans vérifier l'état du serveur 
entre tentatives. Le check_lm_studio() existant (GET /v1/models, ~50ms) permet de 
détecter "no_model_loaded" en quasi-temps-réel — il faut juste le câbler dans la boucle 
de retry.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant toute modification :

1. Lis jarvis/llm_client.py EN ENTIER (117 lignes — fais-le).
2. Lis jarvis/server.py L116-205 (l'endpoint /health et la branche `lm_studio`).
3. Lis jarvis/nightly_learner.py L360-400 (préflight existant — référence pour le 
   pattern, mais NE PAS le dupliquer).
4. tail -20 jarvis_data/llm_traces.jsonl (regarde les 3 timeouts du 24/04 — tu dois 
   pouvoir reconstituer le scénario : ping OK puis 3 timeouts × 1108s sur extraction).
5. Vérifie qu'aucun appel à _sync_call ne dépend du comportement "retry après 1108s" 
   (chat /chat, nightly, daily_brief, status_generator, evaluate-challenge, indexer). 
   grep -rn "chat_completion_sync\|chat_completion_async" jarvis/ | head.
6. Identifie où ranger la nouvelle constante de classe d'erreur :
   - "model_unloaded_midrun" comme valeur de error_type dans le trace JSONL
   - faut-il aussi exposer un état dans /health ? Oui, déjà fait via `lm_studio` 
     champ ; pas de nouvelle clé.

Écris un rapport ~30 lignes listant :
- Le diagramme actuel : APITimeoutError → backoff 2s → retry → backoff 4s → retry → raise
- Le diagramme cible : APITimeoutError → check_lm_studio() rapide → si "no_model_loaded" 
  → trace status="error" error_type="model_unloaded_midrun" → raise immédiatement 
  (pas de retry) ; sinon → comportement actuel (backoff + retry).
- Le ou les call sites qui pourraient régresser (lister explicitement, pas vague).
- Si on doit aussi mettre à jour state.last_result côté nightly (suggéré : oui, 
  ajouter une branche "model_unloaded_midrun" dans nightly_learner._llm_extract pour 
  setter state["last_result"] = "lm_studio_unloaded_midrun" si on récupère cette 
  classe d'erreur — distinct de "extraction_model_unavailable" qui est une absence 
  au démarrage).

ATTENDS validation explicite avant de coder.

Objectif : Sur un run où LM Studio décharge le modèle mid-run, abort en < 15s avec 
trace lisible et état /health degraded — au lieu de brûler 55 minutes en silence.

Fichiers concernés :
- jarvis/llm_client.py (modification ciblée du except APITimeoutError dans _sync_call)
- jarvis/nightly_learner.py (ajout d'une branche de capture pour l'error_type 
  "model_unloaded_midrun", set state["last_result"], early return)
- jarvis/server.py (déjà câblé via /health → vérifier que `last_result == 
  "lm_studio_unloaded_midrun"` déclenche `status: "degraded"` ; sinon ajouter à la 
  liste des marqueurs degraded L156)

Étapes (après validation) :

1. Dans jarvis/llm_client.py, dans la boucle for de _sync_call :
   ```python
   except (APITimeoutError, APIConnectionError) as e:
       last_exc = e
       # Mid-run model unload detection — check before retry
       if isinstance(e, APITimeoutError):
           lm_state = check_lm_studio(timeout=2.0)
           if lm_state == "no_model_loaded":
               _write_trace({
                   "ts": datetime.now(timezone.utc).isoformat(),
                   "model": model_used,
                   "chars_in": chars_in,
                   "latency_ms": round((time.time() - start_time) * 1000),
                   "attempts": attempt + 1,
                   "status": "error",
                   "error_type": "model_unloaded_midrun",
               })
               raise RuntimeError(
                   f"LM Studio unloaded model {model_used} mid-run (after attempt {attempt+1})"
               ) from e
       if attempt < MAX_RETRIES:
           backoff = 2 ** (attempt + 1)
           log.warning("LLM retry %d/%d after %s (backoff %ds)", attempt + 1, MAX_RETRIES, type(e).__name__, backoff)
           time.sleep(backoff)
   ```
   Le check_lm_studio() ajoute ~50ms à chaque APITimeoutError — coût trivial.

2. Dans jarvis/nightly_learner.py::_llm_extract (~L160-180) :
   - Wrapper l'appel chat_completion_sync dans un try/except `RuntimeError` qui 
     contient "unloaded model"
   - Si capté : log.error + state["last_result"] = "lm_studio_unloaded_midrun" + 
     re-raise (laisser run() voir l'arrêt — tu choisis : early return propre dans 
     run(), ou propagation jusqu'au catch global)
   - Cohérent avec la branche existante "extraction_model_unavailable"

3. Dans jarvis/server.py L156 :
   - Ajouter "lm_studio_unloaded_midrun" à la liste des last_result qui passent 
     /health en `status: "degraded"`.

4. Test reproductible (sans casser la prod) :
   ```bash
   # Avec LM Studio démarré + modèle chargé :
   python -c "from jarvis.llm_client import chat_completion_sync; \
     out, t = chat_completion_sync([{'role':'user','content':'ping'}], max_tokens=5); \
     print('OK', out, t)"
   # → doit fonctionner normalement
   
   # Décharger manuellement le modèle dans LM Studio (UI), puis :
   python -c "from jarvis.llm_client import chat_completion_sync; \
     out, t = chat_completion_sync([{'role':'user','content':'ping'}], max_tokens=5); \
     print('OK', out, t)"
   # → doit lever RuntimeError 'unloaded model' en < 15s
   ```

Contraintes :
- Ne supprime PAS les retries existants — APIConnectionError reste retry-friendly 
  (LM Studio peut ne pas répondre brièvement sans avoir déchargé)
- Ne touche pas au préflight existant dans nightly_learner — il complète ce SHIP, pas 
  l'inverse
- Ne touche pas à l'orchestrateur _route_llm dans server.py (HTTPException 504 
  reste correct pour /chat — le RuntimeError remonte naturellement à 500)
- Ne change PAS la signature publique de chat_completion_sync / chat_completion_async
- Pas de nouvelle dépendance, pas de variable d'env nouvelle
- check_lm_studio doit timeout court (2s max) — sinon on rajoute du temps mort

Validation :
- python jarvis/scripts/smoke_test_chat.py 2>/dev/null OR test manuel : 1 ping OK 
  puis 1 ping après unload manuel → exception en < 15s, trace error_type 
  "model_unloaded_midrun" présente
- grep -c "model_unloaded_midrun" jarvis_data/llm_traces.jsonl → ≥ 1 après le test
- curl http://localhost:8765/health (modèle déchargé) → "lm_studio": "no_model_loaded", 
  "status": "degraded"
- python -m py_compile jarvis/llm_client.py jarvis/nightly_learner.py jarvis/server.py → OK
- Les autres call sites (status_generator, daily_brief_generator, evaluate-challenge) 
  doivent compiler aussi : python -m py_compile $(grep -lE "chat_completion" jarvis/*.py)

Ne fais PAS :
- N'ajoute pas un mécanisme de re-load automatique du modèle (over-engineering, 
  appartient à start_jarvis.bat)
- N'ajoute pas de circuit breaker stateful (pour 1 cas en 7 jours, pas de valeur)
- N'ajoute pas de notification email/Slack/push (hors scope)
- Ne refactore pas _sync_call au-delà du bloc except cité
- Ne push pas
- Ne touche pas au cockpit (panel-jarvis.jsx etc.)

Quand c'est fait : montre-moi le diff + la trace JSONL d'un test réel (1 ping OK + 1 
ping après unload). git commit avec message "feat(jarvis): detect LM Studio model 
unload mid-run, abort fast with state.degraded". 
PAS de push.
```
