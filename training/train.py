"""Train the Tilt Sketch doodle classifier and export it for the browser.

Usage: python training/train.py --epochs 12 --batch 256
Writes models/tiltsketch/spec.json and models/tiltsketch/weights.bin.
"""
import argparse
import json
import time

import numpy as np
import tensorflow as tf

from common import CLASSES, MODEL_DIR, OUT, SIZE, PAD, LINE

ARCH = [
    {"type": "conv", "filters": 32}, {"type": "bn"}, {"type": "relu"},
    {"type": "conv", "filters": 32}, {"type": "bn"}, {"type": "relu"}, {"type": "pool"},
    {"type": "conv", "filters": 64}, {"type": "bn"}, {"type": "relu"},
    {"type": "conv", "filters": 64}, {"type": "bn"}, {"type": "relu"}, {"type": "pool"},
    {"type": "conv", "filters": 128}, {"type": "bn"}, {"type": "relu"},
    {"type": "conv", "filters": 128}, {"type": "bn"}, {"type": "relu"}, {"type": "pool"},
    {"type": "gap"}, {"type": "dropout", "rate": 0.3}, {"type": "dense", "units": len(CLASSES)},
]


def build():
    x = inp = tf.keras.Input((SIZE, SIZE, 1))
    for L in ARCH:
        t = L["type"]
        if t == "conv":
            x = tf.keras.layers.Conv2D(L["filters"], 3, padding="same", use_bias=False)(x)
        elif t == "bn":
            x = tf.keras.layers.BatchNormalization()(x)
        elif t == "relu":
            x = tf.keras.layers.ReLU()(x)
        elif t == "pool":
            x = tf.keras.layers.MaxPooling2D()(x)
        elif t == "gap":
            x = tf.keras.layers.GlobalAveragePooling2D()(x)
        elif t == "dropout":
            x = tf.keras.layers.Dropout(L["rate"])(x)
        elif t == "dense":
            x = tf.keras.layers.Dense(L["units"])(x)
    return tf.keras.Model(inp, x)


def load(split):
    d = np.load(OUT / f"{split}.npz")
    return (d["x"].astype(np.float32) / 255.0)[..., None], d["y"].astype(np.int32)


def fit_temperature(logits, y):
    best, bt = 1e9, 1.0
    for T in np.linspace(0.5, 4, 36):
        z = logits / T
        z = z - z.max(1, keepdims=True)
        nll = -(z[np.arange(len(y)), y] - np.log(np.exp(z).sum(1))).mean()
        if nll < best:
            best, bt = nll, float(T)
    return bt


def export(model, T, meta):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    blobs, manifest = [], []
    for layer in model.layers:
        for w in layer.get_weights():
            a = np.asarray(w, np.float32)
            manifest.append({"layer": layer.name, "shape": list(a.shape)})
            blobs.append(a.tobytes())
    (MODEL_DIR / "weights.bin").write_bytes(b"".join(blobs))
    spec = {"version": 1, "input": {"size": SIZE, "pad": PAD, "line": LINE}, "classes": CLASSES,
            "arch": ARCH, "weights": manifest, "temperature": T, "trained": meta}
    (MODEL_DIR / "spec.json").write_text(json.dumps(spec, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=256)
    a = ap.parse_args()
    xtr, ytr = load("train")
    xva, yva = load("val")
    model = build()
    steps = a.epochs * int(np.ceil(len(xtr) / a.batch))
    opt = tf.keras.optimizers.Adam(tf.keras.optimizers.schedules.CosineDecay(2e-3, steps))
    model.compile(opt, tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True), metrics=["accuracy"])
    model.summary()
    t0 = time.time()
    hist = model.fit(xtr, ytr, validation_data=(xva, yva), epochs=a.epochs, batch_size=a.batch, verbose=2)
    T = fit_temperature(model.predict(xva, batch_size=1024, verbose=0), yva)
    meta = {"date": time.strftime("%Y-%m-%d"), "train_images": int(len(xtr)), "val_images": int(len(xva)),
            "epochs": a.epochs, "minutes": round((time.time() - t0) / 60, 1),
            "val_accuracy": round(float(hist.history["val_accuracy"][-1]), 4), "params": int(model.count_params())}
    export(model, T, meta)
    print(json.dumps(meta, indent=1), "temperature", T)


if __name__ == "__main__":
    main()
