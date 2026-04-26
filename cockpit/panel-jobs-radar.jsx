// ═══════════════════════════════════════════════════════════════
// PANEL JOBS RADAR — Offres LinkedIn scorées par fit
// ─────────────────────────────────────────────
// Layout:
//   1. Scan banner (tendances 7j + signal CV + actions du jour)
//   2. Hot leads hero (score ≥ 7) — grandes cards avec intel déplié
//   3. Liste dense du reste (mid + low) — sortable, filtrable
//
// Actions dominantes : Postuler (ouvre URL) + Ouvrir lead LinkedIn
// ═══════════════════════════════════════════════════════════════

const { useState: useStateJr, useMemo: useMemoJr, useEffect: useEffectJr, useRef: useRefJr } = React;

// ─── Supabase write (status + user_notes only — scan is source of truth elsewhere) ───
async function patchJobSupabase(id, patch) {
  const safe = {};
  if ("status" in patch) safe.status = patch.status;
  if ("user_notes" in patch) safe.user_notes = patch.user_notes;
  if (!Object.keys(safe).length) return;
  if (!window.sb || !window.sb.patchJSON || !window.SUPABASE_URL) return;
  const url = window.SUPABASE_URL + "/rest/v1/jobs?id=eq." + encodeURIComponent(id);
  const r = await window.sb.patchJSON(url, safe);
  if (!r.ok) throw new Error("PATCH " + r.status);
}

const CAT_LABEL = {
  produit: "Produit",
  rte:     "RTE",
  pgm:     "PgM",
  pjm:     "PjM",
  cos:     "CoS",
};

const STAGE_LABEL = {
  seed:         "Seed",
  A:            "Série A",
  B:            "Série B",
  C:            "Série C",
  scale:        "Scale-up",
  grand_groupe: "Grand groupe",
};

const STAGE_WEIGHT = { seed: 0, A: 1, B: 2, C: 3, scale: 4, grand_groupe: 5 };

const STATUS_LABEL = {
  new:       "Nouveau",
  to_apply:  "À postuler",
  applied:   "Candidaté",
  snoozed:   "Snoozé",
  archived:  "Archivé",
};

// ─── Helpers ─────────────────────────────────────────────
function scoreBand(score) {
  if (score >= 7) return "hot";
  if (score >= 5) return "mid";
  return "low";
}

function dayLabel(n) {
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "hier";
  return `il y a ${n}j`;
}

function numberFmt(n) {
  return n.toFixed(1).replace(".", ",");
}

// ─── Toast — discreet feedback after a write op ───────────
function JrToast({ message, tone }) {
  if (!message) return null;
  return (
    <div className={`jr-toast jr-toast--${tone || "ok"}`} role="status" aria-live="polite">
      <Icon name={tone === "error" ? "x" : "check"} size={13} stroke={2.2} />
      <span>{message}</span>
    </div>
  );
}

// ─── Actions menu — kebab popover (snooze / archive / notes) ───
function JrActionsMenu({ offer, open, onToggle, onSnooze, onArchive, onEditNotes }) {
  const ref = useRefJr(null);
  useEffectJr(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onToggle(null); };
    const onKey = (e) => { if (e.key === "Escape") onToggle(null); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, onToggle]);
  return (
    <div className="jr-menu" ref={ref}>
      <button
        className="jr-btn jr-btn--icon jr-menu-trigger"
        onClick={(e) => { e.stopPropagation(); onToggle(open ? null : offer.id); }}
        aria-label="Actions"
        aria-expanded={open}
        title="Actions"
      >
        <span className="jr-menu-dots" aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="jr-menu-pop" role="menu">
          <button className="jr-menu-item" role="menuitem" disabled={offer.status === "snoozed"} onClick={() => onSnooze(offer.id)}>
            <Icon name="clock" size={13} stroke={2} />
            <span>Snoozer 7 jours</span>
          </button>
          <button className="jr-menu-item" role="menuitem" disabled={offer.status === "archived"} onClick={() => onArchive(offer.id)}>
            <Icon name="archive" size={13} stroke={2} />
            <span>Archiver</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={() => onEditNotes(offer.id)}>
            <Icon name="file_text" size={13} stroke={2} />
            <span>Éditer les notes</span>
          </button>
          {offer.intel_depth === "light" && (
            <button className="jr-menu-item" role="menuitem" disabled title="Feature à venir — enrichira l'intel manquant via Jarvis">
              <Icon name="sparkles" size={13} stroke={2} />
              <span>Enrichir l'Intel →</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notes editor — inline textarea + save ────────────────
function JrNotesEditor({ offer, onSave, onCancel }) {
  const [draft, setDraft] = useStateJr(offer.user_notes || "");
  return (
    <div className="jr-notes-editor">
      <div className="jr-section-kicker">Notes personnelles</div>
      <textarea
        className="jr-notes-input"
        value={draft}
        autoFocus
        rows={3}
        placeholder="Ta note sur cette offre (visible uniquement par toi)"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="jr-notes-actions">
        <button className="jr-btn jr-btn--ghost jr-btn--sm" onClick={onCancel}>Annuler</button>
        <button className="jr-btn jr-btn--primary jr-btn--sm" onClick={() => onSave(offer.id, draft.trim())}>Enregistrer</button>
      </div>
    </div>
  );
}

// ─── Score chip (big number, band color, decomposition on hover) ───
function ScoreChip({ offer, big = false }) {
  const band = scoreBand(offer.score_total);
  const total = numberFmt(offer.score_total);
  return (
    <div className={`jr-score jr-score--${band} ${big ? "jr-score--big" : ""}`}>
      <div className="jr-score-num">{total}</div>
      <div className="jr-score-unit">/10</div>
      <div className="jr-score-tip" role="tooltip">
        <div className="jr-score-tip-row">
          <span>Séniorité</span>
          <span className="jr-score-tip-val">{numberFmt(offer.score_seniority)}<span>/3</span></span>
        </div>
        <div className="jr-score-tip-row">
          <span>Secteur</span>
          <span className="jr-score-tip-val">{numberFmt(offer.score_sector)}<span>/3</span></span>
        </div>
        <div className="jr-score-tip-row">
          <span>Impact</span>
          <span className="jr-score-tip-val">{numberFmt(offer.score_impact)}<span>/4</span></span>
        </div>
        {offer.score_bonus > 0 && (
          <div className="jr-score-tip-row jr-score-tip-row--bonus">
            <span>Bonus</span>
            <span className="jr-score-tip-val">+1</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Salary estimate (hot leads — calibrated from JD + profile) ───
function SalaryEstimate({ estimate, targetRange }) {
  if (!estimate) return null;
  const { min, max, target, currency, basis, rationale } = estimate;
  if (min == null && max == null && target == null) return null;

  const cur = (!currency || currency === "EUR") ? "k€" : currency;
  const range = (min != null && max != null) ? `${min}-${max}` : (min != null ? String(min) : (max != null ? String(max) : ""));
  const tgt = target != null ? target : (min != null && max != null ? Math.round((min + max) / 2) : null);

  let inTarget = null;
  if (targetRange && tgt != null) {
    const m = String(targetRange).match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        inTarget = (tgt >= lo && tgt <= hi);
      }
    }
  }

  const tone = inTarget === true ? "in" : inTarget === false ? "out" : "neutral";
  const sourceLabel = basis === "published"
    ? "Calibré sur la fourchette publiée"
    : "Estimée depuis le marché + ton profil";

  const ariaLabel = rationale ? `${sourceLabel}. ${rationale}` : sourceLabel;
  const showInfo = !!(rationale || sourceLabel);

  return (
    <div className={`jr-salary jr-salary--${tone}`}>
      <div className="jr-salary-label">
        <Icon name="zap" size={12} stroke={2} />
        <span>Salaire estimé pour toi</span>
      </div>
      <div className="jr-salary-body">
        {tgt != null && <span className="jr-salary-target">~{tgt}{cur}</span>}
        {range && tgt != null && <span className="jr-salary-range">dans {range}{cur}</span>}
        {range && tgt == null && <span className="jr-salary-target">{range}{cur}</span>}
        {showInfo && (
          <button type="button" className="jr-salary-info" aria-label={ariaLabel}>
            <span aria-hidden="true">i</span>
            <span className="jr-salary-info-tip" role="tooltip">
              <span className="jr-salary-info-source">{sourceLabel}</span>
              {rationale && <span className="jr-salary-info-rationale">{rationale}</span>}
            </span>
          </button>
        )}
        {inTarget !== null && (
          <span className={`jr-salary-badge jr-salary-badge--${tone}`}>
            {inTarget ? "Dans ta fourchette cible" : "Hors fourchette cible"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Rubric justif (3 lines, one per axis) ─────────────────
function RubricBlock({ offer }) {
  return (
    <ul className="jr-rubric">
      {offer.rubric_justif.map((r, i) => (
        <li key={i} className="jr-rubric-row">
          <span className="jr-rubric-axis">{r.axis}</span>
          <span className="jr-rubric-text">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Hot lead card (big, intel déplié) ────────────────────
function HotLeadCard({ offer, rank, onApply, onSnooze, onArchive, onEditNotes, onSaveNotes, onCancelNotes, openMenu, onMenuToggle, notesEditing }) {
  const intel = offer.intel;
  const isNotesOpen = notesEditing === offer.id;
  const targetRange = (window.PROFILE_DATA && window.PROFILE_DATA._values && window.PROFILE_DATA._values.target_salary_range) || null;
  return (
    <article className="jr-hot">
      {/* Head: rank, score, CV, age */}
      <header className="jr-hot-head">
        <div className="jr-hot-rank">
          <span className="jr-hot-rank-num">#{String(rank + 1).padStart(2, "0")}</span>
          <span className="jr-hot-rank-label">HOT LEAD</span>
        </div>
        <ScoreChip offer={offer} big />
      </header>

      {/* Title + company + meta */}
      <div className="jr-hot-title-block">
        <div className="jr-hot-meta">
          <span className="jr-hot-cat">{CAT_LABEL[offer.role_category]}</span>
          <span className="jr-hot-sep">·</span>
          <span className="jr-hot-stage">{STAGE_LABEL[offer.company_stage]}</span>
          <span className="jr-hot-sep">·</span>
          <span className="jr-hot-age">Posté {dayLabel(offer.posted_days_ago)}</span>
          {offer.compensation && (<>
            <span className="jr-hot-sep">·</span>
            <span className="jr-hot-comp">{offer.compensation}</span>
          </>)}
        </div>
        <h2 className="jr-hot-title">{offer.title}</h2>
        <div className="jr-hot-company">{offer.company}</div>
      </div>

      <p className="jr-hot-pitch">{offer.pitch}</p>

      {/* Rubric */}
      <div className="jr-hot-rubric">
        <div className="jr-section-kicker">Pourquoi ce score</div>
        <RubricBlock offer={offer} />
      </div>

      {/* Salary estimate — calibrated for this profile */}
      {intel && intel.salary_estimate && (
        <SalaryEstimate estimate={intel.salary_estimate} targetRange={targetRange} />
      )}

      {/* Intel — only on hot leads */}
      {intel && (
        <div className="jr-hot-intel">
          <div className="jr-intel-grid">
            {/* Company signals */}
            <div className="jr-intel-block">
              <div className="jr-section-kicker">Signaux boîte</div>
              <ul className="jr-intel-list">
                {intel.company_signals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            {/* Lead + warm network */}
            <div className="jr-intel-block">
              <div className="jr-section-kicker">Lead identifié</div>
              {intel.lead && (
                <div className="jr-intel-lead">
                  <div className="jr-intel-lead-name">{intel.lead.name}</div>
                  <div className="jr-intel-lead-role">{intel.lead.role}</div>
                  <p className="jr-intel-lead-notes">{intel.lead.notes}</p>
                </div>
              )}
              {intel.warm_network && intel.warm_network.length > 0 && (
                <div className="jr-warm">
                  <div className="jr-warm-title">Réseau warm</div>
                  <ul className="jr-warm-list">
                    {intel.warm_network.map((w, i) => (
                      <li key={i} className="jr-warm-item">
                        <span className="jr-warm-degree">{w.degree === 1 ? "1er" : "2e"}°</span>
                        <div className="jr-warm-body">
                          <span className="jr-warm-name">{w.name}</span>
                          <span className="jr-warm-rel">{w.relation}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {intel.safe_maturity && (
                <div className="jr-safe-line">
                  <span className="jr-safe-label">SAFe</span>
                  <span className="jr-safe-val">{intel.safe_maturity}</span>
                </div>
              )}
            </div>
          </div>

          {/* Angle d'approche */}
          <div className="jr-angle">
            <div className="jr-angle-label">
              <Icon name="target" size={13} stroke={2} />
              <span>Angle d'approche</span>
            </div>
            <p className="jr-angle-text">{intel.angle}</p>
          </div>
        </div>
      )}

      {/* Notes editor (inline, toggled via menu) */}
      {isNotesOpen && (
        <JrNotesEditor offer={offer} onSave={onSaveNotes} onCancel={onCancelNotes} />
      )}
      {!isNotesOpen && offer.user_notes && (
        <div className="jr-notes-readonly">
          <div className="jr-section-kicker">Notes</div>
          <p>{offer.user_notes}</p>
        </div>
      )}

      {/* Actions footer */}
      <footer className="jr-hot-foot">
        <div className="jr-cv-reco">
          <span className={`jr-cv-badge jr-cv-badge--${offer.cv_recommended}`}>
            CV {offer.cv_recommended.toUpperCase()}
          </span>
          <span className="jr-cv-reason">{offer.cv_reason}</span>
        </div>
        <div className="jr-hot-actions">
          <JrActionsMenu
            offer={offer}
            open={openMenu === offer.id}
            onToggle={onMenuToggle}
            onSnooze={onSnooze}
            onArchive={onArchive}
            onEditNotes={onEditNotes}
          />
          {intel && intel.lead && intel.lead.linkedin && (
            <a className="jr-btn jr-btn--ghost" href={intel.lead.linkedin} target="_blank" rel="noopener noreferrer">
              <Icon name="user" size={14} stroke={2} />
              <span>Ouvrir le lead</span>
            </a>
          )}
          <button className="jr-btn jr-btn--primary" onClick={() => onApply(offer)} disabled={!offer.url}>
            <span>{offer.status === "applied" ? "Rouvrir sur LinkedIn" : "Postuler sur LinkedIn"}</span>
            <Icon name="arrow_right" size={14} stroke={2} />
          </button>
        </div>
      </footer>
    </article>
  );
}

// ─── List row (mid + low, dense) ──────────────────────────
function OfferRow({ offer, onApply, onSnooze, onArchive, onEditNotes, onSaveNotes, onCancelNotes, openMenu, onMenuToggle, notesEditing }) {
  const band = scoreBand(offer.score_total);
  const isNotesOpen = notesEditing === offer.id;
  return (
    <article className={`jr-row jr-row--${band} jr-row--${offer.status}`}>
      <div className="jr-row-score">
        <ScoreChip offer={offer} />
      </div>

      <div className="jr-row-main">
        <div className="jr-row-head">
          <div className="jr-row-title-wrap">
            <h3 className="jr-row-title">{offer.title}</h3>
            <span className="jr-row-company">{offer.company}</span>
          </div>
          <div className="jr-row-tags">
            <span className="jr-tag jr-tag--cat">{CAT_LABEL[offer.role_category]}</span>
            <span className="jr-tag jr-tag--stage">{STAGE_LABEL[offer.company_stage]}</span>
            {offer.status !== "new" && (
              <span className={`jr-tag jr-tag--status jr-tag--status-${offer.status}`}>
                {STATUS_LABEL[offer.status]}
              </span>
            )}
          </div>
        </div>
        <p className="jr-row-pitch">{offer.pitch}</p>
        <div className="jr-row-justif">
          {offer.rubric_justif.map((r, i) => (
            <span key={i} className="jr-row-justif-item">
              <span className="jr-row-justif-axis">{r.axis}</span>
              <span className="jr-row-justif-dot">·</span>
              <span className="jr-row-justif-text">{r.text}</span>
            </span>
          ))}
        </div>
        {isNotesOpen && (
          <JrNotesEditor offer={offer} onSave={onSaveNotes} onCancel={onCancelNotes} />
        )}
        {!isNotesOpen && offer.user_notes && (
          <div className="jr-notes-readonly jr-notes-readonly--row">
            <span className="jr-section-kicker">Notes</span>
            <span>{offer.user_notes}</span>
          </div>
        )}
      </div>

      <div className="jr-row-meta">
        <div className="jr-row-meta-line">
          <span className="jr-row-meta-age">{dayLabel(offer.posted_days_ago)}</span>
          {offer.compensation && <span className="jr-row-meta-comp">{offer.compensation}</span>}
        </div>
        <div className="jr-row-meta-cv">
          <span className={`jr-cv-badge jr-cv-badge--${offer.cv_recommended}`}>
            CV {offer.cv_recommended.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="jr-row-actions">
        <JrActionsMenu
          offer={offer}
          open={openMenu === offer.id}
          onToggle={onMenuToggle}
          onSnooze={onSnooze}
          onArchive={onArchive}
          onEditNotes={onEditNotes}
        />
        <button className="jr-btn jr-btn--icon" onClick={() => onApply(offer)} disabled={!offer.url} title={offer.status === "applied" ? "Rouvrir sur LinkedIn" : "Postuler sur LinkedIn"}>
          <Icon name="arrow_right" size={14} stroke={2.2} />
        </button>
      </div>
    </article>
  );
}

// ─── Scan banner (tendances, signal CV, actions du jour) ───
function ScanBanner({ scan }) {
  const { volumes_7d, ratios_category } = scan.tendances;
  const maxVol = Math.max(...volumes_7d);
  const days = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <section className="jr-scan">
      <div className="jr-scan-grid">

        {/* Volumes 7j */}
        <div className="jr-scan-block">
          <div className="jr-scan-kicker">Volume 7 jours</div>
          <div className="jr-scan-sparkbars">
            {volumes_7d.map((v, i) => (
              <div key={i} className="jr-sparkbar">
                <div className="jr-sparkbar-fill" style={{ height: `${(v / maxVol) * 100}%` }}>
                  <span className="jr-sparkbar-val">{v}</span>
                </div>
                <div className="jr-sparkbar-label">{days[i]}</div>
              </div>
            ))}
          </div>
          <div className="jr-scan-footline">
            <strong>{scan.processed_count}</strong> triées aujourd'hui · {scan.raw_count} brutes · <span className="jr-scan-hot"><strong>{scan.hot_leads_count}</strong> hot</span>
          </div>
        </div>

        {/* Répartition par catégorie */}
        <div className="jr-scan-block">
          <div className="jr-scan-kicker">Répartition catégories</div>
          <div className="jr-scan-bars">
            {ratios_category.map(r => (
              <div key={r.id} className="jr-ratbar">
                <div className="jr-ratbar-label">
                  <span>{r.label}</span>
                  <span className="jr-ratbar-val">{r.pct}%</span>
                </div>
                <div className="jr-ratbar-track">
                  <div className="jr-ratbar-fill" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal CV */}
        <div className="jr-scan-block jr-scan-block--cv">
          <div className="jr-scan-kicker">Signal CV · {scan.signal_cv.window_days}j</div>
          <div className="jr-cv-split">
            <div className="jr-cv-split-bar">
              <div className="jr-cv-split-pdf"  style={{ width: `${scan.signal_cv.pdf_pct}%` }}>
                <span>PDF {scan.signal_cv.pdf_pct}%</span>
              </div>
              <div className="jr-cv-split-docx" style={{ width: `${scan.signal_cv.docx_pct}%` }}>
                <span>DOCX {scan.signal_cv.docx_pct}%</span>
              </div>
            </div>
          </div>
          <p className="jr-cv-insight">{scan.signal_cv.insight}</p>
        </div>

        {/* Actions du jour */}
        <div className="jr-scan-block jr-scan-block--actions">
          <div className="jr-scan-kicker">Actions du jour</div>
          <ul className="jr-actions-list">
            {scan.actions.map(a => (
              <li key={a.id} className="jr-action-item">
                <div className="jr-action-body">
                  <span className={`jr-action-kind jr-action-kind--${a.kind}`}>{a.kind === "apply" ? "Relance" : "Prep"}</span>
                  <span className="jr-action-label">{a.label}</span>
                </div>
                <button className="jr-btn jr-btn--ghost jr-btn--sm">{a.cta}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─── Main Panel ──────────────────────────────────────────
function PanelJobsRadar({ data, onNavigate }) {
  const jobs = window.JOBS_DATA;
  if (!jobs) return null;
  const scan = jobs.scan;

  // Local state — mirrors window.JOBS_DATA.offers, applies optimistic patches.
  const [offers, setOffers] = useStateJr(() => (jobs.offers || []).slice());
  const [toast, setToast] = useStateJr(null);
  const [openMenu, setOpenMenu] = useStateJr(null);
  const [notesEditing, setNotesEditing] = useStateJr(null);
  const toastTimer = useRefJr(null);

  // Re-sync if window.JOBS_DATA.offers was replaced by a Tier 2 load after mount
  useEffectJr(() => {
    const w = window.JOBS_DATA;
    if (w && Array.isArray(w.offers) && w.offers !== offers) {
      setOffers(w.offers.slice());
    }
  }, []); // eslint-disable-line

  // Realtime — refresh when a Cowork scan lands while the panel is open.
  useEffectJr(() => {
    const client = window.sb && window.sb.client;
    if (!client || typeof client.channel !== "function") return;
    const refresh = () => {
      try {
        if (window.cockpitDataLoader?.cache) delete window.cockpitDataLoader.cache.jobs_all;
        window.cockpitDataLoader?.loadPanel?.("jobs").then(() => {
          const fresh = window.JOBS_DATA?.offers;
          if (Array.isArray(fresh)) setOffers(fresh.slice());
        });
      } catch {}
    };
    const ch = client
      .channel("jobs_radar_sub")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_scans" }, refresh)
      .subscribe();
    return () => { try { client.removeChannel(ch); } catch {} };
  }, []);

  const showToast = (message, tone) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone: tone || "ok" });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const updateJob = (id, patch, toastMsg) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
    // Mirror the change into the global so other views / re-mounts see it
    try {
      if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA.offers)) {
        const idx = window.JOBS_DATA.offers.findIndex(o => o.id === id);
        if (idx >= 0) window.JOBS_DATA.offers[idx] = { ...window.JOBS_DATA.offers[idx], ...patch };
      }
    } catch {}
    try {
      const key = Object.keys(patch)[0];
      window.track && window.track("jobs_action", {
        action: key,
        job_id: String(id).slice(0, 64),
        value: String(patch[key] ?? "").slice(0, 64),
      });
    } catch {}
    patchJobSupabase(id, patch)
      .then(() => { if (toastMsg) showToast(toastMsg, "ok"); })
      .catch(() => showToast("Erreur de sync — changement local uniquement", "error"));
  };

  const applyToJob = (offer) => {
    if (!offer || !offer.url) return;
    try { window.open(offer.url, "_blank", "noopener,noreferrer"); } catch {}
    if (offer.status !== "applied") {
      updateJob(offer.id, { status: "applied" }, "Postulé · statut mis à jour");
    }
    setOpenMenu(null);
  };
  const snoozeJob = (id) => { updateJob(id, { status: "snoozed" }, "Snoozée 7 jours"); setOpenMenu(null); };
  const archiveJob = (id) => { updateJob(id, { status: "archived" }, "Archivée"); setOpenMenu(null); };
  const startEditNotes = (id) => { setNotesEditing(id); setOpenMenu(null); };
  const cancelEditNotes = () => setNotesEditing(null);
  const saveNotes = (id, notes) => { updateJob(id, { user_notes: notes }, "Notes enregistrées"); setNotesEditing(null); };

  const cardHandlers = {
    onApply: applyToJob,
    onSnooze: snoozeJob,
    onArchive: archiveJob,
    onEditNotes: startEditNotes,
    onSaveNotes: saveNotes,
    onCancelNotes: cancelEditNotes,
    openMenu,
    onMenuToggle: setOpenMenu,
    notesEditing,
  };

  // Filters
  const [scoreFilter, setScoreFilter]   = useStateJr("all");  // all | hot | mid | low
  const [catFilter,   setCatFilter]     = useStateJr("all");
  const [statusFilter,setStatusFilter]  = useStateJr("active"); // active = new+to_apply+applied (hide archived+snoozed)
  const [query,       setQuery]         = useStateJr("");
  const [sort,        setSort]          = useStateJr("score"); // score | recent

  // Split hot leads vs rest
  const hotLeads = useMemoJr(() =>
    offers.filter(o => o.score_total >= 7 && o.status !== "archived" && o.status !== "snoozed")
          .sort((a, b) => b.score_total - a.score_total),
  [offers]);

  // Filtered list (for the dense list below the hero)
  const listOffers = useMemoJr(() => {
    let arr = offers.slice();
    // Hide hot leads from the list — they're in the hero
    arr = arr.filter(o => !hotLeads.find(h => h.id === o.id));

    if (scoreFilter !== "all") {
      arr = arr.filter(o => scoreBand(o.score_total) === scoreFilter);
    }
    if (catFilter !== "all") {
      arr = arr.filter(o => o.role_category === catFilter);
    }
    if (statusFilter === "active") {
      arr = arr.filter(o => o.status === "new" || o.status === "to_apply" || o.status === "applied");
    } else if (statusFilter !== "all") {
      arr = arr.filter(o => o.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.company.toLowerCase().includes(q) ||
        (o.pitch || "").toLowerCase().includes(q)
      );
    }

    if (sort === "score") {
      arr.sort((a, b) => b.score_total - a.score_total);
    } else if (sort === "recent") {
      arr.sort((a, b) => a.posted_days_ago - b.posted_days_ago);
    }
    return arr;
  }, [offers, hotLeads, scoreFilter, catFilter, statusFilter, query, sort]);

  // Stats line
  const totalCount = offers.length;
  const newCount = offers.filter(o => o.status === "new").length;

  return (
    <div className="panel panel-jobs-radar">
      {/* ─── HEADER ─── */}
      <header className="jr-header">
        <div className="jr-header-top">
          <div className="jr-kicker">Jobs Radar · {scan.date_label}</div>
          <div className="jr-header-stats">
            <span><strong>{newCount}</strong> nouvelles</span>
            <span className="jr-sep">·</span>
            <span><strong>{hotLeads.length}</strong> hot leads</span>
            <span className="jr-sep">·</span>
            <span><strong>{totalCount}</strong> au total dans le radar</span>
          </div>
        </div>
        <h1 className="jr-title">
          <span className="jr-title-main">Scan LinkedIn du jour</span>
          <span className="jr-title-sub">
            {scan.raw_count} offres brutes réduites à {scan.processed_count} pertinentes, scorées selon ton fit.
          </span>
        </h1>
      </header>

      {/* ─── SCAN BANNER ─── */}
      <ScanBanner scan={scan} />

      {/* ─── HOT LEADS HERO ─── */}
      {hotLeads.length > 0 && (
        <section className="jr-hot-section">
          <div className="jr-section-head">
            <div className="jr-section-kicker jr-section-kicker--hero">
              <span className="jr-hot-marker" />
              Hot leads · score ≥ 7
            </div>
            <h2 className="jr-section-title">
              {hotLeads.length === 1
                ? "1 offre qui mérite ton matin"
                : `${hotLeads.length} offres qui méritent ton matin`}
            </h2>
          </div>
          <div className="jr-hot-grid">
            {hotLeads.map((o, i) => <HotLeadCard key={o.id} offer={o} rank={i} {...cardHandlers} />)}
          </div>
        </section>
      )}

      {/* ─── FILTERS + LIST ─── */}
      <section className="jr-list-section">
        <div className="jr-section-head jr-section-head--list">
          <div>
            <div className="jr-section-kicker">Le reste du scan</div>
            <h2 className="jr-section-title">
              {listOffers.length} offre{listOffers.length > 1 ? "s" : ""} à trier
            </h2>
          </div>
          <div className="jr-filters">
            <div className="jr-search">
              <Icon name="search" size={14} stroke={2} />
              <input
                className="jr-search-input"
                placeholder="Titre, boîte, pitch…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <FilterGroup
              value={scoreFilter} onChange={setScoreFilter}
              options={[
                { id: "all", label: "Tous scores" },
                { id: "hot", label: "Hot (≥7)" },
                { id: "mid", label: "Mid (5-7)" },
                { id: "low", label: "Low (<5)" },
              ]}
            />
            <FilterGroup
              value={catFilter} onChange={setCatFilter}
              options={[
                { id: "all",     label: "Tous rôles" },
                { id: "produit", label: "Produit" },
                { id: "rte",     label: "RTE" },
                { id: "pgm",     label: "PgM" },
                { id: "pjm",     label: "PjM" },
                { id: "cos",     label: "CoS" },
              ]}
            />
            <FilterGroup
              value={statusFilter} onChange={setStatusFilter}
              options={[
                { id: "active",   label: "Actives" },
                { id: "new",      label: "Nouvelles" },
                { id: "to_apply", label: "À postuler" },
                { id: "applied",  label: "Candidaté" },
                { id: "all",      label: "Tout" },
              ]}
            />
            <div className="jr-sort">
              <button
                className={`jr-sort-btn ${sort === "score" ? "is-active" : ""}`}
                onClick={() => setSort("score")}>Score</button>
              <button
                className={`jr-sort-btn ${sort === "recent" ? "is-active" : ""}`}
                onClick={() => setSort("recent")}>Récence</button>
            </div>
          </div>
        </div>

        {listOffers.length === 0 ? (
          <div className="jr-empty">
            <div className="jr-empty-icon"><Icon name="search" size={28} stroke={1.5} /></div>
            <div className="jr-empty-title">Aucune offre avec ces filtres</div>
            <div className="jr-empty-sub">Essaie de relâcher un critère — ou reviens demain matin.</div>
          </div>
        ) : (
          <div className="jr-list">
            {listOffers.map(o => <OfferRow key={o.id} offer={o} {...cardHandlers} />)}
          </div>
        )}
      </section>

      {toast && <JrToast message={toast.message} tone={toast.tone} />}
    </div>
  );
}

// ─── Filter segmented button group ───────────────────────
function FilterGroup({ value, onChange, options }) {
  return (
    <div className="jr-filter-group">
      {options.map(o => (
        <button
          key={o.id}
          className={`jr-filter-btn ${value === o.id ? "is-active" : ""}`}
          onClick={() => onChange(o.id)}
        >{o.label}</button>
      ))}
    </div>
  );
}

window.PanelJobsRadar = PanelJobsRadar;
