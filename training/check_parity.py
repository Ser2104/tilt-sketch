"""Check that the browser computes the same predictions as Python for the exported model.

Usage: python training/check_parity.py --base http://localhost:8767
"""
import argparse
import asyncio
import gzip
import json

import numpy as np

from common import CLASSES, OUT, render, to_points
from evaluate import load_custom, softmax


async def browser_probs(base, drawings):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto(base + "/index.html")
        await pg.wait_for_function("AI.state!=='wait'", timeout=60000)
        kind = await pg.evaluate("AI.kind")
        out = await pg.evaluate("""async ds=>{const r=[];for(const d of ds){const strokes=d.map(s=>({c:'#13213C',w:.008,pts:s[0].map((x,i)=>[x/256,s[1][i]/256])}));r.push(Array.from(await customProbs(strokes)))}return r}""", drawings)
        await b.close()
        return kind, np.asarray(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8767")
    ap.add_argument("--n", type=int, default=40)
    a = ap.parse_args()
    with gzip.open(OUT / "test_strokes.json.gz", "rt") as f:
        test = json.load(f)[:: max(1, len(json.load(gzip.open(OUT / "test_strokes.json.gz", "rt"))) // a.n)][: a.n]
    drawings = [d for _, d in test]
    model, T = load_custom()
    x = np.stack([render(to_points(d)) for d in drawings]).astype(np.float32)[..., None] / 255
    py = softmax(model.predict(x, verbose=0) / T)
    kind, js = asyncio.run(browser_probs(a.base, drawings))
    agree = (py.argmax(1) == js.argmax(1)).mean()
    diff = np.abs(py - js).max(1)
    print(f"browser model: {kind}; top-1 agreement {agree:.1%}; max prob difference median {np.median(diff):.3f}, worst {diff.max():.3f}")


if __name__ == "__main__":
    main()
