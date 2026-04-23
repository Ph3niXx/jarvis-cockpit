// Panel : Apprentissage → Radar compétences
const { useState: useStateRadar, useMemo: useMemoRadar } = React;

function isoWeekRadar(d){
  const t = new Date(d);
  t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
}

function PanelRadar({ data, onNavigate }) {
  const a = window.APPRENTISSAGE_DATA;
  const axes = a.radar.axes;
  const summary = a.radar.summary;

  const [selectedAxis, setSelectedAxis] = useStateRadar(null);

  const selected = selectedAxis ? axes.find(x => x.id === selectedAxis) : null;
  const weekNum = String(isoWeekRadar(new Date())).padStart(2, "0");

  // Real stats from axes — no more hardcoded "+12 agents" / "Fine-tuning".
  const sortedByScore = [...axes].sort((a, b) => b.score - a.score);
  const sortedByDelta = [...axes].sort((a, b) => b.delta_30d - a.delta_30d);
  const strongest = sortedByScore[0];
  const weakest = sortedByScore[sortedByScore.length - 1];
  const topGainer = sortedByDelta[0];

  return (
    <div className="panel-page" data-screen-label="Radar compétences">
      {/* ── Hero ───────────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Apprentissage · Radar compétences · S{weekNum}</div>
        <h1 className="panel-hero-title">
          Ton niveau IA, <em className="serif-italic">axe par axe</em>
        </h1>
        <p className="panel-hero-sub">
          Moyenne générale <strong>{summary.avg}/100</strong> — <strong>{summary.level_global}</strong>. Les scores bougent quand tu complètes des challenges IA (+0,5 pt par challenge passé à 70%+). Clique un axe pour le détail, l'historique 12 semaines et les recos associées.
        </p>
      </div>

      {/* ── Toolbar ────────────────────────────────────── */}
      <div className="panel-toolbar">
        <div className="radar-toolbar-stats">
          <span className="radar-tb-stat">
            <span className="radar-tb-stat-label">Moyenne</span>
            <span className="radar-tb-stat-val">{summary.avg}</span>
          </span>
          <span className="radar-tb-stat">
            <span className="radar-tb-stat-label">Plus forte progression</span>
            <span className={`radar-tb-stat-val ${topGainer && topGainer.delta_30d > 0 ? "radar-tb-stat-val--gain" : ""}`}>
              {topGainer && topGainer.delta_30d > 0
                ? `+${topGainer.delta_30d} ${topGainer.label}`
                : "Pas encore de mouvement"}
            </span>
          </span>
          <span className="radar-tb-stat">
            <span className="radar-tb-stat-label">Axe le plus faible</span>
            <span className="radar-tb-stat-val radar-tb-stat-val--weak">
              {weakest ? `${weakest.label} · ${weakest.score}` : "—"}
            </span>
          </span>
        </div>
      </div>

      {/* ── Contenu ────────────────────────────────────── */}
      <RadarSpider
        axes={axes}
        summary={summary}
        selectedAxis={selectedAxis}
        onSelectAxis={setSelectedAxis}
        selected={selected}
        strongest={strongest}
        weakest={weakest}
        topGainer={topGainer}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VARIANTE A : Spider chart éditorial (Dawn)
// ─────────────────────────────────────────────────────────
function RadarSpider({ axes, summary, selectedAxis, onSelectAxis, selected, strongest, weakest, topGainer, onNavigate }) {
  const W = 680;
  const H = 520;
  const CX = W / 2;
  const CY = H / 2;
  const R = H * 0.36;
  const SIZE = H;
  const n = axes.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [CX + Math.cos(angle(i)) * r, CY + Math.sin(angle(i)) * r];

  // rings : 25, 50, 75, 100
  const rings = [0.25, 0.5, 0.75, 1].map((f, i) => (
    <polygon key={i}
      points={axes.map((_, j) => pt(j, R * f).join(",")).join(" ")}
      fill={i === 1 ? "var(--bg2)" : "none"}
      stroke="var(--bd)"
      strokeWidth="0.8"
      opacity={i === 3 ? 0.7 : 0.4} />
  ));

  // spokes
  const spokes = axes.map((_, i) => {
    const [x, y] = pt(i, R);
    return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--bd)" strokeWidth="0.6" opacity="0.4" />;
  });

  // target polygon (niveau cible)
  const targetPts = axes.map((a, i) => pt(i, (R * a.target) / 100).join(",")).join(" ");

  // current polygon (niveau actuel)
  const currentPts = axes.map((a, i) => pt(i, (R * a.score) / 100).join(",")).join(" ");

  // Stats narratives calculées depuis les vraies données.
  const atTargetCount = axes.filter(a => a.score >= a.target).length;
  const biggestLoss = [...axes].sort((a, b) => a.delta_30d - b.delta_30d)[0];
  const gapToTarget = weakest ? Math.max(0, weakest.target - weakest.score) : 0;

  return (
    <div className="radar-wrap radar-wrap--spider">
      {/* Colonne gauche : stats calculées depuis les vraies data */}
      <aside className="radar-aside radar-aside--left">
        <div className="section-kicker">Ce que dit ton radar</div>
        <h3 className="radar-aside-title">En <em className="serif-italic">quatre coups d'œil</em></h3>

        <div className="radar-narrative">
          <div className="radar-narrative-item">
            <span className="radar-narrative-label">Ton point fort</span>
            <p className="radar-narrative-body">
              {strongest ? (
                <>Tu domines sur <strong>{strongest.label}</strong> ({strongest.score}/100, niveau {strongest.level.toLowerCase()}). C'est là où tu peux rayonner auprès de tes pairs.</>
              ) : "Radar vide — complète un premier challenge pour lancer ton historique."}
            </p>
          </div>
          <div className="radar-narrative-item">
            <span className="radar-narrative-label">Ton angle mort</span>
            <p className="radar-narrative-body">
              {weakest ? (
                <><strong>{weakest.label}</strong> reste à {weakest.score}/100 — cible à {weakest.target}, soit un écart de {gapToTarget} points. C'est le gain le plus rapide à aller chercher.</>
              ) : "—"}
            </p>
          </div>
          <div className="radar-narrative-item">
            <span className="radar-narrative-label">La vague qui monte</span>
            <p className="radar-narrative-body">
              {topGainer && topGainer.delta_30d > 0 ? (
                <><strong>{topGainer.label}</strong> : +{topGainer.delta_30d} pts sur 30 jours. Continue sur la lancée.</>
              ) : "Pas encore assez d'historique pour détecter une tendance sur 30 jours."}
            </p>
          </div>
          <div className={`radar-narrative-item ${biggestLoss && biggestLoss.delta_30d < 0 ? "radar-narrative-item--warn" : ""}`}>
            <span className="radar-narrative-label">
              {biggestLoss && biggestLoss.delta_30d < 0 ? "Attention" : "Cap atteint"}
            </span>
            <p className="radar-narrative-body">
              {biggestLoss && biggestLoss.delta_30d < 0 ? (
                <><strong>{biggestLoss.label}</strong> perd {Math.abs(biggestLoss.delta_30d)} pts sur 30 jours. Prévois une session pour arrêter la glissade.</>
              ) : (
                <>{atTargetCount} axe{atTargetCount > 1 ? "s" : ""} sur {axes.length} {atTargetCount > 1 ? "ont" : "a"} atteint la cible. Prochain objectif : pousser {weakest ? weakest.label : "tes axes faibles"}.</>
              )}
            </p>
          </div>
        </div>
      </aside>

      {/* Colonne centre : radar */}
      <div className="radar-center">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="radar-svg">
          {rings}
          {spokes}

          {/* ring label (100 only, top) */}
          <text x={CX + 4} y={CY - R + 4} className="radar-ring-label">100</text>

          {/* target polygon */}
          <polygon points={targetPts}
            fill="none"
            stroke="var(--tx3)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6" />

          {/* current polygon */}
          <polygon points={currentPts}
            fill="var(--brand)"
            fillOpacity="0.16"
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinejoin="round" />

          {/* axis points + labels */}
          {axes.map((a, i) => {
            const [px, py] = pt(i, (R * a.score) / 100);
            const [lx, ly] = pt(i, R + 30);
            const anchor = lx < CX - 4 ? "end" : lx > CX + 4 ? "start" : "middle";
            const isSelected = selectedAxis === a.id;
            // split label on " / " or " & " into 2 lines
            const parts = a.label.split(/ \/ | & /);
            const line1 = parts[0];
            const line2 = parts.slice(1).join(a.label.includes(" / ") ? " / " : " & ");
            return (
              <g key={a.id} onClick={() => onSelectAxis(isSelected ? null : a.id)} style={{ cursor: "pointer" }}>
                <circle cx={px} cy={py} r={isSelected ? 7 : 4.5}
                  fill="var(--brand)"
                  stroke="var(--bg)" strokeWidth="2"
                  className={`radar-dot ${isSelected ? "is-selected" : ""}`} />
                <text x={lx} y={ly - 6} textAnchor={anchor}
                  className={`radar-label ${isSelected ? "is-selected" : ""}`}>
                  {line1}
                </text>
                {line2 && (
                  <text x={lx} y={ly + 5} textAnchor={anchor}
                    className={`radar-label ${isSelected ? "is-selected" : ""}`}>
                    {line2}
                  </text>
                )}
                <text x={lx} y={ly + (line2 ? 19 : 9)} textAnchor={anchor}
                  className="radar-label-score">
                  {a.score}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="radar-legend">
          <span className="radar-legend-item">
            <span className="radar-legend-swatch radar-legend-swatch--current" />
            Ton niveau actuel
          </span>
          <span className="radar-legend-item">
            <span className="radar-legend-swatch radar-legend-swatch--target" />
            Ta cible 12 mois
          </span>
          <span className="radar-legend-hint">Clique sur un axe pour le détail</span>
        </div>
      </div>

      {/* Colonne droite : liste des axes ou détail */}
      <aside className="radar-aside radar-aside--right">
        {selected ? (
          <AxisDetail axis={selected} onClose={() => onSelectAxis(null)} onNavigate={onNavigate} />
        ) : (
          <AxisList axes={axes} onSelect={onSelectAxis} />
        )}
      </aside>
    </div>
  );
}

function AxisList({ axes, onSelect }) {
  return (
    <>
      <div className="section-kicker">Les {axes.length} axes</div>
      <h3 className="radar-aside-title">Détail complet</h3>
      <ul className="radar-axis-list">
        {axes.map(ax => {
          const trend = ax.delta_30d > 0 ? "up" : ax.delta_30d < 0 ? "down" : "flat";
          return (
            <li key={ax.id}>
              <button className="radar-axis-item" onClick={() => onSelect(ax.id)}>
                <div className="radar-axis-item-head">
                  <span className="radar-axis-item-label">{ax.label}</span>
                  <span className="radar-axis-item-score">{ax.score}</span>
                </div>
                <div className="radar-axis-item-bar">
                  <span className="radar-axis-item-bar-track" />
                  <span className="radar-axis-item-bar-target" style={{ left: `${ax.target}%` }} />
                  <span className="radar-axis-item-bar-fill" style={{ width: `${ax.score}%` }} />
                </div>
                <div className="radar-axis-item-meta">
                  <span className={`radar-axis-item-level radar-axis-item-level--${ax.level.toLowerCase().split(" ")[0].replace("é","e").replace("à","a")}`}>
                    {ax.level}
                  </span>
                  <span className={`radar-axis-item-delta radar-axis-item-delta--${trend}`}>
                    {ax.delta_30d > 0 ? `+${ax.delta_30d}` : ax.delta_30d}{" "}pts 30j
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// 12-week mini sparkline — SVG polyline of the axis history (post-
// normalization to 0-100). Silent if history too short to be meaningful.
function AxisSparkline({ history }) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const W = 220, H = 44, PAD = 4;
  const scores = history.map(h => h.score);
  const minV = Math.min(...scores, 0);
  const maxV = Math.max(...scores, 100);
  const span = Math.max(1, maxV - minV);
  const step = (W - PAD * 2) / Math.max(1, history.length - 1);
  const pts = history.map((h, i) => {
    const x = PAD + i * step;
    const y = PAD + (H - PAD * 2) * (1 - (h.score - minV) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = history[history.length - 1];
  const lastX = PAD + (history.length - 1) * step;
  const lastY = PAD + (H - PAD * 2) * (1 - (last.score - minV) / span);
  return (
    <div className="radar-detail-spark">
      <div className="radar-detail-spark-head">
        <span className="radar-detail-spark-label">Historique · {history.length} points</span>
        <span className="radar-detail-spark-range">{history[0].date.slice(5)} → {last.date.slice(5)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="radar-detail-spark-svg" preserveAspectRatio="none">
        <polyline points={pts.join(" ")} fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="2.5" fill="var(--brand)" />
      </svg>
    </div>
  );
}

function AxisDetail({ axis, onClose, onNavigate }) {
  const trend = axis.delta_30d > 0 ? "up" : axis.delta_30d < 0 ? "down" : "flat";
  const gap = axis.target - axis.score;
  return (
    <div className="radar-detail">
      <button className="radar-detail-close" onClick={onClose}>← Retour à la liste</button>
      <div className="section-kicker">Axe sélectionné</div>
      <h3 className="radar-detail-title">{axis.label}</h3>
      <div className="radar-detail-score-wrap">
        <span className="radar-detail-score">{axis.score}</span>
        <span className="radar-detail-score-unit">/100</span>
        <span className={`radar-detail-level radar-detail-level--${axis.level.toLowerCase().split(" ")[0].replace("é","e")}`}>{axis.level}</span>
      </div>
      <div className="radar-detail-progress">
        <span className="radar-detail-progress-track" />
        <span className="radar-detail-progress-target" style={{ left: `${axis.target}%` }} />
        <span className="radar-detail-progress-fill" style={{ width: `${axis.score}%` }} />
      </div>
      <div className="radar-detail-progress-legend">
        <span>0</span>
        <span>Cible {axis.target}</span>
        <span>100</span>
      </div>
      <div className="radar-detail-stats">
        <div>
          <span className="radar-detail-stat-label">Sur 30j</span>
          <span className={`radar-detail-stat-val radar-detail-stat-val--${trend}`}>
            {axis.delta_30d > 0 ? `+${axis.delta_30d}` : axis.delta_30d} pts
          </span>
        </div>
        <div>
          <span className="radar-detail-stat-label">À la cible</span>
          <span className="radar-detail-stat-val">
            {gap > 0 ? `+${gap} pts` : "Atteint"}
          </span>
        </div>
      </div>
      <AxisSparkline history={axis.history_12w} />
      <blockquote className="radar-detail-note">
        <span className="radar-detail-note-mark">Note de Jarvis</span>
        <span className="radar-detail-note-text">{axis.note}</span>
      </blockquote>
      <div className="radar-detail-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => {
            try { localStorage.setItem("recos-prefill-axis", axis.axis || axis.id); } catch {}
            if (onNavigate) onNavigate("recos");
          }}
        >
          <Icon name="arrow_right" size={12} stroke={2} /> Voir recos
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => {
            try { localStorage.setItem("challenges-prefill-axis", axis.axis || axis.id); } catch {}
            if (onNavigate) onNavigate("challenges");
          }}
        >
          <Icon name="trophy" size={12} stroke={1.75} /> Défi cet axe
        </button>
      </div>
    </div>
  );
}

window.PanelRadar = PanelRadar;
