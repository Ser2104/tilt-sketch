import asyncio, math
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("BASE", "http://localhost:8766")
PEER = os.environ.get("PEER", "peerhost=127.0.0.1&peerport=9000")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 800}, device_scale_factor=2, has_touch=False)
        logs = []
        pg.on("console", lambda m: logs.append(m.type + ": " + m.text))
        pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
        await pg.goto(BASE+"/index.html")
        await pg.wait_for_function("document.querySelector('#aiStatus .dot.ok')", timeout=60000)
        await pg.evaluate("S.players=['Alex','Sam'];renderPlayers();S.time.solo=8;S.rounds=1;syncSettings();WORDS.splice(0,WORDS.length,'sun')")
        await pg.evaluate("""(()=>{const f=(b,g)=>{const e=new Event('deviceorientation');Object.assign(e,{beta:b,gamma:g});dispatchEvent(e)};window.__ori=f;f(40,0)})()""")
        await pg.click("#tPlay")
        await pg.click("#start")
        for turn in range(2):
            await pg.wait_for_selector("#s-hand:not([hidden])")
            await pg.click("#hGo")
            await pg.wait_for_function("D.state==='run'", timeout=5000)
            await pg.evaluate("window.__ori(40,0)")
            pen = await pg.query_selector("#pen")
            bb = await pen.bounding_box()
            await pg.mouse.move(bb["x"] + 50, bb["y"] + 20)
            # circle via tilt
            R = 4
            for i in range(0, 45):
                a = i / 44 * 2 * math.pi
                await pg.evaluate(f"window.__ori({40 + R*math.sin(a) - (R if i==0 else 0)*0},{R*math.cos(a)})")
                if i == 1: await pg.mouse.down()
                await pg.wait_for_timeout(25)
            await pg.mouse.up()
            for k in range(8):
                a = k / 8 * 2 * math.pi
                await pg.evaluate(f"window.__ori({40 + 5.2*math.sin(a)},{5.2*math.cos(a)})"); await pg.wait_for_timeout(120)
                await pg.mouse.down()
                await pg.evaluate(f"window.__ori({40 + 7.5*math.sin(a)},{7.5*math.cos(a)})"); await pg.wait_for_timeout(140)
                await pg.mouse.up()
            if turn == 0:
                await pg.screenshot(path="shot_draw.png")
            if await pg.evaluate("D.state==='run'"): await pg.click("#finish")
        await pg.wait_for_selector("#s-res:not([hidden])", timeout=20000)
        print(await pg.inner_text("#rCards"))
        await pg.screenshot(path="shot_res.png", full_page=True)
        print("\n".join(logs[:20]))
        await b.close()

asyncio.run(main())
