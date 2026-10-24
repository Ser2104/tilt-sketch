"""Download Quick, Draw! strokes for the game's objects and an "other" pool.

Usage:
  python training/prepare_data.py --per-class 4000
  python training/prepare_data.py --synthetic          # offline dry run with generated shapes
"""
import argparse
import gzip
import json
import math
import random
import urllib.parse
import urllib.request

import numpy as np

from common import DATA, GAME, OTHER, other_categories

URL = "https://storage.googleapis.com/quickdraw_dataset/full/simplified/{}.ndjson"


def fetch(category, limit):
    url = URL.format(urllib.parse.quote(category))
    out = []
    with urllib.request.urlopen(url, timeout=60) as r:
        for raw in r:
            d = json.loads(raw)
            if d.get("recognized"):
                out.append(d["drawing"])
                if len(out) >= limit:
                    break
    return out


def save(name, drawings):
    DATA.mkdir(parents=True, exist_ok=True)
    with gzip.open(DATA / f"{name}.ndjson.gz", "wt") as f:
        for d in drawings:
            f.write(json.dumps(d) + "\n")


def synthetic(per_class, seed=0):
    rng = random.Random(seed)
    names = list(GAME) + [OTHER]
    for k, name in enumerate(names):
        proto = []
        r2 = random.Random(1000 + k)
        for _ in range(r2.randint(1, 4)):
            n = r2.randint(3, 9)
            proto.append([(r2.uniform(20, 235), r2.uniform(20, 235)) for _ in range(n)])
        drawings = []
        for _ in range(per_class):
            d = []
            for s in proto:
                pts = [(x + rng.gauss(0, 8), y + rng.gauss(0, 8)) for x, y in s]
                d.append([[int(min(255, max(0, x))) for x, _ in pts], [int(min(255, max(0, y))) for _, y in pts]])
            drawings.append(d)
        save(name, drawings)
    print(f"synthetic data: {len(names)} classes x {per_class}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=4000)
    ap.add_argument("--other-categories", type=int, default=50)
    ap.add_argument("--synthetic", action="store_true")
    a = ap.parse_args()
    if a.synthetic:
        return synthetic(min(a.per_class, 300))
    for word, cats in GAME.items():
        per = math.ceil(a.per_class / len(cats))
        drawings = [d for c in cats for d in fetch(c, per)]
        save(word, drawings[: a.per_class])
        print(f"{word}: {len(drawings)}")
    pool = other_categories(a.other_categories)
    per = math.ceil(a.per_class / len(pool)) + 1
    other = [d for c in pool for d in fetch(c, per)]
    random.Random(1).shuffle(other)
    save(OTHER, other[: a.per_class])
    (DATA / "other_categories.json").write_text(json.dumps(pool, indent=1))
    print(f"other: {len(other)} from {len(pool)} categories")


if __name__ == "__main__":
    main()
