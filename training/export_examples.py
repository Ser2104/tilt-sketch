"""Pick, for every object, a few real Quick, Draw! drawings the trained model recognizes best; the game shows them as "how others draw it".

Usage (after training): python training/export_examples.py
Writes models/examples.json.
"""
import gzip
import json

import numpy as np

from common import CLASSES, DATA, GAME, MODEL_DIR, clean, render, to_points
from evaluate import load_custom, softmax


def main(per=3, pool=400):
    model, T = load_custom()
    out = {}
    for i, name in enumerate(CLASSES):
        if name not in GAME:
            continue
        with gzip.open(DATA / f"{name}.ndjson.gz", "rt") as f:
            ds = [json.loads(line) for line in f][-pool:]
        ds = [d for d in ds if to_points(d)]
        tidy = [d for d in ds if len(d) <= 8 and sum(len(s[0]) for s in d) <= 120]
        ds = tidy if len(tidy) >= per else ds
        if not ds:
            continue
        x = np.asarray([render(clean(to_points(d))) for d in ds], np.float32)[..., None] / 255
        p = softmax(model.predict(x, batch_size=512, verbose=0) / T)[:, i]
        picks = [ds[k] for k in np.argsort(-p)[:per]]
        out[name] = [[[[int(v) for v in s[0]], [int(v) for v in s[1]]] for s in d] for d in picks]
        print(f"{name}: best {p.max():.2f}")
    (MODEL_DIR.parent / "examples.json").write_text(json.dumps(out, separators=(",", ":")))
    print("wrote", MODEL_DIR.parent / "examples.json")


if __name__ == "__main__":
    main()
