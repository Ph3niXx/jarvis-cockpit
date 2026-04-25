// ═══════════════════════════════════════════════════════════════
// PANEL VEILLE OUTILS — Synthèse hebdo Claude (Cowork routine)
// ─────────────────────────────────────────────
// Hero → Synthèse exécutive (_summary) → 4 sections classées :
//   · Applicables Jarvis
//   · Claude — usage général
//   · Outils complémentaires
//   · Autres news
// Chaque item : statut éditable, notes éditables, applicabilité +
// "comment l'appliquer" (collapsible).
// ═══════════════════════════════════════════════════════════════

window.VEILLE_OUTILS_DATA = window.VEILLE_OUTILS_DATA || {
  items: [],
  summary: null,
  last_run: null,
  total: 0,
  by_category: {},
};

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

// ─── Synthèse exécutive (_summary row) ──────────────────────
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

// ─── Item card ──────────────────────────────────────────────
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

// ─── Section par catégorie ──────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════
function PanelVeilleOutils({ data, onNavigate }) {
  const VO = window.VEILLE_OUTILS_DATA || { items: [], summary: null };
  const allItems = Array.isArray(VO.items) ? VO.items : [];

  const [hideDone, setHideDone] = React.useState(() => {
    try { return localStorage.getItem("vo.hideDone") !== "0"; } catch { return true; }
  });
  const [priFilter, setPriFilter] = React.useState(() => {
    try { return localStorage.getItem("vo.priFilter") || "all"; } catch { return "all"; }
  });
  const [pending, setPending] = React.useState({});
  const [, force] = React.useState(0);

  React.useEffect(() => { try { localStorage.setItem("vo.hideDone", hideDone ? "1" : "0"); } catch {} }, [hideDone]);
  React.useEffect(() => { try { localStorage.setItem("vo.priFilter", priFilter); } catch {} }, [priFilter]);

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

  const stats = React.useMemo(() => {
    const total = allItems.length;
    const newCount = allItems.filter(i => i.status === "new").length;
    const highCount = allItems.filter(i => i.priority === "high" && i.status !== "applied" && i.status !== "dismissed").length;
    const appliedCount = allItems.filter(i => i.status === "applied").length;
    return { total, newCount, highCount, appliedCount };
  }, [allItems]);

  const patchItem = async (id, patch) => {
    if (pending[id]) return;
    if (!window.sb || !window.SUPABASE_URL) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      const url = `${window.SUPABASE_URL}/rest/v1/claude_veille?id=eq.${encodeURIComponent(id)}`;
      const r = await window.sb.patchJSON(url, patch);
      if (!r.ok) throw new Error("patch " + r.status);
      // Mute en mémoire pour rendu immédiat
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

  return (
    <div className="panel-page" data-screen-label="Veille outils">
      {/* HERO */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">
          Veille outils Claude · dernière exécution {voFormatDate(VO.last_run)}
        </div>
        <h1 className="panel-hero-title">
          Ce qui bouge côté <em>Claude</em>.<br/>
          Trié pour toi, pas pour le bruit.
        </h1>
        <p className="panel-hero-sub">
          Synthèse hebdo générée par une routine Cowork : nouveautés Claude Code / Cowork, skills, MCP, retours d'expérience. Classés en 4 buckets pour décider vite ce que tu appliques, ce que tu mets de côté, ce que tu ignores.
        </p>

        <div className="vo-herometa">
          <div className="vo-herometa-stat">
            <span className="vo-herometa-val">{stats.total}</span>
            <span>items totaux</span>
          </div>
          <div className="vo-herometa-stat">
            <span className="vo-herometa-val vo-herometa-val--new">{stats.newCount}</span>
            <span>nouveaux</span>
          </div>
          <div className="vo-herometa-stat">
            <span className="vo-herometa-val vo-herometa-val--high">{stats.highCount}</span>
            <span>priorité haute en attente</span>
          </div>
          <div className="vo-herometa-stat">
            <span className="vo-herometa-val">{stats.appliedCount}</span>
            <span>appliqués</span>
          </div>
        </div>
      </div>

      {/* SYNTHÈSE EXÉCUTIVE */}
      <VOSummaryHero summary={VO.summary} lastRun={VO.last_run} />

      {/* FILTRES */}
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

      {/* SECTIONS PAR CATÉGORIE */}
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
    </div>
  );
}

window.PanelVeilleOutils = PanelVeilleOutils;
