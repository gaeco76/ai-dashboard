#!/usr/bin/env python3
"""저장소 연결 확인 스크린샷: 모델 비교 탭(전체·표·할인·이벤트·메모) + X 탭 주장 판정 패널, 데스크톱 1440 / 모바일 390"""
import os, asyncio
from playwright.async_api import async_playwright
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); OUT = os.path.join(R, 'screenshots')
U = 'file://' + os.path.abspath(os.path.join(R, 'dist', 'ai-dashboard-offline.html'))
UNSTICK = "for (const s of ['.topbar','#toptabs','#secnav','#filterbar']) { const e=document.querySelector(s); if(e) e.style.position='static'; }"
async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for name, vp, mob in [('desktop', {'width': 1440, 'height': 900}, False), ('mobile', {'width': 390, 'height': 844}, True)]:
            pg = await b.new_page(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
            await pg.goto(U); await pg.wait_for_selector('#mTable tbody tr'); await pg.wait_for_timeout(2000)
            info = await pg.evaluate("()=>({storeOn:DATA.storeOn, models:DATA.models.length, gb:document.querySelectorAll('#app .gb').length, md:document.querySelectorAll('#app .g-md').length, srcTags:document.querySelectorAll('#app .srctag').length, over:document.documentElement.scrollWidth-document.documentElement.clientWidth})")
            await pg.screenshot(path=os.path.join(OUT, f'model-{name}.png'), full_page=True)
            await pg.evaluate(UNSTICK); await pg.wait_for_timeout(800)
            for sec in ['s-table', 's-deals', 's-timeline', 's-notes', 's-plans']:
                await pg.locator('#' + sec).screenshot(path=os.path.join(OUT, f'model-{sec[2:]}-{name}.png'))
            await pg.goto(U + '#x'); await pg.wait_for_selector('#xClaims tbody tr'); await pg.wait_for_timeout(1500)
            await pg.evaluate(UNSTICK); await pg.wait_for_timeout(800)
            await pg.locator('#x-claims').screenshot(path=os.path.join(OUT, f'x-claims-{name}.png'))
            xi = await pg.evaluate("()=>({claims:document.querySelectorAll('#xClaims tbody tr').length, conflict:document.querySelectorAll('#xapp .g-conflict').length, over:document.documentElement.scrollWidth-document.documentElement.clientWidth})")
            print(name, info, xi, 'errors:', errs or 'none')
            if errs or info['over'] > 2 or xi['over'] > 2 or not info['storeOn']: bad.append(name)
            await pg.close()
        await b.close()
    print('NO ERRORS' if not bad else 'PROBLEMS ' + str(bad))
asyncio.run(main())
