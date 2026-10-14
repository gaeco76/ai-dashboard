#!/usr/bin/env bash
# 새 리서치 파일 반영: 최신 md → data/data.json, 최신 X 게시글 → data/x.json, 오프라인 단일 파일 재생성
set -e; cd "$(dirname "$0")/.."
python3 tools/parse_md.py "$@"
python3 tools/parse_store.py   # 최신 /workspace/data/ai/*_YYYYMMDD.json (등급) → data/store.json
python3 tools/parse_x.py   # 최신 /workspace/data/ai/x/x_ai_posts_*.json → data/x.json
python3 tools/build_offline.py
