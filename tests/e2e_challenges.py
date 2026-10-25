import asyncio, math, os
from playwright.async_api import async_playwright
BASE = os.environ.get("BASE", "http://localhost:8766")
MOCK = os.environ.get("MOCK", "http://127.0.0.1:8790")
ORI = """(()=>{window.__o=(px,py)=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:-px,beta:90-py,gamma:0});dispatchEvent(e)};__o(0,0)})()"""
CONNECT = f"TS_CONFIG.supabaseUrl='{MOCK}';TS_CONFIG.supabaseKey='sb_publishable_test'"


async def draw_sun(pg, scribble=False):
    await pg.evaluate("__o(0,0)")
    await pg.click("#hGo")
    await pg.wait_for_function("D.state==='run'", timeout=8000)
    sens = await pg.evaluate("degPerSheet()")
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)

    async def go(pts):
        await pg.evaluate(f"__o({pts[0][0] * sens},{pts[0][1] * sens})"); await pg.wait_for_timeout(120)
        await pg.mouse.down()
        for x, y in pts[1:]:
            await pg.evaluate(f"__o({x * sens},{y * sens})"); await pg.wait_for_timeout(16)
        await pg.wait_for_timeout(80); await pg.mouse.up()
    if scribble:
        await go([(0.25 * math.sin(i * 0.9), 0.25 * math.cos(i * 1.3)) for i in range(160)])
    else:
        await go([(0.1 * math.cos(i / 40 * 2 * math.pi), 0.1 * math.sin(i / 40 * 2 * math.pi)) for i in range(41)])
        for k in range(8):
            a = k / 8 * 2 * math.pi
            await go([(r * math.cos(a), r * math.sin(a)) for r in (0.14, 0.16, 0.18, 0.2)])
    await pg.click("#finish")


async def phone(b, name):
    pg = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)).new_page()
    pg.on("pageerror", lambda e: print("PAGEERROR", name, e))
    await pg.goto(BASE + "/index.html")
    await pg.evaluate(ORI)
    await pg.evaluate(CONNECT + ";S.sens=22;WORDS.splice(0,WORDS.length,'sun');LEVEL_LIST[0].time=8;LEVEL_LIST[0].word='sun';LEVEL_LIST[1].word='sun';LEVEL_LIST[1].time=8")
    await pg.evaluate("renderChallengeCards()")
    return pg


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        a = await phone(b, "Ana")
        await a.screenshot(path="ch_home.png")
        print("home card:", (await a.inner_text("#cDaily")).replace("\n", " | "))
        await a.click("#cRank")
        await a.fill("#rkName", "Ana")
        await a.click("#rkSave")
        await a.click("#rkBack")
        await a.evaluate("DAILY_TIME=8")
        await a.click("#cDaily")
        await a.wait_for_selector("#s-hand:not([hidden])")
        print("daily object:", await a.inner_text("#hWho"))
        await draw_sun(a)
        await a.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        print("Ana daily:", await a.inner_text("#crScore"), "|", await a.inner_text("#crInfo"))
        await a.screenshot(path="ch_result.png")

        s = await phone(b, "Leo")
        await s.click("#cRank"); await s.fill("#rkName", "Leo"); await s.click("#rkSave"); await s.click("#rkBack")
        await s.evaluate("DAILY_TIME=8")
        await s.click("#cDaily"); await s.wait_for_selector("#s-hand:not([hidden])")
        await draw_sun(s, scribble=True)
        await s.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        print("Leo daily (scribble):", await s.inner_text("#crScore"), "|", await s.inner_text("#crTitle"))
        await s.click("#crActions button:has-text('See today')")
        await s.wait_for_function("document.querySelector('#rkList li')", timeout=10000)
        print("today's ranking seen by Leo:", (await s.inner_text("#rkList")).replace("\n", " "))
        await s.screenshot(path="ch_rank.png")

        await a.click("#crActions button:has-text('Try again')")
        await a.wait_for_selector("#s-hand:not([hidden])")
        await draw_sun(a)
        await a.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        print("Ana daily retry:", await a.inner_text("#crLabel"), "|", await a.inner_text("#crScore"), "|", await a.inner_text("#crInfo"))
        await a.click("#crActions button:has-text('Back to home')")
        card = await a.inner_text("#cDaily")
        print("daily card after 2 tries:", card.replace("\n", " | "))
        assert "2 tries" in card
        rows = await a.evaluate("Rank.top('daily-'+todayUTC())")
        best = max(r["score"] for r in rows if r["player"] == "Ana")
        print("Ana's ranking score is her best try:", best)
        assert f"{best}%" in card
        await a.click("#cLevels")
        await a.wait_for_selector("#s-levels:not([hidden])")
        await a.screenshot(path="ch_levels.png", full_page=True)
        await a.click(".lv[data-k='0']")
        await a.wait_for_selector("#s-hand:not([hidden])")
        print("level 1 object:", await a.inner_text("#hWho"))
        await draw_sun(a)
        await a.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        print("level 1:", await a.inner_text("#crScore"), await a.inner_text("#crStars"), "|", await a.inner_text("#crTitle"))
        await a.click("#crActions button:nth-child(1)")
        await a.wait_for_selector("#s-hand:not([hidden])")
        print("next level object:", await a.inner_text("#hWho"))
        await draw_sun(a)
        await a.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        print("level 2:", await a.inner_text("#crScore"), await a.inner_text("#crStars"), "|", await a.inner_text("#crTitle"))
        await a.click("#crActions button:has-text('Levels ranking')")
        await a.wait_for_function("document.querySelector('#rkList li')", timeout=10000)
        print("levels ranking:", (await a.inner_text("#rkList")).replace("\n", " "))
        await a.evaluate("TS_CONFIG.supabaseUrl=''")
        await a.click("#rkTabs button[data-tab=daily]")
        print("offline ranking note:", await a.inner_text("#rkStatus"))
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())
