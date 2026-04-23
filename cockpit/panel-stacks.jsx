// ═══════════════════════════════════════════════════════════════
// PANEL STACKS — Stacks & Limits
// Vue synthétique : coûts + quotas + usage des 4 services
// ═══════════════════════════════════════════════════════════════

const { useState: useStState, useMemo: useStMemo } = React;

// ── Utils ───────────────────────────────────────────
function stPct(used, limit) {
  if (limit == null || typeof limit !== "number" || typeof used !== "number") return null;
  return Math.min(999, (used / limit) * 100);
}
function stLevelFor(quota) {
  const pct = stPct(quota.used, quota.limit);
  if (pct == null) return "info";
  if (quota.exceeded || pct >= 100) return "exceeded";
  const crit = (quota.critical_above ?? 0.90) * 100;
  const warn = (quota.warn_above ?? 0.75) * 100;
  if (pct >= crit) return "critical";
  if (pct >= warn) return "warn";
  return "safe";
}
function stFmtNum(v) {
  if (typeof v !== "number") return v;
  if (v >= 1000) return v.toLocaleString("fr-FR");
  if (v >= 10) return v.toFixed(0);
  return v.toFixed(2).replace(/\.?0+$/, "");
}

// ── Spark chart ─────────────────────────────────────
function StChart({ series, unit, color }) {
  const w = 900, h = 90;
  const padL = 34, padR = 8, padT = 8, padB = 20;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const vals = series.map((d) => d.value);
  const yMax = Math.max(...vals) * 1.1 || 1;
  const x = (i) => padL + (i / (series.length - 1)) * plotW;
  const y = (v) => padT + plotH - (v / yMax) * plotH;

  const barW = Math.max(1, plotW / series.length - 1);
  const avg = series.map((_, i) => {
    const a = Math.max(0, i - 3);
    const b = Math.min(series.length, i + 4);
    const sl = series.slice(a, b).map((d) => d.value);
    return sl.reduce((x, y) => x + y, 0) / sl.length;
  });
  const linePath = "M" + avg.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L");

  const todayVal = series[series.length - 1].value;
  const total = vals.reduce((a, b) => a + b, 0);

  return (
    <div className="st-chart">
      <div className="st-chart-head">
        <span className="st-chart-title">Usage · 30 derniers jours</span>
        <span className="st-chart-val"><strong>{stFmtNum(todayVal)}</strong>{unit}</span>
      </div>
      <svg className="st-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ color }}>
        <line className="st-chart-axis" x1={padL} x2={w - padR} y1={h - padB} y2={h - padB} />
        {series.map((d, i) => (
          <rect key={i} className="st-chart-bar"
            x={x(i) - barW / 2}
            y={y(d.value)}
            width={barW}
            height={Math.max(0, (h - padB) - y(d.value))} />
        ))}
        <path d={linePath} className="st-chart-line" stroke={color} />
        <text className="st-chart-label" x={padL - 6} y={y(yMax) + 3} textAnchor="end">{stFmtNum(yMax)}</text>
        <text className="st-chart-label" x={padL - 6} y={h - padB + 3} textAnchor="end">0</text>
        <text className="st-chart-label" x={padL} y={h - 5}>il y a 30j</text>
        <text className="st-chart-label" x={w - padR} y={h - 5} textAnchor="end">auj.</text>
      </svg>
    </div>
  );
}

// ── Quota row ───────────────────────────────────────
function StQuota({ q }) {
  const level = stLevelFor(q);
  const pct = stPct(q.used, q.limit);
  const pctTxt = pct != null ? `${pct.toFixed(0)}%` : null;
  const pctClass = level === "critical" || level === "exceeded" ? "is-critical"
    : level === "warn" ? "is-warn" : "";

  return (
    <div className={`st-quota ${q.type === "info" ? "is-info" : ""}`}>
      <div className="st-quota-head">
        <div className="st-quota-label">{q.label}</div>
        <div className="st-quota-values">
          <strong>{q.raw_used || stFmtNum(q.used)}</strong>
          {q.limit != null ? (
            <> / {typeof q.limit === "number" ? stFmtNum(q.limit) : q.limit} {q.unit}</>
          ) : (
            <> {q.unit}</>
          )}
          {pctTxt && <span className={`st-qpct ${pctClass}`}>{pctTxt}</span>}
        </div>
      </div>
      {q.type !== "info" && pct != null && (
        <div className="st-quota-bar">
          <div className={`st-quota-fill is-${level === "exceeded" ? "exceeded" : level}`}
            style={{ width: Math.min(100, pct) + "%" }} />
        </div>
      )}
      {(q.reset || q.projected != null) && (
        <div className="st-quota-foot">
          <span>{q.reset && `reset · ${q.reset}`}</span>
          {q.projected != null && (
            <span className={`st-projected ${q.projected > q.limit ? "is-over" : (q.projected > q.limit * 0.9 ? "is-near" : "")}`}>
              projeté fin de mois · {stFmtNum(q.projected)} {q.unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Service block ───────────────────────────────────
function StServiceBlock({ s }) {
  const statusLabel = { safe: "tout va bien", warn: "attention", critical: "critique" }[s.status];

  return (
    <div className="st-service">
      <div className="st-service-head">
        <div className="st-service-logo" style={{ background: s.color, color: "#fff" }}>
          {s.service[0]}
        </div>
        <h3 className="st-service-name">{s.service}</h3>
        <div className="st-service-provider">{s.provider}</div>
        <div className={`st-service-plan is-${s.type}`}>{s.plan}</div>
        <div className={`st-service-status is-${s.status}`}>
          <span className="st-status-dot" />
          {statusLabel}
        </div>
        <div className="st-service-last">Dernière utilisation · {s.last_used}</div>
        {s.console_url && (
          <a className="st-service-console" href={s.console_url} target="_blank" rel="noreferrer">
            Ouvrir console ↗
          </a>
        )}
      </div>

      <div className="st-body">
        {/* Alertes propres au service */}
        {s.alerts && s.alerts.length > 0 && (
          <div className="st-alerts" style={{ marginTop: 0, marginBottom: 20 }}>
            {s.alerts.map((a, i) => (
              <div key={i} className="st-alert-row">
                <span className={`st-alert-tag is-${a.level}`}>{a.level}</span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quotas */}
        <div className="st-section">
          <div className="st-section-label">Quotas & limites</div>
          <div className="st-quotas">
            {s.quotas.map((q, i) => <StQuota key={i} q={q} />)}
          </div>
        </div>

        {/* Breakdown */}
        {s.breakdown && s.breakdown.length > 0 && (
          <div className="st-section">
            <div className="st-section-label">Répartition</div>
            <table className="st-bd-table">
              <tbody>
                {s.breakdown.map((row, i) => (
                  <tr key={i}>
                    <td className="is-label">
                      {row.label}
                      {row.note && <div className={`st-bd-note ${row.note.includes("over") || row.note.includes("fallback") ? "is-warn" : ""}`}>{row.note}</div>}
                    </td>
                    {row.calls != null && <td className="is-num">{stFmtNum(row.calls)} calls</td>}
                    {row.tokens_in_M != null && <td className="is-num">{row.tokens_in_M}M in</td>}
                    {row.tokens_out_M != null && <td className="is-num">{row.tokens_out_M}M out</td>}
                    {row.cost != null && <td className="is-num">{row.cost.toFixed(2)} €</td>}
                    {row.minutes != null && <td className="is-num">{stFmtNum(row.minutes)} min</td>}
                    {row.copilot_suggestions != null && <td className="is-num">{stFmtNum(row.copilot_suggestions)} suggestions</td>}
                    {row.size_mb != null && <td className="is-num">{row.size_mb} MB</td>}
                    {row.rows != null && <td className="is-num">{row.rows} rows</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rate limits */}
        {s.rate_limits && Object.keys(s.rate_limits).length > 0 && (
          <div className="st-section">
            <div className="st-section-label">Rate limits instantanés</div>
            <div className="st-rate">
              {Object.entries(s.rate_limits).map(([k, v]) => {
                const p = (v.used / v.limit) * 100;
                return (
                  <div className="st-rate-item" key={k}>
                    <div className="st-rate-label">{k.replace(/_/g, " ")}</div>
                    <div className="st-rate-val">
                      <strong>{stFmtNum(v.used)}</strong> <span>/ {stFmtNum(v.limit)} ({p.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Série 30j */}
        <div className="st-section">
          <div className="st-section-label">Tendance</div>
          <StChart series={s.series_30d} unit={" " + s.series_unit} color={s.color} />
        </div>
      </div>
    </div>
  );
}

// ── Main panel ──────────────────────────────────────
function PanelStacks({ data, onNavigate }) {
  const stacks = window.STACKS_DATA;
  const [typeFilter, setTypeFilter] = useStState("all");
  const [statusFilter, setStatusFilter] = useStState("all");
  const [refreshing, setRefreshing] = useStState(false);
  const [refreshedAt, setRefreshedAt] = useStState(null);

  async function handleRefresh() {
    if (refreshing) return;
    const loader = window.cockpitDataLoader;
    if (!loader) return;
    setRefreshing(true);
    try {
      loader.invalidateCache("stacks_");
      loader.invalidateCache("weekly_analysis");
      loader.invalidateCache("articles_today");
      await loader.loadPanel("stacks");
      setRefreshedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useStMemo(() => {
    return stacks.services.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [typeFilter, statusFilter, stacks.services]);

  const allAlerts = useStMemo(() => {
    const out = [];
    stacks.services.forEach((s) => {
      (s.alerts || []).forEach((a) => {
        if (a.level === "critical" || a.level === "warn")
          out.push({ ...a, service: s.service });
      });
    });
    return out.sort((a, b) => (a.level === "critical" ? -1 : 1));
  }, [stacks.services]);

  const t = stacks.totals;

  return (
    <div className="st-wrap">
      {/* HERO */}
      <section className="st-hero">
        <div>
          <div className="st-hero-eyebrow">
            {t.critical_count > 0 && <span className="st-dot" />}
            Stacks & Limits · {stacks.services.length} services suivis
            <button
              className="st-refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              title={refreshedAt ? `Dernier refresh ${refreshedAt.toLocaleTimeString("fr-FR")}` : "Rafraîchir les données"}>
              {refreshing ? "sync…" : "↻ refresh"}
            </button>
          </div>
          <h1 className="st-hero-title">
            {t.critical_count > 0 ? (
              <><em>{t.critical_count} service{t.critical_count > 1 ? "s" : ""}</em> en zone rouge,<br />{t.warn_count} à surveiller.</>
            ) : t.warn_count > 0 ? (
              <><em>{t.warn_count} service{t.warn_count > 1 ? "s" : ""}</em> proche{t.warn_count > 1 ? "s" : ""} du plafond.</>
            ) : (
              <>Toutes les stacks dans le vert.</>
            )}
          </h1>
          <p className="st-hero-sub">
            {stacks.hero_sub || (
              <>Budget Claude à {((t.cost_mtd / t.cost_budget) * 100).toFixed(0)}% du plafond mensuel.</>
            )}
          </p>
        </div>

        <div className="st-hero-kpis">
          <div className="st-kpi">
            <div className="st-kpi-label">Coût mois en cours</div>
            <div className="st-kpi-val">{t.cost_mtd.toFixed(0)} €</div>
            <div className="st-kpi-sub">/ {t.cost_budget} € budget · j{stacks.day_of_month}/{stacks.days_in_month}</div>
          </div>
          <div className="st-kpi">
            <div className="st-kpi-label">Projeté fin de mois</div>
            <div className={`st-kpi-val ${t.cost_projected > t.cost_budget ? "is-critical" : (t.cost_projected > t.cost_budget * 0.9 ? "is-warn" : "")}`}>
              {t.cost_projected.toFixed(2)} €
            </div>
            <div className="st-kpi-sub">
              {t.cost_delta_pct != null ? (
                <>
                  <span className={t.cost_delta_pct > 0 ? "st-delta-up" : "st-delta-down"}>
                    {t.cost_delta_pct > 0 ? "▲" : "▼"} {Math.abs(t.cost_delta_pct)}%
                  </span>
                  {" vs "}{t.cost_prev_month.toFixed(2)}€ le mois dernier
                </>
              ) : (
                t.cost_projected > t.cost_budget
                  ? `+${(t.cost_projected - t.cost_budget).toFixed(2)} € au-dessus`
                  : `${(t.cost_budget - t.cost_projected).toFixed(2)} € sous budget`
              )}
            </div>
          </div>
          <div className="st-kpi">
            <div className="st-kpi-label">Alertes actives</div>
            <div className={`st-kpi-val ${t.critical_alerts > 0 ? "is-critical" : (t.total_alerts > 0 ? "is-warn" : "")}`}>{t.total_alerts}</div>
            <div className="st-kpi-sub">{t.critical_alerts} critique{t.critical_alerts > 1 ? "s" : ""} · {t.total_alerts - t.critical_alerts} warning{t.total_alerts - t.critical_alerts > 1 ? "s" : ""}</div>
          </div>
          <div className="st-kpi">
            <div className="st-kpi-label">Répartition</div>
            <div className="st-kpi-val" style={{ fontSize: 20 }}>
              {t.paid_count} payant · {t.free_count} gratuit
            </div>
            <div className="st-kpi-sub">{t.safe_count} safe · {t.warn_count} warn · {t.critical_count} crit.</div>
          </div>
        </div>
      </section>

      {/* ALERTES CONSOLIDÉES */}
      {allAlerts.length > 0 && (
        <div className="st-alerts">
          {allAlerts.map((a, i) => (
            <div key={i} className="st-alert-row">
              <span className={`st-alert-tag is-${a.level}`}>{a.level}</span>
              <span className="st-alert-service">{a.service}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="st-intro">
        Suivi des stacks tech avec quotas free-tier, consommations projetées et rate limits instantanés.
        Objectif : ne jamais tomber en panne silencieuse parce qu'un quota a claqué la nuit.
      </div>

      {/* FILTERS */}
      <div className="st-filters">
        <div className="st-filter-group">
          <span className="st-filter-label">Type</span>
          {[
            { k: "all", label: "Tous" },
            { k: "paid", label: "Payants" },
            { k: "free", label: "Free tier" },
          ].map((f) => (
            <button key={f.k}
              className={`st-chip ${typeFilter === f.k ? "is-active" : ""}`}
              onClick={() => setTypeFilter(f.k)}>{f.label}</button>
          ))}
        </div>
        <div className="st-filter-group">
          <span className="st-filter-label">Statut</span>
          {[
            { k: "all", label: "Tous" },
            { k: "critical", label: "Critique" },
            { k: "warn", label: "Warn" },
            { k: "safe", label: "Safe" },
          ].map((f) => (
            <button key={f.k}
              className={`st-chip ${statusFilter === f.k ? "is-active" : ""}`}
              onClick={() => setStatusFilter(f.k)}>{f.label}</button>
          ))}
        </div>
        <div className="st-filter-count">{filtered.length} / {stacks.services.length} services</div>
      </div>

      {/* SERVICES */}
      <div className="st-services">
        {filtered.map((s) => <StServiceBlock key={s.id} s={s} />)}
      </div>
    </div>
  );
}

window.PanelStacks = PanelStacks;
