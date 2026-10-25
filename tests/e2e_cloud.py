import asyncio, json, math, os, urllib.request
from playwright.async_api import async_playwright
from e2e_challenges import BASE, MOCK, ORI, CONNECT, draw_sun


def mock_state():
    req = urllib.request.Request(MOCK + "/rest/v1/rpc/debug_state", data=b"{}", headers={"apikey": "x", "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())


async def page(b, name, url="/index.html"):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
    await ctx.add_init_script(f"addEventListener('DOMContentLoaded',()=>{{{CONNECT}}})")
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(f"{name}: {e}"))
    await pg.goto(BASE + url)
    await pg.evaluate(ORI)
    await pg.evaluate(CONNECT)
    return pg, errs


async def trace_once(pg):
    tpl = await pg.evaluate("D.template.pts")
    sens = await pg.evaluate("degPerSheet()")
    x0, y0 = tpl[0]
    pts = await pg.evaluate("Motor.densify(D.template.pts,.01)")
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)
    await pg.evaluate("__o(0,0)"); await pg.wait_for_timeout(120)
    await pg.mouse.down()
    for x, y in pts:
        await pg.evaluate(f"__o({(x - x0) * sens},{(y - y0) * sens})"); await pg.wait_for_timeout(16)
    await pg.wait_for_timeout(150); await pg.mouse.up()
    if await pg.evaluate("D.state==='run'"): await pg.click("#finish")


async def donations(b):
    pg, errs = await page(b, "donor")
    await pg.evaluate("S.sens=22;WORDS.splice(0,WORDS.length,'sun');LEVEL_LIST.forEach(l=>l.word='sun');LEVEL_LIST[0].time=8;LEVEL_LIST[0].word='sun';DAILY_TIME=8;Donate.render()")
    print("home panel:", (await pg.inner_text("#donatePanel")).replace("\n", " | "))
    before = len(mock_state()["drawings"])
    await pg.click("#cDaily"); await pg.wait_for_selector("#s-hand:not([hidden])")
    await draw_sun(pg)
    await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
    assert await pg.is_visible("#crDonate"), "consent prompt should appear on first result"
    assert len(mock_state()["drawings"]) == before, "nothing is sent before consent"
    await pg.screenshot(path="cl_consent.png", full_page=True)
    await pg.click("#crDonYes")
    await pg.wait_for_function("document.querySelector('#crInfo').textContent.includes('Thanks')", timeout=5000)
    d = mock_state()["drawings"][-1]
    print("donated:", d["word"], "strokes", len(d["strokes"]), "points", sum(len(s[0]) for s in d["strokes"]), "ctrl", d["ctrl"], "guess", d["guess"], "fields", sorted(d))
    assert d["word"] == "sun" and len(d["strokes"]) >= 5 and "player" not in d
    assert all(0 <= v <= 1000 for s in d["strokes"] for axis in s for v in axis)

    await pg.click("#crActions button:has-text('Back to home')")
    await pg.click("#cLevels"); await pg.click(".lv[data-k='0']")
    await pg.wait_for_selector("#s-hand:not([hidden])")
    await draw_sun(pg)
    await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
    await pg.wait_for_timeout(500)
    assert not await pg.is_visible("#crDonate"), "no second prompt"
    mine = [x for x in mock_state()["drawings"] if x["device"] == await pg.evaluate("Rank.device")]
    print("after level 1, drawings from this phone:", len(mine))
    assert len(mine) == 2
    await pg.click("#crActions button:has-text('All levels')") if await pg.is_visible("#crActions button:has-text('All levels')") else None
    await pg.evaluate("show('s-home');Donate.render()")
    await pg.wait_for_timeout(400)
    print("home stats:", await pg.inner_text("#donStats"))
    await pg.click("#openSettings")
    await pg.click("#donDel"); await pg.click("#donDel")
    await pg.wait_for_function("document.querySelector('#donStats').textContent.includes('Deleted')", timeout=5000)
    print("after delete:", await pg.inner_text("#donStats"))
    mine = [x for x in mock_state()["drawings"] if x["device"] == await pg.evaluate("Rank.device")]
    assert not mine and await pg.get_attribute("#donOff", "aria-pressed") == "true"
    return errs


async def clinic(b):
    doc, e1 = await page(b, "clinician")
    await doc.click("#openSettings")
    await doc.click("#cClinic")
    await doc.fill("#ckName", "Penn State Hand Therapy (test)")
    await doc.click("#ckCreate")
    await doc.wait_for_function("document.querySelector('#ckJoinCode').textContent.length===6", timeout=5000)
    code = await doc.inner_text("#ckJoinCode")
    key = await doc.inner_text("#ckKeyShow")
    print("clinic created:", code, "key length", len(key), "|", await doc.inner_text("#ckStatus"))
    assert len(key) == 36
    await doc.screenshot(path="cl_dash_empty.png", full_page=True)

    pt, e2 = await page(b, "patient", f"/index.html?clinic={code}")
    await pt.wait_for_selector("#s-practice:not([hidden])")
    print("join link opens practice with code:", await pt.input_value("#clCode"), "|", await pt.inner_text("#clMsg"))
    await pt.fill("#pfName", "Maria")
    await pt.click("#pfCreate")
    await pt.evaluate("""(()=>{const p=Profiles.cur();p.rom={x:40,y:30,date:new Date(Date.now()-864e5*3).toISOString()};
      p.sessions.push({date:new Date(Date.now()-864e5*2).toISOString(),level0:1,level1:2,exercises:[{label:'Circle',level:1,score:61,coverage:70,accuracy:80,tremorAmp:.6,tremorHz:7,smooth:55,ldlj:-9,speed:20,romX:20,romY:15,active:9}],
      avg:{score:61,coverage:70,accuracy:80,tremorAmp:.6,smooth:55,speed:20,romX:20,romY:15}});Profiles.save();renderHub()})()""")
    print("alias prefilled:", await pt.input_value("#clAlias"))
    await pt.fill("#clAlias", "Maria G.")
    await pt.click("#clJoin")
    await pt.wait_for_function("document.querySelector('#clOnText').textContent.includes('Sent your 1')", timeout=5000)
    print("patient connected:", await pt.inner_text("#clOnText"))
    await pt.screenshot(path="cl_patient.png", full_page=True)

    await pt.click("#pStart")
    await pt.wait_for_selector("#s-hand:not([hidden])")
    await pt.evaluate("__o(0,0)"); await pt.click("#hGo")
    await pt.wait_for_function("D.state==='run'", timeout=8000)
    await trace_once(pt)
    await pt.wait_for_selector("#s-ex:not([hidden])", timeout=5000)
    await pt.click("#exStop")
    await pt.wait_for_selector("#s-psum:not([hidden])")
    await pt.wait_for_function("document.querySelector('#psInfo').textContent.includes('Shared with')", timeout=5000)
    print("session summary:", await pt.inner_text("#psInfo"))

    await doc.click("#ckRefresh")
    await doc.wait_for_function("document.querySelector('#ckList li')", timeout=5000)
    print("clinician sees:", (await doc.inner_text("#ckList")).replace("\n", " | "))
    assert "Maria G." in await doc.inner_text("#ckList") and "2 sessions" in await doc.inner_text("#ckList")
    await doc.screenshot(path="cl_dash.png", full_page=True)
    await doc.click(".ptopen")
    await doc.wait_for_selector("#s-prog:not([hidden])")
    await doc.wait_for_timeout(300)
    print("patient view:", await doc.inner_text("#prName"), "|", (await doc.inner_text("#prKpis")).replace("\n", " "), "| back:", await doc.inner_text("#prBack"))
    await doc.screenshot(path="cl_patient_view.png", full_page=True)
    async with doc.expect_download() as dl:
        await doc.click("#prCsv")
    rows = open(await (await dl.value).path()).read().splitlines()
    print("csv rows:", len(rows), rows[1][:60])
    await doc.click("#prBack")
    await doc.wait_for_selector("#s-clinic:not([hidden])")

    other, e3 = await page(b, "clinician-2")
    await other.click("#openSettings")
    await other.click("#cClinic")
    await other.fill("#ckCode", code); await other.fill("#ckKey", "0" * 36); await other.click("#ckOpen")
    await other.wait_for_function("document.querySelector('#ckMsg').textContent.length>0")
    print("wrong key:", await other.inner_text("#ckMsg"))
    await other.fill("#ckKey", key); await other.click("#ckOpen")
    await other.wait_for_function("document.querySelector('#ckList li')", timeout=5000)
    print("second device with key sees:", (await other.inner_text("#ckList")).replace("\n", " | "))

    await pt.click("#psHub")
    await pt.click("#clLeave"); await pt.click("#clLeave")
    await pt.wait_for_function("document.querySelector('#clMsg').textContent.includes('Stopped')", timeout=5000)
    print("patient stopped:", await pt.inner_text("#clMsg"))
    await doc.click("#ckRefresh")
    await doc.wait_for_function("!document.querySelector('#ckList li')", timeout=5000)
    print("clinician after stop:", await doc.inner_text("#ckStatus"))
    return e1 + e2 + e3


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = await donations(b) + await clinic(b)
        print("page errors:", errs or "none")
        assert not errs
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
