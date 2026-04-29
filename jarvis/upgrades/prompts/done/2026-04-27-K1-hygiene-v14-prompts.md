# K1 — Hygiène : déplacer les 3 prompts v14 (S1, S2, K1) `pending/` → `done/` + actualiser `prompts/README.md`

> Audit source : [2026-04-27-audit.md](../../2026-04-27-audit.md)
> Effort estimé : XS (~5 min)
> North Star : (a) plus aucun timeout LM Studio à 3 attempts × 1114s, (b) signals.md généré chaque matin

---

```
Phase 0 — Vérification :
1. ls jarvis/upgrades/prompts/pending/ → tu dois voir EXACTEMENT ces 3 fichiers :
   2026-04-26-K1-hygiene-v13-prompts.md
   2026-04-26-S1-inference-stuck-detection.md
   2026-04-26-S2-lint-known-sections.md
2. git log --oneline --grep="inference_stuck" → doit trouver 34eb5a1.
3. git log --oneline --grep="lint bloquant KNOWN_SECTIONS" → doit trouver efad1dd.
4. git log --oneline --grep="hygiène — v13 prompts" → doit trouver fc4e16d.
5. ls jarvis/upgrades/prompts/done/ | grep "2026-04-26" → vérifier qu'aucun
   homonyme n'existe (sinon renommer en -v2.md).

Si OK :
6. git mv jarvis/upgrades/prompts/pending/2026-04-26-K1-hygiene-v13-prompts.md \
        jarvis/upgrades/prompts/done/2026-04-26-K1-hygiene-v13-prompts.md
7. git mv jarvis/upgrades/prompts/pending/2026-04-26-S1-inference-stuck-detection.md \
        jarvis/upgrades/prompts/done/2026-04-26-S1-inference-stuck-detection.md
8. git mv jarvis/upgrades/prompts/pending/2026-04-26-S2-lint-known-sections.md \
        jarvis/upgrades/prompts/done/2026-04-26-S2-lint-known-sections.md

9. Réécris jarvis/upgrades/prompts/README.md pour refléter le nouvel état
   (les 3 prompts du 2026-04-27 — S1 inference_stuck v2 + S2 signals.md +
   K1 hygiène v14 — créés par l'audit du jour) :

   ```markdown
   # Prompts Claude Code en attente

   | Fichier | Titre | Effort | Date audit |
   |---------|-------|--------|------------|
   | [v15-S1](pending/2026-04-27-S1-inference-stuck-tighten.md) | Durcir inference_stuck (abort sans check_lm_studio) | XS | 2026-04-27 |
   | [v15-S2](pending/2026-04-27-S2-signals-on-startup.md) | Coupler signals.md au démarrage Jarvis | XS | 2026-04-27 |
   | [v15-K1](pending/2026-04-27-K1-hygiene-v14-prompts.md) | Hygiène : v14 prompts pending → done | XS | 2026-04-27 |

   **Workflow** : copier-coller le contenu d'un fichier dans Claude Code,
   exécuter, revoir le diff, commit, puis déplacer le fichier vers `done/`.
   Pour cette itération, exécuter K1 EN PREMIER (5 min, range les v14)
   pour ne pas mélanger les états.
   ```

git commit avec message "chore(jarvis): hygiène — v14 prompts pending → done +
refresh prompts README".
PAS de push.
```
