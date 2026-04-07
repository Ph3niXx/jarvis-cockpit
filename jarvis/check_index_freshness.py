"""Jarvis — Check if indexation is needed by comparing source row counts.

Exit codes:
  0 = new rows to index (indexation needed)
  1 = everything up to date (nothing to do)
  2 = error (Supabase unreachable, table missing, etc.)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from supabase_client import sb_get

# Tables to check — must match indexer.py TABLE_DEFS
# user_profile is special: always 1 aggregated doc
TABLES = ["articles", "wiki_concepts", "weekly_opportunities", "business_ideas", "rte_usecases"]


def count_source_rows(table: str) -> int | None:
    """Count rows in a source table. Returns None on error."""
    try:
        rows = sb_get(table, "select=id&limit=10000")
        if table == "user_profile":
            rows = sb_get(table, "select=key&limit=10000")
        return len(rows) if isinstance(rows, list) else None
    except Exception:
        return None


def count_indexed(table: str) -> int | None:
    """Count distinct source_ids indexed for a given source table."""
    try:
        rows = sb_get("memories_vectors", f"source_table=eq.{table}&select=source_id&limit=10000")
        if not isinstance(rows, list):
            return None
        return len(set(r.get("source_id", "") for r in rows))
    except Exception:
        return None


def main():
    print("[?] Verification de la fraicheur de l'indexation...\n")

    # Check if memories_vectors exists
    test = sb_get("memories_vectors", "select=id&limit=1")
    if test is None or (isinstance(test, dict) and "message" in test):
        print("    Table memories_vectors absente, indexation initiale necessaire")
        sys.exit(0)

    total_new = 0
    errors = 0

    for table in TABLES:
        source_count = count_source_rows(table)
        if source_count is None:
            print(f"    {table:24s}: [!] table source inaccessible")
            errors += 1
            continue

        indexed_count = count_indexed(table)
        if indexed_count is None:
            indexed_count = 0

        diff = max(0, source_count - indexed_count)
        total_new += diff

        label = "source " if source_count == 1 else "sources"
        idx_label = "indexee " if indexed_count <= 1 else "indexees"
        arrow = f"-> {diff} nouvelle{'s' if diff != 1 else ''}" if diff > 0 else "-> 0 nouvelle"

        print(f"    {table:24s}: {source_count:4d} {label} / {indexed_count:4d} {idx_label} {arrow}")

    # user_profile: always 1 aggregated doc
    up_source = count_source_rows("user_profile")
    up_indexed = count_indexed("user_profile")
    if up_source is not None:
        up_diff = 1 if (up_indexed or 0) == 0 and up_source > 0 else 0
        total_new += up_diff
        print(f"    {'user_profile':24s}: {up_source:4d} keys   / {'1' if up_indexed else '0':>4s} indexee  -> {up_diff} nouvelle")

    print(f"\n    Total : {total_new} lignes a indexer")

    if errors and total_new == 0:
        sys.exit(2)

    if total_new > 0:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
