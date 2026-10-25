#!/usr/bin/env python3
"""Pick photos from Google Photos (e.g. your Favorites) and send them to the TV.

Uses the Google Photos Picker API, the only way third-party apps can read your
photos since March 2025. Run it, choose photos in the browser window that opens,
and the script downloads them (sized for 4K) and pushes them to the dashboard.

One-time setup: put an OAuth client file for a "Desktop app" next to this script
as client_secret.json (see README.md).

    python3 photos_sync.py            # pick, download to ./photos, push to the TV
    python3 photos_sync.py --no-push  # only download
"""
import argparse
import base64
import hashlib
import http.server
import json
import os
import secrets
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT_FILE = os.path.join(HERE, "client_secret.json")
TOKEN_FILE = os.path.join(HERE, "keystore", "google_token.json")
PHOTOS_DIR = os.path.join(HERE, "photos")
SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
PICKER = "https://photospicker.googleapis.com/v1"


def http(method, url, token=None, data=None, form=None):
    headers = {}
    body = None
    if token:
        headers["Authorization"] = "Bearer " + token
    if form is not None:
        body = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw and r.headers.get_content_type() == "application/json" else raw


def load_client():
    if not os.path.exists(CLIENT_FILE):
        sys.exit("client_secret.json not found next to this script. See README.md, 'Google Photos setup'.")
    c = json.load(open(CLIENT_FILE))
    c = c.get("installed") or c.get("web")
    return c["client_id"], c["client_secret"]


def get_token():
    client_id, client_secret = load_client()
    if os.path.exists(TOKEN_FILE):
        saved = json.load(open(TOKEN_FILE))
        try:
            t = http("POST", "https://oauth2.googleapis.com/token", form={
                "client_id": client_id, "client_secret": client_secret,
                "refresh_token": saved["refresh_token"], "grant_type": "refresh_token"})
            return t["access_token"]
        except Exception:
            pass  # refresh token revoked or expired: sign in again

    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [""])[0] == state:
                result["code"] = q.get("code", [""])[0]
                result["error"] = q.get("error", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<h2>Signed in. You can close this tab.</h2>")

        def log_message(self, *a):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect = "http://127.0.0.1:%d" % server.server_port
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": client_id, "redirect_uri": redirect, "response_type": "code", "scope": SCOPE,
        "access_type": "offline", "prompt": "consent", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256"})
    print("Opening Google sign-in in your browser...")
    webbrowser.open(url)
    while "code" not in result:
        server.handle_request()
    server.server_close()
    if not result["code"]:
        sys.exit("Sign-in failed: " + (result.get("error") or "no code"))

    t = http("POST", "https://oauth2.googleapis.com/token", form={
        "client_id": client_id, "client_secret": client_secret, "code": result["code"],
        "code_verifier": verifier, "redirect_uri": redirect, "grant_type": "authorization_code"})
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, "w") as f:
        json.dump({"refresh_token": t.get("refresh_token")}, f)
    os.chmod(TOKEN_FILE, 0o600)
    return t["access_token"]


def pick(token):
    session = http("POST", PICKER + "/sessions", token, data={})
    print("\nChoose photos in the browser window (open Albums > Favorites, select, then Done).")
    webbrowser.open(session["pickerUri"] + "/autoclose")
    interval = float(session.get("pollingConfig", {}).get("pollInterval", "5s").rstrip("s") or 5)
    deadline = time.time() + 30 * 60
    while time.time() < deadline:
        s = http("GET", PICKER + "/sessions/" + session["id"], token)
        if s.get("mediaItemsSet"):
            break
        time.sleep(max(interval, 2))
    else:
        sys.exit("Timed out waiting for the selection.")

    items, page = [], None
    while True:
        q = {"sessionId": session["id"], "pageSize": 100}
        if page:
            q["pageToken"] = page
        r = http("GET", PICKER + "/mediaItems?" + urllib.parse.urlencode(q), token)
        items += r.get("mediaItems", [])
        page = r.get("nextPageToken")
        if not page:
            break
    return session["id"], [i for i in items if i.get("type") == "PHOTO"]


def download(token, items):
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    for f in os.listdir(PHOTOS_DIR):
        os.remove(os.path.join(PHOTOS_DIR, f))
    lock = threading.Lock()
    done = [0]

    def fetch(i, item):
        url = item["mediaFile"]["baseUrl"] + "=w3840-h2160"
        data = http("GET", url, token)
        with open(os.path.join(PHOTOS_DIR, "%04d.jpg" % i), "wb") as f:
            f.write(data)
        with lock:
            done[0] += 1
            print("\r  downloaded %d/%d" % (done[0], len(items)), end="", flush=True)

    threads = []
    for i, item in enumerate(items):
        t = threading.Thread(target=fetch, args=(i, item))
        t.start()
        threads.append(t)
        if len(threads) >= 6:
            threads.pop(0).join()
    for t in threads:
        t.join()
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-push", action="store_true", help="download only; don't send to the TV")
    args = ap.parse_args()

    token = get_token()
    session_id, items = pick(token)
    if not items:
        sys.exit("No photos were selected.")
    print("Downloading %d photos..." % len(items))
    download(token, items)
    try:
        http("DELETE", PICKER + "/sessions/" + session_id, token)
    except Exception:
        pass
    if not args.no_push:
        subprocess.run([os.path.join(HERE, "tv.sh"), "photos", PHOTOS_DIR], check=True)


if __name__ == "__main__":
    main()
