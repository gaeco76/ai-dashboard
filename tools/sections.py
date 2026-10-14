"""섹션별 요소 스크린샷 (점검용): python tools/sections.py [width] [prefix]"""
import sys, asyncio, os
from playwright.async_api import async_playwright
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1440; PRE = sys.argv[2] if len(sys.argv) > 2 else 'sec'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'screenshots', '_check'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': 900}, device_scale_factor=1 if W > 600 else 2)
        await pg.goto('http://127.0.0.1:8765/ai-dashboard/', wait_until='networkidle'); await pg.wait_for_timeout(2500)
        await pg.add_style_tag(content='.topbar,.secnav,.accbar{position:static!important}')
        await pg.screenshot(path=f'{OUT}/{PRE}-top.png')
        for s in ['s-glance','s-scatter','s-context','s-table','s-plans','s-deals','s-timeline','s-reactions','s-notes']:
            await pg.locator('#' + s).screenshot(path=f'{OUT}/{PRE}-{s}.png')
        await b.close()
asyncio.run(main())
