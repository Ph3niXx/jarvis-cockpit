// Home — Brief du jour. Three theme variants share this component
// but the theme's vibe tokens (dividerStyle, accentShape, etc.)
// meaningfully reshape the layout feel.

// Audio brief — reads the macro title + body via Web Speech API.
// No external provider: uses the browser's built-in French voice.
function AudioBriefChip({ macro }) {
  const [state, setState] = React.useState("idle"); // idle | speaking
  const est = Math.max(1, Math.round((macro.body || "").length / 280));
  const label = state === "speaking" ? "Arrêter" : `Lecture audio · ${est} min`;
  const iconName = state === "speaking" ? "check" : "play";

  function speak(){
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const text = (macro.title ? macro.title + ". " : "") + (macro.body || "");
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1.02;
    u.pitch = 1;
    const voices = synth.getVoices();
    const fr = voices.find(v => /^fr/i.test(v.lang));
    if (fr) u.voice = fr;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    synth.speak(u);
    setState("speaking");
  }
  function stop(){
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  }
  React.useEffect(() => () => stop(), []);

  return (
    <button className="ph-chip" onClick={state === "speaking" ? stop : speak}>
      <Icon name={iconName} size={10} stroke={2} /> {label}
    </button>
  );
}

function TrendArrow({ trend, delta }) {
  if (trend === "new") return <span className="pill-badge pill-badge--new">NEW</span>;
  if (trend === "rising") return (
    <span className="delta delta--up">
      <Icon name="arrow_up" size={12} stroke={2.5} />+{delta}
    </span>
  );
  if (trend === "declining") return (
    <span className="delta delta--down">
      <Icon name="arrow_down" size={12} stroke={2.5} />{delta}
    </span>
  );
  return <span className="delta delta--flat">—</span>;
}

function RadarSVG({ axes, size = 260 }) {
  const cx = size / 2, cy = size / 2;
  const radius = size / 2 - 30;
  const n = axes.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const points = axes.map((a, i) => {
    const r = (a.score / 100) * radius;
    return [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  });
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}>
      {rings.map((r, i) => {
        const pts = axes.map((_, j) => {
          const rr = r * radius;
          return `${cx + Math.cos(angle(j)) * rr},${cy + Math.sin(angle(j)) * rr}`;
        }).join(" ");
        return <polygon key={i} points={pts} className="radar-ring" />;
      })}
      {axes.map((_, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={cx + Math.cos(angle(i)) * radius}
          y2={cy + Math.sin(angle(i)) * radius}
          className="radar-spoke" />
      ))}
      <polygon points={points.map(p => p.join(",")).join(" ")} className="radar-shape" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={axes[i].gap ? 5 : 3.5}
          className={axes[i].gap ? "radar-pt radar-pt--gap" : "radar-pt"} />
      ))}
      {axes.map((a, i) => {
        const r = radius + 16;
        const x = cx + Math.cos(angle(i)) * r;
        const y = cy + Math.sin(angle(i)) * r;
        return <text key={i} x={x} y={y} className="radar-label"
          textAnchor={Math.abs(Math.cos(angle(i))) < 0.2 ? "middle" : (Math.cos(angle(i)) > 0 ? "start" : "end")}
          dominantBaseline="middle">{a.name}</text>;
      })}
    </svg>
  );
}

function Sparkbar({ values, max }) {
  const m = max || Math.max(...values);
  return (
    <div className="sparkbar">
      {values.map((v, i) => (
        <span key={i} className="sparkbar-tick" style={{ height: `${(v / m) * 100}%` }} />
      ))}
    </div>
  );
}

function Sparkline({ values, trend }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const w = 100, h = 32;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / Math.max(max - min, 1)) * (h - 4) - 2}`).join(" ");
  const cls = trend === "rising" ? "sl-rising" : trend === "declining" ? "sl-declining" : trend === "new" ? "sl-new" : "sl-stable";
  return (
    <svg className={`sparkline ${cls}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" strokeWidth="1.5" />
      <circle cx={(values.length - 1) * step} cy={h - ((values[values.length-1] - min) / Math.max(max - min, 1)) * (h - 4) - 2} r="2.5" />
    </svg>
  );
}

function SignalCard({ signal, rank, onNavigate }) {
  const trendLabel = { rising: "EN HAUSSE", new: "NOUVEAU", declining: "EN BAISSE", stable: "STABLE" }[signal.trend];
  return (
    <article className={`sig-card sig-card--${signal.trend}`}>
      <div className="sig-card-head">
        <span className="sig-card-rank">#{String(rank + 1).padStart(2, "0")}</span>
        <span className={`sig-card-badge sig-card-badge--${signal.trend}`}>{trendLabel}</span>
        <span className="sig-card-cat">{signal.category}</span>
      </div>
      <h3 className="sig-card-term">{signal.name}</h3>
      <p className="sig-card-context">{signal.context}</p>
      <div className="sig-card-foot">
        <div className="sig-card-stats">
          <span className="sig-card-count">{signal.count}</span>
          <span className="sig-card-count-label">mentions<br/>cette semaine</span>
        </div>
        <div className="sig-card-spark">
          <Sparkline values={signal.history} trend={signal.trend} />
          <div className="sig-card-delta">
            {signal.trend === "new" ? <span className="sig-card-delta-new">nouveau signal</span>
              : signal.delta > 0 ? <span className="sig-card-delta-up"><Icon name="arrow_up" size={10} stroke={2.5} />+{signal.delta}</span>
              : signal.delta < 0 ? <span className="sig-card-delta-down"><Icon name="arrow_down" size={10} stroke={2.5} />{signal.delta}</span>
              : <span className="sig-card-delta-flat">stable</span>}
            <span className="sig-card-delta-window">8 sem.</span>
          </div>
        </div>
        <button
          className="card-action card-action--ask sig-card-ask"
          aria-label="Demander à Jarvis à propos de ce signal"
          onClick={(e) => {
            e.stopPropagation();
            const prompt = `À propos du signal "${signal.name}" (${signal.category}, ${trendLabel}) : ${signal.context || signal.count + " mentions cette semaine"}\nMa question : `;
            try { localStorage.setItem("jarvis-prefill", prompt); } catch {}
            if (typeof onNavigate === "function") onNavigate("jarvis");
          }}
        >
          <Icon name="message_circle" size={12} stroke={2} />
        </button>
      </div>
    </article>
  );
}

function MorningCard({ items = [], onNavigate }) {
  if (!items.length) return null;
  return (
    <section className="morning">
      <div className="morning-head">
        <div className="morning-eyebrow">Trois choses aujourd'hui</div>
        <h2 className="morning-title">Commence par ça.</h2>
      </div>
      <ol className="morning-list">
        {items.map((it, i) => (
          <li key={i} className="morning-item">
            <span className="morning-num">{String(i + 1).padStart(2, "0")}</span>
            <div className="morning-body">
              <div className="morning-kind">{it.kind}</div>
              <h3 className="morning-item-title">{it.title}</h3>
              <p className="morning-reason">{it.reason}</p>
            </div>
            <button
              className="morning-cta"
              onClick={() => {
                if (it.href) window.open(it.href, "_blank", "noopener");
                else if (it.navigate) onNavigate(it.navigate);
              }}
            >
              {it.cta} <Icon name="arrow_right" size={12} stroke={2} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Home({ theme, data, onNavigate }) {
  const { macro, top, signals, stats, date, user, radar, week } = data;
  const morningItems = data.morning_card || [];
  const [readTop, setReadTop] = React.useState({});
  const toggleRead = (rank) => setReadTop({ ...readTop, [rank]: !readTop[rank] });
  const [undoState, setUndoState] = React.useState(null);
  // undoState = { previousMap, count, timer } | null
  React.useEffect(() => () => {
    if (undoState && undoState.timer) clearTimeout(undoState.timer);
  }, [undoState]);
  const markAllRead = () => {
    try {
      const previousMap = JSON.parse(localStorage.getItem("read-articles") || "{}");
      const newMap = { ...previousMap };
      const ids = (top || []).map(t => t._id || t.id).filter(Boolean);
      ids.forEach(id => { newMap[id] = { ts: Date.now() }; });
      localStorage.setItem("read-articles", JSON.stringify(newMap));
      setReadTop(Object.fromEntries((top || []).map(t => [t.rank, true])));
      if (undoState && undoState.timer) clearTimeout(undoState.timer);
      const timer = setTimeout(() => setUndoState(null), 6000);
      setUndoState({ previousMap, count: ids.length, timer });
    } catch {}
  };
  const undoMarkAll = () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    try {
      localStorage.setItem("read-articles", JSON.stringify(undoState.previousMap));
      setReadTop({});
    } catch {}
    setUndoState(null);
  };
  const [viewMode, setViewMode] = React.useState(() => {
    try { return localStorage.getItem("home-view-mode") || "full"; } catch { return "full"; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("home-view-mode", viewMode); } catch {}
  }, [viewMode]);

  const lastVisitTs = React.useMemo(() => {
    try {
      const v = Number(localStorage.getItem("cockpit-last-visit-ts"));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch { return null; }
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem("cockpit-last-visit-ts", String(Date.now())); } catch {}
  }, []);
  const visitDelta = React.useMemo(() => {
    if (!lastVisitTs) return null;
    const now = Date.now();
    const diffH = (now - lastVisitTs) / 3600000;
    if (diffH < 0.5) return null;
    if (diffH < 18) return { h: Math.round(diffH), kind: "today" };
    return { h: Math.round(diffH), kind: "yesterday" };
  }, [lastVisitTs]);
  const newSinceVisit = React.useMemo(() => {
    if (!lastVisitTs) return null;
    let n = 0;
    (data.top || []).forEach(t => {
      const ts = t.fetch_iso ? new Date(t.fetch_iso).getTime() : null;
      if (ts && ts > lastVisitTs) n++;
    });
    return n;
  }, [lastVisitTs, data.top]);

  return (
    <div className="home" data-theme-vibe={theme.id}>
      {/* PAGE HEADER */}
      <header className="ph">
        <div className="ph-left">
          <span className="ph-eyebrow">{date.week} · {date.day_of_year}</span>
          <span className="ph-sep">/</span>
          <strong className="ph-title">Brief du jour</strong>
          <span className="ph-sep">·</span>
          <span className="ph-date">{date.long}</span>
        </div>
        <div className="ph-right">
          <AudioBriefChip macro={macro} />
          <button
            className="ph-chip ph-chip--primary"
            onClick={markAllRead}
          ><Icon name="check" size={13} stroke={2.5} /> Tout marqué lu</button>
        </div>
      </header>

      {morningItems.length > 0 && (
        <div className="home-toggle" role="tablist" aria-label="Vue d'accueil">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "morning"}
            className={`home-toggle-btn ${viewMode === "morning" ? "is-active" : ""}`}
            onClick={() => setViewMode("morning")}
          >Morning Card</button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "full"}
            className={`home-toggle-btn ${viewMode === "full" ? "is-active" : ""}`}
            onClick={() => setViewMode("full")}
          >Brief complet</button>
        </div>
      )}

      {viewMode === "morning" && morningItems.length > 0 ? (
        <MorningCard items={morningItems} onNavigate={onNavigate} />
      ) : (<>

      {/* ── HERO : the macro synthesis ─────────────────────────── */}
      <section className="hero">
        <div className="hero-frame">
          <div className="hero-col-main">
            <div className="hero-kicker">
              <span className="kicker-dot" />
              {visitDelta ? (
                <>
                  DEPUIS TA DERNIÈRE VISITE — {visitDelta.h}H
                  {newSinceVisit != null && (
                    <>{' '}<span className="hero-kicker-meta">
                      · {newSinceVisit} nouveaux articles · {macro.articles_summarized} au total
                    </span></>
                  )}
                </>
              ) : (
                <>
                  {macro.kicker}
                  <span className="hero-kicker-sep">—</span>
                  <span className="hero-kicker-meta">{macro.articles_summarized} articles synthétisés · lecture {macro.reading_time}</span>
                </>
              )}
            </div>
            <h1 className="hero-title">{macro.title}</h1>
            <p className="hero-body">{macro.body}</p>
            <div className="hero-actions">
              <button className="btn btn--primary" onClick={() => onNavigate("top")}>
                Lire les 3 incontournables <Icon name="arrow_right" size={14} stroke={2} />
              </button>
              <button className="btn btn--ghost" onClick={() => onNavigate("updates")}>
                Parcourir les {macro.articles_summarized || 0} articles
              </button>
            </div>
          </div>

          <div className="hero-col-side">
            <div className="hero-todo">
              <div className="hero-todo-label">À traiter depuis hier</div>
              <div className="hero-todo-num">{stats.unread_total ?? stats.articles_today}</div>
              <div className="hero-todo-unit">articles · {stats.signals_rising ?? 0} signaux à regarder</div>
              <button className="btn btn--primary btn--sm hero-todo-cta" onClick={() => onNavigate("top")}>
                Commencer la revue <Icon name="arrow_right" size={12} stroke={2} />
              </button>
            </div>
            <div className="hero-meta">
              <div className="hero-meta-item">
                <span className="hero-meta-label">Prochain brief</span>
                <span className="hero-meta-val">{stats.next_brief}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOP 3 INCONTOURNABLES ───────────────────────────── */}
      <section className="block">
        <div className="block-head">
          <div>
            <div className="section-kicker">Top du jour</div>
            <h2 className="section-title">3 incontournables, classés par l'agent</h2>
          </div>
          <button className="link-more" onClick={() => onNavigate("top")}>
            Tous les incontournables <Icon name="arrow_right" size={12} stroke={2} />
          </button>
        </div>

        <div className="top-grid">
          {top.map((t) => {
            const openArticle = () => {
              const url = t._url || t.url;
              if (!url) return;
              try {
                const id = t._id || t.id;
                if (id) {
                  const rm = JSON.parse(localStorage.getItem("read-articles") || "{}");
                  rm[id] = { ts: Date.now() };
                  localStorage.setItem("read-articles", JSON.stringify(rm));
                }
              } catch {}
              toggleRead(t.rank);
              window.open(url, "_blank", "noopener");
            };
            const hasUrl = !!(t._url || t.url);
            return (
            <article
              key={t.rank}
              className={`top-card ${readTop[t.rank] ? "is-read" : t.unread ? "is-unread" : ""} top-card--rank${t.rank}`}
              onClick={openArticle}
              style={hasUrl ? { cursor: "pointer" } : null}
            >
              <div className="top-card-rail">
                <span className="top-rank">{String(t.rank).padStart(2, "0")}</span>
                <span className="top-score" title="Score de pertinence">
                  <span className="top-score-bar"><span className="top-score-fill" style={{ width: `${t.score}%` }} /></span>
                  <span className="top-score-num">{t.score}</span>
                </span>
              </div>
              <div className="top-card-body">
                <div className="top-meta">
                  <span className="top-source">{t.source}</span>
                  <span className="top-section">{t.section}</span>
                  <span className="top-date">{t.date}</span>
                  {t.unread && !readTop[t.rank] && <span className="top-unread-dot" />}
                </div>
                <h3 className="top-title">{t.title}</h3>
                <p className="top-summary">{t.summary}</p>
                <div className="top-card-foot" onClick={(e) => e.stopPropagation()}>
                  <div className="top-tags">
                    {t.tags.map(tag => <span key={tag} className="top-tag">{tag}</span>)}
                  </div>
                  <div className="top-actions">
                    <button className="card-action card-action--bookmark" aria-label="Garder cet article">
                      <Icon name="bookmark" size={12} stroke={2} />
                    </button>
                    <button
                      className="card-action card-action--ask"
                      aria-label="Demander à Jarvis à propos de cet article"
                      onClick={(e) => {
                        e.stopPropagation();
                        const prompt = `À propos de "${t.title}" (${t.source}) : ${t.summary}\nMa question : `;
                        try { localStorage.setItem("jarvis-prefill", prompt); } catch {}
                        if (typeof onNavigate === "function") onNavigate("jarvis");
                      }}
                    >
                      <Icon name="message_circle" size={12} stroke={2} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      {/* ── 2-COL : Signaux + Radar gap ─────────────────────── */}
      <section className="block block--two">
        <div className="col col--signals">
          <div className="block-head">
            <div>
              <div className="section-kicker">Signaux faibles · S17</div>
              <h2 className="section-title">Ce qui émerge<br/>cette semaine</h2>
            </div>
            <button className="link-more" onClick={() => onNavigate("signals")}>
              Voir tous <Icon name="arrow_right" size={12} stroke={2} />
            </button>
          </div>
          <div className="sig-grid">
            {signals.slice(0, 4).map((s, i) => <SignalCard key={s.name} signal={s} rank={i} onNavigate={onNavigate} />)}
          </div>
        </div>

        <div className="col col--radar">
          <div className="block-head">
            <div>
              <div className="section-kicker">Radar compétences</div>
              <h2 className="section-title">Ton prochain gap à combler</h2>
            </div>
          </div>
          <div className="radar-box">
            <div className="radar-svg-wrap">
              <RadarSVG axes={radar.axes} size={230} />
            </div>
            <div className="radar-next">
              <div className="radar-next-tag">
                <span className="radar-next-dot" />
                Gap prioritaire
              </div>
              <div className="radar-next-axis">{radar.next_gap.axis}</div>
              <p className="radar-next-reason">{radar.next_gap.reason}</p>
              <button className="btn btn--primary btn--sm" onClick={() => onNavigate("challenges")}>
                {radar.next_gap.action} <Icon name="arrow_right" size={12} stroke={2} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ma semaine strip ─────────────────────────────────── */}
      <section className="block">
        <div className="block-head">
          <div>
            <div className="section-kicker">Ma semaine</div>
            <h2 className="section-title">{week.total_read} articles lus, {week.streak} jours d'affilée</h2>
          </div>
          <button className="link-more" onClick={() => onNavigate("week")}>
            Ouvrir ma semaine <Icon name="arrow_right" size={12} stroke={2} />
          </button>
        </div>
        <div className="hwk-wrap">
          <div className="hwk">
            <div className="hwk-head">
              <span className="hwk-head-label">Articles lus</span>
              <span className="hwk-head-avg">moy. {(week.total_read / 7).toFixed(1)}/jour</span>
            </div>
            <div className="hwk-grid">
              {[0, 5, 10, 15].map(tick => (
                <div key={tick} className="hwk-tick" style={{ bottom: `${(tick / 16) * 100}%` }}>
                  <span className="hwk-tick-label">{tick}</span>
                  <span className="hwk-tick-line" />
                </div>
              ))}
              <div className="hwk-bars">
                {week.days.map((d, i) => {
                  const max = 16;
                  return (
                    <div key={d.day} className={`hwk-col ${i === 1 ? "is-today" : ""} ${d.read === Math.max(...week.days.map(x=>x.read)) ? "is-peak" : ""}`}>
                      <div className="hwk-bar-wrap">
                        <div className="hwk-val">{d.read}</div>
                        <div className="hwk-bar" style={{ height: `${(d.read / max) * 100}%` }} />
                      </div>
                      <div className="hwk-label">{d.day}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="hwk-kpi">
            <div className="hwk-kpi-card">
              <div className="hwk-kpi-card-label">Articles lus</div>
              <div className="hwk-kpi-card-val">{week.total_read}</div>
              <div className="hwk-kpi-card-delta is-up">+{week.compare_last.read.this - week.compare_last.read.last} vs S-1</div>
            </div>
            <div className="hwk-kpi-card">
              <div className="hwk-kpi-card-label">Gardés</div>
              <div className="hwk-kpi-card-val">{week.total_marked}</div>
              <div className="hwk-kpi-card-delta">{Math.round((week.total_marked / week.total_read) * 100)}% du flux</div>
            </div>
            <div className="hwk-kpi-card">
              <div className="hwk-kpi-card-label">Streak veille</div>
              <div className="hwk-kpi-card-val hwk-kpi-card-val--flame"><Icon name="flame" size={20} stroke={1.8} /> {week.streak}<span className="hwk-kpi-card-unit">j</span></div>
              <div className="hwk-kpi-card-delta">record depuis janvier</div>
            </div>
          </div>
        </div>
      </section>

      </>)}

      <footer className="home-foot">
        <span>Brief généré par Gemini Flash-Lite · synthèse hebdo par Claude Haiku</span>
        <span>{stats.cost_month} / {stats.cost_budget} ce mois</span>
      </footer>

      {undoState && (
        <div className="ph-undo-toast" role="status">
          <span>{undoState.count} articles marqués lus</span>
          <button className="ph-undo-btn" onClick={undoMarkAll}>Annuler</button>
        </div>
      )}
    </div>
  );
}

window.Home = Home;
