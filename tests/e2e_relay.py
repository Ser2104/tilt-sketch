"""Eight phones join one room through the Supabase Realtime relay (the path used on the published game)."""
import asyncio, os, time
from playwright.async_api import async_playwright
from e2e_multi import ORI, draw

BASE = os.environ.get("BASE", "http://localhost:8766")
URL = BASE + "/index.html"
NAMES = ["Host", "Ana", "Leo", "Maya", "Sam", "Noa", "Eli", "Ivy"]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pages, errs = [], []
        for i in range(8):
            ctx = await b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=1)
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, i=i: errs.append(f"p{i}: {e}"))
            await pg.goto(URL)
            await pg.evaluate(ORI)
            pages.append(pg)
        host, *guests = pages
        print("relay in use:", await host.evaluate("Relay.usable()"))
        assert await host.evaluate("Relay.usable()")
        await host.click("#tPlay")
        await host.evaluate("setPlay('multi');S.time.solo=6;S.rounds=1;WORDS.splice(0,WORDS.length,'sun')")
        await host.fill("#myName", NAMES[0])
        t0 = time.time()
        await host.click("#createRoom")
        await host.wait_for_selector("#s-lobby:not([hidden])", timeout=20000)
        code = await host.inner_text("#lCode")
        print(f"room {code} created in {time.time() - t0:.1f}s")

        async def join(g, name):
            await g.goto(URL + "?room=" + code)
            await g.evaluate(ORI)
            await g.fill("#myName", name)
            await g.click("#joinRoom")
            await g.wait_for_selector("#s-lobby:not([hidden])", timeout=25000)

        t0 = time.time()
        await asyncio.gather(*[join(g, n) for g, n in zip(guests, NAMES[1:])])
        await host.wait_for_function("NET.players.length===8", timeout=20000)
        print(f"8 phones in the lobby after {time.time() - t0:.1f}s:", (await guests[-1].inner_text("#lPlayers")).replace("\n", " | "))

        await host.click("#lStart")
        await asyncio.gather(*[draw(pg, 0) for pg in pages])
        for pg in pages:
            await pg.wait_for_selector("#s-board:not([hidden])", timeout=40000)
        print("round board reached on all 8 phones:", (await guests[0].inner_text("#bCards")).replace("\n", " | ")[:200])

        await host.click("#lLeave") if await host.is_visible("#lLeave") else await host.evaluate("leaveRoom('')")
        await guests[0].wait_for_function("document.querySelector('#netMsg').textContent.length>0", timeout=30000)
        print("guest after host left:", await guests[0].inner_text("#netMsg"))
        print("page errors:", errs or "none")
        assert not errs
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
