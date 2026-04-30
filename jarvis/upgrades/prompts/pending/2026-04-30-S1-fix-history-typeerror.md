# S1 — Fix `panel:history` TypeError sur `t.total_articles.toLocaleString`

> Audit source : [2026-04-30-audit.md](../../2026-04-30-audit.md)
> Effort estimé : XS (~30 min)
> North Star : Solder les 2 dernières dettes UX visibles + fermer le cycle v21.

---

```
Contexte projet : 8 erreurs `error_shown panel:history` cette semaine
(2e pattern d'erreur UI). Message :
`TypeError: Cannot read properties of undefined (reading 'toLocaleString')`.
Cause : `cockpit/panel-history.jsx:444,449` accède `t.total_articles.toLocaleString`
et `t.total_jarvis_calls.toLocaleString` sans guard, alors que `t = hist.totals`
peut avoir ces champs `undefined` quand `cockpit/lib/data-loader.js:4623-4628`
ne mute pas `HISTORY_DATA.totals` (cas où la requête `articles` retourne 0 lignes).

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de modifier quoi que ce soit, écris un rapport ~25 lignes après ces
vérifications :

1. Lis `cockpit/panel-history.jsx` lignes 420-465 EN ENTIER. Confirme :
   (a) ligne 426 `const t = hist.totals;` et que `hist = window.HISTORY_DATA;` ligne 356,
   (b) toutes les occurrences de `t.xxx.toLocaleString` (au moins lignes 444, 449),
   (c) tout autre accès non gardé sur `t.xxx.yyy` (`t.peak_day.short_label`,
       `t.peak_day.articles`, `t.streak_days`, `t.total_actions`).

2. Lis `cockpit/lib/data-loader.js:4615-4630`. Confirme la garde
   `if (window.HISTORY_DATA && arts60.length)` — donc si la table `articles`
   est vide ou que la requête échoue, `HISTORY_DATA.totals` garde la valeur
   initiale du fallback `cockpit/data-history.js`.

3. Lis `cockpit/data-history.js:175-205`. Note le shape exact du fallback :
   `total_articles`, `total_jarvis_calls`, `total_actions`, `streak_days`,
   `peak_day` doivent y être. Vérifie qu'ils existent tous.

4. Trace l'ordre de chargement Tier 1 → Tier 2 :
   `grep -n "data-history\|HISTORY_DATA" cockpit/lib/data-loader.js cockpit/lib/bootstrap.js index.html`
   → identifie quand `data-history.js` est chargé vs quand `loadPanel("history")`
   est appelé. Hypothèse à confirmer : si `loadPanel` mute partiellement (ex:
   `days` mis à jour mais pas `totals` parce que Promise.all interrompue), on
   se retrouve avec un état incohérent.

5. Confirme côté code que les 4 occurrences hors `toLocaleString` aussi accèdent
   sans guard : ligne 454 `t.peak_day.short_label`, 455 `t.peak_day.articles`.
   `t.peak_day` peut être null/undefined si `days = []`.

Écris un rapport et ATTENDS ma validation explicite.

Objectif : panel Historique cesse d'émettre `error_shown panel:history` quand
`HISTORY_DATA.totals` a un champ `undefined`. Approche défensive en aval (guards
au point de consommation), pas refonte amont.

Fichiers concernés :
- cockpit/panel-history.jsx (modification, lignes 426-461)

Étapes (après validation Phase 0) :
1. Remplacer `const t = hist.totals;` par
   `const t = hist?.totals || {};` ligne 426.
2. Pour chaque accès `t.xxx.toLocaleString(...)` (lignes 444, 449), entourer
   par `(t.total_articles ?? 0).toLocaleString("fr-FR")` et
   `(t.total_jarvis_calls ?? 0).toLocaleString("fr-FR")`.
3. Pour `t.peak_day.short_label` et `t.peak_day.articles` (lignes 454-455),
   utiliser optional chaining + fallback : `t.peak_day?.short_label || "—"`
   et `t.peak_day?.articles ?? 0`.
4. Pour `t.streak_days` (450) et `t.total_actions` (459), `t.streak_days ?? 0`
   et `t.total_actions ?? 0`.
5. Pour la division ligne 445 `(t.total_articles / hist.days.length)`,
   protéger : `((t.total_articles ?? 0) / Math.max(1, hist?.days?.length || 1)).toFixed(0)`.

Contraintes :
- Aucun changement dans `data-loader.js` ni `data-history.js`. Le fix est
  strictement défensif côté consommateur.
- Pas de nouvelle dépendance, pas de refacto opportuniste hors lignes 426-461.
- Pas de `useState` ajouté ni de side-effect.
- Pas de modification de la structure JSX (DOM identique).

Validation (lance ces commandes après modification) :
- `grep -n "toLocaleString" cockpit/panel-history.jsx` → les 2 occurrences
  doivent maintenant être protégées par `?? 0`.
- `grep -nE "t\.(total_articles|total_jarvis_calls|peak_day|streak_days|total_actions)" cockpit/panel-history.jsx`
  → chaque accès doit être protégé (`?.` ou `??`).
- Demander à Jean : ouvrir le panel Historique dans Firefox, console devtools
  ouverte → aucune erreur `TypeError` ne doit apparaître, même si on simule un
  état dégradé en commentant temporairement la requête `arts60` dans
  data-loader.js.

Ne fais PAS :
- Ne touche pas à `cockpit/lib/data-loader.js` (transformHistory ou la garde
  `arts60.length`) — c'est hors scope ce SHIP.
- Ne refonds pas `HISTORY_DATA` en TypeScript ou avec PropTypes.
- N'ajoute pas un boundary React global — il existe déjà au niveau App.
- Ne push pas après commit.

Quand c'est fait : montre le diff complet AVANT git add. git commit avec message
`fix(cockpit): panel-history — guards défensifs sur totals undefined (P33 résolu)`.
PAS de push.
```
