// ═══════════════════════════════════════════════════════════════
// PANEL HISTORY — archive temporelle
// - Hero + KPIs
// - Heatmap 60j
// - Filtres (intensité / pinned / search)
// - Timeline groupée par semaine
// - Drawer détail d'un jour + "charger dans le cockpit"
// ═══════════════════════════════════════════════════════════════

const { useState: useHiState, useMemo: useHiMemo, useEffect: useHiEffect } = React;

// ── Heatmap 60j ─────────────────────────────────
function HiHeatmap({ days, activeIso, todayIso, onPick }) {
  // Group by week (ISO), rows = jours sem (Lun–Dim)
  const byWeek = {};
  days.forEach((d) => {
    const date = new Date(d.iso);
    // Lun=0 .. Dim=6
    const dow = (date.getDay() + 6) % 7;
    if (!byWeek[d.week]) byWeek[d.week] = Array(7).fill(null);
    byWeek[d.week][dow] = d;
  });
  // Ordre chronologique (ancien → récent) ; on inverse pour affichage récent à gauche
  const weekKeys = Object.keys(byWeek).sort((a, b) => {
    const da = byWeek[a].find(Boolean).iso;
    const db = byWeek[b].find(Boolean).iso;
    return da < db ? -1 : 1;
  });

  return (
    <div>
      <div className="hi-heatmap">
        {weekKeys.map((wk) => (
          <div key={wk} className="hi-hm-week">
            {byWeek[wk].map((d, i) => {
              if (!d) return <div key={i} className="hi-hm-cell" data-empty="true" />;
              const classes = [
                "hi-hm-cell",
                d.iso === todayIso ? "is-today" : "",
                d.iso === activeIso ? "is-active" : "",
                d.pinned ? "is-pinned" : "",
              ].filter(Boolean).join(" ");
              return (
                <div key={i}
                  className={classes}
                  data-intensity={d.intensity}
                  data-weekend={d.is_weekend}
                  title={`${d.day_label} · ${d.articles} articles · ${d.intensity}`}
                  onClick={() => onPick(d.iso)} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="hi-hm-legend">
        <span>Activité :</span>
        <span className="hi-hm-legend-item">
          <span className="hi-hm-legend-swatch" style={{ background: "color-mix(in srgb, var(--tx) 10%, var(--bg))" }} /> calme
        </span>
        <span className="hi-hm-legend-item">
          <span className="hi-hm-legend-swatch" style={{ background: "color-mix(in srgb, var(--accent) 45%, var(--bg))" }} /> normal
        </span>
        <span className="hi-hm-legend-item">
          <span className="hi-hm-legend-swatch" style={{ background: "var(--accent)" }} /> pic
        </span>
        <span className="hi-hm-legend-item" style={{ marginLeft: "auto" }}>
          <span style={{ width: 5, height: 5, background: "#c88826", borderRadius: "50%", display: "inline-block" }} /> épinglé
        </span>
      </div>
    </div>
  );
}

// ── Drawer ──────────────────────────────────────
function HiDrawer({ day, onClose, onLoadInCockpit }) {
  if (!day) return null;
  return (
    <>
      <div className="hi-drawer-backdrop" onClick={onClose} />
      <div className="hi-drawer" role="dialog">
        <div className="hi-drawer-head">
          <div>
            <div className="hi-drawer-kicker">Brief archivé · il y a {day.days_ago}j</div>
            <h2 className="hi-drawer-date">{day.long}</h2>
            <div className="hi-drawer-sub">
              {day.week} · {day.articles} articles · {day.signals_rising} signaux · {day.jarvis_calls} requêtes Jarvis
            </div>
          </div>
          <button className="hi-drawer-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="hi-drawer-body">
          <div className="hi-drawer-section">
            <div className="hi-drawer-section-label">Macro · synthèse du jour</div>
            <h3 className="hi-drawer-macro-title">{day.macro.title}</h3>
            <p className="hi-drawer-macro-body">{day.macro.body}</p>
          </div>

          {day.top.length > 0 && (
            <div className="hi-drawer-section">
              <div className="hi-drawer-section-label">Top {day.top.length} incontournables</div>
              <div className="hi-drawer-top">
                {day.top.map((t) => (
                  <div key={t.rank} className="hi-drawer-top-item">
                    <div className="hi-drawer-top-rank">{t.rank}</div>
                    <div className="hi-drawer-top-main">
                      <div className="hi-drawer-top-title">{t.title}</div>
                      <div className="hi-drawer-top-meta">{t.source} · {t.section}</div>
                    </div>
                    <div className="hi-drawer-top-score"><strong>{t.score}</strong>/100</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hi-drawer-section">
            <div className="hi-drawer-section-label">Signaux ce jour-là</div>
            <div className="hi-drawer-signals">
              {day.signals.map((s, i) => (
                <span key={i} className="hi-drawer-sig">
                  {s.name}
                  <span className={`hi-drawer-sig-delta ${s.delta > 0 ? "is-up" : s.delta < 0 ? "is-down" : ""}`}>
                    {s.delta > 0 ? "+" : ""}{s.delta}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {day.actions.length > 0 && (
            <div className="hi-drawer-section">
              <div className="hi-drawer-section-label">Actions prises ce jour</div>
              <ul className="hi-drawer-actions">
                {day.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="hi-drawer-foot">
          <button className="hi-drawer-btn" onClick={onClose}>Fermer</button>
          <button className="hi-drawer-btn is-primary" onClick={() => onLoadInCockpit(day)}>
            Charger ce jour dans le cockpit →
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main ────────────────────────────────────────
function PanelHistory({ data, onNavigate, onLoadDay, historicalDay }) {
  const hist = window.HISTORY_DATA;
  const [intensity, setIntensity] = useHiState("all");
  const [pinnedOnly, setPinnedOnly] = useHiState(false);
  const [query, setQuery] = useHiState("");
  const [selectedIso, setSelectedIso] = useHiState(null);

  useHiEffect(() => {
    function onKey(e) { if (e.key === "Escape") setSelectedIso(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useHiMemo(() => {
    return hist.days.filter((d) => {
      if (d.days_ago === 0) return true; // toujours montrer aujourd'hui
      if (intensity !== "all" && d.intensity !== intensity) return false;
      if (pinnedOnly && !d.pinned) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = (d.macro.title + " " + d.macro.body + " " + d.signals.map((s) => s.name).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [intensity, pinnedOnly, query, hist.days]);

  // Group par semaine pour affichage
  const filteredByWeek = useHiMemo(() => {
    const g = {};
    filtered.forEach((d) => { if (!g[d.week]) g[d.week] = []; g[d.week].push(d); });
    return Object.entries(g).sort((a, b) => a[1][0].iso < b[1][0].iso ? 1 : -1);
  }, [filtered]);

  const selectedDay = selectedIso ? hist.days.find((d) => d.iso === selectedIso) : null;
  const t = hist.totals;

  return (
    <div className="hi-wrap">
      {historicalDay && (
        <div className="hi-mode-banner">
          <div>
            <div className="hi-mode-banner-label">Mode historique actif</div>
            <div className="hi-mode-banner-date">Cockpit rechargé pour le {historicalDay.long}</div>
          </div>
          <button className="hi-mode-banner-exit" onClick={() => onLoadDay(null)}>
            Revenir à aujourd'hui →
          </button>
        </div>
      )}

      {/* HERO */}
      <section className="hi-hero">
        <div>
          <div className="hi-hero-eyebrow">Historique · {hist.days.length} jours archivés</div>
          <h1 className="hi-hero-title">
            Revivre n'importe quel brief, <em>tel qu'il a été</em>.
          </h1>
          <p className="hi-hero-sub">
            Chaque jour est une archive complète : macro, top, signaux, décisions. Sélectionne un jour pour ouvrir sa fiche, puis charge-le dans le cockpit pour revenir dans l'ambiance de l'époque.
          </p>
        </div>
        <div className="hi-kpis">
          <div className="hi-kpi">
            <div className="hi-kpi-label">Articles vus (60j)</div>
            <div className="hi-kpi-val">{t.total_articles.toLocaleString("fr-FR")}</div>
            <div className="hi-kpi-sub">{(t.total_articles / hist.days.length).toFixed(0)}/jour en moyenne</div>
          </div>
          <div className="hi-kpi">
            <div className="hi-kpi-label">Requêtes Jarvis</div>
            <div className="hi-kpi-val">{t.total_jarvis_calls.toLocaleString("fr-FR")}</div>
            <div className="hi-kpi-sub">streak en cours · {t.streak_days}j</div>
          </div>
          <div className="hi-kpi">
            <div className="hi-kpi-label">Jour le plus chargé</div>
            <div className="hi-kpi-val" style={{ fontSize: 18 }}>{t.peak_day.short_label}</div>
            <div className="hi-kpi-sub">{t.peak_day.articles} articles ce jour-là</div>
          </div>
          <div className="hi-kpi">
            <div className="hi-kpi-label">Actions consignées</div>
            <div className="hi-kpi-val">{t.total_actions}</div>
            <div className="hi-kpi-sub">sur les 60 derniers jours</div>
          </div>
        </div>
      </section>

      {/* HEATMAP */}
      <section className="hi-heatmap-section">
        <div className="hi-section-kicker">Calendrier d'activité</div>
        <h2 className="hi-section-title">Les 60 derniers jours, d'un coup d'œil</h2>
        <HiHeatmap
          days={hist.days}
          activeIso={selectedIso}
          todayIso={hist.today_iso}
          onPick={setSelectedIso}
        />
      </section>

      {/* FILTERS */}
      <div className="hi-filters">
        <div className="hi-filter-group">
          <span className="hi-filter-label">Intensité</span>
          {[
            { k: "all", label: "Tous" },
            { k: "pic", label: "Pics" },
            { k: "normal", label: "Normal" },
            { k: "calme", label: "Calme" },
          ].map((f) => (
            <button key={f.k}
              className={`hi-chip ${intensity === f.k ? "is-active" : ""}`}
              onClick={() => setIntensity(f.k)}>{f.label}</button>
          ))}
        </div>
        <button
          className={`hi-chip ${pinnedOnly ? "is-active" : ""}`}
          onClick={() => setPinnedOnly(!pinnedOnly)}
          style={{ marginLeft: 12 }}>
          ● Épinglés seulement
        </button>
        <input
          className="hi-search"
          type="text"
          placeholder="Recherche dans les briefs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="hi-filter-count">{filtered.length} / {hist.days.length} jours</div>
      </div>

      {/* TIMELINE */}
      <div className="hi-timeline">
        {filtered.length === 0 && (
          <div className="hi-empty">Aucun jour ne correspond aux filtres en cours.</div>
        )}
        {filteredByWeek.map(([wk, weekDays]) => {
          const first = weekDays[0];
          const last = weekDays[weekDays.length - 1];
          const total = weekDays.reduce((a, d) => a + d.articles, 0);
          return (
            <div key={wk} className="hi-week-group">
              <div className="hi-week-label">
                <span>{wk}</span>
                <span className="hi-week-meta">
                  {last.short_label} → {first.short_label} · {total} articles
                </span>
              </div>
              {weekDays.map((d) => {
                const isToday = d.iso === hist.today_iso;
                return (
                  <div key={d.iso}
                    className={[
                      "hi-day",
                      d.is_weekend ? "is-weekend" : "",
                      isToday ? "is-today" : "",
                      d.iso === selectedIso ? "is-active" : "",
                      d.intensity === "calme" ? "hi-day-calm" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelectedIso(d.iso)}>
                    <div className="hi-day-date">
                      <span className="hi-day-num">{new Date(d.iso).getDate()}</span>
                      <span className="hi-day-dow">{d.long.split(" ")[0].slice(0, 3)}. {d.long.split(" ")[2].slice(0, 4)}.</span>
                      {isToday && <div><span className="hi-day-today-tag">AUJ.</span></div>}
                    </div>
                    <div className="hi-day-content">
                      <span className={`hi-day-macro-tag ${d.intensity === "pic" ? "is-pic" : ""} ${d.macro.tag === "incident" ? "is-incident" : ""}`}>
                        {d.macro.tag}
                      </span>
                      {d.pinned && <span className="hi-day-pinned" title="Épinglé">●</span>}
                      <h3 className="hi-day-title">{d.macro.title}</h3>
                      <p className="hi-day-body">{d.macro.body}</p>
                      <div className="hi-day-signals">
                        {d.signals.slice(0, 5).map((s, i) => (
                          <span key={i} className={`hi-day-sig ${s.delta > 2 ? "is-rising" : ""}`}>
                            {s.name} {s.delta > 0 ? `+${s.delta}` : s.delta}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="hi-day-stats">
                      <div className="hi-day-stats-line"><strong>{d.articles}</strong>articles</div>
                      <div className="hi-day-stats-line"><strong>{d.signals_rising}</strong>signaux</div>
                      <div className="hi-day-stats-line"><strong>{d.jarvis_calls}</strong>req Jarvis</div>
                      <div>{d.reading_time} de lecture</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* DRAWER */}
      {selectedDay && (
        <HiDrawer
          day={selectedDay}
          onClose={() => setSelectedIso(null)}
          onLoadInCockpit={(d) => { onLoadDay(d); setSelectedIso(null); onNavigate("brief"); }}
        />
      )}
    </div>
  );
}

window.PanelHistory = PanelHistory;
