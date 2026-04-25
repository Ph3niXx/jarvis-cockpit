// ═══════════════════════════════════════════════════════════════
// PANEL VEILLE OUTILS — 2 sous-onglets
//   1. Veille hebdo : synthèse Cowork classée en 4 buckets
//   2. Catalogue écosystème : répertoire stable des outils inbound/outbound
// ═══════════════════════════════════════════════════════════════

window.VEILLE_OUTILS_DATA = window.VEILLE_OUTILS_DATA || {
  items: [],
  summary: null,
  last_run: null,
  total: 0,
  by_category: {},
  ecosystem: [],
};

// ── Veille hebdo ───────────────────────────────────────────────
const VO_CATEGORIES = [
  { id: "jarvis_applicable",   label: "Applicables Jarvis",         hint: "Ce qui peut concrètement améliorer le cockpit ou Jarvis." },
  { id: "claude_general",      label: "Claude — usage général",     hint: "Bonnes pratiques pour Claude Code / Cowork au quotidien." },
  { id: "complementary_tools", label: "Outils complémentaires",     hint: "MCP, plugins, libs tierces autour de Claude." },
  { id: "other_news",          label: "Autres news",                hint: "Releases ou articles notables sans action immédiate." },
];

const VO_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const VO_EFFORT_ORDER   = { XS: 0, S: 1, M: 2, L: 3 };
const VO_STATUS_LABEL   = {
  new: "Nouveau",
  in_progress: "En cours",
  applied: "Appliqué",
  dismissed: "Écarté",
};
const VO_STATUS_NEXT = {
  new: ["in_progress", "applied", "dismissed"],
  in_progress: ["applied", "dismissed", "new"],
  applied: ["in_progress", "new"],
  dismissed: ["new", "in_progress"],
};

// ── Catalogue écosystème ───────────────────────────────────────
const VO_DIRECTIONS = [
  { id: "inbound",  label: "Se pluggent à Claude", desc: "MCP servers, skills, plugins — ce qui enrichit Claude." },
  { id: "outbound", label: "Claude s'y plugge",     desc: "SDKs, IDE, frameworks — où on utilise Claude comme moteur." },
];
const VO_ECO_TYPES = [
  { id: "mcp_server",      label: "MCP" },
  { id: "skill",           label: "Skill" },
  { id: "cowork_plugin",   label: "Plugin Cowork" },
  { id: "ide_integration", label: "IDE" },
  { id: "framework",       label: "Framework" },
  { id: "connector",       label: "Connecteur" },
  { id: "sdk",             label: "SDK" },
  { id: "agent_runtime",   label: "Agent" },
  { id: "other",           label: "Autre" },
];
const VO_ECO_TYPE_LABEL = Object.fromEntries(VO_ECO_TYPES.map(t => [t.id, t.label]));

// ── Helpers ────────────────────────────────────────────────────
function voSafeHtml(md) {
  try {
    if (!md) return "";
    const raw = window.marked ? window.marked.parse(String(md)) : String(md).replace(/\n/g, "<br>");
    return window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
  } catch {
    return "";
  }
}

function voFormatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function voSlugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// ── Badges (partagés veille + catalogue) ───────────────────────
function VOPriorityBadge({ p }) {
  if (!p) return null;
  return <span className={`vo-pri vo-pri--${p}`}>{p === "high" ? "haute" : p === "medium" ? "moy." : "basse"}</span>;
}
function VOEffortBadge({ e }) {
  if (!e) return null;
  return <span className="vo-eff" title={`Effort estimé : ${e}`}>{e}</span>;
}
function VOStatusBadge({ s }) {
  return <span className={`vo-status vo-status--${s}`}>{VO_STATUS_LABEL[s] || s}</span>;
}
function VODirectionBadge({ d }) {
  if (!d) return null;
  return <span className={`vo-dir vo-dir--${d}`}>{d === "inbound" ? "↘ inbound" : d === "outbound" ? "↗ outbound" : "↔ both"}</span>;
}
function VOEcoTypeBadge({ t }) {
  if (!t) return null;
  return <span className={`vo-eco-type vo-eco-type--${t}`}>{VO_ECO_TYPE_LABEL[t] || t}</span>;
}

// ─── Synthèse exécutive (_summary row) ─────────────────────────
function VOSummaryHero({ summary, lastRun }) {
  if (!summary) return null;
  return (
    <article className="vo-summary">
      <div className="vo-summary-eyebrow">
        Synthèse exécutive · {voFormatDate(lastRun || summary.run_date)}
      </div>
      <h2 className="vo-summary-title">{summary.title || "Synthèse de la semaine"}</h2>
      <div
        className="vo-summary-body"
        dangerouslySetInnerHTML={{ __html: voSafeHtml(summary.summary) }}
      />
    </article>
  );
}

// ─── Veille hebdo : item card ──────────────────────────────────
function VOItemCard({ item, onPatch, busy }) {
  const [notes, setNotes] = React.useState(item.notes || "");
  const [notesDirty, setNotesDirty] = React.useState(false);
  const [howOpen, setHowOpen] = React.useState(item.category === "jarvis_applicable");

  React.useEffect(() => {
    setNotes(item.notes || "");
    setNotesDirty(false);
  }, [item.id, item.notes]);

  const saveNotes = () => {
    if (!notesDirty) return;
    onPatch(item.id, { notes });
    setNotesDirty(false);
  };

  const onStatus = (next) => {
    if (busy || next === item.status) return;
    onPatch(item.id, { status: next });
  };

  const hostname = (() => {
    try { return item.source_url ? new URL(item.source_url).hostname.replace(/^www\./, "") : null; }
    catch { return null; }
  })();

  return (
    <article className={`vo-card vo-card--${item.category} vo-card--${item.status} ${busy ? "is-busy" : ""}`}>
      <header className="vo-card-head">
        <div className="vo-card-meta">
          <VOStatusBadge s={item.status} />
          <VOPriorityBadge p={item.priority} />
          <VOEffortBadge e={item.effort} />
          {item.source_name && <span className="vo-card-src">{item.source_name}</span>}
        </div>
        <h3 className="vo-card-title">
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.title}</a>
          ) : item.title}
        </h3>
        {hostname && <div className="vo-card-host">{hostname}</div>}
      </header>

      {item.summary && (
        <p className="vo-card-summary">{item.summary}</p>
      )}

      {item.applicability && (
        <div className="vo-card-applic">
          <div className="vo-card-applic-label">Applicabilité</div>
          <div>{item.applicability}</div>
        </div>
      )}

      {item.how_to_apply && (
        <div className="vo-card-how">
          <button
            className="vo-card-how-toggle"
            onClick={() => setHowOpen(o => !o)}
            aria-expanded={howOpen}
          >
            <span>{howOpen ? "▾" : "▸"} Comment l'appliquer</span>
          </button>
          {howOpen && (
            <div
              className="vo-card-how-body"
              dangerouslySetInnerHTML={{ __html: voSafeHtml(item.how_to_apply) }}
            />
          )}
        </div>
      )}

      {item.trend_context && (
        <div className="vo-card-trend">
          <span className="vo-card-trend-label">Tendance</span> {item.trend_context}
        </div>
      )}

      <div className="vo-card-actions">
        <div className="vo-card-status-menu">
          {(VO_STATUS_NEXT[item.status] || []).map(n => (
            <button
              key={n}
              className={`vo-card-status-btn vo-card-status-btn--${n}`}
              onClick={() => onStatus(n)}
              disabled={busy}
            >
              → {VO_STATUS_LABEL[n]}
            </button>
          ))}
        </div>

        <textarea
          className="vo-card-notes"
          placeholder="Notes perso (sauvegardé en quittant le champ)"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
          onBlur={saveNotes}
          disabled={busy}
          rows={2}
        />
      </div>
    </article>
  );
}

// ─── Section par catégorie (veille hebdo) ──────────────────────
function VOSection({ category, items, onPatch, pending }) {
  if (!items.length) return null;
  return (
    <section className={`vo-section vo-section--${category.id}`}>
      <div className="vo-section-head">
        <h3 className="vo-section-title">{category.label}</h3>
        <span className="vo-section-count">{items.length}</span>
        <span className="vo-section-hint">{category.hint}</span>
      </div>
      <div className="vo-section-list">
        {items.map(it => (
          <VOItemCard
            key={it.id}
            item={it}
            onPatch={onPatch}
            busy={!!(pending && pending[it.id])}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Catalogue : item card ─────────────────────────────────────
function VOEcoCard({ item, onPatch, busy }) {
  const [notes, setNotes] = React.useState(item.user_notes || "");
  const [notesDirty, setNotesDirty] = React.useState(false);
  const [hintOpen, setHintOpen] = React.useState(false);
  const [appOpen, setAppOpen]   = React.useState(false);

  React.useEffect(() => {
    setNotes(item.user_notes || "");
    setNotesDirty(false);
  }, [item.id, item.user_notes]);

  const saveNotes = () => {
    if (!notesDirty) return;
    onPatch(item.id, { user_notes: notes });
    setNotesDirty(false);
  };

  const togglePin = () => onPatch(item.id, { is_pinned: !item.is_pinned });
  const setPriority = (p) => onPatch(item.id, { user_priority: p === item.user_priority ? null : p });
  const setStatus = (s) => onPatch(item.id, { status: s });

  return (
    <article className={`vo-eco-card vo-eco-card--${item.direction} vo-eco-card--${item.status} ${item.is_pinned ? "vo-eco-card--pinned" : ""} ${busy ? "is-busy" : ""}`}>
      <div className="vo-eco-card-head">
        <div className="vo-eco-card-meta">
          <VODirectionBadge d={item.direction} />
          <VOEcoTypeBadge t={item.type} />
          {item.vendor && <span className="vo-eco-card-vendor">{item.vendor}</span>}
        </div>
        <button
          className={`vo-eco-pin ${item.is_pinned ? "is-active" : ""}`}
          onClick={togglePin}
          disabled={busy}
          title={item.is_pinned ? "Désépingler" : "Épingler en haut"}
          aria-label="Épingler"
        >
          {item.is_pinned ? "★" : "☆"}
        </button>
      </div>

      <h4 className="vo-eco-card-title">
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.name}</a>
        ) : item.name}
      </h4>

      {item.description && <p className="vo-eco-card-desc">{item.description}</p>}

      {item.applicability && (
        <div className="vo-eco-card-collapse">
          <button className="vo-eco-card-collapse-toggle" onClick={() => setAppOpen(o => !o)}>
            {appOpen ? "▾" : "▸"} Applicabilité projet
          </button>
          {appOpen && <div className="vo-eco-card-collapse-body">{item.applicability}</div>}
        </div>
      )}

      {item.install_hint && (
        <div className="vo-eco-card-collapse">
          <button className="vo-eco-card-collapse-toggle" onClick={() => setHintOpen(o => !o)}>
            {hintOpen ? "▾" : "▸"} Comment l'installer / tester
          </button>
          {hintOpen && (
            <div className="vo-eco-card-collapse-body">
              <code>{item.install_hint}</code>
            </div>
          )}
        </div>
      )}

      {Array.isArray(item.tags) && item.tags.length > 0 && (
        <div className="vo-eco-card-tags">
          {item.tags.slice(0, 8).map(t => (
            <span key={t} className="vo-eco-tag">#{t}</span>
          ))}
        </div>
      )}

      <div className="vo-eco-card-foot">
        <div className="vo-eco-card-priority">
          <span className="vo-eco-card-priority-label">Priorité</span>
          {["high", "medium", "low"].map(p => (
            <button
              key={p}
              className={`vo-eco-pri-btn vo-eco-pri-btn--${p} ${item.user_priority === p ? "is-active" : ""}`}
              onClick={() => setPriority(p)}
              disabled={busy}
            >{p === "high" ? "haute" : p === "medium" ? "moy." : "basse"}</button>
          ))}
        </div>

        <div className="vo-eco-card-status">
          {item.status === "active" && (
            <button className="vo-eco-card-status-btn" onClick={() => setStatus("dismissed")} disabled={busy}>
              Écarter
            </button>
          )}
          {item.status === "dismissed" && (
            <button className="vo-eco-card-status-btn" onClick={() => setStatus("active")} disabled={busy}>
              Réactiver
            </button>
          )}
          {item.status === "archived" && (
            <button className="vo-eco-card-status-btn" onClick={() => setStatus("active")} disabled={busy}>
              Réactiver
            </button>
          )}
          {item.status !== "active" && (
            <span className={`vo-eco-card-status-tag vo-eco-card-status-tag--${item.status}`}>
              {item.status === "dismissed" ? "écarté" : "archivé"}
            </span>
          )}
        </div>

        <textarea
          className="vo-eco-card-notes"
          placeholder="Note perso (save on blur)"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
          onBlur={saveNotes}
          disabled={busy}
          rows={1}
        />
      </div>
    </article>
  );
}

// ─── Catalogue : vue 2 colonnes ────────────────────────────────
function CatalogueView({ items, pending, onPatch, onAddManual }) {
  const [typeFilter, setTypeFilter] = React.useState(() => {
    try { return localStorage.getItem("vo.eco.typeFilter") || "all"; } catch { return "all"; }
  });
  const [hideDismissed, setHideDismissed] = React.useState(() => {
    try { return localStorage.getItem("vo.eco.hideDismissed") !== "0"; } catch { return true; }
  });
  const [tagFilter, setTagFilter] = React.useState([]);

  React.useEffect(() => { try { localStorage.setItem("vo.eco.typeFilter", typeFilter); } catch {} }, [typeFilter]);
  React.useEffect(() => { try { localStorage.setItem("vo.eco.hideDismissed", hideDismissed ? "1" : "0"); } catch {} }, [hideDismissed]);

  const allTags = React.useMemo(() => {
    const m = new Map();
    items.forEach(it => (it.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter(it => {
      if (hideDismissed && (it.status === "dismissed" || it.status === "archived")) return false;
      if (typeFilter !== "all" && it.type !== typeFilter) return false;
      if (tagFilter.length > 0 && !(it.tags || []).some(t => tagFilter.includes(t))) return false;
      return true;
    });
  }, [items, hideDismissed, typeFilter, tagFilter]);

  const sortFn = (a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const pa = VO_PRIORITY_ORDER[a.user_priority] ?? 99;
    const pb = VO_PRIORITY_ORDER[b.user_priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return String(a.name).localeCompare(String(b.name));
  };

  const both     = filtered.filter(i => i.direction === "both").sort(sortFn);
  const inbound  = filtered.filter(i => i.direction === "inbound").sort(sortFn);
  const outbound = filtered.filter(i => i.direction === "outbound").sort(sortFn);

  return (
    <div className="vo-catalogue">
      <div className="vo-catalogue-toolbar">
        <div className="vo-filters-group">
          <span className="vo-filters-label">Type</span>
          <button
            className={`pill ${typeFilter === "all" ? "is-active" : ""}`}
            onClick={() => setTypeFilter("all")}
          >Tous</button>
          {VO_ECO_TYPES.map(t => (
            <button
              key={t.id}
              className={`pill ${typeFilter === t.id ? "is-active" : ""}`}
              onClick={() => setTypeFilter(t.id)}
            >{t.label}</button>
          ))}
        </div>
        <label className="vo-filters-toggle">
          <input
            type="checkbox"
            checked={hideDismissed}
            onChange={(e) => setHideDismissed(e.target.checked)}
          />
          <span>Masquer écartés + archivés</span>
        </label>
        <button className="btn btn--primary" onClick={onAddManual} style={{marginLeft: "auto"}}>
          + Ajouter une intégration
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="vo-eco-tags-bar">
          {allTags.slice(0, 16).map(([t, n]) => {
            const active = tagFilter.includes(t);
            return (
              <button
                key={t}
                className={`vo-eco-tag-chip ${active ? "is-active" : ""}`}
                onClick={() => setTagFilter(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
              >#{t} <span className="vo-eco-tag-count">{n}</span></button>
            );
          })}
          {tagFilter.length > 0 && (
            <button className="vo-eco-tag-clear" onClick={() => setTagFilter([])}>× clear</button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="vo-empty">
          <p>Aucune intégration ne matche ces filtres.</p>
          <p className="vo-empty-sub">Élargis les filtres ou ajoute une intégration manuellement.</p>
        </div>
      ) : (
        <>
          {both.length > 0 && (
            <section className="vo-eco-both">
              <div className="vo-eco-both-head">
                <h3 className="vo-eco-both-title">↔ Bidirectionnels</h3>
                <span className="vo-section-count">{both.length}</span>
              </div>
              <div className="vo-eco-both-list">
                {both.map(it => (
                  <VOEcoCard key={it.id} item={it} onPatch={onPatch} busy={!!pending[it.id]} />
                ))}
              </div>
            </section>
          )}

          <div className="vo-eco-cols">
            {VO_DIRECTIONS.map(dir => {
              const list = dir.id === "inbound" ? inbound : outbound;
              return (
                <section key={dir.id} className={`vo-eco-col vo-eco-col--${dir.id}`}>
                  <div className="vo-eco-col-head">
                    <h3 className="vo-eco-col-title">{dir.label}</h3>
                    <span className="vo-section-count">{list.length}</span>
                    <p className="vo-eco-col-desc">{dir.desc}</p>
                  </div>
                  <div className="vo-eco-col-list">
                    {list.length === 0 ? (
                      <div className="vo-eco-col-empty">—</div>
                    ) : list.map(it => (
                      <VOEcoCard key={it.id} item={it} onPatch={onPatch} busy={!!pending[it.id]} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Modal "+ Ajouter une intégration" ─────────────────────────
function AddIntegrationModal({ open, onClose, onSave, busy, errMsg }) {
  const [name, setName] = React.useState("");
  const [direction, setDirection] = React.useState("inbound");
  const [type, setType] = React.useState("mcp_server");
  const [vendor, setVendor] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [applicability, setApplicability] = React.useState("");
  const [installHint, setInstallHint] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [slugCustom, setSlugCustom] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(""); setDirection("inbound"); setType("mcp_server"); setVendor("");
      setSourceUrl(""); setDescription(""); setApplicability(""); setInstallHint("");
      setTagsInput(""); setSlugCustom("");
    }
  }, [open]);

  if (!open) return null;

  const computedSlug = slugCustom.trim() || voSlugify(name);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!name.trim() || !description.trim()) return;
    const tags = tagsInput
      .split(/[,\s]+/)
      .map(t => t.trim().toLowerCase().replace(/^#/, ""))
      .filter(Boolean);
    onSave({
      slug: computedSlug,
      name: name.trim(),
      direction,
      type,
      vendor: vendor.trim() || null,
      source_url: sourceUrl.trim() || null,
      description: description.trim(),
      applicability: applicability.trim() || null,
      install_hint: installHint.trim() || null,
      tags,
    });
  };

  return (
    <div className="vo-modal-overlay" onClick={onClose}>
      <form className="vo-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="vo-modal-head">
          <h3>+ Ajouter une intégration</h3>
          <button type="button" className="vo-modal-x" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <div className="vo-modal-body">
          <label className="vo-modal-field">
            <span>Nom *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : MCP Slack" required autoFocus />
          </label>

          <label className="vo-modal-field">
            <span>Slug (auto si vide)</span>
            <input value={slugCustom} onChange={(e) => setSlugCustom(e.target.value)} placeholder={voSlugify(name) || "auto-généré"} />
          </label>

          <div className="vo-modal-row">
            <label className="vo-modal-field">
              <span>Direction *</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="inbound">Inbound (se plugge à Claude)</option>
                <option value="outbound">Outbound (utilise Claude)</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="vo-modal-field">
              <span>Type *</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {VO_ECO_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          </div>

          <div className="vo-modal-row">
            <label className="vo-modal-field">
              <span>Vendeur</span>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Anthropic, Hamel, ..." />
            </label>
            <label className="vo-modal-field">
              <span>URL source</span>
              <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
            </label>
          </div>

          <label className="vo-modal-field">
            <span>Description *</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
          </label>

          <label className="vo-modal-field">
            <span>Applicabilité projet</span>
            <textarea value={applicability} onChange={(e) => setApplicability(e.target.value)} rows={2} placeholder="En quoi c'est utile au projet Jarvis / mission RTE ?" />
          </label>

          <label className="vo-modal-field">
            <span>Comment l'installer / tester</span>
            <input value={installHint} onChange={(e) => setInstallHint(e.target.value)} placeholder="ex : pip install xxx" />
          </label>

          <label className="vo-modal-field">
            <span>Tags (séparés par virgule ou espace)</span>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="rag, monitoring, jira" />
          </label>

          {errMsg && <div className="vo-modal-err">{errMsg}</div>}
        </div>

        <div className="vo-modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !name.trim() || !description.trim()}>
            {busy ? "Sauvegarde..." : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════
function PanelVeilleOutils({ data, onNavigate }) {
  const VO = window.VEILLE_OUTILS_DATA || { items: [], summary: null, ecosystem: [] };
  const allItems = Array.isArray(VO.items) ? VO.items : [];
  const allEco = Array.isArray(VO.ecosystem) ? VO.ecosystem : [];

  const [tab, setTab] = React.useState(() => {
    try { return localStorage.getItem("vo.tab") || "veille"; } catch { return "veille"; }
  });
  const [hideDone, setHideDone] = React.useState(() => {
    try { return localStorage.getItem("vo.hideDone") !== "0"; } catch { return true; }
  });
  const [priFilter, setPriFilter] = React.useState(() => {
    try { return localStorage.getItem("vo.priFilter") || "all"; } catch { return "all"; }
  });
  const [pending, setPending] = React.useState({});
  const [, force] = React.useState(0);

  // Modal "+ Ajouter une intégration"
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalBusy, setModalBusy] = React.useState(false);
  const [modalErr, setModalErr] = React.useState(null);

  React.useEffect(() => { try { localStorage.setItem("vo.tab", tab); } catch {} }, [tab]);
  React.useEffect(() => { try { localStorage.setItem("vo.hideDone", hideDone ? "1" : "0"); } catch {} }, [hideDone]);
  React.useEffect(() => { try { localStorage.setItem("vo.priFilter", priFilter); } catch {} }, [priFilter]);

  // ── Veille hebdo : filtrage / tri ────────────────────────────
  const filtered = React.useMemo(() => {
    return allItems.filter(it => {
      if (hideDone && (it.status === "applied" || it.status === "dismissed")) return false;
      if (priFilter !== "all" && it.priority !== priFilter) return false;
      return true;
    }).sort((a, b) => {
      const pa = VO_PRIORITY_ORDER[a.priority] ?? 99;
      const pb = VO_PRIORITY_ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      const ea = VO_EFFORT_ORDER[a.effort] ?? 99;
      const eb = VO_EFFORT_ORDER[b.effort] ?? 99;
      if (ea !== eb) return ea - eb;
      return String(a.title).localeCompare(String(b.title));
    });
  }, [allItems, hideDone, priFilter]);

  const byCategory = React.useMemo(() => {
    const out = {};
    VO_CATEGORIES.forEach(c => out[c.id] = []);
    filtered.forEach(it => {
      if (out[it.category]) out[it.category].push(it);
    });
    return out;
  }, [filtered]);

  // ── Stats hero (par tab) ─────────────────────────────────────
  const veilleStats = React.useMemo(() => {
    const total = allItems.length;
    const newCount = allItems.filter(i => i.status === "new").length;
    const highCount = allItems.filter(i => i.priority === "high" && i.status !== "applied" && i.status !== "dismissed").length;
    const appliedCount = allItems.filter(i => i.status === "applied").length;
    return { total, newCount, highCount, appliedCount };
  }, [allItems]);

  const ecoStats = React.useMemo(() => {
    const active = allEco.filter(i => i.status === "active");
    const inboundCount  = active.filter(i => i.direction === "inbound").length;
    const outboundCount = active.filter(i => i.direction === "outbound").length;
    const pinnedCount   = active.filter(i => i.is_pinned).length;
    const dismissedCount = allEco.filter(i => i.status === "dismissed").length;
    return { total: active.length, inboundCount, outboundCount, pinnedCount, dismissedCount };
  }, [allEco]);

  // ── PATCH veille item ────────────────────────────────────────
  const patchItem = async (id, patch) => {
    if (pending[id]) return;
    if (!window.sb || !window.SUPABASE_URL) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      const url = `${window.SUPABASE_URL}/rest/v1/claude_veille?id=eq.${encodeURIComponent(id)}`;
      const r = await window.sb.patchJSON(url, patch);
      if (!r.ok) throw new Error("patch " + r.status);
      const idx = allItems.findIndex(i => i.id === id);
      if (idx >= 0) {
        allItems[idx] = { ...allItems[idx], ...patch };
        window.VEILLE_OUTILS_DATA.items = allItems;
      }
      try {
        if (patch.status) window.track && window.track("veille_outils_status_changed", { id, to: patch.status });
        if (patch.notes !== undefined) window.track && window.track("veille_outils_notes_saved", { id });
      } catch {}
      force(v => v + 1);
    } catch (e) {
      console.error("[veille-outils] patch failed", e);
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  // ── PATCH ecosystem item ─────────────────────────────────────
  const patchEcoItem = async (id, patch) => {
    if (pending[id]) return;
    if (!window.sb || !window.SUPABASE_URL) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      const url = `${window.SUPABASE_URL}/rest/v1/claude_ecosystem?id=eq.${encodeURIComponent(id)}`;
      const r = await window.sb.patchJSON(url, patch);
      if (!r.ok) throw new Error("patch " + r.status);
      const idx = allEco.findIndex(i => i.id === id);
      if (idx >= 0) {
        allEco[idx] = { ...allEco[idx], ...patch };
        window.VEILLE_OUTILS_DATA.ecosystem = allEco;
      }
      try {
        const evt = patch.is_pinned !== undefined ? "ecosystem_pin_toggled"
                  : patch.status ? "ecosystem_status_changed"
                  : patch.user_priority !== undefined ? "ecosystem_priority_set"
                  : patch.user_notes !== undefined ? "ecosystem_notes_saved"
                  : "ecosystem_patched";
        window.track && window.track(evt, { id });
      } catch {}
      force(v => v + 1);
    } catch (e) {
      console.error("[veille-outils] eco patch failed", e);
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  // ── INSERT manual ecosystem item ─────────────────────────────
  const addEcoManual = async (payload) => {
    if (!window.sb || !window.SUPABASE_URL) {
      setModalErr("Client Supabase indisponible.");
      return;
    }
    setModalBusy(true);
    setModalErr(null);
    try {
      const url = `${window.SUPABASE_URL}/rest/v1/claude_ecosystem`;
      const rows = await window.sb.postJSON(url, {
        ...payload,
        added_date: new Date().toISOString().slice(0, 10),
        last_seen: new Date().toISOString().slice(0, 10),
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row && row.id) {
        allEco.unshift(row);
        window.VEILLE_OUTILS_DATA.ecosystem = allEco;
        force(v => v + 1);
        try { window.track && window.track("ecosystem_added_manual", { slug: payload.slug }); } catch {}
        setModalOpen(false);
      } else {
        setModalErr("Réponse vide — vérifie les permissions RLS.");
      }
    } catch (e) {
      const msg = String(e);
      if (msg.includes("23505") || msg.toLowerCase().includes("duplicate")) {
        setModalErr(`Le slug "${payload.slug}" existe déjà — choisis-en un autre.`);
      } else {
        setModalErr("Échec de l'ajout : " + msg.slice(0, 200));
      }
    } finally {
      setModalBusy(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="panel-page" data-screen-label="Veille outils">
      {/* HERO */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">
          {tab === "veille"
            ? <>Veille outils Claude · dernière exécution {voFormatDate(VO.last_run)}</>
            : <>Catalogue écosystème · {ecoStats.total} intégrations actives</>}
        </div>
        <h1 className="panel-hero-title">
          {tab === "veille" ? (
            <>Ce qui bouge côté <em>Claude</em>.<br/>Trié pour toi, pas pour le bruit.</>
          ) : (
            <>L'<em>écosystème</em> qui se branche à Claude.<br/>Et où Claude se branche.</>
          )}
        </h1>
        <p className="panel-hero-sub">
          {tab === "veille"
            ? "Synthèse hebdo d'une routine Cowork : nouveautés Claude Code / Cowork, skills, MCP, retours d'expérience. 4 buckets pour décider vite ce que tu appliques."
            : "Catalogue stable des outils inbound (qui se pluggent dans Claude) et outbound (où Claude est utilisé comme moteur). Mis à jour mensuellement par une routine Cowork dédiée + ajouts manuels."}
        </p>

        {/* Tab toggle */}
        <div className="vo-tabs">
          <button
            className={`vo-tab ${tab === "veille" ? "is-active" : ""}`}
            onClick={() => setTab("veille")}
          >
            Veille hebdo
            <span className="vo-tab-count">{veilleStats.total}</span>
          </button>
          <button
            className={`vo-tab ${tab === "catalogue" ? "is-active" : ""}`}
            onClick={() => setTab("catalogue")}
          >
            Catalogue écosystème
            <span className="vo-tab-count">{ecoStats.total}</span>
          </button>
        </div>

        {/* Stats per tab */}
        {tab === "veille" ? (
          <div className="vo-herometa">
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val">{veilleStats.total}</span>
              <span>items totaux</span>
            </div>
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val vo-herometa-val--new">{veilleStats.newCount}</span>
              <span>nouveaux</span>
            </div>
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val vo-herometa-val--high">{veilleStats.highCount}</span>
              <span>priorité haute en attente</span>
            </div>
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val">{veilleStats.appliedCount}</span>
              <span>appliqués</span>
            </div>
          </div>
        ) : (
          <div className="vo-herometa">
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val">{ecoStats.total}</span>
              <span>actives</span>
            </div>
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val vo-herometa-val--new">{ecoStats.inboundCount}</span>
              <span>↘ inbound</span>
            </div>
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val vo-herometa-val--high">{ecoStats.outboundCount}</span>
              <span>↗ outbound</span>
            </div>
            <div className="vo-herometa-stat">
              <span className="vo-herometa-val">{ecoStats.pinnedCount}</span>
              <span>épinglés</span>
            </div>
          </div>
        )}
      </div>

      {/* CONTENT PER TAB */}
      {tab === "veille" ? (
        <>
          <VOSummaryHero summary={VO.summary} lastRun={VO.last_run} />

          <div className="vo-filters">
            <div className="vo-filters-group">
              <span className="vo-filters-label">Priorité</span>
              {[
                { id: "all",    label: "Toutes" },
                { id: "high",   label: "Haute" },
                { id: "medium", label: "Moyenne" },
                { id: "low",    label: "Basse" },
              ].map(p => (
                <button
                  key={p.id}
                  className={`pill ${priFilter === p.id ? "is-active" : ""}`}
                  onClick={() => setPriFilter(p.id)}
                >{p.label}</button>
              ))}
            </div>
            <label className="vo-filters-toggle">
              <input
                type="checkbox"
                checked={hideDone}
                onChange={(e) => setHideDone(e.target.checked)}
              />
              <span>Masquer appliqués + écartés</span>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="vo-empty">
              <p>Aucun item ne matche les filtres.</p>
              <p className="vo-empty-sub">
                La routine Cowork tourne chaque samedi matin. Si tu n'as encore rien vu, lance-la depuis Cowork (skill <code>schedule</code>) ou attends le prochain run.
              </p>
            </div>
          ) : (
            VO_CATEGORIES.map(cat => (
              <VOSection
                key={cat.id}
                category={cat}
                items={byCategory[cat.id] || []}
                onPatch={patchItem}
                pending={pending}
              />
            ))
          )}
        </>
      ) : (
        <CatalogueView
          items={allEco}
          pending={pending}
          onPatch={patchEcoItem}
          onAddManual={() => { setModalErr(null); setModalOpen(true); }}
        />
      )}

      <AddIntegrationModal
        open={modalOpen}
        busy={modalBusy}
        errMsg={modalErr}
        onClose={() => setModalOpen(false)}
        onSave={addEcoManual}
      />
    </div>
  );
}

window.PanelVeilleOutils = PanelVeilleOutils;
