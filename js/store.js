/* ===== 공용 저장소(/workspace/data/ai, 등급 데이터) 연결: data/store.json (tools/parse_store.py) =====
 * 우선순위: 저장소 값(지수·API 가격·프로모션·이벤트) > 원문 md(요금제·반응·문맥·가중치 등 저장소에 없는 필드) */
let STORE = null; const STORE_DIFF = [];
const GRADE_KEY = { 확정: 'verified', 부분: 'partial', 개략: 'rough', 충돌: 'conflict', 미확: 'unverified', 추정: 'estimate' };
const GRADE_DESC = { 확정: '인용한 출처로 확인됨', 부분: '일부만 출처로 확인됨', 개략: '대략적인 값(반올림·근사)', 충돌: '출처끼리 값이 다름', 미확: '아직 확인하지 않음', 추정: '출처 없는 값·모델/가정 계산값' };
/** 등급 배지 (kpop 대시보드와 같은 6단계·색) */
function gBadge(rec, small = false) {
  if (!rec) return '';
  const g = rec.grade || '미확', k = GRADE_KEY[g] || 'unverified';
  const t = [`${g}: ${GRADE_DESC[g] || ''}`, rec.note, rec.as_of ? '기준 ' + rec.as_of : '', rec.collected_at ? '수집 ' + rec.collected_at : '', (rec.source_url || []).length ? '출처 ' + rec.source_url.length + '개' : '출처 없음'].filter(Boolean).join(' · ');
  return `<span class="gb g-${k}${small ? ' sm' : ''}" title="${esc(t)}">${esc(g)}</span>`;
}
const mdTag = (what = '원문 md') => `<span class="gb g-md sm" title="공용 저장소에 이 필드가 없어 원문 마크다운 값을 사용 (등급 없음)">md</span>`;
const gKey = rec => rec ? (GRADE_KEY[rec.grade] || 'unverified') : null;
/** 등급별 막대 스타일 — 추정=빗금, 개략=청록 점선 테두리, 미확=흐리게+점선, 충돌=빨간 테두리 */
function gradeStyle(color, rec, extra = {}) {
  const g = gKey(rec);
  if (g === 'estimate') return estStyle(color, extra);
  if (g === 'rough') return { color, opacity: .85, borderColor: '#2dd4bf', borderType: 'dotted', borderWidth: 2, ...extra };
  if (g === 'unverified') return { color, opacity: .45, borderColor: '#9ca3af', borderType: 'dashed', borderWidth: 1.2, ...extra };
  if (g === 'conflict') return { color, borderColor: '#ef4444', borderWidth: 2, ...extra };
  return { color, ...extra };
}
const gSuffix = rec => rec && rec.grade !== '확정' ? ` [${rec.grade}]` : '';
/** 섹션 출처 표시 */
const srcTag = kind => ({ store: '<span class="srctag st-store" title="공용 저장소 /workspace/data/ai (등급 포함)">출처: 공용 저장소</span>',
  md: '<span class="srctag st-md" title="원문 마크다운 (등급 없음)">출처: 원문 md</span>',
  mix: '<span class="srctag st-mix" title="저장소 값 우선, 저장소에 없는 필드는 원문 md">출처: 저장소 + md</span>' })[kind] || '';
const VENDOR_OF = s => /^Claude/.test(s) ? 'Anthropic' : /^Muse/.test(s) ? 'Meta' : /^(Step|StepFun)/.test(s) ? 'StepFun' : /^GPT/.test(s) ? 'OpenAI' : /^Gemini/.test(s) ? 'Google' : /^Grok/.test(s) ? 'xAI' : '기타';

async function loadStore() {
  try {
    if (window.AID_STORE_EMBED !== undefined) STORE = window.AID_STORE_EMBED;
    else { const r = await fetch('data/store.json', { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); STORE = await r.json(); }
  } catch (e) { STORE = null; console.info('공용 저장소 데이터 없음 → md만 사용', e.message); }
  return STORE;
}
function applyStore(D, S) {
  STORE_DIFF.length = 0;
  if (!S || !S.verification?.usable) { D.storeOn = false; return D; }
  D.storeOn = true;
  const subj = m => [m.model, m.vendor + ' ' + m.model].find(s => S.indexLatest[s] || S.priceBySubject[s]) || null;
  const evOf = name => (S.events || []).filter(e => e.subject.split(' / ').map(x => x.trim()).includes(name) || e.subject.replace(/^StepFun /, '') === name);
  const issueOf = (name, word) => (S.openIssues || []).find(x => x.includes(name) && x.includes(word));
  const setPrice = (m, P) => {
    m.g = m.g || {};
    if (P.api_price_input) { if (m.price.in !== P.api_price_input.value) STORE_DIFF.push([m.model, '입력가', m.price.in, P.api_price_input.value]); m.price.in = P.api_price_input.value; m.g.in = P.api_price_input; }
    if (P.api_price_output) { if (m.price.out !== P.api_price_output.value) STORE_DIFF.push([m.model, '출력가', m.price.out, P.api_price_output.value]); m.price.out = P.api_price_output.value; m.g.out = P.api_price_output; }
    if (P.api_price_input_after_intro && P.api_price_output_after_intro) {
      const end = P.intro_price_end_date?.value;
      m.price.alt = m.price.alt.filter(a => a.kind !== 'after');
      m.price.alt.push({ label: end ? `${end.slice(5).replace('-', '/')} 이후` : '이후', in: P.api_price_input_after_intro.value, out: P.api_price_output_after_intro.value, kind: 'after', rec: P.api_price_input_after_intro });
      m.price.introEnd = P.intro_price_end_date || null;
    }
    if (isNum(m.price.in) && isNum(m.price.out)) m.price.blend31 = Math.round((3 * m.price.in + m.price.out) / 4 * 1e4) / 1e4;
  };
  for (const m of D.models) {
    const s = subj(m); m.g = {}; m.storeSubject = s; if (!s) continue;
    const ix = S.indexLatest[s]; if (ix) { if (ix.value !== m.index) STORE_DIFF.push([m.model, '지수', m.index, ix.value]); m.index = ix.value; m.g.index = ix; m.indexHist = S.indexHistory[s]; }
    setPrice(m, S.priceBySubject[s] || {});
    const iss = issueOf(m.model, '문맥'); if (iss) m.g.ctx = { grade: '충돌', note: iss, source_url: [], collected_at: S.verification.date };
    for (const e of evOf(s).concat(s !== m.model ? evOf(m.model) : [])) if (/^\d{4}-\d{2}-\d{2}$/.test(e.value) && /launch|general_availability/.test(e.metric) && !m.release.dates.some(x => x.date === e.value))
      m.release.dates.push({ date: e.value, label: e.metric === 'general_availability' ? '전면 공개' : '출시', rec: e });
    m.urls = [...new Set([...(m.urls || []), ...(ix?.source_url || []), ...((S.priceBySubject[s] || {}).api_price_input?.source_url || [])])];
  }
  // 저장소에만 있는 신규 모델
  const known = new Set(D.models.map(m => m.storeSubject).filter(Boolean));
  const news = [...new Set([...Object.keys(S.indexLatest), ...Object.keys(S.priceBySubject).filter(k => S.priceBySubject[k].api_price_input)])].filter(s => !known.has(s));
  for (const s of news) {
    const ix = S.indexLatest[s], ev = evOf(s).concat(evOf('StepFun ' + s)); const launch = ev.find(e => e.metric === 'launch' && /^\d{4}-/.test(e.value));
    const wIss = issueOf(s.split(' ')[0], '가중치'), wEv = ev.find(e => /weights/.test(e.metric));
    const m = { rank: null, vendor: VENDOR_OF(s), model: s, id: s.toLowerCase().replace(/[^a-z0-9]+/g, '-'), storeOnly: true, storeSubject: s, g: {},
      release: { raw: launch ? launch.value.slice(5).replace('-', '/').replace(/^0/, '') : '—', dates: launch ? [{ date: launch.value, label: null, rec: launch }] : [] },
      index: ix ? ix.value : null, indexRaw: ix ? String(ix.value) : '—', price: { raw: '', in: null, out: null, label: null, alt: [], flags: [], kind: 'list' },
      context: { raw: '—', tokens: null, approx: false }, weights: { raw: wEv ? String(wEv.value) : '미기재', kind: 'unknown', ambiguous: true },
      position: '신규 (저장소)' + (ix?.note ? ' · ' + ix.note : ''), urls: [...new Set([...(ix?.source_url || [])])] };
    if (ix) { m.g.index = ix; m.indexHist = S.indexHistory[s]; }
    if (wEv) m.g.weights = wEv; else if (wIss) m.g.weights = { grade: '미확', note: wIss, source_url: [] };
    setPrice(m, S.priceBySubject[s] || {}); m.urls = [...new Set([...m.urls, ...((S.priceBySubject[s] || {}).api_price_input?.source_url || [])])];
    D.models.push(m);
  }
  D.models.forEach((m, i) => { if (!isNum(m.rank)) m.rank = i + 1; });
  // 프로모션: md 할인 행과 연결, 종료 반영
  for (const r of S.promos || []) {
    const d = D.discounts.find(d => d.target.split(/\s+/).every(w => r.subject.includes(w)));
    if (r.metric === 'promo_status' && d) { d.store = r; d.storeEnded = r.value === '종료'; d.urls = [...new Set([...(d.urls || []), ...(r.source_url || [])])]; }
    else if (r.metric === 'promo_end_date' && /^\d{4}-/.test(r.value)) {
      const P = S.priceBySubject[r.subject.replace(/ 도입가$/, '')] || {};
      D.discounts.push({ target: r.subject, content: P.api_price_input ? `API 도입가 $${P.api_price_input.value} / $${P.api_price_output.value} → 이후 $${P.api_price_input_after_intro?.value} / $${P.api_price_output_after_intro?.value}` : r.note, deadlineRaw: r.value, kind: 'dated',
        milestones: [{ date: r.value, label: '도입가 종료' }], percents: [], vendors: [VENDOR_OF(r.subject)], krw: [], urls: r.source_url || [], store: r, fromStore: true });
    }
  }
  // 요금제 변경 (저장소) · 이벤트
  D.storePlans = (S.pricing || []).filter(r => !/^api_price_(input|output)(_after_intro)?$/.test(r.metric) && r.metric !== 'intro_price_end_date');
  const xs = D.storePlans.find(r => r.subject === 'X Subscription' && Array.isArray(r.value));
  if (xs && !D.plans.some(p => p.vendor.includes('X Subscription'))) {
    const names = (xs.note.match(/([A-Za-z]+(?:\/[A-Za-z]+)+)/) || [, ''])[1].split('/');
    D.plans.push({ vendor: 'xAI · X Subscription', plansRaw: names.join(' / '), pricesRaw: xs.value.join(' / '), tiers: xs.value.map((v, i) => ({ name: names[i] || null, nameMissing: !names[i], prices: [v], priceText: String(v), unknown: false, notes: [] })),
      rowNotes: [], none: false, includes: 'Grok · Grok Bot · Cursor · X Premium 통합', limits: '서드파티 모델은 Premium 이상, API 별도 과금', flags: [], urls: xs.source_url || [], store: xs });
  }
  D.storeEvents = S.events || [];
  return D;
}
