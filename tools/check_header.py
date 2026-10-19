"""헤더 저장소 날짜 + JS 오류 + 모바일 넘침 확인. 사용: check_header.py [url] [prefix]"""
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/ai-dashboard/'
pre = sys.argv[2] if len(sys.argv) > 2 else 'local'
out = {}; errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console ' + m.text))
    pg.goto(base, wait_until='networkidle'); pg.wait_for_timeout(1500)
    out['asOf'] = pg.locator('#asOf').inner_text(); out['title'] = pg.locator('#asOf').get_attribute('title')
    pg.screenshot(path=f'screenshots/{pre}-header.png', clip={'x': 0, 'y': 0, 'width': 1440, 'height': 160})
    pg.goto(base + '#x', wait_until='networkidle'); pg.wait_for_timeout(1500)
    out['x_ok'] = pg.locator('#xapp').inner_text()[:80]
    m = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True)
    m.on('pageerror', lambda e: errs.append('m ' + str(e)))
    m.goto(base, wait_until='networkidle'); m.wait_for_timeout(1500)
    out['mobile_overflow'] = m.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    m.screenshot(path=f'screenshots/{pre}-header-mobile.png', clip={'x': 0, 'y': 0, 'width': 390, 'height': 220})
    out['errors'] = errs; b.close()
print(json.dumps(out, ensure_ascii=False, indent=1))
