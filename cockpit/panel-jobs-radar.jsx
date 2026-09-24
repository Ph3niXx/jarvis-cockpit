// ═══════════════════════════════════════════════════════════════
// PANEL JOBS RADAR — Offres LinkedIn scorées par fit
// ─────────────────────────────────────────────
// Layout (ADR-52) :
//   1. Scan banner (tendances 7j + actions du jour)
//   2. « À décider » — hot leads (≥ 7) non triés des 7 derniers jours
//   3. « Tes candidatures » — suivi et issues (entretien / refus / sans réponse)
//   4. Liste dense du reste — sortable, filtrable
//
// Tri en un geste : Lire l'annonce / J'ai postulé / Pas pour moi.
// ═══════════════════════════════════════════════════════════════

const { useState: useStateJr, useMemo: useMemoJr, useEffect: useEffectJr, useRef: useRefJr } = React;

// Logique pure du tri (cockpit/lib/jobs-view.js, script classique chargé avant
// les panels Babel) — spec 2026-09-24, ADR-52.
const JV = window.jobsView;

// ─── Supabase write (user-editable fields: status, user_notes, user_verdict*, closed_at) ───
async function patchJobSupabase(id, patch) {
  const safe = {};
  if ("status" in patch) safe.status = patch.status;
  if ("user_notes" in patch) safe.user_notes = patch.user_notes;
  if ("user_verdict" in patch) safe.user_verdict = patch.user_verdict;
  if ("user_verdict_reason" in patch) safe.user_verdict_reason = patch.user_verdict_reason;
  if ("user_verdict_at" in patch) safe.user_verdict_at = patch.user_verdict_at;
  if ("closed_at" in patch) safe.closed_at = patch.closed_at;
  // Suivi de candidature (sql/030). Sans ces trois lignes, la whitelist
  // ci-dessus avale silencieusement le patch et le bouton « Relancer »
  // n'écrirait rien — c'est une liste blanche stricte, pas un filtre indicatif.
  if ("applied_at" in patch) safe.applied_at = patch.applied_at;
  if ("last_followup_at" in patch) safe.last_followup_at = patch.last_followup_at;
  if ("followup_count" in patch) safe.followup_count = patch.followup_count;
  if (!Object.keys(safe).length) return;
  if (!window.sb || !window.sb.patchJSON || !window.SUPABASE_URL) return;
  const url = window.SUPABASE_URL + "/rest/v1/jobs?id=eq." + encodeURIComponent(id);
  const r = await window.sb.patchJSON(url, safe);
  if (!r.ok) throw new Error("PATCH " + r.status);
}

// ─── Upsert d'une clé user_profile (réutilise le pattern du panel Profil) ───
async function upsertUserProfile(key, value) {
  if (!window.sb || !window.SUPABASE_URL) throw new Error("supabase indisponible");
  const url = window.SUPABASE_URL + "/rest/v1/user_profile?on_conflict=key";
  const body = [{ key, value, updated_at: new Date().toISOString() }];
  const res = await fetch(url, {
    method: "POST",
    headers: { ...window.sb.headers, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("upsert " + res.status);
  return res.json();
}

const CAT_LABEL = {
  produit: "Produit",
  rte:     "RTE",
  pgm:     "PgM",
  pjm:     "PjM",
  cos:     "CoS",
  em:      "EM",
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

// Libellés des puces de filtres actifs (toolbar) — module-level pour éviter
// la réallocation à chaque render. STATUS distinct de STATUS_LABEL (clés + libellés différents).
const JR_SCORE_LABEL  = { hot: "Hot ≥7", mid: "Mid 5-7", low: "Low <5" };
const JR_STATUS_LABEL = { new: "Nouvelles", to_apply: "À postuler", closed: "Clôturées", all: "Tout" };
const JR_FRESH_LABEL  = { "24h": "< 24h", "7j": "< 7j" };

// ─── Helpers ─────────────────────────────────────────────
function scoreBand(score) {
  if (score >= 7) return "hot";
  if (score >= 5) return "mid";
  return "low";
}
// Une offre clôturée est « morte » et masquée — sauf une candidature, quelle
// que soit son issue (ADR-52).
function jrIsDead(o) { return JV.isDead(o); }

function dayLabel(n) {
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "hier";
  return `il y a ${n}j`;
}

// ─── Persistance des filtres (localStorage) — toolbar 2026-05-31 ───
const JR_FILTERS_KEY = "jr.filters.v1";
function loadJrFilters() {
  try {
    const raw = localStorage.getItem(JR_FILTERS_KEY);
    // Une version antérieure a pu mémoriser le filtre « Candidaté », qui
    // n'existe plus : les candidatures ont leur zone (ADR-52).
    return raw ? JV.normalizeStoredFilters(JSON.parse(raw)) : {};
  } catch { return {}; }
}

function numberFmt(n) {
  return n.toFixed(1).replace(".", ",");
}

// ─── Toast — feedback discret après une écriture, « Annuler » optionnel ───
function JrToast({ message, tone, action }) {
  if (!message) return null;
  return (
    <div className={`jr-toast jr-toast--${tone || "ok"}`} role="status" aria-live="polite">
      <Icon name={tone === "error" ? "x" : "check"} size={13} stroke={2.2} />
      <span>{message}</span>
      {action && (
        <button type="button" className="jr-toast-action" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}

// Ferme un popover au clic extérieur ou sur Échap (menu ⋯, « Pas pour moi »).
function useJrDismiss(ref, open, close) {
  useEffectJr(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
}

// Après un geste, la ligne sort ou se re-trie aussitôt : le 2e clic d'un
// double-clic tomberait sur le bouton de la ligne voisine, glissé sous le
// pointeur, et écrirait sur la mauvaise offre. Ce 2e clic porte
// event.detail = 2 : on l'ignore. Le clavier donne detail = 0.
function jrSingleClick(fn) {
  return (e) => { if (e && e.detail > 1) return; fn(e); };
}

// ─── Actions menu — kebab popover (snooze / notes / clôture) ───
// « Archiver » a disparu (ADR-52) : « Pas pour moi » le remplace, et un
// archivage sans raison est un signal perdu.
function JrActionsMenu({ offer, open, onToggle, onSnooze, onEditNotes, onClose, onReopen }) {
  const ref = useRefJr(null);
  useJrDismiss(ref, open, () => onToggle(null));
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
          <button className="jr-menu-item" role="menuitem" disabled={offer.status === "snoozed"} onClick={jrSingleClick(() => onSnooze(offer.id))}>
            <Icon name="clock" size={13} stroke={2} />
            <span>Snoozer 7 jours</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={jrSingleClick(() => onEditNotes(offer.id))}>
            <Icon name="file_text" size={13} stroke={2} />
            <span>Éditer les notes</span>
          </button>
          {!offer.closed_at && !JV.isApplication(offer) && (
            <button className="jr-menu-item" role="menuitem" onClick={jrSingleClick(() => onClose(offer.id))}>
              <Icon name="x" size={13} stroke={2} />
              <span>Marquer clôturée</span>
            </button>
          )}
          {offer.closed_at && (
            <button className="jr-menu-item" role="menuitem" onClick={jrSingleClick(() => onReopen(offer.id))}>
              <Icon name="refresh" size={13} stroke={2} />
              <span>Rouvrir</span>
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

// ─── « Pas pour moi » — une raison = une décision (ADR-52) ───
// Précision libre facultative en tête, puis trois raisons à un clic.
// « Lien mort » est à part : il clôture l'offre et n'est pas un avis.
function JrNotForMe({ offer, compact = false, onDecide, onDeadLink }) {
  const [open, setOpen] = useStateJr(false);
  const [free, setFree] = useStateJr("");
  const ref = useRefJr(null);
  useJrDismiss(ref, open, () => setOpen(false));
  const decide = (code) => { setOpen(false); onDecide(offer, code, free); setFree(""); };
  return (
    <div className={`jr-nfm ${compact ? "jr-nfm--compact" : ""}`} ref={ref}>
      <button
        className={compact ? "jr-btn jr-btn--icon" : "jr-btn jr-btn--ghost"}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-expanded={open}
        title="Pas pour moi">
        <Icon name="x" size={compact ? 14 : 13} stroke={2.2} />
        {!compact && <span>Pas pour moi</span>}
        {!compact && <Icon name={open ? "chevron_up" : "chevron_down"} size={12} stroke={2} />}
      </button>
      {open && (
        <div className="jr-nfm-pop" role="menu" aria-label="Pourquoi pas pour toi ?">
          <input
            className="jr-nfm-free"
            value={free}
            autoFocus
            placeholder="préciser (optionnel)…"
            onChange={(e) => setFree(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter" && free.trim()) decide(null); }} />
          {JV.NOT_FOR_ME_REASONS.map((r) => (
            <button key={r.code} className="jr-nfm-opt" role="menuitem"
              onClick={jrSingleClick((e) => { e.stopPropagation(); decide(r.code); })}>
              {r.label}
            </button>
          ))}
          <div className="jr-nfm-sep" />
          <button className="jr-nfm-opt jr-nfm-opt--dead" role="menuitem"
            onClick={jrSingleClick((e) => { e.stopPropagation(); setOpen(false); setFree(""); onDeadLink(offer); })}>
            <Icon name="x" size={12} stroke={2} />
            <span>{JV.DEAD_LINK_LABEL}</span>
          </button>
          <div className="jr-nfm-foot">Lien mort = offre clôturée, pas un avis.</div>
        </div>
      )}
    </div>
  );
}

// ─── Actions de tri : lire ≠ postuler (ADR-52) ───
// Sur une candidature, seul « Lire l'annonce » reste : la décision est prise.
function JrTriageActions({ offer, zone, compact = false, onRead, onApplied, onNotForMe, onDeadLink }) {
  const decided = JV.isApplication(offer);
  return (
    <div className={`jr-triage ${compact ? "jr-triage--compact" : ""}`}>
      <button
        className={compact ? "jr-btn jr-btn--icon" : "jr-btn jr-btn--ghost"}
        onClick={jrSingleClick(() => onRead(offer, zone))}
        disabled={!offer.url}
        title="Lire l'annonce">
        <Icon name="eye" size={14} stroke={2} />
        {!compact && <span>Lire l'annonce</span>}
      </button>
      {!decided && (
        <button
          className={compact ? "jr-btn jr-btn--icon" : "jr-btn jr-btn--primary"}
          onClick={jrSingleClick(() => onApplied(offer))}
          title="J'ai postulé">
          <Icon name="check" size={14} stroke={2.2} />
          {!compact && <span>J'ai postulé</span>}
        </button>
      )}
      {!decided && (
        <JrNotForMe offer={offer} compact={compact} onDecide={onNotForMe} onDeadLink={onDeadLink} />
      )}
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

// Belt-and-suspenders: even with the normalizer in data-loader.js, never let
// an upstream shape drift crash the panel. Coerce to string at render time.
function safeRubricText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return ""; }
}

// ─── Rubric justif (3 lines, one per axis) ─────────────────
function RubricBlock({ offer }) {
  const items = Array.isArray(offer.rubric_justif) ? offer.rubric_justif : [];
  return (
    <ul className="jr-rubric">
      {items.map((r, i) => (
        <li key={i} className="jr-rubric-row">
          <span className="jr-rubric-axis">{safeRubricText(r && r.axis)}</span>
          <span className="jr-rubric-text">{safeRubricText(r && r.text)}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Skills attendus (split : présent sur le CV / à acquérir) ───
function JrSkills({ skills, source }) {
  if (!Array.isArray(skills) || !skills.length) return null;
  const have = skills.filter(s => s && s.on_cv);
  const gap  = skills.filter(s => s && !s.on_cv);
  return (
    <div className="jr-skills">
      <div className="jr-section-kicker">
        Skills attendus dans l'offre
        {source === "highlights" && <span className="jr-skills-source">d'après l'annonce</span>}
      </div>
      <div className="jr-skills-split">
        <div className="jr-skills-col jr-skills-col--have">
          <div className="jr-skills-head">Tu as déjà <span className="jr-skills-count">{have.length}</span></div>
          <ul className="jr-skills-chips">
            {have.map((s, i) => <li key={i} className="jr-skill jr-skill--have">{s.name}</li>)}
            {!have.length && <li className="jr-skills-empty">—</li>}
          </ul>
        </div>
        <div className="jr-skills-col jr-skills-col--gap">
          <div className="jr-skills-head">À acquérir <span className="jr-skills-count">{gap.length}</span></div>
          <ul className="jr-skills-chips">
            {gap.map((s, i) => <li key={i} className="jr-skill jr-skill--gap">{s.name}</li>)}
            {!gap.length && <li className="jr-skills-empty">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Hot lead card (big, intel déplié) ────────────────────
function HotLeadCard({ offer, rank, zone = "decide", onRead, onApplied, onNotForMe, onDeadLink, onSnooze, onEditNotes, onSaveNotes, onCancelNotes, onClose, onReopen, openMenu, onMenuToggle, notesEditing }) {
  const intel = offer.intel;
  const logo = (intel && intel.employer_logo) || null;
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
          <span className="jr-hot-age">Repérée {dayLabel(offer.seen_days_ago)}</span>
          {offer.posted_days_ago != null && (<>
            <span className="jr-hot-sep">·</span>
            <span className="jr-hot-age">publiée {dayLabel(offer.posted_days_ago)}</span>
          </>)}
          {offer.compensation && (<>
            <span className="jr-hot-sep">·</span>
            <span className="jr-hot-comp">{offer.compensation}</span>
          </>)}
          {offer.is_remote && (<>
            <span className="jr-hot-sep">·</span>
            <span className="jr-hot-remote">Remote</span>
          </>)}
        </div>
        <h2 className="jr-hot-title">{offer.title}</h2>
        <div className="jr-hot-company">
          {logo && <img className="jr-hot-logo" src={logo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          <span>{offer.company}</span>
        </div>
      </div>

      <p className="jr-hot-pitch">{offer.pitch}</p>

      {/* Rubric */}
      <div className="jr-hot-rubric">
        <div className="jr-section-kicker">Pourquoi ce score</div>
        <RubricBlock offer={offer} />
      </div>

      {/* Skills attendus — tu as / à acquérir */}
      {intel && <JrSkills skills={intel.skills_required} source={intel.skills_source} />}

      {/* Salary estimate — calibrated for this profile */}
      {intel && intel.salary_estimate && (
        <SalaryEstimate estimate={intel.salary_estimate} targetRange={targetRange} />
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
        <JrTriageActions offer={offer} zone={zone} onRead={onRead} onApplied={onApplied} onNotForMe={onNotForMe} onDeadLink={onDeadLink} />
        <div className="jr-hot-actions">
          <JrActionsMenu
            offer={offer}
            open={openMenu === offer.id}
            onToggle={onMenuToggle}
            onSnooze={onSnooze}
            onEditNotes={onEditNotes}
            onClose={onClose}
            onReopen={onReopen}
          />
        </div>
      </footer>
    </article>
  );
}

// ─── List row (mid + low, dense) ──────────────────────────
function OfferRow({ offer, onRead, onApplied, onNotForMe, onDeadLink, onSnooze, onEditNotes, onSaveNotes, onCancelNotes, onClose, onReopen, openMenu, onMenuToggle, notesEditing }) {
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
            {offer.is_remote && <span className="jr-tag jr-tag--remote">Remote</span>}
            {offer.status !== "new" && (
              <span className={`jr-tag jr-tag--status jr-tag--status-${offer.status}`}>
                {STATUS_LABEL[offer.status]}
              </span>
            )}
            {offer.user_verdict === "down" && (
              <span className="jr-tag jr-tag--reason">{JV.reasonTag(offer.user_verdict_reason)}</span>
            )}
          </div>
        </div>
        <p className="jr-row-pitch">{offer.pitch}</p>
        <div className="jr-row-justif">
          {(Array.isArray(offer.rubric_justif) ? offer.rubric_justif : []).map((r, i) => (
            <span key={i} className="jr-row-justif-item">
              <span className="jr-row-justif-axis">{safeRubricText(r && r.axis)}</span>
              <span className="jr-row-justif-dot">·</span>
              <span className="jr-row-justif-text">{safeRubricText(r && r.text)}</span>
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
          <span className="jr-row-meta-age" title={offer.posted_days_ago != null ? `Repérée ${dayLabel(offer.seen_days_ago)} · publiée ${dayLabel(offer.posted_days_ago)}` : undefined}>Repérée {dayLabel(offer.seen_days_ago)}</span>
          {offer.compensation && <span className="jr-row-meta-comp">{offer.compensation}</span>}
        </div>
      </div>

      <div className="jr-row-actions">
        <JrTriageActions offer={offer} zone="list" compact onRead={onRead} onApplied={onApplied} onNotForMe={onNotForMe} onDeadLink={onDeadLink} />
        <JrActionsMenu
          offer={offer}
          open={openMenu === offer.id}
          onToggle={onMenuToggle}
          onSnooze={onSnooze}
          onEditNotes={onEditNotes}
          onClose={onClose}
          onReopen={onReopen}
        />
      </div>
    </article>
  );
}

// ─── Zone 2 — Tes candidatures (ADR-52) ───────────────────
// Repliée par défaut ; l'état plié/déplié est une commodité de ce navigateur.
const JR_APPS_OPEN_KEY = "jr.apps.open.v1";
function loadAppsOpen() {
  try { return localStorage.getItem(JR_APPS_OPEN_KEY) === "1"; } catch { return false; }
}

function JrAppMenu({ offer, open, onToggle, onRead, onFollowUp, onEditNotes, onNotApplied }) {
  const ref = useRefJr(null);
  useJrDismiss(ref, open, () => onToggle(null));
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
          {offer.status === "applied" && (
            <button className="jr-menu-item" role="menuitem" onClick={jrSingleClick(() => { onToggle(null); onFollowUp(offer.id); })}>
              <Icon name="envelope" size={13} stroke={2} />
              <span>Relancer</span>
            </button>
          )}
          <button className="jr-menu-item" role="menuitem" disabled={!offer.url} onClick={jrSingleClick(() => { onToggle(null); onRead(offer, "applications"); })}>
            <Icon name="eye" size={13} stroke={2} />
            <span>Lire l'annonce</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={jrSingleClick(() => onEditNotes(offer.id))}>
            <Icon name="file_text" size={13} stroke={2} />
            <span>Éditer les notes</span>
          </button>
          <button className="jr-menu-item" role="menuitem" onClick={jrSingleClick(() => onNotApplied(offer))}>
            <Icon name="archive" size={13} stroke={2} />
            <span>Pas candidaté en fait</span>
          </button>
        </div>
      )}
    </div>
  );
}

function JrApplicationRow({ offer, onRead, onOutcome, onFollowUp, onNotApplied, onEditNotes, onSaveNotes, onCancelNotes, notesEditing, openMenu, onMenuToggle }) {
  const isNotesOpen = notesEditing === offer.id;
  return (
    <article className={`jr-app jr-app--${offer.status}`}>
      <div className="jr-app-main">
        <div className="jr-app-title"><strong>{offer.company}</strong> — {offer.title}</div>
        <div className="jr-app-meta">{JV.applicationAgeLabel(offer, Date.now())}</div>
        {isNotesOpen && <JrNotesEditor offer={offer} onSave={onSaveNotes} onCancel={onCancelNotes} />}
        {!isNotesOpen && offer.user_notes && <div className="jr-app-notes">{offer.user_notes}</div>}
      </div>
      <div className="jr-app-outcomes" role="group" aria-label="Issue de la candidature">
        {JV.OUTCOMES.map((x) => (
          <button
            key={x.status}
            className={`jr-app-outcome ${offer.status === x.status ? "is-on" : ""}`}
            aria-pressed={offer.status === x.status}
            onClick={jrSingleClick(() => onOutcome(offer, x.status))}>{x.label}</button>
        ))}
      </div>
      <JrAppMenu
        offer={offer}
        open={openMenu === offer.id}
        onToggle={onMenuToggle}
        onRead={onRead}
        onFollowUp={onFollowUp}
        onEditNotes={onEditNotes}
        onNotApplied={onNotApplied}
      />
    </article>
  );
}

function JrApplications({ offers, handlers }) {
  const [open, setOpen] = useStateJr(loadAppsOpen);
  const [showUndated, setShowUndated] = useStateJr(false);
  const { dated, undated } = JV.splitApplications(offers);
  if (!dated.length && !undated.length) return null;
  const c = JV.applicationCounts(offers);
  const parts = [];
  if (c.applied)   parts.push(`${c.applied} en attente`);
  if (c.interview) parts.push(`${c.interview} entretien${c.interview > 1 ? "s" : ""}`);
  if (c.rejected)  parts.push(`${c.rejected} refus`);
  if (c.ghosted)   parts.push(`${c.ghosted} sans réponse`);
  if (c.undated)   parts.push(`${c.undated} avant le 17/08`);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(JR_APPS_OPEN_KEY, next ? "1" : "0"); } catch {}
  };
  return (
    <section className="jr-apps">
      <button className="jr-apps-head" onClick={toggle} aria-expanded={open}>
        <span className="jr-section-kicker">Tes candidatures</span>
        <span className="jr-apps-counts">{parts.join(" · ")}</span>
        <Icon name={open ? "chevron_up" : "chevron_down"} size={16} stroke={2} />
      </button>
      {open && (
        <div className="jr-apps-body">
          {dated.length === 0 && <p className="jr-apps-empty">Aucune candidature datée pour l'instant.</p>}
          {dated.map((o) => <JrApplicationRow key={o.id} offer={o} {...handlers} />)}
          {undated.length > 0 && (
            <div className="jr-apps-undated">
              <button className="jr-apps-undated-head" onClick={() => setShowUndated((v) => !v)} aria-expanded={showUndated}>
                <Icon name={showUndated ? "chevron_up" : "chevron_down"} size={13} stroke={2} />
                <span>Avant le 17/08 · date de candidature inconnue ({undated.length})</span>
              </button>
              {showUndated && undated.map((o) => <JrApplicationRow key={o.id} offer={o} {...handlers} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Encart calibrage — profil de préférences (rules éditable / observed RO) ───
function JrCalibrage() {
  const PF = (window.PROFILE_DATA && window.PROFILE_DATA._values) || {};
  const [open, setOpen]       = useStateJr(false);
  const [editing, setEditing] = useStateJr(false);
  const [draft, setDraft]     = useStateJr(PF.job_pref_rules || "");
  const [saving, setSaving]   = useStateJr(false);
  const observed = PF.job_pref_observed || "";
  const rules = PF.job_pref_rules || "";

  const save = async () => {
    setSaving(true);
    try {
      await upsertUserProfile("job_pref_rules", draft);
      if (window.PROFILE_DATA) {
        window.PROFILE_DATA._values = { ...window.PROFILE_DATA._values, job_pref_rules: draft };
      }
      if (window.track) window.track("profile_field_saved", { key: "job_pref_rules" });
      // setEditing(false) déclenche le re-render qui relit `rules` depuis le
      // PROFILE_DATA fraîchement muté ci-dessus (pas de state local pour rules).
      setEditing(false);
    } catch (e) {
      cockpitToast("Échec de la sauvegarde : " + e.message, { kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="jr-calib">
      <button className="jr-calib-head" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="jr-calib-body">
        <span className="jr-calib-kicker">
          <Icon name="sliders" size={13} stroke={2} />
          Calibrage · ce que le radar a compris de tes goûts
        </span>
        <Icon name={open ? "chevron_up" : "chevron_down"} size={16} stroke={2} />
      </button>

      {open && (
        <div className="jr-calib-body" id="jr-calib-body">
          <div className="jr-calib-block">
            <div className="jr-section-kicker">Tes règles <span className="jr-calib-lock">verrouillé</span></div>
            {!editing ? (
              <div className="jr-calib-rules">
                <p className="jr-calib-text">{rules || "Aucune règle. Écris ici ce que tu cherches (ou évites) — le scan en tiendra compte dès demain."}</p>
                <button className="jr-btn jr-btn--ghost jr-btn--sm" onClick={() => { setDraft(rules); setEditing(true); }}>
                  {rules ? "Modifier" : "Écrire mes règles"}
                </button>
              </div>
            ) : (
              <div className="jr-calib-editor">
                <textarea className="jr-calib-input" rows={4} autoFocus value={draft}
                  placeholder="Ex : je ne veux pas de RTE en grand groupe. Je priorise l'AI tooling early-stage. J'ignore < 95k."
                  onChange={(e) => setDraft(e.target.value)} />
                <div className="jr-calib-actions">
                  <button className="jr-btn jr-btn--ghost jr-btn--sm" onClick={() => setEditing(false)} disabled={saving}>Annuler</button>
                  <button className="jr-btn jr-btn--primary jr-btn--sm" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
                </div>
              </div>
            )}
          </div>

          <div className="jr-calib-block">
            <div className="jr-section-kicker">Observé par le radar <span className="jr-calib-auto">auto</span></div>
            <p className="jr-calib-text jr-calib-text--observed">
              {observed || "Pas encore assez de retours pour inférer un profil. Chaque « Pas pour moi » compte — le radar recalibre le lundi dès 3 nouveaux retours."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Ce que le marché reproche au CV ───────────────────────────────────────
//
// La routine extrait déjà, offre par offre, les compétences exigées avec un
// drapeau `on_cv`. C'était affiché carte par carte et jamais en cumul — soit
// 2 156 paires dont personne ne tirait de verdict. La vue SQL market_skill_gap
// (sql/031) fait l'agrégat et la normalisation ; ici on ne fait que rendre.
//
// Ce bloc n'est PAS une résurrection du groupe Apprentissage. Celui-ci est mort
// parce qu'il reposait sur un auto-diagnostic déclaratif et du contenu poussé.
// Ici la source est inversée — c'est le marché qui parle — et ça s'affiche dans
// l'onglet que l'utilisateur ouvre vraiment.
function JrSkillGap({ rows, activeAxe, onPick, onClear }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const top = rows.slice(0, 5);
  const max = Math.max(...top.map(r => r.manquant || 0), 1);

  return (
    <section className="jr-gap">
      <div className="jr-gap-head">
        <div className="jr-scan-kicker">Ce que le marché te reproche</div>
        {activeAxe && (
          <button className="jr-btn jr-btn--ghost jr-btn--sm" onClick={onClear}>
            Filtre « {activeAxe} » · retirer
          </button>
        )}
      </div>

      <ul className="jr-gap-list">
        {top.map(r => {
          const isActive = r.axe === activeAxe;
          const n = r.manquant || 0;
          const ids = Array.isArray(r.job_ids_manquants) ? r.job_ids_manquants : [];
          return (
            <li key={r.axe}>
              <button
                className={"jr-gap-row" + (isActive ? " is-active" : "")}
                onClick={() => (isActive ? onClear() : onPick(r.axe, ids))}
                disabled={!ids.length}
                title={
                  ids.length
                    ? `Afficher les ${n} offres qui l'exigent et où il est absent de ton CV`
                    : "Aucune offre rattachée"
                }
              >
                <span className="jr-gap-axe">{r.axe}</span>
                <span className="jr-gap-bar">
                  <span className="jr-gap-fill" style={{ width: `${Math.round((n / max) * 100)}%` }} />
                </span>
                <span className="jr-gap-num">
                  <strong>{n}</strong>
                  <span className="jr-gap-den"> / {r.offres}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="jr-gap-foot">
        Lecture : <strong>manquant / offres qui l'exigent</strong>, d'après le drapeau{" "}
        <code>on_cv</code> posé par la routine à chaque scan. Seuls les axes à
        3 manques ou plus sont affichés — en dessous, le bruit des libellés
        uniques domine.
      </p>
    </section>
  );
}

// ─── Scan banner (tendances, signal CV, actions du jour) ───
function ScanBanner({ scan, onFollowUp }) {
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
                <button
                  className="jr-btn jr-btn--ghost jr-btn--sm"
                  onClick={() => a.job_id && onFollowUp && onFollowUp(a.job_id)}
                  disabled={!a.job_id}
                  title={a.job_id ? "Ouvrir l'offre et enregistrer la relance" : "Action sans offre rattachée"}
                >{a.cta}</button>
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

  // Filtre issu du bloc « Ce que le marché te reproche ». Volontairement NON
  // persisté (contrairement aux filtres de la toolbar) : c'est une exploration
  // ponctuelle, la retrouver au prochain chargement donnerait une liste
  // mystérieusement tronquée.
  const [gapFilter, setGapFilter] = useStateJr(null);   // { axe, ids: Set }

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

  const showToast = (message, tone, action) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone: tone || "ok", action: action || null });
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 2400);
  };

  // Mécanique commune : optimistic state + mirror global + PATCH + toast.
  const persistJobPatch = (id, patch, toastMsg) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
    try {
      if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA.offers)) {
        const idx = window.JOBS_DATA.offers.findIndex(o => o.id === id);
        if (idx >= 0) window.JOBS_DATA.offers[idx] = { ...window.JOBS_DATA.offers[idx], ...patch };
      }
    } catch {}
    patchJobSupabase(id, patch)
      .then(() => { if (toastMsg) showToast(toastMsg, "ok"); })
      .catch(() => showToast("Erreur de sync — changement local uniquement", "error"));
  };

  // status / notes — event jobs_action (inchangé).
  const updateJob = (id, patch, toastMsg) => {
    try {
      const key = Object.keys(patch)[0];
      window.track && window.track("jobs_action", {
        action: key,
        job_id: String(id).slice(0, 64),
        value: String(patch[key] ?? "").slice(0, 64),
      });
    } catch {}
    persistJobPatch(id, patch, toastMsg);
  };

  // ─── Gestes de tri (ADR-52) ───────────────────────────────
  // Optimiste → PATCH → succès : event + toast « Annuler » (5 s) ; échec :
  // l'inverse est réappliqué localement et aucun event ne part. Un échec ne
  // laisse ni carte fantôme ni event fantôme.
  const mirrorPatch = (id, patch) => {
    setOffers(prev => JV.applyPatch(prev, id, patch));
    try {
      if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA.offers)) {
        window.JOBS_DATA.offers = JV.applyPatch(window.JOBS_DATA.offers, id, patch);
      }
    } catch {}
  };
  const jobKey = (offer) => String(offer.id).slice(0, 64);
  const nowIso = () => new Date().toISOString();

  const undoGesture = (id, patch, inverse, gesture) => {
    mirrorPatch(id, inverse);
    setToast(null);
    patchJobSupabase(id, inverse)
      .then(() => {
        try { window.track && window.track("jobs_action", { action: "undo", job_id: String(id).slice(0, 64), value: gesture }); } catch {}
        showToast("Geste annulé", "ok");
      })
      .catch(() => {
        mirrorPatch(id, patch);
        showToast("Annulation impossible — le geste reste enregistré", "error");
      });
  };
  const runGesture = (offer, patch, { label, gesture, emit }) => {
    if (!offer) return;
    const inverse = JV.inversePatch(offer, patch);
    mirrorPatch(offer.id, patch);
    setOpenMenu(null);
    patchJobSupabase(offer.id, patch)
      .then(() => {
        try { emit(); } catch {}
        showToast(label, "ok", { label: "Annuler", onClick: () => undoGesture(offer.id, patch, inverse, gesture) });
      })
      .catch(() => {
        mirrorPatch(offer.id, inverse);
        showToast("Écriture impossible — geste annulé", "error");
      });
  };

  // Lire ≠ postuler : ouvre l'annonce, n'écrit rien en base.
  const readOffer = (offer, zone) => {
    if (!offer || !offer.url) return;
    try { window.open(offer.url, "_blank", "noopener,noreferrer"); } catch {}
    try { window.track && window.track("jobs_action", { action: "open", job_id: jobKey(offer), value: zone || "list" }); } catch {}
  };
  const markApplied = (offer) => runGesture(offer, JV.patchApplied(nowIso()), {
    label: "Candidature enregistrée", gesture: "applied",
    emit: () => window.track && window.track("jobs_action", { action: "status", job_id: jobKey(offer), value: "applied" }),
  });
  const notForMe = (offer, code, free) => {
    const patch = JV.patchNotForMe(code, free, nowIso());
    runGesture(offer, patch, {
      label: code ? `Écartée · ${code}` : "Écartée", gesture: "not_for_me",
      emit: () => window.track && window.track("jobs_feedback", {
        verdict: "down",
        reason: String(patch.user_verdict_reason ?? "").slice(0, 64),
        job_id: jobKey(offer),
        score_at_vote: offer.score_total,
      }),
    });
  };
  const deadLink = (offer) => runGesture(offer, JV.patchDeadLink(nowIso()), {
    label: "Offre clôturée · lien mort", gesture: "dead_link",
    emit: () => window.track && window.track("jobs_action", { action: "close", job_id: jobKey(offer), value: "dead_link" }),
  });
  // Issues de candidature : re-cliquer l'issue active la retire (retour à applied).
  const setOutcome = (offer, outcome) => {
    const patch = JV.patchOutcome(offer, outcome);
    const found = JV.OUTCOMES.find(x => x.status === patch.status);
    runGesture(offer, patch, {
      label: found ? `Issue enregistrée · ${found.label}` : "Issue retirée",
      gesture: "outcome",
      emit: () => window.track && window.track("jobs_action", { action: "status", job_id: jobKey(offer), value: patch.status }),
    });
  };
  // Corrige un « applied » qui n'était qu'une lecture (avant ADR-52).
  const notApplied = (offer) => runGesture(offer, JV.patchNotApplied(), {
    label: "Retirée de tes candidatures", gesture: "not_applied",
    emit: () => window.track && window.track("jobs_action", { action: "not_applied", job_id: jobKey(offer), value: "" }),
  });

  // Relance d'une candidature restée sans réponse. Le calcul de la liste
  // existait déjà dans data-loader.js ; le bouton qui l'affichait n'avait
  // simplement aucun `onClick`, et 30 candidatures sur 32 attendaient.
  const followUpJob = (jobId) => {
    const offer = (offers || []).find(o => o.id === jobId);
    if (!offer) return;
    if (offer.url) {
      try { window.open(offer.url, "_blank", "noopener,noreferrer"); } catch {}
    }
    try {
      window.track && window.track("jobs_action", {
        action: "followup",
        job_id: String(jobId).slice(0, 64),
        value: String((offer.followup_count || 0) + 1),
      });
    } catch {}
    // `last_followup_at` fait sortir l'offre de la liste des candidatures en
    // souffrance : c'est ce qui permet à la file de se vider au lieu de
    // réafficher éternellement les mêmes lignes.
    persistJobPatch(
      jobId,
      {
        last_followup_at: new Date().toISOString(),
        followup_count: (offer.followup_count || 0) + 1,
      },
      "Relance enregistrée"
    );
  };
  const snoozeJob = (id) => { updateJob(id, { status: "snoozed" }, "Snoozée 7 jours"); setOpenMenu(null); };
  const startEditNotes = (id) => { setNotesEditing(id); setOpenMenu(null); };
  const cancelEditNotes = () => setNotesEditing(null);
  const saveNotes = (id, notes) => { updateJob(id, { user_notes: notes }, "Notes enregistrées"); setNotesEditing(null); };

  // Clôture manuelle — le front écrit closed_at (réversible via reopenJob). On
  // track explicitement action:"close"/"reopen" (updateJob dériverait "closed_at").
  const closeJob = (id) => {
    try { window.track && window.track("jobs_action", { action: "close", job_id: String(id).slice(0, 64), value: "" }); } catch {}
    persistJobPatch(id, { closed_at: new Date().toISOString() }, "Offre clôturée");
    setOpenMenu(null);
  };
  const reopenJob = (id) => {
    try { window.track && window.track("jobs_action", { action: "reopen", job_id: String(id).slice(0, 64), value: "" }); } catch {}
    persistJobPatch(id, { closed_at: null }, "Offre rouverte");
    setOpenMenu(null);
  };

  const cardHandlers = {
    onRead: readOffer,
    onApplied: markApplied,
    onNotForMe: notForMe,
    onDeadLink: deadLink,
    onSnooze: snoozeJob,
    onEditNotes: startEditNotes,
    onSaveNotes: saveNotes,
    onCancelNotes: cancelEditNotes,
    onClose: closeJob,
    onReopen: reopenJob,
    openMenu,
    onMenuToggle: setOpenMenu,
    notesEditing,
  };
  const appHandlers = {
    onRead: readOffer,
    onOutcome: setOutcome,
    onFollowUp: followUpJob,
    onNotApplied: notApplied,
    onEditNotes: startEditNotes,
    onSaveNotes: saveNotes,
    onCancelNotes: cancelEditNotes,
    notesEditing,
    openMenu,
    onMenuToggle: setOpenMenu,
  };

  // Filters — hydratés depuis localStorage (sauf la recherche), persistés via l'effet ci-dessous.
  const f0 = useMemoJr(() => loadJrFilters(), []);
  const [scoreFilter, setScoreFilter]   = useStateJr(f0.scoreFilter  ?? "all");   // all | hot | mid | low
  const [catFilter,   setCatFilter]     = useStateJr(f0.catFilter    ?? "all");
  const [remoteFilter,setRemoteFilter]  = useStateJr(f0.remoteFilter ?? "all");   // all | remote
  const [statusFilter,setStatusFilter]  = useStateJr(f0.statusFilter ?? "active");// active = new + to_apply (les candidatures ont leur zone)
  const [freshFilter, setFreshFilter]   = useStateJr(f0.freshFilter  ?? "all");   // all | 24h | 7j
  const [query,       setQuery]         = useStateJr("");                          // non persisté (design §5)
  const [sort,        setSort]          = useStateJr(f0.sort          ?? "score"); // score | recent

  // Persistance des facettes (pas la recherche) — design §5.
  useEffectJr(() => {
    try {
      localStorage.setItem(JR_FILTERS_KEY, JSON.stringify(
        { scoreFilter, catFilter, remoteFilter, statusFilter, freshFilter, sort }));
    } catch {}
  }, [scoreFilter, catFilter, remoteFilter, statusFilter, freshFilter, sort]);

  // ─── Filtre « écart de compétence » (les prédicats passesFacets /
  // passesFilters sont définis juste après) ───
  // Cliquer un axe de l'écart de compétences restreint la liste à ses offres.
  // On force `statusFilter` à "all" : le défaut ("active") masquerait la plupart
  // des offres concernées, et le compteur du bloc ne correspondrait plus à ce
  // que la liste affiche — le pire des deux mondes, une promesse de N offres
  // suivie d'une liste de trois.
  const pickGap = async (axe, ids) => {
    setGapFilter({ axe, ids: new Set(ids) });
    setStatusFilter("all");
    // La plupart de ces offres sont archivées et tombent hors de la fenêtre
    // initiale (300 archivées les mieux notées). On les charge à la demande,
    // sinon le filtre afficherait 24 offres en en annonçant 60.
    try {
      const added = await window.cockpitDataLoader?.fetchJobsByIds?.(ids);
      if (added) setOffers(((window.JOBS_DATA && window.JOBS_DATA.offers) || []).slice());
    } catch {}
    try {
      window.track && window.track("jobs_action", {
        action: "skill_gap_filter", job_id: "", value: String(axe).slice(0, 64),
      });
    } catch {}
    try {
      document.querySelector(".jr-list-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  };
  const clearGap = () => setGapFilter(null);

  // Facettes : rôle, lieu, recherche, écart de compétence. Elles pilotent la
  // zone « À décider » ET la liste (ADR-52).
  const passesFacets = (o) => {
    if (gapFilter && !gapFilter.ids.has(o.id)) return false;
    if (catFilter !== "all" && o.role_category !== catFilter) return false;
    if (remoteFilter === "remote" && o.is_remote !== true) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!(o.title.toLowerCase().includes(q) ||
            o.company.toLowerCase().includes(q) ||
            (o.pitch || "").toLowerCase().includes(q))) return false;
    }
    return true;
  };
  const facetsActive = !!gapFilter || catFilter !== "all" || remoteFilter === "remote" || !!query.trim();

  // Liste : facettes + statut + fraîcheur. La bande de score est gérée par section.
  const passesFilters = (o) => {
    if (!passesFacets(o)) return false;
    if (statusFilter === "closed") {
      if (!o.closed_at) return false;
    } else {
      if (jrIsDead(o)) return false;  // masque les clôturées (sauf candidatures)
      if (statusFilter === "active") {
        if (!(o.status === "new" || o.status === "to_apply")) return false;
      } else if (statusFilter !== "all") {
        if (o.status !== statusFilter) return false;
      }
    }
    // Fraîcheur = depuis quand l'offre est dans le radar (first_seen_date), pas la
    // date de publication LinkedIn (antidatée + souvent null → filtre quasi-vide).
    if (freshFilter === "24h" && o.seen_days_ago !== 0) return false;
    if (freshFilter === "7j"  && o.seen_days_ago >= 7) return false;
    return true;
  };

  // Compteur d'en-tête GLOBAL (non filtré) : la taille de la zone « À décider ».
  const decideCount = useMemoJr(() => offers.filter(JV.inDecideZone).length, [offers]);
  // « En cours » = candidatures datées en attente ou en entretien.
  const inProgressCount = useMemoJr(() =>
    JV.splitApplications(offers).dated.filter(o => o.status === "applied" || o.status === "interview").length,
  [offers]);

  // Zone « À décider » : hot leads non triés entrés depuis moins de 7 jours,
  // filtrés par facettes seulement. Masquée si la bande score vise mid ou low.
  const showHero = scoreFilter === "all" || scoreFilter === "hot";
  const heroLeads = useMemoJr(() =>
    showHero
      ? offers.filter(o => JV.inDecideZone(o) && passesFacets(o)).sort(JV.byDecide)
      : [],
  [offers, scoreFilter, catFilter, remoteFilter, query, gapFilter]);

  // Liste dense = set filtré, moins les membres du hero, avec le filtre de bande score.
  const listOffers = useMemoJr(() => {
    const heroIds = new Set(heroLeads.map(h => h.id));
    // Les candidatures vivent dans « Tes candidatures », jamais dans la liste.
    let arr = offers.filter(o => passesFilters(o) && !heroIds.has(o.id) && !JV.isApplication(o));
    if (scoreFilter !== "all") {
      arr = arr.filter(o => scoreBand(o.score_total) === scoreFilter);
    }
    if (sort === "score") {
      arr.sort((a, b) => b.score_total - a.score_total);
    } else if (sort === "recent") {
      arr.sort((a, b) => a.seen_days_ago - b.seen_days_ago);
    }
    return arr;
  }, [offers, heroLeads, scoreFilter, catFilter, remoteFilter, statusFilter, freshFilter, query, sort, gapFilter]);

  // Stats line
  const totalCount = offers.length;
  const closedCount = offers.filter(jrIsDead).length;

  // ─── Toolbar : compteur filtré + puces des filtres actifs (design §3-4) ───
  const filteredCount = heroLeads.length + listOffers.length;
  const activeChips = [];
  if (scoreFilter !== "all")     activeChips.push({ key: "score",  label: `Score : ${JR_SCORE_LABEL[scoreFilter] ?? scoreFilter}`,      clear: () => setScoreFilter("all") });
  if (catFilter !== "all")       activeChips.push({ key: "cat",    label: `Rôle : ${CAT_LABEL[catFilter] ?? catFilter}`,              clear: () => setCatFilter("all") });
  if (remoteFilter === "remote") activeChips.push({ key: "remote", label: "Remote",                                     clear: () => setRemoteFilter("all") });
  if (statusFilter !== "active") activeChips.push({ key: "status", label: `Statut : ${JR_STATUS_LABEL[statusFilter] ?? statusFilter}`,   clear: () => setStatusFilter("active") });
  if (freshFilter !== "all")     activeChips.push({ key: "fresh",  label: `🕒 ${JR_FRESH_LABEL[freshFilter] ?? freshFilter}`, fresh: true, clear: () => setFreshFilter("all") });
  if (query.trim())              activeChips.push({ key: "q",      label: `🔍 « ${query.trim()} »`,                      clear: () => setQuery("") });
  const resetAllFilters = () => {
    setScoreFilter("all"); setCatFilter("all"); setRemoteFilter("all");
    setStatusFilter("active"); setFreshFilter("all"); setQuery("");
  };

  return (
    <div className="panel panel-jobs-radar">
      {/* ─── HEADER ─── */}
      <header className="jr-header">
        <div className="jr-header-top">
          <div className="jr-kicker">Jobs Radar · {scan.date_label}</div>
          <div className="jr-header-stats">
            <span><strong>{decideCount}</strong> à décider</span>
            <span className="jr-sep">·</span>
            <span><strong>{inProgressCount}</strong> candidatures en cours</span>
            <span className="jr-sep">·</span>
            <span><strong>{totalCount}</strong> au total dans le radar</span>
            {closedCount > 0 && (<>
              <span className="jr-sep">·</span>
              <span><strong>{closedCount}</strong> clôturée{closedCount > 1 ? "s" : ""} masquée{closedCount > 1 ? "s" : ""}</span>
            </>)}
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
      <ScanBanner scan={scan} onFollowUp={followUpJob} />

      {/* ─── CE QUE LE MARCHÉ REPROCHE AU CV ─── */}
      <JrSkillGap
        rows={jobs.skillGap}
        activeAxe={gapFilter ? gapFilter.axe : null}
        onPick={pickGap}
        onClear={clearGap}
      />

      {/* ─── CALIBRAGE ─── */}
      <JrCalibrage />

      {/* ─── FILTRES (toolbar collant) ─── */}
      <JrFilterBar
        decideCount={decideCount} filteredCount={filteredCount}
        activeChips={activeChips} resetAllFilters={resetAllFilters}
        scoreFilter={scoreFilter} setScoreFilter={setScoreFilter}
        catFilter={catFilter} setCatFilter={setCatFilter}
        remoteFilter={remoteFilter} setRemoteFilter={setRemoteFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        freshFilter={freshFilter} setFreshFilter={setFreshFilter}
        query={query} setQuery={setQuery}
        sort={sort} setSort={setSort}
      />

      {/* ─── ZONE 1 — À DÉCIDER (7 derniers jours) ─── */}
      {showHero && (
        <section className="jr-hot-section">
          <div className="jr-section-head">
            <div className="jr-section-kicker jr-section-kicker--hero">
              <span className="jr-hot-marker" />
              À décider · 7 derniers jours
            </div>
            <h2 className="jr-section-title">
              {heroLeads.length === 0
                ? "Rien à décider"
                : heroLeads.length === 1
                  ? "1 offre qui mérite ton matin"
                  : `${heroLeads.length} offres qui méritent ton matin`}
            </h2>
          </div>
          {heroLeads.length === 0 ? (
            <p className="jr-decide-empty">
              {facetsActive ? "Rien à décider avec ces filtres." : "Rien de nouveau à trier sur les 7 derniers jours."}
            </p>
          ) : (
            <div className="jr-hot-grid">
              {heroLeads.map((o, i) => <HotLeadCard key={o.id} offer={o} rank={i} zone="decide" {...cardHandlers} />)}
            </div>
          )}
        </section>
      )}

      {/* ─── ZONE 2 — TES CANDIDATURES ─── */}
      <JrApplications offers={offers} handlers={appHandlers} />

      {/* ─── FILTERS + LIST ─── */}
      <section className="jr-list-section">
        <div className="jr-section-head">
          <div className="jr-section-kicker">Le reste du scan</div>
          <h2 className="jr-section-title">
            {listOffers.length} offre{listOffers.length > 1 ? "s" : ""} à trier
          </h2>
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

      {toast && <JrToast message={toast.message} tone={toast.tone} action={toast.action} />}
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

function JrFilterBar({
  decideCount, filteredCount, activeChips, resetAllFilters,
  scoreFilter, setScoreFilter, catFilter, setCatFilter,
  remoteFilter, setRemoteFilter, statusFilter, setStatusFilter,
  freshFilter, setFreshFilter, query, setQuery, sort, setSort,
}) {
  const [expanded, setExpanded] = useStateJr(false);
  return (
    <div className="jr-filterbar">
      <div className="jr-filterbar-row">
        <span className="jr-fb-hot" title="Offres à décider — 7 derniers jours, non filtré">🔥 {decideCount} à décider</span>
        <div className="jr-fb-chips">
          {activeChips.length === 0
            ? <span className="jr-fb-empty">Aucun filtre actif</span>
            : activeChips.map(c => (
                <span key={c.key} className={"jr-chip" + (c.fresh ? " jr-chip--fresh" : "")}>
                  {c.label}
                  <button className="jr-chip-x" onClick={c.clear} aria-label="Retirer ce filtre">×</button>
                </span>
              ))}
        </div>
        <span className="jr-fb-count">{filteredCount} offre{filteredCount > 1 ? "s" : ""}</span>
        <button
          className={"jr-fb-toggle" + (expanded ? " is-open" : "")}
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >Filtres {expanded ? "▴" : "▾"}</button>
      </div>
      <div className={"jr-filterbar-panel" + (expanded ? " is-open" : "")}>
        <div className="jr-filterbar-panel-inner">
          <div className="jr-fb-line">
            <div className="jr-search">
              <Icon name="search" size={14} stroke={2} />
              <input
                className="jr-search-input"
                placeholder="Titre, boîte, pitch…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            {activeChips.length > 0 && (
              <button className="jr-fb-reset" onClick={resetAllFilters}>Tout réinitialiser</button>
            )}
          </div>
          <div className="jr-fb-line">
            <span className="jr-fb-label">Score</span>
            <FilterGroup value={scoreFilter} onChange={setScoreFilter} options={[
              { id: "all", label: "Tous scores" }, { id: "hot", label: "Hot (≥7)" },
              { id: "mid", label: "Mid (5-7)" }, { id: "low", label: "Low (<5)" },
            ]} />
          </div>
          <div className="jr-fb-line">
            <span className="jr-fb-label">Rôle</span>
            <FilterGroup value={catFilter} onChange={setCatFilter} options={[
              { id: "all", label: "Tous rôles" }, { id: "produit", label: "Produit" },
              { id: "rte", label: "RTE" }, { id: "pgm", label: "PgM" },
              { id: "pjm", label: "PjM" }, { id: "cos", label: "CoS" }, { id: "em", label: "EM" },
            ]} />
          </div>
          <div className="jr-fb-line">
            <span className="jr-fb-label">Lieu</span>
            <FilterGroup value={remoteFilter} onChange={setRemoteFilter} options={[
              { id: "all", label: "Tous lieux" }, { id: "remote", label: "Remote" },
            ]} />
            <span className="jr-fb-label jr-fb-label--gap">Fraîcheur</span>
            <FilterGroup value={freshFilter} onChange={setFreshFilter} options={[
              { id: "all", label: "Tout" }, { id: "24h", label: "< 24h" }, { id: "7j", label: "< 7j" },
            ]} />
          </div>
          <div className="jr-fb-line">
            <span className="jr-fb-label">Statut</span>
            <FilterGroup value={statusFilter} onChange={setStatusFilter} options={[
              { id: "active", label: "Actives" }, { id: "new", label: "Nouvelles" },
              { id: "to_apply", label: "À postuler" },
              { id: "closed", label: "Clôturées" }, { id: "all", label: "Tout" },
            ]} />
          </div>
          <div className="jr-fb-line">
            <span className="jr-fb-label">Tri</span>
            <FilterGroup value={sort} onChange={setSort} options={[
              { id: "score", label: "Score" }, { id: "recent", label: "Récence" },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.PanelJobsRadar = PanelJobsRadar;
