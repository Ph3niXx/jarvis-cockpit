# S2 — Fix `panel:opps` TypeError sur `w.urgency` (P35 promu)

> Audit source : [2026-04-30-audit.md](../../2026-04-30-audit.md)
> Effort estimé : XS (~30 min)
> North Star : Solder les 2 dernières dettes UX visibles + fermer le cycle v21.

---

```
Contexte projet : `cockpit/panel-opportunities.jsx:130-134` et `196-201`
accèdent `w.urgency` sans optional chaining, alors que `w = opp.window` peut
être null si la table `weekly_opportunities` a une ligne avec `window: null`.
Les sites 322, 378-379, 407-408 du même fichier utilisent déjà `opp.window?.urgency`
— incohérence à corriger pour aligner FlagshipCard et OppCard sur le même
défensivisme.

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, écris un rapport ~25 lignes après ces
vérifications :

1. Lis `cockpit/panel-opportunities.jsx` lignes 125-205 EN ENTIER. Note tous
   les accès non gardés à `w.xxx` (urgency, closes_in, closes_iso, opens).
   Compare avec lignes 320-410 où `?.` est appliqué partout.

2. Vérifie qu'au moins une opportunité en base a réellement `window: null` ou
   `window: undefined` :
   `grep -rn "window\b" jarvis/migrations/*.sql sql/ | grep -i "opportun"`
   puis lis le DDL de `weekly_opportunities`. Si `window` est NOT NULL, le bug
   est théorique et probablement non actif → STOP, retourner verdict "P35
   condition non remplie".

3. Si `window` est NULL-able, regarde si une ligne actuelle peut être null :
   le `gen_random_uuid()` insertion de `weekly_analysis.py` initialise-t-il
   toujours `window` ? Lis le pipeline qui upsert dans cette table :
   `grep -rn "weekly_opportunities" weekly_analysis.py jarvis/ pipelines/` puis
   note le shape. Si certaines opportunités historiques ont `window: null` (ex:
   premier run du pipeline), le bug est actif.

4. Vérifie que les autres accès dans le fichier n'introduisent pas de nouveau
   non-guard :
   `grep -nE "w\.(urgency|closes|opens)" cockpit/panel-opportunities.jsx`
   → produire la liste complète et catégoriser : déjà gardé (?.) vs non gardé.

5. Cherche dans signals.md ou logs récents si l'erreur `panel:opps` apparaît
   réellement cette semaine :
   `grep -n "panel:opps\|panel:opportunities" jarvis/intel/2026-04-29-signals.md`
   → 0 ou faible occurrence = bug théorique, retourner P35 PARK.
   Si > 0 occurrence = bug actif, continuer.

Écris un rapport et ATTENDS ma validation explicite. Le verdict de Phase 0
peut être : (a) "bug actif, fix go", (b) "bug théorique mais incohérence du
fichier mérite d'être alignée pour cohérence interne", (c) "P35 condition non
remplie, retourner PARK".

Objectif : aligner FlagshipCard (lignes 128-192) et OppCard (lignes 195-...)
sur le même défensivisme `?.` que les sites 322+.

Fichiers concernés :
- cockpit/panel-opportunities.jsx (modification, lignes 130-204)

Étapes (après validation Phase 0, et seulement si verdict (a) ou (b)) :
1. Remplacer `const w = opp.window;` (lignes 130 et 196) par
   `const w = opp.window || {};`. Ainsi `w.urgency` redevient `undefined` au
   lieu de planter — tous les `===` comparent à `"closing"`/`"getting_late"` etc.
   et retombent sur `false`, qui est le comportement attendu (defaultcase final).
2. Pour les accès dans le JSX (lignes 165, 167, 176-177) :
   - `{w.closes_in}` → `{w.closes_in || "—"}`
   - `{w.closes_iso ? ... : "pas de deadline"}` reste OK (le test garde la branche).
   - `{URGENCY_LABEL[w.urgency]}` → `{URGENCY_LABEL[w.urgency] || URGENCY_LABEL.right_time}`
   - `{w.opens?.replace("S", "")}` reste OK.
3. Aucun autre changement.

Contraintes :
- Pas de modification du DDL `weekly_opportunities` (RLS, schéma, NOT NULL).
- Pas de modification de `weekly_analysis.py` ni des transformers data-loader.
- Pas de refacto cosmétique ailleurs dans le fichier.
- Backward compat : aucun autre comportement n'est changé.

Validation (lance ces commandes après modification) :
- `grep -nE "w\.(urgency|closes_in|closes_iso|opens)" cockpit/panel-opportunities.jsx | grep -v "\\?\\." | grep -v "||"`
  → ne doit retourner QUE des accès dans des contextes inoffensifs (test
    conditionnel `w.closes_iso ?` ou similaire). Aucun accès "lecture brute"
    sans guard ne doit subsister.
- Demander à Jean : ouvrir le panel Opportunités → aucune erreur console.
  Si une opportunité de test sans `window` est insérée :
  `INSERT INTO weekly_opportunities (week, title, window, ...) VALUES (..., NULL, ...)`,
  le panel affiche "—" / "pas de deadline" sans planter.

Ne fais PAS :
- Ne touche pas au DDL Supabase.
- Ne refacto pas FlagshipCard ou OppCard pour mutualiser leur logique window.
- Ne change pas les fonctions `formatWindow()` (35-39) ni `windowProgress()` (42-48).
- Ne push pas.

Quand c'est fait : montre le diff complet AVANT git add. git commit avec message
`fix(cockpit): panel-opportunities — guards w.urgency sur opp.window null (P35 résolu)`.
PAS de push.
```
