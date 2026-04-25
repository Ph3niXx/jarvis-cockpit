# Prompts Claude Code en attente

| Fichier | Titre | Effort | Date audit |
|---------|-------|--------|------------|
| [v13-S1](pending/2026-04-25-S1-resync-known-sections.md) | Resync `KNOWN_SECTIONS` sur le vrai cockpit React | XS | 2026-04-25 |
| [v13-S2](pending/2026-04-25-S2-lm-studio-unload-detection.md) | Détection LM Studio `model unloaded` mid-run | S | 2026-04-25 |
| [v13-K1](pending/2026-04-25-K1-kill-stale-log-and-pending.md) | Kill `nightly_learner.log` legacy + close stale preflight pending | XS | 2026-04-25 |
| [v10-S1](pending/2026-04-14-S1-preflight-lm-studio.md) | Préflight `check_lm_studio_ready` + état `llm_unavailable` (absorbé par v13-S2 — sera déplacé par v13-K1) | XS | 2026-04-14 |

**Workflow** : copier-coller le contenu d'un fichier dans Claude Code, exécuter, revoir le diff, commit, puis déplacer le fichier vers `done/`. Pour cette itération, exécuter K1 *en dernier* — il classe automatiquement v10-S1 dans `done/` avec note d'absorption par v13-S2.
