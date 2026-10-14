#!/usr/bin/env python3
"""공용 저장소 /workspace/data/ai (등급 데이터) → data/store.json  (읽기 전용)
각 종류별로 파일명 끝 YYYYMMDD가 가장 최신인 파일을 고른다. md 기반 data/data.json과 값 차이를 diffs로 기록."""
import re, json, glob, os, datetime as dt
ROOT = '/workspace/data'; AI = ROOT + '/ai'
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); OUT = os.path.join(R, 'data', 'store.json')
KST = dt.timezone(dt.timedelta(hours=9))
KINDS = {'benchmarks': 'benchmarks/ai_benchmarks_*_????????.json', 'pricing': 'pricing/ai_pricing_api_????????.json',
         'promos': 'pricing/ai_pricing_promos_????????.json', 'events': 'models/ai_models_events_????????.json',
         'claims': 'x/x_ai_claims_verification_????????.json', 'posts': 'x/x_ai_posts_????????.json'}
GRADES = ['확정', '부분', '개략', '충돌', '미확', '추정']
WARN = []
def latest(pat):
    fs = glob.glob(os.path.join(AI, pat))
    return max(fs, key=lambda f: re.search(r'(\d{8})\.json$', f).group(1)) if fs else None
def recs(path):
    d = json.load(open(path, encoding='utf-8'))
    return d.get('claims') or d.get('records') or d.get('posts') or [] if isinstance(d, dict) else d
def verification():
    """INDEX.md: 파일별 상태 표 + 비서실장 확인 문단"""
    try: t = open(ROOT + '/INDEX.md', encoding='utf-8').read()
    except OSError: return {'label': 'INDEX.md 없음', 'usable': False}
    m = re.search(r'##\s*비서실장 확인 \(([\d-]+)\)\s*\n(.*?)(?:\n##|\Z)', t, re.S)
    body = m.group(2).strip() if m else ''
    usable = bool(m and re.search(r'써도 돼요|사용 가능|검증 완료', body))
    rows = {mm.group(1): mm.group(2).strip() for mm in re.finditer(r'\|\s*`(ai/[^`]+)`\s*\|[^|]*\|\s*([^|]+)\|', t)}
    return {'usable': usable, 'date': m.group(1) if m else None, 'text': body, 'tableStatus': rows,
            'label': (f'비서실장 확인 {m.group(1)} · 사용 가능' if usable else '검증 대기') }
def main():
    files = {k: latest(p) for k, p in KINDS.items()}
    out = {'generatedAt': dt.datetime.now(KST).isoformat(timespec='seconds'), 'root': AI, 'files': {k: (os.path.relpath(v, ROOT) if v else None) for k, v in files.items()},
           'verification': verification(), 'grades': GRADES}
    for k in ('benchmarks', 'pricing', 'promos', 'events', 'claims'):
        out[k] = recs(files[k]) if files[k] else []
    # 규칙 점검: 등급 어휘, 확정인데 source_url 없음
    for k in ('benchmarks', 'pricing', 'promos', 'events', 'claims'):
        for r in out[k]:
            if r.get('grade') not in GRADES: WARN.append(f"{k}: 알 수 없는 등급 {r.get('grade')} — {r.get('subject')}")
            if r.get('grade') == '확정' and not r.get('source_url'): WARN.append(f"{k}: 확정인데 source_url 없음 — {r.get('subject')}")
    # 최신 지수 (subject별 as_of 최대) + 이전 기록
    idx = {}
    for r in out['benchmarks']:
        s = r['subject']; idx.setdefault(s, []).append(r)
    out['indexLatest'] = {s: sorted(v, key=lambda r: r.get('as_of') or '')[-1] for s, v in idx.items()}
    out['indexHistory'] = {s: sorted(v, key=lambda r: r.get('as_of') or '') for s, v in idx.items()}
    pr = {}
    for r in out['pricing']: pr.setdefault(r['subject'], {})[r['metric']] = r
    out['priceBySubject'] = pr
    # md 데이터와 비교
    diffs = []
    try: md = json.load(open(os.path.join(R, 'data', 'data.json'), encoding='utf-8'))
    except OSError: md = {'models': [], 'discounts': []}
    def subj(m):
        for s in (m['model'], m['vendor'] + ' ' + m['model']):
            if s in out['indexLatest'] or s in pr: return s
        return None
    seen = set()
    for m in md['models']:
        s = subj(m); 
        if not s: diffs.append({'kind': 'model', 'subject': m['model'], 'field': '전체', 'md': '있음', 'store': '저장소에 없음'}); continue
        seen.add(s)
        il = out['indexLatest'].get(s)
        if il and il['value'] != m.get('index'): diffs.append({'kind': 'index', 'subject': s, 'field': '지수', 'md': m.get('index'), 'store': il['value'], 'grade': il['grade']})
        p = pr.get(s, {})
        for f, mk in (('in', 'api_price_input'), ('out', 'api_price_output')):
            if mk in p and p[mk]['value'] != m['price'].get(f): diffs.append({'kind': 'price', 'subject': s, 'field': mk, 'md': m['price'].get(f), 'store': p[mk]['value'], 'grade': p[mk]['grade']})
        if 'intro_price_end_date' in p: diffs.append({'kind': 'deadline', 'subject': s, 'field': '도입가 종료일', 'md': '미공개', 'store': p['intro_price_end_date']['value'], 'grade': p['intro_price_end_date']['grade']})
        for f, mk in (('in', 'api_price_input_after_intro'), ('out', 'api_price_output_after_intro')):
            if mk in p:
                alt = next((a for a in m['price'].get('alt', []) if a.get('kind') == 'after'), None)
                if not alt or alt.get(f) != p[mk]['value']: diffs.append({'kind': 'price', 'subject': s, 'field': mk, 'md': alt.get(f) if alt else None, 'store': p[mk]['value'], 'grade': p[mk]['grade']})
        nt = (p.get('api_price_input') or {}).get('note', '')
        if p.get('api_price_input', {}).get('grade') not in (None, '확정'): diffs.append({'kind': 'grade', 'subject': s, 'field': 'api_price_input 등급', 'md': '(등급 없음)', 'store': p['api_price_input']['grade'], 'note': nt})
    for s in sorted(set(out['indexLatest']) | set(k for k, v in pr.items() if 'api_price_input' in v)):
        if s not in seen: diffs.append({'kind': 'model', 'subject': s, 'field': '신규 모델', 'md': '없음', 'store': '있음'})
    mdnames = {m['model']: m for m in md['models']} | {m['vendor'] + ' ' + m['model']: m for m in md['models']}
    for r in out['events']:
        for part in r['subject'].split(' / '):
            m = mdnames.get(part.strip())
            if m and r['metric'] in ('launch', 'general_availability') and re.match(r'\d{4}-\d{2}-\d{2}$', str(r['value'])):
                mdd = [x['date'] for x in m['release']['dates']]
                if r['value'] not in mdd: diffs.append({'kind': 'event', 'subject': part, 'field': r['metric'], 'md': '출시 ' + ', '.join(mdd), 'store': r['value'], 'grade': r['grade']})
    # 비서실장 '남은 일' → 미해결 항목
    v = out['verification']; mm = re.search(r'남은 일[:：]\s*(.+)', v.get('text', ''))
    out['openIssues'] = [x.strip(' .') + (')' if x.count('(') > x.count(')') else '') for x in re.split(r'\),\s*', mm.group(1))] if mm else []
    for r in out['promos']:
        diffs.append({'kind': 'deadline', 'subject': r['subject'], 'field': r['metric'], 'md': '(md: 진행 중/마감 예정)', 'store': r['value'], 'grade': r['grade']})
    out['diffs'] = diffs; out['warnings'] = WARN
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"store → {os.path.normpath(OUT)} · {out['verification']['label']}")
    for k, v in out['files'].items(): print(f'  {k:10} {v}')
    print(f'  diffs {len(diffs)}'); [print('   ', d) for d in diffs]
    [print('  ⚠', w) for w in WARN]
if __name__ == '__main__': main()
