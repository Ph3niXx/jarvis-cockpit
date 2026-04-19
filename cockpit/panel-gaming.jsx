// ═══════════════════════════════════════════════════════════════
// PANEL GAMING — cross-platform (Steam + PSN + Xbox + Riot)
// ─────────────────────────────────────────────
// Hero : last session + 4 plateformes
// §1 En cours — cards avec progression HLTB
// §2 Backlog priorisé
// §3 Activité (courbe 180j + heatmap 24×7)
// §4 Genres
// §5 Wishlist (lien veille gaming)
// §6 Top all-time
// §7 Achievements récents
// §8 2026 milestones
// ═══════════════════════════════════════════════════════════════

const { useState: useGmState, useMemo: useGmMemo } = React;

// ── Chart activity ──────────────────────────────────
function GmActivityChart({ series, range }) {
  const w = 1000, h = 200;
  const padL = 44, padR = 16, padT = 16, padB = 26;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const windowDays = { "30j": 30, "90j": 90, "180j": 180 }[range] || series.length;
  const data = series.slice(-windowDays);
  const vals = data.map((d) => d.hours);
  const yMax = Math.max(...vals) * 1.1;
  const yMin = 0;

  const x = (i) => padL + (i / (data.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const avg = data.map((_, i) => {
    const start = Math.max(0, i - 3);
    const end = Math.min(data.length, i + 4);
    const slice = data.slice(start, end).map((d) => d.hours);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const linePath = "M" + avg.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L");
  const barW = Math.max(1, plotW / data.length - 1);

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => yMin + (i / (yTickCount - 1)) * (yMax - yMin));
  const tickCount = 6;
  const tIdx = Array.from({ length: tickCount }, (_, i) => Math.floor((i / (tickCount - 1)) * (data.length - 1)));
  const fmt = (s) => new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <svg className="gm-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {yTicks.map((t, i) => (
        <g key={"y" + i}>
          <line className="gm-chart-grid" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} />
          <text className="gm-chart-label" x={padL - 8} y={y(t) + 3} textAnchor="end">{t.toFixed(1)}h</text>
        </g>
      ))}
      <line className="gm-chart-axis" x1={padL} x2={w - padR} y1={h - padB} y2={h - padB} />
      {tIdx.map((t, i) => (
        <text key={"x" + i} className="gm-chart-label" x={x(t)} y={h - padB + 15} textAnchor="middle">
          {fmt(data[t].date)}
        </text>
      ))}
      {data.map((d, i) => (
        <rect
          key={i}
          x={x(i) - barW / 2}
          y={y(d.hours)}
          width={barW}
          height={Math.max(0, (h - padB) - y(d.hours))}
          fill="var(--accent)"
          opacity="0.22"
        />
      ))}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Heatmap ─────────────────────────────────────────
function GmHeatmap({ grid }) {
  const DOW = ["L", "M", "M", "J", "V", "S", "D"];
  const reordered = [1, 2, 3, 4, 5, 6, 0].map((i) => grid[i]);
  const max = Math.max(...grid.flat());
  const color = (v) => {
    if (v < 0.5) return "var(--bd)";
    const t = Math.min(1, v / max);
    const alpha = 0.15 + t * 0.85;
    return `rgba(168, 74, 34, ${alpha.toFixed(2)})`;
  };
  return (
    <div>
      <div className="gm-heatmap-grid">
        {reordered.map((row, r) => (
          <React.Fragment key={r}>
            <div className="gm-heatmap-row-label">{DOW[r]}</div>
            {row.map((v, h) => (
              <div key={h} className="gm-heatmap-cell" style={{ background: color(v) }} title={`${DOW[r]} ${h}h · ${v.toFixed(1)}h moy.`} />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="gm-heatmap-hours">
        <span></span>
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 3 === 0 ? h : ""}</span>
        ))}
      </div>
    </div>
  );
}

// ── Panel ───────────────────────────────────────────
function PanelGaming({ onNavigate }) {
  const D = window.GAMING_PERSO_DATA;
  const [chartRange, setChartRange] = useGmState("90j");

  const lastGame = D.in_progress[0]; // P5R en vedette
  const plat = (id) => D.profiles.find((p) => p.id === id);

  return (
    <div className="gm-wrap" data-screen-label="Gaming">
      {/* ══ HERO ══ */}
      <header className="gm-hero">
        <div>
          <div className="gm-hero-eyebrow">
            gaming · steam + psn + xbox + riot · {Math.round(D.totals.hours_total).toLocaleString("fr-FR")}h cumulées depuis 2012
          </div>
          <h1 className="gm-hero-title">
            <em>{D.totals.last30.toFixed(0)}h</em> sur 30 jours<br />
            — JRPG + TFT dominent, <em>{D.totals.backlog_count} jeux</em> en backlog.
          </h1>
          <p className="gm-hero-sub">
            Phase Persona 5 Royal crunch : {lastGame.progress_pct * 100 | 0}% du palais 5. TFT Master+{D.profiles.find(p => p.id === "riot").lp} LP depuis la semaine dernière.
            Sessions majoritairement 20h–23h semaine, 14h–18h week-end. Taux de complétion bibliothèque : {D.totals.completion_rate}%.
          </p>
        </div>

        <div className="gm-last">
          <div className="gm-last-cover" style={{ background: lastGame.cover }}>
            <div className="gm-last-platform">{lastGame.platform}</div>
            <div className="gm-last-cover-title">{lastGame.title}</div>
          </div>
          <div className="gm-last-meta">
            <div className="gm-last-label">last session · {lastGame.last_session}</div>
            <div className="gm-last-title">{lastGame.title}</div>
            <div className="gm-last-sub"><strong>{lastGame.played_h}h</strong> jouées · {lastGame.hltb_main}h HLTB · <strong>{(lastGame.progress_pct * 100).toFixed(0)}%</strong></div>
            <div className="gm-last-stats">
              <span><strong>{lastGame.genre}</strong></span>
              <span>reste <strong>{lastGame.hltb_main - lastGame.played_h}h</strong> estimées</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══ PROFILS PLATEFORMES ══ */}
      <div className="gm-profiles">
        {D.profiles.map((p) => (
          <div className="gm-profile" key={p.id}>
            <div className="gm-profile-head">
              <div className="gm-profile-badge">
                <span className="gm-profile-dot" style={{ background: p.accent }}></span>
                <div>
                  <div className="gm-profile-name">{p.platform}</div>
                  <div className="gm-profile-handle">{p.handle}</div>
                </div>
              </div>
            </div>
            <div className="gm-profile-main">
              <span className="gm-profile-main-val">{p.hours_total.toLocaleString("fr-FR")}</span>
              <span className="gm-profile-main-unit">h</span>
            </div>
            <div className="gm-profile-sub">
              {p.id === "riot" ? (
                <>
                  <strong>{p.rank}</strong> · +{p.lp} LP<br />
                  {p.games_season} games · top 4 <strong>{(p.top4_rate * 100).toFixed(0)}%</strong>
                </>
              ) : (
                <>
                  <strong>{p.games_played}</strong>/{p.games_owned} jeux joués<br />
                  {p.achievements ? <>{p.achievements.toLocaleString("fr-FR")} achievements</> :
                   p.trophies ? <>{p.trophies.platinum} platines · {p.trophies.gold} or</> : ""}
                  {p.gamerscore && <> · {p.gamerscore.toLocaleString("fr-FR")} gs</>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ══ §1 EN COURS ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">01</span>
          <h2 className="gm-section-title">En cours · <em>{D.in_progress.length} jeux actifs</em></h2>
          <span className="gm-section-meta">progression HLTB · last session</span>
        </div>
        <div className="gm-ip-grid">
          {D.in_progress.map((g) => (
            <div className="gm-ip-card" key={g.title}>
              <div className="gm-ip-cover" style={{ background: g.cover }}>
                <div className="gm-ip-cover-plat">{g.platform}</div>
                <div className={`gm-ip-cover-status ${g.comfort ? "comfort" : g.status}`}>
                  {g.comfort ? "comfort" : g.status}
                </div>
              </div>
              <div className="gm-ip-body">
                <div className="gm-ip-head">
                  <div className="gm-ip-title">{g.title}</div>
                  <div className="gm-ip-genre">{g.genre}</div>
                </div>
                {g.ongoing ? (
                  <>
                    <div className="gm-ip-rank">
                      {g.rank}
                      <span className="gm-ip-rank-lp">+{g.delta_lp_week} LP · 7j</span>
                    </div>
                    <div className="gm-ip-last">{g.played_h}h all-time · {g.last_session}</div>
                  </>
                ) : (
                  <>
                    <div className="gm-ip-progress">
                      <div className="gm-ip-progress-head">
                        <span><strong>{g.played_h}h</strong> / {g.hltb_main}h</span>
                        <span>{(g.progress_pct * 100).toFixed(0)}%</span>
                      </div>
                      <div className="gm-ip-bar"><div className="gm-ip-bar-fill" style={{ width: `${g.progress_pct * 100}%` }}></div></div>
                    </div>
                    <div className="gm-ip-last">{g.last_session}</div>
                  </>
                )}
                <div className="gm-ip-note">{g.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §2 BACKLOG ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">02</span>
          <h2 className="gm-section-title">Backlog · <em>à jouer</em></h2>
          <span className="gm-section-meta">trié par priorité · hype × accessibilité</span>
        </div>
        <div className="gm-bl-list">
          <div className="gm-bl-row is-head">
            <div>prio</div>
            <div></div>
            <div>jeu · pourquoi</div>
            <div>plateforme</div>
            <div style={{textAlign:"right"}}>HLTB</div>
            <div style={{textAlign:"center"}}>hype</div>
            <div></div>
          </div>
          {D.backlog.map((b) => (
            <div className={`gm-bl-row ${b.priority === "shame" ? "is-shame" : ""}`} key={b.title}>
              <div>
                <span className={`gm-bl-prio ${b.priority}`}>
                  {b.priority === "shame" ? `honte ${b.shame_years}y` : b.priority}
                </span>
              </div>
              <div>
                <div className="gm-bl-cover" style={{ background: b.cover }}></div>
              </div>
              <div className="gm-bl-info">
                <div className="gm-bl-title">{b.title}</div>
                <div className="gm-bl-reason">{b.reason}</div>
              </div>
              <div>
                <div className="gm-bl-plat">{b.platform}</div>
                <div className="gm-bl-plat-sub">{b.acquired} · {b.acquired_how}</div>
              </div>
              <div>
                <div className="gm-bl-hltb">{b.hltb}h</div>
                <div className="gm-bl-hltb-sub">main story</div>
              </div>
              <div>
                <div className="gm-bl-hype">{b.hype}</div>
                <div className="gm-bl-hype-sub">/10</div>
              </div>
              <div></div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §3 ACTIVITÉ ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">03</span>
          <h2 className="gm-section-title">Temps de jeu · <em>tendance longue</em></h2>
          <span className="gm-section-meta">heures/jour · moyenne mobile 7j</span>
        </div>
        <div className="gm-chart-wrap" style={{ marginBottom: 20 }}>
          <div className="gm-chart-head">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--tx2)" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginRight: 6 }}></span>
              heures/jour
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", opacity: 0.3, margin: "0 6px 0 18px" }}></span>
              moyenne mobile 7j
            </div>
            <div className="mz-range">
              {["30j", "90j", "180j"].map((r) => (
                <button
                  key={r}
                  className={`mz-range-btn ${chartRange === r ? "is-active" : ""}`}
                  onClick={() => setChartRange(r)}
                >{r}</button>
              ))}
            </div>
          </div>
          <GmActivityChart series={D.daily_sessions} range={chartRange} />
        </div>
        <div className="mz-heatmap">
          <div className="mz-heatmap-head">
            <div className="mz-heatmap-title">Heure × jour · moyenne 30j</div>
            <div className="mz-heatmap-legend">
              moins
              <div className="mz-heatmap-scale">
                <span style={{ background: "var(--bd)" }}></span>
                <span style={{ background: "rgba(168, 74, 34, 0.25)" }}></span>
                <span style={{ background: "rgba(168, 74, 34, 0.5)" }}></span>
                <span style={{ background: "rgba(168, 74, 34, 0.75)" }}></span>
                <span style={{ background: "rgba(168, 74, 34, 1)" }}></span>
              </div>
              plus
            </div>
          </div>
          <GmHeatmap grid={D.heatmap} />
        </div>
      </section>

      {/* ══ §4 GENRES ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">04</span>
          <h2 className="gm-section-title">Genres · <em>répartition 30j</em></h2>
          <span className="gm-section-meta">{D.totals.last30.toFixed(0)}h · toutes plateformes</span>
        </div>
        <div className="gm-genre-bar">
          {D.genres_30d.map((g) => (
            <div
              key={g.label}
              className="gm-genre-bar-seg"
              style={{ flex: g.share, background: g.color }}
              title={`${g.label} · ${(g.share * 100).toFixed(0)}% · ${g.hours}h`}
            >
              {g.share > 0.06 ? `${(g.share * 100).toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 36 }}>
          <div className="gm-genre-table">
            {D.genres_30d.map((g) => (
              <div className="gm-genre-row" key={g.label}>
                <div className="gm-genre-dot" style={{ background: g.color }}></div>
                <div className="gm-genre-label">{g.label}</div>
                <div className="gm-genre-share">{(g.share * 100).toFixed(0)}%</div>
                <div className="gm-genre-hrs">{g.hours}h</div>
              </div>
            ))}
          </div>
          <div>
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: 14.5,
              fontStyle: "italic",
              color: "var(--tx2)",
              lineHeight: 1.55,
              textWrap: "pretty"
            }}>
              Les JRPG dominent (P5R crunch) mais TFT reste ta constante — même les jours chargés
              tu y passes 30 min. Les CRPG ralentissent depuis que BG3 stagne en Acte 2.
              Le roguelike (Balatro) sert de décompression entre deux sessions longues.
            </p>
          </div>
        </div>
      </section>

      {/* ══ §5 WISHLIST ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">05</span>
          <h2 className="gm-section-title">Wishlist · <em>ce que tu surveilles</em></h2>
          <span className="gm-section-meta">{D.wishlist.length} titres · croisé avec ta veille gaming</span>
        </div>
        <div className="gm-wl-grid">
          {D.wishlist.map((w) => (
            <div className={`gm-wl-card ${w.days_out !== null && w.days_out > 0 && w.days_out < 90 ? "is-out" : ""}`} key={w.title}>
              <div className="gm-wl-head">
                <div className="gm-wl-title">{w.title}</div>
                <div className="gm-wl-hype">{w.hype}/10</div>
              </div>
              <div>
                {w.already_released ? (
                  <span className="gm-wl-days released">sorti</span>
                ) : w.days_out !== null && w.days_out > 0 ? (
                  <span className={`gm-wl-days ${w.days_out < 90 ? "out" : ""}`}>
                    dans {w.days_out}j
                  </span>
                ) : (
                  <span className="gm-wl-days">tbd</span>
                )}
              </div>
              <div className="gm-wl-release" style={{ marginTop: 8 }}>
                {w.platform} · <strong>{w.release}</strong>
                {w.price_target && <> · cible {w.price_target}€</>}
              </div>
              {w.note && <div className="gm-wl-note">{w.note}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="gm-veille-link">
            <div className="gm-veille-link-text">
              <strong>12 nouveautés</strong> détectées par la veille gaming depuis ta dernière visite —
              Clair Obscur a pris 94/100 sur OpenCritic, Silksong a une date.
            </div>
            <button className="gm-veille-link-btn" onClick={() => onNavigate && onNavigate("gaming_news")}>
              Veille gaming →
            </button>
          </div>
        </div>
      </section>

      {/* ══ §6 TOP ALL-TIME ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">06</span>
          <h2 className="gm-section-title">Top all-time · <em>par heures</em></h2>
          <span className="gm-section-meta">toutes plateformes · depuis 2012</span>
        </div>
        <div>
          <div className="gm-top-row is-head">
            <div>#</div>
            <div>jeu</div>
            <div>plateforme · depuis</div>
            <div style={{textAlign:"right"}}>heures</div>
            <div style={{textAlign:"right"}}>sessions</div>
            <div></div>
          </div>
          {D.top_alltime.map((g) => {
            const p = plat(g.platform);
            const maxH = D.top_alltime[0].hours;
            return (
              <div className="gm-top-row" key={g.rank}>
                <div className="gm-top-rank">{String(g.rank).padStart(2, "0")}</div>
                <div className="gm-top-title">{g.title}</div>
                <div>
                  <div className="gm-top-platform">
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 1, background: p ? p.accent : "#888", marginRight: 6, verticalAlign: "middle" }}></span>
                    {p ? p.platform : g.platform} · {g.since}
                  </div>
                  <div className="gm-top-bar"><div className="gm-top-bar-fill" style={{ width: `${(g.hours / maxH) * 100}%` }}></div></div>
                </div>
                <div>
                  <div className="gm-top-hours">{g.hours.toLocaleString("fr-FR")}<span className="gm-top-hours-unit">h</span></div>
                </div>
                <div className="gm-top-sessions">{g.sessions.toLocaleString("fr-FR")}</div>
                <div></div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ §7 ACHIEVEMENTS ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">07</span>
          <h2 className="gm-section-title">Achievements · <em>30 derniers jours</em></h2>
          <span className="gm-section-meta">{D.recent_achievements.length} débloqués</span>
        </div>
        <div className="gm-ach-list">
          {D.recent_achievements.map((a, i) => (
            <div className="gm-ach" key={i}>
              <div className={`gm-ach-ico ${a.type}`}>
                {a.type === "platinum" ? "PLT" :
                 a.type === "gold" ? "OR" :
                 a.type === "silver" ? "AG" :
                 a.type === "bronze" ? "BZ" :
                 a.type === "rank" ? "★" : "●"}
              </div>
              <div className="gm-ach-meta">
                <div className="gm-ach-label">{a.label}</div>
                <div className="gm-ach-game">{a.game} · {a.date}</div>
              </div>
              <div className="gm-ach-num">
                {a.rarity !== null && (
                  <>
                    <strong>{a.rarity.toFixed(1)}%</strong><br />
                    des joueurs
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §8 MILESTONES ══ */}
      <section className="gm-section">
        <div className="gm-section-head">
          <span className="gm-section-num">08</span>
          <h2 className="gm-section-title">2026 · <em>year to date</em></h2>
          <span className="gm-section-meta">depuis le 1er janvier</span>
        </div>
        <div className="gm-milestones">
          {D.milestones.map((m) => (
            <div className="gm-milestone" key={m.label}>
              <div className="gm-milestone-label">{m.label}</div>
              <div className="gm-milestone-value">{m.value}</div>
              <div className="gm-milestone-sub">{m.sub}</div>
              {m.progress !== undefined && (
                <div className="gm-milestone-bar">
                  <div className="gm-milestone-bar-fill" style={{ width: `${(m.progress * 100).toFixed(0)}%` }}></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

window.PanelGaming = PanelGaming;
