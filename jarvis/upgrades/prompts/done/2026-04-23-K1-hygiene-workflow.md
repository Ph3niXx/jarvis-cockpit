# K1 — Hygiène workflow complète (orphans racine + pending mess + INDEX.md)

> Audit source : [2026-04-23-audit.md](../../2026-04-23-audit.md)
> Effort estimé : XS (~30-45 min)
> North Star : Jarvis doit recommencer à APPRENDRE — K1 parallèle à S1, débloque le workflow pour les prochains audits.

---

```
Contexte projet : 3 nettoyages fusionnés en un seul commit :
(A) 3 orphelins racine (audit-lm-studio-jarvis.md, prompt-fix-jarvis.md, "nul)")
(B) 4 prompts dans pending/ à déplacer vers done/
(C) INDEX.md : statuts v10/v11 honnêtes + lignes v12

Phase 0 — Reconnaissance (OBLIGATOIRE)

Avant toute action :

1. ls -la audit-lm-studio-jarvis.md prompt-fix-jarvis.md "nul)" AUDIT_LLM_CONFIG.md README-jobs-radar.md
   (sanity check — on ne supprime PAS AUDIT_LLM_CONFIG.md ni README-jobs-radar.md, 
   qui sont des références valides)
2. grep -rn "audit-lm-studio-jarvis\|prompt-fix-jarvis" . --exclude-dir=jarvis_data --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.claude
   (confirmer zéro référence)
3. ls jarvis/upgrades/prompts/pending/
4. ls jarvis/upgrades/prompts/done/ | grep -E "2026-04-11v3-S2|2026-04-14-K1|2026-04-14-S2|2026-04-20-S1"
   (vérifier qu'un doublon n'existe PAS déjà dans done/ ; si oui, renommer le pending en v2 avant mv)
5. grep -n "2026-04-14\|2026-04-20" jarvis/upgrades/INDEX.md
   (lire les lignes à modifier)

Écris un rapport ~20 lignes et ATTENDS validation explicite.

Objectif : Un seul commit d'hygiène qui laisse le repo honnête.

Étapes (après validation) :

1. Supprimer les 3 orphelins racine :
   rm audit-lm-studio-jarvis.md
   rm prompt-fix-jarvis.md
   rm -- "nul)"

2. Déplacer les 4 prompts obsolètes/stale vers done/ :
   cd jarvis/upgrades/prompts
   git mv pending/2026-04-11v3-S2-cleanup-residuel-v3.md done/
   git mv pending/2026-04-14-K1-update-index-v9-s2.md done/
   git mv pending/2026-04-14-S2-kill-orphan-root-files.md done/
   git mv pending/2026-04-20-S1-smoke-test-chat.md done/
   git mv pending/2026-04-20-K1-hygiene-workflow.md done/
   (le dernier : v11-K1 est la version écrite du même intent, on le marque fait en le déplaçant)
   
   Si collision dans done/, renommer le source en -v2 avant git mv.
   Restant dans pending/ : UNIQUEMENT 2026-04-14-S1-preflight-lm-studio.md 
   ET les nouveaux fichiers v12 créés par ce même audit (S1 + K1).

3. Mettre à jour jarvis/upgrades/INDEX.md :
   
   Modifier les lignes v10/v11 (2026-04-14 et 2026-04-20) :
     - 2026-04-14 | S1 | Préflight LM Studio → statut reste "proposed" 
       (toujours pertinent, conservé en pending comme filet — retire cependant 
       la note qui dit qu'il est re-promu en v11-S2, puisque v11-S2 n'a jamais 
       été exécuté et que S1-v12 intègre un préflight equivalent pour extraction)
     - 2026-04-14 | S2 | Orphelins racine → "shipped" via K1-v12
     - 2026-04-14 | K1 | Update INDEX v9-S2 → "shipped" via K1-v12
     - 2026-04-20 | S1 | Smoke-test /chat → "deferred" avec note : "Fix 245c5d4 
       a corrigé le contrat sans passer par un smoke-test — valeur d'un filet 
       de régression amoindrie"
     - 2026-04-20 | S2 | Préflight LM Studio re-promu → "deferred" 
       (note : intégré partiellement dans S1-v12 via préflight EXTRACTION_MODEL)
     - 2026-04-20 | K1 | Hygiène workflow → "shipped" via K1-v12
   
   Ajouter les lignes v12 :
     | 2026-04-23 | S1 | Extraction nightly : modèle non-thinking dédié | SHIP | S | proposed | Résout empty_extraction bug (Qwen3 Thinking-only) |
     | 2026-04-23 | K1 | Hygiène workflow (orphans + pending + INDEX) | KILL | XS | shipped | Ce commit |
   
   Ajouter 1 ligne PARK :
     | 2026-04-23 | P26 | Accès télémétrie Supabase depuis sandbox audit | PARK | S | deferred | Quand un 2e audit consécutif manque `usage_events` pour raison env vars |

4. Mettre à jour le bloc Stats en bas d'INDEX.md :
   - Propositions totales : +3 (S1, K1, P26) → 77
   - SHIP proposés en attente : 2 (v10-S1 préflight encore valide + v12-S1)
   - KILL shippés : +1 → 13
   - PARK (différé) : +1 → 26

5. Mettre à jour jarvis/upgrades/prompts/README.md :
   Ne garder QUE les fichiers réellement dans pending/ après les déplacements :
     - 2026-04-14-S1-preflight-lm-studio.md (re-promotion statut — garder en pending)
     - 2026-04-23-S1-extraction-model-nightly.md (créé par ce même audit)
   Réécrire le tableau et la section workflow proprement.

Contraintes :
- Ne supprimer AUCUN fichier racine en dehors des 3 listés (AUDIT_LLM_CONFIG.md 
  et README-jobs-radar.md sont VALIDES)
- Ne modifier AUCUNE ligne d'INDEX.md hors des 6 lignes v10/v11 + bloc Stats + 3 lignes v12
- git mv obligatoire pour tout fichier versionné (pas mv brut)
- Utiliser rm -- "nul)" si le nom résiste (parenthèse Windows)
- Ne touche pas à jarvis/, sql/, .github/, cockpit/, docs/
- Le fichier 2026-04-14-S1-preflight-lm-studio.md RESTE dans pending/ 
  (il est toujours potentiellement utile si LM Studio unload mid-run)

Validation :
- ls audit-lm-studio-jarvis.md prompt-fix-jarvis.md "nul)" 2>&1 | grep "No such" → 3 lignes
- ls jarvis/upgrades/prompts/pending/ → exactement 2 fichiers 
  (2026-04-14-S1-preflight-lm-studio.md + 2026-04-23-S1-extraction-model-nightly.md)
- grep "2026-04-23" jarvis/upgrades/INDEX.md → au moins 3 lignes (S1, K1, P26)
- grep "v11-K1\|v12-K1" jarvis/upgrades/INDEX.md → présent dans feedback
- git status → ~10 changements cohérents

Ne fais PAS :
- Pas d'archive/ folder
- Pas de régénération d'historique INDEX
- Pas de refactor des autres audits
- Ne push pas

Quand c'est fait : git status + diff condensé d'INDEX.md et README.md avant commit.
git commit avec message "chore(jarvis): workflow hygiene — kill 3 orphans, flush 4 stale/obsolete pending, reconcile INDEX.md statuses".
PAS de push.
```
