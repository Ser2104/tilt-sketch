"""Playtest bots: play the published game the way players do and write a feedback report.

Bots: a first-time player (tutorial, daily, a level, a guided drawing, trophies, sharing, Spanish),
a party of 3 phones in a live room, a monkey that taps everything, and a balance bot that judges
real Quick, Draw! drawings with gyroscope wobble on every level object.
Writes to the shared database are answered locally, so the bots never touch real rankings.
"""
import asyncio, json, math, os, random, statistics, struct, sys, time, traceback, urllib.parse, urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from playwright.async_api import async_playwright
from e2e_challenges import ORI

SITE = os.environ.get("SITE", "https://ser2104.github.io/tilt-sketch/index.html")
OUT = os.environ.get("OUT", "playtest-out")
MONKEY_MINUTES = float(os.environ.get("MONKEY_MINUTES", "4"))
BALANCE_OBJECTS = int(os.environ.get("BALANCE_OBJECTS", "40"))
DRAWINGS_PER_OBJECT = int(os.environ.get("DRAWINGS_PER_OBJECT", "10"))
QD = "https://storage.googleapis.com/quickdraw_dataset/full/simplified/{}.ndjson"
os.makedirs(OUT, exist_ok=True)

FINDINGS, METRICS = [], {}
LEFTOVER = """(()=>{const out=new Set(),rx=/\\b(the|and|your|you|with|to|of|is|on|tap|draw|drawing|phone|again)\\b/i;
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){const p=n.parentElement;if(!p||/SCRIPT|STYLE/.test(p.tagName)||p.closest('[data-noi18n]')||!p.offsetParent)continue;
    const t=n.nodeValue.trim();if(t&&rx.test(t))out.add(t)}return[...out]})()"""


def find(sev, area, msg, shot=None):
    FINDINGS.append({"severity": sev, "area": area, "message": msg[:600], "screenshot": shot})
    print(f"[{sev}] {area}: {msg[:300]}")


async def snap(pg, name):
    path = f"{OUT}/{name}.png"
    try:
        await pg.screenshot(path=path)
    except Exception:
        return None
    return path


_drawings, EXAMPLES = {}, {}
def real_drawings(word, n):
    if word in _drawings:
        return _drawings[word][:n]
    out = []
    try:
        name = {"Eiffel Tower": "The Eiffel Tower"}.get(word, word)
        req = urllib.request.Request(QD.format(urllib.parse.quote(name)), headers={"Range": "bytes=0-400000"})
        lines = urllib.request.urlopen(req, timeout=30).read().decode("utf8", "ignore").split("\n")[:-1]
        rows = [json.loads(l) for l in lines if l.startswith("{")]
        rows = [r for r in rows if r.get("recognized")]
        random.shuffle(rows)
        out = [r["drawing"] for r in rows]
    except Exception as e:
        if "drawing_source" not in METRICS:
            find("low", "setup", f"Could not download Quick, Draw! drawings ({e}); used the game's example drawings instead, so difficulty numbers are optimistic.")
        METRICS["drawing_source"] = "game examples (Quick, Draw! unreachable)"
        out = list(EXAMPLES.get(word, []))
    _drawings[word] = out
    return out[:n]


def to_sheet(drawing, rng, wobble=True):
    """Quick, Draw! strokes (0-255) -> game strokes in sheet units, with gyroscope-like wobble."""
    xs = [x for s in drawing for x in s[0]]; ys = [y for s in drawing for y in s[1]]
    side = max(max(xs) - min(xs), max(ys) - min(ys), 1)
    scale = rng.uniform(.42, .58) / side
    ang = math.radians(rng.uniform(-8, 8)) if wobble else 0
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    strokes = []
    for sx, sy in drawing:
        pts, lx, ly = [], None, None
        for i in range(len(sx) - 1):
            for t in range(6):
                f = t / 6
                pts.append((sx[i] + (sx[i + 1] - sx[i]) * f, sy[i] + (sy[i + 1] - sy[i]) * f))
        pts.append((sx[-1], sy[-1]))
        out = []
        for x, y in pts:
            x, y = (x - cx) * scale, (y - cy) * scale
            x, y = x * math.cos(ang) - y * math.sin(ang), x * math.sin(ang) + y * math.cos(ang)
            if wobble:
                x += rng.gauss(0, .004); y += rng.gauss(0, .004)
                if lx is not None:
                    x, y = lx + (x - lx) * .7, ly + (y - ly) * .7
            lx, ly = x, y
            out.append([round(.5 + x, 4), round(.5 + y, 4)])
        strokes.append({"c": "#13213C", "w": .008, "pts": out})
    return strokes


async def new_page(b, name, errors, fresh_player=True, lang=None):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
    init = "try{localStorage.setItem('ts-donate','false');localStorage.setItem('ts-fb-snooze',String(Date.now()))}catch(_){}"
    if lang:
        init += f"try{{localStorage.setItem('ts-lang','{lang}')}}catch(_){{}}"
    if fresh_player:
        init += "Object.defineProperty(navigator,'webdriver',{get:()=>false});"
    await ctx.add_init_script(init)

    async def rpc(route):
        url = route.request.url
        if any(k in url for k in ("donation_stats", "feedback_summary", "name_ok")):
            return await route.continue_()
        await route.fulfill(status=200, content_type="application/json", body="true")
    await ctx.route("**/rest/v1/rpc/**", rpc)
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "favicon" not in m.text and "net::ERR" not in m.text else None)
    t0 = time.time()
    await pg.goto(SITE, wait_until="load", timeout=60000)
    await pg.evaluate(ORI)
    try:
        await pg.wait_for_function("typeof AI!=='undefined'&&AI.state==='ok'", timeout=60000)
        if not EXAMPLES:
            await pg.wait_for_function("Object.keys(EXAMPLES).length>0", timeout=15000)
            EXAMPLES.update(await pg.evaluate("EXAMPLES"))
        METRICS.setdefault("ai_ready_seconds", []).append(round(time.time() - t0, 1))
    except Exception:
        find("critical", "startup", f"The AI did not load within 60 s for {name}.", await snap(pg, f"{name}-ai-timeout"))
    return pg


async def go(pg, pts, sens):
    await pg.evaluate(f"__o({(pts[0][0] - .5) * sens},{(pts[0][1] - .5) * sens})"); await pg.wait_for_timeout(260)
    await pg.mouse.down()
    for x, y in pts[1:]:
        await pg.evaluate(f"__o({(x - .5) * sens},{(y - .5) * sens})"); await pg.wait_for_timeout(16)
    await pg.wait_for_timeout(120); await pg.mouse.up(); await pg.wait_for_timeout(120)


AIM = """(()=>{if(window.__aimBy)return;window.__lx=0;window.__ly=0;const o=__o;
  window.__o=(x,y)=>{window.__lx=x;window.__ly=y;o(x,y)};
  window.__aimBy=(dx,dy)=>__o(__lx+dx,__ly+dy);
  window.__trackTo=(tx,ty,sens,step)=>new Promise(res=>{const ex=tx-D.pos.x,ey=ty-D.pos.y,n=Math.max(1,Math.ceil(Math.hypot(ex,ey)/step));let i=0;
    const f=()=>{__aimBy(ex/n*sens,ey/n*sens);if(++i<n)setTimeout(f,16);else setTimeout(res,16)};f()})})()"""


async def move_by(pg, dx, dy, sens, step=.012):
    """Turns the phone by a sheet distance at a steady, drawing-like speed."""
    n = max(1, math.ceil(math.hypot(dx, dy) / step))
    for _ in range(n):
        await pg.evaluate(f"__aimBy({dx / n * sens},{dy / n * sens})"); await pg.wait_for_timeout(16)


async def go_watching(pg, pts, sens):
    """Draws one stroke like a player: glides to its start while watching the brush, then traces it."""
    await pg.evaluate(AIM)
    for _ in range(5):
        x, y = await pg.evaluate("[D.pos.x,D.pos.y]")
        ex, ey = pts[0][0] - x, pts[0][1] - y
        if math.hypot(ex, ey) < .005:
            break
        await move_by(pg, ex, ey, sens); await pg.wait_for_timeout(140)
    await pg.mouse.down()
    for x1, y1 in pts[1:]:
        await pg.evaluate(f"__trackTo({x1},{y1},{sens},.012)")
    await pg.wait_for_timeout(100); await pg.mouse.up(); await pg.wait_for_timeout(60)


def thin(pts, step=.012):
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= step:
            out.append(p)
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


async def draw_now(pg, strokes, finish=True):
    """Draws on the open drawing screen by aiming the phone, like a player."""
    await pg.wait_for_function("D.state==='run'", timeout=10000)
    sens = await pg.evaluate("degPerSheet()")
    bb = await (await pg.query_selector("#pen")).bounding_box()
    await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    t0 = time.time()
    for s in strokes:
        if not await pg.evaluate("D.state==='run'"):
            break
        await go_watching(pg, thin(s["pts"]), sens)
    took = time.time() - t0
    METRICS["last_draw_complete"] = await pg.evaluate("D.state==='run'")
    if finish and await pg.evaluate("D.state==='run'"):
        await pg.click("#finish")
    return took


async def play_challenge(pg, word, rng, tag):
    """From the intro screen: start, draw a real drawing of the word, return the result."""
    await pg.wait_for_selector("#s-hand:not([hidden])", timeout=20000)
    await pg.evaluate("__o(0,0)"); await pg.click("#hGo")
    drawings = real_drawings(word, 3) or [[[[60, 200, 200, 60, 60], [60, 60, 200, 200, 60]]]]
    strokes = to_sheet(drawings[0], rng)
    direct = await pg.evaluate("([w,s])=>aiJudge(w,[{strokes:s}]).then(x=>x[0].acc)", [word, strokes])
    took = await draw_now(pg, strokes)
    await pg.wait_for_selector("#s-cres:not([hidden])", timeout=30000)
    await pg.wait_for_timeout(600)
    score = int((await pg.inner_text("#crScore")).strip("%") or 0)
    title = await pg.inner_text("#crTitle")
    METRICS.setdefault("ui_plays", []).append({"what": tag, "word": word, "score": score, "direct": direct, "title": title, "draw_seconds": round(took, 1)})
    if not METRICS.get("last_draw_complete", True):
        find("low", "bots", f"{tag}: the bot ran out of time before finishing its '{word}' drawing ({round(took, 1)} s), so this score does not count.")
    elif direct - score >= 40:
        find("medium", "drawing input", f"{tag}: the same '{word}' drawing scored {direct}% when judged directly but {score}% after drawing it by aiming the phone. Aiming may lose or bend lines.", await snap(pg, f"{tag}-input"))
    if not await pg.is_visible("#crXP"):
        find("medium", "progression", f"No XP box after {tag}.", await snap(pg, f"{tag}-noxp"))
    for sel in ("#crActions .btn.primary", "#crActions .linkbtn"):
        el = await pg.query_selector(sel)
        if el and not await el.is_visible():
            find("medium", "layout", f"Result action {sel} not visible after {tag}.", await snap(pg, f"{tag}-actions"))
    return score, title


async def first_time_player(b):
    errors, rng = [], random.Random(1)
    pg = await new_page(b, "newplayer", errors)
    try:
        await pg.click("#cDaily")
        try:
            await pg.wait_for_selector("#coach:not([hidden])", timeout=8000)
        except Exception:
            find("high", "tutorial", "The tutorial did not start the first time the player opened the daily challenge.", await snap(pg, "tutorial-missing"))
            raise
        await pg.wait_for_function("D.state==='run'", timeout=8000)
        await pg.wait_for_timeout(700); await pg.evaluate("__o(5,3)")
        await pg.wait_for_function("document.querySelector('#coachT').textContent.includes('button')", timeout=9000)
        sun = [{"pts": [[.5 + .1 * math.cos(i / 36 * 2 * math.pi), .5 + .1 * math.sin(i / 36 * 2 * math.pi)] for i in range(37)]}]
        await draw_now(pg, sun, finish=False)
        await pg.wait_for_function("document.querySelector('#coachT').textContent.includes('rays')", timeout=9000)
        rays = [{"pts": [[.5 + r * math.cos(k / 8 * 2 * math.pi), .5 + r * math.sin(k / 8 * 2 * math.pi)] for r in (.14, .17, .2)]} for k in range(8)]
        await draw_now(pg, rays, finish=False)
        try:
            await pg.wait_for_function("document.querySelector('#coachT').textContent.includes('got it')", timeout=12000)
        except Exception:
            find("medium", "tutorial", f"The tutorial's last step did not appear after drawing a sun. Live AI said: {await pg.inner_text('#liveAI')}", await snap(pg, "tutorial-step4"))
        await pg.click("#finish")
        await pg.wait_for_selector("#s-hand:not([hidden])", timeout=8000)
        await pg.click("#hGo")
        word = await pg.evaluate("dailyWord()")
        score, title = await play_challenge(pg, word, rng, "daily")
        METRICS["daily_word"] = word
        if score < 40:
            find("medium", "daily", f"A real human drawing of today's object '{word}' scored only {score}% ({title}).", await snap(pg, "daily-low"))
        async with pg.expect_download(timeout=15000) as dl:
            await pg.click("#crActions button:has-text('Share drawing')")
        head = open(await (await dl.value).path(), "rb").read(24)
        if head[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", head[16:24]) != (1080, 1350):
            find("medium", "sharing", "The shared image is not a 1080x1350 PNG.")

        await pg.evaluate("show('s-home')"); await pg.click("#cLevels"); await pg.click(".lv[data-k='0']")
        word = await pg.evaluate("LEVEL_LIST[0].word")
        score, title = await play_challenge(pg, word, rng, "level-1")
        if "passed" not in title.lower() and METRICS.get("last_draw_complete", True):
            find("high", "levels", f"A real human drawing of level 1 ('{word}') did not pass: {score}% ({title}).", await snap(pg, "level1-fail"))

        await pg.evaluate("show('s-home')"); await pg.click("#cGuided"); await pg.click("#gdWorlds .lv[data-k='0']")
        await pg.wait_for_selector("#s-hand:not([hidden])"); await pg.evaluate("__o(0,0)"); await pg.click("#hGo")
        await pg.wait_for_function("D.state==='run'")
        sens = await pg.evaluate("degPerSheet()")
        start = await pg.evaluate("D.template.strokes[0][0]")
        n = await pg.evaluate("D.template.strokes.length")
        bb = await (await pg.query_selector("#pen")).bounding_box(); await pg.mouse.move(bb["x"] + 40, bb["y"] + 20)
        for si in range(n):
            pts = await pg.evaluate(f"Motor.densify(D.template.strokes[{si}],.012)")
            await go(pg, [[x - start[0] + .5 + rng.gauss(0, .003), y - start[1] + .5 + rng.gauss(0, .003)] for x, y in pts], sens)
        try:
            await pg.wait_for_selector("#s-cres:not([hidden])", timeout=8000)
        except Exception:
            await pg.click("#finish"); await pg.wait_for_selector("#s-cres:not([hidden])", timeout=8000)
        stars = await pg.inner_text("#crStars")
        METRICS["guided_first_figure"] = {"score": await pg.inner_text("#crScore"), "stars": stars}
        if "★" not in stars:
            find("high", "guided", "Tracing the first guided figure carefully earned no star.", await snap(pg, "guided-0"))

        await pg.evaluate("show('s-home')"); await pg.click("#cTrophies")
        got = await pg.evaluate("document.querySelectorAll('#tpList .tp.got').length")
        METRICS["trophies_after_first_session"] = got
        if got < 2:
            find("medium", "progression", f"Only {got} trophies after a full first session.", await snap(pg, "trophies"))

        await pg.evaluate("show('s-home')"); await pg.click("#cRank")
        await pg.wait_for_function("!document.querySelector('#rkStatus').textContent.includes('Loading')", timeout=20000)
        st = await pg.inner_text("#rkStatus")
        if "Could not reach" in st:
            find("high", "rankings", "The live ranking could not be loaded.", await snap(pg, "ranking"))
        METRICS["ranking_rows_today"] = await pg.evaluate("document.querySelectorAll('#rkList li').length")
    except Exception as e:
        find("high", "first-time player", f"Bot got stuck: {type(e).__name__}: {e}", await snap(pg, "newplayer-stuck"))
    finally:
        await pg.context.close()

    pg = await new_page(b, "spanish", errors, fresh_player=False, lang="es")
    try:
        left = await pg.evaluate(LEFTOVER)
        if left:
            find("low", "spanish", "English text left on the Spanish home screen: " + " | ".join(left[:8]), await snap(pg, "es-home"))
        await pg.evaluate("openSettings()"); left = await pg.evaluate(LEFTOVER)
        if left:
            find("low", "spanish", "English text left in Spanish settings: " + " | ".join(left[:8]), await snap(pg, "es-settings"))
    finally:
        await pg.context.close()
    return errors


async def party(b):
    errors, rng = [], random.Random(2)
    pg = await new_page(b, "onephone", errors, fresh_player=False)
    try:
        await pg.click("#tPlay")
        await pg.evaluate("S.players=['Ana','Leo'];renderPlayers();S.time.solo=25;S.rounds=1;syncSettings()")
        await pg.click("#start")
        word = None
        for turn in range(2):
            await pg.wait_for_selector("#s-hand:not([hidden])", timeout=15000)
            word = word or await pg.evaluate("G.words?G.words[G.round]:WORDS[0]")
            await pg.evaluate("__o(0,0)"); await pg.click("#hGo")
            await draw_now(pg, to_sheet((real_drawings(word, 2) or [[[[60, 200], [60, 200]]]])[turn % max(1, len(real_drawings(word, 2)))], rng))
        await pg.wait_for_selector("#s-res:not([hidden]), #s-judge:not([hidden])", timeout=30000)
        await pg.wait_for_selector("#s-res:not([hidden])", timeout=30000)
        METRICS["one_phone_round"] = (await pg.inner_text("#s-res"))[:200].replace("\n", " | ")
    except Exception as e:
        find("high", "one phone", f"One-phone Solo game got stuck: {type(e).__name__}: {e}", await snap(pg, "onephone-stuck"))
    finally:
        await pg.context.close()

    pages = []
    try:
        for i in range(3):
            pages.append(await new_page(b, f"room{i}", errors, fresh_player=False))
        host, *guests = pages
        if not await host.evaluate("Relay.usable()"):
            find("high", "rooms", "Live rooms are not available (Relay.usable() is false).")
            return errors
        await host.click("#tPlay")
        await host.evaluate("setPlay('multi');S.time.solo=10;S.rounds=1")
        await host.fill("#myName", "HostBot")
        t0 = time.time(); await host.click("#createRoom")
        await host.wait_for_selector("#s-lobby:not([hidden])", timeout=25000)
        code = await host.inner_text("#lCode")
        METRICS["room_create_seconds"] = round(time.time() - t0, 1)
        for i, g in enumerate(guests):
            await g.goto(SITE + "?room=" + code); await g.evaluate(ORI)
            await g.fill("#myName", f"Bot{i + 1}"); await g.click("#joinRoom")
            await g.wait_for_selector("#s-lobby:not([hidden])", timeout=30000)
        await host.wait_for_function("NET.players.length===3", timeout=30000)
        METRICS["room_join_seconds"] = round(time.time() - t0, 1)
        await host.click("#lStart")
        word = None
        for pgx in pages:
            await pgx.wait_for_selector("#s-hand:not([hidden])", timeout=30000)
        for pgx in pages:
            await pgx.evaluate("__o(0,0)"); await pgx.click("#hGo")
        word = await host.evaluate("D.word")
        ds = real_drawings(word, 3) or [[[[60, 200], [60, 200]]]]
        await asyncio.gather(*[draw_now(pgx, to_sheet(ds[i % len(ds)], rng)) for i, pgx in enumerate(pages)])
        for pgx in pages:
            await pgx.wait_for_selector("#s-board:not([hidden])", timeout=45000)
        METRICS["room_board"] = (await guests[0].inner_text("#bCards"))[:200].replace("\n", " | ")
    except Exception as e:
        find("high", "rooms", f"A 3-phone live room got stuck: {type(e).__name__}: {e}", await snap(pages[-1], "room-stuck") if pages else None)
    finally:
        for pgx in pages:
            await pgx.context.close()
    return errors


async def monkey(b):
    errors, rng = [], random.Random(int(time.time()))
    pg = await new_page(b, "monkey", errors, fresh_player=False)
    end, actions, stuck = time.time() + MONKEY_MINUTES * 60, 0, 0
    while time.time() < end:
        try:
            if "index.html" not in pg.url:
                await pg.goto(SITE); await pg.evaluate(ORI)
            visible = await pg.evaluate("[...document.querySelectorAll('.screen')].filter(s=>!s.hidden).map(s=>s.id)")
            if len(visible) != 1:
                find("medium", "navigation", f"{len(visible)} screens visible at once: {visible}", await snap(pg, f"monkey-screens-{actions}"))
            if await pg.evaluate("typeof D!=='undefined'&&D.state==='run'"):
                bb = await (await pg.query_selector("#pen")).bounding_box()
                await pg.mouse.move(bb["x"] + 30, bb["y"] + 20); await pg.mouse.down()
                for _ in range(rng.randint(5, 30)):
                    await pg.evaluate(f"__o({rng.uniform(-12, 12)},{rng.uniform(-12, 12)})"); await pg.wait_for_timeout(20)
                await pg.mouse.up()
            targets = await pg.query_selector_all(".screen:not([hidden]) button:not([disabled]), .screen:not([hidden]) a[href], .screen:not([hidden]) input")
            targets = [t for t in targets if await t.is_visible()]
            if not targets:
                stuck += 1
                if stuck > 20:
                    find("high", "navigation", f"No tappable control for 10+ seconds on {visible}.", await snap(pg, f"monkey-stuck-{actions}"))
                    await pg.goto(SITE); await pg.evaluate(ORI); stuck = 0
                await pg.wait_for_timeout(500); continue
            stuck = 0
            t = rng.choice(targets)
            if await t.evaluate("e=>e.tagName==='INPUT'"):
                await t.fill(rng.choice(["Ana", "ZZZZ", "<b>x</b>", "😀", "abcd", ""]))
            else:
                await t.click(timeout=2000)
            actions += 1
            if rng.random() < .05:
                await pg.go_back()
            await pg.wait_for_timeout(rng.randint(80, 600))
        except Exception:
            await pg.wait_for_timeout(200)
    METRICS["monkey_actions"] = actions
    await pg.context.close()
    return errors


async def balance(b):
    errors, rng = [], random.Random(7)
    pg = await new_page(b, "balance", errors, fresh_player=False)
    levels = await pg.evaluate("LEVEL_LIST.map((l,i)=>({i,word:l.word,pass:l.pass,time:l.time,world:l.world}))")
    day = int(time.time() // 86400)
    picked = levels if BALANCE_OBJECTS >= len(levels) else [levels[(day * BALANCE_OBJECTS + k) % len(levels)] for k in range(BALANCE_OBJECTS)]
    rows = []
    for L in picked:
        ds = real_drawings(L["word"], DRAWINGS_PER_OBJECT)
        if not ds:
            continue
        scores = []
        for d in ds:
            r = await pg.evaluate("([w,s])=>aiJudge(w,[{strokes:s}]).then(x=>x[0].acc)", [L["word"], to_sheet(d, rng)])
            scores.append(r)
        wrong_word = levels[(L["i"] + 11) % len(levels)]["word"]
        wrong = [await pg.evaluate("([w,s])=>aiJudge(w,[{strokes:s}]).then(x=>x[0].acc)", [wrong_word, to_sheet(d, rng)]) for d in ds[:3]]
        pass_rate = sum(s >= L["pass"] for s in scores) / len(scores)
        row = {"level": L["i"] + 1, "word": L["word"], "pass": L["pass"], "median": statistics.median(scores), "pass_rate": round(pass_rate, 2), "wrong_max": max(wrong), "n": len(scores)}
        rows.append(row)
        if pass_rate < .5:
            find("high" if pass_rate < .3 else "medium", "balance", f"Level {row['level']} '{L['word']}': only {round(pass_rate * 100)}% of real drawings pass (median {row['median']}%, needs {L['pass']}%).")
        if max(wrong) >= L["pass"]:
            find("medium", "balance", f"A drawing of '{L['word']}' scored {max(wrong)}% when judged as '{wrong_word}' (wrong object passes).")
    METRICS["balance"] = rows
    await pg.context.close()
    return errors


def write_report(errors, seconds):
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    for e in sorted(set(errors))[:30]:
        find("high", "page errors", e)
    FINDINGS.sort(key=lambda f: sev_order[f["severity"]])
    counts = {s: sum(f["severity"] == s for f in FINDINGS) for s in sev_order}
    lines = [f"# Playtest report · {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}", "",
             f"Site: {SITE} · bots ran for {round(seconds / 60, 1)} min · findings: " + ", ".join(f"{v} {k}" for k, v in counts.items()), ""]
    if FINDINGS:
        lines += ["## Findings", "", "| Severity | Area | What happened |", "|---|---|---|"]
        lines += [f"| {f['severity']} | {f['area']} | {f['message'].replace('|', '/')} |" for f in FINDINGS]
    else:
        lines += ["## Findings", "", "No problems found. 🎉"]
    m = METRICS
    lines += ["", "## How the bots' games went", ""]
    if m.get("ai_ready_seconds"):
        lines.append(f"- AI ready after {statistics.median(m['ai_ready_seconds'])} s (median of {len(m['ai_ready_seconds'])} loads)")
    for p in m.get("ui_plays", []):
        lines.append(f"- {p['what']}: drew **{p['word']}** in {p['draw_seconds']} s → {p['score']}% ({p['title']}; the same drawing judged directly: {p['direct']}%)")
    for k in ("guided_first_figure", "trophies_after_first_session", "ranking_rows_today", "one_phone_round", "room_create_seconds", "room_join_seconds", "room_board", "monkey_actions"):
        if k in m:
            lines.append(f"- {k.replace('_', ' ')}: {m[k]}")
    if m.get("balance"):
        lines += ["", "## Level difficulty with real human drawings (gyroscope wobble added)", "", "| Level | Object | Needs | Median score | Real drawings that pass | Best wrong-object score |", "|---|---|---|---|---|---|"]
        lines += [f"| {r['level']} | {r['word']} | {r['pass']}% | {r['median']}% | {round(r['pass_rate'] * 100)}% of {r['n']} | {r['wrong_max']}% |" for r in m["balance"]]
    open(f"{OUT}/report.md", "w").write("\n".join(lines) + "\n")
    json.dump({"counts": counts, "findings": FINDINGS, "metrics": METRICS}, open(f"{OUT}/summary.json", "w"), indent=1)
    print("\n".join(lines))


async def main():
    t0 = time.time()
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for bot in (first_time_player, party, balance, monkey):
            try:
                errors += await bot(b)
            except Exception as e:
                find("high", bot.__name__, f"Bot crashed: {e}\n{traceback.format_exc()[-400:]}")
        await b.close()
    write_report(errors, time.time() - t0)


if __name__ == "__main__":
    asyncio.run(main())
