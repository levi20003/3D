/* Befektetés app: kivonat-import, automatikus árfolyamok, nézetek. Minden adat csak a készüléken marad. */
(() => {
'use strict';
const CDN = {
  chart: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};
const REFRESH_MS = 15 * 60 * 1000;

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Nem sikerült menteni a készülékre (betelt a tárhely?).'); } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
let statements = store.get('bf-st', []);
let market = store.get('bf-mkt', { history: {}, fx: {}, usdhuf: null, updatedAt: 0, errors: [] });
let apiKey = store.get('bf-key', '');
const S = {
  tab: 'attekintes', cur: store.get('bf-cur', 'HUF'), theme: store.get('bf-theme', 'auto'),
  range: store.get('bf-range', 'all'), mode: store.get('bf-mode', 'idx'), bench: store.get('bf-bench', true),
  thr: 2, rmode: 'all', txType: 'all', q: '', busy: false, statusText: ''
};
try { const h = location.hash.slice(1); if (h) S.tab = h; } catch (e) {}
let M = null;

/* ---------- utils ---------- */
const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const nf = (n, d = 0) => (n || 0).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d });
const R = () => M ? M.R : 330;
const K = () => S.cur === 'HUF' ? R() : 1;
const money = (usd, o = {}) => { const s = o.sign && usd > 0.0049 ? '+' : usd < -0.0049 ? '−' : ''; return S.cur === 'HUF' ? s + nf(Math.abs(usd * R())) + ' Ft' : s + '$' + nf(Math.abs(usd), o.d ?? 2); };
const usd = (n, d = 2) => (n < 0 ? '−' : '') + '$' + nf(Math.abs(n), d);
const pct = n => (n > 0.049 ? '+' : n < -0.049 ? '−' : '') + nf(Math.abs(n), 1) + '%';
const cls = n => n > 0.0049 ? 'pos' : n < -0.0049 ? 'neg' : '';
const arr = n => n > 0.0049 ? '▲' : n < -0.0049 ? '▼' : '';
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const dhu = d => d.replace(/-/g, '.') + '.';
const HU_M = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const dShort = d => `${d.slice(0, 4)}. ${HU_M[+d.slice(5, 7) - 1]} ${+d.slice(8)}.`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const todayIso = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
// gyakori részvények neve, ha a kivonat már nem sorolja fel (lezárt pozíció)
const NAMES_FALLBACK = { AAPL: 'Apple', MSFT: 'Microsoft', AMZN: 'Amazon', GOOGL: 'Alphabet', GOOG: 'Alphabet', META: 'Meta', NVDA: 'Nvidia', TSLA: 'Tesla', NFLX: 'Netflix', ADBE: 'Adobe', CRM: 'Salesforce', ORCL: 'Oracle', AMD: 'AMD', INTC: 'Intel', PYPL: 'PayPal', UBER: 'Uber', ABNB: 'Airbnb', SHOP: 'Shopify', NOW: 'ServiceNow', DUOL: 'Duolingo', PLTR: 'Palantir', SOFI: 'SoFi', COIN: 'Coinbase', HOOD: 'Robinhood', NKE: 'Nike', SBUX: 'Starbucks', KO: 'Coca-Cola', PEP: 'PepsiCo', MCD: "McDonald's", DIS: 'Disney', V: 'Visa', MA: 'Mastercard', JPM: 'JPMorgan', BAC: 'Bank of America', NVO: 'Novo Nordisk', LLY: 'Eli Lilly', PFE: 'Pfizer', JNJ: 'Johnson & Johnson', CAKE: 'Cheesecake Factory', HNST: 'Honest Company', KULR: 'KULR Technology', ES: 'Esso S.A.F.', SPY: 'S&P 500 (SPY)', VOO: 'Vanguard S&P 500', QQQ: 'Invesco QQQ' };
let animNext = true;
const moneyHTML = v => S.cur === 'HUF' ? `${(v < -0.0049 ? '−' : '') + nf(Math.abs(v * R()))}<span class="cur">Ft</span>` : `<span class="cur pre">$</span>${(v < -0.0049 ? '−' : '') + nf(Math.abs(v), 2)}`;
const nm = t => (M && M.names[t]) || NAMES_FALLBACK[t] || t;
function toast(msg, ms = 3200) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), ms); }
const loaded = {};
function loadScript(src) { return loaded[src] = loaded[src] || new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Nem tölthető be: ' + src)); }; document.head.appendChild(s); }); }

/* ---------- compute ---------- */
function compute() {
  M = statements.length ? Engine.build(statements, { history: market.history, fx: market.fx, usdhuf: market.usdhuf, today: todayIso() }) : null;
}

/* ---------- market data ---------- */
const credits = [];
async function waitCredits(n) {
  for (;;) {
    const now = Date.now(); while (credits.length && now - credits[0] > 61000) credits.shift();
    if (credits.length + n <= 8) { for (let i = 0; i < n; i++) credits.push(Date.now()); return; }
    const wait = 61000 - (now - credits[0]);
    setStatus(`Ingyenes keret: várakozás ${Math.ceil(wait / 1000)} mp…`, 'busy');
    await sleep(Math.min(wait, 5000));
  }
}
async function getJson(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok && r.status !== 429) throw new Error('HTTP ' + r.status); return r.json(); }

async function fetchFx() {
  if (!M) return;
  const first = M.tx[0].date; const have = Object.keys(market.fx).sort();
  const from = have.length ? Engine.addDays(have[have.length - 1], -3) : Engine.addDays(first, -7);
  const urls = [`https://api.frankfurter.dev/v1/${from}..?base=USD&symbols=HUF,EUR`, `https://api.frankfurter.app/${from}..?from=USD&to=HUF,EUR`];
  for (const u of urls) {
    try { const j = await getJson(u); if (j && j.rates) { Object.assign(market.fx, j.rates); break; } } catch (e) { /* következő forrás */ }
  }
  const ds = Object.keys(market.fx).sort(); if (ds.length) market.usdhuf = market.fx[ds[ds.length - 1]].HUF;
}

async function fetchPrices(force) {
  if (!apiKey || !M) return;
  const open = new Set(M.positions.map(p => p.tkr));
  const firstOf = {}; M.tx.forEach(r => { if (r.tkr && !firstOf[r.tkr]) firstOf[r.tkr] = r.date; });
  const syms = [...M.usTickers, 'SPY'];
  const jobs = [];
  for (const s of syms) {
    const h = market.history[s]; const ds = h ? Object.keys(h).sort() : [];
    if (ds.length && !open.has(s) && s !== 'SPY' && !force) continue; // lezárt pozíció: elég egyszer letölteni
    const start = ds.length && !force ? Engine.addDays(ds[ds.length - 1], -4) : Engine.addDays(s === 'SPY' ? M.tx[0].date : firstOf[s], -7);
    jobs.push({ s, start });
  }
  jobs.sort((a, b) => a.start < b.start ? -1 : 1);
  const errs = [];
  for (let i = 0; i < jobs.length; i += 8) {
    const batch = jobs.slice(i, i + 8); const start = batch[0].start;
    setStatus(`Árfolyamok letöltése ${Math.min(i + 8, jobs.length)}/${jobs.length}…`, 'busy');
    let tries = 0, j;
    for (;;) {
      await waitCredits(batch.length);
      const url = `https://api.twelvedata.com/time_series?symbol=${batch.map(b => encodeURIComponent(b.s)).join(',')}&interval=1day&start_date=${start}&order=ASC&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`;
      j = await getJson(url);
      if (j && j.status === 'error' && (j.code === 429 || /credits|minute/i.test(j.message || '')) && tries++ < 3) { credits.length = 0; for (let k = 0; k < 8; k++) credits.push(Date.now()); continue; }
      break;
    }
    if (j && j.status === 'error') { if (j.code === 401 || /api ?key/i.test(j.message || '')) throw new Error('Érvénytelen Twelve Data kulcs.'); errs.push(j.message || 'hiba'); continue; }
    const per = batch.length === 1 ? { [batch[0].s]: j } : j;
    for (const b of batch) {
      const d = per[b.s];
      if (!d || d.status === 'error' || !Array.isArray(d.values)) { errs.push(b.s + ': ' + ((d && d.message) || 'nincs adat')); continue; }
      const h = market.history[b.s] = market.history[b.s] || {};
      d.values.forEach(v => { const c = parseFloat(v.close); if (c > 0) h[v.datetime.slice(0, 10)] = c; });
    }
  }
  market.errors = errs;
}

async function refresh(opts = {}) {
  if (S.busy || !statements.length) return;
  if (!navigator.onLine) { setStatus('Nincs internetkapcsolat, a legutóbbi adatokat látod.', 'off'); return; }
  S.busy = true; setStatus('Frissítés…', 'busy');
  try {
    compute(); await fetchFx(); compute();
    await fetchPrices(opts.force);
    market.updatedAt = Date.now(); store.set('bf-mkt', market);
    compute(); render(true);
    if (market.errors && market.errors.length) toast('Néhány árfolyam nem jött le: ' + market.errors.slice(0, 3).join('; '), 5000);
  } catch (e) { toast(e.message || 'A frissítés nem sikerült.'); }
  S.busy = false; drawStatus();
}

/* ---------- status ---------- */
function setStatus(text, kind) { S.statusText = text; S.statusKind = kind; drawStatus(); }
function drawStatus() {
  const el = $('status'); if (!el) return;
  const rb = $('refreshBtn'); if (rb) rb.querySelector('svg').classList.toggle('spin', S.busy);
  if (S.busy) { el.innerHTML = `<i class="busy"></i>${esc(S.statusText)}`; return; }
  const t = market.updatedAt ? new Date(market.updatedAt) : null;
  const when = t ? (t.toDateString() === new Date().toDateString() ? t.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : t.toLocaleDateString('hu-HU')) : null;
  if (!apiKey) el.innerHTML = `<i class="off"></i>Kivonat ára · ${M ? dhu(M.asOf) : '–'} · <a href="#" id="stKey">Élő árak bekapcsolása →</a>`;
  else el.innerHTML = `<i${navigator.onLine ? '' : ' class="off"'}></i>Élő · ${when || '–'} · ${nf(R(), 2)} Ft/$`;
  const k = $('stKey'); if (k) k.onclick = e => { e.preventDefault(); openSettings(); };
}

/* ---------- charts (Chart.js a mellékdiagramokhoz) ---------- */
let charts = [];
function chart(id, cfg) {
  const el = $(id); if (!el) return;
  if (!window.Chart) { loadScript(CDN.chart).then(() => render(true)).catch(() => {}); return; }
  Chart.defaults.color = css('--muted'); Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.font.size = 12;
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, cfg.options || {});
  const tt = { backgroundColor: css('--surface'), titleColor: css('--ink'), bodyColor: css('--ink'), footerColor: css('--muted'), borderColor: css('--line'), borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4 };
  cfg.options.plugins = Object.assign({ legend: { display: false } }, cfg.options.plugins || {}); cfg.options.plugins.tooltip = Object.assign(tt, cfg.options.plugins.tooltip || {});
  charts.push(new Chart(el, cfg));
}
const grid = () => ({ color: css('--line'), drawTicks: false });
const axisMoney = () => ({ callback: v => S.cur === 'HUF' ? (v < 0 ? '−' : '') + nf(Math.abs(v) / 1000) + 'e Ft' : (v < 0 ? '−$' : '$') + nf(Math.abs(v)) });

/* ---------- nagy árfolyamgrafikon (saját canvas) ---------- */
const RANGES = [['1w', '1 hét', 7], ['1m', '1 hó', 31], ['3m', '3 hó', 92], ['6m', '6 hó', 183], ['1y', '1 év', 366], ['all', 'Mind', null]];
function rangePoints() {
  const s = M.series; const r = RANGES.find(x => x[0] === S.range) || RANGES[5];
  if (!r[2]) return s;
  const from = Engine.addDays(M.today, -r[2]); const i = s.findIndex(p => p.d >= from);
  return s.slice(Math.max(0, i - 1));
}
// monoton köbös görbe (Fritsch–Carlson): sima, de nem lő túl a valós értékeken
function monoPath(ctx, P, move = true) {
  const n = P.length; if (!n) return; if (move) ctx.moveTo(P[0][0], P[0][1]); else ctx.lineTo(P[0][0], P[0][1]);
  if (n < 3) { for (let i = 1; i < n; i++) ctx.lineTo(P[i][0], P[i][1]); return; }
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / ((P[i + 1][0] - P[i][0]) || 1e-9));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  for (let i = 0; i < n - 1; i++) { const dx = (P[i + 1][0] - P[i][0]) / 3; ctx.bezierCurveTo(P[i][0] + dx, P[i][1] + m[i] * dx, P[i + 1][0] - dx, P[i + 1][1] - m[i + 1] * dx, P[i + 1][0], P[i + 1][1]); }
}
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function stockChart(canvas, pts, onScrub, opt = {}) {
  const box = canvas.parentElement; const dpr = window.devicePixelRatio || 1;
  const W = box.clientWidth, H = box.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  const a = pts[0];
  const idx = S.mode === 'idx' || opt.price;
  const y = p => opt.price ? p.nav : idx ? (p.nav / a.nav - 1) * 100 : p.value * K();
  const b = p => !opt.price && S.bench ? (idx ? (p.spyIdx && a.spyIdx ? (p.spyIdx / a.spyIdx - 1) * 100 : null) : (p.spyVal != null ? p.spyVal * K() : null)) : null;
  const inv = p => idx ? null : p.invested * K();
  const ys = pts.map(y), bs = pts.map(b), is = pts.map(inv);
  const all = [...ys, ...bs, ...is].filter(v => v != null && isFinite(v));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const TP = box.classList.contains('bleed') ? 16 : 0; // feliratok ne érjenek a képernyő széléhez
  const L = 0, T = 26, B = 26, w = W - L - 12, h = H - T - B;
  const X = i => L + (pts.length === 1 ? w : i / (pts.length - 1) * w), Y = v => T + (hi - v) / (hi - lo) * h;
  const resNow = idx ? ys[ys.length - 1] - ys[0] : (pts[pts.length - 1].value - pts[pts.length - 1].invested) - (a.value - a.invested);
  const col = css(resNow >= -1e-9 ? '--gain' : '--loss'), muted = css('--muted'), bench = css('--bench'), surf = css('--bg'), line = css('--line');
  const fam = getComputedStyle(document.body).fontFamily;
  const fmtY = v => opt.price ? usd(v) : idx ? pct(v) : money(v / K());
  const segs = vals => { const out = []; let cur = []; vals.forEach((v, i) => { if (v == null || !isFinite(v)) { if (cur.length) out.push(cur); cur = []; } else cur.push([X(i), Y(v)]); }); if (cur.length) out.push(cur); return out; };
  const main = segs(ys)[0] || [];
  let hiI = 0, loI = 0; ys.forEach((v, i) => { if (v > ys[hiI]) hiI = i; if (v < ys[loI]) loI = i; });

  function frame(prog) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // kiindulási szint
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.setLineDash([1, 4]); ctx.beginPath(); ctx.moveTo(L, Y(ys[0])); ctx.lineTo(L + w, Y(ys[0])); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L + w * prog + 1, H); ctx.clip();
    for (const sg of segs(is)) { ctx.beginPath(); sg.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.setLineDash([3, 4]); ctx.strokeStyle = muted; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
    for (const sg of segs(bs)) { ctx.beginPath(); monoPath(ctx, sg); ctx.strokeStyle = bench; ctx.globalAlpha = .9; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1; }
    if (main.length) {
      const grad = ctx.createLinearGradient(0, T, 0, T + h); grad.addColorStop(0, col + '33'); grad.addColorStop(.7, col + '08'); grad.addColorStop(1, col + '00');
      ctx.beginPath(); monoPath(ctx, main); ctx.lineTo(main[main.length - 1][0], T + h); ctx.lineTo(main[0][0], T + h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); monoPath(ctx, main); ctx.strokeStyle = col; ctx.lineWidth = 2.25; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.shadowColor = col + '66'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.restore();
    if (prog < 1) return;
    // csúcs és mélypont
    ctx.font = `500 11px ${fam}`; ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic';
    const tag = (i, above) => { const x = X(i), yy = Y(ys[i]) + (above ? -9 : 17); ctx.textAlign = x < 56 ? 'left' : x > W - 56 ? 'right' : 'center'; ctx.fillText(fmtY(ys[i]), Math.max(TP, Math.min(W - TP, x)), Math.max(12, Math.min(H - B + 2, yy))); };
    if (pts.length > 2) { tag(hiI, true); if (loI !== hiI) tag(loI, false); }
    ctx.textAlign = 'left'; ctx.fillText(dShort(pts[0].d), L + TP, H - 6); ctx.textAlign = 'right'; ctx.fillText(dShort(pts[pts.length - 1].d), L + w - TP, H - 6);
  }
  const dot = (i, c, r = 4) => { const x = X(i), yy = Y(ys[i]); ctx.beginPath(); ctx.arc(x, yy, r + 5, 0, 7); ctx.fillStyle = c + '26'; ctx.fill(); ctx.beginPath(); ctx.arc(x, yy, r, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = surf; ctx.stroke(); };
  const rest = () => { frame(1); dot(ys.length - 1, col); };
  if (opt.animate && !REDUCED && pts.length > 2) { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 700); frame(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(step); else rest(); }; requestAnimationFrame(step); }
  else rest();
  const scrubTo = i => {
    if (i == null) { rest(); onScrub(null); return; }
    frame(1);
    const x = X(i); ctx.strokeStyle = muted; ctx.globalAlpha = .5; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, T - 8); ctx.lineTo(x, T + h); ctx.stroke(); ctx.globalAlpha = 1;
    if (bs[i] != null) { ctx.beginPath(); ctx.arc(x, Y(bs[i]), 3.5, 0, 7); ctx.fillStyle = bench; ctx.fill(); }
    dot(i, col); onScrub(i);
  };
  const pick = e => { const r = canvas.getBoundingClientRect(); const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; return Math.max(0, Math.min(pts.length - 1, Math.round((cx - L) / w * (pts.length - 1)))); };
  canvas.onpointermove = e => scrubTo(pick(e));
  canvas.onpointerdown = e => scrubTo(pick(e));
  canvas.onpointerleave = () => scrubTo(null);
  canvas.onpointerup = e => { if (e.pointerType !== 'mouse') scrubTo(null); };
  canvas.ontouchmove = e => scrubTo(pick(e));
  canvas.ontouchend = () => scrubTo(null);
  canvas.tabIndex = 0; let ki = null;
  canvas.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { ki = ki == null ? pts.length - 1 : Math.max(0, Math.min(pts.length - 1, ki + (e.key === 'ArrowLeft' ? -1 : 1))); scrubTo(ki); e.preventDefault(); } if (e.key === 'Escape') { ki = null; scrubTo(null); } };
  canvas.onblur = () => { ki = null; scrubTo(null); };
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
function compact(v) { return S.cur === 'HUF' ? nf(v / 1000) + 'e' : '$' + nf(v); }

/* ---------- views ---------- */
const V = {};
const TABS = [['attekintes', 'Áttekintés', 'M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z'], ['portfolio', 'Portfólió', 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z'], ['eredmenyek', 'Eredmények', 'M4 20V10M10 20V4M16 20v-7M22 20H2'], ['sp500', 'S&P 500', 'M3 17l6-6 4 4 8-8M15 7h6v6'], ['koltsegek', 'Költségek', 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'], ['naplo', 'Napló', 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01']];
const hasHist = () => Object.keys(market.history || {}).length > 0;

V.attekintes = m => {
  const top = [...m.positions].sort((a, b) => b.pnl - a.pnl);
  const movers = top.length > 6 ? [...top.slice(0, 3), ...top.slice(-3).reverse()] : top;
  const daily = m.positions.some(p => p.dayAbs != null);
  return `
  <section class="stock">
    <div class="lbl-s" id="hl">Portfólió értéke</div>
    <div class="big num" id="hv"></div>
    <div class="chg num" id="hc"></div>
    <div class="chart bleed"><canvas id="sc" role="img" aria-label="A portfólió értékének alakulása. Húzd végig az ujjad a részletekért."></canvas></div>
    <div class="ranges2" role="group" aria-label="Időszak">${RANGES.map(r => `<button data-r="${r[0]}" aria-pressed="${S.range === r[0]}">${r[1]}</button>`).join('')}</div>
    <div class="opts">
      <div class="seg" role="group" aria-label="Nézet"><button data-mo="idx" aria-pressed="${S.mode === 'idx'}">Árfolyam</button><button data-mo="val" aria-pressed="${S.mode === 'val'}">Érték</button></div>
      <button class="chip" id="benchBtn" aria-pressed="${S.bench}"><i></i>S&P 500</button>
    </div>
    <div class="keys">${S.mode === 'idx' ? '<span>A portfólió mint egy részvény: a befizetések nem mozdítják a vonalat.</span>' : '<span><i style="border-top-style:dashed;border-color:var(--muted)"></i>Befizetett összeg</span>'}${S.bench ? `<span><i style="border-color:var(--bench)"></i>${S.mode === 'idx' ? 'S&P 500 (SPY)' : 'Ha mindent S&P 500-ba tettél volna'}${!market.history.SPY ? ' · élő árfolyammal' : ''}</span>` : ''}</div>
  </section>
  ${!apiKey ? `<div class="tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><p><b>Kapcsold be az élő árfolyamokat.</b> Most a kivonat árai és a vételi árak alapján rajzolok. Egy ingyenes Twelve Data kulccsal a grafikon napi záróárakból készül, és az app 15 percenként magától frissít. <a href="#" id="tipKey">Beállítás</a></p></div>` : ''}
  <section class="stats">
    <div class="stat"><div class="lbl-s">${daily ? 'Mai változás' : 'Nem realizált'}</div><div class="v num ${cls(daily ? m.dayChange : m.unreal)}">${money(daily ? m.dayChange : m.unreal, { sign: true })}</div></div>
    <div class="stat"><div class="lbl-s">Befizetve</div><div class="v num">${money(m.dep)}</div></div>
    <div class="stat"><div class="lbl-s">Osztalék</div><div class="v num pos">${money(m.divNet, { sign: true })}</div></div>
    <div class="stat"><div class="lbl-s">Díjak</div><div class="v num neg">${money(-m.feeUsd, { sign: true })}</div></div>
  </section>
  <section class="grid">
    <div class="card"><div class="card-h"><div><h2>Honnan jön az eredmény?</h2><p class="sub">A befizetéstől a mai értékig (a tengely nem nulláról indul)</p></div></div><div class="cv"><canvas id="wf" role="img" aria-label="Eredmény bontása"></canvas></div></div>
    <div class="card"><div class="card-h"><div><h2>Legnagyobb mozgások</h2><p class="sub">Nyitott pozíciók, a bekerüléshez képest</p></div></div>
      <div class="list">${movers.map(p => `<button class="li" data-t="${p.tkr}"><span class="tk">${p.tkr}</span><span><div class="n">${esc(nm(p.tkr))}</div><div class="s num">${money(p.value)}${p.dayChg != null ? ` · ma ${pct(p.dayChg)}` : ''}</div></span><span class="r num ${cls(p.pnl)}">${money(p.pnl, { sign: true })}<div class="s ${cls(p.pnl)}">${pct(p.pct)}</div></span></button>`).join('')}</div></div>
  </section>`;
};
V.attekintes.after = m => {
  const pts = rangePoints(); const a = pts[0], z = pts[pts.length - 1];
  const head = i => {
    const p = i == null ? z : pts[i];
    const res = (p.value - p.invested) - (a.value - a.invested), pc = (p.nav / a.nav - 1) * 100;
    const rl = RANGES.find(r => r[0] === S.range);
    $('hv').innerHTML = moneyHTML(i == null ? m.value : p.value);
    $('hc').innerHTML = `<span class="${cls(res)}">${arr(res)} ${money(res, { sign: true })} (${pct(pc)})</span><small>${i == null ? (S.range === 'all' ? 'kezdés óta' : 'az elmúlt ' + rl[1]) : dShort(p.d) + (p.spyIdx && a.spyIdx && S.bench ? ` · S&P ${pct((p.spyIdx / a.spyIdx - 1) * 100)}` : '')}</small>`;
  };
  head(null);
  stockChart($('sc'), pts, head, { animate: animNext }); animNext = false;
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { S.range = b.dataset.r; store.set('bf-range', S.range); animNext = true; render(true); });
  document.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { S.mode = b.dataset.mo; store.set('bf-mode', S.mode); animNext = true; render(true); });
  $('benchBtn').onclick = () => { S.bench = !S.bench; store.set('bf-bench', S.bench); render(true); };
  const tk = $('tipKey'); if (tk) tk.onclick = e => { e.preventDefault(); openSettings(); };
  // vízesés
  const steps = [];
  steps.push(['Befizetve', m.dep, 1]);
  steps.push(['Realizált', m.realized], ['Nem realizált', m.unreal], ['Osztalék', m.divNet], ['Egyéb', m.other], ['Mai érték', m.value, 1]);
  let run = 0; const data = steps.map(([l, v, b]) => { if (b) { run = v; return [0, v * K()]; } const s = run; run += v; return [s * K(), run * K()]; });
  const vals = data.flat().filter(v => v > 0); const lo = Math.min(...vals), hi = Math.max(...vals);
  const SH = { 'Befizetve': 'Befiz.', 'Árfolyamhatás': 'Árf.', 'Realizált': 'Real.', 'Nem realizált': 'Nyitott', 'Osztalék': 'Oszt.', 'Egyéb': 'Egyéb', 'Mai érték': 'Ma' };
  chart('wf', { type: 'bar', data: { labels: steps.map(s => innerWidth < 600 ? SH[s[0]] : s[0]), datasets: [{ data, backgroundColor: steps.map(([l, v, b]) => b ? css('--accent') : v >= 0 ? css('--gain') : css('--loss')), borderRadius: 4, borderSkipped: false, barPercentage: .7 }] },
    options: { scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, font: { size: 10.5 } } }, y: { min: lo * 0.97, max: hi * 1.01, grid: grid(), border: { display: false }, ticks: axisMoney() } },
      plugins: { tooltip: { callbacks: { title: i => steps[i[0].dataIndex][0], label: c => { const s = steps[c.dataIndex]; return s[2] ? money(s[1]) : money(s[1], { sign: true }); } } } } } });
  bindTickers();
};

V.portfolio = m => {
  const P = [...m.positions].sort((a, b) => b.value - a.value); const tot = sum(P, p => p.value);
  return `
  <section class="card"><div class="card-h"><div><h2>Hőtérkép</h2><p class="sub">Méret = mai érték, szín = eredmény a bekerüléshez képest. Koppints egy részvényre.</p></div></div>
    <div class="tm" id="tm"></div><div class="legend"><span>−40%</span><i></i><span>+40%</span></div></section>
  <section class="card"><div class="card-h"><div><h2>Pozíciók</h2><p class="sub">${P.length} részvény · készpénz ${money(m.cashUsd)}</p></div></div>
    <div class="tw"><table><thead><tr><th>Részvény</th><th>Súly</th><th>Ár</th><th>Ma</th><th>Érték</th><th>Eredmény</th><th>%</th></tr></thead><tbody>
    ${P.map(p => `<tr class="click" data-t="${p.tkr}"><td><b>${p.tkr}</b> <span style="color:var(--muted)">${esc(nm(p.tkr))}</span></td><td class="num">${nf(p.value / tot * 100, 1)}%</td><td class="num">${usd(p.price)}</td><td class="num ${cls(p.dayChg || 0)}">${p.dayChg != null ? pct(p.dayChg) : '–'}</td><td class="num">${money(p.value)}</td><td class="num ${cls(p.pnl)}">${money(p.pnl, { sign: true })}</td><td class="num ${cls(p.pnl)}">${pct(p.pct)}</td></tr>`).join('')}
    </tbody></table></div></section>`;
};
V.portfolio.after = m => {
  const el = $('tm'); const W = el.clientWidth, H = el.clientHeight;
  const rects = squarify([...m.positions].sort((a, b) => b.value - a.value).map(p => ({ ...p, v: p.value })), 0, 0, W, H);
  el.innerHTML = rects.map(r => { const t = Math.max(-1, Math.min(1, r.pct / 40)); const c = t >= 0 ? `color-mix(in oklab,var(--gain) ${Math.round(t * 70)}%,var(--tile))` : `color-mix(in oklab,var(--loss) ${Math.round(-t * 70)}%,var(--tile))`;
    const small = r.w < 70 || r.h < 48;
    return `<button class="tile" data-t="${r.tkr}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:${c}" aria-label="${r.tkr} ${pct(r.pct)}"><b>${r.tkr}</b>${small ? '' : `<span class="num">${pct(r.pct)}<br>${money(r.value)}</span>`}</button>`; }).join('');
  bindTickers();
};
function squarify(items, x, y, w, h) {
  const out = []; const total = sum(items, i => i.v); if (!total) return out; let rest = items.map(i => ({ ...i, a: i.v * w * h / total }));
  const worst = (row, s) => { const a = row.reduce((t, r) => t + r.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(s * s * mx / (a * a), a * a / (s * s * mn)); };
  while (rest.length) { const s = Math.min(w, h); let row = [rest[0]], i = 1;
    while (i < rest.length && worst([...row, rest[i]], s) <= worst(row, s)) { row.push(rest[i]); i++; }
    const a = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) { const cw = a / h; let cy = y; row.forEach(r => { const rh = r.a / cw; out.push({ ...r, x, y: cy, w: cw, h: rh }); cy += rh; }); x += cw; w -= cw; }
    else { const rh = a / w; let cx = x; row.forEach(r => { const rw = r.a / rh; out.push({ ...r, x: cx, y, w: rw, h: rh }); cx += rw; }); y += rh; h -= rh; }
    rest = rest.slice(i); }
  return out;
}

V.eredmenyek = m => {
  const rows = S.rmode === 'closed' ? m.closed.map(c => ({ tkr: c.tkr, total: c.pnl, date: c.date, pct: c.pct })) : m.T.map(t => ({ tkr: t.tkr, total: t.total, t }));
  const big = rows.filter(r => Math.abs(r.total) >= S.thr), small = rows.filter(r => Math.abs(r.total) < S.thr);
  const win = big.filter(r => r.total > 0).sort((a, b) => b.total - a.total), lose = big.filter(r => r.total < 0).sort((a, b) => a.total - b.total);
  const card = (t, a) => `<div class="card"><div class="card-h"><h2>${t}</h2></div><div class="list">${a.length ? a.slice(0, 5).map(r => `<button class="li" data-t="${r.tkr}"><span class="tk">${r.tkr}</span><span><div class="n">${esc(nm(r.tkr))}</div><div class="s">${r.date ? dhu(r.date) + ' eladás' : r.t.open ? 'nyitott pozíció' : 'lezárva'}</div></span><span class="r num ${cls(r.total)}">${money(r.total, { sign: true })}${r.pct != null ? `<div class="s ${cls(r.total)}">${pct(r.pct)}</div>` : ''}</span></button>`).join('') : '<div class="empty">Nincs ilyen tétel a szűrő mellett.</div>'}</div></div>`;
  return `
  <section class="card"><div class="ctrls">
    <div class="seg" role="group" aria-label="Mit számoljon"><button data-m="all" aria-pressed="${S.rmode === 'all'}">Részvényenként</button><button data-m="closed" aria-pressed="${S.rmode === 'closed'}">Lezárt eladások</button></div>
    <label for="thr" style="font-size:.88rem">Kis tételek elrejtése: ±<b class="num" id="thrv">${S.thr.toFixed(1)}</b> USD alatt</label><input type="range" id="thr" min="0" max="10" step="0.5" value="${S.thr}">
  </div></section>
  <section class="grid">${card('Legnagyobb nyereségek', win)}${card('Legnagyobb veszteségek', lose)}</section>
  <section class="card"><div class="card-h"><div><h2>${S.rmode === 'all' ? 'Eredmény részvényenként' : 'Lezárt eladások'}</h2><p class="sub">${S.rmode === 'all' ? 'Realizált + nem realizált + osztalék. Koppints egy sávra.' : 'Átlagos bekerülési áron, díjjal együtt'}</p></div></div>
    <div class="cv" style="height:${Math.max(240, big.length * 30 + 40)}px"><canvas id="rb" role="img" aria-label="Eredmény részvényenként"></canvas></div>
    <p class="sub" style="margin-top:10px">${small.length ? `Elrejtve ${small.length} kis tétel, összesen ${money(sum(small, r => r.total), { sign: true })}: ${small.map(r => r.tkr).join(', ')}.` : 'Nincs elrejtett tétel.'}</p></section>`;
};
V.eredmenyek.after = m => {
  const rows = (S.rmode === 'closed' ? m.closed.map(c => ({ tkr: c.tkr, total: c.pnl, lab: c.tkr + ' · ' + c.date.slice(2).replace(/-/g, '.') })) : m.T.map(t => ({ tkr: t.tkr, total: t.total, lab: t.tkr, t }))).filter(r => Math.abs(r.total) >= S.thr).sort((a, b) => b.total - a.total);
  chart('rb', { type: 'bar', data: { labels: rows.map(r => r.lab), datasets: [{ data: rows.map(r => r.total * K()), backgroundColor: rows.map(r => css(r.total >= 0 ? '--gain' : '--loss')), borderRadius: 4, barPercentage: .75 }] },
    options: { indexAxis: 'y', onClick: (e, els) => { if (els[0]) openTicker(rows[els[0].index].tkr); },
      scales: { x: { grid: grid(), border: { display: false }, ticks: axisMoney() }, y: { grid: { display: false }, ticks: { color: css('--ink') } } },
      plugins: { tooltip: { callbacks: { title: i => nm(rows[i[0].dataIndex].tkr), label: c => money(c.raw / K(), { sign: true }), afterLabel: c => { const t = rows[c.dataIndex].t; return t ? [`Realizált ${money(t.real, { sign: true })}`, `Nem realizált ${money(t.unreal, { sign: true })}`, `Osztalék ${money(t.div, { sign: true })}`] : ''; } } } } } });
  bindTickers();
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.rmode = b.dataset.m; render(true); });
  const thr = $('thr'); thr.oninput = () => { $('thrv').textContent = (+thr.value).toFixed(1); }; thr.onchange = () => { S.thr = +thr.value; render(true); $('thr').focus(); };
};

V.sp500 = m => {
  const last = m.series[m.series.length - 1];
  if (!market.history.SPY || last.spyVal == null) return `
    <section class="card"><h2>Mi lett volna, ha mindent S&P 500-ba teszel?</h2><p class="sub">Minden befizetést ugyanazon a napon SPY-ba fektetve, a mai áron értékelve.</p></section>
    <div class="empty">Ehhez élő árfolyam kell. ${apiKey ? 'Az SPY árai még nem töltődtek le, nyomd meg a frissítés gombot.' : '<a href="#" id="spKey">Add meg az ingyenes Twelve Data kulcsot</a>, és az összehasonlítás magától elkészül.'}</div>`;
  const spy = Engine.asOfLookup(market.history.SPY);
  const rows = m.flows.map(f => { const c = spy(f.date); return { ...f, close: c, val: c ? f.usd / c * spy(M.today) : 0 }; });
  const sv = sum(rows, r => r.val), sres = sv - m.dep, diff = m.value - sv;
  const nav = last.nav, sidx = last.spyIdx;
  return `
  <section class="grid">
    <div class="card"><div class="lbl-s">A portfóliód</div><div class="big num">${money(m.value)}</div><div class="pill ${cls(m.result)}">${arr(m.result)} <span class="num">${money(m.result, { sign: true })}</span> · ${pct(m.result / m.dep * 100)}</div><p class="sub" style="margin-top:8px">Árfolyamhozam (befizetések nélkül): <b class="num ${cls(nav - 100)}">${pct(nav - 100)}</b></p></div>
    <div class="card"><div class="lbl-s">Ugyanez S&P 500-ban</div><div class="big num">${money(sv)}</div><div class="pill ${cls(sres)}">${arr(sres)} <span class="num">${money(sres, { sign: true })}</span> · ${pct(sres / m.dep * 100)}</div><p class="sub" style="margin-top:8px">S&P 500 ugyanebben az időszakban: <b class="num ${cls(sidx - 100)}">${pct(sidx - 100)}</b></p></div>
  </section>
  <div class="tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><p>${diff >= 0 ? `<b>${money(diff)}</b>-ral jobban állsz, mintha indexbe fektettél volna.` : `Az index <b>${money(-diff)}</b>-ral többet hozott volna.`} Az S&P-számítás osztalék nélküli árfolyamhozam (SPY ETF).</p></div>
  <section class="card"><div class="card-h"><div><h2>Befizetésenként</h2><p class="sub">Mennyit érne ma az adott befizetés SPY-ban</p></div></div><div class="cv"><canvas id="sp" role="img" aria-label="Befizetések értéke SPY-ban"></canvas></div></section>`;
};
V.sp500.after = m => {
  const k = $('spKey'); if (k) k.onclick = e => { e.preventDefault(); openSettings(); };
  if (!market.history.SPY) return;
  const spy = Engine.asOfLookup(market.history.SPY);
  const rows = m.flows.map(f => { const c = spy(f.date); return { ...f, val: c ? f.usd / c * spy(M.today) : 0 }; });
  chart('sp', { type: 'bar', data: { labels: rows.map(r => dhu(r.date)), datasets: [{ label: 'Befizetve', data: rows.map(r => r.usd * K()), backgroundColor: css('--tile'), borderRadius: 4 }, { label: 'Ma SPY-ban', data: rows.map(r => r.val * K()), backgroundColor: css('--accent'), borderRadius: 4 }] },
    options: { scales: { x: { grid: { display: false } }, y: { grid: grid(), border: { display: false }, ticks: axisMoney() } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, color: css('--ink') } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + money(c.raw / K()) } } } } });
};

V.koltsegek = m => {
  const kinds = [['exec', 'Végrehajtás', '0,10 $ vagy 0,1% ügyletenként'], ['dep', 'Befizetés', '0,6% a befizetésekre'], ['fx', 'Átváltás', 'kb. 0,35% a forint átváltásra']].map(k => [...k, sum(m.fees.filter(f => f.kind === k[0]), f => f.usd)]);
  const mx = Math.max(...kinds.map(k => k[3]), 0.01);
  const us = m.divs.filter(r => (r.isin || '').startsWith('US')); const save = sum(us, r => r.taxUsd) - sum(us, r => r.grossUsd) * 0.15;
  const trades = m.tx.filter(r => r.type === 'B' || r.type === 'S');
  const drag = m.fees.filter(f => f.kind === 'exec').map(f => ({ ...f, p: f.r.gross ? f.r.fee / f.r.gross * 100 : 0 })).sort((a, b) => b.p - a.p).slice(0, 5);
  return `
  <section class="grid">
    <div class="card"><div class="lbl-s">Összes díj</div><div class="big num neg">${money(-m.feeUsd, { sign: true })}</div><p class="sub" style="margin-top:8px">A befizetett összeg ${nf(m.feeUsd / m.dep * 100, 2)}%-a, ${trades.length} ügylet és ${m.flows.length} befizetés után.</p></div>
    <div class="card"><div class="list">${kinds.map(k => `<div style="padding:8px 0"><div style="display:flex;justify-content:space-between;gap:10px;font-size:.9rem"><span>${k[1]} <span class="sub" style="display:inline">· ${k[2]}</span></span><b class="num">${money(k[3])}</b></div><div style="height:6px;border-radius:3px;background:var(--surface-2);margin-top:6px"><div style="height:100%;width:${k[3] / mx * 100}%;background:var(--loss);border-radius:3px;opacity:.85"></div></div></div>`).join('')}</div></div>
  </section>
  ${save > 0.01 ? `<div class="tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><p><b>W-8BEN nyilatkozat.</b> Az amerikai osztalékokból 30% forrásadót vontak le. A W-8BEN kitöltésével a Lightyearnél 15% lenne, eddig ez kb. <b class="num">${money(save)}</b> különbség. A NAV-os bejelentés ezt nem helyettesíti.</p></div>` : ''}
  <section class="card"><div class="card-h"><div><h2>Arányaiban legdrágább ügyletek</h2><p class="sub">Kis összegnél a fix 0,10 $ díj nagy arányt visz el</p></div></div>
    <div class="tw"><table><thead><tr><th>Ügylet</th><th>Forgalom</th><th>Díj</th><th>Arány</th></tr></thead><tbody>
    ${drag.map(f => `<tr><td><b>${f.r.tkr}</b> <span class="tag">${f.r.type === 'B' ? 'vétel' : 'eladás'}</span> <span class="sub" style="display:inline">${dhu(f.date)}</span></td><td class="num">${usd(f.r.gross * (f.usd / f.r.fee))}</td><td class="num neg">${usd(f.usd)}</td><td class="num neg">${nf(f.p, 2)}%</td></tr>`).join('')}</tbody></table></div></section>
  <section class="card"><div class="card-h"><div><h2>Osztalékok</h2><p class="sub">Bruttó ${money(m.divGross)} · adó ${money(m.divTax)} · nettó ${money(m.divNet)}</p></div></div><div class="cv" style="height:220px"><canvas id="dv" role="img" aria-label="Osztalék részvényenként"></canvas></div></section>`;
};
V.koltsegek.after = m => {
  const by = {}; m.divs.forEach(r => { const x = by[r.tkr] = by[r.tkr] || { n: 0, t: 0 }; x.n += r.netUsd; x.t += r.taxUsd; });
  const rows = Object.entries(by).sort((a, b) => (b[1].n + b[1].t) - (a[1].n + a[1].t));
  chart('dv', { type: 'bar', data: { labels: rows.map(r => r[0]), datasets: [{ label: 'Nettó', data: rows.map(r => r[1].n * K()), backgroundColor: css('--gain'), borderRadius: 3 }, { label: 'Levont adó', data: rows.map(r => r[1].t * K()), backgroundColor: css('--loss'), borderRadius: 3 }] },
    options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: grid(), border: { display: false }, ticks: { callback: v => S.cur === 'HUF' ? nf(v) + ' Ft' : '$' + v } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, color: css('--ink') } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + money(c.raw / K()) } } } } });
};

const TY = { B: 'Vétel', S: 'Eladás', D: 'Osztalék', DEP: 'Befizetés', FX: 'Átváltás', WD: 'Kifizetés' };
V.naplo = () => `
  <section class="card"><div class="ctrls">
    <input type="search" id="q" placeholder="Keresés tickerre vagy névre" value="${esc(S.q)}" aria-label="Keresés">
    <div class="chips">${[['all', 'Mind'], ...Object.entries(TY).filter(([k]) => k !== 'WD')].map(([k, v]) => `<button class="chip" data-ty="${k}" aria-pressed="${S.txType === k}">${v}</button>`).join('')}</div>
  </div></section>
  <section class="card" id="log"></section>`;
V.naplo.after = m => {
  const draw = () => {
    const q = S.q.trim().toUpperCase();
    const rows = [...m.tx].filter(r => (S.txType === 'all' || r.type === S.txType) && (!q || (r.tkr || '').toUpperCase().includes(q) || nm(r.tkr).toUpperCase().includes(q))).reverse();
    const f = (r, v) => r.ccy === 'HUF' ? nf(v) + ' Ft' : r.ccy === 'EUR' ? nf(v, 2) + ' €' : usd(v);
    let last = '', html = '';
    rows.forEach(r => {
      const mo = r.date.slice(0, 7); if (mo !== last) { last = mo; html += `<div class="month">${['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'][+mo.slice(5) - 1]} ${mo.slice(0, 4)}</div>`; }
      const trade = r.type === 'B' || r.type === 'S' || r.type === 'D';
      const amt = r.type === 'D' || r.type === 'S' ? f(r, r.net) : f(r, Math.abs(r.gross));
      const sign = r.type === 'B' || (r.type === 'FX' && r.gross < 0) || r.type === 'WD' ? 'neg' : r.type === 'FX' ? '' : 'pos';
      const sub = r.type === 'B' || r.type === 'S' ? `${nf(r.qty, 4)} db · ${f(r, r.price)}` : r.type === 'D' ? `bruttó ${f(r, r.gross)} · adó ${f(r, r.tax)}` : r.fee ? `díj ${f(r, r.fee)}` : 'díjmentes';
      const tk = r.type === 'FX' ? r.ccy : !r.tkr ? (r.ccy === 'HUF' ? 'Ft' : '$') : r.tkr;
      html += `<button class="li" ${trade ? `data-t="${esc(r.tkr)}"` : ''}><span class="tk">${esc(tk)}</span><span><div class="n">${TY[r.type]}${trade ? ' · ' + esc(nm(r.tkr)) : ''}</div><div class="s">${dhu(r.date)} · ${sub} <span class="tag">${esc(r.label || r.acct)}</span></div></span><span class="r num ${sign}">${sign === 'neg' ? '−' : sign === 'pos' ? '+' : ''}${amt}</span></button>`;
    });
    const el = $('log'); el.innerHTML = html ? `<div class="list">${html}</div>` : '<div class="empty">Nincs találat.</div>';
    bindTickers(el);
  };
  draw();
  $('q').oninput = e => { S.q = e.target.value; draw(); };
  document.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { S.txType = b.dataset.ty; document.querySelectorAll('[data-ty]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
};

/* ---------- onboarding ---------- */
function onboarding() {
  $('bar').hidden = true; $('bnav').hidden = true;
  $('main').innerHTML = `
  <section class="onb">
    <div class="brand" style="font-size:1.3rem"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--ink)"/><path d="M8 21l5-6 4 3 7-8" stroke="var(--bg)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Befektetés</div>
    <h1>Lásd egyben az összes befektetésedet.</h1>
    <p class="sub" style="font-size:1rem">Töltsd be a Lightyear számlakivonataidat (PDF). Az app a telefonodon dolgozza fel őket, semmit nem küld el sehova.</p>
    <div class="drop" id="drop" role="button" tabindex="0"><b>Kivonatok kiválasztása</b><div class="sub">Akár több PDF egyszerre, például TBSZ 2025 és TBSZ 2026</div></div>
    <ol class="steps">
      <li><b>1</b><span>A Lightyear appban kérd le a számlakivonatot (PDF) minden számládra, a nyitástól máig.</span></li>
      <li><b>2</b><span>Töltsd be ide a PDF-et. Új kivonattal bármikor frissítheted a tranzakciókat.</span></li>
      <li><b>3</b><span>Élő árfolyamokhoz add meg az ingyenes Twelve Data kulcsot a beállításokban.</span></li>
    </ol>
  </section>`;
  const d = $('drop'); d.onclick = () => $('fileIn').click(); d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileIn').click(); } };
  d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); importFiles([...e.dataTransfer.files]); };
}

/* ---------- import ---------- */
async function importFiles(files) {
  files = files.filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)); if (!files.length) return;
  toast('Kivonat feldolgozása…', 1500);
  try {
    await loadScript(CDN.pdf); window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  } catch (e) { toast('A PDF-olvasó nem töltődött be. Ellenőrizd az internetkapcsolatot.'); return; }
  const msgs = [];
  for (const f of files) {
    try {
      const st = LYParser.parse(await LYParser.linesFromPdf(window.pdfjsLib, new Uint8Array(await f.arrayBuffer())));
      if (!st.acct || !st.rows.length) { msgs.push(`${f.name}: nem Lightyear számlakivonat.`); continue; }
      mergeStatement(st); msgs.push(`${st.label || st.acct}: ${st.rows.length} tétel`);
    } catch (e) { msgs.push(`${f.name}: nem sikerült beolvasni.`); }
  }
  statements.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  store.set('bf-st', statements); compute(); boot(); toast('Betöltve: ' + msgs.join(' · '), 4500);
  refresh();
}
function mergeStatement(st) {
  const i = statements.findIndex(s => s.acct === st.acct);
  if (i < 0) { statements.push(st); return; }
  const old = statements[i];
  const keep = old.rows.filter(r => r.date < st.from || r.date > st.to);
  const rows = [...keep, ...st.rows].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order);
  rows.forEach((r, k) => r.order = k + 1);
  const newer = st.to >= old.to ? st : old;
  statements[i] = { ...newer, from: old.from < st.from ? old.from : st.from, to: newer.to, rows };
}

/* ---------- sheets ---------- */
function sheet(html) {
  const root = $('sheetRoot'); const prev = document.activeElement;
  root.innerHTML = `<div class="scrim" data-close></div><aside class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</aside>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', k); prev && prev.focus && prev.focus(); };
  const k = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', k);
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  root.querySelector('.sheet').focus();
  return { root, close };
}
function bindTickers(scope) { (scope || document).querySelectorAll('[data-t]').forEach(b => b.onclick = () => openTicker(b.dataset.t)); }
function openTicker(t) {
  const m = M; const p = m.positions.find(x => x.tkr === t); const tk = m.T.find(x => x.tkr === t) || { real: 0, unreal: 0, div: 0, total: 0 };
  const tx = m.tx.filter(r => r.tkr === t).reverse();
  const h = market.history[t]; const hd = h ? Object.keys(h).sort() : [];
  sheet(`<div class="sheet-h"><div><div class="lbl-s">${esc(t)}</div><h2 style="font-size:1.4rem">${esc(nm(t))}</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    ${p ? `<div><div class="big num" style="font-size:2rem">${money(p.value)}</div><div class="pill ${cls(p.pnl)}">${arr(p.pnl)} ${money(p.pnl, { sign: true })} · ${pct(p.pct)}</div></div>
    <dl class="kv"><dt>Mennyiség</dt><dd class="num">${nf(p.qty, 4)} db</dd><dt>Átlagos bekerülés</dt><dd class="num">${usd(p.cost / p.qty)}</dd><dt>Mai ár</dt><dd class="num">${usd(p.price)}${p.dayChg != null ? ` <span class="${cls(p.dayChg)}">${pct(p.dayChg)}</span>` : ''}</dd><dt>Bekerülési érték</dt><dd class="num">${money(p.cost)}</dd></dl>`
    : `<div class="pill ${cls(tk.total)}" style="align-self:flex-start">Lezárt pozíció · ${money(tk.total, { sign: true })}</div>`}
    ${hd.length > 5 ? `<div class="chart" style="height:160px;margin:0"><canvas id="tkc" aria-label="${esc(t)} árfolyam"></canvas></div>` : ''}
    <dl class="kv"><dt>Realizált</dt><dd class="num ${cls(tk.real)}">${money(tk.real, { sign: true })}</dd><dt>Nem realizált</dt><dd class="num ${cls(tk.unreal)}">${money(tk.unreal, { sign: true })}</dd><dt>Osztalék (nettó)</dt><dd class="num pos">${money(tk.div, { sign: true })}</dd><dt><b>Összesen</b></dt><dd class="num ${cls(tk.total)}"><b>${money(tk.total, { sign: true })}</b></dd></dl>
    <div><h2 style="font-size:.95rem;margin-bottom:6px">Tranzakciók</h2><div class="list">${tx.map(r => `<div class="li" style="cursor:default"><span class="tag">${TY[r.type]}</span><span class="s">${dhu(r.date)}${r.qty ? ' · ' + nf(r.qty, 4) + ' db @ ' + (r.ccy === 'EUR' ? nf(r.price, 2) + ' €' : usd(r.price)) : ''}</span><span class="r num">${r.ccy === 'EUR' ? nf(r.type === 'D' ? r.net : r.gross, 2) + ' €' : usd(r.type === 'D' ? r.net : r.gross)}</span></div>`).join('')}</div></div>`);
  const c = $('tkc');
  if (c) { // mini árfolyamgrafikon a vételi/eladási pontokkal
    const first = tx.length ? tx[tx.length - 1].date : hd[0]; const ds = hd.filter(d => d >= Engine.addDays(first, -7));
    const pts = ds.map(d => ({ d, value: h[d], invested: 0, nav: h[d] }));
    stockChart(c, pts, () => {}, { price: true, animate: true });
  }
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
function openSettings() {
  const s = sheet(`<div class="sheet-h"><div><div class="lbl-s">Beállítások</div><h2 style="font-size:1.3rem">Adatok és frissítés</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    <div class="field"><label>Kivonatok</label>
      <div class="list">${statements.map((st, i) => `<div class="li" style="cursor:default"><span class="tk">${esc((st.label || '').slice(-2) || 'LY')}</span><span><div class="n">${esc(st.label || st.acct)}</div><div class="s">${esc(st.acct)} · ${dhu(st.from)}–${dhu(st.to)} · ${st.rows.length} tétel</div></span><button class="ibtn" data-del="${i}" aria-label="Törlés">✕</button></div>`).join('')}</div>
      <button class="btn ghost" id="addSt">Kivonat hozzáadása vagy frissítése (PDF)</button>
      <p class="sub">Ugyanannak a számlának az újabb kivonata felülírja az érintett időszak tételeit, így nem lesz duplikáció.</p></div>
    <div class="field"><label for="key">Twelve Data API-kulcs (élő árfolyamok)</label>
      <input type="password" id="key" value="${esc(apiKey)}" placeholder="pl. 1a2b3c…" autocomplete="off" spellcheck="false">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="saveKey">Mentés és frissítés</button><button class="btn ghost" id="reload">Előzmények újratöltése</button></div>
      <p class="sub">Ingyenes kulcs: <a href="https://twelvedata.com/register" target="_blank" rel="noopener">twelvedata.com/register</a>, utána a Dashboard → API Keys oldalon. Az ingyenes keret percenként 8, naponta 800 lekérést enged; az első letöltés ezért kb. 2–3 percig tart. Az USD/HUF árfolyam az Európai Központi Bank adataiból jön, kulcs nélkül.</p></div>
    <div class="field"><label>Megjelenés</label><div class="seg" role="group" aria-label="Téma">${[['auto', 'Rendszer'], ['light', 'Világos'], ['dark', 'Sötét']].map(([k, l]) => `<button data-th="${k}" aria-pressed="${S.theme === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label>Telepítés</label>${installEvt ? '<button class="btn ghost" id="install">App telepítése a kezdőképernyőre</button>' : ''}<p class="sub">Androidon a Chrome menüjében (⋮) válaszd a „Hozzáadás a kezdőképernyőhöz” vagy „App telepítése” lehetőséget. iPhone-on a Safari Megosztás gombja → „Főképernyőhöz adás”.</p></div>
    <div class="field"><label>Adatok törlése</label><button class="btn danger" id="wipe">Minden adat törlése erről a készülékről</button></div>`);
  $('addSt').onclick = () => { s.close(); $('fileIn').click(); };
  s.root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const i = +b.dataset.del; if (b.dataset.sure) { statements.splice(i, 1); store.set('bf-st', statements); s.close(); compute(); boot(); } else { b.dataset.sure = 1; b.textContent = 'Biztos?'; } });
  $('saveKey').onclick = () => { apiKey = $('key').value.trim(); store.set('bf-key', apiKey); s.close(); drawStatus(); refresh(); };
  $('reload').onclick = () => { market.history = {}; store.set('bf-mkt', market); s.close(); refresh({ force: true }); };
  s.root.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { S.theme = b.dataset.th; store.set('bf-theme', S.theme); applyTheme(); s.root.querySelectorAll('[data-th]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const ib = $('install'); if (ib) ib.onclick = async () => { installEvt.prompt(); installEvt = null; s.close(); };
  $('wipe').onclick = e => { const b = e.currentTarget; if (b.dataset.sure) { ['bf-st', 'bf-mkt', 'bf-key'].forEach(store.del); statements = []; market = { history: {}, fx: {}, usdhuf: null, updatedAt: 0 }; apiKey = ''; s.close(); compute(); boot(); } else { b.dataset.sure = 1; b.textContent = 'Biztosan törlöd? Koppints újra.'; } };
}

/* ---------- chrome ---------- */
const ICON_T = { auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>', light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>', dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' };
const T_LBL = { auto: 'Rendszer', light: 'Világos', dark: 'Sötét' };
function applyTheme() {
  const r = document.documentElement; S.theme === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', S.theme);
  const b = $('themeBtn'); b.innerHTML = ICON_T[S.theme]; b.setAttribute('aria-label', 'Téma: ' + T_LBL[S.theme]);
  requestAnimationFrame(() => { $('themeColor').setAttribute('content', css('--bg')); });
}
function drawCur() { $('cHUF').setAttribute('aria-pressed', S.cur === 'HUF'); $('cUSD').setAttribute('aria-pressed', S.cur === 'USD'); }
function drawNav() {
  const a = (k, l, i, mob) => `<a href="#${k}" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${mob ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${i}"/></svg>${l.split(' ')[0]}` : l}</a>`;
  $('tabs').innerHTML = TABS.map(t => a(...t, false)).join('');
  $('bnav').innerHTML = TABS.map(t => a(...t, true)).join('');
  document.querySelectorAll('[data-tab]').forEach(x => x.onclick = e => { e.preventDefault(); S.tab = x.dataset.tab; try { history.replaceState(null, '', '#' + S.tab); } catch (_) {} drawNav(); render(); window.scrollTo({ top: 0 }); });
}
function render(keep) {
  if (!M) return;
  charts.forEach(c => c.destroy()); charts = [];
  if (!V[S.tab]) S.tab = 'attekintes';
  const y = window.scrollY;
  $('main').innerHTML = V[S.tab](M);
  V[S.tab].after && V[S.tab].after(M);
  if (keep) window.scrollTo({ top: y });
}
function boot() {
  if (!statements.length) { onboarding(); return; }
  $('bar').hidden = false; $('bnav').hidden = false;
  drawNav(); drawCur(); drawStatus(); render();
}

$('themeBtn').onclick = () => { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme]; store.set('bf-theme', S.theme); applyTheme(); };
$('cHUF').onclick = () => { S.cur = 'HUF'; store.set('bf-cur', 'HUF'); drawCur(); render(true); };
$('cUSD').onclick = () => { S.cur = 'USD'; store.set('bf-cur', 'USD'); drawCur(); render(true); };
$('refreshBtn').onclick = () => refresh();
$('setBtn').onclick = openSettings;
$('fileIn').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => render(true), 150); });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (V[h] && h !== S.tab) { S.tab = h; drawNav(); render(); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); render(true); });
new MutationObserver(() => render(true)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.addEventListener('online', () => refresh());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (market.updatedAt || 0) > REFRESH_MS) refresh(); });
setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - (market.updatedAt || 0) > REFRESH_MS) refresh(); }, 60 * 1000);

applyTheme(); compute(); boot();
if (statements.length && Date.now() - (market.updatedAt || 0) > REFRESH_MS) refresh();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__bf = { importFiles, refresh, get M() { return M; } };
})();
