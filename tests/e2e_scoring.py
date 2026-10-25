import asyncio, math, os, random
from playwright.async_api import async_playwright
BASE = os.environ.get("BASE", "http://localhost:8766")


def stroke(pts):
    return {"c": "#13213C", "w": .008, "pts": pts}


def sun():
    c = [[.5 + .1 * math.cos(i / 40 * 2 * math.pi), .5 + .1 * math.sin(i / 40 * 2 * math.pi)] for i in range(41)]
    rays = [[[.5 + .14 * math.cos(a), .5 + .14 * math.sin(a)], [.5 + .2 * math.cos(a), .5 + .2 * math.sin(a)]] for a in [k / 8 * 2 * math.pi for k in range(8)]]
    return [stroke(c)] + [stroke(r) for r in rays]


def house():
    return [stroke([[.35, .45], [.35, .7], [.65, .7], [.65, .45], [.35, .45]]), stroke([[.32, .47], [.5, .3], [.68, .47]]), stroke([[.47, .7], [.47, .6], [.53, .6], [.53, .7]])]


def scribble(seed):
    r = random.Random(seed)
    pts, x, y = [], .5, .5
    for _ in range(400):
        x = min(.8, max(.2, x + r.uniform(-.06, .06)))
        y = min(.8, max(.2, y + r.uniform(-.06, .06)))
        pts.append([x, y])
    return [stroke(pts)]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto(BASE + "/index.html")
        await pg.wait_for_function("AI.state==='ok'", timeout=60000)
        cases = [("sun", sun()), ("house", house()), ("sun", scribble(1)), ("house", scribble(2))]
        for word, strokes in cases:
            r = await pg.evaluate("async a=>(await aiJudge(a[0],[{strokes:a[1]}]))[0]", [word, strokes])
            label = "scribble" if len(strokes) == 1 and len(strokes[0]["pts"]) == 400 else "real drawing"
            print(f"target {word:6} | {label:12} -> {r['acc']:3}% (AI sees: {r['guess']})")
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())
