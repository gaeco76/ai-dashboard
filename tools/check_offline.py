"""오프라인 단일 파일을 file://로, 외부 네트워크 차단 상태에서 열어 JS 오류 확인"""
import asyncio, os
from playwright.async_api import async_playwright
F = 'file://' + os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist', 'ai-dashboard-offline.html'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        await pg.goto(F); await pg.wait_for_timeout(2500)
        print('state:', await pg.inner_text('#srcState'), '| asOf', await pg.inner_text('#asOf'))
        print('charts:', await pg.evaluate("[...document.querySelectorAll('.chart')].filter(e=>e.querySelector('canvas')).length"), '/', await pg.evaluate("document.querySelectorAll('.chart').length"),
              '| deal cards', await pg.evaluate("document.querySelectorAll('.dcard').length"), '| table rows', await pg.evaluate("document.querySelectorAll('#mTable tbody tr').length"))
        print('JS errors:', errs or 'none'); await b.close()
asyncio.run(main())
