import asyncio
from playwright.async_api import async_playwright
from e2e_challenges import BASE, ORI, CONNECT, draw_sun
from e2e_cloud import mock_state


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await ctx.add_init_script(f"addEventListener('DOMContentLoaded',()=>{{{CONNECT}}})")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/index.html")
        await pg.evaluate(ORI)
        await pg.evaluate("S.sens=22;WORDS.splice(0,WORDS.length,'sun');LEVEL_LIST[0].time=8;LEVEL_LIST[0].word='sun';DAILY_TIME=8")

        before = len(mock_state()["feedback"])
        await pg.click("#cDaily"); await pg.wait_for_selector("#s-hand:not([hidden])")
        await draw_sun(pg)
        await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        print("AI explains:", (await pg.inner_text("#crTop")).replace("\n", " | "))
        assert "top guesses" in (await pg.inner_text("#crTop")).lower()
        assert await pg.is_visible("#fb-s-cres"), "survey after result"
        await pg.screenshot(path="ex_result.png", full_page=True)
        await pg.click("#fb-s-cres .fbq[data-q=ease] button[data-v='4']")
        await pg.click("#fb-s-cres .fbq[data-q=again] button[data-v='5']")
        await pg.fill("#fb-s-cres textarea", "Fun but my wrist got tired")
        await pg.click("#fb-s-cres .fbsend")
        await pg.wait_for_function("document.querySelector('#fb-s-cres').textContent.includes('Thank you')", timeout=5000)
        f = mock_state()["feedback"][-1]
        print("feedback stored:", {k: f[k] for k in ("context", "ease", "again", "helped", "comment", "lang")})
        assert len(mock_state()["feedback"]) == before + 1 and f["context"] == "challenge" and f["ease"] == 4

        await pg.click("#crActions button:has-text('Back to home')")
        await pg.click("#cLevels"); await pg.click(".lv[data-k='0']")
        await pg.wait_for_selector("#s-hand:not([hidden])")
        await draw_sun(pg)
        await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        assert not await pg.is_visible("#fb-s-cres"), "no survey again right after answering"
        print("second result: no survey, AI:", (await pg.inner_text("#crTop")).replace("\n", " | "))

        await pg.evaluate("show('s-home')")
        await pg.click("#cFeedback")
        await pg.wait_for_selector("#s-fb:not([hidden])")
        await pg.fill("#fb-general textarea", "Please add Spanish")
        await pg.click("#fb-general .fbsend")
        await pg.wait_for_function("document.querySelector('#fb-general').textContent.includes('Thank you')", timeout=5000)
        print("general feedback:", mock_state()["feedback"][-1]["comment"])

        await pg.evaluate("navigator.serviceWorker.ready")
        await pg.reload()
        await pg.wait_for_function("navigator.serviceWorker.controller!==null", timeout=10000)
        await pg.wait_for_timeout(1500)
        await ctx.set_offline(True)
        await pg.reload()
        await pg.wait_for_selector("#s-home:not([hidden])", timeout=10000)
        await pg.wait_for_function("typeof AI!=='undefined'&&AI.state!=='wait'", timeout=20000)
        print("offline reload: home shown, AI", await pg.evaluate("AI.state+' '+AI.kind"), "| note:", await pg.inner_text("#installMsg"))
        assert await pg.evaluate("AI.state") == "ok"
        await pg.click("#playSeg button[data-play=practice]")
        await pg.wait_for_selector("#s-practice:not([hidden])")
        print("offline practice hub opens")
        manifest = await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
        print("manifest:", manifest["name"], manifest["display"], len(manifest["icons"]), "icons")
        await ctx.set_offline(False)
        print("page errors:", errs or "none")
        assert not errs
        await b.close()


asyncio.run(main())
