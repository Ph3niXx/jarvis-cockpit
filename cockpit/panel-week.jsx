// Panel : Ma semaine — toggle factuel / éditorial
const { useState: useStateWeek } = React;

const DAYS_FULL = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function StatBig({ label, value, unit, delta, accent }) {
  return (
    <div className={`week-stat ${accent ? "week-stat--accent" : ""}`}>
      <div className="week-stat-label">{label}</div>
      <div className="week-stat-value-row">
        <span className="week-stat-value">{value}</span>
        {unit && <span className="week-stat-unit">{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div className={`week-stat-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} vs sem. dern.
        </div>
      )}
    </div>
  );
}

function ReadingChart({ days }) {
  const max = Math.max(...days.map(d => d.read));
  return (
    <div className="week-chart">
      <div className="week-chart-grid">
        {[max, Math.round(max/2), 0].map((v, i) => (
          <div key={i} className="week-chart-gridline"><span>{v}</span></div>
        ))}
      </div>
      <div className="week-chart-bars">
        {days.map((d, i) => (
          <div key={d.day} className="week-chart-col">
            <div className="week-chart-bar-wrap">
              <div className="week-chart-bar" style={{ height: `${(d.read / max) * 100}%` }}>
                <span className="week-chart-bar-val">{d.read}</span>
              </div>
            </div>
            <span className="week-chart-day">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayStrip({ days }) {
  const maxes = {
    read: Math.max(...days.map(d => d.read)),
    music: Math.max(...days.map(d => d.music_min)),
    gaming: Math.max(...days.map(d => d.gaming_min)),
  };
  const FULL_DAYS = { Lun: "Lundi", Mar: "Mardi", Mer: "Mercredi", Jeu: "Jeudi", Ven: "Vendredi", Sam: "Samedi", Dim: "Dimanche" };

  const todayIdx = 1; // Mardi

  return (
    <div className="day-strip">
      {days.map((d, i) => {
        const isToday = i === todayIdx;
        const isPast = i < todayIdx;
        return (
          <div key={d.day} className={`day-card ${isToday ? "is-today" : ""} ${isPast ? "is-past" : "is-future"}`}>
            <div className="day-card-head">
              <span className="day-card-day">{FULL_DAYS[d.day]}</span>
              <span className="day-card-num">{14 + i}</span>
            </div>

            <div className="day-card-rows">
              <div className="day-card-row">
                <span className="day-card-row-label">Veille</span>
                <span className="day-card-row-val">{d.read > 0 ? `${d.read} art.` : "—"}</span>
                <span className="day-card-row-bar"><span className="day-card-row-fill" data-color="brand" style={{ width: `${(d.read / maxes.read) * 100}%` }} /></span>
              </div>
              <div className="day-card-row">
                <span className="day-card-row-label">Sport</span>
                <span className="day-card-row-val">{d.workout ? "✓" : "—"}</span>
                <span className="day-card-row-bar"><span className="day-card-row-fill" data-color="positive" style={{ width: d.workout ? "100%" : "0%" }} /></span>
              </div>
              <div className="day-card-row">
                <span className="day-card-row-label">Musique</span>
                <span className="day-card-row-val">{d.music_min > 0 ? `${d.music_min}′` : "—"}</span>
                <span className="day-card-row-bar"><span className="day-card-row-fill" data-color="neutral" style={{ width: `${(d.music_min / maxes.music) * 100}%` }} /></span>
              </div>
              <div className="day-card-row">
                <span className="day-card-row-label">Gaming</span>
                <span className="day-card-row-val">{d.gaming_min > 0 ? `${d.gaming_min}′` : "—"}</span>
                <span className="day-card-row-bar"><span className="day-card-row-fill" data-color="warn" style={{ width: `${(d.gaming_min / maxes.gaming) * 100}%` }} /></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThemeCloud({ themes }) {
  return (
    <div className="theme-cloud">
      {themes.map(t => (
        <div key={t.label} className={`theme-chip theme-chip--${t.color}`}>
          <span className="theme-chip-label">{t.label}</span>
          <span className="theme-chip-weight">{t.weight}%</span>
          <span className="theme-chip-bar" style={{ width: `${t.weight}%` }} />
        </div>
      ))}
    </div>
  );
}

function PanelWeek({ data, onNavigate }) {
  const [mode, setMode] = useStateWeek("factuel");
  const w = data.week;

  const cmp = w.compare_last;

  return (
    <div className="panel-page">
      <div className="panel-hero">
        <div className="panel-hero-eyebrow">Ma semaine · S17 · Lun 14 → Dim 20 avril</div>
        <h1 className="panel-hero-title">Ce que tu as lu, appris, vécu cette semaine</h1>
        <p className="panel-hero-sub">
          Vue d'ensemble — veille IA, sport, musique, gaming, notes. Deux modes de lecture : factuel (dashboard) ou éditorial (raconté).
        </p>
      </div>

      <div className="panel-toolbar">
        <span className="panel-toolbar-label">Mode</span>
        <div className="panel-toolbar-group">
          <button className={`pill ${mode === "factuel" ? "is-active" : ""}`} onClick={() => setMode("factuel")}>Factuel</button>
          <button className={`pill ${mode === "edito" ? "is-active" : ""}`} onClick={() => setMode("edito")}>Éditorial</button>
        </div>
        <div className="panel-toolbar-divider" />
        <span className="panel-toolbar-label">Semaine</span>
        <div className="panel-toolbar-group">
          <button className="pill is-active">S17 (en cours)</button>
          <button className="pill">S16</button>
          <button className="pill">S15</button>
          <button className="pill">4 sem.</button>
        </div>
      </div>

      {mode === "factuel" ? (
        <div className="week-wrap">
          {/* Top stats row */}
          <div className="week-stats-row">
            <StatBig label="Articles lus" value={w.total_read} delta={cmp.read.this - cmp.read.last} accent />
            <StatBig label="Temps de lecture" value={Math.floor(w.reading_time_min / 60)} unit={`h${w.reading_time_min % 60}`} />
            <StatBig label="Streak veille" value={w.streak} unit="jours" />
            <StatBig label="Signaux détectés" value={cmp.signals_spotted.this} delta={cmp.signals_spotted.this - cmp.signals_spotted.last} />
            <StatBig label="Séances sport" value={w.personal.workouts.done} unit={`/ ${w.personal.workouts.target}`} delta={cmp.workouts.this - cmp.workouts.last} />
            <StatBig label="Notes prises" value={w.personal.notes_count} delta={cmp.notes.this - cmp.notes.last} />
          </div>

          {/* AI summary */}
          <section className="week-section">
            <div className="week-section-head">
              <div>
                <div className="section-kicker"><Icon name="sparkles" size={11} stroke={1.75} /> Synthèse auto · Jarvis</div>
                <h2 className="section-title">Ta semaine en 3 points</h2>
              </div>
              <span className="week-updated">mis à jour il y a 2h</span>
            </div>
            <div className="week-summary">
              {w.ai_summary.map((p, i) => (
                <div key={i} className="week-summary-card">
                  <span className="week-summary-num">0{i+1}</span>
                  <div className="week-summary-kicker">{p.kicker}</div>
                  <p className="week-summary-text">{p.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Activity matrix + reading chart */}
          <section className="week-section">
            <div className="week-section-head">
              <div>
                <div className="section-kicker">Activité quotidienne</div>
                <h2 className="section-title">Ta semaine, jour par jour</h2>
              </div>
            </div>
            <DayStrip days={w.days} />
          </section>

          <div className="week-split">
            <section className="week-section">
              <div className="week-section-head">
                <div>
                  <div className="section-kicker">Lectures · 7 jours</div>
                  <h2 className="section-title">Rythme de veille</h2>
                </div>
                <span className="week-updated">{w.total_read} articles · {Math.floor(w.reading_time_min/60)}h{w.reading_time_min%60}</span>
              </div>
              <ReadingChart days={w.days} />
            </section>

            <section className="week-section">
              <div className="week-section-head">
                <div>
                  <div className="section-kicker">Thèmes dominants</div>
                  <h2 className="section-title">De quoi ta semaine a parlé</h2>
                </div>
              </div>
              <ThemeCloud themes={w.themes} />
            </section>
          </div>

          {/* Top articles + challenges */}
          <div className="week-split">
            <section className="week-section">
              <div className="week-section-head">
                <div>
                  <div className="section-kicker">Top lectures</div>
                  <h2 className="section-title">Les 4 articles que tu as le plus creusés</h2>
                </div>
              </div>
              <div className="week-top-list">
                {w.top_read.map((a, i) => (
                  <div key={i} className="week-top-item">
                    <span className="week-top-day">{a.day}</span>
                    <div className="week-top-body">
                      <div className="week-top-title">{a.title}</div>
                      <div className="week-top-meta">{a.source} · {a.time_min} min de lecture</div>
                    </div>
                    <span className="week-top-time">{a.time_min}′</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="week-section">
              <div className="week-section-head">
                <div>
                  <div className="section-kicker">Challenges</div>
                  <h2 className="section-title">Progression</h2>
                </div>
                <button className="link-more" onClick={() => onNavigate("challenges")}>Voir tous <Icon name="arrow_right" size={12} stroke={2} /></button>
              </div>
              <div className="week-chal-list">
                {data.challenges.map((c, i) => (
                  <div key={i} className={`week-chal-item week-chal-item--${c.status}`}>
                    <div className="week-chal-head">
                      <span className={`week-chal-status week-chal-status--${c.status}`}>
                        {c.status === "in-progress" ? "EN COURS" : "À DÉMARRER"}
                      </span>
                      <span className="week-chal-xp">+{c.xp} XP</span>
                    </div>
                    <div className="week-chal-title">{c.title}</div>
                    <div className="week-chal-meta">{c.duration}</div>
                    {c.progress !== undefined && (
                      <div className="week-chal-bar">
                        <span className="week-chal-bar-fill" style={{ width: `${c.progress}%` }} />
                        <span className="week-chal-bar-val">{c.progress}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Perso block */}
          <section className="week-section">
            <div className="week-section-head">
              <div>
                <div className="section-kicker">Côté perso</div>
                <h2 className="section-title">Hors veille</h2>
              </div>
            </div>
            <div className="week-perso-grid">
              <div className="week-perso-card">
                <div className="week-perso-icon"><Icon name="activity" size={18} stroke={1.75} /></div>
                <div className="week-perso-big">{w.personal.workouts.done}<span className="week-perso-big-unit">/ {w.personal.workouts.target}</span></div>
                <div className="week-perso-label">Séances sport</div>
                <div className="week-perso-note">Au-dessus de l'objectif (2 min.)</div>
              </div>
              <div className="week-perso-card">
                <div className="week-perso-icon"><Icon name="music" size={18} stroke={1.75} /></div>
                <div className="week-perso-big">{Math.floor(w.personal.music.total_min/60)}<span className="week-perso-big-unit">h{w.personal.music.total_min%60}</span></div>
                <div className="week-perso-label">Musique écoutée</div>
                <div className="week-perso-note">Top : {w.personal.music.top_artist} · {w.personal.music.sessions} sessions</div>
              </div>
              <div className="week-perso-card">
                <div className="week-perso-icon"><Icon name="gamepad" size={18} stroke={1.75} /></div>
                <div className="week-perso-big">{Math.floor(w.personal.gaming.total_min/60)}<span className="week-perso-big-unit">h{w.personal.gaming.total_min%60}</span></div>
                <div className="week-perso-label">Temps gaming</div>
                <div className="week-perso-note">Top : {w.personal.gaming.top_game}</div>
              </div>
              <div className="week-perso-card">
                <div className="week-perso-icon"><Icon name="clock" size={18} stroke={1.75} /></div>
                <div className="week-perso-big">{w.personal.sleep_avg_h}<span className="week-perso-big-unit">h</span></div>
                <div className="week-perso-label">Sommeil moyen</div>
                <div className="week-perso-note">Stable vs semaine dernière</div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="week-wrap week-wrap--edito">
          <article className="week-edito">
            <div className="week-edito-date">Semaine 17 · 14 → 20 avril 2026</div>
            <h2 className="week-edito-title">La semaine où les agents sont passés en production</h2>
            <p className="week-edito-lede">
              Soixante articles lus, quatorze jours d'affilée à tenir ton rythme de veille, et un fil rouge qui s'impose : les agents. Quarante pour cent de tes lectures tournent autour du sujet, ton radar prend douze points sur cet axe, et le papier Claude Agents GA est celui que tu as gardé ouvert le plus longtemps.
            </p>
            <div className="week-edito-pullquote">
              « Ton streak veille atteint 14 jours, ton meilleur depuis janvier. »
            </div>
            <p className="week-edito-body">
              Côté perso, trois séances de sport — au-dessus de ton objectif. Beaucoup de musique le samedi (Tame Impala en tête), et un weekend gaming assez marqué sur Elden Ring Nightreign : +85% de temps vs ta moyenne. À surveiller ce weekend, d'autant que tu as un challenge LoRA qui attend.
            </p>
            <h3 className="week-edito-h3">Les temps forts</h3>
            <ul className="week-edito-list">
              {w.top_read.map((a, i) => (
                <li key={i}>
                  <span className="week-edito-list-day">{a.day}</span>
                  <span className="week-edito-list-title">{a.title}</span>
                  <span className="week-edito-list-src">— {a.source}</span>
                </li>
              ))}
            </ul>
            <h3 className="week-edito-h3">Chiffres de la semaine</h3>
            <div className="week-edito-nums">
              <div><strong>60</strong><span>articles lus</span></div>
              <div><strong>3h07</strong><span>de lecture</span></div>
              <div><strong>14</strong><span>jours streak</span></div>
              <div><strong>6</strong><span>signaux détectés</span></div>
              <div><strong>3/4</strong><span>séances sport</span></div>
              <div><strong>7h12</strong><span>sommeil moyen</span></div>
            </div>
            <p className="week-edito-body">
              Le plus gros point d'attention reste le fine-tuning — ton axe radar toujours bloqué à 38. Le challenge LoRA est là pour ça, et tu as un créneau possible dimanche soir après ta session gaming.
            </p>
          </article>
        </div>
      )}
    </div>
  );
}

window.PanelWeek = PanelWeek;
