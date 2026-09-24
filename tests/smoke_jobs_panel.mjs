// Smoke test du panel Jobs Radar : rendu statique en Node, sans navigateur.
// Usage manuel — réseau au premier lancement (téléchargement de Babel), hors CI.
// Run: node tests/smoke_jobs_panel.mjs
//
// Transforme le vrai cockpit/panel-jobs-radar.jsx avec @babel/standalone (même
// version qu'index.html, mise en cache dans le dossier temporaire), l'exécute
// contre un mini-React qui sérialise l'arbre en pseudo-HTML, puis vérifie les
// zones sur un jeu d'offres fictives. Attrape les exceptions de rendu et les
// erreurs de répartition avant de pousser — ce dépôt est public, pousser est
// une publication. Les hooks sont inertes : les clics se testent en appelant les
// onClick de l'arbre rendu, la logique pure dans tests/test_jobs_view.mjs, et la
// mise en page (empilement, rognage des menus) dans Chrome headless s'il est
// installé (CHROME_PATH pour l'indiquer).
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
// FORCE_TRUE ouvre, le temps d'un rendu, les états locaux initialisés à false
// (popover « Pas pour moi ») : les hooks étant inertes, c'est le seul moyen
// de rendre un popover ouvert.
let FORCE_TRUE = false;
const FRAGMENT = Symbol("fragment");
const RAW = Symbol("raw");
const h = (type, props, ...children) => ({ type, props: props || {}, children });
const React = {
  createElement: h,
  Fragment: FRAGMENT,
  useState: (init) => {
    const v = typeof init === "function" ? init() : init;
    return [FORCE_TRUE && v === false ? true : v, () => {}];
  },
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
  if (type === RAW) return props.html;
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

// Contexte d'exécution du panel. `calls` reçoit chaque window.track() ;
// les minuteurs sont inertes (le toast programme 5 s qui retiendraient Node).
// `icon` : "tag" pour les checks de balisage, "svg" pour la mise en page.
function contextFor(offers, storage = {}, calls = [], icon = "tag") {
  const store = { ...storage };
  const ctx = {
    React, console, setTimeout: () => 0, clearTimeout: () => {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    document: { addEventListener() {}, removeEventListener() {}, querySelector: () => null },
    Icon: icon === "svg"
      ? ({ name, size = 16 }) => h(RAW, { html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><title>${name}</title></svg>` })
      : ({ name }) => h("i", { className: `icon-${name}` }),
    cockpitToast: () => {},
    track: (...args) => { calls.push(args); },
    JOBS_DATA: { offers, scan: SCAN, skillGap: [] },
    PROFILE_DATA: { _values: {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(JOBS_VIEW, ctx);
  vm.runInContext(PANEL, ctx);
  return ctx;
}
function renderPanel(offers, storage = {}) {
  return render(h(contextFor(offers, storage).PanelJobsRadar, {}));
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
const rows = count(html, '<article class="jr-row ');
check("liste : 2 lignes (L1, L2) — les candidatures ont leur zone", rows === 2, `${rows} lignes`);

// ── Zone vide ──
const quiet = renderPanel(FIXTURE().filter((o) => !o.title.startsWith("D")));
check("zone vide : une ligne le dit", quiet.includes("Rien de nouveau à trier sur les 7 derniers jours."));
const filtered = renderPanel(FIXTURE(), { "jr.filters.v1": JSON.stringify({ catFilter: "cos" }) });
check("zone vide sous filtre", filtered.includes("Rien à décider avec ces filtres."));

// ── Raison d'un « Pas pour moi » visible dans la liste ──
const all = renderPanel(FIXTURE(), { "jr.filters.v1": JSON.stringify({ statusFilter: "all" }) });
check("étiquette de raison", all.includes("écartée · trop junior"));

// ── Zone « Tes candidatures » ──
check("en-tête : 2 candidatures en cours", html.includes("<strong>2</strong> candidatures en cours"));
check("zone candidatures présente", html.includes("Tes candidatures"));
check("compteurs par issue", html.includes("1 en attente · 1 entretien · 1 avant le 17/08"));
check("repliée par défaut", html.includes("Tes candidatures") && count(html, '<article class="jr-app ') === 0);
const open = renderPanel(FIXTURE(), { "jr.apps.open.v1": "1" });
const apps = count(open, '<article class="jr-app ');
check("dépliée : 2 candidatures datées", apps === 2, `${apps} lignes`);
check("non datées repliées à part", open.includes("Avant le 17/08 · date de candidature inconnue (1)"));
const a2 = articleOf(open, "A2 en entretien");
check("issue active surlignée", a2.includes('aria-pressed="true">Entretien</button>'), a2.slice(0, 240));
check("une candidature n'a plus de J'ai postulé", a2.length > 0 && !a2.includes("J'ai postulé"));
// ── Filtre « Candidaté » mémorisé par l'ancienne version ──
// Sans normalisation, le filtre montrerait les seules candidatures (avant
// cette tâche) ou une liste vide (après) ; ramené à « Actives », il montre
// L1 et L2, sans puce de statut.
const legacy = renderPanel(FIXTURE(), { "jr.filters.v1": JSON.stringify({ statusFilter: "applied" }) });
check("filtre Candidaté ramené à Actives",
  count(legacy, '<article class="jr-row ') === 2 && legacy.includes("L1 hot trop vieille") && !legacy.includes("Statut :"));

// ── Double-clic ──
// Après un geste, la ligne sort ou se re-trie aussitôt : le 2e clic d'un
// double-clic tombe sur le bouton de la ligne voisine, qui a glissé sous le
// pointeur. Ce 2e clic porte event.detail = 2 et doit être ignoré.
function resolve(node) {
  if (node == null || node === false || node === true) return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  if (typeof node !== "object") return [String(node)];
  const { type, props, children } = node;
  if (type === RAW) return [];
  if (type === FRAGMENT) return resolve(children);
  if (typeof type === "function") return resolve(type({ ...props, children: children.length <= 1 ? children[0] : children }));
  return [{ type, props, children: resolve(children) }];
}
function* walk(nodes) {
  for (const n of nodes) {
    if (typeof n !== "object") continue;
    yield n;
    yield* walk(n.children);
  }
}
const textOf = (n) => (typeof n === "string" ? n : n.children.map(textOf).join(""));
const findNode = (nodes, pred) => { for (const n of walk(nodes)) if (pred(n)) return n; return null; };
const click = (btn, detail) => btn.props.onClick({ detail, stopPropagation() {}, preventDefault() {} });
const tick = () => new Promise((r) => setTimeout(r, 0));

{
  const calls = [];
  const ctx = contextFor(FIXTURE(), {}, calls);
  const tree = resolve(h(ctx.PanelJobsRadar, {}));
  const card = findNode(tree, (n) => n.type === "article" && n.props.className === "jr-hot" && textOf(n).includes("D1 à décider"));
  const btn = card && findNode([card], (n) => n.type === "button" && n.props.title === "J'ai postulé");
  click(btn, 2); await tick();
  check("double-clic sur J'ai postulé : le 2e clic est ignoré", calls.length === 0, JSON.stringify(calls));
  click(btn, 1); await tick();
  check("clic simple sur J'ai postulé : le geste part",
    calls.some((c) => c[0] === "jobs_action" && c[1].value === "applied"), JSON.stringify(calls));
}
{
  const got = [];
  const noop = () => {};
  const dated = FIXTURE().filter((o) => ["applied", "interview"].includes(o.status) && o.applied_at);
  const ctx = contextFor([], { "jr.apps.open.v1": "1" });
  const handlers = {
    onRead: noop, onOutcome: (o, s) => got.push(s), onFollowUp: noop, onNotApplied: () => got.push("not_applied"),
    onEditNotes: noop, onSaveNotes: noop, onCancelNotes: noop, notesEditing: null, openMenu: dated[0].id, onMenuToggle: noop,
  };
  const tree = resolve(h(ctx.JrApplications, { offers: dated, handlers }));
  const refus = findNode(tree, (n) => n.type === "button" && textOf(n) === "Refus");
  const undo = findNode(tree, (n) => n.type === "button" && textOf(n).includes("Pas candidaté en fait"));
  click(refus, 2); click(undo, 2);
  check("double-clic sur une issue ou « Pas candidaté » : ignoré", got.length === 0, JSON.stringify(got));
  click(refus, 1); click(undo, 1);
  check("clic simple sur une issue et « Pas candidaté » : transmis", got.length === 2, JSON.stringify(got));
}
{
  const got = [];
  const ctx = contextFor([]);
  FORCE_TRUE = true;
  const tree = resolve(h(ctx.JrNotForMe, { offer: FIXTURE()[0], onDecide: (o, code) => got.push(code), onDeadLink: () => got.push("dead") }));
  FORCE_TRUE = false;
  const junior = findNode(tree, (n) => n.type === "button" && textOf(n) === "Trop junior");
  const dead = findNode(tree, (n) => n.type === "button" && textOf(n).includes("Lien mort"));
  click(junior, 2); click(dead, 2);
  check("double-clic sur une raison « Pas pour moi » : ignoré", got.length === 0, JSON.stringify(got));
  click(junior, 1);
  check("clic simple sur une raison : transmis", got[0] === "trop junior", JSON.stringify(got));
}

// ── Mise en page réelle (Chrome headless) ──
// Le balisage ne dit rien de l'empilement ni du rognage. On rend donc les vrais
// composants avec la vraie CSS dans Chrome, puis on demande à
// document.elementFromPoint ce qui reçoit un clic au centre de chaque entrée
// d'un menu ouvert : l'entrée n'est cliquable que si ce point tombe dans le menu.
// Revue du 2026-09-24 : une ligne atténuée enfermait son popover sous la ligne
// suivante (clic écrit sur la voisine), et overflow:hidden rognait les menus des
// dernières lignes.
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!fs.existsSync(CHROME)) {
  console.log(`SKIP mise en page : Chrome introuvable (${CHROME}) — définir CHROME_PATH`);
} else {
  const { spawnSync } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "jobs-layout-"));
  const TOKENS = ":root{--bg:#F5EFE4;--bg2:#EDE5D6;--bg3:#FBF7EF;--surface:#FFFFFF;--tx:#1F1815;--tx2:#5E524A;--tx3:#766960;--bd:#E0D5C0;--bd2:#C9BBA3;--brand:#C2410C;--brand-tint:#FBEADA;--alert:#B54B3B;--alert-tint:#F4DDD6;--positive:#4D6A3A;--positive-tint:#E9EFDE;--font-display:Georgia,serif;--font-sans:Arial,sans-serif;--font-mono:Consolas,monospace;--radius:6px;--radius-lg:12px;--shadow-md:0 4px 14px rgba(48,32,24,.08)}";
  const PROBE = `window.addEventListener("load", () => {
    const res = [];
    document.querySelectorAll(".jr-menu-pop, .jr-nfm-pop").forEach((pop) => {
      pop.querySelectorAll(".jr-menu-item, .jr-nfm-opt").forEach((it) => {
        const r = it.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        res.push({ label: it.textContent.trim(), ok: !!hit && pop.contains(hit), hit: hit ? (hit.closest("button") || hit).className || hit.tagName : null });
      });
    });
    const pre = document.createElement("pre"); pre.id = "probe"; pre.textContent = JSON.stringify(res);
    document.body.appendChild(pre);
  });`;
  const css = (f) => pathToFileURL(path.join(ROOT, "cockpit", f)).href;
  function probePage(name, inner) {
    const file = path.join(OUT, name + ".html");
    fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8">
<style>${TOKENS} body{margin:0;background:var(--bg)} .wrap{width:1100px;padding:30px}</style>
<link rel="stylesheet" href="${css("styles.css")}"><link rel="stylesheet" href="${css("styles-jobs-radar.css")}">
</head><body><div class="panel panel-jobs-radar"><div class="wrap">${inner}
<div class="after" style="height:600px;background:#eee"></div></div></div><script>${PROBE}</script></body></html>`);
    const run = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${path.join(OUT, "profile")}`, "--window-size=1400,2400", "--dump-dom", pathToFileURL(file).href],
      { encoding: "utf8", timeout: 90000 });
    const m = /<pre id="probe">([\s\S]*?)<\/pre>/.exec(run.stdout || "");
    if (!m) return null;
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
  }
  const layoutCheck = (name, res) => {
    const bad = res ? res.filter((x) => !x.ok).map((x) => `${x.label} → ${x.hit}`) : ["(sonde absente)"];
    check(name, !!res && res.length > 0 && bad.length === 0, `inaccessibles : ${bad.join(" | ")}`);
  };

  const noop = () => {};
  const lx = contextFor([], { "jr.apps.open.v1": "1" }, [], "svg");
  const app = (id, status, applied_at) => ({ ...FIXTURE()[0], id, status, applied_at, title: `Candidature ${id}`, company: `Boîte ${id}` });
  const appsHtml = (offers, openId) => render(h(lx.JrApplications, { offers, handlers: {
    onRead: noop, onOutcome: noop, onFollowUp: noop, onNotApplied: noop, onEditNotes: noop,
    onSaveNotes: noop, onCancelNotes: noop, notesEditing: null, openMenu: openId, onMenuToggle: noop } }));
  const rowHtml = (o, open) => {
    FORCE_TRUE = open;
    const s = render(h(lx.OfferRow, { offer: o, onRead: noop, onApplied: noop, onNotForMe: noop, onDeadLink: noop,
      onSnooze: noop, onEditNotes: noop, onSaveNotes: noop, onCancelNotes: noop, onClose: noop, onReopen: noop,
      openMenu: null, onMenuToggle: noop, notesEditing: null }));
    FORCE_TRUE = false;
    return s;
  };
  const listHtml = (rows) => `<section class="jr-list-section"><div class="jr-list">${rows}</div></section>`;
  const row = (id, status) => ({ ...FIXTURE()[4], id, status, title: `Offre ${id}`, company: `Boîte ${id}` });

  layoutCheck("mise en page : menu d'une candidature refusée au-dessus des lignes atténuées",
    probePage("apps-stack", appsHtml([
      app("i1", "interview", "2026-09-10T10:00:00Z"), app("p1", "applied", "2026-09-20T10:00:00Z"),
      app("r1", "rejected", "2026-09-19T10:00:00Z"), app("g1", "ghosted", "2026-09-18T10:00:00Z"),
      app("r2", "rejected", "2026-09-17T10:00:00Z")], "r1")));
  layoutCheck("mise en page : menu de la dernière candidature non rogné",
    probePage("apps-last", appsHtml([
      app("p1", "applied", "2026-09-22T10:00:00Z"), app("p2", "applied", "2026-09-21T10:00:00Z"),
      app("p3", "applied", "2026-09-20T10:00:00Z"), app("u1", "applied", null)], "p3")));
  layoutCheck("mise en page : « Pas pour moi » d'une ligne archivée au-dessus des suivantes",
    probePage("list-stack", listHtml(rowHtml(row("x1", "archived"), true) + rowHtml(row("x2", "archived"), false) + rowHtml(row("x3", "archived"), false))));
  layoutCheck("mise en page : « Pas pour moi » de la dernière ligne non rogné",
    probePage("list-last", listHtml(rowHtml(row("n1", "new"), false) + rowHtml(row("n2", "new"), true))));
  // Garde-fou : les cartes « À décider » n'avaient pas le défaut, on vérifie
  // qu'elles ne l'acquièrent pas.
  const cardHtml = (o, open) => {
    FORCE_TRUE = open;
    const s = render(h(lx.HotLeadCard, { offer: o, rank: 0, zone: "decide", onRead: noop, onApplied: noop, onNotForMe: noop,
      onDeadLink: noop, onSnooze: noop, onEditNotes: noop, onSaveNotes: noop, onCancelNotes: noop, onClose: noop,
      onReopen: noop, openMenu: null, onMenuToggle: noop, notesEditing: null }));
    FORCE_TRUE = false;
    return s;
  };
  layoutCheck("mise en page : « Pas pour moi » d'une carte À décider au-dessus de la carte suivante",
    probePage("cards", `<section class="jr-hot-section"><div class="jr-hot-grid">${cardHtml(FIXTURE()[0], true)}${cardHtml(FIXTURE()[1], false)}</div></section>`));
}

if (failures) { console.log(`\n${failures} échec(s)`); process.exit(1); }
console.log("\nsmoke OK");
