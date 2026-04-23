// ═══════════════════════════════════════════════════════════════
// Ticket — objet éditable réutilisable
// ─────────────────────────────────────────────
// Shape minimale : { title, description, labels }.
// Évolutif : ajoute des champs via `extraFields` (ex. deadline, priority)
// sans toucher aux consommateurs existants.
//
// Usage typique :
//   <TicketModal
//     open={open}
//     mode="edit" | "create"
//     initial={{title, description, labels}}
//     onSave={async (ticket) => { /* POST / PATCH */ }}
//     onCancel={() => setOpen(false)}
//     title="Modifier l'idée"
//     labelSuggestions={["jarvis","assurance",...]}
//   />
// ═══════════════════════════════════════════════════════════════

// Shape "canonique" utilisée par TicketModal.
// Les helpers ci-dessous garantissent la rétro-compat si on ajoute
// un champ plus tard (ex. priority, due_at) : les tickets sans ce
// champ reçoivent une valeur par défaut.
const EMPTY_TICKET = Object.freeze({ title: "", description: "", labels: [] });

function cloneTicket(t) {
  const src = t || EMPTY_TICKET;
  return {
    title: String(src.title || ""),
    description: String(src.description || ""),
    labels: Array.isArray(src.labels) ? [...src.labels] : [],
  };
}

// Normalise un libellé tag-style. Cohérent avec panel-ideas.jsx::normalizeLabel.
function ticketNormalizeLabel(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^#+/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function ticketLabelTint(label) {
  let h = 0;
  const s = String(label || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

// Petit chip de label — simple, sans dépendre de panel-ideas.jsx.
function TicketLabelChip({ label, onRemove }) {
  const hue = ticketLabelTint(label);
  return (
    <span
      className="tk-lab-chip"
      style={{
        background: `hsl(${hue} 20% var(--lab-bg-l, 92%) / 0.35)`,
        borderColor: `hsl(${hue} 30% 65% / 0.4)`,
      }}
    >
      <span className="tk-lab-chip-dot" style={{ background: `hsl(${hue} 55% 50%)` }} />
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          className="tk-lab-chip-x"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Retirer ${label}`}
        >×</button>
      )}
    </span>
  );
}

function TicketModal({
  open,
  mode = "create",
  initial = null,
  title: headerTitle,
  hint,
  onSave,
  onCancel,
  labelSuggestions = [],
}) {
  const [ticket, setTicket] = React.useState(() => cloneTicket(initial));
  const [labelDraft, setLabelDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const titleRef = React.useRef(null);
  const panelRef = React.useRef(null);

  // Reset state when the modal (re)opens or the initial ticket changes.
  React.useEffect(() => {
    if (!open) return;
    setTicket(cloneTicket(initial));
    setLabelDraft("");
    setSaving(false);
    setError(null);
    const t = setTimeout(() => {
      if (titleRef.current) {
        titleRef.current.focus();
        if (!initial?.title) titleRef.current.select && titleRef.current.select();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [open, initial]);

  // Keyboard: Escape cancels, Ctrl+Enter saves.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel && onCancel();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        commit();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket, saving]);

  const filteredSuggestions = React.useMemo(() => {
    if (!labelDraft.trim()) return [];
    const q = ticketNormalizeLabel(labelDraft);
    if (!q) return [];
    return (labelSuggestions || [])
      .filter(l => l.startsWith(q) && !ticket.labels.includes(l))
      .slice(0, 6);
  }, [labelDraft, labelSuggestions, ticket.labels]);

  if (!open) return null;

  const addLabel = (raw) => {
    const n = ticketNormalizeLabel(raw);
    if (!n || ticket.labels.includes(n)) { setLabelDraft(""); return; }
    setTicket(t => ({ ...t, labels: [...t.labels, n] }));
    setLabelDraft("");
  };
  const removeLabel = (l) => {
    setTicket(t => ({ ...t, labels: t.labels.filter(x => x !== l) }));
  };

  const commit = async () => {
    if (saving) return;
    const trimmedTitle = ticket.title.trim();
    if (!trimmedTitle) {
      setError("Le titre est requis.");
      if (titleRef.current) titleRef.current.focus();
      return;
    }
    const draftPending = ticketNormalizeLabel(labelDraft);
    const finalLabels = draftPending && !ticket.labels.includes(draftPending)
      ? [...ticket.labels, draftPending]
      : ticket.labels;
    const payload = {
      title: trimmedTitle,
      description: ticket.description.trim(),
      labels: finalLabels,
    };
    setSaving(true);
    setError(null);
    try {
      await onSave(payload);
      // Parent closes the modal on success.
    } catch (e) {
      console.error(e);
      setError(e?.message || "Échec de la sauvegarde.");
      setSaving(false);
    }
  };

  return (
    <div className="tk-overlay" onClick={onCancel}>
      <div
        className="tk-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tk-title"
      >
        <div className="tk-head">
          <div className="tk-eyebrow">
            {mode === "edit" ? "Édition" : "Nouveau ticket"}
          </div>
          <h2 className="tk-title" id="tk-title">
            {headerTitle || (mode === "edit" ? "Modifier" : "Créer")}
          </h2>
          {hint && <p className="tk-hint">{hint}</p>}
        </div>

        <form
          className="tk-form"
          onSubmit={(e) => { e.preventDefault(); commit(); }}
        >
          <label className="tk-field">
            <span className="tk-label">Titre</span>
            <input
              ref={titleRef}
              className="tk-input tk-input--title"
              value={ticket.title}
              onChange={(e) => setTicket(t => ({ ...t, title: e.target.value }))}
              placeholder="Une phrase courte qui capture l'idée"
              maxLength={200}
              disabled={saving}
              required
            />
          </label>

          <label className="tk-field">
            <span className="tk-label">
              Description
              <span className="tk-label-hint">optionnelle — contexte, hypothèses, prochaine étape</span>
            </span>
            <textarea
              className="tk-textarea"
              value={ticket.description}
              onChange={(e) => setTicket(t => ({ ...t, description: e.target.value }))}
              placeholder="Dévéloppe ici si tu as le temps — sinon laisse vide."
              rows={6}
              disabled={saving}
            />
          </label>

          <div className="tk-field">
            <span className="tk-label">
              Libellés
              <span className="tk-label-hint">Entrée ou virgule pour ajouter · Retour arrière pour retirer</span>
            </span>
            <div className="tk-lab-editor">
              {ticket.labels.map(l => (
                <TicketLabelChip key={l} label={l} onRemove={() => removeLabel(l)} />
              ))}
              <input
                className="tk-lab-input"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addLabel(labelDraft); }
                  else if (e.key === "Tab" && labelDraft.trim()) { e.preventDefault(); addLabel(labelDraft); }
                  else if (e.key === "Backspace" && !labelDraft && ticket.labels.length) {
                    e.preventDefault();
                    removeLabel(ticket.labels[ticket.labels.length - 1]);
                  }
                }}
                placeholder={ticket.labels.length ? "+ libellé" : "ex. jarvis, apprentissage…"}
                disabled={saving}
              />
            </div>
            {filteredSuggestions.length > 0 && (
              <div className="tk-lab-suggest">
                {filteredSuggestions.map(l => (
                  <button
                    type="button"
                    key={l}
                    className="tk-lab-suggest-item"
                    onClick={() => addLabel(l)}
                  >{l}</button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="tk-error" role="alert">{error}</div>}

          <div className="tk-foot">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
              disabled={saving}
            >Annuler</button>
            <div className="tk-foot-hint">
              <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> enregistre · <kbd>Échap</kbd> annule
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !ticket.title.trim()}
            >
              {saving ? "Enregistre…" : (mode === "edit" ? "Enregistrer" : "Créer")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Exposé globalement pour les autres scripts Babel-standalone.
window.TicketModal = TicketModal;
window.EMPTY_TICKET = EMPTY_TICKET;
window.ticketNormalizeLabel = ticketNormalizeLabel;
