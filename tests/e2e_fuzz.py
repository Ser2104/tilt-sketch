import asyncio, math, os, random
from playwright.async_api import async_playwright
BASE = os.environ.get("BASE", "http://localhost:8766")
ORI = """(()=>{window.__o=(px,py)=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:-px,beta:90-py,gamma:0});dispatchEvent(e)};__o(0,0)})()"""
STYLES = ["scribble", "nothing", "hold_to_end", "taps", "wild_jumps", "trace"]


async def play(pg, style, rng):
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)
    dur = await pg.evaluate("D.dur")
    sens = await pg.evaluate("degPerSheet()")
    t_end = asyncio.get_event_loop().time() + dur + 1
    if style == "nothing":
        return
    if style == "trace":
        pts = await pg.evaluate("Motor.densify(D.template.pts,.01)")
        x0, y0 = pts[0]
        await pg.mouse.down()
        for x, y in pts:
            await pg.evaluate(f"__o({(x - x0) * sens},{(y - y0) * sens})")
            await pg.wait_for_timeout(16)
        await pg.mouse.up()
        await pg.click("#finish")
        return
    if style in ("scribble", "hold_to_end"):
        await pg.mouse.down()
    i = 0
    while asyncio.get_event_loop().time() < t_end and await pg.evaluate("D.state==='run'"):
        i += 1
        if style == "scribble" or style == "hold_to_end":
            await pg.evaluate(f"__o({sens * 0.45 * math.sin(i * 0.37) + rng.uniform(-3, 3)},{sens * 0.45 * math.cos(i * 0.23)})")
        elif style == "taps":
            await pg.mouse.down(); await pg.wait_for_timeout(30); await pg.mouse.up()
            await pg.evaluate(f"__o({rng.uniform(-10, 10)},{rng.uniform(-10, 10)})")
        elif style == "wild_jumps":
            await pg.evaluate(f"__o({rng.uniform(-170, 170)},{rng.uniform(-80, 80)})")
            if i % 5 == 0:
                await pg.mouse.down()
            if i % 7 == 0:
                await pg.mouse.up()
        await pg.wait_for_timeout(16)
    await pg.mouse.up()


async def main():
    rng = random.Random(4)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={"width": 390, "height": 844})).new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/index.html")
        await pg.evaluate(ORI)
        await pg.evaluate("Profiles.create('Fuzz');S.sens=24")
        await pg.click("#tPractice")
        results = {}
        for rnd in range(2):
            await pg.click("#pStart")
            for i in range(5):
                style = STYLES[(rnd * 5 + i) % len(STYLES)]
                try:
                    await pg.wait_for_selector("#s-hand:not([hidden])", timeout=10000)
                except Exception:
                    print("NO HANDOFF at", rnd, i, "screen:", await pg.evaluate("[...document.querySelectorAll('.screen')].find(s=>!s.hidden)?.id"), errs); await b.close(); return
                await pg.evaluate("D.dur=4")
                await pg.evaluate("__o(0,0)")
                await pg.click("#hGo")
                await pg.evaluate("D.dur=4")
                await pg.wait_for_function("D.state==='run'", timeout=8000)
                await play(pg, style, rng)
                try:
                    await pg.wait_for_selector("#s-ex:not([hidden])", timeout=8000)
                except Exception:
                    print("STUCK after", style, "state:", await pg.evaluate("D.state"), "errors:", errs)
                    await b.close()
                    return
                results.setdefault(style, []).append(int(await pg.inner_text("#exScore")))
                await pg.click("#exNext")
            await pg.wait_for_selector("#s-psum:not([hidden])")
            await pg.click("#psHub")
        print("scores by style:", results)
        print("errors:", errs)
        await b.close()

asyncio.run(main())
