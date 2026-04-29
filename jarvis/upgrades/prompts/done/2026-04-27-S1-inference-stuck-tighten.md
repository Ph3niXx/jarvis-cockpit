# S1 — Durcir `inference_stuck` : abort sur 2e `APITimeoutError`, peu importe l'état `check_lm_studio()`

> Audit source : [2026-04-27-audit.md](../../2026-04-27-audit.md)
> Effort estimé : XS (~30 min)
> North Star : (a) plus aucun timeout LM Studio à 3 attempts × 1114s même si check_lm_studio() ne répond pas, (b) signals.md généré chaque matin

---

```
Contexte projet : v14-S1 (commit 34eb5a1) a câblé la détection inference_stuck
mais avec une condition `lm_state == "connected"` qui rate les cas de saturation
totale où GET /v1/models timeout aussi. Confirmé sur 2 traces post-deploy
(2026-04-26T08:08:11 et T08:26:45 dans jarvis_data/llm_traces.jsonl) :
attempts=3, latency_ms≈1114000, error_type=APITimeoutError. Le filet a manqué
2 cas sur 3 dans les 24h suivant son déploiement.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, écris un rapport ~25 lignes après ces
vérifications :

1. Lis jarvis/llm_client.py L91-130 EN ENTIER. Tu dois distinguer 3 branches
   actuelles dans le except APITimeoutError | APIConnectionError :
   (a) `if isinstance(e, APITimeoutError) and lm_state == "no_model_loaded"` →
       raise model_unloaded_midrun (au 1er timeout, inchangée par ce SHIP).
   (b) `elif lm_state == "connected" and attempt >= 1` → raise inference_stuck
       (la branche à durcir).
   (c) Fall-through `if attempt < MAX_RETRIES` → backoff + retry.

2. Lis jarvis_data/llm_traces.jsonl (les 30 dernières lignes — utilise
   tail -30). Recense les traces post-cutoff 2026-04-26T08:00 UTC : tu dois
   trouver exactement :
   - 2 traces APITimeoutError attempts=3 latency≈1114s (08:08, 08:26).
   - 1 trace ok attempts=1 latency=56905 (08:27).
   - 1 trace inference_stuck attempts=2 latency=741271 (08:40).
   Si différent, STOP et signale.

3. grep -rn "chat_completion_sync\|chat_completion_async" jarvis/ — vérifie
   qu'aucun appelant ne dépend du comportement « retry sur APITimeoutError
   à attempt=2 » (server.py /chat, nightly_learner._llm_extract,
   daily_brief_generator, status_generator, evaluate-challenge). Pour chacun,
   verdict « regression-safe oui/non/à investiguer ».

4. Identifie 1 décision design à arbitrer EXPLICITEMENT :
   - Faut-il garder la branche (b) `lm_state == "connected"` comme chemin
     « rapide » qui abort dès attempt >= 1, ET ajouter un fallback qui abort
     aussi quand lm_state != "connected" mais attempt >= 1 ?
     → Recommandé : OUI, fusionner. Sur APITimeoutError à attempt >= 1, abort
       inconditionnel. La branche `lm_state == "no_model_loaded"` (1er timeout)
       reste prioritaire pour distinguer un unload franc d'un freeze. La
       branche `lm_state == "connected"` devient redondante, on la supprime.

5. Considère le cas légitime « long prompt 763s succès au 3e attempt »
   (trace 2026-04-25T14:27:05 chars_in=1989 tokens_out=1101 attempts=3
   status=ok). Ce cas DEVIENDRA un faux positif après ce SHIP : on aurait
   abort en attempt=2. Verdict : compromis acceptable car (i) 1/129 traces,
   (ii) les long-prompts >120s sont déjà rares et hors flux normal, (iii) le
   coût d'attendre 1114s en silence > coût d'aborter et de relancer un
   long-prompt en mode dégradé. Documente ça dans le commentaire du code.

ATTENDS validation explicite avant de coder.

Objectif : Sur APITimeoutError à attempt >= 1, abort en ≤ 250s avec trace
inference_stuck — sans dépendre de la disponibilité de check_lm_studio().

Fichiers concernés :
- jarvis/llm_client.py (modification ciblée du except — 1 fichier, 1 fonction).

Étapes (après validation) :

1. Dans jarvis/llm_client.py, dans le bloc except APITimeoutError | APIConnectionError
   de _sync_call, restructurer comme suit :

   ```python
   except (APITimeoutError, APIConnectionError) as e:
       last_exc = e
       if isinstance(e, APITimeoutError):
           # 1er timeout : check si modèle déchargé (raise immédiat)
           if attempt == 0:
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
                       f"LM Studio unloaded model {model_used} mid-run "
                       f"(after attempt {attempt + 1})"
                   ) from e
           # 2e timeout (ou plus) : inference probablement stuck
           # (VRAM saturée, check_lm_studio peut être lui-même injoignable).
           # Compromis assumé : on abandonne aussi quelques long-prompts
           # légitimes >120s × 2 — ils sont rares (1/129 historiquement)
           # et coûtent moins que 1114s de silence.
           else:
               _write_trace({
                   "ts": datetime.now(timezone.utc).isoformat(),
                   "model": model_used,
                   "chars_in": chars_in,
                   "latency_ms": round((time.time() - start_time) * 1000),
                   "attempts": attempt + 1,
                   "status": "error",
                   "error_type": "inference_stuck",
               })
               raise RuntimeError(
                   f"LM Studio inference stuck on {model_used} "
                   f"(attempt {attempt + 1}/{MAX_RETRIES + 1})"
               ) from e
       if attempt < MAX_RETRIES:
           backoff = 2 ** (attempt + 1)
           log.warning("LLM retry %d/%d after %s (backoff %ds)",
                       attempt + 1, MAX_RETRIES, type(e).__name__, backoff)
           time.sleep(backoff)
   ```

   Note : APIConnectionError reste retry-friendly (réseau flake ≠ inference
   stuck). Seul APITimeoutError déclenche l'abort à attempt >= 1.

2. Validation reproductible :
   - python -m py_compile jarvis/llm_client.py jarvis/nightly_learner.py jarvis/server.py
     → exit 0
   - Test mock (sans LM Studio) : ajouter un test ad-hoc dans test_jarvis.py
     OU script jetable :
     ```python
     from unittest.mock import patch, MagicMock
     from openai import APITimeoutError
     from jarvis.llm_client import _sync_call

     mock_client = MagicMock()
     mock_client.chat.completions.create.side_effect = APITimeoutError("stuck")
     with patch("jarvis.llm_client.get_client", return_value=mock_client):
         try:
             _sync_call([{"role":"user","content":"x"}], 10, 0.0)
         except RuntimeError as e:
             print("OK", e)
     ```
     → doit afficher `OK LM Studio inference stuck on ...` (PAS APITimeoutError).
   - tail -1 jarvis_data/llm_traces.jsonl → `error_type: "inference_stuck"`,
     `attempts: 2`.

3. Vérifier la durée wallclock : le test mock doit retourner en
   < 10s (1 timeout simulé instantané + backoff 2s + 2e timeout simulé).
   Sur un vrai timeout de 120s × 2 + backoff 2s = 242s max — bien < 1114s.

Contraintes :
- Ne touche PAS à la branche APIConnectionError fall-through (réseau retry
  reste utile).
- Ne change PAS la signature publique de chat_completion_sync /
  chat_completion_async ni la valeur MAX_RETRIES.
- Ne supprime PAS check_lm_studio() — la branche `attempt == 0 + no_model_loaded`
  l'utilise toujours.
- Ne touche PAS aux call sites (server.py, nightly_learner, status_generator,
  daily_brief_generator) — ils captent déjà RuntimeError si nécessaire.
- Pas de nouvelle variable d'env, pas de nouvelle dépendance.

Validation :
- python -m py_compile jarvis/llm_client.py → exit 0.
- grep -c "inference_stuck" jarvis/llm_client.py → ≥ 2 (1 dans le trace, 1
  dans le RuntimeError message).
- grep -c "lm_state == \"connected\"" jarvis/llm_client.py → 0 (ancienne
  condition supprimée).
- Test mock APITimeoutError × 2 → RuntimeError "stuck" en attempt=2.
- python -m py_compile $(grep -lE "chat_completion" jarvis/*.py) → tous OK.

Ne fais PAS :
- N'introduis pas de circuit breaker stateful inter-runs.
- N'ajoute pas de notification email/Slack/push.
- Ne refactore pas _sync_call au-delà du bloc except cité.
- Ne touche pas au préflight nightly_learner.
- Ne touche pas au cockpit (panel-jarvis.jsx etc.).
- Ne push pas.

Quand c'est fait : montre-moi le diff complet AVANT git add + le résultat
du test mock. git commit avec message "fix(jarvis): inference_stuck —
abort au 2e timeout sans dépendre de check_lm_studio".
PAS de push.
```
