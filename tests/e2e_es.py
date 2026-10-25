import asyncio
from playwright.async_api import async_playwright
from e2e_challenges import BASE, ORI, CONNECT, draw_sun

LEFTOVER = """(()=>{const out=new Set(),rx=/\\b(the|and|your|you|with|to|of|is|on|tap|draw|drawing|phone|again)\\b/i;
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){const p=n.parentElement;if(!p||/SCRIPT|STYLE/.test(p.tagName)||p.closest('[data-noi18n]'))continue;
    const t=n.nodeValue.trim();if(t&&rx.test(t)&&!/^https?:/.test(t))out.add(t)}
  document.querySelectorAll('[placeholder],[aria-label]').forEach(e=>['placeholder','aria-label'].forEach(a=>{const v=e.getAttribute(a);if(v&&rx.test(v))out.add(a+': '+v)}));
  return[...out]})()"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await ctx.add_init_script("try{if(!localStorage.getItem('ts-lang'))localStorage.setItem('ts-lang','es')}catch(_){}")
        await ctx.add_init_script(f"addEventListener('DOMContentLoaded',()=>{{{CONNECT}}})")
        await ctx.add_init_script("try{if(localStorage.getItem('ts-donate')==null)localStorage.setItem('ts-donate','false')}catch(_){}")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/index.html")
        await pg.evaluate(ORI)
        await pg.evaluate("S.sens=22;WORDS.splice(0,WORDS.length,'sun');LEVEL_LIST.forEach(l=>l.word='sun');DAILY_TIME=8")
        await pg.wait_for_timeout(500)
        print("lang:", await pg.evaluate("document.documentElement.lang"))
        print("home:", (await pg.inner_text("#cDaily")).replace("\n", " | "), "||", await pg.inner_text("#start"))
        await pg.screenshot(path="es_home.png", full_page=True)
        assert "Reto diario" in await pg.inner_text("#cDaily")
        left = await pg.evaluate(LEFTOVER)
        print("english left in whole page:", len(left))
        for t in left:
            print("   ", t[:110])

        await pg.click("#cDaily"); await pg.wait_for_selector("#s-hand:not([hidden])")
        print("handoff:", await pg.inner_text("#hWho"), "|", (await pg.inner_text("#s-hand")).replace("\n", " | ")[:220])
        await draw_sun(pg)
        await pg.wait_for_selector("#s-cres:not([hidden])", timeout=20000)
        await pg.wait_for_timeout(300)
        print("result:", await pg.inner_text("#crTitle"), "|", (await pg.inner_text("#crTop")).replace("\n", " "), "|", await pg.inner_text("#crInfo"))
        assert "La IA ve: sol" in await pg.inner_text("#crTitle")
        print("survey:", (await pg.inner_text("#fb-s-cres")).replace("\n", " ")[:160])
        await pg.screenshot(path="es_result.png", full_page=True)
        await pg.evaluate("openPractice()")
        print("practice:", (await pg.inner_text("#s-practice")).replace("\n", " | ")[:200])
        await pg.evaluate("openGuided()")
        print("guided:", (await pg.inner_text("#gdWorlds")).replace("\n", " | ")[:200])
        await pg.evaluate("openClinic()")
        print("clinic:", (await pg.inner_text("#s-clinic")).replace("\n", " | ")[:200])
        left = await pg.evaluate(LEFTOVER)
        print("english left after flows:", len(left))
        for t in left:
            print("   ", t[:110])
        await pg.evaluate("show('s-home')")
        await pg.click("#openSettings")
        await pg.click("#langSeg button[data-lang=en]")
        await pg.wait_for_load_state("load")
        await pg.wait_for_timeout(500)
        print("after switching back:", (await pg.inner_text("#cDaily")).replace("\n", " | "))
        assert "Daily challenge" in await pg.inner_text("#cDaily")
        print("page errors:", errs or "none")
        assert not errs
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
