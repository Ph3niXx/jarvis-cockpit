// Tests des builders du Brief (cockpit/lib/data-loader.js) + garde-fou textuel
// sur cockpit/home.jsx.
//
// Raison d'etre : un pipeline en panne ne vide pas sa table, il cesse de
// l'ecrire. `daily_digest` est mort le 2026-08-18 et le Brief a continue
// d'afficher le contenu du 17 sous la date du jour, avec « Synthese du
// matin » en chapeau. Meme famille de defaut pour signal_tracking, presente
// au present (« N mentions cette semaine ») alors que la ligne date de trois
// semaines, et pour « Prochain brief : demain 06:00 » promis par un pipeline
// arrete depuis quatre jours.
//
// La regle verrouillee ici : AUCUNE formulation temporelle ne doit etre
// ecrite en dur dans le rendu. Elle se derive de la date portee par la
// donnee (brief.date, signal.week_start) ou elle n'est pas affichee.
//
// Run: node tests/test_home_view.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// data-loader.js est un script navigateur (IIFE qui pose window.cockpitDataLoader).
// Deux bouchons suffisent a le charger sous node : `window` pour recuperer
// l'API, `DOMParser` pour stripHtml(). Le bouchon DOM reste volontairement
// naif — aucun test ici ne juge la qualite du strip HTML.
globalThis.window = {};
globalThis.DOMParser = class {
  parseFromString(raw) {
    return { body: { textContent: String(raw).replace(/<[^>]*>/g, " ") } };
  }
};
require(path.join(ROOT, "cockpit", "lib", "data-loader.js"));
const DL = globalThis.window.cockpitDataLoader;

const HOME = fs.readFileSync(path.join(ROOT, "cockpit", "home.jsx"), "utf8");
// Le garde-fou textuel porte sur ce qui est RENDU, pas sur ce qui est
// commenté : les commentaires citent volontairement les formulations
// supprimées pour expliquer pourquoi elles l'ont été.
const HOME_CODE = HOME
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

let failures = 0;
function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) { failures++; console.log(`FAIL ${name}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(got)}`); }
  else console.log(`ok   ${name}`);
}
function checkTrue(name, ok, detail) {
  if (ok) { console.log(`ok   ${name}`); return; }
  failures++;
  console.log(`FAIL ${name}${detail ? "\n  " + detail : ""}`);
}

// Vendredi 21 aout 2026, 09:00 UTC. Le lundi de cette semaine ISO est le 17.
const NOW = Date.parse("2026-08-21T09:00:00Z");
const NOW_EARLY = Date.parse("2026-08-21T04:00:00Z");
const ART = [{ id: "a1", title: "Un article", summary: "Resume." }];
const briefRow = (date) => ({
  date,
  brief_html: "<h1>Titre du brief</h1><p>Corps du brief.</p>",
  article_count: 12,
  created_at: date + "T06:12:00Z",
});

// ── loadDailyBrief : la LIGNE, pas seulement le contenu ──────
// Sans `date`, impossible de savoir que le brief affiche a quatre jours.
{
  let asked = null;
  globalThis.window.sb = { query: async (t, s) => { asked = [t, s]; return [briefRow("2026-08-17")]; } };
  const row = await DL.loadDailyBrief();
  check("loadDailyBrief interroge daily_briefs", asked && asked[0], "daily_briefs");
  check("loadDailyBrief remonte la date", row && row.date, "2026-08-17");
  check("loadDailyBrief remonte article_count", row && row.article_count, 12);
  check("loadDailyBrief remonte created_at", row && row.created_at, "2026-08-17T06:12:00Z");
  globalThis.window.sb = { query: async () => [] };
  check("table vide => null", await DL.loadDailyBrief(), null);
}

// ── buildMacro : dater le brief des qu'il n'est pas du jour ──
{
  const fresh = DL.buildMacro(ART, briefRow("2026-08-21"), NOW);
  check("brief du jour => aucun ecart", fresh.stale_days, 0);
  check("brief du jour => pas de dateline", fresh.dateline, null);
  check("brief du jour => chapeau inchange", fresh.kicker, "Synthèse du matin");
  check("brief du jour => date exposee quand meme", fresh.brief_date, "2026-08-21");

  const stale = DL.buildMacro(ART, briefRow("2026-08-17"), NOW);
  check("brief de lundi => ecart de 4 jours", stale.stale_days, 4);
  check("brief de lundi => dateline explicite", stale.dateline, "Brief du lundi 17 août");
  check("brief de lundi => le chapeau porte la date", stale.kicker, "Brief du lundi 17 août");
  check("brief de lundi => le contenu reste celui de la ligne", stale.title, "Titre du brief");

  const none = DL.buildMacro([], null, NOW);
  check("aucun brief => etat vide inchange", none.title, "Pas encore de brief aujourd'hui");
  check("aucun brief => pas de dateline", none.dateline, null);
  check("aucun brief => pas d'ecart", none.stale_days, null);

  // Des articles mais pas de ligne de brief : rien a dater, on ne fabrique pas.
  const noBrief = DL.buildMacro(ART, null, NOW);
  check("articles sans brief => pas de dateline", noBrief.dateline, null);
  check("articles sans brief => brief_date null", noBrief.brief_date, null);
}

// ── buildStats.next_brief : promesse ou constat ──────────────
{
  const ok = DL.buildStats(ART, [], briefRow("2026-08-21"), NOW);
  check("brief du jour => prochain passage annonce", ok.next_brief, "demain 06:00");
  check("brief du jour => libelle prochain", ok.next_brief_label, "Prochain brief");

  const early = DL.buildStats(ART, [], briefRow("2026-08-20"), NOW_EARLY);
  check("avant 06:00 UTC, brief d'hier => passage du jour", early.next_brief, "aujourd'hui 06:00");

  const late = DL.buildStats(ART, [], briefRow("2026-08-17"), NOW);
  check("4 jours sans brief => on ne promet plus rien", late.next_brief, "lundi 17 août");
  check("4 jours sans brief => libelle constat", late.next_brief_label, "Dernier brief");

  const none = DL.buildStats(ART, [], null, NOW);
  check("aucun brief => constat vide", none.next_brief, "aucun");
  check("aucun brief => libelle constat", none.next_brief_label, "Dernier brief");
}

// ── buildSignals : chaque signal porte sa semaine ────────────
{
  const rows = [
    { term: "agents", mention_count: 12, trend: "rising", delta: 4, category: "Agents",
      week_start: "2026-08-10", history: [3, 8, 12] },
    { term: "sans-date", mention_count: 3, trend: "stable", category: "Autres", history: [3] },
  ];
  const built = DL.buildSignals(rows);
  const byName = Object.fromEntries(built.map(s => [s.name, s]));
  check("week_start remonte jusqu'a la vue", byName.agents.week_start, "2026-08-10");
  check("libelle de semaine derive de la ligne", byName.agents.week_label, "semaine du 10 août");
  check("ligne sans week_start => aucun libelle invente", byName["sans-date"].week_label, null);
  check("ligne sans week_start => week_start null", byName["sans-date"].week_start, null);
}

// ── buildSignalsWeek : l'en-tete de section ──────────────────
// Le kicker affichait « Signaux faibles · S17 » en dur — S34 dans la vraie vie.
{
  const current = DL.buildSignalsWeek([{ term: "a", week_start: "2026-08-17" }], NOW);
  check("semaine courante => numero derive", current.week, "S34");
  check("semaine courante => present", current.verb, "Ce qui émerge");
  check("semaine courante => adverbe autorise car sourcé", current.when, "cette semaine");
  check("semaine courante => current", current.current, true);

  const old = DL.buildSignalsWeek([{ term: "a", week_start: "2026-08-10" }], NOW);
  check("semaine passee => numero derive", old.week, "S33");
  check("semaine passee => imparfait", old.verb, "Ce qui émergeait");
  check("semaine passee => date explicite", old.when, "semaine du 10 août");
  check("semaine passee => pas current", old.current, false);

  // On garde la semaine la PLUS RECENTE : signal_tracking empile les semaines.
  const mixed = DL.buildSignalsWeek(
    [{ term: "a", week_start: "2026-07-27" }, { term: "b", week_start: "2026-08-10" }], NOW);
  check("plusieurs semaines => la plus recente", mixed.iso, "2026-08-10");

  const empty = DL.buildSignalsWeek([], NOW);
  check("aucun signal => pas de numero", empty.week, null);
  check("aucun signal => pas de complement", empty.when, null);
}

// ── buildMorningCard : la raison d'un signal est datee ───────
{
  const signals = DL.buildSignals([
    { term: "agents", mention_count: 12, trend: "rising", delta: 4, category: "Agents",
      week_start: "2026-08-10", history: [3, 8, 12] },
  ]);
  const items = DL.buildMorningCard({ top: [], signals, radar: {} });
  const sig = items.find(i => i.kind === "signal");
  check("raison du signal datee par sa semaine", sig && sig.reason, "12 mentions, semaine du 10 août");

  const noWeek = DL.buildSignals([
    { term: "agents", mention_count: 12, trend: "rising", category: "Agents", history: [12] },
  ]);
  const items2 = DL.buildMorningCard({ top: [], signals: noWeek, radar: {} });
  const sig2 = items2.find(i => i.kind === "signal");
  check("sans week_start => mentions nues", sig2 && sig2.reason, "12 mentions");
}

// ── home.jsx : aucun adverbe temporel ecrit en dur ───────────
// Ces trois chaines etaient dans le rendu. Si l'une revient, le Brief
// recommence a affirmer une fraicheur qu'il ne mesure pas.
checkTrue("plus de « cette semaine » en dur dans home.jsx",
  !/cette semaine/.test(HOME_CODE),
  "la formulation doit venir de signals_week / signal.week_label");
checkTrue("plus de numero de semaine en dur dans home.jsx",
  !/·\s*S\d{2}/.test(HOME_CODE),
  "le numero de semaine doit venir de signals_week.week");
checkTrue("plus de « brief de demain » en dur dans home.jsx",
  !/brief de demain/.test(HOME_CODE),
  "l'etat zero ne doit pas promettre un brief que le pipeline ne produit plus");

// Anti-vacuite : les checks ci-dessus passeraient sur un home.jsx qui
// n'afficherait plus rien. On verifie que le rendu lit bien les champs.
checkTrue("home.jsx affiche la dateline du brief", /macro\.dateline/.test(HOME));
checkTrue("home.jsx lit l'ecart de fraicheur", /macro\.stale_days/.test(HOME));
checkTrue("home.jsx lit le libelle du prochain brief", /stats\.next_brief_label/.test(HOME));
checkTrue("home.jsx lit la semaine des signaux", /signals_week/.test(HOME));
checkTrue("home.jsx lit la semaine d'un signal", /signal\.week_label/.test(HOME));

console.log(failures ? `\n${failures} test(s) en echec` : "\nTous les tests passent");
process.exit(failures ? 1 : 0);
