# K1 — Hygiène : déplacer les 3 prompts v13 `pending/` → `done/` + actualiser `prompts/README.md`

> Audit source : [2026-04-26-audit.md](../../2026-04-26-audit.md)
> Effort estimé : XS (~5 min)
> North Star : (housekeeping — sert la fluidité du workflow d'exécution des prompts)

---

```
Phase 0 — Vérification :
1. ls jarvis/upgrades/prompts/pending/ → tu dois voir exactement 3 fichiers : 
   2026-04-25-K1-kill-stale-log-and-pending.md
   2026-04-25-S1-resync-known-sections.md
   2026-04-25-S2-lm-studio-unload-detection.md
2. git log --oneline --grep="resync KNOWN_SECTIONS" 
   → doit trouver e1b27bc.
3. git log --oneline --grep="model unload" 
   → doit trouver f82b959.
4. git log --oneline --grep="kill stale nightly_learner" 
   → doit trouver dca2849.
5. ls jarvis/upgrades/prompts/done/ | grep "2026-04-25" 
   → vérifier qu'aucun homonyme n'existe avant déplacement (sinon renommer 
   les nouveaux en -v2.md).

Si OK :
6. git mv jarvis/upgrades/prompts/pending/2026-04-25-K1-kill-stale-log-and-pending.md \
        jarvis/upgrades/prompts/done/2026-04-25-K1-kill-stale-log-and-pending.md
7. git mv jarvis/upgrades/prompts/pending/2026-04-25-S1-resync-known-sections.md \
        jarvis/upgrades/prompts/done/2026-04-25-S1-resync-known-sections.md
8. git mv jarvis/upgrades/prompts/pending/2026-04-25-S2-lm-studio-unload-detection.md \
        jarvis/upgrades/prompts/done/2026-04-25-S2-lm-studio-unload-detection.md

9. Réécris jarvis/upgrades/prompts/README.md pour refléter le nouvel 
   état (les 3 prompts du 2026-04-26 — S1 inference_stuck + S2 lint 
   KNOWN_SECTIONS + K1 hygiène — créés par l'audit du jour) :
   ```markdown
   # Prompts Claude Code en attente
   
   | Fichier | Titre | Effort | Date audit |
   |---------|-------|--------|------------|
   | [v14-S1](pending/2026-04-26-S1-inference-stuck-detection.md) | Détection LM Studio inference_stuck | S | 2026-04-26 |
   | [v14-S2](pending/2026-04-26-S2-lint-known-sections.md) | Lint CI bloquant KNOWN_SECTIONS sync | XS | 2026-04-26 |
   | [v14-K1](pending/2026-04-26-K1-hygiene-v13-prompts.md) | Hygiène : v13 prompts pending → done | XS | 2026-04-26 |
   
   **Workflow** : copier-coller le contenu d'un fichier dans Claude Code, 
   exécuter, revoir le diff, commit, puis déplacer le fichier vers `done/`. 
   Pour cette itération, exécuter K1 EN PREMIER (5 min, range les v13) 
   pour ne pas mélanger les états.
   ```

git commit avec message "chore(jarvis): hygiène — v13 prompts pending → done 
+ refresh prompts README".
PAS de push.
```
