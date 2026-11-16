"""Browser smoke test. Start the app in sample mode first (./run.sh demo), then:

    pip install playwright && playwright install chromium
    python tests/e2e_smoke.py [http://localhost:3000]

Walks every page at desktop and phone widths, exercises the viewer, and fails on any page
error or horizontal overflow.
"""
import asyncio
import re
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
FIELD = "ra=270&dec=66.56"
problems: list[str] = []


def check(cond: bool, what: str):
    print(("  ok   " if cond else "  FAIL ") + what)
    if not cond:
        problems.append(what)


async def run(p, width: int, height: int):
    print(f"\n== {width}x{height} ==")
    # software WebGL, so the 3D views are exercised on machines without a GPU
    b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport={"width": width, "height": height}, has_touch=width < 600)
    pg = await ctx.new_page()
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(str(e)))

    async def no_overflow(name):
        w = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check(w <= 1, f"{name}: no sideways scrolling")

    await pg.goto(BASE + "/")
    await pg.wait_for_selector("text=Start with a field")
    await pg.wait_for_selector("canvas[role=img]")
    check(await pg.locator(".status").count() == 1, "landing: archive status shown")
    caption_home = await pg.locator("footer p").first.inner_text()
    globe = pg.locator("[aria-label^='A globe'] canvas")
    await globe.scroll_into_view_if_needed()
    await pg.wait_for_timeout(1500)
    gb = await globe.bounding_box()
    await pg.mouse.click(gb["x"] + gb["width"] * 0.45, gb["y"] + gb["height"] * 0.45)
    await pg.wait_for_selector("text=Look here", timeout=10000)
    href = await pg.get_by_role("link", name="Look here").get_attribute("href")
    check(href is not None and "ra=" in href and "dec=" in href, "landing: clicking the 3D globe chooses a position")
    await no_overflow("landing")

    await pg.goto(f"{BASE}/?{FIELD}")
    await pg.wait_for_selector("text=Visits", timeout=90000)
    check(await pg.locator(".mark").first.is_visible(), "viewer: data provenance badge shown")
    await pg.get_by_role("button", name="difference").click()
    await pg.wait_for_selector("text=Amber: brighter in B", timeout=30000)
    check("mode=diff" in pg.url, "viewer: mode is kept in the link")
    await pg.get_by_role("button", name="3D surface").click()
    await pg.wait_for_selector("[aria-label^='The image drawn as a three-dimensional surface'] canvas", timeout=20000)
    check("mode=surface" in pg.url, "viewer: 3D surface view opens")
    await pg.get_by_role("button", name="timelapse").click()
    seen = set()
    for _ in range(6):
        seen.add(await pg.locator("span[aria-live=polite]").first.inner_text())
        await pg.wait_for_timeout(500)
    check(len(seen) > 1 and "mode=movie" in pg.url, "viewer: timelapse steps through the visits")
    await pg.get_by_role("button", name="step", exact=True).click()
    cv = await pg.locator("canvas[role=img]").bounding_box()
    await pg.mouse.click(cv["x"] + cv["width"] * 0.5, cv["y"] + cv["height"] * 0.5)
    await pg.wait_for_selector("text=This spot in every visit", timeout=20000)
    await pg.wait_for_selector("text=Plot these as a spectrum", timeout=30000)
    check(True, "viewer: clicking the image measures that spot in every visit")
    caption_view = await pg.locator("footer p").first.inner_text()
    check(caption_view != caption_home and "field you are viewing" in caption_view, "background: the viewer faces the field being viewed")
    await pg.get_by_role("button", name="blink").click()
    await pg.keyboard.press("ArrowRight")
    await pg.wait_for_timeout(300)
    check("a=" in pg.url and "mode=blink" in pg.url, "viewer: arrow key changes visit A")
    await pg.get_by_label("Things that moved between visits").click()
    await pg.wait_for_selector("text=Open the evidence", timeout=60000)
    check("overlay=movers" in pg.url, "viewer: movers overlay is kept in the link")
    async with pg.expect_download() as dl:
        await pg.get_by_role("button", name="Save image").click()
    check((await dl.value).suggested_filename.endswith(".png"), "viewer: image export downloads a PNG")
    await no_overflow("viewer")

    await pg.goto(f"{BASE}/detective?{FIELD}")
    await pg.wait_for_selector("text=Why it was flagged", timeout=60000)
    await no_overflow("movers")
    await pg.get_by_role("link", name="Build its spectrum").click()
    await pg.wait_for_selector("text=Measurements", timeout=60000)
    await no_overflow("spectrum")

    await pg.goto(f"{BASE}/planetx?{FIELD}")
    await pg.wait_for_selector("text=Visual magnitude", timeout=30000)
    await pg.wait_for_selector("[aria-label^='Three-dimensional view'] canvas", timeout=20000)
    check("Brown & Batygin" in await pg.locator("footer p").first.inner_text(), "background: the Planet Nine page faces the predicted region")
    await pg.get_by_role("button", name="Edge-on").click()
    await pg.get_by_role("button", name="Flat, from above").click()
    check(await pg.locator("svg[aria-label^='Top-down view']").count() == 1, "planet nine: 3D orbit view with a flat alternative")
    await no_overflow("planet nine")
    await pg.goto(f"{BASE}/about")
    await pg.wait_for_selector("text=Limits worth knowing")
    check(await pg.locator("text=What it could earn").count() == 1, "how it works: problem, market and revenue sections present")
    check(await pg.locator(".math-block").count() == 14 and await pg.locator(".katex").count() > 60, "how it works: mathematics column is typeset")
    await pg.locator("#m7 summary").click()
    check(await pg.locator("#m7 .derive-body").is_visible(), "how it works: a derivation opens")
    await no_overflow("about")
    r = await pg.goto(f"{BASE}/no-such-page")
    check(r.status == 404 and await pg.locator("text=There is no page at this address").count() == 1, "404 page")
    r = await pg.goto(f"{BASE}/?ra=999&dec=0")
    await pg.wait_for_selector("text=could not be loaded", timeout=30000)
    check(True, "viewer: bad coordinates give a readable error")

    check(not errors, f"no page errors {errors[:3] if errors else ''}")
    await b.close()


async def main():
    async with async_playwright() as p:
        await run(p, 1440, 900)
        await run(p, 390, 800)
    print("\nRESULT:", "PASS" if not problems else f"{len(problems)} FAILED")
    sys.exit(1 if problems else 0)


asyncio.run(main())
