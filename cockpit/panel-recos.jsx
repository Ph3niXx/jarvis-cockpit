// Panel : Apprentissage → Recommandations
// Deux variantes : "flux" (éditorial priorisé) et "constellation" (metaphore visuelle)
const { useState: useStateReco, useMemo: useMemoReco, useEffect: useEffectReco } = React;

function isoWeekReco(d){
  const t = new Date(d);
  t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
}

async function patchRecoCompleted(id, completed){
  if (!window.sb || !window.SUPABASE_URL) return;
  const body = completed
    ? { completed: true, completed_at: new Date().toISOString() }
    : { completed: false, completed_at: null };
  const url = `${window.SUPABASE_URL}/rest/v1/learning_recommendations?id=eq.${encodeURIComponent(id)}`;
  const r = await window.sb.patchJSON(url, body);
  if (!r.ok) throw new Error("patch " + r.status);
  try { window.track && window.track("reco_completed_toggled", { id, completed }); } catch {}
}

function PanelRecos({ data, onNavigate }) {
  const a = window.APPRENTISSAGE_DATA;
  const recos = a.recos;
  const axes = a.radar.axes;

  const [levelFilter, setLevelFilter] = useStateReco("Tous");
  const [axisFilter, setAxisFilter] = useStateReco(null);
  const [timeFilter, setTimeFilter] = useStateReco("all");
  const [hideDone, setHideDone] = useStateReco(false);

  // Consume axis prefill stashed by panel-radar's "Voir recos" CTA.
  useEffectReco(() => {
    try {
      const axis = localStorage.getItem("recos-prefill-axis");
      if (axis) {
        localStorage.removeItem("recos-prefill-axis");
        setAxisFilter(axis);
      }
    } catch {}
  }, []);
  // id -> true | false (instant optimistic override of r.completed / r.unread)
  const [completedOverrides, setCompletedOverrides] = useStateReco({});
  const [pendingIds, setPendingIds] = useStateReco({});

  const isCompleted = (r) => {
    const o = completedOverrides[r.id];
    if (o !== undefined) return o;
    return !r.unread;
  };

  const toggleCompleted = async (r) => {
    if (pendingIds[r.id]) return;
    const next = !isCompleted(r);
    setPendingIds(p => ({ ...p, [r.id]: true }));
    setCompletedOverrides(o => ({ ...o, [r.id]: next }));
    try {
      await patchRecoCompleted(r.id, next);
    } catch (e) {
      console.error("[reco] patch failed", e);
      // Rollback optimistic update
      setCompletedOverrides(o => {
        const n = { ...o }; delete n[r.id]; return n;
      });
      alert("Impossible de sauvegarder. Réessaie dans un instant.");
    } finally {
      setPendingIds(p => {
        const n = { ...p }; delete n[r.id]; return n;
      });
    }
  };

  const levels = ["Tous", "Débutant", "Intermédiaire", "Avancé"];
  const timeBuckets = [
    { id: "all",    label: "Toute durée" },
    { id: "short",  label: "< 20 min",   max: 20 },
    { id: "medium", label: "20-60 min",  min: 20, max: 60 },
    { id: "long",   label: "> 1h",       min: 60 },
  ];

  const filtered = useMemoReco(() => {
    return recos.filter(r => {
      if (hideDone && isCompleted(r)) return false;
      if (levelFilter !== "Tous" && r.level !== levelFilter) return false;
      if (axisFilter && r.axis !== axisFilter) return false;
      if (timeFilter !== "all") {
        const t = timeBuckets.find(b => b.id === timeFilter);
        if (t.max !== undefined && r.duration_min > t.max) return false;
        if (t.min !== undefined && r.duration_min < t.min) return false;
      }
      return true;
    });
  }, [recos, levelFilter, axisFilter, timeFilter, hideDone, completedOverrides]);

  const musts = filtered.filter(r => r.priority === "must");
  const shoulds = filtered.filter(r => r.priority === "should");
  const nices = filtered.filter(r => r.priority === "nice");

  // Budget: sum over items NOT marked done (what's left to do).
  const remaining = filtered.filter(r => !isCompleted(r));
  const totalMin = remaining.reduce((s, r) => s + r.duration_min, 0);
  const totalH = Math.floor(totalMin / 60);
  const totalRestMin = totalMin % 60;
  const totalXP = remaining.reduce((s, r) => s + r.xp, 0);

  // Hero: dynamic week number + real counts (done vs left).
  const totalCount = recos.length;
  const doneCount = recos.filter(r => isCompleted(r)).length;
  const weekNum = String(isoWeekReco(new Date())).padStart(2, "0");

  return (
    <div className="panel-page" data-screen-label="Recommandations">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Apprentissage · Recommandations · S{weekNum}</div>
        <h1 className="panel-hero-title">
          Ce que <em className="serif-italic">tu devrais lire</em> cette semaine,<br/>
          trié pour ton niveau
        </h1>
        <p className="panel-hero-sub">
          Jarvis sélectionne chaque semaine <strong>{totalCount} lectures</strong> alignées sur ton radar compétences — {doneCount}/{totalCount} déjà faites. Priorité calculée sur ton écart au niveau cible, l'actualité et la pertinence métier.
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
        <button className={`pill ${hideDone ? "is-active" : ""}`} onClick={() => setHideDone(v => !v)}>
          <Icon name="check" size={11} stroke={2} /> Masquer les faits
        </button>
        <div className="panel-toolbar-divider" />
        <div className="reco-budget">
          <span className="reco-budget-val">{totalH}h{String(totalRestMin).padStart(2, '0')}</span>
          <span className="reco-budget-label">· {totalXP} XP · {remaining.length} à faire</span>
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────── */}
      <RecoFlux
        musts={musts}
        shoulds={shoulds}
        nices={nices}
        axes={axes}
        onAxis={setAxisFilter}
        axisFilter={axisFilter}
        isCompleted={isCompleted}
        onToggleCompleted={toggleCompleted}
        pendingIds={pendingIds}
        totalRecos={recos.length}
        anyFilterActive={levelFilter !== "Tous" || !!axisFilter || timeFilter !== "all" || hideDone}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// VARIANTE A : Flux priorisé (éditorial Dawn)
// ─────────────────────────────────────────────────────────
function RecoFlux({ musts, shoulds, nices, axes, onAxis, axisFilter, isCompleted, onToggleCompleted, pendingIds, totalRecos, anyFilterActive }) {
  const cardProps = { axes, isCompleted, onToggleCompleted, pendingIds };
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
        {musts.length + shoulds.length + nices.length === 0 && (
          <div className="reco-empty">
            {totalRecos === 0
              ? "Aucune reco générée cette semaine. Le pipeline hebdomadaire tourne chaque dimanche soir (22h UTC)."
              : anyFilterActive
                ? "Aucune reco pour ces filtres — élargis le niveau, la durée ou l'axe."
                : "Toutes les recos sont marquées faites. Beau boulot."}
          </div>
        )}

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
              {musts.map(r => <RecoCardBig key={r.id} reco={r} {...cardProps} />)}
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
              {shoulds.map(r => <RecoCardMed key={r.id} reco={r} {...cardProps} />)}
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
              {nices.map(r => <RecoRow key={r.id} reco={r} {...cardProps} />)}
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
// Click anywhere on a card body = open the URL in a new tab AND mark
// the reco "fait" if it wasn't already. The individual "Marquer fait"
// button stays available for toggling back to "à faire".
function openAndMarkReco(r, isCompletedFn, onToggleCompleted){
  if (r && r.url) window.open(r.url, "_blank", "noopener");
  if (!isCompletedFn(r) && onToggleCompleted) onToggleCompleted(r);
}

function RecoCardBig({ reco: r, axes, isCompleted, onToggleCompleted, pendingIds }) {
  const ax = axes.find(a => a.id === r.axis);
  const done = isCompleted(r);
  const pending = !!pendingIds[r.id];
  return (
    <article
      className={`reco-big ${done ? "is-completed" : "is-unread"}`}
      onClick={() => openAndMarkReco(r, isCompleted, onToggleCompleted)}
      style={r.url ? { cursor: "pointer" } : null}
    >
      <div className="reco-big-head">
        <span className={`reco-type reco-type--${r.type}`}>
          <Icon name={TYPE_ICON[r.type] || "file_text"} size={11} stroke={1.75} /> {TYPE_LABEL[r.type] || (r.type ? r.type[0].toUpperCase() + r.type.slice(1) : "Ressource")}
        </span>
        <span className="reco-sep">·</span>
        <span className="reco-source">{r.source}</span>
        <span className="reco-sep">·</span>
        <span className="reco-duration"><Icon name="clock" size={11} stroke={1.75} /> {r.duration_min} min</span>
        {!done && <span className="reco-dot" />}
      </div>
      <h3 className="reco-big-title">{r.title}</h3>
      <blockquote className="reco-big-why">
        <span className="reco-big-why-mark">Pourquoi</span>
        <span className="reco-big-why-text">{r.why}</span>
      </blockquote>
      <div className="reco-big-meta" onClick={(e) => e.stopPropagation()}>
        <div className="reco-big-axis">
          <span className="reco-big-axis-label">{ax?.label}</span>
          <span className="reco-big-axis-score-wrap">
            <span className="reco-big-axis-score">{ax?.score}</span>
            <span className="reco-big-axis-arrow">→</span>
            <span className="reco-big-axis-target">{ax?.target}</span>
          </span>
        </div>
        <div className="reco-big-actions">
          <button
            className="btn btn--primary btn--sm"
            onClick={() => openAndMarkReco(r, isCompleted, onToggleCompleted)}
            disabled={!r.url}
          >
            <Icon name="arrow_right" size={12} stroke={2} /> Ouvrir
          </button>
          <button
            className={`btn btn--sm ${done ? "btn--primary" : "btn--ghost"}`}
            disabled={pending}
            onClick={() => onToggleCompleted(r)}
          >
            <Icon name="check" size={12} stroke={2} /> {done ? "Fait" : "Marquer fait"}
          </button>
          <span className="reco-big-xp">+{r.xp} XP</span>
        </div>
      </div>
    </article>
  );
}

function RecoCardMed({ reco: r, axes, isCompleted, onToggleCompleted, pendingIds }) {
  const ax = axes.find(a => a.id === r.axis);
  const done = isCompleted(r);
  const pending = !!pendingIds[r.id];
  const handleToggle = (e) => { e.stopPropagation(); onToggleCompleted(r); };
  return (
    <article
      className={`reco-med ${done ? "is-completed" : "is-unread"}`}
      onClick={() => openAndMarkReco(r, isCompleted, onToggleCompleted)}
      style={r.url ? { cursor: "pointer" } : null}
    >
      <div className="reco-med-head">
        <span className={`reco-type reco-type--${r.type}`}>
          <Icon name={TYPE_ICON[r.type] || "file_text"} size={11} stroke={1.75} /> {TYPE_LABEL[r.type] || (r.type ? r.type[0].toUpperCase() + r.type.slice(1) : "Ressource")}
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
        <span className="reco-med-foot-right">
          <button
            className={`reco-med-done ${done ? "is-done" : ""}`}
            disabled={pending}
            onClick={handleToggle}
            title={done ? "Marquer comme à faire" : "Marquer comme fait"}
          >
            <Icon name="check" size={12} stroke={2} /> {done ? "Fait" : "À faire"}
          </button>
          <span className="reco-med-xp">+{r.xp} XP</span>
        </span>
      </footer>
    </article>
  );
}

function RecoRow({ reco: r, isCompleted, onToggleCompleted, pendingIds }) {
  const done = isCompleted(r);
  const pending = !!pendingIds[r.id];
  const handleToggle = (e) => { e.stopPropagation(); onToggleCompleted(r); };
  return (
    <li
      className={`reco-row ${done ? "is-completed" : ""}`}
      onClick={() => openAndMarkReco(r, isCompleted, onToggleCompleted)}
      style={r.url ? { cursor: "pointer" } : null}
    >
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
      <button
        className={`reco-row-done ${done ? "is-done" : ""}`}
        disabled={pending}
        onClick={handleToggle}
        title={done ? "Marquer comme à faire" : "Marquer comme fait"}
      >
        <Icon name="check" size={12} stroke={2} />
      </button>
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
  guide: "book",
  book: "book",
  doc: "file_text",
  tutorial: "play",
  podcast: "play",
};
const TYPE_LABEL = {
  paper: "Paper",
  article: "Article",
  video: "Vidéo",
  course: "Cours",
  guide: "Guide",
  book: "Livre",
  doc: "Doc",
  tutorial: "Tuto",
  podcast: "Podcast",
};

window.PanelRecos = PanelRecos;
