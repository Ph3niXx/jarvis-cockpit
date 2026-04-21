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
function JvMessage({ m, onNavigate, onCopy, onRegenerate, canRegenerate }) {
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
            <span>Jarvis{m.mode ? ` · ${m.mode}` : ""}</span>
            <span className="jv-meta-actions">
              <button onClick={() => onCopy && onCopy(m.text)}>Copier</button>
              {canRegenerate && (
                <button onClick={() => onRegenerate && onRegenerate()}>Régénérer</button>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mémoire : un item ───────────────────────────────────
function JvMemItem({ item, onNavigate, onPin, onForget, pending }) {
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
          <button
            onClick={() => onPin && onPin(item)}
            disabled={pending}
          >
            <JvIcon name="pin" size={11} /> {item.pinned ? "Détacher" : "Épingler"}
          </button>
          <button
            className="is-danger"
            onClick={() => onForget && onForget(item)}
            disabled={pending}
          >
            <JvIcon name="close" size={11} /> Oublier
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mémoire : colonne droite ─────────────────────────────
function JvMemory({ memory, onNavigate, onPin, onForget, pendingIds }) {
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
              <JvMemItem
                key={item.id}
                item={item}
                onNavigate={onNavigate}
                onPin={onPin}
                onForget={onForget}
                pending={!!pendingIds?.[item.id]}
              />
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
const JV_MODE_LABELS = {
  quick: "Rapide (LLM local · sans RAG)",
  deep:  "Deep (LLM local · RAG)",
  cloud: "Cloud (Claude Haiku · RAG)",
};

function PanelJarvis({ data, onNavigate }) {
  const JV = window.JARVIS_DATA || {
    meta: { first_conversation: null, total_messages: 0, total_hours: 0, last_active: "—" },
    memory: [], messages: [], quick_prompts: [],
    stats: { messages_today: 0, messages_week: 0, memory_items: 0, memory_pinned: 0, cost_today_eur: 0, cost_budget_eur: 3 },
  };
  const [input, setInput] = useStateJv(() => {
    try {
      const stash = localStorage.getItem("jarvis-prefill-input");
      if (stash) {
        localStorage.removeItem("jarvis-prefill-input");
        return stash;
      }
    } catch {}
    return "";
  });
  const [messages, setMessages] = useStateJv(() => JV.messages.slice());
  const [memory, setMemory] = useStateJv(() => JV.memory.slice());
  const [sending, setSending] = useStateJv(false);
  const [pendingFacts, setPendingFacts] = useStateJv({});
  const [mode, setMode] = useStateJv(() => {
    try { return localStorage.getItem("jarvis-mode") || "quick"; } catch { return "quick"; }
  });
  const scrollRef = useRefJv(null);
  const taRef = useRefJv(null);

  // Scroll to bottom on mount + after each new message
  useEffectJv(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Auto-resize textarea
  useEffectJv(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 240) + "px";
    }
  }, [input]);

  useEffectJv(() => { try { localStorage.setItem("jarvis-mode", mode); } catch {} }, [mode]);

  const handleNav = (panelId) => { if (onNavigate) onNavigate(panelId); };

  // ── Jarvis gateway (localhost:8765 OR cloudflared tunnel) ───
  // On HTTP pages we can hit localhost directly. On HTTPS pages the
  // browser blocks mixed content, so we have to use the HTTPS tunnel
  // stored in user_profile.jarvis_tunnel_url. We try every candidate
  // in order and report which one failed if none works.
  function jarvisGatewayCandidates(){
    const list = [];
    const isHTTPS = typeof location !== "undefined" && location.protocol === "https:";
    let tunnel = null;
    try {
      const pf = window.PROFILE_DATA?._values || {};
      tunnel = pf.jarvis_tunnel_url || null;
    } catch {}
    if (!isHTTPS) list.push("http://localhost:8765");
    if (tunnel) list.push(tunnel.replace(/\/+$/, ""));
    // Final attempt on HTTPS pages — will fail with mixed-content, but
    // the error message makes the cause obvious.
    if (isHTTPS) list.push("http://localhost:8765");
    return list;
  }

  // Local LLM cold-starts can take 20-40s, RAG + Claude Haiku up to 60s.
  // We give each candidate 120s before giving up.
  const JV_TIMEOUT_MS = 120000;

  async function callJarvis(base, text){
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), JV_TIMEOUT_MS) : null;
    try {
      const resp = await fetch(base + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, mode, session_id: "cockpit", history: [] }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return await resp.json();
    } catch (e) {
      // Translate common AbortError signatures into a readable label
      if (e && (e.name === "AbortError" || /aborted/i.test(String(e.message)))) {
        throw new Error(`timeout après ${Math.round(JV_TIMEOUT_MS / 1000)}s — LLM trop lent ou gateway coincée`);
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    const userMsg = { kind: "user", text, ts: Date.now() };
    setMessages(prev => prev.concat([userMsg]));
    try { window.track && window.track("pipeline_triggered", { pipeline: "jarvis", mode }); } catch {}

    const candidates = jarvisGatewayCandidates();
    const failures = [];
    let data = null;
    for (const base of candidates) {
      try {
        data = await callJarvis(base, text);
        break; // success
      } catch (e) {
        const label = base.replace(/^https?:\/\//, "");
        failures.push(`${label} → ${e.message || String(e).slice(0, 60)}`);
      }
    }

    if (data) {
      const answer = data?.answer || data?.response || data?.message || "—";
      // Server returns { source_table, source_id, similarity, chunk_preview }.
      // Map the physical table name to the short citation kind JvCite expects.
      const SOURCE_KIND = {
        articles: "article",
        wiki_concepts: "wiki",
        weekly_opportunities: "opp",
        business_ideas: "idea",
        rte_usecases: "article",
        user_profile: "profile",
      };
      const cites = (data?.sources || []).map(s => ({
        kind: SOURCE_KIND[s.source_table] || "article",
        label: (s.chunk_preview || s.chunk_text || s.name || "source").slice(0, 80),
      }));
      setMessages(prev => prev.concat([{
        kind: "jarvis",
        text: answer,
        cites,
        ts: Date.now(),
        mode: data?.backend || mode,
      }]));
    } else {
      const isHTTPS = location.protocol === "https:";
      const tunnelSet = !!(window.PROFILE_DATA?._values?.jarvis_tunnel_url);
      const hint = isHTTPS && !tunnelSet
        ? "Tu es sur un cockpit HTTPS mais `jarvis_tunnel_url` n'est pas défini dans user_profile. Lance `start_jarvis.bat` sur ton PC (il démarre LM Studio + le tunnel Cloudflare et sauve l'URL)."
        : isHTTPS
        ? "Le tunnel enregistré ne répond pas. Probablement expiré — relance `start_jarvis.bat` pour générer une nouvelle URL."
        : "Le serveur Jarvis local ne répond pas sur `http://localhost:8765`. Lance `start_jarvis.bat`.";
      const errorMsg = `**Jarvis est hors ligne.**\n\n${hint}\n\n_Tentatives :_\n${failures.map(f => `- ${f}`).join("\n")}`;
      setMessages(prev => prev.concat([{
        kind: "jarvis",
        text: errorMsg,
        ts: Date.now(),
      }]));
      try { window.track && window.track("error_shown", { context: "jarvis:gateway", message: failures.join(" | ").slice(0, 200) }); } catch {}
    }

    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Message actions ─────────────────────────────────────
  const handleCopy = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for file:// or non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
      }
    } catch (e) { console.warn("[jarvis] copy failed", e); }
  };

  const handleRegenerate = async () => {
    // Resend the most recent user message as a new turn
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "user" && typeof m.text === "string") {
        setInput(m.text);
        // Defer send so React commits the input change first
        setTimeout(() => { handleSend(); }, 0);
        return;
      }
    }
  };

  // ── Memory actions (pin = local, forget = soft-delete via superseded_by)
  const handlePin = (item) => {
    setMemory(prev => prev.map(m => m.id === item.id ? { ...m, pinned: !m.pinned } : m));
    try {
      const raw = localStorage.getItem("jarvis-fact-pinned") || "{}";
      const map = JSON.parse(raw);
      if (map[item.id]) delete map[item.id]; else map[item.id] = true;
      localStorage.setItem("jarvis-fact-pinned", JSON.stringify(map));
    } catch {}
    // Keep the global in sync so a re-render from somewhere else still
    // sees the new pinned state.
    if (window.JARVIS_DATA) {
      window.JARVIS_DATA.memory = window.JARVIS_DATA.memory.map(
        m => m.id === item.id ? { ...m, pinned: !m.pinned } : m
      );
    }
  };

  const handleForget = async (item) => {
    if (!window.sb || !window.SUPABASE_URL) return;
    if (!confirm(`Oublier ce fait ?\n\n"${item.value}"`)) return;
    setPendingFacts(p => ({ ...p, [item.id]: true }));
    // Optimistic remove
    const prevMem = memory;
    setMemory(prev => prev.filter(m => m.id !== item.id));
    try {
      const url = `${window.SUPABASE_URL}/rest/v1/profile_facts?id=eq.${encodeURIComponent(item.id)}`;
      // Soft-delete: superseded_by pointing to itself so nightly_learner
      // treats it as obsolete without losing the audit trail.
      const r = await window.sb.patchJSON(url, { superseded_by: item.id });
      if (!r.ok) throw new Error("patch " + r.status);
      if (window.JARVIS_DATA) {
        window.JARVIS_DATA.memory = window.JARVIS_DATA.memory.filter(m => m.id !== item.id);
      }
      try { window.track && window.track("jarvis_fact_forgotten", { id: item.id }); } catch {}
    } catch (e) {
      console.error("[jarvis] forget failed", e);
      setMemory(prevMem);
      alert("Impossible d'oublier ce fait. Réessaie dans un instant.");
    } finally {
      setPendingFacts(p => {
        const n = { ...p }; delete n[item.id]; return n;
      });
    }
  };

  // Last jarvis message has a "Régénérer" button
  let lastJarvisIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === "jarvis" && !messages[i].kind_aside) { lastJarvisIdx = i; break; }
  }

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
              <span><strong>{(JV.meta?.total_messages || 0).toLocaleString("fr-FR")}</strong> messages</span>
              <span><strong>{JV.meta?.total_hours || 0} h</strong> ensemble</span>
              {JV.meta?.first_conversation && (
                <span>Depuis {new Date(JV.meta.first_conversation).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
              )}
              <span>Aujourd'hui · <strong>{(JV.stats?.cost_today_eur || 0).toFixed(2)} €</strong> / {(JV.stats?.cost_budget_eur || 3).toFixed(0)} €</span>
            </div>
          </div>
          <div className="jv-header-actions">
            <button className="jv-iconbtn" title="Rechercher"><JvIcon name="search" /></button>
            <button className="jv-iconbtn" title="Paramètres"><JvIcon name="settings" /></button>
          </div>
        </header>

        <div className="jv-scroll" ref={scrollRef}>
          <div className="jv-feed">
            {messages.length === 0 && !sending && (
              <div className="jv-empty">
                Pas encore de conversation synchronisée.<br/>
                Lance <code>start_jarvis.bat</code> et écris un message ci-dessous pour démarrer.
              </div>
            )}
            {messages.map((m, i) => (
              <JvMessage
                key={m.id || i}
                m={m}
                onNavigate={handleNav}
                onCopy={handleCopy}
                onRegenerate={handleRegenerate}
                canRegenerate={i === lastJarvisIdx}
              />
            ))}
            {sending && (
              <div className="jv-msg jv-msg--jarvis" style={{ opacity: 0.6 }}>
                <span className="jv-avatar"><JvIcon name="sparkle" size={14} /></span>
                <div className="jv-bubble" style={{ fontStyle: "italic" }}>
                  Jarvis réfléchit… <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginLeft: 8 }}>mode {mode}</span>
                </div>
              </div>
            )}
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
              <span style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                {["quick", "deep", "cloud"].map(m => (
                  <button
                    key={m}
                    className="jv-prompt"
                    onClick={() => setMode(m)}
                    style={mode === m ? { background: "var(--brand)", color: "var(--bg2)", borderColor: "var(--brand)" } : {}}
                    title={m === "quick" ? "Local LLM, sans RAG · 512 tok" : m === "deep" ? "Local + RAG · 2048 tok" : "Claude Haiku + RAG · ~0.01$"}
                  >{m === "quick" ? "Rapide" : m === "deep" ? "Deep" : "Cloud"}</button>
                ))}
              </div>
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
              <span>{JV_MODE_LABELS[mode] || mode} · mémoire activée</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═════ MEMORY COLUMN ═══════════════════════════ */}
      <JvMemory
        memory={memory}
        onNavigate={handleNav}
        onPin={handlePin}
        onForget={handleForget}
        pendingIds={pendingFacts}
      />
    </div>
  );
}

window.PanelJarvis = PanelJarvis;
