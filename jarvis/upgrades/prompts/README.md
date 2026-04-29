# Prompts Claude Code en attente

| Fichier | Titre | Effort | Date audit |
|---------|-------|--------|------------|
| [v16-S1](pending/2026-04-28-S1-gitattributes-crlf.md) | `.gitattributes` + renormalize CRLF/LF (tuer 72 modifs whitespace) | XS | 2026-04-28 (v16) |
| [v16-K1](pending/2026-04-28-K1-mark-p31-killed.md) | Marquer P31 (préflight LM Studio général) comme `killed` | XS | 2026-04-28 (v16) |
| [v15-S1](pending/2026-04-27-S1-inference-stuck-tighten.md) | Durcir `inference_stuck` (abort sans `check_lm_studio`) | XS | 2026-04-27 |
| [v15-S2](pending/2026-04-27-S2-signals-on-startup.md) | Coupler `signals.md` au démarrage Jarvis | XS | 2026-04-27 |

**Workflow** : copier-coller le contenu d'un fichier dans Claude Code, exécuter, revoir le diff, commit, puis déplacer le fichier vers `done/`.

**Ordre d'exécution recommandé (v17, 2026-04-28 soir)** :

1. **v16-S1** (`.gitattributes` + renormalize) — verrou structurel. Tant qu'il n'est pas levé, commiter le reste reste psychologiquement coûteux (72 modifs whitespace polluent `git status`).
2. **v16-K1** (annoter P31 killed dans INDEX.md).
3. **v15-S1** (durcir `inference_stuck` — fix le trou observé le 26/04).
4. **v15-S2** (coupler `signals.md` à `start_jarvis.bat` — 5e jour sans signals.md aujourd'hui).

**Engagement audit v17 → v18** : si à la prochaine routine Cowork (mercredi 29/04), `git log` ne montre toujours pas l'exécution d'au moins **v17-K1 + v16-S1**, l'audit v18 ne sera pas produit. La routine se mettra en pause explicite jusqu'à exécution du backlog.
