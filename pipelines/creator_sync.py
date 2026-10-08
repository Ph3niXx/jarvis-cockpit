#!/usr/bin/env python3
"""
Buffer → Supabase : les posts de la chaîne Once Upon a Nerd et leurs chiffres
(onglet « Once Upon a Nerd », ADR-54).

Les épisodes sont publiés par le dépôt privé `youtuber` via l'API Buffer : un
épisode par jour, trois posts (TikTok, YouTube, Instagram). Buffer relit chaque
post publié sur son réseau une fois par jour (`metricsUpdatedAt`) : ses chiffres
ont jusqu'à ~24 h de retard sur les applis. Chaque run range :

  creator_episodes       l'épisode (numéro, titre YouTube, durée de la vidéo)
  creator_posts          un post Buffer (réseau, statut, dates, lien, erreur)
  creator_post_readings  un relevé par passage de Buffer — clé (post_id, read_at),
                         donc relancer le pipeline ne duplique rien
  creator_public_readings  les compteurs publics des posts TikTok et YouTube des
                         14 derniers jours, lus sur leur page à chaque run : plus
                         frais que Buffer (ADR-55)
  creator_audience       les abonnés lus sur les pages publiques TikTok et YouTube,
                         un relevé par jour de Paris (Buffer n'en donne pas)

L'épisode d'un post se lit dans l'URL de la vidéo hébergée
(`.../onceuponanerd/<épisode>.mp4`) tant que le post est programmé. Une fois
publié, Buffer remplace cette URL par sa propre copie : l'épisode vient alors de
ce que la base sait déjà, sinon d'un post frère parti le même jour à New York
(les trois créneaux de publication sont à l'heure de New York).

Usage:
    python pipelines/creator_sync.py
    python pipelines/creator_sync.py --dry-run    # lit Buffer, n'écrit rien
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BUFFER_API = "https://api.buffer.com"
NETWORKS = ("tiktok", "youtube", "instagram")
SCHEDULE_TZ = ZoneInfo("America/New_York")   # créneaux du dépôt youtuber (publish/schedule.json)
PARIS = ZoneInfo("Europe/Paris")              # un relevé d'abonnés par jour de Paris
FREE_INSIGHTS_DAYS = 31                       # « Free-plan Insights are limited to the last 31 days »
READINGS_LOOKBACK_DAYS = 40                   # au-delà, Buffer gratuit ne relit plus un post
EPISODE_IN_URL = re.compile(r"/onceuponanerd/(\d{3}-[a-z0-9-]+)\.mp4")
YOUTUBE_ID = re.compile(r"(?:shorts/|[?&]v=|youtu\.be/)([\w-]{11})")
PUBLIC_WINDOW_DAYS = 14                       # compteurs publics : les posts des deux dernières semaines
PUBLIC_PAUSE_S = 0.5                          # entre deux pages publiques
MAX_RETRIES = 3
PAGE = 1000

POSTS_QUERY = """query Posts($input: PostsInput!, $after: String) {
  posts(first: 50, after: $after, input: $input) {
    edges { node {
      id status channelService dueAt sentAt externalLink error { message }
      metricsUpdatedAt metrics { type value }
      assets { source ... on VideoAsset { video { durationMs } } }
      metadata { ... on YoutubePostMetadata { title } } } }
    pageInfo { hasNextPage endCursor } } }"""
ORGS_QUERY = "query { account { organizations { id } } }"
CHANNELS_QUERY = """query Channels($input: ChannelsInput!) {
  channels(input: $input) { service name externalLink } }"""

# Métriques Buffer → colonnes typées (le reste part tel quel dans `metrics`).
COUNTS = {"views": "views", "reactions": "reactions", "comments": "comments", "shares": "shares",
          "saves": "saves", "reach": "reach", "impressions": "impressions", "follows": "follows"}
DECIMALS = {"averageTimeWatched": "avg_watch_s", "totalTimeWatched": "total_watch_min",
            "engagementRate": "engagement_rate"}

# Pages publiques des chaînes : Buffer ne donne pas les abonnés.
WEB_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                             "(KHTML, like Gecko) Chrome/128.0 Safari/537.36",
               "Accept-Language": "en-US,en;q=0.9"}
SCALE = {"": 1, "K": 1_000, "M": 1_000_000, "B": 1_000_000_000}


def env_required(name):
    """Read a required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: Missing required environment variable: {name}")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Buffer
# ---------------------------------------------------------------------------

class BufferError(RuntimeError):
    pass


def buffer_gql(api_key, query, variables=None):
    """One GraphQL call. Network errors and 5xx are retried; GraphQL errors are not."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(BUFFER_API, json={"query": query, "variables": variables or {}},
                                 headers={"Authorization": f"Bearer {api_key}"}, timeout=60)
        except requests.RequestException as err:
            if attempt == MAX_RETRIES:
                raise
            print(f"[buffer] {err}, nouvel essai")
            time.sleep(2 ** attempt)
            continue
        if resp.status_code >= 500 and attempt < MAX_RETRIES:
            time.sleep(2 ** attempt)
            continue
        try:
            body = resp.json()
        except ValueError:
            body = None
        if isinstance(body, dict) and body.get("errors"):
            raise BufferError("; ".join(e.get("message", str(e)) for e in body["errors"]))
        if resp.status_code != 200 or not isinstance(body, dict) or "data" not in body:
            raise BufferError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        return body["data"]
    raise BufferError("max retries exceeded")


def iso_utc(moment):
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def fetch_posts(api_key, since=None):
    """Every post of every organization, oldest due first; `since` keeps those due from then."""
    nodes = []
    for org in buffer_gql(api_key, ORGS_QUERY)["account"]["organizations"]:
        query = {"organizationId": org["id"], "sort": [{"field": "dueAt", "direction": "asc"}]}
        if since:
            query["filter"] = {"dueAt": {"start": iso_utc(since)}}
        after = None
        while True:
            page = buffer_gql(api_key, POSTS_QUERY, {"input": query, "after": after})["posts"]
            nodes += [edge["node"] for edge in page["edges"]]
            if not page["pageInfo"]["hasNextPage"]:
                break
            after = page["pageInfo"]["endCursor"]
    return nodes


def fetch_posts_within_plan(api_key, now):
    """All posts; on Buffer's free plan, only the last 31 days if Buffer refuses older insights.
    Returns (nodes, since) — `since` is None when Buffer answered for every post."""
    try:
        return fetch_posts(api_key), None
    except BufferError as err:
        if "limited to the last" not in str(err):
            raise
        since = now - timedelta(days=FREE_INSIGHTS_DAYS - 1)
        print(f"[buffer] {err} — repli sur les posts dus depuis {since:%Y-%m-%d}")
        return fetch_posts(api_key, since), since


def fetch_channels(api_key):
    out = []
    for org in buffer_gql(api_key, ORGS_QUERY)["account"]["organizations"]:
        out += buffer_gql(api_key, CHANNELS_QUERY, {"input": {"organizationId": org["id"]}})["channels"]
    return [c for c in out if c["service"] in NETWORKS]


# ---------------------------------------------------------------------------
# Transformations (pures, testées par tests/test_creator_sync.py)
# ---------------------------------------------------------------------------

def parse_ts(stamp):
    return datetime.fromisoformat(stamp.replace("Z", "+00:00")) if stamp else None


def episode_in_assets(node):
    """The episode folder in the hosted video's URL, while Buffer still points at it."""
    for asset in node.get("assets") or []:
        found = EPISODE_IN_URL.search(asset.get("source") or "")
        if found:
            return found.group(1)
    return None


def schedule_day(node):
    due = parse_ts(node.get("dueAt"))
    return due.astimezone(SCHEDULE_TZ).date().isoformat() if due else None


def assign_episodes(nodes, known):
    """post_id → episode folder. What the base already knows wins, then the video URL, then a sibling
    post due the same New York day (one episode a day, three posts)."""
    mapping = {}
    for node in nodes:
        episode = known.get(node["id"]) or episode_in_assets(node)
        if episode:
            mapping[node["id"]] = episode
    by_day = {}
    for node in nodes:
        if node["id"] in mapping and schedule_day(node):
            by_day.setdefault(schedule_day(node), set()).add(mapping[node["id"]])
    for node in nodes:
        siblings = by_day.get(schedule_day(node)) or set()
        if node["id"] not in mapping and len(siblings) == 1:
            mapping[node["id"]] = next(iter(siblings))
    return mapping


def episode_rows(nodes, mapping, existing, now):
    """One row per episode. A field Buffer no longer gives (the video's duration once the post is
    out) keeps its stored value instead of being overwritten with null."""
    rows = {}
    for node in nodes:
        slug = mapping.get(node["id"])
        if not slug:
            continue
        old = existing.get(slug, {})
        row = rows.setdefault(slug, {"slug": slug, "number": int(slug.split("-")[0]),
                                     "title": old.get("title"), "video_seconds": old.get("video_seconds"),
                                     "first_due_at": old.get("first_due_at") or node.get("dueAt"),
                                     "updated_at": now.isoformat()})
        title = (node.get("metadata") or {}).get("title")
        if title:
            row["title"] = title
        for asset in node.get("assets") or []:
            duration = ((asset or {}).get("video") or {}).get("durationMs")
            if duration:
                row["video_seconds"] = round(duration / 1000, 1)
        if node.get("dueAt") and (not row["first_due_at"] or parse_ts(node["dueAt"]) < parse_ts(row["first_due_at"])):
            row["first_due_at"] = node["dueAt"]
    return list(rows.values())


def post_rows(nodes, mapping, now):
    return [{"post_id": n["id"], "episode": mapping.get(n["id"]), "network": n["channelService"],
             "status": n["status"], "due_at": n.get("dueAt"), "sent_at": n.get("sentAt"),
             "url": n.get("externalLink"), "error": (n.get("error") or {}).get("message"),
             "updated_at": now.isoformat()}
            for n in nodes if n["channelService"] in NETWORKS]


def missing_rows(stored, nodes, since, now):
    """Posts the base knows but Buffer no longer returns: deleted in Buffer (a failed post is deleted
    before being scheduled again). Marked `missing`, figures kept. A post due before `since` is only
    outside the window Buffer was asked about, not gone."""
    seen = {n["id"] for n in nodes}
    out = []
    for row in stored:
        if row["post_id"] in seen or row["status"] == "missing":
            continue
        if since and row.get("due_at") and parse_ts(row["due_at"]) < since:
            continue
        out.append({**row, "status": "missing", "updated_at": now.isoformat()})
    return out


def reading_row(node, last):
    """The post's figures as one reading, or None. Skipped: no figures yet, a Buffer refresh from
    before the post went out, the refresh already stored, and an all-zero reading after real figures
    (Buffer stopped reporting the post: keeping it would draw a collapse that never happened)."""
    metrics, read_at, sent_at = node.get("metrics"), node.get("metricsUpdatedAt"), node.get("sentAt")
    if not (metrics and read_at and sent_at) or parse_ts(read_at) <= parse_ts(sent_at):
        return None
    if last and parse_ts(last["read_at"]) >= parse_ts(read_at):
        return None
    figures = {m["type"]: m["value"] for m in metrics}
    if last and not any(figures.values()) and any(last.get(c) for c in ("views", "reactions", "comments")):
        return None
    row = {"post_id": node["id"], "read_at": read_at, "metrics": figures}
    for name, column in COUNTS.items():
        row[column] = int(round(figures[name])) if figures.get(name) is not None else None
    for name, column in DECIMALS.items():
        row[column] = round(figures[name], 2) if figures.get(name) is not None else None
    return row


def tiktok_followers(html):
    """TikTok's profile page embeds its stats as JSON: followers and the likes of all the videos."""
    followers, likes = re.search(r'"followerCount":(\d+)', html), re.search(r'"heartCount":(\d+)', html)
    if not followers:
        return None
    return {"followers": int(followers.group(1)), "likes": int(likes.group(1)) if likes else None}


def youtube_followers(html):
    """YouTube's channel header: "12 subscribers", rounded by YouTube past 1,000 ("1.2K subscribers").
    Absent while the channel has none."""
    found = re.search(r'"content":"([\d.,]+)([KMB]?) subscribers?"', html)
    if not found:
        return None
    return {"followers": round(float(found.group(1).replace(",", "")) * SCALE[found.group(2)]), "likes": None}


PARSERS = {"tiktok": tiktok_followers, "youtube": youtube_followers}


def tiktok_counts(html):
    """The video's own stats, from the JSON TikTok embeds in the page (a bare regex would also catch
    the author's stats, which carry the same key names)."""
    found = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">(.*?)</script>',
                      html, re.S)
    try:
        stats = json.loads(found.group(1))["__DEFAULT_SCOPE__"]["webapp.video-detail"]["itemInfo"]["itemStruct"]["stats"]
    except (AttributeError, KeyError, TypeError, ValueError):
        return None
    count = lambda key: int(stats[key]) if str(stats.get(key, "")).isdigit() else None
    if count("playCount") is None:
        return None
    return {"views": count("playCount"), "likes": count("diggCount"), "comments": count("commentCount"),
            "shares": count("shareCount"), "saves": count("collectCount")}


def youtube_counts(html):
    """The watch page's own counters: views (videoDetails) and likes. Comments load separately."""
    views, likes = re.search(r'"viewCount":"(\d+)"', html), re.search(r'"likeCount":"(\d+)"', html)
    if not views:
        return None
    return {"views": int(views.group(1)), "likes": int(likes.group(1)) if likes else None,
            "comments": None, "shares": None, "saves": None}


def public_counts(network, url):
    """Live counters on the post's public page. Best effort: None when unreadable."""
    try:
        if network == "youtube":
            video = YOUTUBE_ID.search(url or "")
            if not video:
                return None
            resp = requests.get("https://www.youtube.com/watch", params={"v": video.group(1), "hl": "en"},
                                headers=WEB_HEADERS, cookies={"SOCS": "CAI"}, timeout=30)
            resp.raise_for_status()
            return youtube_counts(resp.text)
        if network == "tiktok" and url:
            resp = requests.get(url, headers=WEB_HEADERS, timeout=30)
            resp.raise_for_status()
            return tiktok_counts(resp.text)
    except requests.RequestException as err:
        print(f"[public] {network}: {err}")
    return None


def public_rows(nodes, now, fetch=public_counts, pause=PUBLIC_PAUSE_S):
    """One reading of the public counters per TikTok and YouTube post sent in the last 14 days.
    Buffer reads each network once a day; these pages answer at once."""
    rows = []
    for node in nodes:
        sent = parse_ts(node.get("sentAt"))
        if (node["status"] != "sent" or not sent or node["channelService"] not in ("tiktok", "youtube")
                or not node.get("externalLink") or now - sent > timedelta(days=PUBLIC_WINDOW_DAYS)):
            continue
        counts = fetch(node["channelService"], node["externalLink"])
        if counts:
            rows.append({"post_id": node["id"], "read_at": now.isoformat(), **counts})
        time.sleep(pause)
    return rows


def read_followers(service, url):
    """Best effort: None when the page is unreadable (Instagram answers anonymous requests with 429,
    and some CDNs block the runners' datacenter IPs, cf. ADR-44)."""
    if service not in PARSERS or not url:
        return None
    try:
        resp = requests.get(url, headers=WEB_HEADERS, cookies={"SOCS": "CAI"},
                            params={"hl": "en"} if service == "youtube" else None, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as err:
        print(f"[audience] {service}: {err}")
        return None
    return PARSERS[service](resp.text)


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

def sb_headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sb_get_all(url, key, table, params):
    """Every row, 1000 at a time (PostgREST caps a response at 1000 rows)."""
    out, offset = [], 0
    while True:
        resp = requests.get(f"{url}/rest/v1/{table}", headers=sb_headers(key),
                            params={**params, "limit": PAGE, "offset": offset}, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
        out += rows
        if len(rows) < PAGE:
            return out
        offset += PAGE


def sb_upsert(url, key, table, rows):
    """Upsert on the primary key. Fails loudly: a run that wrote nothing must not end green."""
    for i in range(0, len(rows), 500):
        resp = requests.post(f"{url}/rest/v1/{table}",
                             headers={**sb_headers(key), "Prefer": "resolution=merge-duplicates,return=minimal"},
                             data=json.dumps(rows[i:i + 500], default=str), timeout=30)
        if resp.status_code not in (200, 201, 204):
            raise RuntimeError(f"upsert {table}: HTTP {resp.status_code} {resp.text[:300]}")
    return len(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def sync(dry_run=False):
    now = datetime.now(timezone.utc)
    print("=" * 60)
    print(f"  Once Upon a Nerd — {now:%Y-%m-%d %H:%M UTC} — {'DRY-RUN' if dry_run else 'LIVE'}")
    print("=" * 60)
    api_key = env_required("BUFFER_API_KEY")
    supabase_url = env_required("SUPABASE_URL") if not dry_run else os.environ.get("SUPABASE_URL")
    service_key = env_required("SUPABASE_SERVICE_KEY") if not dry_run else os.environ.get("SUPABASE_SERVICE_KEY")
    read_db = bool(supabase_url and service_key)

    nodes, since = fetch_posts_within_plan(api_key, now)
    nodes = [n for n in nodes if n["channelService"] in NETWORKS]
    stored, known, existing, last = [], {}, {}, {}
    if read_db:
        stored = sb_get_all(supabase_url, service_key, "creator_posts",
                            {"select": "post_id,episode,network,status,due_at,sent_at,url,error"})
        known = {r["post_id"]: r["episode"] for r in stored if r["episode"]}
        existing = {r["slug"]: r for r in sb_get_all(supabase_url, service_key, "creator_episodes", {"select": "*"})}
        recent = (now - timedelta(days=READINGS_LOOKBACK_DAYS)).isoformat()
        for r in sb_get_all(supabase_url, service_key, "creator_post_readings",
                            {"select": "post_id,read_at,views,reactions,comments",
                             "read_at": f"gte.{recent}", "order": "read_at.asc"}):
            last[r["post_id"]] = r

    mapping = assign_episodes(nodes, known)
    episodes = episode_rows(nodes, mapping, existing, now)
    posts = post_rows(nodes, mapping, now) + missing_rows(stored, nodes, since, now)
    readings = [r for r in (reading_row(n, last.get(n["id"])) for n in nodes) if r]
    live = public_rows(nodes, now)
    unmapped = [n["id"] for n in nodes if n["id"] not in mapping]
    print(f"[buffer] {len(nodes)} posts ({sum(n['status'] == 'sent' for n in nodes)} publiés), "
          f"{len(episodes)} épisodes, {len(readings)} relevés neufs"
          + (f", {len(unmapped)} posts sans épisode" if unmapped else "")
          + (f" — fenêtre gratuite depuis {since:%Y-%m-%d}" if since else ""))
    print(f"[public] {len(live)} compteurs publics lus")

    audience = []
    for channel in fetch_channels(api_key):
        figures = read_followers(channel["service"], channel.get("externalLink"))
        if figures:
            audience.append({"network": channel["service"], "day": now.astimezone(PARIS).date().isoformat(),
                             "followers": figures["followers"], "likes": figures["likes"],
                             "read_at": now.isoformat()})
    seen = ", ".join(f"{a['network']} {a['followers']}" for a in audience)
    print(f"[audience] {seen or 'aucune page lisible'}")

    if dry_run:
        for row in readings:
            print(f"[dry-run] {mapping.get(row['post_id'], '?')} {row['post_id']} {row['read_at']} vues={row['views']}")
        for row in live:
            print(f"[dry-run] public {mapping.get(row['post_id'], '?')} {row['post_id']} vues={row['views']} j'aime={row['likes']}")
        return
    sb_upsert(supabase_url, service_key, "creator_episodes", episodes)
    sb_upsert(supabase_url, service_key, "creator_posts", posts)
    sb_upsert(supabase_url, service_key, "creator_post_readings", readings)
    sb_upsert(supabase_url, service_key, "creator_public_readings", live)
    sb_upsert(supabase_url, service_key, "creator_audience", audience)
    print("DONE")


if __name__ == "__main__":
    try:
        sync(dry_run="--dry-run" in sys.argv)
    except (BufferError, requests.RequestException, RuntimeError) as err:
        print(f"FATAL: {err}")
        sys.exit(1)
