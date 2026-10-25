"""Tiny stand-in for the Supabase endpoints the game uses, with the same rules as docs/supabase.sql."""
import hashlib
import json
import re
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROWS = {}
DRAWINGS = []
FEEDBACK = []
CLINICS = {}
PATIENTS = []
WORDS = set(json.loads(re.search(r"const TARGETS=(\{.*?\});", (Path(__file__).resolve().parent.parent / "js" / "core.js").read_text(), re.S).group(1)))


def h(k):
    return hashlib.sha256((k or "").encode()).hexdigest()


class Err(Exception):
    pass


def clinic(code, key=None):
    c = CLINICS.get((code or "").strip().upper())
    if not c or (key is not None and c["hash"] != h(key)):
        raise Err("wrong clinic code or key" if key is not None else "unknown clinic code")
    return c


def rpc(name, d):
    if name == "donate_drawing":
        if d["p_word"] not in WORDS:
            raise Err("unknown object")
        if not isinstance(d["p_strokes"], list) or not 1 <= len(d["p_strokes"]) <= 80 or len(json.dumps(d["p_strokes"])) > 60000:
            raise Err("bad drawing")
        DRAWINGS.append({k[2:]: v for k, v in d.items()})
        return None
    if name == "delete_my_drawings":
        n = len(DRAWINGS)
        DRAWINGS[:] = [x for x in DRAWINGS if x["device"] != d["p_device"]]
        return n - len(DRAWINGS)
    if name == "donation_stats":
        return {"drawings": len(DRAWINGS), "objects": len({x["word"] for x in DRAWINGS}), "players": len({x["device"] for x in DRAWINGS})}
    if name == "create_clinic":
        if not d["p_name"].strip():
            raise Err("empty name")
        code = "".join(secrets.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(6))
        key = secrets.token_hex(18)
        CLINICS[code] = {"code": code, "hash": h(key), "name": d["p_name"].strip()[:60]}
        return {"code": code, "key": key, "name": CLINICS[code]["name"]}
    if name == "join_clinic":
        c = clinic(d["p_code"])
        if not d["p_alias"].strip():
            raise Err("empty name")
        for p in PATIENTS:
            if p["clinic"] == c["code"] and p["device"] == d["p_device"]:
                p["alias"] = d["p_alias"].strip()[:24]
                return c["name"]
        PATIENTS.append({"id": len(PATIENTS) + 1, "clinic": c["code"], "device": d["p_device"], "alias": d["p_alias"].strip()[:24], "joined_at": datetime.now(timezone.utc).isoformat(), "sessions": []})
        return c["name"]
    if name == "share_session":
        for p in PATIENTS:
            if p["clinic"] == (d["p_code"] or "").upper() and p["device"] == d["p_device"]:
                p["sessions"].append(d["p_session"])
                return None
        raise Err("not connected")
    if name == "leave_clinic":
        PATIENTS[:] = [p for p in PATIENTS if not (p["clinic"] == (d["p_code"] or "").upper() and p["device"] == d["p_device"])]
        return None
    if name == "clinic_report":
        c = clinic(d["p_code"], d["p_key"])
        pts = [{"id": p["id"], "alias": p["alias"], "joined_at": p["joined_at"], "sessions": sorted(p["sessions"], key=lambda s: s.get("date", ""))} for p in PATIENTS if p["clinic"] == c["code"]]
        return {"name": c["name"], "code": c["code"], "patients": pts}
    if name == "clinic_remove_patient":
        c = clinic(d["p_code"], d["p_key"])
        PATIENTS[:] = [p for p in PATIENTS if not (p["clinic"] == c["code"] and p["id"] == d["p_patient"])]
        return None
    if name == "submit_feedback":
        if d["p_context"] not in ("practice", "game", "challenge", "guided", "general"):
            raise Err("unknown context")
        if d["p_ease"] is None and d["p_again"] is None and d["p_helped"] is None and not (d["p_comment"] or "").strip():
            raise Err("empty feedback")
        FEEDBACK.append({k[2:]: v for k, v in d.items()})
        return None
    if name == "feedback_summary":
        avg = lambda k: round(sum(f[k] for f in FEEDBACK if f[k]) / max(1, sum(1 for f in FEEDBACK if f[k])), 2)
        return {"answers": len(FEEDBACK), "people": len({f["device"] for f in FEEDBACK}), "ease": avg("ease"), "again": avg("again"), "helped": avg("helped")}
    raise KeyError(name)


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
        if not self.path.startswith("/rest/v1/rpc/") or not self.headers.get("apikey"):
            return self.reply(404, {"message": "not found"})
        d = json.loads(self.rfile.read(int(self.headers["Content-Length"])) or b"{}")
        name = self.path.split("/rpc/")[1].split("?")[0]
        if name == "debug_state":
            return self.reply(200, {"drawings": DRAWINGS, "patients": PATIENTS, "feedback": FEEDBACK})
        if name != "submit_score":
            try:
                out = rpc(name, d)
            except KeyError:
                return self.reply(404, {"message": "not found"})
            except Err as e:
                return self.reply(400, {"message": str(e)})
            return self.reply(200, out) if out is not None else self.reply(204)
        now = datetime.now(timezone.utc)
        ok_boards = {"levels", "guided", "daily-" + now.strftime("%Y-%m-%d"), "daily-" + (now - timedelta(days=1)).strftime("%Y-%m-%d")}
        bad = re.search(r"(n+i+g{2,}|n+[iy]+g+r|n+[iy]+g+[ea]+r+[sz]*$|n+[iy]+g+u+h|f+a+g+|k+i+k+e|c+h+i+n+k|r+e+t+a+r+d|n+a+z+i|h+i+t+l+e+r|w+h+o+r+e|s+l+u+t|c+u+n+t|r+a+p+i+s+t)", re.sub("[^a-z]", "", d["p_player"].lower().translate(str.maketrans("0134@$!|5", "oieaasiis"))))
        if d["p_board"] not in ok_boards or not d["p_player"].strip() or bad:
            return self.reply(400, {"message": "unknown or closed board"})
        key = (d["p_board"], d["p_device"])
        new = {"board": d["p_board"], "player": d["p_player"][:24], "score": max(0, min(100, d["p_score"])), "level": d["p_level"], "stars": d["p_stars"], "t": now.timestamp()}
        old = ROWS.get(key)
        if old:
            new["score"] = max(old["score"], new["score"])
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
