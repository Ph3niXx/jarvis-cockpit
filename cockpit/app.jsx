// App root — theme switcher + router
const { useState, useEffect } = React;

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
    window.scrollTo({ top: 0, behavior: "smooth" });
    try { window.location.hash = id; } catch {}
    try { window.track && window.track("section_opened", { section: id }); } catch {}
    // Tier 2 lazy load for the panel we're entering — bump dataVersion on
    // resolve so the panel re-mounts and re-reads window.*_DATA.
    try {
      if (window.cockpitDataLoader && typeof window.cockpitDataLoader.loadPanel === "function") {
        window.cockpitDataLoader.loadPanel(id).then(() => setDataVersion(v => v + 1)).catch(() => {});
      }
    } catch {}
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
  let content;
  if (activePanel === "brief") content = <Home key={panelKey} theme={theme} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "top") content = <PanelTop key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "signals") content = <PanelSignals key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "radar") content = <PanelRadar key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "recos") content = <PanelRecos key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "challenges") content = <PanelChallenges key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "wiki") content = <PanelWiki key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "opps") content = <PanelOpportunities key={panelKey} data={data} onNavigate={handleNavigate} />;
  else if (activePanel === "ideas") content = <PanelIdeas key={panelKey} data={data} onNavigate={handleNavigate} />;
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
      { id: "natation", label: "Natation", color: "#e67040" },
    ]} prodSection={{ kicker: "Compétitions à venir", title: "Ce qu'il ne faut pas rater cette année" }} />;
  else if (activePanel === "gaming_news")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="GAMING_DATA" title="Gaming" showActors={false} categoryLabel="Rubrique" typeLabel="Format" categories={[
      { id: "releases", label: "Sorties récentes", color: "#3a2a1a" },
      { id: "upcoming", label: "À venir", color: "#006fcd" },
      { id: "esport", label: "E-sport", color: "#d13639" },
      { id: "industry", label: "Industrie", color: "#555" },
    ]} prodSection={{ kicker: "Sorties attendues", title: "Les jeux sur ton radar pour les prochains mois" }} />;
  else if (activePanel === "anime")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="ANIME_DATA" title="Anime / Ciné / Séries" showActors={false} categoryLabel="Statut" typeLabel="Format" categories={[
      { id: "released", label: "Sorties récentes", color: "#1f1f1f" },
      { id: "upcoming", label: "À venir prochainement", color: "#2e6a4f" },
      { id: "industry", label: "Industrie", color: "#555" },
    ]} prodSection={{ kicker: "Sorties majeures", title: "Ce qui arrive au cinéma, en série, en anime" }} />;
  else if (activePanel === "news")
    content = <PanelVeille key={panelKey} data={data} onNavigate={handleNavigate} corpus="NEWS_DATA" title="Actualités" showActors={false} categoryLabel="Zone" typeLabel="Rubrique" categories={[
      { id: "paris", label: "Paris", color: "#1a5f3f" },
      { id: "france", label: "France", color: "#1e3a8a" },
      { id: "international", label: "International", color: "#bf0a30" },
    ]} prodSection={{ kicker: "Échéances à surveiller", title: "Les dates qui vont marquer les prochains mois" }} />;
  else content = <Stub id={activePanel} theme={theme} onBack={() => setActivePanel("brief")} />;

  return (
    <div className="app">
      <Sidebar theme={theme} activeId={activePanel} onSelect={handleNavigate} data={data} onThemeChange={setThemeId} />
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
        {content}
      </main>
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
