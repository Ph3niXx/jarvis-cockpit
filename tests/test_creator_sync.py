#!/usr/bin/env python3
"""Garde-fous du sync Buffer de l'onglet Once Upon a Nerd (ADR-54).
Run: python tests/test_creator_sync.py
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipelines"))
from creator_sync import (assign_episodes, episode_in_assets, episode_rows, missing_rows, post_rows, reading_row,
                          tiktok_followers, youtube_followers)

failures = 0


def check(name, got, expected):
    global failures
    if got != expected:
        failures += 1
        print(f"FAIL {name}\n  expected: {expected!r}\n  got:      {got!r}")
    else:
        print(f"ok   {name}")


NOW = datetime(2026, 10, 9, 21, 40, tzinfo=timezone.utc)
CLOUDINARY = "https://res.cloudinary.com/x/video/upload/v1/onceuponanerd/001-naruto-nine-tails.mp4"
BACKFILL = "https://buffer-updates-media-backfill-bucket.s3.amazonaws.com/a/b/p1_video.mp4"


def node(post_id, network, due, status="scheduled", source=CLOUDINARY, sent=None, metrics=None, read_at=None,
         title=None, duration_ms=None):
    video = {"durationMs": duration_ms} if duration_ms else None
    return {"id": post_id, "channelService": network, "status": status, "dueAt": due, "sentAt": sent,
            "externalLink": None, "error": None, "metricsUpdatedAt": read_at, "metrics": metrics,
            "assets": [{"source": source, "video": video}], "metadata": {"title": title} if title else {}}


# ── L'épisode d'un post ──────────────────────────────────────────
# Le piège constaté le 2026-10-08 : une fois le TikTok publié, Buffer remplace
# l'URL Cloudinary par sa propre copie, et l'épisode n'y est plus lisible.
check("episode lu dans l'URL de la video hebergee",
      episode_in_assets(node("p1", "tiktok", "2026-10-08T16:30:00.000Z")), "001-naruto-nine-tails")
check("URL remplacee par Buffer : plus d'episode",
      episode_in_assets(node("p1", "tiktok", "2026-10-08T16:30:00.000Z", source=BACKFILL)), None)

sent_tiktok = node("p1", "tiktok", "2026-10-08T16:30:00.000Z", status="sent", source=BACKFILL)
youtube = node("p2", "youtube", "2026-10-08T18:00:00.000Z")
instagram = node("p3", "instagram", "2026-10-08T22:30:00.000Z")       # 18:30 a New York, 00:30 a Paris
next_day = node("p4", "tiktok", "2026-10-09T16:30:00.000Z", source=BACKFILL)
check("un post publie herite de l'episode d'un frere du meme jour a New York",
      assign_episodes([sent_tiktok, youtube, instagram, next_day], {}),
      {"p1": "001-naruto-nine-tails", "p2": "001-naruto-nine-tails", "p3": "001-naruto-nine-tails"})
check("ce que la base sait deja l'emporte",
      assign_episodes([sent_tiktok], {"p1": "009-autre"}), {"p1": "009-autre"})

# ── Episodes : une valeur que Buffer ne donne plus ne s'efface pas ──
rows = episode_rows([node("p2", "youtube", "2026-10-08T18:00:00.000Z", source=BACKFILL, title="Kishimoto Didn't Invent")],
                    {"p2": "001-naruto-nine-tails"},
                    {"001-naruto-nine-tails": {"title": "ancien", "video_seconds": 65.8, "first_due_at": "2026-10-08T16:30:00+00:00"}},
                    NOW)
check("titre YouTube repris, duree conservee, premiere date conservee",
      (rows[0]["number"], rows[0]["title"], rows[0]["video_seconds"], rows[0]["first_due_at"]),
      (1, "Kishimoto Didn't Invent", 65.8, "2026-10-08T16:30:00+00:00"))
rows = episode_rows([node("p2", "youtube", "2026-10-08T18:00:00.000Z", duration_ms=65833)],
                    {"p2": "001-naruto-nine-tails"}, {}, NOW)
check("duree lue dans les metadonnees de la video", rows[0]["video_seconds"], 65.8)

# ── Posts : toutes les lignes ont les memes cles (upsert PostgREST groupe) ──
posts = post_rows([youtube, node("x", "twitter", "2026-10-08T18:00:00.000Z")], {"p2": "001-naruto-nine-tails"}, NOW)
check("un reseau hors perimetre est ignore", [p["post_id"] for p in posts], ["p2"])
stored = [{"post_id": "gone", "episode": "001-naruto-nine-tails", "network": "youtube", "status": "error",
           "due_at": "2026-10-08T18:00:00+00:00", "sent_at": None, "url": None, "error": "Video rejected"},
          {"post_id": "old", "episode": "000-x", "network": "tiktok", "status": "sent",
           "due_at": "2026-08-01T16:30:00+00:00", "sent_at": None, "url": None, "error": None}]
missing = missing_rows(stored, [youtube], datetime(2026, 9, 9, tzinfo=timezone.utc), NOW)
check("un post supprime de Buffer passe en missing ; un post hors fenetre gratuite reste tel quel",
      [(m["post_id"], m["status"]) for m in missing], [("gone", "missing")])
check("meme jeu de cles pour posts et posts disparus", sorted(missing[0]), sorted(posts[0]))

# ── Releves ──────────────────────────────────────────────────────
SENT = "2026-10-08T16:32:56.860Z"
figures = [{"type": "views", "value": 120.0}, {"type": "reactions", "value": 9.0},
           {"type": "averageTimeWatched", "value": 21.456}, {"type": "engagementRate", "value": 7.5}]
row = reading_row(node("p1", "tiktok", "", status="sent", sent=SENT, metrics=figures,
                       read_at="2026-10-08T20:01:45.221Z"), None)
check("un releve : colonnes typees et brut dans metrics",
      (row["views"], row["reactions"], row["avg_watch_s"], row["engagement_rate"], row["shares"], row["metrics"]["views"]),
      (120, 9, 21.46, 7.5, None, 120.0))
check("un passage de Buffer anterieur a la publication n'est pas un releve",
      reading_row(node("p1", "tiktok", "", status="sent", sent=SENT, metrics=figures,
                       read_at="2026-10-07T20:01:45.221Z"), None), None)
check("le releve deja range n'est pas reecrit",
      reading_row(node("p1", "tiktok", "", status="sent", sent=SENT, metrics=figures, read_at="2026-10-08T20:01:45.221Z"),
                  {"read_at": "2026-10-08T20:01:45.221+00:00", "views": 120}), None)
zeros = [{"type": "views", "value": 0.0}, {"type": "reactions", "value": 0.0}]
check("un releve tout a zero apres de vrais chiffres est ignore",
      reading_row(node("p1", "tiktok", "", status="sent", sent=SENT, metrics=zeros, read_at="2026-10-09T20:01:00.000Z"),
                  {"read_at": "2026-10-08T20:01:45+00:00", "views": 120, "reactions": 9, "comments": 0}), None)
check("un premier releve a zero est garde (0 vue est une vraie mesure)",
      reading_row(node("p1", "tiktok", "", status="sent", sent=SENT, metrics=zeros,
                       read_at="2026-10-08T20:01:45.221Z"), None)["views"], 0)

# ── Abonnes ──────────────────────────────────────────────────────
check("TikTok : abonnes et j'aime du profil",
      tiktok_followers('"stats":{"followerCount":1234,"heart":9,"heartCount":5678}'), {"followers": 1234, "likes": 5678})
check("YouTube : compteur arrondi par YouTube",
      youtube_followers('{"content":"1.2K subscribers"}'), {"followers": 1200, "likes": None})
check("YouTube : compteur absent (chaine a zero abonne)", youtube_followers('{"content":"@onceuponan3rd"}'), None)

if failures:
    print(f"\n{failures} echec(s)")
    sys.exit(1)
print("\nTous les tests passent.")
