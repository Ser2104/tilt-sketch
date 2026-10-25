"""Tiny stand-in for the Supabase endpoints the game uses, with the same rules as docs/supabase.sql."""
import json
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROWS = {}


class H(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "apikey, authorization, content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()

    def reply(self, code, body=None):
        self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json"); self.end_headers()
        if body is not None:
            self.wfile.write(json.dumps(body).encode())

    def do_POST(self):
        if not self.path.startswith("/rest/v1/rpc/submit_score") or not self.headers.get("apikey"):
            return self.reply(404, {"message": "not found"})
        d = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        now = datetime.now(timezone.utc)
        ok_boards = {"levels", "guided", "daily-" + now.strftime("%Y-%m-%d"), "daily-" + (now - timedelta(days=1)).strftime("%Y-%m-%d")}
        if d["p_board"] not in ok_boards or not d["p_player"].strip():
            return self.reply(400, {"message": "unknown or closed board"})
        key = (d["p_board"], d["p_device"])
        new = {"board": d["p_board"], "player": d["p_player"][:24], "score": max(0, min(100, d["p_score"])), "level": d["p_level"], "stars": d["p_stars"], "t": now.timestamp()}
        old = ROWS.get(key)
        if old:
            new["score"] = old["score"] if d["p_board"].startswith("daily-") else max(old["score"], new["score"])
            new["level"] = max(old["level"], new["level"]); new["stars"] = max(old["stars"], new["stars"])
        ROWS[key] = new
        self.reply(204)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path != "/rest/v1/leaderboard":
            return self.reply(404, {"message": "not found"})
        q = parse_qs(u.query)
        board = q["board"][0].removeprefix("eq.")
        rows = [r for r in ROWS.values() if r["board"] == board]
        rows.sort(key=lambda r: (-r["level"], -r["stars"], r["t"]) if board in ("levels", "guided") else (-r["score"], r["t"]))
        self.reply(200, [{k: r[k] for k in ("player", "score", "level", "stars")} for r in rows[: int(q.get("limit", ["25"])[0])]])

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8790), H).serve_forever()
