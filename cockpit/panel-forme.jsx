// ═══════════════════════════════════════════════════════════════
// PANEL FORME — Strava (runs) + [optionnel] Withings si dispo
// ─────────────────────────────────────────────
// Hero : volume de la semaine (course) + streak
// §1 Entraînement : 4 KPI cards (Distance, Allure, Dénivelé, Régularité)
// §2 Charge hebdo : courbe km/semaine (12 semaines)
// §3 Composition [Withings — affiché seulement si _has_weight]
// §4 Records auto-calculés (5k, 10k, semi, marathon, plus longue, volume max)
// §5 Journal 20 dernières séances
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

// ── Bar chart — charge hebdo (km/semaine) ────────────
function WeekLoadChart({ weeks }) {
  if (!weeks || !weeks.length) return null;
  const w = 1000;
  const h = 220;
  const padL = 48, padR = 20, padT = 20, padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxKm = Math.max(10, ...weeks.map((x) => x.km || 0));
  const barW = plotW / weeks.length * 0.7;
  const stepX = plotW / weeks.length;
  const yTicks = [0, maxKm / 2, maxKm];

  return (
    <svg className="fm-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {yTicks.map((t, i) => {
        const y = padT + plotH - (t / maxKm) * plotH;
        return (
          <g key={"y" + i}>
            <line className="fm-chart-grid" x1={padL} x2={w - padR} y1={y} y2={y} />
            <text className="fm-chart-label" x={padL - 8} y={y + 3} textAnchor="end">{Math.round(t)}</text>
          </g>
        );
      })}
      {weeks.map((wk, i) => {
        const km = wk.km || 0;
        const barH = (km / maxKm) * plotH;
        const x = padL + i * stepX + (stepX - barW) / 2;
        const y = padT + plotH - barH;
        const d = new Date(wk.week_start);
        const lbl = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill="var(--brand)" rx="2" />
            {km > 0 && <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fm-chart-label" style={{ fontSize: 10 }}>{km}</text>}
            <text x={x + barW / 2} y={h - padB + 14} textAnchor="middle" className="fm-chart-label">{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Day of week label ────────────────────────────────
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function PanelForme({ data, onNavigate }) {
  const FD = window.FORME_DATA;
  const hasWeight = !!FD._has_weight;

  // 7 derniers jours glissants
  const weekBars = useFmMemo(() => {
    const today = new Date(FD.today.date);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const sess = FD.sessions.filter((s) => s.date === iso);
      return {
        iso,
        dow: DOW[d.getDay()],
        dom: d.getDate(),
        isToday: iso === FD.today.date,
        sessions: sess,
      };
    });
    const maxKm = Math.max(...days.flatMap((x) => x.sessions.map((s) => s.distance_km)), 10);
    return { days, maxKm };
  }, [FD]);

  // Charge hebdo (12 semaines)
  const weekLoad = useFmMemo(() => {
    const acts = FD._raw || [];
    const dayMs = 24 * 3600 * 1000;
    const now = Date.now();
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
      const to = now - w * 7 * dayMs;
      const from = now - (w + 1) * 7 * dayMs;
      const acsWk = acts.filter((a) => {
        const t = new Date(a.start_date).getTime();
        return t >= from && t < to;
      });
      weeks.push({
        week_start: new Date(from).toISOString().slice(0, 10),
        km: Math.round(acsWk.reduce((s, a) => s + (Number(a.distance_m) || 0) / 1000, 0)),
        sessions: acsWk.length,
      });
    }
    return weeks;
  }, [FD._raw]);

  const weekKmTotal = weekBars.days.reduce(
    (a, d) => a + d.sessions.reduce((s, x) => s + x.distance_km, 0),
    0
  );

  const hasData = (FD.sessions && FD.sessions.length > 0) || (FD._raw && FD._raw.length > 0);
  const latest = FD.sessions && FD.sessions[0];

  return (
    <div className="fm-wrap" data-screen-label="Forme">
      {/* ══ HERO ══ */}
      <header className="fm-hero">
        <div>
          <div className="fm-hero-eyebrow">forme · strava · {FD.today.date}</div>
          <h1 className="fm-hero-title">
            {FD.week.km.toFixed(1)} km · <em>{FD.week.runs} sorties</em> cette semaine
          </h1>
          <p className="fm-hero-lede">
            {hasData ? (
              <>
                {FD.year.km} km parcourus en {new Date().getFullYear()} · {FD.year.runs} sorties.
                {latest && ` Dernière sortie : ${latest.name} (${latest.distance_km.toFixed(1)} km).`}
                {FD.week.streak > 1 && ` Streak actuel : ${FD.week.streak} jour${FD.week.streak > 1 ? "s" : ""}.`}
              </>
            ) : (
              "Aucune activité Strava synchronisée sur cette période."
            )}
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

      {/* ══ §1 ENTRAÎNEMENT ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">01</span>
          <h2 className="fm-section-title">Entraînement · <em>30 derniers jours</em></h2>
          <span className="fm-section-meta">strava · {FD.month.sessions} activités</span>
        </div>

        <div className="fm-train-grid">
          <div className="fm-train-card">
            <div className="fm-train-card-label">Distance</div>
            <div className="fm-train-card-value">{FD.month.km.toFixed(0)}<span className="fm-train-card-unit">km</span></div>
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
                  {Math.floor(FD.month.pace_avg)}:{String(Math.round((FD.month.pace_avg % 1) * 60)).padStart(2, "0")}
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
            <div className="fm-train-card-label">Régularité</div>
            <div className="fm-train-card-value">{FD.week.streak}<span className="fm-train-card-unit">j</span></div>
            <div className="fm-train-card-sub">streak · {FD.week.days_active}/7 cette semaine</div>
          </div>
        </div>

        {/* Week strip */}
        <div className="fm-weekbars">
          <div className="fm-weekbars-head">
            <span className="fm-weekbars-title">7 derniers jours</span>
            <div className="fm-weekbars-total">
              {weekKmTotal.toFixed(1)} km <small>· {weekBars.days.filter((d) => d.sessions.length).length} jours actifs</small>
            </div>
          </div>
          <div className="fm-weekbars-grid">
            {weekBars.days.map((d) => {
              const dayKm = d.sessions.reduce((s, x) => s + x.distance_km, 0);
              const runPct = dayKm > 0 ? (dayKm / weekBars.maxKm) * 100 : 0;
              return (
                <div key={d.iso} className="fm-weekbar">
                  <div className="fm-weekbar-stack" style={{ height: 100 }}>
                    {dayKm > 0 && <div className="fm-weekbar-run" style={{ height: `${runPct}%` }} />}
                    {dayKm === 0 && <div className="fm-weekbar-rest" />}
                  </div>
                  <div className={`fm-weekbar-day ${d.isToday ? "is-today" : ""}`}>
                    {d.dow} {d.dom}
                  </div>
                  {dayKm > 0 && <div className="fm-weekbar-val">{dayKm.toFixed(1)}k</div>}
                </div>
              );
            })}
          </div>
          <div className="fm-chart-legend" style={{ marginTop: 12 }}>
            <span><span className="fm-chart-legend-dot" style={{ background: "var(--brand)", height: 8 }}></span>Course</span>
            <span><span className="fm-chart-legend-dot" style={{ background: "var(--bg2)", border: "1px dashed var(--bd)", height: 8 }}></span>Repos</span>
          </div>
        </div>
      </section>

      {/* ══ §2 CHARGE HEBDO ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">02</span>
          <h2 className="fm-section-title">Charge hebdo · <em>12 dernières semaines</em></h2>
          <span className="fm-section-meta">km parcourus · tendance</span>
        </div>
        <div className="fm-chart-wrap">
          <WeekLoadChart weeks={weekLoad} />
        </div>
      </section>

      {/* ══ §3 COMPOSITION — affiché seulement si Withings branché ══ */}
      {hasWeight ? (
        <section className="fm-section">
          <div className="fm-section-head">
            <span className="fm-section-num">03</span>
            <h2 className="fm-section-title">Composition · <em>Withings</em></h2>
          </div>
          {/* À implémenter quand le pipeline Withings existe */}
        </section>
      ) : (
        <section className="fm-section fm-empty-section">
          <div className="fm-section-head">
            <span className="fm-section-num">03</span>
            <h2 className="fm-section-title">Composition · <em>Withings</em></h2>
            <span className="fm-section-meta">source non connectée</span>
          </div>
          <div className="fm-empty-card">
            <p>Pas de données de composition corporelle. Branche un pipeline Withings (poids, masse grasse, masse musculaire) pour activer cette section.</p>
          </div>
        </section>
      )}

      {/* ══ §4 RECORDS ══ */}
      {FD.records && FD.records.length > 0 && (
        <section className="fm-section">
          <div className="fm-section-head">
            <span className="fm-section-num">04</span>
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

      {/* ══ §5 SÉANCES RÉCENTES ══ */}
      <section className="fm-section">
        <div className="fm-section-head">
          <span className="fm-section-num">05</span>
          <h2 className="fm-section-title">Séances · <em>journal</em></h2>
          <span className="fm-section-meta">les 20 dernières</span>
        </div>
        {FD.sessions && FD.sessions.length > 0 ? (
          <div className="fm-sessions">
            <div className="fm-sess-head">
              <span>date</span>
              <span>type</span>
              <span>séance</span>
              <span style={{ textAlign: "right" }}>distance · allure</span>
              <span style={{ textAlign: "right" }}>fc · D+</span>
              <span style={{ textAlign: "right" }}>durée</span>
            </div>
            {FD.sessions.slice(0, 20).map((s, i) => {
              const d = new Date(s.date);
              const dateFmt = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
              const hasDistance = s.distance_km > 0;
              const paceMin = Math.floor(s.pace_min_km);
              const paceSec = Math.round((s.pace_min_km - paceMin) * 60);
              return (
                <div key={i} className="fm-sess-row">
                  <span className="fm-sess-date">{dateFmt}</span>
                  <span className="fm-sess-type" data-t="run">{(s.sport_type || "run").toLowerCase()}</span>
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
            <p>Aucune séance Strava synchronisée. Vérifie le workflow <code>strava-sync.yml</code>.</p>
          </div>
        )}
      </section>
    </div>
  );
}

window.PanelForme = PanelForme;
