/* ===== core: kpop-dashboard 공용 헬퍼 재사용 (표·차트·카드) ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNum = v => typeof v === 'number' && isFinite(v);
const nf = new Intl.NumberFormat('ko-KR');
const fmtN = v => isNum(v) ? nf.format(v) : '—';
/* ---------- 정렬 가능한 표 ---------- */
/**
 * cols: [{k,label,num,html(row),val(row),cls,title}]
 * opts: {rows, sort:{k,dir}, rowClass(row), search:[keys], tools: html, empty}
 */
function DataTable(el, cols, opts) {
  const st = { k: opts.sort?.k, dir: opts.sort?.dir || 'desc', q: '' };
  el.innerHTML = `<div class="tbl-tools">${opts.search ? `<input type="search" placeholder="검색…">` : ''}${opts.tools || ''}<span class="count"></span></div><div class="tablewrap" style="${opts.maxH ? 'max-height:' + opts.maxH + 'px' : ''}"><table class="dt"><thead></thead><tbody></tbody></table></div>`;
  const thead = $('thead', el), tbody = $('tbody', el), cnt = $('.count', el);
  const valOf = (c, r) => c.val ? c.val(r) : r[c.k];
  function draw() {
    let rows = (typeof opts.rows === 'function' ? opts.rows() : opts.rows).slice();
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(r => opts.search.some(k => String(typeof k === 'function' ? k(r) : r[k] ?? '').toLowerCase().includes(q))); }
    if (st.k != null) {
      const c = cols.find(c => c.k === st.k);
      if (c) {
        const coll = new Intl.Collator('ko', { numeric: true });
        rows.sort((a, b) => {
          const va = valOf(c, a), vb = valOf(c, b);
          const na = va == null || va === '' || (typeof va === 'number' && isNaN(va)), nb = vb == null || vb === '' || (typeof vb === 'number' && isNaN(vb));
          if (na && nb) return 0; if (na) return 1; if (nb) return -1; // null은 항상 아래
          const r = (typeof va === 'number' && typeof vb === 'number') ? va - vb : coll.compare(String(va), String(vb));
          return st.dir === 'asc' ? r : -r;
        });
      }
    }
    thead.innerHTML = '<tr>' + cols.map(c => `<th class="${c.num ? 'num' : ''} ${c.nosort ? '' : 'sortable'}" data-k="${esc(c.k)}" title="${esc(c.title || '')}">${esc(c.label)}${st.k === c.k ? `<span class="arr">${st.dir === 'asc' ? '▲' : '▼'}</span>` : ''}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows.length ? rows.map((r, i) => `<tr class="${opts.rowClass ? opts.rowClass(r) : ''}">` + cols.map(c => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.html ? c.html(r, i) : esc(r[c.k] ?? '')}</td>`).join('') + '</tr>').join('')
      : `<tr><td colspan="${cols.length}"><div class="hidden-note">${opts.empty || '표시할 행이 없습니다 (정확도 필터를 확인하세요)'}</div></td></tr>`;
    const total = (typeof opts.rows === 'function' ? opts.rows() : opts.rows).length;
    cnt.textContent = `${rows.length}행` + (opts.totalHint ? ` / 전체 ${opts.totalHint()}행` : (rows.length !== total ? ` / ${total}행` : ''));
  }
  thead.addEventListener('click', e => {
    const th = e.target.closest('th.sortable'); if (!th) return;
    const k = th.dataset.k; const c = cols.find(c => String(c.k) === k);
    if (st.k === c.k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.k = c.k; st.dir = c.num ? 'desc' : 'asc'; }
    draw();
  });
  const inp = $('input[type=search]', el); if (inp) inp.addEventListener('input', () => { st.q = inp.value.trim(); draw(); });
  draw();
  return { draw, el };
}

/* ---------- 차트 ---------- */
const CHARTS = new Map();
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function themeColors() {
  return { text: cssVar('--text'), muted: cssVar('--muted'), line: cssVar('--line'), line2: cssVar('--line2'), card: cssVar('--card'), card2: cssVar('--card2') };
}
const PAL = ['#7c6cff', '#22d3ee', '#f472b6', '#f59e0b', '#22c55e', '#60a5fa', '#a78bfa', '#fb7185', '#34d399', '#facc15', '#38bdf8', '#e879f9'];
/** 추정치 해칭(decal) */
const DECAL = { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 4], rotation: -Math.PI / 4, color: 'rgba(255,255,255,0.45)' };
const estStyle = (color, extra = {}) => ({ color, opacity: 0.55, decal: DECAL, borderColor: color, borderType: 'dashed', borderWidth: 1, ...extra });
const solidStyle = (color, extra = {}) => ({ color, ...extra });

function baseOption() {
  const c = themeColors();
  return {
    backgroundColor: 'transparent', color: PAL, animationDuration: 500,
    textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: c.text },
    grid: { left: 10, right: 20, top: 30, bottom: 10, containLabel: true },
    tooltip: {
      confine: true, enterable: true, backgroundColor: c.card, borderColor: c.line2, borderWidth: 1, padding: [8, 10],
      textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'box-shadow:0 10px 30px rgba(0,0,0,.35);border-radius:10px;', className: 'ech-tip',
    },
    legend: { textStyle: { color: c.muted, fontSize: 12 }, icon: 'roundRect', itemWidth: 12, itemHeight: 8, top: 0, type: 'scroll', pageTextStyle: { color: c.muted } },
  };
}
function axisStyle(extra = {}) {
  const c = themeColors();
  return Object.assign({
    axisLine: { lineStyle: { color: c.line2 } }, axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.line, type: 'dashed' } },
    nameTextStyle: { color: c.muted, fontSize: 11 },
  }, extra);
}
function deepMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
function chart(el, option) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return null;
  let inst = echarts.getInstanceByDom(el);
  if (inst) inst.dispose();
  inst = echarts.init(el, null, { renderer: 'canvas' });
  inst.setOption(deepMerge(baseOption(), option));
  CHARTS.set(el, inst);
  return inst;
}
function resizeVisible() { for (const [el, c] of CHARTS) { if (!document.body.contains(el)) { CHARTS.delete(el); continue; } if (el.offsetParent) c.resize(); } }
window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(resizeVisible, 120); });

/* ---------- 카드/레이아웃 헬퍼 ---------- */
function card({ title, sub = '', tools = '', body = '', foot = '', cls = '', id = '' }) {
  return `<div class="card ${cls}" ${id ? `id="${id}"` : ''}><div class="card-h"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${tools ? `<div class="card-tools">${tools}</div>` : ''}</div>${body}${foot ? `<div class="card-foot">${foot}</div>` : ''}</div>`;
}
const chartDiv = (id, h = '') => `<div class="chart ${h}" id="${id}"></div>`;
function seg(id, items, on) { return `<div class="seg" id="${id}">${items.map(([v, l]) => `<button data-v="${esc(v)}" class="${v === on ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; }
function bindSeg(id, cb) {
  const el = document.getElementById(id); if (!el) return;
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
}
