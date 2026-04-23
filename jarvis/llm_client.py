"""Jarvis — Centralized LLM client with concurrency lock."""

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests as http_requests

from openai import OpenAI, APITimeoutError, APIConnectionError
from config import LM_STUDIO_BASE_URL, LM_STUDIO_API_KEY, LLM_MODEL

log = logging.getLogger(__name__)
MAX_RETRIES = 2  # 3 attempts total (1 initial + 2 retries)
TRACE_FILE = Path("jarvis_data/llm_traces.jsonl")

_client = None
_lock = asyncio.Lock()


def check_lm_studio(timeout: float = 5.0) -> str:
    """Check LM Studio availability. Returns 'connected', 'no_model_loaded', or 'unreachable'."""
    try:
        r = http_requests.get(f"{LM_STUDIO_BASE_URL}/models", timeout=timeout)
        if r.status_code != 200:
            return "unreachable"
        try:
            models = r.json().get("data", [])
            return "connected" if models else "no_model_loaded"
        except (ValueError, KeyError):
            return "connected"
    except Exception:
        return "unreachable"


def _write_trace(span: dict) -> None:
    """Append a trace span to the JSONL file. Best-effort — never raises."""
    try:
        TRACE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with TRACE_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(span, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks leaked by Qwen3.5 thinking mode."""
    return re.sub(r'<think>[\s\S]*?</think>', '', text).strip()


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=LM_STUDIO_BASE_URL, api_key=LM_STUDIO_API_KEY, timeout=120.0)
    return _client


def _sync_call(messages: list, max_tokens: int, temperature: float, response_format: dict | None = None, model: str | None = None) -> tuple[str, int]:
    """Blocking LLM call with retry on timeout/connection errors."""
    client = get_client()
    last_exc = None
    start_time = time.time()
    chars_in = sum(len(m.get("content", "")) for m in messages)
    model_used = model or LLM_MODEL
    kwargs = dict(
        model=model_used,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    if response_format is not None:
        kwargs["response_format"] = response_format
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(**kwargs)
            answer = _strip_thinking(response.choices[0].message.content or "")
            tokens = response.usage.total_tokens if response.usage else 0
            _write_trace({
                "ts": datetime.now(timezone.utc).isoformat(),
                "model": model_used,
                "chars_in": chars_in,
                "tokens_out": tokens,
                "latency_ms": round((time.time() - start_time) * 1000),
                "attempts": attempt + 1,
                "status": "ok",
            })
            return answer, tokens
        except (APITimeoutError, APIConnectionError) as e:
            last_exc = e
            if attempt < MAX_RETRIES:
                backoff = 2 ** (attempt + 1)  # 2s, 4s
                log.warning("LLM retry %d/%d after %s (backoff %ds)", attempt + 1, MAX_RETRIES, type(e).__name__, backoff)
                time.sleep(backoff)
    _write_trace({
        "ts": datetime.now(timezone.utc).isoformat(),
        "model": model_used,
        "chars_in": chars_in,
        "latency_ms": round((time.time() - start_time) * 1000),
        "attempts": MAX_RETRIES + 1,
        "status": "error",
        "error_type": type(last_exc).__name__,
    })
    raise last_exc


async def chat_completion_async(messages: list, max_tokens: int = 2048, temperature: float = 0.3, response_format: dict | None = None, model: str | None = None) -> tuple[str, int]:
    """Async LLM call with lock. Runs sync SDK in thread pool to avoid blocking event loop."""
    async with _lock:
        return await asyncio.to_thread(_sync_call, messages, max_tokens, temperature, response_format, model)


def chat_completion_sync(messages: list, max_tokens: int = 2048, temperature: float = 0.3, response_format: dict | None = None, model: str | None = None) -> tuple[str, int]:
    """Synchronous LLM call (for scripts like nightly_learner). No lock needed — scripts run alone."""
    return _sync_call(messages, max_tokens, temperature, response_format, model)
