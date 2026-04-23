# K1 — Hygiène workflow : kill orphelins racine + flush stale pending + MàJ INDEX.md

> Audit source : [2026-04-20-audit.md](../../2026-04-20-audit.md)
> Effort estimé : XS (<15 min)
> North Star : Jarvis doit revivre — ne pas laisser le repo mentir sur son état pendant la relance.

---

```
Contexte projet : 3 nettoyages mineurs post-migration React :
(A) 3 fichiers orphelins racine (audit-lm-studio-jarvis.md, prompt-fix-jarvis.md, "nul)")
(B) 1 prompt stale dans jarvis/upgrades/prompts/pending/ (2026-04-11v3-S2, shippé bd6d169 mais pas déplacé)
(C) INDEX.md ment : v10-S1/S2/K1 marqués "proposed" depuis 6 jours sans exécution

Phase 0 — Reconnaissance (OBLIGATOIRE)
Avant toute action :
- ls -la audit-lm-studio-jarvis.md prompt-fix-jarvis.md "nul)" AUDIT_LLM_CONFIG.md
- grep -rn "audit-lm-studio-jarvis\|prompt-fix-jarvis" . --exclude-dir=jarvis_data --exclude-dir=.git
- ls jarvis/upgrades/prompts/pending/
- git log --oneline --all -- jarvis/upgrades/prompts/done/2026-04-11v3-S2-cleanup-residuel-v3.md | head -3
  (vérifier qu'un doublon n'existe PAS déjà dans done/)
- grep -n "2026-04-14" jarvis/upgrades/INDEX.md
  (lire les 3 lignes v10 à modifier)
Écris un rapport court et ATTENDS validation.

Objectif : Trois nettoyages atomiques en un seul commit.

Étapes (après validation de la Phase 0) :

1. Supprimer les 3 fichiers orphelins racine :
   - rm audit-lm-studio-jarvis.md
   - rm prompt-fix-jarvis.md
   - rm "nul)"  (si resist: rm -- "nul)" ou rm ./"nul)")
   NE PAS supprimer AUDIT_LLM_CONFIG.md, README.md, CLAUDE.md.

2. Déplacer le prompt stale :
   - mv jarvis/upgrades/prompts/pending/2026-04-11v3-S2-cleanup-residuel-v3.md \
        jarvis/upgrades/prompts/done/
   - Vérifier qu'il n'y a pas de collision avec un fichier existant dans done/

3. Mettre à jour jarvis/upgrades/INDEX.md :
   - Lignes 74-76 (v10 items 2026-04-14 | S1/S2/K1) : 
     Laisser "proposed" pour S1 (re-promu en v11-S2) 
     ET S2 et K1 (fusionnés dans ce KILL) :
       - Pour S2 (orphelins) : statut "shipped", feedback "v11-K1 a fini le travail"
       - Pour K1 (update INDEX v9-S2) : statut "shipped", feedback "v11-K1 inclut la MàJ"
   - Mettre à jour le bloc Stats en bas du fichier :
     - SHIP shippés : +0 (aucun SHIP exécuté cet audit — c'est un KILL)
     - KILL shippés : +1 (v11-K1)
     - Ajouter les lignes v11 :
       | 2026-04-20 | S1 | Smoke-test /chat post-React | SHIP | S | proposed | Nouveau |
       | 2026-04-20 | S2 | Préflight LM Studio (re-promu v10-S1) | SHIP | XS | proposed | Prompt inchangé dans pending/ |
       | 2026-04-20 | K1 | Hygiène workflow (orphelins+pending+INDEX) | KILL | XS | shipped | Ce commit |

4. Mettre à jour jarvis/upgrades/prompts/README.md :
   Refléter uniquement les fichiers RÉELLEMENT dans pending/ après les déplacements.
   À ce stade doivent rester : 
     - 2026-04-14-S1-preflight-lm-studio.md (re-promu v11-S2)
     - 2026-04-14-S2-kill-orphan-root-files.md (SUPERSEDED par ce KILL — le supprimer aussi)
     - 2026-04-14-K1-update-index-v9-s2.md (SUPERSEDED par ce KILL — le supprimer aussi)
     - 2026-04-20-S1-smoke-test-chat.md (nouveau, créé par Cowork)
   Après nettoyage : déplacer S2-orphans et K1-update vers done/ (l'intention est accomplie).

Contraintes :
- Ne supprime AUCUN fichier racine en dehors des 3 listés
- Ne modifie AUCUNE ligne d'INDEX.md hors des 3 lignes v10 + bloc Stats + ajout v11
- Ne touche pas à jarvis/, sql/, .github/, cockpit/
- Utilise git mv plutôt que mv quand c'est un fichier versionné (les prompts pending/done le sont)
- Si un conflit apparaît (fichier existe déjà dans done/), renomme avec suffixe -v2

Validation :
- ls audit-lm-studio-jarvis.md 2>&1 → "No such file"
- ls "nul)" 2>&1 → "No such file"
- ls jarvis/upgrades/prompts/pending/ → ne contient QUE 2026-04-14-S1-preflight-lm-studio.md + 2026-04-20-*.md
- grep "v11-K1" jarvis/upgrades/INDEX.md → présent
- git status → ~8 changements cohérents

Ne fais PAS :
- Ne crée pas de dossier archive/
- Ne regénère pas l'historique dans INDEX.md
- Ne refactore pas les autres audits v9/v10 (hors scope)
- N'ajoute pas de .gitignore sur prompts/

Quand c'est fait : montre-moi git status + un diff condensé d'INDEX.md.
git commit avec message "chore(jarvis): workflow hygiene — kill 3 orphans, flush stale pending, mark v10 items closed".
PAS de push.
```
