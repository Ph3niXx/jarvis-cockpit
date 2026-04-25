"""Jarvis — Configuration centralisée."""

import os

# LM Studio local server
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LM_STUDIO_API_KEY = os.getenv("LM_STUDIO_API_KEY", "lm-studio")

# Models
# Qwen3.5 9B Q4_K_M (~5.5 Go VRAM) is the single instruct model used for
# both /chat (Rapide + Deep) and the JSON extraction in nightly_learner.
# Pure instruct (no <think>…</think> blocks), so _strip_thinking() is a no-op
# and the JSON pipeline works without a second dedicated model.
# Override via LLM_MODEL / EXTRACTION_MODEL env vars if needed.
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3.5-9b")
EXTRACTION_MODEL = os.getenv("EXTRACTION_MODEL", "qwen/qwen3.5-9b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "qwen/qwen3-embedding-0.6b")

# Generation parameters
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "2048"))

# Thinking mode: disabled by default (Qwen3.5 thinking slows simple tasks)
THINKING_MODE_DEFAULT = os.getenv("THINKING_MODE_DEFAULT", "false").lower() == "true"

# Embedding parameters
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))

# RAG parameters
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.3"))

# Claude API (cloud mode)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# Observer (Phase 6)
OBSERVER_INTERVAL_S = int(os.getenv("OBSERVER_INTERVAL_S", "30"))
OUTLOOK_INTERVAL_S = int(os.getenv("OUTLOOK_INTERVAL_S", "300"))  # 5 min
DAILY_BRIEF_HOUR = int(os.getenv("DAILY_BRIEF_HOUR", "18"))

# Supabase (reuse existing env vars — URL and publishable key are public, same as index.html)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mrmgptqpflzyavdfqwwv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_EvHJAk2BOwXN23stOddXQQ_AAzbKw5e")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role key (writes, no default)
