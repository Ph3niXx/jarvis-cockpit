// Panel : Veille IA — feed éditorial unifié
const { useState: useStateVeille, useMemo: useMemoVeille, useEffect: useEffectVeille } = React;

// Persistent read/archive state across navigations — single key for all
// panel-veille corpora since IDs come from distinct tables (no collision).
const VEILLE_READ_KEY = "veille-read-state";
function loadVeilleReadState(){
  try {
    const raw = localStorage.getItem(VEILLE_READ_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  } catch { return {}; }
}
function saveVeilleReadState(state){
  try { localStorage.setItem(VEILLE_READ_KEY, JSON.stringify(state)); } catch {}
}

const VEILLE_TYPES = ["Tous", "Release", "Framework", "Cas prod", "Papier", "Deal", "Régulation", "Analyse"];
const VEILLE_PERIODS = [
  { id: "24h", label: "24h", max_h: 24 },
  { id: "7j",  label: "7 jours", max_h: 24 * 7 },
  { id: "30j", label: "30 jours", max_h: 24 * 30 },
];

function ActorMark({ actor, size = 28 }) {
  if (!actor) {
    return <span className="vl-actor-mark" style={{ width: size, height: size, background: "#888", fontSize: size * 0.45 }}>?</span>;
  }
  return (
    <span
      className="vl-actor-mark"
      style={{ width: size, height: size, background: actor.color, fontSize: size * 0.45 }}
    >{actor.mark}</span>
  );
}

function PulseBars({ pulse, color }) {
  const max = Math.max(...pulse, 1);
  return (
    <div className="vl-pulse">
      {pulse.map((v, i) => (
        <span key={i} className="vl-pulse-bar" style={{ height: `${(v / max) * 100}%`, background: color }} />
      ))}
    </div>
  );
}

const MONTHS_FR_FULL = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function ProdTable({ prodSection, items }){
  const sorted = useMemoVeille(() => {
    return (items || []).slice().sort((a, b) => {
      const da = a.air_iso ? new Date(a.air_iso).getTime() : Infinity;
      const db = b.air_iso ? new Date(b.air_iso).getTime() : Infinity;
      return da - db;
    });
  }, [items]);

  // Years with at least one release, asc
  const years = useMemoVeille(() => {
    const set = new Set();
    sorted.forEach(p => {
      if (p.air_iso) set.add(new Date(p.air_iso).getFullYear());
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [sorted]);

  const currentYear = new Date().getFullYear();
  const defaultYear = years.includes(currentYear) ? currentYear : (years[0] || currentYear);
  const [yearFilter, setYearFilter] = useStateVeille(defaultYear); // number | "all"
  const [monthFilter, setMonthFilter] = useStateVeille("all");    // "all" | 0-11

  // Reset month when year changes to avoid stale selection
  React.useEffect(() => { setMonthFilter("all"); }, [yearFilter]);

  // Months within the selected year (or all months across years if yearFilter === "all")
  const monthsAvailable = useMemoVeille(() => {
    const set = new Set();
    sorted.forEach(p => {
      if (!p.air_iso) return;
      const d = new Date(p.air_iso);
      if (yearFilter === "all" || d.getFullYear() === yearFilter) set.add(d.getMonth());
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [sorted, yearFilter]);

  const filtered = useMemoVeille(() => {
    return sorted.filter(p => {
      if (!p.air_iso) return false;
      const d = new Date(p.air_iso);
      if (yearFilter !== "all" && d.getFullYear() !== yearFilter) return false;
      if (monthFilter !== "all" && d.getMonth() !== monthFilter) return false;
      return true;
    });
  }, [sorted, yearFilter, monthFilter]);

  const yearCount = (y) => sorted.filter(p => p.air_iso && new Date(p.air_iso).getFullYear() === y).length;
  const monthCount = (m) => sorted.filter(p => {
    if (!p.air_iso) return false;
    const d = new Date(p.air_iso);
    if (yearFilter !== "all" && d.getFullYear() !== yearFilter) return false;
    return d.getMonth() === m;
  }).length;

  return (
    <section className="vl-section">
      <div className="vl-section-head">
        <div>
          <div className="vl-section-kicker">{prodSection.kicker}</div>
          <h2 className="vl-section-title">{prodSection.title}</h2>
        </div>
      </div>
      <div className="vl-prod-filter-row">
        <span className="vl-prod-filter-label">Année</span>
        <div className="vl-prod-filters">
          <button
            className={`vl-prod-filter ${yearFilter === "all" ? "is-active" : ""}`}
            onClick={() => setYearFilter("all")}
          >
            Tout <span className="vl-prod-filter-count">{sorted.length}</span>
          </button>
          {years.map(y => (
            <button
              key={y}
              className={`vl-prod-filter ${yearFilter === y ? "is-active" : ""}`}
              onClick={() => setYearFilter(y)}
            >
              {y} <span className="vl-prod-filter-count">{yearCount(y)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="vl-prod-filter-row">
        <span className="vl-prod-filter-label">Mois</span>
        <div className="vl-prod-filters">
          <button
            className={`vl-prod-filter ${monthFilter === "all" ? "is-active" : ""}`}
            onClick={() => setMonthFilter("all")}
          >
            Tout
          </button>
          {monthsAvailable.map(m => (
            <button
              key={m}
              className={`vl-prod-filter ${monthFilter === m ? "is-active" : ""}`}
              onClick={() => setMonthFilter(m)}
            >
              {MONTHS_FR_FULL[m]} <span className="vl-prod-filter-count">{monthCount(m)}</span>
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="vl-prod-empty">Aucune sortie prévue sur cette période.</div>
      ) : (
        <div className="vl-prod-table-wrap">
          <table className="vl-prod-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Titre</th>
                <th>Type</th>
                <th>Studio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.url || p.company}>
                  <td className="vl-prod-date">{p.when}</td>
                  <td className="vl-prod-title">{p.company}</td>
                  <td><span className="vl-prod-pill" style={{ background: p.color }}>{p.domain}</span></td>
                  <td className="vl-prod-studio">{p.model}</td>
                  <td>
                    {p.url && (
                      <a className="vl-prod-link" href={p.url} target="_blank" rel="noopener noreferrer">MAL ↗</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PanelVeille({ data, onNavigate, corpus = "VEILLE_DATA", title = "Veille IA", actorsLabel = "labos + éditeurs", prodSection = { kicker: "Agents en production", title: "Qui a déployé quoi, ce mois-ci" }, showActors = true, categoryLabel = "Acteur", categories = null, typeLabel = "Type", prodTableMode = false }) {
  const v = window[corpus];
  if (!v) return <div className="panel-page" style={{padding: 60}}>Corpus <code>{corpus}</code> introuvable.</div>;
  const [tone, setTone] = useStateVeille("dense"); // "dense" technique par défaut / "dawn" éditorial
  const [actorFilter, setActorFilter] = useStateVeille("all");
  const [typeFilter, setTypeFilter] = useStateVeille("Tous");
  const [period, setPeriod] = useStateVeille("7j");
  const [trendFilter, setTrendFilter] = useStateVeille(null); // id of selected trend
  const [readState, setReadState] = useStateVeille(() => loadVeilleReadState()); // id -> "read" | "archived" | undefined, persisted to localStorage

  // Persist on every change — LS write is cheap and keeps cross-nav state
  useEffectVeille(() => { saveVeilleReadState(readState); }, [readState]);
  const [expandedGroups, setExpandedGroups] = useStateVeille({}); // type -> true = show all in group
  const GROUP_PREVIEW = 5;

  const actors = v.actors;
  // Prefer the prop when explicitly provided (legacy). Otherwise fall
  // back to v.categories (auto-populated by loadPanel from the real
  // article corpus). Allows panels to have dynamic filter pills.
  const effectiveCategories = categories || v.categories || null;
  const periodMaxH = VEILLE_PERIODS.find((p) => p.id === period).max_h;

  const filtered = useMemoVeille(() => {
    const trend = trendFilter ? v.trends.find(t => t.id === trendFilter) : null;
    const trendKeywords = trend ? trend.label.toLowerCase().split(/\s+/).filter(w => w.length > 3) : null;
    return v.feed.filter((f) => {
      if (readState[f.id] === "archived") return false;
      if (effectiveCategories) {
        if (actorFilter !== "all" && f.category !== actorFilter) return false;
      } else {
        if (actorFilter !== "all" && f.actor !== actorFilter) return false;
      }
      if (typeFilter !== "Tous" && f.type !== typeFilter) return false;
      if (f.date_h > periodMaxH) return false;
      if (trendKeywords) {
        const hay = (f.title + " " + f.summary + " " + f.tags.join(" ")).toLowerCase();
        if (!trendKeywords.some(k => hay.includes(k))) return false;
      }
      return true;
    });
  }, [v.feed, readState, actorFilter, typeFilter, periodMaxH, trendFilter, effectiveCategories]);

  // Build types list from feed dynamically (always start with "Tous")
  const availableTypes = useMemoVeille(() => {
    const set = new Set(v.feed.map(f => f.type));
    return ["Tous", ...Array.from(set).sort()];
  }, [v.feed]);

  const unreadCount = filtered.filter((f) => f.unread && readState[f.id] !== "read").length;

  const markRead = (id) => setReadState({ ...readState, [id]: readState[id] === "read" ? undefined : "read" });
  const archive = (id) => setReadState({ ...readState, [id]: "archived" });
  const markAllRead = () => {
    const next = { ...readState };
    filtered.forEach((f) => { next[f.id] = "read"; });
    setReadState(next);
  };

  const actorFilterPills = effectiveCategories
    ? [
        { id: "all", label: "Tous", count: v.feed.length, color: null },
        ...effectiveCategories.map(c => ({
          id: c.id,
          label: c.label,
          count: v.feed.filter(f => f.category === c.id).length,
          color: c.color || null,
        })),
      ]
    : [
        { id: "all", label: "Tous acteurs", count: v.feed.length, color: null },
        ...actors.filter(a => a.followed).map(a => ({
          id: a.name,
          label: a.name,
          count: v.feed.filter(f => f.actor === a.name).length,
          color: a.color,
        })),
      ];

  return (
    <div className={`panel-page vl-panel ${tone === "dense" ? "vl-dense" : "vl-dawn"}`}>
      {/* ═══════ HERO ═══════ */}
      <div className="vl-hero">
        <div className="vl-hero-left">
          <div className="vl-hero-kicker">
            <span className="vl-hero-dot" />
            <span>{title} · {v.headline.kicker}</span>
            <span className="vl-hero-sep">·</span>
            <span>{unreadCount} non-lu{unreadCount > 1 ? "s" : ""}</span>
          </div>
          <div className="vl-hero-actor">
            <ActorMark actor={actors.find(a => a.name === v.headline.actor)} size={40} />
            <div>
              <div className="vl-hero-actor-name">{v.headline.actor}</div>
              <div className="vl-hero-actor-version">{v.headline.version}</div>
            </div>
          </div>
          <h1 className="vl-hero-title">{v.headline.tagline}</h1>
          <p className="vl-hero-body">{v.headline.body}</p>
          <div className="vl-hero-cta">
            <button
              className="btn btn--primary"
              disabled={!v.headline.url}
              onClick={() => {
                if (!v.headline.url) return;
                try {
                  if (v.headline.id) {
                    const rm = JSON.parse(localStorage.getItem("read-articles") || "{}");
                    rm[v.headline.id] = { ts: Date.now(), kept: !!rm[v.headline.id]?.kept };
                    localStorage.setItem("read-articles", JSON.stringify(rm));
                  }
                } catch {}
                window.open(v.headline.url, "_blank", "noopener");
              }}
            ><Icon name="paper" size={13} stroke={2}/> Lire le détail</button>
            <button
              className="btn btn--ghost"
              disabled={!v.headline.id}
              onClick={() => {
                if (!v.headline.id) return;
                try {
                  const rm = JSON.parse(localStorage.getItem("read-articles") || "{}");
                  rm[v.headline.id] = { ts: Date.now(), kept: true };
                  localStorage.setItem("read-articles", JSON.stringify(rm));
                } catch {}
              }}
            ><Icon name="archive" size={13} stroke={2}/> Sauvegarder</button>
          </div>
        </div>
        <div className="vl-hero-right">
          <div className="vl-hero-metrics-label">Benchmarks</div>
          <div className="vl-hero-metrics">
            {v.headline.metrics.map((m) => (
              <div key={m.label} className="vl-metric">
                <div className="vl-metric-label">{m.label}</div>
                <div className="vl-metric-value">{m.value}</div>
                <div className={`vl-metric-delta ${m.delta.startsWith("+") ? "is-up" : m.delta === "=" ? "" : "is-flat"}`}>{m.delta === "=" ? "stable" : m.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ ACTEURS SUIVIS ═══════ */}
      {showActors && (
      <section className="vl-section">
        <div className="vl-section-head">
          <div>
            <div className="vl-section-kicker">Acteurs suivis</div>
            <h2 className="vl-section-title">{actors.filter(a => a.followed).length} {actorsLabel} dans ton radar</h2>
          </div>
          <span className="vl-section-hint" title="Les acteurs sont détectés automatiquement depuis le flux RSS des 30 derniers jours">
            Auto-détecté · top 12
          </span>
        </div>
        <div className="vl-actors-grid">
          {actors.map((a) => (
            <button
              key={a.id}
              className={`vl-actor-card ${a.followed ? "" : "is-unfollowed"}`}
              onClick={() => setActorFilter(actorFilter === a.name ? "all" : a.name)}
            >
              <div className="vl-actor-head">
                <ActorMark actor={a} size={32} />
                <div className="vl-actor-meta">
                  <div className="vl-actor-name">{a.name}</div>
                  <div className="vl-actor-momentum">{a.momentum}</div>
                </div>
                {a.followed && <span className="vl-actor-pin" title="Suivi"><Icon name="pin" size={11} stroke={2}/></span>}
              </div>
              <div className="vl-actor-last">
                <div className="vl-actor-last-time">{a.last_activity}</div>
                <div className="vl-actor-last-title">{a.last_title}</div>
              </div>
              <div className="vl-actor-foot">
                <PulseBars pulse={a.pulse} color={a.color} />
                <span className="vl-actor-foot-label">8 sem.</span>
              </div>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* ═══════ TENDANCES TRANSVERSES ═══════ */}
      <section className="vl-section">
        <div className="vl-section-head">
          <div>
            <div className="vl-section-kicker">Tendances transverses</div>
            <h2 className="vl-section-title">{showActors ? "Les sujets qui bougent, au-delà des gros acteurs" : "Les sujets qui bougent en ce moment"}</h2>
          </div>
          {trendFilter && (
            <button className="btn btn--ghost btn--sm" onClick={() => setTrendFilter(null)}>
              <Icon name="x" size={12} stroke={2}/> Effacer filtre tendance
            </button>
          )}
        </div>
        <div className="vl-trends-grid">
          {v.trends.map((t) => {
            const isActive = trendFilter === t.id;
            return (
              <button
                key={t.id}
                className={`vl-trend-card vl-trend-card--${t.status} ${isActive ? "is-active" : ""}`}
                onClick={() => setTrendFilter(isActive ? null : t.id)}
              >
                <div className="vl-trend-head">
                  <div>
                    <div className="vl-trend-kicker">{t.kicker}</div>
                    <h3 className="vl-trend-label">{t.label}</h3>
                  </div>
                  <span className={`vl-trend-status vl-trend-status--${t.status}`}>
                    {t.status === "new" && "nouveau"}
                    {t.status === "rising" && "↗"}
                    {t.status === "stable" && "≈"}
                    {t.status === "debated" && "⇄"}
                  </span>
                </div>
                <p className="vl-trend-summary">{t.summary}</p>
                <div className="vl-trend-foot">
                  <div className="vl-trend-pulse">
                    <PulseBars pulse={t.pulse} color="currentColor" />
                  </div>
                  <div className="vl-trend-stats">
                    <span className="vl-trend-momentum">{t.momentum}</span>
                    <span className="vl-trend-count">{t.articles_count} articles</span>
                  </div>
                </div>
                <div className="vl-trend-actors">
                  <span className="vl-trend-actors-label">Impliqués</span>
                  <div className="vl-trend-actors-list">
                    {t.actors_involved.slice(0, 4).map((a, i) => (
                      <span key={i} className="vl-trend-actor-chip">{a}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══════ FEED + FILTRES ═══════ */}
      <section className="vl-section">
        <div className="vl-section-head">
          <div>
            <div className="vl-section-kicker">Feed chronologique</div>
            <h2 className="vl-section-title">
              {filtered.length} actu{filtered.length > 1 ? "s" : ""}
              {actorFilter !== "all" && <span className="vl-section-title-sub"> · filtré sur {actorFilter}</span>}
              {typeFilter !== "Tous" && <span className="vl-section-title-sub"> · type {typeFilter}</span>}
              {trendFilter && <span className="vl-section-title-sub"> · tendance {v.trends.find(t => t.id === trendFilter)?.label}</span>}
            </h2>
          </div>
          <div className="vl-feed-actions">
            {unreadCount > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={markAllRead}>
                <Icon name="check" size={12} stroke={2}/> Tout marquer lu
              </button>
            )}
          </div>
        </div>

        <div className="vl-filters">
          <div className="vl-filter-group">
            <span className="vl-filter-label">{categoryLabel}</span>
            <div className="vl-filter-pills">
              {actorFilterPills.map((a) => (
                <button
                  key={a.id}
                  className={`vl-pill ${actorFilter === a.id ? "is-active" : ""}`}
                  onClick={() => setActorFilter(a.id)}
                  style={a.color && actorFilter === a.id ? { background: a.color, color: "white", borderColor: a.color } : {}}
                >
                  {a.color && <span className="vl-pill-dot" style={{ background: a.color }} />}
                  <span>{a.label}</span>
                  <span className="vl-pill-count">{a.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="vl-filter-group">
            <span className="vl-filter-label">{typeLabel}</span>
            <div className="vl-filter-pills">
              {availableTypes.map((t) => {
                const count = t === "Tous" ? v.feed.length : v.feed.filter(f => f.type === t).length;
                return (
                  <button
                    key={t}
                    className={`vl-pill ${typeFilter === t ? "is-active" : ""}`}
                    onClick={() => setTypeFilter(t)}
                  >
                    <span>{t}</span>
                    <span className="vl-pill-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="vl-filter-group">
            <span className="vl-filter-label">Période</span>
            <div className="vl-filter-pills">
              {VEILLE_PERIODS.map((p) => (
                <button
                  key={p.id}
                  className={`vl-pill ${period === p.id ? "is-active" : ""}`}
                  onClick={() => setPeriod(p.id)}
                >{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {(() => {
          if (filtered.length === 0) {
            return (
              <div className="vl-empty">
                <Icon name="eye" size={24} stroke={1.5}/>
                <div className="vl-empty-title">Aucune actu ne matche tes filtres</div>
                <button className="btn btn--ghost btn--sm" onClick={() => { setActorFilter("all"); setTypeFilter("Tous"); setPeriod("30j"); }}>Réinitialiser</button>
              </div>
            );
          }

          const renderItem = (f) => {
            const actor = actors.find(a => a.name === f.actor);
            const isRead = readState[f.id] === "read" || !f.unread;
            const openArticle = () => {
              if (!f.url) return;
              try {
                const rm = JSON.parse(localStorage.getItem("read-articles") || "{}");
                rm[f.id] = { ts: Date.now(), kept: !!rm[f.id]?.kept };
                localStorage.setItem("read-articles", JSON.stringify(rm));
              } catch {}
              markRead(f.id);
              window.open(f.url, "_blank", "noopener");
            };
            return (
              <article
                key={f.id}
                className={`vl-feed-item ${isRead ? "is-read" : "is-unread"} ${f.starred ? "is-starred" : ""}`}
                onClick={openArticle}
                style={f.url ? { cursor: "pointer" } : null}
              >
                <div className="vl-feed-rail">
                  {actor ? <ActorMark actor={actor} size={30}/> : <span className="vl-actor-mark vl-actor-mark--neutral" style={{ width: 30, height: 30, fontSize: 13 }}>{f.actor.slice(0,1)}</span>}
                  {!isRead && <span className="vl-feed-unread-dot" />}
                </div>
                <div className="vl-feed-body">
                  <div className="vl-feed-meta">
                    <span className="vl-feed-actor">{f.actor}</span>
                    <span className="vl-feed-sep">·</span>
                    <span className={`vl-feed-type vl-feed-type--${f.type.toLowerCase().replace(/\s/g,"-").replace(/é/g,"e")}`}>{f.type}</span>
                    <span className="vl-feed-sep">·</span>
                    <span className="vl-feed-date">{f.date_label}</span>
                    {f.starred && <span className="vl-feed-star" title="Épinglé"><Icon name="star" size={11} stroke={2}/></span>}
                  </div>
                  <h3 className="vl-feed-title">{f.title}</h3>
                  <p className="vl-feed-summary">{f.summary}</p>
                  <div className="vl-feed-tags">
                    {f.tags.map((t) => <span key={t} className="vl-tag">{t}</span>)}
                  </div>
                </div>
                <div className="vl-feed-actions-col" onClick={(e) => e.stopPropagation()}>
                  <button className="vl-iconbtn" title={isRead ? "Marquer non-lu" : "Marquer lu"} onClick={() => markRead(f.id)}>
                    <Icon name={isRead ? "envelope" : "check"} size={13} stroke={2}/>
                  </button>
                  <button className="vl-iconbtn" title="Archiver" onClick={() => archive(f.id)}>
                    <Icon name="archive" size={13} stroke={2}/>
                  </button>
                  <button className="vl-iconbtn" title="Ouvrir l'article" onClick={openArticle}>
                    <Icon name="arrow_right" size={13} stroke={2}/>
                  </button>
                </div>
              </article>
            );
          };

          // Flat mode: when user has filtered by type, no need to group.
          if (typeFilter !== "Tous") {
            return <div className="vl-feed">{filtered.map(renderItem)}</div>;
          }

          // Grouped mode: bucket by type, order by unread count desc then total desc.
          const buckets = {};
          filtered.forEach(f => {
            const k = f.type || "Autre";
            if (!buckets[k]) buckets[k] = [];
            buckets[k].push(f);
          });
          const groups = Object.entries(buckets).map(([type, items]) => ({
            type,
            items,
            unread: items.filter(f => f.unread && readState[f.id] !== "read").length,
          }));
          groups.sort((a, b) => b.unread - a.unread || b.items.length - a.items.length);

          return (
            <div className="vl-feed-groups">
              {groups.map((g, idx) => {
                const isExpanded = expandedGroups[g.type] === true;
                const visible = isExpanded ? g.items : g.items.slice(0, GROUP_PREVIEW);
                const extra = g.items.length - GROUP_PREVIEW;
                const typeSlug = g.type.toLowerCase().replace(/\s/g, "-").replace(/é/g, "e");
                return (
                  <details key={g.type} className="vl-feed-group" open={idx === 0}>
                    <summary className="vl-feed-group-summary">
                      <span className={`vl-feed-type vl-feed-type--${typeSlug} vl-feed-group-chip`}>{g.type}</span>
                      <span className="vl-feed-group-count">{g.items.length} actu{g.items.length > 1 ? "s" : ""}</span>
                      {g.unread > 0 && (
                        <span className="vl-feed-group-unread">{g.unread} non-lu{g.unread > 1 ? "s" : ""}</span>
                      )}
                      <span className="vl-feed-group-chevron" aria-hidden="true">
                        <Icon name="chevron_down" size={16} stroke={2}/>
                      </span>
                    </summary>
                    <div className="vl-feed vl-feed-group-body">
                      {visible.map(renderItem)}
                      {extra > 0 && (
                        <button
                          className="vl-feed-more-btn"
                          onClick={() => setExpandedGroups({ ...expandedGroups, [g.type]: !isExpanded })}
                        >
                          {isExpanded
                            ? <><Icon name="chevron_up" size={13} stroke={2}/> Replier à {GROUP_PREVIEW}</>
                            : <><Icon name="chevron_down" size={13} stroke={2}/> Voir les {extra} autres</>}
                        </button>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* ═══════ CAS PROD / SORTIES À VENIR ═══════ */}
      {prodSection && (
        prodTableMode
          ? <ProdTable prodSection={prodSection} items={v.prod_cases} />
          : (
            <section className="vl-section">
              <div className="vl-section-head">
                <div>
                  <div className="vl-section-kicker">{prodSection.kicker}</div>
                  <h2 className="vl-section-title">{prodSection.title}</h2>
                </div>
              </div>
              <div className="vl-prod-grid">
                {v.prod_cases.map((p) => (
                  <article key={p.company} className="vl-prod-card">
                    <div className="vl-prod-head">
                      <span className="vl-prod-logo" style={{ background: p.color }}>{p.logo_mark}</span>
                      <div>
                        <div className="vl-prod-company">{p.company}</div>
                        <div className="vl-prod-domain">{p.domain}</div>
                      </div>
                    </div>
                    <div className="vl-prod-scale">{p.scale}</div>
                    <p className="vl-prod-head-line">{p.headline}</p>
                    <div className="vl-prod-foot">
                      <span className="vl-prod-model">{p.model}</span>
                      <span className="vl-prod-impact">{p.impact}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
      )}

      {/* ═══════ TWEAK TONE TOGGLE ═══════ */}
      <div className="vl-tone-toggle" title="Ton éditorial">
        <button className={tone === "dawn" ? "is-active" : ""} onClick={() => setTone("dawn")}>Éditorial</button>
        <button className={tone === "dense" ? "is-active" : ""} onClick={() => setTone("dense")}>Dense</button>
      </div>
    </div>
  );
}

window.PanelVeille = PanelVeille;
