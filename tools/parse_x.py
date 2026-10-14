#!/usr/bin/env python3
"""X 화제 게시글 → data/x.json
사용: python3 tools/parse_x.py [파일.json]  (생략 시 /workspace/data/ai/x/x_ai_posts_*.json 중 최신 날짜)
원본은 읽기만 한다. 시간은 UTC → KST 변환. 주제는 원문 텍스트 키워드 규칙으로 분류(복수 소속 가능, 첫 매칭 = 대표 주제)."""
import re, json, sys, glob, os, html, statistics as stt, datetime as dt
SRC = '/workspace/data/ai/x'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'x.json')
KST = dt.timezone(dt.timedelta(hours=9))
MODELS = ['Claude', 'GPT', 'Grok', 'Gemini', 'Muse', 'Qwen', 'GLM', 'DeepSeek']
EXPECTED = {'Claude': 23, 'Grok': 23, 'GPT': 22, 'Gemini': 19, 'Qwen': 13, 'DeepSeek': 13, 'Muse': 9, 'GLM': 8}
# (id, 이름, 설명, 정규식) — 순서 = 우선순위
TOPICS = [
  ('ultra', 'Gemini 4 Argon 요금제 제한 논란', 'Ultra 전용·유료 API 단계 등 접근 제한에 대한 불만/언급', r'Ultra|exclusive|paid API tier|\$20/month|Pro users'),
  ('argon', 'Gemini 4 Argon 출시·사용기', 'Argon 출시·공개·성능 언급', r'Argon|Gemini 4\b'),
  ('rank', '모델 목록·순위·벤치마크', '“올해 출시 모델”, 파워 랭킹, 리더보드, 출시 예상 목록', r'leaderboard|[Rr]anking|benchmark|Benchmark|Elo|launched in 2026|출시될|Latest models|鄙视链|Closed AI has|February:|顶尖|발표|अमेरिका|Mercadona'),
  ('multi', '멀티모델 구독·라우팅·에이전트 플랫폼', '여러 모델을 한 곳에서 쓰는 앱·구독, 서드파티 모델 접근', r'one chat|Credits|[Ss]ubscription|구독|nine models|models, from|Devin|agent window|wallet|Gateway|Copilot|Perplexity'),
  ('coding', '코딩 에이전트 (Claude Code·Codex)', '코딩·바이브코딩·모델 간 협업/대결', r'(?i:claude code)|(?<![-\w])[Cc]odex(?![-\w])|vibe cod|Game Jam|duck|Opus-5'),
  ('news', '뉴스 요약·오픈 모델 배포', '일간 AI 뉴스 요약, 오픈 가중치·로컬 실행·토렌트', r'FACTS|FAKTÓW|torrents|offline|GGUF|Qwen-Image'),
  ('askgrok', '@grok 질문 (봇 호출)', '@grok 태그로 질문·요청하는 일상 게시글 — 모델 평가 아님', r'(?i)@grok\b'),
]
def latest():
    fs = [f for f in glob.glob(os.path.join(SRC, 'x_ai_posts_*.json')) if re.search(r'\d{8}', f)]
    if not fs: sys.exit('no x_ai_posts_*.json in ' + SRC)
    return max(fs, key=lambda f: re.search(r'(\d{8})', os.path.basename(f)).group(1))
def main():
    path = sys.argv[1] if len(sys.argv) > 1 else latest()
    raw = json.load(open(path, encoding='utf-8'))
    posts = raw['posts'] if isinstance(raw, dict) else raw
    out = []
    for p in posts:
        t = dt.datetime.fromisoformat(p['created_at'].replace('Z', '+00:00'))
        k = t.astimezone(KST); txt = html.unescape(p.get('text') or '')  # X 원문의 &amp; 등 엔티티 복원
        tops = [tid for tid, _, _, rx in TOPICS if re.search(rx, txt)]
        eng = (p.get('likes') or 0) + (p.get('reposts') or 0) * 2 + (p.get('replies') or 0)
        out.append({**{x: p.get(x) for x in ('id', 'search', 'author', 'url', 'text', 'models', 'likes', 'reposts', 'replies', 'views', 'grade', 'note', 'collected_at', 'source_url')}, 'text': txt,
                    'created_utc': p['created_at'], 'kst': k.strftime('%Y-%m-%d %H:%M'), 'kstHour': k.strftime('%Y-%m-%d %H:00'),
                    'topics': tops or ['other'], 'topic': (tops or ['other'])[0], 'eng': eng})
    cnt = {m: sum(m in (p['models'] or []) for p in out) for m in MODELS}
    check = [{'model': m, 'file': cnt[m], 'expected': EXPECTED.get(m), 'ok': cnt[m] == EXPECTED.get(m)} for m in MODELS]
    pop = [p for p in out if p['search'] == 'popular']
    fd = re.search(r'(\d{4})(\d{2})(\d{2})', os.path.basename(path))
    data = {'sourceFile': os.path.basename(path), 'sourcePath': path, 'collectedAt': '-'.join(fd.groups()) if fd else None,
            'generatedAt': dt.datetime.now(KST).isoformat(timespec='seconds'), 'models': MODELS, 'posts': out,
            'topics': [{'id': a, 'name': b, 'desc': c} for a, b, c, _ in TOPICS] + [{'id': 'other', 'name': '기타·무관', 'desc': '규칙에 안 걸린 게시글(모델명 오탐 포함 가능)'}],
            'countCheck': check, 'grades': sorted({p['grade'] for p in out}),
            'popularFilter': {'stated': 'likes ≥ 500', 'popularPosts': len(pop), 'meeting': sum((p['likes'] or 0) >= 500 for p in pop), 'maxLikes': max([p['likes'] or 0 for p in out] or [0])},
            'range': [min(p['kst'] for p in out), max(p['kst'] for p in out)] if out else None}
    # 주장 판정 파일 (같은 폴더 최신 x_ai_claims_verification_*.json)
    cfs = [f for f in glob.glob(os.path.join(SRC, 'x_ai_claims_verification_*.json')) if re.search(r'\d{8}', f)]
    cf = max(cfs, key=lambda f: re.search(r'(\d{8})', os.path.basename(f)).group(1)) if cfs else None
    claims, cnote = [], ''
    if cf:
        cj = json.load(open(cf, encoding='utf-8')); claims = cj.get('claims', []) if isinstance(cj, dict) else cj; cnote = cj.get('note', '') if isinstance(cj, dict) else ''
        ids = {p['id']: p for p in out}
        for i, c in enumerate(claims):
            c['idx'] = i; c['linkedPosts'] = [c['post_id']] if c.get('post_id') in ids else []
            if c.get('post_id') in ids: ids[c['post_id']].setdefault('claims', []).append(i)
            else: print('  ⚠ 판정 대상 게시글이 게시글 파일에 없음:', c.get('post_id'), c.get('subject'))
    data['claimsFile'] = os.path.relpath(cf, '/workspace/data') if cf else None
    data['claimsNote'] = cnote; data['claims'] = claims
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{path} → {os.path.normpath(OUT)}: posts {len(out)}, claims {len(claims)} ({data["claimsFile"]}), range {data["range"]} KST')
    for c in check: print(f"  {c['model']:8} {c['file']:3} (예상 {c['expected']}) {'OK' if c['ok'] else '불일치'}")
    from collections import Counter
    print('  topics(primary):', Counter(p['topic'] for p in out)); print('  topics(any):', Counter(t for p in out for t in p['topics']))
if __name__ == '__main__': main()
