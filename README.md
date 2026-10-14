# AI 모델 비교 대시보드

AI 모델 비교 정적 대시보드입니다. 탭 2개: **모델 비교**(공용 저장소 등급 데이터 우선 + 리서치 md 보조), **X 화제**(X 게시글 화제·주장 판정).

공개 주소: https://gaeco76.github.io/ai-dashboard/ (X 탭: `#x`) 스타일은 Artificial Analysis 풍이고, ECharts·테마·배지 스타일은 kpop-dashboard에서 가져왔습니다.

- 새 리서치 파일 반영: `tools/refresh.sh` (가장 최신 날짜의 .md → `data/data.json` → `dist/ai-dashboard-offline.html`)
  - 특정 파일 지정: `tools/refresh.sh /path/2026-10-11.md`
- 로컬에서 보기: `/workspace`에서 `python3 -m http.server 8765` 실행 후 http://127.0.0.1:8765/ai-dashboard/ 접속. 또는 `dist/ai-dashboard-offline.html`을 바로 열면 됩니다(데이터 내장).
- 점검: `/workspace/.venv-pw/bin/python tools/shoot.py` (JS 오류 확인과 데스크톱·모바일·라이트 스크린샷), `tools/check_offline.py` (오프라인 파일을 네트워크 차단 상태로 확인), `tools/sections.py` (섹션별 스크린샷)
- 오늘 날짜를 바꿔 D-day 테스트: `?today=2026-10-08`
- 숫자는 원문에서 추출한 값만 씁니다. 3:1 혼합가와 지수÷가격은 대시보드가 계산한 파생값이며 화면에도 그렇게 표기합니다.

## 데이터 소스
- `data/store.json` ← 공용 저장소 `/workspace/data/ai/` 등급 파일(지수·API 가격·프로모션·모델 이벤트·X 주장 판정, 종류별 최신 `*_YYYYMMDD.json`) — `tools/parse_store.py`
- `data/data.json` ← 리서치 md (요금제·크리에이터 반응·문맥·가중치 등 저장소에 없는 필드, 저장소가 없을 때 전체 폴백) — `tools/parse_md.py`
- `data/x.json` ← `/workspace/data/ai/x/x_ai_posts_*.json` + `x_ai_claims_verification_*.json` — `tools/parse_x.py`
- 등급 배지: 확정·부분·개략·충돌·미확·추정 (kpop-dashboard와 동일 색). 저장소에 없는 md 값은 `md` 태그. 섹션 제목에 출처 표시.
- X 게시글은 모두 미확 — 확정 판정된 주장만 출처와 함께 사실로 표시.

## 공개 사이트(GitHub Pages) 갱신
Pages는 `/workspace`를 읽을 수 없으므로 `data/`가 스냅샷입니다(`data/SNAPSHOT.json`에 동기화 시각·md5).
- `tools/sync_data.sh` — 원본에서 data/·dist 재생성
- `tools/sync_data.sh --push` — 변경 시 커밋·푸시 → Pages 자동 재배포 (원본 갱신 후 실행)
