"""Shared settings, rendering and gyro-style augmentation for the Tilt Sketch doodle model."""
import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "out"
MODEL_DIR = ROOT.parent / "models" / "tiltsketch"

SIZE = 64
PAD = 4
LINE = 2.4
SS = 4

GAME = {
    "cat": ["cat"], "dog": ["dog"], "house": ["house"], "tree": ["tree"], "bicycle": ["bicycle"],
    "airplane": ["airplane"], "guitar": ["guitar"], "umbrella": ["umbrella"], "cup": ["cup", "coffee cup", "mug"],
    "flower": ["flower"], "key": ["key"], "clock": ["clock", "alarm clock", "wristwatch"], "shoe": ["shoe"],
    "mountain": ["mountain"], "sailboat": ["sailboat"], "ice cream": ["ice cream"], "scissors": ["scissors"],
    "eyeglasses": ["eyeglasses"], "fish": ["fish"], "hat": ["hat"], "snail": ["snail"], "light bulb": ["light bulb"],
    "sea turtle": ["sea turtle"], "ladder": ["ladder", "stairs"], "cloud": ["cloud"], "hammer": ["hammer"],
    "hamburger": ["hamburger"], "crown": ["crown"], "pizza": ["pizza"], "sun": ["sun"], "moon": ["moon"],
    "star": ["star"], "butterfly": ["butterfly"], "spider": ["spider"], "castle": ["castle"], "train": ["train"],
    "car": ["car"], "pineapple": ["pineapple"], "strawberry": ["strawberry"], "mushroom": ["mushroom"],
    "cactus": ["cactus"], "penguin": ["penguin"], "giraffe": ["giraffe"], "elephant": ["elephant"],
    "snake": ["snake"], "fork": ["fork"], "lighthouse": ["lighthouse"], "tent": ["tent"], "rainbow": ["rainbow"],
    "snowman": ["snowman"], "television": ["television"], "pencil": ["pencil"], "candle": ["candle"],
    "smiley face": ["smiley face"], "hot air balloon": ["hot air balloon"], "watermelon": ["watermelon"],
    "octopus": ["octopus"], "whale": ["whale"], "owl": ["owl"], "shark": ["shark"], "helicopter": ["helicopter"],
    "hourglass": ["hourglass"], "skull": ["skull"], "lightning": ["lightning"], "snowflake": ["snowflake"],
    "sword": ["sword"], "helmet": ["helmet"], "dragon": ["dragon"], "flying saucer": ["flying saucer"],
    "mermaid": ["mermaid"], "angel": ["angel"], "diamond": ["diamond"], "bee": ["bee"], "rabbit": ["rabbit"],
    "frog": ["frog"], "camera": ["camera"], "headphones": ["headphones"], "Eiffel Tower": ["The Eiffel Tower"],
}
OTHER = "other"
CLASSES = list(GAME) + [OTHER]


def all_quickdraw_categories():
    names = json.loads((ROOT.parent / "models" / "doodlenet" / "classes.json").read_text())
    return sorted(n.replace("_", " ") for n in names)


def other_categories(n=50, seed=7):
    used = {c for v in GAME.values() for c in v}
    pool = [c for c in all_quickdraw_categories() if c not in used]
    random.Random(seed).shuffle(pool)
    keep = {"squiggle", "line", "zigzag", "circle", "square", "triangle"}
    return sorted(set(pool[:n]) | (keep & set(pool)))


def to_points(drawing):
    return [np.stack([np.asarray(s[0], float), np.asarray(s[1], float)], 1) for s in drawing if len(s[0])]


def chaikin(p, it=2):
    for _ in range(it):
        if len(p) < 3:
            return p
        q = [p[0]]
        for a, b in zip(p[:-1], p[1:]):
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        q.append(p[-1])
        p = np.asarray(q)
    return p


def resample(p, step):
    if len(p) < 2:
        return p
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    if d[-1] < 1e-6:
        return p[:1]
    t = np.arange(0, d[-1], step)
    return np.stack([np.interp(t, d, p[:, 0]), np.interp(t, d, p[:, 1])], 1)


def gyro_augment(strokes, rng):
    """Make a clean doodle look like it was drawn by aiming a phone."""
    pts = np.concatenate(strokes)
    span = max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1]), 1.0)
    a = math.radians(rng.uniform(-15, 15))
    sx, sy, sh = rng.uniform(0.85, 1.15), rng.uniform(0.85, 1.15), rng.uniform(-0.15, 0.15)
    M = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]) @ np.array([[sx, sh], [0, sy]])
    c = pts.mean(0)
    out = []
    phase = rng.uniform(0, 100)
    wob = rng.uniform(0.005, 0.03) * span
    jit = rng.uniform(0.0, 0.006) * span
    for s in strokes:
        if len(strokes) > 1 and rng.random() < 0.05:
            continue
        p = resample(s, span / 80)
        if len(p) == 0:
            continue
        t = np.arange(len(p)) / 80.0 + phase
        p = p + wob * np.stack([np.sin(2.1 * t) + 0.5 * np.sin(5.3 * t + 1), np.cos(1.7 * t) + 0.5 * np.sin(4.1 * t + 2)], 1)
        if jit > 0:
            p = p + np.random.default_rng(rng.randrange(1 << 30)).normal(0, jit, p.shape)
        if rng.random() < 0.7:
            p = chaikin(p)
        out.append((p - c) @ M.T + c)
    out = [s for s in out if len(s)]
    if not out:
        return strokes
    if len(out) > 1 and rng.random() < 0.3:
        joined = [out[0]]
        for s in out[1:]:
            joined[-1] = np.concatenate([joined[-1], s])
        out = joined
    if rng.random() < 0.3:
        total = sum(len(s) for s in out)
        keep = max(1, int(total * rng.uniform(0.6, 1.0)))
        cut, n = [], 0
        for s in out:
            if n >= keep:
                break
            cut.append(s[: max(1, keep - n)])
            n += len(s)
        out = [s for s in cut if len(s)] or out
    return out


def render(strokes, size=SIZE, pad=PAD, line=LINE):
    """Same framing as the browser: crop to the ink, keep aspect, pad, draw dark lines on white, return ink in [0,1]."""
    pts = np.concatenate(strokes)
    x0, y0 = pts.min(0)
    x1, y1 = pts.max(0)
    side = max(x1 - x0, y1 - y0, 1e-6)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    big = size * SS
    sc = (big - 2 * pad * SS) / side
    img = Image.new("L", (big, big), 255)
    d = ImageDraw.Draw(img)
    w = max(1, int(round(line * SS)))
    for s in strokes:
        q = [(big / 2 + (x - cx) * sc, big / 2 + (y - cy) * sc) for x, y in s]
        if len(q) == 1:
            x, y = q[0]
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=0)
        else:
            d.line(q, fill=0, width=w, joint="curve")
            for x, y in (q[0], q[-1]):
                d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=0)
    img = img.resize((size, size), Image.BOX)
    return (255 - np.asarray(img, np.uint8)).astype(np.uint8)
