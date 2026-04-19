// Panel : Apprentissage → Radar compétences
// Deux variantes : "spider" (éditorial Dawn) et "carte" (territoire)
const { useState: useStateRadar, useMemo: useMemoRadar } = React;

function PanelRadar({ data, onNavigate }) {
  const a = window.APPRENTISSAGE_DATA;
  const axes = a.radar.axes;
  const summary = a.radar.summary;

  const [selectedAxis, setSelectedAxis] = useStateRadar(null);

  const selected = selectedAxis ? axes.find(x => x.id === selectedAxis) : null;

  return (
    <div className="panel-page" data-screen-label="Radar compétences">
      {/* ── Hero ───────────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Apprentissage · Radar compétences · S17</div>
        <h1 className="panel-hero-title">
          Ton niveau IA, <em className="serif-italic">axe par axe</em>
        </h1>
        <p className="panel-hero-sub">
          Moyenne générale <strong>{summary.avg}/100</strong>, <strong>{summary.level_global}</strong>. {summary.position_peers}. Score calculé sur tes lectures, challenges complétés et auto-évaluation.
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
            <span className="radar-tb-stat-val radar-tb-stat-val--gain">+12 agents</span>
          </span>
          <span className="radar-tb-stat">
            <span className="radar-tb-stat-label">Axe faible</span>
            <span className="radar-tb-stat-val radar-tb-stat-val--weak">Fine-tuning</span>
          </span>
        </div>
      </div>

      {/* ── Contenu ────────────────────────────────────── */}
      <RadarSpider axes={axes} summary={summary}
        selectedAxis={selectedAxis} onSelectAxis={setSelectedAxis} selected={selected} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VARIANTE A : Spider chart éditorial (Dawn)
// ─────────────────────────────────────────────────────────
function RadarSpider({ axes, summary, selectedAxis, onSelectAxis, selected }) {
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

  // Best strengths / gaps
  const sorted = [...axes].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3);
  const weaknesses = sorted.slice(-3).reverse();
  const gainers = [...axes].sort((a, b) => b.delta_30d - a.delta_30d).slice(0, 3);

  return (
    <div className="radar-wrap radar-wrap--spider">
      {/* Colonne gauche : stats narratives */}
      <aside className="radar-aside radar-aside--left">
        <div className="section-kicker">Ce qui ressort ce mois</div>
        <h3 className="radar-aside-title">En <em className="serif-italic">trois coups d'œil</em></h3>

        <div className="radar-narrative">
          <div className="radar-narrative-item">
            <span className="radar-narrative-label">Ton arme</span>
            <p className="radar-narrative-body">
              Tu domines sur <strong>Régulation / AI Act</strong> (82/100). Top 5% de ton réseau. Avantage décisif en interne Malakoff.
            </p>
          </div>
          <div className="radar-narrative-item">
            <span className="radar-narrative-label">Ton angle mort</span>
            <p className="radar-narrative-body">
              <strong>Fine-tuning</strong> reste à 38/100, stagne depuis 30j. LoRA 8-bit est devenu accessible — temps d'y aller.
            </p>
          </div>
          <div className="radar-narrative-item">
            <span className="radar-narrative-label">La vague qui monte</span>
            <p className="radar-narrative-body">
              <strong>Agents & outils</strong> : +12 points ce mois grâce au cycle Claude Agents. Continue sur la lancée.
            </p>
          </div>
          <div className="radar-narrative-item radar-narrative-item--warn">
            <span className="radar-narrative-label">Attention</span>
            <p className="radar-narrative-body">
              <strong>MLOps / déploiement</strong> perd 1 point. Tu n'as rien lu de pratique sur vLLM/Triton ce mois.
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
          <AxisDetail axis={selected} onClose={() => onSelectAxis(null)} />
        ) : (
          <AxisList axes={axes} gainers={gainers} onSelect={onSelectAxis} />
        )}
      </aside>
    </div>
  );
}

function AxisList({ axes, gainers, onSelect }) {
  return (
    <>
      <div className="section-kicker">Les 10 axes</div>
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

function AxisDetail({ axis, onClose }) {
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
      <blockquote className="radar-detail-note">
        <span className="radar-detail-note-mark">Note de Jarvis</span>
        <span className="radar-detail-note-text">{axis.note}</span>
      </blockquote>
      <div className="radar-detail-actions">
        <button className="btn btn--primary btn--sm">
          <Icon name="arrow_right" size={12} stroke={2} /> Voir recos
        </button>
        <button className="btn btn--ghost btn--sm">
          <Icon name="trophy" size={12} stroke={1.75} /> Défi cet axe
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VARIANTE B : Carte d'exploration (territoires)
// ─────────────────────────────────────────────────────────
function RadarCarte({ axes, summary, selectedAxis, onSelectAxis, selected }) {
  // Chaque axe devient un "territoire" avec un score = surface conquise
  // On range par score décroissant — terres conquises en haut, inconnues en bas
  const sorted = [...axes].sort((a, b) => b.score - a.score);

  const zones = sorted.map(ax => {
    let zone, tone;
    if (ax.score >= 70) { zone = "conquis"; tone = "Terres conquises"; }
    else if (ax.score >= 50) { zone = "frontiere"; tone = "Frontières actives"; }
    else { zone = "inconnu"; tone = "Terres inconnues"; }
    return { ...ax, zone, tone };
  });

  const conquis = zones.filter(z => z.zone === "conquis");
  const frontiere = zones.filter(z => z.zone === "frontiere");
  const inconnu = zones.filter(z => z.zone === "inconnu");

  return (
    <div className="radar-wrap radar-wrap--carte">
      <div className="radar-carte-intro">
        <div className="section-kicker">Ta carte IA</div>
        <h2 className="radar-carte-intro-title">
          Trois <em className="serif-italic">territoires</em>, dix axes,<br/>
          un chemin à suivre
        </h2>
        <p className="radar-carte-intro-body">
          Les <strong>terres conquises</strong> sont celles où tu as passé le seuil d'expertise. Les <strong>frontières actives</strong> sont en progression. Les <strong>terres inconnues</strong> attendent d'être explorées — c'est là que la progression la plus forte se trouve.
        </p>
      </div>

      <CarteZone title="Terres conquises" tone="conquis" count={conquis.length}
        desc="Tu peux compter sur ces axes. Maintiens le niveau, partage ton expertise."
        axes={conquis} onSelect={onSelectAxis} selectedAxis={selectedAxis} />
      <CarteZone title="Frontières actives" tone="frontiere" count={frontiere.length}
        desc="Zone de progression. Continue à lire, pratique régulièrement."
        axes={frontiere} onSelect={onSelectAxis} selectedAxis={selectedAxis} />
      <CarteZone title="Terres inconnues" tone="inconnu" count={inconnu.length}
        desc="Gains potentiels les plus forts. Un challenge peut débloquer +20 pts."
        axes={inconnu} onSelect={onSelectAxis} selectedAxis={selectedAxis} />
    </div>
  );
}

function CarteZone({ title, tone, count, desc, axes, onSelect, selectedAxis }) {
  return (
    <section className={`radar-carte-zone radar-carte-zone--${tone}`}>
      <header className="radar-carte-zone-head">
        <div>
          <div className="section-kicker">{title}</div>
          <div className="radar-carte-zone-count">{count} axe{count > 1 ? "s" : ""}</div>
        </div>
        <p className="radar-carte-zone-desc">{desc}</p>
      </header>
      <div className="radar-carte-axes">
        {axes.map(ax => (
          <CarteAxisCard key={ax.id} axis={ax} selected={selectedAxis === ax.id} onClick={() => onSelect(selectedAxis === ax.id ? null : ax.id)} />
        ))}
      </div>
    </section>
  );
}

function CarteAxisCard({ axis, selected, onClick }) {
  const trend = axis.delta_30d > 0 ? "up" : axis.delta_30d < 0 ? "down" : "flat";
  return (
    <button className={`radar-carte-card ${selected ? "is-selected" : ""}`} onClick={onClick}>
      <div className="radar-carte-card-head">
        <span className="radar-carte-card-label">{axis.label}</span>
        <span className="radar-carte-card-score">{axis.score}</span>
      </div>
      <div className="radar-carte-card-bar">
        <span className="radar-carte-card-bar-fill" style={{ width: `${axis.score}%` }} />
      </div>
      <div className="radar-carte-card-meta">
        <span>{axis.level}</span>
        <span className="radar-carte-card-sep">·</span>
        <span className={`radar-carte-card-delta radar-carte-card-delta--${trend}`}>
          {axis.delta_30d > 0 ? "+" : ""}{axis.delta_30d} pts 30j
        </span>
      </div>
      <p className="radar-carte-card-note">{axis.note}</p>
    </button>
  );
}

window.PanelRadar = PanelRadar;
