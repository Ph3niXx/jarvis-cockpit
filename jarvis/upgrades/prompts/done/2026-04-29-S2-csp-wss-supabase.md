# S2 — Whitelist `wss://*.supabase.co` dans la CSP `index.html`

> Audit source : [2026-04-29v21-audit.md](../../2026-04-29v21-audit.md)
> Effort estimé : XS (~15 min)
> North Star : solder les 3 dettes d'erreurs visibles (Jarvis Lab Chunks=0, Jobs WebSocket, indexer 409).

---

```
Contexte projet : 11 erreurs `error_shown` `panel:jobs` cette semaine, message
`WebSocket not available: The operation is insecure.`. Cause : `panel-jobs-radar.jsx`
ouvre une souscription Supabase Realtime (`client.channel(...).subscribe()`)
qui tente une connexion `wss://mrmgptqpflzyavdfqwwv.supabase.co/realtime/v1/...`,
mais la CSP `index.html:6` n'autorise que `https://mrmgptqpflzyavdfqwwv.supabase.co`
(scheme HTTP), pas `wss://`. Firefox bloque, erreur remonte au boundary React.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier la CSP, écris un rapport ~15 lignes après ces vérifications :

1. Lis `index.html:6` (la meta CSP). Identifie la directive `connect-src` actuelle.
   Confirme qu'elle contient `https://mrmgptqpflzyavdfqwwv.supabase.co` mais
   PAS `wss://mrmgptqpflzyavdfqwwv.supabase.co`.

2. Vérifie qu'AUCUN autre site code n'utilise une URL WSS différente :
   `grep -rn "wss://\|ws://" cockpit/ index.html`
   → ne doit retourner que les usages indirects via Supabase JS client (qui
   construit l'URL automatiquement à partir de SUPABASE_URL).

3. Vérifie qu'il n'y a qu'UN seul site qui ouvre une souscription :
   `grep -rn "channel\|\.subscribe(" cockpit/`
   → confirme `panel-jobs-radar.jsx:584-602` comme seul site, pas d'autre panel
   à risque.

4. Vérifie aussi la directive `default-src 'self'` : on n'aura pas besoin de
   l'élargir, parce que `connect-src` override `default-src` pour les WebSockets
   en CSP3.

Écris un rapport et ATTENDS ma validation explicite.

Objectif : ajouter `wss://mrmgptqpflzyavdfqwwv.supabase.co` à la directive
`connect-src` de la CSP, et seulement ça.

Fichiers concernés :
- index.html (modification ligne 6, meta CSP)

Étapes (après validation Phase 0) :
1. Modifier la directive `connect-src` pour ajouter
   `wss://mrmgptqpflzyavdfqwwv.supabase.co`. Position : juste après l'entrée
   `https://mrmgptqpflzyavdfqwwv.supabase.co` pour grouper les 2 schemes du
   même hôte.
2. Aucune autre modification de la meta CSP. Pas d'élargissement opportuniste
   à `wss://*.trycloudflare.com` ou autre — uniquement le scheme manquant
   pour Supabase.

Contraintes :
- Pas de nouvelle dépendance.
- Garder les autres directives strictement identiques (default-src, script-src,
  style-src, font-src, img-src, frame-src, object-src, base-uri).
- Pas de retour à la ligne ajouté dans la meta (la CSP courante est sur 1 ligne).

Validation (à exécuter mentalement faute de browser dans la sandbox) :
- `grep -c "wss://mrmgptqpflzyavdfqwwv.supabase.co" index.html` → doit retourner 1.
- `grep -c "https://mrmgptqpflzyavdfqwwv.supabase.co" index.html` → doit
  toujours retourner 1.
- Demander à Jean : ouvrir devtools sur le cockpit déployé, ouvrir le panel
  Jobs Radar, vérifier qu'aucune erreur `WebSocket not available` n'apparaît
  dans la console.

Ne fais PAS :
- Ne touche à AUCUNE autre directive CSP.
- N'introduis pas `'unsafe-eval'` ailleurs ou `'unsafe-inline'` supplémentaire.
- Ne supprime pas l'entrée `https://...supabase.co` (reste utilisée pour les
  appels REST classiques).
- Ne push pas après commit.

Quand c'est fait : montre le diff complet AVANT git add. git commit avec message
`fix(csp): autorise wss://supabase.co (panel jobs realtime)`.
PAS de push.
```
