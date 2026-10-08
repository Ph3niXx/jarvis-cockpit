// ═══════════════════════════════════════════════════════════════
// CREATOR_DATA — démo de l'onglet « Once Upon a Nerd » (mode file://)
// ─────────────────────────────────────────────
// Mêmes formes que les tables creator_* : le loader (case "creator") remplace
// tout, y compris par des tables vides, et passe `_demo` à false. Les chiffres
// ci-dessous sont inventés, relatifs à l'heure d'ouverture.
// ═══════════════════════════════════════════════════════════════

(function () {
  const DAY = 864e5;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const iso = (days, h, m) => new Date(midnight.getTime() + days * DAY + (h * 60 + m) * 60000).toISOString();
  const SLOTS = { tiktok: [18, 30, 0, 1], youtube: [20, 0, 0, 0.55], instagram: [0, 30, 1, 0.3] };
  const SHOWS = [
    ["001-naruto-nine-tails", "Kishimoto Didn't Invent the Nine-Tails. He Inherited It.", 900],
    ["002-jjk-sukuna", "Jujutsu Kaisen's Sukuna Shares His Name With a Two-Faced Man Recorded in 720", 2400],
    ["003-demon-slayer-ichimatsu", "Demon Slayer Couldn't Trademark Tanjiro's Pattern. The Reason Is 280 Years Old.", 600],
    ["004-dragon-ball-goku", "Goku's Name, Cloud and Staff Come From a 1592 Novel", 1500],
    ["005-naruto-shukaku", "Naruto's Shukaku Has the Same Name as a Tanuki Monk From a Japanese Temple Legend", 700],
  ];
  const episodes = [], posts = [], readings = [];
  SHOWS.forEach(([slug, title, base], i) => {
    const day0 = i - 4;                                   // #1 il y a quatre jours, #5 aujourd'hui
    episodes.push({ slug, number: i + 1, title, video_seconds: 66, first_due_at: iso(day0, 18, 30) });
    for (const [net, [h, m, shift, scale]] of Object.entries(SLOTS)) {
      const due = iso(day0 + shift, h, m), sent = Date.parse(due) < Date.now();
      const postId = `demo-${i + 1}-${net}`;
      posts.push({ post_id: postId, episode: slug, network: net, status: sent ? "sent" : "scheduled", due_at: due,
                   sent_at: sent ? due : null, url: sent ? "https://example.com/" : null, error: null,
                   updated_at: new Date().toISOString() });
      if (!sent) continue;
      for (let k = 0; ; k++) {
        const t = Date.parse(iso(day0 + shift + k, 22, 1));
        if (t > Date.now()) break;
        if (t <= Date.parse(due)) continue;
        const age = (t - Date.parse(due)) / DAY;
        const views = Math.round(base * scale * (1 - Math.exp(-age / 1.6)));
        readings.push({ post_id: postId, read_at: new Date(t).toISOString(), views,
                        reactions: Math.round(views * 0.06), comments: Math.round(views * 0.006),
                        shares: Math.round(views * 0.01), saves: net === "instagram" ? Math.round(views * 0.02) : null,
                        reach: Math.round(views * 0.8), impressions: null, follows: null,
                        avg_watch_s: net === "youtube" ? null : 18 + (i % 3) * 6, total_watch_min: null,
                        engagement_rate: null });
      }
    }
  });
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const audience = [
    { network: "tiktok", day: ymd(midnight.getTime() - 7 * DAY), followers: 40, likes: 300 },
    { network: "tiktok", day: ymd(midnight.getTime()), followers: 212, likes: 1900 },
  ];
  window.CREATOR_DATA = { _demo: true, episodes, posts, readings, audience };
})();
