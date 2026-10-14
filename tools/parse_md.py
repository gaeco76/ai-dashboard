#!/usr/bin/env python3
"""AI 모델 리서치 마크다운 → data/data.json
사용: python3 tools/parse_md.py [파일.md]   (생략 시 /workspace/ai-model-research/*.md 중 최신 날짜 파일)
원본 텍스트(raw)는 항상 보존하고, 숫자는 원문에 있는 것만 추출한다. 파생값(3:1 혼합가 등)은 derived로 표시."""
import re, json, sys, glob, os, datetime as dt

SRC_DIR = '/workspace/ai-model-research'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'data.json')
WARN = []

def latest_md():
    files = [f for f in glob.glob(os.path.join(SRC_DIR, '*.md')) if re.search(r'\d{4}-\d{2}-\d{2}', os.path.basename(f))]
    if not files: sys.exit('no dated .md in ' + SRC_DIR)
    return max(files, key=lambda f: re.search(r'\d{4}-\d{2}-\d{2}', os.path.basename(f)).group(0))

URL_RE = re.compile(r'https?://[^\s)>\]]+')
UNCERTAIN_RE = re.compile(r'미확인|추정|미공개|약 |조건부|한시|도입가|\?')

def flags_of(s):
    s = s or ''; f = []
    if '미확인' in s: f.append('unverified')
    if '추정' in s: f.append('estimate')
    if '미공개' in s: f.append('undisclosed')
    if re.search(r'(^|\s)약\s', s): f.append('approx')
    if '한시' in s or '도입가' in s: f.append('temporary')
    return f

def num(s):
    s = s.replace(',', '').strip()
    try: return float(s) if '.' in s else int(s)
    except ValueError: return None

def table_rows(lines):
    rows = [l for l in lines if l.strip().startswith('|')]
    if len(rows) < 2: return [], []
    cells = lambda l: [c.strip() for c in l.strip().strip('|').split('|')]
    head = cells(rows[0]); body = [cells(r) for r in rows[1:] if not re.match(r'^\|\s*-', r.strip())]
    for b in body:
        if len(b) != len(head): WARN.append(f'열 개수 불일치: {b}')
    return head, body

# 날짜 표기: YYYY-MM-DD · YYYY년 M월 D일 · YYYY년 M/D · M월 D일 · M/D (앞쪽 패턴 우선)
DATE_RE = re.compile(r'(?<![\d/])(?:(?P<y1>\d{4})-(?P<m1>\d{1,2})-(?P<d1>\d{1,2})'
                     r'|(?:(?P<y2>\d{4})\s*년\s*)?(?P<m2>\d{1,2})\s*월\s*(?P<d2>\d{1,2})\s*일'
                     r'|(?:(?P<y3>\d{4})\s*년\s*)?(?P<m3>\d{1,2})/(?P<d3>\d{1,2}))(?![\d/])')

def find_date(s, year, base, future_bias=False):
    """첫 날짜 → (ISO, match, 연도명시여부). 연도 미기재: 기준연도 가정 후 future_bias(마감일)면 60일 넘게 과거일 때 다음 해,
    아니면 31일 넘게 미래일 때 전년. 연도가 명시되면 그대로 사용."""
    for m in DATE_RE.finditer(s or ''):
        y = m.group('y1') or m.group('y2') or m.group('y3')
        mo = m.group('m1') or m.group('m2') or m.group('m3'); da = m.group('d1') or m.group('d2') or m.group('d3')
        try: d = dt.date(int(y) if y else year, int(mo), int(da))
        except ValueError: WARN.append(f'잘못된 날짜: {m.group(0)}'); continue
        if not y:
            if future_bias and (base - d).days > 60: d = d.replace(year=year + 1)
            if not future_bias and (d - base).days > 31: d = d.replace(year=year - 1)
        return d.isoformat(), m, bool(y)
    return None, None, False

def md_date(s, year, base, future_bias=False):
    return find_date(s, year, base, future_bias)[0]

def strip_date(s, m):
    """날짜 부분 제거 후 남은 라벨(공백 정리)."""
    if not m: return s.strip()
    return re.sub(r'\s{2,}', ' ', (s[:m.start()] + ' ' + s[m.end():])).strip(' ,·')

def split_src(s):
    """'… 출처: url url' 또는 셀 안 URL → (텍스트, [url])."""
    urls = [u.rstrip('.,') for u in URL_RE.findall(s or '')]
    t = URL_RE.sub('', s or ''); t = re.sub(r'출처\s*[:：]\s*', '', t)
    t = re.sub(r'\(\s*\)', '', t); t = re.sub(r'\s{2,}', ' ', t); t = re.sub(r'\s+([.,;])', r'\1', t); t = re.sub(r'[,;]\s*(?=\()', ' ', t).strip(' ,;')
    if t.count('(') < t.count(')') and t.endswith(')'): t = t[:-1]
    return t.strip(), urls

PAIR = r'(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)'
def parse_price(raw):
    out = {'raw': raw, 'in': None, 'out': None, 'label': None, 'alt': [], 'flags': flags_of(raw)}
    main, *paren = re.split(r'\(', raw, maxsplit=1)
    m = re.search(PAIR, main)
    if m:
        out['in'], out['out'] = num(m.group(1)), num(m.group(2))
        lab = main[m.end():].strip()
        out['label'] = lab or None
    if paren:
        p = paren[0].rstrip(')').strip()
        prev = 0
        for pm in re.finditer(PAIR, p):
            out['alt'].append({'label': p[prev:pm.start()].strip(' ,;') or None, 'in': num(pm.group(1)), 'out': num(pm.group(2))}); prev = pm.end()
    # 의미 분류: 원문 표기 기반
    kind = 'list'
    if out['label'] and '도입가' in out['label']: kind = 'intro'      # 한시 도입가 (이후 가격 alt)
    elif out['label'] and '오프피크' in out['label']: kind = 'offpeak' # 시간대 할인가 (피크 alt)
    out['kind'] = kind
    for a in out['alt']:
        a['kind'] = 'after' if a['label'] and '이후' in a['label'] else 'peak' if a['label'] and '피크' in a['label'] else 'tier' if a['label'] and '초과' in a['label'] else 'other'
    if out['in'] is not None and out['out'] is not None:
        out['blend31'] = round((3 * out['in'] + out['out']) / 4, 4)  # 파생값: 입력3:출력1 가중평균
    return out

def parse_ctx(raw):
    m = re.search(r'(\d+(?:\.\d+)?)\s*([MK])', raw, re.I)
    v = None
    if m: v = round(float(m.group(1)) * (1_000_000 if m.group(2).upper() == 'M' else 1_000))
    return {'raw': raw, 'tokens': v, 'approx': bool(re.search(r'약|~|≈', raw))}

def parse_weights(raw):
    if '조건부' in raw: k = 'conditional'
    elif '비공개' in raw: k = 'closed'
    elif re.search(r'MIT|Apache|BSD|공개', raw, re.I): k = 'open'
    else: k = 'unknown'; WARN.append(f'가중치 분류 불가: {raw}')
    return {'raw': raw, 'kind': k, 'ambiguous': raw.strip() not in ('비공개', 'MIT', '조건부 공개', 'Apache 2.0')}

def parse_release(raw, year, base):
    parts = []
    for seg in re.split(r'[,，]', raw):
        seg = seg.strip()
        d, m, _ = find_date(seg, year, base)
        if d: parts.append({'date': d, 'label': strip_date(seg, m) or None})
    return {'raw': raw, 'dates': parts}

def split_tiers(names_raw, prices_raw):
    """요금제 이름·가격 분해. '·'는 같은 티어의 복수 가격, '~'는 이름 범위(중간 이름 미기재)."""
    notes_row, tiers = [], []
    if re.search(r'없음', names_raw): return [], [prices_raw]
    # 가격: 괄호 메모 위치 기록
    segs = [s.strip() for s in prices_raw.split(' / ')]
    names = [s.strip() for s in names_raw.split(' / ')]
    price_items = []
    for i, s in enumerate(segs):
        note = None
        pm = re.search(r'\(([^)]*)\)', s)
        if pm: note = pm.group(1); s = (s[:pm.start()] + s[pm.end():]).strip()
        vals = [num(x) for x in re.split(r'[·]', s) if x.strip()]
        txt = s
        price_items.append({'values': [v for v in vals if v is not None], 'text': txt, 'note': note, 'unknown': '미확인' in txt})
    # 이름 범위 확장
    if len(names) == 1 and '~' in names[0] and len(price_items) > 1:
        a, b = [x.strip() for x in names[0].split('~')]
        prefix = ''
        mm = re.match(r'(.*\s)(\S+)$', a)
        if mm: prefix, a = mm.group(1), mm.group(2)
        n = len(price_items)
        names = [prefix + a] + [None] * (n - 2) + [b]
        WARN.append(f'요금제 이름 범위 "{names_raw}" — 중간 {n-2}개 이름 미기재')
    elif len(names) != len(price_items):
        WARN.append(f'요금제 이름 {len(names)}개 vs 가격 {len(price_items)}개: {names_raw} | {prices_raw}')
    for i, p in enumerate(price_items):
        name = names[i] if i < len(names) else None
        note, scope = p['note'], 'tier'
        if note:
            hit = [n for n in names if n and re.search(r'\b' + re.escape(n.split()[-1]) + r'\b', note)]
            if hit and hit[0] != name:  # 메모가 다른 티어 이름을 가리킴
                for t in tiers:
                    if t['name'] == hit[0]: t['notes'].append(note)
                note = None
            elif i == len(price_items) - 1 and not hit and len(price_items) > 1:
                notes_row.append(note); note = None; scope = 'row'  # 마지막 괄호: 행 전체인지 마지막 티어인지 모호
        tiers.append({'name': name, 'nameMissing': name is None, 'prices': p['values'], 'priceText': p['text'], 'unknown': p['unknown'] or (note and '미확인' in note),
                      'notes': [note] if note else []})
    return tiers, notes_row

VENDOR_KEYS = {'Anthropic': ['Claude', 'Anthropic', 'Opus'], 'OpenAI': ['ChatGPT', 'OpenAI', 'GPT', 'Codex'], 'Google': ['Google', 'Gemini'],
               'Meta': ['Muse', 'Meta'], 'xAI': ['Grok', 'xAI'], 'Xiaomi': ['MiMo', 'Xiaomi'], 'Alibaba': ['Qwen', 'Alibaba'],
               'Z.ai': ['GLM', 'Z.ai', 'ZCode'], 'Moonshot': ['Kimi', 'Moonshot'], 'DeepSeek': ['DeepSeek'], 'MiniMax': ['MiniMax']}
def vendors_in(s):
    return [v for v, ks in VENDOR_KEYS.items() if any(k.lower() in s.lower() for k in ks)]

def match_model(name, models):
    toks = set(re.findall(r'[A-Za-z0-9.]+', name.lower()))
    best, score = None, 0
    for m in models:
        mt = set(re.findall(r'[A-Za-z0-9.]+', (m['vendor'] + ' ' + m['model']).lower()))
        sc = len(toks & mt) / max(1, len(toks))
        if sc > score: best, score = m, sc
    return (best['id'] if best and score >= 0.5 else None), round(score, 2)

SENT = [('대체로 긍정', 'mostly_pos'), ('대체로 부정', 'mostly_neg'), ('긍정', 'pos'), ('부정', 'neg'), ('혼합', 'mixed')]

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else latest_md()
    text = open(path, encoding='utf-8').read()
    lines = text.splitlines()
    title = lines[0].lstrip('# ').strip() if lines else ''
    m = re.search(r'(\d{4}-\d{2}-\d{2})', title) or re.search(r'(\d{4}-\d{2}-\d{2})', os.path.basename(path))
    as_of = m.group(1); base = dt.date.fromisoformat(as_of); year = base.year
    # 섹션 분할
    secs, cur, preamble = {}, None, []
    for l in lines[1:]:
        h = re.match(r'^##\s+(?:\d+\.\s*)?(.+)$', l)
        if h: cur = h.group(1).strip(); secs[cur] = []; continue
        (secs[cur] if cur else preamble).append(l)
    find = lambda *keys: next((k for k in secs if any(x in k for x in keys)), None)
    data = {'asOf': as_of, 'title': title, 'sourceFile': os.path.basename(path), 'sourcePath': path,
            'generatedAt': dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec='seconds'),
            'preamble': ' '.join(x.strip() for x in preamble if x.strip()), 'sources': [], 'sections': list(secs.keys())}
    seen = set()
    for u in URL_RE.findall(text):
        u = u.rstrip('.,')
        if u in seen: continue
        seen.add(u); ctx = next((x for x in lines if u in x), '')
        data['sources'].append({'url': u, 'context': URL_RE.sub('', ctx).replace('출처:', '').strip(' |-')[:160], 'count': text.count(u)})
    data['sourceMentions'] = len(URL_RE.findall(text))
    # 지수/가격 정의
    im = re.search(r'지수\s*=\s*([^(\n]+?)\s*\(', data['preamble']); data['indexName'] = im.group(1).strip() if im else '지수'
    pm = re.search(r'가격\s*=\s*([^\n]+)', data['preamble']); data['priceUnit'] = pm.group(1).strip() if pm else ''
    # 1. 모델
    models = []
    k = find('모델 비교', '비교표')
    if k:
        head, body = table_rows(secs[k])
        col = {h: i for i, h in enumerate(head)}
        g = lambda r, *names: next((r[col[n]] for n in names if n in col and col[n] < len(r)), '')
        for r in body:
            price_col = next((h for h in head if '$' in h or '가격' in h), None)
            mo = {'rank': num(g(r, '#')), 'vendor': g(r, '업체'), 'model': g(r, '모델'),
                  'release': parse_release(g(r, '출시'), year, base), 'index': num(g(r, '지수')) if re.fullmatch(r'\d+(\.\d+)?', g(r, '지수')) else None,
                  'indexRaw': g(r, '지수'), 'price': parse_price(r[col[price_col]] if price_col else ''), 'context': parse_ctx(g(r, '문맥')),
                  'weights': parse_weights(g(r, '가중치')), 'position': split_src(g(r, '포지션'))[0], 'urls': split_src(g(r, '출처'))[1]}
            mo['id'] = re.sub(r'[^a-z0-9]+', '-', (mo['vendor'] + ' ' + mo['model']).lower()).strip('-')
            if mo['index'] is None: WARN.append(f"지수 숫자 아님: {mo['model']} '{mo['indexRaw']}'")
            if mo['price']['in'] is None: WARN.append(f"가격 파싱 실패: {mo['model']} '{mo['price']['raw']}'")
            models.append(mo)
    # 표 아래 메모 줄 ('- …' , '출처:' 포함) → modelNotes, 모델 매칭
    notes = []
    if k:
        for l in secs[k]:
            mm = re.match(r'^\s*[-*]\s+(.+)$', l)
            if not mm: continue
            txt, urls = split_src(mm.group(1))
            hit = [mo['id'] for mo in models if re.search(r'(?<![A-Za-z0-9.])' + re.escape(mo['model']) + r'(?![A-Za-z0-9.\-])', txt, re.I)]
            head_m = re.match(r'^([^:：]{2,40})[:：]', txt)
            notes.append({'text': txt, 'urls': urls, 'models': hit, 'head': head_m.group(1).strip() if head_m else None,
                          'variant': bool(re.match(r'^(변형|프리뷰)', txt))})
        # 표 가격 셀이 '아래 메모'를 가리키면 메모의 대체 가격(예: 오프피크) 추출
        for mo in models:
            if '메모' not in mo['price']['raw']: continue
            for n in notes:
                if n['head'] and mo['model'].lower() in n['head'].lower():
                    for am in re.finditer(r'(오프피크|피크|이후|초과)[^0-9.]{0,6}' + PAIR, n['text']):
                        if am.group(1) == (mo['price']['label'] or ''): continue
                        mo['price']['alt'].append({'label': am.group(1), 'in': num(am.group(2)), 'out': num(am.group(3)), 'kind': 'offpeak' if am.group(1) == '오프피크' else 'other', 'fromNote': True})
    data['models'] = models; data['modelNotes'] = notes
    # 2. 구독
    plans = []
    k = find('구독', '요금제')
    if k:
        head, body = table_rows(secs[k]); col = {h: i for i, h in enumerate(head)}
        for r in body:
            g = lambda n: r[col[n]] if n in col and col[n] < len(r) else ''
            pcol = next((h for h in head if '가격' in h), None)
            tiers, rownotes = split_tiers(g('요금제'), r[col[pcol]] if pcol else '')
            incl = g('표 모델 포함')
            plans.append({'urls': split_src(g('출처'))[1], 'vendor': g('업체'), 'plansRaw': g('요금제'), 'pricesRaw': r[col[pcol]] if pcol else '', 'tiers': tiers, 'rowNotes': rownotes,
                          'none': not tiers, 'includes': incl, 'limits': g('한도'), 'flags': sorted(set(flags_of(r[col[pcol]] if pcol else '') + flags_of(incl) + flags_of(g('요금제'))))})
    data['plans'] = plans; data['planCurrency'] = 'USD/월' if k and 'USD' in k else ''
    # 3. 할인
    disc = []
    k = find('할인', '프로모션')
    if k:
        head, body = table_rows(secs[k]); col = {h: i for i, h in enumerate(head)}
        for r in body:
            g = lambda n: r[col[n]] if n in col and col[n] < len(r) else ''
            raw = g('마감'); ms = []
            for seg in re.split(r'[,，]', raw):
                seg = seg.strip(); d, m, _ = find_date(seg, year, base, future_bias=True)
                if d: ms.append({'date': d, 'label': strip_date(seg, m) or '마감'})
            ms.sort(key=lambda x: x['date'])
            kind = 'dated' if ms else 'ongoing' if '상시' in raw else 'undisclosed' if ('미공개' in raw or '미정' in raw) else 'unknown'
            content = g('내용')
            pct = [x for x in re.findall(r'(\d+(?:[–-]\d+)?)\s*%', content)]
            krw = re.findall(r'₩([\d,]+)', content)
            d = {'urls': split_src(g('출처'))[1], 'target': g('대상'), 'content': content, 'deadlineRaw': raw, 'kind': kind, 'milestones': ms, 'percents': pct,
                 'vendors': vendors_in(g('대상') + ' ' + content), 'krw': [num(x) for x in krw]}
            if len(krw) == 2 and pct and '–' not in pct[0]:
                a, b = num(krw[0]), num(krw[1]); calc = round((1 - b / a) * 100, 1)
                d['check'] = {'calcPercent': calc, 'statedPercent': num(pct[0]), 'ok': abs(calc - num(pct[0])) < 1}
            # 마감이 일부 혜택에만 해당하는 경우(예: 'Vercel 40%, Ramp 50%' / 마감 'Ramp 10/6')
            named = [x['label'] for x in ms if x['label'] not in ('마감', '신청', '소멸')]
            if named and len(re.findall(r'%', content)) > len(named):
                d['partialDeadline'] = f"마감은 {', '.join(named)}에만 기재 — 나머지 혜택 마감 미기재"
                WARN.append(f"할인 '{g('대상')}': {d['partialDeadline']}")
            disc.append(d)
    data['discounts'] = disc
    # 4. 신기능
    feats = []
    k = find('신기능', '기능')
    if k:
        for l in secs[k]:
            sm = re.match(r'^\s*출처\s*[:：]\s*(.+)$', l)
            if sm and feats: feats[-1]['urls'] += split_src(sm.group(1))[1]; continue
            mm = re.match(r'^\s*[-*]\s*([^:：]+)[:：]\s*(.+)$', l)
            if not mm: continue
            vendor, rest = mm.group(1).strip(), mm.group(2).strip()
            ctx = None
            cm = re.match(r'^(.+?)\s+—\s+(.+)$', rest)
            if cm: ctx, rest = cm.group(1), cm.group(2)
            items = []
            for it in re.split(r',\s*(?![^()]*\))', rest):
                it = it.strip(); d = md_date(it, year, base, future_bias=('종료' in it))
                items.append({'text': it, 'date': d})
            cdate = md_date(ctx, year, base) if ctx else None
            feats.append({'urls': [], 'vendor': vendor, 'context': ctx, 'contextDate': cdate, 'items': items})
    data['features'] = feats
    # 5. 반응
    reacts = []
    k = find('반응', '크리에이터')
    if k:
        for l in secs[k]:
            sm = re.match(r'^\s*출처\s*[:：]\s*(.+)$', l)
            if sm and reacts: reacts[-1]['urls'] += split_src(sm.group(1))[1]; continue
            mm = re.match(r'^\s*[-*]\s*(.+?)\s*\(([^)]+)\)\s*[:：]\s*(.+)$', l)
            if not mm: continue
            model, who, rest = mm.groups()
            sraw, _, body = rest.partition('—')
            sraw = sraw.strip(); s = next((v for kk, v in SENT if sraw.startswith(kk)), 'unknown')
            mid, sc = match_model(model, models)
            if mid is None or sc < 1: WARN.append(f'반응 모델 매칭 {"실패" if mid is None else "부분"}: "{model}" → {mid} ({sc})')
            parts = [p.strip() for p in re.split(r',\s*', body.strip()) if p.strip()]
            reacts.append({'urls': [], 'model': model.strip(), 'modelId': mid, 'matchScore': sc, 'creator': who.strip(), 'sentimentRaw': sraw, 'sentiment': s,
                           'text': body.strip(), 'parts': parts})
    data['reactions'] = reacts
    # 불확실성 메모: 원문에서 미확인/추정/미공개 등 표기 줄
    data['uncertainLines'] = [split_src(l.strip())[0] if not l.strip().startswith('|') else URL_RE.sub('', l.strip()) for l in lines if re.search(r'미확인|추정|미공개|조건부|한시|도입가|약 \d', l) and l.strip().startswith(('|', '-'))]
    # 공용 저장소 /workspace/data/ai 상태 (등급 데이터가 생기면 대시보드가 읽도록 확장 예정)
    store = '/workspace/data/ai'
    st = {'path': store, 'exists': os.path.isdir(store), 'graded': False, 'files': []}
    if st['exists']:
        for f in sorted(glob.glob(store + '/**/*.json', recursive=True)):
            try:
                j = json.load(open(f, encoding='utf-8')); txt = json.dumps(j, ensure_ascii=False)
                st['files'].append({'file': os.path.relpath(f, store), 'hasGrade': '"grade"' in txt, 'hasCollectedAt': '"collected_at"' in txt})
            except Exception as e: st['files'].append({'file': os.path.relpath(f, store), 'error': str(e)})
        st['graded'] = bool(st['files']) and all(x.get('hasGrade') and x.get('hasCollectedAt') for x in st['files'])
    data['store'] = st
    data['warnings'] = WARN
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{path} → {os.path.normpath(OUT)}: models {len(models)}, plans {len(plans)}, discounts {len(disc)}, features {len(feats)}, reactions {len(reacts)}, warnings {len(WARN)}')
    for w in WARN: print('  ⚠', w)

if __name__ == '__main__': main()
