"""Game layer: tutorial, XP and levels, streak, achievements, unlockable colors, sharing, sounds toggle, rehab hidden."""
import asyncio, math
from playwright.async_api import async_playwright
from e2e_challenges import BASE, ORI, CONNECT, draw_sun


async def strokes(pg, paths):
    sens = await pg.evaluate("degPerSheet()")
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)
    for pts in paths:
        await pg.evaluate(f"__o({pts[0][0] * sens},{pts[0][1] * sens})"); await pg.wait_for_timeout(120)
        await pg.mouse.down()
        for x, y in pts[1:]:
            await pg.evaluate(f"__o({x * sens},{y * sens})"); await pg.wait_for_timeout(16)
        await pg.wait_for_timeout(80); await pg.mouse.up(); await pg.wait_for_timeout(400)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
        await ctx.add_init_script(f"addEventListener('DOMContentLoaded',()=>{{{CONNECT}}})")
        await ctx.add_init_script("try{if(localStorage.getItem('ts-donate')==null)localStorage.setItem('ts-donate','false');localStorage.setItem('ts-fb-snooze',String(Date.now()));localStorage.removeItem('ts-rehab')}catch(_){}")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/index.html")
        await pg.evaluate(ORI)
        await pg.evaluate("S.sens=22;WORDS.splice(0,WORDS.length,'sun');LEVEL_LIST.forEach(l=>l.word='sun');LEVEL_LIST[0].time=8;DAILY_TIME=8")
        await pg.wait_for_function("AI.state==='ok'", timeout=30000)

        hidden = await pg.evaluate("['#tPractice','#cClinic','#profManage'].map(s=>getComputedStyle(document.querySelector(s)).display)")
        print("rehab entries hidden:", hidden)
        assert all(h == "none" for h in hidden)
        print("level chip:", await pg.inner_text("#profLv"))

        await pg.evaluate("void(window.__tut=runTutorial())")
        await pg.wait_for_function("D.state==='run'", timeout=8000)
        print("tutorial 1:", await pg.inner_text("#coachT"))
        await pg.wait_for_timeout(700); await pg.evaluate("__o(4,3)"); await pg.wait_for_function("document.querySelector('#coachT').textContent.includes('big button')", timeout=5000)
        print("tutorial 2:", await pg.inner_text("#coachT"))
        await strokes(pg, [[(0.1 * math.cos(i / 40 * 2 * math.pi), 0.1 * math.sin(i / 40 * 2 * math.pi)) for i in range(41)]])
        await pg.wait_for_function("document.querySelector('#coachT').textContent.includes('rays')", timeout=5000)
        print("tutorial 3:", await pg.inner_text("#coachT"))
        await strokes(pg, [[(r * math.cos(k / 8 * 2 * math.pi), r * math.sin(k / 8 * 2 * math.pi)) for r in (0.14, 0.17, 0.2)] for k in range(8)])
        await pg.wait_for_function("document.querySelector('#coachT').textContent.includes('got it')", timeout=8000)
        print("tutorial 4:", await pg.inner_text("#coachT"), "| AI live:", await pg.inner_text("#liveAI"))
        await pg.click("#finish")
        await pg.wait_for_selector("#s-hand:not([hidden])", timeout=5000)
        print("after tutorial:", await pg.inner_text("#hWho"))
        await pg.click("#hGo")
        assert await pg.evaluate("window.__tut") and await pg.evaluate("store.get('ts-tut',false)")

        await pg.evaluate("show('s-home')")
        await pg.click("#cDaily"); await pg.wait_for_selector("#s-hand:not([hidden])")
        await draw_sun(pg)
        await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        await pg.wait_for_timeout(500)
        xp = (await pg.inner_text("#crXP")).replace("\n", " | ")
        print("daily result XP:", xp)
        assert "XP" in xp and "streak" in xp
        await pg.screenshot(path="game_result.png", full_page=True)
        await pg.wait_for_selector("#toast.on", timeout=5000)
        print("toast:", (await pg.inner_text("#toast")).replace("\n", " "))

        async with pg.expect_download() as dl:
            await pg.click("#crActions button:has-text('Share drawing')")
        path = await (await dl.value).path()
        from PIL import Image
        im = Image.open(path)
        print("share image:", im.size)
        assert im.size == (1080, 1350)
        im.save("game_share.png")

        g = await pg.evaluate("Game.state()")
        print("state:", {k: g[k] for k in ("xp", "draws", "streak", "shares", "got")})
        assert g["draws"] == 1 and g["streak"] == 1 and g["shares"] == 1 and "first" in g["got"] and "share" in g["got"]

        await pg.evaluate("(()=>{const s=Game.state();s.xp=460;store.set('ts-game',s)})()")
        await pg.evaluate("show('s-home')"); await pg.click("#cLevels"); await pg.click(".lv[data-k='0']")
        await pg.wait_for_selector("#s-hand:not([hidden])")
        await draw_sun(pg)
        await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        lv = await pg.evaluate("Game.levelOf(Game.state().xp).n")
        unlocked = await pg.evaluate("[...document.querySelectorAll('#swatches .sw')].map(b=>b.dataset.c||('lock'+b.dataset.lock))")
        print("player level:", lv, "| swatches:", unlocked)
        assert lv >= 3 and "#E0A100" in unlocked and "lock5" in unlocked
        print("chip:", await pg.inner_text("#profLv"), "| home daily card:", (await pg.evaluate("renderChallengeCards(),document.querySelector('#cDaily').innerText")).replace("\n", " | "))

        await pg.evaluate("show('s-home')"); await pg.click("#cTrophies")
        await pg.wait_for_selector("#s-trophies:not([hidden])")
        got = await pg.evaluate("document.querySelectorAll('#tpList .tp.got').length")
        print("trophies screen:", (await pg.inner_text("#tpStats")).replace("\n", " "), "| unlocked items:", got)
        assert got >= 3
        await pg.screenshot(path="game_trophies.png", full_page=True)

        await pg.evaluate("openSettings()")
        await pg.click("[data-fx=sound]")
        print("sound off:", await pg.evaluate("FX.sound"), "| saved:", await pg.evaluate("localStorage.getItem('ts-fx')"))
        assert await pg.evaluate("FX.sound") is False
        print("game safety note shown:", await pg.is_visible(".disclaimer.game-only"))

        await pg.evaluate("localStorage.setItem('ts-lang','es')"); await pg.reload(); await pg.evaluate(ORI)
        await pg.evaluate("Game.openTrophies()"); await pg.wait_for_timeout(400)
        print("es trophies:", (await pg.inner_text("#tpList")).replace("\n", " | ")[:160])
        assert "logros" in (await pg.inner_text("#s-trophies")).lower()
        print("page errors:", errs or "none")
        assert not errs
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
