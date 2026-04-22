// ═══════════════════════════════════════════════════════════════
// PANEL SIGNAUX FAIBLES — détecteur d'opportunités
// ─────────────────────────────────────────────
// Hiérarchie éditoriale :
//   1. Hero → framing "ce qui monte avant le mainstream" + méta-stats
//   2. Priority grid → 4 signaux à surveiller cette semaine
//   3. Groupes par catégorie → liste éditoriale dense avec expand
// ═══════════════════════════════════════════════════════════════

const { useState: useStateSg, useMemo: useMemoSg } = React;

// ── Big 12-week SVG graph (used in expanded detail) ──────────
function SignalGraph({ history, trend, windowWeeks = 12, startWeek = 6 }) {
  const W = 520, H = 140, PAD_L = 36, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const n = history.length;
  const max = Math.max(...history, 1);
  const step = (W - PAD_L - PAD_R) / Math.max(n - 1, 1);
  const y = (v) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);
  const x = (i) => PAD_L + i * step;
  const points = history.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M ${x(0)},${H - PAD_B} L ${points.split(" ").join(" L ")} L ${x(n - 1)},${H - PAD_B} Z`;
  // gridlines
  const gridY = [0.25, 0.5, 0.75, 1].map((p) => PAD_T + (H - PAD_T - PAD_B) * p);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`sig-graph-svg sig-graph--${trend}`} preserveAspectRatio="none">
      {gridY.map((gy, i) => (
        <line key={i} className="sig-graph-baseline" x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} />
      ))}
      {/* y-axis labels */}
      <text x={6} y={PAD_T + 8} className="sig-graph-axis">{max}</text>
      <text x={6} y={H - PAD_B} className="sig-graph-axis">0</text>
      {/* area */}
      <path d={area} className="sig-graph-area" />
      {/* line */}
      <polyline points={points} className="sig-graph-line" />
      {/* dots */}
      {history.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} className={`sig-graph-dot ${i === n - 1 ? "sig-graph-dot--last" : ""}`} />
      ))}
      {/* x-axis week markers */}
      {history.map((_, i) => {
        const w = startWeek + i;
        if (i === 0 || i === n - 1 || i % 3 === 0) {
          return <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="sig-graph-axis">S{String(w).padStart(2, "0")}</text>;
        }
        return null;
      })}
      {/* last value label */}
      <text x={x(n - 1) + 8} y={y(history[n - 1]) + 4} className="sig-graph-label">{history[n - 1]}</text>
    </svg>
  );
}

// ── Mini sparkline for rows ──────────────────────────────────
function MiniSpark({ history, trend }) {
  const W = 100, H = 28;
  const max = Math.max(...history, 1);
  const n = history.length;
  const step = W / Math.max(n - 1, 1);
  const y = (v) => H * (1 - v / max);
  const pts = history.map((v, i) => `${i * step},${y(v)}`).join(" ");
  const color = trend === "rising" ? "var(--positive)"
    : trend === "new" ? "var(--brand)"
    : trend === "declining" ? "#b8956a"
    : "var(--tx2)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={(n - 1) * step} cy={y(history[n - 1])} r="2.8" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

// ── Delta chip (reused) ──────────────────────────────────────
function DeltaChip({ signal }) {
  if (signal.trend === "new") return <span className="sig-row-count-delta sig-row-count-delta--new">nouveau</span>;
  if (signal.delta == null) return <span className="sig-row-count-delta">—</span>;
  if (signal.delta > 0) return <span className="sig-row-count-delta sig-row-count-delta--up">↑ +{signal.delta} / 8 sem</span>;
  if (signal.delta < 0) return <span className="sig-row-count-delta sig-row-count-delta--down">↓ {signal.delta} / 8 sem</span>;
  return <span className="sig-row-count-delta">stable</span>;
}

const TREND_LABEL = { rising: "en hausse", new: "nouveau", declining: "en baisse", stable: "stable" };

// ── Expanded row detail ──────────────────────────────────────
function SignalDetail({ signal, windowWeeks, onNavigate }) {
  const handleSeeVeille = () => {
    // Pré-remplir la recherche de veille avec le nom du signal
    try { localStorage.setItem("veille-prefill-query", signal.name); } catch {}
    if (onNavigate) onNavigate("search");
  };
  const handleAskJarvis = () => {
    const sources = (signal.sources || []).slice(0, 5).map(s => `- ${s.who}${s.what ? " : " + s.what : ""} (${s.when})`).join("\n");
    const prompt = `J'aimerais creuser le signal « ${signal.name} » détecté dans ma veille IA.\n\nCatégorie : ${signal.category}\nTendance : ${signal.trend}, ${signal.count} mentions (${signal.delta >= 0 ? "+" : ""}${signal.delta ?? "?"} sur 4 sem)\nPremière occurrence : ${signal.first_seen}\n\nSources récentes :\n${sources || "(aucune)"}\n\nPeux-tu : (1) m'expliquer pourquoi ce signal monte maintenant, (2) identifier 2-3 opportunités concrètes, (3) me pointer des lectures clés ?`;
    try { localStorage.setItem("jarvis-prefill-input", prompt); } catch {}
    if (onNavigate) onNavigate("jarvis");
  };
  const startWeek = 17 - windowWeeks + 1;
  const historyShown = signal.history.slice(-windowWeeks);
  return (
    <div className="sig-detail">
      <div className="sig-detail-left">
        <div>
          <div className="sig-detail-label">Fréquence des mentions · {windowWeeks} semaines</div>
          <div className="sig-detail-graph">
            <SignalGraph history={historyShown} trend={signal.trend} windowWeeks={windowWeeks} startWeek={startWeek} />
            <div className="sig-detail-graph-meta">
              <span>première occurrence · {signal.first_seen}</span>
              <span>maturité · {signal.maturity}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="sig-detail-label">Lecture Jarvis</div>
          <p className="sig-detail-take">{signal.jarvis_take}</p>
        </div>
      </div>

      <div className="sig-detail-right">
        <div>
          <div className="sig-detail-label">{signal.sources.length} sources détectées</div>
          <div className="sig-detail-sources">
            {signal.sources.map((s, i) => (
              <div key={i} className="sig-source">
                <span className="sig-source-week">{s.when}</span>
                <span className="sig-source-text"><strong>{s.who}</strong> — {s.what}</span>
                <span className="sig-source-kind">{s.kind}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sig-detail-actions">
          <button className="btn btn--ghost" onClick={handleSeeVeille}>
            <Icon name="arrow_right" size={14} stroke={1.75} /> Voir la veille filtrée
          </button>
          <button className="btn btn--ghost" onClick={handleAskJarvis}>
            <Icon name="sparkles" size={14} stroke={1.75} /> Demander à Jarvis
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row in a group list ──────────────────────────────────────
function SignalRow({ signal, rank, open, onToggle, watched, onWatch, windowWeeks, onNavigate }) {
  return (
    <React.Fragment>
      <div className={`sig-row ${open ? "is-open" : ""}`} onClick={onToggle} role="button" tabIndex={0}>
        <div className="sig-row-rank">
          <span className="sig-row-rank-num">#{String(rank).padStart(2, "0")}</span>
        </div>
        <div className="sig-row-term">
          <span className="sig-row-term-name">{signal.name}</span>
          <span className={`sig-row-term-trend sig-row-term-trend--${signal.trend}`}>
            <span className="sig-row-term-trend-dot" />
            {TREND_LABEL[signal.trend]} · depuis {signal.first_seen}
          </span>
        </div>
        <div className="sig-row-take">{signal.jarvis_take}</div>
        <div className="sig-row-spark">
          <MiniSpark history={signal.history.slice(-windowWeeks)} trend={signal.trend} />
        </div>
        <div className="sig-row-count">
          <span className="sig-row-count-val">{signal.count}</span>
          <DeltaChip signal={signal} />
        </div>
        <div className="sig-row-watch">
          <button
            className={`sig-row-watch-btn ${watched ? "is-watched" : ""}`}
            onClick={(e) => { e.stopPropagation(); onWatch(); }}
            title={watched ? "Retirer de la watchlist" : "Ajouter à la watchlist"}
          >
            <Icon name="bookmark" size={14} stroke={1.75} />
          </button>
        </div>
      </div>
      {open && <SignalDetail signal={signal} windowWeeks={windowWeeks} onNavigate={onNavigate} />}
    </React.Fragment>
  );
}

// ── Priority cell (top opportunités) ─────────────────────────
function PriorityCell({ signal, rank, onOpen, watched, onWatch }) {
  return (
    <button className="sig-pri-cell" onClick={onOpen}>
      <div className="sig-pri-cell-top">
        <span className="sig-pri-cell-rank">#{String(rank).padStart(2, "0")}</span>
        <span className={`sig-row-term-trend sig-row-term-trend--${signal.trend}`}>
          <span className="sig-row-term-trend-dot" />
          {TREND_LABEL[signal.trend]}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{signal.category}</span>
      </div>
      <div className="sig-pri-cell-term">{signal.name}</div>
      <div className="sig-pri-cell-take">{signal.jarvis_take}</div>
      <div className="sig-pri-cell-foot">
        <div className="sig-pri-cell-count">
          <strong>{signal.count}</strong>mentions · <DeltaChip signal={signal} />
        </div>
        <div style={{ width: 90 }}>
          <MiniSpark history={signal.history.slice(-8)} trend={signal.trend} />
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WATCHLIST PANEL — dédié avec alertes
// ═══════════════════════════════════════════════════════════════
function WatchlistPanel({ signals, watched, onToggle, onOpen, onClear }) {
  const watchedSignals = signals.filter(s => watched.includes(s.id));
  const allAlerts = useMemoSg(() => {
    const items = [];
    watchedSignals.forEach(s => {
      (s.alerts || []).forEach(a => {
        items.push({ signal: s, week: a.week, text: a.text });
      });
    });
    // latest first
    return items.sort((a, b) => b.week.localeCompare(a.week)).slice(0, 6);
  }, [watchedSignals]);

  if (watchedSignals.length === 0) {
    return (
      <div className="sig-watch-empty">
        <div>
          <div className="sig-watch-empty-kicker">Watchlist</div>
          <div className="sig-watch-empty-body">
            Clique sur l'icône <Icon name="bookmark" size={12} stroke={1.75} /> d'un signal pour le suivre. Tu verras ici ses alertes hebdo et pourras l'exporter.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sig-watch">
      <div className="sig-watch-head">
        <div>
          <h2 className="sig-watch-title">Ta watchlist</h2>
          <span className="sig-watch-sub">{watchedSignals.length} signal{watchedSignals.length > 1 ? "s" : ""} · {allAlerts.length} alerte{allAlerts.length > 1 ? "s" : ""} récente{allAlerts.length > 1 ? "s" : ""}</span>
        </div>
        <button className="btn btn--ghost" onClick={onClear} style={{ fontSize: 12 }}>
          <Icon name="x" size={13} stroke={1.75} /> Vider
        </button>
      </div>

      <div className="sig-watch-body">
        <div className="sig-watch-items">
          {watchedSignals.map(s => (
            <div key={s.id} className="sig-watch-item" onClick={() => onOpen(s.id)}>
              <div className="sig-watch-item-top">
                <span className={`sig-row-term-trend sig-row-term-trend--${s.trend}`}>
                  <span className="sig-row-term-trend-dot" />
                  {TREND_LABEL[s.trend]}
                </span>
                <button
                  className="sig-watch-item-remove"
                  onClick={(e) => { e.stopPropagation(); onToggle(s.id); }}
                  title="Retirer"
                >
                  <Icon name="x" size={12} stroke={1.75} />
                </button>
              </div>
              <div className="sig-watch-item-name">{s.name}</div>
              <div className="sig-watch-item-meta">
                <span>{s.count} mentions</span>
                <span className="sig-watch-item-meta-sep">·</span>
                <span>{s.category}</span>
              </div>
              <div className="sig-watch-item-spark">
                <MiniSpark history={s.history.slice(-8)} trend={s.trend} />
              </div>
            </div>
          ))}
        </div>

        <div className="sig-watch-alerts">
          <div className="sig-watch-alerts-label">Alertes récentes</div>
          {allAlerts.length === 0 ? (
            <div className="sig-watch-alerts-empty">Pas d'alerte sur tes signaux cette semaine.</div>
          ) : (
            <div className="sig-watch-alerts-list">
              {allAlerts.map((a, i) => (
                <div key={i} className="sig-watch-alert" onClick={() => onOpen(a.signal.id)}>
                  <span className="sig-watch-alert-week">{a.week}</span>
                  <div className="sig-watch-alert-body">
                    <span className="sig-watch-alert-signal">{a.signal.name}</span>
                    <span className="sig-watch-alert-text">{a.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HYPE CYCLE VIEW — momentum × maturity
// ═══════════════════════════════════════════════════════════════

// Canonical Gartner-ish curve y(x), x ∈ [0,1]
// seed(0.1) ↗ hype peak(0.55) ↘ trough(0.75) ↗ plateau(1)
function hypeCurveY(x) {
  // Smooth piecewise: rise to peak, fall to trough, rise again
  // Using blended cosines for aesthetics
  if (x <= 0.55) {
    // 0 → 0.55 : rise from 0.8 to 0.1 (y is inverted: 0 top, 1 bottom)
    const t = x / 0.55;
    return 0.82 - 0.72 * (1 - Math.cos(Math.PI * t)) / 2; // 0.82 → 0.10
  } else if (x <= 0.78) {
    // 0.55 → 0.78 : fall from 0.10 to 0.72
    const t = (x - 0.55) / 0.23;
    return 0.10 + 0.62 * (1 - Math.cos(Math.PI * t)) / 2;
  } else {
    // 0.78 → 1 : rise (recover) from 0.72 to 0.42
    const t = (x - 0.78) / 0.22;
    return 0.72 - 0.30 * (1 - Math.cos(Math.PI * t)) / 2;
  }
}

function HypeCycleView({ signals, onOpen, watched, onWatch }) {
  const W = 1000, H = 540;
  const PAD_L = 60, PAD_R = 60, PAD_T = 40, PAD_B = 80;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const positions = window.SIGNALS_DATA.maturity_positions;

  // ── Build curve path ─────────────────────────────────
  const curvePoints = [];
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    curvePoints.push(`${PAD_L + x * innerW},${PAD_T + hypeCurveY(x) * innerH}`);
  }
  const curvePath = `M ${curvePoints.join(" L ")}`;

  // ── Compute signal points with jitter & collision avoidance ─
  const pts = useMemoSg(() => {
    // Group by maturity, spread along x within a band
    const buckets = {};
    signals.forEach(s => {
      if (!buckets[s.maturity]) buckets[s.maturity] = [];
      buckets[s.maturity].push(s);
    });
    const bandWidths = { seed: 0.10, emerging: 0.14, hype: 0.22, plateau: 0.10, declining: 0.08 };
    const placed = [];
    Object.entries(buckets).forEach(([maturity, list]) => {
      // Sort by delta desc so strongest momentum is leftmost in the band
      const sorted = [...list].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
      const base = positions[maturity] ?? 0.5;
      const band = bandWidths[maturity] ?? 0.10;
      sorted.forEach((s, i) => {
        const t = sorted.length === 1 ? 0.5 : i / (sorted.length - 1);
        const x = base - band / 2 + t * band;
        const yOnCurve = hypeCurveY(x);
        // offset slightly above curve based on momentum (positive delta pushes up)
        const mom = s.delta ?? 0;
        const momOffset = Math.max(-0.05, Math.min(0.08, mom / 350));
        const y = yOnCurve - momOffset;
        // Stagger labels alternately above/below with varying distance
        // so no two adjacent labels collide
        const slot = i % 4;
        const labelDy = slot === 0 ? -16 : slot === 1 ? -34 : slot === 2 ? -52 : 22;
        const labelDx = 0;
        placed.push({ s, x, y, labelDy, labelDx });
      });
    });
    return placed;
  }, [signals]);

  // ── Phase labels along the curve ─────────────────────
  const phases = [
    { x: 0.10, label: "Innovation" },
    { x: 0.30, label: "Émergence" },
    { x: 0.55, label: "Pic de hype" },
    { x: 0.78, label: "Désillusion" },
    { x: 0.95, label: "Plateau" },
  ];

  const [hoverId, setHoverId] = useStateSg(null);

  return (
    <div className="sig-hype">
      <div className="sig-hype-head">
        <h2 className="sig-hype-title">Cycle de <em>hype</em></h2>
        <span className="sig-hype-sub">Maturité × momentum · {signals.length} signaux positionnés</span>
      </div>

      <div className="sig-hype-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} className="sig-hype-svg" preserveAspectRatio="xMidYMid meet">
          {/* Background gradient for curve zones */}
          <defs>
            <linearGradient id="hype-bg-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.05" />
              <stop offset="55%" stopColor="var(--positive)" stopOpacity="0.06" />
              <stop offset="78%" stopColor="#b8956a" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--tx)" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Axes */}
          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} className="sig-hype-axis" />
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} className="sig-hype-axis" />

          {/* Axis labels */}
          <text x={PAD_L} y={H - 20} className="sig-hype-axislabel">Maturité →</text>
          <text x={PAD_L} y={PAD_T - 14} className="sig-hype-axislabel" transform={`rotate(0)`}>↑ Momentum (attention)</text>

          {/* Filled curve area */}
          <path
            d={curvePath + ` L ${W - PAD_R},${H - PAD_B} L ${PAD_L},${H - PAD_B} Z`}
            fill="url(#hype-bg-grad)"
          />

          {/* The curve itself */}
          <path d={curvePath} className="sig-hype-curve" />

          {/* Phase markers */}
          {phases.map((p, i) => {
            const cx = PAD_L + p.x * innerW;
            const cy = PAD_T + hypeCurveY(p.x) * innerH;
            return (
              <g key={i}>
                <line x1={cx} y1={H - PAD_B} x2={cx} y2={H - PAD_B + 6} className="sig-hype-axis" />
                <text x={cx} y={H - PAD_B + 22} textAnchor="middle" className="sig-hype-phase">
                  {p.label}
                </text>
              </g>
            );
          })}

          {/* Peak marker */}
          <g>
            <line
              x1={PAD_L + 0.55 * innerW} y1={PAD_T + hypeCurveY(0.55) * innerH - 8}
              x2={PAD_L + 0.55 * innerW} y2={PAD_T + hypeCurveY(0.55) * innerH - 18}
              className="sig-hype-peaktick"
            />
            <text x={PAD_L + 0.55 * innerW} y={PAD_T + hypeCurveY(0.55) * innerH - 24} textAnchor="middle" className="sig-hype-peaklabel">
              PEAK
            </text>
          </g>

          {/* Signal dots */}
          {pts.map(({ s, x, y, labelDy, labelDx }) => {
            const cx = PAD_L + x * innerW;
            const cy = PAD_T + y * innerH;
            const r = 4 + Math.min(10, s.count / 6);
            const isHover = hoverId === s.id;
            const isWatch = watched.includes(s.id);
            return (
              <g key={s.id}
                 className={`sig-hype-pt sig-hype-pt--${s.trend} ${isHover ? "is-hover" : ""} ${isWatch ? "is-watch" : ""}`}
                 onMouseEnter={() => setHoverId(s.id)}
                 onMouseLeave={() => setHoverId(null)}
                 onClick={() => onOpen(s.id)}
                 style={{ cursor: "pointer" }}>
                <circle cx={cx} cy={cy} r={r} className="sig-hype-pt-halo" />
                <circle cx={cx} cy={cy} r={r * 0.55} className="sig-hype-pt-core" />
                {/* leader line from dot to label for clarity */}
                <line
                  x1={cx} y1={cy}
                  x2={cx + labelDx} y2={cy + labelDy + 4}
                  className="sig-hype-pt-leader"
                />
                <text x={cx + labelDx} y={cy + labelDy} textAnchor="middle" className="sig-hype-pt-label">
                  {s.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="sig-hype-legend">
          <span className="sig-hype-legend-item"><span className="sig-hype-legend-dot sig-hype-legend-dot--rising" /> en hausse</span>
          <span className="sig-hype-legend-item"><span className="sig-hype-legend-dot sig-hype-legend-dot--new" /> nouveau</span>
          <span className="sig-hype-legend-item"><span className="sig-hype-legend-dot sig-hype-legend-dot--declining" /> en baisse</span>
          <span className="sig-hype-legend-item" style={{ marginLeft: "auto" }}>Taille · volume de mentions</span>
        </div>
      </div>

      <p className="sig-hype-note">
        <strong>Lecture :</strong> plus un signal est à gauche, plus il est frais. Le pic = saturation
        d'attention ; après, désillusion puis plateau productif. <em>Idéal :</em> capter entre émergence et pic.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CO-OCCURRENCES GRAPH — termes qui montent ensemble
// ═══════════════════════════════════════════════════════════════
function CoOccurGraph({ signals, onOpen, watched }) {
  const W = 1000, H = 620;
  const cx = W / 2, cy = H / 2;

  // ── Radial layout: category = angle sector, distance by count ──
  const layout = useMemoSg(() => {
    const cats = [...new Set(signals.map(s => s.category))];
    const angleMap = {};
    cats.forEach((c, i) => {
      angleMap[c] = (i / cats.length) * Math.PI * 2;
    });
    const grouped = {};
    signals.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    const nodes = {};
    const maxCount = Math.max(...signals.map(s => s.count));
    Object.entries(grouped).forEach(([cat, list]) => {
      const baseAngle = angleMap[cat];
      const spread = Math.PI / cats.length * 0.9;
      const sorted = [...list].sort((a, b) => b.count - a.count);
      sorted.forEach((s, i) => {
        const t = sorted.length === 1 ? 0.5 : i / (sorted.length - 1);
        const angle = baseAngle - spread / 2 + t * spread;
        // Distance from center: inverse of count (bigger = more central)
        const dist = 120 + (1 - s.count / maxCount) * 180;
        nodes[s.id] = {
          s,
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          cat,
          angle,
        };
      });
    });
    return { nodes, cats, angleMap };
  }, [signals]);

  // ── Build edges from related[] ──
  const edges = useMemoSg(() => {
    const seen = new Set();
    const list = [];
    signals.forEach(s => {
      (s.related || []).forEach(rid => {
        const key = [s.id, rid].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);
        if (!layout.nodes[s.id] || !layout.nodes[rid]) return;
        list.push({ a: s.id, b: rid });
      });
    });
    return list;
  }, [signals, layout]);

  const [hoverId, setHoverId] = useStateSg(null);

  // ── Category labels (sectors) ──
  const catLabels = layout.cats.map(cat => {
    const angle = layout.angleMap[cat];
    const r = 320;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return { cat, x, y, angle };
  });

  // Neighbors of hovered
  const neighborIds = useMemoSg(() => {
    if (!hoverId) return new Set();
    const set = new Set([hoverId]);
    edges.forEach(e => {
      if (e.a === hoverId) set.add(e.b);
      if (e.b === hoverId) set.add(e.a);
    });
    return set;
  }, [hoverId, edges]);

  return (
    <div className="sig-graph">
      <div className="sig-graph-head">
        <h2 className="sig-graph-title">Co-occurrences</h2>
        <span className="sig-graph-sub">
          Termes qui montent ensemble · {edges.length} liens entre {signals.length} signaux
        </span>
      </div>

      <div className="sig-graph-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} className="sig-graph-svg2" preserveAspectRatio="xMidYMid meet">
          {/* Concentric guides */}
          {[140, 220, 300].map(r => (
            <circle key={r} cx={cx} cy={cy} r={r} className="sig-graph-guide" />
          ))}

          {/* Category labels */}
          {catLabels.map(({ cat, x, y }) => (
            <text key={cat} x={x} y={y} textAnchor="middle" className="sig-graph-catlabel">
              {cat}
            </text>
          ))}

          {/* Edges */}
          {edges.map((e, i) => {
            const a = layout.nodes[e.a], b = layout.nodes[e.b];
            if (!a || !b) return null;
            const active = !hoverId || neighborIds.has(e.a) && neighborIds.has(e.b);
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={`sig-graph-edge ${active ? "is-active" : "is-dim"}`}
              />
            );
          })}

          {/* Nodes */}
          {Object.values(layout.nodes).map(({ s, x, y }) => {
            const r = 5 + Math.min(12, s.count / 5);
            const active = !hoverId || neighborIds.has(s.id);
            const isWatch = watched.includes(s.id);
            return (
              <g key={s.id}
                 className={`sig-graph-node sig-graph-node--${s.trend} ${active ? "is-active" : "is-dim"} ${isWatch ? "is-watch" : ""}`}
                 onMouseEnter={() => setHoverId(s.id)}
                 onMouseLeave={() => setHoverId(null)}
                 onClick={() => onOpen(s.id)}
                 style={{ cursor: "pointer" }}>
                <circle cx={x} cy={y} r={r} className="sig-graph-node-halo" />
                <circle cx={x} cy={y} r={r * 0.55} className="sig-graph-node-core" />
                <text x={x} y={y + r + 14} textAnchor="middle" className="sig-graph-node-label">
                  {s.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="sig-hype-legend">
          <span className="sig-hype-legend-item"><span className="sig-hype-legend-dot sig-hype-legend-dot--rising" /> en hausse</span>
          <span className="sig-hype-legend-item"><span className="sig-hype-legend-dot sig-hype-legend-dot--new" /> nouveau</span>
          <span className="sig-hype-legend-item"><span className="sig-hype-legend-dot sig-hype-legend-dot--declining" /> en baisse</span>
          <span className="sig-hype-legend-item" style={{ marginLeft: "auto" }}>Survole un nœud pour isoler son cluster</span>
        </div>
      </div>

      <p className="sig-hype-note">
        <strong>Lecture :</strong> un lien = deux termes qui apparaissent ensemble dans les sources.
        Les clusters révèlent les <em>thèmes émergents</em> — souvent plus signifiants qu'un terme isolé.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PANEL
// ═══════════════════════════════════════════════════════════════
function exportSignalsCSV(signals){
  if (!signals || !signals.length) return;
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = ["id", "name", "category", "trend", "mention_count", "delta_4w", "first_seen", "last_seen"];
  const header = cols.join(",");
  const rows = signals.map(s => cols.map(c => esc(s[c])).join(",")).join("\n");
  const csv = "\uFEFF" + header + "\n" + rows; // BOM pour Excel FR
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signals-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function PanelSignals({ data, onNavigate }) {
  const SIG = window.SIGNALS_DATA;
  const allSignals = SIG.signals;

  // ── Tweaks state (persisted) ────────────────────────────
  const [density, setDensity] = useStateSg(() => localStorage.getItem("sig.density") || "comfortable");
  const [windowWeeks, setWindowWeeks] = useStateSg(() => parseInt(localStorage.getItem("sig.window") || "12"));
  const [view, setView] = useStateSg(() => localStorage.getItem("sig.view") || "editorial");

  React.useEffect(() => localStorage.setItem("sig.density", density), [density]);
  React.useEffect(() => localStorage.setItem("sig.window", String(windowWeeks)), [windowWeeks]);
  React.useEffect(() => localStorage.setItem("sig.view", view), [view]);

  // ── Watchlist ───────────────────────────────────────────
  const [watched, setWatched] = useStateSg(() => {
    try { return JSON.parse(localStorage.getItem("sig.watch") || "[]"); }
    catch { return []; }
  });
  const toggleWatch = (id) => {
    setWatched((w) => {
      const next = w.includes(id) ? w.filter(x => x !== id) : [...w, id];
      localStorage.setItem("sig.watch", JSON.stringify(next));
      return next;
    });
  };

  // ── Filter ──────────────────────────────────────────────
  const [trendFilter, setTrendFilter] = useStateSg("all");

  const counts = useMemoSg(() => ({
    all: allSignals.length,
    rising: allSignals.filter(s => s.trend === "rising").length,
    new: allSignals.filter(s => s.trend === "new").length,
    declining: allSignals.filter(s => s.trend === "declining").length,
  }), [allSignals]);

  const filtered = trendFilter === "all" ? allSignals : allSignals.filter(s => s.trend === trendFilter);

  // ── Priority picks : top rising/new by delta/count ──────
  const priorityPicks = useMemoSg(() => {
    return [...allSignals]
      .filter(s => s.trend === "rising" || s.trend === "new")
      .sort((a, b) => {
        // New signals first, then rising by delta
        if (a.trend === "new" && b.trend !== "new") return -1;
        if (b.trend === "new" && a.trend !== "new") return 1;
        const da = a.delta ?? a.count;
        const db = b.delta ?? b.count;
        return db - da;
      })
      .slice(0, 4);
  }, [allSignals]);

  // ── Group by category ───────────────────────────────────
  const grouped = useMemoSg(() => {
    const g = {};
    filtered.forEach(s => {
      if (!g[s.category]) g[s.category] = [];
      g[s.category].push(s);
    });
    // sort signals inside each cat : rising/new first, then by count
    Object.values(g).forEach(arr => arr.sort((a, b) => {
      const trendOrder = { new: 0, rising: 1, stable: 2, declining: 3 };
      const t = trendOrder[a.trend] - trendOrder[b.trend];
      if (t !== 0) return t;
      return b.count - a.count;
    }));
    return g;
  }, [filtered]);

  const categories = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  // ── Open row state ──────────────────────────────────────
  const [openId, setOpenId] = useStateSg(null);

  // ── Edit mode (tweaks panel) ────────────────────────────
  const [editMode, setEditMode] = useStateSg(false);
  React.useEffect(() => {
    const listener = (e) => {
      if (e.data?.type === "__activate_edit_mode") setEditMode(true);
      if (e.data?.type === "__deactivate_edit_mode") setEditMode(false);
    };
    window.addEventListener("message", listener);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", listener);
  }, []);

  const filters = [
    { id: "all", label: "Tout" },
    { id: "rising", label: "En hausse" },
    { id: "new", label: "Nouveaux" },
    { id: "declining", label: "En baisse" },
  ];

  const views = [
    { id: "editorial", label: "Éditorial", icon: "list" },
    { id: "hype",      label: "Cycle de hype", icon: "trend" },
    { id: "graph",     label: "Co-occurrences", icon: "graph" },
  ];

  const openSignal = (id) => {
    setView("editorial");
    setOpenId(id);
    setTimeout(() => {
      document.querySelector(`[data-sig-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  };
  const clearWatch = () => { setWatched([]); localStorage.setItem("sig.watch", "[]"); };

  return (
    <div className={`panel-page ${density === "dense" ? "sig-dense" : ""}`}>

      {/* ── HERO ─────────────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">
          Signaux faibles · {SIG.week} · mis à jour {SIG.updated}
        </div>
        <h1 className="panel-hero-title">
          Détecteur d'<em>opportunités</em>.<br/>
          Ce qui monte avant le mainstream.
        </h1>
        <p className="panel-hero-sub">
          {allSignals.length} termes suivis sur {SIG.window_weeks} semaines glissantes. Jarvis extrait les n-grams
          qui gagnent (ou perdent) en fréquence sur tes sources et te signale ce qui mérite attention.
        </p>

        <div className="sig-herometa">
          <div className="sig-herometa-stat">
            <span className="sig-herometa-val sig-herometa-val--up">{counts.rising}</span>
            <span>en hausse</span>
          </div>
          <div className="sig-herometa-stat">
            <span className="sig-herometa-val sig-herometa-val--new">{counts.new}</span>
            <span>nouveaux cette sem.</span>
          </div>
          <div className="sig-herometa-stat">
            <span className="sig-herometa-val sig-herometa-val--down">{counts.declining}</span>
            <span>en baisse</span>
          </div>
          <div className="sig-herometa-stat">
            <span className="sig-herometa-val">{watched.length}</span>
            <span>dans ta watchlist</span>
          </div>
        </div>
      </div>

      {/* ── WATCHLIST ───────────────────────────────────── */}
      <WatchlistPanel
        signals={allSignals}
        watched={watched}
        onToggle={toggleWatch}
        onOpen={openSignal}
        onClear={clearWatch}
      />

      {/* ── PRIORITY ───────────────────────────────────── */}
      <div className="sig-priority">
        <div className="sig-priority-head">
          <h2 className="sig-priority-title">À surveiller <em>cette semaine</em></h2>
          <span className="sig-priority-sub">Sélection Jarvis · 4 signaux</span>
        </div>
        <div className="sig-priority-grid">
          {priorityPicks.map((s, i) => (
            <PriorityCell
              key={s.id}
              signal={s}
              rank={i + 1}
              onOpen={() => openSignal(s.id)}
              watched={watched.includes(s.id)}
              onWatch={() => toggleWatch(s.id)}
            />
          ))}
        </div>
      </div>

      {/* ── VIEW SWITCHER ──────────────────────────────── */}
      <div className="sig-viewswitch">
        <div className="sig-viewswitch-label">Vue</div>
        <div className="sig-viewswitch-group">
          {views.map(v => (
            <button
              key={v.id}
              className={`sig-viewswitch-btn ${view === v.id ? "is-active" : ""}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "hype" && (
        <HypeCycleView
          signals={allSignals}
          onOpen={openSignal}
          watched={watched}
          onWatch={toggleWatch}
        />
      )}

      {view === "graph" && (
        <CoOccurGraph
          signals={allSignals}
          onOpen={openSignal}
          watched={watched}
        />
      )}

      {view === "editorial" && (
        <>
          {/* ── TOOLBAR ──────────────────────────────── */}
      <div className="panel-toolbar">
        <span className="panel-toolbar-label">Tendance</span>
        <div className="panel-toolbar-group">
          {filters.map(f => (
            <button
              key={f.id}
              className={`pill ${trendFilter === f.id ? "is-active" : ""}`}
              onClick={() => setTrendFilter(f.id)}
            >
              <span>{f.label}</span>
              <span className="pill-count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="panel-toolbar-divider" />
        <span className="panel-toolbar-label">Fenêtre</span>
        <div className="panel-toolbar-group">
          {[4, 8, 12].map(w => (
            <button key={w} className={`pill ${windowWeeks === w ? "is-active" : ""}`} onClick={() => setWindowWeeks(w)}>
              {w} sem.
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn--ghost" onClick={() => exportSignalsCSV(filtered)} disabled={!filtered.length}>
            <Icon name="download" size={14} stroke={1.75} /> Exporter CSV
          </button>
        </div>
      </div>

      {/* ── GROUPS ─────────────────────────────────────── */}
      <div className="sig-groups">
        {categories.map(cat => (
          <section key={cat} className="sig-group">
            <div className="sig-group-head">
              <h3 className="sig-group-name">{cat}</h3>
              <span className="sig-group-meta">
                {grouped[cat].length} signaux
                <span className="sig-group-meta-sep">·</span>
                {grouped[cat].filter(s => s.trend === "rising" || s.trend === "new").length} en mouvement
              </span>
            </div>
            <div className="sig-list">
              {grouped[cat].map((s, i) => (
                <div key={s.id} data-sig-id={s.id}>
                  <SignalRow
                    signal={s}
                    rank={i + 1}
                    open={openId === s.id}
                    onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                    watched={watched.includes(s.id)}
                    onWatch={() => toggleWatch(s.id)}
                    windowWeeks={windowWeeks}
                    onNavigate={onNavigate}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
        </>
      )}

      {/* ── TWEAKS PANEL ──────────────────────────────── */}
      {editMode && (
        <TweaksPanelSig
          density={density} setDensity={setDensity}
          windowWeeks={windowWeeks} setWindowWeeks={setWindowWeeks}
          view={view} setView={setView}
        />
      )}
    </div>
  );
}

// ── Tweaks floating panel ─────────────────────────────────────
function TweaksPanelSig({ density, setDensity, windowWeeks, setWindowWeeks, view, setView }) {
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 1000,
      background: "var(--surface)", border: "1px solid var(--bd)",
      borderRadius: 8, padding: 16, width: 260,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      fontFamily: "var(--font-sans)", fontSize: 13,
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tx2)", marginBottom: 12 }}>
        Tweaks · Signaux
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--tx2)", marginBottom: 6 }}>Densité</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["comfortable", "dense"].map(d => (
            <button key={d}
              className={`pill ${density === d ? "is-active" : ""}`}
              onClick={() => setDensity(d)}
              style={{ flex: 1, justifyContent: "center" }}>
              {d === "comfortable" ? "Aéré" : "Dense"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--tx2)", marginBottom: 6 }}>Vue</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { id: "editorial", label: "Éditorial" },
            { id: "hype", label: "Hype" },
            { id: "graph", label: "Graphe" },
          ].map(v => (
            <button key={v.id}
              className={`pill ${view === v.id ? "is-active" : ""}`}
              onClick={() => setView(v.id)}
              style={{ flex: 1, justifyContent: "center", minWidth: 0 }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--tx2)", marginBottom: 6 }}>Fenêtre d'analyse</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[4, 8, 12].map(w => (
            <button key={w}
              className={`pill ${windowWeeks === w ? "is-active" : ""}`}
              onClick={() => setWindowWeeks(w)}
              style={{ flex: 1, justifyContent: "center" }}>
              {w} sem.
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--tx2)", lineHeight: 1.4 }}>
        Astuce : clique sur un signal pour voir le graphe détaillé, ses sources et l'analyse Jarvis.
      </div>
    </div>
  );
}

window.PanelSignals = PanelSignals;
