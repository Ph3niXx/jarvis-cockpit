"""Jarvis — Indexer: embed Supabase tables into memories_vectors.

Usage:
    python jarvis/indexer.py                  # full reindex (default)
    python jarvis/indexer.py --incremental    # only new rows since last index
    python jarvis/indexer.py --table=articles # one table only
    python jarvis/indexer.py --dry-run        # show what would be indexed
"""

import argparse
import sys
import time

from config import EMBEDDING_DIM
from embeddings import embed_text, embed_batch
from supabase_client import sb_get, sb_post

# ── Table definitions ──────────────────────────────────────────────

TABLE_DEFS = {
    "articles": {
        "pk": "id",
        "date_col": "fetch_date",
        "build": lambda row: _build_articles(row),
        "meta": lambda row: {
            "title": row.get("title", ""),
            "source": row.get("source", ""),
            "section": row.get("section", ""),
            "url": row.get("url", ""),
            "date": row.get("fetch_date", ""),
        },
    },
    "wiki_concepts": {
        "pk": "slug",
        "date_col": "updated_at",
        "build": lambda row: _build_wiki(row),
        "meta": lambda row: {
            "name": row.get("name", ""),
            "category": row.get("category", ""),
            "slug": row.get("slug", ""),
        },
    },
    "weekly_opportunities": {
        "pk": "id",
        "date_col": "week_start",
        "build": lambda row: _build_opportunities(row),
        "meta": lambda row: {
            "title": row.get("usecase_title", ""),
            "sector": row.get("sector", ""),
            "category": row.get("category", ""),
            "relevance_score": row.get("relevance_score", 0),
            "week_start": row.get("week_start", ""),
        },
    },
    "business_ideas": {
        "pk": "id",
        "date_col": "created_at",
        "build": lambda row: _build_ideas(row),
        "meta": lambda row: {
            "title": row.get("title", ""),
            "sector": row.get("sector", ""),
            "status": row.get("status", ""),
        },
    },
    "rte_usecases": {
        "pk": "id",
        "date_col": None,
        "build": lambda row: _build_rte(row),
        "meta": lambda row: {
            "tool_label": row.get("tool_label", ""),
            "usecase": row.get("usecase", ""),
        },
    },
    "user_profile": {
        "pk": "key",
        "date_col": "updated_at",
        "build": None,  # special handling: concat all rows
        "meta": lambda row: {"type": "profile_aggregate"},
    },
    "profile_facts": {
        "pk": "id",
        "date_col": "created_at",
        "build": lambda row: _build_profile_facts(row),
        "meta": lambda row: {
            "fact_type": row.get("fact_type", ""),
            "confidence": row.get("confidence", 0),
            "source": row.get("source", ""),
        },
    },
    "entities": {
        "pk": "id",
        "date_col": "created_at",
        "build": lambda row: _build_entities(row),
        "meta": lambda row: {
            "entity_type": row.get("entity_type", ""),
            "name": row.get("name", ""),
            "mentions_count": row.get("mentions_count", 0),
        },
    },
}


# ── Content builders ───────────────────────────────────────────────

def _join(*parts):
    return "\n\n".join(p for p in parts if p and str(p).strip())


def _build_articles(row):
    return _join(
        row.get("title", ""),
        row.get("summary", ""),
        f"Source: {row.get('source', '')} | Section: {row.get('section', '')}",
    )


def _build_wiki(row):
    return _join(
        f"{row.get('name', '')} ({row.get('category', '')})",
        row.get("summary_beginner", ""),
        row.get("summary_intermediate", ""),
        row.get("summary_advanced", ""),
    )


def _build_opportunities(row):
    return _join(
        row.get("usecase_title", ""),
        row.get("usecase_description", ""),
        f"Secteur: {row.get('sector', '')} | Catégorie: {row.get('category', '')}",
        f"Client cible: {row.get('who_pays', '')}",
        f"Taille marché: {row.get('market_size', '')} | Effort: {row.get('effort_to_build', '')}",
        row.get("relevance_why", ""),
        f"Prochaine étape: {row.get('next_step', '')}",
    )


def _build_ideas(row):
    return _join(
        row.get("title", ""),
        row.get("description", ""),
        f"Secteur: {row.get('sector', '')}",
    )


def _build_rte(row):
    return _join(
        f"{row.get('tool_label', '')}: {row.get('usecase', '')}",
        row.get("description", ""),
    )


def _build_profile_facts(row):
    return f"{row.get('fact_type', '')}: {row.get('fact_text', '')}"


def _build_entities(row):
    return _join(
        f"{row.get('entity_type', '')} — {row.get('name', '')}",
        row.get("description", ""),
    )


def _build_user_profile(rows):
    """Concat all key:value pairs from user_profile into a single document."""
    lines = []
    for row in sorted(rows, key=lambda r: r.get("key", "")):
        k = row.get("key", "")
        v = row.get("value", "")
        if k and v:
            lines.append(f"{k}: {v}")
    return "\n".join(lines)


# ── Chunking ───────────────────────────────────────────────────────

def chunk_text(text: str, max_chars: int = 1500, overlap: int = 200) -> list[str]:
    """Split text into chunks by paragraph, respecting max_chars with overlap."""
    if not text or len(text) <= max_chars:
        return [text] if text else []

    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current) + len(para) + 2 <= max_chars:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current.strip())
                # Overlap: keep the tail of the previous chunk
                if overlap > 0 and len(current) > overlap:
                    current = current[-overlap:] + "\n\n" + para
                else:
                    current = para
            else:
                # Single paragraph exceeds max_chars — force split by sentences
                chunks.extend(_split_long_paragraph(para, max_chars, overlap))
                current = ""

    if current.strip():
        chunks.append(current.strip())

    return chunks


def _split_long_paragraph(text: str, max_chars: int, overlap: int) -> list[str]:
    """Split a single long paragraph by sentence boundaries."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}" if current else sentence
        else:
            if current:
                chunks.append(current.strip())
            current = sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks


# ── Indexing logic ─────────────────────────────────────────────────

def fetch_rows(table: str, date_col: str | None, since: str | None) -> list:
    """Fetch rows from a Supabase table, optionally filtered by date."""
    params = "order=id" if table != "user_profile" else "order=key"

    if since and date_col:
        params += f"&{date_col}=gt.{since}"

    # Paginate for large tables
    all_rows = []
    limit = 200
    offset = 0

    while True:
        page_params = f"{params}&limit={limit}&offset={offset}"
        rows = sb_get(table, page_params)
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < limit:
            break
        offset += limit

    return all_rows


def get_last_indexed_date(table: str) -> str | None:
    """Get the most recent created_at from memories_vectors for a given source table."""
    rows = sb_get(
        "memories_vectors",
        f"source_table=eq.{table}&select=created_at&order=created_at.desc&limit=1",
    )
    if rows and rows[0].get("created_at"):
        return rows[0]["created_at"]
    return None


def index_table(table: str, incremental: bool = False, dry_run: bool = False) -> dict:
    """Index a single table into memories_vectors."""
    tdef = TABLE_DEFS[table]
    pk = tdef["pk"]
    date_col = tdef["date_col"]

    # Determine cutoff for incremental mode
    since = None
    if incremental and date_col:
        since = get_last_indexed_date(table)
        if since:
            print(f"  Incremental: indexing rows after {since}")

    # Special handling for user_profile (aggregate into one document)
    if table == "user_profile":
        return _index_user_profile(dry_run)

    # Fetch source rows
    rows = fetch_rows(table, date_col, since)
    if not rows:
        print(f"  No rows to index.")
        return {"chunks": 0, "rows": 0}

    # Build chunks
    all_chunks = []
    for row in rows:
        source_id = str(row.get(pk, ""))
        text = tdef["build"](row)
        if not text or not text.strip():
            continue

        chunks = chunk_text(text)
        meta = tdef["meta"](row)

        for idx, chunk in enumerate(chunks):
            all_chunks.append({
                "source_table": table,
                "source_id": source_id,
                "chunk_index": idx,
                "chunk_text": chunk,
                "metadata": meta,
            })

    print(f"  {len(rows)} rows -> {len(all_chunks)} chunks")

    if dry_run:
        return {"chunks": len(all_chunks), "rows": len(rows)}

    if not all_chunks:
        return {"chunks": 0, "rows": len(rows)}

    # Embed in batches
    texts = [c["chunk_text"] for c in all_chunks]
    print(f"  Embedding {len(texts)} chunks...")
    vectors = embed_batch(texts, batch_size=32, verbose=True)

    # Upsert in batches of 50
    upserted = 0
    for i in range(0, len(all_chunks), 50):
        batch = []
        for j, chunk in enumerate(all_chunks[i:i + 50]):
            batch.append({
                **chunk,
                "embedding": vectors[i + j],
            })

        ok = sb_post("memories_vectors", batch, upsert=True)
        if ok:
            upserted += len(batch)

        pct = min(i + 50, len(all_chunks)) * 100 // len(all_chunks)
        print(f"  Upsert: {min(i + 50, len(all_chunks))}/{len(all_chunks)} ({pct}%)", end="\r")

    print()
    return {"chunks": upserted, "rows": len(rows)}


def _index_user_profile(dry_run: bool) -> dict:
    """Index user_profile as a single aggregated document."""
    rows = sb_get("user_profile", "order=key")
    if not rows:
        print("  No profile data.")
        return {"chunks": 0, "rows": 0}

    text = _build_user_profile(rows)
    chunks = chunk_text(text)
    print(f"  {len(rows)} keys -> {len(chunks)} chunks")

    if dry_run:
        return {"chunks": len(chunks), "rows": len(rows)}

    vectors = embed_batch([c for c in chunks], batch_size=32)

    records = []
    for idx, chunk in enumerate(chunks):
        records.append({
            "source_table": "user_profile",
            "source_id": "user_profile_all",
            "chunk_index": idx,
            "chunk_text": chunk,
            "embedding": vectors[idx],
            "metadata": {"type": "profile_aggregate"},
        })

    ok = sb_post("memories_vectors", records, upsert=True)
    return {"chunks": len(records) if ok else 0, "rows": len(rows)}


# ── Main ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Jarvis — Index Supabase tables into memories_vectors")
    parser.add_argument("--full", action="store_true", default=True, help="Full reindex (default)")
    parser.add_argument("--incremental", action="store_true", help="Only index new rows")
    parser.add_argument("--table", type=str, help="Index a specific table only")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be indexed without writing")
    args = parser.parse_args()

    incremental = args.incremental

    # Validate embedding dimension at startup
    print("=" * 60)
    print("JARVIS — Indexer")
    print("=" * 60)

    print(f"\nValidating embedding model (expected dim={EMBEDDING_DIM})...")
    test_vec = embed_text("test")
    actual_dim = len(test_vec)
    if actual_dim != EMBEDDING_DIM:
        print(f"[ERROR] Embedding dimension mismatch: model produces {actual_dim}, config expects {EMBEDDING_DIM}")
        print(f"  -> Update EMBEDDING_DIM in config.py or switch model.")
        sys.exit(1)
    print(f"  OK: {EMBEDDING_DIM}-dim vectors\n")

    # Determine which tables to index
    tables = list(TABLE_DEFS.keys())
    if args.table:
        if args.table not in TABLE_DEFS:
            print(f"[ERROR] Unknown table: {args.table}")
            print(f"  Available: {', '.join(tables)}")
            sys.exit(1)
        tables = [args.table]

    mode = "DRY RUN" if args.dry_run else ("incremental" if incremental else "full")
    print(f"Mode: {mode}")
    print(f"Tables: {', '.join(tables)}\n")

    t0 = time.perf_counter()
    total_chunks = 0
    total_rows = 0

    for table in tables:
        print(f"[{table}]")
        stats = index_table(table, incremental=incremental, dry_run=args.dry_run)
        total_chunks += stats["chunks"]
        total_rows += stats["rows"]
        print()

    elapsed = time.perf_counter() - t0

    print("=" * 60)
    print(f"Done in {elapsed:.1f}s")
    print(f"  Rows processed: {total_rows}")
    print(f"  Chunks {'(would be)' if args.dry_run else ''} indexed: {total_chunks}")
    if total_chunks > 0 and elapsed > 0:
        print(f"  Speed: {total_chunks / elapsed:.1f} chunks/s")
    print("=" * 60)


if __name__ == "__main__":
    main()
