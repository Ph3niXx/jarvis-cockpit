# K1 — Marquer P31 (`Préflight LM Studio général`) comme `killed` dans INDEX.md

> Audit source : [2026-04-28-audit.md](../../2026-04-28-audit.md)
> Effort estimé : XS (~10 min)
> North Star : nettoyer le backlog PARK pour qu'il reflète la réalité — P31 est doublement absorbé par v13-S2 + v14-S1.

---

```
Phase 0 — Vérification :
1. grep -n "P31" jarvis/upgrades/INDEX.md → doit retourner exactement 2 lignes
   (la ligne v14-S1 absorbée → P31, et la ligne P31 PARK).
2. git log --oneline --grep="inference_stuck" → doit trouver 34eb5a1 (v14-S1).
3. ls jarvis_data/llm_traces.jsonl → fichier existe.
4. grep "inference_stuck" jarvis_data/llm_traces.jsonl | wc -l → ≥ 1
   (preuve que la branche existe et fire).

Si OK :
5. Édite jarvis/upgrades/INDEX.md, ligne « P31 — Préflight LM Studio général » :
   - Remplace `PARK | XS | deferred | Si v13-S2 mid-run insuffisant ...`
     par `PARK | XS | killed | 2026-04-28 — couverture suffisante via v13-S2
     (model_unloaded_midrun) + v14-S1 (inference_stuck) + start_jarvis.bat
     préchauffé. Si nouveau gap, créer ticket P38 sur preuve.`

6. Bumpe la stat « PARK (différé) » dans la section Stats : -1 (le compteur
   n'est pas critique, à ajuster si visible).

git commit avec message "chore(jarvis): mark P31 (preflight LM Studio
general) as killed — covered by v13-S2 + v14-S1".
PAS de push.
```
