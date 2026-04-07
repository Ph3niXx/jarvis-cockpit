"""Launch cloudflared quick tunnel and save URL to Supabase."""

import subprocess
import sys
import os
import re
import time

sys.path.insert(0, os.path.dirname(__file__))

from supabase_client import sb_post

LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "jarvis_data", "cloudflared.log")


def main():
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

    # Start cloudflared in background
    log_fh = open(LOG_FILE, "w")
    # Find cloudflared binary
    import shutil
    cf_bin = shutil.which("cloudflared")
    if not cf_bin:
        # Common Windows install paths
        for candidate in [
            os.path.expandvars(r"%ProgramFiles(x86)%\cloudflared\cloudflared.exe"),
            os.path.expandvars(r"%ProgramFiles%\cloudflared\cloudflared.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe"),
        ]:
            if os.path.isfile(candidate):
                cf_bin = candidate
                break

    if not cf_bin:
        print("  [!] cloudflared not found. Install with: winget install cloudflare.cloudflared")
        sys.exit(1)

    proc = subprocess.Popen(
        [cf_bin, "tunnel", "--url", "http://localhost:8765"],
        stdout=log_fh,
        stderr=subprocess.STDOUT,
    )

    # Wait for URL to appear (up to 20s)
    tunnel_url = None
    for _ in range(40):
        time.sleep(0.5)
        try:
            with open(LOG_FILE, "r") as f:
                content = f.read()
            m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", content)
            if m:
                tunnel_url = m.group()
                break
        except Exception:
            pass

    if not tunnel_url:
        print("  [!] Tunnel URL not found after 20s")
        print(f"      Check {LOG_FILE}")
        sys.exit(1)

    print(f"      [OK] Tunnel actif : {tunnel_url}")

    # Save to Supabase
    ok = sb_post("user_profile", {"key": "jarvis_tunnel_url", "value": tunnel_url}, upsert=True)
    if ok:
        print("      [OK] URL sauvegardee dans Supabase")
    else:
        print("      [!] Echec sauvegarde Supabase (non bloquant)")

    print()
    print(f"  ============================================")
    print(f"    Jarvis accessible depuis partout :")
    print(f"    {tunnel_url}")
    print(f"  ============================================")

    # Keep running (will be killed when parent .bat exits)
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()


if __name__ == "__main__":
    main()
