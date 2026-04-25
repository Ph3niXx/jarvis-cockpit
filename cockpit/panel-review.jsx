// Panel "Revue" — flow unread-first séquentiel
function PanelReview({ data, onNavigate }) {
  const allArticles = (data.top || []).concat(data.week?.items || []);
  const readMap = (() => {
    try { return JSON.parse(localStorage.getItem("read-articles") || "{}"); } catch { return {}; }
  })();
  const queue = React.useMemo(
    () => allArticles.filter(a => {
      const id = a._id || a.id;
      return id && !readMap[id];
    }),
    []
  );
  const [idx, setIdx] = React.useState(0);
  const current = queue[idx];
  const markReadAndAdvance = (action) => {
    const id = current && (current._id || current.id);
    if (id) {
      try {
        const rm = JSON.parse(localStorage.getItem("read-articles") || "{}");
        rm[id] = { ts: Date.now(), action };
        localStorage.setItem("read-articles", JSON.stringify(rm));
        if (window.track) window.track("review_action", { action, id });
      } catch {}
    }
    setIdx(i => i + 1);
  };
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") { e.preventDefault(); markReadAndAdvance("skip"); }
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); markReadAndAdvance("save"); }
      if (e.key.toLowerCase() === "i") { e.preventDefault(); onNavigate("ideas"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]);

  if (!queue.length) {
    return (
      <div className="review-empty">
        <div className="review-empty-eyebrow">Revue · terminée</div>
        <h2 className="review-empty-title">Ta pile est vide.</h2>
        <p className="review-empty-body">Rien à traiter pour l'instant. Repasse demain.</p>
        <button className="btn btn--ghost" onClick={() => onNavigate("brief")}>Retour au brief</button>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="review-empty">
        <div className="review-empty-eyebrow">Revue · terminée</div>
        <h2 className="review-empty-title">Tu as traité les {queue.length} articles.</h2>
        <p className="review-empty-body">Bien joué. Rien n'attend plus ton attention ce matin.</p>
        <button className="btn btn--primary" onClick={() => onNavigate("brief")}>Retour au brief</button>
      </div>
    );
  }
  return (
    <div className="review">
      <header className="review-head">
        <div className="review-progress">
          <span className="review-progress-num">{idx + 1}</span>
          <span className="review-progress-sep">/</span>
          <span className="review-progress-tot">{queue.length}</span>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => onNavigate("brief")}>Quitter</button>
      </header>
      <article className="review-article">
        <div className="review-meta">
          <span className="review-source">{current.source}</span>
          <span className="review-section">{current.section}</span>
          <span className="review-date">{current.date}</span>
        </div>
        <h1 className="review-title">{current.title}</h1>
        <p className="review-summary">{current.summary}</p>
        {current._url || current.url ? (
          <a className="review-open" href={current._url || current.url} target="_blank" rel="noopener">
            Ouvrir l'article ↗
          </a>
        ) : null}
      </article>
      <footer className="review-actions">
        <button className="review-action" onClick={() => markReadAndAdvance("skip")}>
          <span className="review-action-label">Passer</span>
          <span className="review-action-key">K / →</span>
        </button>
        <button className="review-action" onClick={() => markReadAndAdvance("save")}>
          <span className="review-action-label">Garder</span>
          <span className="review-action-key">S</span>
        </button>
        <button className="review-action" onClick={() => { onNavigate("ideas"); }}>
          <span className="review-action-label">→ Idée</span>
          <span className="review-action-key">I</span>
        </button>
      </footer>
    </div>
  );
}
window.PanelReview = PanelReview;
