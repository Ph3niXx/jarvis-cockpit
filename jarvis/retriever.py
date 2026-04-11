"""Jarvis — Semantic search over memories_vectors via pgvector."""

from config import RAG_TOP_K, RAG_SIMILARITY_THRESHOLD
from embeddings import embed_text
from supabase_client import sb_rpc


def search(
    query: str,
    k: int = None,
    threshold: float = None,
    source_filter: str | None = None,
    query_vector: list[float] | None = None,
) -> list[dict]:
    """Search the k most relevant chunks for a query.

    Args:
        query: natural language question
        k: number of results (default from config RAG_TOP_K)
        threshold: minimum similarity 0-1 (default from config)
        source_filter: table name to restrict search (optional)
        query_vector: pre-computed embedding (skips embed_text if provided)

    Returns:
        List of dicts with keys: id, source_table, source_id, chunk_text,
        chunk_index, metadata, similarity
    """
    if k is None:
        k = RAG_TOP_K
    if threshold is None:
        threshold = RAG_SIMILARITY_THRESHOLD

    if query_vector is None:
        query_vector = embed_text(query)

    # Build RPC params — vector sent as JSON array of floats
    params = {
        "query_embedding": query_vector,
        "match_threshold": threshold,
        "match_count": k,
        "filter_source_table": source_filter,
    }

    results = sb_rpc("match_memories", params)
    return results


def search_and_format(
    query: str,
    k: int = None,
    source_filter: str | None = None,
    query_vector: list[float] | None = None,
) -> str:
    """Search and format results as context for LLM prompt injection.

    Returns a formatted string ready to be inserted into a system/user prompt.
    Returns empty string if no results found.
    """
    results = search(query, k=k, source_filter=source_filter, query_vector=query_vector)

    if not results:
        return ""

    lines = ["[Contexte trouvé dans ta base de connaissances]", ""]

    for i, r in enumerate(results, 1):
        source = r.get("source_table", "?")
        sim = r.get("similarity", 0)
        text = r.get("chunk_text", "")
        meta = r.get("metadata", {})

        # Build a short label from metadata
        label = meta.get("title") or meta.get("name") or meta.get("usecase") or ""
        if label:
            label = f" — {label}"

        lines.append(f"Source {i} ({source}, similarité {sim:.2f}){label} :")
        lines.append(text)
        lines.append("")

    return "\n".join(lines).strip()
