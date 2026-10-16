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
                     url: p.url, error: p.error, readings: [], live: [] };
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
    // Compteurs publics (TikTok, YouTube) relus à chaque collecte : plus frais que Buffer.
    for (const row of r.live || []) {
      const slot = bySlot[row.post_id];
      if (slot) slot.live.push(row);
    }
    const byTime = (x, y) => ts(x.read_at) - ts(y.read_at);
    for (const sl of Object.values(bySlot)) { sl.readings.sort(byTime); sl.live.sort(byTime); }
    return Object.values(episodes).sort((a, b) => a.number - b.number);
  }

  const slot = (ep, id) => (ep && ep.posts && ep.posts[id]) || null;
  const netsOf = sel => (sel === "all" || !NET[sel] ? NETWORKS : [NET[sel]]);
  // Dernier état connu d'un post : le dernier relevé Buffer, complété par le dernier
  // compteur public. Un compteur ne recule pas : pour les chiffres que donnent les
  // deux sources, la plus haute l'emporte (Buffer a jusqu'à un jour de retard).
  const LIVE_KEYS = { views: "views", reactions: "likes", comments: "comments", shares: "shares", saves: "saves" };
  function lastReading(sl) {
    if (!sl) return null;
    const b = sl.readings && sl.readings.length ? sl.readings[sl.readings.length - 1] : null;
    const l = sl.live && sl.live.length ? sl.live[sl.live.length - 1] : null;
    if (!b && !l) return null;
    const out = Object.assign({}, b || {});
    for (const [key, liveKey] of Object.entries(LIVE_KEYS)) {
      const bv = b ? num(b[key]) : null, lv = l ? num(l[liveKey]) : null;
      out[key] = bv == null ? lv : lv == null ? bv : Math.max(bv, lv);
    }
    out.bufferAt = b ? b.read_at : null;
    out.liveAt = l ? l.read_at : null;
    out.read_at = !b ? l.read_at : !l ? b.read_at : (ts(l.read_at) > ts(b.read_at) ? l.read_at : b.read_at);
    return out;
  }
  const label = ep => `#${ep.number}`;

  // Vues cumulées dans le temps : [instant, vues], avec (mise en ligne, 0) en tête.
  // Relevés Buffer et compteurs publics mêlés ; chaque point garde le plus haut déjà
  // connu, pour qu'un relevé Buffer en retard ne fasse pas reculer la courbe.
  function points(sl) {
    if (!sl || !sl.sent_at) return [];
    const marks = [...(sl.readings || []), ...(sl.live || [])]
      .map(r => [ts(r.read_at), num(r.views)])
      .filter(([t, v]) => isFinite(t) && v != null)
      .sort((a, b) => a[0] - b[0]);
    const out = [[ts(sl.sent_at), 0]];
    for (const [t, v] of marks) {
      const lastPoint = out[out.length - 1];
      if (t < lastPoint[0]) continue;
      if (t === lastPoint[0]) { lastPoint[1] = Math.max(lastPoint[1], v); continue; }
      out.push([t, Math.max(lastPoint[1], v)]);
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
        .filter(sl => sl && sl.sent_at && ((sl.readings && sl.readings.length) || (sl.live && sl.live.length)))
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
    let updated = 0, metrics = 0, live = 0;
    for (const p of r.posts || []) updated = Math.max(updated, ts(p.updated_at) || 0);
    for (const x of r.readings || []) metrics = Math.max(metrics, ts(x.read_at) || 0);
    for (const x of r.live || []) live = Math.max(live, ts(x.read_at) || 0);
    const iso = t => (t ? new Date(t).toISOString() : null);
    return { updatedAt: iso(updated), metricsAt: iso(metrics), liveAt: iso(live) };
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

  // ── Prompt d'analyse ────────────────────────────────────────
  // Le bouton « Copier le prompt » met tout l'état de l'onglet dans le
  // presse-papiers, à coller dans une conversation Claude : la chaîne, les
  // consignes, puis les chiffres en tableaux Markdown. Ce que la base ne sait
  // pas (la recette des scripts) vit ici : à tenir à jour quand elle change.
  const CHANNEL_NOTES = [
    "Once Upon a Nerd : des Shorts de 61 à 70 s, en anglais, qui racontent la source réelle (mythe, histoire, folklore) d'un personnage ou d'un élément d'anime, de manga, de film ou de jeu vidéo.",
    "Un épisode par jour, publié sur TikTok, YouTube Shorts et Instagram Reels via Buffer (heures exactes dans le détail des posts).",
    "Format 2 pour #12, #13 et tous les épisodes à partir de #15, format 1 pour les autres. Format 2 : la première phrase nomme l'œuvre ou le personnage, le plan 0 montre côte à côte la source réelle et le personnage, le pont qui suit fait 14 mots au plus et apporte un fait nouveau, la fin boucle sur le plan 0. Il répond aux premiers chiffres de YouTube Studio : la moitié des spectateurs balayait dès le plan 0, et la moitié de ceux qui restaient partait entre 4 et 12 s.",
  ];
  const formatOf = n => (n === 12 || n === 13 || n >= 15 ? 2 : 1);
  const STATUS_FR = { sent: "en ligne", sending: "en cours d'envoi", scheduled: "programmé", needs_approval: "à valider",
                      draft: "brouillon", error: "échec", missing: "supprimé de Buffer" };

  function prompt(raw, now) {
    const eps = build(raw);
    const fresh = freshness(raw);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const n0 = v => (v == null ? "—" : nf.format(Math.round(v)));
    const pc = v => (v == null ? "—" : pf.format(v));
    const when = t => (t ? at(t) : "—");
    const cell = s => String(s).replace(/\|/g, "\\|");
    const table = (head, rows) => [
      `| ${head.join(" | ")} |`, `|${head.map(() => " --- ").join("|")}|`,
      ...rows.map(r => `| ${r.map(cell).join(" | ")} |`),
    ].join("\n");
    const watchedOf = (ep, r) => {
      const avg = r ? num(r.avg_watch_s) : null;
      return avg != null && ep.seconds > 0 ? Math.min(1, avg / ep.seconds) : null;
    };

    const nets = [...NETWORKS.map(n => ({ id: n.id, label: n.label })), { id: "all", label: "Tous" }];
    const state = table(
      ["Réseau", "Posts en ligne", "Vues", "Gain 24 h", "J'aime", "Commentaires", "Partages", "Enregistrements",
       "Engagement", "Regardé", "Abonnés (écart 7 j)"],
      nets.map(o => {
        const a = agg(eps, o.id), aud = o.id === "all" ? null : audience(raw && raw.audience, o.id);
        return [o.label, `${n0(a.live)} sur ${n0(a.planned)}`, n0(a.views), n0(gain24(eps, o.id)),
                ...INTERACTIONS.map(k => n0(total(eps, o.id, k))), pc(a.eng), pc(a.watched),
                aud ? `${n0(aud.followers)}${aud.change != null ? ` (${aud.change > 0 ? "+" : ""}${n0(aud.change)})` : ""}` : "—"];
      }));

    const live = eps.filter(isLive);
    const byEp = new Map(curves(eps, "all").map(c => [c.ep.slug, c]));
    const episodes = table(
      ["#", "Titre", "Durée", "Format", "Mis en ligne", "Âge", ...NETWORKS.map(n => n.label), "Total",
       "J+1", "J+3", "J+7", "Engagement", "Regardé"],
      live.map(ep => {
        const a = agg([ep], "all"), c = byEp.get(ep.slug), pub = pubTime(ep);
        return [label(ep), ep.title, ep.seconds ? `${n0(ep.seconds)} s` : "—", formatOf(ep.number), when(pub),
                `${nf2.format(Math.max(0, (now - pub) / DAY))} j`,
                ...NETWORKS.map(n => { const r = lastReading(slot(ep, n.id)); return r ? n0(r.views) : "—"; }),
                n0(a.views), ...[1, 3, 7].map(j => (c ? n0(valueAt(c, j)) : "—")), pc(a.eng), pc(a.watched)];
      }));

    const postRows = [];
    for (const ep of live) for (const n of NETWORKS) {
      const sl = slot(ep, n.id);
      if (!sl || PENDING.includes(sl.status)) continue;
      const r = lastReading(sl), avg = r ? num(r.avg_watch_s) : null;
      postRows.push([label(ep), n.label, STATUS_FR[sl.status] || sl.status, when(ts(sl.sent_at)),
                     ...["views", ...INTERACTIONS].map(k => (r ? n0(r[k]) : "—")),
                     avg == null ? "—" : `${nf2.format(avg)} s`, pc(watchedOf(ep, r)), r ? when(ts(r.read_at)) : "—"]);
    }
    const posts = table(["#", "Réseau", "Statut", "Mis en ligne", "Vues", "J'aime", "Commentaires", "Partages",
                         "Enregistrements", "Durée moy. de visionnage", "Regardé", "Relevé du"], postRows);

    const perDay = table(["Jour", ...NETWORKS.map(n => n.label), "Total"],
      daily(eps, "all", 14, now).map(d => [dLong.format(d.day), ...NETWORKS.map(n => n0(d.vals[n.id])), n0(d.total)]));

    const upcoming = programme(eps, now).filter(o => !isLive(o.ep)).map(({ ep }) => {
      const times = NETWORKS.map(n => [n, slot(ep, n.id)]).filter(([, sl]) => sl && sl.due_at)
        .map(([n, sl]) => `${n.label} ${when(ts(sl.due_at))}`);
      return `- ${label(ep)} « ${ep.title} » (format ${formatOf(ep.number)}) : ${times.join(", ")}`;
    });

    return [
      "Tu es l'analyste d'audience de ma chaîne. Voici l'état de ses posts, relevé par ma tour de contrôle. Analyse-le et dis-moi, en français, chiffres à l'appui :",
      "1. Ce qui marche et ce qui ne marche pas, réseau par réseau.",
      "2. Quels épisodes démarrent mieux que les autres au même âge (J+1, J+3) et ce qu'ils ont en commun : œuvre, sujet, titre, format.",
      "3. L'effet du format 2 par rapport au format 1, s'il se voit déjà, et avec quelle confiance vu le nombre d'épisodes.",
      "4. La tendance : la chaîne progresse-t-elle d'un épisode à l'autre ?",
      "5. Trois actions concrètes pour les prochains épisodes, classées par impact attendu.",
      "Ne tire pas de conclusion d'un post de moins de 48 h : signale-le à part. Si je joins des captures de YouTube Studio ou TikTok Studio (rétention, vus ou balayés), croise-les avec ces chiffres.",
      "",
      "## La chaîne",
      ...CHANNEL_NOTES.map(s => `- ${s}`),
      "",
      "## Comment lire les chiffres",
      "- Sources : Buffer, qui relit chaque réseau une fois par jour (jusqu'à 24 h de retard), et les compteurs publics des posts TikTok et YouTube de moins de 14 jours, relus à chaque collecte. Pour un même chiffre, le plus haut des deux est gardé.",
      "- Engagement = (j'aime + commentaires + partages + enregistrements) / vues. Regardé = durée moyenne de visionnage / durée de la vidéo, pondérée par les vues (TikTok et Instagram seulement).",
      "- J+1, J+3, J+7 = vues cumulées tous réseaux, chaque post compté depuis sa propre mise en ligne. « — » = pas encore de donnée ou âge pas encore atteint.",
      "- L'offre gratuite de Buffer limite ses statistiques aux 31 derniers jours : un post plus vieux garde ses derniers chiffres.",
      `- Dates en heure locale (${tz}).`,
      "",
      `## État au ${when(now)}`,
      `Dernière collecte : ${when(ts(fresh.updatedAt))} · dernier relevé Buffer : ${when(ts(fresh.metricsAt))} · derniers compteurs publics : ${when(ts(fresh.liveAt))}.`,
      "",
      state,
      "",
      "## Épisodes en ligne",
      live.length ? episodes : "Aucun épisode en ligne.",
      "",
      "## Détail des posts",
      postRows.length ? posts : "Aucun post publié.",
      "",
      "## Vues gagnées par jour (14 derniers jours)",
      perDay,
      "",
      "## Programmés, pas encore en ligne",
      upcoming.length ? upcoming.join("\n") : "Rien.",
      "",
    ].join("\n");
  }

  const api = {
    NETWORKS, NET, DAY, HOUR, PENDING,
    build, slot, netsOf, lastReading, label, points, stepAt, interpAt, pubTime, isLive,
    agg, total, latestReading, gain, gain24, startOfDay, addDays, daily, curves, valueAt,
    queueEnd, programme, alerts, audience, freshness, formatOf, prompt,
    nf, nf2, cf, pf, pf0, dLong, dShort, tFmt, big, plural, at, dayLabel, inDays, niceScale,
  };
  if (typeof window !== "undefined") window.creatorView = Object.assign(window.creatorView || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
