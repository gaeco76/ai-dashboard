#!/usr/bin/env bash
# 데이터 스냅샷 갱신: /workspace 원본(읽기 전용) → ./data/*.json → dist 오프라인 파일
#   원본: /workspace/ai-model-research/*.md (최신), /workspace/data/ai/**/*_YYYYMMDD.json (최신, 등급), /workspace/data/ai/x/x_ai_*_YYYYMMDD.json
#   GitHub Pages는 /workspace를 읽을 수 없으므로 이 스냅샷(data/)이 공개 사이트의 데이터입니다.
# 사용: tools/sync_data.sh          (로컬 갱신만)
#       tools/sync_data.sh --push   (변경 시 커밋·푸시 → Pages 자동 재배포)
set -euo pipefail; cd "$(dirname "$0")/.."
bash tools/refresh.sh
python3 - <<'PY'
import json, hashlib, os, datetime as dt
fs = sorted(f for f in os.listdir('data') if f.endswith('.json') and f != 'SNAPSHOT.json')
for f in fs: json.load(open('data/' + f, encoding='utf-8'))  # JSON 검증
st = json.load(open('data/store.json', encoding='utf-8'))
snap = {'synced_at': dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec='seconds'),
        'verification': st.get('verification', {}).get('label'), 'store_files': st.get('files'),
        'md5': {f: hashlib.md5(open('data/' + f, 'rb').read()).hexdigest() for f in fs}}
json.dump(snap, open('data/SNAPSHOT.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('snapshot', snap['synced_at'], '|', snap['verification'], '|', ', '.join(fs))
PY
if [[ "${1:-}" == "--push" ]]; then
  git add data dist
  if git diff --cached --quiet; then echo "변경 없음 — 푸시 생략"; else
    git -c user.name=gaeco76 -c user.email=gaeco76@users.noreply.github.com commit -qm "데이터 스냅샷 갱신 $(date '+%Y-%m-%d %H:%M KST')" && git push -q origin main && echo "푸시 완료"; fi
fi
