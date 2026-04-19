// ═══════════════════════════════════════════════════════════════
// MUSIC_DATA — Last.fm scrobbles depuis Apple Music
// ─────────────────────────────────────────────
// Ton : gros consommateur, metal dominant, anime OST secondaire.
// 30k+ scrobbles/an ~ 90-110 tracks/jour en moyenne.
// ═══════════════════════════════════════════════════════════════

(function () {
  const TODAY = new Date("2026-04-27");

  // ── Now playing ────────────────────────────────────────────────
  const now_playing = {
    artist: "Gojira",
    track: "Stranded",
    album: "Magma",
    album_art_hint: "#2a1e18",
    started_at: "il y a 2 min",
    loved: true,
    scrobble_count_track: 34,
    scrobble_count_artist: 892,
  };

  // ── Top artists (semaine, mois, 6m, all-time) ──────────────────
  const top_artists = {
    "7d": [
      { rank: 1, name: "Gojira", scrobbles: 87, change: 2, color: "#2a3d2e", genre: "death metal", new: false },
      { rank: 2, name: "Hiroyuki Sawano", scrobbles: 64, change: 5, color: "#1a2438", genre: "OST anime", new: false },
      { rank: 3, name: "Sleep Token", scrobbles: 58, change: -1, color: "#3a1e2e", genre: "prog metal", new: false },
      { rank: 4, name: "Yoko Kanno", scrobbles: 42, change: 8, color: "#2a1e38", genre: "OST anime", new: false },
      { rank: 5, name: "TOOL", scrobbles: 39, change: -2, color: "#1e1e1e", genre: "prog metal", new: false },
      { rank: 6, name: "Igorrr", scrobbles: 31, change: 0, color: "#3a2e1a", genre: "avant-garde metal", new: true },
      { rank: 7, name: "Meshuggah", scrobbles: 28, change: -3, color: "#2a2e2a", genre: "djent", new: false },
      { rank: 8, name: "Kenshi Yonezu", scrobbles: 24, change: 12, color: "#1a2a3a", genre: "J-pop", new: false },
      { rank: 9, name: "Between the Buried and Me", scrobbles: 22, change: -4, color: "#2e1e2a", genre: "prog metal", new: false },
      { rank: 10, name: "Yuki Kajiura", scrobbles: 19, change: 3, color: "#3a2e3a", genre: "OST anime", new: false },
    ],
    "30d": [
      { rank: 1, name: "Gojira", scrobbles: 342, change: 0, color: "#2a3d2e", genre: "death metal" },
      { rank: 2, name: "Sleep Token", scrobbles: 287, change: 1, color: "#3a1e2e", genre: "prog metal" },
      { rank: 3, name: "Hiroyuki Sawano", scrobbles: 241, change: -1, color: "#1a2438", genre: "OST anime" },
      { rank: 4, name: "TOOL", scrobbles: 198, change: 2, color: "#1e1e1e", genre: "prog metal" },
      { rank: 5, name: "Yoko Kanno", scrobbles: 174, change: 4, color: "#2a1e38", genre: "OST anime" },
      { rank: 6, name: "Meshuggah", scrobbles: 156, change: -2, color: "#2a2e2a", genre: "djent" },
      { rank: 7, name: "Igorrr", scrobbles: 138, change: 7, color: "#3a2e1a", genre: "avant-garde metal", new: true },
      { rank: 8, name: "Plini", scrobbles: 117, change: -1, color: "#1a2a2a", genre: "prog instrumental" },
      { rank: 9, name: "Between the Buried and Me", scrobbles: 109, change: -3, color: "#2e1e2a", genre: "prog metal" },
      { rank: 10, name: "Animals as Leaders", scrobbles: 98, change: 0, color: "#2e2a1e", genre: "prog instrumental" },
    ],
    "6m": [
      { rank: 1, name: "Gojira", scrobbles: 1847, color: "#2a3d2e", genre: "death metal" },
      { rank: 2, name: "TOOL", scrobbles: 1512, color: "#1e1e1e", genre: "prog metal" },
      { rank: 3, name: "Sleep Token", scrobbles: 1398, color: "#3a1e2e", genre: "prog metal" },
      { rank: 4, name: "Meshuggah", scrobbles: 1187, color: "#2a2e2a", genre: "djent" },
      { rank: 5, name: "Hiroyuki Sawano", scrobbles: 1056, color: "#1a2438", genre: "OST anime" },
      { rank: 6, name: "Yoko Kanno", scrobbles: 942, color: "#2a1e38", genre: "OST anime" },
      { rank: 7, name: "Opeth", scrobbles: 828, color: "#1e2a1e", genre: "prog death" },
      { rank: 8, name: "Between the Buried and Me", scrobbles: 741, color: "#2e1e2a", genre: "prog metal" },
      { rank: 9, name: "Plini", scrobbles: 658, color: "#1a2a2a", genre: "prog instrumental" },
      { rank: 10, name: "Igorrr", scrobbles: 603, color: "#3a2e1a", genre: "avant-garde metal" },
    ],
    "all": [
      { rank: 1, name: "TOOL", scrobbles: 8247, since: "2014", color: "#1e1e1e", genre: "prog metal" },
      { rank: 2, name: "Gojira", scrobbles: 7891, since: "2015", color: "#2a3d2e", genre: "death metal" },
      { rank: 3, name: "Meshuggah", scrobbles: 6342, since: "2013", color: "#2a2e2a", genre: "djent" },
      { rank: 4, name: "Opeth", scrobbles: 5821, since: "2012", color: "#1e2a1e", genre: "prog death" },
      { rank: 5, name: "Between the Buried and Me", scrobbles: 4967, since: "2014", color: "#2e1e2a", genre: "prog metal" },
      { rank: 6, name: "Yoko Kanno", scrobbles: 4183, since: "2016", color: "#2a1e38", genre: "OST anime" },
      { rank: 7, name: "Dream Theater", scrobbles: 3847, since: "2012", color: "#2a1e1e", genre: "prog metal" },
      { rank: 8, name: "Hiroyuki Sawano", scrobbles: 3621, since: "2018", color: "#1a2438", genre: "OST anime" },
      { rank: 9, name: "Mastodon", scrobbles: 3184, since: "2013", color: "#3a2a1a", genre: "sludge metal" },
      { rank: 10, name: "Yuki Kajiura", scrobbles: 2847, since: "2017", color: "#3a2e3a", genre: "OST anime" },
    ],
  };

  // ── Top tracks (30j) ───────────────────────────────────────────
  const top_tracks = [
    { rank: 1, title: "The Apparition", artist: "Sleep Token", album: "Take Me Back to Eden", plays: 47, duration: "5:21" },
    { rank: 2, title: "Stranded", artist: "Gojira", album: "Magma", plays: 43, duration: "4:28" },
    { rank: 3, title: "Silvera", artist: "Gojira", album: "Magma", plays: 38, duration: "4:22" },
    { rank: 4, title: "unicorn", artist: "Hiroyuki Sawano", album: "BEST OF VOCAL WORKS 2", plays: 34, duration: "4:51" },
    { rank: 5, title: "Chocolate", artist: "Sleep Token", album: "Take Me Back to Eden", plays: 31, duration: "4:07" },
    { rank: 6, title: "The Pot", artist: "TOOL", album: "10,000 Days", plays: 29, duration: "6:22" },
    { rank: 7, title: "Demoniac", artist: "Gojira", album: "Magma", plays: 27, duration: "6:37" },
    { rank: 8, title: "Bloody Stream", artist: "Coda", album: "JoJo OST", plays: 24, duration: "3:58" },
    { rank: 9, title: "Vicarious", artist: "TOOL", album: "10,000 Days", plays: 23, duration: "7:06" },
    { rank: 10, title: "Bleed", artist: "Meshuggah", album: "obZen", plays: 22, duration: "7:23" },
    { rank: 11, title: "Tank!", artist: "Yoko Kanno", album: "Cowboy Bebop OST", plays: 21, duration: "3:26" },
    { rank: 12, title: "Fleurs du Mal", artist: "Sleep Token", album: "Take Me Back to Eden", plays: 20, duration: "6:26" },
  ];

  // ── Top albums (30j) ───────────────────────────────────────────
  const top_albums = [
    { rank: 1, title: "Take Me Back to Eden", artist: "Sleep Token", year: 2023, plays: 248, bg: "#3a1e2e" },
    { rank: 2, title: "Magma", artist: "Gojira", year: 2016, plays: 231, bg: "#2a3d2e" },
    { rank: 3, title: "10,000 Days", artist: "TOOL", year: 2006, plays: 178, bg: "#1e1e1e" },
    { rank: 4, title: "BEST OF VOCAL WORKS 2", artist: "Hiroyuki Sawano", year: 2020, plays: 164, bg: "#1a2438" },
    { rank: 5, title: "obZen", artist: "Meshuggah", year: 2008, plays: 138, bg: "#2a2e2a" },
    { rank: 6, title: "Cowboy Bebop OST", artist: "Yoko Kanno", year: 1998, plays: 121, bg: "#2a1e38" },
    { rank: 7, title: "From Mars to Sirius", artist: "Gojira", year: 2005, plays: 109, bg: "#1e2e3a" },
    { rank: 8, title: "Blossom", artist: "Igorrr", year: 2017, plays: 87, bg: "#3a2e1a" },
  ];

  // ── Série journalière scrobbles (180 jours) ────────────────────
  const DAYS = 180;
  const daily_series = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const dow = d.getDay();
    const t = i / (DAYS - 1);
    // base 85-120 scrobbles/jour, plus gros week-ends + samedis matin
    let base = 92 + Math.sin(i * 0.31) * 18;
    if (dow === 0 || dow === 6) base += 30 + Math.random() * 25;
    // période intense fin mars (prépa deep work)
    if (t > 0.78) base += 20;
    // 2 jours creux janvier (grippe + coupure)
    if (i === 62 || i === 63 || i === 109) base *= 0.15;
    // variance
    base += (Math.random() - 0.5) * 20;
    daily_series.push({
      date: d.toISOString().slice(0, 10),
      scrobbles: Math.max(0, Math.round(base)),
    });
  }

  const total7 = daily_series.slice(-7).reduce((a, x) => a + x.scrobbles, 0);
  const total30 = daily_series.slice(-30).reduce((a, x) => a + x.scrobbles, 0);
  const totalAll = daily_series.reduce((a, x) => a + x.scrobbles, 0);
  const totalYTD = daily_series
    .filter((d) => d.date >= "2026-01-01")
    .reduce((a, x) => a + x.scrobbles, 0);

  // ── Heatmap hebdo (24h × 7j, moyenne sur 30j) ──────────────────
  // Pics matin 8-11h (deep work), après-midi creux, soir 20-23h
  const heatmap = [];
  for (let dow = 0; dow < 7; dow++) {
    const row = [];
    for (let h = 0; h < 24; h++) {
      let v = 0;
      if (h >= 8 && h <= 11) v = 8 + Math.random() * 4;
      else if (h === 7 || h === 12) v = 4 + Math.random() * 3;
      else if (h >= 14 && h <= 17) v = 5 + Math.random() * 3;
      else if (h >= 18 && h <= 20) v = 3 + Math.random() * 2;
      else if (h >= 21 && h <= 23) v = 2 + Math.random() * 1.5;
      else if (h >= 0 && h <= 5) v = 0;
      else v = 1 + Math.random();
      // week-end shifted later
      if ((dow === 0 || dow === 6) && h >= 10 && h <= 14) v += 4;
      if ((dow === 0 || dow === 6) && h >= 22) v += 2;
      row.push(+v.toFixed(1));
    }
    heatmap.push(row);
  }

  // ── Répartition genres (30j) ───────────────────────────────────
  const genres_30d = [
    { label: "Prog metal", share: 0.31, color: "#3a1e2e", change: 2 },
    { label: "Death / djent", share: 0.23, color: "#2a3d2e", change: 0 },
    { label: "OST anime", share: 0.19, color: "#1a2438", change: 3 },
    { label: "Prog instrumental", share: 0.11, color: "#1a2a2a", change: -1 },
    { label: "Avant-garde / misc.", share: 0.08, color: "#3a2e1a", change: 4 },
    { label: "J-pop / J-rock", share: 0.05, color: "#2a1e38", change: 1 },
    { label: "Autres", share: 0.03, color: "#555", change: -2 },
  ];

  // ── Découvertes (nouveaux artistes 30j) ────────────────────────
  const discoveries = [
    { artist: "Igorrr", first_scrobble: "il y a 22j", scrobbles: 138, verdict: "accroché", genre: "avant-garde metal", note: "Recommandé via Sleep Token. Plus sale que prévu, tu aimes." },
    { artist: "Plini", first_scrobble: "il y a 47j", scrobbles: 117, verdict: "accroché", genre: "prog instrumental", note: "Solide en background deep work." },
    { artist: "Spiritbox", first_scrobble: "il y a 18j", scrobbles: 32, verdict: "à creuser", genre: "metalcore mélodique", note: "2 singles écoutés, album pas encore touché." },
    { artist: "Polyphia", first_scrobble: "il y a 34j", scrobbles: 28, verdict: "à creuser", genre: "prog instrumental", note: "Technique mais peut-être trop clean pour toi." },
    { artist: "Lovebites", first_scrobble: "il y a 11j", scrobbles: 19, verdict: "à creuser", genre: "power metal japonais", note: "Piste anime via YouTube Music reco." },
    { artist: "Frederic", first_scrobble: "il y a 28j", scrobbles: 7, verdict: "abandonné", genre: "J-pop", note: "Testé 2 pistes, trop léger." },
  ];

  // ── Listening streaks ──────────────────────────────────────────
  const streaks = {
    current_daily: 127, // jours consécutifs avec au moins 1 scrobble
    longest_daily: 341,
    current_top_artist_weeks: 8, // Gojira #1 pendant 8 semaines
  };

  // ── Milestones 2026 YTD ────────────────────────────────────────
  const milestones = [
    { label: "Scrobbles 2026", value: totalYTD.toLocaleString("fr-FR"), sub: "objectif 35 000", progress: Math.min(1, totalYTD / 35000) },
    { label: "Artistes uniques", value: "847", sub: "vs 812 en 2025" },
    { label: "Nouvelles découvertes", value: "23", sub: "nouveaux artistes" },
    { label: "Albums écoutés ≥5×", value: "47", sub: "dont 18 nouveaux" },
    { label: "Heure d'écoute estimée", value: "527 h", sub: "~3h40 / jour" },
    { label: "Genre dominant", value: "Prog metal", sub: "31% du temps" },
  ];

  window.MUSIC_DATA = {
    now_playing,
    totals: {
      last7: total7,
      last30: total30,
      ytd: totalYTD,
      all180: totalAll,
      hours_today: 3.6,
      hours_week: 24.7,
    },
    streaks,
    top_artists,
    top_tracks,
    top_albums,
    daily_series,
    heatmap,
    genres_30d,
    discoveries,
    milestones,
  };
})();
