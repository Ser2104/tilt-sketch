"""Render train/validation/test images with the browser framing and gyro-style augmentation.

Usage: python training/build_dataset.py --variants 2 --workers 2
"""
import argparse
import gzip
import json
import random
from multiprocessing import Pool

import numpy as np

from common import CLASSES, DATA, OUT, gyro_augment, render, to_points


def load(name):
    with gzip.open(DATA / f"{name}.ndjson.gz", "rt") as f:
        return [json.loads(line) for line in f]


def work(args):
    label, drawings, variants, augment, seed = args
    r = random.Random(seed)
    xs = []
    for d in drawings:
        s = to_points(d)
        if not s:
            continue
        if augment:
            for _ in range(variants):
                xs.append(render(gyro_augment(s, r)))
        else:
            xs.append(render(s))
    return label, np.asarray(xs, np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", type=int, default=2)
    ap.add_argument("--val", type=float, default=0.1)
    ap.add_argument("--test", type=float, default=0.1)
    ap.add_argument("--workers", type=int, default=2)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = {"train": [], "val": [], "test_gyro": [], "test_clean": []}
    test_strokes = []
    for i, name in enumerate(CLASSES):
        ds = load(name)
        n = len(ds)
        nt, nv = int(n * a.test), int(n * a.val)
        test, val, train = ds[:nt], ds[nt:nt + nv], ds[nt + nv:]
        jobs["train"].append((i, train, a.variants, True, 10_000 + i))
        jobs["val"].append((i, val, 1, True, 20_000 + i))
        jobs["test_gyro"].append((i, test, 1, True, 30_000 + i))
        jobs["test_clean"].append((i, test, 1, False, 40_000 + i))
        test_strokes += [(i, d) for d in test]
    with Pool(a.workers) as pool:
        for split, js in jobs.items():
            xs, ys = [], []
            for label, arr in pool.imap_unordered(work, js):
                xs.append(arr)
                ys.append(np.full(len(arr), label, np.int16))
            X, Y = np.concatenate(xs), np.concatenate(ys)
            np.savez_compressed(OUT / f"{split}.npz", x=X, y=Y)
            print(split, X.shape)
    with gzip.open(OUT / "test_strokes.json.gz", "wt") as f:
        json.dump(test_strokes, f)


if __name__ == "__main__":
    main()
