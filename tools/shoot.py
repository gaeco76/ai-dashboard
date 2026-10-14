"""헤드리스 Chrome: JS 오류 수집 + 데스크톱(1440)·모바일(390) 전체 페이지 스크린샷
사용: /workspace/.venv-pw/bin/python tools/shoot.py [url] [접미사]"""
import sys, asyncio, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/ai-dashboard/'
SUF = sys.argv[2] if len(sys.argv) > 2 else ''
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'screenshots')
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for name, vp, scale, theme in [('desktop', {'width': 1440, 'height': 900}, 1, 'dark'), ('mobile', {'width': 390, 'height': 844}, 2, 'dark'), ('desktop-light', {'width': 1440, 'height': 900}, 1, 'light')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=scale, is_mobile=name == 'mobile', has_touch=name == 'mobile')
            await ctx.add_init_script(f"localStorage.setItem('aid-theme','{theme}')")
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] PAGEERROR {e}'))
            pg.on('console', lambda m, n=name: errs.append(f'[{n}] CONSOLE {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
            await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(2500)
            err = await pg.eval_on_selector_all('.error', 'e=>e.map(x=>x.textContent)')
            if err: errs.append(f'[{name}] RENDER {err}')
            ow = await pg.evaluate('document.documentElement.scrollWidth')
            if ow > vp['width'] + 1: errs.append(f'[{name}] 가로 오버플로 scrollWidth={ow}')
            f = os.path.join(OUT, f'{name}{SUF}.png'); await pg.screenshot(path=f, full_page=True); print('shot', f)
            if name == 'desktop':
                await pg.locator('#s-glance').screenshot(path=os.path.join(OUT, f'glance{SUF}.png'))
                await pg.goto(URL + '?today=2026-10-08', wait_until='networkidle'); await pg.wait_for_timeout(1500)
                await pg.locator('#s-deals').screenshot(path=os.path.join(OUT, f'deals-expired-test{SUF}.png')); print('shot expired test (today=2026-10-08)')
            await ctx.close()
        await b.close()
    print('\n'.join(errs) or 'NO ERRORS')
asyncio.run(main())
