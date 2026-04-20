// ═══════════════════════════════════════════════════════════════
// PANEL MUSIQUE — Last.fm (depuis Apple Music)
// ─────────────────────────────────────────────
// Hero : now playing + 4 KPIs
// §1 Top artists (range toggle 7d/30d/6m/all)
// §2 Top tracks + albums
// §3 Série journalière + heatmap horaire
// §4 Genres + découvertes
// §5 Milestones 2026 YTD
// ═══════════════════════════════════════════════════════════════

const { useState: useMzState, useMemo: useMzMemo, useEffect: useMzEffect } = React;

// ── Live now-playing hook ─────────────────────────────────
// Polls Last.fm user.getRecentTracks every 30s and returns the
// freshest "now playing" info. If the user is actively listening,
// Last.fm flags the top track with @attr.nowplaying === "true" and
// omits its timestamp. Otherwise we fall back to the cached shape.
function useLiveNowPlaying(initial) {
  const [np, setNp] = useMzState(initial || null);
  useMzEffect(() => { setNp(initial || null); }, [initial]);

  useMzEffect(() => {
    const pf = (window.PROFILE_DATA && window.PROFILE_DATA._values) || {};
    const apiKey = pf.lastfm_api_key;
    const user = pf.lastfm_username;
    if (!apiKey || !user) return;

    let alive = true;

    async function poll() {
      try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${encodeURIComponent(apiKey)}&limit=1&format=json`;
        const r = await fetch(url);
        if (!r.ok) return;
        const data = await r.json();
        const tracks = data?.recenttracks?.track;
        const first = Array.isArray(tracks) ? tracks[0] : tracks;
        if (!first || !alive) return;
        const isLive = first["@attr"]?.nowplaying === "true";
        const imgArr = first.image || [];
        // Skip Last.fm's generic star placeholder — it's worse UX than
        // our tinted fallback. Same filter applies server-side in
        // pipelines/lastfm_sync.py::_best_image.
        const imgRaw = imgArr.reverse().find(i => i && i["#text"])?.["#text"] || null;
        const image_url = imgRaw && !imgRaw.includes("2a96cbd8b46e442fc41c2b86b821562f") ? imgRaw : null;
        const ts = first.date?.uts ? Number(first.date.uts) * 1000 : null;
        setNp(prev => {
          const merged = {
            ...(prev || {}),
            track: first.name || "—",
            artist: (first.artist?.["#text"]) || first.artist?.name || "—",
            album: first.album?.["#text"] || "",
            image_url: image_url || prev?.image_url || null,
            loved: first.loved === "1",
            is_live: isLive,
            started_at: isLive ? "en cours" : ts ? relTimeMs(ts) : (prev?.started_at || ""),
            ago: isLive ? "en cours" : ts ? relTimeMs(ts) : (prev?.ago || ""),
          };
          return merged;
        });
      } catch (e) {
        // Network / parsing error → keep current state.
      }
    }

    poll();
    const id = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return np;
}

function relTimeMs(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "il y a " + s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return "il y a " + m + "min";
  const h = Math.floor(m / 60);
  if (h < 48) return "il y a " + h + "h";
  const d = Math.floor(h / 24);
  return "il y a " + d + "j";
}

// ── Daily line chart ────────────────────────────────
function MzDailyChart({ series, range }) {
  const w = 1000, h = 240;
  const padL = 44, padR = 16, padT = 16, padB = 26;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const windowDays = { "30j": 30, "90j": 90, "180j": 180 }[range] || series.length;
  const data = series.slice(-windowDays);
  const vals = data.map((d) => d.scrobbles);
  const yMax = Math.max(...vals) * 1.1;
  const yMin = 0;

  const x = (i) => padL + (i / (data.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // line (7-day moving avg pour lisser)
  const avg = data.map((_, i) => {
    const start = Math.max(0, i - 3);
    const end = Math.min(data.length, i + 4);
    const slice = data.slice(start, end).map((d) => d.scrobbles);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const linePath = "M" + avg.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L");

  // bars
  const barW = Math.max(1, plotW / data.length - 1);

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => yMin + (i / (yTickCount - 1)) * (yMax - yMin));

  const tickCount = 6;
  const tIdx = Array.from({ length: tickCount }, (_, i) => Math.floor((i / (tickCount - 1)) * (data.length - 1)));
  const fmt = (s) => {
    const d = new Date(s);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <svg className="mz-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {yTicks.map((t, i) => (
        <g key={"y" + i}>
          <line className="mz-chart-grid" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} />
          <text className="mz-chart-label" x={padL - 8} y={y(t) + 3} textAnchor="end">{Math.round(t)}</text>
        </g>
      ))}
      <line className="mz-chart-axis" x1={padL} x2={w - padR} y1={h - padB} y2={h - padB} />
      {tIdx.map((t, i) => (
        <text key={"x" + i} className="mz-chart-label" x={x(t)} y={h - padB + 15} textAnchor="middle">
          {fmt(data[t].date)}
        </text>
      ))}
      {data.map((d, i) => (
        <rect
          key={i}
          x={x(i) - barW / 2}
          y={y(d.scrobbles)}
          width={barW}
          height={Math.max(0, (h - padB) - y(d.scrobbles))}
          fill="var(--accent)"
          opacity="0.22"
        />
      ))}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Heatmap ─────────────────────────────────────────
function MzHeatmap({ grid }) {
  const DOW = ["L", "M", "M", "J", "V", "S", "D"];
  // grid est [dow 0-6 avec dow=0 dimanche]. On réordonne lundi first.
  const reordered = [1, 2, 3, 4, 5, 6, 0].map((i) => grid[i]);
  const max = Math.max(...grid.flat());
  const color = (v) => {
    if (v < 0.5) return "var(--bd)";
    const t = v / max;
    // teinte brand (orange/brun) en 5 paliers
    const alpha = 0.15 + t * 0.85;
    return `rgba(168, 74, 34, ${alpha.toFixed(2)})`;
  };
  return (
    <div>
      <div className="mz-heatmap-grid">
        {reordered.map((row, r) => (
          <React.Fragment key={r}>
            <div className="mz-heatmap-row-label">{DOW[r]}</div>
            {row.map((v, h) => (
              <div key={h} className="mz-heatmap-cell" style={{ background: color(v) }} title={`${DOW[r]} ${h}h — ${v.toFixed(1)}`} />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="mz-heatmap-hours">
        <span></span>
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 3 === 0 ? h : ""}</span>
        ))}
      </div>
    </div>
  );
}

// ── Panel principal ─────────────────────────────────
function PanelMusique() {
  const D = window.MUSIC_DATA;
  const [artistRange, setArtistRange] = useMzState("30d");
  const [chartRange, setChartRange] = useMzState("90j");

  const artists = D.top_artists[artistRange];
  // Live polling — falls back to the cached D.now_playing until the
  // first Last.fm response lands. Flagged `is_live` only when Last.fm
  // says the user is actively listening right now.
  const np = useLiveNowPlaying(D.now_playing) || D.now_playing || {};

  // initiales pour art placeholder
  const initials = (name) =>
    name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="mz-wrap" data-screen-label="Musique">
      {/* ══ HERO ══ */}
      <header className="mz-hero">
        <div>
          <div className="mz-hero-eyebrow">
            {np.is_live && <span className="mz-live">live</span>}
            <span>last.fm · {D.totals.all180.toLocaleString("fr-FR")} scrobbles 180j</span>
          </div>
          <h1 className="mz-hero-title">
            <em>{D.totals.last30.toLocaleString("fr-FR")}</em> scrobbles<br />
            sur 30 jours{(D.genres_30d && D.genres_30d[0]) ? <> — dominé par le <em>{D.genres_30d[0].name}</em>.</> : "."}
          </h1>
          <p className="mz-hero-sub">
            {(D.top_artists && D.top_artists["30d"] && D.top_artists["30d"][0])
              ? <><strong>{D.top_artists["30d"][0].name}</strong> #1 sur 30 jours · </>
              : null}
            Streak quotidien : {D.streaks.current_daily} jours sans interruption{D.streaks.longest_daily ? <> · record {D.streaks.longest_daily}j</> : ""}.
          </p>
        </div>

        <div className="mz-hero-np">
          <div className="mz-hero-np-art" style={{ background: np.album_art_hint || "var(--tx)" }}>
            {np.image_url
              ? <img src={np.image_url} alt={np.album || np.track || ""} onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : <span>{np.album || "—"}</span>}
          </div>
          <div className="mz-hero-np-meta">
            <div className="mz-hero-np-label">
              {np.is_live ? "now playing" : "dernière écoute"}
              {np.started_at || np.ago ? " · " + (np.started_at || np.ago) : ""}
            </div>
            <div className="mz-hero-np-track">{np.track || "—"}</div>
            <div className="mz-hero-np-artist">
              <strong>{np.artist || "—"}</strong>{np.album ? <> · {np.album}</> : null}
            </div>
            <div className="mz-hero-np-stats">
              {np.scrobble_count_track ? <span><strong>{np.scrobble_count_track}</strong> plays · ce titre</span> : null}
              {np.scrobble_count_artist ? <span><strong>{np.scrobble_count_artist}</strong> · cet artiste</span> : null}
              {np.loved && <span className="mz-loved">♥ loved</span>}
            </div>
          </div>
        </div>
      </header>

      {/* ══ KPIs ══ */}
      <div className="mz-kpis">
        <div className="mz-kpi">
          <div className="mz-kpi-label">scrobbles · 7j</div>
          <div className="mz-kpi-value">{D.totals.last7.toLocaleString("fr-FR")}</div>
          <div className="mz-kpi-sub"><span className="up">▲ +8%</span> vs 7j préc.</div>
        </div>
        <div className="mz-kpi">
          <div className="mz-kpi-label">scrobbles · 30j</div>
          <div className="mz-kpi-value">{D.totals.last30.toLocaleString("fr-FR")}</div>
          <div className="mz-kpi-sub">~{Math.round(D.totals.last30 / 30)} / jour</div>
        </div>
        <div className="mz-kpi">
          <div className="mz-kpi-label">streak quotidien</div>
          <div className="mz-kpi-value">{D.streaks.current_daily}<span className="mz-kpi-unit">j</span></div>
          <div className="mz-kpi-sub">record · {D.streaks.longest_daily}j</div>
        </div>
        <div className="mz-kpi">
          <div className="mz-kpi-label">aujourd'hui</div>
          <div className="mz-kpi-value">{D.totals.hours_today}<span className="mz-kpi-unit">h</span></div>
          <div className="mz-kpi-sub">{D.totals.hours_week}h cette semaine</div>
        </div>
      </div>

      {/* ══ §1 TOP ARTISTS ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">01</span>
          <h2 className="mz-section-title">Top artists · <em>{
            { "7d": "7 derniers jours", "30d": "30 jours", "6m": "6 mois", "all": "all-time" }[artistRange]
          }</em></h2>
          <div className="mz-range" style={{ marginLeft: "auto" }}>
            {["7d", "30d", "6m", "all"].map((r) => (
              <button
                key={r}
                className={`mz-range-btn ${artistRange === r ? "is-active" : ""}`}
                onClick={() => setArtistRange(r)}
              >
                {{ "7d": "7j", "30d": "30j", "6m": "6m", "all": "all" }[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="mz-top">
          <div className="mz-top-col">
            {artists.slice(0, 5).map((a) => (
              <div className="mz-artist-row" key={a.rank}>
                <div className="mz-artist-rank">{String(a.rank).padStart(2, "0")}</div>
                <div className="mz-artist-art" style={{ background: a.color }}>{initials(a.name)}</div>
                <div className="mz-artist-meta">
                  <div className="mz-artist-name">
                    {a.name}
                    {a.new && <span className="mz-artist-new">new</span>}
                  </div>
                  <div className="mz-artist-genre">
                    {a.genre}{a.since ? ` · depuis ${a.since}` : ""}
                  </div>
                </div>
                <div className="mz-artist-num">
                  <div className="mz-artist-plays">{a.scrobbles.toLocaleString("fr-FR")}</div>
                  <div className="mz-artist-plays-lbl">plays</div>
                  {a.change !== undefined && (
                    <div className={`mz-artist-change ${a.change > 0 ? "up" : a.change < 0 ? "down" : "flat"}`}>
                      {a.change > 0 ? `▲ +${a.change}` : a.change < 0 ? `▼ ${a.change}` : "— 0"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mz-top-col">
            {artists.slice(5, 10).map((a) => (
              <div className="mz-artist-row" key={a.rank}>
                <div className="mz-artist-rank">{String(a.rank).padStart(2, "0")}</div>
                <div className="mz-artist-art" style={{ background: a.color }}>{initials(a.name)}</div>
                <div className="mz-artist-meta">
                  <div className="mz-artist-name">
                    {a.name}
                    {a.new && <span className="mz-artist-new">new</span>}
                  </div>
                  <div className="mz-artist-genre">
                    {a.genre}{a.since ? ` · depuis ${a.since}` : ""}
                  </div>
                </div>
                <div className="mz-artist-num">
                  <div className="mz-artist-plays">{a.scrobbles.toLocaleString("fr-FR")}</div>
                  <div className="mz-artist-plays-lbl">plays</div>
                  {a.change !== undefined && (
                    <div className={`mz-artist-change ${a.change > 0 ? "up" : a.change < 0 ? "down" : "flat"}`}>
                      {a.change > 0 ? `▲ +${a.change}` : a.change < 0 ? `▼ ${a.change}` : "— 0"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ §2 TOP TRACKS + ALBUMS ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">02</span>
          <h2 className="mz-section-title">Top tracks · <em>30 jours</em></h2>
          <span className="mz-section-meta">{D.top_tracks.length} titres · triés par plays</span>
        </div>
        <div>
          <div className="mz-tracks mz-tracks-head">
            <div>#</div>
            <div>titre</div>
            <div>album</div>
            <div style={{textAlign:"right"}}>plays</div>
            <div style={{textAlign:"right"}}>durée</div>
          </div>
          {D.top_tracks.map((t, i) => (
            <div className="mz-tracks" key={`${t.rank || i}-${t.title}`}>
              <div className="mz-track-rank">{String(t.rank || i + 1).padStart(2, "0")}</div>
              <div>
                <div className="mz-track-title">{t.title}</div>
                <div className="mz-track-title-sub">{t.artist}</div>
              </div>
              <div className="mz-track-artist">{t.album}</div>
              <div className="mz-track-plays">{t.plays}</div>
              <div className="mz-track-dur">{t.duration || ""}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §3 ALBUMS ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">03</span>
          <h2 className="mz-section-title">Top albums · <em>30 jours</em></h2>
          <span className="mz-section-meta">écoutes full-album, pas juste singles</span>
        </div>
        <div className="mz-albums">
          {D.top_albums.map((a, i) => (
            <div className="mz-album" key={`${a.rank || i}-${a.title}`}>
              <div className="mz-album-art" style={{ background: a.bg || "#2a2a2a" }}>
                {a.image_url && (
                  <img
                    className="mz-album-img"
                    src={a.image_url}
                    alt={a.title || ""}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <div className="mz-album-rank">{String(a.rank || i + 1).padStart(2, "0")}</div>
                <div className="mz-album-plays"><strong>{a.plays}</strong><br />plays</div>
              </div>
              <div>
                <div className="mz-album-title">{a.title}</div>
                <div className="mz-album-artist">{a.artist}{a.year ? ` · ${a.year}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §4 SÉRIE + HEATMAP ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">04</span>
          <h2 className="mz-section-title">Rythme d'écoute · <em>tendance longue</em></h2>
          <span className="mz-section-meta">scrobbles par jour · moyenne mobile 7j</span>
        </div>
        <div className="mz-chart-wrap" style={{ marginBottom: 20 }}>
          <div className="mz-chart-head">
            <div className="mz-chart-legend">
              <span><span className="mz-chart-legend-dot" style={{ background: "var(--accent)" }}></span>scrobbles / jour</span>
              <span><span className="mz-chart-legend-dot" style={{ background: "var(--accent)", opacity: 0.3 }}></span>moyenne mobile 7j</span>
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
          <MzDailyChart series={D.daily_series} range={chartRange} />
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
          <MzHeatmap grid={D.heatmap} />
        </div>
      </section>

      {/* ══ §5 GENRES ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">05</span>
          <h2 className="mz-section-title">Genres · <em>répartition 30j</em></h2>
          <span className="mz-section-meta">somme = 100% du temps d'écoute</span>
        </div>
        <div className="mz-genre-bar">
          {D.genres_30d.map((g) => (
            <div
              key={g.label}
              className="mz-genre-bar-seg"
              style={{ flex: g.share, background: g.color }}
              title={`${g.label} · ${(g.share * 100).toFixed(0)}%`}
            >
              {g.share > 0.08 ? `${(g.share * 100).toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
        <div className="mz-genres">
          <div>
            <div className="mz-genre-table">
              {D.genres_30d.map((g) => (
                <div className="mz-genre-row" key={g.label}>
                  <div className="mz-genre-dot" style={{ background: g.color }}></div>
                  <div className="mz-genre-label">{g.label}</div>
                  <div className="mz-genre-share">{(g.share * 100).toFixed(0)}%</div>
                  <div className={`mz-genre-change ${g.change > 0 ? "up" : g.change < 0 ? "down" : "flat"}`}>
                    {g.change > 0 ? `▲ +${g.change}` : g.change < 0 ? `▼ ${g.change}` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mz-top-col-head">
              <div className="mz-top-col-title">lecture</div>
            </div>
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: 14.5,
              fontStyle: "italic",
              color: "var(--tx2)",
              lineHeight: 1.55,
              textWrap: "pretty"
            }}>
              Le prog metal tient 31% — stable mais en légère hausse. L'avant-garde
              grimpe de 4 points grâce à Igorrr (découverte du mois). Les OST anime
              restent la bulle parallèle qui sort à chaque creux — backgrounds deep work
              et soirs de lecture. La part J-pop reste anecdotique : tu tries très dur.
            </p>
          </div>
        </div>
      </section>

      {/* ══ §6 DÉCOUVERTES ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">06</span>
          <h2 className="mz-section-title">Découvertes · <em>30 derniers jours</em></h2>
          <span className="mz-section-meta">{D.discoveries.length} nouveaux artistes · {D.discoveries.filter(d => d.verdict === "accroché").length} accrochés</span>
        </div>
        <div className="mz-disc-list">
          {D.discoveries.map((d) => (
            <div className="mz-disc" key={d.artist}>
              <div className="mz-disc-head">
                <div className="mz-disc-name">{d.artist}</div>
                <div className={`mz-disc-verdict ${
                  d.verdict === "accroché" ? "accroche" :
                  d.verdict === "à creuser" ? "creuser" : "abandon"
                }`}>{d.verdict}</div>
              </div>
              <div className="mz-disc-meta">
                <span><strong>{d.scrobbles}</strong> plays</span>
                <span>{d.first_scrobble}</span>
                <span>{d.genre}</span>
              </div>
              <div className="mz-disc-note">{d.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ §7 MILESTONES ══ */}
      <section className="mz-section">
        <div className="mz-section-head">
          <span className="mz-section-num">07</span>
          <h2 className="mz-section-title">2026 · <em>year to date</em></h2>
          <span className="mz-section-meta">depuis le 1er janvier</span>
        </div>
        <div className="mz-milestones">
          {D.milestones.map((m) => (
            <div className="mz-milestone" key={m.label}>
              <div className="mz-milestone-label">{m.label}</div>
              <div className="mz-milestone-value">{m.value}</div>
              <div className="mz-milestone-sub">{m.sub}</div>
              {m.progress !== undefined && (
                <div className="mz-milestone-bar">
                  <div className="mz-milestone-bar-fill" style={{ width: `${(m.progress * 100).toFixed(0)}%` }}></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

window.PanelMusique = PanelMusique;
