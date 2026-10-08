// cockpit/lib/creator-view.js
// Logique de présentation pure de l'onglet « Once Upon a Nerd » : assemblage
// des lignes Supabase en épisodes, vues par jour, courbes de démarrage,
// alertes, programmation, formats.
// Script classique compatible Babel standalone : expose window.creatorView.
// Guard module.exports => testable sous node (tests/test_creator_view.mjs).
//
// CONTRAINTE : aucune dépendance au DOM, à React ou à window.CREATOR_DATA.
(function () {
  // Ordre fixe = ordre des créneaux de publication (TikTok, puis YouTube, puis Instagram).
  const NETWORKS = [
    { id: "tiktok", label: "TikTok", cls: "tt" },
    { id: "youtube", label: "YouTube", cls: "yt" },
    { id: "instagram", label: "Instagram", cls: "ig" },
  ];
  const NET = Object.fromEntries(NETWORKS.map(n => [n.id, n]));
  const DAY = 864e5, HOUR = 36e5;
  const PENDING = ["scheduled", "sending", "needs_approval", "draft"];
  const INTERACTIONS = ["reactions", "comments", "shares", "saves"];
  // Quand un post est reprogrammé après un échec, l'ancien reste en base :
  // l'épisode garde le post le plus avancé.
  const STATUS_RANK = { sent: 6, sending: 5, scheduled: 4, needs_approval: 3, draft: 2, error: 1, missing: 0 };

  const num = v => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));
  const ts = s => (s ? Date.parse(s) : NaN);

  // ── Assemblage ──────────────────────────────────────────────
  // raw = { episodes, posts, readings, audience } tels que lus en base.
  function build(raw) {
    const r = raw || {};
    const episodes = {};
    for (const e of r.episodes || []) {
      episodes[e.slug] = { slug: e.slug, number: e.number, title: e.title || e.slug,
                           seconds: num(e.video_seconds), posts: {} };
    }
    const bySlot = {};
    const ranked = sl => [STATUS_RANK[sl.status] ?? -1, ts(sl.due_at) || 0];
    for (const p of r.posts || []) {
      const ep = episodes[p.episode];
      if (!ep || !NET[p.network]) continue;
      const slot = { postId: p.post_id, status: p.status, due_at: p.due_at, sent_at: p.sent_at,
                     url: p.url, error: p.error, readings: [] };
      bySlot[p.post_id] = slot;
      const cur = ep.posts[p.network];
      if (!cur) { ep.posts[p.network] = slot; continue; }
      const [a, b] = [ranked(slot), ranked(cur)];
      if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) ep.posts[p.network] = slot;
    }
    for (const row of r.readings || []) {
      const slot = bySlot[row.post_id];
      if (slot) slot.readings.push(row);
    }
    for (const sl of Object.values(bySlot)) sl.readings.sort((x, y) => ts(x.read_at) - ts(y.read_at));
    return Object.values(episodes).sort((a, b) => a.number - b.number);
  }

  const slot = (ep, id) => (ep && ep.posts && ep.posts[id]) || null;
  const netsOf = sel => (sel === "all" || !NET[sel] ? NETWORKS : [NET[sel]]);
  const lastReading = sl => (sl && sl.readings && sl.readings.length ? sl.readings[sl.readings.length - 1] : null);
  const label = ep => `#${ep.number}`;

  // Vues cumulées dans le temps : [instant, vues], avec (mise en ligne, 0) en tête.
  function points(sl) {
    if (!sl || !sl.sent_at) return [];
    const out = [[ts(sl.sent_at), 0]];
    for (const r of sl.readings || []) {
      const t = ts(r.read_at);
      if (t > out[out.length - 1][0]) out.push([t, num(r.views) || 0]);
    }
    return out;
  }
  function stepAt(p, T) {
    let v = 0;
    for (const [t, x] of p) { if (t <= T) v = x; else break; }
    return v;
  }
  function interpAt(p, T) {
    if (!p.length || T <= p[0][0]) return 0;
    for (let i = 1; i < p.length; i++) {
      if (T <= p[i][0]) {
        const [t0, v0] = p[i - 1], [t1, v1] = p[i];
        return v0 + (v1 - v0) * (T - t0) / (t1 - t0);
      }
    }
    return p[p.length - 1][1];
  }

  function pubTime(ep) {
    const slots = NETWORKS.map(n => slot(ep, n.id)).filter(Boolean);
    const sent = slots.filter(s => s.sent_at).map(s => ts(s.sent_at));
    if (sent.length) return Math.min(...sent);
    const due = slots.filter(s => s.due_at).map(s => ts(s.due_at));
    return due.length ? Math.min(...due) : Infinity;
  }
  const isLive = ep => NETWORKS.some(n => (slot(ep, n.id) || {}).status === "sent");

  // ── Agrégats ────────────────────────────────────────────────
  // Engagement = (j'aime + commentaires + partages + enregistrements) / vues.
  // Regardé = durée moyenne de visionnage / durée de la vidéo, pondérée par les vues.
  function agg(eps, sel) {
    let views = 0, inter = 0, wNum = 0, wDen = 0, live = 0, planned = 0;
    for (const ep of eps) for (const n of netsOf(sel)) {
      const sl = slot(ep, n.id);
      if (!sl) continue;
      planned++;
      if (sl.status === "sent") live++;
      const r = lastReading(sl);
      if (!r) continue;
      const v = num(r.views) || 0;
      views += v;
      for (const k of INTERACTIONS) inter += num(r[k]) || 0;
      const avg = num(r.avg_watch_s);
      if (avg != null && ep.seconds > 0 && v > 0) { wNum += Math.min(1, avg / ep.seconds) * v; wDen += v; }
    }
    return { views, inter, eng: views > 0 ? inter / views : null, watched: wDen > 0 ? wNum / wDen : null, live, planned };
  }
  function total(eps, sel, key) {
    let t = 0, seen = false;
    for (const ep of eps) for (const n of netsOf(sel)) {
      const r = lastReading(slot(ep, n.id));
      if (r && num(r[key]) != null) { t += num(r[key]); seen = true; }
    }
    return seen ? t : null;
  }
  function latestReading(eps) {
    let m = 0;
    for (const ep of eps) for (const n of NETWORKS) {
      const r = lastReading(slot(ep, n.id));
      if (r) m = Math.max(m, ts(r.read_at));
    }
    return m || null;
  }
  // Vues gagnées entre deux instants (relevés en escalier : la valeur connue à chaque instant).
  function gain(eps, sel, T1, T0) {
    let g = 0;
    for (const ep of eps) for (const n of netsOf(sel)) {
      const p = points(slot(ep, n.id));
      if (p.length) g += stepAt(p, T1) - stepAt(p, T0);
    }
    return g;
  }
  // « En 24 h » : Buffer relit une fois par jour, à quelques minutes près ; 20 h
  // de marge font tomber le relevé de la veille dans la fenêtre.
  function gain24(eps, sel) {
    const T1 = latestReading(eps);
    return T1 ? gain(eps, sel, T1, T1 - 20 * HOUR) : null;
  }

  // ── Jours (heure locale du navigateur) ──────────────────────
  const startOfDay = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const addDays = (t, n) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };

  // Vues gagnées chaque jour = écart entre la valeur connue en fin de journée et la veille.
  function daily(eps, sel, maxDays, now) {
    const series = [], firsts = [];
    for (const ep of eps) for (const n of netsOf(sel)) {
      const sl = slot(ep, n.id);
      if (!sl || !sl.sent_at) continue;
      firsts.push(ts(sl.sent_at));
      series.push({ net: n.id, p: points(sl) });
    }
    if (!firsts.length) return [];
    const days = [];
    for (let d = startOfDay(Math.min(...firsts)), today = startOfDay(now); d <= today; d = addDays(d, 1)) days.push(d);
    return days.slice(-maxDays).map(day => {
      const end = addDays(day, 1) - 1, prev = day - 1, vals = {};
      let sum = 0;
      for (const n of netsOf(sel)) {
        let g = 0;
        for (const x of series) if (x.net === n.id) g += Math.max(0, stepAt(x.p, end) - stepAt(x.p, prev));
        vals[n.id] = g;
        sum += g;
      }
      return { day, vals, total: sum };
    });
  }

  // Courbes de démarrage : vues cumulées en fonction de l'âge du post (en jours),
  // chaque réseau mesuré depuis sa propre mise en ligne, échantillonnées par quart de jour.
  function curves(eps, sel) {
    const out = [];
    for (const ep of eps) {
      const parts = netsOf(sel).map(n => slot(ep, n.id))
        .filter(sl => sl && sl.sent_at && sl.readings && sl.readings.length)
        .map(sl => ({ sent: ts(sl.sent_at), p: points(sl) }));
      if (!parts.length) continue;
      const maxAge = Math.max(...parts.map(x => (x.p[x.p.length - 1][0] - x.sent) / DAY));
      if (!(maxAge > 0)) continue;
      const at = j => parts.reduce((a, x) => a + interpAt(x.p, x.sent + j * DAY), 0);
      const pts = [];
      for (let j = 0; j < maxAge; j += 0.25) pts.push([j, at(j)]);
      pts.push([maxAge, at(maxAge)]);
      out.push({ ep, pts, maxAge, pub: pubTime(ep) });
    }
    return out;
  }
  function valueAt(c, j) {
    if (j > c.maxAge + 1e-9) return null;
    for (let i = 1; i < c.pts.length; i++) {
      if (j <= c.pts[i][0]) {
        const [a, va] = c.pts[i - 1], [b, vb] = c.pts[i];
        return b === a ? vb : va + (vb - va) * (j - a) / (b - a);
      }
    }
    return c.pts[c.pts.length - 1][1];
  }

  // ── Programmation et alertes ────────────────────────────────
  function queueEnd(eps, now) {
    let best = null;
    for (const ep of eps) {
      const waiting = NETWORKS.some(n => { const sl = slot(ep, n.id); return sl && PENDING.includes(sl.status); });
      if (!waiting) continue;
      const t = pubTime(ep);
      if (!best || t > best.t) best = { ep, t };
    }
    return best ? { ...best, days: Math.round((startOfDay(best.t) - startOfDay(now)) / DAY) } : null;
  }
  // Les épisodes du jour et à venir, plus ceux dont un post attend encore
  // (Instagram part à 00:30 heure de Paris, le lendemain de TikTok et YouTube).
  function programme(eps, now) {
    const today = startOfDay(now);
    return eps.map(ep => {
      const dues = NETWORKS.map(n => slot(ep, n.id)).filter(s => s && s.due_at).map(s => ts(s.due_at));
      return { ep, due: dues.length ? Math.min(...dues) : Infinity };
    }).filter(o => isFinite(o.due) && (startOfDay(o.due) >= today ||
      NETWORKS.some(n => PENDING.includes((slot(o.ep, n.id) || {}).status))))
      .sort((a, b) => a.due - b.due);
  }
  function alerts(eps, updatedAt, now) {
    const list = [];
    for (const ep of eps) for (const n of NETWORKS) {
      const sl = slot(ep, n.id);
      if (!sl) continue;
      if (sl.status === "error") {
        list.push({ sev: "alert", text: `${label(ep)} sur ${n.label} : échec de publication${sl.error ? ` (${sl.error})` : ""}` });
      }
      if (sl.status === "missing") list.push({ sev: "alert", text: `${label(ep)} sur ${n.label} : post supprimé de Buffer` });
    }
    if (updatedAt && now - ts(updatedAt) > 36 * HOUR) {
      list.push({ sev: "warn", text: `Dernière collecte il y a ${Math.floor((now - ts(updatedAt)) / DAY)} j : le pipeline ne tourne plus` });
    }
    const q = queueEnd(eps, now);
    if (eps.length && !q) list.push({ sev: "warn", text: "Plus aucun post programmé dans Buffer" });
    else if (q && q.days <= 2) list.push({ sev: "warn", text: `Dernier épisode programmé : ${label(q.ep)}, ${dayLabel(q.t, now)}. Il faut programmer la suite.` });
    return list;
  }

  // Abonnés : dernier relevé du réseau et écart avec celui d'il y a une semaine.
  function audience(rows, network) {
    const a = (rows || []).filter(r => r.network === network && num(r.followers) != null)
      .sort((x, y) => String(x.day).localeCompare(String(y.day)));
    if (!a.length) return null;
    const now = a[a.length - 1];
    const weekAgo = [...a].reverse().find(r => ts(r.day) <= ts(now.day) - 6.5 * DAY);
    return { followers: num(now.followers), likes: num(now.likes), day: now.day,
             change: weekAgo ? num(now.followers) - num(weekAgo.followers) : null };
  }
  // Fraîcheur : dernier passage du pipeline, dernier relevé Buffer.
  function freshness(raw) {
    const r = raw || {};
    let updated = 0, metrics = 0;
    for (const p of r.posts || []) updated = Math.max(updated, ts(p.updated_at) || 0);
    for (const x of r.readings || []) metrics = Math.max(metrics, ts(x.read_at) || 0);
    return { updatedAt: updated ? new Date(updated).toISOString() : null,
             metricsAt: metrics ? new Date(metrics).toISOString() : null };
  }

  // ── Formats ─────────────────────────────────────────────────
  const nf = new Intl.NumberFormat("fr-FR");
  const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const cf = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
  const pf = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
  const pf0 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
  const dLong = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const dShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const tFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const big = v => (Math.abs(v) >= 100000 ? cf.format(v) : nf.format(Math.round(v)));
  const plural = (n, one, many) => `${nf.format(n)} ${Math.abs(n) >= 2 ? many : one}`;
  const at = t => `${dLong.format(t)} à ${tFmt.format(t)}`;
  function dayLabel(t, now) {
    const d = startOfDay(t), today = startOfDay(now);
    if (d === today) return "aujourd'hui";
    if (d === addDays(today, 1)) return "demain";
    if (d === addDays(today, -1)) return "hier";
    return dLong.format(t);
  }
  function inDays(t, now) {
    const n = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
    return n === 0 ? "aujourd'hui" : n === 1 ? "demain" : n > 0 ? `dans ${n} jours` : `il y a ${-n} j`;
  }
  function niceScale(max) {
    if (!(max > 0)) return { max: 10, step: 5 };
    const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
    const step = Math.max(1, (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 && mag > 1 ? 2.5 : r <= 5 ? 5 : 10) * mag);
    return { max: Math.ceil(max / step) * step, step };
  }

  const api = {
    NETWORKS, NET, DAY, HOUR, PENDING,
    build, slot, netsOf, lastReading, label, points, stepAt, interpAt, pubTime, isLive,
    agg, total, latestReading, gain, gain24, startOfDay, addDays, daily, curves, valueAt,
    queueEnd, programme, alerts, audience, freshness,
    nf, nf2, cf, pf, pf0, dLong, dShort, tFmt, big, plural, at, dayLabel, inDays, niceScale,
  };
  if (typeof window !== "undefined") window.creatorView = Object.assign(window.creatorView || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
