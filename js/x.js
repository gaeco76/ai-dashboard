/* ===== X 화제 탭: data/x.json (tools/parse_x.py ← /workspace/data/ai/x/x_ai_posts_*.json) ===== */
const XM_COLOR = { Claude: '#d4a27f', GPT: '#10a37f', Grok: '#94a3b8', Gemini: '#4285f4', Muse: '#a78bfa', Qwen: '#facc15', GLM: '#22d3ee', DeepSeek: '#7c6cff' };
const XS = { minLikes: 0, search: 'all', engM: 'likesSum', tlM: 'likes', loaded: false, data: null };
const xMed = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const xPosts = () => XS.data.posts.filter(p => (p.likes || 0) >= XS.minLikes && (XS.search === 'all' || p.search === XS.search));
const xBadge = g => `<span class="badge b-unverified" title="등급 ${esc(g)}: 검증되지 않은 게시글 원문 — 글 속 출시·순위 주장은 사실 확인 전">${esc(g || '미확')}</span>`;
const xChip = m => `<span class="xchip" style="--c:${XM_COLOR[m] || '#888'}">${esc(m)}</span>`;
const xExcerpt = (t, n = 140) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const xTopic = id => XS.data.topics.find(t => t.id === id) || { name: id };
const xFmtK = v => !isNum(v) ? '—' : v >= 1e4 ? (+(v / 1e3).toFixed(1)) + 'K' : nf.format(v);

/* 주장 판정: grade(확정/부분/충돌/미확…) + value(주장이 맞는지) → 문구. 확정만 사실로, 나머지는 '화제' 프레이밍 유지 */
const xVerdict = c => {
  const g = c.grade, ok = c.value === true;
  const txt = g === '확정' ? (ok ? '사실로 확인' : '사실 아님 (확인)') : g === '충돌' ? '출처와 어긋남' : g === '부분' ? '일부만 확인' : g === '개략' ? '대체로 맞음' : g === '추정' ? '추정' : '확인 안 됨 — 화제일 뿐';
  return { g, txt, ok, cls: GRADE_KEY[g] || 'unverified' };
};
const xClaimBadge = (c, full = false) => { const v = xVerdict(c);
  return `<span class="gb g-${v.cls} ${full ? '' : 'sm'}" title="${esc(c.subject)} — ${esc(v.txt)}${c.note ? ' · ' + esc(c.note) : ''} · 판정 ${esc(c.collected_at || '')}">${esc(v.g)}${full ? ' · ' + esc(v.txt) : ''}</span>`; };
const xClaimsOf = p => (p.claims || []).map(i => XS.data.claims[i]).filter(Boolean);
async function xLoad() {
  if (XS.loaded) return XS.data;
  if (window.AID_X_EMBED) XS.data = window.AID_X_EMBED;
  else { const r = await fetch('data/x.json', { cache: 'no-cache' }); if (!r.ok) throw new Error('data/x.json ' + r.status); XS.data = await r.json(); }
  XS.loaded = true; return XS.data;
}
function xRender() {
  const D = XS.data, el = $('#xapp'), pf = D.popularFilter || {};
  const allOk = D.countCheck.every(c => c.ok);
  el.innerHTML = `
  <div class="page-head"><div><h1>X 화제 <span class="badge b-unverified">전부 미확</span></h1>
    <p>수집일 <b>${esc(D.collectedAt)}</b> · 원본 <code>${esc(D.sourcePath)}</code> · 게시 시각 ${esc(D.range?.[0])} ~ ${esc(D.range?.[1])} (KST, UTC+9 변환) · 게시글 ${D.posts.length}개 (인기+최신 검색 병합·중복 제거)</p></div></div>
  <div class="xbanner" role="note"><b>⚠ 화제 = 사람들이 하는 말이지 사실이 아닙니다.</b> 모든 게시글 등급이 <b>${D.grades.map(esc).join(', ')}</b>입니다. 글 속 모델 출시·순위·성능·가격 주장은 검증되지 않았으며, 이 탭은 그것을 "무엇이 화제인가"로만 보여 줍니다. 확인된 수치는 ‘모델 비교’ 탭을 보세요.${D.claims?.length ? ` 단, 아래 <b>주장 판정</b>(${esc(D.claimsFile)})에서 <span class="gb g-verified sm">확정</span>으로 판정된 주장만 출처와 함께 사실로 표시합니다. 게시글 자체의 등급은 그대로 미확입니다.` : ''}</div>
  <div class="xbanner warn" role="note"><b>⚠ 인기 검색 필터 미적용.</b> 인기(popular) 검색의 조건 <code>${esc(pf.stated || 'likes ≥ 500')}</code>이 지켜지지 않아 인기 ${pf.popularPosts}개 중 조건 충족 <b>${pf.meeting}개</b>, 전체 최대 좋아요 <b>${pf.maxLikes}</b>. 반응 적은 게시글이 섞여 있습니다 — 아래 최소 좋아요 필터로 거를 수 있습니다.</div>
  <div class="xctl card"><span class="accbar-label">최소 좋아요</span>${seg('xMin', [['0', '전체'], ['1', '≥1'], ['5', '≥5'], ['50', '≥50']], String(XS.minLikes))}
    <span class="accbar-label">검색 출처</span>${seg('xSrc', [['all', '전체'], ['popular', '인기'], ['latest', '최신']], XS.search)}
    <span class="muted small" id="xCount"></span></div>
  <div class="grid g4" id="xKpi"></div>
  <section class="sec" id="x-models"><h2 class="sec">모델별 언급 · 참여도</h2><div class="grid g2">
    ${card({ title: '모델 언급 수', sub: '게시글당 복수 모델 가능 · 수집 측 models 태그 기준(오탐 포함 가능)', body: chartDiv('xMent', 'h420') })}
    ${card({ title: '모델별 참여도', sub: '해당 모델을 언급한 게시글의 합계/중앙값', tools: seg('xEng', [['likesSum', '좋아요 합'], ['likesMed', '좋아요 중앙'], ['viewsSum', '조회 합'], ['viewsMed', '조회 중앙']], XS.engM), body: chartDiv('xEngC', 'h420') })}
  </div></section>
  <section class="sec" id="x-time"><h2 class="sec">시간대별 게시글 · 참여도 (KST, 1시간 단위)</h2>
    ${card({ title: '시간대별 게시글 수와 참여도', sub: '막대 = 게시글 수(모델 무관) · 선 = 그 시간 게시글의 합계', tools: seg('xTl', [['likes', '좋아요'], ['views', '조회']], XS.tlM), body: chartDiv('xTime', 'h360'), foot: '최신(latest) 검색 게시글은 수집 직전(10/14 05시대 KST)에 몰려 있어 마지막 구간이 튑니다 — 화제 증가가 아니라 수집 방식 영향.' })}</section>
  ${D.claims?.length ? `<section class="sec" id="x-claims"><h2 class="sec">주장 판정 <span class="srctag st-store">출처: 공용 저장소</span></h2>
    <div class="muted small" style="margin-bottom:8px">게시글 속 모델 출시·가격·순위 주장을 비서실장 확인 저장소 파일(<code>${esc(D.claimsFile)}</code>)이 판정한 결과. ${esc(D.claimsNote)}</div>
    <div class="grid g4" id="xClaimKpi" style="margin-bottom:10px"></div><div class="card" id="xClaims"></div></section>` : ''}
  <section class="sec" id="x-topics"><h2 class="sec">주요 화제 (원문 키워드 분류)</h2>
    <div class="muted small" style="margin-bottom:8px">게시글 텍스트의 키워드 규칙으로 분류(<code>tools/parse_x.py</code> TOPICS). 대표 주제 = 첫 번째로 맞은 규칙, 한 게시글이 여러 주제에 걸릴 수 있음. 예시 링크는 참여도순.</div>
    <div class="grid g2" style="margin-bottom:12px">${card({ title: '화제별 게시글 수', sub: '진한 막대 = 대표 주제 · 연한 막대 = 해당 주제 언급 포함', body: chartDiv('xTop', 'h360') })}<div id="xTopCards" class="xtopcards"></div></div></section>
  <section class="sec" id="x-posts"><h2 class="sec">참여도 상위 게시글</h2><div class="card" id="xTable"></div>
    <div class="muted small" style="margin-top:6px">참여도 = 좋아요 + 리포스트×2 + 답글 (대시보드 파생값). 모든 행 등급 미확.</div></section>
  <section class="sec" id="x-notes"><h2 class="sec">데이터 메모</h2><div class="grid g2">
    ${card({ title: '모델 언급 수 검증', sub: '파일 집계 vs 요청서 예상값', body: `<table class="dt"><thead><tr><th>모델</th><th class="num">파일</th><th class="num">예상</th><th>결과</th></tr></thead><tbody>${D.countCheck.map(c => `<tr><td>${xChip(c.model)}</td><td class="num">${c.file}</td><td class="num">${c.expected ?? '—'}</td><td>${c.ok ? '✓ 일치' : '<b style="color:#f87171">불일치</b>'}</td></tr>`).join('')}</tbody></table><div class="small muted" style="margin-top:6px">${allOk ? '8개 모델 모두 일치.' : '불일치 있음.'} 집계는 필터와 무관하게 전체 ${D.posts.length}개 기준.</div>` })}
    ${card({ title: '출처 · 한계', body: `<ul class="notes"><li>원본: <code>${esc(D.sourcePath)}</code> (읽기 전용) → <code>data/x.json</code> · 파싱 ${esc(String(D.generatedAt).replace('T', ' ').slice(0, 16))} KST</li>
      <li>models 태그는 수집 측 문자열 매칭이라 오탐이 있습니다 (예: “Food is the ultimate muse”가 Muse로, ‘@grok’ 봇 호출 질문이 Grok으로 집계).</li>
      <li>@grok 호출 게시글은 Grok 모델에 대한 평가가 아니라 봇에게 묻는 일상 글입니다 — ‘@grok 질문’ 주제로 분리.</li>
      <li>게시 시각은 UTC를 KST(UTC+9)로 변환. 참여도 수치는 수집 시점 스냅샷.</li>
      <li>갱신: <code>tools/refresh.sh</code>가 최신 <code>x_ai_posts_*.json</code>을 자동 선택합니다.</li></ul>` })}
  </div></section>`;
  bindSeg('xMin', v => { XS.minLikes = +v; xDraw(); });
  bindSeg('xSrc', v => { XS.search = v; xDraw(); });
  bindSeg('xEng', v => { XS.engM = v; xDrawEng(); });
  bindSeg('xTl', v => { XS.tlM = v; xDrawTime(); });
  xDraw();
}
function xDraw() {
  const P = xPosts(), D = XS.data;
  $('#xCount').textContent = `표시 ${P.length} / ${D.posts.length}개`;
  const sum = k => P.reduce((a, p) => a + (p[k] || 0), 0);
  const kpi = (l, v, d) => `<div class="card kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="desc">${d}</div></div>`;
  const top = [...P].sort((a, b) => b.eng - a.eng)[0];
  $('#xKpi').innerHTML = kpi('게시글', P.length + '개', `인기 ${P.filter(p => p.search === 'popular').length} · 최신 ${P.filter(p => p.search === 'latest').length}`)
    + kpi('좋아요 합', nf.format(sum('likes')), `중앙값 ${xMed(P.map(p => p.likes || 0)) ?? '—'} · 리포스트 ${nf.format(sum('reposts'))}`)
    + kpi('조회 합', xFmtK(sum('views')), `중앙값 ${nf.format(xMed(P.map(p => p.views || 0)) ?? 0)}`)
    + kpi('참여도 1위', top ? '@' + esc(top.author) : '—', top ? `좋아요 ${top.likes} · 조회 ${xFmtK(top.views)} ${xBadge(top.grade)}` : '');
  xDrawMent(); xDrawEng(); xDrawTime(); xDrawClaims(); xDrawTopics(); xDrawTable();
}
const xEmpty = id => { const e = document.getElementById(id); const c = echarts.getInstanceByDom(e); c && c.dispose(); e.innerHTML = '<div class="hidden-note">필터에 맞는 게시글이 없습니다.</div>'; };
function xStats() {
  const P = xPosts();
  return XS.data.models.map(m => { const ps = P.filter(p => (p.models || []).includes(m));
    return { m, n: ps.length, likesSum: ps.reduce((a, p) => a + (p.likes || 0), 0), likesMed: xMed(ps.map(p => p.likes || 0)) ?? 0, viewsSum: ps.reduce((a, p) => a + (p.views || 0), 0), viewsMed: xMed(ps.map(p => p.views || 0)) ?? 0 }; });
}
function xDrawMent() {
  const S = xStats().sort((a, b) => b.n - a.n); if (!xPosts().length) return xEmpty('xMent');
  const c = themeColors();
  chart('xMent', { grid: { left: 6, right: 40, top: 6, bottom: 6, containLabel: true }, tooltip: { trigger: 'item', formatter: p => { const s = S[p.dataIndex]; return `<div class="t">${esc(s.m)} <span class="badge b-unverified">미확</span></div><div class="row"><span class="muted">언급 게시글</span><span>${s.n}</span></div><div class="row"><span class="muted">좋아요 합/중앙</span><span>${s.likesSum} / ${s.likesMed}</span></div><div class="row"><span class="muted">조회 합/중앙</span><span>${nf.format(s.viewsSum)} / ${nf.format(s.viewsMed)}</span></div>`; } },
    xAxis: axisStyle({ type: 'value', minInterval: 1 }), yAxis: axisStyle({ type: 'category', inverse: true, data: S.map(s => s.m), axisLabel: { color: c.text } }),
    series: [{ type: 'bar', barMaxWidth: 20, data: S.map(s => ({ value: s.n, itemStyle: { color: XM_COLOR[s.m], borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', color: c.text, fontWeight: 700 } }] });
}
function xDrawEng() {
  const S = xStats().sort((a, b) => b[XS.engM] - a[XS.engM]); if (!xPosts().length) return xEmpty('xEngC');
  const c = themeColors(), isV = XS.engM.startsWith('views');
  chart('xEngC', { grid: { left: 6, right: 50, top: 6, bottom: 6, containLabel: true }, tooltip: { trigger: 'item', formatter: p => { const s = S[p.dataIndex]; return `<div class="t">${esc(s.m)}</div><div>언급 ${s.n}개 · 좋아요 합 ${s.likesSum} (중앙 ${s.likesMed}) · 조회 합 ${nf.format(s.viewsSum)} (중앙 ${nf.format(s.viewsMed)})</div><div class="n">한두 게시글이 합계를 좌우합니다 — 중앙값도 확인하세요.</div>`; } },
    xAxis: axisStyle({ type: 'value', axisLabel: { color: c.muted, formatter: v => isV ? xFmtK(v) : v } }), yAxis: axisStyle({ type: 'category', inverse: true, data: S.map(s => s.m), axisLabel: { color: c.text } }),
    series: [{ type: 'bar', barMaxWidth: 20, data: S.map(s => ({ value: s[XS.engM], itemStyle: { color: XM_COLOR[s.m], opacity: XS.engM.endsWith('Med') ? .75 : 1, borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', color: c.muted, formatter: p => isV ? xFmtK(p.value) : p.value } }] });
}
function xDrawTime() {
  const P = xPosts(); if (!P.length) return xEmpty('xTime');
  const c = themeColors(), all = XS.data.posts.map(p => p.kstHour).sort();
  const h0 = Date.parse(all[0].replace(' ', 'T') + ':00+09:00'), h1 = Date.parse(all[all.length - 1].replace(' ', 'T') + ':00+09:00');
  const hours = []; for (let t = h0; t <= h1; t += 36e5) { const d = new Date(t + 9 * 36e5); hours.push(d.toISOString().slice(0, 13).replace('T', ' ') + ':00'); }
  const by = h => P.filter(p => p.kstHour === h);
  const lab = h => { const [d, t] = h.split(' '); return `${+d.slice(5, 7)}/${+d.slice(8, 10)} ${t.slice(0, 2)}시`; };
  chart('xTime', { legend: { data: ['게시글 수', XS.tlM === 'likes' ? '좋아요 합' : '조회 합'] }, grid: { left: 10, right: 10, top: 34, bottom: 10, containLabel: true },
    tooltip: { trigger: 'axis', formatter: ps => { const h = hours[ps[0].dataIndex], ps2 = by(h); return `<div class="t">${lab(h)} KST</div><div>게시글 ${ps2.length}개 · 좋아요 ${ps2.reduce((a, p) => a + (p.likes || 0), 0)} · 조회 ${nf.format(ps2.reduce((a, p) => a + (p.views || 0), 0))}</div>${ps2.slice(0, 4).map(p => `<div class="n">@${esc(p.author)}: ${esc(xExcerpt(p.text, 60))}</div>`).join('')}`; } },
    xAxis: axisStyle({ type: 'category', data: hours.map(lab), axisLabel: { color: c.muted, rotate: isMobile() ? 60 : 40, fontSize: 10 } }),
    yAxis: [axisStyle({ type: 'value', name: '게시글', minInterval: 1 }), axisStyle({ type: 'value', name: XS.tlM === 'likes' ? '좋아요' : '조회', splitLine: { show: false }, axisLabel: { color: c.muted, formatter: v => xFmtK(v) } })],
    series: [{ name: '게시글 수', type: 'bar', barMaxWidth: 22, itemStyle: { color: '#7c6cff', borderRadius: [3, 3, 0, 0] }, data: hours.map(h => by(h).length) },
      { name: XS.tlM === 'likes' ? '좋아요 합' : '조회 합', type: 'line', yAxisIndex: 1, smooth: false, symbolSize: 6, itemStyle: { color: '#f472b6' }, data: hours.map(h => by(h).reduce((a, p) => a + (p[XS.tlM] || 0), 0)) }] });
}
function xDrawClaims() {
  const C = XS.data.claims || []; if (!C.length || !$('#xClaims')) return;
  const vis = new Set(xPosts().map(p => p.id)), byId = new Map(XS.data.posts.map(p => [p.id, p]));
  const cnt = g => C.filter(c => c.grade === g).length;
  $('#xClaimKpi').innerHTML = ['확정', '부분', '충돌', '미확'].map(g => `<div class="card kpi"><div class="label">${gBadge({ grade: g })} 판정</div><div class="value">${cnt(g)}건</div><div class="desc">${g === '확정' ? '출처로 확인 — 사실로 표시' : g === '충돌' ? '출처와 어긋나는 주장' : g === '부분' ? '일부만 확인' : '확인 안 됨 — 화제로만'}</div></div>`).join('');
  const ord = { 충돌: 0, 확정: 1, 부분: 2, 개략: 3, 미확: 4, 추정: 5 };
  DataTable($('#xClaims'), [
    { k: 'subject', label: '주장', cls: 'wrap xtext', html: c => `<b>${esc(c.subject)}</b>${c.note ? `<span class="note">${esc(c.note)}</span>` : ''}` },
    { k: 'grade', label: '판정', val: c => ord[c.grade] ?? 9, html: c => xClaimBadge(c, true) },
    { k: 'value', label: '주장 성립', html: c => c.value === true ? '<span style="color:#22c55e">예</span>' : c.value === false ? '<span style="color:#f87171">아니오/불명</span>' : '—' },
    { k: 'src', label: '근거 출처', nosort: true, cls: 'wrap', html: c => srcLinks(c.source_url, '') || '<span class="nullval">없음</span>' },
    { k: 'posts', label: '연결 게시글', num: true, val: c => c.linkedPosts.length, html: c => `${c.linkedPosts.length}개 ` + c.linkedPosts.map(id => { const p = byId.get(id); return p ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="${vis.has(id) ? '' : 'muted'}" title="${vis.has(id) ? '' : '현재 필터에서 숨김 · '}${esc(xExcerpt(p.text, 80))}">↗ @${esc(p.author)}</a>` : ''; }).join(' ') + ' ' + xBadge('미확') },
  ], { rows: C, sort: { k: 'grade', dir: 'asc' }, search: ['subject', 'note', 'author'], maxH: 1400 });
}
function xDrawTopics() {
  const P = xPosts(), T = XS.data.topics;
  const rows = T.map(t => { const prim = P.filter(p => p.topic === t.id), any = P.filter(p => p.topics.includes(t.id));
    return { t, prim: prim.length, any: any.length, likes: any.reduce((a, p) => a + (p.likes || 0), 0), views: any.reduce((a, p) => a + (p.views || 0), 0), ex: [...any].sort((a, b) => b.eng - a.eng || b.views - a.views).slice(0, 3) }; })
    .filter(r => r.any).sort((a, b) => (a.t.id === 'other') - (b.t.id === 'other') || b.prim - a.prim || b.any - a.any);
  if (!rows.length) { xEmpty('xTop'); $('#xTopCards').innerHTML = ''; return; }
  const c = themeColors();
  chart('xTop', { legend: { data: ['대표 주제', '언급 포함'] }, grid: { left: 6, right: 30, top: 30, bottom: 6, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: axisStyle({ type: 'value', minInterval: 1 }), yAxis: axisStyle({ type: 'category', inverse: true, data: rows.map(r => r.t.name), axisLabel: { color: c.text, width: isMobile() ? 120 : 210, overflow: 'truncate', fontSize: 11 } }),
    series: [{ name: '대표 주제', type: 'bar', barGap: '-100%', z: 3, barMaxWidth: 16, itemStyle: { color: '#7c6cff' }, data: rows.map(r => r.prim), label: { show: true, position: 'insideRight', color: '#fff', fontSize: 10 } },
      { name: '언급 포함', type: 'bar', z: 2, barMaxWidth: 16, itemStyle: { color: 'rgba(124,108,255,.3)' }, data: rows.map(r => r.any), label: { show: true, position: 'right', color: c.muted, fontSize: 10 } }] });
  $('#xTopCards').innerHTML = rows.map(r => `<div class="xtc"><div class="xtc-h"><b>${esc(r.t.name)}</b><span class="muted small">대표 ${r.prim} · 포함 ${r.any} · 좋아요 ${r.likes} · 조회 ${xFmtK(r.views)}</span></div><div class="small muted">${esc(r.t.desc)}</div>
    <ul>${r.ex.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">↗ @${esc(p.author)}</a> <span class="muted">${esc(p.kst.slice(5))} · ♥${p.likes} · 👁${xFmtK(p.views)}</span> ${xBadge(p.grade)}${xClaimsOf(p).map(c => xClaimBadge(c)).join('')}<br><span class="small">${esc(xExcerpt(p.text, 110))}</span></li>`).join('')}</ul></div>`).join('');
}
function xDrawTable() {
  const ranked = [...xPosts()].sort((a, b) => b.eng - a.eng || b.views - a.views); const rk = new Map(ranked.map((p, i) => [p.id, i + 1]));
  DataTable($('#xTable'), [
    { k: 'rk', label: '#', num: true, val: p => rk.get(p.id) },
    { k: 'author', label: '작성자', html: p => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><b>@${esc(p.author)}</b></a><span class="note">${p.search === 'popular' ? '인기' : '최신'} 검색</span>` },
    { k: 'kst', label: '게시 (KST)', html: p => `<span title="UTC ${esc(p.created_utc)}">${esc(p.kst.slice(5))}</span>` },
    { k: 'text', label: '내용 (발췌)', nosort: true, cls: 'wrap xtext', html: p => `<span title="${esc(p.text)}">${esc(xExcerpt(p.text))}</span><span class="note">${p.topics.map(t => esc(xTopic(t).name)).join(' · ')}</span>` },
    { k: 'models', label: '언급 모델', nosort: true, cls: 'wrap', html: p => (p.models || []).map(xChip).join('') || '<span class="nullval">—</span>' },
    { k: 'likes', label: '좋아요', num: true }, { k: 'reposts', label: '리포스트', num: true }, { k: 'replies', label: '답글', num: true },
    { k: 'views', label: '조회', num: true, html: p => fmtN(p.views) },
    { k: 'eng', label: '참여도', num: true, title: '좋아요 + 리포스트×2 + 답글' },
    { k: 'grade', label: '게시글 등급', html: p => xBadge(p.grade) },
    { k: 'claims', label: '주장 판정', cls: 'wrap', val: p => (p.claims || []).length || null, html: p => xClaimsOf(p).map(c => `<div class="xcl">${xClaimBadge(c)} <span class="small">${esc(xExcerpt(c.subject, 46))}</span>${c.grade === '확정' ? srcLinks(c.source_url, '근거') : ''}</div>`).join('') || '<span class="nullval" title="출시·가격 주장이 없어 판정 대상 아님">판정 대상 아님</span>' },
    { k: 'url', label: '링크', nosort: true, cls: 'nowrap', html: p => `<a href="${esc(p.url)}" target="_blank" rel="noopener">↗ 원문</a>` },
  ], { rows: () => xPosts(), sort: { k: 'rk', dir: 'asc' }, search: ['author', 'text', p => (p.models || []).join(' ')], maxH: 2400 });
}
/* ---------- 상단 탭 ---------- */
function xSetTab(t, push = true) {
  const isX = t === 'x';
  $$('#toptabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  ['#secnav', '#filterbar', '#app'].forEach(s => { const e = $(s); if (e) e.hidden = isX; });
  $('#xapp').hidden = !isX;
  if (push) history.replaceState(null, '', isX ? '#x' : location.pathname + location.search);
  if (isX) {
    if (!XS.loaded) xLoad().then(xRender).catch(e => { $('#xapp').innerHTML = `<div class="error">X 데이터를 불러오지 못했습니다 (${esc(e.message)}). <code>python3 tools/parse_x.py</code> 실행 후 다시 여세요.</div>`; });
    else setTimeout(resizeVisible, 30);
  } else setTimeout(resizeVisible, 30);
  window.scrollTo(0, 0);
}
(function xInit() {
  $('#toptabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) xSetTab(b.dataset.t); });
  const want = location.hash === '#x' || new URLSearchParams(location.search).get('tab') === 'x';
  if (want) xSetTab('x', false);
  $('#themeBtn').addEventListener('click', () => { if (XS.loaded && !$('#xapp').hidden) setTimeout(xRender, 0); });
})();
window.addEventListener('hashchange', () => { if (location.hash === '#x') xSetTab('x', false); else if (!location.hash.startsWith('#s-') && !$('#xapp').hidden) xSetTab('main', false); });
