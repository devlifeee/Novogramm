#!/usr/bin/env python3
"""Obtain a Gmail API refresh token from a downloaded Desktop OAuth client JSON."""

import argparse
import json
import queue
import secrets
import sys
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import requests


GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
CALLBACK_TIMEOUT_SECONDS = 300
HTTP_TIMEOUT_SECONDS = 15


def load_desktop_credentials(path):
    try:
        credentials = json.loads(Path(path).read_text(encoding="utf-8"))["installed"]
        return credentials["client_id"], credentials["client_secret"], credentials["auth_uri"], credentials["token_uri"]
    except (KeyError, OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not read Desktop OAuth credentials JSON: {type(error).__name__}") from error


def receive_authorization_code(auth_uri, client_id):
    result = queue.Queue(maxsize=1)

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            query = parse_qs(urlparse(self.path).query)
            result.put(query)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Authorization received. You can close this window.")

        def log_message(self, _format, *_args):
            pass

    server = HTTPServer(("127.0.0.1", 0), CallbackHandler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}/"
    state = secrets.token_urlsafe(32)
    authorization_url = f"{auth_uri}?{urlencode({
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': GMAIL_SEND_SCOPE,
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state,
    })}"
    print("Opening the Google authorization page in your browser.", file=sys.stderr)
    webbrowser.open(authorization_url)

    deadline = time.monotonic() + CALLBACK_TIMEOUT_SECONDS
    server.timeout = 1
    try:
        while time.monotonic() < deadline:
            server.handle_request()
            if not result.empty():
                query = result.get_nowait()
                if query.get("state", [None])[0] != state:
                    raise SystemExit("OAuth state did not match; authorization was rejected")
                if "error" in query:
                    raise SystemExit(f"Google authorization failed: {query['error'][0]}")
                if "code" not in query:
                    raise SystemExit("Google authorization did not return a code")
                return query["code"][0], redirect_uri
    finally:
        server.server_close()
    raise SystemExit("Timed out waiting for browser authorization")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("credentials_json", help="Downloaded Desktop OAuth client credentials JSON")
    args = parser.parse_args()

    client_id, client_secret, auth_uri, token_uri = load_desktop_credentials(args.credentials_json)
    code, redirect_uri = receive_authorization_code(auth_uri, client_id)
    try:
        response = requests.post(
            token_uri,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        refresh_token = response.json().get("refresh_token")
    except (requests.RequestException, ValueError) as error:
        raise SystemExit(f"OAuth token exchange failed: {type(error).__name__}") from error
    if not refresh_token:
        raise SystemExit("Google did not return a refresh token; rerun and complete the consent prompt")

    print(refresh_token)


if __name__ == "__main__":
    main()
