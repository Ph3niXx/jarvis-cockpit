# K1 — Supprimer `cockpit/data-jobs.js` (773 lignes de mock data datée du 20/04)

> Audit source : [2026-04-29v21-audit.md](../../2026-04-29v21-audit.md)
> Effort estimé : XS (~15 min)
> North Star : solder les 3 dettes d'erreurs visibles ; bonus housekeeping cohérent.

---

```
Phase 0 :
1. Confirme que `cockpit/data-jobs.js` est bien chargé par `index.html` :
   `grep -n "data-jobs" index.html`
   → doit retourner UNE ligne (~82).
2. Confirme les sites de référence à `JOBS_DATA` :
   `grep -rn "JOBS_DATA" cockpit/`
   → doit retourner les 6 occurrences attendues (data-loader.js:4643-4647 +
     panel-jobs-radar.jsx).
3. Vérifie que `cockpit/lib/data-loader.js` peut tourner si `window.JOBS_DATA`
   est `undefined` au démarrage (i.e. le fichier mock n'est plus chargé).
   Lis lignes 4640-4670 et confirme la garde
   `if (window.JOBS_DATA && (allJobs?.length || todayScan)) {...}` —
   noter que le mock ne sert qu'à hydrater `_raw`, donc retirer le mock
   force le panel à appeler Supabase systématiquement.

Si tout est OK :

4. Supprimer le fichier `cockpit/data-jobs.js`.
5. Retirer la ligne `<script src="cockpit/data-jobs.js?v=1"></script>` de
   `index.html` (vers la ligne 82).
6. Modifier `cockpit/lib/data-loader.js:4642-4647` pour gérer le cas
   `window.JOBS_DATA` indéfini : initialiser un objet vide
   `window.JOBS_DATA = window.JOBS_DATA || {}` AVANT l'assignation. Sinon,
   tester l'égalité préalable.
7. `git add -A && git commit -m "chore(cockpit): kill data-jobs.js mock (773L
   datées, fallback hors usage réel)"`.

Validation :
- `grep -c "data-jobs" index.html` → 0.
- Ouvrir le panel Jobs Radar dans le cockpit déployé → afficher les vraies
  offres Supabase, ou un état vide propre si la table est vide. Aucune erreur
  console.

Ne fais PAS :
- Ne supprime pas `jarvis/seed/jobs_radar_mock.sql` (utilisable comme fixture).
- Ne touche pas à `panel-jobs-radar.jsx` au-delà du strict nécessaire.
- Ne push pas.

Affiche le diff complet AVANT git add.
```
