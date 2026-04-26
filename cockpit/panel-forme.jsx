// ═══════════════════════════════════════════════════════════════
// PANEL FORME — Hero global (Withings + cross-discipline) + tabs
// ─────────────────────────────────────────────
// Hero  : composition Withings (poids/MG/muscle) + strip 7j multi-discipline
//         + 4 KPIs cross-discipline (séances/durée/streak/jours actifs)
// Tabs  : Course (KPIs run + charge hebdo + records + journal)
//         Workout (KPIs workout + charge min/sem + journal)
// Bas   : Courbes composition long range (toujours visible si Withings actif)
// ═══════════════════════════════════════════════════════════════

const { useState: useFmState, useMemo: useFmMemo, useEffect: useFmEffect } = React;

const FORME_TAB_KEY = "forme.tab";

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

// ── Bar chart générique — barres verticales avec label et axe Y ─────
// `unit` (e.g. "km", "min") apparaît dans le label de tick max ; `colorVar`
// surcharge la couleur de barre (defaut --brand). Utilisé pour la charge
// hebdo course (km) et workout (minutes).
function WeekLoadChart({ weeks, valueKey = "km", unit = "km", colorVar = "var(--brand)" }) {
  if (!weeks || !weeks.length) return null;
  const w = 1000;
  const h = 220;
  const padL = 48, padR = 20, padT = 20, padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxV = Math.max(10, ...weeks.map((x) => x[valueKey] || 0));
  const barW = plotW / weeks.length * 0.7;
  const stepX = plotW / weeks.length;
  const yTicks = [0, maxV / 2, maxV];

  return (
    <svg className="fm-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {yTicks.map((t, i) => {
        const y = padT + plotH - (t / maxV) * plotH;
        return (
          <g key={"y" + i}>
            <line className="fm-chart-grid" x1={padL} x2={w - padR} y1={y} y2={y} />
            <text className="fm-chart-label" x={padL - 8} y={y + 3} textAnchor="end">{Math.round(t)}</text>
          </g>
        );
      })}
      {weeks.map((wk, i) => {
        const v = wk[valueKey] || 0;
        const barH = (v / maxV) * plotH;
        const x = padL + i * stepX + (stepX - barW) / 2;
        const y = padT + plotH - barH;
        const d = new Date(wk.week_start);
        const lbl = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={colorVar} rx="2" />
            {v > 0 && <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fm-chart-label" style={{ fontSize: 10 }}>{v}</text>}
            <text x={x + barW / 2} y={h - padB + 14} textAnchor="middle" className="fm-chart-label">{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Day of week label ────────────────────────────────
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

// Couleur par catégorie (utilisée dans le strip 7j et le journal)
const CAT_COLOR = {
  run: "var(--brand)",
  workout: "#5b8def",
  other: "var(--tx3)",
};
const CAT_LABEL = {
  run: "Course",
  workout: "Workout",
  other: "Autre",
};

// ── Line chart (composition) ────────────────────────
function LineChart({ series, ySeries, range, height = 280 }) {
  const w = 1000;
  const h = height;
  const padL = 52, padR = 20, padT = 20, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const windowDays = { "30j": 30, "90j": 90, "180j": 180 }[range] || series.length;
  const data = series.slice(-windowDays).filter(d => ySeries.every(s => d[s.key] != null));
  if (data.length < 2) {
    return (
      <div className="fm-chart-empty" style={{ padding: "60px 20px", textAlign: "center", color: "var(--tx3)" }}>
        Pas assez de mesures sur {range} pour tracer une courbe.
      </div>
    );
  }

  const allVals = ySeries.flatMap((s) => data.map((d) => d[s.key]));
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const ySpan = (yMax - yMin) || 1;
  const yPad = ySpan * 0.1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const x = (i) => padL + (i / (data.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yLo) / (yHi - yLo)) * plotH;

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.floor((i / (tickCount - 1)) * (data.length - 1)));
  const fmt = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => yLo + (i / (yTickCount - 1)) * (yHi - yLo));

  return (
    <svg className="fm-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {yTicks.map((t, i) => (
        <g key={"y" + i}>
          <line className="fm-chart-grid" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} />
          <text className="fm-chart-label" x={padL - 8} y={y(t) + 3} textAnchor="end">{t.toFixed(1)}</text>
        </g>
      ))}
      <line className="fm-chart-axis" x1={padL} x2={w - padR} y1={h - padB} y2={h - padB} />
      {ticks.map((t, i) => (
        <text key={"x" + i} className="fm-chart-label" x={x(t)} y={h - padB + 16} textAnchor="middle">
          {fmt(data[t].date)}
        </text>
      ))}
      {ySeries.map((s) => {
        const path = "M" + data.map((d, i) => `${x(i).toFixed(1)},${y(d[s.key]).toFixed(1)}`).join(" L");
        return (
          <path key={s.key} d={path} fill="none" stroke={s.color}
            strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        );
      })}
      {ySeries.map((s) => {
        const last = data[data.length - 1];
        return (
          <circle key={"m" + s.key} cx={x(data.length - 1)} cy={y(last[s.key])} r="3.5" fill={s.color} />
        );
      })}
    </svg>
  );
}

// ── Format helpers ──────────────────────────────────
function fmtMinAsHour(min) {
  const total = Math.round(min || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}'`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
function fmtPace(p) {
  if (!p) return "—";
  const m = Math.floor(p);
  const s = Math.round((p - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
// Sous-onglet COURSE — KPIs run + charge hebdo + records + journal
// ═══════════════════════════════════════════════════════════════
function CourseTab({ FD, weekLoadKm }) {
  const runSessions = FD.run_sessions || FD.sessions.filter(s => s.type === "run");
  const hasRuns = runSessions.length > 0;

  return (
    <>
      {/* §1 ENTRAÎNEMENT COURSE */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">01</span>
          <h2 className="fm-section-title">Course · <em>30 derniers jours</em></h2>
          <span className="fm-section-meta">strava · {FD.month.runs || 0} sorties</span>
        </div>

        <div className="fm-train-grid">
          <div className="fm-train-card">
            <div className="fm-train-card-label">Distance</div>
            <div className="fm-train-card-value">{(FD.month.km || 0).toFixed(0)}<span className="fm-train-card-unit">km</span></div>
            <div className="fm-train-card-sub">
              {FD.month.km_prev > 0 ? (
                <>
                  <span className={FD.month.km > FD.month.km_prev ? "up" : "down"}>
                    {FD.month.km > FD.month.km_prev ? "▲" : "▼"} {Math.abs(FD.month.km - FD.month.km_prev).toFixed(1)} km
                  </span> vs 30j préc.
                </>
              ) : (
                <>{FD.month.runs} sorties course</>
              )}
            </div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Allure moyenne</div>
            <div className="fm-train-card-value">
              {FD.month.pace_avg > 0 ? (
                <>
                  {fmtPace(FD.month.pace_avg)}
                  <span className="fm-train-card-unit">/km</span>
                </>
              ) : (
                <span style={{ color: "var(--tx3)" }}>—</span>
              )}
            </div>
            <div className="fm-train-card-sub">{FD.month.runs} sorties course</div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Dénivelé</div>
            <div className="fm-train-card-value">{(FD.month.elev_m || 0).toLocaleString("fr-FR")}<span className="fm-train-card-unit">m D+</span></div>
            <div className="fm-train-card-sub">{(FD.month.calories || 0).toLocaleString("fr-FR")} kcal</div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Volume semaine</div>
            <div className="fm-train-card-value">{(FD.week.km || 0).toFixed(1)}<span className="fm-train-card-unit">km</span></div>
            <div className="fm-train-card-sub">{FD.week.runs} sorties · obj {FD.week.goal_km} km</div>
          </div>
        </div>
      </section>

      {/* §2 CHARGE HEBDO COURSE */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">02</span>
          <h2 className="fm-section-title">Charge hebdo · <em>12 dernières semaines</em></h2>
          <span className="fm-section-meta">km parcourus · tendance</span>
        </div>
        <div className="fm-chart-wrap">
          <WeekLoadChart weeks={weekLoadKm} valueKey="km" unit="km" />
        </div>
      </section>

      {/* §3 RECORDS COURSE */}
      {FD.records && FD.records.length > 0 && (
        <section className="fm-section">
          <div className="fm-section-head">
            <span className="fm-section-num">03</span>
            <h2 className="fm-section-title">Records · <em>auto-calculés</em></h2>
            <span className="fm-section-meta">personal bests depuis la synchronisation</span>
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
      )}

      {/* §4 JOURNAL COURSE */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">04</span>
          <h2 className="fm-section-title">Sorties course · <em>journal</em></h2>
          <span className="fm-section-meta">les 20 dernières</span>
        </div>
        {hasRuns ? (
          <div className="fm-sessions">
            <div className="fm-sess-head">
              <span>date</span>
              <span>type</span>
              <span>séance</span>
              <span style={{ textAlign: "right" }}>distance · allure</span>
              <span style={{ textAlign: "right" }}>fc · D+</span>
              <span style={{ textAlign: "right" }}>durée</span>
            </div>
            {runSessions.slice(0, 20).map((s, i) => {
              const d = new Date(s.date);
              const dateFmt = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
              const hasDistance = s.distance_km > 0;
              const paceMin = Math.floor(s.pace_min_km);
              const paceSec = Math.round((s.pace_min_km - paceMin) * 60);
              return (
                <div key={i} className="fm-sess-row">
                  <span className="fm-sess-date">{dateFmt}</span>
                  <span className="fm-sess-type" data-t="run">{(s.sport_type || "Run").toLowerCase()}</span>
                  <span className="fm-sess-name">{s.name}<small>{s.effort}</small></span>
                  <span className="fm-sess-metric">
                    {hasDistance ? `${s.distance_km.toFixed(1)} km` : "—"}
                    {hasDistance && <span className="fm-sess-metric-sub">{paceMin}:{String(paceSec).padStart(2, "0")}/km</span>}
                  </span>
                  <span className="fm-sess-metric">
                    {s.hr_avg ? `${s.hr_avg} bpm` : "—"}
                    {s.elev_m > 0 && <span className="fm-sess-metric-sub">+{s.elev_m} m D+</span>}
                  </span>
                  <span className="fm-sess-dur">{Math.floor(s.duration_min)}'</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fm-empty-card">
            <p>Aucune sortie course synchronisée. Vérifie le workflow <code>strava-sync.yml</code>.</p>
          </div>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sous-onglet WORKOUT — KPIs workout + charge min/sem + journal
// ═══════════════════════════════════════════════════════════════
function WorkoutTab({ FD, weekLoadMin }) {
  const workoutSessions = FD.workout_sessions || FD.sessions.filter(s => s.type === "workout");
  const hasWorkouts = workoutSessions.length > 0;

  if (!hasWorkouts) {
    return (
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">01</span>
          <h2 className="fm-section-title">Workout · <em>premiers pas</em></h2>
          <span className="fm-section-meta">aucune séance détectée</span>
        </div>
        <div className="fm-empty-card">
          <p>
            Pas encore de workout dans Strava (musculation, cross-training, yoga, etc.).
            Dès que tu enregistres une séance avec un sport_type comme <code>WeightTraining</code> ou <code>Workout</code>,
            elle apparaîtra ici avec ses KPIs dédiés (durée totale, fréquence, top discipline) et son journal.
          </p>
        </div>
      </section>
    );
  }

  const minutesDelta = (FD.month.workout_minutes || 0) - (FD.month.workout_minutes_prev || 0);
  const avgDur = FD.month.workouts > 0 ? Math.round(FD.month.workout_minutes / FD.month.workouts) : 0;
  const topType = FD.month.workout_top_type || "—";

  return (
    <>
      {/* §1 KPIs WORKOUT */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">01</span>
          <h2 className="fm-section-title">Workout · <em>30 derniers jours</em></h2>
          <span className="fm-section-meta">strava · {FD.month.workouts} séances</span>
        </div>

        <div className="fm-train-grid">
          <div className="fm-train-card">
            <div className="fm-train-card-label">Séances</div>
            <div className="fm-train-card-value">{FD.month.workouts}<span className="fm-train-card-unit">/30j</span></div>
            <div className="fm-train-card-sub">{FD.week.workouts} cette semaine</div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Volume horaire</div>
            <div className="fm-train-card-value">{fmtMinAsHour(FD.month.workout_minutes)}</div>
            <div className="fm-train-card-sub">
              {FD.month.workout_minutes_prev > 0 ? (
                <>
                  <span className={minutesDelta >= 0 ? "up" : "down"}>
                    {minutesDelta >= 0 ? "▲" : "▼"} {fmtMinAsHour(Math.abs(minutesDelta))}
                  </span> vs 30j préc.
                </>
              ) : (
                <>moyenne {avgDur}'/séance</>
              )}
            </div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Discipline n°1</div>
            <div className="fm-train-card-value" style={{ fontSize: 24 }}>
              {topType}
            </div>
            <div className="fm-train-card-sub">{(FD.month.workout_calories || 0).toLocaleString("fr-FR")} kcal</div>
          </div>
          <div className="fm-train-card">
            <div className="fm-train-card-label">Régularité 7j</div>
            <div className="fm-train-card-value">{FD.month.workout_days_active_7 || 0}<span className="fm-train-card-unit">/7</span></div>
            <div className="fm-train-card-sub">jours avec un workout</div>
          </div>
        </div>
      </section>

      {/* §2 CHARGE HEBDO WORKOUT (minutes) */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">02</span>
          <h2 className="fm-section-title">Charge hebdo · <em>12 dernières semaines</em></h2>
          <span className="fm-section-meta">minutes / semaine · tendance</span>
        </div>
        <div className="fm-chart-wrap">
          <WeekLoadChart weeks={weekLoadMin} valueKey="min" unit="min" colorVar="#5b8def" />
        </div>
      </section>

      {/* §3 RECORDS — placeholder honnête */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">03</span>
          <h2 className="fm-section-title">Records · <em>à venir</em></h2>
          <span className="fm-section-meta">tonnage, 1RM, sets</span>
        </div>
        <div className="fm-empty-card">
          <p>
            Strava n'expose pas la structure d'une séance de force (sets, reps, charges).
            Pour suivre tonnage et 1RM ici, il faudra brancher une seconde source
            (Hevy, Strong, ou saisie manuelle dans le cockpit).
          </p>
        </div>
      </section>

      {/* §4 JOURNAL WORKOUT */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">04</span>
          <h2 className="fm-section-title">Séances workout · <em>journal</em></h2>
          <span className="fm-section-meta">les 20 dernières</span>
        </div>
        <div className="fm-sessions fm-sessions--workout">
          <div className="fm-sess-head">
            <span>date</span>
            <span>type</span>
            <span>séance</span>
            <span style={{ textAlign: "right" }}>fc</span>
            <span style={{ textAlign: "right" }}>kcal</span>
            <span style={{ textAlign: "right" }}>durée</span>
          </div>
          {workoutSessions.slice(0, 20).map((s, i) => {
            const d = new Date(s.date);
            const dateFmt = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            return (
              <div key={i} className="fm-sess-row">
                <span className="fm-sess-date">{dateFmt}</span>
                <span className="fm-sess-type" data-t="workout">{(s.sport_type || "workout").toLowerCase()}</span>
                <span className="fm-sess-name">{s.name}<small>{s.effort}</small></span>
                <span className="fm-sess-metric">
                  {s.hr_avg ? `${s.hr_avg} bpm` : "—"}
                </span>
                <span className="fm-sess-metric">
                  {s.calories ? s.calories.toLocaleString("fr-FR") : "—"}
                </span>
                <span className="fm-sess-dur">{Math.floor(s.duration_min)}'</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
function PanelForme({ data, onNavigate }) {
  const FD = window.FORME_DATA;
  const hasWeight = !!FD._has_weight;
  const hasWorkouts = !!FD._has_workouts || (FD.month && FD.month.workouts > 0);

  const [tab, setTab] = useFmState(() => {
    try { return localStorage.getItem(FORME_TAB_KEY) || "course"; } catch { return "course"; }
  });
  useFmEffect(() => { try { localStorage.setItem(FORME_TAB_KEY, tab); } catch {} }, [tab]);

  const [chartView, setChartView] = useFmState("weight");
  const [range, setRange] = useFmState("90j");

  // Sparklines composition (hero)
  const spark = useFmMemo(() => {
    if (!hasWeight) return null;
    const s30 = FD.weight_series.slice(-30);
    return {
      weight: s30.filter(d => d.weight != null).map((d) => ({ value: d.weight })),
      fat: s30.filter(d => d.fat_pct != null).map((d) => ({ value: d.fat_pct })),
      muscle: s30.filter(d => d.muscle_kg != null).map((d) => ({ value: d.muscle_kg })),
    };
  }, [FD, hasWeight]);

  const ySeriesByView = {
    weight: [{ key: "weight", color: "var(--brand)", label: "poids kg" }],
    comp: [
      { key: "fat_pct", color: "#b43a3a", label: "masse grasse %" },
      { key: "water_pct", color: "#2d7a4e", label: "eau %" },
    ],
    muscle: [{ key: "muscle_kg", color: "#2d7a4e", label: "masse musculaire kg" }],
  };

  // 7 derniers jours, multi-discipline (hero strip)
  const weekStrip = useFmMemo(() => {
    const today = new Date(FD.today.date);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const sess = (FD.sessions || []).filter((s) => s.date === iso);
      return {
        iso,
        dow: DOW[d.getDay()],
        dom: d.getDate(),
        isToday: iso === FD.today.date,
        sessions: sess,
      };
    });
    const maxMin = Math.max(
      ...days.flatMap((x) => x.sessions.map((s) => s.duration_min || 0)),
      30
    );
    return { days, maxMin };
  }, [FD]);

  // Charge hebdo (12 semaines) — km course + min workout, dérivés de _raw
  // si présent (vraies données Strava), sinon recalculé sur sessions.
  const weekLoad = useFmMemo(() => {
    const dayMs = 24 * 3600 * 1000;
    const now = Date.now();
    const weeks = [];
    const acts = FD._raw || [];

    for (let w = 11; w >= 0; w--) {
      const to = now - w * 7 * dayMs;
      const from = now - (w + 1) * 7 * dayMs;
      let km = 0;
      let min = 0;
      if (acts.length > 0) {
        // Vraies données Strava : utiliser sport_type pour catégoriser
        const acsWk = acts.filter((a) => {
          const t = new Date(a.start_date).getTime();
          return t >= from && t < to;
        });
        acsWk.forEach((a) => {
          const sport = (a.sport_type || "").toLowerCase();
          const isRun = sport.includes("run");
          const isWorkout = sport.includes("weight") || sport === "workout" ||
                            sport.includes("crossfit") || sport.includes("yoga") ||
                            sport.includes("pilates") || sport.includes("strength") ||
                            sport.includes("training");
          if (isRun) km += (Number(a.distance_m) || 0) / 1000;
          if (isWorkout) min += (Number(a.moving_time_s) || 0) / 60;
        });
      } else {
        // Fixture : utiliser sessions (déjà au bon shape)
        const sessWk = (FD.sessions || []).filter((s) => {
          const t = new Date(s.date).getTime();
          return t >= from && t < to;
        });
        sessWk.forEach((s) => {
          if (s.type === "run") km += s.distance_km || 0;
          if (s.type === "workout") min += s.duration_min || 0;
        });
      }
      weeks.push({
        week_start: new Date(from).toISOString().slice(0, 10),
        km: Math.round(km),
        min: Math.round(min),
      });
    }
    return weeks;
  }, [FD]);

  const weekKmTotal = weekStrip.days.reduce(
    (a, d) => a + d.sessions.filter(s => s.type === "run").reduce((s, x) => s + (x.distance_km || 0), 0),
    0
  );
  const weekMinTotal = weekStrip.days.reduce(
    (a, d) => a + d.sessions.reduce((s, x) => s + (x.duration_min || 0), 0),
    0
  );
  const weekSessTotal = weekStrip.days.reduce((a, d) => a + d.sessions.length, 0);

  const hasData = (FD.sessions && FD.sessions.length > 0) || (FD._raw && FD._raw.length > 0);
  const latest = FD.sessions && FD.sessions[0];

  return (
    <div className="fm-wrap" data-screen-label="Forme">
      {/* ═══════ HERO GLOBAL — composition + cross-discipline ═══════ */}
      <header className="fm-hero">
        <div className="fm-hero-head">
          <div className="fm-hero-eyebrow">
            forme · {hasWeight ? "withings + strava" : "strava"} · {FD.today.date}
          </div>
          <h1 className="fm-hero-title">
            {hasWeight && FD.today.weight != null ? (
              <>{FD.today.weight.toFixed(1)} kg · <em>{weekSessTotal} séance{weekSessTotal > 1 ? "s" : ""}</em> cette semaine</>
            ) : (
              <>{weekSessTotal} <em>séance{weekSessTotal > 1 ? "s" : ""}</em> cette semaine · {fmtMinAsHour(weekMinTotal + weekKmTotal * 5)} actif</>
            )}
          </h1>
          <p className="fm-hero-lede">
            {hasData ? (
              <>
                {FD.year.km} km parcourus en {new Date().getFullYear()} · {FD.year.runs} sorties course.
                {latest && ` Dernière activité : ${latest.name} (${CAT_LABEL[latest.type] || latest.type}).`}
                {FD.week.streak > 1 && ` Streak : ${FD.week.streak} jour${FD.week.streak > 1 ? "s" : ""}.`}
              </>
            ) : (
              "Aucune activité Strava synchronisée sur cette période."
            )}
          </p>
        </div>

        {/* Bloc composition Withings — intégré au hero */}
        {hasWeight ? (
          <div className="fm-hero-comp">
            <div className="fm-hero-comp-label">
              composition · {FD.today.weighed_at
                ? new Date(FD.today.weighed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                : "—"}
            </div>
            <div className="fm-hero-comp-grid">
              {FD.today.weight != null && (
                <div className="fm-hero-comp-cell">
                  <div className="fm-hero-comp-key">Poids</div>
                  <div className="fm-hero-comp-val">{FD.today.weight.toFixed(1)}<small>kg</small></div>
                  {spark && spark.weight.length > 1 && <Sparkline data={spark.weight} color="var(--brand)" w={80} h={20} />}
                  {FD.today.weight_delta_month != null && (
                    <div className={`fm-hero-comp-delta ${FD.today.weight_delta_month < 0 ? "up" : FD.today.weight_delta_month > 0 ? "down" : "flat"}`}>
                      {FD.today.weight_delta_month > 0 ? "+" : ""}{FD.today.weight_delta_month.toFixed(1)} kg / 30j
                    </div>
                  )}
                </div>
              )}
              {FD.today.fat_pct != null && (
                <div className="fm-hero-comp-cell">
                  <div className="fm-hero-comp-key">Masse grasse</div>
                  <div className="fm-hero-comp-val">{FD.today.fat_pct.toFixed(1)}<small>%</small></div>
                  {spark && spark.fat.length > 1 && <Sparkline data={spark.fat} color="#b43a3a" w={80} h={20} />}
                  {FD.today.fat_delta_month != null && (
                    <div className={`fm-hero-comp-delta ${FD.today.fat_delta_month < 0 ? "up" : "down"}`}>
                      {FD.today.fat_delta_month > 0 ? "+" : ""}{FD.today.fat_delta_month.toFixed(1)} pt / 30j
                    </div>
                  )}
                </div>
              )}
              {FD.today.muscle_kg != null && (
                <div className="fm-hero-comp-cell">
                  <div className="fm-hero-comp-key">Muscle</div>
                  <div className="fm-hero-comp-val">{FD.today.muscle_kg.toFixed(1)}<small>kg</small></div>
                  {spark && spark.muscle.length > 1 && <Sparkline data={spark.muscle} color="#2d7a4e" w={80} h={20} />}
                  {FD.today.muscle_delta_month != null && (
                    <div className={`fm-hero-comp-delta ${FD.today.muscle_delta_month > 0 ? "up" : FD.today.muscle_delta_month < 0 ? "down" : "flat"}`}>
                      {FD.today.muscle_delta_month > 0 ? "+" : ""}{FD.today.muscle_delta_month.toFixed(1)} kg / 30j
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="fm-hero-comp fm-hero-comp--empty">
            <div className="fm-hero-comp-label">composition</div>
            <p className="fm-hero-comp-empty-msg">
              Pesée Withings non connectée. Voir <code>docs/withings-setup.md</code>.
            </p>
          </div>
        )}
      </header>

      {/* Strip 7 jours — multi-discipline */}
      <section className="fm-week-strip">
        <div className="fm-week-strip-head">
          <span className="fm-week-strip-title">7 derniers jours</span>
          <div className="fm-week-strip-total">
            {weekSessTotal} séance{weekSessTotal > 1 ? "s" : ""}
            <small> · {weekKmTotal.toFixed(1)} km · {fmtMinAsHour(weekMinTotal)}</small>
          </div>
        </div>
        <div className="fm-weekbars-grid">
          {weekStrip.days.map((d) => {
            const totalMin = d.sessions.reduce((s, x) => s + (x.duration_min || 0), 0);
            return (
              <div key={d.iso} className="fm-weekbar">
                <div className="fm-weekbar-stack" style={{ height: 100 }}>
                  {d.sessions.length === 0 && <div className="fm-weekbar-rest" />}
                  {d.sessions.map((s, i) => {
                    const pct = totalMin > 0 ? ((s.duration_min || 0) / weekStrip.maxMin) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="fm-weekbar-seg"
                        style={{ height: `${pct}%`, background: CAT_COLOR[s.type] || CAT_COLOR.other }}
                        title={`${s.name} · ${Math.round(s.duration_min || 0)}'`}
                      />
                    );
                  })}
                </div>
                <div className={`fm-weekbar-day ${d.isToday ? "is-today" : ""}`}>
                  {d.dow} {d.dom}
                </div>
                {d.sessions.length > 0 && (
                  <div className="fm-weekbar-val">{d.sessions.length}×</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="fm-chart-legend" style={{ marginTop: 12 }}>
          <span><span className="fm-chart-legend-dot" style={{ background: CAT_COLOR.run, height: 8 }}></span>Course</span>
          <span><span className="fm-chart-legend-dot" style={{ background: CAT_COLOR.workout, height: 8 }}></span>Workout</span>
          <span><span className="fm-chart-legend-dot" style={{ background: "var(--bg2)", border: "1px dashed var(--bd)", height: 8 }}></span>Repos</span>
        </div>
      </section>

      {/* ═══════ TABS ═══════ */}
      <div className="fm-tabs">
        <button
          className={`fm-tab ${tab === "course" ? "is-active" : ""}`}
          onClick={() => setTab("course")}
        >
          Course
          <span className="fm-tab-count">{FD.month.runs || 0}</span>
        </button>
        <button
          className={`fm-tab ${tab === "workout" ? "is-active" : ""}`}
          onClick={() => setTab("workout")}
        >
          Workout
          <span className="fm-tab-count">{FD.month.workouts || 0}</span>
        </button>
      </div>

      {/* ═══════ CONTENT PER TAB ═══════ */}
      {tab === "course"
        ? <CourseTab FD={FD} weekLoadKm={weekLoad} />
        : <WorkoutTab FD={FD} weekLoadMin={weekLoad} />
      }

      {/* ═══════ COURBES COMPOSITION (toujours visible si Withings) ═══════ */}
      {hasWeight && (
        <section className="fm-section">
          <div className="fm-section-head">
            <span className="fm-section-num">∞</span>
            <h2 className="fm-section-title">Courbes composition · <em>tendance longue</em></h2>
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
            <div className="fm-chart-legend" style={{ marginTop: 12 }}>
              {ySeriesByView[chartView].map((s) => (
                <span key={s.key}>
                  <span className="fm-chart-legend-dot" style={{ background: s.color }}></span>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

window.PanelForme = PanelForme;
