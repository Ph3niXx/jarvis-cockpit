// Panel : Apprentissage → Recommandations
// Deux variantes : "flux" (éditorial priorisé) et "constellation" (metaphore visuelle)
const { useState: useStateReco, useMemo: useMemoReco } = React;

function PanelRecos({ data, onNavigate }) {
  const a = window.APPRENTISSAGE_DATA;
  const recos = a.recos;
  const axes = a.radar.axes;

  const [levelFilter, setLevelFilter] = useStateReco("Tous");
  const [axisFilter, setAxisFilter] = useStateReco(null);
  const [timeFilter, setTimeFilter] = useStateReco("all");

  const levels = ["Tous", "Débutant", "Intermédiaire", "Avancé"];
  const timeBuckets = [
    { id: "all", label: "Toute durée" },
    { id: "short", label: "< 20 min", max: 20 },
    { id: "medium", label: "20-60 min", min: 20, max: 60 },
    { id: "long", label: "> 1h", min: 60 },
  ];

  const filtered = useMemoReco(() => {
    return recos.filter(r => {
      if (levelFilter !== "Tous" && r.level !== levelFilter) return false;
      if (axisFilter && r.axis !== axisFilter) return false;
      if (timeFilter !== "all") {
        const t = timeBuckets.find(b => b.id === timeFilter);
        if (t.max && r.duration_min > t.max) return false;
        if (t.min && r.duration_min <= t.min) return false;
      }
      return true;
    });
  }, [recos, levelFilter, axisFilter, timeFilter]);

  const musts = filtered.filter(r => r.priority === "must");
  const shoulds = filtered.filter(r => r.priority === "should");
  const nices = filtered.filter(r => r.priority === "nice");

  // total time budget
  const totalMin = filtered.reduce((s, r) => s + r.duration_min, 0);
  const totalH = Math.floor(totalMin / 60);
  const totalRestMin = totalMin % 60;
  const totalXP = filtered.reduce((s, r) => s + r.xp, 0);

  return (
    <div className="panel-page" data-screen-label="Recommandations">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Apprentissage · Recommandations · S17</div>
        <h1 className="panel-hero-title">
          Ce que <em className="serif-italic">tu devrais lire</em> cette semaine,<br/>
          trié pour ton niveau
        </h1>
        <p className="panel-hero-sub">
          Jarvis sélectionne chaque jour <strong>{recos.length} lectures</strong> alignées sur ton radar compétences. Priorité calculée sur 3 axes : écart au niveau cible, actualité, et pertinence métier.
        </p>
      </div>

      {/* ── Barre d'outils ──────────────────────────────── */}
      <div className="panel-toolbar">
        <span className="panel-toolbar-label">Niveau</span>
        <div className="panel-toolbar-group">
          {levels.map(l => (
            <button key={l} className={`pill ${levelFilter === l ? "is-active" : ""}`} onClick={() => setLevelFilter(l)}>
              {l}
            </button>
          ))}
        </div>
        <div className="panel-toolbar-divider" />
        <span className="panel-toolbar-label">Durée</span>
        <div className="panel-toolbar-group">
          {timeBuckets.map(t => (
            <button key={t.id} className={`pill ${timeFilter === t.id ? "is-active" : ""}`} onClick={() => setTimeFilter(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="panel-toolbar-divider" />
        <div className="reco-budget">
          <span className="reco-budget-val">{totalH}h{String(totalRestMin).padStart(2, '0')}</span>
          <span className="reco-budget-label">· {totalXP} XP · {filtered.length} items</span>
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────── */}
      <RecoFlux musts={musts} shoulds={shoulds} nices={nices} axes={axes} onAxis={setAxisFilter} axisFilter={axisFilter} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VARIANTE A : Flux priorisé (éditorial Dawn)
// ─────────────────────────────────────────────────────────
function RecoFlux({ musts, shoulds, nices, axes, onAxis, axisFilter }) {
  return (
    <div className="reco-wrap reco-wrap--flux">
      {/* Sidebar axes */}
      <aside className="reco-aside">
        <div className="section-kicker">Par axe de compétence</div>
        <h3 className="reco-aside-title">Ton radar</h3>
        <ul className="reco-axis-list">
          <li>
            <button className={`reco-axis ${axisFilter === null ? "is-active" : ""}`} onClick={() => onAxis(null)}>
              <span className="reco-axis-label">Tous les axes</span>
            </button>
          </li>
          {axes.map(ax => (
            <li key={ax.id}>
              <button className={`reco-axis ${axisFilter === ax.id ? "is-active" : ""}`} onClick={() => onAxis(ax.id)}>
                <span className="reco-axis-label">{ax.label}</span>
                <span className="reco-axis-bar">
                  <span className="reco-axis-bar-fill" style={{ width: `${ax.score}%` }} />
                </span>
                <span className="reco-axis-score">{ax.score}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Colonne principale */}
      <div className="reco-main">
        {musts.length > 0 && (
          <section className="reco-section">
            <header className="reco-section-head">
              <div>
                <div className="section-kicker">Priorité 1</div>
                <h2 className="section-title"><em className="serif-italic">Ne passe pas</em> à côté</h2>
              </div>
              <span className="reco-section-meta">{musts.length} item{musts.length > 1 ? "s" : ""}</span>
            </header>
            <div className="reco-cards reco-cards--big">
              {musts.map(r => <RecoCardBig key={r.id} reco={r} axes={axes} />)}
            </div>
          </section>
        )}

        {shoulds.length > 0 && (
          <section className="reco-section">
            <header className="reco-section-head">
              <div>
                <div className="section-kicker">Priorité 2</div>
                <h2 className="section-title">Tu devrais <em className="serif-italic">creuser ça</em></h2>
              </div>
              <span className="reco-section-meta">{shoulds.length} items</span>
            </header>
            <div className="reco-cards reco-cards--med">
              {shoulds.map(r => <RecoCardMed key={r.id} reco={r} axes={axes} />)}
            </div>
          </section>
        )}

        {nices.length > 0 && (
          <section className="reco-section">
            <header className="reco-section-head">
              <div>
                <div className="section-kicker">Priorité 3</div>
                <h2 className="section-title">Si tu as <em className="serif-italic">du temps</em></h2>
              </div>
              <span className="reco-section-meta">{nices.length} items</span>
            </header>
            <ul className="reco-list">
              {nices.map(r => <RecoRow key={r.id} reco={r} />)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────
function RecoCardBig({ reco: r, axes }) {
  const ax = axes.find(a => a.id === r.axis);
  return (
    <article className={`reco-big ${r.unread ? "is-unread" : ""}`}>
      <div className="reco-big-head">
        <span className={`reco-type reco-type--${r.type}`}>
          <Icon name={TYPE_ICON[r.type] || "file_text"} size={11} stroke={1.75} /> {TYPE_LABEL[r.type]}
        </span>
        <span className="reco-sep">·</span>
        <span className="reco-source">{r.source}</span>
        <span className="reco-sep">·</span>
        <span className="reco-duration"><Icon name="clock" size={11} stroke={1.75} /> {r.duration_min} min</span>
        {r.unread && <span className="reco-dot" />}
      </div>
      <h3 className="reco-big-title">{r.title}</h3>
      <blockquote className="reco-big-why">
        <span className="reco-big-why-mark">Pourquoi</span>
        <span className="reco-big-why-text">{r.why}</span>
      </blockquote>
      <div className="reco-big-meta">
        <div className="reco-big-axis">
          <span className="reco-big-axis-label">{ax?.label}</span>
          <span className="reco-big-axis-score-wrap">
            <span className="reco-big-axis-score">{ax?.score}</span>
            <span className="reco-big-axis-arrow">→</span>
            <span className="reco-big-axis-target">{ax?.target}</span>
          </span>
        </div>
        <div className="reco-big-actions">
          <button className="btn btn--primary btn--sm">
            <Icon name="arrow_right" size={12} stroke={2} /> Ouvrir
          </button>
          <button className="btn btn--ghost btn--sm">
            <Icon name="bookmark" size={12} stroke={1.75} /> Garder
          </button>
          <span className="reco-big-xp">+{r.xp} XP</span>
        </div>
      </div>
    </article>
  );
}

function RecoCardMed({ reco: r, axes }) {
  const ax = axes.find(a => a.id === r.axis);
  return (
    <article className={`reco-med ${r.unread ? "is-unread" : ""}`}>
      <div className="reco-med-head">
        <span className={`reco-type reco-type--${r.type}`}>
          <Icon name={TYPE_ICON[r.type] || "file_text"} size={11} stroke={1.75} /> {TYPE_LABEL[r.type]}
        </span>
        <span className="reco-sep">·</span>
        <span className="reco-source">{r.source}</span>
        <span className="reco-sep">·</span>
        <span className="reco-duration">{r.duration_min} min</span>
      </div>
      <h3 className="reco-med-title">{r.title}</h3>
      <p className="reco-med-why"><span className="reco-med-why-mark">→</span> {r.why_short}</p>
      <footer className="reco-med-foot">
        <span className="reco-med-axis">{ax?.label} · <strong>{ax?.score}</strong>/100</span>
        <span className="reco-med-xp">+{r.xp} XP</span>
      </footer>
    </article>
  );
}

function RecoRow({ reco: r }) {
  return (
    <li className="reco-row">
      <span className={`reco-type reco-type--${r.type}`}>
        <Icon name={TYPE_ICON[r.type] || "file_text"} size={11} stroke={1.75} />
      </span>
      <div className="reco-row-main">
        <h4 className="reco-row-title">{r.title}</h4>
        <div className="reco-row-meta">
          <span>{r.source}</span>
          <span className="reco-sep">·</span>
          <span>{r.duration_min} min</span>
          <span className="reco-sep">·</span>
          <span>{r.axis_label}</span>
        </div>
      </div>
      <span className="reco-row-xp">+{r.xp} XP</span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const TYPE_ICON = {
  paper: "book",
  article: "file_text",
  video: "play",
  course: "target",
};
const TYPE_LABEL = {
  paper: "Paper",
  article: "Article",
  video: "Vidéo",
  course: "Cours",
};

window.PanelRecos = PanelRecos;
