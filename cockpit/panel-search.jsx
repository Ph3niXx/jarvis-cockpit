// Panel : Recherche — Command-K avec détection OS
const { useState: useStateSearch, useEffect: useEffectSearch, useRef: useRefSearch, useMemo: useMemoSearch } = React;

// ── OS detection ──────────────────────────────────────────────
const OS_INFO = (() => {
  if (typeof navigator === "undefined") return { os: "other", modKey: "Ctrl", modSymbol: "Ctrl", isTouch: false };
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMac = /Mac/.test(platform) && !isIOS;
  const isAndroid = /Android/.test(ua);
  const isWin = /Win/.test(platform);
  const isTouch = isIOS || isAndroid || (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches);
  let os = "other", modKey = "Ctrl", modSymbol = "Ctrl";
  if (isIOS) { os = "ios"; modKey = "Cmd"; modSymbol = "⌘"; }
  else if (isMac) { os = "mac"; modKey = "Cmd"; modSymbol = "⌘"; }
  else if (isAndroid) { os = "android"; modKey = "Ctrl"; modSymbol = "Ctrl"; }
  else if (isWin) { os = "win"; modKey = "Ctrl"; modSymbol = "Ctrl"; }
  return { os, modKey, modSymbol, isTouch, isIOS, isMac, isAndroid, isWin };
})();

// ── Recent queries (localStorage) + saved searches (localStorage) ──
// Demo CORPUS was removed: live Supabase search runs as soon as you
// type 2 chars. Short-query suggestions now use your actual recent
// searches instead of fake articles.
const CORPUS = [];

function readRecentQueries(){
  try {
    const raw = localStorage.getItem("search.recent");
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, 5) : [];
  } catch { return []; }
}
function pushRecentQuery(q, resultsCount){
  try {
    const prev = readRecentQueries().filter(r => r.q !== q);
    const next = [{ q, ts: new Date().toISOString(), results: resultsCount }, ...prev].slice(0, 10);
    localStorage.setItem("search.recent", JSON.stringify(next));
  } catch {}
}
function relTimeSearch(iso){
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.round(diffMs / 3600000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} jours`;
}

function readSavedSearches(){
  try {
    const raw = localStorage.getItem("search.saved");
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function saveCurrentSearch(q){
  try {
    const name = (window.prompt("Nom de cette recherche :", q) || "").trim();
    if (!name) return false;
    const prev = readSavedSearches().filter(s => s.name !== name);
    const next = [{ name, query: q, ts: new Date().toISOString() }, ...prev].slice(0, 20);
    localStorage.setItem("search.saved", JSON.stringify(next));
    return true;
  } catch { return false; }
}

function stripSnippet(html){
  const d = document.createElement("div");
  d.innerHTML = String(html || "");
  return (d.textContent || "");
}

// ── Shortcut display helper ─────────────────────────────────
function Kbd({ children }) {
  return <span className="cmdk-kbd">{children}</span>;
}

// ── The Command-K modal content ─────────────────────────────
function openResult(r, onClose, onAskJarvis){
  if (!r) return;
  if (r.url) {
    window.open(r.url, "_blank");
    return;
  }
  if (r.navTo) {
    onClose();
    if (r.navTo === "jarvis" && onAskJarvis) onAskJarvis(r.title || "");
    else if (window.__cockpitNavigate) window.__cockpitNavigate(r.navTo);
  }
}

function CmdKModal({ query, setQuery, filtered, selectedIdx, setSelectedIdx, onClose, onAskJarvis, onSaveSearch }) {
  const inputRef = useRefSearch(null);

  useEffectSearch(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Keyboard navigation inside modal
  useEffectSearch(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (!query) return;
      const items = filtered;
      if (items.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        openResult(items[selectedIdx], onClose, onAskJarvis);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, filtered, selectedIdx, onClose, setSelectedIdx, onAskJarvis]);

  const hasQuery = !!query;
  const resultCount = filtered.length;

  return (
    <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
      <div className="cmdk-input-row">
        <Icon name="search" size={18} stroke={1.75} />
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Cherche dans articles, wiki, idées, conversations Jarvis…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
        />
        {hasQuery && (
          <button
            className="cmdk-ai-toggle"
            onClick={() => { onClose(); onAskJarvis(query); }}
            title="Envoyer cette question à Jarvis"
          >
            <Icon name="assistant" size={12} stroke={1.75} />
            <span>Demander à Jarvis</span>
          </button>
        )}
        {!OS_INFO.isTouch && <span className="cmdk-esc">esc</span>}
        {OS_INFO.isTouch && (
          <button className="cmdk-close-touch" onClick={onClose} aria-label="Fermer">×</button>
        )}
      </div>

      <div className="cmdk-body">
        {!hasQuery && (
          <>
            {(() => {
              const recents = readRecentQueries();
              const saved = readSavedSearches();
              if (recents.length === 0 && saved.length === 0) {
                return (
                  <div className="cmdk-group">
                    <div className="cmdk-group-label">Astuce</div>
                    <div className="cmdk-item" style={{ color: "var(--tx3)", cursor: "default" }}>
                      <Icon name="search" size={14} stroke={1.75} />
                      <span className="cmdk-item-title">Tape 2 caractères ou plus pour chercher dans articles, wiki, idées et conversations Jarvis.</span>
                    </div>
                  </div>
                );
              }
              return <>
                {recents.length > 0 && (
                  <div className="cmdk-group">
                    <div className="cmdk-group-label">Recherches récentes</div>
                    {recents.slice(0, 5).map((r, i) => (
                      <button key={i} className="cmdk-item" onClick={() => setQuery(r.q)}>
                        <Icon name="clock" size={14} stroke={1.75} />
                        <span className="cmdk-item-title">{r.q}</span>
                        <span className="cmdk-item-meta">{r.results} résultats · {relTimeSearch(r.ts)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {saved.length > 0 && (
                  <div className="cmdk-group">
                    <div className="cmdk-group-label">Recherches sauvegardées</div>
                    {saved.slice(0, 5).map((s, i) => (
                      <button key={i} className="cmdk-item" onClick={() => setQuery(s.query || s.q)}>
                        <Icon name="bookmark" size={14} stroke={1.75} />
                        <span className="cmdk-item-title">{s.name}</span>
                        <span className="cmdk-item-meta">{s.query || s.q}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>;
            })()}
            {!OS_INFO.isTouch && (
              <div className="cmdk-group">
                <div className="cmdk-group-label">Raccourcis</div>
                <div className="cmdk-item cmdk-item--shortcut">
                  <Kbd>↑</Kbd><Kbd>↓</Kbd>
                  <span className="cmdk-item-title">Naviguer dans les résultats</span>
                </div>
                <div className="cmdk-item cmdk-item--shortcut">
                  <Kbd>↵</Kbd>
                  <span className="cmdk-item-title">Ouvrir le résultat sélectionné</span>
                </div>
              </div>
            )}
          </>
        )}

        {hasQuery && (
          <div className="cmdk-group">
            <div className="cmdk-group-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{resultCount} résultat{resultCount > 1 ? "s" : ""}</span>
              {resultCount > 0 && (
                <button
                  onClick={() => onSaveSearch(query)}
                  title="Sauvegarder cette recherche"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--div, rgba(120,120,120,.3))",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontSize: 11,
                    color: "var(--tx2)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Icon name="bookmark" size={11} stroke={1.75} /> Sauvegarder
                </button>
              )}
            </div>
            {resultCount === 0 && (
              <div className="cmdk-noresult">
                Aucun résultat dans ton corpus. Clic sur « Demander à Jarvis » pour une réponse en langage naturel.
              </div>
            )}
            {filtered.slice(0, 10).map((r, i) => (
              <button
                key={r.id}
                className={`cmdk-item cmdk-item--result ${i === selectedIdx ? "is-selected" : ""}`}
                onClick={() => openResult(r, onClose, onAskJarvis)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <Icon name={r.icon} size={14} stroke={1.75} />
                <div className="cmdk-item-body">
                  <div className="cmdk-item-title-row">
                    <span className="cmdk-item-title">{r.title}</span>
                    <span className="cmdk-item-scope">{r.scope}</span>
                  </div>
                  <div className="cmdk-item-snippet">{r.snippet}</div>
                </div>
                {i === selectedIdx && !OS_INFO.isTouch && <span className="cmdk-item-enter">↵</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!OS_INFO.isTouch && (
        <div className="cmdk-footer">
          <div className="cmdk-footer-item"><Kbd>↑</Kbd><Kbd>↓</Kbd><span>naviguer</span></div>
          <div className="cmdk-footer-item"><Kbd>↵</Kbd><span>ouvrir</span></div>
          <div className="cmdk-footer-item" style={{ marginLeft: "auto" }}>
            <span className="cmdk-footer-brand">Cockpit</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Panel
// ═══════════════════════════════════════════════════════════════
function PanelSearch({ data, onNavigate }) {
  const [open, setOpen] = useStateSearch(false);
  const [query, setQuery] = useStateSearch("");
  const [selectedIdx, setSelectedIdx] = useStateSearch(0);

  // Expose the router so CmdKModal's openResult helper can navigate
  // internally without prop-drilling through every call site.
  useEffectSearch(() => {
    window.__cockpitNavigate = onNavigate;
    return () => { if (window.__cockpitNavigate === onNavigate) delete window.__cockpitNavigate; };
  }, [onNavigate]);

  // Global shortcut to open modal — covers the case where the user is
  // already on the search panel (the app-level Ctrl+K sets the flag,
  // this panel-local one just opens straight away).
  useEffectSearch(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-open on mount when the app-level Ctrl+K handler set a flag
  // (fixes the "two presses needed" bug from other panels).
  useEffectSearch(() => {
    try {
      if (window.__openSearchOnMount) {
        window.__openSearchOnMount = false;
        setOpen(true);
      }
    } catch {}
  }, []);

  // Prefill depuis d'autres panels (ex: clic sur un signal → recherche)
  useEffectSearch(() => {
    try {
      const stash = localStorage.getItem("veille-prefill-query");
      if (stash) {
        localStorage.removeItem("veille-prefill-query");
        setQuery(stash);
        setOpen(true);
      }
    } catch {}
  }, []);

  // ── Live Supabase search on 4 tables in parallel ──────────
  const [liveResults, setLiveResults] = useStateSearch([]);
  const searchAbortRef = useRefSearch({ last: null, timer: null });
  useEffectSearch(() => {
    if (!query || query.trim().length < 2) { setLiveResults([]); return; }
    const q = query.trim();
    clearTimeout(searchAbortRef.current.timer);
    searchAbortRef.current.timer = setTimeout(async () => {
      const token = Math.random();
      searchAbortRef.current.last = token;
      const encoded = encodeURIComponent(q);
      const base = window.SUPABASE_URL + "/rest/v1/";
      const urls = [
        base + "articles?or=(title.ilike.*" + encoded + "*,summary.ilike.*" + encoded + "*,source.ilike.*" + encoded + "*)&order=date_fetched.desc&limit=10",
        base + "wiki_concepts?or=(name.ilike.*" + encoded + "*,slug.ilike.*" + encoded + "*,summary_beginner.ilike.*" + encoded + "*,summary_intermediate.ilike.*" + encoded + "*)&order=mention_count.desc&limit=5",
        base + "business_ideas?or=(title.ilike.*" + encoded + "*,description.ilike.*" + encoded + "*,teaser.ilike.*" + encoded + "*)&order=created_at.desc&limit=5",
        base + "jarvis_conversations?or=(content.ilike.*" + encoded + "*)&order=created_at.desc&limit=5&select=id,session_id,role,content,created_at",
      ];
      try {
        const [arts, wikis, ideas, msgs] = await Promise.all(
          urls.map(u => window.sb.fetchJSON(u).catch(() => []))
        );
        if (searchAbortRef.current.last !== token) return;
        const mapped = [
          ...(arts || []).map((a, i) => ({
            id: "a_" + (a.id || i),
            type: "article",
            scope: (a.section || "Veille IA").toUpperCase(),
            title: a.title || "—",
            snippet: stripSnippet(a.summary).slice(0, 180),
            icon: "sparkles",
            url: a.url,
          })),
          ...(wikis || []).map((w, i) => ({
            id: "w_" + (w.id || w.slug || i),
            type: "wiki",
            scope: "WIKI",
            title: w.name || w.slug || "—",
            snippet: stripSnippet(w.summary_beginner || w.summary_intermediate || "").slice(0, 180) || (w.category || ""),
            icon: "book",
            navTo: "wiki",
          })),
          ...(ideas || []).map((it, i) => ({
            id: "i_" + (it.id || i),
            type: "idea",
            scope: "IDÉE",
            title: it.title || "(sans titre)",
            snippet: stripSnippet(it.teaser || it.description || "").slice(0, 180),
            icon: "lightbulb",
            navTo: "ideas",
          })),
          ...(msgs || []).map((m, i) => {
            const content = stripSnippet(m.content || "");
            return {
              id: "j_" + (m.id || i),
              type: "jarvis",
              scope: (m.role ? m.role.toUpperCase() : "JARVIS"),
              title: content.slice(0, 80) || "(message vide)",
              snippet: content.slice(80, 260),
              icon: "assistant",
              navTo: "jarvis",
            };
          }),
        ];
        setLiveResults(mapped);
        try { window.track && window.track("search_performed", { query_length: q.length, results_count: mapped.length }); } catch {}
        try { pushRecentQuery(q, mapped.length); } catch {}
      } catch (e) {
        if (searchAbortRef.current.last !== token) return;
        console.error("[search]", e);
        setLiveResults([]);
      }
    }, 220);
    return () => clearTimeout(searchAbortRef.current.timer);
  }, [query]);

  const filtered = useMemoSearch(() => {
    if (!query || query.trim().length < 2) return [];
    return liveResults;
  }, [query, liveResults]);

  const close = () => { setOpen(false); setQuery(""); setSelectedIdx(0); setLiveResults([]); };

  // Ask Jarvis: stash the query and navigate to the Jarvis panel (uses
  // the same localStorage key panel-jarvis.jsx already consumes on mount).
  const askJarvis = (q) => {
    try { localStorage.setItem("jarvis-prefill-input", q || query); } catch {}
    onNavigate("jarvis");
  };

  const handleSaveSearch = (q) => {
    const ok = saveCurrentSearch(q);
    if (ok) {
      try { window.track && window.track("search_saved", { query_length: q.length }); } catch {}
    }
  };

  return (
    <div className="panel-page">
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Recherche unifiée · articles + notes + wiki + Jarvis</div>
        <h1 className="panel-hero-title">Retrouve tout ce que tu as lu, écrit, ou demandé</h1>
        <p className="panel-hero-sub">
          La recherche s'ouvre partout avec <strong>{OS_INFO.modKey}+K</strong>{OS_INFO.isTouch ? " (ou via le bouton ci-dessous)" : ""}, filtre dans ton corpus, et bascule en <strong>mode IA</strong> pour une réponse synthétique citant tes sources. Aucune page de résultats — juste un modal qui répond et disparaît.
        </p>
        <button className="cmdk-trigger" onClick={() => setOpen(true)}>
          <Icon name="search" size={16} stroke={1.75} />
          <span className="cmdk-trigger-text">Chercher dans tout ton cockpit…</span>
          {!OS_INFO.isTouch && (
            <span className="cmdk-trigger-kbd">
              <Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>K</Kbd>
            </span>
          )}
        </button>
      </div>

      <div className="cmdk-demos">
        <div className="cmdk-demos-label">À tester</div>
        <div className="cmdk-demos-row">
          <button className="pill" onClick={() => { setOpen(true); }}>
            Ouvrir le Command-K
          </button>
          <button className="pill" onClick={() => { setOpen(true); setQuery("agents"); }}>
            Démo : rechercher "agents"
          </button>
          <button className="pill" onClick={() => askJarvis("Explique-moi ce qu'est le Model Context Protocol")}>
            Démo : demander à Jarvis
          </button>
          <button className="pill" onClick={() => { setOpen(true); setQuery("xyznothing"); }}>
            Démo : 0 résultat
          </button>
        </div>
        <div className="cmdk-demos-meta">
          Détecté : <strong>{OS_INFO.os === "other" ? "desktop" : OS_INFO.os}</strong>
          {OS_INFO.isTouch && " · mode tactile"}
          {" · raccourci "}
          <Kbd>{OS_INFO.modKey}</Kbd>+<Kbd>K</Kbd>
        </div>
      </div>

      <div className="cmdk-previews">
        <div className="cmdk-preview-head">Aperçus des états</div>
        <div className="cmdk-preview-grid">
          <button className="cmdk-preview" onClick={() => { setOpen(true); }}>
            <div className="cmdk-preview-label">État initial</div>
            <div className="cmdk-preview-desc">Recherches récentes + sauvegardées + raccourcis</div>
          </button>
          <button className="cmdk-preview" onClick={() => { setOpen(true); setQuery("agents"); }}>
            <div className="cmdk-preview-label">Résultats</div>
            <div className="cmdk-preview-desc">Articles, wiki, idées, conversations — navigation ↑↓ ↵</div>
          </button>
          <button className="cmdk-preview" onClick={() => askJarvis("Donne-moi une synthèse des derniers signaux IA")}>
            <div className="cmdk-preview-label">Demander à Jarvis</div>
            <div className="cmdk-preview-desc">Bascule sur le panel Jarvis avec la requête en prefill</div>
          </button>
        </div>
      </div>

      {open && (
        <div className="cmdk-overlay" onClick={close}>
          <CmdKModal
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            selectedIdx={selectedIdx}
            setSelectedIdx={setSelectedIdx}
            onClose={close}
            onAskJarvis={askJarvis}
            onSaveSearch={handleSaveSearch}
          />
        </div>
      )}
    </div>
  );
}

window.PanelSearch = PanelSearch;
