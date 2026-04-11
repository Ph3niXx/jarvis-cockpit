"""Jarvis — Centralized LLM client with concurrency lock."""

import asyncio
import re
from openai import OpenAI
from config import LM_STUDIO_BASE_URL, LM_STUDIO_API_KEY, LLM_MODEL

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
    """Blocking LLM call — must run in a thread to avoid blocking asyncio."""
    client = get_client()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )
    answer = _strip_thinking(response.choices[0].message.content or "")
    tokens = response.usage.total_tokens if response.usage else 0
    return answer, tokens


async def chat_completion_async(messages: list, max_tokens: int = 2048, temperature: float = 0.3) -> tuple[str, int]:
    """Async LLM call with lock. Runs sync SDK in thread pool to avoid blocking event loop."""
    async with _lock:
        return await asyncio.to_thread(_sync_call, messages, max_tokens, temperature)


def chat_completion_sync(messages: list, max_tokens: int = 2048, temperature: float = 0.3) -> tuple[str, int]:
    """Synchronous LLM call (for scripts like nightly_learner). No lock needed — scripts run alone."""
    client = get_client()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )
    answer = _strip_thinking(response.choices[0].message.content or "")
    tokens = response.usage.total_tokens if response.usage else 0
    return answer, tokens
