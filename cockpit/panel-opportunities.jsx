// ═══════════════════════════════════════════════════════════════
// PANEL OPPORTUNITÉS — Fenêtres de tir à saisir
// ─────────────────────────────────────────────
// Hero → flagship (top priority) → view switcher
//   · Éditorial : feed dense par scope
//   · Kanban    : colonnes par timing
//   · Fenêtres  : timeline des dates de fermeture
// Actions dominantes : "Je saisis" vs "Je passe"
// ═══════════════════════════════════════════════════════════════

const { useState: useStateOp, useMemo: useMemoOp, useEffect: useEffectOp } = React;

const SCOPES = [
  { id: "all",       label: "Tous" },
  { id: "business",  label: "Business",     name: "Business",          sub: "Monétiser, vendre, positionner" },
  { id: "side",      label: "Side project", name: "Side project",      sub: "Dev perso, contenu, visibilité" },
  { id: "life",      label: "Life",         name: "Vie perso",         sub: "Famille, santé, finance" },
  { id: "jarvis",    label: "Jarvisception",name: "Jarvisception",     sub: "Faire évoluer le cockpit lui-même" },
];

const EFFORT_LABEL = { weekend: "Weekend", "1m": "~1 mois", "3m": "~3 mois", "6m": "6+ mois" };
const EFFORT_LEVEL = { weekend: 1, "1m": 2, "3m": 3, "6m": 4 };
const COMPETITION_LABEL = { low: "Peu", med: "Modérée", high: "Forte" };
const COMPETITION_LEVEL = { low: 1, med: 2, high: 3 };

const URGENCY_ORDER = { closing: 0, getting_late: 1, right_time: 2, too_early: 3 };
const URGENCY_LABEL = {
  closing:      "Se dépêcher",
  getting_late: "Fenêtre qui se rétrécit",
  right_time:   "Bon moment",
  too_early:    "Trop tôt",
};

// ─── utilities ───────────────────────────────────────────
function formatWindow(w) {
  if (!w) return { label: "—", sub: "" };
  if (!w.closes_iso) return { label: "perpétuel", sub: "pas de deadline" };
  return { label: w.closes_in, sub: "avant fermeture" };
}

// progress: 0 (just opened) → 1 (fully closed). Fake based on urgency.
function windowProgress(w) {
  if (!w || !w.closes_iso) return 0.15;
  if (w.urgency === "closing")      return 0.85;
  if (w.urgency === "getting_late") return 0.6;
  if (w.urgency === "right_time")   return 0.3;
  return 0.1;
}

// ─── Effort gauge ────────────────────────────────────────
function EffortGauge({ effort }) {
  const level = EFFORT_LEVEL[effort] || 1;
  return (
    <span className="opp-effort">
      <span className="opp-effort-dots">
        {[1, 2, 3, 4].map(i => (
          <span key={i}
            className={`opp-effort-dot ${i <= level ? "is-filled" : ""} ${i <= level && level >= 3 ? "is-filled--long" : ""}`}
          />
        ))}
      </span>
      <span>{EFFORT_LABEL[effort] || "—"}</span>
    </span>
  );
}

function CompetitionBars({ competition }) {
  const level = COMPETITION_LEVEL[competition] || 1;
  const heights = [7, 11, 15];
  return (
    <span className="opp-comp">
      <span className="opp-comp-bars">
        {[1, 2, 3].map(i => (
          <span key={i}
            className={`opp-comp-bar ${i <= level ? `is-filled--${competition}` : ""}`}
            style={{ height: heights[i - 1] }}
          />
        ))}
      </span>
      <span>Concurrence {COMPETITION_LABEL[competition]}</span>
    </span>
  );
}

// Ring visuel pour le % match (0-100). Couleur échelle : <50 gris, 50-69 neutre, 70-84 brand, 85+ positive.
function MatchRing({ value, size = 64, stroke = 5 }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  const level = v >= 85 ? "high" : v >= 70 ? "mid" : v >= 50 ? "low" : "none";
  return (
    <div className={`opp-match-ring opp-match-ring--${level}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--bd)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="opp-match-ring-inner">
        <span className="opp-match-ring-val">{v}</span>
        <span className="opp-match-ring-unit">% match</span>
      </div>
    </div>
  );
}

function SignalChip({ name, onClick }) {
  // find trend from SIGNALS_DATA if available
  const sig = (window.SIGNALS_DATA?.signals || []).find(s => s.name === name);
  const trend = sig?.trend || "stable";
  return (
    <button className="opp-sig-chip" onClick={onClick}>
      <span className={`opp-sig-chip-dot opp-sig-chip-dot--${trend}`} />
      <span>{name}</span>
    </button>
  );
}

// ─── Flagship (top priority opportunity) ─────────────────
function FlagshipCard({ opp, onTake, onPass, onOpenSignal, onAskJarvis, onSendToIdeas }) {
  const w = opp.window || {};
  const progress = windowProgress(w);
  const barCls = w.urgency === "closing" ? "opp-flagship-window-bar-fill--closing"
               : w.urgency === "getting_late" ? "opp-flagship-window-bar-fill--closing"
               : "";
  return (
    <article className="opp-flagship">
      <div className="opp-flagship-main">
        <div className="opp-flagship-kicker">
          {opp.kicker} · Opportunité flagship de la semaine
        </div>
        <h2 className="opp-flagship-title">{opp.title}</h2>
        <p className="opp-flagship-teaser">{opp.teaser}</p>

        <div className="opp-flagship-nextstep">
          <strong>Next step</strong>
          {opp.next_step}
        </div>

        <div className="opp-flagship-actions">
          <button className="btn btn--primary" onClick={() => onTake(opp.id)}>
            <Icon name="check" size={14} stroke={2} /> Je saisis
          </button>
          <button className="btn btn--ghost" onClick={() => onPass(opp.id)}>
            Je passe
          </button>
          <button className="btn btn--ghost" onClick={() => onAskJarvis && onAskJarvis(opp)}>
            <Icon name="assistant" size={14} stroke={1.75} /> Plan d'action
          </button>
        </div>
      </div>

      <div className="opp-flagship-side">
        <div>
          <div className="opp-flagship-window-label">Fenêtre de tir</div>
          <div className="opp-flagship-window-val">{w.closes_in || "—"}</div>
          <div className="opp-flagship-window-sub">
            {w.closes_iso ? `ferme le ${new Date(w.closes_iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}` : "pas de deadline"}
          </div>
        </div>

        <div className="opp-flagship-window-bar">
          <div className="opp-flagship-window-bar-track">
            <div className={`opp-flagship-window-bar-fill ${barCls}`} style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="opp-flagship-window-bar-sub">
            <span>ouverte S{w.opens?.replace("S", "")}</span>
            <span>{URGENCY_LABEL[w.urgency] || URGENCY_LABEL.right_time}</span>
          </div>
        </div>

        <div className="opp-flagship-side-signals">
          <div className="opp-flagship-side-signals-label">Pourquoi maintenant · signaux convergents</div>
          <div>
            {(opp.signals || []).map(s => (
              <SignalChip key={s} name={s} onClick={() => onOpenSignal(s)} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Card (editorial row) ────────────────────────────────
function OppCard({ opp, open, onToggle, onTake, onPass, onReset, onOpenSignal, onAskJarvis, onSendToIdeas }) {
  const w = opp.window || {};
  const cls = `opp-card ${opp.status === "taken" ? "is-taken" : ""} ${opp.status === "passed" ? "is-passed" : ""}`;
  const progress = windowProgress(w);
  const winCls = w.urgency === "closing" ? "--closing"
               : w.urgency === "getting_late" ? "--getting"
               : "";

  return (
    <article className={cls} onClick={onToggle} data-opp-id={opp.id}>
      <div className="opp-card-match">
        <MatchRing value={opp.match} />
      </div>

      <div className="opp-card-body">
        <div className="opp-card-kicker">{opp.kicker}</div>
        <h3 className="opp-card-title">{opp.title}</h3>
        <p className="opp-card-teaser">{opp.teaser}</p>
        <div className="opp-card-meta">
          <EffortGauge effort={opp.effort} />
          <span className="opp-card-meta-sep">·</span>
          <CompetitionBars competition={opp.competition} />
        </div>
      </div>

      <div className="opp-card-window" onClick={(e) => e.stopPropagation()}>
        <span className="opp-card-window-label">Fenêtre</span>
        <span className={`opp-card-window-val opp-card-window-val${winCls}`}>{w.closes_in}</span>
        <div className="opp-card-window-bar">
          <div className={`opp-card-window-bar-fill opp-card-window-bar-fill${winCls}`} style={{ width: `${progress * 100}%` }} />
        </div>
        {(opp.signals || []).length > 0 && (
          <div className="opp-card-signals">
            <span className="opp-card-signals-lbl">Signaux source</span>
            {opp.signals.slice(0, 3).map(s => (
              <button key={s} className="opp-card-sig" onClick={(e) => { e.stopPropagation(); onOpenSignal(s); }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <>
          <div className="opp-detail" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="opp-detail-section-label">Analyse</div>
              <p className="opp-detail-body">{opp.body}</p>
              {opp.why_you && (
                <div className="opp-detail-why">
                  <strong style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tx2)", display: "block", marginBottom: 4, fontWeight: 500 }}>Pourquoi toi</strong>
                  {opp.why_you}
                </div>
              )}
            </div>
            <div>
              <div className="opp-detail-section-label">Sources</div>
              <div className="opp-detail-sources">
                {(opp.sources || []).length > 0 ? opp.sources.map((s, i) => {
                  const inner = (
                    <>
                      <span><strong style={{ color: "var(--tx)" }}>{s.who}</strong>{s.what ? <> — {s.what}</> : null}</span>
                      <span>{s.when}</span>
                    </>
                  );
                  return s.url ? (
                    <a key={i} className="opp-detail-source opp-detail-source--link" href={s.url} target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  ) : (
                    <div key={i} className="opp-detail-source">{inner}</div>
                  );
                }) : (
                  <div style={{ color: "var(--tx3)" }}>Pas de source externe — opportunité intuition / réseau.</div>
                )}
              </div>
              <div className="opp-detail-nextstep">
                <strong>Next step</strong>
                {opp.next_step}
              </div>
            </div>
            <div className="opp-detail-actions">
              {opp.status === "open" ? (
                <>
                  <button className="btn btn--primary opp-cta-take" onClick={() => onTake(opp.id)}>
                    <Icon name="check" size={14} stroke={2} /> Je saisis
                  </button>
                  <button className="btn btn--ghost opp-cta-pass" onClick={() => onPass(opp.id)}>
                    Je passe
                  </button>
                </>
              ) : (
                <>
                  <span className={`opp-status-badge opp-status-badge--${opp.status}`}>
                    {opp.status === "taken" ? "✓ Saisie" : "× Passée"}
                  </span>
                  <button className="btn btn--ghost" onClick={() => onReset && onReset(opp.id)}>
                    <Icon name="arrow_left" size={14} stroke={1.75} /> Restaurer
                  </button>
                </>
              )}
              <button className="btn btn--ghost" onClick={() => onAskJarvis && onAskJarvis(opp)}>
                <Icon name="assistant" size={14} stroke={1.75} /> Demander un plan à Jarvis
              </button>
              <button className="btn btn--ghost" onClick={() => onSendToIdeas && onSendToIdeas(opp)}>
                <Icon name="notebook" size={14} stroke={1.75} /> Envoyer au Carnet d'idées
              </button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

// ─── Kanban View ─────────────────────────────────────────
function KanbanView({ opps, onOpen, onTake, onPass }) {
  const cols = [
    { id: "too_early",    label: "Trop tôt",       sub: "Laisser mûrir" },
    { id: "right_time",   label: "Bon moment",     sub: "Pas d'urgence, mais priorisable" },
    { id: "getting_late", label: "Se rétrécit",    sub: "Encore jouable, pas longtemps" },
    { id: "closing",      label: "Se dépêcher",    sub: "Action cette semaine" },
  ];
  const byCol = {};
  cols.forEach(c => byCol[c.id] = []);
  opps.forEach(o => {
    const u = o.window?.urgency || "right_time";
    (byCol[u] || byCol.right_time).push(o);
  });

  return (
    <div className="opp-kanban">
      {cols.map(c => (
        <div key={c.id} className={`opp-kan-col opp-kan-col--${c.id}`}>
          <div className="opp-kan-col-head">
            <div className="opp-kan-col-kicker">{c.sub}</div>
            <div className="opp-kan-col-title">
              {c.label} <span className="opp-kan-col-count">· {byCol[c.id].length}</span>
            </div>
          </div>
          {byCol[c.id].map(o => (
            <div key={o.id} className="opp-kan-card" onClick={() => onOpen(o.id)}>
              <div className="opp-kan-card-kicker">{o.kicker}</div>
              <h4 className="opp-kan-card-title">{o.title}</h4>
              <div className="opp-kan-card-meta">
                <span>{EFFORT_LABEL[o.effort]}</span>
                <span className="opp-kan-card-match">{o.match}%</span>
              </div>
            </div>
          ))}
          {byCol[c.id].length === 0 && (
            <div style={{ color: "var(--tx3)", fontSize: 12, fontFamily: "var(--font-mono)", padding: "8px 0" }}>—</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Timeline "fenêtres" View ────────────────────────────
function TimelineView({ opps, onOpen }) {
  // 6 months, starting today
  const today = new Date("2026-04-21");
  const monthCount = 9; // avril → décembre
  const months = [];
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(d);
  }
  const start = months[0];
  const end = new Date(months[monthCount - 1].getFullYear(), months[monthCount - 1].getMonth() + 1, 1);
  const totalMs = end - start;

  function posPct(date) {
    return Math.max(0, Math.min(100, ((date - start) / totalMs) * 100));
  }

  // Today indicator
  const todayPct = posPct(today);

  // sort opps : closing first then by date
  const sorted = [...opps].sort((a, b) => {
    const ua = URGENCY_ORDER[a.window?.urgency || "right_time"];
    const ub = URGENCY_ORDER[b.window?.urgency || "right_time"];
    if (ua !== ub) return ua - ub;
    const ad = a.window?.closes_iso ? new Date(a.window.closes_iso).getTime() : Infinity;
    const bd = b.window?.closes_iso ? new Date(b.window.closes_iso).getTime() : Infinity;
    return ad - bd;
  });

  return (
    <div className="opp-tl">
      <div className="opp-tl-months">
        <div className="opp-tl-month-labels" style={{ gridTemplateColumns: `repeat(${monthCount}, 1fr)` }}>
          {months.map((m, i) => {
            const isCurrent = m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear();
            return (
              <div key={i} className={`opp-tl-month-label ${isCurrent ? "is-current" : ""}`}>
                {m.toLocaleDateString("fr-FR", { month: "short" })} {String(m.getFullYear()).slice(2)}
              </div>
            );
          })}
        </div>

        <div className="opp-tl-rows">
          <div className="opp-tl-today" style={{ left: `${todayPct}%` }} />
          {sorted.map(o => {
            const w = o.window;
            const hasDeadline = !!w?.closes_iso;
            let left = todayPct;
            let width = 100 - todayPct;
            let variant = w?.urgency === "closing" ? "--closing"
                        : w?.urgency === "getting_late" ? "--getting" : "";
            if (!hasDeadline) {
              variant = "--perpetual";
              left = todayPct;
              width = 100 - todayPct - 2;
            } else {
              const closeDate = new Date(w.closes_iso);
              left = todayPct;
              width = Math.max(4, posPct(closeDate) - todayPct);
            }
            return (
              <div key={o.id} className="opp-tl-row" onClick={() => onOpen(o.id)}>
                <div
                  className={`opp-tl-bar opp-tl-bar${variant}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span>{o.title}</span>
                  <span className="opp-tl-bar-match">{o.match}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="opp-tl-legend">
        <span className="opp-tl-legend-item"><span className="opp-tl-legend-sw opp-tl-legend-sw--closing" /> se dépêcher</span>
        <span className="opp-tl-legend-item"><span className="opp-tl-legend-sw opp-tl-legend-sw--getting" /> se rétrécit</span>
        <span className="opp-tl-legend-item"><span className="opp-tl-legend-sw opp-tl-legend-sw--right" /> bon moment</span>
        <span className="opp-tl-legend-item"><span className="opp-tl-legend-sw opp-tl-legend-sw--perp" /> perpétuelle (pas de deadline)</span>
        <span style={{ marginLeft: "auto" }}>Ligne verticale = aujourd'hui · barre = de maintenant à la fermeture</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PANEL
// ═══════════════════════════════════════════════════════════════
function PanelOpportunities({ data, onNavigate }) {
  const OPP = window.OPPORTUNITIES_DATA;
  const allOpps = OPP.opportunities;

  const [scope, setScope] = useStateOp(() => localStorage.getItem("opp.scope") || "all");
  const [view, setView] = useStateOp(() => localStorage.getItem("opp.view") || "editorial");
  const [status, setStatus] = useStateOp(() => {
    try { return JSON.parse(localStorage.getItem("opp.status") || "{}"); }
    catch { return {}; }
  });
  const [openId, setOpenId] = useStateOp(null);

  useEffectOp(() => localStorage.setItem("opp.scope", scope), [scope]);
  useEffectOp(() => localStorage.setItem("opp.view", view), [view]);
  useEffectOp(() => localStorage.setItem("opp.status", JSON.stringify(status)), [status]);

  const enrichedOpps = useMemoOp(() => allOpps.map(o => ({
    ...o,
    status: status[o.id] || o.status || "open",
  })), [allOpps, status]);

  const openOpps = enrichedOpps.filter(o => o.status === "open");
  const takenOpps = enrichedOpps.filter(o => o.status === "taken");
  const passedOpps = enrichedOpps.filter(o => o.status === "passed");

  const scopeFiltered = scope === "all" ? openOpps : openOpps.filter(o => o.scope === scope);

  const counts = useMemoOp(() => ({
    all: openOpps.length,
    business: openOpps.filter(o => o.scope === "business").length,
    side:     openOpps.filter(o => o.scope === "side").length,
    life:     openOpps.filter(o => o.scope === "life").length,
    jarvis:   openOpps.filter(o => o.scope === "jarvis").length,
  }), [openOpps]);

  const urgentCount = openOpps.filter(o =>
    o.window?.urgency === "closing" || o.window?.urgency === "getting_late"
  ).length;

  // Prochaine deadline (parmi les opps ouvertes à trancher)
  const nextDeadline = useMemoOp(() => {
    const withDate = openOpps
      .filter(o => o.window?.closes_iso)
      .map(o => ({ opp: o, date: new Date(o.window.closes_iso) }))
      .filter(x => !isNaN(x.date.getTime()) && x.date.getTime() > Date.now())
      .sort((a, b) => a.date - b.date);
    if (!withDate.length) return null;
    const { opp, date } = withDate[0];
    const daysLeft = Math.max(0, Math.round((date.getTime() - Date.now()) / 86400000));
    return { opp, daysLeft, date };
  }, [openOpps]);

  // Flagship = best open opp (prioritize urgency, then match)
  const flagship = useMemoOp(() => {
    return [...openOpps].sort((a, b) => {
      const ua = URGENCY_ORDER[a.window?.urgency || "right_time"];
      const ub = URGENCY_ORDER[b.window?.urgency || "right_time"];
      if (ua !== ub) return ua - ub;
      return b.match - a.match;
    })[0];
  }, [openOpps]);

  // Group by scope for editorial
  const grouped = useMemoOp(() => {
    const g = {};
    scopeFiltered.forEach(o => {
      if (!g[o.scope]) g[o.scope] = [];
      g[o.scope].push(o);
    });
    // sort within: urgency then match
    Object.values(g).forEach(arr => arr.sort((a, b) => {
      const ua = URGENCY_ORDER[a.window?.urgency || "right_time"];
      const ub = URGENCY_ORDER[b.window?.urgency || "right_time"];
      if (ua !== ub) return ua - ub;
      return b.match - a.match;
    }));
    return g;
  }, [scopeFiltered]);

  const scopeOrder = ["business", "side", "life", "jarvis"];

  const handleTake = (id) => setStatus(s => ({ ...s, [id]: "taken" }));
  const handlePass = (id) => setStatus(s => ({ ...s, [id]: "passed" }));

  const handleAskJarvis = (opp) => {
    const prompt = `Aide-moi à bâtir un plan d'action pour cette opportunité :\n\n${opp.title}\n${opp.summary || opp.pitch || ""}\n\nFenêtre : ${opp.window?.closes_in || "—"}. Priorité : ${opp.priority || opp.match + "/100"}.\n\nDonne-moi 5 étapes concrètes pour les 2 prochaines semaines.`;
    try { localStorage.setItem("jarvis-prefill-input", prompt); } catch {}
    onNavigate && onNavigate("jarvis");
  };

  const handleSendToIdeas = async (opp) => {
    if (!window.sb || !window.SUPABASE_URL) {
      alert("Client Supabase non initialisé.");
      return;
    }
    if (!confirm(`Copier cette opportunité dans le carnet d'idées ?\n\n"${opp.title}"\n\nElle y attendra en statut "maturing" que tu la creuses.`)) return;
    try {
      const url = `${window.SUPABASE_URL}/rest/v1/business_ideas`;
      // Compile un description riche incluant tout le contexte DB.
      const descParts = [];
      if (opp.teaser || opp.summary) descParts.push(opp.teaser || opp.summary);
      if (opp.body && opp.body !== opp.teaser) descParts.push(opp.body);
      const description = descParts.join("\n\n").trim() || opp.title;

      // Notes contextuelles (champs DB opportunités)
      const noteLines = [];
      noteLines.push(`Source : opportunité hebdo "${opp.id}"`);
      if (opp.match) noteLines.push(`Pertinence : ${opp.match}/100 (confiance ${opp.confidence || "medium"})`);
      if (opp.window?.closes_in) noteLines.push(`Fenêtre : ${opp.window.closes_in} (${opp.window.urgency || "right_time"})`);
      if (opp.effort) noteLines.push(`Effort à bâtir : ${opp.effort}`);
      if (opp.competition) noteLines.push(`Concurrence : ${opp.competition}`);
      if (opp.market_size) noteLines.push(`Marché : ${opp.market_size}`);
      if (opp.who_pays) noteLines.push(`Qui paye : ${opp.who_pays}`);
      if (opp.why_you) noteLines.push(`\nPourquoi toi :\n${opp.why_you}`);
      if (opp.next_step) noteLines.push(`\nNext step :\n${opp.next_step}`);
      if ((opp.sources || []).length) {
        const srcLines = opp.sources.slice(0, 5).map(s => `- ${s.who}${s.what ? " — " + s.what : ""}${s.url ? " (" + s.url + ")" : ""}`).join("\n");
        noteLines.push(`\nSources :\n${srcLines}`);
      }

      const payload = {
        title: opp.title,
        description,
        sector: opp.scope || "business",
        status: "maturing",
        notes: noteLines.join("\n"),
        related_concepts: [...(opp.signals || []), ...(opp.tags || [])].filter(Boolean).slice(0, 10),
      };
      const rows = await window.sb.postJSON(url, payload);
      try { window.track && window.track("opp_sent_to_ideas", { opp_id: opp.id, idea_id: rows?.[0]?.id }); } catch {}
      if (confirm("Idée créée avec le contexte complet (marché, concurrence, sources, next step). Ouvrir le carnet d'idées ?")) onNavigate && onNavigate("ideas");
    } catch (e) {
      console.error(e);
      alert("Impossible d'enregistrer l'idée. Réessaie dans un instant.");
    }
  };
  const handleReset = (id) => setStatus(s => { const n = { ...s }; delete n[id]; return n; });

  const handleOpenSignal = (signalName) => {
    // Navigation vers panel signaux avec le nom du signal à mettre en avant.
    // panel-signals consomme ce stash au mount pour scroller vers le bon signal.
    try { localStorage.setItem("signals-focus-name", signalName || ""); } catch {}
    onNavigate && onNavigate("signals");
  };

  return (
    <div className="panel-page" data-screen-label="Opportunités">
      {/* ── HERO ───────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">
          Opportunités · {OPP.week} · mis à jour {OPP.updated}
        </div>
        <h1 className="panel-hero-title">
          Opportunités <em>à saisir</em>.<br/>
          Ton carnet d'actions, avant que les fenêtres ne se ferment.
        </h1>
        <p className="panel-hero-sub">
          {openOpps.length} fenêtres ouvertes cette semaine, détectées à partir de tes signaux faibles, de ta veille et de tes contraintes perso. Chaque opportunité a une date limite — explicite ou estimée. À toi de dire <em>je saisis</em> ou <em>je passe</em>.
        </p>

        <div className="opp-herometa">
          <div className="opp-herometa-stat">
            <span className="opp-herometa-val">{openOpps.length}</span>
            <span>ouvertes</span>
          </div>
          <div className="opp-herometa-stat">
            <span className="opp-herometa-val opp-herometa-val--urgent">{urgentCount}</span>
            <span>à saisir avant 10 sem.</span>
          </div>
          {nextDeadline ? (
            <div className="opp-herometa-stat">
              <span className={`opp-herometa-val ${nextDeadline.daysLeft <= 14 ? "opp-herometa-val--urgent" : ""}`}>
                {nextDeadline.daysLeft}j
              </span>
              <span title={nextDeadline.opp.title}>avant la + proche fenêtre</span>
            </div>
          ) : null}
          <div className="opp-herometa-stat">
            <span className="opp-herometa-val opp-herometa-val--taken">{takenOpps.length}</span>
            <span>saisies</span>
          </div>
          <div className="opp-herometa-stat">
            <span className="opp-herometa-val">{passedOpps.length}</span>
            <span>passées</span>
          </div>
        </div>
      </div>

      {/* ── FLAGSHIP ─────────────────────────────── */}
      {flagship && (
        <FlagshipCard
          opp={flagship}
          onTake={handleTake}
          onPass={handlePass}
          onOpenSignal={handleOpenSignal}
        />
      )}

      {/* ── VIEW SWITCHER ─────────────────────────── */}
      <div className="opp-viewswitch">
        <div className="opp-viewswitch-label">Vue</div>
        <div className="opp-viewswitch-group">
          {[
            { id: "editorial", label: "Éditorial" },
            { id: "kanban",    label: "Par timing" },
            { id: "timeline",  label: "Fenêtres" },
          ].map(v => (
            <button key={v.id}
              className={`opp-viewswitch-btn ${view === v.id ? "is-active" : ""}`}
              onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--tx2)", letterSpacing: "0.04em" }}>
          {scope === "all" ? `${openOpps.length} opportunités` : `${counts[scope]} · ${SCOPES.find(s => s.id === scope)?.name || ""}`}
        </div>
      </div>

      {/* ── SCOPE FILTERS (only for editorial) ────── */}
      {view === "editorial" && (
        <div className="opp-scopes">
          {SCOPES.map(s => (
            <button key={s.id}
              className={`pill ${scope === s.id ? "is-active" : ""}`}
              onClick={() => setScope(s.id)}>
              <span>{s.label}</span>
              <span className="pill-count">{counts[s.id]}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────── */}
      {view === "editorial" && (
        <div className="opp-list">
          {scope === "all" ? (
            scopeOrder.filter(sc => grouped[sc]?.length).map(sc => {
              const def = SCOPES.find(s => s.id === sc);
              return (
                <section key={sc} className="opp-group">
                  <div className="opp-group-head">
                    <h3 className="opp-group-name">
                      {def.name} <em>— {def.sub}</em>
                    </h3>
                    <span className="opp-group-meta">{grouped[sc].length} opportunité{grouped[sc].length > 1 ? "s" : ""}</span>
                  </div>
                  {grouped[sc].map(o => (
                    <OppCard key={o.id} opp={o}
                      open={openId === o.id}
                      onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                      onTake={handleTake} onPass={handlePass} onReset={handleReset}
                      onAskJarvis={handleAskJarvis} onSendToIdeas={handleSendToIdeas}
                      onOpenSignal={handleOpenSignal} />
                  ))}
                </section>
              );
            })
          ) : (
            <section className="opp-group">
              {(grouped[scope] || []).map(o => (
                <OppCard key={o.id} opp={o}
                  open={openId === o.id}
                  onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  onTake={handleTake} onPass={handlePass} onAskJarvis={handleAskJarvis} onSendToIdeas={handleSendToIdeas}
                  onOpenSignal={handleOpenSignal} />
              ))}
              {(grouped[scope] || []).length === 0 && (
                <div style={{ color: "var(--tx3)", padding: "40px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                  Aucune opportunité ouverte dans ce scope cette semaine.
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {view === "kanban" && (
        <KanbanView opps={scopeFiltered}
          onOpen={(id) => { setView("editorial"); setOpenId(id); setTimeout(() => {
            document.querySelector(`[data-opp-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          }, 80); }}
          onTake={handleTake} onPass={handlePass} onAskJarvis={handleAskJarvis} onSendToIdeas={handleSendToIdeas} />
      )}

      {view === "timeline" && (
        <TimelineView opps={scopeFiltered}
          onOpen={(id) => { setView("editorial"); setOpenId(id); setTimeout(() => {
            document.querySelector(`[data-opp-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          }, 80); }} />
      )}

      {/* ── LEDGER (taken + passed) ─────────────── */}
      {(takenOpps.length > 0 || passedOpps.length > 0) && (
        <div className="opp-ledger">
          <div className="opp-ledger-side">
            <div className="opp-ledger-head">
              <span className="opp-ledger-label">Je saisis</span>
              <span className="opp-ledger-count">{takenOpps.length}</span>
            </div>
            {takenOpps.length === 0 ? (
              <div style={{ color: "var(--tx3)", fontSize: 13, padding: "8px 0" }}>Rien encore saisi cette semaine.</div>
            ) : takenOpps.map(o => (
              <div key={o.id} className="opp-ledger-item">
                <span className="opp-ledger-item-title">{o.title}</span>
                <button
                  className="opp-ledger-restore"
                  onClick={() => handleReset(o.id)}
                  title="Remettre dans la liste à trancher"
                >
                  <Icon name="arrow_left" size={11} stroke={2} /> Restaurer
                </button>
              </div>
            ))}
          </div>
          <div className="opp-ledger-side">
            <div className="opp-ledger-head">
              <span className="opp-ledger-label">Je passe</span>
              <span className="opp-ledger-count">{passedOpps.length}</span>
            </div>
            {passedOpps.length === 0 ? (
              <div style={{ color: "var(--tx3)", fontSize: 13, padding: "8px 0" }}>Rien passé pour l'instant.</div>
            ) : passedOpps.map(o => (
              <div key={o.id} className="opp-ledger-item is-passed">
                <span className="opp-ledger-item-title">{o.title}</span>
                <button
                  className="opp-ledger-restore"
                  onClick={() => handleReset(o.id)}
                  title="Remettre dans la liste à trancher"
                >
                  <Icon name="arrow_left" size={11} stroke={2} /> Restaurer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

window.PanelOpportunities = PanelOpportunities;
