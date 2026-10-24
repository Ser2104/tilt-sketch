import asyncio, math
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("BASE", "http://localhost:8766")
PEER = os.environ.get("PEER", "peerhost=127.0.0.1&peerport=9000")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
        ctx=await b.new_context(viewport={"width":390,"height":800},device_scale_factor=2,permissions=["camera"])
        pg=await ctx.new_page();errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.goto(BASE+"/index.html")
        await pg.evaluate("""(()=>{window.__o=(px,py)=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:-px,beta:90-py,gamma:0});dispatchEvent(e)};__o(0,0)})()""")
        await pg.click("#camOn");await pg.wait_for_timeout(800)
        print("cam msg:",await pg.inner_text("#camMsg"))
        await pg.evaluate("S.players=['Alex','Sam'];renderPlayers();S.time.solo=6;S.rounds=1")
        await pg.click("#start");await pg.wait_for_selector("#s-hand:not([hidden])");await pg.click("#hGo")
        await pg.wait_for_function("D.state==='run'")
        bb=await (await pg.query_selector("#pen")).bounding_box();await pg.mouse.move(bb["x"]+40,bb["y"]+20)
        await pg.evaluate("__o(-3,-3)");await pg.wait_for_timeout(200);await pg.mouse.down()
        for i in range(31):
            a=i/30*2*math.pi;await pg.evaluate(f"__o({4*math.cos(a)-3},{4*math.sin(a)-3})");await pg.wait_for_timeout(30)
        await pg.mouse.up();await pg.wait_for_timeout(200)
        print("sheet px",await pg.evaluate("D.sheet"),"video visible",await pg.evaluate("!document.querySelector('#camv').hidden&&document.querySelector('#camv').videoWidth"))
        await pg.screenshot(path="cam_draw.png");print("errors",errs);await b.close()
asyncio.run(main())
