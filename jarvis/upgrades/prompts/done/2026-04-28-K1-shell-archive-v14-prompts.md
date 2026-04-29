# K1 — Ranger les 3 prompts v14 (`2026-04-26-{S1,S2,K1}*.md`) `pending/` → `done/`

> Audit source : [2026-04-28-audit.md](../../2026-04-28-audit.md) (v17, re-run du soir)
> Effort estimé : XS (~2 minutes, shell direct, pas besoin de Claude Code)
> North Star : Drainer la file de 5 prompts pending — bypass Claude Code via shell direct sur le housekeeping pur.

---

```
Phase 0 — Vérification (3 commandes, lit-only) :

1. ls jarvis/upgrades/prompts/pending/ | sort
   → doit lister EXACTEMENT (parmi d'autres) ces 3 fichiers v14 :
     2026-04-26-K1-hygiene-v13-prompts.md
     2026-04-26-S1-inference-stuck-detection.md
     2026-04-26-S2-lint-known-sections.md

2. git log --oneline | grep -E "(34eb5a1|efad1dd|fc4e16d)"
   → doit retourner les 3 commits :
     34eb5a1 feat(jarvis): detect LM Studio inference_stuck (...)
     efad1dd ci(audit): lint bloquant KNOWN_SECTIONS sync (...)
     fc4e16d chore(jarvis): hygiène — v13 prompts pending → done (...)

3. ls jarvis/upgrades/prompts/done/ | grep "2026-04-26"
   → doit retourner 0 ligne (aucun homonyme à écraser).

Si OK :

4. git mv jarvis/upgrades/prompts/pending/2026-04-26-K1-hygiene-v13-prompts.md \
        jarvis/upgrades/prompts/done/2026-04-26-K1-hygiene-v13-prompts.md
   git mv jarvis/upgrades/prompts/pending/2026-04-26-S1-inference-stuck-detection.md \
        jarvis/upgrades/prompts/done/2026-04-26-S1-inference-stuck-detection.md
   git mv jarvis/upgrades/prompts/pending/2026-04-26-S2-lint-known-sections.md \
        jarvis/upgrades/prompts/done/2026-04-26-S2-lint-known-sections.md

5. Édite jarvis/upgrades/prompts/README.md :
   - Retire les 3 lignes du tableau qui pointent vers
     pending/2026-04-26-{K1,S1,S2}-*.md.
   - Conserve les 5 lignes restantes (v15-S1, v15-S2, v15-K1, v16-S1, v16-K1).
   - Garde le bloc "Workflow" intact.

6. git status --short jarvis/upgrades/prompts/
   → vérifie que le diff montre 3 renames (R) + 1 modification (M README.md).

7. git commit -m "chore(jarvis): hygiène — v14 prompts pending → done (rattrapage v15-K1 non exécuté)"

PAS de push. Affiche `git status` final pour confirmer.
```
