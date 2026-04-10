"""Jarvis — Outlook Observer: read calendar and email stats via COM automation.

Connects to the running Outlook desktop instance via pywin32 COM.
No Azure AD or OAuth required — uses the existing Outlook session.
Polls every N seconds, writes a snapshot JSON to jarvis_data/.

Usage:
    # As asyncio task (from server.py):
    observer = OutlookObserver()
    asyncio.create_task(observer.start())

    # Stats:
    observer.get_today_data()
"""

import asyncio
import json
import logging
import platform
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path

log = logging.getLogger("outlook_observer")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "jarvis_data"

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="outlook_com")


# ── File helpers ──────────────────────────────────────────────────

def _outlook_file(d: date) -> Path:
    """Return path to Outlook snapshot file for a given date."""
    return DATA_DIR / f"outlook_{d.isoformat()}.json"


def _save_snapshot(d: date, data: dict):
    """Save Outlook snapshot to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    filepath = _outlook_file(d)
    filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_outlook_data(d: date) -> dict:
    """Read Outlook snapshot for a given date. Returns empty dict if not found."""
    filepath = _outlook_file(d)
    if not filepath.exists():
        return {}
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


# ── COM polling (runs in thread) ──────────────────────────────────

def _poll_outlook() -> dict:
    """Poll Outlook COM for calendar and email data. Runs in a thread."""
    import pythoncom
    pythoncom.CoInitialize()
    try:
        import win32com.client

        outlook = win32com.client.Dispatch("Outlook.Application")
        namespace = outlook.GetNamespace("MAPI")

        today = date.today()
        data = {
            "last_poll": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "meetings": [],
            "meetings_stats": {"count": 0, "total_minutes": 0, "teams_count": 0},
            "emails": {"inbox_total": 0, "inbox_unread": 0, "received_today": 0, "sent_today": 0},
        }

        # ── Calendar ──────────────────────────────────────────
        try:
            calendar_folder = namespace.GetDefaultFolder(9)  # olFolderCalendar
            items = calendar_folder.Items
            items.Sort("[Start]")
            items.IncludeRecurrences = True

            # Filter for today's meetings
            start_filter = today.strftime("%m/%d/%Y 00:00")
            end_filter = (today + timedelta(days=1)).strftime("%m/%d/%Y 00:00")
            restriction = f"[Start] >= '{start_filter}' AND [Start] < '{end_filter}'"
            filtered = items.Restrict(restriction)

            meetings = []
            total_minutes = 0
            teams_count = 0

            item = filtered.GetFirst()
            while item:
                try:
                    subject = getattr(item, "Subject", "") or ""
                    start_time = getattr(item, "Start", None)
                    end_time = getattr(item, "End", None)
                    location = getattr(item, "Location", "") or ""
                    duration = getattr(item, "Duration", 0) or 0

                    # Count attendees
                    attendees_count = 0
                    try:
                        recipients = item.Recipients
                        attendees_count = recipients.Count if recipients else 0
                    except Exception:
                        pass

                    # Detect Teams meetings
                    is_teams = False
                    try:
                        body = getattr(item, "Body", "") or ""
                        is_teams = (
                            "teams" in location.lower()
                            or "teams.microsoft.com" in body.lower()
                            or "teams meeting" in body.lower()
                        )
                    except Exception:
                        is_teams = "teams" in location.lower()

                    start_str = start_time.strftime("%H:%M") if start_time else ""
                    end_str = end_time.strftime("%H:%M") if end_time else ""

                    meetings.append({
                        "subject": subject[:100],
                        "start": start_str,
                        "end": end_str,
                        "duration_min": duration,
                        "is_teams": is_teams,
                        "attendees_count": attendees_count,
                    })

                    total_minutes += duration
                    if is_teams:
                        teams_count += 1

                except Exception as e:
                    log.debug("Error reading calendar item: %s", e)

                item = filtered.GetNext()

            data["meetings"] = meetings
            data["meetings_stats"] = {
                "count": len(meetings),
                "total_minutes": total_minutes,
                "teams_count": teams_count,
            }

        except Exception as e:
            log.warning("Failed to read calendar: %s", e)

        # ── Inbox ─────────────────────────────────────────────
        try:
            inbox = namespace.GetDefaultFolder(6)  # olFolderInbox
            inbox_items = inbox.Items

            data["emails"]["inbox_total"] = inbox_items.Count

            # Count unread
            unread_filter = inbox_items.Restrict("[UnRead] = True")
            data["emails"]["inbox_unread"] = unread_filter.Count

            # Count received today
            today_str = today.strftime("%m/%d/%Y 00:00")
            today_filter = inbox_items.Restrict(f"[ReceivedTime] >= '{today_str}'")
            data["emails"]["received_today"] = today_filter.Count

        except Exception as e:
            log.warning("Failed to read inbox: %s", e)

        # ── Sent items ────────────────────────────────────────
        try:
            sent = namespace.GetDefaultFolder(5)  # olFolderSentMail
            sent_items = sent.Items

            today_str = today.strftime("%m/%d/%Y 00:00")
            today_filter = sent_items.Restrict(f"[SentOn] >= '{today_str}'")
            data["emails"]["sent_today"] = today_filter.Count

        except Exception as e:
            log.warning("Failed to read sent items: %s", e)

        return data

    except Exception as e:
        log.warning("Outlook COM error: %s", e)
        return {}
    finally:
        pythoncom.CoUninitialize()


# ── Observer class ────────────────────────────────────────────────

class OutlookObserver:
    """Async observer that polls Outlook COM for calendar and email data."""

    def __init__(self, interval_s: int = 300):
        self.interval_s = interval_s
        self._running = False
        self._last_data: dict = {}

    async def start(self):
        """Main loop — run as asyncio task."""
        if platform.system() != "Windows":
            log.warning("OutlookObserver: not on Windows, observer disabled")
            return

        self._running = True
        log.info("OutlookObserver started (interval=%ds)", self.interval_s)

        while self._running:
            try:
                loop = asyncio.get_event_loop()
                data = await loop.run_in_executor(_executor, _poll_outlook)

                if data:
                    self._last_data = data
                    _save_snapshot(date.today(), data)

                    stats = data.get("meetings_stats", {})
                    emails = data.get("emails", {})
                    log.info(
                        "Outlook poll: %d meetings (%d min), %d emails received, %d sent",
                        stats.get("count", 0),
                        stats.get("total_minutes", 0),
                        emails.get("received_today", 0),
                        emails.get("sent_today", 0),
                    )

            except Exception as e:
                log.warning("OutlookObserver poll error: %s", e)

            await asyncio.sleep(self.interval_s)

    def stop(self):
        """Signal the observer to stop."""
        self._running = False

    def get_today_data(self) -> dict:
        """Return the latest Outlook snapshot for today."""
        if self._last_data:
            return self._last_data
        return read_outlook_data(date.today())
