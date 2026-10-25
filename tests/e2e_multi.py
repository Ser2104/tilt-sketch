import asyncio, math
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("BASE", "http://localhost:8766")
PEER = os.environ.get("PEER", "peerhost=127.0.0.1&peerport=9000")

URL = BASE+"/index.html?"+PEER
ORI = """(()=>{window.__o=(px,py)=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:-px,beta:90-py,gamma:0});dispatchEvent(e)};__o(0,0)})()"""

async def draw(pg, shape):
    await pg.wait_for_selector("#s-hand:not([hidden])", timeout=30000)
    await pg.click("#hGo")
    await pg.wait_for_function("D.state==='run'", timeout=8000)
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)
    pts = [(6 * math.cos(i / 30 * 2 * math.pi) + shape, 6 * math.sin(i / 30 * 2 * math.pi)) for i in range(31)]
    await pg.evaluate(f"__o({pts[0][0]},{pts[0][1]})"); await pg.wait_for_timeout(150)
    await pg.mouse.down()
    for x, y in pts[1:]:
        await pg.evaluate(f"__o({x},{y})"); await pg.wait_for_timeout(30)
    await pg.wait_for_timeout(100); await pg.mouse.up()
    if await pg.evaluate("D.state==='run'"): await pg.click("#finish")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pages, errs = [], []
        for i in range(4):
            ctx = await b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=1)
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, i=i: errs.append(f"p{i}: {e}"))
            await pg.goto(URL)
            await pg.evaluate(ORI)
            pages.append(pg)
        host, *guests = pages
        await host.click("#tPlay")
        await host.evaluate("setPlay('multi');S.time.solo=6;S.time.teams=6;S.time.impostor=6;S.rounds=1;WORDS.splice(0,WORDS.length,'moon')")
        await host.fill("#myName", "Sergio")
        await host.click("#createRoom")
        await host.wait_for_selector("#s-lobby:not([hidden])", timeout=15000)
        code = await host.inner_text("#lCode")
        print("room", code, "qr:", await host.evaluate("!!document.querySelector('#lQr svg')"))
        for i, g in enumerate(guests[:2]):
            await g.goto(URL + "&room=" + code); await g.evaluate(ORI)
            await g.fill("#myName", ["Ana", "Leo"][i]); await g.click("#joinRoom")
            await g.wait_for_selector("#s-lobby:not([hidden])", timeout=15000)
        await host.wait_for_function("NET.players.length===3")
        print("guest lobby sees:", (await guests[0].inner_text("#lPlayers")).replace("\n", " | "))
        await host.screenshot(path="m_lobby.png")

        # SOLO, 3 phones at once
        await host.click("#lStart")
        await asyncio.gather(*[draw(pg, 0) for pg in pages[:3]])
        for pg in pages[:3]:
            await pg.wait_for_selector("#s-board:not([hidden])", timeout=20000)
        print("SOLO board on guest:", (await guests[1].inner_text("#bCards")).replace("\n", " | "))
        await guests[0].screenshot(path="m_board_guest.png")

        await host.click("#bFoot button:nth-child(1)")
        await guests[0].wait_for_function("document.querySelector('#bLabel').textContent==='Winner'", timeout=10000)
        print("FINAL on guest:", await guests[0].inner_text("#bTitle"))
        # back to lobby, 4th joins, TEAMS relay
        await host.click("#bFoot button:nth-child(2)")
        await host.wait_for_selector("#s-lobby:not([hidden])")
        g3 = guests[2]
        await g3.goto(URL + "&room=" + code); await g3.evaluate(ORI)
        await g3.fill("#myName", "Maya"); await g3.click("#joinRoom")
        await g3.wait_for_selector("#s-lobby:not([hidden])", timeout=15000)
        await host.click("#lModes button[data-m=teams]")
        await host.wait_for_function("NET.players.length===4")
        print("teams lobby:", (await g3.inner_text("#lPlayers")).replace("\n", " | "))
        await host.click("#lStart")
        # stage 1: players 0 and 2 (Sergio, Leo) draw; others wait
        await asyncio.gather(draw(pages[0], 0), draw(pages[2], 0))
        await pages[1].wait_for_selector("#s-hand:not([hidden])", timeout=15000)
        await pages[1].screenshot(path="m_relay.png")
        print("relay label:", await pages[1].inner_text("#hPass"), "/", await pages[1].inner_text("#hWho"))
        await asyncio.gather(draw(pages[1], 3), draw(pages[3], 3))
        for pg in pages:
            await pg.wait_for_selector("#s-board:not([hidden])", timeout=20000)
        print("TEAMS board:", (await pages[3].inner_text("#bCards")).replace("\n", " | "))
        await host.click("#bFoot button:nth-child(1)")
        await host.wait_for_function("document.querySelector('#bLabel').textContent==='Winner'", timeout=10000)

        # IMPOSTOR
        await host.click("#bFoot button:nth-child(2)")
        await host.wait_for_selector("#s-lobby:not([hidden])")
        await host.click("#lModes button[data-m=impostor]")
        await host.click("#lStart")
        words = []
        for pg in pages:
            await pg.wait_for_selector("#s-hand:not([hidden])", timeout=15000)
            words.append(await pg.inner_text("#hWho"))
        print("impostor words:", words)
        await asyncio.gather(*[draw(pg, 0) for pg in pages])
        for pg in pages:
            await pg.wait_for_selector("#s-mgal:not([hidden])", timeout=20000)
        print("vote locked at start:", await guests[0].evaluate("[...document.querySelectorAll('#mgVotes button')].every(b=>b.disabled)"))
        await host.wait_for_timeout(31000)
        imp = await host.evaluate("H.imp")
        for pg in pages:
            btns = await pg.query_selector_all("#mgVotes button")
            target = None
            for bt in btns:
                if await bt.get_attribute("data-v") == imp: target = bt
            await (target or btns[0]).click()
        for pg in pages:
            await pg.wait_for_selector("#s-board:not([hidden])", timeout=15000)
        print("REVEAL:", await guests[1].inner_text("#bTitle"), "|", await guests[1].inner_text("#bInfo"))
        await guests[1].screenshot(path="m_reveal.png", full_page=True)
        print("errors:", errs)
        await b.close()

asyncio.run(main())
