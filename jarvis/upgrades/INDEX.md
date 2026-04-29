# Jarvis Upgrades — Index

Historique de toutes les propositions de Jarvis Upgrade Scout.

## Légende statuts
- `proposed` : proposée par l'agent, pas encore reviewée
- `accepted` : validée, à coder
- `merged` : implémentée et en prod
- `rejected` : refusée (raison notée)
- `deferred` : intéressante mais pas maintenant
- `killed` : fausse bonne idée, supprimée

## Backlog

| Date | # | Titre | Verdict | Effort | Status | Feedback |
|------|---|-------|---------|--------|--------|----------|
| 2026-04-11 | S1 | Fix scheduler month-boundary | SHIP | XS | shipped | Commit d015e88 |
| 2026-04-11 | S2 | Éliminer double embedding /chat + kill extra_body | SHIP | XS | shipped | Commit a3b14e4. extra_body résiduel dans llm_client → traité par v2-S2 |
| 2026-04-11 | S3 | Unifier Supabase helpers nightly_learner | SHIP | S | shipped | Commit 7c4449a |
| 2026-04-11 | K1 | daily-audit.md racine repo | KILL | XS | shipped | Commit dd0c17e. Fichier réapparu → traité par v2-S2 |
| 2026-04-11 | K2 | extra_body dans test_jarvis.py et test_rag.py | KILL | XS | shipped | Commit 86d537c |
| 2026-04-11 | P1 | Déduplication profile_facts | PARK | S | deferred | Diagnostic S2-v5 en cours pour mesurer le taux réel |
| 2026-04-11 | P2 | Hybrid search BM25 + vector | PARK | M | deferred | 407 chunks, pas encore 500. Attendre. |
| 2026-04-11 | P3 | Dashboard analytics hebdomadaire | PARK | M | deferred | Après traces JSONL 2 semaines + /health stable |
| 2026-04-11 | P4 | Table friction_markers | PARK | S | deferred | Après dashboard |
| 2026-04-11v2 | S1 | Retry + backoff exponentiel dans llm_client | SHIP | S | shipped | Commit 3e4f051 |
| 2026-04-11v2 | S2 | Cleanup résiduel: kill extra_body + daily-audit.md | SHIP | XS | shipped | Commit bd6d169 |
| 2026-04-11v2 | K1 | Prompts pending/ 04-11 → done/ | KILL | XS | shipped | Prompts v1 dans done/ |
| 2026-04-11v2 | P5 | LM Studio 0.4 stateful API / llmster mode | PARK | S | deferred | Après json_object validé en production |
| 2026-04-11v2 | P6 | Reranker cross-encoder (bge-reranker-v2-m3) | PARK | M | deferred | Après hybrid search P2 |
| 2026-04-11v3 | S1 | Renforcer parsing JSON avec response_format json_object | SHIP | XS | shipped | Commit 3ca4d50 |
| 2026-04-11v3 | S2 | Kill daily-audit.md + move prompts v2 → done | SHIP | XS | shipped | Cleanup complet, pending/ vidé |
| 2026-04-11v3 | S3 | Endpoint /health avec métriques nightly_learner | SHIP | S | shipped | Commit 4b76084 |
| 2026-04-11v3 | K1 | daily-audit.md (formalisé, exécution via S2) | KILL | XS | shipped | Supprimé définitivement |
| 2026-04-11v3 | K2 | Prompts v2 dans pending/ (exécution via S2) | KILL | XS | shipped | Déplacés vers done/ |
| 2026-04-11v3 | P7 | Constrained decoding grammar enforcement | PARK | M | deferred | Si taux JSON parse > 5% après validation json_object |
| 2026-04-12 | S1 | Exécuter les 3 prompts v3 (json_object + ménage + /health) | SHIP | S | shipped | Méta-prompt couvrant v3-S1/S2/S3, tous exécutés |
| 2026-04-12 | S2 | Découper chat() server.py (118L → 3 fonctions) | SHIP | S | shipped | Commit 5ebd6a3. chat() = 29L |
| 2026-04-12 | S3 | Tracing JSONL des appels LLM dans llm_client | SHIP | S | shipped | Commit a4cafe0 |
| 2026-04-12 | K1 | Déplacer prompts v2 exécutés vers done/ | KILL | XS | shipped | Tous prompts dans done/ |
| 2026-04-12 | K2 | Signalement run() nightly_learner (163L) | KILL | - | shipped | Signalement formel → P8 |
| 2026-04-12 | P8 | Refactoring nightly_learner.run() (163L) | PARK | M | deferred | Quand un SHIP nécessite de modifier run() |
| 2026-04-12 | P9 | Message compaction (pattern ReMe) | PARK | M | proposed | → Promu en SHIP S1-v6 (condition remplie) |
| 2026-04-12 | P10 | Catégorisation fact_type (personal/task/tool) | PARK | S | deferred | Après dédup facts |
| 2026-04-12 | P11 | Intégrer traces JSONL dans /health | PARK | S | proposed | → Promu en SHIP S1-v5 |
| 2026-04-12v2 | S1 | Intégrer métriques traces JSONL dans /health | SHIP | XS | shipped | Commit ec2e0a8 |
| 2026-04-12v2 | S2 | Diagnostic duplication profile_facts | SHIP | XS | proposed | Diagnostic pour décider si P1 doit monter en SHIP |
| 2026-04-12v2 | K1 | Drop table usecase_maturity (dépréciée) | KILL | XS | shipped | Commit d3d510c |
| 2026-04-12v2 | P12 | Rotation traces JSONL | PARK | XS | deferred | Quand llm_traces.jsonl > 10K lignes |
| 2026-04-12v2 | P13 | Brief vocal Kokoro-82M | PARK | S | deferred | Quand daily_brief_generator stabilisé |
| 2026-04-12v2 | P14 | Streaming SSE pour /chat | PARK | M | deferred | Quand chat utilisé >5 sessions/semaine |
| 2026-04-12v2 | P15 | Jarvis comme MCP server | PARK | M | deferred | Quand MCP pertinent pour workflow Jean |
| 2026-04-12v3 | S1 | Message compaction conversations longues | SHIP | S | proposed | P9 promu — condition chat() refactoré remplie |
| 2026-04-12v3 | S2 | Fix détection modèle LM Studio déchargé | SHIP | XS | proposed | Bug "Model unloaded" observé le 12/04 |
| 2026-04-12v3 | S3 | Ménage pending/ (prompts v2 shippés → done/) | SHIP | XS | proposed | Housekeeping |
| 2026-04-12v3 | K1 | Rotation log nightly_learner (archiver legacy) | KILL | XS | shipped | Exécuté lors du ménage v3 |
| 2026-04-12v3 | P16 | Compaction côté client | PARK | S | deferred | Après validation compaction serveur S1 |
| 2026-04-12v3 | S1 | Message compaction conversations longues | SHIP | S | shipped | Commit 467ab2e |
| 2026-04-12v3 | S2 | Fix détection modèle LM Studio déchargé | SHIP | XS | shipped | Commit d250cc6 |
| 2026-04-12v3 | S3 | Ménage pending/ (prompts v3 shippés → done/) | SHIP | XS | shipped | pending/ vidé |
| 2026-04-12v4 | S1 | Exposer métadonnées compaction dans /chat | SHIP | XS | shipped | Commit 5f6db48 |
| 2026-04-12v4 | S2 | Extraire _get_activity_context() de _build_context() | SHIP | XS | shipped | Commit 15c69e0 |
| 2026-04-12v4 | S3 | Diagnostic facts duplication (re-proposé) | SHIP | XS | parked | (downgraded from ship after rechallenging) → P17 |
| 2026-04-12v4 | K1 | Kill duplication check LM Studio (extract helper) | KILL | XS | shipped | Commit 03de872 |
| 2026-04-12v4 | P17 | Diagnostic facts duplication (fusionné avec P1) | PARK | XS | deferred | Quand facts > 200 OU contradictions observées |
| 2026-04-13 | S1 | Fix regression response_format nightly_learner | SHIP | XS | shipped | Commit 8e5e57a |
| 2026-04-13 | S2 | Ménage pending/ + suppression log archivé | SHIP | XS | shipped | Commit 32e3b91 |
| 2026-04-13 | K1 | Update statuts v4 dans INDEX.md | KILL | XS | shipped | Statuts mis à jour |
| 2026-04-13 | P18 | Nightly_learner honest status (extraction_rate) | PARK | XS | proposed | → Promu en SHIP S1-v9 (condition remplie : S1 shippé) |
| 2026-04-13v2 | S1 | Nightly status honnête (empty_extraction + /health) | SHIP | XS | shipped | Commit 104ec5c |
| 2026-04-13v2 | S2 | Fix indexer 409 (on_conflict PostgREST) | SHIP | XS | deferred | Prompt dans done/ mais commit absent — bug persiste → P21 |
| 2026-04-13v2 | K1 | Kill log cumulatif nightly_learner.log | KILL | XS | shipped | Commit ec6ead8 |
| 2026-04-13v2 | P19 | /health dans le cockpit UI | PARK | S | deferred | Après S1-v10 validé en production (2 runs nightly propres) |
| 2026-04-14 | S1 | Préflight check_lm_studio_ready + état llm_unavailable | SHIP | XS | proposed | Nightly hangs 100% sur APITimeoutError (traces 1108s/call) |
| 2026-04-14 | S2 | Kill 3 fichiers orphelins racine repo (audit-lm-studio, prompt-fix, nul)) | SHIP | XS | shipped | Exécuté via K1-v12 |
| 2026-04-14 | K1 | Update statut v9-S2 dans INDEX.md + créer P21 | KILL | XS | shipped | Intent absorbé par K1-v12 |
| 2026-04-14 | S3 | Healthchecks.io ping sur crons | SHIP | S | parked | (downgraded from ship after rechallenging) → P20 |
| 2026-04-14 | P20 | Healthchecks.io / Uptime Kuma ping sur crons | PARK | S | deferred | Après 2 runs nightly échouant silencieusement malgré S1-v10 |
| 2026-04-14 | P21 | Fix indexer 409 (on_conflict PostgREST) — ex v9-S2 | PARK | XS | deferred | Quand >5 erreurs 409/run OR divergence vecteurs observée |
| 2026-04-14 | P22 | Observer Outlook Graph API (remplacer COM pywin32) | PARK | M | deferred | Quand Outlook desktop observer >2 crashs/semaine OR Jean travaille sans Outlook |
| 2026-04-14 | P23 | Instructor pour extraction structurée (Pydantic) | PARK | M | deferred | Quand S1-v10 stable ET 2e prompt d'extraction échoue de la même façon |
| 2026-04-14 | P24 | Migrer sur Ollama (backend LLM) | PARK | M | deferred | Si P6 reranker se réveille ET LM Studio n'a toujours pas de réranker natif |
| 2026-04-20 | S1 | Smoke-test `/chat` post-migration React | SHIP | S | deferred | Fix 245c5d4 a corrigé le contrat sans passer par un smoke-test — valeur du filet de régression amoindrie |
| 2026-04-20 | S2 | Préflight LM Studio (re-promu v10-S1) | SHIP | XS | deferred | Intégré partiellement dans S1-v12 via préflight EXTRACTION_MODEL |
| 2026-04-20 | K1 | Hygiène workflow (orphelins racine + stale pending + INDEX MàJ) | KILL | XS | shipped | Exécuté via K1-v12 |
| 2026-04-20 | P25 | Audit post-migration React panel-by-panel | PARK | M | deferred | Après smoke test S1 vert ET incident repéré sur un panel précis |
| 2026-04-23 | S1 | Extraction nightly : modèle non-thinking dédié | SHIP | S | shipped | Commit 1e26898. Résout empty_extraction bug (Qwen3 4B Thinking 2507 produit tout dans `<think>`). Nightly du 25/04 : extraction_rate 3.8 (vs 0.0 pendant 6 jours) |
| 2026-04-23 | K1 | Hygiène workflow (orphans + pending + INDEX) | KILL | XS | shipped | Commit 36113b6 |
| 2026-04-23 | P26 | Accès télémétrie Supabase depuis sandbox audit | PARK | S | deferred | Quand un 2e audit consécutif manque `usage_events` pour raison env vars |
| 2026-04-14 | S1 | Préflight `check_lm_studio_ready` + état `llm_unavailable` | SHIP | XS | parked | (downgraded from ship after rechallenging — absorbé par 2026-04-25-S2 mid-run detection) → P31 |
| 2026-04-25 | S1 | Resync `KNOWN_SECTIONS` sur le vrai cockpit React | SHIP | XS | shipped | Commit e1b27bc. Liste resynchronisée — mais a déjà dérivé 3h plus tard (veille-outils ajouté) → motive v14-S2 lint CI |
| 2026-04-25 | S2 | Détection LM Studio model unloaded mid-run (abort fast) | SHIP | S | shipped | Commit f82b959. Branche `model_unloaded_midrun` opérationnelle (vérifié 25/04 13:32). Reste l'autre moitié (inference stuck) → traité par v14-S1 |
| 2026-04-25 | S3 | Bump `project_status.yaml` avec Phase 7 méta-doc | SHIP | XS | parked | (downgraded from ship after rechallenging — pure cosmétique, valeur faible vs S1+S2) → P27 |
| 2026-04-25 | K1 | Kill `nightly_learner.log` legacy + close stale preflight pending | KILL | XS | shipped | Commit dca2849. Log supprimé + v10-S1 preflight déplacé en done/. v13 prompts eux-mêmes restés en pending → traité par v14-K1 |
| 2026-04-25 | P27 | Bump `project_status.yaml` avec Phase 7 méta-doc | PARK | XS | deferred | Quand les 4 lints CI Phase 7 tournent 7j sans warning ni intervention manuelle |
| 2026-04-25 | P28 | Hybrid search BM25 + tsvector + RRF (réveil P2 enrichi par veille 25/04) | PARK | M | deferred | Maintenant que vectors=883 ≥ 500 ET capacité M libre une semaine sans incident urgent |
| 2026-04-25 | P29 | Mem0g graph extension (relations + conflict detector + hybrid retrieval) | PARK | M | deferred | Quand P28 shippé ET ≥ 3 cas de contradiction de faits observés dans `profile_facts` en 1 semaine |
| 2026-04-25 | P30 | Investiguer pourquoi `signals.md` du 25/04 manquant | PARK | XS | deferred | **Condition remplie** (26/04 aussi manquant) — à traiter dès qu'une fenêtre se libère OU qu'un 3e jour rate |
| 2026-04-25 | P31 | Préflight LM Studio général (ex v10-S1, absorbé par v13-S2) | PARK | XS | killed | 2026-04-28 — couverture suffisante via v13-S2 (model_unloaded_midrun) + v14-S1 (inference_stuck) + start_jarvis.bat préchauffé. Si nouveau gap, créer ticket P38 sur preuve. |
| 2026-04-26 | S1 | Détection LM Studio `inference_stuck` (modèle chargé mais inférence bloquée) | SHIP | S | shipped | Commit 34eb5a1. Filet a un trou : `lm_state == "connected"` rate la saturation totale (2/3 cas du 26/04 sont passés en attempts=3 × 1114s) → durci par v15-S1 |
| 2026-04-26 | S2 | Lint CI bloquant `KNOWN_SECTIONS` sync vs `cockpit/app.jsx` | SHIP | XS | shipped | Commit efad1dd. Confirmé en prod : commit 75d4ced 24h plus tard ajoute "evening" suite au catch du lint |
| 2026-04-26 | K1 | Hygiène : 3 prompts v13 pending → done + refresh prompts/README | KILL | XS | shipped | Commit fc4e16d |
| 2026-04-26 | P32 | Cloud fallback dans `nightly_learner._llm_extract` après échec local | PARK | S | deferred | (downgraded from ship after rechallenging — redondant après v14-S1 + v13-S2) Si après 2 semaines avec v14-S1 mergé, ≥ 3 nuits consécutives sans extraction |
| 2026-04-26 | P33 | Fix wiki TypeError sur `e.word_count.toLocaleString` (108 occurrences/sem) | PARK | XS | deferred | (downgraded from ship after rechallenging — bug UX bruyant, hors North Star "silent failures") Prochaine fenêtre UX-focused OR > 200 occurrences/sem |
| 2026-04-26 | P34 | Fix `Chunks: 0` bug dans `status_generator.get_chunks_count()` (Content-Range mal lu) | PARK | XS | deferred | Quand snapshot Jarvis Lab consulté ≥ 3x/sem OR feature dépend de cette métrique |
| 2026-04-27 | S1 | Durcir `inference_stuck` — abort sur 2e `APITimeoutError` sans dépendre de `check_lm_studio()` | SHIP | XS | proposed | v14-S1 a un trou : 2/3 cas du 26/04 ont passé attempts=3 × 1114s parce que `check_lm_studio` retourne "unreachable" sous saturation totale |
| 2026-04-27 | S2 | Coupler `signals.md` au démarrage Jarvis (`run_nightly_after_deps.bat`) | SHIP | XS | proposed | 3 jours consécutifs sans signals.md (25/04, 26/04, 27/04). Aucune automatisation visible dans le repo. Bypass de Task Scheduler |
| 2026-04-27 | K1 | Hygiène : 3 prompts v14 pending → done + refresh prompts/README | KILL | XS | proposed | v14-S1/S2/K1 shippés mais traînent dans pending/, README incohérent |
| 2026-04-27 | P35 | Fix `panel:opps` TypeError null.urgency (24 occurrences) | PARK | XS | deferred | Prochaine fenêtre UX-focused (cogroupé avec P33) |
| 2026-04-28 | S1 | `.gitattributes` + renormalize CRLF/LF (tuer 72 modifs whitespace-only) | SHIP | XS | proposed | 95 modifs working tree dont 72 whitespace-only. Pas de .gitattributes à racine. Bloque mécaniquement le commit des audits depuis 3 cycles |
| 2026-04-28 | K1 | Marquer P31 (`Préflight LM Studio général`) comme `killed` | KILL | XS | proposed | Couverture doublement assurée par v13-S2 + v14-S1, condition de réveil obsolète |
| 2026-04-28 | P36 | `audit_commit.sh` + règle CLAUDE.md (auto-commit fin d'audit) | PARK | XS | deferred | (downgraded from ship after rechallenging — red team test 1+4 : un script ne change pas le manque de discipline). Si après v16-S1 mergé et 2 semaines, audits restent non commités, automatiser |
| 2026-04-28v17 | — | 0 SHIP émis (décision défensive : 5 prompts pending non exécutés saturent le débit) | — | — | — | Re-run du soir, 6h après v16. Engagement explicite : pas de v18 si v17-K1 + v16-S1 ne sont pas exécutés d'ici la prochaine routine |
| 2026-04-28v17 | K1 | Ranger 3 prompts v14 shippés `pending/` → `done/` (shell direct, sans Claude Code) | KILL | XS | proposed | v14-K1/S1/S2 (commits fc4e16d, 34eb5a1, efad1dd) traînent dans pending depuis 48h+ parce que v15-K1 lui-même pending. Bypass Claude Code = casse le verrou |
| 2026-04-28v17 | P37 | Auto-commit batch des artefacts Cowork (jarvis audit + design audit + veille claude + ecosystem) | PARK | S | deferred | Découverte v17 : ~22 fichiers untracked générés par 4 routines parallèles. Réveil quand v16-S1 mergé ET pattern persiste 7 jours après hygiène |
| 2026-04-29v18 | — | **PAUSE ROUTINE** — engagement v17 honoré : 0 commit en 72h, 9 prompts pending non exécutés, 81 whitespace modifs persistent. Aucun SHIP / KILL / PARK émis. Reprise v19 dès qu'un commit post-26/04 apparaît. | — | — | — | Action minimale recommandée (15 min Jean, sans Claude Code) : `git mv` 4 prompts redondants v14+v15 → `done/` + edit README. Voir `jarvis/upgrades/2026-04-29-audit.md`. |
| 2026-04-29v19 | — | **PAUSE CONFIRMÉE** — 2e run du jour, ~11h après v18, conditions strictement identiques. Streak git silence 83h, 9 prompts pending inchangés. Aucun SHIP / KILL / PARK émis. Reprise v20 si ≥1 commit post-26/04 OU ≥1 prompt drainé. | — | — | — | Engagement durci : prochaine exécution sans changement → pas même de notice (no-op plus honnête qu'addendum répété). |

## Stats

- Propositions totales : 97
- SHIP shippés : 30 (v1: 5, v2: 2, v3: 3, v4: 3, v5: 2, v6: 3, v7: 3, v8: 2, v9: 2, v10: 0, v11: 0, v12: 1, v13: 2, v14: 2, v15: 0, v16: 0, v17: 0)
- SHIP proposés (en attente) : 3 (v15-S1 inference_stuck tighten + v15-S2 signals on startup + v16-S1 .gitattributes CRLF)
- SHIP rétrogradés : 7 (v7-S3 → P17, v10-S3 → P20, v10-S1 → P31, v13-S3 → P27, v14-S3 cloud fallback → P32, v14-S4 wiki TypeError → P33, v16-S2 audit_commit → P36) ; v17 = 3 candidats considérés/rétrogradés (C1 → P36, C2 → P37, C3 → P28 reconfirmé) sans nouveau ratio compté car aucun ne relevait du seuil "candidat sérieux à émettre"
- KILL shippés : 15 (v1: 2, v2: 1, v3: 2, v4: 2, v5: 1, v6: 1, v7: 1, v8: 1, v9: 1, v12: 1, v13: 1, v14: 1)
- KILL proposés : 3 (v15-K1 hygiène v14 prompts + v16-K1 P31 killed + v17-K1 shell archive v14)
- PARK (différé) : 36 (P37 ajouté ; P31 toujours en `deferred` jusqu'à exécution v16-K1)
- Taux d'exécution v1→v9 : 96% (25/26 shippés)
- Taux d'exécution v13 : 3/3 shippés (100%) — meilleur sprint depuis v9
- Taux d'exécution v14 : 3/3 shippés (100%) — niveau v13 maintenu
- Taux d'exécution v15 : 0/3 shippés (0%) — cause structurelle (working tree pollué) → adressée par v16-S1, lui-même non exécuté
- Taux d'exécution v16 : 0/2 shippés (0%) — 2e sprint consécutif à 0%
- Taux d'exécution v17 : 0 SHIP émis par décision défensive — 1 KILL émis (v17-K1)
- Taux d'exécution v18 : **PAUSE ROUTINE** — engagement v17 honoré (0 commit en 72h), aucune émission
- Taux d'exécution v19 : **PAUSE CONFIRMÉE** — 2e run du jour identique, aucune émission
- Taux de rechallenging (rétrogradations) : 18.9% (7/37 shippés ou émis) — v17/v18/v19 ne comptent pas dans la cible (pas de SHIP émis)
- **Streak git silence** : 83h depuis dernier commit `75d4ced` (2026-04-26 23:29) — record 2026 prolongé (+11h vs v18, +35h vs v17)
