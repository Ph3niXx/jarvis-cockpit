"""Jarvis — End-to-end RAG test.

Verifies:
1. memories_vectors table exists and has data
2. Embedding generation works
3. Semantic search returns relevant results
4. Contextualized LLM response with RAG context
"""

import sys
import time

from openai import OpenAI

from config import (
    LM_STUDIO_BASE_URL,
    LM_STUDIO_API_KEY,
    LLM_MODEL,
    LLM_MAX_TOKENS,
    EMBEDDING_DIM,
)
from embeddings import embed_text
from supabase_client import sb_get
from retriever import search, search_and_format

TEST_QUERIES = [
    "Quels sont les derniers outils d'intelligence artificielle ?",
    "Quelles opportunités business liées à l'IA sont identifiées ?",
    "Qu'est-ce que le RAG en intelligence artificielle ?",
]


def main():
    print("=" * 60)
    print("JARVIS — Test RAG end-to-end")
    print("=" * 60)

    ok_count = 0
    total_tests = 0
    latencies = []

    # ── Test 1: Table exists and has data ──────────────────────────
    total_tests += 1
    print("\n[1] Vérification de memories_vectors...")

    rows = sb_get("memories_vectors", "select=source_table&limit=1000")
    if not rows:
        print("  [FAIL] Table vide ou inexistante.")
        print("\n  -> Lance d'abord : python jarvis/indexer.py")
        print("  -> (et assure-toi d'avoir exécuté la migration SQL dans Supabase)")
        sys.exit(1)

    # Count per source
    counts = {}
    for r in rows:
        st = r.get("source_table", "?")
        counts[st] = counts.get(st, 0) + 1

    total_chunks = len(rows)
    if total_chunks >= 1000:
        # We hit the limit, get actual count
        count_rows = sb_get("memories_vectors", "select=id&limit=10000")
        total_chunks = len(count_rows)

    print(f"  OK: {total_chunks} chunks indexés")
    for table, count in sorted(counts.items()):
        print(f"    - {table}: {count}")
    ok_count += 1

    # ── Test 2: Embedding works ────────────────────────────────────
    total_tests += 1
    print("\n[2] Test embedding...")

    t0 = time.perf_counter()
    vec = embed_text("Test de recherche sémantique pour Jarvis")
    embed_latency = time.perf_counter() - t0

    if len(vec) != EMBEDDING_DIM:
        print(f"  [FAIL] Dimension: {len(vec)} (attendu {EMBEDDING_DIM})")
    else:
        print(f"  OK: vecteur {EMBEDDING_DIM}-dim en {embed_latency:.2f}s")
        ok_count += 1

    # ── Test 3: Semantic search ────────────────────────────────────
    print("\n[3] Tests de recherche sémantique...")

    for i, query in enumerate(TEST_QUERIES):
        total_tests += 1
        print(f"\n  Query {i + 1}: \"{query}\"")

        t0 = time.perf_counter()
        results = search(query, k=3, threshold=0.3)
        latency = time.perf_counter() - t0
        latencies.append(latency)

        if not results:
            print(f"  [WARN] Aucun résultat (threshold peut-être trop haut)")
        else:
            print(f"  {len(results)} résultats en {latency:.2f}s:")
            for r in results:
                sim = r.get("similarity", 0)
                source = r.get("source_table", "?")
                text = r.get("chunk_text", "")[:100]
                print(f"    [{sim:.3f}] ({source}) {text}...")
            ok_count += 1

    # ── Test 4: Contextualized LLM response ────────────────────────
    total_tests += 1
    print("\n[4] Test réponse LLM contextualisée (RAG)...")

    rag_query = TEST_QUERIES[-1]
    context = search_and_format(rag_query, k=3)

    if not context:
        print("  [SKIP] Pas de contexte RAG disponible.")
    else:
        print(f"  Contexte RAG: {len(context)} chars")

        system_prompt = (
            "Tu es Jarvis, assistant IA personnel. "
            "Réponds en français, de manière concise, en te basant UNIQUEMENT sur le contexte fourni. "
            "Si le contexte ne contient pas la réponse, dis-le. /no_think\n\n"
            f"{context}"
        )

        client = OpenAI(base_url=LM_STUDIO_BASE_URL, api_key=LM_STUDIO_API_KEY)

        try:
            t0 = time.perf_counter()
            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": rag_query},
                ],
                max_tokens=LLM_MAX_TOKENS,
                temperature=0.3,
                extra_body={"chat_template_kwargs": {"enable_thinking": False}},
            )
            llm_latency = time.perf_counter() - t0

            reply = response.choices[0].message.content
            usage = response.usage

            print(f"\n  Réponse Jarvis ({llm_latency:.1f}s):")
            print(f"  {reply}")

            if usage:
                print(f"\n  Tokens: {usage.prompt_tokens} prompt + {usage.completion_tokens} completion")

            ok_count += 1

        except Exception as e:
            print(f"  [FAIL] Erreur LLM: {e}")

    # ── Bilan ──────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"Bilan: {ok_count}/{total_tests} tests OK")
    if latencies:
        avg = sum(latencies) / len(latencies)
        print(f"Latence recherche moyenne: {avg:.2f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
