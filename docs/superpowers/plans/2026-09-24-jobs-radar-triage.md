# Jobs Radar — tri en un geste · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Séparer « lire l'annonce » de « j'ai postulé », remplacer le vote 👍/👎 par un « Pas pour moi » à un clic, et répartir l'onglet en trois zones (à décider sur 7 jours, candidatures avec issues, reste du scan) pour que chaque visite montre du neuf et que chaque décision écrive un signal exploitable.

**Architecture:** La logique pure (répartition des zones, écriture de chaque geste et son inverse pour « Annuler », sérialisation des raisons) vit dans `cockpit/lib/jobs-view.js`, script classique testé sous Node selon le patron `*-view.js`. Le panel `cockpit/panel-jobs-radar.jsx` ne fait que rendre et câbler les gestes (optimiste → PATCH → event + toast « Annuler », ou inverse local si l'écriture échoue). Une migration étend le trigger d'héritage aux issues de candidature. La routine distante n'est pas touchée.

**Tech Stack:** React 18 + `@babel/standalone` 7.29.0 via CDN (aucun build step), scripts classiques exposant `window.X` (pas d'imports ES modules), Supabase REST + connecteur MCP Supabase (projet `mrmgptqpflzyavdfqwwv`), GitHub Pages de projet sous `/jarvis-cockpit/`. Tests : scripts Node autonomes `tests/test_*.mjs` (ni `package.json` ni framework), plus un smoke de rendu statique `tests/smoke_jobs_panel.mjs` (manuel, hors CI).

**Spec:** `docs/superpowers/specs/2026-09-24-jobs-radar-triage-design.md`

## Global Constraints

- **Fenêtre « À décider » : 7 jours** — `DECIDE_WINDOW_DAYS = 7`, une offre y est si `seen_days_ago < 7` ; score minimal `DECIDE_MIN_SCORE = 7` ; statut `new` ou `to_apply` ; `closed_at` nul.
- **Codes de raison exacts** (lus par l'étape 7 de la routine, ne jamais les reformuler) : `pas crédible`, `trop junior`, `boîte ou secteur`. Format de `user_verdict_reason` inchangé : `raison · raison — texte libre` ; texte libre seul = ` — texte`.
- **Libellés exacts** : « Lire l'annonce », « J'ai postulé », « Pas pour moi », « Lien mort / offre fermée », « Pas crédible pour moi (compétences, domaine) », « Trop junior », « Boîte ou secteur », « Entretien », « Refus », « Sans réponse », « Pas candidaté en fait », « Annuler », « À décider · 7 derniers jours », « Tes candidatures », « Rien de nouveau à trier sur les 7 derniers jours. », « Rien à décider avec ces filtres. », « Avant le 17/08 · date de candidature inconnue (N) ».
- **Toast** : 5 s quand il porte « Annuler », 2,4 s sinon. Seul le dernier geste est annulable.
- **Les events des gestes partent après confirmation de l'écriture.** Échec → inverse réappliqué localement, toast « Écriture impossible — geste annulé », aucun event.
- **Aucune nouvelle colonne**, liste blanche de `patchJobSupabase` inchangée. **Aucune modification automatique des données existantes.**
- **La routine n'est pas modifiée** (ni le prompt live, ni le bloc de prompt de `docs/cowork-routines/jobs-radar.md`).
- **État plié/déplié de « Tes candidatures »** : `localStorage`, clé `jr.apps.open.v1`, valeurs `"1"` / `"0"`, lectures et écritures sous `try/catch`, replié par défaut.
- **Pas d'imports ES modules dans `cockpit/`** : `jobs-view.js` expose `window.jobsView` + `module.exports`. Il va dans `index.html` seulement (jamais dans `mediatheque.html`).
- **Après toute modification de `index.html` ou de `cockpit/**`** : `node scripts/sync-sw.mjs`. Ne jamais éditer `STATIC[]` ou `CACHE` à la main.
- **Règles cardinales, même commit que le code** : `docs/specs/tab-jobs.md` + `last_updated` de `docs/specs/index.json` ; `docs/telemetry.md` pour toute nouvelle valeur d'event ; `docs/architecture/` pour la migration.
- **CI `lint-specs` bloquante** : aucun vocabulaire technique dans `## Fonctionnalités` et `## Parcours utilisateur` de la spec d'onglet (pas de noms de colonnes en `_at`/`_id`, de composants `<X>`, de `window.x`, de `localStorage.x`, de hooks React).
- **Linters Python** : toujours préfixés `PYTHONUTF8=1` (sinon un `UnicodeEncodeError` cp1252 masque le verdict).
- **Dépôt public** : pousser sur `main` est une publication — **feu vert explicite de l'utilisateur** avant tout push.

## Review Focus

- **Écriture refusée** (réseau, RLS) sur un geste : la carte revient exactement à son état d'avant et aucun event ne part → test d'aller-retour `applyPatch` + `inversePatch` (Tâche 1).
- **Filtre « Candidaté » mémorisé par l'ancienne version** dans le navigateur : ramené à « Actives », pas de liste vide ni de puce orpheline → test `normalizeStoredFilters` (Tâche 1) + smoke (Tâche 4).
- **Précision libre contenant « — » ou « · »** : relue intacte par le parseur, donc par la routine → test d'aller-retour `composeReason`/`parseReason` (Tâche 1).
- **« Annuler » juste après un deuxième geste sur la même offre** (postulé, puis entretien) : retour à l'état après le premier geste, pas à l'origine → test (Tâche 1).
- **Lignes incomplètes** (âge ou score manquant, statut nul) : jamais dans « À décider », aucun plantage du rendu → tests `inDecideZone` (Tâche 1) + smoke (Tâche 3).

---

## File Structure

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `cockpit/lib/jobs-view.js` (créé) | Logique pure : zones, écritures des gestes et leurs inverses, raisons, filtres mémorisés, âge d'une candidature | 1 |
| `tests/test_jobs_view.mjs` (créé) | Tests Node du module | 1 |
| `sql/035_jobs_inherit_outcomes.sql` (créé) | Trigger d'héritage étendu aux issues | 2 |
| `docs/architecture/decisions.md` | ADR-52 | 2 |
| `docs/architecture/dependencies.yaml` | Note du trigger sur la table `jobs` | 2 |
| `tests/smoke_jobs_panel.mjs` (créé) | Rendu statique du panel sous Node (manuel, hors CI) | 3, 4 |
| `cockpit/panel-jobs-radar.jsx` | Rendu et câblage des gestes, zones | 3, 4 |
| `cockpit/styles-jobs-radar.css` | Styles `jr-*` des nouveaux éléments ; retrait des styles du vote | 3, 4 |
| `index.html` | Chargement de `jobs-view.js`, versions des assets | 3, 4 |
| `sw.js` | Régénéré par `node scripts/sync-sw.mjs` | 3, 4 |
| `cockpit/lib/data-loader.js` | Relances limitées aux candidatures datées | 4 |
| `docs/specs/tab-jobs.md` + `docs/specs/index.json` | Spec d'onglet | 2, 3, 4 |
| `docs/telemetry.md` | Nouvelles valeurs de `jobs_action` / `jobs_feedback` | 3, 4 |
| `jarvis/spec.json` | Description de l'onglet `jobs` | 4 |
| `docs/cowork-routines/jobs-radar.md` | Une ligne de contrat : sens de `applied` | 4 |

Branche de travail : `feat/jobs-radar-triage` (déjà créée, porte le commit de la spec).

---

### Task 1: Module pur `jobs-view.js` et ses tests

**Files:**
- Create: `cockpit/lib/jobs-view.js`
- Test: `tests/test_jobs_view.mjs`

**Interfaces:**
- Consumes: rien.
- Produces (sur `window.jobsView` et `module.exports`) :
  - constantes `DECIDE_WINDOW_DAYS` (7), `DECIDE_MIN_SCORE` (7), `APPLICATION_STATUSES` (`["applied","interview","rejected","ghosted"]`), `OUTCOMES` (`[{status,label}]` ×3), `NOT_FOR_ME_REASONS` (`[{code,label}]` ×3), `DEAD_LINK_LABEL` (string) ;
  - `isApplication(o) → bool`, `isUndecided(o) → bool`, `isDead(o) → bool`, `inDecideZone(o) → bool`, `byDecide(a, b) → number` (comparateur) ;
  - `splitApplications(offers) → { dated: Offer[], undated: Offer[] }`, `applicationCounts(offers) → { applied, interview, rejected, ghosted, undated }` ;
  - `patchApplied(nowIso)`, `patchNotForMe(code|null, free, nowIso)`, `patchDeadLink(nowIso)`, `patchOutcome(offer, outcomeStatus)`, `patchNotApplied()` → objets patch ;
  - `inversePatch(offer, patch) → patch`, `applyPatch(offers, id, patch) → Offer[]` (non mutant) ;
  - `composeReason(codes[], free) → string|null`, `parseReason(raw) → { reasons: string[], free: string }`, `reasonTag(raw) → string` ;
  - `normalizeStoredFilters(f) → object`, `applicationAgeLabel(offer, nowMs) → string`.
  - « Offer » = la forme produite par `transformJobRow` dans `cockpit/lib/data-loader.js` (`id`, `status`, `score_total`, `seen_days_ago`, `closed_at`, `applied_at`, `last_followup_at`, `first_seen_date`, `user_verdict*`, …).

- [ ] **Step 1: Write the failing test**

Créer `tests/test_jobs_view.mjs` :

```js
// Tests du module de présentation Jobs Radar (JS pur, sans DOM).
// Run: node tests/test_jobs_view.mjs
// Spec : docs/superpowers/specs/2026-09-24-jobs-radar-triage-design.md
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const V = require(join(here, "..", "cockpit", "lib", "jobs-view.js"));

let failures = 0;
function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) { failures++; console.log(`FAIL ${name}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(got)}`); }
  else console.log(`ok   ${name}`);
}

const NOW = "2026-09-24T09:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const offer = (over) => ({ id: "x", status: "new", score_total: 8, seen_days_ago: 1, closed_at: null, applied_at: null, ...over });

// ── inDecideZone : la fenêtre de 7 jours et ses bornes ──────────
check("nouvelle, 8/10, vue hier => à décider", V.inDecideZone(offer({})), true);
check("vue aujourd'hui => à décider", V.inDecideZone(offer({ seen_days_ago: 0 })), true);
check("vue il y a 6 j => à décider", V.inDecideZone(offer({ seen_days_ago: 6 })), true);
check("vue il y a 7 j pile => reste du scan", V.inDecideZone(offer({ seen_days_ago: 7 })), false);
check("score 7 pile => à décider", V.inDecideZone(offer({ score_total: 7 })), true);
check("score 6,9 => reste du scan", V.inDecideZone(offer({ score_total: 6.9 })), false);
check("to_apply => à décider", V.inDecideZone(offer({ status: "to_apply" })), true);
["applied", "interview", "rejected", "ghosted", "archived", "snoozed"].forEach((s) =>
  check(`statut ${s} => jamais à décider`, V.inDecideZone(offer({ status: s })), false));
check("clôturée => jamais à décider", V.inDecideZone(offer({ closed_at: NOW })), false);
// Review focus : lignes incomplètes
check("âge inconnu => pas à décider", V.inDecideZone(offer({ seen_days_ago: undefined })), false);
check("score null => pas à décider", V.inDecideZone(offer({ score_total: null })), false);
check("statut null => pas à décider", V.inDecideZone(offer({ status: null })), false);
check("offre absente => pas à décider", V.inDecideZone(null), false);

// ── isApplication / isDead ──────────────────────────────────────
["applied", "interview", "rejected", "ghosted"].forEach((s) => {
  check(`${s} est une candidature`, V.isApplication(offer({ status: s })), true);
  check(`${s} clôturée reste visible`, V.isDead(offer({ status: s, closed_at: NOW })), false);
});
check("new clôturée => morte", V.isDead(offer({ closed_at: NOW })), true);
check("new non clôturée => vivante", V.isDead(offer({})), false);
check("archived n'est pas une candidature", V.isApplication(offer({ status: "archived" })), false);

// ── byDecide : score décroissant, puis la plus récente ──────────
check("tri à décider",
  [offer({ id: "a", score_total: 8, seen_days_ago: 5 }),
   offer({ id: "b", score_total: 9, seen_days_ago: 6 }),
   offer({ id: "c", score_total: 8, seen_days_ago: 1 })].sort(V.byDecide).map((o) => o.id),
  ["b", "c", "a"]);

// ── splitApplications / applicationCounts ───────────────────────
const apps = [
  offer({ id: "p1", status: "applied",   applied_at: "2026-09-20T10:00:00Z" }),
  offer({ id: "p2", status: "applied",   applied_at: "2026-09-22T10:00:00Z" }),
  offer({ id: "i1", status: "interview", applied_at: "2026-09-01T10:00:00Z" }),
  offer({ id: "r1", status: "rejected",  applied_at: "2026-09-23T10:00:00Z" }),
  offer({ id: "g1", status: "ghosted",   applied_at: "2026-08-20T10:00:00Z" }),
  offer({ id: "u1", status: "applied",   first_seen_date: "2026-05-01" }),
  offer({ id: "u2", status: "interview", first_seen_date: "2026-04-01" }),
  offer({ id: "n1", status: "new" }),
];
const split = V.splitApplications(apps);
check("datées : entretien, puis en attente (récentes d'abord), puis issues closes",
  split.dated.map((o) => o.id), ["i1", "p2", "p1", "r1", "g1"]);
check("non datées : entretien d'abord", split.undated.map((o) => o.id), ["u2", "u1"]);
check("compteurs par issue (datées) + non datées",
  V.applicationCounts(apps), { applied: 2, interview: 1, rejected: 1, ghosted: 1, undated: 2 });

// ── Gestes : écritures exactes ──────────────────────────────────
check("j'ai postulé", V.patchApplied(NOW), { status: "applied", applied_at: NOW });
check("pas pour moi, raison seule", V.patchNotForMe("trop junior", "", NOW),
  { status: "archived", user_verdict: "down", user_verdict_reason: "trop junior", user_verdict_at: NOW });
check("pas pour moi, raison + précision",
  V.patchNotForMe("pas crédible", "pas d'expérience LLM", NOW).user_verdict_reason,
  "pas crédible — pas d'expérience LLM");
check("pas pour moi, texte libre seul", V.patchNotForMe(null, "trop loin", NOW).user_verdict_reason, " — trop loin");
check("lien mort = clôture seule, pas un avis", V.patchDeadLink(NOW), { closed_at: NOW });
check("issue entretien", V.patchOutcome(offer({ status: "applied" }), "interview"), { status: "interview" });
check("re-clic sur l'issue active => retour en attente",
  V.patchOutcome(offer({ status: "interview" }), "interview"), { status: "applied" });
check("pas candidaté en fait", V.patchNotApplied(), { status: "archived", applied_at: null });

// ── inversePatch / applyPatch ───────────────────────────────────
const before = offer({ id: "k", status: "new", user_verdict: null, user_verdict_reason: "", user_verdict_at: null });
const gesture = V.patchNotForMe("trop junior", "", NOW);
const inv = V.inversePatch(before, gesture);
check("inverse = valeurs d'avant", inv,
  { status: "new", user_verdict: null, user_verdict_reason: "", user_verdict_at: null });
check("clé absente => null", V.inversePatch({ id: "k" }, { closed_at: NOW }), { closed_at: null });
// Review focus : écriture refusée => l'offre revient exactement à l'état d'avant
const list0 = [before, offer({ id: "other" })];
const list1 = V.applyPatch(list0, "k", gesture);
const list2 = V.applyPatch(list1, "k", inv);
check("aller-retour geste + inverse", list2, list0);
check("applyPatch ne mute pas l'entrée", list0[0].status, "new");
check("applyPatch ne touche que l'offre visée", list1[1], list0[1]);
// Review focus : annuler le 2e geste ramène à l'état après le 1er, pas à l'origine
const s0 = [offer({ id: "m", status: "new" })];
const s1 = V.applyPatch(s0, "m", V.patchApplied(NOW));
const g2 = V.patchOutcome(s1[0], "interview");
const inv2 = V.inversePatch(s1[0], g2);
check("annuler l'issue garde la candidature", V.applyPatch(V.applyPatch(s1, "m", g2), "m", inv2), s1);
// Rechargement temps réel pendant la fenêtre d'annulation : autre instance, même id
check("inverse appliqué sur une liste rechargée",
  V.applyPatch([{ ...s1[0], status: "interview" }], "m", inv2)[0].status, "applied");

// ── Raisons : format historique, relu par la routine ────────────
check("compose raisons + libre",
  V.composeReason(["trop junior", "boîte ou secteur"], "  bof  "), "trop junior · boîte ou secteur — bof");
check("compose vide => null", V.composeReason([], "  "), null);
check("parse historique : libre seul", V.parseReason(" — Je ne suis pas ML engineer."),
  { reasons: [], free: "Je ne suis pas ML engineer." });
check("parse historique : raisons", V.parseReason("scope parfait · secteur"),
  { reasons: ["scope parfait", "secteur"], free: "" });
check("parse historique : raison simple", V.parseReason("trop junior"), { reasons: ["trop junior"], free: "" });
check("parse null", V.parseReason(null), { reasons: [], free: "" });
// Review focus : séparateurs tapés dans la précision libre
check("libre contenant — et ·, avec raison",
  V.parseReason(V.composeReason(["trop junior"], "a — b · c")), { reasons: ["trop junior"], free: "a — b · c" });
check("libre contenant — et ·, sans raison",
  V.parseReason(V.composeReason([], "a — b · c")), { reasons: [], free: "a — b · c" });
check("étiquette d'une offre écartée", V.reasonTag("trop junior — bof"), "écartée · trop junior");
check("étiquette sans code", V.reasonTag(" — trop loin"), "écartée");

// ── Filtres mémorisés (review focus) ────────────────────────────
check("filtre Candidaté d'une ancienne version => Actives",
  V.normalizeStoredFilters({ statusFilter: "applied", catFilter: "cos" }), { statusFilter: "active", catFilter: "cos" });
check("filtre valide conservé", V.normalizeStoredFilters({ statusFilter: "closed" }), { statusFilter: "closed" });
check("rien de mémorisé", V.normalizeStoredFilters(null), {});

// ── Âge d'une candidature ───────────────────────────────────────
check("candidaté aujourd'hui", V.applicationAgeLabel({ applied_at: "2026-09-24T07:00:00Z" }, NOW_MS), "candidaté aujourd'hui");
check("candidaté hier", V.applicationAgeLabel({ applied_at: "2026-09-23T07:00:00Z" }, NOW_MS), "candidaté hier");
check("candidaté il y a 5 j", V.applicationAgeLabel({ applied_at: "2026-09-19T07:00:00Z" }, NOW_MS), "candidaté il y a 5 j");
check("la relance prime",
  V.applicationAgeLabel({ applied_at: "2026-09-01T07:00:00Z", last_followup_at: "2026-09-22T07:00:00Z" }, NOW_MS),
  "relancé il y a 2 j");
check("non datée", V.applicationAgeLabel({}, NOW_MS), "date de candidature inconnue");

// ── Répartition complète : aucune offre dans deux zones ─────────
const pool = [...apps, offer({ id: "d1" }), offer({ id: "o7", seen_days_ago: 9 }), offer({ id: "z", status: "archived" })];
const zoneOf = (o) => (V.inDecideZone(o) ? "decide" : V.isApplication(o) ? "apps" : "rest");
check("répartition", pool.reduce((acc, o) => { acc[zoneOf(o)] = (acc[zoneOf(o)] || 0) + 1; return acc; }, {}),
  { apps: 7, decide: 2, rest: 2 });
check("à décider et candidature sont exclusifs",
  pool.filter((o) => V.inDecideZone(o) && V.isApplication(o)).length, 0);

if (failures) { console.log(`\n${failures} échec(s)`); process.exit(1); }
console.log("\ntous les tests passent");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_jobs_view.mjs`
Expected: FAIL — `Error: Cannot find module '…/cockpit/lib/jobs-view.js'`.

- [ ] **Step 3: Write minimal implementation**

Créer `cockpit/lib/jobs-view.js` :

```js
// cockpit/lib/jobs-view.js
// Logique pure de l'onglet Jobs Radar : répartition des offres dans les trois
// zones (à décider / tes candidatures / reste du scan), écriture de chaque
// geste de tri et son inverse pour « Annuler », sérialisation des raisons de
// « Pas pour moi ». Spec : docs/superpowers/specs/2026-09-24-jobs-radar-triage-design.md
// Script classique compatible Babel standalone : expose window.jobsView.
// Guard module.exports => testable sous node (tests/test_jobs_view.mjs).
//
// CONTRAINTE : aucune dépendance au DOM, à React ni à window.JOBS_DATA.
(function () {
  // Une offre non décidée sort de « À décider » au bout de 7 jours et rejoint
  // le reste du scan. Pas de file qui grossit : c'est la culpabilité d'un
  // backlog qui a tué atlas.
  const DECIDE_WINDOW_DAYS = 7;
  const DECIDE_MIN_SCORE = 7;

  const APPLICATION_STATUSES = ["applied", "interview", "rejected", "ghosted"];
  const UNDECIDED_STATUSES = ["new", "to_apply"];

  const OUTCOMES = [
    { status: "interview", label: "Entretien" },
    { status: "rejected",  label: "Refus" },
    { status: "ghosted",   label: "Sans réponse" },
  ];

  // Les codes sont stockés tels quels dans user_verdict_reason, que l'étape 7
  // de la routine relit. Ne pas les reformuler sans relire son prompt.
  const NOT_FOR_ME_REASONS = [
    { code: "pas crédible",     label: "Pas crédible pour moi (compétences, domaine)" },
    { code: "trop junior",      label: "Trop junior" },
    { code: "boîte ou secteur", label: "Boîte ou secteur" },
  ];
  const DEAD_LINK_LABEL = "Lien mort / offre fermée";

  // Ce qui appelle une action d'abord : l'entretien, puis l'attente.
  const APPLICATION_ORDER = { interview: 0, applied: 1, rejected: 2, ghosted: 2 };

  function isApplication(o) {
    return !!o && APPLICATION_STATUSES.includes(o.status);
  }
  function isUndecided(o) {
    return !!o && UNDECIDED_STATUSES.includes(o.status);
  }
  // Une offre clôturée est « morte » et masquée — sauf une candidature, qui
  // reste dans le suivi quelle que soit son issue.
  function isDead(o) {
    return !!o && !!o.closed_at && !isApplication(o);
  }
  function inDecideZone(o) {
    if (!isUndecided(o) || o.closed_at) return false;
    const score = Number(o.score_total);
    const age = Number(o.seen_days_ago);
    if (o.score_total == null || !Number.isFinite(score) || !Number.isFinite(age)) return false;
    return score >= DECIDE_MIN_SCORE && age < DECIDE_WINDOW_DAYS;
  }
  function byDecide(a, b) {
    return (Number(b.score_total) - Number(a.score_total)) ||
           (Number(a.seen_days_ago) - Number(b.seen_days_ago));
  }

  function tsOf(v) {
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? t : 0;
  }
  const rankOf = (o) => (o.status in APPLICATION_ORDER ? APPLICATION_ORDER[o.status] : 3);

  // Datées : applied_at est posé par le front depuis le 2026-08-17. Non
  // datées : les candidatures antérieures, pour lesquelles aucune date fiable
  // n'existe (sql/030).
  function splitApplications(offers) {
    const apps = (offers || []).filter(isApplication);
    const dated = apps.filter((o) => !!o.applied_at)
      .sort((a, b) => (rankOf(a) - rankOf(b)) || (tsOf(b.applied_at) - tsOf(a.applied_at)));
    const undated = apps.filter((o) => !o.applied_at)
      .sort((a, b) => (rankOf(a) - rankOf(b)) || (tsOf(b.first_seen_date) - tsOf(a.first_seen_date)));
    return { dated, undated };
  }
  function applicationCounts(offers) {
    const { dated, undated } = splitApplications(offers);
    const c = { applied: 0, interview: 0, rejected: 0, ghosted: 0, undated: undated.length };
    dated.forEach((o) => { c[o.status] += 1; });
    return c;
  }

  // ── Écriture d'un geste (l'instant est injecté : testable) ──
  function patchApplied(now) {
    return { status: "applied", applied_at: now };
  }
  function patchNotForMe(code, free, now) {
    return {
      status: "archived",
      user_verdict: "down",
      user_verdict_reason: composeReason(code ? [code] : [], free),
      user_verdict_at: now,
    };
  }
  // Un lien mort n'est pas un avis : il clôture, il n'entre pas dans
  // l'apprentissage du radar.
  function patchDeadLink(now) {
    return { closed_at: now };
  }
  // Re-cliquer l'issue active la retire : retour à « en attente ».
  function patchOutcome(offer, outcome) {
    return { status: offer && offer.status === outcome ? "applied" : outcome };
  }
  function patchNotApplied() {
    return { status: "archived", applied_at: null };
  }

  // Inverse exact d'un geste : mêmes clés, valeurs lues AVANT le geste.
  function inversePatch(offer, patch) {
    const inv = {};
    Object.keys(patch || {}).forEach((k) => {
      inv[k] = offer && offer[k] !== undefined ? offer[k] : null;
    });
    return inv;
  }
  // Applique un patch à une offre d'un tableau, sans muter l'entrée.
  function applyPatch(offers, id, patch) {
    return (offers || []).map((o) => (o && o.id === id ? { ...o, ...patch } : o));
  }

  // ── Raisons : format historique de user_verdict_reason ──
  //   "raison1 · raison2 [ — texte libre ]". Le premier " — " sépare les
  //   raisons du texte libre ; les raisons sont jointes par " · ".
  function composeReason(codes, free) {
    const f = String(free || "").trim();
    const list = (codes || []).filter(Boolean);
    if (!list.length && !f) return null;
    return list.join(" · ") + (f ? " — " + f : "");
  }
  function parseReason(raw) {
    const s = raw || "";
    const i = s.indexOf(" — ");
    const reasonsPart = i >= 0 ? s.slice(0, i) : s;
    const free = i >= 0 ? s.slice(i + 3) : "";
    const reasons = reasonsPart.trim()
      ? reasonsPart.split(" · ").map((x) => x.trim()).filter(Boolean)
      : [];
    return { reasons, free };
  }
  function reasonTag(raw) {
    const { reasons } = parseReason(raw);
    return reasons.length ? `écartée · ${reasons.join(" · ")}` : "écartée";
  }

  // L'option de filtre « Candidaté » n'existe plus : les candidatures ont
  // leur zone. Un navigateur qui l'a mémorisée repart sur « Actives ».
  function normalizeStoredFilters(f) {
    const out = { ...(f || {}) };
    if (out.statusFilter === "applied") out.statusFilter = "active";
    return out;
  }

  function dayWord(d) {
    if (d === 0) return "aujourd'hui";
    if (d === 1) return "hier";
    return `il y a ${d} j`;
  }
  function daysSince(iso, nowMs) {
    return Math.max(0, Math.floor((nowMs - tsOf(iso)) / 86400000));
  }
  function applicationAgeLabel(o, nowMs) {
    if (o && o.last_followup_at) return `relancé ${dayWord(daysSince(o.last_followup_at, nowMs))}`;
    if (o && o.applied_at) return `candidaté ${dayWord(daysSince(o.applied_at, nowMs))}`;
    return "date de candidature inconnue";
  }

  const api = {
    DECIDE_WINDOW_DAYS, DECIDE_MIN_SCORE, APPLICATION_STATUSES, OUTCOMES,
    NOT_FOR_ME_REASONS, DEAD_LINK_LABEL,
    isApplication, isUndecided, isDead, inDecideZone, byDecide,
    splitApplications, applicationCounts,
    patchApplied, patchNotForMe, patchDeadLink, patchOutcome, patchNotApplied,
    inversePatch, applyPatch,
    composeReason, parseReason, reasonTag,
    normalizeStoredFilters, applicationAgeLabel,
  };
  if (typeof window !== "undefined") window.jobsView = Object.assign(window.jobsView || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/test_jobs_view.mjs`
Expected: une ligne `ok` par check, puis `tous les tests passent`, code de sortie 0.

- [ ] **Step 5: Commit**

```bash
git add cockpit/lib/jobs-view.js tests/test_jobs_view.mjs
git commit -F - <<'EOF'
feat(jobs): module pur du tri en un geste

Zones (a decider sur 7 jours, candidatures, reste du scan), ecriture de
chaque geste et son inverse pour « Annuler », raisons au format
historique que la routine relit. Isole du panel pour etre teste sous
Node : c'est la que se jouent les cas qui mordraient en prod (echec
d'ecriture, annulation apres un second geste, precision libre qui
contient les separateurs).

Specs mises a jour: N/A (module pas encore charge par le panel)
Tests effectues: node tests/test_jobs_view.mjs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Migration 035 — les issues de candidature survivent aux republications

**Files:**
- Create: `sql/035_jobs_inherit_outcomes.sql`
- Modify: `docs/architecture/decisions.md` (ajout ADR-52 en fin de fichier)
- Modify: `docs/architecture/dependencies.yaml` (commentaire `reader` de la colonne `closed_at` de la table `jobs`)
- Modify: `docs/specs/tab-jobs.md`, `docs/specs/index.json`

**Interfaces:**
- Consumes: la fonction existante `public.jobs_inherit_user_status()` (version `sql/026`) et `public.jobs_logical_key(text, text)`.
- Produces: même fonction, même trigger `jobs_inherit_user_status` (BEFORE INSERT) ; comportement étendu à `interview` / `rejected` / `ghosted`. Aucune autre tâche n'en dépend dans le code ; la Tâche 4 écrit ces statuts.

- [ ] **Step 1: Write the failing test**

Le test est une transaction qui s'annule elle-même : le bloc lève une exception dont le message porte le verdict, ce qui garantit que rien ne persiste. Lancer via l'outil MCP `execute_sql` (projet `mrmgptqpflzyavdfqwwv`) :

```sql
DO $$
DECLARE
  r  text := '';
  s  text;
  st text;
BEGIN
  FOREACH st IN ARRAY ARRAY['interview', 'rejected', 'ghosted'] LOOP
    INSERT INTO public.jobs (linkedin_job_id, title, company, url, status, score_total)
      VALUES ('t035-' || st || '-a', 'Poste test 035 ' || st, 'Boite test 035', 'https://example.com', st, 8);
    INSERT INTO public.jobs (linkedin_job_id, title, company, url, status, score_total)
      VALUES ('t035-' || st || '-b', 'Poste test 035 ' || st, 'Boite test 035', 'https://example.com', 'new', 8);
    SELECT status INTO s FROM public.jobs WHERE linkedin_job_id = 't035-' || st || '-b';
    r := r || st || '=>' || s || ' ';
  END LOOP;
  -- Candidature clôturée : reste une candidature, hérite la clôture.
  INSERT INTO public.jobs (linkedin_job_id, title, company, url, status, score_total, closed_at)
    VALUES ('t035-closed-a', 'Poste test 035 clos', 'Boite test 035', 'https://example.com', 'interview', 8, now());
  INSERT INTO public.jobs (linkedin_job_id, title, company, url, status, score_total)
    VALUES ('t035-closed-b', 'Poste test 035 clos', 'Boite test 035', 'https://example.com', 'new', 8);
  SELECT status || '/' || (closed_at IS NOT NULL)::text INTO s
    FROM public.jobs WHERE linkedin_job_id = 't035-closed-b';
  r := r || 'closed-interview=>' || s;
  RAISE EXCEPTION 'VERDICT 035: %', r;
END $$;
```

- [ ] **Step 2: Run test to verify it fails**

Expected (erreur renvoyée par l'outil, attendue) : `VERDICT 035: interview=>new rejected=>new ghosted=>new closed-interview=>archived/true`. C'est le défaut : sans la migration, une republication d'une offre en entretien revient en `new`.

- [ ] **Step 3: Write minimal implementation**

Créer `sql/035_jobs_inherit_outcomes.sql` :

```sql
-- 035 — Jobs Radar : les issues de candidature survivent aux republications
-- Spec : docs/superpowers/specs/2026-09-24-jobs-radar-triage-design.md — ADR-52.
--
-- Le front écrit désormais `interview`, `rejected` et `ghosted` — statuts
-- ouverts par le CHECK de sql/030 et jamais écrits jusqu'ici. Le trigger de
-- sql/026 n'hérite, parmi eux, que de `applied`. Si la dédup de la routine rate
-- une republication — elle a dérivé plusieurs fois —, une offre où l'utilisateur
-- est en entretien reviendrait en `new`. Les quatre statuts de candidature sont
-- donc traités comme `applied` : hérités sans péremption, jamais forcés en
-- `archived` par une clôture. Seule la fonction change ; le trigger BEFORE
-- INSERT de 013/026 reste en place.
CREATE OR REPLACE FUNCTION public.jobs_inherit_user_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prior   RECORD;
  v_key   text;
  v_corp  text;
BEGIN
  IF NEW.title IS NULL OR NEW.company IS NULL THEN
    RETURN NEW;
  END IF;

  -- NB : on appelle la fonction plutôt que de lire NEW.logical_key — les
  -- colonnes générées sont calculées APRÈS les triggers BEFORE.
  v_key  := public.jobs_logical_key(NEW.company, NEW.title);
  v_corp := split_part(v_key, '|', 1);

  -- Garde-fou anti-sur-fusion (ADR-25) : deux employeurs masqués distincts
  -- partageraient la clé. On n'hérite alors de rien.
  IF v_corp IN ('', 'confidential', 'confidentialcareers', 'undisclosed') THEN
    RETURN NEW;
  END IF;

  SELECT status, user_notes, closed_at INTO prior
  FROM public.jobs
  WHERE logical_key = v_key
    AND (
      -- « cette annonce est morte » : décision explicite, sans péremption
      closed_at IS NOT NULL
      -- une candidature, quelle que soit son issue : ne jamais la reproposer
      OR status IN ('applied', 'interview', 'rejected', 'ghosted')
      OR (status = 'snoozed'  AND updated_at >= now() - interval '14 days')
      -- ADR-23 : n'hériter que d'un archivage qui reflète une décision USER.
      -- Le NOT LIKE exclut les auto-archivages de vieillissement (ADR-26/31).
      OR (status = 'archived' AND updated_at >= now() - interval '90 days'
          AND (user_verdict IS NOT NULL OR score_total >= 5)
          AND coalesce(user_notes, '') NOT LIKE '%auto-archive vieillissement%')
    )
  ORDER BY (closed_at IS NOT NULL) DESC,
           (status IN ('applied', 'interview', 'rejected', 'ghosted')) DESC,
           updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Une offre clôturée revient archivée, sauf une candidature : le front ne
    -- considère jamais une candidature comme morte.
    NEW.status := CASE
      WHEN prior.closed_at IS NOT NULL
       AND prior.status NOT IN ('applied', 'interview', 'rejected', 'ghosted') THEN 'archived'
      ELSE prior.status
    END;
    NEW.closed_at := coalesce(NEW.closed_at, prior.closed_at);
    IF (NEW.user_notes IS NULL OR NEW.user_notes = '') AND prior.user_notes IS NOT NULL THEN
      NEW.user_notes := prior.user_notes;
    END IF;
  END IF;

  RETURN NEW;
END $$;
```

Puis l'appliquer via l'outil MCP `apply_migration` (projet `mrmgptqpflzyavdfqwwv`, `name: "jobs_inherit_outcomes"`, `query` = le contenu exact du fichier).

- [ ] **Step 4: Run test to verify it passes**

Relancer le bloc `DO` du Step 1 via `execute_sql`.
Expected (erreur attendue) : `VERDICT 035: interview=>interview rejected=>rejected ghosted=>ghosted closed-interview=>interview/true`.

Puis vérifier que rien n'a persisté :

```sql
SELECT count(*) FROM public.jobs WHERE linkedin_job_id LIKE 't035-%';
```
Expected: `0`.

- [ ] **Step 5: Documenter (même commit)**

1. `docs/architecture/decisions.md` — ajouter à la fin du fichier :

```markdown
## ADR-52 · 2026-09-24 · Jobs Radar — lire une annonce n'est pas postuler, et trier tient en un geste

**Contexte.** L'utilisateur trouve que le fit des offres ne progresse pas. Mesuré le 2026-09-24, il a raison : la part des hot leads (≥ 7, doublons fusionnés) qu'il ouvre est plate depuis cinq mois — 37 % en avril-mai, 23 % en juin-juillet, 34 % en août, 33 % en septembre — malgré ADR-21, ADR-33 et ADR-50. Deux causes relèvent du front. **L'écran cache la nouveauté** : avec les filtres par défaut, le bloc hot leads comptait 82 cartes, dont 49 offres déjà « postulées », et une seule offre de la semaine parmi les 12 premières. **Le signal ment** : « Postuler sur LinkedIn » était le seul moyen d'ouvrir l'annonce — `jobs` ne stocke pas sa description — et il écrivait `status = applied`. `applied` voulait donc dire « ouvert » ; cinq offres étaient à la fois `applied` et 👎. L'ÉTAPE 7 de la routine lit pourtant `applied` comme « POSITIFS CONFIRMÉS PAR LES CANDIDATURES ». Le vote 👍/👎 n'a servi que 23 fois en cinq mois, et le recalibrage, qui exige 3 votes neufs, n'a pas tourné depuis le 2026-08-10.

**Décision — lire et postuler deviennent deux gestes.** « Lire l'annonce » ouvre le lien et n'écrit rien en base (`jobs_action {action:"open"}` seulement) ; « J'ai postulé » écrit `status = applied` + `applied_at`. À partir de la mise en production, `applied` signifie « candidature envoyée ».

**Décision — trier tient en un geste, et chaque geste est un signal.** « Pas pour moi » remplace le 👍/👎 et l'entrée « Archiver » : trois raisons à un clic (`pas crédible`, `trop junior`, `boîte ou secteur`) plus une précision libre, qui écrivent `user_verdict = down` au format historique de `user_verdict_reason` et archivent l'offre. « Lien mort » n'écrit que `closed_at` : ce n'est pas un avis, il n'entre pas dans l'apprentissage. Chaque geste s'annule pendant 5 secondes, et s'annule tout seul si l'écriture échoue — les events ne partent qu'après confirmation.

**Décision — trois zones.** « À décider » ne montre que les hot leads non triés entrés depuis moins de 7 jours : une offre non décidée en sort d'elle-même, il n'y a pas de file qui grossit. « Tes candidatures » porte le suivi et les issues (`interview`, `rejected`, `ghosted`, statuts ouverts par `sql/030` et jamais écrits jusqu'ici) ; les 30 candidatures sans date, antérieures au 2026-08-17, y sont repliées et se corrigent à la main. Le reste du scan garde la liste dense.

**Décision — les issues survivent aux republications (`sql/035`).** `jobs_inherit_user_status` traite `interview`, `rejected` et `ghosted` comme `applied` : hérités sans péremption, jamais forcés en `archived` par une clôture. Vérifié par un bloc `DO` qui lève son verdict en exception, donc sans rien persister.

**Ce qui est assumé.** La routine n'est pas modifiée : ses entrées changent seulement de sens — `applied` devient fiable, chaque « Pas pour moi » compte pour le seuil de 3 votes du recalibrage. Les 52 `applied` historiques ne sont pas corrigés automatiquement : l'ÉTAPE 7 continuera de lire comme positives les candidatures non corrigées, dont trois offres 👎 et pourtant `applied`, au recalibrage du lundi 2026-09-28 (décision séparée). « Ouvert » ne vit que dans la télémétrie : pas de colonne `opened_at` tant qu'un lot « apprentissage » n'en démontre pas le besoin. **Sonde de valeur**, lue le 2026-10-22 : si la part des hot leads décidés avant de sortir de la fenêtre de 7 jours ne dépasse pas le tiers d'ouverture mesuré avant ce changement, le geste unique n'a pas suffi. Spec : `docs/superpowers/specs/2026-09-24-jobs-radar-triage-design.md`.
```

2. `docs/architecture/dependencies.yaml` — dans la table `jobs`, colonne `closed_at`, remplacer la ligne :

```yaml
        reader: front  # masquage feed + filtre Clôturées (migration 015) ; + trigger jobs_inherit_user_status (hérite closed_at sur republication — ADR-32)
```
par :
```yaml
        reader: front  # masquage feed + filtre Clôturées (migration 015) ; + trigger jobs_inherit_user_status (hérite closed_at sur republication — ADR-32 ; depuis sql/035, hérite aussi sans péremption les statuts de candidature applied / interview / rejected / ghosted — ADR-52)
```

3. `docs/specs/tab-jobs.md` :
   - Section `## Back — sources de données`, ligne `jobs` : remplacer `status (new/to_apply/applied/snoozed/archived)` par `status (new/to_apply/applied/interview/rejected/ghosted/snoozed/archived — les trois issues de candidature ouvertes par sql/030)`.
   - Même ligne : remplacer `` `archived` à score ≥ 5 ≤90j, `applied`, et **`closed_at` sans péremption** `` par `` `archived` à score ≥ 5 ≤90j, `applied` **et les issues `interview` / `rejected` / `ghosted`** (migration 035, ADR-52), et **`closed_at` sans péremption** ``.
   - Section `## Fonctionnalités`, à la fin de la puce **Archivage durable face aux republications LinkedIn**, ajouter la phrase : ` Une candidature, quelle que soit son issue (entretien, refus, sans réponse), n'est jamais reproposée comme nouvelle.`
   - Section `## Dernière MAJ`, insérer en première ligne sous le titre :
     `2026-09-24 — **Les issues de candidature survivent aux republications (ADR-52)** : le trigger `jobs_inherit_user_status` hérite désormais `interview`, `rejected` et `ghosted` comme `applied` — sans péremption, jamais forcés en `archived` par une clôture. Migration `sql/035_jobs_inherit_outcomes.sql`, vérifiée par un bloc `DO` qui lève son verdict. Prépare la zone « Tes candidatures ».`
4. `docs/specs/index.json` — entrée `"slug": "jobs"` : `"last_updated": "2026-08-27"` → `"last_updated": "2026-09-24"`.

Vérifier : `PYTHONUTF8=1 sh -c 'for s in lint_specs_produit validate_architecture validate_spec; do python scripts/$s.py || exit 1; done'` → les trois passent.

- [ ] **Step 6: Commit**

```bash
git add sql/035_jobs_inherit_outcomes.sql docs/architecture/decisions.md docs/architecture/dependencies.yaml docs/specs/tab-jobs.md docs/specs/index.json
git commit -F - <<'EOF'
feat(jobs): les issues de candidature survivent aux republications

Le front va ecrire interview, rejected et ghosted (statuts ouverts par
sql/030, jamais ecrits). Le trigger de 026 n'en heritait aucun : si la
dedup de la routine rate une republication, une offre en entretien
revenait en new. Les quatre statuts de candidature sont desormais
traites comme applied. ADR-52 consigne l'ensemble du lot.

Specs mises a jour: tab-jobs
Tests effectues: bloc DO en transaction auto-annulee (verdict avant et
apres), applique via MCP apply_migration

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Zone « À décider » et tri en un geste

**Files:**
- Create: `tests/smoke_jobs_panel.mjs`
- Modify: `cockpit/panel-jobs-radar.jsx`
- Modify: `cockpit/styles-jobs-radar.css`
- Modify: `index.html` (lignes 35, 72, 124)
- Modify: `sw.js` (via `node scripts/sync-sw.mjs`)
- Modify: `docs/specs/tab-jobs.md`, `docs/telemetry.md`

**Interfaces:**
- Consumes (Tâche 1) : `window.jobsView` — `inDecideZone`, `byDecide`, `isApplication`, `isDead`, `NOT_FOR_ME_REASONS`, `DEAD_LINK_LABEL`, `patchApplied`, `patchNotForMe`, `patchDeadLink`, `inversePatch`, `applyPatch`, `reasonTag`.
- Produces (utilisé par la Tâche 4) : dans `PanelJobsRadar`, `runGesture(offer, patch, { label, gesture, emit })`, `readOffer(offer, zone)`, `jobKey(offer)`, `passesFacets(o)`, `facetsActive`, `decideCount` ; composants `useJrDismiss(ref, open, close)`, `JrTriageActions`, `JrNotForMe` ; `JrToast` accepte `action = { label, onClick }` ; `showToast(message, tone, action)`.

- [ ] **Step 1: Write the failing test (smoke de rendu statique)**

Créer `tests/smoke_jobs_panel.mjs` :

```js
// Smoke test du panel Jobs Radar : rendu statique en Node, sans navigateur.
// Usage manuel — réseau au premier lancement (téléchargement de Babel), hors CI.
// Run: node tests/smoke_jobs_panel.mjs
//
// Transforme le vrai cockpit/panel-jobs-radar.jsx avec @babel/standalone (même
// version qu'index.html, mise en cache dans le dossier temporaire), l'exécute
// contre un mini-React qui sérialise l'arbre en pseudo-HTML, puis vérifie les
// zones sur un jeu d'offres fictives. Attrape les exceptions de rendu et les
// erreurs de répartition avant de pousser — ce dépôt est public, pousser est
// une publication. Les hooks sont inertes : les interactions se testent dans
// tests/test_jobs_view.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BABEL_URL = "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js";
const BABEL_CACHE = path.join(os.tmpdir(), "babel-standalone-7.29.0.min.js");

if (!fs.existsSync(BABEL_CACHE)) {
  const res = await fetch(BABEL_URL);
  if (!res.ok) throw new Error(`téléchargement de Babel : HTTP ${res.status}`);
  fs.writeFileSync(BABEL_CACHE, await res.text());
}
const Babel = createRequire(import.meta.url)(BABEL_CACHE);

// ── Mini-React : createElement → arbre ; hooks inertes ; rendu pseudo-HTML ──
const FRAGMENT = Symbol("fragment");
const h = (type, props, ...children) => ({ type, props: props || {}, children });
const React = {
  createElement: h,
  Fragment: FRAGMENT,
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  useMemo: (fn) => fn(),
  useEffect: () => {},
  useRef: (v = null) => ({ current: v }),
  useCallback: (fn) => fn,
};
const ATTRS = ["className", "title", "disabled", "aria-pressed", "aria-expanded"];
function render(node) {
  if (node == null || node === false || node === true) return "";
  if (Array.isArray(node)) return node.map(render).join("");
  if (typeof node !== "object") return String(node);
  const { type, props, children } = node;
  if (type === FRAGMENT) return render(children);
  if (typeof type === "function") {
    return render(type({ ...props, children: children.length <= 1 ? children[0] : children }));
  }
  const attrs = ATTRS
    .filter((k) => props[k] !== undefined && props[k] !== null && props[k] !== false)
    .map((k) => ` ${k === "className" ? "class" : k}="${props[k]}"`)
    .join("");
  return `<${type}${attrs}>${render(children)}</${type}>`;
}

const JOBS_VIEW = fs.readFileSync(path.join(ROOT, "cockpit", "lib", "jobs-view.js"), "utf8");
const PANEL = Babel.transform(
  fs.readFileSync(path.join(ROOT, "cockpit", "panel-jobs-radar.jsx"), "utf8"),
  { presets: ["react"] },
).code;

const SCAN = {
  date_label: "Jeudi 24 septembre", raw_count: 100, processed_count: 15, hot_leads_count: 3,
  tendances: { volumes_7d: [0, 0, 15, 0, 0, 0, 0], ratios_category: [{ id: "produit", label: "Produit", pct: 100 }] },
  actions: [],
};

function renderPanel(offers, storage = {}) {
  const store = { ...storage };
  const ctx = {
    React, console, setTimeout, clearTimeout,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    document: { addEventListener() {}, removeEventListener() {}, querySelector: () => null },
    Icon: ({ name }) => h("i", { className: `icon-${name}` }),
    cockpitToast: () => {},
    track: () => {},
    JOBS_DATA: { offers, scan: SCAN, skillGap: [] },
    PROFILE_DATA: { _values: {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(JOBS_VIEW, ctx);
  vm.runInContext(PANEL, ctx);
  return render(h(ctx.PanelJobsRadar, {}));
}

let seq = 0;
function offer(over) {
  seq += 1;
  return {
    id: `job-${seq}`, title: `Poste ${seq}`, company: `Boîte ${seq}`, url: `https://example.com/${seq}`,
    seen_days_ago: 1, posted_days_ago: null, role_category: "produit", company_stage: "scale",
    pitch: "", compensation: "", score_total: 8, score_seniority: 2, score_sector: 3, score_impact: 3,
    score_bonus: 0, rubric_justif: [], intel: null, intel_depth: "light", status: "new",
    first_seen_date: "2026-09-23", last_seen_date: "2026-09-23", user_notes: "", user_verdict: null,
    user_verdict_reason: "", user_verdict_at: null, closed_at: null, is_remote: null,
    applied_at: null, last_followup_at: null, followup_count: 0,
    ...over,
  };
}
const FIXTURE = () => [
  offer({ title: "D1 à décider", score_total: 9, seen_days_ago: 0 }),
  offer({ title: "D2 à décider", score_total: 8, seen_days_ago: 3 }),
  offer({ title: "D3 à décider", score_total: 7, seen_days_ago: 6 }),
  offer({ title: "L1 hot trop vieille", score_total: 8.5, seen_days_ago: 7 }),
  offer({ title: "L2 moyenne", score_total: 6, seen_days_ago: 1 }),
  offer({ title: "A1 déjà postulée", score_total: 9.5, status: "applied", applied_at: "2026-09-22T10:00:00Z" }),
  offer({ title: "A2 en entretien", score_total: 8, status: "interview", applied_at: "2026-09-10T10:00:00Z" }),
  offer({ title: "A3 ancienne candidature", score_total: 8, status: "applied", first_seen_date: "2026-05-01" }),
  offer({ title: "X1 écartée", score_total: 8, status: "archived", user_verdict: "down", user_verdict_reason: "trop junior" }),
  offer({ title: "C1 clôturée", score_total: 9, closed_at: "2026-09-20T10:00:00Z" }),
];

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log(`ok   ${name}`); return; }
  failures++;
  console.log(`FAIL ${name}${detail ? "\n  " + detail : ""}`);
}
const count = (html, needle) => html.split(needle).length - 1;
// Isole l'<article> (carte ou ligne) qui contient `title`.
function articleOf(html, title) {
  const i = html.indexOf(title);
  if (i < 0) return "";
  return html.slice(html.lastIndexOf("<article", i), html.indexOf("</article>", i));
}

// ── Rendu par défaut ──
const html = renderPanel(FIXTURE());
const cards = count(html, '<article class="jr-hot">');
check("À décider : 3 cartes", cards === 3, `${cards} cartes`);
check("À décider : triée par score",
  html.indexOf("D1 à décider") < html.indexOf("D2 à décider") && html.indexOf("D2 à décider") < html.indexOf("D3 à décider"));
check("en-tête : 3 à décider", html.includes("<strong>3</strong> à décider"));
check("plus aucun bouton Postuler", !html.includes("Postuler sur LinkedIn"));
check("plus de pouces", !html.includes("icon-thumbs_up") && !html.includes("icon-thumbs_down"));
check("chaque carte : Lire / J'ai postulé / Pas pour moi",
  count(html, "<span>Lire l'annonce</span>") === 3 &&
  count(html, "<span>J'ai postulé</span>") === 3 &&
  count(html, "<span>Pas pour moi</span>") === 3);
check("offre clôturée masquée", !html.includes("C1 clôturée"));
const a1 = articleOf(html, "A1 déjà postulée");
check("candidature : lire seulement",
  a1.includes(`title="Lire l'annonce"`) && !a1.includes(`title="J'ai postulé"`) && !a1.includes(`title="Pas pour moi"`),
  a1.slice(0, 240));
const rows = count(html, '<article class="jr-row ');
check("liste : 4 lignes (L1, L2, A1, A3)", rows === 4, `${rows} lignes`);

// ── Zone vide ──
const quiet = renderPanel(FIXTURE().filter((o) => !o.title.startsWith("D")));
check("zone vide : une ligne le dit", quiet.includes("Rien de nouveau à trier sur les 7 derniers jours."));
const filtered = renderPanel(FIXTURE(), { "jr.filters.v1": JSON.stringify({ catFilter: "cos" }) });
check("zone vide sous filtre", filtered.includes("Rien à décider avec ces filtres."));

// ── Raison d'un « Pas pour moi » visible dans la liste ──
const all = renderPanel(FIXTURE(), { "jr.filters.v1": JSON.stringify({ statusFilter: "all" }) });
check("étiquette de raison", all.includes("écartée · trop junior"));

if (failures) { console.log(`\n${failures} échec(s)`); process.exit(1); }
console.log("\nsmoke OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/smoke_jobs_panel.mjs`
Expected: FAIL — au moins `À décider : 3 cartes` (le hero actuel compte aussi A1), `plus aucun bouton Postuler`, `plus de pouces`, `zone vide : une ligne le dit`. Si le script plante avant (réseau), vérifier l'accès à unpkg.com.

- [ ] **Step 3: Implement — panel, en huit remplacements dans `cockpit/panel-jobs-radar.jsx`**

**3a.** Juste après la ligne `const { useState: useStateJr, useMemo: useMemoJr, useEffect: useEffectJr, useRef: useRefJr } = React;`, ajouter :

```jsx

// Logique pure du tri (cockpit/lib/jobs-view.js, script classique chargé avant
// les panels Babel) — spec 2026-09-24, ADR-52.
const JV = window.jobsView;
```

**3b.** Remplacer :

```jsx
// Une offre clôturée est "morte" et masquée — sauf si déjà postulée (reste dans le pipeline applied).
function jrIsDead(o) { return !!o.closed_at && o.status !== "applied"; }
```
par :
```jsx
// Une offre clôturée est « morte » et masquée — sauf une candidature, quelle
// que soit son issue (ADR-52).
function jrIsDead(o) { return JV.isDead(o); }
```

**3c.** Remplacer toute la fonction `JrToast` (du commentaire `// ─── Toast — discreet feedback after a write op ───────────` à son `}` final) par :

```jsx
// ─── Toast — feedback discret après une écriture, « Annuler » optionnel ───
function JrToast({ message, tone, action }) {
  if (!message) return null;
  return (
    <div className={`jr-toast jr-toast--${tone || "ok"}`} role="status" aria-live="polite">
      <Icon name={tone === "error" ? "x" : "check"} size={13} stroke={2.2} />
      <span>{message}</span>
      {action && (
        <button type="button" className="jr-toast-action" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}

// Ferme un popover au clic extérieur ou sur Échap (menu ⋯, « Pas pour moi »).
function useJrDismiss(ref, open, close) {
  useEffectJr(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
}
```

**3d.** Remplacer toute la fonction `JrActionsMenu` (du commentaire `// ─── Actions menu — kebab popover (snooze / archive / notes) ───` à son `}` final) par :

```jsx
// ─── Actions menu — kebab popover (snooze / notes / clôture) ───
// « Archiver » a disparu (ADR-52) : « Pas pour moi » le remplace, et un
// archivage sans raison est un signal perdu.
function JrActionsMenu({ offer, open, onToggle, onSnooze, onEditNotes, onClose, onReopen }) {
  const ref = useRefJr(null);
  useJrDismiss(ref, open, () => onToggle(null));
  return (
    <div className="jr-menu" ref={ref}>
      <button
        className="jr-btn jr-btn--icon jr-menu-trigger"
        onClick={(e) => { e.stopPropagation(); onToggle(open ? null : offer.id); }}
        aria-label="Actions"
        aria-expanded={open}
        title="Actions"
      >
        <span className="jr-menu-dots" aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="jr-menu-pop" role="menu">
          <button className="jr-menu-item" role="menuitem" disabled={offer.status === "snoozed"} onClick={() => onSnooze(offer.id)}>
            <Icon name="clock" size={13} stroke={2} />
            <span>Snoozer 7 jours</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={() => onEditNotes(offer.id)}>
            <Icon name="file_text" size={13} stroke={2} />
            <span>Éditer les notes</span>
          </button>
          {!offer.closed_at && !JV.isApplication(offer) && (
            <button className="jr-menu-item" role="menuitem" onClick={() => onClose(offer.id)}>
              <Icon name="x" size={13} stroke={2} />
              <span>Marquer clôturée</span>
            </button>
          )}
          {offer.closed_at && (
            <button className="jr-menu-item" role="menuitem" onClick={() => onReopen(offer.id)}>
              <Icon name="refresh" size={13} stroke={2} />
              <span>Rouvrir</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**3e.** Remplacer tout le bloc du vote — du commentaire `// ─── Vote 👍/👎 + raisons (popover multi-sélection) ───────` jusqu'au `}` qui ferme `function JrVote` (juste avant `// ─── Score chip`) — par :

```jsx
// ─── « Pas pour moi » — une raison = une décision (ADR-52) ───
// Précision libre facultative en tête, puis trois raisons à un clic.
// « Lien mort » est à part : il clôture l'offre et n'est pas un avis.
function JrNotForMe({ offer, compact = false, onDecide, onDeadLink }) {
  const [open, setOpen] = useStateJr(false);
  const [free, setFree] = useStateJr("");
  const ref = useRefJr(null);
  useJrDismiss(ref, open, () => setOpen(false));
  const decide = (code) => { setOpen(false); onDecide(offer, code, free); setFree(""); };
  return (
    <div className={`jr-nfm ${compact ? "jr-nfm--compact" : ""}`} ref={ref}>
      <button
        className={compact ? "jr-btn jr-btn--icon" : "jr-btn jr-btn--ghost"}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-expanded={open}
        title="Pas pour moi">
        <Icon name="x" size={compact ? 14 : 13} stroke={2.2} />
        {!compact && <span>Pas pour moi</span>}
        {!compact && <Icon name={open ? "chevron_up" : "chevron_down"} size={12} stroke={2} />}
      </button>
      {open && (
        <div className="jr-nfm-pop" role="menu" aria-label="Pourquoi pas pour toi ?">
          <input
            className="jr-nfm-free"
            value={free}
            autoFocus
            placeholder="préciser (optionnel)…"
            onChange={(e) => setFree(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter" && free.trim()) decide(null); }} />
          {JV.NOT_FOR_ME_REASONS.map((r) => (
            <button key={r.code} className="jr-nfm-opt" role="menuitem"
              onClick={(e) => { e.stopPropagation(); decide(r.code); }}>
              {r.label}
            </button>
          ))}
          <div className="jr-nfm-sep" />
          <button className="jr-nfm-opt jr-nfm-opt--dead" role="menuitem"
            onClick={(e) => { e.stopPropagation(); setOpen(false); setFree(""); onDeadLink(offer); }}>
            <Icon name="x" size={12} stroke={2} />
            <span>{JV.DEAD_LINK_LABEL}</span>
          </button>
          <div className="jr-nfm-foot">Lien mort = offre clôturée, pas un avis.</div>
        </div>
      )}
    </div>
  );
}

// ─── Actions de tri : lire ≠ postuler (ADR-52) ───
// Sur une candidature, seul « Lire l'annonce » reste : la décision est prise.
function JrTriageActions({ offer, zone, compact = false, onRead, onApplied, onNotForMe, onDeadLink }) {
  const decided = JV.isApplication(offer);
  return (
    <div className={`jr-triage ${compact ? "jr-triage--compact" : ""}`}>
      <button
        className={compact ? "jr-btn jr-btn--icon" : "jr-btn jr-btn--ghost"}
        onClick={() => onRead(offer, zone)}
        disabled={!offer.url}
        title="Lire l'annonce">
        <Icon name="eye" size={14} stroke={2} />
        {!compact && <span>Lire l'annonce</span>}
      </button>
      {!decided && (
        <button
          className={compact ? "jr-btn jr-btn--icon" : "jr-btn jr-btn--primary"}
          onClick={() => onApplied(offer)}
          title="J'ai postulé">
          <Icon name="check" size={14} stroke={2.2} />
          {!compact && <span>J'ai postulé</span>}
        </button>
      )}
      {!decided && (
        <JrNotForMe offer={offer} compact={compact} onDecide={onNotForMe} onDeadLink={onDeadLink} />
      )}
    </div>
  );
}
```

**3f.** Dans `HotLeadCard` :
- remplacer la signature par :
```jsx
function HotLeadCard({ offer, rank, zone = "decide", onRead, onApplied, onNotForMe, onDeadLink, onSnooze, onEditNotes, onSaveNotes, onCancelNotes, onClose, onReopen, openMenu, onMenuToggle, notesEditing }) {
```
- remplacer tout le `<footer className="jr-hot-foot"> … </footer>` par :
```jsx
      <footer className="jr-hot-foot">
        <JrTriageActions offer={offer} zone={zone} onRead={onRead} onApplied={onApplied} onNotForMe={onNotForMe} onDeadLink={onDeadLink} />
        <div className="jr-hot-actions">
          <JrActionsMenu
            offer={offer}
            open={openMenu === offer.id}
            onToggle={onMenuToggle}
            onSnooze={onSnooze}
            onEditNotes={onEditNotes}
            onClose={onClose}
            onReopen={onReopen}
          />
        </div>
      </footer>
```

**3g.** Dans `OfferRow` :
- remplacer la signature par :
```jsx
function OfferRow({ offer, onRead, onApplied, onNotForMe, onDeadLink, onSnooze, onEditNotes, onSaveNotes, onCancelNotes, onClose, onReopen, openMenu, onMenuToggle, notesEditing }) {
```
- dans `.jr-row-tags`, juste après le bloc `{offer.status !== "new" && ( … )}`, ajouter :
```jsx
            {offer.user_verdict === "down" && (
              <span className="jr-tag jr-tag--reason">{JV.reasonTag(offer.user_verdict_reason)}</span>
            )}
```
- remplacer tout le `<div className="jr-row-actions"> … </div>` par :
```jsx
      <div className="jr-row-actions">
        <JrTriageActions offer={offer} zone="list" compact onRead={onRead} onApplied={onApplied} onNotForMe={onNotForMe} onDeadLink={onDeadLink} />
        <JrActionsMenu
          offer={offer}
          open={openMenu === offer.id}
          onToggle={onMenuToggle}
          onSnooze={onSnooze}
          onEditNotes={onEditNotes}
          onClose={onClose}
          onReopen={onReopen}
        />
      </div>
```

**3h.** Dans `JrCalibrage`, remplacer la chaîne :
```
Pas encore assez de votes pour inférer un profil. Note quelques offres 👍/👎 — le radar synthétise après quelques retours.
```
par :
```
Pas encore assez de retours pour inférer un profil. Chaque « Pas pour moi » compte — le radar recalibre le lundi dès 3 nouveaux retours.
```

- [ ] **Step 4: Implement — `PanelJobsRadar`, en sept remplacements**

**4a.** Remplacer `showToast` par :
```jsx
  const showToast = (message, tone, action) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone: tone || "ok", action: action || null });
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 2400);
  };
```

**4b.** Remplacer le bloc qui va du commentaire `// vote 👍/👎 (+ raison) — event jobs_feedback, porte le score au moment du vote.` jusqu'à la fin de `applyToJob` (la ligne `  };` qui suit `setOpenMenu(null);`) par :
```jsx
  // ─── Gestes de tri (ADR-52) ───────────────────────────────
  // Optimiste → PATCH → succès : event + toast « Annuler » (5 s) ; échec :
  // l'inverse est réappliqué localement et aucun event ne part. Un échec ne
  // laisse ni carte fantôme ni event fantôme.
  const mirrorPatch = (id, patch) => {
    setOffers(prev => JV.applyPatch(prev, id, patch));
    try {
      if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA.offers)) {
        window.JOBS_DATA.offers = JV.applyPatch(window.JOBS_DATA.offers, id, patch);
      }
    } catch {}
  };
  const jobKey = (offer) => String(offer.id).slice(0, 64);
  const nowIso = () => new Date().toISOString();

  const undoGesture = (id, patch, inverse, gesture) => {
    mirrorPatch(id, inverse);
    setToast(null);
    patchJobSupabase(id, inverse)
      .then(() => {
        try { window.track && window.track("jobs_action", { action: "undo", job_id: String(id).slice(0, 64), value: gesture }); } catch {}
        showToast("Geste annulé", "ok");
      })
      .catch(() => {
        mirrorPatch(id, patch);
        showToast("Annulation impossible — le geste reste enregistré", "error");
      });
  };
  const runGesture = (offer, patch, { label, gesture, emit }) => {
    if (!offer) return;
    const inverse = JV.inversePatch(offer, patch);
    mirrorPatch(offer.id, patch);
    setOpenMenu(null);
    patchJobSupabase(offer.id, patch)
      .then(() => {
        try { emit(); } catch {}
        showToast(label, "ok", { label: "Annuler", onClick: () => undoGesture(offer.id, patch, inverse, gesture) });
      })
      .catch(() => {
        mirrorPatch(offer.id, inverse);
        showToast("Écriture impossible — geste annulé", "error");
      });
  };

  // Lire ≠ postuler : ouvre l'annonce, n'écrit rien en base.
  const readOffer = (offer, zone) => {
    if (!offer || !offer.url) return;
    try { window.open(offer.url, "_blank", "noopener,noreferrer"); } catch {}
    try { window.track && window.track("jobs_action", { action: "open", job_id: jobKey(offer), value: zone || "list" }); } catch {}
  };
  const markApplied = (offer) => runGesture(offer, JV.patchApplied(nowIso()), {
    label: "Candidature enregistrée", gesture: "applied",
    emit: () => window.track && window.track("jobs_action", { action: "status", job_id: jobKey(offer), value: "applied" }),
  });
  const notForMe = (offer, code, free) => {
    const patch = JV.patchNotForMe(code, free, nowIso());
    runGesture(offer, patch, {
      label: code ? `Écartée · ${code}` : "Écartée", gesture: "not_for_me",
      emit: () => window.track && window.track("jobs_feedback", {
        verdict: "down",
        reason: String(patch.user_verdict_reason ?? "").slice(0, 64),
        job_id: jobKey(offer),
        score_at_vote: offer.score_total,
      }),
    });
  };
  const deadLink = (offer) => runGesture(offer, JV.patchDeadLink(nowIso()), {
    label: "Offre clôturée · lien mort", gesture: "dead_link",
    emit: () => window.track && window.track("jobs_action", { action: "close", job_id: jobKey(offer), value: "dead_link" }),
  });
```

**4c.** Supprimer la ligne `const archiveJob = (id) => { updateJob(id, { status: "archived" }, "Archivée"); setOpenMenu(null); };`, puis remplacer tout l'objet `cardHandlers` par :
```jsx
  const cardHandlers = {
    onRead: readOffer,
    onApplied: markApplied,
    onNotForMe: notForMe,
    onDeadLink: deadLink,
    onSnooze: snoozeJob,
    onEditNotes: startEditNotes,
    onSaveNotes: saveNotes,
    onCancelNotes: cancelEditNotes,
    onClose: closeJob,
    onReopen: reopenJob,
    openMenu,
    onMenuToggle: setOpenMenu,
    notesEditing,
  };
```

**4d.** Remplacer toute la fonction `passesFilters` (de `  const passesFilters = (o) => {` à son `  };`) par :
```jsx
  // Facettes : rôle, lieu, recherche, écart de compétence. Elles pilotent la
  // zone « À décider » ET la liste (ADR-52).
  const passesFacets = (o) => {
    if (gapFilter && !gapFilter.ids.has(o.id)) return false;
    if (catFilter !== "all" && o.role_category !== catFilter) return false;
    if (remoteFilter === "remote" && o.is_remote !== true) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!(o.title.toLowerCase().includes(q) ||
            o.company.toLowerCase().includes(q) ||
            (o.pitch || "").toLowerCase().includes(q))) return false;
    }
    return true;
  };
  const facetsActive = !!gapFilter || catFilter !== "all" || remoteFilter === "remote" || !!query.trim();

  // Liste : facettes + statut + fraîcheur. La bande de score est gérée par section.
  const passesFilters = (o) => {
    if (!passesFacets(o)) return false;
    if (statusFilter === "closed") {
      if (!o.closed_at) return false;
    } else {
      if (jrIsDead(o)) return false;  // masque les clôturées (sauf candidatures)
      if (statusFilter === "active") {
        if (!(o.status === "new" || o.status === "to_apply" || o.status === "applied")) return false;
      } else if (statusFilter !== "all") {
        if (o.status !== statusFilter) return false;
      }
    }
    // Fraîcheur = depuis quand l'offre est dans le radar (first_seen_date), pas la
    // date de publication LinkedIn (antidatée + souvent null → filtre quasi-vide).
    if (freshFilter === "24h" && o.seen_days_ago !== 0) return false;
    if (freshFilter === "7j"  && o.seen_days_ago >= 7) return false;
    return true;
  };
```

**4e.** Remplacer les blocs `hotLeadsCount` et `heroLeads` (du commentaire `// Compteur header GLOBAL …` jusqu'à la fin du `useMemoJr` de `heroLeads`) par :
```jsx
  // Compteur d'en-tête GLOBAL (non filtré) : la taille de la zone « À décider ».
  const decideCount = useMemoJr(() => offers.filter(JV.inDecideZone).length, [offers]);

  // Zone « À décider » : hot leads non triés entrés depuis moins de 7 jours,
  // filtrés par facettes seulement. Masquée si la bande score vise mid ou low.
  const showHero = scoreFilter === "all" || scoreFilter === "hot";
  const heroLeads = useMemoJr(() =>
    showHero
      ? offers.filter(o => JV.inDecideZone(o) && passesFacets(o)).sort(JV.byDecide)
      : [],
  [offers, scoreFilter, catFilter, remoteFilter, query, gapFilter]);
```
Puis supprimer la ligne `  const newCount = offers.filter(o => o.status === "new").length;`.

**4f.** Dans le rendu :
- remplacer le contenu de `<div className="jr-header-stats">` jusqu'au bloc `{closedCount > 0 && (…)}` exclu par :
```jsx
            <span><strong>{decideCount}</strong> à décider</span>
            <span className="jr-sep">·</span>
            <span><strong>{totalCount}</strong> au total dans le radar</span>
```
- dans l'appel `<JrFilterBar`, remplacer `hotLeadsCount={hotLeadsCount}` par `decideCount={decideCount}` ;
- remplacer tout le bloc `{/* ─── HOT LEADS HERO ─── */}` + `{heroLeads.length > 0 && ( … )}` par :
```jsx
      {/* ─── ZONE 1 — À DÉCIDER (7 derniers jours) ─── */}
      {showHero && (
        <section className="jr-hot-section">
          <div className="jr-section-head">
            <div className="jr-section-kicker jr-section-kicker--hero">
              <span className="jr-hot-marker" />
              À décider · 7 derniers jours
            </div>
            <h2 className="jr-section-title">
              {heroLeads.length === 0
                ? "Rien à décider"
                : heroLeads.length === 1
                  ? "1 offre qui mérite ton matin"
                  : `${heroLeads.length} offres qui méritent ton matin`}
            </h2>
          </div>
          {heroLeads.length === 0 ? (
            <p className="jr-decide-empty">
              {facetsActive ? "Rien à décider avec ces filtres." : "Rien de nouveau à trier sur les 7 derniers jours."}
            </p>
          ) : (
            <div className="jr-hot-grid">
              {heroLeads.map((o, i) => <HotLeadCard key={o.id} offer={o} rank={i} zone="decide" {...cardHandlers} />)}
            </div>
          )}
        </section>
      )}
```
- remplacer `{toast && <JrToast message={toast.message} tone={toast.tone} />}` par `{toast && <JrToast message={toast.message} tone={toast.tone} action={toast.action} />}`.

**4g.** Dans `JrFilterBar` : remplacer `hotLeadsCount,` par `decideCount,` dans la liste des props, et la ligne `<span className="jr-fb-hot" title="Total hot leads (non filtré)">🔥 {hotLeadsCount} hot</span>` par :
```jsx
        <span className="jr-fb-hot" title="Offres à décider — 7 derniers jours, non filtré">🔥 {decideCount} à décider</span>
```

Vérifier qu'il ne reste aucune référence morte : `grep -n "JrVote\|VERDICT_REASONS\|jrParseReason\|jrComposeReason\|applyToJob\|archiveJob\|voteJob\|hotLeadsCount\|newCount" cockpit/panel-jobs-radar.jsx` → aucune sortie.

- [ ] **Step 5: Implement — CSS, index.html, service worker**

1. `cockpit/styles-jobs-radar.css` : supprimer tout le bloc qui commence à `/* ─── Vote (popover multi-raison) ────────────────────────── */` et finit à la règle `.jr-vote-free-input::placeholder { color: var(--tx3); }` incluse (aucune classe `jr-vote*` n'est plus rendue). Puis ajouter à la fin du fichier :

```css
/* ─── Tri en un geste — lire ≠ postuler (ADR-52) ─────────── */
.jr-triage { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.jr-triage--compact { gap: 6px; }
.jr-nfm { position: relative; display: inline-flex; }
.jr-nfm-pop {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
  width: 290px; background: var(--surface); border: 1px solid var(--bd2);
  border-radius: var(--radius); box-shadow: var(--shadow-md); padding: 6px;
  display: flex; flex-direction: column; gap: 1px;
}
.jr-nfm--compact .jr-nfm-pop { left: auto; right: 0; }
.jr-nfm-free {
  width: 100%; font-family: var(--font-sans); font-size: 12px; line-height: 1.4;
  padding: 7px 9px; margin-bottom: 4px;
  background: var(--bg); color: var(--tx); border: 1px solid var(--bd2); border-radius: 5px;
}
.jr-nfm-free::placeholder { color: var(--tx3); }
.jr-nfm-opt {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 10px; border: 0; border-radius: 3px; background: transparent;
  font-family: var(--font-sans); font-size: 12.5px; color: var(--tx); text-align: left; cursor: pointer;
}
.jr-nfm-opt:hover { background: var(--bg3); }
.jr-nfm-opt--dead { color: var(--tx2); }
.jr-nfm-opt--dead svg { color: var(--tx3); }
.jr-nfm-sep { height: 1px; background: var(--bd); margin: 5px 2px; }
.jr-nfm-foot {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .06em;
  color: var(--tx3); padding: 2px 10px 4px;
}
.jr-toast-action {
  margin-left: 6px; padding: 3px 9px; border-radius: 3px;
  border: 1px solid currentColor; background: transparent; color: inherit;
  font-family: var(--font-sans); font-size: 12px; font-weight: 600; cursor: pointer;
}
.jr-toast-action:hover { opacity: .8; }
.jr-tag--reason { background: var(--alert-tint); color: var(--alert); border-color: transparent; }
.jr-decide-empty {
  margin: 0; padding: 18px 20px; border: 1px dashed var(--bd); border-radius: var(--radius-lg);
  font-family: var(--font-sans); font-size: 13px; color: var(--tx2);
}
```

2. `index.html` :
   - ligne `<link rel="stylesheet" href="cockpit/styles-jobs-radar.css?v=5">` → `?v=6` ;
   - après la ligne `<script src="cockpit/lib/sante-view.js?v=1"></script>`, ajouter `<script src="cockpit/lib/jobs-view.js?v=1"></script>` ;
   - ligne `<script type="text/babel" src="cockpit/panel-jobs-radar.jsx?v=5"></script>` → `?v=6`.
3. Run: `node scripts/sync-sw.mjs` → `sw.js` régénéré (STATIC[] contient `/jarvis-cockpit/cockpit/lib/jobs-view.js?v=1`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `node tests/smoke_jobs_panel.mjs && node tests/test_jobs_view.mjs && node tests/test_sw_static.mjs && node tests/test_mediatheque_entry.mjs`
Expected: `smoke OK`, `tous les tests passent`, et aucun `FAIL` dans les deux derniers.

- [ ] **Step 7: Documenter (même commit)**

1. `docs/specs/tab-jobs.md` :
   - `## Finalité fonctionnelle` : remplacer `affiche les offres ≥7 en "Hot leads" + le reste en liste dense filtrable.` par `affiche en tête les offres ≥7 **à décider** (entrées depuis moins de 7 jours, pas encore triées) + le reste en liste dense filtrable.` ; et remplacer `L'utilisateur édite **uniquement** le statut (postuler / snoozer / archiver / clôturer), le vote 👍/👎 et les notes perso — toutes les autres colonnes sont propriété de la routine.` par `L'utilisateur agit par **gestes de tri** — lire l'annonce, « J'ai postulé », « Pas pour moi » avec une raison, lien mort, snoozer, clôturer — et édite ses notes perso ; toutes les autres colonnes sont propriété de la routine. Depuis ADR-52, lire une annonce n'est plus postuler.`
   - `## Parcours utilisateur` : remplacer toute la liste numérotée (de `1. Clic sidebar` à `9. Rafraîchissement temps réel …`) par :
```markdown
1. Clic sidebar "Jobs Radar" (groupe Business) — le panel charge les offres et le scan de la semaine.
2. Lecture du header : eyebrow "Jobs Radar · date du jour" + stats inline ("N à décider · T au total dans le radar") + titre descriptif.
3. Scan du banner en trois blocs : volumes sur 7 jours en barres Lun→Dim, répartition par catégorie de rôle (Produit / RTE / PgM / PjM / CoS / EM), actions du jour (relances + entretiens à préparer).
4. Lecture de la zone « À décider » : les offres notées 7+ entrées dans le radar depuis moins de 7 jours et pas encore triées, en grandes cartes avec logo de la boîte, score survolable, rubric par axe (Séniorité / Secteur / Impact), skills attendus scindés « tu as déjà » / « à acquérir », salaire estimé pour toi et badge « Remote » le cas échéant. Sans offre à trier, une ligne le dit.
5. Tri d'une carte en un geste — « Lire l'annonce » ouvre l'annonce sans rien enregistrer ; « J'ai postulé » enregistre la candidature ; « Pas pour moi » propose trois raisons en un clic (pas crédible pour moi, trop junior, boîte ou secteur) avec une précision libre facultative, ou « Lien mort / offre fermée ». La carte quitte la zone et un toast permet d'annuler pendant 5 secondes.
6. Utilisation des filtres : recherche texte + cinq groupes de filtres (score hot/mid/low / rôle / lieu / fraîcheur / statut) + tri (score ou récence). Rôle, lieu et recherche filtrent aussi la zone « À décider » ; statut et fraîcheur ne filtrent que la liste. Filtre statut "Actives" par défaut, qui masque les snoozées et archivées. La **fraîcheur** et le tri **récence** se mesurent sur la date d'entrée de l'offre dans le radar, pas la date de publication LinkedIn.
7. Liste dense en dessous : une ligne par offre avec score compact, titre / boîte, tags (catégorie / stage / statut, et la raison d'un « Pas pour moi »), pitch, rubric condensée, les mêmes gestes de tri en icônes et un menu kebab.
8. Menu kebab par offre : "Snoozer 7 jours", "Éditer les notes" (zone de texte inline avec bouton Enregistrer), "Marquer clôturée".
9. Rafraîchissement temps réel : quand le scan automatisé pousse de nouvelles offres pendant que le panel est ouvert, le feed se met à jour automatiquement sans recharger la page.
```
   - `## Fonctionnalités` — remplacer la puce **Hot leads en hero** par :
     `- **Zone « À décider »** : en tête de page, les offres notées 7+ entrées dans le radar depuis moins de 7 jours et pas encore triées, en grandes cartes avec logo de la boîte, rubric par axe, skills attendus, salaire estimé et badge « Remote ». Une offre non triée en sort d'elle-même au bout de 7 jours et rejoint la liste : pas de file qui grossit. Les filtres rôle, lieu et recherche s'y appliquent, et une ligne signale quand il n'y a rien à trier. Le compteur « à décider » de l'en-tête reste un total global.`
   - Puce **Barre de filtres collante** : remplacer la phrase `Tous les filtres pilotent à la fois le bloc « hot leads » et la liste, et sont **mémorisés** d'une visite à l'autre (sauf la recherche texte, qui repart vide).` par `Rôle, lieu et recherche pilotent à la fois la zone « À décider » et la liste ; statut et fraîcheur ne pilotent que la liste, et un filtre de score « moyen » ou « faible » masque la zone. Les filtres sont **mémorisés** d'une visite à l'autre (sauf la recherche texte, qui repart vide).`
   - Remplacer la puce **Actions rapides par offre** par :
     `- **Tri en un geste** : chaque offre propose « Lire l'annonce » (ouvre l'annonce, n'enregistre rien), « J'ai postulé » (enregistre la candidature) et « Pas pour moi », plus un menu (Snoozer 7 jours / Éditer les notes / Marquer clôturée). Lire une annonce n'est plus postuler : le radar distingue enfin une offre lue d'une candidature envoyée.`
   - Remplacer la puce **Statuts + notes persistés** par :
     `- **Gestes sauvegardés, annulables** : chaque geste est sauvegardé en base avec un toast de confirmation qui propose « Annuler » pendant 5 secondes ; si la sauvegarde échoue, le geste est annulé à l'écran et un toast d'erreur le signale. Les notes perso sont sauvegardées en base.`
   - Remplacer la puce **Vote 👍/👎 + raisons** par :
     `- **« Pas pour moi » en un clic** : trois raisons à un clic — pas crédible pour moi (compétences, domaine), trop junior, boîte ou secteur — avec une précision libre facultative ; l'offre est écartée et sa raison nourrit le recalibrage du radar. « Lien mort / offre fermée » clôture l'offre sans compter comme un avis. Dans la liste, une offre écartée affiche sa raison en étiquette.`
   - Puce **Masquage des offres clôturées** : remplacer `tu la masques **à la main** via le menu kebab « Marquer clôturée »` par `tu la masques **à la main** via le menu kebab « Marquer clôturée » ou « Pas pour moi › Lien mort / offre fermée »`.
   - `## Front — structure UI` : remplacer la ligne `` - `.jr-hot-section` (conditionnel si `heroLeads.length > 0`) → … `` par `` - `.jr-hot-section` — zone « À décider » (rendue si le filtre score autorise « hot ») → `.jr-hot-grid` avec `<HotLeadCard>` (pied : `<JrTriageActions>` + `<JrActionsMenu>` ; intègre `<JrSkills>` et `<SalaryEstimate>`) ou `.jr-decide-empty` `` ; et `` - `<JrToast>` (conditionnel) `` par `` - `<JrToast>` (conditionnel, action « Annuler » optionnelle) ``.
   - `## Front — fonctions JS` :
     - ligne `PanelJobsRadar` : remplacer `prédicat partagé `passesFilters` (hero + liste)` par `prédicats `passesFacets` (rôle/lieu/recherche/écart — zone « À décider » + liste) et `passesFilters` (+ statut/fraîcheur — liste)` ;
     - ligne `JrActionsMenu` : `(Snoozer/Archiver/Éditer notes/Marquer clôturée/Rouvrir)` → `(Snoozer/Éditer notes/Marquer clôturée/Rouvrir)` ;
     - ligne `JrToast` : `` `JrToast({ message, tone })` | Toast aria-live 2.4s `` → `` `JrToast({ message, tone, action })` | Toast aria-live, 5 s avec « Annuler », 2,4 s sinon `` ;
     - ligne `patchJobSupabase` : `Whitelist `{status, user_notes}` puis` → `Whitelist stricte (statut, notes, verdict, clôture, dates de candidature et de relance) puis` ;
     - remplacer la ligne `` `applyToJob(offer)` / `snoozeJob` / `archiveJob` / `saveNotes` | Handlers PATCH | … `` par ces lignes :
```markdown
| `runGesture(offer, patch, { label, gesture, emit })` / `undoGesture(...)` | Geste de tri : état optimiste → PATCH → event + toast « Annuler » ; échec → inverse local, aucun event (ADR-52) | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `readOffer(offer, zone)` / `markApplied` / `notForMe` / `deadLink` | Handlers de tri ; `readOffer` n'écrit rien en base | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `JrTriageActions({ offer, zone, compact, ... })` / `JrNotForMe` | Lire / J'ai postulé / Pas pour moi (variantes carte et ligne) ; popover précision libre + 3 raisons + lien mort | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `useJrDismiss(ref, open, close)` | Ferme un popover au clic extérieur ou sur Échap | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `snoozeJob` / `saveNotes` / `closeJob` / `reopenJob` / `followUpJob` | Handlers PATCH hors tri | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `window.jobsView` | Logique pure : zones, écritures des gestes et leurs inverses, raisons — testée par `tests/test_jobs_view.mjs` | [cockpit/lib/jobs-view.js](cockpit/lib/jobs-view.js) |
```
   - `## Appels externes` : remplacer `` - **`window.open(url, "_blank")`** : ouverture offres LinkedIn + LinkedIn du lead. `` par `` - **`window.open(url, "_blank")`** : « Lire l'annonce » et « Relancer ». `` ; remplacer la puce **Telemetry** par `` - **Telemetry** : `window.track("jobs_action", { action, job_id, value })` — gestes de tri (`open`, `status`, `close`, `undo`), snooze, notes, relance. `window.track("jobs_feedback", { verdict, reason, job_id, score_at_vote })` — une décision « Pas pour moi ». Détail : `docs/telemetry.md`. ``
   - `## États & edge cases` :
     - remplacer la puce **Hero vide** par : `` - **Zone « À décider » vide** : aucune offre non triée ≥ 7 entrée depuis moins de 7 jours (ou aucune avec les filtres rôle / lieu / recherche) → `.jr-decide-empty` : « Rien de nouveau à trier sur les 7 derniers jours. » ou « Rien à décider avec ces filtres. » ``
     - remplacer la puce **PATCH échoue** par : `` - **PATCH échoue** : pour un geste de tri, l'inverse est réappliqué localement + toast « Écriture impossible — geste annulé », aucun event ne part. Pour snooze et notes (chemin `updateJob`), toast « Erreur de sync — changement local uniquement », sans rollback. ``
     - remplacer la puce **`offer.url` vide** par : `` - **`offer.url` vide** : « Lire l'annonce » désactivé ; « J'ai postulé » reste possible (candidature par un autre canal). ``
     - ajouter : `` - **Annuler après un deuxième geste** : seul le dernier geste est annulable ; son inverse est calculé sur l'état juste avant lui. ``
   - `## Limitations connues / TODO` : remplacer la puce **Pas de rollback sur PATCH échoué** par `` - [ ] **Pas de rollback sur PATCH échoué** — corrigé pour les gestes de tri (ADR-52) ; reste vrai pour snooze et notes : l'offre garde son état local, la DB l'écrase au reload. ``
   - `## Dernière MAJ` : insérer en première ligne sous le titre :
     `2026-09-24 — **Lire ≠ postuler, tri en un geste (ADR-52)** : « Postuler sur LinkedIn » était le seul moyen de lire l'annonce et marquait l'offre `applied` — le statut voulait dire « ouvert ». Remplacé par « Lire l'annonce » (aucune écriture) + « J'ai postulé ». Le vote 👍/👎 et « Archiver » cèdent la place à « Pas pour moi » : trois raisons à un clic + précision libre, ou « Lien mort » (clôture, pas un avis). Toast « Annuler » 5 s, rollback local si l'écriture échoue. La zone du haut devient « À décider » : hot leads non triés entrés depuis moins de 7 jours (8 cartes au lieu de 82 le 2026-09-24). Logique pure dans `cockpit/lib/jobs-view.js`, testée par `tests/test_jobs_view.mjs` ; smoke de rendu `tests/smoke_jobs_panel.mjs`.`
2. `docs/telemetry.md` :
   - ligne `jobs_action` : ajouter à la fin de la cellule de description (avant le `|` final) : ` **Depuis le 2026-09-24 (ADR-52) — lire ≠ postuler** : `action:"open"` = annonce ouverte, `value` = zone (`decide` / `list`), sans écriture en base ; `action:"status"` + `value:"applied"` = candidature **envoyée** (avant cette date, ce couple voulait dire « annonce ouverte » : Postuler était le seul moyen de la lire) ; `action:"close"` + `value:"dead_link"` = lien mort signalé depuis « Pas pour moi » ; `action:"undo"`, `value` = geste annulé (`applied` / `not_for_me` / `dead_link`). Ces events partent **après** confirmation de l'écriture.`
   - remplacer toute la ligne `jobs_feedback` par :
```markdown
| `jobs_feedback` | `{verdict, reason, job_id, score_at_vote}` | `cockpit/panel-jobs-radar.jsx::notForMe()` — décision « Pas pour moi » : `verdict:"down"`, `reason` = raison sérialisée (`pas crédible` / `trop junior` / `boîte ou secteur`, suivie de ` — précision libre`). **Un event par décision depuis le 2026-09-24 (ADR-52)** ; avant, `voteJob()` en émettait un par case cochée et portait aussi des `up`. `score_at_vote` mesure le désaccord avec le score (doit décroître). **Sonde de valeur, à lire le 2026-10-22** : part des hot leads entrés dans la fenêtre de 7 jours qui reçoivent une décision (postulé, pas pour moi, snooze, lien mort, clôturée) avant d'en sortir ; point de départ ≈ un tiers d'ouverture, aucune décision visible après lecture depuis juin. |
```

Vérifier : `PYTHONUTF8=1 sh -c 'for s in lint_specs_produit validate_spec; do python scripts/$s.py || exit 1; done'` → passent.

- [ ] **Step 8: Commit**

```bash
git add tests/smoke_jobs_panel.mjs cockpit/panel-jobs-radar.jsx cockpit/styles-jobs-radar.css index.html sw.js docs/specs/tab-jobs.md docs/telemetry.md
git commit -F - <<'EOF'
feat(jobs): zone a decider et tri en un geste

« Postuler » etait le seul moyen de lire l'annonce et ecrivait applied :
le statut voulait dire « ouvert », et la routine le relisait comme une
candidature confirmee. Lire et postuler deviennent deux gestes ; le vote
et « Archiver » cedent la place a « Pas pour moi » (trois raisons a un
clic, ou lien mort qui n'est pas un avis). Chaque geste s'annule 5 s et
s'annule seul si l'ecriture echoue. La zone du haut ne montre plus que
les hot leads non tries des 7 derniers jours : 8 cartes au lieu de 82.

Specs mises a jour: tab-jobs
Tests effectues: node tests/smoke_jobs_panel.mjs, node tests/test_jobs_view.mjs,
lint_specs_produit, validate_spec

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Zone « Tes candidatures », issues et relances datées

**Files:**
- Modify: `tests/smoke_jobs_panel.mjs`
- Modify: `cockpit/panel-jobs-radar.jsx`
- Modify: `cockpit/styles-jobs-radar.css`
- Modify: `cockpit/lib/data-loader.js` (fonction `transformJobScan`)
- Modify: `index.html`, `sw.js` (via sync)
- Modify: `docs/specs/tab-jobs.md`, `docs/telemetry.md`, `jarvis/spec.json`, `docs/cowork-routines/jobs-radar.md`

**Interfaces:**
- Consumes (Tâche 1) : `JV.splitApplications`, `JV.applicationCounts`, `JV.OUTCOMES`, `JV.patchOutcome`, `JV.patchNotApplied`, `JV.applicationAgeLabel`, `JV.isApplication`, `JV.normalizeStoredFilters`.
- Consumes (Tâche 3) : `runGesture(offer, patch, { label, gesture, emit })`, `readOffer(offer, zone)`, `jobKey(offer)`, `useJrDismiss`, `startEditNotes`, `saveNotes`, `cancelEditNotes`, `followUpJob(jobId)`, `openMenu` / `setOpenMenu`, `notesEditing`.
- Produces : composants `JrApplications({ offers, handlers })`, `JrApplicationRow`, `JrAppMenu` ; handlers `setOutcome(offer, outcome)`, `notApplied(offer)` ; compteur `inProgressCount`.

- [ ] **Step 1: Write the failing test**

Dans `tests/smoke_jobs_panel.mjs` :
- remplacer le check `liste : 4 lignes (L1, L2, A1, A3)` et la ligne `const rows = …` qui le précède par :
```js
const rows = count(html, '<article class="jr-row ');
check("liste : 2 lignes (L1, L2) — les candidatures ont leur zone", rows === 2, `${rows} lignes`);
```
- remplacer le bloc du check `candidature : lire seulement` (la ligne `const a1 = …` et le `check(...)` qui suit) par rien : A1 quitte la liste.
- ajouter, juste avant `if (failures)` :
```js
// ── Zone « Tes candidatures » ──
check("en-tête : 2 candidatures en cours", html.includes("<strong>2</strong> candidatures en cours"));
check("zone candidatures présente", html.includes("Tes candidatures"));
check("compteurs par issue", html.includes("1 en attente · 1 entretien · 1 avant le 17/08"));
check("repliée par défaut", count(html, '<article class="jr-app ') === 0);
const open = renderPanel(FIXTURE(), { "jr.apps.open.v1": "1" });
const apps = count(open, '<article class="jr-app ');
check("dépliée : 2 candidatures datées", apps === 2, `${apps} lignes`);
check("non datées repliées à part", open.includes("Avant le 17/08 · date de candidature inconnue (1)"));
const a2 = articleOf(open, "A2 en entretien");
check("issue active surlignée", a2.includes('aria-pressed="true">Entretien</button>'), a2.slice(0, 240));
check("une candidature n'a plus de J'ai postulé", !a2.includes("J'ai postulé"));
// ── Filtre « Candidaté » mémorisé par l'ancienne version ──
// Sans normalisation, le filtre montrerait les seules candidatures (avant
// cette tâche) ou une liste vide (après) ; ramené à « Actives », il montre
// L1 et L2, sans puce de statut.
const legacy = renderPanel(FIXTURE(), { "jr.filters.v1": JSON.stringify({ statusFilter: "applied" }) });
check("filtre Candidaté ramené à Actives",
  count(legacy, '<article class="jr-row ') === 2 && legacy.includes("L1 hot trop vieille") && !legacy.includes("Statut :"));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/smoke_jobs_panel.mjs`
Expected: FAIL — `liste : 2 lignes` (4 trouvées), `zone candidatures présente`, `compteurs par issue`, `dépliée : 2 candidatures datées`, `filtre Candidaté ramené à Actives`.

- [ ] **Step 3: Implement — composants de la zone 2**

Dans `cockpit/panel-jobs-radar.jsx` :

**3a.** Remplacer :
```jsx
const JR_STATUS_LABEL = { new: "Nouvelles", to_apply: "À postuler", applied: "Candidaté", closed: "Clôturées", all: "Tout" };
```
par :
```jsx
const JR_STATUS_LABEL = { new: "Nouvelles", to_apply: "À postuler", closed: "Clôturées", all: "Tout" };
```

**3b.** Dans `loadJrFilters`, remplacer `return raw ? JSON.parse(raw) : {};` par :
```jsx
    // Une version antérieure a pu mémoriser le filtre « Candidaté », qui
    // n'existe plus : les candidatures ont leur zone (ADR-52).
    return raw ? JV.normalizeStoredFilters(JSON.parse(raw)) : {};
```

**3c.** Juste avant le commentaire `// ─── Encart calibrage — profil de préférences (rules éditable / observed RO) ───`, ajouter :

```jsx
// ─── Zone 2 — Tes candidatures (ADR-52) ───────────────────
// Repliée par défaut ; l'état plié/déplié est une commodité de ce navigateur.
const JR_APPS_OPEN_KEY = "jr.apps.open.v1";
function loadAppsOpen() {
  try { return localStorage.getItem(JR_APPS_OPEN_KEY) === "1"; } catch { return false; }
}

function JrAppMenu({ offer, open, onToggle, onRead, onFollowUp, onEditNotes, onNotApplied }) {
  const ref = useRefJr(null);
  useJrDismiss(ref, open, () => onToggle(null));
  return (
    <div className="jr-menu" ref={ref}>
      <button
        className="jr-btn jr-btn--icon jr-menu-trigger"
        onClick={(e) => { e.stopPropagation(); onToggle(open ? null : offer.id); }}
        aria-label="Actions"
        aria-expanded={open}
        title="Actions"
      >
        <span className="jr-menu-dots" aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="jr-menu-pop" role="menu">
          {offer.status === "applied" && (
            <button className="jr-menu-item" role="menuitem" onClick={() => { onToggle(null); onFollowUp(offer.id); }}>
              <Icon name="envelope" size={13} stroke={2} />
              <span>Relancer</span>
            </button>
          )}
          <button className="jr-menu-item" role="menuitem" disabled={!offer.url} onClick={() => { onToggle(null); onRead(offer, "applications"); }}>
            <Icon name="eye" size={13} stroke={2} />
            <span>Lire l'annonce</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={() => onEditNotes(offer.id)}>
            <Icon name="file_text" size={13} stroke={2} />
            <span>Éditer les notes</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={() => onNotApplied(offer)}>
            <Icon name="archive" size={13} stroke={2} />
            <span>Pas candidaté en fait</span>
          </button>
        </div>
      )}
    </div>
  );
}

function JrApplicationRow({ offer, onRead, onOutcome, onFollowUp, onNotApplied, onEditNotes, onSaveNotes, onCancelNotes, notesEditing, openMenu, onMenuToggle }) {
  const isNotesOpen = notesEditing === offer.id;
  return (
    <article className={`jr-app jr-app--${offer.status}`}>
      <div className="jr-app-main">
        <div className="jr-app-title"><strong>{offer.company}</strong> — {offer.title}</div>
        <div className="jr-app-meta">{JV.applicationAgeLabel(offer, Date.now())}</div>
        {isNotesOpen && <JrNotesEditor offer={offer} onSave={onSaveNotes} onCancel={onCancelNotes} />}
        {!isNotesOpen && offer.user_notes && <div className="jr-app-notes">{offer.user_notes}</div>}
      </div>
      <div className="jr-app-outcomes" role="group" aria-label="Issue de la candidature">
        {JV.OUTCOMES.map((x) => (
          <button
            key={x.status}
            className={`jr-app-outcome ${offer.status === x.status ? "is-on" : ""}`}
            aria-pressed={offer.status === x.status}
            onClick={() => onOutcome(offer, x.status)}>{x.label}</button>
        ))}
      </div>
      <JrAppMenu
        offer={offer}
        open={openMenu === offer.id}
        onToggle={onMenuToggle}
        onRead={onRead}
        onFollowUp={onFollowUp}
        onEditNotes={onEditNotes}
        onNotApplied={onNotApplied}
      />
    </article>
  );
}

function JrApplications({ offers, handlers }) {
  const [open, setOpen] = useStateJr(loadAppsOpen);
  const [showUndated, setShowUndated] = useStateJr(false);
  const { dated, undated } = JV.splitApplications(offers);
  if (!dated.length && !undated.length) return null;
  const c = JV.applicationCounts(offers);
  const parts = [];
  if (c.applied)   parts.push(`${c.applied} en attente`);
  if (c.interview) parts.push(`${c.interview} entretien${c.interview > 1 ? "s" : ""}`);
  if (c.rejected)  parts.push(`${c.rejected} refus`);
  if (c.ghosted)   parts.push(`${c.ghosted} sans réponse`);
  if (c.undated)   parts.push(`${c.undated} avant le 17/08`);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(JR_APPS_OPEN_KEY, next ? "1" : "0"); } catch {}
  };
  return (
    <section className="jr-apps">
      <button className="jr-apps-head" onClick={toggle} aria-expanded={open}>
        <span className="jr-section-kicker">Tes candidatures</span>
        <span className="jr-apps-counts">{parts.join(" · ")}</span>
        <Icon name={open ? "chevron_up" : "chevron_down"} size={16} stroke={2} />
      </button>
      {open && (
        <div className="jr-apps-body">
          {dated.length === 0 && <p className="jr-apps-empty">Aucune candidature datée pour l'instant.</p>}
          {dated.map((o) => <JrApplicationRow key={o.id} offer={o} {...handlers} />)}
          {undated.length > 0 && (
            <div className="jr-apps-undated">
              <button className="jr-apps-undated-head" onClick={() => setShowUndated((v) => !v)} aria-expanded={showUndated}>
                <Icon name={showUndated ? "chevron_up" : "chevron_down"} size={13} stroke={2} />
                <span>Avant le 17/08 · date de candidature inconnue ({undated.length})</span>
              </button>
              {showUndated && undated.map((o) => <JrApplicationRow key={o.id} offer={o} {...handlers} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Implement — câblage dans `PanelJobsRadar`**

**4a.** Juste après la définition de `deadLink`, ajouter :
```jsx
  // Issues de candidature : re-cliquer l'issue active la retire (retour à applied).
  const setOutcome = (offer, outcome) => {
    const patch = JV.patchOutcome(offer, outcome);
    const found = JV.OUTCOMES.find(x => x.status === patch.status);
    runGesture(offer, patch, {
      label: found ? `Issue enregistrée · ${found.label}` : "Issue retirée",
      gesture: "outcome",
      emit: () => window.track && window.track("jobs_action", { action: "status", job_id: jobKey(offer), value: patch.status }),
    });
  };
  // Corrige un « applied » qui n'était qu'une lecture (avant ADR-52).
  const notApplied = (offer) => runGesture(offer, JV.patchNotApplied(), {
    label: "Retirée de tes candidatures", gesture: "not_applied",
    emit: () => window.track && window.track("jobs_action", { action: "not_applied", job_id: jobKey(offer), value: "" }),
  });
```

**4b.** Juste après l'objet `cardHandlers`, ajouter :
```jsx
  const appHandlers = {
    onRead: readOffer,
    onOutcome: setOutcome,
    onFollowUp: followUpJob,
    onNotApplied: notApplied,
    onEditNotes: startEditNotes,
    onSaveNotes: saveNotes,
    onCancelNotes: cancelEditNotes,
    notesEditing,
    openMenu,
    onMenuToggle: setOpenMenu,
  };
```

**4c.** Remplacer le commentaire de la ligne `const [statusFilter,setStatusFilter] …` : `// active = new+to_apply+applied` → `// active = new + to_apply (les candidatures ont leur zone)`. Dans `passesFilters`, remplacer :
```jsx
        if (!(o.status === "new" || o.status === "to_apply" || o.status === "applied")) return false;
```
par :
```jsx
        if (!(o.status === "new" || o.status === "to_apply")) return false;
```

**4d.** Dans `listOffers`, remplacer :
```jsx
    let arr = offers.filter(o => passesFilters(o) && !heroIds.has(o.id));
```
par :
```jsx
    // Les candidatures vivent dans « Tes candidatures », jamais dans la liste.
    let arr = offers.filter(o => passesFilters(o) && !heroIds.has(o.id) && !JV.isApplication(o));
```

**4e.** Juste après `decideCount`, ajouter :
```jsx
  // « En cours » = candidatures datées en attente ou en entretien.
  const inProgressCount = useMemoJr(() =>
    JV.splitApplications(offers).dated.filter(o => o.status === "applied" || o.status === "interview").length,
  [offers]);
```
et dans `<div className="jr-header-stats">`, juste après `<span><strong>{decideCount}</strong> à décider</span>`, ajouter :
```jsx
            <span className="jr-sep">·</span>
            <span><strong>{inProgressCount}</strong> candidatures en cours</span>
```

**4f.** Juste avant `{/* ─── FILTERS + LIST ─── */}`, ajouter :
```jsx
      {/* ─── ZONE 2 — TES CANDIDATURES ─── */}
      <JrApplications offers={offers} handlers={appHandlers} />
```

**4g.** Dans `JrFilterBar`, dans le `FilterGroup` du statut, supprimer l'option `{ id: "applied", label: "Candidaté" },` (la ligne devient `{ id: "to_apply", label: "À postuler" },` seule, suivie de `{ id: "closed", label: "Clôturées" }, { id: "all", label: "Tout" },`).

- [ ] **Step 5: Implement — relances datées, CSS, index.html, service worker**

1. `cockpit/lib/data-loader.js`, dans `transformJobScan`, remplacer :
```js
        .filter(j => j.status === "applied")
```
par :
```js
        // Relances : seulement les candidatures datées. Les candidatures
        // d'avant le 2026-08-17 n'ont pas d'applied_at, et une partie n'était
        // qu'une lecture d'annonce (ADR-52) : les relancer n'aurait aucun sens.
        .filter(j => j.status === "applied" && j.applied_at)
```
2. `cockpit/styles-jobs-radar.css` — ajouter à la fin du fichier :
```css
/* ─── Zone 2 — Tes candidatures (ADR-52) ──────────────────── */
.jr-apps {
  margin: 0 0 40px; border: 1px solid var(--bd); border-radius: var(--radius-lg);
  background: var(--surface); overflow: hidden;
}
.jr-apps-head {
  width: 100%; display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: transparent; border: 0; cursor: pointer;
  color: var(--tx); text-align: left;
}
.jr-apps-head .jr-section-kicker { margin: 0; color: var(--tx); }
.jr-apps-counts { flex: 1; font-family: var(--font-sans); font-size: 12.5px; color: var(--tx2); }
.jr-apps-body { border-top: 1px solid var(--bd); }
.jr-apps-empty { margin: 0; padding: 14px 18px; font-family: var(--font-sans); font-size: 13px; color: var(--tx2); }
.jr-app {
  display: grid; grid-template-columns: 1fr auto auto; gap: 16px; align-items: center;
  padding: 12px 18px; border-bottom: 1px solid var(--bd);
}
.jr-app:last-child { border-bottom: 0; }
.jr-app--rejected, .jr-app--ghosted { opacity: 0.6; }
.jr-app-main { min-width: 0; }
.jr-app-title {
  font-family: var(--font-sans); font-size: 13.5px; color: var(--tx);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.jr-app-meta { font-family: var(--font-mono); font-size: 11px; color: var(--tx3); margin-top: 3px; }
.jr-app-notes { font-family: var(--font-sans); font-size: 12.5px; color: var(--tx2); margin-top: 6px; }
.jr-app-outcomes { display: inline-flex; gap: 4px; }
.jr-app-outcome {
  padding: 5px 10px; border-radius: var(--radius); border: 1px solid var(--bd2);
  background: transparent; color: var(--tx2); font-family: var(--font-sans); font-size: 11.5px; cursor: pointer;
}
.jr-app-outcome:hover { color: var(--tx); border-color: var(--tx2); }
.jr-app-outcome.is-on { background: var(--tx); border-color: var(--tx); color: var(--bg); }
.jr-apps-undated { border-top: 1px dashed var(--bd); }
.jr-apps-undated-head {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 10px 18px; background: transparent; border: 0; cursor: pointer;
  font-family: var(--font-sans); font-size: 12px; color: var(--tx3); text-align: left;
}
.jr-apps-undated-head:hover { color: var(--tx); }
@media (max-width: 900px) {
  .jr-app { grid-template-columns: 1fr auto; }
  .jr-app-outcomes { grid-column: 1 / -1; }
}
```
3. `index.html` : `styles-jobs-radar.css?v=6` → `?v=7` ; `panel-jobs-radar.jsx?v=6` → `?v=7` ; `cockpit/lib/data-loader.js?v=43` → `?v=44`.
4. Run: `node scripts/sync-sw.mjs`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `node tests/smoke_jobs_panel.mjs && node tests/test_jobs_view.mjs && node tests/test_sw_static.mjs && node tests/test_mediatheque_entry.mjs`
Expected: `smoke OK`, `tous les tests passent`, aucun `FAIL`.

- [ ] **Step 7: Documenter (même commit)**

1. `docs/specs/tab-jobs.md` :
   - Ligne d'accroche (blockquote sous le titre) : remplacer par `> Feed d'offres scorées par fit (0-10) via un scan automatisé 3×/semaine (routine Claude Code distante sur API jobs structurée), réparti en trois zones — « À décider » (hot leads des 7 derniers jours pas encore triés), « Tes candidatures » (suivi et issues) et le reste du scan en liste dense filtrable —, avec un tri en un geste (lire / j'ai postulé / pas pour moi) persisté en DB et un rafraîchissement temps réel via Supabase channels.`
   - `## Finalité fonctionnelle` : remplacer `affiche en tête les offres ≥7 **à décider** (entrées depuis moins de 7 jours, pas encore triées) + le reste en liste dense filtrable.` par `affiche en tête les offres ≥7 **à décider** (entrées depuis moins de 7 jours, pas encore triées), puis la zone **« Tes candidatures »** (suivi, issues entretien / refus / sans réponse), puis le reste en liste dense filtrable.`
   - `## Parcours utilisateur` : à l'étape 2, remplacer `("N à décider · T au total dans le radar")` par `("N à décider · M candidatures en cours · T au total dans le radar")` ; insérer après l'étape 5 la nouvelle étape `6. Dépliage de « Tes candidatures » — les candidatures envoyées avec leur ancienneté, entretiens d'abord ; « Entretien » / « Refus » / « Sans réponse » en un clic (re-cliquer retire l'issue) et un menu (Relancer, Lire l'annonce, Éditer les notes, Pas candidaté en fait). Les candidatures d'avant le 17 août, sans date connue, sont repliées dessous.` puis renuméroter les étapes suivantes de 7 à 10 ; dans l'étape « Liste dense en dessous », ajouter à la fin : ` Les candidatures n'y figurent plus.`
   - `## Fonctionnalités` : juste après la puce **Tri en un geste**, ajouter :
     `- **Tes candidatures** : une section repliable (son état est mémorisé) liste les candidatures envoyées avec leur ancienneté — entretiens d'abord, puis en attente, puis refus et sans réponse — et permet de poser l'issue en un clic (Entretien / Refus / Sans réponse, re-cliquer pour la retirer), de relancer, de lire l'annonce ou de corriger une offre marquée par erreur (« Pas candidaté en fait »). Son en-tête compte les candidatures par issue ; celles d'avant le 17 août, sans date connue, sont repliées à part.`
   - Puce **Scan banner** : `actions du jour (relances + entretiens à préparer)` → `actions du jour (relances des candidatures datées + entretiens à préparer)`.
   - Puce **Liste dense filtrable** : ajouter à la fin ` Les candidatures n'y figurent plus : elles vivent dans « Tes candidatures ».`
   - Puce **Masquage des offres clôturées** : `Une offre déjà postulée reste visible dans le pipeline.` → `Une candidature reste visible dans « Tes candidatures », quelle que soit son issue.`
   - `## Front — structure UI` : juste après la ligne `.jr-hot-section`, ajouter `` - `<JrApplications>` → `.jr-apps` : en-tête repliable (compteurs par issue) + `.jr-apps-body` avec des `<JrApplicationRow>` (`.jr-app`, issues + `<JrAppMenu>`) et le groupe replié `.jr-apps-undated` ``.
   - `## Front — fonctions JS` : ajouter les lignes :
```markdown
| `JrApplications({ offers, handlers })` / `JrApplicationRow` / `JrAppMenu` | Zone « Tes candidatures » : datées / non datées (`splitApplications`), issues à un clic, menu Relancer / Lire / Notes / Pas candidaté ; état plié mémorisé (`jr.apps.open.v1`) | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `setOutcome(offer, outcome)` / `notApplied(offer)` | Issue de candidature (re-clic = retrait) et correction d'un faux « applied », via `runGesture` | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
```
   - `## États & edge cases` : ajouter
     `` - **Candidature clôturée** : reste dans « Tes candidatures », jamais masquée. ``
     `` - **Candidature non datée qui reçoit une issue** : reste dans le groupe « Avant le 17/08 ». ``
     `` - **Filtre mémorisé « Candidaté »** (version antérieure) : ramené à « Actives » au chargement. ``
   - `## Dernière MAJ` : insérer en première ligne sous le titre :
     `2026-09-24 — **Zone « Tes candidatures » (ADR-52)** : les candidatures quittent la liste dense pour une section repliable qui pose l'issue en un clic (entretien / refus / sans réponse — statuts ouverts par `sql/030`, jamais écrits jusqu'ici) et corrige les faux positifs (« Pas candidaté en fait »). Les 30 candidatures d'avant le 2026-08-17 (sans date de candidature) y sont repliées ; aucune donnée corrigée automatiquement. Les relances d'« Actions du jour » ne portent plus que sur les candidatures datées. En-tête : « N à décider · N candidatures en cours ». L'option de filtre « Candidaté » disparaît.`
2. `docs/telemetry.md`, ligne `jobs_action` : ajouter à la fin de la cellule de description : ` Zone « Tes candidatures » : `action:"open"` avec `value:"applications"` ; `action:"status"` + `value` ∈ `interview` / `rejected` / `ghosted` = issue posée, `value:"applied"` depuis une issue = issue retirée ; `action:"not_applied"` = une candidature corrigée en « pas candidaté » ; `action:"undo"` peut aussi valoir `outcome` / `not_applied`.`
3. `jarvis/spec.json`, onglet `"id": "jobs"` : remplacer la valeur de `"description"` par `"Scan d'offres scoré par fit (hot/mid/low). Trois zones : à décider (hot leads des 7 derniers jours), tes candidatures (issues), reste du scan. Tri en un geste : lire, j'ai postulé, pas pour moi."` (ne pas toucher `frequency` ni `update_details`).
4. `docs/cowork-routines/jobs-radar.md`, section `## Contrat de données`, juste après la puce qui commence par `` - `status` = `new` si `score_total ≥ 5` ``, ajouter :
   `` - **Sens de `applied` (ADR-52)** : depuis le 2026-09-24, `applied` = candidature **envoyée** — le front sépare « Lire l'annonce » (aucune écriture) de « J'ai postulé ». Avant cette date, `applied` pouvait ne vouloir dire qu'« annonce ouverte » : les lignes sans `applied_at` sont à lire avec prudence. Le front écrit aussi les issues `interview` / `rejected` / `ghosted`, que le trigger hérite comme `applied` (`sql/035`). ``

Vérifier : `PYTHONUTF8=1 sh -c 'for s in lint_claude_md lint_known_sections lint_specs_produit validate_architecture validate_spec; do python scripts/$s.py || exit 1; done'` → les cinq passent.

- [ ] **Step 8: Commit**

```bash
git add tests/smoke_jobs_panel.mjs cockpit/panel-jobs-radar.jsx cockpit/styles-jobs-radar.css cockpit/lib/data-loader.js index.html sw.js docs/specs/tab-jobs.md docs/telemetry.md jarvis/spec.json docs/cowork-routines/jobs-radar.md
git commit -F - <<'EOF'
feat(jobs): zone tes candidatures et issues en un clic

Les statuts interview, rejected et ghosted existaient depuis sql/030
sans qu'aucun bouton ne les ecrive : le systeme ne voyait aucun retour
de candidature. Les candidatures quittent la liste pour une zone
repliable qui pose l'issue en un clic et corrige les faux « applied »
(« Pas candidate en fait »). Les 30 candidatures non datees y sont
repliees, rien n'est corrige automatiquement ; les relances ne visent
plus que les candidatures datees.

Specs mises a jour: tab-jobs
Tests effectues: node tests/smoke_jobs_panel.mjs, node tests/test_jobs_view.mjs,
5 linters bloquants

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Vérification complète, publication, contrôle en production

**Files:**
- Modify (seulement si la publication n'a pas lieu le 2026-09-24) : `docs/telemetry.md`, `docs/cowork-routines/jobs-radar.md`
- Modify (hors dépôt) : mémoire `project_jobs_fit_plat.md`

**Interfaces:**
- Consumes : la branche `feat/jobs-radar-triage` complète (Tâches 1 à 4).
- Produces : `main` publié, contrôle en production consigné.

- [ ] **Step 1: Run the full suite**

Run (Bash) :
```bash
PYTHONUTF8=1 sh -c 'for s in lint_claude_md lint_known_sections lint_specs_produit validate_architecture validate_spec; do python scripts/$s.py || exit 1; done' && echo "LINTERS OK"
sh -c 'for f in tests/test_*.mjs; do node "$f" > /dev/null || { echo "ECHEC $f"; exit 1; }; done' && echo "MJS OK"
PYTHONUTF8=1 sh -c 'for f in tests/test_*.py; do python "$f" > /dev/null || { echo "ECHEC $f"; exit 1; }; done' && echo "PY OK"
node tests/smoke_jobs_panel.mjs | tail -1
```
Expected: `LINTERS OK`, `MJS OK`, `PY OK`, `smoke OK`.

- [ ] **Step 2: Dater la bascule**

Si la publication a lieu un autre jour que le 2026-09-24, remplacer dans `docs/telemetry.md` (lignes `jobs_action` et `jobs_feedback`) et dans la puce « Sens de `applied` » de `docs/cowork-routines/jobs-radar.md` les mentions « depuis le 2026-09-24 » / « Depuis le 2026-09-24 » par la date réelle de publication, puis commiter (`docs(jobs): date de bascule du sens de applied`). Sinon, ne rien faire.

- [ ] **Step 3: STOP — feu vert de l'utilisateur**

Montrer `git log --oneline main..feat/jobs-radar-triage` et demander explicitement : « Je publie sur `main` (dépôt public) ? ». **Ne rien pousser sans un oui.**

- [ ] **Step 4: Publier**

```bash
git switch main
git merge --no-ff feat/jobs-radar-triage -m "Merge: Jobs Radar — tri en un geste, lire n'est plus postuler (ADR-52)"
git push origin main
```
Puis attendre le déploiement Pages : `gh run list --limit 3` jusqu'à voir `pages build and deployment` en `completed success`.

- [ ] **Step 5: Contrôle en production**

1. Noter l'instant de début : `date -u +%Y-%m-%dT%H:%M:%SZ`.
2. Attendu SQL (MCP `execute_sql`) :
```sql
SELECT count(*) AS a_decider FROM public.jobs
WHERE score_total >= 7 AND status IN ('new','to_apply') AND closed_at IS NULL
  AND first_seen_date > current_date - 7;
```
3. Charger les outils Chrome en un seul appel `ToolSearch` (`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text`), puis `tabs_context_mcp`, ouvrir un **nouvel onglet** sur `https://ph3nixx.github.io/jarvis-cockpit/`, hard-refresh (deux fois si le service worker sert l'ancienne version), ouvrir « Jobs Radar ». Si l'extension n'est pas connectée : demander à l'utilisateur de faire les gestes ci-dessous et vérifier uniquement par SQL.
4. Vérifier à l'écran : titre « À décider · 7 derniers jours », nombre de cartes = `a_decider` (filtres par défaut), aucun bouton « Postuler sur LinkedIn », aucune icône de pouce, section « Tes candidatures » repliée avec ses compteurs.
5. Sur une offre **de la liste** à faible enjeu (bande 5–7, statut nouveau), dans cet ordre, en relisant la ligne en base après chaque geste (`SELECT status, applied_at, user_verdict, user_verdict_reason, closed_at FROM jobs WHERE id = '<id>';`) :
   - « J'ai postulé » → `applied` + `applied_at` posé → « Annuler » → retour à `new`, `applied_at` nul ;
   - « Pas pour moi » › « Trop junior » → `archived`, `down`, `trop junior` → « Annuler » → retour à l'état initial ;
   - « Pas pour moi » › « Lien mort » → `closed_at` posé → « Annuler » → `closed_at` nul.
6. Dans « Tes candidatures », sur une candidature datée : « Entretien » → `interview` → re-cliquer → `applied`.
7. Lister les events de test pour les exclure des mesures :
```sql
SELECT id, ts, event_type, payload FROM public.usage_events
WHERE ts >= '<instant de début>' AND event_type IN ('jobs_action','jobs_feedback') ORDER BY ts;
```

- [ ] **Step 6: Mémoire et compte rendu**

Mettre à jour `C:\Users\johnb\.claude\projects\C--Users-johnb-projects-jarvis-cockpit\memory\project_jobs_fit_plat.md` : ajouter une ligne « À partir du <date de publication> (ADR-52), la métrique d'ouverture se lit sur `jobs_action` `action:"open"` ; `status → applied` veut dire candidature envoyée. Les events de test du contrôle en production sont les ids <liste>. » Puis rendre compte à l'utilisateur : ce qui est en production, ce qui a été vérifié (écran + base), les ids des events de test, et le rappel de la sonde de valeur du 2026-10-22.
