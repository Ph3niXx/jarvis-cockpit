// ═══════════════════════════════════════════════════════════════
// PANEL CARNET D'IDÉES — L'incubateur
// ─────────────────────────────────────────────
// Hero → capture bar → flagship (idée mûre) → view switcher :
//   · Pipeline : kanban 5 colonnes par maturité
//   · Galerie  : mur de post-its
// ═══════════════════════════════════════════════════════════════

const { useState: useStateId, useMemo: useMemoId, useEffect: useEffectId } = React;

const STAGE_ORDER = ["seed", "incubating", "maturing", "ready_to_promote", "parked"];const STAGE_LABEL = {
  seed: "Graine",
  incubating: "Incubation",
  maturing: "Maturation",
  ready_to_promote: "Prête",
  parked: "Parquée",
};
const CAT_COLOR = {
  business: "#2f2a24",
  side:     "#5a4634",
  content:  "#8a6e4a",
  jarvis:   "#3a4a3a",
  life:     "#6a4a3a",
};

// days since captured
function daysSince(iso) {
  const captured = new Date(iso);
  const today = new Date("2026-04-21");
  return Math.max(0, Math.floor((today - captured) / (24*3600*1000)));
}
function ageLabel(iso) {
  const d = daysSince(iso);
  if (d < 2) return "aujourd'hui";
  if (d < 8) return `${d}j`;
  if (d < 60) return `${Math.round(d/7)} sem.`;
  return `${Math.round(d/30)} mois`;
}

function IdSignalChip({ name, onClick }) {
  const sig = (window.SIGNALS_DATA?.signals || []).find(s => s.name === name);
  const trend = sig?.trend || "stable";
  return (
    <button className="id-sig-chip" onClick={onClick}>
      <span className={`id-sig-chip-dot id-sig-chip-dot--${trend}`} />
      <span>{name}</span>
    </button>
  );
}

// ─── Flagship : l'idée qui "attend" ──────────────────────
function FlagshipIdea({ idea, onPromote, onOpenSignal, onCreate, onDig, onArchive, pending }) {
  const isPending = pending && pending[idea.id];
  return (
    <article className="id-flagship">
      <div className="id-flagship-main">
        <div className="id-flagship-kicker">{idea.kicker} · L'idée qui attend</div>
        <h2 className="id-flagship-title">{idea.title}</h2>
        <p className="id-flagship-oneliner">« {idea.one_liner} »</p>
        <p className="id-flagship-body">{idea.body}</p>
        {idea.jarvis_prompt && (
          <div className="id-flagship-prompt">{idea.jarvis_prompt}</div>
        )}
        <div className="id-flagship-actions">
          <button className="btn btn--primary" onClick={() => onPromote(idea.id)} disabled={isPending}>
            <Icon name="arrow_up" size={14} stroke={2} /> Promouvoir en opportunité
          </button>
          <button className="btn btn--ghost" onClick={() => onDig && onDig(idea)} disabled={isPending}>
            <Icon name="edit" size={14} stroke={1.75} /> Creuser plus
          </button>
          <button className="btn btn--ghost" onClick={() => onArchive && onArchive(idea.id)} disabled={isPending}>
            <Icon name="archive" size={14} stroke={1.75} /> Parquer
          </button>
        </div>
      </div>

      <div className="id-flagship-side">
        <div className="id-flagship-age">
          <div className="id-flagship-age-label">En incubation</div>
          <div className="id-flagship-age-val">{ageLabel(idea.captured_at)}</div>
          <div className="id-flagship-age-sub">
            touchée {idea.touched_count} fois · dernière édition {ageLabel(idea.last_touched)}
          </div>
        </div>

        <div className="id-flagship-scores">
          {[
            { k: "impact",    label: "Impact",     val: idea.impact },
            { k: "effort",    label: "Effort",     val: idea.effort,    reverse: true },
            { k: "alignment", label: "Alignement", val: idea.alignment },
          ].map(s => (
            <div key={s.k} className="id-flagship-score">
              <span className="id-flagship-score-label">{s.label}</span>
              <span className="id-flagship-score-bar">
                <span className={`id-flagship-score-fill ${s.reverse ? "id-flagship-score-fill--effort" : ""}`}
                      style={{ width: `${(s.val/5)*100}%` }} />
              </span>
              <span className="id-flagship-score-val">{s.val}/5</span>
            </div>
          ))}
        </div>

        {(idea.signals || []).length > 0 && (
          <div className="id-flagship-signals">
            <div className="id-flagship-signals-label">Signaux source</div>
            <div>
              {idea.signals.map(s => (
                <IdSignalChip key={s} name={s} onClick={() => onOpenSignal(s)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Pipeline view (5 colonnes par maturité) ─────────────
function PipelineView({ ideas, stages, onOpen }) {
  const byStage = {};
  stages.forEach(st => byStage[st.id] = []);
  ideas.forEach(i => {
    if (byStage[i.status]) byStage[i.status].push(i);
  });
  // within stage : sort by last_touched desc
  Object.values(byStage).forEach(arr => arr.sort((a,b) => new Date(b.last_touched) - new Date(a.last_touched)));

  return (
    <div className="id-pipe">
      {stages.map(st => (
        <div key={st.id} className={`id-pipe-col id-pipe-col--${st.id}`}>
          <div className="id-pipe-col-head">
            <div className="id-pipe-col-title">
              <span>{st.label}</span>
              <span className="id-pipe-col-count">{byStage[st.id].length}</span>
            </div>
            <div className="id-pipe-col-sub">{st.sub}</div>
          </div>
          {byStage[st.id].map(i => (
            <article key={i.id}
              className={`id-pipe-card ${i.status === "ready_to_promote" ? "id-pipe-card--ready" : ""} ${i.status === "parked" ? "id-pipe-card--parked" : ""}`}
              onClick={() => onOpen(i.id)}>
              <div className="id-pipe-card-kicker">
                <span className="id-pipe-card-cat" style={{ background: CAT_COLOR[i.category] }} />
                <span>{i.category}</span>
              </div>
              <h4 className="id-pipe-card-title">{i.title}</h4>
              <div className="id-pipe-card-meta">
                <span className="id-pipe-card-age">{ageLabel(i.captured_at)}</span>
                {i.promoted_to_opp ? (
                  <span className="id-pipe-card-promoted">↗ opp</span>
                ) : (
                  <span className="id-pipe-card-touched">×{i.touched_count}</span>
                )}
              </div>
            </article>
          ))}
          {byStage[st.id].length === 0 && (
            <div style={{ color: "var(--tx3)", fontSize: 11, fontFamily: "var(--font-mono)", padding: "12px 4px", fontStyle: "italic" }}>—</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Gallery view (mur de post-its) ──────────────────────
function GalleryView({ ideas, onOpen }) {
  // sort : ready first, then recent touched
  const sorted = [...ideas].sort((a,b) => {
    const ra = a.status === "ready_to_promote" ? 0 : 1;
    const rb = b.status === "ready_to_promote" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return new Date(b.last_touched) - new Date(a.last_touched);
  });
  return (
    <div className="id-gallery">
      {sorted.map(i => {
        const cls = [
          "id-note",
          i.status === "ready_to_promote" && "id-note--ready",
          i.status === "parked" && "id-note--parked",
        ].filter(Boolean).join(" ");
        return (
          <article key={i.id} className={cls} data-cat={i.category} onClick={() => onOpen(i.id)}>
            <div className="id-note-kicker">{i.kicker}</div>
            <h3 className="id-note-title">{i.title}</h3>
            <p className="id-note-oneliner">{i.one_liner}</p>
            <div className="id-note-foot">
              <span className={`id-note-stage ${i.status === "ready_to_promote" ? "id-note-stage--ready" : ""} ${i.status === "parked" ? "id-note-stage--parked" : ""}`}>
                {STAGE_LABEL[i.status]}
              </span>
              <span>{ageLabel(i.captured_at)} · ×{i.touched_count}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ─── Detail panel (modal-like inline) ────────────────────
function IdeaDetail({ idea, allIdeas, onClose, onOpenSignal, onPromote, onOpen, onDig, onArchive, onNavigate, pending }) {
  const related = (idea.related_ids || []).map(id => allIdeas.find(i => i.id === id)).filter(Boolean);
  return (
    <div className="id-detail">
      <div>
        <div className="id-detail-section-label">Contexte & développement</div>
        <div className="id-detail-origin">Captée : {idea.origin}</div>
        <p className="id-detail-body">{idea.body}</p>

        {idea.jarvis_prompt && (
          <div className="id-detail-prompt">{idea.jarvis_prompt}</div>
        )}

        {idea.jarvis_enriched && (
          <div className="id-detail-enrich">
            <div className="id-detail-enrich-head">Enrichissement Jarvis</div>
            {idea.jarvis_enriched.similar_companies && (
              <div className="id-detail-enrich-row">
                <span className="id-detail-enrich-label">Concurrents</span>
                <span className="id-detail-enrich-val">{idea.jarvis_enriched.similar_companies.join(" · ")}</span>
              </div>
            )}
            {idea.jarvis_enriched.market_sig && (
              <div className="id-detail-enrich-row">
                <span className="id-detail-enrich-label">Marché</span>
                <span className="id-detail-enrich-val">{idea.jarvis_enriched.market_sig}</span>
              </div>
            )}
            {idea.jarvis_enriched.risks && (
              <div className="id-detail-enrich-row">
                <span className="id-detail-enrich-label">Risques</span>
                <span className="id-detail-enrich-val">{idea.jarvis_enriched.risks}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="id-detail-meta-row">
          <div className="id-detail-meta-cell">
            Stade
            <span className="id-detail-meta-val">{STAGE_LABEL[idea.status]}</span>
          </div>
          <div className="id-detail-meta-cell">
            Âge
            <span className="id-detail-meta-val">{ageLabel(idea.captured_at)}</span>
          </div>
          <div className="id-detail-meta-cell">
            Impact
            <span className="id-detail-meta-val">{idea.impact}/5</span>
          </div>
          <div className="id-detail-meta-cell">
            Effort
            <span className="id-detail-meta-val">{idea.effort}/5</span>
          </div>
        </div>

        {(idea.signals || []).length > 0 && (
          <div style={{marginBottom:16}}>
            <div className="id-detail-section-label">Signaux source</div>
            <div>
              {idea.signals.map(s => (
                <IdSignalChip key={s} name={s} onClick={() => onOpenSignal(s)} />
              ))}
            </div>
          </div>
        )}

        {idea.promoted_to_opp && (
          <div style={{marginBottom:16, padding:"10px 12px", background:"color-mix(in srgb, var(--brand) 10%, transparent)", border:"1px solid color-mix(in srgb, var(--brand) 30%, var(--bd))", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--tx)", letterSpacing:"0.04em", textTransform:"uppercase"}}>
            ↗ Déjà promue — opportunité {idea.promoted_to_opp}
          </div>
        )}

        {related.length > 0 && (
          <div className="id-detail-related">
            <div className="id-detail-section-label">Idées liées ({related.length})</div>
            {related.map(r => (
              <button key={r.id} className="id-detail-related-item" onClick={() => onOpen(r.id)} style={{textAlign:"left", border:"none", background:"transparent", width:"100%", cursor:"pointer"}}>
                <span className="id-detail-related-kicker">{STAGE_LABEL[r.status]}</span>
                {r.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="id-detail-actions">
        {!idea.promoted_to_opp && (
          <button className="btn btn--primary" onClick={() => onPromote(idea.id)} disabled={pending && pending[idea.id]}>
            <Icon name="arrow_up" size={14} stroke={2} /> Promouvoir en opportunité
          </button>
        )}
        <button className="btn btn--ghost" onClick={() => onDig && onDig(idea)} disabled={pending && pending[idea.id]}>
          <Icon name="edit" size={14} stroke={1.75} /> Creuser plus
        </button>
        <button className="btn btn--ghost" onClick={() => onNavigate && onNavigate("jarvis")}>
          <Icon name="assistant" size={14} stroke={1.75} /> Demander à Jarvis
        </button>
        <button className="btn btn--ghost" onClick={() => onArchive && onArchive(idea.id)} disabled={pending && pending[idea.id]}>
          <Icon name="archive" size={14} stroke={1.75} /> Parquer
        </button>
        <button className="btn btn--ghost" onClick={onClose} style={{marginLeft:"auto"}}>Fermer</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PANEL
// ═══════════════════════════════════════════════════════════════
function PanelIdeas({ data, onNavigate }) {
  const ID = window.IDEAS_DATA;
  const allIdeas = ID.ideas;
  const stages = ID.stages;
  const categories = ID.categories;

  const [view, setView] = useStateId(() => localStorage.getItem("idea.view") || "pipeline");
  const [cat, setCat] = useStateId(() => localStorage.getItem("idea.cat") || "all");
  const [openId, setOpenId] = useStateId(null);

  useEffectId(() => localStorage.setItem("idea.view", view), [view]);
  useEffectId(() => localStorage.setItem("idea.cat", cat), [cat]);

  const filtered = cat === "all" ? allIdeas : allIdeas.filter(i => i.category === cat);

  const counts = useMemoId(() => {
    const c = { all: allIdeas.length };
    categories.forEach(cat => c[cat.id] = allIdeas.filter(i => i.category === cat.id).length);
    return c;
  }, [allIdeas, categories]);

  const readyCount = allIdeas.filter(i => i.status === "ready_to_promote").length;
  const freshCount = allIdeas.filter(i => daysSince(i.captured_at) <= 7).length;
  const incubatingCount = allIdeas.filter(i => i.status === "incubating" || i.status === "maturing").length;

  // Flagship = la plus mature qui n'a pas été promue (highest touched_count parmi ready_to_promote)
  const flagship = useMemoId(() => {
    const candidates = allIdeas.filter(i => i.status === "ready_to_promote" && !i.promoted_to_opp);
    if (candidates.length === 0) {
      // fallback : la plus mature maturing
      return [...allIdeas]
        .filter(i => i.status === "maturing")
        .sort((a,b) => b.touched_count - a.touched_count)[0];
    }
    return candidates.sort((a,b) => b.touched_count - a.touched_count)[0];
  }, [allIdeas]);

  const [pending, setPending] = React.useState({});
  const patchIdea = async (id, patch) => {
    if (!window.sb || !window.SUPABASE_URL) throw new Error("no client");
    const url = `${window.SUPABASE_URL}/rest/v1/business_ideas?id=eq.${encodeURIComponent(id)}`;
    const r = await window.sb.patchJSON(url, patch);
    if (!r.ok) throw new Error("patch " + r.status);
    // Mutate the in-memory list so the UI reflects immediately without
    // waiting for a full reload.
    if (window.IDEAS_DATA?.ideas) {
      window.IDEAS_DATA.ideas = window.IDEAS_DATA.ideas.map(
        i => i.id === id ? { ...i, ...patch } : i
      );
    }
  };

  const handleOpen = (id) => setOpenId(openId === id ? null : id);

  const handlePromote = async (id) => {
    if (pending[id]) return;
    if (!confirm("Marquer cette idée comme promue en opportunité ? Elle sera taguée 'promoted' et tu pourras l'intégrer au panel Opportunités.")) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      await patchIdea(id, { status: "promoted", updated_at: new Date().toISOString() });
      try { window.track && window.track("idea_promoted", { id }); } catch {}
      alert("Idée taguée 'promoted'. Recharge le panel Opportunités pour l'y voir.");
    } catch (e) {
      console.error(e);
      alert("Échec de la sauvegarde — réessaie.");
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleArchive = async (id) => {
    if (pending[id]) return;
    if (!confirm("Parquer cette idée ? Elle passera en statut 'archived' et ne sera plus mise en avant.")) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      await patchIdea(id, { status: "archived", updated_at: new Date().toISOString() });
      setOpenId(null);
      try { window.track && window.track("idea_archived", { id }); } catch {}
    } catch (e) {
      console.error(e);
      alert("Échec de la sauvegarde — réessaie.");
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleDig = async (idea) => {
    if (pending[idea.id]) return;
    const current = idea.notes || idea.body || "";
    const next = prompt("Ajoute ou édite tes notes sur cette idée :", current);
    if (next == null || next === current) return;
    setPending(p => ({ ...p, [idea.id]: true }));
    try {
      await patchIdea(idea.id, { notes: next, updated_at: new Date().toISOString() });
      try { window.track && window.track("idea_dug", { id: idea.id }); } catch {}
    } catch (e) {
      console.error(e);
      alert("Échec de la sauvegarde — réessaie.");
    } finally {
      setPending(p => { const n = { ...p }; delete n[idea.id]; return n; });
    }
  };

  const handleOpenSignal = () => onNavigate("signals");

  const openIdea = openId ? allIdeas.find(i => i.id === openId) : null;

  return (
    <div className="panel-page" data-screen-label="Carnet d'idées">
      {/* ── HERO ───────────────────────────────────── */}
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">
          Carnet d'idées · mis à jour {ID.updated}
        </div>
        <h1 className="panel-hero-title">
          Ton <em>carnet d'idées</em>.<br/>
          Le brouillon du futur — avant que ça devienne une opportunité.
        </h1>
        <p className="panel-hero-sub">
          {allIdeas.length} idées en incubation. Capturées au fil de l'eau, relues quand elles mûrissent, promues en opportunité datée quand la fenêtre s'ouvre. Pas de deadline ici — juste un lent processus de sédimentation.
        </p>

        <div className="id-herometa">
          <div className="id-herometa-stat">
            <span className="id-herometa-val">{allIdeas.length}</span>
            <span>idées totales</span>
          </div>
          <div className="id-herometa-stat">
            <span className="id-herometa-val id-herometa-val--fresh">{freshCount}</span>
            <span>captées cette semaine</span>
          </div>
          <div className="id-herometa-stat">
            <span className="id-herometa-val">{incubatingCount}</span>
            <span>en maturation</span>
          </div>
          <div className="id-herometa-stat">
            <span className="id-herometa-val id-herometa-val--ready">{readyCount}</span>
            <span>prêtes à promouvoir</span>
          </div>
        </div>
      </div>

      {/* ── CAPTURE BAR ───────────────────────────── */}
      <div className="id-capture">
        <div className="id-capture-icon">
          <Icon name="plus" size={18} stroke={1.75} />
        </div>
        <input className="id-capture-input" placeholder="Capturer une idée — juste le titre, Jarvis enrichira…" />
        <span className="id-capture-hint">
          <span className="id-capture-kbd">⌘</span> <span className="id-capture-kbd">N</span> partout
        </span>
      </div>

      {/* ── FLAGSHIP ─────────────────────────────── */}
      {flagship && (
        <FlagshipIdea
          idea={flagship}
          onPromote={handlePromote}
          onOpenSignal={handleOpenSignal}
          onDig={handleDig}
          onArchive={handleArchive}
          pending={pending}
        />
      )}

      {/* ── VIEW SWITCHER ─────────────────────────── */}
      <div className="id-viewswitch">
        <div className="id-viewswitch-label">Vue</div>
        <div className="id-viewswitch-group">
          {[
            { id: "pipeline", label: "Pipeline" },
            { id: "gallery",  label: "Galerie" },
          ].map(v => (
            <button key={v.id}
              className={`id-viewswitch-btn ${view === v.id ? "is-active" : ""}`}
              onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--tx2)", letterSpacing: "0.04em" }}>
          {cat === "all" ? `${allIdeas.length} idées` : `${counts[cat]} · ${categories.find(c => c.id === cat)?.label || ""}`}
        </div>
      </div>

      {/* ── CAT FILTERS ───────────────────────────── */}
      <div className="id-cats">
        <button className={`pill ${cat === "all" ? "is-active" : ""}`} onClick={() => setCat("all")}>
          <span>Toutes</span>
          <span className="pill-count">{counts.all}</span>
        </button>
        {categories.map(c => (
          <button key={c.id}
            className={`pill ${cat === c.id ? "is-active" : ""}`}
            onClick={() => setCat(c.id)}>
            <span>{c.label}</span>
            <span className="pill-count">{counts[c.id]}</span>
          </button>
        ))}
      </div>

      {/* ── VIEWS ─────────────────────────────────── */}
      {view === "pipeline" && (
        <PipelineView ideas={filtered} stages={stages} onOpen={handleOpen} />
      )}
      {view === "gallery" && (
        <GalleryView ideas={filtered} onOpen={handleOpen} />
      )}


      {/* ── DETAIL (inline) ───────────────────────── */}
      {openIdea && (
        <div style={{marginTop: 24}}>
          <IdeaDetail
            idea={openIdea}
            allIdeas={allIdeas}
            onClose={() => setOpenId(null)}
            onOpenSignal={handleOpenSignal}
            onPromote={handlePromote}
            onOpen={handleOpen}
            onDig={handleDig}
            onArchive={handleArchive}
            onNavigate={onNavigate}
            pending={pending}
          />
        </div>
      )}
    </div>
  );
}
