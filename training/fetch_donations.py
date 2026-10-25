"""Download the gyroscope drawings players chose to share, for training and for a real-world test set.

Needs the project's secret key (Supabase -> Project Settings -> API keys -> Secret keys). Keep it private:
set it as an environment variable or a Colab secret, never in the repository.

Usage: SUPABASE_SECRET_KEY=sb_secret_... python training/fetch_donations.py --min-score 10
"""
import argparse
import gzip
import json
import os
import re
import urllib.request

from common import DATA, GAME

URL = os.environ.get("SUPABASE_URL") or re.search(r'https://[a-z0-9]+\.supabase\.co', (DATA.parent.parent / "js" / "config.js").read_text()).group(0)


def fetch(key, page=1000):
    headers = {"apikey": key}
    if not key.startswith("sb_"):
        headers["Authorization"] = "Bearer " + key
    rows, offset = [], 0
    while True:
        q = f"{URL}/rest/v1/drawings?select=id,word,strokes,ctrl,ai_score&order=id&limit={page}&offset={offset}"
        batch = json.loads(urllib.request.urlopen(urllib.request.Request(q, headers=headers)).read())
        rows += batch
        if len(batch) < page:
            return rows
        offset += page


def valid(strokes):
    try:
        ok = [s for s in strokes if len(s) == 2 and len(s[0]) == len(s[1]) and len(s[0]) >= 2
              and all(0 <= v <= 1000 for a in s for v in a)]
    except TypeError:
        return None
    return ok if sum(len(s[0]) for s in ok) >= 8 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-score", type=int, default=10, help="skip drawings the AI scored below this (likely scribbles)")
    a = ap.parse_args()
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not key:
        raise SystemExit("Set SUPABASE_SECRET_KEY (the project's secret key) first.")
    rows = fetch(key)
    out, skipped = [], 0
    for r in rows:
        s = valid(r["strokes"])
        if r["word"] not in GAME or s is None or (r["ai_score"] or 0) < a.min_score:
            skipped += 1
            continue
        out.append({"id": r["id"], "word": r["word"], "ctrl": r["ctrl"], "drawing": s})
    DATA.mkdir(parents=True, exist_ok=True)
    with gzip.open(DATA / "donated.ndjson.gz", "wt") as f:
        for o in out:
            f.write(json.dumps(o) + "\n")
    print(f"{len(out)} usable drawings for {len({o['word'] for o in out})} objects, {skipped} skipped -> {DATA / 'donated.ndjson.gz'}")


if __name__ == "__main__":
    main()
