# S1 — Détection LM Studio `inference_stuck` (modèle chargé mais inférence bloquée)

> Audit source : [2026-04-26-audit.md](../../2026-04-26-audit.md)
> Effort estimé : S (1.5-2h)
> North Star : Plus aucun timeout LM Studio ne doit consommer 55 min en silence — qu'il s'agisse d'un modèle déchargé OU d'une inférence bloquée par saturation VRAM.

---

```
Contexte projet : Le 24/04 puis le 25/04, 3 timeouts × 1114s = 55 min brûlées 
en silence par jour. v13-S2 (commit f82b959) couvre désormais "modèle déchargé 
en cours de run" (model_unloaded_midrun). Reste à couvrir : "modèle chargé 
mais inférence bloquée" (probable VRAM debord sur RTX 5070 Laptop 8 Go avec 
le 9B + embedding 0.6B chargés simultanément). Quand ça arrive, check_lm_studio() 
renvoie "ok" (le modèle est listé) mais l'inférence elle-même est stuck — 
retry n'aide pas, c'est hardware, on ne sortira pas de la boucle de saturation 
en réessayant.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, compile ce bilan en ~30 lignes :

1. Lis jarvis/llm_client.py EN ENTIER (~133 lignes — fais-le).
2. Lis jarvis/server.py L130-170 (l'endpoint /health, la liste degraded markers).
3. Lis jarvis/nightly_learner.py L455-510 (les 2 catch existants pour 
   "lm_studio_unloaded_midrun" — ce sont tes templates).
4. tail -30 jarvis_data/llm_traces.jsonl | grep -E "error|model_unloaded" 
   (récupère la signature exacte des 3 timeouts du 25/04 et du model_unloaded 
   du 25/04 13:32 — tu dois pouvoir distinguer les 2 sur le terrain).
5. grep -rn "chat_completion_sync\|chat_completion_async" jarvis/ — liste 
   les call sites qui peuvent voir le nouveau RuntimeError "inference stuck". 
   Tu dois prouver qu'aucun ne dépend du comportement "retry après 1114s".
6. Identifie les 2 décisions de design à arbitrer EXPLICITEMENT (et propose-les 
   à Jean si doute) :
   - Trigger inference_stuck après attempt 0 (1 timeout, ~120s) ou attempt 1 
     (2 timeouts, ~242s) ? Recommandé : attempt >= 1 — laisse 1 retry pour 
     les long-prompts légitimes (760s observés sur 1 OK), abort dès le 2e 
     échec consécutif sur un modèle "ok". Compromis vs mur 1114s.
   - lm_state == "ok" suffit-il, ou faut-il aussi vérifier que le model_id 
     ciblé est dans la liste retournée par check_lm_studio ? Recommandé : 
     "ok" suffit pour ce SHIP — on traite check_lm_studio comme un binaire 
     "joignable + au moins un modèle". L'affinage modèle-précis appartient 
     à un futur SHIP.

Écris un rapport ~25 lignes listant :
- Le diagramme actuel (post v13-S2) : APITimeoutError → check_lm_studio() → 
  branche "no_model_loaded" raise OR sinon backoff + retry jusqu'à 3 fois.
- Le diagramme cible : APITimeoutError → check_lm_studio() → branche 
  "no_model_loaded" raise (inchangée) OR branche NEW "ok" + attempt >= 1 → 
  trace error_type="inference_stuck" + raise RuntimeError immédiat OR sinon 
  backoff + retry (inchangé).
- Les call sites identifiés (server.py /chat, nightly_learner._llm_extract, 
  daily_brief_generator, status_generator, evaluate-challenge) avec verdict 
  "regression-safe oui/non/à investiguer" pour chacun.
- Les 2 arbitrages design + ta proposition.

ATTENDS validation explicite avant de coder.

Objectif : Sur un run où LM Studio renvoie "ok" mais l'inférence est stuck 
(VRAM saturée ou run-away), abort en ≤ 250s avec trace lisible et 
/health "degraded" — au lieu de brûler 1114s en silence.

Fichiers concernés :
- jarvis/llm_client.py (modification ciblée du except APITimeoutError dans 
  _sync_call, ajout d'une branche "ok" + attempt >= 1)
- jarvis/nightly_learner.py (ajouter une 3e branche aux 2 catch existants 
  pour state["last_result"] = "lm_studio_inference_stuck", early return)
- jarvis/server.py L157 (ajouter "lm_studio_inference_stuck" à la liste 
  des last_result qui passent /health en degraded)

Étapes (après validation) :

1. Dans jarvis/llm_client.py, dans le bloc except APITimeoutError | 
   APIConnectionError de _sync_call, après la branche existante 
   `if lm_state == "no_model_loaded"` :
   ```python
   elif lm_state == "ok" and attempt >= 1:
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
           f"LM Studio inference stuck on {model_used} (attempt {attempt + 1}/{MAX_RETRIES + 1})"
       ) from e
   ```
   Note : `attempt >= 1` veut dire qu'on tolère 1 retry — le premier timeout 
   peut être un long-prompt légitime ou flaky GPU. Le DEUXIÈME timeout sur 
   "ok" est le signal stuck.

2. Dans jarvis/nightly_learner.py, copie-colle exactement la branche 
   "lm_studio_unloaded_midrun" déjà présente aux L460-465 et L497-502, 
   ajoute juste après :
   ```python
   except RuntimeError as e:
       if "inference stuck" in str(e).lower():
           state["last_result"] = "lm_studio_inference_stuck"
           _save_state(state)
           return {"status": "error", "reason": "lm_studio_inference_stuck"}
       raise
   ```
   (ou intègre-le dans le except RuntimeError existant si la structure le 
   permet — ne PAS casser le handler unload existant).

3. Dans jarvis/server.py L157 :
   ```python
   if nightly.get("last_result") in ("empty_extraction", "extraction_model_unavailable", "lm_studio_unloaded_midrun", "lm_studio_inference_stuck"):
       result["status"] = "degraded"
   ```

4. Test reproductible (sans casser la prod) :
   - Démarre LM Studio + 9B chargé. Lance un long chat parallèle (8k tokens 
     d'historique). Pendant ce chat, lance manuellement :
     ```bash
     python -c "from jarvis.llm_client import chat_completion_sync; \
       out, t = chat_completion_sync([{'role':'user','content':'ping ' * 200}], 
       max_tokens=100); print('OK', t)"
     ```
   - Si VRAM est saturée, l'inférence va timeout — devrait afficher le 
     RuntimeError "stuck" en ≤ 250s (au lieu de 1114s).
   - grep -c "inference_stuck" jarvis_data/llm_traces.jsonl → ≥ 1
   - Si reproduction VRAM trop pénible, alternative : mock APITimeoutError 
     dans test_jarvis.py, vérifier que le code-path raise bien.

Contraintes :
- Ne supprime PAS la branche "no_model_loaded" existante — elle est 
  orthogonale, elle reste utile.
- Ne change PAS la signature publique de chat_completion_sync / 
  chat_completion_async.
- Ne réduit PAS le timeout client (toujours 120s) — sinon on génère des 
  faux positifs sur les long-prompts légitimes.
- Ne touche pas au préflight nightly_learner — il complète ce SHIP au 
  démarrage, pas à l'inverse.
- Ne touche pas à _route_llm dans server.py (HTTPException 504 reste 
  correct pour /chat).
- Pas de nouvelle dépendance, pas de variable d'env nouvelle.
- check_lm_studio doit garder son timeout court (2s) — sinon on rajoute 
  du temps mort sur le retry.

Validation :
- python -m py_compile jarvis/llm_client.py jarvis/nightly_learner.py jarvis/server.py
  → exit 0
- grep -c "inference_stuck" jarvis/llm_client.py → ≥ 2 (1 dans le trace, 
  1 dans le RuntimeError message)
- grep -c "lm_studio_inference_stuck" jarvis/nightly_learner.py jarvis/server.py 
  → ≥ 2 (1 dans nightly, 1 dans server /health)
- Test pratique (cf étape 4) : trace contient `inference_stuck` après 
  ≤ 250s OU mock unit test passe.
- python -m py_compile $(grep -lE "chat_completion" jarvis/*.py) → tous OK 
  (pas de régression syntaxe sur les call sites).

Ne fais PAS :
- N'introduis pas de circuit breaker stateful inter-runs (pour 1 cas/jour, 
  pas de valeur).
- N'ajoute pas de notification email/Slack/push (hors scope).
- Ne refactore pas _sync_call au-delà du bloc except cité.
- Ne supprime pas la branche `if attempt < MAX_RETRIES` existante en aval 
  (les APIConnectionError doivent toujours retry — réseau flake ≠ inference 
  stuck).
- Ne touche pas au cockpit (panel-jarvis.jsx, etc.).
- Ne push pas.

Quand c'est fait : montre-moi le diff complet AVANT git add + une trace 
JSONL d'un test réel ou mock (1 ping OK + 1 ping après saturation/mock). 
git commit avec message "feat(jarvis): detect LM Studio inference_stuck 
(VRAM-saturated), abort fast with state.degraded".
PAS de push.
```
