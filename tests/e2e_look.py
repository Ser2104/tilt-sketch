import asyncio, math
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("BASE", "http://localhost:8766")
PEER = os.environ.get("PEER", "peerhost=127.0.0.1&peerport=9000")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 800}, device_scale_factor=2)
        logs=[]; pg.on("pageerror", lambda e: logs.append("PAGEERROR "+str(e)))
        await pg.goto(BASE+"/index.html")
        await pg.wait_for_function("document.querySelector('#aiStatus .dot.ok')", timeout=60000)
        await pg.evaluate("S.players=['Alex','Sam','Maya','Leo'];S.mode='teams';renderPlayers();S.time.teams=10;S.rounds=1;syncSettings();WORDS.splice(0,WORDS.length,'sun')")
        await pg.evaluate("""(()=>{window.__o=(px,py)=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:-px,beta:90-py,gamma:0});dispatchEvent(e)};__o(0,0)})()""")
        await pg.screenshot(path="look_home.png", full_page=True)
        await pg.click("#tPlay")
        await pg.click("#start")
        async def stroke(pts):
            await pg.evaluate(f"__o({pts[0][0]},{pts[0][1]})"); await pg.wait_for_timeout(150)
            await pg.mouse.down()
            for x,y in pts[1:]:
                await pg.evaluate(f"__o({x},{y})"); await pg.wait_for_timeout(28)
            await pg.wait_for_timeout(120); await pg.mouse.up()
        for turn in range(4):
            await pg.wait_for_selector("#s-hand:not([hidden])")
            if turn==1: await pg.screenshot(path="look_handoff.png")
            await pg.click("#hGo")
            await pg.wait_for_function("D.state==='run'", timeout=5000)
            bb = await (await pg.query_selector("#pen")).bounding_box()
            await pg.mouse.move(bb["x"]+50, bb["y"]+20)
            if turn%2==0:
                await stroke([(4*math.cos(i/40*2*math.pi), 4*math.sin(i/40*2*math.pi)) for i in range(41)])
                await pg.screenshot(path="look_draw.png")
                if await pg.evaluate("D.state==='run'"): await pg.click("#finish")
            else:
                for k in range(8):
                    a=k/8*2*math.pi
                    await stroke([(5.2*math.cos(a)-4,5.2*math.sin(a)),(7.5*math.cos(a)-4,7.5*math.sin(a))])
                await pg.screenshot(path="look_draw2.png")
                if await pg.evaluate("D.state==='run'"): await pg.click("#finish")
        await pg.wait_for_selector("#s-res:not([hidden])", timeout=20000)
        print(await pg.inner_text("#rCards")); print(logs)
        await b.close()
asyncio.run(main())
