# Jobs Radar — trier en un geste, et « Postuler » qui ne ment plus

Spec de conception, validée en conversation le 2026-09-24. Lots **A** (montrer la
nouveauté) et **B** (capter l'avis en un clic) du diagnostic du même jour. Les
lots C à F (scoring, crédibilité, apprentissage, sourcing) sont hors périmètre.

## Problème

L'utilisateur trouve que les offres ne s'améliorent pas en fit. La mesure lui donne
raison : la part des hot leads (≥ 7, doublons fusionnés) qu'il ouvre est **plate
depuis cinq mois** — 37 % (avril-mai), 23 % (juin-juillet), 34 % (août), 33 %
(septembre) — malgré trois refontes de rubric (ADR-21, ADR-33, ADR-50).

Deux des causes relèvent du front, et ce sont elles que traite cette spec.

**1. L'écran cache la nouveauté.** Le bloc « Hot leads » affiche tout ce qui passe
les filtres à score ≥ 7, trié par score. Avec les filtres par défaut (statut
« Actives » = `new` + `to_apply` + `applied`), il comptait le 2026-09-24
**82 cartes, dont 49 offres déjà « postulées »**. Dans les 12 premières, 10 étaient
déjà postulées et une seule datait de la semaine. D'une visite à l'autre, le haut
de page ne bouge pas.

**2. Le signal n'est pas capté, et ce qui l'est ment.**
- « Postuler sur LinkedIn » (`applyToJob`) est le **seul** moyen d'ouvrir
  l'annonce — `jobs` ne stocke pas la description — et il écrit
  `status = applied`. `applied` veut donc dire « ouvert ». Cinq offres sont à la
  fois `applied` et 👎, dont une offre au lien mort (« le lien ne marche pas »). Or l'étape 7 de la
  routine relit `applied` comme « POSITIFS CONFIRMÉS PAR LES CANDIDATURES ».
- 23 votes 👍/👎 en cinq mois, dont 17 dans les trois semaines qui ont suivi leur
  mise en service, et 2 entre le 7 juin et le 21 septembre. Le recalibrage du
  lundi exige 3 nouveaux votes : il n'a pas tourné depuis le 2026-08-10.
- Depuis juin, l'utilisateur n'archive plus après lecture (0 event `archived` de
  juin à août) : rien ne distingue une offre lue et écartée d'une offre ignorée.
- `interview`, `rejected` et `ghosted` existent en base depuis `sql/030`, mais
  aucun bouton ne les écrit : 0 ligne. Le système ne voit aucun retour de
  candidature.

## Objectif

Chaque visite montre ce qui est nouveau et demande une décision ; chaque décision
tient en un geste et écrit un signal exploitable.

Critères de succès :
- La zone du haut ne contient que des offres **à décider**, entrées depuis moins
  de 7 jours (8 cartes au lieu de 82 sur les données du 2026-09-24).
- À partir de la mise en prod, `applied` signifie « candidature envoyée » et
  l'ouverture de l'annonce se lit dans la télémétrie.
- **Sonde de valeur**, mesurée quatre semaines après la mise en prod : part des
  hot leads entrés dans la fenêtre de 7 jours qui reçoivent une décision
  (postulé, pas pour moi, snooze, lien mort, clôturée) avant d'en sortir. Point
  de comparaison : environ un tiers de hot leads ouverts aujourd'hui, et aucune
  décision visible après lecture depuis juin. Si la part décidée ne dépasse pas
  ce tiers, le geste unique n'a pas suffi et le problème est ailleurs.

## Décisions tranchées avec l'utilisateur (2026-09-24)

1. **Fenêtre de la zone du haut : 7 jours glissants** — ni « depuis ta dernière
   visite » (vide à la deuxième visite du jour), ni « tout le non-décidé » (liste
   de tâches qui grossit, le mécanisme de culpabilité qui a tué atlas).
2. **Les 52 `applied` historiques** : les candidatures datées (`applied_at` non
   nul, 22 lignes) sont visibles ; les 30 sans date sont repliées ; la correction
   se fait à la main via « Pas candidaté en fait ». **Aucune modification
   automatique des données.**
3. **👍/👎 disparaissent**, remplacés par les actions de tri. « J'ai postulé » est
   le signal positif ; « Pas pour moi » remplace le 👎.
4. **Trois zones** plutôt qu'un simple changement des filtres par défaut.

## Ce que l'utilisateur voit et fait

Ordre de la page inchangé au-dessus de la barre de filtres (en-tête, scan
banner, « Ce que le marché te reproche », calibrage, barre de filtres). En
dessous, trois zones.

### Zone 1 — « À décider · 7 derniers jours »

Remplace « Hot leads · score ≥ 7 ».

- **Contenu** : `score_total ≥ 7`, statut `new` ou `to_apply`, `closed_at` nul,
  `seen_days_ago < 7` (même borne que le filtre fraîcheur « < 7j »). Tri par score
  décroissant, puis de la plus récente à la plus ancienne à score égal.
- **Filtres** : rôle, remote, recherche et filtre « écart de compétence »
  s'appliquent. Statut et fraîcheur **ne s'appliquent pas** : la zone a sa
  propre définition. Comme aujourd'hui, la zone se masque si le filtre de bande
  score vaut « Mid » ou « Low ».
- **Zone vide** : une ligne au lieu d'une disparition silencieuse — « Rien de
  nouveau à trier sur les 7 derniers jours. », ou « Rien à décider avec ces
  filtres. » si l'un des filtres qui s'appliquent à la zone (rôle, remote,
  recherche, écart de compétence) est actif.
- **Pied de carte** : trois actions, puis le menu ⋯.
  - **Lire l'annonce ↗** — ouvre `url` dans un nouvel onglet. Aucune écriture.
    Désactivé si l'offre n'a pas de lien.
  - **J'ai postulé ✓** — la carte quitte la zone 1 et rejoint la zone 2.
  - **Pas pour moi ▾** — ouvre un popover (même famille visuelle que l'ancien
    popover de vote) :
    - un champ libre en tête, optionnel : « préciser (optionnel)… » ;
    - trois raisons, **un clic = décision prise** : *Pas crédible pour moi
      (compétences, domaine)*, *Trop junior*, *Boîte ou secteur* — le texte du
      champ libre, s'il y en a un, est joint à la raison ;
    - `Entrée` dans le champ libre = décision avec le seul texte libre ;
    - séparé des trois autres : *Lien mort / offre fermée* — clôture l'offre,
      **n'est pas un avis** et n'entre pas dans l'apprentissage.
  - **⋯** : Snoozer 7 jours, Éditer les notes, Marquer clôturée (ou Rouvrir).
    **« Archiver » disparaît** : « Pas pour moi » le remplace, et un archivage
    sans raison est un signal perdu.
- **Toast avec « Annuler »** pendant 5 secondes après J'ai postulé, Pas pour moi,
  Lien mort, chaque issue et Pas candidaté en fait. Annuler remet exactement les
  valeurs d'avant le geste. Seul le dernier geste est annulable : un nouveau
  geste remplace le toast précédent.

### Zone 2 — « Tes candidatures »

Nouvelle section, repliable, **repliée par défaut** ; l'état plié/déplié est
mémorisé dans le navigateur (`localStorage`, clé `jr.apps.open.v1`, lectures et
écritures sous `try/catch`).

- **Contenu** : statuts `applied`, `interview`, `rejected`, `ghosted`, que l'offre
  soit clôturée ou non. Ignore tous les filtres de la barre.
- **En-tête** (toujours visible) : compteurs non nuls, par issue, des
  candidatures **datées** — « N en attente · N entretiens · N refus · N sans
  réponse » — puis « · N avant le 17/08 » pour les non datées, toutes issues
  confondues.
- **Dépliée** : les candidatures **datées** (`applied_at` non nul), `interview`
  d'abord, puis `applied`, puis `rejected` et `ghosted` ; à l'intérieur de chaque
  groupe, `applied_at` décroissant.
- **Une ligne** : boîte — titre · « candidaté il y a N j » (ou « relancé il y a
  N j »), puis **[Entretien] [Refus] [Sans réponse]** : l'issue active est
  surlignée, re-cliquer dessus la retire (retour à `applied`).
- **⋯ de ligne** : Relancer (uniquement si `applied` ; comportement actuel :
  ouvre l'annonce et enregistre la relance), Lire l'annonce, Éditer les notes,
  **Pas candidaté en fait**.
- **Les non datées** : repliées sous « Avant le 17/08 · date de candidature
  inconnue (N) », mêmes lignes et mêmes actions, triées comme les datées
  (entretiens d'abord, puis en attente, puis issues closes), puis par
  `first_seen_date` décroissant. Une non datée qui reçoit une issue reste dans ce
  groupe.

### Zone 3 — « Le reste du scan »

La liste dense actuelle, avec trois changements :
- elle **exclut les candidatures** (elles vivent en zone 2) en plus des membres
  de la zone 1 ;
- le filtre statut perd l'option « Candidaté » ; « Actives » devient `new` +
  `to_apply` ; « Tout » couvre tout ce qui n'est pas une candidature. Un filtre
  mémorisé à `applied` est ramené à `active` au chargement ;
- chaque ligne porte les mêmes gestes en icônes (↗ ✓ ✕▾ ⋯). Une ligne archivée
  avec un 👎 (visible via « Tout ») affiche sa raison en étiquette.

### Autour des zones

- **En-tête** : « N à décider · N candidatures en cours · N au total dans le
  radar » (+ clôturées masquées, inchangé). « À décider » = taille de la zone 1
  sans filtre ; « en cours » = candidatures datées en `applied` ou en
  `interview`. La pastille de la barre de filtres « 🔥 N hot » devient
  « 🔥 N à décider ».
- **Actions du jour** (scan banner) : les relances ne portent plus que sur les
  candidatures **datées**. Les lignes « Relancer X — date de candidature
  inconnue » sur des offres d'avril disparaissent.
- **Encart calibrage** : le texte vide qui invite à « noter quelques offres
  👍/👎 » devient « Pas encore assez de retours pour inférer un profil. Chaque
  « Pas pour moi » compte — le radar recalibre le lundi dès 3 nouveaux retours. »

## Écritures en base

**Aucune nouvelle colonne.** Tous les champs existent et sont déjà dans la liste
blanche de `patchJobSupabase`.

| Geste | Écriture `jobs` | Télémétrie |
|---|---|---|
| Lire l'annonce | — | `jobs_action {action:"open", value:<zone>}` — `decide` / `applications` / `list` |
| J'ai postulé | `status=applied`, `applied_at=now` | `jobs_action {action:"status", value:"applied"}` |
| Pas pour moi | `status=archived`, `user_verdict=down`, `user_verdict_reason`, `user_verdict_at=now` | `jobs_feedback {verdict:"down", reason, job_id, score_at_vote}` — **un seul** event par décision |
| Lien mort | `closed_at=now` | `jobs_action {action:"close", value:"dead_link"}` |
| Entretien / Refus / Sans réponse | `status=interview` / `rejected` / `ghosted` ; re-clic → `status=applied` | `jobs_action {action:"status", value:<statut>}` |
| Pas candidaté en fait | `status=archived`, `applied_at=null` | `jobs_action {action:"not_applied"}` |
| Annuler | les valeurs d'avant le geste, sur les seules clés touchées | `jobs_action {action:"undo", value:<geste>}` |

- **Raison** : sérialisée au format actuel de `user_verdict_reason` —
  `raison · raison — texte libre` — que `jrParseReason` relit et que l'étape 7 de
  la routine lit déjà. Codes : `pas crédible`, `trop junior`, `boîte ou secteur`.
  Texte libre seul : ` — texte`, comme les verdicts historiques.
- **Les events des nouveaux gestes partent après confirmation de l'écriture**,
  pas avant : un échec ne laisse plus d'event fantôme. « Lire l'annonce », sans
  écriture, part immédiatement.
- **« Ouvert » vit dans la télémétrie seule.** Pas de colonne `opened_at` : le
  lot E dira s'il en faut une.

## Trigger d'héritage — migration `sql/035_jobs_inherit_outcomes.sql`

`jobs_inherit_user_status` (dernière version : `sql/026`) hérite aujourd'hui
`applied` sans péremption, mais pas `interview`, `rejected` ni `ghosted`. Si la
dédup de la routine rate une republication — elle a dérivé plusieurs fois —, une
offre où l'utilisateur est en entretien reviendrait en `new`.

`CREATE OR REPLACE FUNCTION` sur la même fonction, trois changements :
- la clause `OR status = 'applied'` devient
  `OR status IN ('applied','interview','rejected','ghosted')` ;
- le tri `(status = 'applied') DESC` devient `(status IN (…)) DESC` ;
- le `CASE` qui force `archived` sur une offre clôturée épargne ces quatre
  statuts, comme il épargne `applied` aujourd'hui.

Le trigger lui-même (BEFORE INSERT) ne change pas. Appliquée via le connecteur
MCP (`apply_migration`).

## La routine ne change pas

Aucune modification du prompt ni de `docs/cowork-routines/jobs-radar.md` hors
contrat de données. Effets mécaniques :
- chaque « Pas pour moi » pose `user_verdict_at` et compte donc pour le seuil de
  3 votes du recalibrage du lundi ;
- `applied` redevient fiable pour les offres postulées après la mise en prod ;
- « Lien mort » n'écrit que `closed_at` et n'entre pas dans l'apprentissage.

Une ligne est ajoutée au « Contrat de données » de
`docs/cowork-routines/jobs-radar.md` : à partir de la date de mise en prod,
`applied` = candidature envoyée ; avant, `applied` = annonce ouverte.

## Découpage du code

### `cockpit/lib/jobs-view.js` (nouveau)

Logique pure, sans DOM, React ni `window.JOBS_DATA` — motif de `sante-view.js` :
script classique qui expose `window.jobsView` et `module.exports` pour Node.

- Constantes : `DECIDE_WINDOW_DAYS = 7`, `DECIDE_MIN_SCORE = 7`,
  `APPLICATION_STATUSES`, `OUTCOMES` (statut → libellé), `NOT_FOR_ME_REASONS`
  (code + libellé), `DEAD_LINK_REASON`.
- Prédicats : `isApplication(o)`, `isUndecided(o)`, `isDead(o)` — l'actuel
  `jrIsDead` étendu : une offre clôturée n'est morte que si elle n'est pas une
  candidature —, `inDecideZone(o)`.
- Répartition : `splitApplications(offers)` → `{ dated, undated }` triés comme
  décrit ; `applicationCounts(offers)`.
- Écritures (l'instant `now` est injecté, ISO) : `patchApplied(now)`,
  `patchNotForMe(code, free, now)`, `patchDeadLink(now)`,
  `patchOutcome(offer, outcome)`, `patchNotApplied()`.
- Annulation : `inversePatch(offer, patch)` → mêmes clés que `patch`, valeurs
  lues sur `offer` avant le geste, `null` si absentes.
- Raisons : `composeReason(codes, free)` et `parseReason(raw)`, déplacés depuis
  `jrComposeReason` / `jrParseReason` sans changer le format.

### `cockpit/panel-jobs-radar.jsx`

Rendu seulement.
- Nouveaux : `JrTriageActions` (variantes carte et ligne), `JrNotForMe`
  (popover), `JrApplications` (zone 2) et sa ligne.
- `JrToast` accepte une action `{ label, onClick }` ; il reste 5 s quand elle est
  présente, 2,4 s sinon.
- Retirés : `JrVote`, `VERDICT_REASONS`, l'entrée « Archiver » de
  `JrActionsMenu`, l'option « Candidaté » du filtre statut.
- Une seule mécanique d'écriture pour les nouveaux gestes : état optimiste →
  PATCH → en cas de succès, event + toast avec Annuler ; en cas d'échec,
  réapplication locale de `inversePatch` + toast d'erreur.

### Ailleurs

- `cockpit/lib/data-loader.js` : `transformJobScan` ne retient pour les
  relances que les candidatures `applied` avec `applied_at` non nul.
- `cockpit/styles-jobs-radar.css` : classes `jr-*` des nouveaux éléments.
- `index.html` : `<script src="cockpit/lib/jobs-view.js?v=1">` avant le panel,
  versions du panel et de la feuille de style incrémentées.
- `sql/035_jobs_inherit_outcomes.sql`.

## États & edge cases

- **Échec du PATCH** : le geste est annulé localement, toast « Écriture
  impossible — geste annulé ». Corrige, pour les nouveaux gestes, la limite
  « pas de rollback sur PATCH échoué » listée dans la spec d'onglet.
- **Rafraîchissement temps réel pendant la fenêtre d'annulation** : Annuler
  s'applique par `id` et reste valide après rechargement de la liste.
- **Offre à 7 jours pile** (`seen_days_ago = 7`) : zone 3.
- **`to_apply`** : traité comme non décidé. Le front ne l'écrit toujours pas.
- **Candidature clôturée** : reste en zone 2, jamais masquée.
- **« Pas pour moi » sur une offre déjà 👍** (historique) : le verdict est
  remplacé.
- **Offre `snoozed`** : absente des zones 1 et 2, visible en zone 3 via « Tout ».
- **Candidature non datée qui reçoit une issue** : reste dans le groupe non daté.

## Télémétrie

Aucun nouvel `event_type`. Mises à jour de `docs/telemetry.md` :
- `jobs_action` : nouvelles valeurs `open` (avec la zone), `close`/`dead_link`,
  `not_applied`, `undo` ; statuts `interview` / `rejected` / `ghosted`. **À partir
  de la date de mise en prod**, l'ouverture d'une annonce se lit sur
  `action:"open"` et `status → applied` signifie « candidature envoyée ».
- `jobs_feedback` : un event par décision « Pas pour moi », toujours `down`. Les
  events antérieurs en comptaient un par case cochée, et portaient aussi des
  `up`.
- La sonde de valeur de ce lot, et sa date de lecture.

## Tests

`tests/test_jobs_view.mjs`, écrit **avant** le code (Node, sans DOM, même
harnais que `test_sante_view.mjs`) :
- `inDecideZone` : `seen_days_ago` 0, 6 et 7 ; score 6,9 et 7 ; statuts `new`,
  `to_apply`, `applied`, `archived`, `snoozed` ; offre clôturée ;
- `isApplication` et `isDead` sur les quatre statuts de candidature, clôturés ou
  non ;
- `splitApplications` : séparation datées / non datées et ordre des groupes ;
- chaque `patch*`, et `patchOutcome` qui repasse en `applied` au re-clic ;
- `inversePatch` : valeurs d'avant, `null` pour une clé absente ;
- `composeReason` → `parseReason` aller-retour, et lecture de verdicts
  historiques réels (` — Je ne suis pas ML engineer.`, `scope parfait ·
  secteur`, `trop junior`) ;
- répartition complète : aucune offre dans deux zones à la fois.

Migration 035 vérifiée comme 026, dans une transaction annulée : pour chacun des
trois nouveaux statuts, une republication simulée hérite du statut ; une
republication d'une offre `interview` clôturée reste `interview`.

Avant tout push : les 5 linters bloquants et l'ensemble des tests (commandes de
`CLAUDE.md`).

## Documentation à mettre à jour (même commit que le code)

- `docs/specs/tab-jobs.md` : finalité, parcours, fonctionnalités (zones, tri,
  candidatures — retrait du vote et de « Actions rapides »), structure front,
  table des fonctions, sources back (trigger), états & edge cases, limitations,
  dernière MAJ ; `docs/specs/index.json` : `last_updated`.
- `jarvis/spec.json` : description de l'onglet `jobs` (« hero leads » → les trois
  zones).
- `docs/telemetry.md` : voir ci-dessus.
- `docs/architecture/decisions.md` : **ADR-52** — lire une annonce n'est pas
  postuler ; le tri est un geste ; héritage des issues.
- `docs/architecture/dependencies.yaml` : note du trigger sur la table `jobs`
  (issues héritées).
- `docs/cowork-routines/jobs-radar.md` : la ligne de contrat ci-dessus.
- `sw.js` : via `node scripts/sync-sw.mjs`, jamais à la main.

## Mise en prod et vérification

1. Branche `feat/jobs-radar-triage`, code et docs, linters et tests verts.
2. Migration 035 appliquée via MCP, vérifiée en base.
3. Push sur `main` après **feu vert explicite** : le dépôt est public, pousser
   est une publication.
4. Vérification en prod, dans un onglet dédié du Chrome de l'utilisateur,
   après hard-refresh : zone 1 égale au décompte SQL attendu ; un geste de
   chaque type sur une offre réelle de faible enjeu, relu en base puis annulé ;
   une issue posée puis retirée sur une candidature datée. Les events de test
   sont listés dans le compte rendu pour être exclus des mesures.
5. La mémoire `project-jobs-fit-plat` est mise à jour : à partir de la date de
   mise en prod, la métrique d'ouverture se lit sur `action:"open"`.

## Risques assumés

- **Retirer « Archiver »** force une raison. Si l'utilisateur le vit comme une
  friction, le champ libre et les trois raisons restent à un clic.
- **Le 👍 disparaît** : l'étape 7 perd les raisons positives (« la boîte »,
  « coup de cœur »). Elles étaient quatre en cinq mois et toutes doublées d'une
  candidature.
- **Les 30 candidatures non datées restent des « positifs » pour l'étape 7**
  tant que l'utilisateur ne les corrige pas, et le recalibrage du lundi
  2026-09-28 lira comme candidatures confirmées trois offres pourtant 👎. Ce
  lot ne touche pas la routine : c'est une décision séparée.
- **Une offre non décidée sort de la zone 1 au bout de 7 jours** : voulu (pas de
  file qui grossit). Elle reste en zone 3 jusqu'au vieillissement automatique.

## Hors périmètre

- Toute modification du prompt de la routine, y compris l'exclusion
  « `applied` + 👎 » avant le 2026-09-28.
- Lots C à F : notation déterministe, axe de crédibilité, apprentissage sur tous
  les signaux, sourcing, dédup par similarité ; le plafond 6.9 d'ADR-50.
- Colonne `opened_at`, stockage de la description de l'annonce.
- Raccourcis clavier, vue mobile.
- `jarvis/spec.json` annonce encore un « scan quotidien » alors que la routine
  tourne trois fois par semaine : signalé, non corrigé ici.
