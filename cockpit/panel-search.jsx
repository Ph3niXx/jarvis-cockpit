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

// ── Shortcut display helper ─────────────────────────────────
function Kbd({ children }) {
  return <span className="cmdk-kbd">{children}</span>;
}

// ── The Command-K modal content ─────────────────────────────
function CmdKModal({ query, setQuery, filtered, aiMode, setAiMode, selectedIdx, setSelectedIdx, onClose }) {
  const inputRef = useRefSearch(null);

  useEffectSearch(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Keyboard navigation inside modal
  useEffectSearch(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (!query) return;
      const items = aiMode ? [] : filtered;
      if (items.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = items[selectedIdx];
        if (sel && sel.url) window.open(sel.url, "_blank");
      }
      // Toggle AI mode with Ctrl+I / Cmd+I
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault(); setAiMode((m) => !m);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, filtered, aiMode, selectedIdx, onClose, setSelectedIdx, setAiMode]);

  return (
    <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
      <div className="cmdk-input-row">
        <Icon name="search" size={18} stroke={1.75} />
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder={aiMode ? "Pose ta question à Jarvis…" : "Cherche dans tes articles, notes, wiki, conversations…"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
        />
        <button
          className={`cmdk-ai-toggle ${aiMode ? "is-on" : ""}`}
          onClick={() => setAiMode(!aiMode)}
          title={`Mode IA (${OS_INFO.modKey}+I)`}
        >
          <Icon name="sparkles" size={12} stroke={1.75} />
          <span>Mode IA</span>
        </button>
        {!OS_INFO.isTouch && <span className="cmdk-esc">esc</span>}
        {OS_INFO.isTouch && (
          <button className="cmdk-close-touch" onClick={onClose} aria-label="Fermer">×</button>
        )}
      </div>

      <div className="cmdk-body">
        {aiMode && query && (
          <div className="cmdk-ai-response">
            <div className="cmdk-ai-kicker"><Icon name="sparkles" size={11} stroke={1.75} /> Mode IA — ouvre Jarvis pour une vraie réponse contextualisée</div>
            <p className="cmdk-ai-text">
              Tape <strong>Entrée</strong> pour envoyer « <strong>{query}</strong> » à Jarvis avec le RAG activé, ou ferme cette modale et utilise la recherche classique ci-dessous.
            </p>
          </div>
        )}

        {!query && (
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
                      <span className="cmdk-item-title">Tape 2 caractères ou plus pour lancer la recherche sur tes articles.</span>
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
                  <Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>I</Kbd>
                  <span className="cmdk-item-title">Basculer en mode IA</span>
                </div>
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

        {query && !aiMode && (
          <div className="cmdk-group">
            <div className="cmdk-group-label">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</div>
            {filtered.length === 0 && (
              <div className="cmdk-noresult">
                Aucun résultat. Essaie le mode IA {!OS_INFO.isTouch && <>(<Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>I</Kbd>)</>} pour une réponse en langage naturel.
              </div>
            )}
            {filtered.slice(0, 6).map((r, i) => (
              <button
                key={r.id}
                className={`cmdk-item cmdk-item--result ${i === selectedIdx ? "is-selected" : ""}`}
                onClick={() => { if (r.url) window.open(r.url, "_blank"); }}
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
          <div className="cmdk-footer-item"><Kbd>{OS_INFO.modSymbol}</Kbd><Kbd>I</Kbd><span>mode IA</span></div>
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
  const [aiMode, setAiMode] = useStateSearch(false);
  const [selectedIdx, setSelectedIdx] = useStateSearch(0);

  // Global shortcut to open modal
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

  // ── Live Supabase search ──────────────────────────────────
  const [liveResults, setLiveResults] = useStateSearch([]);
  const searchAbortRef = useRefSearch({ last: null, timer: null });
  useEffectSearch(() => {
    if (!query || query.trim().length < 2) { setLiveResults([]); return; }
    const q = query.trim();
    clearTimeout(searchAbortRef.current.timer);
    searchAbortRef.current.timer = setTimeout(async () => {
      const token = Math.random();
      searchAbortRef.current.last = token;
      try {
        const encoded = encodeURIComponent(q);
        const url = window.SUPABASE_URL + "/rest/v1/articles?or=(title.ilike.*" + encoded + "*,summary.ilike.*" + encoded + "*,source.ilike.*" + encoded + "*)&order=date_fetched.desc&limit=20";
        const rows = await window.sb.fetchJSON(url);
        if (searchAbortRef.current.last !== token) return;
        setLiveResults((rows || []).map((a, i) => ({
          id: a.id || ("sr" + i),
          type: "article",
          scope: (a.section || "Veille IA").toUpperCase(),
          title: a.title || "—",
          source: a.source || "—",
          date: a.date_published ? new Date(a.date_published).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "",
          snippet: (function(s){ const d=document.createElement("div"); d.innerHTML=String(s||""); return (d.textContent||"").slice(0, 180); })(a.summary),
          tags: a.tags || [],
          icon: "sparkles",
          url: a.url,
        })));
        try { window.track && window.track("search_performed", { query_length: q.length, results_count: rows.length }); } catch {}
        try { pushRecentQuery(q, (rows || []).length); } catch {}
      } catch (e) {
        if (searchAbortRef.current.last !== token) return;
        console.error("[search]", e);
        setLiveResults([]);
      }
    }, 220);
    return () => clearTimeout(searchAbortRef.current.timer);
  }, [query]);

  // Live results win when available; short queries (<2 chars) fall back
  // to the in-memory demo corpus so typing feedback stays instant.
  const filtered = useMemoSearch(() => {
    if (!query) return [];
    if (query.trim().length >= 2) return liveResults;
    const q = query.toLowerCase();
    return CORPUS.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.snippet.toLowerCase().includes(q) ||
      c.tags.some(t => t.includes(q))
    );
  }, [query, liveResults]);

  const close = () => { setOpen(false); setQuery(""); setAiMode(false); setSelectedIdx(0); setLiveResults([]); };

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
          <button className="pill" onClick={() => { setOpen(true); setQuery("mistral bnp"); setAiMode(true); }}>
            Démo : question IA
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
            <div className="cmdk-preview-desc">Filtré par mot-clé, navigation ↑↓ ↵</div>
          </button>
          <button className="cmdk-preview" onClick={() => { setOpen(true); setQuery("claude agents GA"); setAiMode(true); }}>
            <div className="cmdk-preview-label">Réponse IA</div>
            <div className="cmdk-preview-desc">Synthèse + sources citées</div>
          </button>
        </div>
      </div>

      {open && (
        <div className="cmdk-overlay" onClick={close}>
          <CmdKModal
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            aiMode={aiMode}
            setAiMode={setAiMode}
            selectedIdx={selectedIdx}
            setSelectedIdx={setSelectedIdx}
            onClose={close}
          />
        </div>
      )}
    </div>
  );
}

window.PanelSearch = PanelSearch;
