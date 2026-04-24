// ═══════════════════════════════════════════════════════════════
// PANEL JARVIS LAB — Roadmap des phases du projet Jarvis
// Vue macro (roadmap + résumé phase) + grille de cartes + drawer
// latéral détaillé pour chaque feature.
// Source : jarvis/spec.json (fetch lazy avec cache mémoire).
// ═══════════════════════════════════════════════════════════════

const { useState: useJLState, useEffect: useJLEffect, useRef: useJLRef, useMemo: useJLMemo } = React;

let __jarvisLabSpecCache = null;

// Caches pour la section "Specs détaillées" (docs/specs/*.md)
let __jlSpecsIndexCache = null;
const __jlSpecsMdCache = {};

async function __fetchSpecsIndex(force = false) {
  if (!force && __jlSpecsIndexCache) return __jlSpecsIndexCache;
  const res = await fetch("./docs/specs/index.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  __jlSpecsIndexCache = json;
  return json;
}

async function __fetchSpecMd(slug) {
  if (__jlSpecsMdCache[slug] !== undefined) return __jlSpecsMdCache[slug];
  const res = await fetch(`./docs/specs/tab-${slug}.md`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${slug}`);
  const txt = await res.text();
  __jlSpecsMdCache[slug] = txt;
  return txt;
}

function __parseSpecMd(src) {
  if (typeof window.marked === "undefined") {
    const escaped = String(src || "").replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
    return { html: `<pre>${escaped}</pre>`, toc: [] };
  }
  const slugify = (s) => String(s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
  const tokens = window.marked.lexer(src || "");
  const toc = [];
  const ids = [];
  const seen = new Set();
  tokens.forEach(t => {
    if (t.type === "heading") {
      let id = slugify(t.text || t.raw) || `h-${ids.length}`;
      let i = 1;
      while (seen.has(id)) { id = slugify(t.text || t.raw) + "-" + i++; }
      seen.add(id);
      ids.push(id);
      if (t.depth === 2) toc.push({ id, text: t.text });
    }
  });
  let html = window.marked.parser(tokens);
  let idx = 0;
  html = html.replace(/<h([1-6])>/g, (_, d) => {
    const id = ids[idx++];
    return id ? `<h${d} id="${id}">` : `<h${d}>`;
  });
  const safe = window.DOMPurify
    ? window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
    : html;
  return { html: safe, toc };
}

async function __fetchJarvisSpec(force = false) {
  if (!force && __jarvisLabSpecCache) return __jarvisLabSpecCache;
  const res = await fetch("./jarvis/spec.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  __jarvisLabSpecCache = json;
  return json;
}

function __invalidateJarvisSpecCache() {
  __jarvisLabSpecCache = null;
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

const JL_FREQ_LABEL = {
  realtime: "Temps réel",
  daily:    "Quotidien",
  weekly:   "Hebdo",
  manual:   "Manuel",
  mixed:    "Mixte",
};

function JLCockpitTabCard({ tab, onFocusSpec, onNavigate }) {
  const handleCardClick = () => {
    if (!tab.id) return;
    if (onFocusSpec) { onFocusSpec(tab.id); return; }
    if (onNavigate) onNavigate(tab.id);
  };
  const handleOpenClick = (e) => {
    e.stopPropagation();
    if (onNavigate && tab.id) onNavigate(tab.id);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className="jl-tab-card"
      data-frequency={tab.frequency}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
      title={`Voir la spec de ${tab.label}`}
    >
      <div className="jl-tab-head">
        <div className="jl-tab-name">{tab.label}</div>
        <span className="jl-tab-freq">{JL_FREQ_LABEL[tab.frequency] || tab.frequency}</span>
      </div>
      <p className="jl-tab-desc">{tab.description}</p>
      <div className="jl-tab-sources">
        {tab.data_sources.map((ds, i) => (
          <span key={i} className="jl-tab-source">{ds}</span>
        ))}
      </div>
      {tab.update_details && (
        <div className="jl-tab-detail">{tab.update_details}</div>
      )}
      <div className="jl-tab-foot">
        <span className="jl-tab-file">{tab.panel_file}</span>
        <button
          type="button"
          className="jl-tab-open"
          onClick={handleOpenClick}
          title={`Ouvrir l'onglet ${tab.label}`}
        >
          Ouvrir ↗
        </button>
      </div>
    </div>
  );
}

function JLCockpitSpecs({ spec, onFocusSpec, onNavigate }) {
  const ct = spec.cockpit_tabs;
  if (!ct || !Array.isArray(ct.groups)) return null;
  const totalTabs = ct.groups.reduce((s, g) => s + (g.tabs || []).length, 0);
  return (
    <section className="jl-specs">
      <div className="jl-specs-head">
        <div className="jl-section-eyebrow">Specs cockpit</div>
        <h2 className="jl-specs-title">Catalogue des onglets</h2>
        <p className="jl-specs-sub">
          {totalTabs} onglets · {ct.groups.length} groupes ·
          {ct.summary ? ` ${ct.summary}` : ""}
        </p>
      </div>
      {ct.groups.map(group => (
        <div key={group.id} className="jl-tab-group">
          <div className="jl-tab-group-header">
            <span className="jl-tab-group-name">{group.label}</span>
            <span className="jl-tab-group-count">{(group.tabs || []).length}</span>
          </div>
          <div className="jl-tab-grid">
            {(group.tabs || []).map(t => (
              <JLCockpitTabCard key={t.id} tab={t} onFocusSpec={onFocusSpec} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </section>
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

const JL_SCOPE_ORDER = ["pro", "perso", "mixte"];
const JL_SCOPE_LABEL = { pro: "Pro", perso: "Perso", mixte: "Mixte" };

function JLSpecStatusBadge({ status }) {
  if (status === "stub") {
    return <span className="jl-spec-badge jl-spec-badge--stub">à documenter</span>;
  }
  return <span className="jl-spec-badge jl-spec-badge--documented">documentée</span>;
}

function JLSpecsSidebar({ tabs, selectedSlug, onSelect }) {
  const groups = {};
  tabs.forEach(t => {
    const sc = JL_SCOPE_ORDER.includes(t.scope) ? t.scope : "mixte";
    (groups[sc] = groups[sc] || []).push(t);
  });
  Object.values(groups).forEach(arr => {
    arr.sort((a, b) => {
      const as = a.status === "stub" ? 1 : 0;
      const bs = b.status === "stub" ? 1 : 0;
      if (as !== bs) return as - bs;
      return (a.order || 0) - (b.order || 0);
    });
  });

  return (
    <aside className="jl-specs-sidebar" aria-label="Liste des specs">
      {JL_SCOPE_ORDER.map(sc => {
        const arr = groups[sc];
        if (!arr || !arr.length) return null;
        return (
          <div key={sc} className="jl-specs-scope">
            <div className="jl-specs-scope-label">
              {JL_SCOPE_LABEL[sc]}
              <span className="jl-specs-scope-count">{arr.length}</span>
            </div>
            <ul className="jl-specs-nav">
              {arr.map(t => (
                <li key={t.slug}>
                  <button
                    type="button"
                    className={`jl-specs-nav-item ${t.slug === selectedSlug ? "is-active" : ""}`}
                    data-status={t.status}
                    onClick={() => onSelect(t.slug)}
                  >
                    <span className="jl-specs-nav-title">{t.title}</span>
                    {t.status === "stub" && (
                      <span className="jl-specs-nav-stub" aria-label="Stub">todo</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}

function JLSpecsMobileSelect({ tabs, selectedSlug, onSelect }) {
  return (
    <div className="jl-specs-mobile-select">
      <label className="jl-specs-mobile-label">Spec</label>
      <select
        value={selectedSlug || ""}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">— Choisir un onglet —</option>
        {tabs.map(t => (
          <option key={t.slug} value={t.slug}>
            {t.title}{t.status === "stub" ? "  (à documenter)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function JLSpecsDoc({ tab, mdState, onOpenTab }) {
  if (!tab) {
    return (
      <div className="jl-specs-doc-empty">
        <div className="jl-specs-doc-empty-title">Aucune spec sélectionnée</div>
        <p>Choisis un onglet dans la colonne de gauche pour lire sa spec détaillée.</p>
      </div>
    );
  }

  const scopeKey = JL_SCOPE_ORDER.includes(tab.scope) ? tab.scope : "mixte";
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  let body;
  if (tab.status === "stub") {
    body = (
      <div className="jl-specs-doc-stub">
        <p><strong>Cette spec est un stub.</strong></p>
        <p>Le fichier <code>docs/specs/tab-{tab.slug}.md</code> n'a pas encore été rédigé — ou a été marqué comme incomplet dans l'index.</p>
      </div>
    );
  } else if (mdState.err) {
    body = (
      <div className="jl-error">
        Impossible de charger <code>docs/specs/tab-{tab.slug}.md</code> — {mdState.err.message}
      </div>
    );
  } else if (mdState.loading || !mdState.parsed) {
    body = <div className="jl-loading">Chargement de la spec…</div>;
  } else {
    body = (
      <div
        className="jl-specs-doc-body"
        dangerouslySetInnerHTML={{ __html: mdState.parsed.html }}
      />
    );
  }

  const toc = mdState.parsed?.toc || [];

  return (
    <div className="jl-specs-doc-wrap">
      <article className="jl-specs-doc">
        <header className="jl-specs-doc-header">
          <div className="jl-specs-doc-meta">
            <span className={`jl-spec-badge jl-spec-badge--scope jl-spec-badge--scope-${scopeKey}`}>
              {JL_SCOPE_LABEL[scopeKey]}
            </span>
            <JLSpecStatusBadge status={tab.status} />
            {tab.last_updated && (
              <span className="jl-specs-doc-date">MAJ {tab.last_updated}</span>
            )}
          </div>
          <button
            type="button"
            className="jl-specs-doc-open"
            onClick={() => onOpenTab && onOpenTab(tab.dom_id || tab.slug)}
            title={`Ouvrir l'onglet ${tab.title}`}
          >
            Ouvrir l'onglet →
          </button>
        </header>
        {body}
      </article>
      {toc.length > 0 && (
        <aside className="jl-specs-toc" aria-label="Sommaire de la spec">
          <div className="jl-specs-toc-label">Sections</div>
          <ul>
            {toc.map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => scrollTo(item.id)}>
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

function JLSpecsViewer({ onOpenTab, selectedSlug, onSelectSlug, forwardRef }) {
  const [index, setIndex] = useJLState(__jlSpecsIndexCache);
  const [indexErr, setIndexErr] = useJLState(null);
  const [mdState, setMdState] = useJLState({ loading: false, parsed: null, err: null });
  const setSelectedSlug = onSelectSlug;

  useJLEffect(() => {
    if (index) return;
    let cancelled = false;
    __fetchSpecsIndex()
      .then(json => { if (!cancelled) setIndex(json); })
      .catch(e => {
        if (cancelled) return;
        console.error("[jarvis-lab] specs index load failed", e);
        setIndexErr(e);
      });
    return () => { cancelled = true; };
  }, []);

  const tabs = useJLMemo(() => {
    const arr = index?.tabs || [];
    return arr.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [index]);

  const selectedTab = tabs.find(t => t.slug === selectedSlug) || null;

  useJLEffect(() => {
    if (!selectedTab || selectedTab.status === "stub") {
      setMdState({ loading: false, parsed: null, err: null });
      return;
    }
    let cancelled = false;
    setMdState({ loading: true, parsed: null, err: null });
    __fetchSpecMd(selectedTab.slug)
      .then(src => {
        if (cancelled) return;
        setMdState({ loading: false, parsed: __parseSpecMd(src), err: null });
      })
      .catch(e => {
        if (cancelled) return;
        console.error(`[jarvis-lab] md load failed for ${selectedTab.slug}`, e);
        setMdState({ loading: false, parsed: null, err: e });
      });
    return () => { cancelled = true; };
  }, [selectedTab && selectedTab.slug]);

  if (indexErr) {
    return (
      <section className="jl-specs-viewer" ref={forwardRef}>
        <div className="jl-specs-head">
          <div className="jl-section-eyebrow">Specs détaillées</div>
          <h2 className="jl-specs-title">Parcours de la documentation</h2>
        </div>
        <div className="jl-error">
          Impossible de charger <code>docs/specs/index.json</code> — {indexErr.message}
        </div>
      </section>
    );
  }
  if (!index) {
    return (
      <section className="jl-specs-viewer" ref={forwardRef}>
        <div className="jl-specs-head">
          <div className="jl-section-eyebrow">Specs détaillées</div>
          <h2 className="jl-specs-title">Parcours de la documentation</h2>
        </div>
        <div className="jl-loading">Chargement de l'index…</div>
      </section>
    );
  }

  const documented = tabs.filter(t => t.status !== "stub").length;
  const stubs = tabs.length - documented;

  return (
    <section className="jl-specs-viewer" ref={forwardRef}>
      <div className="jl-specs-head">
        <div className="jl-section-eyebrow">Specs détaillées</div>
        <h2 className="jl-specs-title">Parcours de la documentation</h2>
        <p className="jl-specs-sub">
          {tabs.length} onglets · {documented} documentée{documented > 1 ? "s" : ""}
          {stubs > 0 ? ` · ${stubs} à documenter` : ""}
          {" · source : "}<code>docs/specs/*.md</code>
        </p>
      </div>
      <JLSpecsMobileSelect
        tabs={tabs}
        selectedSlug={selectedSlug}
        onSelect={setSelectedSlug}
      />
      <div className="jl-specs-viewer-grid">
        <JLSpecsSidebar
          tabs={tabs}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />
        <JLSpecsDoc
          tab={selectedTab}
          mdState={mdState}
          onOpenTab={onOpenTab}
        />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ARCHITECTURE VIEWER — 4 vues lues depuis docs/architecture/*.yaml
// (layers.yaml, flows/*.yaml, pipelines.yaml, dependencies.yaml).
// Cache module-level, rendu SVG custom pour routage contrôlé.
// ═══════════════════════════════════════════════════════════════

const __jlArchCache = {};

async function __fetchArchYaml(path) {
  if (__jlArchCache[path] !== undefined) return __jlArchCache[path];
  const res = await fetch(`./docs/architecture/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  const txt = await res.text();
  if (!window.jsyaml) throw new Error("js-yaml library not loaded (check index.html CDN)");
  const data = window.jsyaml.load(txt);
  __jlArchCache[path] = data;
  return data;
}

// ----- Couches (vue en couches Front / Middle / Back) -----

const ARCH_W = 1100;
const ARCH_LAYER_H = 210;
const ARCH_GUTTER_H = 54;
const ARCH_LABEL_BAND_W = 64;
const ARCH_PAD_X = 24;
const ARCH_BOX_PAD_V = 28;
const ARCH_BOX_GAP = 16;
const ARCH_RIGHT_RAIL_X = 1014;
const ARCH_LEGEND_H = 64;

function __archLayerYs() {
  return {
    front: 0,
    middle: ARCH_LAYER_H + ARCH_GUTTER_H,
    back: 2 * (ARCH_LAYER_H + ARCH_GUTTER_H),
  };
}

function __archLayerRects(n) {
  const xStart = ARCH_LABEL_BAND_W + ARCH_PAD_X;
  const xEnd = ARCH_W - ARCH_PAD_X - 40;
  const avail = xEnd - xStart;
  const bw = Math.max(140, (avail - (n - 1) * ARCH_BOX_GAP) / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: xStart + i * (bw + ARCH_BOX_GAP), w: bw });
  }
  return out;
}

function __archComputePositions(layers) {
  const ys = __archLayerYs();
  const out = {};
  for (const layer of layers) {
    const rects = __archLayerRects(layer.boxes.length);
    const yTop = ys[layer.id] + ARCH_BOX_PAD_V;
    const h = ARCH_LAYER_H - 2 * ARCH_BOX_PAD_V;
    layer.boxes.forEach((b, i) => {
      out[`${layer.id}.${b.id}`] = {
        x: rects[i].x, y: yTop, w: rects[i].w, h,
        box: b, layerId: layer.id,
      };
    });
  }
  return out;
}

function ArchBox({ rect }) {
  const { x, y, w, h, box } = rect;
  return (
    <g className={`jl-arch-box ${box.accent ? "is-accent" : ""}`}>
      <rect x={x} y={y} width={w} height={h} rx={12} />
      <text x={x + 14} y={y + 26} className="jl-arch-box-title">{box.title}</text>
      <text x={x + 14} y={y + 48} className="jl-arch-box-subtitle">{box.subtitle}</text>
      {(box.meta || []).slice(0, 2).map((m, i) => (
        <text key={i} x={x + 14} y={y + 74 + i * 18} className="jl-arch-box-meta">{m}</text>
      ))}
    </g>
  );
}

function ArchEdgeLabel({ x, y, text, type }) {
  const w = Math.max(60, text.length * 6.5 + 14);
  const h = 18;
  return (
    <g className={`jl-arch-edge-label is-${type}`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} className="jl-arch-edge-label-bg" />
      <text x={x} y={y + 4} textAnchor="middle" className="jl-arch-edge-label-text">{text}</text>
    </g>
  );
}

function ArchEdge({ edge, rects }) {
  const src = rects[edge.from];
  const tgt = rects[edge.to];
  if (!src || !tgt) return null;
  const type = edge.type || "adjacent";
  const srcCx = src.x + src.w / 2;
  const tgtCx = tgt.x + tgt.w / 2;
  let path = "";
  let labelX = 0, labelY = 0;

  if (type === "intra_layer") {
    const srcLeft = src.x < tgt.x;
    const x1 = srcLeft ? src.x + src.w : src.x;
    const x2 = srcLeft ? tgt.x : tgt.x + tgt.w;
    const y = src.y + src.h / 2;
    path = `M ${x1} ${y} L ${x2} ${y}`;
    labelX = (x1 + x2) / 2;
    labelY = y - 10;
  } else if (type === "adjacent") {
    const srcAbove = src.y < tgt.y;
    const y1 = srcAbove ? src.y + src.h : src.y;
    const y2 = srcAbove ? tgt.y : tgt.y + tgt.h;
    const gutterMid = (y1 + y2) / 2;
    if (Math.abs(srcCx - tgtCx) < 1) {
      path = `M ${srcCx} ${y1} L ${srcCx} ${y2}`;
      labelX = srcCx;
      labelY = gutterMid;
    } else {
      path = `M ${srcCx} ${y1} L ${srcCx} ${gutterMid} L ${tgtCx} ${gutterMid} L ${tgtCx} ${y2}`;
      labelX = (srcCx + tgtCx) / 2;
      labelY = gutterMid - 8;
    }
  } else if (type === "cross_layer") {
    const sy = src.y + src.h / 2;
    const ty = tgt.y + tgt.h / 2;
    const rx = ARCH_RIGHT_RAIL_X;
    path = `M ${src.x + src.w} ${sy} L ${rx} ${sy} L ${rx} ${ty} L ${tgt.x + tgt.w} ${ty}`;
    labelX = rx - 70;
    labelY = (sy + ty) / 2;
  }

  return (
    <g className={`jl-arch-edge is-${type}`}>
      <path d={path} className="jl-arch-edge-line" fill="none" />
      <ArchEdgeLabel x={labelX} y={labelY} text={edge.label} type={type} />
    </g>
  );
}

function ArchLayerBand({ layer, y }) {
  return (
    <g className="jl-arch-layer">
      <rect
        x={ARCH_LABEL_BAND_W}
        y={y}
        width={ARCH_W - ARCH_LABEL_BAND_W}
        height={ARCH_LAYER_H}
        className="jl-arch-layer-bg"
      />
      <text
        className="jl-arch-layer-label"
        x={ARCH_LABEL_BAND_W / 2}
        y={y + ARCH_LAYER_H / 2}
        textAnchor="middle"
        transform={`rotate(-90, ${ARCH_LABEL_BAND_W / 2}, ${y + ARCH_LAYER_H / 2})`}
      >{layer.label}</text>
      <text
        className="jl-arch-layer-sublabel"
        x={ARCH_LABEL_BAND_W / 2 + 18}
        y={y + ARCH_LAYER_H / 2}
        textAnchor="middle"
        transform={`rotate(-90, ${ARCH_LABEL_BAND_W / 2 + 18}, ${y + ARCH_LAYER_H / 2})`}
      >{layer.sublabel}</text>
    </g>
  );
}

function ArchCouchesView({ data }) {
  const rects = useJLMemo(() => __archComputePositions(data.layers || []), [data]);
  const ys = __archLayerYs();
  const totalH = 3 * ARCH_LAYER_H + 2 * ARCH_GUTTER_H + ARCH_LEGEND_H;
  const legendY = 3 * ARCH_LAYER_H + 2 * ARCH_GUTTER_H + 22;

  return (
    <div className="jl-arch-svg-wrap">
      <svg
        className="jl-arch-couches-svg"
        viewBox={`0 0 ${ARCH_W} ${totalH}`}
        role="img"
        aria-label="Vue en couches Front / Middle / Back"
      >
        {(data.layers || []).map((l) => (
          <ArchLayerBand key={l.id} layer={l} y={ys[l.id]} />
        ))}
        {Object.values(rects).map((r) => (
          <ArchBox key={`${r.layerId}.${r.box.id}`} rect={r} />
        ))}
        {(data.edges || []).map((e) => (
          <ArchEdge key={e.id} edge={e} rects={rects} />
        ))}
        <g transform={`translate(${ARCH_LABEL_BAND_W + ARCH_PAD_X}, ${legendY})`} className="jl-arch-legend">
          <line x1="0" y1="8" x2="28" y2="8" className="jl-arch-legend-rail" />
          <text x="36" y="12" className="jl-arch-legend-text">rail orange = saut de couche</text>
          <line x1="280" y1="8" x2="308" y2="8" className="jl-arch-legend-line" />
          <text x="316" y="12" className="jl-arch-legend-text">traits gris = appel interne</text>
          <rect x="520" y="2" width="14" height="14" className="jl-arch-legend-accent-box" />
          <text x="542" y="12" className="jl-arch-legend-text">bord orange = composant pivot</text>
        </g>
      </svg>
    </div>
  );
}

// ----- Flux par domaine (4 colonnes linéaires) -----

const __ARCH_FLOW_SLUGS = [
  "veille-ia", "jarvis-rag", "perso-strava",
  "perso-withings", "perso-lastfm", "perso-steam",
  "tft", "business-opps", "activity-briefs",
];

function FlowCol({ label, items }) {
  return (
    <div className="jl-arch-flow-col">
      <div className="jl-arch-flow-col-label">{label}</div>
      <div className="jl-arch-flow-col-items">
        {items.map((it, i) => (
          <div key={i} className={`jl-arch-flow-item ${it.accent ? "is-accent" : ""}`}>
            <div className="jl-arch-flow-item-title">{it.title}</div>
            {it.sub && <div className="jl-arch-flow-item-sub">{it.sub}</div>}
            {it.extra && <div className="jl-arch-flow-item-extra">{it.extra}</div>}
            {it.components && (
              <ul className="jl-arch-flow-item-components">
                {it.components.map((c, j) => (
                  <li key={j}><code>{c.id}</code> — {c.detail || c.trigger || ""}</li>
                ))}
              </ul>
            )}
            {it.steps && (
              <ol className="jl-arch-flow-item-steps">
                {it.steps.slice(0, 5).map((s, j) => <li key={j}>{s}</li>)}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchFlowDiagram({ flow }) {
  const status = flow.status || "active";
  return (
    <div className={`jl-arch-flow-diagram is-${status}`}>
      <div className="jl-arch-flow-head">
        <div className="jl-arch-flow-label">{flow.label}</div>
        {status === "todo" && <span className="jl-arch-flow-badge">stub — à étoffer</span>}
      </div>
      <div className="jl-arch-flow-columns">
        <FlowCol
          label="Source API"
          items={(flow.source_api || []).map(x => ({ title: x.name, sub: "", extra: x.detail }))}
        />
        <FlowCol
          label="Pipeline"
          items={[{
            title: flow.pipeline?.id || "—",
            sub: flow.pipeline?.cron || flow.pipeline?.trigger || "",
            extra: flow.pipeline?.workflow || flow.pipeline?.script,
            steps: flow.pipeline?.steps,
            components: flow.pipeline?.components,
            accent: true,
          }]}
        />
        <FlowCol
          label="Tables Supabase"
          items={(flow.tables || []).map(t => ({
            title: t.name,
            sub: t.write ? "WRITE" : "READ",
            extra: t.detail,
            accent: !!t.write,
          }))}
        />
        <FlowCol
          label="Panels consommateurs"
          items={(flow.panels || []).map(p => ({ title: p.id, sub: "", extra: p.detail }))}
        />
      </div>
      {flow.notes && flow.notes.length > 0 && (
        <ul className="jl-arch-flow-notes">
          {flow.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

function ArchFlowsView() {
  const [slug, setSlug] = useJLState("veille-ia");
  const [data, setData] = useJLState(null);
  const [err, setErr] = useJLState(null);

  useJLEffect(() => {
    let cancelled = false;
    setData(null); setErr(null);
    __fetchArchYaml(`flows/${slug}.yaml`)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="jl-arch-flows">
      <div className="jl-arch-flows-picker">
        {__ARCH_FLOW_SLUGS.map(s => (
          <button
            key={s}
            type="button"
            className={`jl-arch-flow-pill ${slug === s ? "is-active" : ""}`}
            onClick={() => setSlug(s)}
          >{s}</button>
        ))}
      </div>
      {err && <div className="jl-arch-error">Erreur : {String(err.message || err)}</div>}
      {!err && !data && <div className="jl-arch-loading">Chargement de flows/{slug}.yaml…</div>}
      {data && <ArchFlowDiagram flow={data} />}
    </div>
  );
}

// ----- Timeline crons 24h -----

function ArchTimelineView() {
  const [data, setData] = useJLState(null);
  const [err, setErr] = useJLState(null);

  useJLEffect(() => {
    let cancelled = false;
    __fetchArchYaml("pipelines.yaml")
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e); });
    return () => { cancelled = true; };
  }, []);

  if (err) return <div className="jl-arch-error">Erreur : {String(err.message || err)}</div>;
  if (!data) return <div className="jl-arch-loading">Chargement de pipelines.yaml…</div>;

  const positioned = (data.pipelines || []).map(p => {
    const m = (p.cron || "").match(/^(\d+) (\d+) \* \* (\S+)$/);
    if (m) {
      const mn = parseInt(m[1], 10);
      const h = parseInt(m[2], 10);
      const dow = m[3];
      const minutesOfDay = h * 60 + mn;
      const xPct = (minutesOfDay / 1440) * 100;
      // dow "*" ou intervalle "1-5" = quotidien ; "0", "6", "0,3" = hebdo.
      const weekly = dow !== "*" && !dow.includes("-");
      return { ...p, _x: xPct, _dow: dow, _weekly: weekly };
    }
    if ((p.cron || "").includes("*/2")) {
      return { ...p, _x: null, _every2h: true };
    }
    return { ...p, _x: null };
  });

  const dailyPins = positioned.filter(p => p._x != null && !p._weekly);
  const weeklyPins = positioned.filter(p => p._weekly);
  const everyNh = positioned.filter(p => p._every2h);

  // Stagger vertically by proximity to avoid label overlap.
  dailyPins.sort((a, b) => a._x - b._x);
  let lastX = -100;
  let lane = 0;
  dailyPins.forEach(p => {
    if (p._x - lastX < 6) lane = (lane + 1) % 3;
    else lane = 0;
    p._lane = lane;
    lastX = p._x;
  });

  return (
    <div className="jl-arch-timeline">
      <div className="jl-arch-timeline-head">
        <div className="jl-arch-timeline-label">Timeline 24 h (UTC)</div>
        <div className="jl-arch-timeline-sub">
          {dailyPins.length} crons quotidiens positionnés · {everyNh.length} cron(s) toutes les 2 h · {weeklyPins.length} cron hebdo
        </div>
      </div>
      <div className="jl-arch-timeline-bar-wrap">
        <div className="jl-arch-timeline-bar">
          {Array.from({ length: 25 }, (_, i) => (
            <div
              key={i}
              className={`jl-arch-timeline-tick ${i % 6 === 0 ? "is-major" : ""}`}
              style={{ left: `${(i / 24) * 100}%` }}
            >
              {i % 3 === 0 && <span className="jl-arch-timeline-tick-label">{String(i).padStart(2, "0")}h</span>}
            </div>
          ))}
          {dailyPins.map(p => (
            <div
              key={p.id}
              className={`jl-arch-timeline-pin jl-arch-timeline-pin--lane-${p._lane || 0}`}
              style={{ left: `${p._x}%` }}
              title={`${p.name} — ${p.cron}`}
            >
              <div className="jl-arch-timeline-pin-line" />
              <div className="jl-arch-timeline-pin-label">
                <div className="jl-arch-timeline-pin-name">{p.id}</div>
                <div className="jl-arch-timeline-pin-time">{p.human_time}</div>
                <div className="jl-arch-timeline-pin-duration">~{p.avg_duration_s || "?"}s</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {everyNh.length > 0 && (
        <div className="jl-arch-timeline-note">
          <strong>Toutes les 2 h :</strong> {everyNh.map(p => p.id).join(", ")} (12 runs/jour).
        </div>
      )}
      {weeklyPins.length > 0 && (
        <div className="jl-arch-timeline-weekly">
          <strong>Cron hebdomadaire :</strong> {weeklyPins.map(p => `${p.id} — ${p.human_time}`).join(", ")}.
        </div>
      )}
    </div>
  );
}

// ----- Dépendances panel × table -----

function ArchDepsView() {
  const [data, setData] = useJLState(null);
  const [err, setErr] = useJLState(null);
  const [selectedPanel, setSelectedPanel] = useJLState("brief");

  useJLEffect(() => {
    let cancelled = false;
    __fetchArchYaml("dependencies.yaml")
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e); });
    return () => { cancelled = true; };
  }, []);

  if (err) return <div className="jl-arch-error">Erreur : {String(err.message || err)}</div>;
  if (!data) return <div className="jl-arch-loading">Chargement de dependencies.yaml…</div>;

  const panels = data.panels || [];
  const tablesByName = {};
  (data.tables || []).forEach(t => { tablesByName[t.name] = t; });
  const selected = panels.find(p => p.id === selectedPanel) || panels[0];

  return (
    <div className="jl-arch-deps">
      <div className="jl-arch-deps-panel-list">
        <div className="jl-arch-deps-list-label">Panels ({panels.length})</div>
        <div className="jl-arch-deps-list-items">
          {panels.map(p => {
            const reads = (p.reads || []).length;
            const writes = (p.writes || []).length;
            return (
              <button
                key={p.id}
                type="button"
                className={`jl-arch-deps-panel-item ${(selected && selected.id === p.id) ? "is-active" : ""}`}
                onClick={() => setSelectedPanel(p.id)}
              >
                <span className="jl-arch-deps-panel-name">{p.id}</span>
                <span className="jl-arch-deps-panel-counts">
                  {reads > 0 && <span className="jl-arch-deps-r">R{reads}</span>}
                  {writes > 0 && <span className="jl-arch-deps-w">W{writes}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="jl-arch-deps-detail">
          <div className="jl-arch-deps-head">
            <div className="jl-arch-deps-title">{selected.id}</div>
            <div className="jl-arch-deps-file"><code>{selected.file}</code></div>
          </div>
          {(selected.reads || []).length > 0 && (
            <div className="jl-arch-deps-group">
              <div className="jl-arch-deps-group-label">Lit ({selected.reads.length})</div>
              <div className="jl-arch-deps-group-items">
                {selected.reads.map(t => (
                  <div key={t} className="jl-arch-deps-chip is-read">
                    <span className="jl-arch-deps-chip-name">{t}</span>
                    {tablesByName[t] && (
                      <span className="jl-arch-deps-chip-rls">{tablesByName[t].rls}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(selected.writes || []).length > 0 && (
            <div className="jl-arch-deps-group">
              <div className="jl-arch-deps-group-label">Écrit ({selected.writes.length})</div>
              <div className="jl-arch-deps-group-items">
                {selected.writes.map(t => (
                  <div key={t} className="jl-arch-deps-chip is-write">
                    <span className="jl-arch-deps-chip-name">{t}</span>
                    {tablesByName[t] && (
                      <span className="jl-arch-deps-chip-rls">{tablesByName[t].rls}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(selected.rpcs || []).length > 0 && (
            <div className="jl-arch-deps-group">
              <div className="jl-arch-deps-group-label">RPCs</div>
              <div className="jl-arch-deps-group-items">
                {selected.rpcs.map(r => (
                  <div key={r} className="jl-arch-deps-chip is-rpc">
                    <span className="jl-arch-deps-chip-name">/rpc/{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(selected.external || []).length > 0 && (
            <div className="jl-arch-deps-group">
              <div className="jl-arch-deps-group-label">Appels externes</div>
              <ul className="jl-arch-deps-external">
                {selected.external.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {(selected.static_sources || []).length > 0 && (
            <div className="jl-arch-deps-group">
              <div className="jl-arch-deps-group-label">Sources statiques</div>
              <ul className="jl-arch-deps-external">
                {selected.static_sources.map((s, i) => <li key={i}><code>{s}</code></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----- Viewer racine (4 onglets) -----

function JLArchitectureViewer() {
  const [tab, setTab] = useJLState("couches");
  const [layersData, setLayersData] = useJLState(null);
  const [layersErr, setLayersErr] = useJLState(null);

  useJLEffect(() => {
    if (tab !== "couches" || layersData) return;
    let cancelled = false;
    __fetchArchYaml("layers.yaml")
      .then(d => { if (!cancelled) setLayersData(d); })
      .catch(e => { if (!cancelled) setLayersErr(e); });
    return () => { cancelled = true; };
  }, [tab, layersData]);

  const TABS = [
    { id: "couches", label: "Couches" },
    { id: "flux", label: "Flux par domaine" },
    { id: "timeline", label: "Timeline crons" },
    { id: "deps", label: "Dépendances" },
  ];

  return (
    <section className="jl-arch-section" id="jarvis-lab-architecture">
      <div className="jl-arch-section-head">
        <div className="jl-arch-section-eyebrow">ARCHITECTURE</div>
        <h2 className="jl-arch-section-title">Comment tout s'emboîte</h2>
        <p className="jl-arch-section-sub">
          Vue macro des couches, flux par domaine, timeline des crons et dépendances panel ↔ table.
          Source&nbsp;: <code>docs/architecture/*.yaml</code> versionnés. Éditer un YAML recharge
          automatiquement la vue correspondante au prochain reload.
        </p>
      </div>
      <div className="jl-arch-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`jl-arch-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>
      <div className="jl-arch-tab-body">
        {tab === "couches" && (
          <>
            {layersErr && <div className="jl-arch-error">Erreur : {String(layersErr.message || layersErr)}</div>}
            {!layersErr && !layersData && <div className="jl-arch-loading">Chargement de layers.yaml…</div>}
            {layersData && <ArchCouchesView data={layersData} />}
          </>
        )}
        {tab === "flux" && <ArchFlowsView />}
        {tab === "timeline" && <ArchTimelineView />}
        {tab === "deps" && <ArchDepsView />}
      </div>
    </section>
  );
}

function PanelJarvisLab({ onNavigate }) {
  const [spec, setSpec] = useJLState(__jarvisLabSpecCache);
  const [err, setErr] = useJLState(null);
  const [selectedPhaseId, setSelectedPhaseId] = useJLState(null);
  const [drawerRef, setDrawerRef] = useJLState(null);
  const [drawerOpen, setDrawerOpen] = useJLState(false);
  const [filterStatus, setFilterStatus] = useJLState("all");
  const [filterScope, setFilterScope] = useJLState("all");
  const [refreshing, setRefreshing] = useJLState(false);
  const [specsFocusedSlug, setSpecsFocusedSlug] = useJLState(null);
  const lastOpenerRef = useJLRef(null);
  const specsViewerRef = useJLRef(null);

  const focusSpec = (tabId) => {
    if (!tabId) return;
    const slug = String(tabId).replace(/_/g, "-");
    setSpecsFocusedSlug(slug);
    requestAnimationFrame(() => {
      const el = specsViewerRef.current;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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

  const refreshSpec = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setErr(null);
    try {
      __invalidateJarvisSpecCache();
      const json = await __fetchJarvisSpec(true);
      setSpec(json);
    } catch (e) {
      console.error("[jarvis-lab] refresh failed", e);
      setErr(e);
    } finally {
      setRefreshing(false);
    }
  };

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
        <div className="jl-header-main">
          <div className="jl-title">JARVIS LAB</div>
          <div className="jl-subtitle">
            Source : jarvis/spec.json · Dernière MAJ : {spec.meta?.updated_at || "—"}
          </div>
        </div>
        <button
          type="button"
          className="jl-refresh-btn"
          onClick={refreshSpec}
          disabled={refreshing}
          title="Recharger spec.json (vide le cache)"
        >
          {refreshing ? "Rechargement…" : "Rafraîchir"}
        </button>
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

      <JLCockpitSpecs spec={spec} onFocusSpec={focusSpec} onNavigate={onNavigate} />

      <JLArchitectureViewer />

      <JLSpecsViewer
        onOpenTab={onNavigate}
        selectedSlug={specsFocusedSlug}
        onSelectSlug={setSpecsFocusedSlug}
        forwardRef={specsViewerRef}
      />

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
