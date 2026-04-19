// ═══════════════════════════════════════════════════════════════
// PANEL PROFIL v2 — Contrat système
// ─────────────────────────────────────────────
// 4 zones :
//  1. CONTRACT  — ce que get_user_context() injecte (terminal)
//  2. TRIANG.   — déclaré vs observé (Jarvis + footprint)
//  3. COMMITS   — table dense actionable
//  4. DRAWER    — edit fields + history timeline
// ═══════════════════════════════════════════════════════════════

const { useState: usePf2State } = React;

function PanelProfile({ data, onNavigate }) {
  const PF = window.PROFILE_DATA;
  const [mission, setMission] = usePf2State("general"); // general | mission
  const [drawerOpen, setDrawerOpen] = usePf2State(false);
  const [openHist, setOpenHist] = usePf2State(null);
  const [commitSort, setCommitSort] = usePf2State("stale");

  const sortedCommits = [...PF.commitments].sort((a, b) => {
    if (commitSort === "stale") return b.movement_days - a.movement_days;
    if (commitSort === "deadline") return a.deadline.localeCompare(b.deadline);
    return 0;
  });

  const excluded = new Set(PF.contract.mission_excluded);
  const contractRows = PF.contract.general_context;
  const finalTokens = mission === "mission"
    ? PF.contract.mission_specific.final_tokens
    : PF.contract.total_tokens;

  return (
    <div className="pf2-wrap" data-screen-label="Profil">
      {/* ══ HEADER ══ */}
      <header className="pf2-head">
        <div className="pf2-head-main">
          <div className="pf2-head-eyebrow">user_profile · {PF.identity.profile_version}</div>
          <h1 className="pf2-head-name">{PF.identity.name}</h1>
          <div className="pf2-head-role">{PF.identity.role} · {PF.identity.location}</div>
          <div className="pf2-head-stats">
            <span>last_edit · <strong>{PF.identity.last_edit_at}</strong> · {PF.identity.last_edit_field}</span>
            <span>next_injection · <strong>{PF.identity.next_injection_at}</strong></span>
          </div>
        </div>
        <div className="pf2-head-energy">
          <span>energy</span>
          <div className="pf2-head-energy-bar"><div style={{width: `${PF.identity.energy.level*100}%`}}/></div>
          <strong>{PF.identity.energy.mood}</strong>
        </div>
      </header>

      <div className="pf2-last-uq">
        <div>
          <div className="pf2-last-uq-label">Dernière uncomfortable question</div>
          <div className="pf2-last-uq-date">{PF.uncomfortable_last.date}</div>
          <div className="pf2-last-uq-target">→ {PF.uncomfortable_last.field_target}</div>
        </div>
        <div>
          <div className="pf2-last-uq-q">« {PF.uncomfortable_last.question} »</div>
          <div className="pf2-last-uq-a">{PF.uncomfortable_last.answer}</div>
          <div className="pf2-last-uq-resolution">✓ {PF.uncomfortable_last.resolution}</div>
        </div>
      </div>

      {/* ══ ZONE 1 — CONTRACT ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">01</span>
          <h2 className="pf2-zone-title">Ce que <em>Claude voit</em> de toi</h2>
          <span className="pf2-zone-meta">last run · {PF.contract.last_run_at}</span>
        </div>
        <p className="pf2-zone-intro">
          Le payload exact injecté par <code>get_user_context()</code> dans les prompts. Lecture seule — pour éditer, ouvre le drawer en zone 04.
        </p>
        <div className="pf2-toggle">
          <button className={`pf2-toggle-btn ${mission==="general"?"is-active":""}`} onClick={()=>setMission("general")}>general_context</button>
          <button className={`pf2-toggle-btn ${mission==="mission"?"is-active":""}`} onClick={()=>setMission("mission")}>mission · weekly_reflection</button>
        </div>
        <div className="pf2-terminal">
          <div className="pf2-term-divider">// get_user_context({mission === "mission" ? 'mission="weekly_reflection"' : ""}) · tokens · freshness</div>
          {contractRows.map(row => {
            const isExcluded = mission === "mission" && excluded.has(row.field);
            return (
              <div key={row.field} className={`pf2-term-line ${isExcluded?"is-excluded":""}`}>
                <span className="pf2-term-key">{row.field}:</span>
                <span className="pf2-term-value">"{row.value}"</span>
                <span className="pf2-term-tokens">{row.tokens}t</span>
                <span className="pf2-term-status" data-s={row.fresh}>
                  {row.fresh === "fresh" ? "FRESH" : row.fresh === "stale" ? "STALE" : "STABLE"}
                </span>
              </div>
            );
          })}
          <div className="pf2-term-foot">
            <span>next_run · <strong>{PF.contract.next_run_at}</strong></span>
            <span>
              {mission === "mission"
                ? <>excluded · <strong>{excluded.size} fields, -{PF.contract.mission_specific.excluded_tokens}t</strong> · final <strong className="ok">{finalTokens}t</strong></>
                : <>total · <strong className="ok">{finalTokens}t</strong></>}
            </span>
          </div>
        </div>
      </section>

      {/* ══ ZONE 2 — TRIANGULATION ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">02</span>
          <h2 className="pf2-zone-title">Triangulation · <em>déclaré vs observé</em></h2>
          <span className="pf2-zone-meta">nightly_learner · {PF.triangulation.last_nightly_run}</span>
        </div>
        <p className="pf2-zone-intro">
          Trois sources croisées. Les divergences sont le carburant des uncomfortable questions du dimanche — clique pour la composer.
        </p>
        <div className="pf2-tri-head">
          <span>field / level</span>
          <span>declared</span>
          <span>observed · jarvis</span>
          <span>observed · footprint</span>
        </div>
        <div className="pf2-tri">
          {PF.triangulation.rows.map(r => (
            <React.Fragment key={r.field}>
              <div className="pf2-tri-row">
                <div>
                  <div className="pf2-tri-field">{r.field}</div>
                  <span className="pf2-tri-field-age">declared {r.declared_age} ago</span>
                  <span className="pf2-tri-level" data-l={r.level}>{r.level}</span>
                </div>
                <div className="pf2-tri-col">{r.declared}</div>
                <div className={`pf2-tri-col ${r.level==="critical"?"is-critical":r.level==="drift"?"is-divergent":r.jarvis==="—"?"is-muted":""}`}>
                  {r.jarvis}
                </div>
                <div className={`pf2-tri-col ${r.level==="critical"?"is-critical":r.level==="drift"?"is-divergent":r.footprint==="—"?"is-muted":""}`}>
                  {r.footprint}
                </div>
                {r.action && r.action !== "—" && (
                  <div className={`pf2-tri-action ${r.resolved?"is-resolved":""}`}>
                    <span>{r.action}</span>
                    {!r.resolved && <button>Compose UQ →</button>}
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
          <div className="pf2-tri-foot">
            <span><strong>{PF.triangulation.rows.length}</strong> fields tracked · <span className="crit">{PF.triangulation.divergences_critical} critical</span> · <span className="drift-c">{PF.triangulation.divergences_drift} drift</span></span>
            <span>next run · dimanche 02:47</span>
          </div>
        </div>
      </section>

      {/* ══ ZONE 3 — COMMITMENTS ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">03</span>
          <h2 className="pf2-zone-title">Commitments · <em>ce qui doit bouger</em></h2>
          <span className="pf2-zone-meta">
            tri · <button className="pf2-toggle-btn" style={{border:"1px solid var(--bd)",borderRadius:3,padding:"3px 8px",background:commitSort==="stale"?"var(--tx)":"transparent",color:commitSort==="stale"?"var(--bg)":"var(--tx2)"}} onClick={()=>setCommitSort("stale")}>stale first</button>
            {" "}
            <button className="pf2-toggle-btn" style={{border:"1px solid var(--bd)",borderRadius:3,padding:"3px 8px",background:commitSort==="deadline"?"var(--tx)":"transparent",color:commitSort==="deadline"?"var(--bg)":"var(--tx2)"}} onClick={()=>setCommitSort("deadline")}>deadline</button>
          </span>
        </div>
        <p className="pf2-zone-intro">
          Séparé de <code>user_profile</code>. Couche actionnable — le weekly peut te poser "qu'est-ce qui a bougé sur X ?" sans paraphraser.
        </p>
        <div className="pf2-cm-head">
          <span>objectif</span>
          <span>deadline</span>
          <span>next_action</span>
          <span>last_movement</span>
          <span>status</span>
        </div>
        <div className="pf2-cm">
          {sortedCommits.map(c => (
            <div key={c.id} className="pf2-cm-row">
              <div className="pf2-cm-label">{c.label}</div>
              <div className="pf2-cm-deadline">
                {c.deadline}
                <small>{c.deadline_fmt}</small>
              </div>
              <div className="pf2-cm-action">{c.next_action}</div>
              <div className={`pf2-cm-move ${c.movement_days <= 7 ? "is-fresh" : c.movement_days > 14 ? "is-stale" : ""}`}>
                {c.last_movement}
              </div>
              <div className="pf2-cm-status" data-s={c.status}>{c.status}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ ZONE 4 — DRAWER + HISTORY ══ */}
      <section className="pf2-zone">
        <div className="pf2-zone-head">
          <span className="pf2-zone-num">04</span>
          <h2 className="pf2-zone-title">Édition · <em>&amp; historique</em></h2>
          <span className="pf2-zone-meta">append-only · user_profile_history</span>
        </div>
        <div className="pf2-z4">
          <div className={`pf2-drawer ${drawerOpen?"is-open":""}`}>
            <div className="pf2-drawer-head" onClick={()=>setDrawerOpen(!drawerOpen)}>
              <span>Edit profile fields · <strong>{PF.profile_fields.length} champs</strong></span>
            </div>
            <div className="pf2-drawer-body">
              {PF.profile_fields.map(f => (
                <div key={f.key} className="pf2-field">
                  <span className="pf2-field-key">{f.key}</span>
                  <span className="pf2-field-value">{String(f.value)}</span>
                  <span className="pf2-field-updated">{f.updated}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pf2-history">
            <div className="pf2-history-head">
              <span>history · 6-12 mois</span>
              <strong>{PF.history.length} entrées</strong>
            </div>
            {PF.history.map((h, i) => (
              <div key={i} className={`pf2-hist-item ${openHist === i ? "is-open" : ""}`} onClick={()=>setOpenHist(openHist===i?null:i)}>
                <span className="pf2-hist-date">{h.date_fmt}</span>
                <div className="pf2-hist-body">
                  <span className="pf2-hist-field">{h.field}</span>
                  <span className="pf2-hist-source" data-s={h.source}>{h.source}</span>
                </div>
                <span style={{color:"var(--tx3)",fontSize:14}}>{openHist === i ? "−" : "+"}</span>
                <div className="pf2-hist-diff">
                  <div className="pf2-hist-diff-from">{h.diff_from}</div>
                  <div className="pf2-hist-diff-to">{h.diff_to}</div>
                  <div style={{color:"var(--tx3)",fontSize:10,marginTop:6,letterSpacing:"0.04em"}}>trigger · {h.trigger}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

window.PanelProfile = PanelProfile;
