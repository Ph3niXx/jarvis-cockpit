// ═══════════════════════════════════════════════════════════════
// PANEL CARNET D'IDÉES — L'incubateur
// ─────────────────────────────────────────────
// Hero → capture bar → flagship (idée mûre) → view switcher :
//   · Pipeline : kanban 5 colonnes par maturité
//   · Galerie  : mur de post-its
// ═══════════════════════════════════════════════════════════════

const { useState: useStateId, useMemo: useMemoId, useEffect: useEffectId } = React;

const STAGE_ORDER = ["seed", "incubating", "maturing", "ready_to_promote", "parked"];const IDEA_STAGE_LABEL = {
  seed: "Graine",
  incubating: "Incubation",
  maturing: "Maturation",
  ready_to_promote: "Prête",
  parked: "Parquée",
  promoted: "Promue",
  archived: "Archivée",
};
const CAT_COLOR = {
  business: "#2f2a24",
  side:     "#5a4634",
  content:  "#8a6e4a",
  jarvis:   "#3a4a3a",
  life:     "#6a4a3a",
};

// Free-form label normalization: lowercase, strip diacritics + special chars.
function normalizeLabel(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^#+/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

// "Lance un LoRA #jarvis #apprentissage" -> { title: "Lance un LoRA", labels: ["jarvis","apprentissage"] }
function parseHashtags(text) {
  const raw = String(text || "");
  const labels = [];
  const cleaned = raw.replace(/#([a-zA-ZÀ-ÿ0-9_-]{2,32})/g, (_m, tag) => {
    const norm = normalizeLabel(tag);
    if (norm && !labels.includes(norm)) labels.push(norm);
    return "";
  }).replace(/\s+/g, " ").trim();
  return { title: cleaned, labels };
}

// Stable color derived from label string (same label -> same tint across panel).
function labelTint(label) {
  let h = 0;
  const s = String(label || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function IdLabelChip({ label, active, onClick, onRemove }) {
  const hue = labelTint(label);
  return (
    <span
      className={`id-lab-chip ${active ? "is-active" : ""}`}
      onClick={onClick}
      style={{
        "--lab-h": hue,
        background: `hsl(${hue} 20% var(--lab-bg-l, 92%) / 0.35)`,
        borderColor: `hsl(${hue} 30% 65% / 0.4)`,
      }}
    >
      <span className="id-lab-chip-dot" style={{ background: `hsl(${hue} 55% 50%)` }} />
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          className="id-lab-chip-x"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Retirer ${label}`}
        >×</button>
      )}
    </span>
  );
}

// days since captured
function daysSince(iso) {
  if (!iso) return 0;
  const captured = new Date(iso);
  if (isNaN(captured.getTime())) return 0;
  const today = new Date();
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
            <Icon name="edit" size={14} stroke={1.75} /> Modifier
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
// Drag & drop natif HTML5 : onDragStart sur card, onDrop sur colonne →
// onMoveStatus(id, nextStatus) patche la DB + met à jour IDEAS_DATA en mémoire.
function PipelineView({ ideas, stages, onOpen, onMoveStatus, pending }) {
  const [dragId, setDragId] = React.useState(null);
  const [hoverCol, setHoverCol] = React.useState(null);

  const byStage = {};
  stages.forEach(st => byStage[st.id] = []);
  ideas.forEach(i => {
    if (byStage[i.status]) byStage[i.status].push(i);
  });
  Object.values(byStage).forEach(arr => arr.sort((a,b) => new Date(b.last_touched) - new Date(a.last_touched)));

  const onDragStart = (e, id) => {
    setDragId(id);
    try { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; } catch {}
  };
  const onDragEnd = () => { setDragId(null); setHoverCol(null); };
  const onColDragOver = (e, stId) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch {}
    if (hoverCol !== stId) setHoverCol(stId);
  };
  const onColDragLeave = (e, stId) => {
    // Only clear if leaving the column itself (not a child card).
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (hoverCol === stId) setHoverCol(null);
    }
  };
  const onColDrop = (e, stId) => {
    e.preventDefault();
    const id = (() => { try { return e.dataTransfer.getData("text/plain"); } catch { return dragId; } })() || dragId;
    setDragId(null); setHoverCol(null);
    if (!id) return;
    const idea = ideas.find(i => i.id === id);
    if (!idea || idea.status === stId) return;
    onMoveStatus && onMoveStatus(id, stId);
  };

  return (
    <div className="id-pipe">
      {stages.map(st => {
        const isHover = hoverCol === st.id;
        return (
          <div
            key={st.id}
            className={`id-pipe-col id-pipe-col--${st.id} ${isHover ? "id-pipe-col--drophover" : ""}`}
            onDragOver={(e) => onColDragOver(e, st.id)}
            onDragLeave={(e) => onColDragLeave(e, st.id)}
            onDrop={(e) => onColDrop(e, st.id)}
          >
            <div className="id-pipe-col-head">
              <div className="id-pipe-col-title">
                <span>{st.label}</span>
                <span className="id-pipe-col-count">{byStage[st.id].length}</span>
              </div>
              <div className="id-pipe-col-sub">{st.sub}</div>
            </div>
            {byStage[st.id].map(i => {
              const isPending = pending && pending[i.id];
              const isDragging = dragId === i.id;
              return (
                <article key={i.id}
                  className={`id-pipe-card ${i.status === "ready_to_promote" ? "id-pipe-card--ready" : ""} ${i.status === "parked" ? "id-pipe-card--parked" : ""} ${isDragging ? "id-pipe-card--dragging" : ""} ${isPending ? "id-pipe-card--pending" : ""}`}
                  draggable={!isPending}
                  onDragStart={(e) => onDragStart(e, i.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpen(i.id)}>
                  <div className="id-pipe-card-kicker">
                    <span className="id-pipe-card-cat" style={{ background: CAT_COLOR[i.category] }} />
                    <span>{i.category}</span>
                  </div>
                  <h4 className="id-pipe-card-title">{i.title}</h4>
                  {(i.labels && i.labels.length > 0) && (
                    <div className="id-pipe-card-labels">
                      {i.labels.slice(0, 3).map(l => <IdLabelChip key={l} label={l} />)}
                      {i.labels.length > 3 && <span className="id-pipe-card-labels-more">+{i.labels.length - 3}</span>}
                    </div>
                  )}
                  <div className="id-pipe-card-meta">
                    <span className="id-pipe-card-age">{ageLabel(i.captured_at)}</span>
                    {i.promoted_to_opp ? (
                      <span className="id-pipe-card-promoted">↗ opp</span>
                    ) : (
                      <span className="id-pipe-card-touched">×{i.touched_count}</span>
                    )}
                  </div>
                </article>
              );
            })}
            {byStage[st.id].length === 0 && (
              <div style={{ color: "var(--tx3)", fontSize: 11, fontFamily: "var(--font-mono)", padding: "12px 4px", fontStyle: "italic" }}>
                {isHover ? "→ déposer ici" : "—"}
              </div>
            )}
          </div>
        );
      })}
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
            {(i.labels && i.labels.length > 0) && (
              <div className="id-note-labels">
                {i.labels.slice(0, 4).map(l => <IdLabelChip key={l} label={l} />)}
              </div>
            )}
            <div className="id-note-foot">
              <span className={`id-note-stage ${i.status === "ready_to_promote" ? "id-note-stage--ready" : ""} ${i.status === "parked" ? "id-note-stage--parked" : ""}`}>
                {IDEA_STAGE_LABEL[i.status]}
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
function IdeaDetail({ idea, allIdeas, onClose, onOpenSignal, onPromote, onOpen, onDig, onArchive, onNavigate, onSetLabels, pending }) {
  const related = (idea.related_ids || []).map(id => allIdeas.find(i => i.id === id)).filter(Boolean);
  const [labelDraft, setLabelDraft] = React.useState("");
  const labels = Array.isArray(idea.labels) ? idea.labels : [];
  const commitLabel = () => {
    const normalized = normalizeLabel(labelDraft);
    if (!normalized || labels.includes(normalized)) { setLabelDraft(""); return; }
    onSetLabels && onSetLabels(idea.id, [...labels, normalized]);
    setLabelDraft("");
  };
  const removeLabel = (l) => {
    onSetLabels && onSetLabels(idea.id, labels.filter(x => x !== l));
  };
  return (
    <div className="id-detail">
      <div>
        <div className="id-detail-section-label">Contexte & développement</div>
        {idea.origin && <div className="id-detail-origin">Captée : {idea.origin}</div>}
        {idea.body && <p className="id-detail-body">{idea.body}</p>}

        {idea.notes && (
          <div style={{marginBottom: 16}}>
            <div className="id-detail-section-label">Notes perso</div>
            <div style={{padding: "12px 14px", background: "var(--bg)", borderLeft: "2px solid var(--tx3)", fontSize: 13, lineHeight: 1.55, color: "var(--tx)", whiteSpace: "pre-wrap"}}>
              {idea.notes}
            </div>
          </div>
        )}

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
            <span className="id-detail-meta-val">{IDEA_STAGE_LABEL[idea.status]}</span>
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

        <div style={{marginBottom:16}}>
          <div className="id-detail-section-label">Libellés</div>
          <div className="id-lab-editor">
            {labels.length > 0
              ? labels.map(l => (
                  <IdLabelChip key={l} label={l} onRemove={() => removeLabel(l)} />
                ))
              : <span style={{fontFamily:"var(--font-mono)", fontSize:11, color:"var(--tx3)", fontStyle:"italic"}}>Aucun libellé — ajoute-en pour filtrer et regrouper</span>
            }
            <input
              className="id-lab-input"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitLabel(); }
                else if (e.key === "Backspace" && !labelDraft && labels.length) { removeLabel(labels[labels.length - 1]); }
              }}
              onBlur={commitLabel}
              placeholder="+ libellé"
              aria-label="Ajouter un libellé"
              disabled={pending && pending[idea.id]}
            />
          </div>
        </div>

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
                <span className="id-detail-related-kicker">{IDEA_STAGE_LABEL[r.status]}</span>
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
          <Icon name="edit" size={14} stroke={1.75} /> Modifier
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

// ─── Suggestions depuis signaux / opportunités ───────────
function SuggestionsSection({ allIdeas, onAccept, onDismiss, dismissedIds }) {
  const suggestions = React.useMemo(() => {
    const out = [];
    const existingTitles = new Set(allIdeas.map(i => String(i.title || "").toLowerCase()));
    const hasTitle = (s) => existingTitles.has(String(s).toLowerCase());

    // 1. Signaux montants/nouveaux non couverts
    const signals = (window.SIGNALS_DATA?.signals || []);
    const rising = signals
      .filter(s => s && (s.trend === "rising" || s.trend === "new"))
      .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
      .slice(0, 4);
    rising.forEach(s => {
      const key = `sig:${s.name}`;
      if (dismissedIds.includes(key)) return;
      if (hasTitle(`signal ${s.name}`)) return;
      const alreadyLinked = allIdeas.some(i => (i.signals || []).includes(s.name));
      if (alreadyLinked) return;
      out.push({
        key,
        source: "signal",
        sourceLabel: s.trend === "new" ? "Signal nouveau" : "Signal montant",
        title: `Produit / contenu autour de « ${s.name} »`,
        description: `Ce terme est ${s.trend === "new" ? "apparu cette semaine" : "en progression"} (${s.mention_count || 0} mentions). Aucune de tes idées ne l'adresse.`,
        labels: [normalizeLabel(s.name)],
        signals: [s.name],
      });
    });

    // 2. Opportunités fortes non liées
    const opps = (window.OPPORTUNITIES_DATA?.opportunities || window.OPPS_DATA?.opportunities || []);
    const promotedIds = new Set(allIdeas.map(i => i.promoted_to_opp).filter(Boolean));
    const topOpps = [...opps]
      .filter(o => o && !promotedIds.has(o.id))
      .sort((a, b) => (b.relevance_score || b.score || 0) - (a.relevance_score || a.score || 0))
      .slice(0, 3);
    topOpps.forEach(o => {
      const key = `opp:${o.id}`;
      if (dismissedIds.includes(key)) return;
      if (hasTitle(o.usecase_title || o.title)) return;
      out.push({
        key,
        source: "opportunity",
        sourceLabel: "Opportunité repérée",
        title: o.usecase_title || o.title || "Opportunité sans titre",
        description: o.usecase_description || o.description || o.relevance_why || "",
        labels: [o.sector, o.category].filter(Boolean).map(normalizeLabel).filter(Boolean),
        signals: [],
      });
    });

    return out.slice(0, 5);
  }, [allIdeas, dismissedIds]);

  if (suggestions.length === 0) return null;

  return (
    <section className="id-suggests">
      <div className="id-suggests-head">
        <div className="id-suggests-eyebrow">Suggestions Jarvis</div>
        <h3 className="id-suggests-title">Pourraient devenir des idées</h3>
        <div className="id-suggests-sub">{suggestions.length} piste{suggestions.length > 1 ? "s" : ""} — accepte pour l'ajouter au carnet, ignore pour ne plus voir.</div>
      </div>
      <div className="id-suggests-list">
        {suggestions.map(s => (
          <article key={s.key} className={`id-suggest id-suggest--${s.source}`}>
            <div className="id-suggest-kicker">{s.sourceLabel}</div>
            <h4 className="id-suggest-title">{s.title}</h4>
            {s.description && <p className="id-suggest-desc">{s.description.slice(0, 220)}{s.description.length > 220 ? "…" : ""}</p>}
            {s.labels.length > 0 && (
              <div className="id-suggest-labs">
                {s.labels.map(l => <IdLabelChip key={l} label={l} />)}
              </div>
            )}
            <div className="id-suggest-actions">
              <button className="btn btn--primary" onClick={() => onAccept(s)}>
                <Icon name="plus" size={13} stroke={2} /> Ajouter au carnet
              </button>
              <button className="btn btn--ghost" onClick={() => onDismiss(s.key)}>Ignorer</button>
            </div>
          </article>
        ))}
      </div>
    </section>
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
  const [labelFilter, setLabelFilter] = useStateId(() => {
    try { return JSON.parse(localStorage.getItem("idea.labels") || "[]"); } catch { return []; }
  });
  const [openId, setOpenId] = useStateId(null);
  const [captureValue, setCaptureValue] = useStateId("");
  const [capturing, setCapturing] = useStateId(false);
  const [captureMsg, setCaptureMsg] = useStateId(null);
  const [suggestDismissed, setSuggestDismissed] = useStateId(() => {
    try { return JSON.parse(localStorage.getItem("idea.suggestDismissed") || "[]"); } catch { return []; }
  });
  // modal d'édition/création — { open, mode: "create"|"edit", ideaId: string|null, initial: Ticket }
  const [modal, setModal] = useStateId({ open: false, mode: "create", ideaId: null, initial: null });
  const [, forceRender] = useStateId(0);
  const captureRef = React.useRef(null);

  useEffectId(() => localStorage.setItem("idea.view", view), [view]);
  useEffectId(() => localStorage.setItem("idea.cat", cat), [cat]);
  useEffectId(() => localStorage.setItem("idea.labels", JSON.stringify(labelFilter)), [labelFilter]);
  useEffectId(() => localStorage.setItem("idea.suggestDismissed", JSON.stringify(suggestDismissed)), [suggestDismissed]);

  useEffectId(() => {
    window.__ideasFocusCapture = () => {
      if (captureRef.current) {
        captureRef.current.focus();
        captureRef.current.select && captureRef.current.select();
      }
    };
    return () => { if (window.__ideasFocusCapture) delete window.__ideasFocusCapture; };
  }, []);

  // Raccourcis panel-scoped :
  //   Ctrl/Cmd+N        → focus capture
  //   P / G             → switch view Pipeline / Galerie
  //   Escape            → ferme le détail ouvert
  useEffectId(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      const inInput = tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable);

      // Ctrl+Shift+N → ouvre la modale de création complète (depuis ce panel)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        if (inInput) return;
        e.preventDefault();
        openCreateModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !e.shiftKey && !e.altKey) {
        if (inInput) return;
        e.preventDefault();
        if (captureRef.current) captureRef.current.focus();
        return;
      }
      if (inInput || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape" && openId && !modal.open) { e.preventDefault(); setOpenId(null); return; }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setView("pipeline"); return; }
      if (e.key === "g" || e.key === "G") { e.preventDefault(); setView("gallery"); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, modal.open]);

  // Tous les labels présents + compte — pour les pills dynamiques.
  const labelCounts = useMemoId(() => {
    const m = new Map();
    allIdeas.forEach(i => {
      (i.labels || []).forEach(l => m.set(l, (m.get(l) || 0) + 1));
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [allIdeas]);

  const filtered = useMemoId(() => {
    let out = allIdeas;
    if (cat !== "all") out = out.filter(i => i.category === cat);
    if (labelFilter.length > 0) {
      // Union : idée matche si elle a au moins un des labels sélectionnés
      out = out.filter(i => (i.labels || []).some(l => labelFilter.includes(l)));
    }
    return out;
  }, [allIdeas, cat, labelFilter]);

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
    if (!confirm("Parquer cette idée ? Elle passera en statut 'parked' et sera filée dans la colonne parking du pipeline.")) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      await patchIdea(id, { status: "parked", updated_at: new Date().toISOString() });
      setOpenId(null);
      try { window.track && window.track("idea_archived", { id }); } catch {}
    } catch (e) {
      console.error(e);
      alert("Échec de la sauvegarde — réessaie.");
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  // "Modifier" (legacy, notes quick-edit). La vraie édition complète
  // passe désormais par openEditModal ci-dessous.
  const handleDig = (idea) => openEditModal(idea);

  // ─── Ticket modal : create & edit ─────────────────────
  const openCreateModal = (prefillTitle = "", prefillLabels = []) => {
    setModal({
      open: true,
      mode: "create",
      ideaId: null,
      initial: { title: prefillTitle, description: "", labels: prefillLabels },
    });
  };
  const openEditModal = (idea) => {
    setModal({
      open: true,
      mode: "edit",
      ideaId: idea.id,
      initial: {
        title: idea.title || "",
        // On utilise notes si présent (édition perso), sinon body (description d'origine).
        description: idea.notes || idea.body || "",
        labels: Array.isArray(idea.labels) ? [...idea.labels] : [],
      },
    });
  };
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const handleModalSave = async (ticket) => {
    // ticket: { title, description, labels }
    if (modal.mode === "create") {
      await createIdea({
        title: ticket.title,
        body: ticket.description,
        labels: ticket.labels,
      });
    } else if (modal.mode === "edit" && modal.ideaId) {
      // Écrit à la fois description (canon) et notes (affiché dans le détail)
      // pour que les deux restent synchrones jusqu'à ce qu'on unifie.
      await patchIdea(modal.ideaId, {
        title: ticket.title,
        description: ticket.description,
        notes: ticket.description,
        labels: ticket.labels,
        updated_at: new Date().toISOString(),
      });
      try { window.track && window.track("idea_edited", { id: modal.ideaId }); } catch {}
    }
    closeModal();
  };

  const handleOpenSignal = () => onNavigate("signals");

  // Centralise la création d'une idée (capture bar + suggestions).
  const createIdea = async ({ title, body = "", labels = [], signals = [] }) => {
    if (!window.sb || !window.SUPABASE_URL) throw new Error("no client");
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const payload = {
      title,
      description: body,
      status: "seed",
      sector: "other",
      labels,
      related_trends: signals,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const rows = await window.sb.postJSON(
      `${window.SUPABASE_URL}/rest/v1/business_ideas`,
      payload
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.id) throw new Error("no row returned");
    const newIdea = {
      id: row.id,
      category: "business",
      labels: Array.isArray(row.labels) ? row.labels : labels,
      kicker: `Idée · ${new Date(nowIso).toLocaleDateString("fr", { weekday: "short", day: "numeric", month: "short" })}`,
      title: row.title,
      one_liner: body ? String(body).slice(0, 140) : "",
      body: row.description || "",
      notes: "",
      status: "seed",
      captured_at: todayStr,
      last_touched: todayStr,
      touched_count: 1,
      effort: 3, impact: 3, alignment: 3,
      signals,
      source: "idée perso",
      origin: "Capture rapide",
      related_ids: [],
      jarvis_prompt: "",
      jarvis_enriched: null,
      promoted_to_opp: null,
    };
    if (window.IDEAS_DATA?.ideas) {
      window.IDEAS_DATA.ideas = [newIdea, ...window.IDEAS_DATA.ideas];
    }
    forceRender(v => v + 1);
    return newIdea;
  };

  const handleCapture = async () => {
    const raw = captureValue.trim();
    if (!raw || capturing) return;
    if (!window.sb || !window.SUPABASE_URL) {
      setCaptureMsg({ kind: "err", text: "Client Supabase indisponible." });
      return;
    }
    const { title, labels } = parseHashtags(raw);
    if (!title) {
      setCaptureMsg({ kind: "err", text: "Il faut au moins un titre avant les #libellés." });
      return;
    }
    setCapturing(true);
    setCaptureMsg(null);
    try {
      const newIdea = await createIdea({ title, labels });
      setCaptureValue("");
      setCaptureMsg({ kind: "ok", text: labels.length ? `Idée captée avec ${labels.length} libellé${labels.length > 1 ? "s" : ""}.` : "Idée captée." });
      try { window.track && window.track("idea_captured", { id: newIdea.id, labels: labels.length }); } catch {}
      setTimeout(() => setCaptureMsg(null), 2500);
    } catch (e) {
      console.error(e);
      setCaptureMsg({ kind: "err", text: "Échec de la capture — réessaie." });
    } finally {
      setCapturing(false);
    }
  };

  // Drag & drop: déplacement d'une idée vers une autre colonne.
  const handleMoveStatus = async (id, nextStatus) => {
    if (pending[id]) return;
    const current = allIdeas.find(i => i.id === id);
    if (!current || current.status === nextStatus) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      await patchIdea(id, { status: nextStatus, updated_at: new Date().toISOString() });
      try { window.track && window.track("idea_moved", { id, from: current.status, to: nextStatus }); } catch {}
      forceRender(v => v + 1);
    } catch (e) {
      console.error(e);
      setCaptureMsg({ kind: "err", text: "Déplacement impossible — réessaie." });
      setTimeout(() => setCaptureMsg(null), 2500);
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  // Édition des libellés depuis le détail.
  const handleSetLabels = async (id, nextLabels) => {
    if (pending[id]) return;
    setPending(p => ({ ...p, [id]: true }));
    try {
      await patchIdea(id, { labels: nextLabels, updated_at: new Date().toISOString() });
      forceRender(v => v + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleAcceptSuggestion = async (sugg) => {
    try {
      const newIdea = await createIdea({
        title: sugg.title,
        body: sugg.description || "",
        labels: sugg.labels || [],
        signals: sugg.signals || [],
      });
      setSuggestDismissed(prev => [...prev, sugg.key]);
      try { window.track && window.track("suggestion_accepted", { key: sugg.key, source: sugg.source }); } catch {}
      setOpenId(newIdea.id);
    } catch (e) {
      console.error(e);
      alert("Impossible d'ajouter la suggestion — réessaie.");
    }
  };
  const handleDismissSuggestion = (key) => {
    setSuggestDismissed(prev => prev.includes(key) ? prev : [...prev, key]);
  };

  const onCaptureKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleCapture(); }
    else if (e.key === "Escape") { setCaptureValue(""); e.target.blur(); }
  };

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
        <input
          ref={captureRef}
          className="id-capture-input"
          placeholder="Capturer une idée — titre #libellé1 #libellé2, puis Entrée"
          value={captureValue}
          onChange={(e) => setCaptureValue(e.target.value)}
          onKeyDown={onCaptureKey}
          disabled={capturing}
        />
        {captureValue.trim() && (
          <button
            className="btn btn--primary"
            onClick={handleCapture}
            disabled={capturing}
            style={{fontSize: 12, padding: "6px 14px"}}
          >
            {capturing ? "…" : "Capturer"}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost id-capture-detailed"
          onClick={() => {
            const { title, labels } = parseHashtags(captureValue);
            openCreateModal(title, labels);
            setCaptureValue("");
          }}
          disabled={capturing}
          title="Ouvrir le formulaire complet (Ctrl+Shift+N)"
          style={{fontSize: 12, padding: "6px 12px"}}
        >
          <Icon name="edit" size={13} stroke={1.75} /> Détails
        </button>
        {captureMsg && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em",
            color: captureMsg.kind === "ok" ? "var(--positive)" : "var(--negative, #b3491a)"
          }}>
            {captureMsg.text}
          </span>
        )}
        <span className="id-capture-hint">
          <span className="id-capture-kbd">Ctrl</span>+<span className="id-capture-kbd">N</span> rapide · <span className="id-capture-kbd">Ctrl</span>+<span className="id-capture-kbd">⇧</span>+<span className="id-capture-kbd">N</span> modal
        </span>
      </div>

      {/* ── SUGGESTIONS ──────────────────────────── */}
      <SuggestionsSection
        allIdeas={allIdeas}
        onAccept={handleAcceptSuggestion}
        onDismiss={handleDismissSuggestion}
        dismissedIds={suggestDismissed}
      />

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

      {/* ── LABEL FILTERS (dynamiques) ─────────────── */}
      {labelCounts.length > 0 && (
        <div className="id-labfilters">
          <div className="id-labfilters-label">Libellés</div>
          <div className="id-labfilters-list">
            {labelCounts.slice(0, 20).map(([l, n]) => {
              const active = labelFilter.includes(l);
              return (
                <IdLabelChip
                  key={l}
                  label={`${l} · ${n}`}
                  active={active}
                  onClick={() => {
                    setLabelFilter(prev => active ? prev.filter(x => x !== l) : [...prev, l]);
                  }}
                />
              );
            })}
            {labelFilter.length > 0 && (
              <button
                className="id-labfilters-clear"
                onClick={() => setLabelFilter([])}
              >× clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── VIEWS ─────────────────────────────────── */}
      {view === "pipeline" && (
        <PipelineView
          ideas={filtered}
          stages={stages}
          onOpen={handleOpen}
          onMoveStatus={handleMoveStatus}
          pending={pending}
        />
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
            onSetLabels={handleSetLabels}
            pending={pending}
          />
        </div>
      )}

      {/* ── TICKET MODAL (create/edit) ────────────── */}
      <TicketModalSlot
        state={modal}
        onSave={handleModalSave}
        onCancel={closeModal}
        suggestions={labelCounts.map(([l]) => l)}
      />
    </div>
  );
}

// Slot qui lit window.TicketModal à l'exécution (composant chargé avant
// panel-ideas.jsx via <script type="text/babel">).
function TicketModalSlot({ state, onSave, onCancel, suggestions }) {
  const Mod = window.TicketModal;
  if (!Mod) return null;
  return (
    <Mod
      open={state.open}
      mode={state.mode}
      initial={state.initial}
      title={state.mode === "edit" ? "Modifier l'idée" : "Nouvelle idée"}
      hint={state.mode === "create"
        ? "Structure réutilisable : titre, description, libellés. Tu pourras enrichir plus tard."
        : "Modifie le ticket. Scores, signaux, statut se pilotent ailleurs."
      }
      onSave={onSave}
      onCancel={onCancel}
      labelSuggestions={suggestions}
    />
  );
}
