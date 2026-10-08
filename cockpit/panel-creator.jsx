// ═══════════════════════════════════════════════════════════════
// PANEL ONCE UPON A NERD — l'adoption des posts de la chaîne, réseau par
// réseau : vues, interactions, abonnés, démarrage de chaque épisode.
//
// Données : window.CREATOR_DATA (lignes des tables creator_*), rempli par
// loadPanel("creator") et alimenté par pipelines/creator_sync.py (Buffer).
// Toute la logique (assemblage, vues par jour, courbes, alertes, formats)
// vit dans cockpit/lib/creator-view.js, testée sous node. Ici, du JSX.
// ═══════════════════════════════════════════════════════════════

const { useState: useCrState, useEffect: useCrEffect, useRef: useCrRef } = React;

const CR_NET_KEY = "cockpit-creator-net";

function crReadNet() {
  try {
    const v = localStorage.getItem(CR_NET_KEY);
    return v === "all" || (v && window.creatorView.NET[v]) ? v : "all";
  } catch (e) { return "all"; }
}

// Largeur réelle du conteneur : les graphiques sont dessinés à l'échelle du
// pixel, pas étirés, pour que textes et barres gardent leur taille.
function useCrWidth(ref) {
  const [width, setWidth] = useCrState(0);
  useCrEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.round(el.clientWidth));
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      setWidth(prev => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return width;
}

function crRoundTop(x, y, w, h, r) {
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
const crTick = v => (v >= 10000 ? window.creatorView.cf.format(v) : window.creatorView.nf.format(v));

function CrEmpty({ text }) {
  return <div className="cr-empty"><p>{text}</p></div>;
}

function CrTip({ x, y, width, title, rows, total }) {
  const V = window.creatorView;
  const left = x + 14 + 220 > width ? Math.max(0, x - 14 - 220) : x + 14;
  return (
    <div className="cr-tip" style={{ left, top: y }} role="status">
      <div className="cr-tip-t">{title}</div>
      {rows.map(r => (
        <div className="cr-tip-r" key={r.label}>
          <i className={`cr-key ${r.key}`} />
          <b>{V.nf.format(Math.round(r.value))}</b>
          <span>{r.label}</span>
        </div>
      ))}
      {total != null && (
        <div className="cr-tip-r cr-tip-total"><b>{V.nf.format(Math.round(total))}</b><span>au total</span></div>
      )}
    </div>
  );
}

function CrDataTable({ head, rows }) {
  return (
    <div className="cr-scroll">
      <table className="cr-table cr-data-table">
        <thead><tr>{head.map((t, i) => <th key={t} scope="col" className={i ? "num" : ""}>{t}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r[0]}>
              {r.map((t, i) => (i ? <td key={i} className="num">{t}</td> : <th key={i} scope="row">{t}</th>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Vues gagnées par jour, empilées par réseau ─────────────────
function CrDaily({ data, nets }) {
  const V = window.creatorView;
  const ref = useCrRef(null);
  const W = useCrWidth(ref);
  const [hi, setHi] = useCrState(null);
  let body = null, tip = null;

  if (!data.length) body = <CrEmpty text="Les vues apparaîtront après la première mise en ligne." />;
  else if (data.every(d => d.total === 0)) body = <CrEmpty text="Pas encore de vues relevées. Buffer relit les réseaux une fois par jour." />;
  else if (W > 0) {
    const H = 230, M = { t: 20, r: 10, b: 28, l: 44 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const sc = V.niceScale(Math.max(...data.map(d => d.total)));
    const y = v => M.t + ph - (v / sc.max) * ph;
    const band = pw / data.length, bw = Math.max(3, Math.min(24, band * 0.62));
    const every = Math.max(1, Math.ceil(54 / band));
    const ticks = [];
    for (let v = 0; v <= sc.max + 1e-9; v += sc.step) ticks.push(v);
    const lastDay = data[data.length - 1];
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
           aria-label="Vues gagnées par jour et par réseau. Le tableau donne chaque valeur.">
        {ticks.map(v => (
          <g key={v}>
            <line className={v === 0 ? "cr-axis" : "cr-grid"} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
            <text className="cr-tick" x={M.l - 8} y={y(v) + 4} textAnchor="end">{crTick(v)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = M.l + band * (i + 0.5), x0 = cx - bw / 2;
          const segs = nets.filter(n => d.vals[n.id] > 0);
          let acc = 0;
          const shapes = segs.map((n, k) => {
            const v = d.vals[n.id], top = y(acc + v), bottom = y(acc), h = bottom - top - (k > 0 ? 2 : 0);
            acc += v;
            if (h <= 0.5) return null;
            return k === segs.length - 1
              ? <path key={n.id} className={`cr-mk-${n.cls}`} d={crRoundTop(x0, top, bw, h, Math.min(4, h, bw / 2))} />
              : <rect key={n.id} className={`cr-mk-${n.cls}`} x={x0} y={top} width={bw} height={h} />;
          });
          return (
            <g key={d.day}>
              {shapes}
              {(data.length - 1 - i) % every === 0 && (
                <text className="cr-tick" x={cx} y={H - 8} textAnchor="middle">{V.dShort.format(d.day)}</text>
              )}
            </g>
          );
        })}
        {lastDay.total > 0 && (
          <text className="cr-tick cr-lbl" x={M.l + band * (data.length - 0.5)} y={y(lastDay.total) - 7}
                textAnchor="middle">+{V.big(lastDay.total)}</text>
        )}
        {data.map((d, i) => (
          <rect key={`hit-${d.day}`} className={`cr-hit${hi === i ? " is-on" : ""}`} x={M.l + band * i} y={M.t}
                width={band} height={ph} tabIndex={0}
                aria-label={`${V.dLong.format(d.day)} : ${V.plural(Math.round(d.total), "vue", "vues")}`}
                onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
                onFocus={() => setHi(i)} onBlur={() => setHi(null)} />
        ))}
      </svg>
    );
    if (hi != null && data[hi]) {
      const d = data[hi];
      tip = <CrTip x={M.l + band * (hi + 0.5)} y={M.t} width={W} title={V.dLong.format(d.day)}
                   rows={nets.map(n => ({ key: `cr-k-${n.cls}`, label: n.label, value: d.vals[n.id] }))}
                   total={nets.length > 1 ? d.total : null} />;
    }
  }
  return <div className="cr-chart" ref={ref}>{body}{tip}</div>;
}

// ── Démarrage : vues cumulées depuis la mise en ligne ──────────
function CrLaunch({ curves }) {
  const V = window.creatorView;
  const ref = useCrRef(null);
  const W = useCrWidth(ref);
  const [cursor, setCursor] = useCrState(null);       // { j, py }
  let body = null, tip = null;

  if (!curves.length) body = <CrEmpty text="Les courbes apparaissent avec les premiers relevés Buffer après la mise en ligne." />;
  else if (W > 0) {
    const H = 230, M = { t: 20, r: 54, b: 28, l: 44 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const xMax = Math.min(30, Math.max(1, Math.ceil(Math.max(...curves.map(c => c.maxAge)))));
    const sc = V.niceScale(Math.max(...curves.flatMap(c => c.pts.map(p => p[1]))));
    const x = j => M.l + (Math.min(j, xMax) / xMax) * pw, y = v => M.t + ph - (v / sc.max) * ph;
    const ticks = [];
    for (let v = 0; v <= sc.max + 1e-9; v += sc.step) ticks.push(v);
    const stepJ = [1, 2, 5, 7, 10, 14].find(k => (pw / xMax) * k >= 44) || 30;
    const jTicks = [];
    for (let j = 0; j <= xMax; j += stepJ) jTicks.push(j);
    const hl = curves.reduce((a, c) => (c.pub > a.pub ? c : a));
    const path = c => c.pts.filter(p => p[0] <= xMax).map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    const end = hl.pts.filter(p => p[0] <= xMax).pop();
    const snap = xMax > 4 ? 1 : 0.25;
    let near = null, vals = [];
    if (cursor) {
      vals = curves.map(c => ({ c, v: V.valueAt(c, cursor.j) })).filter(o => o.v != null).sort((a, b) => b.v - a.v);
      if (cursor.py != null && vals.length) {
        near = vals.reduce((a, o) => (Math.abs(y(o.v) - cursor.py) < Math.abs(y(a.v) - cursor.py) ? o : a)).c;
      }
    }
    const move = (j, py) => setCursor({ j: Math.max(0, Math.min(xMax, Math.round(j / snap) * snap)), py });
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
           aria-label="Vues cumulées de chaque épisode depuis sa mise en ligne. Le tableau donne les valeurs à J+1, J+3, J+7, J+14 et J+30.">
        {ticks.map(v => (
          <g key={v}>
            <line className={v === 0 ? "cr-axis" : "cr-grid"} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
            <text className="cr-tick" x={M.l - 8} y={y(v) + 4} textAnchor="end">{crTick(v)}</text>
          </g>
        ))}
        {jTicks.map(j => <text key={j} className="cr-tick" x={x(j)} y={H - 8} textAnchor="middle">{`J+${j}`}</text>)}
        {curves.filter(c => c !== hl).map(c => <path key={c.ep.slug} className="cr-ln cr-ln-ep" d={path(c)} />)}
        <path className="cr-ln cr-ln-hl" d={path(hl)} />
        {near && near !== hl && <path className="cr-ln cr-ln-hover" d={path(near)} />}
        <circle className="cr-end-dot" cx={x(end[0])} cy={y(end[1])} r={4} />
        <text className="cr-tick cr-lbl" x={x(end[0]) + 8} y={y(end[1]) + 4}>{V.label(hl.ep)}</text>
        {cursor && <line className="cr-cross" x1={x(cursor.j)} x2={x(cursor.j)} y1={M.t} y2={M.t + ph} />}
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="transparent" tabIndex={0}
              aria-label="Courbes de démarrage : flèches gauche et droite pour parcourir les jours"
              onMouseMove={e => {
                const box = e.currentTarget.ownerSVGElement.getBoundingClientRect(), k = W / box.width;
                move(((e.clientX - box.left) * k - M.l) / pw * xMax, (e.clientY - box.top) * k);
              }}
              onMouseLeave={() => setCursor(null)}
              onFocus={() => move(xMax, null)} onBlur={() => setCursor(null)}
              onKeyDown={e => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                move((cursor ? cursor.j : xMax) + (e.key === "ArrowRight" ? snap : -snap), null);
              }} />
      </svg>
    );
    if (cursor && vals.length) {
      const title = cursor.j < 1 ? `${Math.round(cursor.j * 24)} h après la mise en ligne`
                                 : `J+${V.nf2.format(cursor.j)} après la mise en ligne`;
      tip = <CrTip x={x(cursor.j)} y={M.t} width={W} title={title} total={null}
                   rows={vals.slice(0, 8).map(o => ({ key: o.c === hl ? "cr-k-hl" : o.c === near ? "cr-k-hover" : "cr-k-ep",
                                                      label: V.label(o.c.ep), value: o.v }))} />;
    }
  }
  return <div className="cr-chart" ref={ref}>{body}{tip}</div>;
}

// ── Tableau des épisodes ───────────────────────────────────────
const CR_METRICS = [
  ["views", "Vues"], ["reactions", "J'aime"], ["comments", "Commentaires"], ["shares", "Partages"],
  ["saves", "Enregistrements"], ["reach", "Comptes touchés"], ["impressions", "Impressions"],
  ["avg_watch_s", "Durée moyenne regardée"], ["total_watch_min", "Temps total regardé"],
  ["follows", "Abonnés gagnés"], ["engagement_rate", "Engagement selon Buffer"],
];

function crMetricValue(ep, key, v) {
  const V = window.creatorView;
  if (key === "avg_watch_s") return `${V.nf2.format(v)} s${ep.seconds ? ` · ${V.pf0.format(Math.min(1, v / ep.seconds))}` : ""}`;
  if (key === "total_watch_min") return `${V.nf.format(Math.round(v))} min`;
  if (key === "engagement_rate") return V.pf.format(v / 100);
  return V.nf.format(v);
}

function CrNetCell({ ep, net, now }) {
  const V = window.creatorView;
  const sl = V.slot(ep, net.id);
  if (!sl) return <span className="cr-muted" title={`Pas programmé sur ${net.label}`}>—</span>;
  if (sl.status === "sent") {
    const r = V.lastReading(sl);
    const value = <span className="cr-v">{r ? V.big(Number(r.views) || 0) : "…"}</span>;
    const title = r ? `Voir le post ${net.label}` : "En ligne, chiffres au prochain relevé Buffer";
    return sl.url
      ? <a className="cr-cell-link" href={sl.url} target="_blank" rel="noopener noreferrer" title={title}>{value}</a>
      : <span title={title}>{value}</span>;
  }
  if (sl.status === "error") return <span className="cr-st is-alert" title={sl.error || ""}>⚠ échec</span>;
  if (sl.status === "missing") return <span className="cr-st is-alert" title="Supprimé de Buffer">✕ supprimé</span>;
  const t = sl.due_at ? Date.parse(sl.due_at) : null;
  const when = t ? (V.startOfDay(t) === V.startOfDay(now) ? V.tFmt.format(t) : V.dShort.format(t)) : "prévu";
  return <span className="cr-st cr-muted" title={t ? `Programmé ${V.at(t)}` : "Programmé"}>◷ {when}</span>;
}

function CrNetDetail({ ep, net }) {
  const V = window.creatorView;
  const sl = V.slot(ep, net.id);
  if (!sl) {
    return (
      <div className="cr-det-card">
        <h3><i className={`cr-dot cr-bg-${net.cls}`} />{net.label}</h3>
        <p className="cr-det-line">Pas programmé sur ce réseau.</p>
      </div>
    );
  }
  const due = sl.due_at ? Date.parse(sl.due_at) : null, sent = sl.sent_at ? Date.parse(sl.sent_at) : null;
  const line = {
    sent: `En ligne depuis ${sent ? V.at(sent) : "?"}`,
    error: `Échec de publication${sl.error ? ` : ${sl.error}` : ""}`,
    missing: "Post supprimé de Buffer",
    draft: "Brouillon dans Buffer",
  }[sl.status] || `Programmé ${due ? V.at(due) : ""}`;
  const r = V.lastReading(sl);
  return (
    <div className="cr-det-card">
      <h3><i className={`cr-dot cr-bg-${net.cls}`} />{net.label}</h3>
      <p className="cr-det-line">{line}</p>
      {r && (
        <dl>
          {CR_METRICS.filter(([k]) => r[k] != null && r[k] !== "").map(([k, name]) => (
            <React.Fragment key={k}><dt>{name}</dt><dd>{crMetricValue(ep, k, Number(r[k]))}</dd></React.Fragment>
          ))}
        </dl>
      )}
      {r && (
        <p className="cr-det-foot">
          {[r.liveAt && `Compteur public du ${V.at(Date.parse(r.liveAt))}`,
            r.bufferAt && `relevé Buffer du ${V.at(Date.parse(r.bufferAt))}`,
            `${V.plural(sl.readings.length + sl.live.length, "relevé", "relevés")} en tout`].filter(Boolean).join(" · ")}
        </p>
      )}
      {!r && sl.status === "sent" && <p className="cr-det-foot">Premiers chiffres au prochain relevé Buffer.</p>}
      {sl.url && <a className="cr-det-link" href={sl.url} target="_blank" rel="noopener noreferrer">Ouvrir sur {net.label} ↗</a>}
    </div>
  );
}

function CrEpisodes({ eps, sel, now }) {
  const V = window.creatorView;
  const [sort, setSort] = useCrState({ key: "date", dir: -1 });
  const [open, setOpen] = useCrState({});
  const shown = V.netsOf(sel);
  const cols = [
    { key: "ep", label: "Épisode" },
    { key: "date", label: "Mise en ligne", cls: "cr-col-date" },
    ...(sel === "all" ? [{ key: "total", label: "Total", num: true }] : []),
    ...shown.map(n => ({ key: n.id, label: n.label, num: true, net: n })),
    { key: "eng", label: "Engagement", num: true, cls: "cr-col-opt",
      title: "(J'aime + commentaires + partages + enregistrements) / vues" },
    { key: "watched", label: "Regardé", num: true, cls: "cr-col-opt",
      title: "Part moyenne de la vidéo regardée (TikTok, Instagram)" },
  ];
  const sortKey = cols.some(c => c.key === sort.key) ? sort.key : "date";
  const rows = eps.map(ep => ({ ep, a: V.agg([ep], sel), pub: V.pubTime(ep) }));
  const val = (row, key) => {
    if (key === "ep") return row.ep.number;
    if (key === "date") return row.pub;
    if (key === "total") return row.a.views;
    if (key === "eng") return row.a.eng == null ? -1 : row.a.eng;
    if (key === "watched") return row.a.watched == null ? -1 : row.a.watched;
    const sl = V.slot(row.ep, key), r = V.lastReading(sl);
    return sl && sl.status === "sent" ? (r ? Number(r.views) || 0 : 0) : -1;
  };
  rows.sort((a, b) => ((val(a, sortKey) - val(b, sortKey)) * sort.dir) || (b.pub - a.pub));
  const toggle = slug => setOpen(Object.assign({}, open, { [slug]: !open[slug] }));

  return (
    <div className="cr-scroll">
      <table className="cr-table">
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} scope="col" title={c.title || undefined}
                  className={[c.num ? "num" : "", c.cls || ""].join(" ").trim() || undefined}
                  aria-sort={sortKey === c.key ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                <button type="button" className="cr-sort"
                        onClick={() => setSort(sortKey === c.key ? { key: c.key, dir: -sort.dir } : { key: c.key, dir: c.key === "ep" ? 1 : -1 })}>
                  {c.net && <i className={`cr-dot cr-bg-${c.net.cls}`} />}
                  {c.label}
                  <span className="cr-ar" aria-hidden="true">{sortKey === c.key && sort.dir > 0 ? "▲" : "▼"}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ep, a, pub }) => {
            const isOpen = !!open[ep.slug], live = V.isLive(ep);
            const parts = V.NETWORKS.map(n => ({ n, v: Number((V.lastReading(V.slot(ep, n.id)) || {}).views) || 0 })).filter(o => o.v > 0);
            const sum = parts.reduce((t, o) => t + o.v, 0);
            return (
              <React.Fragment key={ep.slug}>
                <tr className={`cr-row${isOpen ? " is-open" : ""}`}
                    onClick={e => { if (!e.target.closest("a,button")) toggle(ep.slug); }}>
                  <td>
                    <button type="button" className="cr-ep" aria-expanded={isOpen} onClick={() => toggle(ep.slug)}>
                      <span className="cr-chev" aria-hidden="true">▶</span>
                      <span className="cr-no">{V.label(ep)}</span>
                      <span className="cr-ep-title" title={ep.title}>{ep.title}</span>
                    </button>
                  </td>
                  <td className="cr-col-date">
                    <span>{isFinite(pub) ? V.dayLabel(pub, now) : "—"}</span>
                    <span className="cr-when">
                      {live ? `J+${Math.max(0, Math.floor((now - pub) / V.DAY))}` : isFinite(pub) ? `à ${V.tFmt.format(pub)}` : ""}
                    </span>
                  </td>
                  {sel === "all" && (
                    <td className="num">
                      <span className="cr-v">{live ? V.big(a.views) : "—"}</span>
                      {sum > 0 && (
                        <span className="cr-split" role="img"
                              aria-label={parts.map(o => `${o.n.label} ${V.pf0.format(o.v / sum)}`).join(", ")}>
                          {parts.map(o => <i key={o.n.id} className={`cr-bg-${o.n.cls}`} style={{ flex: `${o.v} 1 0` }} />)}
                        </span>
                      )}
                    </td>
                  )}
                  {shown.map(n => <td key={n.id} className="num"><CrNetCell ep={ep} net={n} now={now} /></td>)}
                  <td className="num cr-col-opt">{a.eng == null ? "—" : V.pf.format(a.eng)}</td>
                  <td className="num cr-col-opt">{a.watched == null ? "—" : V.pf0.format(a.watched)}</td>
                </tr>
                {isOpen && (
                  <tr className="cr-det-row">
                    <td colSpan={cols.length}>
                      <p className="cr-det-title">
                        {V.label(ep)} · <q>{ep.title}</q>{ep.seconds ? ` · ${V.nf.format(Math.round(ep.seconds))} s` : ""}
                      </p>
                      <div className="cr-det-grid">{V.NETWORKS.map(n => <CrNetDetail key={n.id} ep={ep} net={n} />)}</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Programmation ──────────────────────────────────────────────
function CrProgramme({ eps, now }) {
  const V = window.creatorView;
  const items = V.programme(eps, now);
  const q = V.queueEnd(eps, now);
  if (!items.length) {
    return <p className="cr-prog-foot is-warn"><b>Plus rien de programmé.</b> La prochaine collecte le confirmera.</p>;
  }
  return (
    <>
      <div className="cr-prog">
        {items.map(({ ep, due }) => (
          <div key={ep.slug} className={`cr-day${V.startOfDay(due) === V.startOfDay(now) ? " is-today" : ""}`}>
            <div className="cr-day-d">{V.dayLabel(due, now)}</div>
            <div className="cr-day-ep" title={ep.title}>{V.label(ep)} · {ep.title}</div>
            <ul>
              {V.NETWORKS.map(n => {
                const sl = V.slot(ep, n.id);
                const t = sl ? (sl.sent_at ? Date.parse(sl.sent_at) : sl.due_at ? Date.parse(sl.due_at) : null) : null;
                const text = !sl ? "—" : sl.status === "sent" ? `✓ ${V.tFmt.format(t)}`
                  : sl.status === "error" ? "⚠ échec" : sl.status === "missing" ? "✕ supprimé" : (t ? V.tFmt.format(t) : "—");
                const tone = sl && sl.status === "sent" ? " is-ok" : sl && ["error", "missing"].includes(sl.status) ? " is-alert" : "";
                return (
                  <li key={n.id} title={t ? V.at(t) : undefined}>
                    <i className={`cr-dot cr-bg-${n.cls}`} />{n.label}<span className={`cr-t${tone}`}>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {q
        ? <p className={`cr-prog-foot${q.days <= 2 ? " is-warn" : ""}`}>
            Dernier épisode programmé : <b>{V.label(q.ep)}, {V.dLong.format(q.t)}</b>, {V.inDays(q.t, now)}.
          </p>
        : <p className="cr-prog-foot"><b>Tout est publié.</b> Rien d'autre en attente dans Buffer.</p>}
    </>
  );
}

// ── Chiffres clés ──────────────────────────────────────────────
function CrSpark({ values }) {
  const n = values.length;
  if (n < 2) return null;
  const W = 300, H = 44, max = Math.max(1, ...values);
  const x = i => (i / (n - 1)) * (W - 8) + 4, y = v => H - 4 - (v / max) * (H - 10);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg className="cr-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
         aria-label={`Vues gagnées par jour sur ${n} jours`}>
      <path d={`${line}L${x(n - 1)},${H}L${x(0)},${H}Z`} className="cr-spark-area" />
      <path d={line} className="cr-spark-line" vectorEffect="non-scaling-stroke" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r={4} className="cr-end-dot" />
    </svg>
  );
}

function CrKpis({ eps, raw, now }) {
  const V = window.creatorView;
  const all = V.agg(eps, "all");
  const d24 = V.gain24(eps, "all");
  const days = V.daily(eps, "all", 14, now).map(d => d.total);
  const stat = (key, name) => {
    const v = V.total(eps, "all", key);
    return <div key={key}><b>{v == null ? "—" : V.big(v)}</b><span>{name}</span></div>;
  };
  const delta = d => (d == null ? null : `${d > 0 ? "▲ +" : ""}${V.big(d)} en 24 h`);
  return (
    <section className="cr-kpis" aria-label="Chiffres clés">
      <article className="cr-tile cr-hero-tile">
        <div className="cr-tile-h">
          <span className="cr-label">Vues, tous réseaux</span>
          <span className={`cr-delta${d24 > 0 ? " is-up" : ""}`}>{delta(d24) || "pas encore de relevé"}</span>
        </div>
        <div className="cr-hero-n">{V.big(all.views)}</div>
        <CrSpark values={days} />
        <div className="cr-mini">
          <span><b>{V.nf.format(all.live)}</b> post{all.live >= 2 ? "s" : ""} en ligne sur {V.nf.format(all.planned)}</span>
          <span>Engagement <b>{all.eng == null ? "—" : V.pf.format(all.eng)}</b></span>
          <span>Regardé <b>{all.watched == null ? "—" : V.pf0.format(all.watched)}</b></span>
        </div>
        <div className="cr-hero-stats">
          {stat("reactions", "J'aime")}{stat("comments", "Commentaires")}{stat("shares", "Partages")}{stat("saves", "Enregistrements")}
        </div>
      </article>
      {V.NETWORKS.map(n => {
        const a = V.agg(eps, n.id), share = all.views > 0 ? a.views / all.views : 0;
        const d = V.gain24(eps, n.id);
        const aud = V.audience(raw.audience, n.id);
        const next = !a.live ? Math.min(...eps.map(ep => V.slot(ep, n.id))
          .filter(sl => sl && V.PENDING.includes(sl.status) && sl.due_at).map(sl => Date.parse(sl.due_at))) : Infinity;
        return (
          <article className="cr-tile" key={n.id}>
            <div className="cr-tile-h">
              <span className="cr-net"><i className={`cr-dot cr-bg-${n.cls}`} />{n.label}</span>
            </div>
            <div className="cr-tile-n">{V.big(a.views)}</div>
            <div className={`cr-meter cr-track-${n.cls}`} role="img" aria-label={`${V.pf0.format(share)} des vues`}>
              <i className={`cr-bg-${n.cls}`} style={{ width: `${(share * 100).toFixed(1)}%` }} />
            </div>
            <div className="cr-mini">
              <span><b>{V.pf0.format(share)}</b> des vues</span>
              {d != null && <span className={`cr-delta${d > 0 ? " is-up" : ""}`}>{delta(d)}</span>}
            </div>
            <div className="cr-mini">
              <span>
                <b>{aud ? V.nf.format(aud.followers) : "—"}</b>{aud && aud.followers >= 2 ? " abonnés" : " abonné"}
                {aud && aud.change ? ` (${aud.change > 0 ? "+" : ""}${V.nf.format(aud.change)} en 7 j)` : ""}
              </span>
              <span>Engagement <b>{a.eng == null ? "—" : V.pf.format(a.eng)}</b></span>
              {a.watched != null && <span>Regardé <b>{V.pf0.format(a.watched)}</b></span>}
            </div>
            {isFinite(next) && <div className="cr-next">Premier post {V.dayLabel(next, now)} à {V.tFmt.format(next)}</div>}
          </article>
        );
      })}
    </section>
  );
}

// ── Onglet ─────────────────────────────────────────────────────
function PanelCreator({ data, onNavigate }) {
  const V = window.creatorView;
  const raw = window.CREATOR_DATA || {};
  const now = Date.now();
  const eps = V.build(raw);
  const fresh = V.freshness(raw);
  const [net, setNet] = useCrState(crReadNet);
  const [tables, setTables] = useCrState({ daily: false, launch: false });
  const chooseNet = id => {
    setNet(id);
    try { localStorage.setItem(CR_NET_KEY, id); } catch (e) { /* navigation privée */ }
  };
  const flip = key => setTables(Object.assign({}, tables, { [key]: !tables[key] }));
  const nets = V.netsOf(net);
  const dailyData = V.daily(eps, net, 30, now);
  const cs = V.curves(eps, net);
  const hl = cs.length ? cs.reduce((a, c) => (c.pub > a.pub ? c : a)) : null;
  const notes = (
    <section className="cr-notes" aria-labelledby="cr-notes-h">
      <h2 id="cr-notes-h">Comment lire l'onglet</h2>
      <ul>
        <li>Les chiffres viennent de Buffer, qui relit chaque réseau une fois par jour : jusqu'à 24 h de retard sur les applis. La collecte passe deux fois par jour, à 21 h 40 et 6 h 40 UTC.</li>
        <li>À chaque collecte, les vues et j'aime des posts TikTok et YouTube des 14 derniers jours sont aussi relus sur leur page publique, plus frais que Buffer. Pour un même chiffre, l'onglet garde le plus haut des deux : un compteur ne recule pas.</li>
        <li>Les vues gagnées par jour sont l'écart entre deux relevés. Engagement = (j'aime + commentaires + partages + enregistrements) / vues.</li>
        <li>Regardé = durée moyenne de visionnage rapportée à la durée de la vidéo, pour les réseaux qui la donnent (TikTok, Instagram).</li>
        <li>Abonnés : lus sur les pages publiques TikTok et YouTube quand elles affichent le compteur. Instagram ne le permet pas sans connexion.</li>
        <li>L'offre gratuite de Buffer limite ses statistiques aux 31 derniers jours : un post qui n'est plus relu garde ses derniers chiffres.</li>
      </ul>
    </section>
  );

  const header = (
    <header className="cr-hero">
      <div className="cr-eyebrow">Business · chaîne Once Upon a Nerd</div>
      <h1 className="cr-title">L'adoption des posts</h1>
      <p className="cr-sub">
        {fresh.liveAt ? `Compteurs publics du ${V.at(Date.parse(fresh.liveAt))} · ` : ""}
        {fresh.metricsAt ? `relevé Buffer du ${V.at(Date.parse(fresh.metricsAt))}` : "pas encore de relevé Buffer"}
        {fresh.updatedAt ? ` · collecte du ${V.at(Date.parse(fresh.updatedAt))}` : ""}
        {raw._demo ? " · données de démonstration" : ""}
      </p>
    </header>
  );

  if (!eps.length) {
    return (
      <div className="cr-panel">
        {header}
        <div className="cr-state">
          <h2>Aucun épisode pour l'instant</h2>
          <p>L'onglet se remplit à la première collecte (GitHub Actions, deux fois par jour) dès qu'un post est programmé dans Buffer.</p>
        </div>
        {notes}
      </div>
    );
  }

  const alerts = V.alerts(eps, fresh.updatedAt, now);
  return (
    <div className="cr-panel">
      {header}
      {alerts.length > 0 && (
        <div className="cr-alerts" role="status">
          {alerts.map(a => (
            <div key={a.text} className={`cr-alert is-${a.sev}`}>
              <span className="cr-alert-ic" aria-hidden="true">{a.sev === "alert" ? "⚠" : "◷"}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}
      <CrKpis eps={eps} raw={raw} now={now} />

      <div className="cr-filters">
        <span className="cr-f-label" id="cr-net-label">Réseau</span>
        <div className="cr-seg" role="radiogroup" aria-labelledby="cr-net-label">
          {[{ id: "all", label: "Tous" }, ...V.NETWORKS].map(o => (
            <button key={o.id} type="button" role="radio" aria-checked={net === o.id}
                    className={`cr-seg-b${net === o.id ? " is-on" : ""}`} onClick={() => chooseNet(o.id)}>
              {o.cls && <i className={`cr-dot cr-bg-${o.cls}`} />}{o.label}
            </button>
          ))}
        </div>
        <span className="cr-f-note">S'applique aux graphiques et au tableau ci-dessous.</span>
      </div>

      <section className="cr-charts">
        <article className="cr-card">
          <div className="cr-card-h">
            <h2>Vues gagnées par jour</h2>
            <button type="button" className="cr-view-t" aria-pressed={tables.daily} onClick={() => flip("daily")}>
              {tables.daily ? "Voir le graphique" : "Voir le tableau"}
            </button>
          </div>
          <p className="cr-card-sub">Écart entre deux relevés Buffer, par réseau, sur les 30 derniers jours.</p>
          <div className="cr-legend">{nets.map(n => <span key={n.id}><i className={`cr-sw cr-bg-${n.cls}`} />{n.label}</span>)}</div>
          {tables.daily
            ? <CrDataTable head={["Jour", ...nets.map(n => n.label), ...(nets.length > 1 ? ["Total"] : [])]}
                           rows={[...dailyData].reverse().map(d => [V.dLong.format(d.day), ...nets.map(n => V.nf.format(Math.round(d.vals[n.id]))),
                                                                     ...(nets.length > 1 ? [V.nf.format(Math.round(d.total))] : [])])} />
            : <CrDaily data={dailyData} nets={nets} />}
        </article>
        <article className="cr-card">
          <div className="cr-card-h">
            <h2>Démarrage des épisodes</h2>
            <button type="button" className="cr-view-t" aria-pressed={tables.launch} onClick={() => flip("launch")}>
              {tables.launch ? "Voir le graphique" : "Voir le tableau"}
            </button>
          </div>
          <p className="cr-card-sub">Vues cumulées depuis la mise en ligne. Le dernier épisode est en couleur ; survole une courbe pour comparer.</p>
          <div className="cr-legend">
            <span><i className="cr-lk cr-k-hl" />{hl ? `${V.label(hl.ep)}, le dernier` : "Dernier épisode"}</span>
            <span><i className="cr-lk cr-k-ep" />Les autres épisodes</span>
          </div>
          {tables.launch
            ? <CrDataTable head={["Épisode", "J+1", "J+3", "J+7", "J+14", "J+30"]}
                           rows={[...cs].sort((a, b) => b.pub - a.pub).map(c => [`${V.label(c.ep)} ${c.ep.title}`,
                             ...[1, 3, 7, 14, 30].map(j => { const v = V.valueAt(c, j); return v == null ? "—" : V.nf.format(Math.round(v)); })])} />
            : <CrLaunch curves={cs} />}
        </article>
      </section>

      <section className="cr-card" aria-labelledby="cr-ep-h">
        <div className="cr-card-h"><h2 id="cr-ep-h">Épisodes</h2></div>
        <p className="cr-card-sub">Vues par réseau au dernier relevé. Clique un épisode pour voir le détail de chaque post.</p>
        <CrEpisodes eps={eps} sel={net} now={now} />
      </section>

      <section className="cr-card" aria-labelledby="cr-prog-h">
        <div className="cr-card-h"><h2 id="cr-prog-h">Programmation</h2></div>
        <p className="cr-card-sub">Les prochains posts, à l'heure de ton navigateur.</p>
        <CrProgramme eps={eps} now={now} />
      </section>

      {notes}
    </div>
  );
}

window.PanelCreator = PanelCreator;
