// Tests du module de présentation de l'onglet Once Upon a Nerd (JS pur, sans DOM).
// Run: node tests/test_creator_view.mjs
process.env.TZ = "Europe/Paris";   // jours locaux déterministes
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const V = require(join(here, "..", "cockpit", "lib", "creator-view.js"));

let failures = 0;
function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) { failures++; console.log(`FAIL ${name}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(got)}`); }
  else console.log(`ok   ${name}`);
}

const NOW = Date.parse("2026-10-10T12:00:00Z");
const raw = {
  episodes: [
    { slug: "001-naruto", number: 1, title: "Nine-Tails", video_seconds: 60 },
    { slug: "002-jjk", number: 2, title: "Sukuna", video_seconds: 60 },
  ],
  posts: [
    { post_id: "a", episode: "001-naruto", network: "tiktok", status: "sent", due_at: "2026-10-08T16:30:00Z", sent_at: "2026-10-08T16:32:00Z" },
    { post_id: "b", episode: "001-naruto", network: "youtube", status: "error", due_at: "2026-10-08T18:00:00Z", error: "Video rejected" },
    { post_id: "b2", episode: "001-naruto", network: "youtube", status: "sent", due_at: "2026-10-09T18:00:00Z", sent_at: "2026-10-09T18:01:00Z" },
    { post_id: "c", episode: "002-jjk", network: "tiktok", status: "scheduled", due_at: "2026-10-11T16:30:00Z" },
    { post_id: "z", episode: "999-inconnu", network: "tiktok", status: "sent" },
  ],
  readings: [
    { post_id: "a", read_at: "2026-10-09T20:00:00Z", views: 300, reactions: 30, comments: 3, shares: 3, avg_watch_s: 30 },
    { post_id: "a", read_at: "2026-10-08T20:00:00Z", views: 100, reactions: 10 },
    { post_id: "b2", read_at: "2026-10-09T20:00:00Z", views: 50 },
  ],
  audience: [
    { network: "tiktok", day: "2026-10-02", followers: 10 },
    { network: "tiktok", day: "2026-10-09", followers: 25 },
  ],
};
const eps = V.build(raw);

// ── build : un post reprogrammé après un échec remplace l'ancien ──
check("deux episodes, le post inconnu est ignore", eps.map(e => e.slug), ["001-naruto", "002-jjk"]);
check("le post publie l'emporte sur l'echec du meme reseau", V.slot(eps[0], "youtube").postId, "b2");
check("releves tries dans le temps", V.slot(eps[0], "tiktok").readings.map(r => r.views), [100, 300]);

// ── Agrégats ──────────────────────────────────────────────────
const all = V.agg(eps, "all");
check("vues = dernier releve de chaque post", all.views, 350);
check("engagement = (j'aime + commentaires + partages) / vues", Math.round(all.eng * 1000) / 1000, 0.103);
check("regarde = duree moyenne / duree de la video, ponderee", all.watched, 0.5);
check("posts en ligne sur programmes", [all.live, all.planned], [2, 3]);
check("gain sur 24 h : ecart avec le releve de la veille", V.gain24(eps, "all"), 250);

// ── Vues par jour (jours de Paris) ────────────────────────────
const days = V.daily(eps, "all", 30, NOW);
check("un jour par date depuis la premiere publication", days.map(d => d.total), [100, 250, 0]);
check("repartition par reseau du 9 octobre", days[1].vals, { tiktok: 200, youtube: 50, instagram: 0 });

// ── Démarrage ─────────────────────────────────────────────────
const cs = V.curves(eps, "tiktok");
check("une courbe par episode avec des releves", cs.map(c => c.ep.slug), ["001-naruto"]);
check("vues a J+0 = 0", V.valueAt(cs[0], 0), 0);
check("pas de valeur au-dela du dernier releve", V.valueAt(cs[0], 5), null);

// ── Programmation, alertes, abonnés ───────────────────────────
check("fin de file : #2 demain", [V.label(V.queueEnd(eps, NOW).ep), V.queueEnd(eps, NOW).days], ["#2", 1]);
check("alertes : file qui se termine, pas l'echec remplace",
      V.alerts(eps, "2026-10-10T06:40:00Z", NOW).map(a => a.sev), ["warn"]);
check("alerte collecte arretee apres 36 h",
      V.alerts(eps, "2026-10-08T06:40:00Z", NOW).some(a => a.text.startsWith("Dernière collecte il y a 2")), true);
check("abonnes : dernier releve et ecart sur 7 jours", V.audience(raw.audience, "tiktok"),
      { followers: 25, likes: null, day: "2026-10-09", change: 15 });
check("fraicheur : dernier releve Buffer", V.freshness(raw).metricsAt, "2026-10-09T20:00:00.000Z");

// ── Formats ───────────────────────────────────────────────────
check("echelle ronde", V.niceScale(350), { max: 400, step: 100 });
check("echelle vide", V.niceScale(0), { max: 10, step: 5 });
check("libelle de jour", V.dayLabel(Date.parse("2026-10-11T16:30:00Z"), NOW), "demain");

// ── Compteurs publics (ADR-55) ────────────────────────────────
// Buffer relit une fois par jour ; le compteur public est plus frais, et un
// relevé Buffer en retard ne doit jamais faire reculer une courbe.
const withLive = V.build({
  episodes: [{ slug: "001-naruto", number: 1, title: "Nine-Tails", video_seconds: 60 }],
  posts: [{ post_id: "y", episode: "001-naruto", network: "youtube", status: "sent",
            due_at: "2026-10-08T18:00:00Z", sent_at: "2026-10-08T18:00:51Z" }],
  readings: [{ post_id: "y", read_at: "2026-10-08T18:03:42Z", views: 0, reactions: 0 },
             { post_id: "y", read_at: "2026-10-09T20:01:00Z", views: 90, reactions: 4 }],
  live: [{ post_id: "y", read_at: "2026-10-08T18:50:00Z", views: 32, likes: 2 },
         { post_id: "y", read_at: "2026-10-09T06:40:00Z", views: 120, likes: 6 }],
});
const ySlot = V.slot(withLive[0], "youtube");
check("courbe : jamais de recul quand Buffer est en retard sur le compteur public",
      V.points(ySlot).map(p => p[1]), [0, 0, 32, 120, 120]);
const yLast = V.lastReading(ySlot);
check("dernier etat : le plus haut des deux sources, chiffre par chiffre",
      [yLast.views, yLast.reactions], [120, 6]);
check("dernier etat : dates des deux sources", [yLast.liveAt, yLast.bufferAt],
      ["2026-10-09T06:40:00Z", "2026-10-09T20:01:00Z"]);
check("un post sans releve Buffer a deja sa courbe grace au compteur public",
      V.curves(V.build({ episodes: [{ slug: "e", number: 1 }],
                         posts: [{ post_id: "t", episode: "e", network: "tiktok", status: "sent", sent_at: "2026-10-08T16:32:00Z" }],
                         live: [{ post_id: "t", read_at: "2026-10-08T18:50:00Z", views: 0 }] }), "all").length, 1);

if (failures) { console.log(`\n${failures} echec(s)`); process.exit(1); }
console.log("\nTous les tests passent.");
