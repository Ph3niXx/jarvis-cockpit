// ═══════════════════════════════════════════════════════════════
// PANEL PROFIL v4 — full Supabase + nouvelles features
// ─────────────────────────────────────────────
// Zones (toutes branchées sur tables réelles) :
//  0. Toolbar : recherche globale + export JSON + copier payload Claude + score complétude
//  1. Contexte Claude — vrai user_profile (mission_keys exclues en mode mission)
//  2. Faits appris — profile_facts avec "marquer comme faux" (superseded_by)
//  3. Entités détectées — entities avec filtres
//  4. Commitments — table commitments (CRUD)
//  5. Triangulation réelle — matching user_profile ↔ profile_facts
//  6. Uncomfortable Questions — table uncomfortable_questions (répondre)
//  7. Éditeur + Historique append-only — user_profile_history
// ═══════════════════════════════════════════════════════════════

const { useState: usePfState, useMemo: usePfMemo, useEffect: usePfEffect } = React;

const PF_MISSION_EXCLUDED = window.PROFILE_MISSION_EXCLUDED || [];
const PF_HIDDEN_KEYS = new Set(window.PROFILE_HIDDEN_KEYS || []);
const PF_FIELD_LABELS = window.PROFILE_FIELD_LABELS || {};
const PF_FACT_TYPE_LABELS = window.PROFILE_FACT_TYPE_LABELS || {};
const PF_COMMIT_STATUS_LABELS = window.PROFILE_COMMITMENT_STATUS_LABELS || {};

// Champs considérés "utiles" pour le score de complétude.
const PF_SCORE_FIELDS = [
  "identity", "current_role", "company_context", "ambitions",
  "interests", "current_projects", "what_excites_me", "what_frustrates_me",
  "sectors_of_interest", "learning_style",
];

function pfEstTokens(value) {
  if (!value) return 0;
  const words = String(value).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3));
}

function pfRelTime(isoStr) {
  if (!isoStr) return "—";
  const then = new Date(isoStr).getTime();
  if (!then) return "—";
  const diff = Date.now() - then;
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days}j`;
  const months = Math.round(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.round(days / 365);
  return `il y a ${years}${years > 1 ? " ans" : " an"}`;
}

function pfDaysSince(isoStr) {
  if (!isoStr) return null;
  const then = new Date(isoStr).getTime();
  if (!then) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

function pfFreshness(isoStr) {
  const d = pfDaysSince(isoStr);
  if (d === null) return "stable";
  if (d < 14) return "fresh";
  if (d > 90) return "stale";
  return "stable";
}

function pfDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + (dateStr.length <= 10 ? "T00:00:00" : "")).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
}

function pfNormalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);
}

async function pfUpsertField(key, value) {
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

async function pfSupersedeFact(id) {
  const url = window.SUPABASE_URL + "/rest/v1/profile_facts?id=eq." + encodeURIComponent(id);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...window.sb.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ superseded_by: id }),
  });
  if (!res.ok) throw new Error("supersede " + res.status);
  return res;
}

async function pfUpsertCommitment(payload, id) {
  const url = window.SUPABASE_URL + "/rest/v1/commitments" + (id ? "?id=eq." + encodeURIComponent(id) : "");
  const method = id ? "PATCH" : "POST";
  const res = await fetch(url, {
    method,
    headers: { ...window.sb.headers, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("commitment " + res.status);
  return res.json();
}

async function pfDeleteCommitment(id) {
  const url = window.SUPABASE_URL + "/rest/v1/commitments?id=eq." + encodeURIComponent(id);
  const res = await fetch(url, { method: "DELETE", headers: window.sb.headers });
  if (!res.ok) throw new Error("delete " + res.status);
  return res;
}

async function pfAnswerUQ(id, answer, resolution) {
  const url = window.SUPABASE_URL + "/rest/v1/uncomfortable_questions?id=eq." + encodeURIComponent(id);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...window.sb.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      answer,
      resolution: resolution || null,
      answered_at: new Date().toISOString(),
      resolved: true,
    }),
  });
  if (!res.ok) throw new Error("answer " + res.status);
  return res;
}

function pfBuildClaudePayload(rows, missionMode) {
  const excluded = new Set(PF_MISSION_EXCLUDED);
  const active = rows.filter(r => r.value && String(r.value).trim() && !PF_HIDDEN_KEYS.has(r.key));
  const filtered = missionMode ? active.filter(r => !excluded.has(r.key)) : active;
  return filtered.map(r => `${r.key}: ${r.value}`).join("\n");
}

function PanelProfile({ data, onNavigate }) {
  const PF = window.PROFILE_DATA || {};
  const rows = Array.isArray(PF._raw) ? PF._raw : [];
  const facts = Array.isArray(PF._facts) ? PF._facts : [];
  const entities = Array.isArray(PF._entities) ? PF._entities : [];
  const history = Array.isArray(PF._history) ? PF._history : [];
  const commitments = Array.isArray(PF._commitments) ? PF._commitments : [];
  const uqs = Array.isArray(PF._uqs) ? PF._uqs : [];

  const [mission, setMission] = usePfState("general");
  const [drawerOpen, setDrawerOpen] = usePfState(false);
  const [editing, setEditing] = usePfState({});
  const [saving, setSaving] = usePfState({});
  const [search, setSearch] = usePfState("");
  const [copyFlash, setCopyFlash] = usePfState(false);
  const [localRows, setLocalRows] = usePfState(rows);
  const [localFacts, setLocalFacts] = usePfState(facts);
  const [localCommits, setLocalCommits] = usePfState(commitments);
  const [localUqs, setLocalUqs] = usePfState(uqs);
  const [entityFilter, setEntityFilter] = usePfState("all");
  const [commitSort, setCommitSort] = usePfState("stale");
  const [openHist, setOpenHist] = usePfState(null);

  usePfEffect(() => { setLocalRows(rows); }, [rows.length, PF._lastUpdated]);
  usePfEffect(() => { setLocalFacts(facts); }, [facts.length]);
  usePfEffect(() => { setLocalCommits(commitments); }, [commitments.length]);
  usePfEffect(() => { setLocalUqs(uqs); }, [uqs.length]);

  const visibleRows = localRows.filter(r => !PF_HIDDEN_KEYS.has(r.key));
  const contractRows = visibleRows.filter(r => r.value && String(r.value).trim());

  const totalTokens = contractRows.reduce((s, r) => s + pfEstTokens(r.value), 0);
  const excluded = new Set(PF_MISSION_EXCLUDED);
  const excludedTokens = contractRows.filter(r => excluded.has(r.key)).reduce((s, r) => s + pfEstTokens(r.value), 0);
  const missionTokens = totalTokens - excludedTokens;

  const identityStr = rows.find(r => r.key === "identity")?.value || "";
  const role = rows.find(r => r.key === "current_role")?.value || "";
  const company = rows.find(r => r.key === "company_context")?.value || "";
  const displayName = (PF._values && PF._values.name) || "Jean";

  // Score de complétude
  const scoreFilled = PF_SCORE_FIELDS.filter(k => {
    const r = localRows.find(x => x.key === k);
    return r && r.value && String(r.value).trim();
  }).length;
  const scoreMissing = PF_SCORE_FIELDS.filter(k => {
    const r = localRows.find(x => x.key === k);
    return !r || !r.value || !String(r.value).trim();
  });
  const scorePct = Math.round((scoreFilled / PF_SCORE_FIELDS.length) * 100);

  // Recherche globale filtrage
  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (text) => !searchLower || String(text || "").toLowerCase().includes(searchLower);

  // Facts groupés + filtrés
  const factsByType = usePfMemo(() => {
    const groups = {};
    localFacts.forEach(f => {
      if (searchLower && !matchesSearch(f.fact_text) && !matchesSearch(f.fact_type)) return;
      const t = f.fact_type || "other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(f);
    });
    return groups;
  }, [localFacts.length, searchLower]);

  // Entities filtrés
  const entityTypes = usePfMemo(() => {
    const types = new Set(entities.map(e => e.entity_type).filter(Boolean));
    return ["all", ...Array.from(types)];
  }, [entities.length]);

  const filteredEntities = entities.filter(e => {
    if (entityFilter !== "all" && e.entity_type !== entityFilter) return false;
    if (searchLower && !matchesSearch(e.name) && !matchesSearch(e.description)) return false;
    return true;
  });

  // Triangulation : pour chaque champ user_profile actif, chercher des facts reliés
  const triangulation = usePfMemo(() => {
    return contractRows.map(row => {
      const valueWords = new Set(pfNormalize(row.value));
      const relatedFacts = localFacts.filter(f => {
        const factWords = pfNormalize(f.fact_text);
        return factWords.some(w => valueWords.has(w));
      });
      const daysSinceUpdate = pfDaysSince(row.updated_at) || 0;
      let level = "aligned";
      if (relatedFacts.length === 0 && daysSinceUpdate > 60) level = "drift";
      if (relatedFacts.length === 0 && daysSinceUpdate > 150) level = "stale-critical";
      return {
        field: row.key,
        label: PF_FIELD_LABELS[row.key] || row.key,
        declared: row.value,
        declared_age_days: daysSinceUpdate,
        facts: relatedFacts.slice(0, 3),
        facts_count: relatedFacts.length,
        level,
      };
    });
  }, [contractRows.length, localFacts.length]);

  // Commitments filtrés + triés
  const sortedCommits = usePfMemo(() => {
    const now = Date.now();
    const withDays = localCommits.map(c => ({
      ...c,
      movement_days: c.last_movement_at ? Math.floor((now - new Date(c.last_movement_at).getTime()) / 86400000) : 9999,
      days_to_deadline: c.deadline ? pfDaysUntil(c.deadline) : null,
    }));
    const sorted = [...withDays].sort((a, b) => {
      if (commitSort === "stale") return b.movement_days - a.movement_days;
      if (commitSort === "deadline") {
        const ad = a.days_to_deadline ?? 9999;
        const bd = b.days_to_deadline ?? 9999;
        return ad - bd;
      }
      return 0;
    });
    if (searchLower) return sorted.filter(c => matchesSearch(c.label) || matchesSearch(c.next_action) || matchesSearch(c.notes));
    return sorted;
  }, [localCommits.length, commitSort, searchLower]);

  async function handleSaveField(key) {
    const newValue = editing[key];
    if (newValue === undefined) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await pfUpsertField(key, newValue);
      const now = new Date().toISOString();
      setLocalRows(rs => {
        const idx = rs.findIndex(r => r.key === key);
        if (idx === -1) return [...rs, { key, value: newValue, updated_at: now }];
        const copy = [...rs];
        copy[idx] = { ...copy[idx], value: newValue, updated_at: now };
        return copy;
      });
      if (window.PROFILE_DATA) {
        window.PROFILE_DATA._values = { ...window.PROFILE_DATA._values, [key]: newValue };
      }
      setEditing(e => { const c = { ...e }; delete c[key]; return c; });
      if (window.track) window.track("profile_field_saved", { key });
    } catch (err) {
      alert("Échec de la sauvegarde : " + err.message);
    } finally {
      setSaving(s => { const c = { ...s }; delete c[key]; return c; });
    }
  }

  async function handleAddField(key, value) {
    if (!key || !value) return;
    try {
      await pfUpsertField(key, value);
      const now = new Date().toISOString();
      setLocalRows(rs => [...rs, { key, value, updated_at: now }]);
    } catch (err) {
      alert("Échec : " + err.message);
    }
  }

  async function handleMarkFactFalse(factId) {
    if (!confirm("Marquer ce fait comme incorrect ? Il sera supprimé de la vue active.")) return;
    try {
      await pfSupersedeFact(factId);
      setLocalFacts(fs => fs.filter(f => f.id !== factId));
      if (window.PROFILE_DATA) {
        window.PROFILE_DATA._facts = window.PROFILE_DATA._facts.filter(f => f.id !== factId);
      }
    } catch (err) {
      alert("Échec : " + err.message);
    }
  }

  async function handleSaveCommit(payload, id) {
    try {
      const result = await pfUpsertCommitment(payload, id);
      const fresh = Array.isArray(result) ? result[0] : result;
      setLocalCommits(cs => {
        if (id) return cs.map(c => c.id === id ? { ...c, ...fresh } : c);
        return [...cs, fresh];
      });
    } catch (err) {
      alert("Échec : " + err.message);
    }
  }

  async function handleDeleteCommit(id) {
    if (!confirm("Archiver ce commitment ?")) return;
    try {
      await pfUpsertCommitment({ archived_at: new Date().toISOString() }, id);
      setLocalCommits(cs => cs.filter(c => c.id !== id));
    } catch (err) {
      alert("Échec : " + err.message);
    }
  }

  async function handleAnswerUQ(id, answer, resolution) {
    try {
      await pfAnswerUQ(id, answer, resolution);
      setLocalUqs(us => us.map(u => u.id === id ? { ...u, answer, resolution, resolved: true, answered_at: new Date().toISOString() } : u));
    } catch (err) {
      alert("Échec : " + err.message);
    }
  }

  function handleExportJSON() {
    const payload = {
      exported_at: new Date().toISOString(),
      user_profile: localRows,
      profile_facts: localFacts,
      entities,
      commitments: localCommits,
      uncomfortable_questions: localUqs,
      history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profile_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.track) window.track("profile_exported", { fields: localRows.length });
  }

  async function handleCopyPayload() {
    const payload = pfBuildClaudePayload(contractRows, mission === "mission");
    try {
      await navigator.clipboard.writeText(payload);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
      if (window.track) window.track("profile_payload_copied", { mission });
    } catch (err) {
      alert("Impossible de copier : " + err.message);
    }
  }

  const openUq = localUqs.find(u => !u.resolved);

  return (
    <div className="pf2-wrap" data-screen-label="Profil">
      {/* ══ HEADER ══ */}
      <header className="pf2-head">
        <div className="pf2-head-main">
          <div className="pf2-head-eyebrow">user_profile · {visibleRows.length} champs · complétude {scorePct}%</div>
          <h1 className="pf2-head-name">{displayName}</h1>
          <div className="pf2-head-role">{role || "—"}</div>
          <div className="pf2-head-stats">
            <span>dernière maj · <strong>{pfRelTime(PF._lastUpdated)}</strong></span>
            <span>faits · <strong>{localFacts.length}</strong></span>
            <span>entités · <strong>{entities.length}</strong></span>
            <span>commits · <strong>{localCommits.length}</strong></span>
            <span>UQ · <strong>{localUqs.length}</strong></span>
          </div>
        </div>
        <div className="pf2-head-energy">
          <span>complétude</span>
          <div className="pf2-head-energy-bar"><div style={{ width: `${scorePct}%` }} /></div>
          <strong>{scoreFilled}/{PF_SCORE_FIELDS.length}</strong>
        </div>
      </header>

      {/* ══ TOOLBAR ══ */}
      <div className="pf2-toolbar">
        <input
          className="pf2-toolbar-search"
          type="search"
          placeholder="Rechercher (faits, entités, commitments…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="pf2-toolbar-actions">
          <button className="pf2-btn" onClick={handleCopyPayload}>
            {copyFlash ? "✓ Copié" : "Copier le payload Claude"}
          </button>
          <button className="pf2-btn" onClick={handleExportJSON}>Exporter JSON</button>
        </div>
      </div>

      {scoreMissing.length > 0 && (
        <div className="pf2-score-hint">
          <strong>Champs manquants ({scoreMissing.length})</strong> :
          {scoreMissing.slice(0, 5).map((k, i) => (
            <button
              key={k}
              className="pf2-score-hint-link"
              onClick={() => { setDrawerOpen(true); setEditing(ed => ({ ...ed, [k]: "" })); }}
            >
              {PF_FIELD_LABELS[k] || k}{i < Math.min(4, scoreMissing.length - 1) ? "," : ""}
            </button>
          ))}
          {scoreMissing.length > 5 && <span style={{ color: "var(--tx3)" }}> · +{scoreMissing.length - 5}</span>}
        </div>
      )}

      {/* Uncomfortable question ouverte */}
      {openUq && (
        <UqBlock uq={openUq} onAnswer={handleAnswerUQ} />
      )}

      {identityStr && !openUq && (
        <div className="pf2-last-uq">
          <div>
            <div className="pf2-last-uq-label">Identité déclarée</div>
            <div className="pf2-last-uq-date">champ <code>identity</code></div>
          </div>
          <div>
            <div className="pf2-last-uq-q">« {identityStr} »</div>
          </div>
        </div>
      )}

      {/* ══ ZONE 1 — CONTEXTE CLAUDE ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">01</span>
          <h2 className="pf2-zone-title">Ce que <em>Claude voit</em> de toi</h2>
          <span className="pf2-zone-meta">{contractRows.length} champs actifs</span>
        </div>
        <p className="pf2-zone-intro">
          Payload injecté par <code>get_user_context()</code> dans les prompts Claude.
          Le mode <em>mission</em> exclut les champs opérationnels.
        </p>
        <div className="pf2-toggle">
          <button className={`pf2-toggle-btn ${mission === "general" ? "is-active" : ""}`} onClick={() => setMission("general")}>general_context</button>
          <button className={`pf2-toggle-btn ${mission === "mission" ? "is-active" : ""}`} onClick={() => setMission("mission")}>mission · weekly_reflection</button>
        </div>
        <div className="pf2-terminal">
          <div className="pf2-term-divider">// get_user_context({mission === "mission" ? 'mission_specific=True' : ""}) · tokens estimés · fraîcheur</div>
          {contractRows.length === 0 && (
            <div className="pf2-term-line" style={{ color: "#e0a05a" }}>Aucun champ user_profile. Remplis le drawer en zone 07.</div>
          )}
          {contractRows.map(row => {
            const isExcluded = mission === "mission" && excluded.has(row.key);
            const fresh = pfFreshness(row.updated_at);
            const tokens = pfEstTokens(row.value);
            const label = PF_FIELD_LABELS[row.key] || row.key;
            return (
              <div key={row.key} className={`pf2-term-line ${isExcluded ? "is-excluded" : ""}`}>
                <span className="pf2-term-key">{label}:</span>
                <span className="pf2-term-value">"{String(row.value).slice(0, 260)}{String(row.value).length > 260 ? "…" : ""}"</span>
                <span className="pf2-term-tokens">~{tokens}t</span>
                <span className="pf2-term-status" data-s={fresh}>
                  {fresh === "fresh" ? "FRESH" : fresh === "stale" ? "STALE" : "STABLE"}
                </span>
              </div>
            );
          })}
          <div className="pf2-term-foot">
            <span>
              {mission === "mission"
                ? <>excluded · <strong>{excluded.size} fields, -{excludedTokens}t</strong> · final <strong className="ok">~{missionTokens}t</strong></>
                : <>total · <strong className="ok">~{totalTokens}t</strong></>}
            </span>
            <span>source · <strong>user_profile</strong></span>
          </div>
        </div>
      </section>

      {/* ══ ZONE 2 — FAITS APPRIS ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">02</span>
          <h2 className="pf2-zone-title">Ce que <em>Jarvis</em> a appris de toi</h2>
          <span className="pf2-zone-meta">nightly_learner · {localFacts.length} faits actifs</span>
        </div>
        <p className="pf2-zone-intro">
          Extraction nocturne depuis tes conversations Jarvis. Clique sur <strong>Faux</strong> pour
          marquer un fait incorrect : il sera supersédé et exclu des prompts.
        </p>
        {localFacts.length === 0 ? (
          <div className="pf2-empty">Aucun fait extrait. Lance <code>python jarvis/nightly_learner.py</code>.</div>
        ) : Object.keys(factsByType).length === 0 ? (
          <div className="pf2-empty">Aucun fait ne correspond à la recherche.</div>
        ) : (
          <div className="pf2-facts">
            {Object.entries(factsByType).sort(([, a], [, b]) => b.length - a.length).map(([type, items]) => (
              <div key={type} className="pf2-fact-group">
                <div className="pf2-fact-group-head">
                  <span className="pf2-fact-type" data-t={type}>{PF_FACT_TYPE_LABELS[type] || type}</span>
                  <span className="pf2-fact-count">{items.length}</span>
                </div>
                <div className="pf2-fact-items">
                  {items.slice(0, 15).map(f => (
                    <div key={f.id} className="pf2-fact-item">
                      <div className="pf2-fact-text">{f.fact_text}</div>
                      <div className="pf2-fact-meta">
                        <span>conf · {Math.round((f.confidence || 0) * 100)}%</span>
                        <span>{pfRelTime(f.created_at)}</span>
                        {f.source && <span className="pf2-fact-source">{f.source}</span>}
                        <button className="pf2-fact-false" onClick={() => handleMarkFactFalse(f.id)}>Faux</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ ZONE 3 — ENTITÉS ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">03</span>
          <h2 className="pf2-zone-title">Entités · <em>gens, outils, projets</em></h2>
          <span className="pf2-zone-meta">{filteredEntities.length}/{entities.length} entités</span>
        </div>
        <p className="pf2-zone-intro">
          Personnes, outils, projets et concepts mentionnés dans tes conversations.
        </p>
        {entities.length === 0 ? (
          <div className="pf2-empty">Aucune entité détectée.</div>
        ) : (
          <>
            <div className="pf2-ent-filters">
              {entityTypes.map(t => (
                <button key={t} className={`pf2-ent-filter ${entityFilter === t ? "is-active" : ""}`} onClick={() => setEntityFilter(t)}>
                  {t === "all" ? "Tous" : t} {t !== "all" && <span className="pf2-ent-filter-count">{entities.filter(e => e.entity_type === t).length}</span>}
                </button>
              ))}
            </div>
            {filteredEntities.length === 0 ? (
              <div className="pf2-empty">Aucune entité ne correspond aux filtres.</div>
            ) : (
              <div className="pf2-ent-grid">
                {filteredEntities.map(e => (
                  <div key={e.id} className="pf2-ent-card" data-type={e.entity_type}>
                    <div className="pf2-ent-head">
                      <span className="pf2-ent-type">{e.entity_type}</span>
                      <span className="pf2-ent-mentions">{e.mentions_count || 0}×</span>
                    </div>
                    <div className="pf2-ent-name">{e.name}</div>
                    {e.description && <div className="pf2-ent-desc">{e.description}</div>}
                    <div className="pf2-ent-foot">
                      {e.last_mentioned && <span>dernière mention · {pfRelTime(e.last_mentioned)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ══ ZONE 4 — COMMITMENTS ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">04</span>
          <h2 className="pf2-zone-title">Commitments · <em>ce qui doit bouger</em></h2>
          <span className="pf2-zone-meta">
            tri ·
            <button className="pf2-chip" data-active={commitSort === "stale"} onClick={() => setCommitSort("stale")}>stale first</button>
            <button className="pf2-chip" data-active={commitSort === "deadline"} onClick={() => setCommitSort("deadline")}>deadline</button>
          </span>
        </div>
        <p className="pf2-zone-intro">
          Table actionnable dans <code>commitments</code>. Pour chaque objectif : deadline, prochaine action, dernier mouvement.
        </p>
        <CommitmentTable commits={sortedCommits} onSave={handleSaveCommit} onDelete={handleDeleteCommit} />
      </section>

      {/* ══ ZONE 5 — TRIANGULATION ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">05</span>
          <h2 className="pf2-zone-title">Triangulation · <em>déclaré vs observé</em></h2>
          <span className="pf2-zone-meta">cross-check user_profile ↔ profile_facts</span>
        </div>
        <p className="pf2-zone-intro">
          Pour chaque champ déclaré, matching automatique avec les faits extraits par Jarvis.
          Un champ sans écho dans les conversations = signal de drift.
        </p>
        <div className="pf2-tri-head">
          <span>champ</span>
          <span>déclaré (user_profile)</span>
          <span>observé (facts)</span>
          <span>statut</span>
        </div>
        <div className="pf2-tri">
          {triangulation.map(t => (
            <div key={t.field} className="pf2-tri-row">
              <div>
                <div className="pf2-tri-field">{t.label}</div>
                <span className="pf2-tri-field-age">màj {t.declared_age_days}j</span>
                <span className="pf2-tri-level" data-l={t.level === "aligned" ? "aligned" : t.level === "stale-critical" ? "critical" : "drift"}>
                  {t.level === "aligned" ? "ALIGNED" : t.level === "stale-critical" ? "CRITICAL" : "DRIFT"}
                </span>
              </div>
              <div className="pf2-tri-col">{String(t.declared).slice(0, 100)}{String(t.declared).length > 100 ? "…" : ""}</div>
              <div className={`pf2-tri-col ${t.facts.length === 0 ? "is-muted" : ""}`}>
                {t.facts.length === 0
                  ? <em>aucun fait relié</em>
                  : t.facts.map((f, i) => (
                    <div key={i} style={{ marginBottom: 4, fontSize: 11 }}>• {f.fact_text.slice(0, 90)}{f.fact_text.length > 90 ? "…" : ""}</div>
                  ))
                }
              </div>
              <div className="pf2-tri-col">
                <strong>{t.facts_count}</strong> fait{t.facts_count > 1 ? "s" : ""} relié{t.facts_count > 1 ? "s" : ""}
              </div>
            </div>
          ))}
          <div className="pf2-tri-foot">
            <span>
              <strong>{triangulation.length}</strong> champs ·
              <span className="drift-c"> {triangulation.filter(t => t.level === "drift").length} drift</span> ·
              <span className="crit"> {triangulation.filter(t => t.level === "stale-critical").length} critical</span>
            </span>
            <span>source · profile_facts</span>
          </div>
        </div>
      </section>

      {/* ══ ZONE 6 — UNCOMFORTABLE QUESTIONS ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">06</span>
          <h2 className="pf2-zone-title">Questions <em>inconfortables</em></h2>
          <span className="pf2-zone-meta">{localUqs.length} questions · {localUqs.filter(u => u.resolved).length} résolues</span>
        </div>
        <p className="pf2-zone-intro">
          Générées par le pipeline hebdo quand un drift de triangulation est détecté.
        </p>
        {localUqs.length === 0 ? (
          <div className="pf2-empty">Aucune question pour l'instant. Le pipeline hebdo en générera une par semaine.</div>
        ) : (
          <div className="pf2-uq-list">
            {localUqs.map(u => <UqItem key={u.id} uq={u} onAnswer={handleAnswerUQ} />)}
          </div>
        )}
      </section>

      {/* ══ ZONE 7 — ÉDITEUR + HISTORIQUE ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">07</span>
          <h2 className="pf2-zone-title">Édition · <em>&amp; historique</em></h2>
          <span className="pf2-zone-meta">append-only · trigger Postgres</span>
        </div>
        <div className="pf2-z4">
          <div className={`pf2-drawer ${drawerOpen ? "is-open" : ""}`}>
            <div className="pf2-drawer-head" onClick={() => setDrawerOpen(!drawerOpen)}>
              <span>Éditer les champs · <strong>{visibleRows.length} entrées</strong></span>
            </div>
            <div className="pf2-drawer-body">
              {visibleRows.map(f => {
                const isEditing = editing[f.key] !== undefined;
                const isSaving = !!saving[f.key];
                const label = PF_FIELD_LABELS[f.key] || f.key;
                const currentValue = isEditing ? editing[f.key] : f.value;
                return (
                  <div key={f.key} className={`pf2-field-edit ${isEditing ? "is-editing" : ""}`}>
                    <div className="pf2-field-row">
                      <span className="pf2-field-key">{label}</span>
                      <span className="pf2-field-updated">{pfRelTime(f.updated_at)}</span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          className="pf2-field-input"
                          value={currentValue || ""}
                          onChange={e => setEditing(ed => ({ ...ed, [f.key]: e.target.value }))}
                          rows={Math.min(8, Math.max(2, String(currentValue || "").split("\n").length))}
                          autoFocus
                        />
                        <div className="pf2-field-actions">
                          <button className="pf2-btn pf2-btn-primary" disabled={isSaving} onClick={() => handleSaveField(f.key)}>
                            {isSaving ? "Enregistrement…" : "Enregistrer"}
                          </button>
                          <button className="pf2-btn" disabled={isSaving} onClick={() => setEditing(e => { const c = { ...e }; delete c[f.key]; return c; })}>
                            Annuler
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="pf2-field-value-row">
                        <div className="pf2-field-value">{String(f.value || "").trim() || <em style={{ color: "var(--tx3)" }}>vide</em>}</div>
                        <button className="pf2-btn pf2-btn-ghost" onClick={() => setEditing(ed => ({ ...ed, [f.key]: f.value || "" }))}>Éditer</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <NewFieldForm onSave={handleAddField} existingKeys={visibleRows.map(r => r.key)} />
            </div>
          </div>

          <div className="pf2-history">
            <div className="pf2-history-head">
              <span>history · user_profile_history</span>
              <strong>{history.length} entrées</strong>
            </div>
            {history.length === 0 ? (
              <div style={{ padding: 16, color: "var(--tx3)", fontSize: 12 }}>Aucun changement enregistré.</div>
            ) : history.slice(0, 20).map((h, i) => (
              <div key={h.id || i} className={`pf2-hist-item ${openHist === i ? "is-open" : ""}`} onClick={() => setOpenHist(openHist === i ? null : i)}>
                <span className="pf2-hist-date">{pfRelTime(h.changed_at)}</span>
                <div className="pf2-hist-body">
                  <span className="pf2-hist-field">{PF_FIELD_LABELS[h.field_key] || h.field_key}</span>
                  <span className="pf2-hist-source" data-s={h.source}>{h.source}</span>
                </div>
                <span style={{ color: "var(--tx3)", fontSize: 14 }}>{openHist === i ? "−" : "+"}</span>
                <div className="pf2-hist-diff">
                  {h.value_before && <div className="pf2-hist-diff-from">{h.value_before}</div>}
                  {h.value_after && <div className="pf2-hist-diff-to">{h.value_after}</div>}
                  <div style={{ color: "var(--tx3)", fontSize: 10, marginTop: 6, letterSpacing: "0.04em" }}>
                    trigger · {h.trigger_type || "manual_edit"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function UqBlock({ uq, onAnswer }) {
  const [answer, setAnswer] = usePfState("");
  const [resolution, setResolution] = usePfState("");
  return (
    <div className="pf2-uq-open">
      <div className="pf2-uq-label">Question inconfortable · en attente</div>
      <div className="pf2-uq-date">{pfRelTime(uq.asked_at)} · cible <code>{uq.field_target || "—"}</code></div>
      <div className="pf2-uq-question">« {uq.question} »</div>
      <textarea
        className="pf2-field-input"
        placeholder="Ta réponse…"
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        rows={3}
      />
      <input
        className="pf2-field-input"
        style={{ marginTop: 8 }}
        placeholder="Résolution (ex: champ X mis à jour, Y archivé…)"
        value={resolution}
        onChange={e => setResolution(e.target.value)}
      />
      <div className="pf2-field-actions">
        <button
          className="pf2-btn pf2-btn-primary"
          disabled={!answer.trim()}
          onClick={() => onAnswer(uq.id, answer.trim(), resolution.trim())}
        >
          Répondre &amp; résoudre
        </button>
      </div>
    </div>
  );
}

function UqItem({ uq, onAnswer }) {
  const [open, setOpen] = usePfState(false);
  const [answer, setAnswer] = usePfState(uq.answer || "");
  const [resolution, setResolution] = usePfState(uq.resolution || "");

  if (uq.resolved) {
    return (
      <div className="pf2-uq-item is-resolved">
        <div className="pf2-uq-meta">
          <span>{pfRelTime(uq.asked_at)}</span>
          <span className="pf2-uq-pill pf2-uq-pill-ok">✓ résolu</span>
          {uq.field_target && <code>{uq.field_target}</code>}
        </div>
        <div className="pf2-uq-q">« {uq.question} »</div>
        <div className="pf2-uq-a">→ {uq.answer}</div>
        {uq.resolution && <div className="pf2-uq-res">✓ {uq.resolution}</div>}
      </div>
    );
  }

  return (
    <div className="pf2-uq-item">
      <div className="pf2-uq-meta">
        <span>{pfRelTime(uq.asked_at)}</span>
        <span className="pf2-uq-pill">en attente</span>
        {uq.field_target && <code>{uq.field_target}</code>}
      </div>
      <div className="pf2-uq-q">« {uq.question} »</div>
      {!open ? (
        <button className="pf2-btn pf2-btn-ghost" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>Répondre</button>
      ) : (
        <>
          <textarea className="pf2-field-input" placeholder="Ta réponse…" value={answer} onChange={e => setAnswer(e.target.value)} rows={3} style={{ marginTop: 8 }} />
          <input className="pf2-field-input" placeholder="Résolution (optionnel)" value={resolution} onChange={e => setResolution(e.target.value)} style={{ marginTop: 6 }} />
          <div className="pf2-field-actions">
            <button className="pf2-btn pf2-btn-primary" disabled={!answer.trim()} onClick={() => onAnswer(uq.id, answer.trim(), resolution.trim())}>Résoudre</button>
            <button className="pf2-btn" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </>
      )}
    </div>
  );
}

function CommitmentTable({ commits, onSave, onDelete }) {
  const [creating, setCreating] = usePfState(false);

  return (
    <>
      <div className="pf2-cm-head">
        <span>objectif</span>
        <span>deadline</span>
        <span>next_action</span>
        <span>last_movement</span>
        <span>status</span>
        <span></span>
      </div>
      <div className="pf2-cm">
        {commits.length === 0 && !creating && (
          <div style={{ padding: 24, color: "var(--tx3)", textAlign: "center", fontSize: 12 }}>
            Aucun commitment. <button className="pf2-btn pf2-btn-ghost" onClick={() => setCreating(true)}>+ Ajouter</button>
          </div>
        )}
        {commits.map(c => <CommitmentRow key={c.id} commit={c} onSave={onSave} onDelete={onDelete} />)}
        {creating && (
          <CommitmentRow
            commit={{ label: "", deadline: "", next_action: "", status: "on-track" }}
            isNew
            onSave={async (p) => { await onSave(p); setCreating(false); }}
            onCancel={() => setCreating(false)}
          />
        )}
        {commits.length > 0 && !creating && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--bd)" }}>
            <button className="pf2-btn pf2-btn-ghost" onClick={() => setCreating(true)}>+ Ajouter un commitment</button>
          </div>
        )}
      </div>
    </>
  );
}

function CommitmentRow({ commit, isNew, onSave, onDelete, onCancel }) {
  const [editing, setEditing] = usePfState(!!isNew);
  const [form, setForm] = usePfState({
    label: commit.label || "",
    deadline: commit.deadline || "",
    next_action: commit.next_action || "",
    last_movement: commit.last_movement || "",
    status: commit.status || "on-track",
    notes: commit.notes || "",
  });

  async function save() {
    const payload = { ...form };
    if (!payload.label.trim()) { alert("Label requis"); return; }
    if (!payload.deadline) delete payload.deadline;
    if (!isNew && form.last_movement !== commit.last_movement) {
      payload.last_movement_at = new Date().toISOString();
    }
    await onSave(payload, isNew ? null : commit.id);
    if (!isNew) setEditing(false);
  }

  if (editing) {
    return (
      <div className="pf2-cm-row is-editing">
        <input className="pf2-field-input" placeholder="Objectif" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        <input className="pf2-field-input" type="date" value={form.deadline || ""} onChange={e => setForm({ ...form, deadline: e.target.value })} />
        <input className="pf2-field-input" placeholder="Prochaine action" value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })} />
        <input className="pf2-field-input" placeholder="Dernier mouvement" value={form.last_movement} onChange={e => setForm({ ...form, last_movement: e.target.value })} />
        <select className="pf2-field-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          <option value="on-track">En cours</option>
          <option value="at-risk">À risque</option>
          <option value="stale">Bloqué</option>
          <option value="done">Terminé</option>
          <option value="cancelled">Abandonné</option>
        </select>
        <div className="pf2-field-actions" style={{ margin: 0, gridColumn: "1 / -1" }}>
          <button className="pf2-btn pf2-btn-primary" onClick={save}>Enregistrer</button>
          <button className="pf2-btn" onClick={isNew ? onCancel : () => setEditing(false)}>Annuler</button>
        </div>
      </div>
    );
  }

  const deadlineFmt = commit.deadline
    ? `${commit.deadline}${commit.days_to_deadline != null ? ` · ${commit.days_to_deadline > 0 ? `dans ${commit.days_to_deadline}j` : `-${Math.abs(commit.days_to_deadline)}j`}` : ""}`
    : "—";

  return (
    <div className="pf2-cm-row">
      <div className="pf2-cm-label">{commit.label}</div>
      <div className="pf2-cm-deadline">
        {commit.deadline || "—"}
        {commit.days_to_deadline != null && <small>{commit.days_to_deadline > 0 ? `dans ${commit.days_to_deadline}j` : `passé de ${Math.abs(commit.days_to_deadline)}j`}</small>}
      </div>
      <div className="pf2-cm-action">{commit.next_action || "—"}</div>
      <div className={`pf2-cm-move ${(commit.movement_days || 0) <= 7 ? "is-fresh" : (commit.movement_days || 0) > 14 ? "is-stale" : ""}`}>
        {commit.last_movement ? `${commit.last_movement} · ${commit.movement_days}j` : `${commit.movement_days || 0}j`}
      </div>
      <div className="pf2-cm-status" data-s={commit.status}>{PF_COMMIT_STATUS_LABELS[commit.status] || commit.status}</div>
      <div>
        <button className="pf2-btn pf2-btn-ghost" onClick={() => setEditing(true)}>Éditer</button>
        <button className="pf2-btn pf2-btn-ghost" onClick={() => onDelete(commit.id)}>×</button>
      </div>
    </div>
  );
}

function NewFieldForm({ onSave, existingKeys }) {
  const [open, setOpen] = usePfState(false);
  const [key, setKey] = usePfState("");
  const [value, setValue] = usePfState("");
  const [err, setErr] = usePfState("");

  function submit() {
    setErr("");
    const k = key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!k) { setErr("Clé requise"); return; }
    if (existingKeys.includes(k)) { setErr("Clé existe déjà"); return; }
    if (!value.trim()) { setErr("Valeur requise"); return; }
    onSave(k, value.trim());
    setKey(""); setValue(""); setOpen(false);
  }

  if (!open) {
    return (
      <button className="pf2-btn pf2-btn-ghost" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
        + Ajouter un champ
      </button>
    );
  }

  return (
    <div className="pf2-field-edit is-editing" style={{ marginTop: 14 }}>
      <div className="pf2-field-row">
        <input className="pf2-field-input pf2-field-key-input" placeholder="clé (ex: hobbies)" value={key} onChange={e => setKey(e.target.value)} />
      </div>
      <textarea className="pf2-field-input" placeholder="valeur" value={value} onChange={e => setValue(e.target.value)} rows={3} />
      {err && <div style={{ color: "var(--critical)", fontSize: 11, marginTop: 4 }}>{err}</div>}
      <div className="pf2-field-actions">
        <button className="pf2-btn pf2-btn-primary" onClick={submit}>Créer</button>
        <button className="pf2-btn" onClick={() => { setOpen(false); setErr(""); }}>Annuler</button>
      </div>
    </div>
  );
}

window.PanelProfile = PanelProfile;
