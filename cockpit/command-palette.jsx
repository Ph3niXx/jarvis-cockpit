// Command Palette — Ctrl+K modal qui unifie navigation, recherche, Jarvis, idées
function CommandPalette({ open, onClose, data, onNavigate }) {
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef(null);
  const NAV = (data.nav || []).flatMap(g => g.items.map(it => ({ ...it, group: g.group })));
  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current && inputRef.current.focus(), 20);
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;
  const q = query.trim().toLowerCase();
  const navMatches = !q ? NAV.slice(0, 6) : NAV.filter(it => it.label.toLowerCase().includes(q)).slice(0, 6);
  const articleMatches = !q
    ? []
    : (data.top || []).filter(a => (a.title || "").toLowerCase().includes(q)).slice(0, 4);
  const jarvisSuggest = q ? [
    { label: `Demande à Jarvis : "${query}"`, action: () => { try { localStorage.setItem("jarvis-prefill", query); } catch {} onNavigate("jarvis"); } },
    { label: `Résume-moi "${query}"`, action: () => { try { localStorage.setItem("jarvis-prefill", "Résume-moi " + query); } catch {} onNavigate("jarvis"); } },
  ] : [];
  const createIdea = q ? [{ label: `Créer une idée : "${query}"`, action: () => { try { localStorage.setItem("ideas-prefill", query); } catch {} onNavigate("ideas"); } }] : [];

  const allSections = [
    { title: "Navigation", items: navMatches.map(it => ({ label: it.label, hint: it.group, action: () => onNavigate(it.id) })) },
    { title: "Articles",   items: articleMatches.map(a => ({ label: a.title, hint: a.source, action: () => { const url = a._url || a.url; if (url) window.open(url, "_blank", "noopener"); } })) },
    { title: "Jarvis",     items: jarvisSuggest },
    { title: "Carnet",     items: createIdea },
  ].filter(s => s.items.length);

  const flat = allSections.flatMap(s => s.items);

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key === "Enter") { e.preventDefault(); if (flat[0]) flat[0].action(); onClose(); }
  };

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Palette de commandes">
        <input
          ref={inputRef}
          className="cp-input"
          placeholder="Chercher, naviguer, demander à Jarvis…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="cp-body">
          {allSections.map(s => (
            <div key={s.title} className="cp-section">
              <div className="cp-section-title">{s.title}</div>
              <ul className="cp-list">
                {s.items.map((it, i) => (
                  <li key={i}>
                    <button className="cp-item" onClick={() => { it.action(); onClose(); }}>
                      <span className="cp-item-label">{it.label}</span>
                      {it.hint && <span className="cp-item-hint">{it.hint}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="cp-foot">
          <kbd>Enter</kbd> pour ouvrir <span className="cp-foot-sep">·</span> <kbd>Esc</kbd> pour fermer
        </div>
      </div>
    </div>
  );
}
window.CommandPalette = CommandPalette;
