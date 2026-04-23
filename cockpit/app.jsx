// App root — theme switcher + router
const { useState, useEffect } = React;

// Global keyboard shortcuts (PC/Mac). Anything panel-specific stays in the
// panel file; this is only the top-level index.
const KEYBOARD_SHORTCUTS = [
  { group: "Navigation", keys: ["Ctrl", "K"],         label: "Ouvrir la recherche" },
  { group: "Navigation", keys: ["Ctrl", "N"],         label: "Capture rapide (carnet)" },
  { group: "Navigation", keys: ["Ctrl", "Shift", "N"], label: "Nouvelle idée avec modal (titre, description, libellés)" },
  { group: "Navigation", keys: ["Ctrl", "1-8"],       label: "Aller au panel N (Brief, Top, Nouveautés, Signaux, Opportunités, Idées, Radar, Jarvis)" },
  { group: "Navigation", keys: ["Ctrl", "B"],         label: "Replier / déplier la sidebar" },
  { group: "Navigation", keys: ["?"],                  label: "Afficher cette aide" },
  { group: "Navigation", keys: ["Échap"],              label: "Fermer un panneau / modale" },
  { group: "Carnet d'idées", keys: ["P"],              label: "Vue pipeline" },
  { group: "Carnet d'idées", keys: ["G"],              label: "Vue galerie" },
  { group: "Carnet d'idées", keys: ["#libellé"],       label: "Tagger l'idée pendant la capture" },
  { group: "Carnet d'idées", keys: ["Glisser carte"],  label: "Changer de statut (entre colonnes)" },
  { group: "Modal ticket",    keys: ["Ctrl", "Entrée"], label: "Enregistrer" },
  { group: "Modal ticket",    keys: ["Tab"],            label: "Valider le libellé en cours de saisie" },
  { group: "Modal ticket",    keys: ["Échap"],          label: "Annuler sans enregistrer" },
];

function ShortcutsOverlay({ open, onClose }) {
  if (!open) return null;
  const groups = {};
  KEYBOARD_SHORTCUTS.forEach(s => {
    (groups[s.group] = groups[s.group] || []).push(s);
  });
  return (
    <div className="kbd-overlay" onClick={onClose}>
      <div className="kbd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <div className="kbd-eyebrow">Aide</div>
          <h2 className="kbd-title">Raccourcis clavier</h2>
          <p className="kbd-sub">PC : utilise <kbd>Ctrl</kbd>. Mac : <kbd>⌘</kbd> équivalent.</p>
        </div>
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="kbd-group">
            <div className="kbd-group-title">{groupName}</div>
            <dl className="kbd-list">
              {items.map((s, i) => (
                <React.Fragment key={i}>
                  <dt className="kbd-keys">
                    {s.keys.map((k, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <span className="kbd-plus">+</span>}
                        <kbd>{k}</kbd>
                      </React.Fragment>
                    ))}
                  </dt>
                  <dd className="kbd-desc">{s.label}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        ))}
        <div className="kbd-foot">
          <button className="btn btn--ghost" onClick={onClose}>Fermer (Échap)</button>
        </div>
      </div>
    </div>
  );
}

// Error boundary — prevents a single panel crash from taking down the
// whole app. Shows a recoverable error card in place of the panel.
class PanelErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(err, info){
    console.error("[PanelErrorBoundary]", err, info?.componentStack);
    try { window.track && window.track("error_shown", { context: "panel:" + (this.props.panelId || "unknown"), message: String(err).slice(0, 200) }); } catch {}
  }
  componentDidUpdate(prev){
    // Reset the error when the panel changes (user navigated away).
    if (prev.panelId !== this.props.panelId && this.state.err) this.setState({ err: null });
  }
  render(){
    if (this.state.err) {
      return (
        <div style={{ padding: "80px 40px", maxWidth: 640, margin: "0 auto", fontFamily: "var(--font-body, Inter)" }}>
          <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tx3)", marginBottom: 12 }}>
            Erreur de rendu — panel {this.props.panelId}
          </div>
          <h2 style={{ fontFamily: "var(--font-display, serif)", fontSize: 22, color: "var(--tx)", marginBottom: 12 }}>
            Ce panel n'a pas pu s'afficher
          </h2>
          <pre style={{ fontSize: 12, color: "var(--tx2)", background: "var(--bg2)", padding: "10px 14px", borderRadius: 6, overflow: "auto", maxHeight: 160 }}>
            {String(this.state.err).slice(0, 400)}
          </pre>
          <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => this.setState({ err: null })}>Réessayer</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Stub({ id, theme, onBack }) {
  return (
    <div className="stub">
      <span className="stub-kicker">Panel {id}</span>
      <h2 className="stub-title">Ce panel reste à designer</h2>
      <p className="stub-body">
        Cette itération se concentre sur le Brief du jour (la home). Les autres panels garderont la même grammaire visuelle — même hiérarchie, mêmes composants — une fois qu'on aura validé la direction.
      </p>
      <button className="btn btn--ghost stub-back" onClick={onBack}>← Retour au Brief</button>
    </div>
  );
}

// Loader shown while a Tier 2 panel fetches its data. Keeps the fake
// skeleton hidden until real data lands — no more "is this my data?" UX.
function PanelLoader({ id }) {
  return (
    <div style={{ padding: "120px 48px", maxWidth: 680, margin: "0 auto", fontFamily: "var(--font-body, Inter)", textAlign: "left" }}>
      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tx3, #9A8D82)", marginBottom: 14 }}>
        Chargement · {id}
      </div>
      <h2 style={{ fontFamily: "var(--font-display, 'Fraunces', serif)", fontSize: 26, fontWeight: 500, color: "var(--tx, #1F1815)", margin: "0 0 10px", letterSpacing: "-.01em" }}>
        On récupère tes données…
      </h2>
      <p style={{ fontSize: 13, color: "var(--tx2, #5E524A)", lineHeight: 1.6, margin: 0 }}>
        Premier chargement de ce panel depuis Supabase. Ça prend 2-3 secondes.
      </p>
    </div>
  );
}

function PanelError({ id, err, onRetry }) {
  return (
    <div style={{ padding: "120px 48px", maxWidth: 680, margin: "0 auto", fontFamily: "var(--font-body, Inter)" }}>
      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--acc, #C2410C)", marginBottom: 14 }}>
        Erreur · {id}
      </div>
      <h2 style={{ fontFamily: "var(--font-display, 'Fraunces', serif)", fontSize: 26, fontWeight: 500, color: "var(--tx, #1F1815)", margin: "0 0 10px", letterSpacing: "-.01em" }}>
        Impossible de charger ce panel
      </h2>
      <p style={{ fontSize: 13, color: "var(--tx2, #5E524A)", lineHeight: 1.6, margin: "0 0 14px" }}>
        Supabase n'a pas répondu. Vérifie ta connexion, ou réessaie.
      </p>
      {err && <pre style={{ fontSize: 11, color: "var(--tx3, #9A8D82)", background: "var(--bg2)", padding: "10px 14px", borderRadius: 6, overflow: "auto", maxHeight: 140, marginBottom: 14 }}>{String(err).slice(0, 300)}</pre>}
      <button className="btn btn--primary btn--sm" onClick={onRetry}>Réessayer</button>
    </div>
  );
}

function App() {
  const [activePanel, setActivePanel] = useState(() => {
    try {
      const h = (window.location.hash || "").replace(/^#/, "").trim();
      if (h) return h;
    } catch {}
    return "brief";
  });
  const [historicalDay, setHistoricalDay] = useState(null);
  // Incremented when a Tier 2 loadPanel resolves — used as part of the
  // panel key so React re-mounts the panel after real data hydrates.
  const [dataVersion, setDataVersion] = useState(0);
  // Per-panel loading / error state for Tier 2 panels. Each entry is
  // "loading" | "ready" | { error }. Absence = not-yet-requested.
  const [panelStatus, setPanelStatus] = useState(() => {
    // If bootstrap already preloaded the initial panel, it sets this.
    return window.__cockpitInitialPanelReady ? { [window.__cockpitInitialPanelReady]: "ready" } : {};
  });
  const [retryTick, setRetryTick] = useState(0);
  const [sbMobileOpen, setSbMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [themeId, setThemeId] = useState(() => {
    try {
      const stored = localStorage.getItem("cockpit-theme");
      if (stored) return stored;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "obsidian";
    } catch {}
    return "dawn";
  });
  const theme = THEMES[themeId] || THEMES.dawn;
  const data = COCKPIT_DATA;

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute("data-theme", themeId);
    try { localStorage.setItem("cockpit-theme", themeId); } catch {}
  }, [themeId, theme]);

  const handleNavigate = (id) => {
    setActivePanel(id);
    setSbMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try { window.location.hash = id; } catch {}
    try { window.track && window.track("section_opened", { section: id }); } catch {}
    // Tier 2 lazy load happens in the effect below — triggering on every
    // activePanel change including the first mount (deep-linked refresh).
  };

  // Tier 2 lazy load: fires whenever activePanel changes or retry is
  // requested. Covers deep-link refreshes (#music, #perf…) — the panel
  // never renders against untouched fake *_DATA globals: we either
  // show a loader until real data arrives, or an error with retry.
  //
  // Tier 1-only panels (brief/top/week/jarvis/search) don't go through
  // this path (their data is already populated by bootTier1 before
  // React mounts).
  useEffect(() => {
    const dl = window.cockpitDataLoader;
    if (!dl || typeof dl.loadPanel !== "function") return;
    const isTier2 = dl.TIER2_PANELS && dl.TIER2_PANELS.has(activePanel);
    if (!isTier2) return;

    // If we've already loaded this panel once in this session, the
    // T2 cache (once()) resolves synchronously — but we still go
    // through the async path so `ready` is set correctly.
    setPanelStatus(prev => {
      if (prev[activePanel] === "ready") return prev;
      return { ...prev, [activePanel]: "loading" };
    });

    let cancelled = false;
    dl.loadPanel(activePanel).then((result) => {
      if (cancelled) return;
      setPanelStatus(prev => ({ ...prev, [activePanel]: "ready" }));
      if (result !== null) setDataVersion(v => v + 1);
    }).catch((err) => {
      if (cancelled) return;
      console.error("[loadPanel]", activePanel, err);
      setPanelStatus(prev => ({ ...prev, [activePanel]: { error: err } }));
    });
    return () => { cancelled = true; };
  }, [activePanel, retryTick]);

  // Clear the T2 cache for the active panel and re-run the effect.
  const retryActivePanel = () => {
    try {
      const dl = window.cockpitDataLoader;
      if (dl && dl.cache) {
        // Drop every cache key that mentions this panel. Keys are
        // table names, so we clear them all — heavy-handed but safe.
        Object.keys(dl.cache).forEach(k => { delete dl.cache[k]; });
      }
    } catch {}
    setPanelStatus(prev => { const next = { ...prev }; delete next[activePanel]; return next; });
    setRetryTick(t => t + 1);
  };

  // Hash deep-link: sync browser hash → activePanel (back/forward nav).
  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || "").replace(/^#/, "").trim();
      if (h && h !== activePanel) setActivePanel(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [activePanel]);

  // Cmd/Ctrl+K → search panel
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleNavigate("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cmd/Ctrl+N (global) → navigate to ideas & focus capture input.
  // When we're already on the ideas panel, the panel's own listener
  // focuses the input directly.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !e.shiftKey && !e.altKey) {
        const tag = (e.target && e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        if (activePanel === "ideas") return; // panel listener takes over
        e.preventDefault();
        handleNavigate("ideas");
        setTimeout(() => {
          try { window.__ideasFocusCapture && window.__ideasFocusCapture(); } catch {}
        }, 120);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel]);

  // Ctrl/Cmd+1..8 → jump to the first 8 main panels (matches the
  // sidebar order of the core sections).
  const QUICK_PANELS = ["brief", "top", "updates", "signals", "opps", "ideas", "radar", "jarvis"];
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > QUICK_PANELS.length) return;
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      handleNavigate(QUICK_PANELS[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl/Cmd+B → toggle sidebar rail (delegates to the sidebar component,
  // which owns the collapsed state).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !e.shiftKey && !e.altKey) {
        const tag = (e.target && e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        try { window.__cockpitToggleSidebar && window.__cockpitToggleSidebar(); } catch {}
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "?" → ouvre l'overlay d'aide | Escape → referme tout overlay/modale
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      const inInput = tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable);
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (inInput) return;
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
        return;
      }
      if (e.key === "Escape") {
        if (shortcutsOpen) { e.preventDefault(); setShortcutsOpen(false); }
        if (sbMobileOpen) setSbMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsOpen, sbMobileOpen]);

  // Global link_clicked telemetry (delegated to capture a[target="_blank"]).
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest('a[target="_blank"]');
      if (!a || !a.href) return;
      try { window.track && window.track("link_clicked", { url: a.href.substring(0, 200), section: activePanel }); } catch {}
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [activePanel]);

  // Panel key — remount on activePanel or dataVersion change so panels
  // pick up the latest window.*_DATA after Tier 2 hydration.
  const panelKey = activePanel + ":" + dataVersion;

  // Tier 2 panels are only rendered once their data has landed. While
  // pending, we show a loader so the fake skeleton baked into
  // data-*.js never surfaces. On error we surface a retry card.
  const dl = window.cockpitDataLoader;
  const isTier2 = dl && dl.TIER2_PANELS && dl.TIER2_PANELS.has(activePanel);
  const status = panelStatus[activePanel];
  let content;
  if (isTier2 && (!status || status === "loading")) {
    content = <PanelLoader key={`loader:${activePanel}:${retryTick}`} id={activePanel} />;
  } else if (isTier2 && status && typeof status === "object" && status.error) {
    content = <PanelError key={`err:${activePanel}:${retryTick}`} id={activePanel} err={status.error} onRetry={retryActivePanel} />;
  } else if (activePanel === "brief") content = <Home key={panelKey} theme={theme} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "top") content = <PanelTop key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "signals") content = <PanelSignals key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "radar") content = <PanelRadar key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "recos") content = <PanelRecos key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "challenges") content = <PanelChallenges key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "wiki") content = <PanelWiki key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "opps") content = <PanelOpportunities key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "ideas") content = <PanelIdeas key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "jobs") content = <PanelJobsRadar key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "week") content = <PanelWeek key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "jarvis") content = <PanelJarvis key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "profile") content = <PanelProfile key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "perf") content = <PanelForme key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "music") content = <PanelMusique key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "gaming") content = <PanelGaming key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "stacks") content = <PanelStacks key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "history") content = <PanelHistory key={panelKey} data={data} onNavigate={handleNavigate} onLoadDay={setHistoricalDay} historicalDay={historicalDay} />;
  else if (activePanel === "search") content = <PanelSearch key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "updates")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="VEILLE_DATA" title="Veille IA" actorsLabel="labos + éditeurs" prodSection={{ kicker: "Agents en production", title: "Qui a déployé quoi, ce mois-ci" }} />;
  else if (activePanel === "sport")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="SPORT_DATA" title="Sport" showActors={false} categoryLabel="Discipline" typeLabel="Format" categories={[
      { id: "foot", label: "Football", color: "#004170" },
      { id: "esport", label: "E-sport", color: "#0ac7ff" },
      { id: "rugby", label: "Rugby", color: "#1a3a6c" },
      { id: "cyclisme", label: "Cyclisme", color: "#d8a93a" },
      { id: "tennis", label: "Tennis", color: "#b3491a" },
      { id: "natation", label: "Natation", color: "#e67040" },
    ]} prodSection={null} />;
  else if (activePanel === "gaming_news")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="GAMING_DATA" title="Gaming" showActors={false} categoryLabel="Rubrique" typeLabel="Format" categories={[
      { id: "releases", label: "Sorties récentes", color: "#3a2a1a" },
      { id: "upcoming", label: "À venir", color: "#006fcd" },
      { id: "esport", label: "E-sport", color: "#d13639" },
      { id: "industry", label: "Industrie", color: "#555" },
    ]} prodSection={null} />;
  else if (activePanel === "anime")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="ANIME_DATA" title="Anime / Ciné / Séries" showActors={false} categoryLabel="Statut" typeLabel="Format" categories={[
      { id: "released", label: "Sorties récentes", color: "#1f1f1f" },
      { id: "upcoming", label: "À venir prochainement", color: "#2e6a4f" },
      { id: "industry", label: "Industrie", color: "#555" },
    ]} prodSection={{ kicker: "Prochaines sorties anime", title: "Les animes à venir — source MyAnimeList" }} prodTableMode={true} />;
  else if (activePanel === "news")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="NEWS_DATA" title="Actualités" showActors={false} categoryLabel="Zone" typeLabel="Rubrique" categories={[
      { id: "paris", label: "Paris", color: "#1a5f3f" },
      { id: "france", label: "France", color: "#1e3a8a" },
      { id: "international", label: "International", color: "#bf0a30" },
    ]} prodSection={null} />;
  else content = <Stub id={activePanel} theme={theme} onBack={() => setActivePanel("brief")} />;

  return (
    <div className={`app ${sbMobileOpen ? "is-sb-mobile-open" : ""}`}>
      <button
        className="sb-mobile-trigger"
        onClick={() => setSbMobileOpen(v => !v)}
        aria-label={sbMobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
      >
        <span /><span /><span />
      </button>
      {sbMobileOpen && (
        <div className="sb-mobile-backdrop" onClick={() => setSbMobileOpen(false)} />
      )}
      <Sidebar theme={theme} activeId={activePanel} onSelect={handleNavigate} data={data} onThemeChange={setThemeId} mobileOpen={sbMobileOpen} onMobileClose={() => setSbMobileOpen(false)} />
      <main className="main">
        {historicalDay && activePanel !== "history" && (
          <div style={{
            position: "sticky", top: 0, zIndex: 20,
            background: "var(--tx)", color: "var(--bg)",
            padding: "10px 24px", display: "flex",
            justifyContent: "space-between", alignItems: "center",
            fontSize: 13, fontFamily: "var(--font-sans)",
          }}>
            <span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7, marginRight: 12 }}>Mode historique</span>
              Cockpit rechargé pour le <strong style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500 }}>{historicalDay.long}</strong>
            </span>
            <button onClick={() => setHistoricalDay(null)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--bg)", background: "transparent", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 12px", borderRadius: 2, cursor: "pointer", letterSpacing: "0.04em" }}>
              Revenir à aujourd'hui →
            </button>
          </div>
        )}
        <PanelErrorBoundary panelId={activePanel}>{content}</PanelErrorBoundary>
      </main>
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <button
        className="kbd-fab"
        onClick={() => setShortcutsOpen(true)}
        title="Raccourcis clavier (?)"
        aria-label="Afficher les raccourcis clavier"
      >?</button>
    </div>
  );
}

// Deferred mount — the bootstrap script (cockpit/lib/bootstrap.js) awaits
// auth + Tier 1 data, then calls window.__cockpitMount().
// Idempotent: reuse the existing root if mount is called twice.
let __cockpitRoot = null;
window.__cockpitMount = function(){
  const container = document.getElementById("root");
  if (!container) return;
  if (!__cockpitRoot) __cockpitRoot = ReactDOM.createRoot(container);
  __cockpitRoot.render(<App />);
};
// Fallback: if no bootstrap script is present (e.g. running the raw
// migration-package locally), mount immediately so the fake-data maquette
// still works.
if (!window.__cockpitBootstrapPending) {
  window.__cockpitMount();
}
