# S1 — Extraction nightly : modèle non-thinking dédié

> Audit source : [2026-04-23-audit.md](../../2026-04-23-audit.md)
> Effort estimé : S (~1.5h)
> North Star : Jarvis doit recommencer à APPRENDRE — `extraction_rate` est gelé à 0 depuis le switch Qwen3 4B Thinking 2507.

---

```
Contexte projet : Le nightly learner extrait 0 faits depuis le switch (commit 
e50201c) sur qwen/qwen3-4b-thinking-2507, un modèle Thinking-only qui produit 
toute sa sortie dans <think>…</think>. _strip_thinking() dans llm_client.py 
supprime ces blocks → sortie brute 0 chars → "No JSON found". La boucle 
d'apprentissage est morte silencieusement (last_result: "empty_extraction", 
extraction_rate: 0.0). Le chat a été patché côté max_tokens (server.py:251) 
mais pas le nightly.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant d'écrire la moindre ligne, compile ce bilan en ~40 lignes :

1. Lis jarvis/config.py EN ENTIER.
2. Lis jarvis/llm_client.py L1-120.
3. Lis jarvis/nightly_learner.py L1-60 (prompts) puis L159-205 (_llm_extract + 
   extract_from_session).
4. Lis jarvis/server.py L235-255 (le commentaire qui admet le problème Thinking).
5. grep -n "LLM_MODEL\|chat_completion_sync\|chat_completion_async" jarvis/*.py
   (pour voir TOUS les call sites — il faut modifier sans casser le chat).
6. cat jarvis_data/nightly_learner_state.json
7. tail -20 jarvis_data/last_nightly_learner.log
8. tail -10 jarvis_data/llm_traces.jsonl

Puis PRÉSENTE 2 OPTIONS à Jean, avec leurs trade-offs chiffrés :

  OPTION A — Modèle dédié à l'extraction (propre, recommandé)
    - Ajouter EXTRACTION_MODEL dans config.py, défaut 'qwen/qwen3-4b-instruct-2507'
    - Ajouter paramètre `model: str | None = None` à chat_completion_sync/async
      (si None → LLM_MODEL)
    - _llm_extract passe model=EXTRACTION_MODEL
    - Coût : 1 téléchargement LM Studio (~4 Go), 1 config env var, ~30 lignes code
    - Bénéfice : séparation des préoccupations, extraction reprend immédiatement
    - Risque : si Jean ne télécharge pas le modèle, LM Studio renverra 404 → 
      NOUVEAU failure mode. Mitiger en ajoutant un check_lm_studio_ready() ciblé 
      sur EXTRACTION_MODEL au début du nightly (peut être un simple POST 
      /v1/chat/completions à EXTRACTION_MODEL avec max_tokens=5, sortir 
      "llm_unavailable_for_extraction" si KO).
  
  OPTION B — Bump max_tokens nightly à 4096 + garder Thinking (cheap)
    - Changer max_tokens=1024 → 4096 dans nightly_learner.py:172
    - Accepter que le thinking dévore le budget mais laisser assez de place 
      pour que le modèle finisse son raisonnement + émette un JSON après
    - Coût : 1 ligne changée, 0 téléchargement
    - Bénéfice : zero friction install, teste rapidement si c'est juste un 
      problème de budget
    - Risque : même à 4096 tokens, le modèle pourrait ne jamais émettre 
      quoi que ce soit après </think> (comportement documenté des 
      Thinking-only). Si ça ne marche pas, 1h perdue et on revient à A.

Ne code RIEN tant que Jean n'a pas choisi A ou B (ou un hybride).

Objectif : Restaurer extraction_rate > 0 sur le prochain nightly, sans 
régression sur le chat (qui fonctionne actuellement en Thinking).

Fichiers concernés (dépend du choix) :

SI OPTION A :
- jarvis/config.py (création EXTRACTION_MODEL + default)
- jarvis/llm_client.py (param `model` optionnel dans _sync_call, 
  chat_completion_sync, chat_completion_async)
- jarvis/nightly_learner.py (passer model=EXTRACTION_MODEL dans _llm_extract)
- CLAUDE.md (documenter le dual-model setup en 3 lignes, section "Stack 
  technique Jarvis")
- (optionnel) jarvis/daily_brief_generator.py : ce module utilise aussi du 
  LLM structuré — vérifier s'il souffre du même bug. Si oui, même fix.

SI OPTION B :
- jarvis/nightly_learner.py:172 (max_tokens=1024 → 4096)
- rien d'autre

Étapes (après validation de la Phase 0 ET du choix d'option) :

[OPTION A — étapes]

1. Dans jarvis/config.py, ajouter APRÈS LLM_MODEL :
   # Modèle non-thinking pour extraction structurée (Qwen3 4B Thinking 2507
   # produit tout son contenu dans <think>…</think> et ne peut pas être 
   # utilisé pour extraction JSON — cf nightly_learner empty_extraction bug).
   EXTRACTION_MODEL = os.getenv("EXTRACTION_MODEL", "qwen/qwen3-4b-instruct-2507")

2. Dans jarvis/llm_client.py, `_sync_call` :
   Ajouter paramètre `model: str | None = None` → si None, utiliser LLM_MODEL.
   Propager dans chat_completion_sync et chat_completion_async.

3. Dans jarvis/nightly_learner.py, `_llm_extract` ligne ~164 :
   from config import EXTRACTION_MODEL
   raw, _tokens = chat_completion_sync(
       messages=[...],
       max_tokens=1024,
       temperature=0.1,
       model=EXTRACTION_MODEL,  # ← ligne ajoutée
   )

4. Dans jarvis/nightly_learner.py, au début de run() (cherche "[1/5]") :
   Ajouter un préflight léger sur EXTRACTION_MODEL :
   
     from llm_client import chat_completion_sync
     from config import EXTRACTION_MODEL
     try:
         ping, _ = chat_completion_sync(
             messages=[{"role": "user", "content": "ping"}],
             max_tokens=5, temperature=0.0, model=EXTRACTION_MODEL,
         )
     except Exception as e:
         log.error("[0/5] Extraction model %s unavailable: %s", EXTRACTION_MODEL, e)
         state["last_result"] = "extraction_model_unavailable"
         state["last_run"] = datetime.now(tz=timezone.utc).isoformat()
         _save_state(state)
         return {"status": "error", "reason": "extraction_model_unavailable"}
   
   (placer AVANT l'appel existant check_lm_studio())

5. Dans jarvis/server.py, /health : détecter "extraction_model_unavailable" 
   comme degraded (chercher la branche empty_extraction existante ligne ~130, 
   y ajouter le nouvel état).

6. Dans CLAUDE.md, section "Stack technique Jarvis", ajouter 1 ligne après 
   "LLM principal : Qwen3.5 9B Q4_K_M..." :
   - **Extraction JSON** : Qwen3-4B-Instruct-2507 (non-thinking, dédié nightly_learner)

7. Lancer manuellement : `python jarvis/nightly_learner.py --days=1` 
   pour valider. Observer llm_traces.jsonl et last_nightly_learner.log.

[OPTION B — étapes]

1. jarvis/nightly_learner.py:172 — changer max_tokens=1024 → 4096.
2. Lancer manuellement 1 run et OBSERVER si le modèle émet un JSON après </think>. 
   Si toujours 0 chars, basculer vers OPTION A sans commit B.
3. Si succès, commit.

Contraintes (valables pour A et B) :
- NE PAS toucher au prompt SYSTEM du nightly (CONVERSATION_EXTRACTION_PROMPT, 
  ACTIVITY_EXTRACTION_PROMPT) — la cause n'est pas le prompt
- NE PAS refactorer llm_client.py au-delà du strict nécessaire
- NE PAS toucher au chat (mode quick/deep/cloud) — ça fonctionne
- NE PAS modifier _strip_thinking — c'est correct dans son contexte
- Utiliser les helpers existants (sb_post, sb_get) et env vars, pas de 
  hard-coding
- Pas de secret nouveau
- Si l'OPTION A nécessite de télécharger Qwen3-4B-Instruct-2507, STOP et 
  demander à Jean (éviter de freezer LM Studio pendant le download)

Validation :

[OPTION A]
- python -c "from jarvis.config import EXTRACTION_MODEL; print(EXTRACTION_MODEL)" 
  → "qwen/qwen3-4b-instruct-2507"
- python -c "from jarvis.llm_client import chat_completion_sync; \
    out, t = chat_completion_sync([{'role':'user','content':'ping'}], \
    max_tokens=5, model='qwen/qwen3-4b-instruct-2507'); print(out, t)" 
  → non-vide, tokens > 0 (modèle installé)
- python jarvis/nightly_learner.py --days=1 → last_stats.facts + entities > 0 
  dans jarvis_data/nightly_learner_state.json
- tail -5 jarvis_data/llm_traces.jsonl → nouvelles entrées avec 
  "model": "qwen/qwen3-4b-instruct-2507"

[OPTION B]
- grep -n "max_tokens=4096" jarvis/nightly_learner.py → 1 match
- python jarvis/nightly_learner.py --days=1 → extraction_rate > 0
- Si extraction_rate reste à 0.0 → basculer vers A

Ne fais PAS :
- Ne bouge pas les prompts d'extraction (CONVERSATION_EXTRACTION_PROMPT etc.)
- N'ajoute PAS response_format="json_object" (déjà testé et fragile avec 
  Qwen, cf audit 2026-04-11v3)
- N'ajoute PAS de lib Instructor/Outlines (over-engineering, PARK P23)
- Ne supprime PAS le modèle Thinking — le chat en a besoin
- Ne touche pas au cockpit (panel-jarvis etc.)
- Ne pousse pas sur GitHub (git push) — Jean revoit d'abord

Quand c'est fait : montre-moi le diff complet AVANT git add + le résultat 
du run nightly de validation (last_stats.facts et entities).
git commit avec message "fix(jarvis): dedicated non-thinking model for 
nightly extraction (resolves empty_extraction bug)".
PAS de push.
```
