"""Jarvis — Centralized LLM client with concurrency lock."""

import asyncio
import logging
import re
import time
from openai import OpenAI, APITimeoutError, APIConnectionError
from config import LM_STUDIO_BASE_URL, LM_STUDIO_API_KEY, LLM_MODEL

log = logging.getLogger(__name__)
MAX_RETRIES = 2  # 3 attempts total (1 initial + 2 retries)

_client = None
_lock = asyncio.Lock()


def _strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks leaked by Qwen3.5 thinking mode."""
    return re.sub(r'<think>[\s\S]*?</think>', '', text).strip()


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=LM_STUDIO_BASE_URL, api_key=LM_STUDIO_API_KEY, timeout=60.0)
    return _client


def _sync_call(messages: list, max_tokens: int, temperature: float) -> tuple[str, int]:
    """Blocking LLM call with retry on timeout/connection errors."""
    client = get_client()
    last_exc = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            answer = _strip_thinking(response.choices[0].message.content or "")
            tokens = response.usage.total_tokens if response.usage else 0
            return answer, tokens
        except (APITimeoutError, APIConnectionError) as e:
            last_exc = e
            if attempt < MAX_RETRIES:
                backoff = 2 ** (attempt + 1)  # 2s, 4s
                log.warning("LLM retry %d/%d after %s (backoff %ds)", attempt + 1, MAX_RETRIES, type(e).__name__, backoff)
                time.sleep(backoff)
    raise last_exc


async def chat_completion_async(messages: list, max_tokens: int = 2048, temperature: float = 0.3) -> tuple[str, int]:
    """Async LLM call with lock. Runs sync SDK in thread pool to avoid blocking event loop."""
    async with _lock:
        return await asyncio.to_thread(_sync_call, messages, max_tokens, temperature)


def chat_completion_sync(messages: list, max_tokens: int = 2048, temperature: float = 0.3) -> tuple[str, int]:
    """Synchronous LLM call (for scripts like nightly_learner). No lock needed — scripts run alone."""
    return _sync_call(messages, max_tokens, temperature)
