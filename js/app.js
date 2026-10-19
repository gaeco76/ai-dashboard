/* ===== AI 모델 비교 대시보드 ===== */
let DATA = null;
const ST = { w: 'all', vOff: new Set(), px: 'blend31', plog: true, slog: true };
const VCOLOR = { Anthropic: '#d4a27f', OpenAI: '#10a37f', Google: '#4285f4', Meta: '#a78bfa', xAI: '#94a3b8', Xiaomi: '#ff6900', Alibaba: '#facc15', 'Z.ai': '#22d3ee', Moonshot: '#f472b6', DeepSeek: '#7c6cff', MiniMax: '#ef4444' };
const vc = v => VCOLOR[v] || PAL[Object.keys(VCOLOR).length % PAL.length];
const W_LABEL = { open: '오픈 가중치', conditional: '조건부 공개', closed: '비공개', unknown: '미분류' };
const W_SYM = { open: 'diamond', conditional: 'triangle', closed: 'circle', unknown: 'rect' };
const W_MARK = { open: '◆', conditional: '▲', closed: '●', unknown: '■' };
const SENT_LABEL = { pos: '긍정', mostly_pos: '대체로 긍정', neg: '부정', mostly_neg: '대체로 부정', mixed: '혼합', unknown: '미분류' };
const usd = v => isNum(v) ? '$' + (v < 1 ? String(+v.toFixed(3)) : (Number.isInteger(v) ? v : +v.toFixed(2))) : '—';
const usdM = v => isNum(v) ? '$' + (Number.isInteger(v) ? nf.format(v) : v.toFixed(2)) : '—';
const ctxFmt = t => !isNum(t) ? '—' : t >= 1e6 ? (+(t / 1e6).toFixed(2)) + 'M' : (t / 1e3) + 'K';
const fmtDate = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return (y !== TODAY.slice(0, 4) ? `${y}/` : '') + `${+m}/${+d}`; };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
/* 행별 출처 URL → 클릭 가능한 칩 (도메인 표시, 전체 URL은 title) */
const srcLinks = (urls, lbl = '출처') => (urls && urls.length) ? `<span class="srcs"><span class="muted">${lbl}</span>${urls.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">↗ ${esc(host(u))}</a>`).join('')}</span>` : '';
const wBadge = w => `<span class="badge b-${w.kind === 'open' ? 'open' : w.kind === 'conditional' ? 'cond' : 'closed'}" title="원문: ${esc(w.raw)}">${W_MARK[w.kind]} ${esc(w.raw)}</span>`;
function priceBadge(p) {
  const b = [];
  if (p.kind === 'intro') b.push(`<span class="badge b-estimate" title="한시 도입가">도입가(한시)</span>`);
  if (p.kind === 'offpeak') b.push(`<span class="badge b-offpeak" title="시간대 할인가">오프피크가</span>`);
  if (p.label && p.kind === 'list') b.push(`<span class="badge b-tier" title="원문 대표가 표기">${esc(p.label)}가</span>`);
  p.alt.forEach(a => b.push(`<span class="badge ${a.kind === 'tier' ? 'b-tier' : a.kind === 'offpeak' ? 'b-offpeak' : 'b-change'}" ${a.fromNote ? 'title="표 아래 메모에서 추출"' : ''}>${esc(a.label || '대체')} ${usd(a.in)} / ${usd(a.out)}${a.fromNote ? '*' : ''}</span>`));
  return b.join(' ');
}
/* ---------- 오늘(KST) · D-day ---------- */
const TODAY = (new URLSearchParams(location.search).get('today')) || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const dayDiff = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(TODAY + 'T00:00:00Z')) / 864e5);
const ddTxt = n => n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`;
const urg = n => n == null ? 'u-none' : n < 0 ? 'u-none' : n <= 3 ? 'u-hot' : n <= 14 ? 'u-warm' : 'u-ok';
function dealState(d) {
  if (d.kind !== 'dated') return { order: d.kind === 'undisclosed' ? 1e5 : 2e5, label: d.kind === 'ongoing' ? '상시' : d.kind === 'undisclosed' ? '미공개' : '미상', n: null, expired: false };
  const ms = d.milestones.map(m => ({ ...m, n: dayDiff(m.date) }));
  if (d.storeEnded) { const last = [...ms].reverse().find(m => m.n < 0) || ms[ms.length - 1]; return { order: 3e5 - (last?.n ?? 0), label: '종료', n: last?.n ?? null, expired: true, ms, cur: last, ended: true }; }
  const next = ms.find(m => m.n >= 0);
  if (!next) { const last = ms[ms.length - 1]; return { order: 3e5 - last.n, label: '만료', n: last.n, expired: true, ms, cur: last }; }
  return { order: next.n, label: ddTxt(next.n), n: next.n, expired: false, ms, cur: next };
}
const dealsSorted = () => DATA.discounts.map((d, i) => ({ d, i, s: dealState(d) })).sort((a, b) => a.s.order - b.s.order || a.i - b.i);

/* ---------- 필터 ---------- */
const visModels = () => DATA.models.filter(m => (ST.w === 'all' || m.weights.kind === ST.w) && !ST.vOff.has(m.vendor));
function drawFilters() {
  const cnt = k => DATA.models.filter(m => k === 'all' || m.weights.kind === k).length;
  $('#wFilter').innerHTML = seg('wSeg', [['all', `전체 ${cnt('all')}`], ['open', `◆ 오픈 ${cnt('open')}`], ['conditional', `▲ 조건부 ${cnt('conditional')}`], ['closed', `● 비공개 ${cnt('closed')}`]], ST.w);
  bindSeg('wSeg', v => { ST.w = v; renderModels(); });
  const vendors = [...new Set(DATA.models.map(m => m.vendor))];
  $('#vFilter').innerHTML = vendors.map(v => `<span class="vchip ${ST.vOff.has(v) ? 'off' : ''}" data-v="${esc(v)}"><i style="background:${vc(v)}"></i>${esc(v)}</span>`).join('') + ` <button class="btn small ghost" id="vAll">전체</button>`;
  $('#vFilter').onclick = e => { const c = e.target.closest('.vchip'); if (c) { ST.vOff.has(c.dataset.v) ? ST.vOff.delete(c.dataset.v) : ST.vOff.add(c.dataset.v); drawFilters(); renderModels(); } if (e.target.id === 'vAll') { ST.vOff.clear(); drawFilters(); renderModels(); } };
}

/* ---------- 레이아웃 ---------- */
const isMobile = () => window.innerWidth < 600;
function layout() {
  const D = DATA, M = D.models;
  const top = [...M].sort((a, b) => (b.index ?? -1) - (a.index ?? -1))[0];
  const cheapest = [...M].filter(m => isNum(m.price.blend31)).sort((a, b) => a.price.blend31 - b.price.blend31)[0];
  const bestOpen = [...M].filter(m => m.weights.kind === 'open').sort((a, b) => b.index - a.index)[0];
  const recent = M.filter(m => m.release.dates.some(x => { const n = dayDiff(x.date); return n <= 0 && n >= -30; }));
  const next = dealsSorted().find(x => x.s.n != null && !x.s.expired);
  const valueKing = [...M].filter(m => isNum(m.index) && isNum(m.price.blend31)).sort((a, b) => b.index / b.price.blend31 - a.index / a.price.blend31)[0];
  const kpi = (l, v, d, cls = '') => `<div class="card kpi"><div class="label">${l}</div><div class="value ${cls}">${v}</div><div class="desc">${d}</div></div>`;
  $('#app').innerHTML = `
  <div class="page-head"><div><h1>${esc(D.title)}</h1>
    <p>${esc(D.indexName)} 기준 지수 · 가격 = ${esc(D.priceUnit)} · 원문 <code>${esc(D.sourceFile)}</code> · D-day 기준 오늘 <b>${TODAY}</b> (KST)</p></div></div>
  <div class="grid g6">
    ${kpi('비교 모델', M.length + '개', `${new Set(M.map(m => m.vendor)).size}개 업체 · 오픈 ${M.filter(m => m.weights.kind === 'open').length} · 조건부 ${M.filter(m => m.weights.kind === 'conditional').length} · 비공개 ${M.filter(m => m.weights.kind === 'closed').length}`)}
    ${kpi('지수 1위', `${top.index}<small>${esc(top.model)}</small>`, `<span class="vdot" style="background:${vc(top.vendor)}"></span>${esc(top.vendor)} · ${usd(top.price.in)} / ${usd(top.price.out)}`)}
    ${kpi('오픈 가중치 1위', bestOpen ? `${bestOpen.index}<small>${esc(bestOpen.model)}</small>` : '—', bestOpen ? `${esc(bestOpen.weights.raw)} · ${usd(bestOpen.price.in)} / ${usd(bestOpen.price.out)}` : '')}
    ${kpi('최저 API 가격', `${usd(cheapest.price.in)} / ${usd(cheapest.price.out)}`, `${esc(cheapest.vendor)} ${esc(cheapest.model)} ${priceBadge({ ...cheapest.price, alt: [] })}`, 'sm')}
    ${kpi('지수 ÷ 3:1 혼합가 최고', esc(valueKing.model), `지수 ${valueKing.index} · 혼합 ${usd(valueKing.price.blend31)} <span class="muted">(파생값)</span>`, 'sm')}
    ${kpi('가장 임박한 할인 마감', next ? `${ddTxt(next.s.n)}<small>${fmtDate(next.s.cur.date)}</small>` : '—', next ? `${esc(next.d.target)} · ${esc(next.s.cur.label)}` : '')}
  </div>
  <section class="sec" id="s-glance"><h2 class="sec">한눈에: 지수 · API 가격 · 할인 마감 ${D.storeOn ? srcTag('mix') : srcTag('md')}</h2>
  <div class="grid g3 glance">
    ${card({ title: '지능 지수 순위', sub: `${esc(D.indexName)} · 마커 ◆오픈 ▲조건부 ●비공개`, body: chartDiv('cIndex') })}
    ${card({ title: 'API 가격 (1M 토큰당 USD)', sub: '같은 순서(지수순) · 실선=원문 가격, 점선 원=대체/구간 가격', tools: seg('pScale', [['log', '로그'], ['lin', '선형']], ST.plog ? 'log' : 'lin'), body: chartDiv('cPrice') })}
    ${card({ title: '할인 마감 D-day', sub: '마감 임박순 · 미공개/상시는 아래 · 만료는 흐리게', cls: 'dcol', body: `<div class="dlist" id="dList"></div>` })}
  </div></section>
  <section class="sec" id="s-scatter"><h2 class="sec">지능 vs 가격 ${D.storeOn ? srcTag('store') : srcTag('md')}</h2>
  <div class="grid g3">
    ${card({ title: '지능 지수 vs 가격', sub: '가로축 로그 스케일 · 점선 = 보이는 모델의 중앙값 · 왼쪽 위 = 싸고 똑똑함', cls: 'span2', tools: seg('pxSeg', [['blend31', '3:1 혼합(파생)'], ['in', '입력'], ['out', '출력']], ST.px), body: chartDiv('cScatter', 'h480'), foot: '3:1 혼합가 = (입력×3 + 출력)/4 로 대시보드가 계산한 파생값(원문에 없음). 도입가·오프피크·구간가 모델은 점선으로 대체 가격까지 연결.' })}
    ${card({ title: '가성비 (지수 ÷ 가격)', sub: '선택한 가격 기준 · 파생값', body: chartDiv('cValue', 'h480') })}
  </div></section>
  <section class="sec" id="s-context"><h2 class="sec">문맥 길이 ${D.storeOn ? srcTag('md') : srcTag('md')}</h2>
  <div class="grid g2">
    ${card({ title: '최대 문맥 길이 (토큰)', sub: '빗금 = 원문이 근사치(“약”)로 표기', body: chartDiv('cCtx', 'h420') })}
    ${card({ title: '출시일 vs 지수', sub: '원문 출시일(연도 미기재 → 기준연도 가정) · 복수 날짜는 선으로 연결', body: chartDiv('cRel', 'h420') })}
  </div></section>
  <section class="sec" id="s-table"><h2 class="sec">모델 비교표 ${D.storeOn ? srcTag('mix') : srcTag('md')}</h2><div class="card" id="mTable"></div><div class="card mnotes" id="mNotes" style="margin-top:12px"></div></section>
  <section class="sec" id="s-plans"><h2 class="sec">구독 요금제 (월 USD) ${D.storeOn ? srcTag('mix') : srcTag('md')}</h2>
    ${card({ title: '업체별 월 구독 가격대', sub: '점 = 요금제 티어(같은 티어의 복수 가격은 모두 표시) · 빈 점 = 미확인 · 빗금 = 한시가', tools: seg('sScale', [['log', '로그'], ['lin', '선형']], 'log'), body: chartDiv('cPlans', 'h420') })}
    <div class="pcards" id="pCards" style="margin-top:12px"></div></section>
  <section class="sec" id="s-deals"><h2 class="sec">진행 중 할인 · 프로모션 ${D.storeOn ? srcTag('mix') : srcTag('md')}</h2><div class="dcards" id="dCards"></div></section>
  <section class="sec" id="s-timeline"><h2 class="sec">최근 30일 신기능 · 일정 ${D.storeOn ? srcTag('mix') : srcTag('md')}</h2>
    ${card({ title: '일정 타임라인', sub: '● 모델 출시(표) ◆ 날짜가 있는 신기능·이벤트 ▼ 할인 마감 · 음영 = 최근 30일 · 세로선 = 오늘', body: chartDiv('cTime', 'h420') })}
    <div class="card" id="evList" style="margin-top:12px"></div>
    <div class="fcards" id="fCards" style="margin-top:12px"></div></section>
  <section class="sec" id="s-reactions"><h2 class="sec">크리에이터 반응 ${D.storeOn ? srcTag('md') : srcTag('md')}</h2><div class="rcards" id="rCards"></div></section>
  <section class="sec" id="s-notes"><h2 class="sec">데이터 메모 · 불확실성</h2><div class="grid g2" id="notes"></div></section>`;
  bindSeg('pScale', v => { ST.plog = v === 'log'; drawPrice(); });
  bindSeg('pxSeg', v => { ST.px = v; drawScatter(); drawValue(); });
  bindSeg('sScale', v => drawPlans(v === 'log'));
  renderModels(); drawModelNotes(); drawDeals(); drawPlans(true); drawPlanCards(); drawTimeline(); drawEvents(); drawFeatures(); drawReactions(); drawNotes();
}
function renderModels() { drawIndex(); drawPrice(); drawScatter(); drawValue(); drawCtx(); drawRel(); drawTable(); }
const byRank = () => visModels().sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || a.rank - b.rank);
const mLabel = m => `${W_MARK[m.weights.kind]} ${m.model}`;
const yCat = (names, w) => axisStyle({ type: 'category', inverse: true, data: names, axisLabel: { color: themeColors().text, fontSize: 11.5, width: w || (isMobile() ? 110 : 140), overflow: 'truncate' }, splitLine: { show: false } });
function modelTip(m, extra = []) {
  return `<div class="t">${esc(m.vendor)} · ${esc(m.model)}</div>` + [['지수', m.index ?? esc(m.indexRaw)], ['입력/출력', `${usd(m.price.in)} / ${usd(m.price.out)} ${esc(m.price.label || '')}`], ...m.price.alt.map(a => [a.label || '대체', `${usd(a.in)} / ${usd(a.out)}`]), ...(m.g?.index || m.g?.in ? [['등급', `지수 ${gBadge(m.g.index, true) || mdTag()} · 가격 ${gBadge(m.g.in, true) || mdTag()}`]] : [['등급', mdTag()]]), ['3:1 혼합(파생)', usd(m.price.blend31)], ['문맥', esc(m.context.raw)], ['가중치', esc(m.weights.raw)], ['출시', esc(m.release.raw)], ['포지션', esc(m.position)], ...extra].map(([k, v]) => `<div class="row"><span class="muted">${esc(k)}</span><span>${v}</span></div>`).join('') + `<div class="n">원문 가격 표기: ${esc(m.price.raw)}</div>`;
}
const emptyNote = el => { const e = typeof el === 'string' ? document.getElementById(el) : el; const c = echarts.getInstanceByDom(e); c && c.dispose(); e.innerHTML = '<div class="hidden-note">필터에 맞는 모델이 없습니다.</div>'; };

function drawIndex() {
  const M = byRank(); if (!M.length) return emptyNote('cIndex');
  chart('cIndex', { grid: { left: 6, right: 34, top: 6, bottom: 6, containLabel: true }, tooltip: { trigger: 'item', formatter: p => modelTip(M[p.dataIndex]) },
    xAxis: axisStyle({ type: 'value', max: v => Math.ceil(v.max / 10) * 10 }), yAxis: yCat(M.map(mLabel)),
    series: [{ type: 'bar', barMaxWidth: 18, data: M.map(m => ({ value: m.index, itemStyle: gradeStyle(vc(m.vendor), m.g?.index, { borderRadius: [0, 4, 4, 0] }) })), label: { show: true, position: 'right', color: themeColors().text, fontWeight: 700, fontSize: 12, formatter: p => p.value + gSuffix(M[p.dataIndex].g?.index) + (M[p.dataIndex].storeOnly ? ' 신규' : '') } }] });
}
function drawPrice() {
  const M = byRank(); if (!M.length) return emptyNote('cPrice');
  const c = themeColors(), alt = [];
  // 로그 모드: ECharts 로그축 막대는 1에서 시작해 1 미만이 음수 방향으로 그려지므로 log10(v/0.1) 변환 후 값 축 사용
  const L = ST.plog, tf = v => isNum(v) ? (L ? Math.log10(v / 0.1) : v) : null, inv = x => L ? 0.1 * Math.pow(10, x) : x;
  M.forEach((m, i) => m.price.alt.forEach(a => { alt.push({ value: [tf(a.in), i], m, a, raw: a.in }); alt.push({ value: [tf(a.out), i], m, a, raw: a.out }); }));
  const maxv = Math.max(...M.flatMap(m => [m.price.out, m.price.in, ...m.price.alt.map(a => a.out)]).filter(isNum));
  chart('cPrice', { legend: { data: ['입력', '출력', '대체·구간 가격'] }, grid: { left: 6, right: 44, top: 28, bottom: 6, containLabel: true },
    tooltip: { trigger: 'item', formatter: p => p.seriesName === '대체·구간 가격' ? modelTip(p.data.m) : modelTip(M[p.dataIndex]) },
    xAxis: axisStyle(L ? { type: 'value', min: 0, max: Math.ceil(Math.log10(maxv / 0.1)), interval: 1, axisLabel: { color: c.muted, formatter: x => '$' + +inv(x).toPrecision(2) } } : { type: 'value', axisLabel: { color: c.muted, formatter: v => '$' + v } }),
    yAxis: yCat(M.map(mLabel)),
    series: [
      { name: '입력', type: 'bar', barGap: '10%', barMaxWidth: 9, itemStyle: { color: '#60a5fa', borderRadius: [0, 3, 3, 0] }, data: M.map(m => ({ value: tf(m.price.in), raw: m.price.in, itemStyle: gradeStyle('#60a5fa', m.g?.in, { borderRadius: [0, 3, 3, 0] }) })), label: { show: !isMobile(), position: 'right', fontSize: 9.5, color: c.muted, formatter: p => usd(p.data.raw) } },
      { name: '출력', type: 'bar', barMaxWidth: 9, itemStyle: { color: '#f472b6', borderRadius: [0, 3, 3, 0] }, data: M.map(m => ({ value: tf(m.price.out), raw: m.price.out, itemStyle: gradeStyle('#f472b6', m.g?.out, { borderRadius: [0, 3, 3, 0] }) })), label: { show: true, position: 'right', fontSize: 9.5, color: c.muted, formatter: p => usd(p.data.raw) + gSuffix(M[p.dataIndex].g?.out) } },
      { name: '대체·구간 가격', type: 'scatter', symbolSize: 9, data: alt, itemStyle: { color: 'transparent', borderColor: c.text, borderType: 'dashed', borderWidth: 1.4 } },
    ] });
}
const pxOf = m => ST.px === 'in' ? m.price.in : ST.px === 'out' ? m.price.out : m.price.blend31;
const pxAlt = a => ST.px === 'in' ? a.in : ST.px === 'out' ? a.out : (3 * a.in + a.out) / 4;
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
/* 픽셀 공간 탐욕 배치: 점마다 오른쪽/왼쪽/위/아래/대각 후보 중 다른 라벨·점과 가장 덜 겹치는 위치 선택 */
function smartLabels(inst, si, texts, fs = 11) {
  if (!inst) return;
  const data = inst.getOption().series[si].data;
  const tw = t => [...t].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? fs : fs * 0.58), 0);
  const px = data.map(d => inst.convertToPixel({ seriesIndex: si }, d.value));
  const boxes = px.map(p => ({ x1: p[0] - 8, y1: p[1] - 8, x2: p[0] + 8, y2: p[1] + 8 }));
  const ov = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const W = inst.getWidth(), H = inst.getHeight();
  const cand = (p, w, h) => [['right', p[0] + 10, p[1] - h / 2], ['left', p[0] - 10 - w, p[1] - h / 2], ['top', p[0] - w / 2, p[1] - 10 - h], ['bottom', p[0] - w / 2, p[1] + 10],
    ['insideTopRight', p[0] + 6, p[1] - 6 - h, [6, -6]], ['insideBottomRight', p[0] + 6, p[1] + 6, [6, 6]], ['insideTopLeft', p[0] - 6 - w, p[1] - 6 - h, [-6, -6]], ['insideBottomLeft', p[0] - 6 - w, p[1] + 6, [-6, 6]]];
  const placed = [];
  const order = px.map((p, i) => i).sort((a, b) => px[a][0] - px[b][0]);
  const res = Array(data.length);
  order.forEach(i => {
    const w = tw(texts[i]), h = fs + 3; let best = null;
    cand(px[i], w, h).forEach(([pos, x, y, off], ci) => {
      const b = { x1: x, y1: y, x2: x + w, y2: y + h };
      let sc = placed.reduce((a, q) => a + ov(b, q), 0) * 3 + boxes.reduce((a, q, j) => a + (j === i ? 0 : ov(b, q)), 0) * 2 + ci * 2;
      if (b.x1 < 0 || b.x2 > W || b.y1 < 0 || b.y2 > H) sc += 5000;
      if (!best || sc < best.sc) best = { sc, pos, off, b };
    });
    placed.push(best.b); res[i] = best.off ? { position: [0, 0], offset: best.off, align: best.off[0] > 0 ? 'left' : 'right', verticalAlign: best.off[1] > 0 ? 'top' : 'bottom' } : { position: best.pos };
  });
  inst.setOption({ series: inst.getOption().series.map((s, k) => k === si ? { data: s.data.map((d, j) => ({ ...d, label: { ...(d.label || {}), ...res[j], offset: res[j].offset || [0, 0] } })) } : {}) });
}
/* 라벨 겹침 완화: 정규화 좌표가 가까운 점끼리 묶어 라벨 위치를 오른쪽·왼쪽·아래·위로 순환 배치 */
function labelPos(pts, tx = 0.09, ty = 0.06) {
  const n = pts.length, par = [...Array(n).keys()], f = i => par[i] === i ? i : (par[i] = f(par[i]));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(pts[i][0] - pts[j][0]) < tx && Math.abs(pts[i][1] - pts[j][1]) < ty) par[f(i)] = f(j);
  const groups = {}; pts.forEach((p, i) => (groups[f(i)] = groups[f(i)] || []).push(i));
  const pos = Array(n).fill('right');
  Object.values(groups).forEach(g => { if (g.length < 2) return; g.sort((a, b) => pts[a][0] - pts[b][0] || pts[b][1] - pts[a][1]);
    g.forEach((i, k) => pos[i] = k === 0 ? 'left' : k === g.length - 1 ? 'right' : (k % 2 ? 'top' : 'bottom')); });
  return pos;
}
const norm = (vals, log) => { const v = vals.map(x => log ? Math.log10(x) : x); const mn = Math.min(...v), mx = Math.max(...v); return v.map(x => mx > mn ? (x - mn) / (mx - mn) : .5); };
function drawScatter() {
  const M = visModels().filter(m => isNum(m.index) && isNum(pxOf(m))); if (!M.length) return emptyNote('cScatter');
  const c = themeColors(), mx = median(M.map(pxOf)), my = median(M.map(m => m.index));
  const xs = M.flatMap(m => [pxOf(m), ...m.price.alt.map(pxAlt)]);
  const xmin = Math.pow(10, Math.floor(Math.log10(Math.min(...xs)))), xmax = Math.pow(10, Math.ceil(Math.log10(Math.max(...xs))));
  const ymin = Math.floor((Math.min(...M.map(m => m.index)) - 4) / 5) * 5, ymax = Math.ceil((Math.max(...M.map(m => m.index)) + 3) / 5) * 5;
  const links = M.flatMap(m => m.price.alt.map(a => ({ m, a })));
  const nx = norm(M.map(pxOf), true), ny = norm(M.map(m => m.index)); const LP = labelPos(M.map((m, i) => [nx[i], ny[i]]));
  const quad = (x, y, t, al) => ({ type: 'text', [al.h]: 70, [al.v]: 40, style: { text: t, fill: c.muted, opacity: .55, font: '600 12px sans-serif' } });
  chart('cScatter', { grid: { left: 10, right: 30, top: 30, bottom: 30, containLabel: true },
    tooltip: { trigger: 'item', formatter: p => p.data.m ? modelTip(p.data.m, p.data.a ? [['이 점', `${esc(p.data.a.label || '대체')} 가격`]] : []) : '' },
    xAxis: axisStyle({ type: 'log', min: xmin, max: xmax, name: ST.px === 'blend31' ? '3:1 혼합가 $/1M (로그)' : (ST.px === 'in' ? '입력' : '출력') + ' $/1M (로그)', nameLocation: 'middle', nameGap: 26, axisLabel: { color: c.muted, formatter: v => '$' + v } }),
    yAxis: axisStyle({ type: 'value', min: ymin, max: ymax, name: '지수' }),
    graphic: isMobile() ? [] : [quad(0, 0, '★ 싸고 똑똑함', { h: 'left', v: 'top' }), quad(0, 0, '비싸고 똑똑함', { h: 'right', v: 'top' }), quad(0, 0, '싸지만 지수 낮음', { h: 'left', v: 'bottom' }), quad(0, 0, '비싸고 지수 낮음', { h: 'right', v: 'bottom' })],
    series: [
      ...links.map(({ m, a }) => ({ type: 'line', silent: true, symbol: 'none', lineStyle: { color: vc(m.vendor), type: 'dashed', width: 1.2, opacity: .8 }, data: [[pxOf(m), m.index], [pxAlt(a), m.index]], z: 1 })),
      { type: 'scatter', z: 2, data: links.map(({ m, a }) => ({ value: [pxAlt(a), m.index], m, a, symbol: W_SYM[m.weights.kind], symbolSize: 11, itemStyle: { color: 'transparent', borderColor: vc(m.vendor), borderType: 'dashed', borderWidth: 1.5 }, label: { show: !isMobile(), position: 'bottom', formatter: (a.label || '대체'), color: c.muted, fontSize: 9.5 } })) },
      { type: 'scatter', z: 3, data: M.map((m, i) => ({ value: [pxOf(m), m.index], m, symbol: W_SYM[m.weights.kind], symbolSize: 15, itemStyle: { color: vc(m.vendor), borderColor: m.price.kind === 'list' ? 'rgba(0,0,0,.35)' : '#fff', borderType: m.price.kind === 'list' ? 'solid' : 'dashed', borderWidth: 1.3 } })),
        label: { show: true, position: 'right', formatter: p => p.data.m.model + (p.data.m.price.kind !== 'list' ? ` (${p.data.m.price.label})` : ''), color: c.text, fontSize: 11 }, labelLayout: { hideOverlap: false, moveOverlap: 'shiftY' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: c.muted, type: 'dashed', opacity: .6 }, label: { color: c.muted, fontSize: 10 }, data: [{ xAxis: mx, label: { formatter: `가격 중앙값 ${usd(+mx.toFixed(3))}` } }, { yAxis: my, label: { formatter: `지수 중앙값 ${my}`, position: 'insideEndTop' } }] } },
    ] });
  smartLabels(CHARTS.get($('#cScatter')), links.length + 1, M.map(m => m.model + (m.price.kind !== 'list' ? ` (${m.price.label})` : '')));
}
function drawValue() {
  const M = visModels().filter(m => isNum(m.index) && isNum(pxOf(m))).map(m => ({ m, v: m.index / pxOf(m) })).sort((a, b) => b.v - a.v); if (!M.length) return emptyNote('cValue');
  chart('cValue', { grid: { left: 6, right: 40, top: 6, bottom: 6, containLabel: true }, tooltip: { trigger: 'item', formatter: p => modelTip(M[p.dataIndex].m, [['지수÷가격', M[p.dataIndex].v.toFixed(1)]]) },
    xAxis: axisStyle({ type: 'log', min: 1 }), yAxis: yCat(M.map(x => mLabel(x.m))),
    series: [{ type: 'bar', barMaxWidth: 16, data: M.map(x => ({ value: +x.v.toFixed(1), itemStyle: x.m.price.kind === 'list' ? { color: vc(x.m.vendor), borderRadius: [0, 4, 4, 0] } : estStyle(vc(x.m.vendor), { borderRadius: [0, 4, 4, 0] }) })), label: { show: true, position: 'right', fontSize: 11, color: themeColors().muted, formatter: p => p.value + (M[p.dataIndex].m.price.kind !== 'list' ? ' *' : '') } }] });
}
function drawCtx() {
  const M = visModels().filter(m => isNum(m.context.tokens)).sort((a, b) => b.context.tokens - a.context.tokens || (b.index - a.index)); if (!M.length) return emptyNote('cCtx');
  chart('cCtx', { grid: { left: 6, right: 50, top: 6, bottom: 6, containLabel: true }, tooltip: { trigger: 'item', formatter: p => modelTip(M[p.dataIndex]) },
    xAxis: axisStyle({ type: 'value', axisLabel: { color: themeColors().muted, formatter: ctxFmt } }), yAxis: yCat(M.map(mLabel)),
    series: [{ type: 'bar', barMaxWidth: 16, data: M.map(m => ({ value: m.context.tokens, itemStyle: m.context.approx ? estStyle(vc(m.vendor), { borderRadius: [0, 4, 4, 0] }) : { color: vc(m.vendor), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', fontSize: 11, color: themeColors().muted, formatter: p => (M[p.dataIndex].context.approx ? '약 ' : '') + ctxFmt(p.value) } }] });
}
function drawRel() {
  const M = visModels().filter(m => isNum(m.index) && m.release.dates.length); if (!M.length) return emptyNote('cRel');
  const c = themeColors(); const ts = iso => Date.parse(iso + 'T00:00:00+09:00');
  const first = M.map(m => ts(m.release.dates[0].date)); const nx = norm(first), ny = norm(M.map(m => m.index)); const LP = labelPos(M.map((m, i) => [nx[i], ny[i]]), 0.12, 0.08);
  const xmin = Math.min(...first) - 10 * 864e5, xmax = Math.max(ts(TODAY), ...M.flatMap(m => m.release.dates.map(x => ts(x.date)))) + 14 * 864e5;
  chart('cRel', { grid: { left: 10, right: 30, top: 20, bottom: 24, containLabel: true }, tooltip: { trigger: 'item', formatter: p => p.data.m ? modelTip(p.data.m, [['이 점', esc(p.data.lab || '출시')]]) : '' },
    xAxis: axisStyle({ type: 'time', min: xmin, max: xmax, axisLabel: { color: c.muted, formatter: v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; } } }), yAxis: axisStyle({ type: 'value', min: 20, name: '지수' }),
    series: [...M.filter(m => m.release.dates.length > 1).map(m => ({ type: 'line', silent: true, symbol: 'none', lineStyle: { color: vc(m.vendor), type: 'dashed' }, data: m.release.dates.map(x => [ts(x.date), m.index]) })),
      { type: 'scatter', data: M.flatMap((m, mi) => m.release.dates.map((x, k) => ({ value: [ts(x.date), m.index], m, lab: x.label, symbol: W_SYM[m.weights.kind], symbolSize: 13, itemStyle: { color: k ? 'transparent' : vc(m.vendor), borderColor: vc(m.vendor), borderWidth: 1.5 }, label: { show: k === 0, position: 'right', formatter: m.model, color: c.text, fontSize: 10.5 } }))), labelLayout: { moveOverlap: 'shiftY' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#f472b6', type: 'solid' }, label: { formatter: '오늘', color: '#f472b6' }, data: [{ xAxis: ts(TODAY) }] } }] });
  const relSi = M.filter(m => m.release.dates.length > 1).length; const relTexts = M.flatMap(m => m.release.dates.map((x, k) => k === 0 ? m.model : '')); smartLabels(CHARTS.get($('#cRel')), relSi, relTexts, 10.5);
}
function drawTable() {
  DataTable($('#mTable'), [
    { k: 'rank', label: '#', num: true },
    { k: 'vendor', label: '업체', html: m => `<span class="vdot" style="background:${vc(m.vendor)}"></span>${esc(m.vendor)}` },
    { k: 'model', label: '모델', cls: 'wrap', html: m => `<b>${esc(m.model)}</b>${m.storeOnly ? ' <span class="gb g-new sm" title="10/04 원문 표에 없던 모델 — 저장소에서 추가">신규</span>' : ''}<span class="note">${esc(m.position)}</span>` },
    { k: 'rel', label: '출시', val: m => m.release.dates[0]?.date, html: m => esc(m.release.raw) + m.release.dates.filter(x => x.rec).map(x => `<span class="note">${esc(x.label || '출시')} ${fmtDate(x.date)} ${gBadge(x.rec, true)}</span>`).join('') },
    { k: 'index', label: '지수', num: true, html: m => `<b>${m.index ?? esc(m.indexRaw)}</b> ${gBadge(m.g?.index, true) || mdTag()}` },
    { k: 'pin', label: '입력 $', num: true, val: m => m.price.in, html: m => `${usd(m.price.in)} ${gBadge(m.g?.in, true) || (isNum(m.price.in) ? mdTag() : '')}` },
    { k: 'pout', label: '출력 $', num: true, val: m => m.price.out, html: m => `${usd(m.price.out)} ${gBadge(m.g?.out, true) || (isNum(m.price.out) ? mdTag() : '')}` },
    { k: 'blend', label: '3:1 혼합 $', title: '파생값 (입력×3+출력)/4', num: true, val: m => m.price.blend31, html: m => `<span class="muted">${usd(m.price.blend31)}</span>` },
    { k: 'pnote', label: '가격 조건', nosort: true, cls: 'wrap', html: m => priceBadge(m.price) || '<span class="nullval">—</span>' },
    { k: 'ctx', label: '문맥', num: true, val: m => m.context.tokens, html: m => (m.context.approx ? `<span class="estval">${esc(m.context.raw)}</span>` : esc(m.context.raw)) + ' ' + (m.g?.ctx ? gBadge(m.g.ctx, true) : m.context.tokens ? mdTag() : '') },
    { k: 'w', label: '가중치', val: m => m.weights.kind, html: m => wBadge(m.weights) + ' ' + (m.g?.weights ? gBadge(m.g.weights, true) : m.storeOnly ? '' : mdTag()) },
    { k: 'src', label: '출처', nosort: true, cls: 'wrap', html: m => srcLinks(m.urls, '') || '<span class="nullval">—</span>' },
    { k: 'react', label: '반응', nosort: true, html: m => DATA.reactions.filter(r => r.modelId === m.id).map(r => `<span class="badge b-${r.sentiment}" title="${esc(r.creator)}: ${esc(r.text)}">${SENT_LABEL[r.sentiment]}</span>`).join(' ') || '<span class="nullval">—</span>' },
  ], { rows: () => visModels(), sort: { k: 'index', dir: 'desc' }, search: ['vendor', 'model', 'position'], maxH: 2000 });
}
const D_MD_TAG = '<div class="small muted">저장소 기록 없음 — 원문 md 기준 ' + '<span class="gb g-md sm">md</span></div>';
function drawDeals() {
  const L = dealsSorted();
  const vd = d => d.vendors.map(v => `<span class="vdot" style="background:${vc(v)}" title="${esc(v)}"></span>`).join('');
  const msHTML = s => (s.ms || []).map(m => `<span class="ms ${m.n < 0 ? 'past' : ''}">${esc(m.label)} ${fmtDate(m.date)} · ${ddTxt(m.n)}</span>`).join('');
  $('#dList').innerHTML = L.map(({ d, s }) => `<a href="#s-deals" class="drow ${urg(s.n)} ${s.expired ? 'expired' : ''}" style="color:inherit;text-decoration:none">
    <div class="dd">${s.ended ? '종료' : s.n != null ? (s.expired ? '만료' : ddTxt(s.n)) : s.label}${s.cur ? `<small>${fmtDate(s.cur.date)} ${esc(s.cur.label)}</small>` : ''}</div>
    <div><div class="dt-t">${vd(d)}${esc(d.target)}</div><div class="dt-c">${esc(d.content)}</div></div></a>`).join('');
  $('#dCards').innerHTML = L.map(({ d, s }) => `<div class="dcard ${urg(s.n)} ${s.expired ? 'expired' : ''}">
    <div class="top"><div><div class="big">${s.ended ? '종료' : s.n != null ? (s.expired ? '만료' : ddTxt(s.n)) : esc(s.label)}</div><div class="small muted" title="원문: ${esc(d.deadlineRaw)}">${d.milestones.length ? d.milestones.map(m => `${m.label === '마감' ? '' : esc(m.label) + ' '}${fmtDate(m.date)}${m.label === '마감' ? ' 마감' : ''}`).join(' · ') : esc(d.deadlineRaw)}</div></div>
      ${d.percents.length ? `<div class="pct">${d.percents.map(p => esc(p) + '%').join(' · ')}</div>` : ''}</div>
    <div class="dt-t">${vd(d)}${esc(d.target)}</div><div class="small">${esc(d.content)}</div>
    ${s.ms ? `<div>${msHTML(s)}</div>` : ''}
    ${s.n != null && !s.expired ? `<div class="dbar" title="오늘부터 30일 기준"><i style="width:${Math.max(3, 100 - Math.min(30, s.n) / 30 * 100)}%"></i></div>` : ''}
    ${d.check ? `<div class="small muted">₩${nf.format(d.krw[0])} → ₩${nf.format(d.krw[1])}: 계산 ${d.check.calcPercent}% ${d.check.ok ? '✓ 원문과 일치' : '⚠ 원문과 다름'}</div>` : ''}
    ${d.partialDeadline ? `<div class="small" style="color:#fbbf24">⚠ ${esc(d.partialDeadline)}</div>` : ''}
    ${d.kind === 'undisclosed' ? '<span class="badge b-unverified">마감 미공개</span>' : d.kind === 'ongoing' ? '<span class="badge b-change">상시</span>' : ''}
    ${s.ms && !s.expired && s.ms.some(m => m.n < 0) ? `<div class="small muted">일부 혜택 종료: ${s.ms.filter(m => m.n < 0).map(m => `${esc(m.label)} ${fmtDate(m.date)}`).join(', ')}</div>` : ''}
    ${d.store ? `<div class="small">저장소: <b>${esc(d.store.metric === 'promo_status' ? d.store.value : '종료일 ' + d.store.value)}</b> ${gBadge(d.store, true)} <span class="muted">${esc(d.store.note || '')}</span></div>` : D_MD_TAG}
    ${srcLinks(d.urls)}
  </div>`).join('');
}
function drawPlans(log) {
  const P = DATA.plans.filter(p => !p.none); const c = themeColors();
  const pts = [];
  P.forEach((p, yi) => p.tiers.forEach((t, ti) => {
    const name = t.name || `티어 ${ti + 1}(이름 미기재)`;
    t.prices.filter(v => !log || v > 0).forEach(v => pts.push({ value: [v, yi], p, t, name, tmp: p.flags.includes('temporary'), unk: t.unknown || p.rowNotes.some(n => /미확인/.test(n)) }));
  }));
  chart('cPlans', { grid: { left: 6, right: 30, top: 10, bottom: 26, containLabel: true },
    tooltip: { trigger: 'item', formatter: x => { const d = x.data; return d ? `<div class="t">${esc(d.p.vendor)} · ${esc(d.name)}</div><div class="row"><span class="muted">월</span><span>${usdM(d.value[0])}</span></div><div class="row"><span class="muted">포함 모델</span><span>${esc(d.p.includes)}</span></div><div class="row"><span class="muted">한도</span><span>${esc(d.p.limits)}</span></div>${[...d.t.notes, ...d.p.rowNotes].map(n => `<div class="n">메모: ${esc(n)}</div>`).join('')}<div class="n">원문: ${esc(d.p.pricesRaw)}</div>` : ''; } },
    xAxis: axisStyle({ type: log ? 'log' : 'value', min: log ? 1 : 0, axisLabel: { color: c.muted, formatter: v => '$' + v } }),
    yAxis: yCat(P.map(p => p.vendor), 90),
    series: [
      ...P.map((p, yi) => ({ type: 'line', silent: true, symbol: 'none', lineStyle: { color: vc(p.vendor), width: 3, opacity: .35 }, data: [[Math.min(...pts.filter(x => x.value[1] === yi).map(x => x.value[0])), yi], [Math.max(...pts.filter(x => x.value[1] === yi).map(x => x.value[0])), yi]] })),
      { type: 'scatter', symbolSize: 13, data: pts.map(d => ({ ...d, itemStyle: d.unk ? { color: 'transparent', borderColor: vc(d.p.vendor), borderType: 'dashed', borderWidth: 1.6 } : d.tmp ? estStyle(vc(d.p.vendor), { opacity: .8 }) : { color: vc(d.p.vendor), borderColor: 'rgba(0,0,0,.3)' } })),
        label: { show: !isMobile(), position: 'top', fontSize: 9.5, color: c.muted, formatter: x => `${x.data.name.split(' ').pop()} ${usdM(x.data.value[0])}` }, labelLayout: { hideOverlap: true } }] });
}
function drawPlanCards() {
  $('#pCards').innerHTML = DATA.plans.map(p => `<div class="pcard"><h4><span class="vdot" style="background:${vc(p.vendor)}"></span>${esc(p.vendor)} ${p.flags.includes('temporary') ? '<span class="badge b-estimate">한시가</span>' : ''}${p.flags.includes('unverified') ? '<span class="badge b-unverified">일부 미확인</span>' : ''}${p.flags.includes('estimate') ? '<span class="badge b-estimate">추정 포함</span>' : ''}</h4>
    ${p.none ? `<div class="tier"><span>구독 없음</span><span class="p">${esc(p.rowNotes.join(' '))}</span></div>` : p.tiers.map((t, i) => `<div class="tier"><span>${t.name ? esc(t.name) : `<span class="nullval">티어 ${i + 1} (이름 미기재)</span>`}${t.notes.map(n => `<span class="note small muted">${/미확인/.test(n) ? '<span class="badge b-unverified">미확인</span> ' : ''}${esc(n)}</span>`).join('')}</span>
      <span class="p ${p.flags.includes('temporary') ? 'tmp' : ''}">${t.prices.length ? t.prices.map(usdM).join(' · ') : '<span class="badge b-unverified">미확인</span>'}</span></div>`).join('')}
    ${p.rowNotes.length && !p.none ? `<div class="pk">메모: ${p.rowNotes.map(n => `<span class="${/미확인/.test(n) ? 'badge b-unverified' : 'badge b-estimate'}">${esc(n)}</span>`).join(' ')}${p.rowNotes.some(n => /미확인/.test(n)) ? ' <span class="muted">(원문상 행 전체에 걸린 표기인지 마지막 티어만인지 불명확)</span>' : ' <span class="muted">(전 티어 적용으로 표시)</span>'}</div>` : ''}
    <div class="pk">포함 모델: <b>${esc(p.includes)}</b></div><div class="pk">한도: <b>${esc(p.limits)}</b></div>${p.store ? `<div class="pk">${gBadge(p.store, true)} <span class="muted">저장소 · ${esc(p.store.note)}</span></div>` : DATA.storeOn ? '<div class="pk"><span class="gb g-md sm">md</span> <span class="muted">원문 md (저장소에 요금제 표 없음)</span></div>' : ''}${srcLinks(p.urls)}</div>`).join('')
    + (DATA.storePlans?.length ? `<div class="pcard sp"><h4>저장소: 요금제·가격 변경 ${srcTag('store')}</h4>${DATA.storePlans.map(r => `<div class="tier"><span><b>${esc(r.subject)}</b> <span class="muted small">${esc(r.metric)}</span><span class="note small muted">${esc(r.note)}</span>${srcLinks(r.source_url)}</span><span class="p">${r.value == null ? '<span class="nullval">값 없음</span>' : esc(Array.isArray(r.value) ? r.value.join(' / ') : r.value)} <span class="muted small">${esc(r.unit)}</span> ${gBadge(r, true)}</span></div>`).join('')}</div>` : '');
}
function drawTimeline() {
  const c = themeColors(); const ts = iso => Date.parse(iso + 'T00:00:00+09:00');
  const vendors = [...new Set([...DATA.models.map(m => m.vendor), ...DATA.features.map(f => f.vendor)])];
  const rel = DATA.models.flatMap(m => m.release.dates.map(x => ({ value: [ts(x.date), m.vendor], kind: '출시', text: `${m.model}${x.label ? ' ' + x.label : ''}`, date: x.date, v: m.vendor })));
  const fe = DATA.features.flatMap(f => [...(f.contextDate ? [{ value: [ts(f.contextDate), f.vendor], kind: '이벤트', text: `${f.context}: ${f.items.map(i => i.text).join(', ')}`, short: f.context, date: f.contextDate, v: f.vendor }] : []),
    ...f.items.filter(i => i.date).map(i => ({ value: [ts(i.date), f.vendor], kind: '신기능·일정', text: i.text, date: i.date, v: f.vendor }))]);
  const dl = DATA.discounts.flatMap(d => d.milestones.map(m => ({ value: [ts(m.date), d.vendors[0] || '기타'], kind: '할인 ' + m.label, text: `${d.target} — ${d.content}`, short: `${m.label} ${fmtDate(m.date)}`, date: m.date, v: d.vendors[0] })));
  const ev = (DATA.storeEvents || []).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.value)).map(e => ({ value: [ts(e.value), VENDOR_OF(e.subject) === '기타' ? (vendors.find(v => vendors_hit(e.subject, v)) || '기타') : VENDOR_OF(e.subject)], kind: '저장소 이벤트 · ' + e.grade, text: `${e.subject} — ${e.metric}: ${e.note}`, short: e.subject.split(' / ')[0], date: e.value, v: VENDOR_OF(e.subject), rec: e }));
  ev.forEach(e => { if (!vendors.includes(e.value[1])) vendors.push(e.value[1]); });
  const lab = (sz, pos) => ({ show: !isMobile(), position: pos, fontSize: 9.5, color: c.muted, formatter: x => (x.data.short || x.data.text).slice(0, 22) });
  const all = [...rel, ...fe, ...dl, ...ev].map(x => ts(x.date));
  const s30 = ts(TODAY) - 30 * 864e5;
  chart('cTime', { legend: { data: ['모델 출시', '신기능·이벤트', '할인 마감', ...(ev.length ? ['저장소 이벤트'] : [])] }, grid: { left: 6, right: 30, top: isMobile() ? 46 : 36, bottom: 26, containLabel: true },
    tooltip: { trigger: 'item', formatter: p => p.data && p.data.kind ? `<div class="t">${esc(p.data.v || '')} · ${esc(p.data.kind)}</div><div>${esc(p.data.date)} (${ddTxt(dayDiff(p.data.date))})</div><div class="n">${esc(p.data.text)}</div>` : '' },
    xAxis: axisStyle({ type: 'time', min: Math.min(...all) - 7 * 864e5, max: Math.max(...all) + 16 * 864e5, axisLabel: { color: c.muted, formatter: v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; } } }),
    yAxis: yCat(vendors, 80),
    series: [
      { name: '모델 출시', color: c.text, type: 'scatter', symbol: 'circle', symbolSize: 11, data: rel.map(x => ({ ...x, itemStyle: { color: vc(x.v) } })), label: lab(11, 'top'),
        markArea: { silent: true, itemStyle: { color: 'rgba(124,108,255,.09)' }, label: { show: true, position: 'insideBottom', color: c.muted, fontSize: 10, formatter: '최근 30일' }, data: [[{ xAxis: s30 }, { xAxis: ts(TODAY) }]] },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#f472b6' }, label: { formatter: `오늘 ${fmtDate(TODAY)}`, color: '#f472b6', position: 'start', distance: 4 }, data: [{ xAxis: ts(TODAY) }] } },
      { name: '신기능·이벤트', color: '#22d3ee', type: 'scatter', symbol: 'diamond', symbolSize: 13, data: fe.map(x => ({ ...x, itemStyle: { color: 'transparent', borderColor: vc(x.v), borderWidth: 2 } })), label: lab(9, 'left') },
      ...(ev.length ? [{ name: '저장소 이벤트', color: '#22c55e', type: 'scatter', symbol: 'pin', symbolSize: 18, data: ev.map(x => ({ ...x, itemStyle: gradeStyle('#22c55e', x.rec) })), label: lab(9, 'top') }] : []),
      { name: '할인 마감', color: '#fbbf24', type: 'scatter', symbol: 'triangle', symbolRotate: 180, symbolSize: 11, data: dl.map(x => ({ ...x, itemStyle: { color: '#fbbf24', opacity: dayDiff(x.date) < 0 ? .3 : 1 } })), label: lab(9, 'right') },
    ] });
  if (!isMobile()) { const ci = CHARTS.get($('#cTime')); smartLabels(ci, 0, rel.map(x => x.text.slice(0, 22)), 9.5); smartLabels(ci, 2, dl.map(x => x.short), 9.5); }
}
const vendors_hit = (subj, v) => (VENDOR_KEYS_JS[v] || []).some(k => subj.toLowerCase().includes(k.toLowerCase()));
const VENDOR_KEYS_JS = { Anthropic: ['Claude'], OpenAI: ['GPT', 'OpenAI'], Google: ['Gemini'], Meta: ['Muse'], xAI: ['Grok', 'xAI', 'X Subscription'], Xiaomi: ['MiMo'], Alibaba: ['Qwen'], 'Z.ai': ['GLM'], Moonshot: ['Kimi'], DeepSeek: ['DeepSeek'], MiniMax: ['MiniMax'] };
function drawEvents() {
  const E = DATA.storeEvents || [], el = $('#evList'); if (!E.length) { el.remove(); return; }
  const ord = e => /^\d{4}-/.test(e.value) ? e.value : '9999';
  el.innerHTML = `<div class="card-h"><div><h3>모델 이벤트 ${srcTag('store')}</h3><div class="sub">출시·공개·상태 변경 (공용 저장소 ${esc(STORE?.files?.events || '')}) · 미확·충돌은 등급으로 구분</div></div></div>
    <ul class="notes evl">${[...E].sort((a, b) => ord(b).localeCompare(ord(a))).map(e => `<li class="ev-${GRADE_KEY[e.grade] || 'unverified'}">${gBadge(e)} <b>${esc(e.subject)}</b> <span class="muted small">${esc(e.metric)}</span> · <b>${esc(e.value || '날짜 미확인')}</b>${/^\d{4}-/.test(e.value) ? ` <span class="ms">${ddTxt(dayDiff(e.value))}</span>` : ''}<br><span class="small">${esc(e.note)}</span>${srcLinks(e.source_url)}</li>`).join('')}</ul>`;
}
function drawFeatures() {
  // 신기능 항목 ↔ 표 모델: 전체 이름, '-마지막 접미사' 제거형(MiMo-V2.6), 브랜드 첫 단어 제거형(Opus 5.5)을 단어 경계로 매칭 (M3.1 ≠ M3)
  const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = m => { const n = [m.model]; if (m.model.includes('-') && m.model.split('-').length > 2) n.push(m.model.split('-').slice(0, -1).join('-')); const w = m.model.split(' '); if (w.length >= 3) n.push(w.slice(1).join(' ')); return n; };
  const relOf = txt => DATA.models.find(m => names(m).some(n => new RegExp('(^|[^A-Za-z0-9.])' + reEsc(n) + '($|[^A-Za-z0-9.\\-])').test(txt)));
  $('#fCards').innerHTML = DATA.features.map(f => `<div class="fcard"><h4><span class="vdot" style="background:${vc(f.vendor)}"></span>${esc(f.vendor)}${f.context ? ` <span class="badge b-change">${esc(f.context)}</span>` : ''}</h4><ul>${f.items.map(i => { const m = relOf(i.text); return `<li>${esc(i.text)}${i.date ? ` <span class="ms">${fmtDate(i.date)} · ${ddTxt(dayDiff(i.date))}</span>` : ''}${m ? ` <span class="ms" title="모델 비교표">지수 ${m.index} · ${esc(m.release.raw)} 출시</span>` : ''}</li>`; }).join('')}</ul>${srcLinks(f.urls)}</div>`).join('');
}
function drawReactions() {
  $('#rCards').innerHTML = DATA.reactions.map(r => { const m = DATA.models.find(x => x.id === r.modelId);
    return `<div class="rcard s-${r.sentiment}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${esc(r.model)}</b><div class="who">🎙 ${esc(r.creator)}</div></div><span class="badge b-${r.sentiment}">${esc(r.sentimentRaw)}</span></div>
    <ul>${r.parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    ${m ? `<div class="mchip"><span class="vdot" style="background:${vc(m.vendor)}"></span>${esc(m.vendor)} ${esc(m.model)}${m.model !== r.model ? ' <span title="원문 표기와 표의 모델명이 다름">(표 매칭)</span>' : ''} · 지수 <b>${m.index}</b> · ${usd(m.price.in)} / ${usd(m.price.out)}</div>` : '<div class="mchip">표의 모델과 매칭 안 됨</div>'}${srcLinks(r.urls)}</div>`; }).join('');
}
function drawNotes() {
  const D = DATA;
  $('#notes').innerHTML = card({ title: '출처 · 파싱 정보', body: `<ul class="notes">
    ${storeNote(D)}${storeDiffNote(D)}
    <li>원문 출처 URL ${D.sourceMentions ?? D.sources.length}회 표기 · 고유 ${D.sources.length}개 (각 행·카드의 ↗ 링크로 연결)
      <details><summary class="small muted">전체 URL 목록</summary>${D.sources.map(s => `<div class="small"><a href="${esc(s.url)}" target="_blank" rel="noopener">↗ ${esc(s.url)}</a>${s.count > 1 ? ` <span class="muted">×${s.count}</span>` : ''}<br><span class="muted">${esc(s.context)}</span></div>`).join('')}</details></li>
    <li>원문 파일: <code>${esc(D.sourcePath)}</code> · 파싱 ${esc(D.generatedAt.replace('T', ' ').slice(0, 16))} KST (<code>tools/parse_md.py</code>)</li>
    <li>원문 섹션: ${D.sections.map(esc).join(' · ')}</li>
    <li>날짜 표기 YYYY-MM-DD · YYYY년 M/D · M월 D일 · M/D 모두 인식. 연도 미기재 → ${D.asOf.slice(0, 4)}년 가정(마감은 60일 넘게 지났으면 다음 해). D-day는 오늘(${TODAY}, KST) 기준.</li>
    <li>3:1 혼합가, 지수÷가격은 대시보드 파생값입니다(원문 수치 아님).</li></ul>` }) +
    card({ title: '원문의 불확실성 표기 · 파싱 경고', body: `<ul class="notes">${D.warnings.map(w => `<li>⚠ ${esc(w)}</li>`).join('')}
    ${D.uncertainLines.map(l => `<li class="small"><span class="badge b-unverified">원문</span> <span class="muted">${esc(l.replace(/^\|\s*|\s*\|$/g, '').replace(/\s*\|\s*/g, ' · ').replace(/^-\s*/, ''))}</span></li>`).join('')}</ul>` });
}
function storeDiffNote(D) {
  if (!D.storeOn || !STORE) return '';
  const V = STORE.verification, F = STORE.files;
  return `<li><span class="gb g-verified">공용 저장소 연결</span> ${esc(V.label)} — 지수·API 가격·프로모션·모델 이벤트는 저장소 값이 우선, 요금제·크리에이터 반응·문맥·가중치는 원문 md.
    <div class="small muted">${Object.entries(F).filter(([k, v]) => v).map(([k, v]) => `<code>${esc(v)}</code>`).join(' · ')}</div>
    ${Object.values(V.tableStatus || {}).some(x => /검증 대기/.test(x)) ? '<div class="small" style="color:#fbbf24">INDEX.md 파일 표의 상태 칸은 아직 ‘검증 대기’로 남아 있음 (비서실장 확인 문단은 사용 가능)</div>' : ''}
    ${(STORE.openIssues || []).length ? `<div class="small">남은 확인: ${STORE.openIssues.map(esc).join(' · ')}</div>` : ''}</li>
    <li>저장소 vs 원문 md 차이 ${STORE.diffs.length}건<div class="tablewrap" style="max-height:none"><table class="dt small"><thead><tr><th>대상</th><th>항목</th><th>md(10/04)</th><th>저장소</th><th>등급</th></tr></thead><tbody>${STORE.diffs.map(d => `<tr><td>${esc(d.subject)}</td><td>${esc(d.field)}</td><td>${esc(d.md)}</td><td><b>${esc(Array.isArray(d.store) ? d.store.join('/') : d.store)}</b></td><td>${d.grade ? gBadge({ grade: d.grade, note: d.note }, true) : ''}</td></tr>`).join('')}</tbody></table></div></li>`;
}
function storeNote(D) {
  if (D.storeOn) return '';
  const st = D.store; if (!st) return '';
  if (st.graded) return `<li><span class="badge b-open">공용 저장소</span> <code>${esc(st.path)}</code> 등급 데이터 있음</li>`;
  return `<li><span class="badge b-unverified">공용 저장소 미연결</span> <code>${esc(st.path)}</code> ${st.exists ? `파일 ${st.files.length}개 — grade/collected_at 없음(등급 미부여)` : '없음'} → 원문 md 파서 사용</li>`;
}
function drawModelNotes() {
  const N = DATA.modelNotes || []; const el = $('#mNotes'); if (!N.length) { el.remove(); return; }
  const name = id => (DATA.models.find(m => m.id === id) || {}).model || id;
  el.innerHTML = `<div class="card-h"><div><h3>표 아래 메모</h3><div class="sub">원문 표 밑 주석 · 변형/프리뷰 모델은 표·차트에 넣지 않음</div></div></div><ul class="notes">${N.map(n => `<li>${n.variant ? '<span class="badge b-change">변형·프리뷰</span> ' : n.head ? `<b>${esc(n.head)}</b> ` : ''}${esc(n.head && !n.variant ? n.text.slice(n.text.indexOf(n.head) + n.head.length).replace(/^[:：]\s*/, '') : n.text.replace(/^변형·프리뷰\s*\([^)]*\)\s*[:：]\s*/, ''))} ${srcLinks(n.urls)}</li>`).join('')}</ul>`;
}
/* ---------- 초기화 ---------- */
function setupNav() {
  const links = $$('#secnav a');
  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-160px 0px -60% 0px' });
  $$('section.sec').forEach(s => obs.observe(s));
}
async function init() {
  const saved = localStorage.getItem('aid-theme'); if (saved) document.documentElement.dataset.theme = saved;
  $('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('aid-theme', t); if (DATA) { layout(); drawFilters(); } };
  if (!window.echarts) { $('#loading').innerHTML = '<div class="error">차트 라이브러리(ECharts)를 불러오지 못했습니다.</div>'; return; }
  let src = '';
  if (window.AID_EMBED) { DATA = window.AID_EMBED; src = '내장 데이터(오프라인 단일 파일)'; }
  else {
    try { const r = await fetch('data/data.json', { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); DATA = await r.json(); src = 'data/data.json'; }
    catch (e) { $('#loading').innerHTML = `<div class="error">data/data.json을 불러오지 못했습니다 (${esc(e.message)}). file://로 열었다면 dist/ai-dashboard-offline.html을 사용하거나 정적 서버로 여세요.</div>`; return; }
  }
  await loadStore(); applyStore(DATA, STORE);
  if (DATA.storeOn) src += ' + 공용 저장소(등급)';
  $('#loading').remove();
  $('#asOf').textContent = DATA.asOf + ' KST';
  // 공용 저장소 최신 데이터 날짜 (파일명 _YYYYMMDD 중 최댓값) — md 기준일과 나란히 표시
  if (DATA.storeOn && STORE?.files) {
    const fd = Object.entries(STORE.files).map(([k, f]) => [k, (String(f || '').match(/_(\d{4})(\d{2})(\d{2})\.json$/) || []).slice(1).join('-')]).filter(x => x[1]);
    const latest = fd.map(x => x[1]).sort().pop();
    if (latest) { $('#asOf').innerHTML = `원문 md ${esc(DATA.asOf)} · 저장소 <span id="storeAsOf">${esc(latest)}</span> KST`;
      $('#asOf').title = '저장소 파일별 날짜: ' + fd.map(([k, d]) => `${k} ${d}`).join(', '); }
  }
  $('#srcState').innerHTML = `<span class="dot" style="background:#22c55e"></span>${esc(src)}`;
  $('#foot').innerHTML = `<div>원문: ${esc(DATA.sourceFile)} · ${esc(DATA.indexName)} · 가격 ${esc(DATA.priceUnit)}</div><div>숫자는 원문 마크다운에서만 추출하며, 파생값은 별도 표기합니다. 오늘(KST) ${TODAY} 기준 D-day.</div>`;
  drawFilters(); layout(); setupNav();
  let lastMobile = isMobile();
  window.addEventListener('resize', () => { if (isMobile() !== lastMobile) { lastMobile = isMobile(); layout(); } });
}
init();
