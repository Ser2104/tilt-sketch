import asyncio
from playwright.async_api import async_playwright
from e2e_challenges import BASE, ORI


async def visible(pg):
    return await pg.evaluate("document.querySelector('.screen:not([hidden])').id")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/index.html")
        await pg.evaluate(ORI)
        await pg.click("#cLevels")
        await pg.click(".lv[data-k='0']")
        await pg.wait_for_selector("#s-hand:not([hidden])")
        await pg.click("#hGo")
        await pg.wait_for_function("D.state==='run'", timeout=8000)
        await pg.go_back()
        await pg.wait_for_timeout(300)
        print("back while drawing ->", await visible(pg), "| drawing stopped:", await pg.evaluate("D.state"))
        assert await visible(pg) == "s-levels" and await pg.evaluate("D.state") == "idle"
        await pg.go_back()
        await pg.wait_for_timeout(300)
        print("back again ->", await visible(pg))
        assert await visible(pg) == "s-home"
        await pg.click("#tPlay")
        await pg.click("#openSettings3")
        await pg.go_back(); await pg.wait_for_timeout(200)
        print("settings, back ->", await visible(pg))
        assert await visible(pg) == "s-play"
        await pg.go_back(); await pg.wait_for_timeout(200)
        assert await visible(pg) == "s-home"
        await pg.go_forward(); await pg.wait_for_timeout(200)
        print("forward ->", await visible(pg))
        assert await visible(pg) == "s-play"
        print("page errors:", errs or "none")
        assert not errs
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
