// ═══════════════════════════════════════════════════════════════
// PANEL HISTORY — archive temporelle
// - Hero + KPIs · Top sources 60j
// - Sparkline volume + Heatmap 60j
// - Filtres (intensité / pinned / search) + export CSV
// - Timeline groupée par semaine
// - Drawer : macro, top, +extras, signaux, actions, note perso
// - Pin persist localStorage · Navigation clavier j/k/p/Esc
// ═══════════════════════════════════════════════════════════════

const { useState: useHiState, useMemo: useHiMemo, useEffect: useHiEffect, useRef: useHiRef } = React;

// ── Sparkline 60j ───────────────────────────────
function HiSparkline({ days }) {
  // days come newest → oldest ; for the chart we want oldest → newest.
  const chrono = [...days].reverse();
  const counts = chrono.map(d => d.articles);
  const max = Math.max(...counts, 1);
  const W = 720, H = 60, PAD = 4;
  const step = (W - PAD * 2) / (chrono.length - 1 || 1);
  const pts = chrono.map((d, i) => [
    PAD + i * step,
    H - PAD - ((d.articles / max) * (H - PAD * 2)),
  ]);
  const pathD = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = pathD + ` L${pts[pts.length-1][0]},${H-PAD} L${pts[0][0]},${H-PAD} Z`;
  const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
  const avgY = H - PAD - ((avg / max) * (H - PAD * 2));
  return (
    <svg className="hi-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={area} className="hi-spark-area" />
      <path d={pathD} className="hi-spark-line" />
      <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY} className="hi-spark-avg" />
      {pts.map(([x, y], i) => chrono[i].intensity === "pic" ? (
        <circle key={i} cx={x} cy={y} r={2.5} className="hi-spark-pic" />
      ) : null)}
    </svg>
  );
}

// ── Top sources 60j ────────────────────────────
function HiTopSources({ days }) {
  const counts = {};
  days.forEach(d => {
    (d.top || []).forEach(t => {
      const s = t.source || "—";
      counts[s] = (counts[s] || 0) + 1;
    });
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!entries.length) return null;
  const max = entries[0][1];
  return (
    <div className="hi-topsources">
      <div className="hi-topsources-label">Top sources des incontournables · 60j</div>
      <ol className="hi-topsources-list">
        {entries.map(([src, n]) => (
          <li key={src}>
            <span className="hi-topsources-name">{src}</span>
            <span className="hi-topsources-bar">
              <span className="hi-topsources-fill" style={{ width: `${(n/max)*100}%` }} />
            </span>
            <span className="hi-topsources-n">{n}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Note libre par jour (localStorage) ─────────
const HIST_NOTES_KEY = "cockpit:history:notes";
function readHistoryNotes() {
  try { return JSON.parse(localStorage.getItem(HIST_NOTES_KEY) || "{}"); } catch { return {}; }
}
function writeHistoryNote(iso, text) {
  const all = readHistoryNotes();
  if (text && text.trim()) all[iso] = text.trim();
  else delete all[iso];
  try { localStorage.setItem(HIST_NOTES_KEY, JSON.stringify(all)); } catch {}
}

function HiDayNote({ iso }) {
  const [val, setVal] = useHiState(() => readHistoryNotes()[iso] || "");
  const [savedAt, setSavedAt] = useHiState(null);
  const timerRef = useHiRef(null);
  function onChange(e) {
    const v = e.target.value;
    setVal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeHistoryNote(iso, v);
      setSavedAt(Date.now());
    }, 400);
  }
  return (
    <div className="hi-drawer-section">
      <div className="hi-drawer-section-label">Ma note perso</div>
      <textarea
        className="hi-daynote"
        value={val}
        placeholder="Qu'est-ce qui t'a marqué ce jour-là ? (sauvé automatiquement en local)"
        onChange={onChange}
      />
      {savedAt && <div className="hi-daynote-saved">Enregistré.</div>}
    </div>
  );
}

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
function HiDrawer({ day, onClose, onTogglePin, isPinned }) {
  if (!day) return null;
  // Retrieve full brief_html (saved in HISTORY_DATA._raw.briefs) for this day.
  const briefHtml = (function(){
    const raw = window.HISTORY_DATA?._raw?.briefs;
    if (!Array.isArray(raw)) return null;
    const match = raw.find(b => (b.date || "").slice(0,10) === day.iso);
    return match?.brief_html || null;
  })();
  // All articles of the day (beyond top 3)
  const allArticles = (function(){
    const raw = window.HISTORY_DATA?._raw?.arts60;
    if (!Array.isArray(raw)) return [];
    return raw.filter(a => a.fetch_date === day.iso);
  })();
  const extraArticles = allArticles.slice(3);
  return (
    <>
      <div className="hi-drawer-backdrop" onClick={onClose} />
      <div className="hi-drawer" role="dialog">
        <div className="hi-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hi-drawer-kicker">Brief archivé · il y a {day.days_ago}j</div>
            <h2 className="hi-drawer-date">{day.long}</h2>
            <div className="hi-drawer-sub">
              {day.week} · {day.articles} articles · {day.signals_rising} signaux · {day.jarvis_calls} requêtes Jarvis
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "start" }}>
            <button
              className="hi-drawer-pin"
              onClick={() => onTogglePin(day.iso)}
              title={isPinned ? "Désépingler" : "Épingler ce jour"}
              aria-label={isPinned ? "Désépingler" : "Épingler"}
            >
              {isPinned ? "● épinglé" : "○ épingler"}
            </button>
            <button className="hi-drawer-close" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
        </div>

        <div className="hi-drawer-body">
          <div className="hi-drawer-section">
            <div className="hi-drawer-section-label">Macro · synthèse du jour</div>
            <h3 className="hi-drawer-macro-title">{day.macro.title}</h3>
            <p className="hi-drawer-macro-body">{day.macro.body}</p>
            {briefHtml && (
              <details className="hi-drawer-fullbrief">
                <summary>Voir le brief complet</summary>
                <div
                  className="hi-drawer-fullbrief-html"
                  dangerouslySetInnerHTML={{ __html: window.DOMPurify ? window.DOMPurify.sanitize(briefHtml) : briefHtml }}
                />
              </details>
            )}
          </div>

          {day.top.length > 0 && (
            <div className="hi-drawer-section">
              <div className="hi-drawer-section-label">Top {day.top.length} incontournables</div>
              <div className="hi-drawer-top">
                {day.top.map((t) => (
                  <div
                    key={t.rank}
                    className="hi-drawer-top-item"
                    onClick={() => { if (t.url) window.open(t.url, "_blank", "noopener"); }}
                    style={t.url ? { cursor: "pointer" } : null}
                  >
                    <div className="hi-drawer-top-rank">{t.rank}</div>
                    <div className="hi-drawer-top-main">
                      <div className="hi-drawer-top-title">{t.title}</div>
                      <div className="hi-drawer-top-meta">{t.source} · {t.section}</div>
                    </div>
                    <div className="hi-drawer-top-score"><strong>{t.score}</strong>/100</div>
                  </div>
                ))}
              </div>
              {extraArticles.length > 0 && (
                <details className="hi-drawer-extras">
                  <summary>+ {extraArticles.length} autres articles ce jour-là</summary>
                  <ul className="hi-drawer-extra-list">
                    {extraArticles.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.url || "#"}
                          target={a.url ? "_blank" : undefined}
                          rel="noopener"
                          onClick={(e) => { if (!a.url) e.preventDefault(); }}
                        >
                          {a.title}
                        </a>
                        <span className="hi-drawer-extra-meta">
                          {a.source} · {a.section}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {day.signals.length > 0 && (
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
          )}

          {day.actions.length > 0 && (
            <div className="hi-drawer-section">
              <div className="hi-drawer-section-label">Actions prises ce jour</div>
              <ul className="hi-drawer-actions">
                {day.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <HiDayNote iso={day.iso} />
        </div>

        <div className="hi-drawer-foot">
          <button className="hi-drawer-btn" onClick={onClose}>Fermer</button>
          <button
            className="hi-drawer-btn is-primary"
            onClick={() => {
              if (!briefHtml) {
                alert("Pas de brief Gemini pour ce jour-là.");
                return;
              }
              const w = window.open("", "_blank", "noopener,width=900,height=900");
              if (!w) return;
              const safe = window.DOMPurify ? window.DOMPurify.sanitize(briefHtml) : briefHtml;
              w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Brief du ${day.long}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#2b2118}h1,h2,h3{font-weight:500;letter-spacing:-.01em}a{color:#8b4513}</style></head><body><p style="font-family:monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7a6a5a;margin-bottom:8px">Brief du ${day.long}</p>${safe}</body></html>`);
              w.document.close();
            }}
          >
            Imprimer / Exporter le brief →
          </button>
        </div>
      </div>
    </>
  );
}

// ── CSV export ──────────────────────────────────
function hiExportCsv(days) {
  const header = ["iso","jour","semaine","intensite","articles","signaux_rising","jarvis_calls","pinned","macro_titre","top1","top2","top3"];
  const rows = days.map(d => [
    d.iso,
    d.long,
    d.week,
    d.intensity,
    d.articles,
    d.signals_rising,
    d.jarvis_calls,
    d.pinned ? "oui" : "",
    `"${(d.macro?.title || "").replace(/"/g, '""')}"`,
    `"${(d.top[0]?.title || "").replace(/"/g, '""')}"`,
    `"${(d.top[1]?.title || "").replace(/"/g, '""')}"`,
    `"${(d.top[2]?.title || "").replace(/"/g, '""')}"`,
  ].join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cockpit-historique-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Main ────────────────────────────────────────
function PanelHistory({ data, onNavigate, onLoadDay, historicalDay }) {
  const hist = window.HISTORY_DATA;
  const [intensity, setIntensity] = useHiState("all");
  const [pinnedOnly, setPinnedOnly] = useHiState(false);
  const [query, setQuery] = useHiState("");
  const [selectedIso, setSelectedIso] = useHiState(null);
  const [pinTick, setPinTick] = useHiState(0); // forces re-render after pin toggle

  useHiEffect(() => {
    function onKey(e) {
      // Ignore when typing in input/textarea
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { setSelectedIso(null); return; }
      // J/K or ArrowDown/ArrowUp to move selection in the filtered list
      const list = hist.days;
      if (!list.length) return;
      const idx = selectedIso ? list.findIndex(d => d.iso === selectedIso) : -1;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const next = list[Math.min(list.length - 1, idx === -1 ? 0 : idx + 1)];
        if (next) setSelectedIso(next.iso);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prev = list[Math.max(0, idx === -1 ? 0 : idx - 1)];
        if (prev) setSelectedIso(prev.iso);
      } else if (e.key === "Enter" && selectedIso) {
        // Already selected, no extra action (drawer already open)
      } else if (e.key === "p" && selectedIso) {
        // Quick pin toggle on current selection
        handleTogglePin(selectedIso);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIso, hist.days]);

  function handleTogglePin(iso) {
    if (window.cockpitHistoryPins?.toggle) {
      const nowPinned = window.cockpitHistoryPins.toggle(iso);
      // Mutate the day in place so filters/KPIs reflect the change without refetch.
      const day = hist.days.find(d => d.iso === iso);
      if (day) day.pinned = nowPinned;
      setPinTick(t => t + 1);
      try { window.track && window.track("history_pin_toggled", { iso, pinned: nowPinned }); } catch {}
    }
  }


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
  }, [intensity, pinnedOnly, query, hist.days, pinTick]);

  // Group par semaine pour affichage
  const filteredByWeek = useHiMemo(() => {
    const g = {};
    filtered.forEach((d) => { if (!g[d.week]) g[d.week] = []; g[d.week].push(d); });
    return Object.entries(g).sort((a, b) => a[1][0].iso < b[1][0].iso ? 1 : -1);
  }, [filtered]);

  const selectedDay = selectedIso ? hist.days.find((d) => d.iso === selectedIso) : null;
  const t = hist?.totals || {};

  return (
    <div className="hi-wrap">
      {/* HERO */}
      <section className="hi-hero">
        <div>
          <div className="hi-hero-eyebrow">Historique · {hist.days.length} jours archivés</div>
          <h1 className="hi-hero-title">
            Revivre n'importe quel brief, <em>tel qu'il a été</em>.
          </h1>
          <p className="hi-hero-sub">
            Chaque jour est une archive complète : macro, top, signaux, décisions. Sélectionne un jour pour ouvrir sa fiche, épingler les moments clés ou exporter le brief.
          </p>
        </div>
        <div className="hi-kpis">
          <div className="hi-kpi">
            <div className="hi-kpi-label">Articles vus (60j)</div>
            <div className="hi-kpi-val">{(t.total_articles ?? 0).toLocaleString("fr-FR")}</div>
            <div className="hi-kpi-sub">{((t.total_articles ?? 0) / Math.max(1, hist?.days?.length || 1)).toFixed(0)}/jour en moyenne</div>
          </div>
          <div className="hi-kpi">
            <div className="hi-kpi-label">Requêtes Jarvis</div>
            <div className="hi-kpi-val">{(t.total_jarvis_calls ?? 0).toLocaleString("fr-FR")}</div>
            <div className="hi-kpi-sub">streak en cours · {t.streak_days ?? 0}j</div>
          </div>
          <div className="hi-kpi">
            <div className="hi-kpi-label">Jour le plus chargé</div>
            <div className="hi-kpi-val" style={{ fontSize: 18 }}>{t.peak_day?.short_label || "—"}</div>
            <div className="hi-kpi-sub">{t.peak_day?.articles ?? 0} articles ce jour-là</div>
          </div>
          <div className="hi-kpi">
            <div className="hi-kpi-label">Actions consignées</div>
            <div className="hi-kpi-val">{t.total_actions ?? 0}</div>
            <div className="hi-kpi-sub">sur les 60 derniers jours</div>
          </div>
        </div>
      </section>

      {/* TOP SOURCES */}
      <HiTopSources days={hist.days} />

      {/* HEATMAP */}
      <section className="hi-heatmap-section">
        <div className="hi-section-kicker">Calendrier d'activité</div>
        <h2 className="hi-section-title">Les 60 derniers jours, d'un coup d'œil</h2>
        <HiSparkline days={hist.days} />
        <HiHeatmap
          days={hist.days}
          activeIso={selectedIso}
          todayIso={hist.today_iso}
          onPick={setSelectedIso}
        />
        <div className="hi-kbd-hint">
          <span className="hi-kbd">↑↓</span> ou <span className="hi-kbd">j/k</span> naviguer · <span className="hi-kbd">p</span> épingler · <span className="hi-kbd">Esc</span> fermer
        </div>
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
        <button
          className="hi-chip hi-export-btn"
          onClick={() => hiExportCsv(filtered)}
          title="Télécharger les jours filtrés en CSV"
        >↓ CSV ({filtered.length})</button>
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
          onTogglePin={handleTogglePin}
          isPinned={!!selectedDay.pinned}
        />
      )}
    </div>
  );
}

window.PanelHistory = PanelHistory;
