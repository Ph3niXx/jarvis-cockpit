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
