# S1 — Fast-fail du nightly_learner quand LM Studio ne répond pas (préflight)

> Audit source : [2026-04-14-audit.md](../../2026-04-14-audit.md)
> Effort estimé : XS (~30-45 min)
> North Star : Jarvis doit compléter UN run nightly jusqu'au bout et écrire un état honnête.

---

```
Contexte projet : jarvis/llm_client.py contient check_lm_studio() qui ping /v1/models
uniquement. Quand LM Studio auto-unload le modèle de la VRAM, le HTTP répond toujours
200 sur /v1/models mais /v1/chat/completions hang indéfiniment. Résultat :
nightly_learner.py lance son run (7 sessions + 4 jours d'activité), chaque appel
_llm_extract prend ~18 minutes à timeout (3 attempts × 120s SDK + backoffs puis
SDK internal retries), et le process ne termine jamais. L'état nightly n'est pas
écrit depuis le 12/04.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)
Avant de créer/modifier quoi que ce soit :
- Lis jarvis/llm_client.py L24-36 (check_lm_studio actuel)
- Lis jarvis/nightly_learner.py L300-320 approx (début de run() — cherche l'appel à check_lm_studio)
  grep -n "check_lm_studio" jarvis/nightly_learner.py
- Lis jarvis/server.py L117-133 (/health — pour y détecter le nouvel état)
- cat jarvis_data/nightly_learner_state.json (état actuel)
- tail -30 jarvis_data/last_nightly_learner.log (pour voir la trace du hang)
- grep -n "check_lm_studio" jarvis/server.py jarvis/daily_brief_generator.py
  (pour savoir qui d'autre appelle check_lm_studio — on ne va PAS modifier cet appel)
Écris un rapport court et ATTENDS ma validation explicite.

Objectif : Ajouter check_lm_studio_ready() qui teste réellement l'inférence,
et faire fast-fail nightly_learner avec un état "llm_unavailable" si le modèle
n'est pas réellement disponible.

Fichiers concernés :
- jarvis/llm_client.py (ajout d'une fonction)
- jarvis/nightly_learner.py (appel préflight + état)
- jarvis/server.py (détection état dans /health)

Étapes (après validation de la Phase 0) :

1. Dans jarvis/llm_client.py, AJOUTER (sans modifier check_lm_studio existante) :
   def check_lm_studio_ready(timeout: float = 30.0) -> str:
       """Real preflight: POST chat/completions with tiny prompt. 
       Returns 'ready', 'unloaded', or 'unreachable'."""
       # Étape 1 : check /v1/models (rapide)
       base_status = check_lm_studio(timeout=5.0)
       if base_status != "connected":
           return "unreachable"
       # Étape 2 : real inference ping
       try:
           client = OpenAI(base_url=LM_STUDIO_BASE_URL, api_key=LM_STUDIO_API_KEY, timeout=timeout)
           r = client.chat.completions.create(
               model=LLM_MODEL,
               messages=[{"role": "user", "content": "ping"}],
               max_tokens=5,
               temperature=0.0,
           )
           return "ready" if r.choices and r.choices[0].message.content else "unloaded"
       except (APITimeoutError, APIConnectionError):
           return "unloaded"
       except Exception:
           return "unreachable"

2. Dans jarvis/nightly_learner.py, au début de run() (après la bannière) :
   Ajouter un bloc préflight AVANT la boucle des sources :
   
   from llm_client import check_lm_studio_ready
   log.info("[0/5] Préflight LM Studio (inference ping)...")
   ready_status = check_lm_studio_ready(timeout=30.0)
   if ready_status != "ready":
       log.error("  [FAIL] LM Studio non pret pour inference: %s", ready_status)
       state["last_result"] = "llm_unavailable"
       state["last_run"] = datetime.now(tz=timezone.utc).isoformat()
       state["last_stats"] = {
           "sessions": 0, "activity_days": 0, "facts": 0, "entities": 0,
           "extraction_rate": 0.0,
           "reason": f"llm_{ready_status}"
       }
       _save_state(state)
       log.error("Abort : state ecrit avec last_result=llm_unavailable")
       return {"status": "error", "reason": ready_status}
   log.info("  [OK] LM Studio pret pour inference")
   
   (Placer ce bloc juste après _load_state() et avant le premier "[1/5]")

3. Dans jarvis/server.py, dans /health, étendre la détection existante 
   (cherche "empty_extraction" — même endroit) :
   
   if nightly.get("last_result") in ("empty_extraction", "llm_unavailable"):
       result["status"] = "degraded"

4. Vérifier que l'appel existant check_lm_studio() dans nightly_learner.py 
   (cherche "[1/5]") reste EN PLACE — on ajoute le préflight en plus,
   on ne le remplace pas (le [1/5] check est rapide et informatif).

Contraintes :
- Ne PAS modifier check_lm_studio() existante (utilisée ailleurs : server.py, 
  daily_brief_generator.py, batch scripts)
- Ne PAS changer le timeout SDK de 120s dans get_client() — c'est pour /chat
  utilisateur qui peut nécessiter plus
- Ne PAS toucher à _llm_extract ni à _parse_json_response
- Le nouveau `last_result: "llm_unavailable"` est un 4e état valide : 
  "ok", "no_data", "empty_extraction", "llm_unavailable"
- L'import `APITimeoutError, APIConnectionError` est déjà présent dans 
  llm_client.py — à réutiliser
- L'import de `OpenAI` est déjà présent dans llm_client.py — à réutiliser

Validation :
- grep -n "check_lm_studio_ready" jarvis/llm_client.py → 1 définition
- grep -n "check_lm_studio_ready" jarvis/nightly_learner.py → 1 appel dans run()
- grep -n "llm_unavailable" jarvis/server.py → 1 occurrence (dans /health)
- python -c "from jarvis.llm_client import check_lm_studio_ready; print('OK')" → pas d'erreur
- python -c "import jarvis.nightly_learner; print('OK')" → pas d'erreur
- (optionnel si LM Studio tourne) python -c "from jarvis.llm_client import check_lm_studio_ready; print(check_lm_studio_ready())" → "ready"

Ne fais PAS :
- Ne refactore PAS check_lm_studio existante
- N'ajoute PAS de retry dans check_lm_studio_ready (le SDK fait déjà son retry interne)
- Ne touche pas à server.py en dehors de la condition du /health (pas de refactor)
- Ne change pas la logique d'extraction dans nightly_learner
- N'ajoute pas de sleep/wait entre /models et /chat — le client OpenAI est réutilisé

Quand c'est fait : montre-moi le diff complet AVANT git add.
git commit avec message "feat(jarvis): add check_lm_studio_ready preflight + llm_unavailable state".
PAS de push (je le ferai après revue).
```
