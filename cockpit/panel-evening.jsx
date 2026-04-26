// Panel "Miroir du soir" — récap réflexif 19h sur l'usage du cockpit du jour.
// Lit la table daily_mirror (1 ligne par jour, écrite par la routine Cowork).
// Best-effort : si pas de ligne pour aujourd'hui, on affiche l'état d'attente.
function PanelEvening({ data, onNavigate }) {
  const [mirror, setMirror] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const rows = await window.sb.query(
          "daily_mirror",
          `mirror_date=eq.${today}&select=mirror_date,summary_html,stats,generated_at&limit=1`
        );
        if (cancelled) return;
        if (Array.isArray(rows) && rows[0]) setMirror(rows[0]);
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="evening evening--loading">
        <div className="evening-eyebrow">Miroir du soir</div>
        <p className="evening-loading-text">Chargement…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="evening evening--empty">
        <div className="evening-eyebrow">Miroir du soir · erreur</div>
        <h1 className="evening-title">Le miroir n'a pas pu se charger</h1>
        <p className="evening-body-text">
          Vérifie ta connexion ou ton authentification, puis recharge la page.
        </p>
        <div className="evening-foot">
          <button className="btn btn--ghost" onClick={() => onNavigate("brief")}>← Brief</button>
        </div>
      </div>
    );
  }

  if (!mirror) {
    const now = new Date();
    const beforeMirror = now.getHours() < 19;
    return (
      <div className="evening evening--empty">
        <div className="evening-eyebrow">Miroir du soir · en attente</div>
        <h1 className="evening-title">Pas encore de miroir aujourd'hui</h1>
        <p className="evening-body-text">
          {beforeMirror
            ? "Le récap quotidien est généré chaque jour à 19h. Reviens après."
            : "La routine n'a pas encore tourné — soit elle est en retard, soit elle a sauté ce soir. Reviens dans un moment."}
        </p>
        <div className="evening-foot">
          <button className="btn btn--ghost" onClick={() => onNavigate("brief")}>← Brief</button>
          <button className="btn btn--ghost" onClick={() => onNavigate("jarvis")}>Demander à Jarvis</button>
        </div>
      </div>
    );
  }

  const safe = window.DOMPurify
    ? window.DOMPurify.sanitize(mirror.summary_html || "", {
        ALLOWED_TAGS: ["p", "strong", "em", "br"],
        ALLOWED_ATTR: [],
      })
    : (mirror.summary_html || "");

  const dateLabel = formatDateLong(mirror.mirror_date);
  const generatedLabel = formatGeneratedAt(mirror.generated_at);

  return (
    <div className="evening">
      <header className="evening-head">
        <div className="evening-eyebrow">{dateLabel} · 19:00</div>
        <h1 className="evening-title">Miroir du soir</h1>
        {generatedLabel && (
          <p className="evening-sub">Généré à {generatedLabel}</p>
        )}
      </header>
      <div
        className="evening-body"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
      <footer className="evening-foot">
        <button className="btn btn--ghost" onClick={() => onNavigate("brief")}>← Brief du matin</button>
        <button className="btn btn--ghost" onClick={() => onNavigate("jarvis")}>Demander à Jarvis</button>
      </footer>
    </div>
  );
}

function formatDateLong(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

function formatGeneratedAt(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

window.PanelEvening = PanelEvening;
