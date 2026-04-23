// ═══════════════════════════════════════════════════════════════
// PANEL PROFIL v3 — branché Supabase (plus de fake data)
// ─────────────────────────────────────────────
// Zones réelles :
//  1. Contexte Claude — vrai user_profile (mission_keys exclues en mode mission)
//  2. Ce que Jarvis a appris — profile_facts (nightly_learner)
//  3. Entités détectées — entities
//  4. Éditeur — save direct sur user_profile (UPSERT)
// ═══════════════════════════════════════════════════════════════

const { useState: usePfState, useMemo: usePfMemo, useEffect: usePfEffect } = React;

const PF_MISSION_EXCLUDED = window.PROFILE_MISSION_EXCLUDED || [];
const PF_HIDDEN_KEYS = new Set(window.PROFILE_HIDDEN_KEYS || []);
const PF_FIELD_LABELS = window.PROFILE_FIELD_LABELS || {};
const PF_FACT_TYPE_LABELS = window.PROFILE_FACT_TYPE_LABELS || {};

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

function pfFreshness(isoStr) {
  if (!isoStr) return "stable";
  const days = Math.floor((Date.now() - new Date(isoStr).getTime()) / 86400000);
  if (days < 14) return "fresh";
  if (days > 90) return "stale";
  return "stable";
}

async function pfUpsertField(key, value) {
  const url = window.SUPABASE_URL + "/rest/v1/user_profile?on_conflict=key";
  const body = [{ key, value, updated_at: new Date().toISOString() }];
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...window.sb.headers,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("upsert " + res.status);
  return res.json();
}

function PanelProfile({ data, onNavigate }) {
  const PF = window.PROFILE_DATA || {};
  const rows = Array.isArray(PF._raw) ? PF._raw : [];
  const facts = Array.isArray(PF._facts) ? PF._facts : [];
  const entities = Array.isArray(PF._entities) ? PF._entities : [];

  const [mission, setMission] = usePfState("general");
  const [drawerOpen, setDrawerOpen] = usePfState(false);
  const [editing, setEditing] = usePfState({});
  const [saving, setSaving] = usePfState({});
  const [localRows, setLocalRows] = usePfState(rows);
  const [entityFilter, setEntityFilter] = usePfState("all");

  usePfEffect(() => { setLocalRows(rows); }, [rows.length, PF._lastUpdated]);

  const visibleRows = localRows.filter(r => !PF_HIDDEN_KEYS.has(r.key));
  const contractRows = visibleRows.filter(r => r.value && String(r.value).trim());

  const totalTokens = contractRows.reduce((s, r) => s + pfEstTokens(r.value), 0);
  const excluded = new Set(PF_MISSION_EXCLUDED);
  const excludedTokens = contractRows
    .filter(r => excluded.has(r.key))
    .reduce((s, r) => s + pfEstTokens(r.value), 0);
  const missionTokens = totalTokens - excludedTokens;

  const identity = rows.find(r => r.key === "identity")?.value || "";
  const role = rows.find(r => r.key === "current_role")?.value || "";
  const company = rows.find(r => r.key === "company_context")?.value || "";
  const displayName = (PF._values && PF._values.name) || "Jean";

  const factsByType = usePfMemo(() => {
    const groups = {};
    facts.forEach(f => {
      const t = f.fact_type || "other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(f);
    });
    return groups;
  }, [facts.length]);

  const entityTypes = usePfMemo(() => {
    const types = new Set(entities.map(e => e.entity_type).filter(Boolean));
    return ["all", ...Array.from(types)];
  }, [entities.length]);

  const filteredEntities = entityFilter === "all"
    ? entities
    : entities.filter(e => e.entity_type === entityFilter);

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
      console.error("[profile] save failed", err);
      alert("Échec de la sauvegarde : " + err.message);
    } finally {
      setSaving(s => { const c = { ...s }; delete c[key]; return c; });
    }
  }

  function handleCancelEdit(key) {
    setEditing(e => { const c = { ...e }; delete c[key]; return c; });
  }

  async function handleAddField(key, value) {
    if (!key || !value) return;
    setSaving(s => ({ ...s, __new__: true }));
    try {
      await pfUpsertField(key, value);
      const now = new Date().toISOString();
      setLocalRows(rs => [...rs, { key, value, updated_at: now }]);
      if (window.PROFILE_DATA) {
        window.PROFILE_DATA._values = { ...window.PROFILE_DATA._values, [key]: value };
      }
    } catch (err) {
      alert("Échec : " + err.message);
    } finally {
      setSaving(s => { const c = { ...s }; delete c[key]; return c; });
    }
  }

  return (
    <div className="pf2-wrap" data-screen-label="Profil">
      {/* ══ HEADER ══ */}
      <header className="pf2-head">
        <div className="pf2-head-main">
          <div className="pf2-head-eyebrow">user_profile · {visibleRows.length} champs</div>
          <h1 className="pf2-head-name">{displayName}</h1>
          <div className="pf2-head-role">{role || "—"}</div>
          <div className="pf2-head-stats">
            <span>dernière maj · <strong>{pfRelTime(PF._lastUpdated)}</strong></span>
            <span>faits appris · <strong>{facts.length}</strong></span>
            <span>entités détectées · <strong>{entities.length}</strong></span>
          </div>
        </div>
        <div className="pf2-head-energy">
          <span>contexte</span>
          <strong>{company || "—"}</strong>
        </div>
      </header>

      {identity && (
        <div className="pf2-last-uq">
          <div>
            <div className="pf2-last-uq-label">Identité déclarée</div>
            <div className="pf2-last-uq-date">champ <code>identity</code></div>
          </div>
          <div>
            <div className="pf2-last-uq-q">« {identity} »</div>
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
          Le payload injecté par <code>get_user_context()</code> dans les prompts Claude du pipeline hebdomadaire.
          Le mode <em>mission</em> exclut les champs opérationnels (rôle, entreprise, projets).
        </p>
        <div className="pf2-toggle">
          <button className={`pf2-toggle-btn ${mission === "general" ? "is-active" : ""}`} onClick={() => setMission("general")}>general_context</button>
          <button className={`pf2-toggle-btn ${mission === "mission" ? "is-active" : ""}`} onClick={() => setMission("mission")}>mission · weekly_reflection</button>
        </div>
        <div className="pf2-terminal">
          <div className="pf2-term-divider">// get_user_context({mission === "mission" ? 'mission_specific=True' : ""}) · tokens estimés · fraîcheur</div>
          {contractRows.length === 0 && (
            <div className="pf2-term-line" style={{ color: "#e0a05a" }}>Aucun champ user_profile n'a de valeur. Remplis le drawer en zone 04.</div>
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
            <span>source · <strong>user_profile</strong> (Supabase)</span>
          </div>
        </div>
      </section>

      {/* ══ ZONE 2 — FAITS APPRIS (profile_facts) ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">02</span>
          <h2 className="pf2-zone-title">Ce que <em>Jarvis</em> a appris de toi</h2>
          <span className="pf2-zone-meta">nightly_learner · {facts.length} faits actifs</span>
        </div>
        <p className="pf2-zone-intro">
          Extraction nocturne depuis tes conversations Jarvis et observations d'activité.
          Les faits obsolètes sont automatiquement remplacés (superseded). Groupés par type.
        </p>
        {facts.length === 0 ? (
          <div className="pf2-empty">
            Aucun fait extrait pour l'instant. Lance <code>python jarvis/nightly_learner.py</code> ou attends la prochaine exécution à minuit.
          </div>
        ) : (
          <div className="pf2-facts">
            {Object.entries(factsByType)
              .sort(([, a], [, b]) => b.length - a.length)
              .map(([type, items]) => (
                <div key={type} className="pf2-fact-group">
                  <div className="pf2-fact-group-head">
                    <span className="pf2-fact-type" data-t={type}>{PF_FACT_TYPE_LABELS[type] || type}</span>
                    <span className="pf2-fact-count">{items.length}</span>
                  </div>
                  <div className="pf2-fact-items">
                    {items.slice(0, 12).map(f => (
                      <div key={f.id} className="pf2-fact-item">
                        <div className="pf2-fact-text">{f.fact_text}</div>
                        <div className="pf2-fact-meta">
                          <span>conf · {Math.round((f.confidence || 0) * 100)}%</span>
                          <span>{pfRelTime(f.created_at)}</span>
                          {f.source && <span className="pf2-fact-source">{f.source}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ══ ZONE 3 — ENTITÉS DÉTECTÉES ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">03</span>
          <h2 className="pf2-zone-title">Entités · <em>gens, outils, projets</em></h2>
          <span className="pf2-zone-meta">{entities.length} entités détectées</span>
        </div>
        <p className="pf2-zone-intro">
          Personnes, outils, projets, entreprises et concepts mentionnés dans tes conversations Jarvis.
          Classés par nombre de mentions.
        </p>
        {entities.length === 0 ? (
          <div className="pf2-empty">Aucune entité détectée pour l'instant.</div>
        ) : (
          <>
            <div className="pf2-ent-filters">
              {entityTypes.map(t => (
                <button
                  key={t}
                  className={`pf2-ent-filter ${entityFilter === t ? "is-active" : ""}`}
                  onClick={() => setEntityFilter(t)}
                >
                  {t === "all" ? "Tous" : t} {t !== "all" && <span className="pf2-ent-filter-count">{entities.filter(e => e.entity_type === t).length}</span>}
                </button>
              ))}
            </div>
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
          </>
        )}
      </section>

      {/* ══ ZONE 4 — ÉDITEUR ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">04</span>
          <h2 className="pf2-zone-title">Édition · <em>champs user_profile</em></h2>
          <span className="pf2-zone-meta">save direct · upsert Supabase</span>
        </div>
        <p className="pf2-zone-intro">
          Édite chaque champ et sauvegarde. La valeur est upsertée dans <code>user_profile</code>
          et immédiatement disponible pour Claude au prochain run.
        </p>
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
                        <button className="pf2-btn" disabled={isSaving} onClick={() => handleCancelEdit(f.key)}>
                          Annuler
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pf2-field-value-row">
                      <div className="pf2-field-value">{String(f.value || "").trim() || <em style={{ color: "var(--tx3)" }}>vide</em>}</div>
                      <button className="pf2-btn pf2-btn-ghost" onClick={() => setEditing(ed => ({ ...ed, [f.key]: f.value || "" }))}>
                        Éditer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <NewFieldForm onSave={handleAddField} existingKeys={visibleRows.map(r => r.key)} />
          </div>
        </div>
      </section>
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
