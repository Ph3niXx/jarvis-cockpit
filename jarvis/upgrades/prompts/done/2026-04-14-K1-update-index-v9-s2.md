# K1 — Mettre à jour le statut v9-S2 dans INDEX.md + créer P21

> Audit source : [2026-04-14-audit.md](../../2026-04-14-audit.md)
> Effort estimé : XS (<5 min)
> North Star : Nettoyer l'INDEX pour qu'il reflète la réalité (bug 409 persiste malgré prompt en `done/`).

---

```
Phase 0 : Vérifier l'état actuel :
  grep -n "13v2.*S2\|Fix indexer 409" jarvis/upgrades/INDEX.md
  ls jarvis/upgrades/prompts/done/ | grep indexer
  tail -5 jarvis_data/last_indexer.log  (pour confirmer que les 409 persistent)
  
Si la ligne v9-S2 est déjà en statut shipped ou deferred : STOP.

Sinon :
1. Dans jarvis/upgrades/INDEX.md :
   - Modifier la ligne 2026-04-13v2 | S2 | Fix indexer 409 :
     Statut "proposed" → "deferred"
     Feedback "→ Promu en P21 : prompt dans done/ mais commit absent, bug persiste"
   
   - Ajouter une nouvelle ligne P21 :
     | 2026-04-14 | P21 | Fix indexer 409 (on_conflict PostgREST) | PARK | XS | deferred | Reprendre quand >5 erreurs 409/run OR impact sur vecteurs observé |
     
2. Mettre à jour le bloc Stats en bas :
   - SHIP proposés (en attente) : passer à 2 (v10-S1, v10-S2)
   - PARK : +1 (P20 Healthchecks) et +1 (P21 indexer 409) → total à ajuster
   - Note : le prompt 2026-04-13v2-S2 reste dans done/ (artefact workflow à résoudre
     manuellement si ça agace — hors périmètre de ce kill)

Montre-moi le diff avant commit.
git commit avec message "chore(jarvis): mark v9-S2 as deferred + create P21 park entry".
PAS de push.
```
