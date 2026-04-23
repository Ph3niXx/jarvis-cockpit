# Prompts Claude Code en attente

| Fichier | Titre | Effort | Date audit |
|---------|-------|--------|------------|
| [v10-S1](pending/2026-04-14-S1-preflight-lm-studio.md) | Préflight `check_lm_studio_ready` + état `llm_unavailable` | XS | 2026-04-14 |

**Statut** : maintenu en pending comme filet de sécurité mid-run (LM Studio auto-unload inattendu). Si LM Studio ne crashe pas dans les 2 prochains runs nightly, downgrader vers P-series.

**Workflow** : copier-coller le contenu d'un fichier dans Claude Code, exécuter, revoir le diff, commit, puis déplacer le fichier vers `done/`.
