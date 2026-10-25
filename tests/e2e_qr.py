import asyncio
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("BASE", "http://localhost:8766")
PEER = os.environ.get("PEER", "peerhost=127.0.0.1&peerport=9000")
URL=BASE+"/index.html?"+PEER
ORI="""(()=>{const e=new Event('deviceorientation');Object.assign(e,{alpha:0,beta:90,gamma:0});dispatchEvent(e)})()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        h=await (await b.new_context(viewport={"width":390,"height":844},device_scale_factor=2)).new_page()
        h.on("pageerror",lambda e:errs.append(str(e)))
        await h.goto(URL);await h.evaluate(ORI)
        await h.click("#tPlay");await h.click("#playSeg button[data-play=multi]");await h.fill("#myName","Sergio");await h.click("#createRoom")
        await h.wait_for_selector("#s-lobby:not([hidden])",timeout=15000)
        code=await h.inner_text("#lCode");link=await h.evaluate("inviteLink()")
        print("code",code,"link",link)
        await h.screenshot(path="qr_lobby.png")
        g=await (await b.new_context(viewport={"width":390,"height":844},device_scale_factor=2)).new_page()
        g.on("pageerror",lambda e:errs.append(str(e)))
        await g.goto(link);await g.evaluate(ORI)
        await g.screenshot(path="qr_invite.png")
        await g.fill("#myName","Ana");await g.click("#joinRoom")
        await g.wait_for_selector("#s-lobby:not([hidden])",timeout=15000)
        print("joined:",(await h.inner_text("#lPlayers")).replace("\n"," | "))
        print("errors",errs);await b.close()
asyncio.run(main())
