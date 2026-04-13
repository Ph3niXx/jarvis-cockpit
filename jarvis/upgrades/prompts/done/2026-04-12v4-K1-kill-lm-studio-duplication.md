# K1 — Kill la duplication du check LM Studio

> Audit source : [2026-04-12-audit-v4.md](../../2026-04-12-audit-v4.md)
> Effort estimé : XS (<1h)
> North Star : Réduire la dette de maintenance — chaque modification future du check LM Studio ne doit être faite qu'une seule fois

---

```
Phase 0 : Vérifie la duplication :
  grep -A 15 "LM Studio" jarvis/server.py | head -20
  grep -A 15 "LM Studio" jarvis/nightly_learner.py | head -20
  grep -n "import.*from" jarvis/llm_client.py (vérifier les imports existants)

Si les deux blocs ne sont PAS quasi-identiques, STOP — la duplication n'est plus là.

Sinon :
1. Dans jarvis/llm_client.py, ajouter :
   def check_lm_studio(timeout: float = 5.0) -> str:
       """Check LM Studio availability. Returns 'connected', 'no_model_loaded', or 'unreachable'."""
       try:
           r = requests.get(f"{LM_STUDIO_BASE_URL}/models", timeout=timeout)
           if r.status_code != 200:
               return "unreachable"
           try:
               models = r.json().get("data", [])
               return "connected" if models else "no_model_loaded"
           except (ValueError, KeyError):
               return "connected"
       except Exception:
           return "unreachable"

2. Dans server.py health() : remplacer le bloc LM Studio par un appel à check_lm_studio(timeout=2)
3. Dans nightly_learner.py run() : remplacer le bloc par un appel à check_lm_studio(timeout=5)
4. Ajouter l'import dans les deux fichiers

Validation :
- grep -n "check_lm_studio" jarvis/llm_client.py jarvis/server.py jarvis/nightly_learner.py → 3 fichiers
- python -c "from jarvis.llm_client import check_lm_studio; print('OK')"

Ne fais PAS :
- Ne modifie pas la logique de détection (juste l'extraction)
- Ne touche pas au retry/backoff
- Ne modifie pas les timeouts existants (2s pour health, 5s pour nightly)

Montre-moi le diff avant commit.
git commit avec message "refactor(jarvis): extract shared check_lm_studio helper".
PAS de push.
```
