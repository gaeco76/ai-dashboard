#!/usr/bin/env python3
"""단일 파일 오프라인 HTML: CSS·ECharts·JS·data.json 인라인 → dist/ai-dashboard-offline.html"""
import os, re, json
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
html = rd('index.html'); data = json.loads(rd('data/data.json'))
safe = lambda s: s.replace('</script', '<\\/script')
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', lambda m: '<style>' + rd(m.group(1)) + '</style>', html)
html = html.replace('<script src="vendor/echarts.min.js"></script>', '<script>' + safe(rd('vendor/echarts.min.js')) + '</script>')
html = html.replace('<script src="js/core.js"></script>', '<script>window.AID_EMBED=' + safe(json.dumps(data, ensure_ascii=False)) + ';\n' + safe(rd('js/core.js')) + '</script>')
sd = rd('data/store.json') if os.path.exists(os.path.join(R, 'data', 'store.json')) else 'null'
html = html.replace('<script src="js/store.js"></script>', '<script>window.AID_STORE_EMBED=' + safe(json.dumps(json.loads(sd), ensure_ascii=False)) + ';\n' + safe(rd('js/store.js')) + '</script>')
html = html.replace('<script src="js/app.js"></script>', '<script>' + safe(rd('js/app.js')) + '</script>')
xd = rd('data/x.json') if os.path.exists(os.path.join(R, 'data', 'x.json')) else 'null'
html = html.replace('<script src="js/x.js"></script>', '<script>window.AID_X_EMBED=' + safe(json.dumps(json.loads(xd), ensure_ascii=False)) + ';\n' + safe(rd('js/x.js')) + '</script>')
html = html.replace('<title>AI 모델 비교 대시보드</title>', f'<title>AI 모델 비교 대시보드 (오프라인 · {data["asOf"]})</title>')
assert 'src="js/' not in html and 'href="css/' not in html
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
out = os.path.join(R, 'dist', 'ai-dashboard-offline.html'); open(out, 'w', encoding='utf-8').write(html)
print(os.path.normpath(out), len(html.encode()), 'bytes')
