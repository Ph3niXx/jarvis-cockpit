// ═══════════════════════════════════════════════════════════════
// PANEL JARVIS LAB — Roadmap des phases du projet Jarvis
// Vue macro (roadmap + résumé phase) + grille de cartes + drawer
// latéral détaillé pour chaque feature.
// Source : jarvis/spec.json (fetch lazy avec cache mémoire).
// ═══════════════════════════════════════════════════════════════

const { useState: useJLState, useEffect: useJLEffect, useRef: useJLRef } = React;

let __jarvisLabSpecCache = null;

async function __fetchJarvisSpec() {
  if (__jarvisLabSpecCache) return __jarvisLabSpecCache;
  const res = await fetch("./jarvis/spec.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  __jarvisLabSpecCache = json;
  return json;
}

function JLRoadmapNode({ phase, selected, onClick }) {
  const statusKey = phase.status.replace("_", "-");
  return (
    <button
      type="button"
      className={`jl-node jl-node--${statusKey} ${selected ? "is-selected" : ""}`}
      onClick={() => onClick(phase.id)}
      title={phase.name}
    >
      <span className="jl-node-dot" aria-hidden="true" />
      <span className="jl-node-label">P{phase.order}</span>
      <span className="jl-node-status">{phase.status.replace("_", " ")}</span>
    </button>
  );
}

function JLPhaseSummary({ phase }) {
  const features = phase.features || [];
  const done = features.filter(f => f.status === "done").length;
  const wip = features.filter(f => f.status === "in_progress").length;
  const backlog = features.filter(f => f.status === "backlog").length;
  const blocked = features.filter(f => f.status === "blocked").length;

  return (
    <div className="jl-summary">
      <div className="jl-summary-title">
        Phase {phase.order} — {phase.name}
      </div>
      <div className="jl-summary-stats">
        {done}/{features.length} features done · {wip} in progress · {backlog} backlog
        {blocked > 0 ? ` · ${blocked} blocked` : ""}
      </div>
    </div>
  );
}

function JLFeatureCard({ phase, feature, onFeatureClick }) {
  const statusKey = feature.status.replace("_", "-");
  const blocked = feature.status === "blocked";
  const impl = feature.implementation || {};
  const nbFiles = (impl.files || []).length;
  const nbDeps = (feature.depends_on || []).length;
  const nbDecisions = (impl.key_decisions || []).length;
  const handleClick = (e) => onFeatureClick(phase.id, feature.id, e.currentTarget);

  return (
    <button
      type="button"
      className="jl-feature-card"
      data-status={statusKey}
      data-phase-id={phase.id}
      data-feature-id={feature.id}
      onClick={handleClick}
    >
      <div className="jl-feature-head">
        <span className={`jl-feature-badge jl-feature-badge--${statusKey}`}>
          <span className="jl-feature-badge-dot" aria-hidden="true" />
          <span className="jl-feature-badge-label">{feature.status.replace("_", " ")}</span>
        </span>
        <span className="jl-feature-meta-top">
          {feature.scope} · {feature.progress || 0}%
        </span>
      </div>
      <div className="jl-feature-name">{feature.name}</div>
      <p className="jl-feature-desc">{feature.description}</p>
      <div className="jl-feature-progress" aria-hidden="true">
        <div
          className={`jl-feature-progress-fill ${blocked ? "is-blocked" : ""}`}
          style={{ width: `${feature.progress || 0}%` }}
        />
      </div>
      <div className="jl-feature-meta-bottom">
        <div>{nbFiles} file{nbFiles === 1 ? "" : "s"} · {nbDeps} dep · {nbDecisions} decision{nbDecisions === 1 ? "" : "s"}</div>
        <div>Updated {feature.updated_at}</div>
      </div>
    </button>
  );
}

const JL_STATUS_FILTERS = [
  { id: "all",         label: "Tous" },
  { id: "done",        label: "Done" },
  { id: "in_progress", label: "WIP" },
  { id: "backlog",     label: "Backlog" },
  { id: "blocked",     label: "Blocked" },
];
const JL_SCOPE_FILTERS = [
  { id: "all",   label: "Tous" },
  { id: "perso", label: "Perso" },
  { id: "pro",   label: "Pro" },
];

function JLFilterChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      className={`jl-filter-chip ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function JLFilterBar({ statusFilter, scopeFilter, onStatusChange, onScopeChange }) {
  return (
    <div className="jl-filter-bar">
      <div className="jl-filter-group">
        <span className="jl-filter-label">Statut</span>
        {JL_STATUS_FILTERS.map(f => (
          <JLFilterChip
            key={f.id}
            active={statusFilter === f.id}
            label={f.label}
            onClick={() => onStatusChange(f.id)}
          />
        ))}
      </div>
      <div className="jl-filter-sep" aria-hidden="true" />
      <div className="jl-filter-group">
        <span className="jl-filter-label">Scope</span>
        {JL_SCOPE_FILTERS.map(f => (
          <JLFilterChip
            key={f.id}
            active={scopeFilter === f.id}
            label={f.label}
            onClick={() => onScopeChange(f.id)}
          />
        ))}
      </div>
    </div>
  );
}

function JLFeaturesGrid({ phase, statusFilter, scopeFilter, onFeatureClick }) {
  if (!phase) return null;
  const all = phase.features || [];
  const filtered = all.filter(f => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (scopeFilter !== "all" && f.scope !== scopeFilter) return false;
    return true;
  });
  if (!filtered.length) {
    return <div className="jl-empty">Aucune feature ne correspond aux filtres.</div>;
  }
  return (
    <div className="jl-features-grid">
      {filtered.map(f => (
        <JLFeatureCard
          key={f.id}
          phase={phase}
          feature={f}
          onFeatureClick={onFeatureClick}
        />
      ))}
    </div>
  );
}

function JLBadges({ feature }) {
  const statusKey = feature.status.replace("_", "-");
  return (
    <div className="jl-drawer-badges">
      <span className={`jl-chip jl-chip-status jl-chip--${statusKey}`}>
        <span className="jl-chip-dot" aria-hidden="true" />
        <span>{feature.status.replace("_", " ")}</span>
      </span>
      <span className="jl-chip jl-chip-scope">{feature.scope}</span>
      <span className="jl-chip jl-chip-progress">{feature.progress}%</span>
    </div>
  );
}

function JLDependencyLink({ refStr, spec, onNavigate }) {
  const [phaseId, featureId] = refStr.split(".");
  const phase = spec.phases?.find(p => p.id === phaseId);
  const feature = phase?.features?.find(f => f.id === featureId);
  if (!feature) {
    return <span className="jl-dep-missing">→ {refStr} [ref manquante]</span>;
  }
  return (
    <button
      type="button"
      className="jl-dep-link"
      onClick={() => onNavigate(phaseId, featureId)}
      title={`${phase.name} · ${feature.name}`}
    >
      {refStr}
    </button>
  );
}

function JLDrawerContent({ data, spec, onNavigate, closeRef }) {
  if (!data) return null;
  const { phase, feature } = data;
  const impl = feature.implementation || {};
  const files = impl.files || [];
  const deps = impl.dependencies || [];
  const decisions = impl.key_decisions || [];
  const dependsOn = feature.depends_on || [];
  const metricsEntries = feature.metrics ? Object.entries(feature.metrics) : [];
  const nextSteps = feature.next_steps || [];

  return (
    <>
      <button
        ref={closeRef}
        type="button"
        className="jl-drawer-close"
        aria-label="Fermer"
        onClick={() => onNavigate.close()}
      >
        ✕
      </button>

      <div className="jl-drawer-breadcrumb">
        PHASE {phase.order} · {phase.name.toUpperCase()}
      </div>

      <h2 className="jl-drawer-name">{feature.name}</h2>

      <JLBadges feature={feature} />

      <div className="jl-drawer-progress" aria-hidden="true">
        <div
          className="jl-drawer-progress-fill"
          style={{ width: `${feature.progress || 0}%` }}
        />
      </div>

      <p className="jl-drawer-description">{feature.description}</p>

      <hr className="jl-drawer-separator" />
      <div className="jl-drawer-section-header">Implementation</div>

      <div className="jl-drawer-sublabel">Files</div>
      {files.length === 0 ? (
        <p className="jl-dep-empty">Aucun fichier listé.</p>
      ) : (
        <ul className="jl-drawer-list is-mono">
          {files.map(f => <li key={f}>{f}</li>)}
        </ul>
      )}

      <div className="jl-drawer-sublabel">Dependencies</div>
      {deps.length === 0 ? (
        <p className="jl-dep-empty">Aucune dépendance listée.</p>
      ) : (
        <ul className="jl-drawer-list">
          {deps.map(d => <li key={d}>{d}</li>)}
        </ul>
      )}

      <div className="jl-drawer-sublabel">Key decisions</div>
      {decisions.length === 0 ? (
        <p className="jl-dep-empty">Aucune décision listée.</p>
      ) : (
        <ul className="jl-drawer-list">
          {decisions.map(d => <li key={d}>{d}</li>)}
        </ul>
      )}

      <hr className="jl-drawer-separator" />
      <div className="jl-drawer-section-header">Depends on</div>
      {dependsOn.length === 0 ? (
        <p className="jl-dep-empty">Aucune dépendance</p>
      ) : (
        <ul className="jl-drawer-deps">
          {dependsOn.map(ref => (
            <li key={ref}>
              <JLDependencyLink
                refStr={ref}
                spec={spec}
                onNavigate={(pId, fId) => onNavigate.open(pId, fId)}
              />
            </li>
          ))}
        </ul>
      )}

      {metricsEntries.length > 0 && (
        <>
          <hr className="jl-drawer-separator" />
          <div className="jl-drawer-section-header">Metrics</div>
          <div className="jl-drawer-metrics">
            {metricsEntries.map(([k, v]) => (
              <React.Fragment key={k}>
                <span className="jl-drawer-metrics-key">{k}</span>
                <span className="jl-drawer-metrics-val">{String(v)}</span>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {nextSteps.length > 0 && (
        <>
          <hr className="jl-drawer-separator" />
          <div className="jl-drawer-section-header">Next steps</div>
          <ul className="jl-drawer-steps">
            {nextSteps.map(s => <li key={s}>{s}</li>)}
          </ul>
        </>
      )}

      <hr className="jl-drawer-separator" />
      <div className="jl-drawer-footer">Updated {feature.updated_at}</div>
    </>
  );
}

function JLDrawer({ data, spec, open, onClose, onNavigate }) {
  const closeRef = useJLRef(null);

  // Body scroll lock while drawer is open.
  useJLEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape to close.
  useJLEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus close button on open; also when content changes via dep-link
  // navigation (data swap).
  useJLEffect(() => {
    if (!open) return;
    const el = closeRef.current;
    if (el) {
      const id = requestAnimationFrame(() => {
        try { el.focus(); } catch {}
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open, data]);

  return (
    <>
      <div
        className={`jl-overlay ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`jl-drawer ${open ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={data ? `Détail de la feature ${data.feature.name}` : "Drawer"}
      >
        <JLDrawerContent
          data={data}
          spec={spec}
          onNavigate={{ close: onClose, open: onNavigate }}
          closeRef={closeRef}
        />
      </aside>
    </>
  );
}

function PanelJarvisLab() {
  const [spec, setSpec] = useJLState(__jarvisLabSpecCache);
  const [err, setErr] = useJLState(null);
  const [selectedPhaseId, setSelectedPhaseId] = useJLState(null);
  const [drawerRef, setDrawerRef] = useJLState(null);
  const [drawerOpen, setDrawerOpen] = useJLState(false);
  const [filterStatus, setFilterStatus] = useJLState("all");
  const [filterScope, setFilterScope] = useJLState("all");
  const lastOpenerRef = useJLRef(null);

  useJLEffect(() => {
    if (spec) return;
    let cancelled = false;
    __fetchJarvisSpec()
      .then(json => { if (!cancelled) setSpec(json); })
      .catch(e => {
        if (!cancelled) {
          console.error("[jarvis-lab] spec load failed", e);
          setErr(e);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useJLEffect(() => {
    if (!spec || selectedPhaseId) return;
    const phases = spec.phases || [];
    const wip = phases.find(p => p.status === "in_progress");
    if (wip) { setSelectedPhaseId(wip.id); return; }
    const lastDone = [...phases].reverse().find(p => p.status === "done");
    if (lastDone) { setSelectedPhaseId(lastDone.id); return; }
    if (phases[0]) setSelectedPhaseId(phases[0].id);
  }, [spec]);

  const openFeature = (phaseId, featureId, opener) => {
    if (opener) lastOpenerRef.current = opener;
    setDrawerRef({ phaseId, featureId });
    setDrawerOpen(true);
    if (phaseId !== selectedPhaseId) setSelectedPhaseId(phaseId);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    const opener = lastOpenerRef.current;
    if (opener && typeof opener.focus === "function") {
      try { opener.focus(); } catch {}
    }
  };

  if (err) {
    return (
      <section id="jarvis-lab" className="jl-root">
        <div className="jl-error">
          Impossible de charger spec.json — vérifie que le fichier existe et que le serveur est en cours d'exécution.
        </div>
      </section>
    );
  }
  if (!spec) {
    return (
      <section id="jarvis-lab" className="jl-root">
        <div className="jl-loading">Chargement de spec.json…</div>
      </section>
    );
  }

  const phases = spec.phases || [];
  const selectedPhase = phases.find(p => p.id === selectedPhaseId) || phases[0];

  const drawerData = (() => {
    if (!drawerRef) return null;
    const p = phases.find(x => x.id === drawerRef.phaseId);
    if (!p) return null;
    const f = (p.features || []).find(x => x.id === drawerRef.featureId);
    return f ? { phase: p, feature: f } : null;
  })();

  return (
    <section id="jarvis-lab" className="jl-root">
      <header className="jl-header">
        <div className="jl-title">JARVIS LAB</div>
        <div className="jl-subtitle">
          Source : jarvis/spec.json · Dernière MAJ : {spec.meta?.updated_at || "—"}
        </div>
      </header>

      <div className="jl-roadmap">
        <div className="jl-roadmap-line" aria-hidden="true" />
        <div className="jl-roadmap-nodes">
          {phases.map(p => (
            <JLRoadmapNode
              key={p.id}
              phase={p}
              selected={selectedPhase && p.id === selectedPhase.id}
              onClick={setSelectedPhaseId}
            />
          ))}
        </div>
      </div>

      {selectedPhase && <JLPhaseSummary phase={selectedPhase} />}

      <div id="jarvis-lab-features">
        <JLFilterBar
          statusFilter={filterStatus}
          scopeFilter={filterScope}
          onStatusChange={setFilterStatus}
          onScopeChange={setFilterScope}
        />
        <JLFeaturesGrid
          phase={selectedPhase}
          statusFilter={filterStatus}
          scopeFilter={filterScope}
          onFeatureClick={openFeature}
        />
      </div>

      <JLDrawer
        data={drawerData}
        spec={spec}
        open={drawerOpen && !!drawerData}
        onClose={closeDrawer}
        onNavigate={(phaseId, featureId) => openFeature(phaseId, featureId, null)}
      />
    </section>
  );
}

window.PanelJarvisLab = PanelJarvisLab;
