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
