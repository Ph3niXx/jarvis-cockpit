"""Jarvis — Window Observer: track active window titles on Windows.

Logs the foreground window every N seconds to a local JSONL file.
Only writes when the window changes (deduplication). Raw data stays
local in jarvis_data/ for privacy — only generated briefs go to Supabase.

Usage:
    # As asyncio task (from server.py):
    observer = WindowObserver()
    asyncio.create_task(observer.start())

    # Stats:
    observer.get_today_stats()
"""

import asyncio
import ctypes
import json
import logging
import platform
import re
from datetime import datetime, date
from pathlib import Path

log = logging.getLogger("window_observer")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "jarvis_data"

# ── App categorization ────────────────────────────────────────────

_CATEGORIES = {
    "dev": [
        "visual studio code", "vs code", "vscode", "lm studio", "lmstudio",
        "terminal", "cmd", "powershell", "bash", "git", "python", "node",
        "pycharm", "intellij", "webstorm", "sublime", "notepad++", "vim",
        "docker", "postman", "insomnia", "github desktop", "warp",
    ],
    "communication": [
        "teams", "outlook", "slack", "discord", "gmail", "thunderbird",
        "zoom", "webex", "google meet", "skype", "whatsapp", "telegram",
    ],
    "browsing": [
        "chrome", "firefox", "edge", "brave", "opera", "safari", "vivaldi",
    ],
    "documents": [
        "word", "excel", "powerpoint", "onenote", "notion", "obsidian",
        "acrobat", "pdf", "google docs", "google sheets", "libre",
    ],
}


def _categorize(app_name: str) -> str:
    """Categorize an app name into dev/communication/browsing/documents/other."""
    lower = app_name.lower()
    for category, keywords in _CATEGORIES.items():
        for kw in keywords:
            if kw in lower:
                return category
    return "other"


def _extract_app_name(title: str) -> str:
    """Extract app name from window title.

    Common patterns:
      "file.py - Visual Studio Code"  → "Visual Studio Code"
      "Inbox - user@mail.com - Outlook" → "Outlook"
      "Google Chrome" → "Google Chrome"
      "Document1 - Microsoft Word" → "Microsoft Word"
    """
    if not title:
        return "Unknown"

    # Pattern: "... - AppName" (most apps use this)
    parts = title.rsplit(" - ", 1)
    if len(parts) == 2 and len(parts[1].strip()) > 1:
        return parts[1].strip()

    # Pattern: "... — AppName" (em dash)
    parts = title.rsplit(" — ", 1)
    if len(parts) == 2 and len(parts[1].strip()) > 1:
        return parts[1].strip()

    # Pattern: "AppName: details"
    parts = title.split(":", 1)
    if len(parts) == 2 and len(parts[0].strip()) > 1:
        candidate = parts[0].strip()
        if len(candidate) < 40:
            return candidate

    # Fallback: use full title (truncated)
    return title[:60]


# ── Windows API ───────────────────────────────────────────────────

def _get_foreground_window_title() -> str:
    """Get the title of the currently focused window (Windows only)."""
    if platform.system() != "Windows":
        return ""
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return ""
        buf = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
        return buf.value
    except Exception:
        return ""


# ── JSONL file helpers ────────────────────────────────────────────

def _activity_file(d: date) -> Path:
    """Return path to activity JSONL file for a given date."""
    return DATA_DIR / f"activity_{d.isoformat()}.jsonl"


def _append_entry(filepath: Path, entry: dict):
    """Append a JSON line to the activity file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _update_last_entry_duration(filepath: Path, duration_s: int):
    """Update the duration_s of the last line in the JSONL file."""
    if not filepath.exists():
        return
    try:
        lines = filepath.read_text(encoding="utf-8").splitlines()
        if not lines:
            return
        last = json.loads(lines[-1])
        last["duration_s"] = duration_s
        lines[-1] = json.dumps(last, ensure_ascii=False)
        filepath.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except Exception as e:
        log.warning("Failed to update last entry duration: %s", e)


def read_day_entries(d: date) -> list[dict]:
    """Read all activity entries for a given date."""
    filepath = _activity_file(d)
    if not filepath.exists():
        return []
    entries = []
    for line in filepath.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def compute_stats(entries: list[dict]) -> dict:
    """Compute activity stats from a list of entries."""
    if not entries:
        return {
            "total_minutes": 0,
            "categories": {},
            "top_apps": [],
            "first_activity": "",
            "last_activity": "",
            "window_changes": 0,
        }

    cat_seconds: dict[str, int] = {}
    app_seconds: dict[str, int] = {}

    for e in entries:
        dur = e.get("duration_s", 0)
        cat = e.get("category", "other")
        app = e.get("app", "Unknown")

        cat_seconds[cat] = cat_seconds.get(cat, 0) + dur
        app_seconds[app] = app_seconds.get(app, 0) + dur

    # Top apps sorted by time
    top_apps = sorted(app_seconds.items(), key=lambda x: x[1], reverse=True)[:8]
    top_apps = [{"name": name, "minutes": round(secs / 60)} for name, secs in top_apps]

    # Category minutes
    categories = {cat: round(secs / 60) for cat, secs in cat_seconds.items()}

    # Time bounds
    first = entries[0].get("ts", "")
    last = entries[-1].get("ts", "")
    first_time = first[11:16] if len(first) >= 16 else ""
    last_time = last[11:16] if len(last) >= 16 else ""

    return {
        "total_minutes": round(sum(cat_seconds.values()) / 60),
        "categories": categories,
        "top_apps": top_apps,
        "first_activity": first_time,
        "last_activity": last_time,
        "window_changes": len(entries),
    }


# ── Observer class ────────────────────────────────────────────────

class WindowObserver:
    """Async background observer that logs the active window title."""

    def __init__(self, interval_s: int = 30):
        self.interval_s = interval_s
        self._last_title: str = ""
        self._last_change: datetime | None = None
        self._running = False

    async def start(self):
        """Main loop — run as asyncio task."""
        if platform.system() != "Windows":
            log.warning("WindowObserver: not on Windows, observer disabled")
            return

        self._running = True
        log.info("WindowObserver started (interval=%ds)", self.interval_s)

        while self._running:
            try:
                self._tick()
            except Exception as e:
                log.warning("WindowObserver tick error: %s", e)

            await asyncio.sleep(self.interval_s)

    def stop(self):
        """Signal the observer to stop."""
        self._running = False
        # Flush last entry duration
        self._flush_last()

    def _tick(self):
        """Single observation tick."""
        title = _get_foreground_window_title()
        if not title:
            return

        now = datetime.now()
        today = now.date()
        filepath = _activity_file(today)

        # Same window as before — update duration on last entry
        if title == self._last_title and self._last_change:
            duration_s = int((now - self._last_change).total_seconds())
            _update_last_entry_duration(filepath, duration_s)
            return

        # New window — flush previous duration and write new entry
        if self._last_change and self._last_title:
            prev_duration = int((now - self._last_change).total_seconds())
            # Check if we need to update previous day's file
            prev_date = self._last_change.date()
            if prev_date == today:
                _update_last_entry_duration(filepath, prev_duration)
            else:
                _update_last_entry_duration(_activity_file(prev_date), prev_duration)

        app = _extract_app_name(title)
        category = _categorize(app)

        entry = {
            "ts": now.strftime("%Y-%m-%dT%H:%M:%S"),
            "title": title[:200],  # Truncate very long titles
            "app": app,
            "category": category,
            "duration_s": 0,
        }

        _append_entry(filepath, entry)
        self._last_title = title
        self._last_change = now

    def _flush_last(self):
        """Flush the duration of the last observed window."""
        if self._last_change and self._last_title:
            now = datetime.now()
            duration_s = int((now - self._last_change).total_seconds())
            filepath = _activity_file(self._last_change.date())
            _update_last_entry_duration(filepath, duration_s)

    def get_today_stats(self) -> dict:
        """Return stats for today's activity."""
        entries = read_day_entries(date.today())
        return compute_stats(entries)

    def get_day_entries(self, d: date) -> list[dict]:
        """Return raw entries for a specific date."""
        return read_day_entries(d)
