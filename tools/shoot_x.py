#!/usr/bin/env python3
"""X 화제 탭 검증·스크린샷: 오프라인 단일 파일 + (선택) http 서버 버전. JS 오류·가로 넘침 검사."""
import sys, os, asyncio
from playwright.async_api import async_playwright
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); OUT = os.path.join(R, 'screenshots')
URLS = ['file://' + os.path.abspath(os.path.join(R, 'dist', 'ai-dashboard-offline.html'))] + sys.argv[1:]
async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for u in URLS:
            for name, vp, mob in [('desktop', {'width': 1440, 'height': 900}, False), ('mobile', {'width': 390, 'height': 844}, True)]:
                pg = await b.new_page(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
                errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
                await pg.goto(u + '#x'); await pg.wait_for_selector('#xTable tbody tr', timeout=15000); await pg.wait_for_timeout(1500)
                info = await pg.evaluate("""()=>({charts:['xMent','xEngC','xTime','xTop'].filter(i=>echarts.getInstanceByDom(document.getElementById(i))).length,
                  rows:document.querySelectorAll('#xTable tbody tr').length, badges:document.querySelectorAll('#xapp .b-unverified').length,
                  banner:!!document.querySelector('.xbanner'), links:document.querySelectorAll('#xapp a[href^="https://x.com"]').length,
                  over:document.documentElement.scrollWidth-document.documentElement.clientWidth, mainHidden:document.getElementById('app').hidden})""")
                # 최소 좋아요 필터 동작
                await pg.click('#xMin button[data-v="5"]'); await pg.wait_for_timeout(400)
                f5 = await pg.inner_text('#xCount'); await pg.click('#xMin button[data-v="0"]'); await pg.wait_for_timeout(600)
                tag = 'x-' + name if u.startswith('file://') else 'x-' + name + '-http'
                await pg.screenshot(path=os.path.join(OUT, tag + '.png'), full_page=True)
                # 탭 왕복
                await pg.click('#toptabs button[data-t="main"]'); await pg.wait_for_timeout(800)
                back = await pg.evaluate("()=>!document.getElementById('app').hidden && document.getElementById('xapp').hidden && document.querySelectorAll('#app .chart canvas').length>0")
                print(tag, info, 'min5:', f5, 'tab-back:', back, 'errors:', errs or 'none')
                if errs or info['over'] > 2 or info['charts'] < 4 or not back: bad.append(tag)
                await pg.close()
        await b.close()
    print('NO ERRORS' if not bad else 'PROBLEMS ' + str(bad))
asyncio.run(main())
