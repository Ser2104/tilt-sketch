"""Makes the Google Play screenshots (1080x1920) from the real game.

Run from the repo root with the site served locally:
  python3 -m http.server 8766 &  python3 scripts/store_screens.py [en|es]
Writes docs/play-store/screenshot-N.png (English) or screenshot-es-N.png (Spanish).
"""
import asyncio, base64, json, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tests", "bots"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tests"))
os.environ.setdefault("SITE", "http://localhost:8766/index.html")
os.environ.setdefault("OUT", "/tmp/store-shots")
import playtest as P
from playwright.async_api import async_playwright

LANG = sys.argv[1] if len(sys.argv) > 1 else "en"
SITE = os.environ["SITE"]
OUT = "docs/play-store"
W, H = 390, 684  # phone screen in CSS pixels inside the frame
CAPTIONS = {
    "en": [("Draw by moving your", "phone"), ("Our AI judges every", "drawing"), ("See how others draw", "it first"),
           ("Daily challenge,", "levels and more"), ("40 levels across 5", "worlds"), ("Play with friends on", "one phone or many"),
           ("Trace 30 guided", "drawings"), ("Rank up, win trophies, unlock", "colors")],
    "es": [("Dibuja moviendo tu", "celular"), ("Nuestra IA evalúa cada", "dibujo"), ("Mira primero cómo", "lo dibujan otros"),
           ("Reto diario,", "niveles y más"), ("40 niveles en 5", "mundos"), ("Juega con amigos en", "uno o varios celulares"),
           ("Traza 30 dibujos", "guiados"), ("Sube de rango, gana trofeos y desbloquea", "colores")],
}[LANG]


def today_local():
    import datetime
    return datetime.date.today().isoformat()


SEED = {
    "ts-lang": LANG, "ts-tut": True, "ts-donate": False, "ts-fb-snooze": 9e15,
    "ts-fb-game": 9e15, "ts-fb-challenge": 9e15, "ts-fb-guided": 9e15,
    "ts-rank-name": "Maya", "ts-name": "Maya",
    "ts-game": {"xp": 1100, "draws": 24, "best": 100, "party": 0, "shares": 0, "streak": 4, "streakBest": 4, "last": today_local(),
                "got": ["first", "ten", "perfect", "streak3", "lv5"]},
    "ts-levels": {"unlocked": 6, "best": {"0": 96, "1": 92, "2": 100, "3": 91, "4": 95, "5": 90}},
    "ts-guided": {"unlocked": 6, "best": {str(i): 95 for i in range(6)}},
}


async def phone(b):
    ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=2.2)
    init = "".join(f"localStorage.setItem({json.dumps(k)},{json.dumps(v if isinstance(v, str) and k in ('ts-lang','ts-name') else json.dumps(v))});" for k, v in SEED.items())
    await ctx.add_init_script(f"try{{{init}}}catch(_){{}}Object.defineProperty(navigator,'webdriver',{{get:()=>false}});")
    await ctx.route("**/rest/v1/rpc/**", lambda r: r.fulfill(status=200, content_type="application/json", body="true"))
    pg = await ctx.new_page()
    await ctx.add_init_script("addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='#toast{display:none!important}';document.head.append(s)})")
    await pg.goto(SITE); await pg.evaluate(P.ORI)
    await pg.wait_for_function("AI.state==='ok'&&Object.keys(EXAMPLES).length>0", timeout=60000)
    P.EXAMPLES.update(await pg.evaluate("EXAMPLES"))
    return pg


async def compose(b, n, png, cap):
    img = base64.b64encode(png).decode()
    root = SITE.rsplit("/", 1)[0] + "/fonts"
    html = f"""<html><head><style>
    @font-face{{font-family:Bungee;src:url({root}/bungee-latin-400-normal.woff2)}}
    body{{margin:0;width:1080px;height:1920px;background:#13213C;display:flex;flex-direction:column;align-items:center;overflow:hidden}}
    h1{{font-family:Bungee;color:#E9F0F4;font-size:68px;line-height:1.12;text-align:center;margin:110px 60px 56px;font-weight:400;text-transform:uppercase}}
    h1 em{{font-style:normal;color:#FF5A36}}
    .ph{{border:10px solid #2A3A58;border-radius:56px;overflow:hidden;width:858px;height:1505px;background:#E9F0F4}}
    .ph img{{width:858px;height:1505px;display:block}}</style></head>
    <body><h1>{cap[0]} <em>{cap[1]}</em></h1><div class="ph"><img src="data:image/png;base64,{img}"></div></body></html>"""
    pg = await b.new_page(viewport={"width": 1080, "height": 1920})
    await pg.goto(SITE.rsplit("/", 1)[0] + "/manifest.webmanifest"); await pg.set_content(html)
    await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(600)
    name = f"screenshot-{n}.png" if LANG == "en" else f"screenshot-es-{n}.png"
    await pg.screenshot(path=os.path.join(OUT, name)); await pg.close()
    print("wrote", name)


async def main():
    rng = random.Random(7)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await phone(b)
        shot = lambda: pg.screenshot()

        # 3: level intro (sailboat, level 7)
        await pg.evaluate("openLevels()"); await pg.wait_for_timeout(300)
        await pg.click("#lvPlay"); await pg.wait_for_selector("#s-hand:not([hidden])"); await pg.wait_for_timeout(700)
        s3 = await shot()
        # 1: drawing with the AI bubble
        await pg.evaluate("__o(0,0)"); await pg.click("#hGo")
        strokes = P.to_sheet(P.EXAMPLES["sailboat"][0], rng, wobble=False)
        for st in strokes:  # a smaller drawing so the whole boat fits on the zoomed sheet
            st["pts"] = [[.5 + (x - .5) * .62, .5 + (y - .5) * .62] for x, y in st["pts"]]
        await P.draw_now(pg, strokes, finish=False)
        try:
            await pg.wait_for_function("D.word&&liveGuess===D.word", timeout=8000)
        except Exception:
            print("warning: the live AI bubble did not settle on the object")
        await pg.wait_for_timeout(600)
        s1 = await shot()
        # 2: result
        await pg.click("#finish"); await pg.wait_for_selector("#s-cres:not([hidden])", timeout=30000)
        await pg.wait_for_timeout(3600); await pg.evaluate("document.querySelectorAll('.fb[data-inline]').forEach(x=>x.remove());scrollTo(0,0)")
        s2 = await shot()
        # 4: home
        await pg.evaluate("renderChallengeCards();show('s-home');scrollTo(0,0)"); await pg.wait_for_timeout(500)
        s4 = await shot()
        # 5: levels map
        await pg.evaluate("openLevels()"); await pg.wait_for_timeout(600)
        s5 = await shot()
        # 6: play with friends
        await pg.evaluate("show('s-home')"); await pg.click("#tPlay")
        await pg.evaluate("S.players=['Alex','Sam','Maya','Leo'];renderPlayers()"); await pg.wait_for_timeout(400)
        s6 = await shot()
        # 7: guided
        await pg.evaluate("openGuided();scrollTo(0,0)"); await pg.wait_for_timeout(600)
        s7 = await shot()
        # 8: trophies
        await pg.evaluate("Game.openTrophies();scrollTo(0,0)"); await pg.wait_for_timeout(600)
        s8 = await shot()
        for i, s in enumerate([s1, s2, s3, s4, s5, s6, s7, s8]):
            await compose(b, i + 1, s, CAPTIONS[i])
        await b.close()

asyncio.run(main())
