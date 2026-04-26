# K1 — Supprimer `jarvis_data/nightly_learner.log` (legacy 12-14/04, périmé) + classer le pending stale `2026-04-14-S1-preflight-lm-studio.md`

> Audit source : [2026-04-25-audit.md](../../2026-04-25-audit.md)
> Effort estimé : XS (~5 min)
> North Star : Le diagnostic hebdo de Jarvis doit redevenir fiable — éliminer le bruit de logs périmés.

---

```
Phase 0 — Vérification :
1. wc -l jarvis_data/nightly_learner.log (doit faire ~50 lignes, max 100)
2. tail -3 jarvis_data/nightly_learner.log (doit être daté ≤ 2026-04-14)
3. ls jarvis_data/last_nightly_learner.log (doit exister — c'est le successeur live)
4. ls jarvis/upgrades/prompts/pending/2026-04-14-S1-preflight-lm-studio.md
5. ls jarvis/upgrades/prompts/done/2026-04-14-S1-preflight-lm-studio.md (vérifier 
   qu'il n'y a PAS déjà un fichier homonyme dans done/ — sinon renommer en -v2)

Si OK :
6. rm jarvis_data/nightly_learner.log
7. git mv jarvis/upgrades/prompts/pending/2026-04-14-S1-preflight-lm-studio.md \
        jarvis/upgrades/prompts/done/2026-04-14-S1-preflight-lm-studio.md
8. (si jarvis_data/ est versionné) git rm jarvis_data/nightly_learner.log ; sinon 
   simple rm — vérifier .gitignore : `cat .gitignore | grep jarvis_data`

Note : ce repo gitignore typically `jarvis_data/` (privacy-first). Confirme avec git 
status.

git commit avec message "chore(jarvis): kill stale nightly_learner.log + close stale 
preflight pending (absorbed by v13-S2)".
PAS de push.
```
