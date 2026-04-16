#!/usr/bin/env python3
"""
One-shot script to complete the Strava OAuth2 flow.

Launches a local HTTP server, opens the browser for authorization,
captures the callback code, and exchanges it for tokens.

Output: STRAVA_REFRESH_TOKEN and STRAVA_ATHLETE_ID to copy into GitHub Secrets.

Dependencies: stdlib only (no pip install needed).
"""

import http.server
import json
import os
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
REDIRECT_URI = "http://localhost:8000/callback"
SCOPES = "read,activity:read_all,profile:read_all"


def read_config_txt():
    """Try to read client_id and client_secret from Config.txt at repo root."""
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Config.txt")
    config = {}
    if not os.path.exists(config_path):
        return config
    with open(config_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                config[key.strip()] = value.strip()
    return config


def get_credentials():
    """Get Strava client_id and client_secret from Config.txt or user input."""
    config = read_config_txt()

    client_id = config.get("STRAVA_CLIENT_ID") or os.environ.get("STRAVA_CLIENT_ID")
    client_secret = config.get("STRAVA_CLIENT_SECRET") or os.environ.get("STRAVA_CLIENT_SECRET")

    if not client_id:
        client_id = input("Enter your Strava client_id: ").strip()
    if not client_secret:
        client_secret = input("Enter your Strava client_secret: ").strip()

    if not client_id or not client_secret:
        print("ERROR: client_id and client_secret are required.")
        sys.exit(1)

    return client_id, client_secret


def exchange_code(client_id, client_secret, code):
    """Exchange authorization code for access/refresh tokens."""
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    req = urllib.request.Request(STRAVA_TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler that captures the OAuth callback."""

    auth_code = None
    error = None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/callback":
            self.send_response(404)
            self.end_headers()
            return

        params = urllib.parse.parse_qs(parsed.query)

        if "error" in params:
            CallbackHandler.error = params["error"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>Authorization denied.</h1><p>You can close this tab.</p>")
        elif "code" in params:
            CallbackHandler.auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<h1>Authorization successful!</h1>"
                b"<p>Return to the terminal to see your tokens. You can close this tab.</p>"
            )
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, format, *args):
        """Suppress default HTTP request logging."""
        pass


def main():
    print("=" * 60)
    print("  Strava OAuth2 — Token Generator")
    print("=" * 60)
    print()

    client_id, client_secret = get_credentials()

    # Build authorization URL
    auth_params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "approval_prompt": "auto",
    })
    auth_url = f"{STRAVA_AUTH_URL}?{auth_params}"

    # Start local server
    server = http.server.HTTPServer(("localhost", 8000), CallbackHandler)
    server_thread = threading.Thread(target=server.handle_request, daemon=True)
    server_thread.start()

    print(f"Opening browser for Strava authorization...")
    print(f"If the browser doesn't open, visit:\n  {auth_url}\n")
    webbrowser.open(auth_url)

    # Wait for callback
    print("Waiting for callback on http://localhost:8000/callback ...")
    server_thread.join(timeout=120)
    server.server_close()

    if CallbackHandler.error:
        print(f"\nERROR: Authorization denied by user: {CallbackHandler.error}")
        sys.exit(1)

    if not CallbackHandler.auth_code:
        print("\nERROR: No authorization code received (timeout after 120s).")
        sys.exit(1)

    print(f"Authorization code received. Exchanging for tokens...")

    # Exchange code for tokens
    token_data = exchange_code(client_id, client_secret, CallbackHandler.auth_code)

    refresh_token = token_data.get("refresh_token")
    athlete = token_data.get("athlete", {})
    athlete_id = athlete.get("id")
    first_name = athlete.get("firstname", "?")
    last_name = athlete.get("lastname", "?")

    if not refresh_token:
        print(f"\nERROR: No refresh_token in response: {json.dumps(token_data, indent=2)}")
        sys.exit(1)

    print()
    print("=" * 60)
    print("  SUCCESS — Copy these values into GitHub Secrets:")
    print("=" * 60)
    print()
    print(f"  Athlete: {first_name} {last_name} (ID: {athlete_id})")
    print()
    print(f"  STRAVA_REFRESH_TOKEN={refresh_token}")
    print(f"  STRAVA_ATHLETE_ID={athlete_id}")
    print()
    print("  GitHub Secrets location:")
    print("  Settings > Secrets and variables > Actions > New repository secret")
    print()
    print("  You also need these secrets (from your Strava API app):")
    print(f"  STRAVA_CLIENT_ID={client_id}")
    print(f"  STRAVA_CLIENT_SECRET=<your_secret>")
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
