"""Jarvis — Embedding generation via Qwen3-Embedding-0.6B on LM Studio."""

import sys
import time

from openai import OpenAI, APIConnectionError, APITimeoutError

from config import (
    LM_STUDIO_BASE_URL,
    LM_STUDIO_API_KEY,
    EMBEDDING_MODEL,
    EMBEDDING_DIM,
)

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=LM_STUDIO_BASE_URL,
            api_key=LM_STUDIO_API_KEY,
            timeout=30.0,
        )
    return _client


def embed_text(text: str) -> list[float]:
    """Generate a single embedding vector for a text string.

    Truncates input to 8000 chars as safety margin for context window.
    Returns a list of floats with length == EMBEDDING_DIM.
    """
    text = text[:8000].strip()
    if not text:
        return [0.0] * EMBEDDING_DIM

    client = _get_client()
    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
        )
    except (APIConnectionError, ConnectionError):
        print("[ERROR] Cannot reach LM Studio for embeddings.")
        print(f"  -> URL: {LM_STUDIO_BASE_URL}")
        print(f"  -> Model: {EMBEDDING_MODEL}")
        sys.exit(1)
    except APITimeoutError:
        print("[ERROR] Embedding request timed out (30s).")
        sys.exit(1)

    vector = response.data[0].embedding
    if len(vector) != EMBEDDING_DIM:
        print(f"[ERROR] Embedding dimension mismatch: got {len(vector)}, expected {EMBEDDING_DIM}")
        print(f"  -> Model {EMBEDDING_MODEL} may produce a different dimension.")
        sys.exit(1)

    return vector


def embed_batch(texts: list[str], batch_size: int = 32, verbose: bool = False) -> list[list[float]]:
    """Generate embeddings for a list of texts in batches.

    Args:
        texts: list of strings to embed
        batch_size: number of texts per API call (default 32)
        verbose: print progress for large batches

    Returns:
        List of embedding vectors in the same order as input.
    """
    if not texts:
        return []

    client = _get_client()
    all_vectors = []
    total = len(texts)

    for i in range(0, total, batch_size):
        batch = [t[:8000].strip() or "empty" for t in texts[i:i + batch_size]]

        try:
            response = client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch,
            )
        except (APIConnectionError, ConnectionError):
            print(f"\n[ERROR] Lost connection to LM Studio at batch {i // batch_size + 1}.")
            sys.exit(1)
        except APITimeoutError:
            print(f"\n[ERROR] Timeout at batch {i // batch_size + 1}.")
            sys.exit(1)

        # Sort by index to guarantee order matches input
        sorted_data = sorted(response.data, key=lambda d: d.index)
        vectors = [d.embedding for d in sorted_data]

        # Validate first vector dimension
        if vectors and len(vectors[0]) != EMBEDDING_DIM:
            print(f"[ERROR] Dimension mismatch: got {len(vectors[0])}, expected {EMBEDDING_DIM}")
            sys.exit(1)

        all_vectors.extend(vectors)

        if verbose and total > batch_size:
            done = min(i + batch_size, total)
            pct = done * 100 // total
            print(f"  Embedding: {done}/{total} ({pct}%)", end="\r")

    if verbose and total > batch_size:
        print()

    return all_vectors
