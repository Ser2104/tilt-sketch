import asyncio, time
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("BASE", "http://localhost:8766")
PEER = os.environ.get("PEER", "peerhost=127.0.0.1&peerport=9000")
URL = BASE+"/index.html?"+PEER
ORI = """(()=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:0,beta:90,gamma:0});dispatchEvent(e)})()"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pages = []
        for i in range(4):
            pg = await (await b.new_context(viewport={"width": 390, "height": 800})).new_page()
            pg.on("pageerror", lambda e, i=i: errs.append(f"p{i}: {e}"))
            await pg.goto(URL); await pg.evaluate(ORI); pages.append(pg)
        h, g1, g2, g3 = pages
        await h.click("#tPlay")
        await h.evaluate("setPlay('multi');S.rounds=1")
        await h.fill("#myName", "Host"); await h.click("#createRoom")
        await h.wait_for_selector("#s-lobby:not([hidden])", timeout=15000)
        code = await h.inner_text("#lCode")
        for g, n in [(g1, "Ana"), (g2, "Leo"), (g3, "Maya")]:
            await g.goto(URL + "&room=" + code); await g.evaluate(ORI)
            await g.fill("#myName", n); await g.click("#joinRoom")
            await g.wait_for_selector("#s-lobby:not([hidden])", timeout=15000)
        await h.wait_for_function("NET.players.length===4")
        # host changes seconds per turn from the lobby
        print("lobby has time panel:", await h.evaluate("!!document.querySelector('#lSettings #timePanel')"))
        for _ in range(2): await h.click("#timeStep button[data-d='-5']")
        await g1.wait_for_function("document.querySelector('#lRules').textContent.startsWith('5 s per turn')", timeout=5000)
        print("guest sees rules:", await g1.inner_text("#lRules"))
        # Leo's phone never starts drawing; Maya never taps start (auto-start)
        await g2.evaluate("window.startDraw=()=>{}")
        t0 = time.time()
        await h.click("#lStart")
        for pg in (h, g1):
            await pg.wait_for_selector("#s-hand:not([hidden])"); await pg.click("#hGo")
        await g3.wait_for_function("document.querySelector('#hGo').textContent.includes('auto in')", timeout=5000)
        print("auto-start label:", await g3.inner_text("#hGo"))
        await g3.wait_for_selector("#s-draw:not([hidden])", timeout=15000)
        print("Maya auto-started after %.1fs" % (time.time() - t0))
        await g2.evaluate("window.__seen=[];new MutationObserver(()=>__seen.push(document.querySelector('#wTitle').textContent)).observe(document.querySelector('#wTitle'),{childList:true,characterData:true,subtree:true})")
        await g2.wait_for_selector("#s-board:not([hidden])", timeout=40000)
        print("Leo forced out after %.1fs; saw:" % (time.time() - t0), await g2.evaluate("__seen"))
        await h.wait_for_selector("#s-board:not([hidden])", timeout=20000)
        print("results after %.1fs" % (time.time() - t0))
        # impostor with short discussion and nobody voting
        await h.click("#bFoot button:nth-child(1)")
        await h.wait_for_function("document.querySelector('#bLabel').textContent==='Winner'")
        await h.click("#bFoot button:nth-child(2)")
        await h.click("#lModes button[data-m=impostor]")
        await h.evaluate("S.disc=10;S.vote=10;S.time.impostor=5;settingsChanged()")
        await g1.wait_for_function("document.querySelector('#lRules').textContent.includes('10 s discussion')", timeout=5000)
        print("impostor rules:", await g1.inner_text("#lRules"))
        t1 = time.time()
        await h.click("#lStart")
        for pg in (h, g1, g3):
            await pg.wait_for_selector("#s-hand:not([hidden])"); await pg.click("#hGo")
        await g1.wait_for_selector("#s-mgal:not([hidden])", timeout=40000)
        await g1.wait_for_function("document.querySelector('#mgVoteLabel').textContent.includes('Closes in')", timeout=15000)
        print("vote label:", await g1.inner_text("#mgVoteLabel"))
        await h.wait_for_selector("#s-board:not([hidden])", timeout=30000)
        print("reveal with no votes after %.1fs:" % (time.time() - t1), await h.inner_text("#bLabel"), "|", await h.inner_text("#bTitle"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
