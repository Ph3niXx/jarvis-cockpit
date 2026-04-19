// ═══════════════════════════════════════════════════════════════
// PANEL JARVIS — La conversation unique
// ─────────────────────────────────────────────
// Structure : split 2/3 chat · 1/3 mémoire.
// Chat : conversation infinie (pas de threads), séparateurs
//        temporels, messages user + jarvis, citations cliquables,
//        composer sticky en bas avec quick prompts.
// Mémoire : "Ce que je sais de toi" — faits structurés éditables,
//           groupés par catégorie, avec source et strength.
// Ton de Jarvis : familier-direct, légèrement opinionated.
//                 Challenge quand tu répètes (flag "challenging").
// ═══════════════════════════════════════════════════════════════

const { useState: useStateJv, useEffect: useEffectJv, useMemo: useMemoJv, useRef: useRefJv } = React;

// ─── Icônes mini (local) ─────────────────────────────────
function JvIcon({ name, size = 14 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    mic:      <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></>,
    paperclip:<path d="M21.5 11 12 20.5a5.5 5.5 0 0 1-7.8-7.8l9.3-9.3a3.7 3.7 0 0 1 5.2 5.2L9.4 17.8a1.8 1.8 0 1 1-2.6-2.6L16 6"/>,
    send:     <path d="M4 12 22 4l-8 18-2-8-8-2Z"/>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    refresh:  <><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></>,
    pin:      <path d="M12 17v5M8 3h8l-1 6 3 3H6l3-3-1-6Z"/>,
    plus:     <><path d="M12 5v14M5 12h14"/></>,
    edit:     <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
    close:    <><path d="M18 6 6 18M6 6l12 12"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8L4.2 6A2 2 0 1 1 7 3.2l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></>,
    sparkle:  <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

// Parse very basic markdown (bold, italic, lists, paragraphs)
function formatText(text) {
  // Split by paragraphs
  const parts = text.split(/\n\n+/).map((block, bi) => {
    // Numbered list?
    if (/^\d+\.\s/m.test(block)) {
      const items = block.split(/\n/).filter(l => /^\d+\.\s/.test(l)).map((l, i) => {
        const m = l.replace(/^\d+\.\s/, "");
        return <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(m) }} />;
      });
      return <ol key={bi}>{items}</ol>;
    }
    // Bulleted?
    if (/^-\s/m.test(block)) {
      const items = block.split(/\n/).filter(l => /^-\s/.test(l)).map((l, i) => {
        const m = l.replace(/^-\s/, "");
        return <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(m) }} />;
      });
      return <ul key={bi}>{items}</ul>;
    }
    return <p key={bi} dangerouslySetInnerHTML={{ __html: inlineFormat(block) }} />;
  });
  return parts;
}
function inlineFormat(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}

// ─── Citations pill ──────────────────────────────────────
function JvCite({ cite, onNavigate }) {
  const TYPE_LABEL = {
    signal: "signal",
    article: "article",
    wiki: "wiki",
    idea: "idée",
    opp: "opportunité",
    brief: "brief",
  };
  const TARGET = {
    signal: "signals",
    article: "updates",
    wiki: "wiki",
    idea: "ideas",
    opp: "opps",
    brief: "brief",
  };
  return (
    <span className="jv-cite" onClick={() => onNavigate(TARGET[cite.kind])}>
      <span className="jv-cite-type">{TYPE_LABEL[cite.kind] || cite.kind}</span>
      <span>{cite.label}</span>
    </span>
  );
}

// ─── Message single ──────────────────────────────────────
function JvMessage({ m, onNavigate }) {
  if (m.kind === "stamp") {
    return (
      <div className="jv-stamp">
        <span className="jv-stamp-line" />
        <span className="jv-stamp-label">{m.label}</span>
        <span className="jv-stamp-line" />
      </div>
    );
  }
  const cls = [
    "jv-msg",
    `jv-msg--${m.kind}`,
    m.kind_aside && "jv-msg--aside",
    m.challenging && "jv-msg--challenging",
  ].filter(Boolean).join(" ");

  const avatar = m.kind === "user"
    ? "A"
    : <JvIcon name="sparkle" size={14} />;

  return (
    <div className={cls}>
      <span className="jv-avatar">{avatar}</span>
      <div>
        <div className="jv-bubble">{formatText(m.text)}</div>
        {m.cites && m.cites.length > 0 && (
          <div className="jv-cites">
            {m.cites.map((c, i) => <JvCite key={i} cite={c} onNavigate={onNavigate} />)}
          </div>
        )}
        {m.kind === "jarvis" && !m.kind_aside && (
          <div className="jv-meta">
            <span>Jarvis</span>
            <span className="jv-meta-actions">
              <button>Copier</button>
              <button>Régénérer</button>
              <button>Éditer mémoire</button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mémoire : un item ───────────────────────────────────
function JvMemItem({ item, onNavigate }) {
  const [expanded, setExpanded] = useStateJv(false);
  const strength = item.strength || "strong";
  return (
    <div className={`jv-mem-item ${item.pinned ? "is-pinned" : ""} ${expanded ? "is-expanded" : ""}`}
         onClick={() => setExpanded(e => !e)}>
      <div className="jv-mem-item-label">{item.label}</div>
      <div className="jv-mem-item-value">{item.value}</div>
      <div className="jv-mem-item-foot">
        <span>{item.source}</span>
        <span>·</span>
        <span>{item.learned}</span>
        <span style={{marginLeft:"auto"}} className={`jv-mem-item-strength jv-mem-item-strength--${strength}`}>
          <span className="jv-mem-item-strength-dot" />
          <span className="jv-mem-item-strength-dot" />
          <span className="jv-mem-item-strength-dot" />
        </span>
      </div>
      {expanded && item.editable && (
        <div className="jv-mem-expand" onClick={(e) => e.stopPropagation()}>
          <button><JvIcon name="edit" size={11} /> Éditer</button>
          <button><JvIcon name="pin" size={11} /> {item.pinned ? "Détacher" : "Épingler"}</button>
          <button className="is-danger"><JvIcon name="close" size={11} /> Oublier</button>
        </div>
      )}
    </div>
  );
}

// ─── Mémoire : colonne droite ─────────────────────────────
function JvMemory({ memory, onNavigate }) {
  const [activeFilter, setActiveFilter] = useStateJv("all");
  const categories = useMemoJv(() => {
    const order = ["profil", "préférences", "intérêts", "positions", "projets", "contraintes"];
    const grouped = {};
    memory.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    });
    return order.filter(c => grouped[c]).map(c => ({ id: c, items: grouped[c] }));
  }, [memory]);

  const filters = [
    { id: "all", label: "Tout", count: memory.length },
    { id: "pinned", label: "★ Épinglés", count: memory.filter(m => m.pinned).length },
    ...categories.map(c => ({ id: c.id, label: c.id, count: c.items.length })),
  ];

  const filteredCats = useMemoJv(() => {
    if (activeFilter === "all") return categories;
    if (activeFilter === "pinned") {
      const pinned = memory.filter(m => m.pinned);
      return pinned.length ? [{ id: "épinglés", items: pinned }] : [];
    }
    return categories.filter(c => c.id === activeFilter);
  }, [categories, activeFilter, memory]);

  return (
    <aside className="jv-memory">
      <div className="jv-mem-header">
        <div className="jv-mem-eyebrow">Mémoire</div>
        <h2 className="jv-mem-title">Ce que je sais <em>de toi</em></h2>
        <p className="jv-mem-sub">
          {memory.length} faits structurés. Tu peux éditer, épingler, ou me demander d'oublier.
        </p>
      </div>

      <div className="jv-mem-filters">
        {filters.map(f => (
          <button key={f.id}
            className={`jv-mem-filter ${activeFilter === f.id ? "is-active" : ""}`}
            onClick={() => setActiveFilter(f.id)}>
            {f.label}
            <span className="jv-mem-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="jv-mem-scroll">
        {filteredCats.map(cat => (
          <div key={cat.id}>
            <div className="jv-mem-group">
              <div className="jv-mem-group-label">
                <span>{cat.id}</span>
                <span className="jv-mem-group-count">{cat.items.length}</span>
              </div>
            </div>
            {cat.items.map(item => (
              <JvMemItem key={item.id} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </div>

      <div className="jv-mem-foot">
        <span>Dernière mise à jour · aujourd'hui</span>
        <button className="jv-mem-foot-link">Exporter tout</button>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PANEL
// ═══════════════════════════════════════════════════════════════
function PanelJarvis({ data, onNavigate }) {
  const JV = window.JARVIS_DATA;
  const [input, setInput] = useStateJv("");
  const scrollRef = useRefJv(null);
  const taRef = useRefJv(null);

  // Scroll to bottom on mount
  useEffectJv(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Auto-resize textarea
  useEffectJv(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 240) + "px";
    }
  }, [input]);

  const handleNav = (panelId) => { if (onNavigate) onNavigate(panelId); };

  const handleSend = () => {
    if (!input.trim()) return;
    setInput("");
    // Demo only — we don't actually append to timeline
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="jv-wrap" data-screen-label="Jarvis">
      {/* ═════ CHAT COLUMN ═════════════════════════════ */}
      <div className="jv-chat">
        <header className="jv-header">
          <div className="jv-header-main">
            <div className="jv-header-eyebrow">En ligne · {JV.meta.last_active}</div>
            <h1 className="jv-header-title">
              Jarvis <em>·</em> ta conversation continue
            </h1>
            <div className="jv-header-meta">
              <span><strong>{JV.meta.total_messages.toLocaleString("fr-FR")}</strong> messages</span>
              <span><strong>{JV.meta.total_hours} h</strong> ensemble</span>
              <span>Depuis {new Date(JV.meta.first_conversation).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
              <span>Aujourd'hui · <strong>{JV.stats.cost_today_eur.toFixed(2)} €</strong> / {JV.stats.cost_budget_eur.toFixed(0)} €</span>
            </div>
          </div>
          <div className="jv-header-actions">
            <button className="jv-iconbtn" title="Rechercher"><JvIcon name="search" /></button>
            <button className="jv-iconbtn" title="Paramètres"><JvIcon name="settings" /></button>
          </div>
        </header>

        <div className="jv-scroll" ref={scrollRef}>
          <div className="jv-feed">
            {JV.messages.map((m, i) => (
              <JvMessage key={i} m={m} onNavigate={handleNav} />
            ))}
          </div>
        </div>

        <div className="jv-composer-wrap">
          <div className="jv-composer-inner">
            <div className="jv-prompts">
              {JV.quick_prompts.map((p, i) => (
                <button key={i} className="jv-prompt" onClick={() => setInput(p + " ")}>
                  {p}
                </button>
              ))}
            </div>
            <div className="jv-composer">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Réponds à Jarvis, ou pose ta question…"
                rows={1}
              />
              <div className="jv-composer-actions">
                <button className="jv-iconbtn" title="Joindre un fichier"><JvIcon name="paperclip" /></button>
                <button className="jv-iconbtn" title="Dicter"><JvIcon name="mic" /></button>
                <button className="jv-send" disabled={!input.trim()} onClick={handleSend} title="Envoyer">
                  <JvIcon name="send" size={15} />
                </button>
              </div>
            </div>
            <div className="jv-composer-foot">
              <span><span className="jv-kbd">⏎</span> envoyer · <span className="jv-kbd">⇧⏎</span> nouvelle ligne</span>
              <span>Claude Sonnet 4.5 · mémoire activée</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═════ MEMORY COLUMN ═══════════════════════════ */}
      <JvMemory memory={JV.memory} onNavigate={handleNav} />
    </div>
  );
}

window.PanelJarvis = PanelJarvis;
