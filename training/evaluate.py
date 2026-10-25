"""Evaluate the trained model against held-out drawings and the DoodleNet baseline; write docs/EVALUATION.md.

Usage: python training/evaluate.py
"""
import gzip
import json
from collections import Counter

import numpy as np
import tensorflow as tf
from PIL import Image, ImageDraw

from common import CLASSES, GAME, MODEL_DIR, OTHER, OUT, ROOT, gyro_augment, to_points
from train import build

DOCS = ROOT.parent / "docs"
DN = ROOT.parent / "models" / "doodlenet"


def load_custom():
    spec = json.loads((MODEL_DIR / "spec.json").read_text())
    model = build(spec["arch"])
    raw = np.frombuffer((MODEL_DIR / "weights.bin").read_bytes(), np.float32)
    i, off = 0, 0
    for layer in model.layers:
        n = len(layer.get_weights())
        if not n:
            continue
        ws = []
        for _ in range(n):
            shape = spec["weights"][i]["shape"]
            size = int(np.prod(shape))
            ws.append(raw[off:off + size].reshape(shape))
            off += size
            i += 1
        layer.set_weights(ws)
    return model, spec["temperature"]


def load_doodlenet():
    m = json.loads((DN / "model.json").read_text())
    raw = np.frombuffer((DN / "group1-shard1of1.bin").read_bytes(), np.float32)
    L = tf.keras.layers
    model = tf.keras.Sequential([
        tf.keras.Input((28, 28, 1)),
        L.Conv2D(16, 3, padding="same", activation="relu"), L.Conv2D(16, 3, padding="same", activation="relu"), L.MaxPooling2D(),
        L.Conv2D(32, 3, padding="same", activation="relu"), L.Conv2D(32, 3, padding="same", activation="relu"), L.MaxPooling2D(),
        L.Conv2D(64, 3, padding="same", activation="relu"), L.Conv2D(64, 3, padding="same", activation="relu"), L.MaxPooling2D(),
        L.Flatten(), L.Dense(512, activation="tanh"), L.Dense(345, activation="softmax")])
    ws, off = [], 0
    for w in m["weightsManifest"][0]["weights"]:
        n = int(np.prod(w["shape"]))
        ws.append(raw[off:off + n].reshape(w["shape"]))
        off += n
    model.set_weights(ws)
    names = json.loads((DN / "classes.json").read_text())
    return model, [n.replace("_", " ") for n in names]


def doodlenet_input(strokes, pad):
    pts = np.concatenate(strokes)
    x0, y0 = pts.min(0)
    x1, y1 = pts.max(0)
    side = max(x1 - x0, y1 - y0, 1e-6)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    N, SS = 56, 4
    sc = (N - 2 * pad) / side
    img = Image.new("L", (N * SS, N * SS), 255)
    d = ImageDraw.Draw(img)
    for s in strokes:
        q = [((N / 2 + (x - cx) * sc) * SS, (N / 2 + (y - cy) * sc) * SS) for x, y in s]
        if len(q) > 1:
            d.line(q, fill=0, width=int(2.6 * SS), joint="curve")
    a = 1 - np.asarray(img.resize((N, N), Image.BOX), np.float32) / 255
    a = a.reshape(28, 2, 28, 2).mean((1, 3))
    return (a > 0.2).astype(np.float32)[..., None]


def softmax(z):
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def summarize(p, y):
    top1 = (p.argmax(1) == y).mean()
    top3 = np.mean([y[i] in np.argsort(-p[i])[:3] for i in range(len(y))])
    conf = p.max(1)
    bins = np.linspace(0, 1, 11)
    ece = sum(abs((p.argmax(1)[m] == y[m]).mean() - conf[m].mean()) * m.mean()
              for lo, hi in zip(bins[:-1], bins[1:]) if (m := (conf > lo) & (conf <= hi)).any())
    return top1, top3, ece


def main():
    model, T = load_custom()
    res = {}
    for split in ("test_gyro", "test_clean"):
        d = np.load(OUT / f"{split}.npz")
        x, y = (d["x"].astype(np.float32) / 255)[..., None], d["y"].astype(int)
        p = softmax(model.predict(x, batch_size=1024, verbose=0) / T)
        res[split] = (p, y)
    p, y = res["test_gyro"]
    per = {c: float((p.argmax(1)[y == i] == i).mean()) for i, c in enumerate(CLASSES) if (y == i).any()}
    confusions = Counter((CLASSES[a], CLASSES[b]) for a, b in zip(y, p.argmax(1)) if a != b).most_common(12)

    dn, dn_names = load_doodlenet()
    idx = {w: [dn_names.index(c) for c in cats if c in dn_names] for w, cats in GAME.items()}
    words = list(GAME)
    with gzip.open(OUT / "test_strokes.json.gz", "rt") as f:
        test = [(lbl, d) for lbl, d in json.load(f) if CLASSES[lbl] != OTHER]
    import random
    r = random.Random(30_000)
    xs, ys = [], []
    for lbl, d in test:
        s = to_points(d)
        if s:
            xs.append(doodlenet_input(gyro_augment(s, r), 4))
            ys.append(lbl)
    dp = dn.predict(np.asarray(xs), batch_size=1024, verbose=0)
    restricted = np.stack([dp[:, idx[w]].sum(1) for w in words], 1)
    dn_top1 = float((restricted.argmax(1) == np.asarray(ys)).mean())
    game = y != CLASSES.index(OTHER)
    ours_game_top1 = float((p[game][:, :len(words)].argmax(1) == y[game]).mean())

    real_lines, real_eval = [], {}
    if (OUT / "test_real.npz").exists():
        d = np.load(OUT / "test_real.npz")
        xr, yr = (d["x"].astype(np.float32) / 255)[..., None], d["y"].astype(int)
        pr = softmax(model.predict(xr, batch_size=1024, verbose=0) / T)
        ours_real = float((pr[:, :len(words)].argmax(1) == yr).mean())
        with gzip.open(OUT / "test_real_strokes.json.gz", "rt") as f:
            rs = [(lbl, to_points(dr)) for lbl, dr in json.load(f)]
        rx = np.asarray([doodlenet_input(s, 4) for _, s in rs])
        rd = dn.predict(rx, batch_size=1024, verbose=0)
        dn_real = float((np.stack([rd[:, idx[w]].sum(1) for w in words], 1).argmax(1) == np.asarray([l for l, _ in rs])).mean())
        real_eval = {"real_n": int(len(yr)), "real_ours_top1": round(ours_real, 4), "real_doodlenet_top1": round(dn_real, 4)}
        real_lines = [
            "## Real gyroscope drawings shared by players", "",
            f"{len(yr)} drawings that players chose to share, held out from training (`training/fetch_donations.py`). This is the closest measure of accuracy in real play.", "",
            "| Model | Top-1 accuracy |", "|---|---|",
            f"| DoodleNet | {dn_real:.1%} |", f"| Tilt Sketch model | {ours_real:.1%} |", ""]

    g1, g3, ge = summarize(*res["test_gyro"])
    c1, c3, ce = summarize(*res["test_clean"])
    spec = json.loads((MODEL_DIR / "spec.json").read_text())
    lines = [
        "# Model evaluation", "",
        f"Generated by `training/evaluate.py` on {spec['trained']['date']}. Test drawings were never seen in training.", "",
        "## Headline", "",
        "| Test set | Top-1 accuracy | Top-3 accuracy | Calibration error (ECE) |", "|---|---|---|---|",
        f"| Gyro-style drawings (wobble, rotation, cut-off strokes) | {g1:.1%} | {g3:.1%} | {ge:.3f} |",
        f"| Clean drawings | {c1:.1%} | {c3:.1%} | {ce:.3f} |", "",
        "## Against the previous AI (DoodleNet)", "",
        "Both models choose among the game's objects only, on the same gyro-style test drawings (the \"other\" class excluded because DoodleNet has none).", "",
        "| Model | Top-1 accuracy |", "|---|---|",
        f"| DoodleNet (ml5.js, 28×28 input, 345 classes, restricted to ours) | {dn_top1:.1%} |",
        f"| Tilt Sketch model (64×64 input, trained for our objects) | {ours_game_top1:.1%} |", "",
        *real_lines,
        "## Accuracy per object (gyro-style test)", "",
        "| Object | Accuracy |", "|---|---|",
        *[f"| {c} | {v:.0%} |" for c, v in sorted(per.items(), key=lambda kv: kv[1])], "",
        "## Most common confusions", "",
        "| True object | Predicted as | Count |", "|---|---|---|",
        *[f"| {a} | {b} | {n} |" for (a, b), n in confusions], "",
    ]
    DOCS.mkdir(exist_ok=True)
    (DOCS / "EVALUATION.md").write_text("\n".join(lines))
    spec["evaluation"] = {"gyro_top1": round(g1, 4), "gyro_top3": round(g3, 4), "clean_top1": round(c1, 4),
                          "doodlenet_game_top1": round(dn_top1, 4), "ours_game_top1": round(ours_game_top1, 4), **real_eval}
    (MODEL_DIR / "spec.json").write_text(json.dumps(spec, indent=1))
    print("\n".join(lines[:14]))


if __name__ == "__main__":
    main()
