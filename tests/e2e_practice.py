import asyncio, math, os, json
from playwright.async_api import async_playwright
BASE = os.environ.get("BASE", "http://localhost:8766")
ORI = """(()=>{window.__o=(px,py)=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:-px,beta:90-py,gamma:0});dispatchEvent(e)};__o(0,0)})()"""


async def trace(pg, tremor_deg, sloppy):
    tpl = await pg.evaluate("D.template.pts")
    sens = await pg.evaluate("degPerSheet()")
    x0, y0 = tpl[0]
    pts = await pg.evaluate("Motor.densify(D.template.pts,.01)")
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)
    await pg.evaluate("__o(0,0)")
    await pg.wait_for_timeout(120)
    await pg.mouse.down()
    t = 0.0
    for i, (x, y) in enumerate(pts):
        t += 1 / 60
        jx = tremor_deg * math.sin(2 * math.pi * 8 * t)
        jy = tremor_deg * math.cos(2 * math.pi * 8 * t)
        off = sloppy * math.sin(i / 7)
        await pg.evaluate(f"__o({(x - x0) * sens + jx + off},{(y - y0) * sens + jy + off})")
        await pg.wait_for_timeout(16)
    await pg.wait_for_timeout(150)
    await pg.mouse.up()
    await pg.click("#finish")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/index.html")
        await pg.evaluate(ORI)
        await pg.click("#tPractice")
        await pg.fill("#pfName", "Test patient")
        await pg.click("#pfCreate")
        print("hub stats:", (await pg.inner_text("#pfStats")).replace("\n", " "))
        await pg.click("#pCal")
        await pg.click("#calGo")
        for i in range(8 * 30):
            a = i / 60 * 2 * math.pi
            await pg.evaluate(f"__o({15 * math.cos(a)},{10 * math.sin(a)})")
            await pg.wait_for_timeout(33)
        await pg.wait_for_selector("#calSave:not([hidden])", timeout=5000)
        print("calibration:", (await pg.inner_text("#calResult")).replace("\n", " "))
        await pg.screenshot(path="pr_cal.png")
        await pg.click("#calSave")
        print("hub after cal:", (await pg.inner_text("#pfStats")).replace("\n", " "))
        await pg.click("#pStart")
        for i in range(5):
            await pg.wait_for_selector("#s-hand:not([hidden])")
            if i == 0:
                await pg.screenshot(path="pr_intro.png")
            await pg.evaluate("__o(0,0)")
            await pg.click("#hGo")
            await pg.wait_for_function("D.state==='run'", timeout=8000)
            await trace(pg, tremor_deg=0.05 if i < 3 else 1.2, sloppy=0 if i % 2 == 0 else 1.5)
            if i == 1:
                pass
            await pg.wait_for_selector("#s-ex:not([hidden])", timeout=5000)
            print(f"ex{i+1}", await pg.inner_text("#exTitle"), "score", await pg.inner_text("#exScore"), "|", (await pg.inner_text("#exChips")).replace("\n", " "), "|", await pg.inner_text("#exAdapt"))
            if i == 0:
                await pg.screenshot(path="pr_ex.png")
            await pg.click("#exNext")
        await pg.wait_for_selector("#s-psum:not([hidden])")
        print("summary:", await pg.inner_text("#psTitle"), "|", await pg.inner_text("#psInfo"))
        await pg.click("#psProg")
        await pg.wait_for_selector("#s-prog:not([hidden])")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path="pr_prog.png", full_page=True)
        async with pg.expect_download() as dl:
            await pg.click("#prCsv")
        d = await dl.value
        path = await d.path()
        print("csv:", open(path).read().splitlines()[:2])
        await pg.click("#prReport")
        await pg.wait_for_selector("#s-report:not([hidden])")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path="pr_report.png", full_page=True)
        await pg.emulate_media(media="print")
        print("print shows report only:", await pg.evaluate("[...document.querySelectorAll('.screen')].filter(s=>getComputedStyle(s).display!=='none').map(s=>s.id)"))
        print("errors:", errs)
        await b.close()

asyncio.run(main())
