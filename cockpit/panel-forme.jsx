// ═══════════════════════════════════════════════════════════════
// PANEL FORME — Withings + Strava
// ─────────────────────────────────────────────
// Hero : état du jour (poids + lede narratif)
// §1 Composition (Withings) : poids, fat%, muscle avec sparklines
// §2 Charbon (courbes mensuelles toggle poids/composition)
// §3 Entraînement : semaine en cours + cards month
// §4 Records · Objectifs
// §5 Séances récentes (liste dense)
// ═══════════════════════════════════════════════════════════════

const { useState: useFmState, useMemo: useFmMemo } = React;

// ── Sparkline util ──────────────────────────────────
function Sparkline({ data, w = 64, h = 24, color, range }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => d.value);
  const min = range ? range[0] : Math.min(...vals);
  const max = range ? range[1] : Math.max(...vals);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.value - min) / span) * h * 0.85 - h * 0.075;
    return [x, y];
  });
  const path = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const fill = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg className="fm-comp-card-spark fm-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path className="fm-spark-fill" d={fill} />
      <path d={path} style={color ? { stroke: color } : null} />
    </svg>
  );
}

// ── Line chart ──────────────────────────────────────
function LineChart({ series, ySeries, range, height = 280, showRange }) {
  const w = 1000;
  const h = height;
  const padL = 48, padR = 20, padT = 20, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const days = series.length;
  const windowDays = { "30j": 30, "90j": 90, "180j": 180 }[range] || days;
  const data = series.slice(-windowDays);

  // y scale : min/max parmi toutes les ySeries
  const allVals = ySeries.flatMap((s) => data.map((d) => d[s.key]));
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const ySpan = (yMax - yMin) || 1;
  const yPad = ySpan * 0.1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const x = (i) => padL + (i / (data.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yLo) / (yHi - yLo)) * plotH;

  // x axis labels
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.floor((i / (tickCount - 1)) * (data.length - 1)));
  const fmt = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  // y ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => yLo + (i / (yTickCount - 1)) * (yHi - yLo));

  return (
    <svg className="fm-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {/* grid */}
      {yTicks.map((t, i) => (
        <g key={"y" + i}>
          <line className="fm-chart-grid" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} />
          <text className="fm-chart-label" x={padL - 8} y={y(t) + 3} textAnchor="end">{t.toFixed(1)}</text>
        </g>
      ))}
      {/* x axis */}
      <line className="fm-chart-axis" x1={padL} x2={w - padR} y1={h - padB} y2={h - padB} />
      {ticks.map((t, i) => (
        <text key={"x" + i} className="fm-chart-label" x={x(t)} y={h - padB + 16} textAnchor="middle">
          {fmt(data[t].date)}
        </text>
      ))}
      {/* lines */}
      {ySeries.map((s) => {
        const path = "M" + data.map((d, i) => `${x(i).toFixed(1)},${y(d[s.key]).toFixed(1)}`).join(" L");
        return (
          <path
            key={s.key}
            d={path}
            fill="none"
            stroke={s.color}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
      {/* last point markers */}
      {ySeries.map((s) => {
        const last = data[data.length - 1];
        return (
          <circle
            key={"m" + s.key}
            cx={x(data.length - 1)}
            cy={y(last[s.key])}
            r="3.5"
            fill={s.color}
          />
        );
      })}
    </svg>
  );
}

// ── Day of week label ────────────────────────────────
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function PanelForme({ data, onNavigate }) {
  const FD = window.FORME_DATA;
  const [chartView, setChartView] = useFmState("weight"); // weight | comp
  const [range, setRange] = useFmState("90j");

  // Sparklines : derniers 30 jours
  const spark = useFmMemo(() => {
    const s30 = FD.weight_series.slice(-30);
    return {
      weight: s30.map((d) => ({ value: d.weight })),
      fat: s30.map((d) => ({ value: d.fat_pct })),
      muscle: s30.map((d) => ({ value: d.muscle_kg })),
    };
  }, []);

  // 7 derniers jours glissants terminant aujourd'hui
  const weekBars = useFmMemo(() => {
    const today = new Date(FD.today.date);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const sess = FD.sessions.filter((s) => s.date === iso);
      const run = sess.find((s) => s.type === "run");
      const lift = sess.find((s) => s.type === "lift");
      return {
        iso,
        dow: DOW[d.getDay()],
        dom: d.getDate(),
        isToday: iso === FD.today.date,
        isFuture: false,
        run, lift,
      };
    });
    const maxKm = Math.max(...days.map((x) => x.run?.distance_km || 0), 10);
    return { days, maxKm };
  }, []);

  const weekKmTotal = weekBars.days.reduce((a, d) => a + (d.run?.distance_km || 0), 0);

  const ySeriesByView = {
    weight: [{ key: "weight", color: "var(--brand)", label: "poids kg" }],
    comp: [
      { key: "fat_pct", color: "#b43a3a", label: "masse grasse %" },
      { key: "water_pct", color: "#2d7a4e", label: "eau %" },
    ],
    muscle: [{ key: "muscle_kg", color: "#2d7a4e", label: "masse musculaire kg" }],
  };

  return (
    <div className="fm-wrap" data-screen-label="Forme">
      {/* ══ HERO ══ */}
      <header className="fm-hero">
        <div>
          <div className="fm-hero-eyebrow">forme · withings + strava · {FD.today.date}</div>
          <h1 className="fm-hero-title">
            {FD.today.weight.toFixed(1)} kg · <em>{FD.week.streak} jours</em> actifs
          </h1>
          <p className="fm-hero-lede">
            Recomp en cours — sec depuis fin janvier. {Math.abs(FD.today.weight_delta_3m).toFixed(1)} kg
            de moins en 90 jours, {FD.today.fat_delta_month > 0 ? "+" : ""}{Math.abs(FD.today.fat_delta_month).toFixed(1)} pt de masse grasse ce mois-ci,
            muscle stable à {FD.today.muscle_kg.toFixed(0)} kg. Prépa 10k juin — volume course en montée.
          </p>
        </div>
        <div className="fm-hero-stat">
          <div className="fm-hero-stat-label">volume semaine · km course</div>
          <div className="fm-hero-stat-value">
            {FD.week.km.toFixed(1)}<span className="fm-hero-stat-unit">km</span>
          </div>
          <div className={`fm-hero-stat-delta ${FD.week.km >= FD.week.goal_km * 0.8 ? "up" : "flat"}`}>
            {FD.week.runs} sorties · objectif {FD.week.goal_km} km · {((FD.week.km / FD.week.goal_km) * 100).toFixed(0)}%
          </div>
        </div>
      </header>

      {/* ══ §1 COMPOSITION ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">01</span>
          <h2 className="fm-section-title">Composition · <em>Withings</em></h2>
          <span className="fm-section-meta">dernière pesée · ce matin 07:42</span>
        </div>
        <div className="fm-comp-grid">
          <div className="fm-comp-card">
            <div className="fm-comp-card-head">
              <span className="fm-comp-card-label">poids</span>
              <Sparkline data={spark.weight} color="var(--brand)" />
            </div>
            <div className="fm-comp-card-value">
              {FD.today.weight.toFixed(1)}<span className="fm-comp-card-unit">kg</span>
            </div>
            <div className="fm-comp-deltas">
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">7j</span>
                <span className={`fm-comp-delta-val ${FD.today.weight_delta_week < 0 ? "up" : FD.today.weight_delta_week > 0 ? "down" : "flat"}`}>
                  {FD.today.weight_delta_week > 0 ? "+" : ""}{FD.today.weight_delta_week.toFixed(1)} kg
                </span>
              </div>
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">30j</span>
                <span className={`fm-comp-delta-val ${FD.today.weight_delta_month < 0 ? "up" : FD.today.weight_delta_month > 0 ? "down" : "flat"}`}>
                  {FD.today.weight_delta_month > 0 ? "+" : ""}{FD.today.weight_delta_month.toFixed(1)} kg
                </span>
              </div>
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">90j</span>
                <span className={`fm-comp-delta-val ${FD.today.weight_delta_3m < 0 ? "up" : FD.today.weight_delta_3m > 0 ? "down" : "flat"}`}>
                  {FD.today.weight_delta_3m > 0 ? "+" : ""}{FD.today.weight_delta_3m.toFixed(1)} kg
                </span>
              </div>
            </div>
          </div>

          <div className="fm-comp-card">
            <div className="fm-comp-card-head">
              <span className="fm-comp-card-label">masse grasse</span>
              <Sparkline data={spark.fat} color="#b43a3a" />
            </div>
            <div className="fm-comp-card-value">
              {FD.today.fat_pct.toFixed(1)}<span className="fm-comp-card-unit">%</span>
            </div>
            <div className="fm-comp-deltas">
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">30j</span>
                <span className={`fm-comp-delta-val ${FD.today.fat_delta_month < 0 ? "up" : "down"}`}>
                  {FD.today.fat_delta_month > 0 ? "+" : ""}{FD.today.fat_delta_month.toFixed(1)} pt
                </span>
              </div>
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">masse grasse kg</span>
                <span className="fm-comp-delta-val flat">
                  {(FD.today.weight * FD.today.fat_pct / 100).toFixed(1)} kg
                </span>
              </div>
            </div>
          </div>

          <div className="fm-comp-card">
            <div className="fm-comp-card-head">
              <span className="fm-comp-card-label">masse musculaire</span>
              <Sparkline data={spark.muscle} color="#2d7a4e" />
            </div>
            <div className="fm-comp-card-value">
              {FD.today.muscle_kg.toFixed(1)}<span className="fm-comp-card-unit">kg</span>
            </div>
            <div className="fm-comp-deltas">
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">30j</span>
                <span className={`fm-comp-delta-val ${FD.today.muscle_delta_month > 0 ? "up" : FD.today.muscle_delta_month < 0 ? "down" : "flat"}`}>
                  {FD.today.muscle_delta_month > 0 ? "+" : ""}{FD.today.muscle_delta_month.toFixed(1)} kg
                </span>
              </div>
              <div className="fm-comp-delta">
                <span className="fm-comp-delta-key">eau</span>
                <span className="fm-comp-delta-val flat">{FD.today.water_pct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ §2 COURBES ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">02</span>
          <h2 className="fm-section-title">Courbes · <em>tendance longue</em></h2>
          <span className="fm-section-meta">{FD.weight_series.length} jours de données</span>
        </div>
        <div className="fm-chart-wrap">
          <div className="fm-chart-head">
            <div className="fm-range-toggle">
              <button className={`fm-range-btn ${chartView === "weight" ? "is-active" : ""}`} onClick={() => setChartView("weight")}>Poids</button>
              <button className={`fm-range-btn ${chartView === "comp" ? "is-active" : ""}`} onClick={() => setChartView("comp")}>Composition</button>
              <button className={`fm-range-btn ${chartView === "muscle" ? "is-active" : ""}`} onClick={() => setChartView("muscle")}>Muscle</button>
            </div>
            <div className="fm-range-toggle">
              <button className={`fm-range-btn ${range === "30j" ? "is-active" : ""}`} onClick={() => setRange("30j")}>30j</button>
              <button className={`fm-range-btn ${range === "90j" ? "is-active" : ""}`} onClick={() => setRange("90j")}>90j</button>
              <button className={`fm-range-btn ${range === "180j" ? "is-active" : ""}`} onClick={() => setRange("180j")}>180j</button>
            </div>
          </div>
          <LineChart series={FD.weight_series} ySeries={ySeriesByView[chartView]} range={range} />
          <div className="fm-chart-legend" style={{marginTop:12}}>
            {ySeriesByView[chartView].map((s) => (
              <span key={s.key}>
                <span className="fm-chart-legend-dot" style={{background: s.color}}></span>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ §3 ENTRAÎNEMENT ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">03</span>
          <h2 className="fm-section-title">Entraînement · <em>30 derniers jours</em></h2>
          <span className="fm-section-meta">strava · {FD.month.sessions} séances</span>
        </div>

        <div className="fm-train-grid">
          <div className="fm-train-card">
            <div className="fm-train-card-label">Distance</div>
            <div className="fm-train-card-value">{FD.month.km.toFixed(0)}<span className="fm-train-card-unit">km</span></div>
            <div className="fm-train-card-sub">
              <span className={FD.month.km > FD.month.km_prev ? "up" : "down"}>
                {FD.month.km > FD.month.km_prev ? "▲" : "▼"} {Math.abs(FD.month.km - FD.month.km_prev).toFixed(1)} km
              </span> vs 30j préc.
            </div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Allure moyenne</div>
            <div className="fm-train-card-value">
              {Math.floor(FD.month.pace_avg)}:{String(Math.round((FD.month.pace_avg % 1) * 60)).padStart(2, "0")}
              <span className="fm-train-card-unit">/km</span>
            </div>
            <div className="fm-train-card-sub">{FD.month.runs} sorties course</div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Volume muscu</div>
            <div className="fm-train-card-value">{(FD.month.tonnage / 1000).toFixed(1)}<span className="fm-train-card-unit">t</span></div>
            <div className="fm-train-card-sub">
              <span className={FD.month.tonnage > FD.month.tonnage_prev ? "up" : "down"}>
                {FD.month.tonnage > FD.month.tonnage_prev ? "▲" : "▼"} {((FD.month.tonnage - FD.month.tonnage_prev) / 1000).toFixed(1)}t
              </span> · {FD.month.lifts} séances
            </div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Régularité</div>
            <div className="fm-train-card-value">{FD.week.streak}<span className="fm-train-card-unit">j</span></div>
            <div className="fm-train-card-sub">streak · {FD.week.days_active}/7 cette semaine</div>
          </div>
        </div>

        {/* Week strip */}
        <div className="fm-weekbars">
          <div className="fm-weekbars-head">
            <span className="fm-weekbars-title">7 derniers jours · course + muscu</span>
            <div className="fm-weekbars-total">
              {weekKmTotal.toFixed(1)} km <small>· {weekBars.days.filter((d) => d.run || d.lift).length} séances</small>
            </div>
          </div>
          <div className="fm-weekbars-grid">
            {weekBars.days.map((d) => {
              const runPct = d.run ? (d.run.distance_km / weekBars.maxKm) * 100 : 0;
              const liftPct = d.lift ? 40 : 0;
              return (
                <div key={d.iso} className="fm-weekbar">
                  <div className="fm-weekbar-stack" style={{ height: 100 }}>
                    {d.run && <div className="fm-weekbar-run" style={{ height: `${runPct}%` }} />}
                    {d.lift && <div className="fm-weekbar-lift" style={{ height: `${liftPct}%` }} />}
                    {!d.run && !d.lift && !d.isFuture && <div className="fm-weekbar-rest" />}
                  </div>
                  <div className={`fm-weekbar-day ${d.isToday ? "is-today" : ""}`}>
                    {d.dow} {d.dom}
                  </div>
                  {d.run && <div className="fm-weekbar-val">{d.run.distance_km.toFixed(1)}k</div>}
                </div>
              );
            })}
          </div>
          <div className="fm-chart-legend" style={{marginTop:12}}>
            <span><span className="fm-chart-legend-dot" style={{background:"var(--brand)", height:8}}></span>Course</span>
            <span><span className="fm-chart-legend-dot" style={{background:"color-mix(in srgb, var(--brand) 50%, var(--bg2))", height:8}}></span>Muscu</span>
            <span><span className="fm-chart-legend-dot" style={{background:"var(--bg2)", border:"1px dashed var(--bd)", height:8}}></span>Repos</span>
          </div>
        </div>
      </section>

      {/* ══ §4 RECORDS + OBJECTIFS ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">04</span>
          <h2 className="fm-section-title">Records · <em>&amp; objectifs</em></h2>
          <span className="fm-section-meta">personal bests sur 12 mois</span>
        </div>

        <div className="fm-goals" style={{marginBottom: 24}}>
          {FD.goals.map((g) => (
            <div key={g.label} className="fm-goal">
              <div className="fm-goal-head">
                <span className="fm-goal-label">{g.label}</span>
                <span className="fm-goal-nums"><strong>{g.current}</strong> → {g.target}</span>
              </div>
              <div className="fm-goal-bar">
                <div className="fm-goal-bar-fill" style={{ width: `${g.progress * 100}%` }} />
              </div>
              <div className="fm-goal-foot">
                <span>{(g.progress * 100).toFixed(0)}% · échéance {g.deadline}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="fm-records">
          {FD.records.map((r) => (
            <div key={r.label} className="fm-record">
              <div>
                <div className="fm-record-label">{r.label}</div>
                {r.pace && <span className="fm-record-pace">{r.pace}</span>}
              </div>
              <div>
                <div className="fm-record-value">{r.value}</div>
                <span className="fm-record-date">il y a {r.ago}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §5 SÉANCES RÉCENTES ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">05</span>
          <h2 className="fm-section-title">Séances · <em>journal</em></h2>
          <span className="fm-section-meta">les 20 dernières</span>
        </div>
        <div className="fm-sessions">
          <div className="fm-sess-head">
            <span>date</span>
            <span>type</span>
            <span>séance</span>
            <span style={{textAlign:"right"}}>métrique</span>
            <span style={{textAlign:"right"}}>intensité</span>
            <span style={{textAlign:"right"}}>durée</span>
          </div>
          {FD.sessions.slice(0, 20).map((s, i) => {
            const d = new Date(s.date);
            const dateFmt = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            if (s.type === "run") {
              const paceMin = Math.floor(s.pace_min_km);
              const paceSec = Math.round((s.pace_min_km - paceMin) * 60);
              return (
                <div key={i} className="fm-sess-row">
                  <span className="fm-sess-date">{dateFmt}</span>
                  <span className="fm-sess-type" data-t="run">run</span>
                  <span className="fm-sess-name">{s.name}<small>{s.effort}</small></span>
                  <span className="fm-sess-metric">
                    {s.distance_km.toFixed(1)} km
                    <span className="fm-sess-metric-sub">{paceMin}:{String(paceSec).padStart(2,"0")}/km</span>
                  </span>
                  <span className="fm-sess-metric">
                    {s.hr_avg} bpm
                    <span className="fm-sess-metric-sub">+{s.elev_m} m D+</span>
                  </span>
                  <span className="fm-sess-dur">{Math.floor(s.duration_min)}'</span>
                </div>
              );
            } else {
              return (
                <div key={i} className="fm-sess-row">
                  <span className="fm-sess-date">{dateFmt}</span>
                  <span className="fm-sess-type" data-t="lift">lift</span>
                  <span className="fm-sess-name">{s.name}<small>{s.effort}</small></span>
                  <span className="fm-sess-metric">
                    {(s.tonnage_kg / 1000).toFixed(1)} t
                    <span className="fm-sess-metric-sub">{s.sets} sets</span>
                  </span>
                  <span className="fm-sess-metric" style={{color:"var(--tx3)"}}>—</span>
                  <span className="fm-sess-dur">{s.duration_min}'</span>
                </div>
              );
            }
          })}
        </div>
      </section>
    </div>
  );
}

window.PanelForme = PanelForme;
