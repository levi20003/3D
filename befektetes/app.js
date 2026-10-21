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
  tab: 'attekintes', cur: store.get('bf-cur2', 'USD'), theme: store.get('bf-theme', 'auto'),
  range: store.get('bf-range', 'all'), mode: store.get('bf-mode', 'idx'), bench: store.get('bf-bench', true),
  hide: store.get('bf-hide', false), tr: 'all', ps: store.get('bf-ps', 'value'), scroll: {}, an: store.get('bf-an', 'trend'), hm: store.get('bf-hm', 'all'), bd: store.get('bf-bd', 'sector'), thr: 2, rmode: 'all', txType: 'all', q: '', busy: false, statusText: ''
};
const OLDTAB = { eredmenyek: 'eredmeny', sp500: 'sp', koltsegek: 'koltseg' };
try { const h = location.hash.slice(1); if (OLDTAB[h]) { S.tab = 'elemzes'; S.an = OLDTAB[h]; } else if (h) S.tab = h; } catch (e) {}
let M = null;

/* ---------- utils ---------- */
const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const nf = (n, d = 0) => (n || 0).toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: d });
const R = () => M ? M.R : 330;
const K = () => S.cur === 'HUF' ? R() : 1;
const money = (usd, o = {}) => { if (S.hide) return '••••'; const s = o.sign && usd > 0.0049 ? '+' : usd < -0.0049 ? '−' : ''; return S.cur === 'HUF' ? s + nf(Math.abs(usd * R())) + ' Ft' : s + '$' + nf(Math.abs(usd), o.d ?? 2); };
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
const moneyHTML = v => S.hide ? '••••••' : S.cur === 'HUF' ? `${(v < -0.0049 ? '−' : '') + nf(Math.abs(v * R()))}<span class="cur">Ft</span>` : `<span class="cur pre">$</span>${(v < -0.0049 ? '−' : '') + nf(Math.abs(v), 2)}`;
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
async function getJson(url) { let r; try { r = await fetch(url, { cache: 'no-store' }); } catch (e) { throw new Error('Hálózati hiba vagy letiltott kérés (' + (e.message || e) + ')'); } if (!r.ok && r.status !== 429) { let t = ''; try { t = (await r.text()).slice(0, 120); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ': ' + t : '')); } return r.json(); }

const diag = (k, v) => { market.diag = market.diag || {}; market.diag[k] = { at: Date.now(), ...v }; };
async function fetchFx() {
  if (!M) return;
  const first = M.tx[0].date; const have = Object.keys(market.fx).sort();
  const from = have.length ? Engine.addDays(have[have.length - 1], -3) : Engine.addDays(first, -7);
  const urls = [`https://api.frankfurter.dev/v1/${from}..?base=USD&symbols=HUF,EUR`, `https://api.frankfurter.app/${from}..?from=USD&to=HUF,EUR`];
  for (const u of urls) {
    try { const j = await getJson(u); if (j && j.rates) { Object.assign(market.fx, j.rates); diag('fx', { ok: true, msg: Object.keys(j.rates).length + ' nap' }); break; } else diag('fx', { ok: false, msg: JSON.stringify(j).slice(0, 160) }); } catch (e) { diag('fx', { ok: false, msg: e.message || String(e) }); }
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
  if (!force) { // frissítéskor csak a 8 legrégebben frissített, így nincs várakozás a kereten
    const fr = market.fetched = market.fetched || {};
    const fresh = jobs.filter(j => !market.history[j.s]);
    const inc = jobs.filter(j => market.history[j.s] && Date.now() - (fr[j.s] || 0) > 10 * 60e3).sort((a, b) => (fr[a.s] || 0) - (fr[b.s] || 0)).slice(0, Math.max(0, 8 - fresh.length));
    jobs.length = 0; jobs.push(...fresh, ...inc); jobs.sort((a, b) => a.start < b.start ? -1 : 1);
  }
  const errs = [];
  for (let i = 0; i < jobs.length; i += 8) {
    const batch = jobs.slice(i, i + 8); const start = batch[0].start;
    setStatus(`Árfolyamok letöltése ${Math.min(i + 8, jobs.length)}/${jobs.length}…`, 'busy');
    let tries = 0, j;
    for (;;) {
      await waitCredits(batch.length);
      const url = `https://api.twelvedata.com/time_series?symbol=${batch.map(b => encodeURIComponent(b.s)).join(',')}&interval=1day&start_date=${start}&order=asc&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`;
      j = await getJson(url);
      if (j && j.status === 'error' && (j.code === 429 || /credits|minute/i.test(j.message || '')) && tries++ < 3) { credits.length = 0; for (let k = 0; k < 8; k++) credits.push(Date.now()); continue; }
      break;
    }
    if (j && j.status === 'error') { if (j.code === 401 || /api ?key/i.test(j.message || '')) { diag('td', { ok: false, msg: j.message || 'Érvénytelen kulcs' }); throw new Error('Érvénytelen Twelve Data kulcs.'); } errs.push(j.message || 'hiba'); continue; }
    const per = batch.length === 1 ? { [batch[0].s]: j } : j;
    for (const b of batch) {
      const d = per[b.s];
      if (!d || d.status === 'error' || !Array.isArray(d.values)) { errs.push(b.s + ': ' + ((d && d.message) || 'nincs adat')); continue; }
      const h = market.history[b.s] = market.history[b.s] || {}; (market.fetched = market.fetched || {})[b.s] = Date.now();
      d.values.forEach(v => { const c = parseFloat(v.close); if (c > 0) h[v.datetime.slice(0, 10)] = c; });
    }
  }
  // S&P 500 tartalék: ha az SPY nem jön le az ingyenes csomagban, VOO / IVV / SPX
  if (!market.history.SPY || Object.keys(market.history.SPY).length < 5) {
    for (const alt of ['VOO', 'IVV', 'SPX']) {
      try { await waitCredits(1); const j = await getJson(`https://api.twelvedata.com/time_series?symbol=${alt}&interval=1day&start_date=${Engine.addDays(M.tx[0].date, -7)}&order=asc&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`);
        if (j && Array.isArray(j.values) && j.values.length > 5) { const h = market.history.SPY = {}; j.values.forEach(v => { const c = parseFloat(v.close); if (c > 0) h[v.datetime.slice(0, 10)] = c; }); market.benchSym = alt; (market.fetched = market.fetched || {}).SPY = Date.now(); break; }
        errs.push(alt + ': ' + ((j && j.message) || 'nincs adat')); } catch (e) { errs.push(alt + ': ' + e.message); }
    }
  } else if (!market.benchSym) market.benchSym = 'SPY';
  market.errors = errs;
  const nh = Object.keys(market.history).filter(k => Object.keys(market.history[k]).length > 1).length;
  diag('td', { ok: nh > 0, msg: `${nh} részvény előzménye megvan${errs.length ? ' · hibák: ' + errs.slice(0, 3).join('; ') : ''}` });
}

async function refresh(opts = {}) {
  if (S.busy || !statements.length) return;
  if (!navigator.onLine) { setStatus('Nincs internetkapcsolat, a legutóbbi adatokat látod.', 'off'); return; }
  S.busy = true; setStatus('Frissítés…', 'busy');
  try {
    compute(); await fetchFx(); compute();
    await fetchPrices(opts.force);
    compute(); await fetchCalendar(opts.force);
    market.updatedAt = Date.now(); store.set('bf-mkt', market);
    compute(); render(true); checkAlerts();
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
const moneyShort = (v, sign) => S.hide ? '' : (sign && v > 0.0049 ? '+' : v < -0.0049 ? '−' : '') + (S.cur === 'HUF' ? nf(Math.abs(v * R()) / 1000, Math.abs(v * R()) < 10000 ? 1 : 0) + 'e' : '$' + nf(Math.abs(v), Math.abs(v) < 100 ? 2 : 0));
const VL = { id: 'vl', afterDatasetsDraw(ch, _a, o) {
  if (!o || !o.fmt) return; const c = ch.ctx; c.save(); c.font = `700 10.5px ${getComputedStyle(document.body).fontFamily}`; c.fillStyle = css('--ink');
  ch.data.datasets.forEach((ds, di) => { if (o.only != null && o.only !== di) return; ch.getDatasetMeta(di).data.forEach((el, i) => {
    const v = ds.data[i]; const raw = Array.isArray(v) ? v[1] - v[0] : v; const t = o.fmt(raw, i, di); if (!t) return; const p = el.getProps(['x', 'y', 'base'], true);
    if (ch.options.indexAxis === 'y') { c.textAlign = raw >= 0 ? 'left' : 'right'; c.textBaseline = 'middle'; c.fillText(t, (raw >= 0 ? Math.max(p.x, p.base) : Math.min(p.x, p.base)) + (raw >= 0 ? 6 : -6), p.y); }
    else { c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(t, p.x, Math.min(p.y, p.base) - 4); } }); }); c.restore(); } };
function chart(id, cfg) {
  const el = $(id); if (!el) return;
  if (!window.Chart) { loadScript(CDN.chart).then(() => render(true)).catch(() => {}); return; }
  Chart.defaults.color = css('--muted'); Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.font.size = 12;
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, cfg.options || {});
  const tt = { backgroundColor: css('--surface'), titleColor: css('--ink'), bodyColor: css('--ink'), footerColor: css('--muted'), borderColor: css('--line'), borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4 };
  cfg.options.plugins = Object.assign({ legend: { display: false } }, cfg.options.plugins || {}); cfg.options.plugins.tooltip = Object.assign(tt, cfg.options.plugins.tooltip || {});
  if (!chart.reg) { Chart.register(VL); chart.reg = true; }
  cfg.options.layout = Object.assign({ padding: { top: 18, right: cfg.options.indexAxis === 'y' ? 56 : 4, left: cfg.options.indexAxis === 'y' ? 4 : 0 } }, cfg.options.layout || {});
  charts.push(new Chart(el, cfg));
}
const grid = () => ({ color: css('--line'), drawTicks: false });
const axisMoney = () => ({ callback: v => S.cur === 'HUF' ? (v < 0 ? '−' : '') + nf(Math.abs(v) / 1000) + 'e Ft' : (v < 0 ? '−$' : '$') + nf(Math.abs(v)) });

/* ---------- nagy árfolyamgrafikon (saját canvas) ---------- */
const RANGES = [['1w', '1 hét', 7], ['1m', '1 hó', 31], ['3m', '3 hó', 92], ['6m', '6 hó', 183], ['ytd', 'YTD', 'ytd'], ['1y', '1 év', 366], ['all', 'Mind', null]];
const rangeFrom = key => { const r = RANGES.find(x => x[0] === key) || RANGES[6]; if (!r[2]) return null; return r[2] === 'ytd' ? M.today.slice(0, 4) + '-01-01' : Engine.addDays(M.today, -r[2]); };
const rangeLabel = key => key === 'all' ? 'kezdés óta' : key === 'ytd' ? 'az év eleje óta' : 'az elmúlt ' + RANGES.find(r => r[0] === key)[1];
function rangePoints() {
  const s = M.series; const from = rangeFrom(S.range);
  if (!from) return s;
  const i = s.findIndex(p => p.d >= from);
  return i < 0 ? s.slice(-2) : s.slice(Math.max(0, i - 1));
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
  // Árfolyam nézet pénzben: a vonal a mai értéknél végződik, a befizetések nem emelik meg
  const zz = pts[pts.length - 1], base = zz.value * K(), b0 = a.nav * base / zz.nav;
  const y = p => opt.price ? p.nav : idx ? base * p.nav / zz.nav : p.value * K();
  const b = p => !opt.price && S.bench ? (idx ? (p.spyIdx && a.spyIdx ? b0 * p.spyIdx / a.spyIdx : null) : (p.spyVal != null ? p.spyVal * K() : null)) : null;
  const inv = p => idx ? null : p.invested * K();
  const ys = pts.map(y), bs = pts.map(b), is = pts.map(inv);
  const all = [...ys, ...bs, ...is, ...(opt.markers || []).map(k => k.price), ...(opt.ref ? [opt.ref] : [])].filter(v => v != null && isFinite(v));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const TP = box.classList.contains('bleed') ? 16 : box.classList.contains('hc-chart') ? 20 : 0; // feliratok ne érjenek a képernyő széléhez
  const L = 0, T = 26, B = 26, w = W - L - 12, h = H - T - B;
  const X = i => L + (pts.length === 1 ? w : i / (pts.length - 1) * w), Y = v => T + (hi - v) / (hi - lo) * h;
  const resNow = idx ? ys[ys.length - 1] - ys[0] : (pts[pts.length - 1].value - pts[pts.length - 1].invested) - (a.value - a.invested);
  const pal = opt.pal || {};
  const col = resNow >= -1e-9 ? (pal.up || css('--gain')) : (pal.down || css('--loss')), muted = pal.muted || css('--muted'), bench = pal.bench || css('--bench'), surf = pal.surf || css('--bg'), line = pal.line || css('--line');
  const fam = getComputedStyle(document.body).fontFamily;
  const fmtY = v => opt.price ? usd(v) : money(v / K(), { d: S.cur === 'USD' && Math.abs(v) >= 1000 ? 0 : 2 });
  const segs = vals => { const out = []; let cur = []; vals.forEach((v, i) => { if (v == null || !isFinite(v)) { if (cur.length) out.push(cur); cur = []; } else cur.push([X(i), Y(v)]); }); if (cur.length) out.push(cur); return out; };
  const main = segs(ys)[0] || [];
  let hiI = 0, loI = 0; ys.forEach((v, i) => { if (v > ys[hiI]) hiI = i; if (v < ys[loI]) loI = i; });

  function frame(prog) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (opt.grid !== false) { const st = niceStep((hi - lo) / 4.5); ctx.font = `500 10px ${fam}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { const yy = Y(v); if (yy < T + 8 || yy > T + h - 6) continue; ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + w, yy); ctx.stroke();
        if (!(S.hide && !opt.price) && !(opt.endTag !== false && Math.abs(yy - Y(ys[ys.length - 1])) < 16)) { const gl = opt.price ? '$' + nf(v, st < 1 ? 2 : 0) : compact(v, st); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = surf; ctx.strokeText(gl, L + w - TP, yy - 3); ctx.fillStyle = muted; ctx.fillText(gl, L + w - TP, yy - 3); } }
      ctx.textBaseline = 'alphabetic'; }
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
    if (opt.ref) { const yy = Y(opt.ref); ctx.setLineDash([4, 4]); ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + w, yy); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `500 10.5px ${fam}`; ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText('átlagár ' + usd(opt.ref), L + w - 2, yy - 5); }
    (opt.markers || []).forEach(k => { const x = X(k.i), yy = Y(k.price), up = k.type === 'B', c2 = css(up ? '--gain' : '--loss');
      ctx.beginPath(); ctx.arc(x, yy, 3, 0, 7); ctx.fillStyle = c2; ctx.fill();
      const tip = up ? yy + 6 : yy - 6, base = up ? yy + 16 : yy - 16; ctx.beginPath(); ctx.moveTo(x, tip); ctx.lineTo(x - 6, base); ctx.lineTo(x + 6, base); ctx.closePath(); ctx.fillStyle = c2; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = surf; ctx.stroke(); });
    // csúcs és mélypont
    ctx.font = `500 11px ${fam}`; ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic';
    const tag = (i, above) => { const x = X(i), yy = Y(ys[i]) + (above ? -9 : 17); ctx.textAlign = x < 56 ? 'left' : x > W - 56 ? 'right' : 'center'; ctx.fillText(fmtY(ys[i]), Math.max(TP, Math.min(W - TP, x)), Math.max(12, Math.min(H - B + 2, yy))); };
    if (pts.length > 2 && opt.grid === false) { tag(hiI, true); if (loI !== hiI) tag(loI, false); }
    ctx.textAlign = 'left'; ctx.fillText(dShort(pts[0].d), L + TP, H - 6); ctx.textAlign = 'right'; ctx.fillText(dShort(pts[pts.length - 1].d), L + w - TP, H - 6);
  }
  const dot = (i, c, r = 4) => { const x = X(i), yy = Y(ys[i]); ctx.beginPath(); ctx.arc(x, yy, r + 5, 0, 7); ctx.fillStyle = c + '26'; ctx.fill(); ctx.beginPath(); ctx.arc(x, yy, r, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = surf; ctx.stroke(); };
  const endTag = () => { if (S.hide && !opt.price) return; const i = ys.length - 1, t = fmtY(ys[i]); ctx.font = `700 11px ${fam}`; const tw = ctx.measureText(t).width + 14, th = 20;
    let x = X(i) - tw - 12, yy = Y(ys[i]) - th / 2; yy = Math.max(2, Math.min(H - B - th, yy)); if (x < 4) x = X(i) + 12;
    ctx.beginPath(); ctx.roundRect(x, yy, tw, th, 10); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = inkOn(col); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 7, yy + th / 2 + .5); ctx.textBaseline = 'alphabetic'; };
  const rest = () => { frame(1); dot(ys.length - 1, col); if (opt.endTag !== false) endTag(); };
  if (opt.animate && !REDUCED && pts.length > 2) { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 700); frame(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(step); else rest(); }; requestAnimationFrame(step); }
  else rest();
  const scrubTo = i => {
    if (i == null) { rest(); onScrub(null); return; }
    frame(1);
    const x = X(i), yv = Y(ys[i]); ctx.strokeStyle = muted; ctx.globalAlpha = .55; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, T - 8); ctx.lineTo(x, T + h); ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(L, yv); ctx.lineTo(L + w, yv); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    { const t = dShort(pts[i].d); ctx.font = `600 10.5px ${fam}`; const tw = ctx.measureText(t).width + 14; const bx = Math.max(2, Math.min(W - tw - 2, x - tw / 2)); ctx.beginPath(); ctx.roundRect(bx, H - 22, tw, 19, 9); ctx.fillStyle = surf; ctx.fill(); ctx.strokeStyle = line; ctx.stroke(); ctx.fillStyle = pal.text || css('--ink'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, bx + 7, H - 12); ctx.textBaseline = 'alphabetic'; }
    if (bs[i] != null) { ctx.beginPath(); ctx.arc(x, Y(bs[i]), 3.5, 0, 7); ctx.fillStyle = bench; ctx.fill(); }
    dot(i, col); onScrub(i, X(i), Y(ys[i]), W);
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
function compact(v, st) { if (S.cur === 'HUF') return st && st < 1000 ? nf(v) + ' Ft' : nf(v / 1000, st && st < 10000 && st % 1000 ? 1 : 0) + 'e Ft'; return '$' + nf(v, st && st < 1 ? 2 : 0); }

/* ---------- views ---------- */
const V = {};
const TABS = [['attekintes', 'Kezdőlap', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'], ['portfolio', 'Portfólió', 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z'], ['elemzes', 'Elemzés', 'M4 20V10M10 20V4M16 20v-7M22 20H2'], ['naptar', 'Naptár', 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4'], ['naplo', 'Napló', 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01']];
const hasHist = () => Object.keys(market.history || {}).length > 0;

// mikor kezdődött a mostani tartási időszak (0-ról nyitott pozíció)
function holdStart(t) { let q = 0, st = null; for (const r of M.tx) { if (r.tkr !== t || (r.type !== 'B' && r.type !== 'S')) continue; const was = q; q += r.type === 'B' ? r.qty : -r.qty; if (was < 1e-7 && q > 1e-7) st = r.date; if (q < 1e-7) q = 0; } return st; }
// pozíció változása egy időszakban: ha a pozíció azóta nyílt, a bekerüléshez képest
function perf(p, from) {
  if (from === 'day') return p.dayChg == null ? null : { pct: p.dayChg, abs: p.dayAbs };
  const hs = holdStart(p.tkr);
  if (!from || (hs && hs >= from)) return { pct: p.pct, abs: p.pnl };
  const p0 = M.priceAt(p.tkr, from); if (!p0) return { pct: p.pct, abs: p.pnl };
  return { pct: (p.price / p0 - 1) * 100, abs: p.qty * (p.price - p0) };
}
function spark(canvas, vals) {
  const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr); if (vals.length < 2) return;
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const P = vals.map((v, i) => [i / (vals.length - 1) * (W - 2) + 1, H - 3 - (v - lo) / r * (H - 6)]);
  const col = css(vals[vals.length - 1] >= vals[0] ? '--gain' : '--loss');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col + '30'); g.addColorStop(1, col + '00');
  c.beginPath(); monoPath(c, P); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fillStyle = g; c.fill();
  c.beginPath(); monoPath(c, P); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();
}

const ICO = {
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1',
  add: 'M12 5v14M5 12h14', file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 12v6M9 15l3 3 3-3',
  refresh: 'M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', more: 'M5 12h.01M12 12h.01M19 12h.01',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7', leaf: 'M11 20A7 7 0 0 1 4 13c0-5 5-9 16-10-1 11-5 16-9 17zM4 20c3-5 6-8 10-10',
  chev: 'M9 18l6-6-6-6', wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01', trend: 'M3 17l6-6 4 4 8-8M15 7h6v6', moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'
};
const ic = (k, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICO[k]}"/></svg>`;
const SHADES = () => [css('--c1'), css('--c2'), css('--c3'), css('--c4'), css('--c5'), css('--c6')];
const PAL = () => Array.from({ length: 10 }, (_, i) => css('--p' + (i + 1)));
const shade = i => { const p = PAL(); return p[i % p.length]; };
let TCOL = {};
function buildColors() { TCOL = {}; if (!M) return; const p = PAL(); [...M.positions].sort((a, b) => b.value - a.value).forEach((x, i) => TCOL[x.tkr] = p[i % p.length]); }
function tColor(t) { if (!TCOL[t]) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; const p = PAL(); TCOL[t] = p[Math.abs(h) % p.length]; } return TCOL[t]; }
function inkOn(hex) { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || ''); if (!m) return '#fff'; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#12231a' : '#ffffff'; }
const logo = (t, size = 44) => { const c = tColor(t); return `<span class="lg" style="--lg:${c};--lgc:${inkOn(c)};width:${size}px;height:${size}px;font-size:${Math.max(9, size * 0.25)}px">${esc(String(t).slice(0, 4))}</span>`; };
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Jó éjszakát' : h < 10 ? 'Jó reggelt' : h < 18 ? 'Szép napot' : 'Jó estét'; };
const heroPal = () => ({ up: css('--hero-up'), down: css('--hero-down'), muted: css('--hero-muted'), line: css('--hero-line'), bench: css('--hero-bench'), surf: css('--hero'), text: css('--hero-muted') });
function txIcon(r) {
  if (r.type === 'DEP') return `<span class="lg lg-in">${ic('add')}</span>`;
  if (r.type === 'FX') return `<span class="lg lg-fx">${ic('swap')}</span>`;
  return logo(r.tkr, 44);
}
function txRow(r) {
  const f = (v) => r.ccy === 'HUF' ? (S.hide ? '••••' : nf(v) + ' Ft') : r.ccy === 'EUR' ? (S.hide ? '••••' : nf(v, 2) + ' €') : (S.hide ? '••••' : usd(v));
  const amt = r.type === 'D' || r.type === 'S' ? r.net : Math.abs(r.gross);
  const neg = r.type === 'B' || r.type === 'WD' || (r.type === 'FX' && r.gross < 0);
  const title = r.type === 'DEP' ? 'Befizetés' : r.type === 'FX' ? `Átváltás · ${r.ccy}` : nm(r.tkr);
  const sub = r.type === 'B' ? 'Vétel' : r.type === 'S' ? 'Eladás' : r.type === 'D' ? 'Osztalék' : r.type === 'DEP' ? (r.label || '') : 'Devizaváltás';
  return `<button class="txr" ${r.type === 'B' || r.type === 'S' || r.type === 'D' ? `data-t="${esc(r.tkr)}"` : ''}>${txIcon(r)}<span class="txm"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="ta"><b class="num ${neg ? '' : 'pos'}">${neg ? '−' : '+'}${f(amt)}</b><small>${dShort(r.date)}</small></span></button>`;
}

V.attekintes = m => {
  const top = [...m.positions].sort((a, b) => b.pnl - a.pnl);
  const movers = top.length > 6 ? [...top.slice(0, 3), ...top.slice(-3).reverse()] : top;
  const recent = [...m.tx].filter(r => r.type !== 'FX').reverse().slice(0, 5);
  return `
  <section class="hero" id="hero">
    <div class="hc-top"><span class="hc-lbl"><i class="hc-dot">${ic('wallet')}</i>Portfólió értéke</span>
      <button class="hc-eye" id="eyeBtn" aria-label="${S.hide ? 'Összegek mutatása' : 'Összegek elrejtése'}">${ic(S.hide ? 'eyeOff' : 'eye')}</button></div>
    <div class="hc-val num" id="hv"></div>
    <div class="hc-chg num" id="hc"></div>
    <div class="chart hc-chart"><canvas id="sc" role="img" aria-label="A portfólió értékének alakulása. Húzd végig az ujjad a részletekért."></canvas><div class="ftip" id="ftip" hidden></div></div>
    <div class="ranges2 hc-ranges" role="group" aria-label="Időszak">${RANGES.map(r => `<button data-r="${r[0]}" aria-pressed="${S.range === r[0]}">${r[1]}</button>`).join('')}</div>
    <div class="hc-opts">
      <div class="hseg" role="group" aria-label="Nézet"><button data-mo="idx" aria-pressed="${S.mode === 'idx'}">Árfolyam</button><button data-mo="val" aria-pressed="${S.mode === 'val'}">Érték</button></div>
      <button class="hchip" id="benchBtn" aria-pressed="${S.bench}"><i></i>S&P 500</button>
    </div>
  </section>
  <nav class="qa" aria-label="Gyorsműveletek">
    <button id="qaImport"><span>${ic('file')}</span>Kivonat</button>
    <button id="qaRefresh"><span>${ic('refresh')}</span>Frissítés</button>
    <button id="qaAlert"><span>${ic('bell')}</span>Riasztás</button>
    <button id="qaMore"><span>${ic('more', 3)}</span>Több</button>
  </nav>
  ${!apiKey ? `<button class="insight" id="tipKey"><span class="in-ic">${ic('trend')}</span><span><b>Kapcsold be az élő árfolyamokat</b><small>Ingyenes Twelve Data kulccsal napi árak, S&P összehasonlítás és riasztások.</small></span>${ic('chev')}</button>` : ''}
  <section class="fstats">
    ${[[m.positions.some(p => p.dayAbs != null) ? 'Ma' : 'Nyitott eredmény', m.positions.some(p => p.dayAbs != null) ? m.dayChange : m.unreal, 1],
       ['Befizetve', m.dep, 0], ['Osztalék', m.divNet, 1], ['Díjak', -m.feeUsd, 1]]
      .map(([l, v, sg]) => `<div class="fcard"><div class="lbl-s">${l}</div><div class="v num ${sg ? cls(v) : ''}">${money(v, { sign: !!sg })}</div></div>`).join('')}
  </section>
  ${tbszCard()}
  <section>
    <div class="sec-h"><h2>Eszközeid</h2><span class="sub">${esc(rangeLabel(S.range))}</span></div>
    <div class="rail" id="rail">${[...m.positions].sort((a, b) => b.value - a.value).map(p => { const f = perf(p, rangeFrom(S.range)); return `<button class="acard" data-t="${p.tkr}"><div class="ah"><span class="tk">${p.tkr}</span><span class="ach num ${cls(f.pct)}">${pct(f.pct)}</span></div><div class="an">${esc(nm(p.tkr))}</div><canvas class="sp" data-sp="${p.tkr}"></canvas><div class="av num">${money(p.value)}</div><div class="s num ${cls(f.abs)}">${money(f.abs, { sign: true })}</div></button>`; }).join('')}</div>
  </section>
  <section class="card">
    <div class="card-h" style="margin-bottom:4px"><h2>Legutóbbi tranzakciók</h2><a href="#naplo" class="see" data-go="naplo">Összes ${ic('chev')}</a></div>
    <div class="txl">${recent.map(txRow).join('')}</div>
  </section>
  <section class="grid">
    <div class="card"><div class="card-h"><div><h2>Honnan jön az eredmény?</h2><p class="sub">A befizetéstől a mai értékig</p></div></div><div class="cv"><canvas id="wf" role="img" aria-label="Eredmény bontása"></canvas></div></div>
    <div class="card"><div class="card-h"><div><h2>Legnagyobb mozgások</h2><p class="sub">Nyitott pozíciók, a bekerüléshez képest</p></div></div>
      <div class="txl">${movers.map(p => `<button class="txr" data-t="${p.tkr}">${txIcon({ tkr: p.tkr, type: 'B' })}<span class="txm"><b>${esc(nm(p.tkr))}</b><small class="num">${money(p.value)}${p.dayChg != null ? ` · ma ${pct(p.dayChg)}` : ''}</small></span><span class="ta"><b class="num ${cls(p.pnl)}">${money(p.pnl, { sign: true })}</b><small class="num ${cls(p.pnl)}">${pct(p.pct)}</small></span></button>`).join('')}</div></div>
  </section>`;
};
V.attekintes.after = m => {
  const pts = rangePoints(); const a = pts[0], z = pts[pts.length - 1];
  const head = i => {
    const p = i == null ? z : pts[i];
    const res = (p.value - p.invested) - (a.value - a.invested), pc = (p.nav / a.nav - 1) * 100;
    $('hv').innerHTML = moneyHTML(i == null ? m.value : p.value); if (i == null) delete $('hv').dataset.scrub; else $('hv').dataset.scrub = 1;
    $('hc').innerHTML = `<span class="hpill ${pc >= 0 ? 'up' : 'down'}">${arr(pc)} ${pct(pc)}</span><span class="hc-abs">${money(res, { sign: true })}</span><small>${i == null ? rangeLabel(S.range) : dShort(p.d)}</small>`;
  };
  const tip = $('ftip');
  const onScrub = (i, x, y, W) => {
    head(i);
    if (i == null) { tip.hidden = true; return; }
    const p = pts[i], pc = (p.nav / a.nav - 1) * 100, res = (p.value - p.invested) - (a.value - a.invested);
    tip.innerHTML = `<div class="td">${dShort(p.d)}</div><div class="tv num">${money(p.value)}</div><div class="num ${cls(pc)}">${pct(pc)} · ${money(res, { sign: true })}</div>${p.spyIdx && a.spyIdx && S.bench ? `<div class="tb num"><i></i>S&P ${pct((p.spyIdx / a.spyIdx - 1) * 100)}</div>` : ''}${S.mode === 'val' ? `<div class="tb num">Befizetve ${money(p.invested)}</div>` : ''}`;
    tip.hidden = false; const tw = tip.offsetWidth; const left = x + 14 + tw > W - 8 ? x - 14 - tw : x + 14;
    tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(0, Math.min(y - 40, tip.parentElement.clientHeight - tip.offsetHeight - 30))}px)`;
  };
  head(null);
  if (animNext && !REDUCED && !S.hide) { const t0 = performance.now(), v1 = m.value, v0 = v1 * 0.92; const st = t => { const k = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - k, 3); const el = $('hv'); if (!el || el.dataset.scrub) return; el.innerHTML = moneyHTML(v0 + (v1 - v0) * e); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }
  stockChart($('sc'), pts, onScrub, { animate: animNext, pal: heroPal() }); animNext = false;
  const days = M.series.map(x => x.d);
  document.querySelectorAll('[data-sp]').forEach(c => { const t = c.dataset.sp, from = rangeFrom(S.range), hs = holdStart(t); const st = !from || (hs && hs > from) ? hs : from; const ds = days.filter(d => d >= st); spark(c, ds.map(d => M.priceAt(t, d))); });
  const tc = $('tbszCard'); if (tc) { tc.onclick = openTbsz; tc.onkeydown = e => { if (e.key === 'Enter') openTbsz(); }; }
  const rail = $('rail'); if (rail) { rail.onwheel = e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { rail.scrollLeft += e.deltaY; e.preventDefault(); } }; }
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { S.range = b.dataset.r; store.set('bf-range', S.range); animNext = true; render(true); });
  document.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { S.mode = b.dataset.mo; store.set('bf-mode', S.mode); animNext = true; render(true); });
  $('benchBtn').onclick = () => { if (!market.history.SPY) { explainNoData('spy'); return; } S.bench = !S.bench; store.set('bf-bench', S.bench); render(true); };
  $('eyeBtn').onclick = () => { S.hide = !S.hide; store.set('bf-hide', S.hide); render(true); };
  $('qaImport').onclick = () => $('fileIn').click(); $('qaRefresh').onclick = () => refresh({}); $('qaAlert').onclick = openAlerts; $('qaMore').onclick = openActions;
  const tk = $('tipKey'); if (tk) tk.onclick = openSettings;
  bindGo();
  const steps = [['Befizetve', m.dep, 1], ['Realizált', m.realized], ['Nem realizált', m.unreal], ['Osztalék', m.divNet], ['Egyéb', m.other], ['Mai érték', m.value, 1]];
  let run = 0; const data = steps.map(([l, v, b]) => { if (b) { run = v; return [0, v * K()]; } const s = run; run += v; return [s * K(), run * K()]; });
  const vals = data.flat().filter(v => v > 0); const lo = Math.min(...vals), hi = Math.max(...vals);
  const SH = { 'Befizetve': 'Befiz.', 'Realizált': 'Real.', 'Nem realizált': 'Nyitott', 'Osztalék': 'Oszt.', 'Egyéb': 'Egyéb', 'Mai érték': 'Ma' };
  chart('wf', { type: 'bar', data: { labels: steps.map(s => innerWidth < 600 ? SH[s[0]] : s[0]), datasets: [{ data, backgroundColor: steps.map(([l, v, b]) => b ? css('--accent') : v >= 0 ? css('--gain') : css('--loss')), borderRadius: 8, borderSkipped: false, barPercentage: .7 }] },
    options: { scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, font: { size: 10.5 } } }, y: { min: lo * 0.97, max: hi * 1.01, grid: grid(), border: { display: false }, ticks: S.hide ? { display: false } : axisMoney() } },
      plugins: { vl: { fmt: (r, i) => moneyShort(steps[i][1], !steps[i][2]) }, tooltip: { callbacks: { title: i => steps[i[0].dataIndex][0], label: c => { const s = steps[c.dataIndex]; return s[2] ? money(s[1]) : money(s[1], { sign: true }); } } } } } });
  bindTickers();
};
function bindGo(scope) { (scope || document).querySelectorAll('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.go, a.dataset.sub); }); }
function go(tab, sub) { if (sub) S.an = sub; switchTab(tab); }
function switchTab(tab, push = true) {
  if (tab === S.tab && push) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.scroll[S.tab] = window.scrollY; S.tab = tab;
  if (push) { try { history.pushState({ tab }, '', '#' + tab); } catch (_) {} }
  drawNav(); S.enter = true; render(); window.scrollTo({ top: S.scroll[tab] || 0 });
}

/* ---------- Elemzés ---------- */
const AN = [['trend', 'Áttekintés'], ['eredmeny', 'Eredmény'], ['sp', 'S&P 500'], ['koltseg', 'Költségek']];
function monthly(m) {
  const by = {}; m.series.forEach(p => { by[p.d.slice(0, 7)] = p; });
  return Object.entries(by).map(([k, p]) => ({ k, p })).slice(-8);
}
function insights(m) {
  const out = []; const last = m.series[m.series.length - 1];
  if (last.spyIdx) { const d = last.nav - last.spyIdx; out.push({ ic: 'leaf', t: d >= 0 ? `${nf(Math.abs(d), 1)} százalékponttal az S&P 500 felett vagy` : `${nf(Math.abs(d), 1)} százalékponttal az S&P 500 alatt vagy`, s: 'A portfólió árfolyamhozama a kezdés óta, befizetések nélkül.', go: ['elemzes', 'sp'] }); }
  const best = [...m.T].sort((a, b) => b.total - a.total)[0]; if (best) out.push({ ic: 'trend', t: `${best.tkr} hozta a legtöbbet`, s: `${nm(best.tkr)}: összesen ${money(best.total, { sign: true })}.`, t2: best.tkr });
  const fp = m.feeUsd / m.dep * 100; out.push({ ic: 'wallet', t: `A díjak a befizetés ${nf(fp, 2)}%-át vitték el`, s: fp < 1 ? 'Ez alacsony. A legnagyobb tétel a befizetési díj.' : 'Kevesebb, nagyobb befizetéssel csökkenthető.', go: ['elemzes', 'koltseg'] });
  return out;
}
function ring(canvasId, centerId, items, onPick, center) {
  const cv = $(canvasId); if (!cv) return; const tot = sum(items, i => i.v);
  const dpr = devicePixelRatio || 1, S0 = cv.clientWidth; cv.width = cv.height = S0 * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const cx = S0 / 2, R1 = S0 / 2 - 8, R0 = R1 * 0.72; const segs = []; let a0 = -Math.PI / 2;
  items.forEach((it, i) => { const a1 = a0 + it.v / tot * Math.PI * 2; segs.push({ it, i, a0, a1 }); a0 = a1; });
  const draw = hl => { c.clearRect(0, 0, S0, S0); segs.forEach(s => { const on = hl === s.i, r1 = on ? R1 + 5 : R1;
      c.beginPath(); c.arc(cx, cx, r1, s.a0 + 0.02, s.a1 - 0.02); c.arc(cx, cx, R0, s.a1 - 0.02, s.a0 + 0.02, true); c.closePath(); c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = css('--surface');
      c.fillStyle = shade(s.i); c.globalAlpha = hl == null || on ? 1 : 0.45; c.fill(); c.stroke(); c.globalAlpha = 1; });
    const ce = $(centerId); if (ce) ce.innerHTML = center(hl == null ? null : items[hl]); onPick && onPick(hl); };
  const hit = e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left - cx, y = e.clientY - r.top - cx; const d = Math.hypot(x, y); if (d < R0 - 6 || d > R1 + 10) return null; let a = Math.atan2(y, x); if (a < -Math.PI / 2) a += Math.PI * 2; const s = segs.find(s => a >= s.a0 && a < s.a1); return s ? s.i : null; };
  draw(null); cv.onpointermove = e => draw(hit(e)); cv.onpointerdown = e => draw(hit(e)); cv.onpointerleave = () => draw(null);
  return draw;
}
V.elemzes = m => {
  const sub = AN.some(a => a[0] === S.an) ? S.an : 'trend';
  const tabs = `<div class="ptabs" role="tablist">${AN.map(([k, l]) => `<button role="tab" data-an="${k}" aria-selected="${sub === k}">${l}</button>`).join('')}</div>`;
  if (sub === 'eredmeny') return tabs + V.eredmenyek(m);
  if (sub === 'sp') return tabs + V.sp500(m);
  if (sub === 'koltseg') return tabs + V.koltsegek(m);
  const g = {}; m.positions.forEach(p => { const k = SECTOR[p.tkr] || 'Egyéb'; g[k] = (g[k] || 0) + p.value; });
  const items = Object.entries(g).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v); const tot = sum(items, i => i.v);
  const mo = monthly(m); const ins = insights(m);
  return tabs + `
  <section class="card">
    <div class="card-h"><h2>Hová fektetsz?</h2><span class="sub">ágazatonként</span></div>
    <div class="ring-wrap"><div class="ring"><canvas id="rg"></canvas><div class="rc" id="rc"></div></div>
      <div class="rl">${items.map((it, i) => `<button class="rli" data-ri="${i}"><i style="background:${shade(i)}"></i><span>${esc(it.k)}</span><b class="num">${nf(it.v / tot * 100, 0)}%</b></button>`).join('')}</div></div>
  </section>
  ${ins.map((x, i) => `<button class="insight" data-ins="${i}"><span class="in-ic">${ic(x.ic)}</span><span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${ic('chev')}</button>`).join('')}
  <section class="card">
    <div class="card-h"><div><h2>Értéktrend</h2><p class="sub">A portfólió értéke hónap végén</p></div></div>
    <div class="bars" id="bars">${(() => { const mx = Math.max(...mo.map(x => x.p.value)), mn = Math.min(...mo.map(x => x.p.value)) * 0.85;
      return mo.map((x, i) => `<button class="tbar${i === mo.length - 1 ? ' on' : ''}" data-bi="${i}" style="--h:${((x.p.value - mn) / (mx - mn || 1) * 78 + 22).toFixed(1)}%"><em class="num">${money(x.p.value, { d: 0 })}</em><i></i><span>${['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'][+x.k.slice(5) - 1]}</span></button>`).join(''); })()}</div>
  </section>`;
};
V.elemzes.after = m => {
  document.querySelectorAll('[data-an]').forEach(b => b.onclick = () => { S.an = b.dataset.an; store.set('bf-an', S.an); render(true); });
  const sub = AN.some(a => a[0] === S.an) ? S.an : 'trend';
  if (sub === 'eredmeny') return V.eredmenyek.after(m);
  if (sub === 'sp') return V.sp500.after(m);
  if (sub === 'koltseg') return V.koltsegek.after(m);
  const g = {}; m.positions.forEach(p => { const k = SECTOR[p.tkr] || 'Egyéb'; g[k] = (g[k] || 0) + p.value; });
  const items = Object.entries(g).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v); const tot = sum(items, i => i.v);
  const draw = ring('rg', 'rc', items, hl => document.querySelectorAll('.rli').forEach(b => b.classList.toggle('on', +b.dataset.ri === hl)),
    it => it ? `<small>${esc(it.k)}</small><b class="num">${money(it.v)}</b><span class="num">${nf(it.v / tot * 100, 1)}%</span>` : `<small>Összesen</small><b class="num">${money(tot)}</b><span>${items.length} ágazat</span>`);
  document.querySelectorAll('.rli').forEach(b => { b.onmouseenter = b.onfocus = () => draw(+b.dataset.ri); b.onmouseleave = () => draw(null); b.onclick = () => draw(+b.dataset.ri); });
  const ins = insights(m);
  document.querySelectorAll('[data-ins]').forEach(b => b.onclick = () => { const x = ins[+b.dataset.ins]; if (x.t2) openTicker(x.t2); else if (x.go) go(...x.go); });
  document.querySelectorAll('.tbar').forEach(b => b.onclick = () => { document.querySelectorAll('.tbar').forEach(x => x.classList.toggle('on', x === b)); });
};

/* ---------- gyorsműveletek (középső gomb) ---------- */
function openActions() {
  const s = sheet(`<div class="sheet-h"><div><div class="lbl-s">Gyorsműveletek</div><h2 style="font-size:1.3rem">Mit szeretnél?</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    <div class="acts">
      <button data-act="import"><span>${ic('file')}</span><b>Kivonat betöltése</b><small>Új Lightyear PDF</small></button>
      <button data-act="refresh"><span>${ic('refresh')}</span><b>Frissítés</b><small>Árak, naptár, hírek</small></button>
      <button data-act="alert"><span>${ic('bell')}</span><b>Riasztás</b><small>Árszint, napi mozgás</small></button>
      <button data-act="cur"><span>${ic('swap')}</span><b>Pénznem: ${S.cur === 'USD' ? 'Ft-ra' : '$-ra'}</b><small>Most: ${S.cur === 'USD' ? 'dollár' : 'forint'}</small></button>
      <button data-act="theme"><span>${ic('moon')}</span><b>Téma</b><small>${{ auto: 'Rendszer', light: 'Világos', dark: 'Sötét' }[S.theme]}</small></button>
      <button data-act="settings"><span>${ic('more', 3)}</span><b>Beállítások</b><small>Kulcsok, adatok</small></button>
    </div>`);
  s.root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const a = b.dataset.act; s.close();
    if (a === 'import') $('fileIn').click(); if (a === 'refresh') refresh({}); if (a === 'alert') openAlerts(); if (a === 'settings') openSettings();
    if (a === 'cur') { S.cur = S.cur === 'USD' ? 'HUF' : 'USD'; store.set('bf-cur2', S.cur); drawCur(); render(true); }
    if (a === 'theme') { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme]; store.set('bf-theme', S.theme); applyTheme(); } });
}

V.portfolio = m => {
  if (S.hm === 'day' && !m.positions.some(p => p.dayChg != null)) S.hm = 'all';
  const P = [...m.positions].sort((a, b) => b.value - a.value); const tot = sum(P, p => p.value);
  const daily = P.some(p => p.dayChg != null);
  const best = [...P].sort((a, b) => b.pct - a.pct)[0], worst = [...P].sort((a, b) => a.pct - b.pct)[0];
  const SORTS = [['value', 'Érték'], ['pnl', 'Eredmény'], ['pct', '%'], ...(daily ? [['day', 'Ma']] : []), ['name', 'Név']];
  const ps = SORTS.some(s => s[0] === S.ps) ? S.ps : 'value';
  const L = [...P].sort((a, b) => ps === 'name' ? a.tkr.localeCompare(b.tkr) : ps === 'day' ? (b.dayChg ?? -1e9) - (a.dayChg ?? -1e9) : b[ps] - a[ps]);
  const pnlTot = sum(P, p => p.pnl);
  return `
  <section class="pf-head">
    <div class="pf-l"><span class="lbl-s">Részvények értéke</span><b class="num pf-v">${money(tot)}</b>
      <div class="pf-chips"><span class="pchip ${pnlTot >= 0 ? 'up' : 'down'}">${arr(pnlTot)} ${money(pnlTot, { sign: true })} összesen</span>${daily ? `<span class="pchip ${m.dayChange >= 0 ? 'up' : 'down'}">${money(m.dayChange, { sign: true })} ma</span>` : ''}</div></div>
    <div class="pf-bw">
      <button class="bw up" data-t="${best.tkr}"><small>Legjobb</small>${logo(best.tkr, 28)}<b>${best.tkr}</b><span class="num">${pct(best.pct)}</span></button>
      <button class="bw down" data-t="${worst.tkr}"><small>Leggyengébb</small>${logo(worst.tkr, 28)}<b>${worst.tkr}</b><span class="num">${pct(worst.pct)}</span></button>
    </div>
  </section>
  <section class="card"><div class="card-h"><div><h2>Allokáció</h2><p class="sub">${P.length} részvény · húzd az ujjad a körön</p></div></div>
    <div class="donut-wrap"><div class="donut"><canvas id="dn" aria-label="Allokáció"></canvas><div class="dc" id="dc"></div></div>
    <div class="dl" id="dl">${P.map((p, i) => `<button class="dli" data-i="${i}" data-t="${p.tkr}"><i style="background:${tColor(p.tkr)}"></i><b>${p.tkr}</b><span class="num">${nf(p.value / tot * 100, 1)}%</span></button>`).join('')}</div></div>
    <div class="stack" aria-hidden="true">${P.map(p => `<i style="flex:${p.value};background:${tColor(p.tkr)}"></i>`).join('')}</div></section>
  <section class="card"><div class="card-h"><div><h2>Pozíciók</h2><p class="sub">készpénz ${money(m.cashUsd)}</p></div></div>
    <div class="chips sorts" role="group" aria-label="Rendezés">${SORTS.map(([k, l]) => `<button class="chip" data-ps="${k}" aria-pressed="${ps === k}">${l}</button>`).join('')}</div>
    <div class="plist">${L.map(p => `<button class="prow" data-t="${p.tkr}">${logo(p.tkr, 44)}
      <span class="pm"><b>${esc(nm(p.tkr))}</b><small class="num">${p.tkr} · ${nf(p.qty, 3)} db · ${usd(p.price)}${p.dayChg != null ? ` · <span class="${cls(p.dayChg)}">${pct(p.dayChg)}</span>` : ''}</small>
        <span class="wbar"><i style="width:${(p.value / P[0].value * 100).toFixed(1)}%;background:${tColor(p.tkr)}"></i></span></span>
      <canvas class="psp" data-sp2="${p.tkr}"></canvas>
      <span class="pv"><b class="num">${money(p.value)}</b><span class="pp ${p.pnl >= 0 ? 'up' : 'down'} num">${pct(p.pct)}</span></span></button>`).join('')}</div></section>
  ${breakdownCard(m)}
  <section class="card"><div class="card-h"><div><h2>Hőtérkép</h2><p class="sub">Méret = érték, szín = változás</p></div>
    <div class="seg" role="group" aria-label="Időszak">${[['all', 'Mind'], ['ytd', 'YTD'], ['day', 'Mai']].map(([k, l]) => `<button data-hm="${k}" aria-pressed="${S.hm === k}" ${k === 'day' && !daily ? 'class="soft"' : ''}>${l}</button>`).join('')}</div></div>
    <div class="tm" id="tm"></div><div class="legend"><span>${S.hm === 'day' ? '−4%' : '−40%'}</span><i></i><span>${S.hm === 'day' ? '+4%' : '+40%'}</span></div></section>`;
};
V.portfolio.after = m => {
  const el = $('tm'); const W = el.clientWidth, H = el.clientHeight;
  const from = S.hm === 'ytd' ? M.today.slice(0, 4) + '-01-01' : S.hm === 'day' ? 'day' : null; const lim = S.hm === 'day' ? 4 : 40;
  const rects = squarify([...m.positions].sort((a, b) => b.value - a.value).map(p => { const f = perf(p, from) || { pct: 0, abs: 0 }; return { ...p, v: p.value, pct: f.pct, abs: f.abs }; }), 0, 0, W, H);
  el.innerHTML = rects.map(r => { const t = Math.max(-1, Math.min(1, r.pct / lim)); const c = t >= 0 ? `color-mix(in oklab,var(--gain) ${Math.round(t * 70)}%,var(--tile))` : `color-mix(in oklab,var(--loss) ${Math.round(-t * 70)}%,var(--tile))`;
    const small = r.w < 70 || r.h < 48;
    return `<button class="tile" data-t="${r.tkr}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:${c}" aria-label="${r.tkr} ${pct(r.pct)}"><b>${r.tkr}</b>${small ? (r.w > 44 && r.h > 34 ? `<span class="num">${pct(r.pct)}</span>` : '') : `<span class="num"><b class="tp">${pct(r.pct)}</b>${r.w > 120 ? `<br>${money(r.abs, { sign: true })}` : ''}<br><span class="tvv">${money(r.value)}</span></span>`}</button>`; }).join('');
  bindTickers();
  document.querySelectorAll('[data-hm]').forEach(b => b.onclick = () => { if (b.dataset.hm === 'day' && !m.positions.some(p => p.dayChg != null)) { explainNoData('day'); return; } S.hm = b.dataset.hm; store.set('bf-hm', S.hm); render(true); });
  document.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { S.ps = b.dataset.ps; store.set('bf-ps', S.ps); render(true); });
  donut(m);
  const days = M.series.map(x => x.d).slice(-66);
  document.querySelectorAll('[data-sp2]').forEach(c => { const t = c.dataset.sp2; const hs = holdStart(t); spark(c, days.filter(d => !hs || d >= hs).map(d => M.priceAt(t, d))); });
  document.querySelectorAll('[data-bd]').forEach(b => b.onclick = () => { S.bd = b.dataset.bd; store.set('bf-bd', S.bd); render(true); });
};
function donut(m) {
  const cv = $('dn'); if (!cv) return; const P = [...m.positions].sort((a, b) => b.value - a.value); const tot = sum(P, p => p.value);
  const dpr = devicePixelRatio || 1, S0 = cv.clientWidth; cv.width = cv.height = S0 * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const cx = S0 / 2, R1 = S0 / 2 - 8, R0 = R1 * 0.7; const surf = css('--surface');
  const segs = []; let a0 = -Math.PI / 2; P.forEach((p, i) => { const a1 = a0 + p.value / tot * Math.PI * 2; segs.push({ p, i, a0, a1 }); a0 = a1; });
  const center = i => { const p = i == null ? null : P[i]; $('dc').innerHTML = p ? `${logo(p.tkr, 30)}<b class="num">${nf(p.value / tot * 100, 1)}%</b><small class="num">${money(p.value)}</small>` : `<span class="lbl-s">Összesen</span><b class="num">${money(tot)}</b><small>${P.length} részvény</small>`; };
  let cur = null, prog = REDUCED ? 1 : 0;
  const draw = hl => { if (!cv.isConnected) return; cur = hl; c.clearRect(0, 0, S0, S0); const lim = -Math.PI / 2 + prog * Math.PI * 2;
    segs.forEach(s => { if (s.a0 >= lim) return; const on = hl === s.i, r1 = on ? R1 + 6 : R1, e = Math.min(s.a1, lim);
      c.beginPath(); c.arc(cx, cx, r1, s.a0 + 0.018, e - 0.018); c.arc(cx, cx, R0 - (on ? 2 : 0), e - 0.018, s.a0 + 0.018, true); c.closePath();
      c.fillStyle = tColor(s.p.tkr); c.globalAlpha = hl == null || on ? 1 : 0.32; c.fill(); c.globalAlpha = 1; c.lineWidth = 2; c.strokeStyle = surf; c.stroke(); });
    document.querySelectorAll('.dli').forEach(b => b.classList.toggle('on', +b.dataset.i === hl)); center(hl); };
  const hit = e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left - cx, y = e.clientY - r.top - cx; const d = Math.hypot(x, y); if (d < R0 - 6 || d > R1 + 10) return null; let a = Math.atan2(y, x); if (a < -Math.PI / 2) a += Math.PI * 2; const s = segs.find(s => a >= s.a0 && a < s.a1); return s ? s.i : null; };
  if (prog < 1) { const t0 = performance.now(); const st = t => { prog = Math.min(1, (t - t0) / 650); prog = 1 - Math.pow(1 - prog, 3); draw(cur); if (prog < 1 && cv.isConnected) requestAnimationFrame(st); }; requestAnimationFrame(st); } else draw(null);
  cv.onpointermove = e => { const h = hit(e); if (h !== cur) draw(h); }; cv.onpointerdown = e => draw(hit(e)); cv.onpointerleave = () => draw(null);
  cv.onclick = e => { const i = hit(e); if (i != null) openTicker(P[i].tkr); };
  document.querySelectorAll('.dli').forEach(b => { b.onmouseenter = () => draw(+b.dataset.i); b.onmouseleave = () => draw(null); b.onfocus = () => draw(+b.dataset.i); });
}
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
      plugins: { vl: { fmt: r => moneyShort(r / K(), true) }, tooltip: { callbacks: { title: i => nm(rows[i[0].dataIndex].tkr), label: c => money(c.raw / K(), { sign: true }), afterLabel: c => { const t = rows[c.dataIndex].t; return t ? [`Realizált ${money(t.real, { sign: true })}`, `Nem realizált ${money(t.unreal, { sign: true })}`, `Osztalék ${money(t.div, { sign: true })}`] : ''; } } } } } });
  bindTickers();
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.rmode = b.dataset.m; render(true); });
  const thr = $('thr'); thr.oninput = () => { $('thrv').textContent = (+thr.value).toFixed(1); }; thr.onchange = () => { S.thr = +thr.value; render(true); $('thr').focus(); };
};

V.sp500 = m => {
  const last = m.series[m.series.length - 1];
  if (!market.history.SPY || last.spyVal == null) return `
    <section class="card"><h2>Mi lett volna, ha mindent S&P 500-ba teszel?</h2><p class="sub">Minden befizetést ugyanazon a napon SPY-ba fektetve, a mai áron értékelve.</p></section>
    <button class="insight" id="spWhy"><span class="in-ic">${ic('trend')}</span><span><b>Még nincs S&P 500 adat</b><small>Koppints ide: megmutatom, mi hiányzik, és egy gombbal letöltöm.</small></span>${ic('chev')}</button>`;
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
  const k = $('spWhy'); if (k) k.onclick = () => explainNoData('spy');
  if (!market.history.SPY) return;
  const spy = Engine.asOfLookup(market.history.SPY);
  const rows = m.flows.map(f => { const c = spy(f.date); return { ...f, val: c ? f.usd / c * spy(M.today) : 0 }; });
  chart('sp', { type: 'bar', data: { labels: rows.map(r => dhu(r.date)), datasets: [{ label: 'Befizetve', data: rows.map(r => r.usd * K()), backgroundColor: css('--tile'), borderRadius: 4 }, { label: 'Ma SPY-ban', data: rows.map(r => r.val * K()), backgroundColor: css('--accent'), borderRadius: 4 }] },
    options: { scales: { x: { grid: { display: false } }, y: { grid: grid(), border: { display: false }, ticks: axisMoney() } }, plugins: { vl: { only: 1, fmt: r => moneyShort(r / K()) }, legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, color: css('--ink') } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + money(c.raw / K()) } } } } });
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
function onboarding(step = 0) {
  $('bar').hidden = true; $('bnav').hidden = true;
  const slides = [
    ['A befektetéseid,', 'egy helyen.', 'Lightyear számláid összesítve, élő árfolyamokkal és az S&P 500-hoz mérve.'],
    ['Lásd, mi hozza', 'a hozamot.', 'Nyertesek, vesztesek, díjak, osztalékok és TBSZ-határidők egy pillantással.'],
    ['Kezdjük', 'a kivonattal.', 'Töltsd be a PDF-kivonataidat. A telefonodon maradnak, semmit nem küldünk el sehova.']];
  const [a, b, c] = slides[step];
  $('main').innerHTML = `
  <section class="onb2">
    <div class="ob-top"><span class="num">0${step + 1} / 03</span><span class="ob-prog">${slides.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</span>${step < 2 ? '<button class="ob-skip" id="obSkip">Kihagyás</button>' : '<span></span>'}</div>
    <h1>${a}<br><em>${b}</em></h1>
    <p>${c}</p>
    <div class="ob-art" aria-hidden="true">
      <div class="oa-card oa-back"></div>
      <div class="oa-card oa-front"><span>Portfólió</span><b class="num">$12 480,50</b><svg viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 48 C20 44 30 30 50 34 S80 50 100 36 S140 12 160 20 S190 8 200 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><small>▲ 3,2% · S&P 500 +2,1%</small></div>
      <div class="oa-pod"></div>
    </div>
    ${step < 2 ? `<button class="ob-btn" id="obNext">Tovább →</button>` : `<div class="drop" id="drop" role="button" tabindex="0"><b>Kivonatok kiválasztása</b><div class="sub">PDF, akár több egyszerre (pl. TBSZ 2025 és TBSZ 2026)</div></div>`}
  </section>`;
  const n = $('obNext'); if (n) n.onclick = () => onboarding(step + 1);
  const sk = $('obSkip'); if (sk) sk.onclick = () => onboarding(2);
  const d = $('drop'); if (!d) return;
  d.onclick = () => $('fileIn').click(); d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileIn').click(); } };
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
let sheetClose = null, skipPop = false;
function sheet(html) {
  const root = $('sheetRoot'); const prev = sheetClose ? null : document.activeElement;
  if (!sheetClose) { try { history.pushState({ sheet: 1 }, ''); } catch (_) {} }
  root.innerHTML = `<div class="scrim" data-close></div><aside class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</aside>`;
  const close = fromPop => { if (sheetClose !== close) return; root.innerHTML = ''; sheetClose = null; document.removeEventListener('keydown', k); if (!fromPop) { skipPop = true; history.back(); } prev && prev.focus && prev.focus(); };
  if (sheetClose) { const old = sheetClose; sheetClose = null; old.silent = true; }
  sheetClose = close;
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
    <div class="tk-head"><div class="tkh" id="tkHead"></div><div class="seg" role="group" aria-label="Időszak">${[['1m', '1H'], ['3m', '3H'], ['6m', '6H'], ['1y', '1É'], ['all', 'Mind']].map(([k, l]) => `<button data-tr="${k}" aria-pressed="${(S.tr || 'all') === k}">${l}</button>`).join('')}</div></div>
    <div class="chart" style="height:240px;margin:0"><canvas id="tkc" aria-label="${esc(t)} árfolyam vételi és eladási pontokkal"></canvas><div class="ftip" id="tkTip" hidden></div></div>
    <div class="keys" style="margin-top:-4px"><span><b class="pos">▲</b> vétel</span><span><b class="neg">▼</b> eladás</span>${p ? '<span><i style="border-top-style:dashed;border-color:var(--muted)"></i>átlagos bekerülési ár</span>' : ''}</div>
    <dl class="kv"><dt>Realizált</dt><dd class="num ${cls(tk.real)}">${money(tk.real, { sign: true })}</dd><dt>Nem realizált</dt><dd class="num ${cls(tk.unreal)}">${money(tk.unreal, { sign: true })}</dd><dt>Osztalék (nettó)</dt><dd class="num pos">${money(tk.div, { sign: true })}</dd><dt><b>Összesen</b></dt><dd class="num ${cls(tk.total)}"><b>${money(tk.total, { sign: true })}</b></dd></dl>
    <div><h2 style="font-size:.95rem;margin-bottom:6px">Vételek és eladások időzítése</h2><div class="list" id="timing"></div></div>
    <div><h2 style="font-size:.95rem;margin-bottom:6px">Összes tranzakció</h2><div class="list">${tx.map(r => `<div class="li" style="cursor:default"><span class="tag">${TY[r.type]}</span><span class="s">${dhu(r.date)}${r.qty ? ' · ' + nf(r.qty, 4) + ' db @ ' + (r.ccy === 'EUR' ? nf(r.price, 2) + ' €' : usd(r.price)) : ''}</span><span class="r num">${r.ccy === 'EUR' ? nf(r.type === 'D' ? r.net : r.gross, 2) + ' €' : usd(r.type === 'D' ? r.net : r.gross)}</span></div>`).join('')}</div></div>`);
  tickerChart(t, p);
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
function openSettings(focus) {
  const s = sheet(`<div class="sheet-h"><div><div class="lbl-s">Beállítások</div><h2 style="font-size:1.3rem">Adatok és frissítés</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    <div class="field"><label>Kivonatok</label>
      <div class="list">${statements.map((st, i) => `<div class="li" style="cursor:default"><span class="tk">${esc((st.label || '').slice(-2) || 'LY')}</span><span><div class="n">${esc(st.label || st.acct)}</div><div class="s">${esc(st.acct)} · ${dhu(st.from)}–${dhu(st.to)} · ${st.rows.length} tétel</div></span><button class="ibtn" data-del="${i}" aria-label="Törlés">✕</button></div>`).join('')}</div>
      <button class="btn ghost" id="addSt">Kivonat hozzáadása vagy frissítése (PDF)</button>
      <p class="sub">Ugyanannak a számlának az újabb kivonata felülírja az érintett időszak tételeit, így nem lesz duplikáció.</p></div>
    <div class="field"><label for="key">Twelve Data API-kulcs (élő árfolyamok)</label>
      <input type="password" id="key" value="${esc(apiKey)}" placeholder="pl. 1a2b3c…" autocomplete="off" spellcheck="false">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="saveKey">Mentés és frissítés</button><button class="btn ghost" id="reload">Előzmények újratöltése</button></div>
      <p class="sub">Ingyenes kulcs: <a href="https://twelvedata.com/register" target="_blank" rel="noopener">twelvedata.com/register</a>, utána a Dashboard → API Keys oldalon. Az ingyenes keret percenként 8, naponta 800 lekérést enged; az első letöltés ezért kb. 2–3 percig tart. Az USD/HUF árfolyam az Európai Központi Bank adataiból jön, kulcs nélkül.</p></div>
    <div class="field"><label for="fkey">Finnhub API-kulcs (naptár és hírek)</label>
      <input type="password" id="fkey" value="${esc(fhKey)}" placeholder="pl. c1a2b3…" autocomplete="off" spellcheck="false">
      <div><button class="btn" id="saveF">Mentés és frissítés</button></div>
      <p class="sub">Ingyenes kulcs: <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io/register</a>, belépés után a Dashboard főoldalán látod. Ebből jönnek a gyorsjelentések időpontjai és a cégek hírei.</p></div>
    <div class="field" id="diagField"><label>Adatforrások állapota</label>${diagHtml()}</div>
    <div class="field"><label>Megjelenés</label><div class="seg" role="group" aria-label="Téma">${[['auto', 'Rendszer'], ['light', 'Világos'], ['dark', 'Sötét']].map(([k, l]) => `<button data-th="${k}" aria-pressed="${S.theme === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label>Telepítés</label>${installEvt ? '<button class="btn ghost" id="install">App telepítése a kezdőképernyőre</button>' : ''}<p class="sub">Androidon a Chrome menüjében (⋮) válaszd a „Hozzáadás a kezdőképernyőhöz” vagy „App telepítése” lehetőséget. iPhone-on a Safari Megosztás gombja → „Főképernyőhöz adás”.</p></div>
    <div class="field"><label>Adatok törlése</label><button class="btn danger" id="wipe">Minden adat törlése erről a készülékről</button></div>`);
  $('addSt').onclick = () => { s.close(); $('fileIn').click(); };
  $('dgTest').onclick = diagTest;
  if (focus === 'diag') setTimeout(() => $('diagField').scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
  $('saveF').onclick = () => { fhKey = $('fkey').value.trim(); store.set('bf-fhkey', fhKey); if (market.cal) market.cal.at = 0; s.close(); refresh(); };
  s.root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const i = +b.dataset.del; if (b.dataset.sure) { statements.splice(i, 1); store.set('bf-st', statements); s.close(); compute(); boot(); } else { b.dataset.sure = 1; b.textContent = 'Biztos?'; } });
  $('saveKey').onclick = () => { apiKey = $('key').value.trim(); store.set('bf-key', apiKey); s.close(); drawStatus(); refresh(); };
  $('reload').onclick = () => { market.history = {}; store.set('bf-mkt', market); s.close(); refresh({ force: true }); };
  s.root.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { S.theme = b.dataset.th; store.set('bf-theme', S.theme); applyTheme(); s.root.querySelectorAll('[data-th]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const ib = $('install'); if (ib) ib.onclick = async () => { installEvt.prompt(); installEvt = null; s.close(); };
  $('wipe').onclick = e => { const b = e.currentTarget; if (b.dataset.sure) { ['bf-st', 'bf-mkt', 'bf-key', 'bf-fhkey', 'bf-alertlog', 'bf-alerted', 'bf-alertcfg'].forEach(store.del); fhKey = ''; alertLog = []; statements = []; market = { history: {}, fx: {}, usdhuf: null, updatedAt: 0 }; apiKey = ''; s.close(); compute(); boot(); } else { b.dataset.sure = 1; b.textContent = 'Biztosan törlöd? Koppints újra.'; } };
}

/* ---------- TBSZ ---------- */
// TBSZ: gyűjtőév = a nyitás éve; utána 3 év lekötés (kivét 10% adóval), 5 év után adómentes. Normál számla: 15% SZJA + 13% szocho.
function tbszAccounts() {
  if (!M) return [];
  return statements.map(st => {
    const y = +(((st.label || '').match(/TBSZ\s*(\d{4})/i) || [])[1]); if (!y) return null;
    const posVal = sum(st.positions, p => p.qty * (M.priceAt(p.tkr, M.today) || 0));
    const cash = sum(Object.entries(st.cash || {}), ([c, v]) => c === 'USD' ? v : c === 'HUF' ? v / R() : c === 'EUR' ? v * 1.16 : v);
    const dep = sum(M.flows.filter(f => f.acct === st.acct), f => f.usd);
    const value = posVal + cash, gain = value - dep;
    const start = `${y}-01-01`, gy = `${y}-12-31`, t3 = `${y + 3}-12-31`, t5 = `${y + 5}-12-31`;
    const days = d => Math.ceil((Date.parse(d + 'T23:59:59') - Date.parse(M.today + 'T12:00:00')) / 864e5);
    let phase, next, nextLbl, rate;
    if (M.today <= gy) { phase = 'Gyűjtőév'; next = gy; nextLbl = 'még befizethetsz'; rate = 28; }
    else if (M.today <= t3) { phase = 'Lekötés'; next = t3; nextLbl = 'a 3 éves határig'; rate = 28; }
    else if (M.today <= t5) { phase = 'Kedvezményes'; next = t5; nextLbl = 'az adómentességig'; rate = 10; }
    else { phase = 'Adómentes'; next = null; rate = 0; }
    const span = Date.parse(t5) - Date.parse(start); const prog = Math.max(0, Math.min(1, (Date.parse(M.today) - Date.parse(start)) / span));
    const mark = d => (Date.parse(d) - Date.parse(start)) / span;
    return { st, y, value, dep, gain, gy, t3, t5, phase, next, nextLbl, daysLeft: next ? days(next) : 0, rate, prog, m1: mark(gy), m3: mark(t3) };
  }).filter(Boolean).sort((a, b) => a.y - b.y);
}
function tbszCard() {
  const A = tbszAccounts(); if (!A.length) return '';
  return `<section class="card lift tbsz" id="tbszCard" role="button" tabindex="0"><div class="card-h"><div><h2>TBSZ</h2><p class="sub">Lekötés és adó · koppints a részletekért</p></div></div>
    ${A.map(a => `<div class="tb-row"><div class="tb-top"><b>${esc(a.st.label)}</b><span class="tag">${a.phase}</span><span class="sub num" style="margin-left:auto">${a.next ? `${nf(a.daysLeft)} nap ${a.nextLbl}` : 'adómentesen kivehető'}</span></div>
      <div class="tb-bar"><i style="width:${a.prog * 100}%"></i><u style="left:${a.m1 * 100}%"></u><u style="left:${a.m3 * 100}%"></u></div>
      <div class="tb-lbl sub"><span>${a.y}</span><span style="left:${a.m1 * 100}%">gyűjtőév vége</span><span style="left:${a.m3 * 100}%">10%</span><span style="right:0">0% · ${a.y + 5}</span></div></div>`).join('')}</section>`;
}
function openTbsz() {
  const A = tbszAccounts();
  const s = sheet(`<div class="sheet-h"><div><div class="lbl-s">TBSZ</div><h2 style="font-size:1.3rem">Lekötés és adóelőny</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    ${A.map(a => { const gH = a.gain * R(); const normal = Math.max(0, gH) * 0.28;
      return `<div class="card" style="box-shadow:none"><div class="card-h"><div><h2>${esc(a.st.label)}</h2><p class="sub">${esc(a.st.acct)}</p></div><span class="tag">${a.phase}</span></div>
      <dl class="kv"><dt>Mostani érték</dt><dd class="num">${money(a.value)}</dd><dt>Befizetve</dt><dd class="num">${money(a.dep)}</dd><dt>Eredmény</dt><dd class="num ${cls(a.gain)}">${money(a.gain, { sign: true })}</dd>
      <dt>Gyűjtőév vége</dt><dd class="num">${dhu(a.gy)}</dd><dt>10%-os kivét ettől</dt><dd class="num">${dhu(Engine.addDays(a.t3, 1))}</dd><dt>Adómentes ettől</dt><dd class="num">${dhu(Engine.addDays(a.t5, 1))}</dd>
      <dt>Ha most kivennéd</dt><dd class="num">${a.rate}% adó</dd></dl>
      <p class="sub" style="margin-top:10px">${gH > 0 ? `Normál számlán a mostani nyereség után kb. <b class="num">${nf(normal)} Ft</b> adó lenne (15% SZJA + 13% szocho). A lekötés végén ez <b>0 Ft</b>.` : 'Most nincs nyereség, így adó sem lenne. Minden 100 000 Ft nyereségen a lekötés végéig kitartva kb. 28 000 Ft adót spórolsz.'}${a.phase === 'Gyűjtőév' ? ` A gyűjtőévben még <b>${nf(a.daysLeft)} napig</b> fizethetsz be erre a számlára.` : ''}</p></div>`; }).join('')}
    <p class="sub">Tájékoztató számítás: a szocho éves felső határát és a korábbi évek veszteségét nem veszi figyelembe. Ha a lekötés alatt pénzt veszel ki, a számla megszakad.</p>`);
  return s;
}

/* ---------- ágazat és ország ---------- */
const SECTOR = { AAPL: 'Technológia', MSFT: 'Technológia', NVDA: 'Technológia', AMD: 'Technológia', INTC: 'Technológia', ORCL: 'Technológia', CRM: 'Technológia', ADBE: 'Technológia', NOW: 'Technológia', SHOP: 'Technológia', PLTR: 'Technológia', APP: 'Technológia', SOUN: 'Technológia', DUOL: 'Technológia', KULR: 'Technológia',
  GOOGL: 'Kommunikáció', GOOG: 'Kommunikáció', META: 'Kommunikáció', NFLX: 'Kommunikáció', DIS: 'Kommunikáció',
  AMZN: 'Ciklikus fogyasztás', TSLA: 'Ciklikus fogyasztás', NKE: 'Ciklikus fogyasztás', SBUX: 'Ciklikus fogyasztás', MCD: 'Ciklikus fogyasztás', ABNB: 'Ciklikus fogyasztás', CAKE: 'Ciklikus fogyasztás',
  EL: 'Alapvető fogyasztás', ELF: 'Alapvető fogyasztás', CELH: 'Alapvető fogyasztás', HNST: 'Alapvető fogyasztás', KO: 'Alapvető fogyasztás', PEP: 'Alapvető fogyasztás',
  SOFI: 'Pénzügy', PYPL: 'Pénzügy', V: 'Pénzügy', MA: 'Pénzügy', JPM: 'Pénzügy', BAC: 'Pénzügy', COIN: 'Pénzügy', HOOD: 'Pénzügy',
  NVO: 'Egészségügy', LLY: 'Egészségügy', PFE: 'Egészségügy', JNJ: 'Egészségügy', UBER: 'Ipar', Z: 'Ingatlan', ES: 'Energia', SPY: 'Index', VOO: 'Index', QQQ: 'Index' };
const COUNTRY_OVR = { NVO: 'Dánia' };
const CC = { US: 'USA', FR: 'Franciaország', DE: 'Németország', GB: 'Egyesült Királyság', NL: 'Hollandia', IE: 'Írország', DK: 'Dánia', CH: 'Svájc', CA: 'Kanada', JP: 'Japán', HU: 'Magyarország', EE: 'Észtország' };
function countryOf(t) { if (COUNTRY_OVR[t]) return COUNTRY_OVR[t]; const r = M.tx.find(x => x.tkr === t && x.isin); const c = r ? r.isin.slice(0, 2) : ''; return CC[c] || c || 'Ismeretlen'; }
function breakdownCard(m) {
  const by = S.bd === 'country' ? countryOf : t => SECTOR[t] || 'Egyéb';
  const g = {}; m.positions.forEach(p => { const k = by(p.tkr); (g[k] = g[k] || { k, v: 0, items: [] }).v += p.value; g[k].items.push(p); });
  const tot = sum(m.positions, p => p.value); const rows = Object.values(g).sort((a, b) => b.v - a.v);
  return `<section class="card lift"><div class="card-h"><div><h2>Megoszlás</h2><p class="sub">Koppints egy sorra a részvényekért</p></div>
    <div class="seg" role="group" aria-label="Megoszlás"><button data-bd="sector" aria-pressed="${S.bd !== 'country'}">Ágazat</button><button data-bd="country" aria-pressed="${S.bd === 'country'}">Ország</button></div></div>
    <div class="bd">${rows.map((r, i) => `<details class="bdr"><summary><span class="bdn">${esc(r.k)}</span><span class="num bdp">${nf(r.v / tot * 100, 1)}%</span><span class="bdb"><i style="width:${r.v / rows[0].v * 100}%;background:${shade(i)}"></i></span></summary>
      <div class="bdi">${r.items.sort((a, b) => b.value - a.value).map(p => `<button class="li" data-t="${p.tkr}"><span class="tk">${p.tkr}</span><span><div class="n">${esc(nm(p.tkr))}</div><div class="s num">${nf(p.value / tot * 100, 1)}% a portfólióból</div></span><span class="r num">${money(p.value)}<div class="s ${cls(p.pnl)}">${pct(p.pct)}</div></span></button>`).join('')}</div></details>`).join('')}</div></section>`;
}

/* ---------- riasztások ---------- */
let alertCfg = store.get('bf-alertcfg', { day: 5, port: 3, ath: true, notify: false, price: {} });
let alertLog = store.get('bf-alertlog', []);
function pushAlert(key, title, body, tkr) {
  const seen = store.get('bf-alerted', []); if (seen.includes(key)) return; seen.push(key); store.set('bf-alerted', seen.slice(-300));
  alertLog.unshift({ ts: Date.now(), title, body, tkr, read: false }); alertLog = alertLog.slice(0, 60); store.set('bf-alertlog', alertLog);
  if (alertCfg.notify && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: key })).catch(() => {});
  }
}
function checkAlerts() {
  if (!M) return; const d = M.today; const c = alertCfg; const hid = S.hide; S.hide = false;
  for (const p of M.positions) {
    if (p.dayChg != null && Math.abs(p.dayChg) >= c.day) pushAlert(`${d}|day|${p.tkr}`, `${p.tkr} ${pct(p.dayChg)} ma`, `${nm(p.tkr)}: ${usd(p.price)}, a pozíciód ${money(p.dayAbs, { sign: true })}.`, p.tkr);
    const pa = c.price[p.tkr];
    if (pa && pa.above && p.price >= pa.above) pushAlert(`${d}|above|${p.tkr}|${pa.above}`, `${p.tkr} ${usd(pa.above)} fölött`, `Mostani ár: ${usd(p.price)}.`, p.tkr);
    if (pa && pa.below && p.price <= pa.below) pushAlert(`${d}|below|${p.tkr}|${pa.below}`, `${p.tkr} ${usd(pa.below)} alatt`, `Mostani ár: ${usd(p.price)}.`, p.tkr);
  }
  const base = M.value - M.dayChange; const pp = base > 0 ? M.dayChange / base * 100 : 0;
  if (M.positions.some(p => p.dayChg != null) && Math.abs(pp) >= c.port) pushAlert(`${d}|port`, `A portfólió ${pct(pp)} ma`, `Mai változás: ${money(M.dayChange, { sign: true })}.`);
  if (c.ath && M.series.length > 20) { const s = M.series; const last = s[s.length - 1].nav; const prevMax = Math.max(...s.slice(0, -1).map(x => x.nav)); if (last > prevMax) pushAlert(`${d}|ath`, 'Új csúcs', `A portfóliód árfolyama még sosem volt ilyen magasan (${pct(last - 100)} a kezdés óta).`); }
  S.hide = hid; drawBell();
}
function drawBell() { const b = $('bellBtn'); if (!b) return; const n = alertLog.filter(a => !a.read).length; b.querySelector('em').textContent = n || ''; b.querySelector('em').hidden = !n; }
function openAlerts() {
  alertLog.forEach(a => a.read = true); store.set('bf-alertlog', alertLog); drawBell();
  const ts = M ? M.positions.map(p => p.tkr).sort() : [];
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const s = sheet(`<div class="sheet-h"><div><div class="lbl-s">Riasztások</div><h2 style="font-size:1.3rem">Értesítések</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    <div class="list">${alertLog.length ? alertLog.slice(0, 30).map(a => `<button class="li" ${a.tkr ? `data-t="${esc(a.tkr)}"` : ''}><span class="tk">${esc(a.tkr || '★')}</span><span><div class="n">${esc(a.title)}</div><div class="s">${esc(a.body)}</div></span><span class="r s">${new Date(a.ts).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}</span></button>`).join('') : '<div class="empty">Még nincs riasztás. Ha egy szabály teljesül, itt jelenik meg, és értesítést is kapsz, ha engedélyezed.</div>'}</div>
    <div class="field"><label>Szabályok</label>
      <dl class="kv" style="align-items:center"><dt><label for="aDay">Részvény napi mozgása legalább (%)</label></dt><dd><input type="number" id="aDay" min="1" step="0.5" value="${alertCfg.day}" style="width:90px"></dd>
      <dt><label for="aPort">Portfólió napi mozgása legalább (%)</label></dt><dd><input type="number" id="aPort" min="0.5" step="0.5" value="${alertCfg.port}" style="width:90px"></dd>
      <dt><label for="aAth">Új csúcs a portfólióban</label></dt><dd><input type="checkbox" id="aAth" ${alertCfg.ath ? 'checked' : ''}></dd></dl></div>
    <div class="field"><label>Árszint-riasztás</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="aT">${ts.map(t => `<option>${t}</option>`).join('')}</select>
      <input type="number" id="aAbove" placeholder="fölött $" step="0.01" style="width:100px"><input type="number" id="aBelow" placeholder="alatt $" step="0.01" style="width:100px"><button class="btn ghost" id="aAdd">Hozzáadás</button></div>
      <div class="list" id="aList">${Object.entries(alertCfg.price).map(([t, v]) => `<div class="li" style="cursor:default"><span class="tk">${t}</span><span class="s">${v.above ? `${usd(v.above)} fölött ` : ''}${v.below ? `${usd(v.below)} alatt` : ''}</span><button class="ibtn" data-rm="${t}" aria-label="Törlés">✕</button></div>`).join('')}</div></div>
    <div class="field"><label>Telefonos értesítés</label>
      ${perm === 'unsupported' ? '<p class="sub">Ez a böngésző nem támogatja az értesítéseket.</p>' : perm === 'granted' ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="aNotify" ${alertCfg.notify ? 'checked' : ''}> Értesítés küldése</label>` : `<button class="btn" id="aPerm">Értesítések engedélyezése</button>`}
      <p class="sub">A riasztásokat az app minden frissítéskor ellenőrzi (megnyitáskor és 15 percenként, amíg fut). Bezárt appnál nem fut, ehhez szerver kellene.</p></div>
    <button class="btn" id="aSave">Mentés</button>`);
  bindTickers(s.root);
  const save = () => { alertCfg.day = +$('aDay').value || 5; alertCfg.port = +$('aPort').value || 3; alertCfg.ath = $('aAth').checked; const n = $('aNotify'); if (n) alertCfg.notify = n.checked; store.set('bf-alertcfg', alertCfg); };
  $('aSave').onclick = () => { save(); s.close(); toast('Riasztások elmentve.'); checkAlerts(); };
  $('aAdd').onclick = () => { const t = $('aT').value, a = +$('aAbove').value || null, b = +$('aBelow').value || null; if (!t || (!a && !b)) return; alertCfg.price[t] = { above: a, below: b }; save(); s.close(); openAlerts(); };
  s.root.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { delete alertCfg.price[b.dataset.rm]; save(); s.close(); openAlerts(); });
  const pb = $('aPerm'); if (pb) pb.onclick = async () => { const r = await Notification.requestPermission(); if (r === 'granted') { alertCfg.notify = true; save(); toast('Értesítések bekapcsolva.'); } s.close(); openAlerts(); };
}

/* ---------- naptár és hírek (Finnhub) ---------- */
let fhKey = store.get('bf-fhkey', '');
async function fetchCalendar(force) {
  if (!fhKey || !M) return; const cal = market.cal || {};
  if (!force && cal.at && Date.now() - cal.at < 6 * 3600e3) return;
  const syms = M.positions.map(p => p.tkr).filter(t => M.usTickers.includes(t));
  const from = Engine.addDays(M.today, -10), to = Engine.addDays(M.today, 120), nf7 = Engine.addDays(M.today, -7);
  const earnings = [], news = [];
  for (const t of syms) {
    setStatus(`Naptár és hírek: ${t}…`, 'busy');
    try { const j = await getJson(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(fhKey)}`); (j.earningsCalendar || []).forEach(e => earnings.push({ ...e, symbol: e.symbol || t })); } catch (e) {}
    try { const j = await getJson(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(t)}&from=${nf7}&to=${M.today}&token=${encodeURIComponent(fhKey)}`); if (Array.isArray(j)) j.slice(0, 4).forEach(n => news.push({ t, at: n.datetime * 1000, h: n.headline, src: n.source, url: n.url })); } catch (e) {}
  }
  market.cal = { at: Date.now(), earnings, news };
  diag('fh', { ok: earnings.length + news.length > 0, msg: `${earnings.length} jelentés, ${news.length} hír` });
}
function estDividends() {
  const out = []; const by = {};
  M.divs.forEach(d => (by[d.tkr] = by[d.tkr] || []).push(d));
  for (const [t, ds] of Object.entries(by)) {
    if (!M.positions.find(p => p.tkr === t) || ds.length < 2) continue;
    const dates = ds.map(d => d.date).sort(); const gaps = dates.slice(1).map((d, i) => (Date.parse(d) - Date.parse(dates[i])) / 864e5).sort((a, b) => a - b);
    const gap = Math.round(gaps[Math.floor(gaps.length / 2)]); if (gap < 20) continue;
    let next = Engine.addDays(dates[dates.length - 1], gap); while (next < M.today) next = Engine.addDays(next, gap);
    const last = ds[ds.length - 1]; const p = M.positions.find(x => x.tkr === t);
    out.push({ date: next, kind: 'div', t, title: `${t} osztalék (becslés)`, sub: `kb. ${usd(last.netUsd)} nettó · ${Math.round(gap)} naponta fizet`, est: true });
  }
  return out;
}
function calendarEvents() {
  const ev = [];
  (market.cal && market.cal.earnings || []).forEach(e => ev.push({ date: e.date, kind: 'earn', t: e.symbol, title: `${e.symbol} gyorsjelentés`, sub: `${e.year ? `${e.year} Q${e.quarter} · ` : ''}${e.hour === 'bmo' ? 'nyitás előtt' : e.hour === 'amc' ? 'zárás után' : 'időpont nyitott'}${e.epsEstimate != null ? ` · EPS várakozás ${usd(e.epsEstimate)}` : ''}${e.epsActual != null ? ` · tény ${usd(e.epsActual)}` : ''}` }));
  estDividends().forEach(e => ev.push(e));
  tbszAccounts().forEach(a => {
    if (a.phase === 'Gyűjtőév') ev.push({ date: a.gy, kind: 'tbsz', title: `${a.st.label}: utolsó befizetési nap`, sub: 'A gyűjtőév vége, utána nem fizethetsz be erre a számlára' });
    ev.push({ date: Engine.addDays(a.t3, 1), kind: 'tbsz', title: `${a.st.label}: 10%-os kivét lehetséges`, sub: 'Lejár a 3 éves lekötés' });
    ev.push({ date: Engine.addDays(a.t5, 1), kind: 'tbsz', title: `${a.st.label}: adómentes`, sub: 'Lejár az 5 éves lekötés' });
  });
  const y = +M.today.slice(0, 4); [y, y + 1].forEach(yy => { const d = `${yy}-12-31`; if (d >= M.today && !tbszAccounts().some(a => a.y === yy)) ev.push({ date: `${yy}-01-01`, kind: 'tbsz', title: `TBSZ ${yy} nyitható`, sub: 'Új gyűjtőév kezdődik' }); });
  return ev.filter(e => e.date >= Engine.addDays(M.today, -10)).sort((a, b) => a.date < b.date ? -1 : 1);
}
const KIND = { earn: ['Jelentés', 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5'], div: ['Osztalék', 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'], tbsz: ['TBSZ', 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z'] };
V.naptar = m => {
  const ev = calendarEvents(); const news = (market.cal && market.cal.news || []).sort((a, b) => b.at - a.at).slice(0, 20);
  let last = ''; const MON = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  return `
  ${!fhKey ? `<div class="tip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><p><b>Gyorsjelentések és hírek.</b> Ehhez egy ingyenes Finnhub kulcs kell (<a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io/register</a>). <a href="#" id="fhSet">Kulcs megadása</a>. Az osztalék-becslés és a TBSZ-határidők kulcs nélkül is látszanak.</p></div>` : ''}
  <section class="card"><div class="card-h"><div><h2>Közelgő események</h2><p class="sub">Gyorsjelentések, várható osztalékok, TBSZ-határidők</p></div></div>
    <div class="cal">${ev.length ? ev.map(e => { const mo = e.date.slice(0, 7); let h = ''; if (mo !== last) { last = mo; h = `<div class="month">${MON[+mo.slice(5) - 1]} ${mo.slice(0, 4)}</div>`; }
      const past = e.date < m.today; const dd = Math.ceil((Date.parse(e.date) - Date.parse(m.today)) / 864e5);
      return h + `<button class="cev${past ? ' past' : ''}" ${e.t ? `data-t="${esc(e.t)}"` : 'data-tbsz="1"'}><span class="cd"><b class="num">${+e.date.slice(8)}</b><small>${['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][new Date(e.date + 'T12:00:00').getDay()]}</small></span>
        <span><div class="n">${esc(e.title)}</div><div class="s">${esc(e.sub)}</div></span><span class="r"><span class="ktag k-${e.kind}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${KIND[e.kind][1]}"/></svg>${KIND[e.kind][0]}</span><div class="s num">${dd === 0 ? 'ma' : dd > 0 ? `${dd} nap múlva` : `${-dd} napja`}</div></span></button>`; }).join('') : '<div class="empty">Nincs közelgő esemény.</div>'}</div></section>
  ${fhKey ? `<section class="card"><div class="card-h"><div><h2>Hírek a cégeidről</h2><p class="sub">Az elmúlt 7 nap · forrás: Finnhub</p></div></div>
    <div class="list">${news.length ? news.map(n => `<a class="li news" href="${esc(n.url)}" target="_blank" rel="noopener"><span class="tk">${esc(n.t)}</span><span><div class="n" style="white-space:normal">${esc(n.h)}</div><div class="s">${esc(n.src)} · ${new Date(n.at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></span><span></span></a>`).join('') : '<div class="empty">Még nincs hír. Nyomd meg a frissítés gombot.</div>'}</div></section>` : ''}`;
};
V.naptar.after = () => {
  bindTickers(); document.querySelectorAll('[data-tbsz]').forEach(b => b.onclick = openTbsz);
  const f = $('fhSet'); if (f) f.onclick = e => { e.preventDefault(); openSettings(); };
};

/* ---------- részletes részvénygrafikon ---------- */
function tickerChart(t, p) {
  const c = $('tkc'); if (!c) return; const TR = { '1m': 31, '3m': 92, '6m': 183, '1y': 366 };
  const tx = M.tx.filter(r => r.tkr === t && (r.type === 'B' || r.type === 'S'));
  const h = market.history[t]; const hasH = h && Object.keys(h).length > 5;
  const first = tx.length ? tx[0].date : M.today; const lastTx = tx.length ? tx[tx.length - 1].date : M.today;
  const end = p ? M.today : (Engine.addDays(lastTx, 45) < M.today ? Engine.addDays(lastTx, 45) : M.today);
  const fromR = TR[S.tr] ? Engine.addDays(end, -TR[S.tr]) : Engine.addDays(first, -30);
  const ds = hasH ? Object.keys(h).sort().filter(d => d >= fromR && d <= end) : M.series.map(x => x.d).filter(d => d >= fromR && d <= end);
  if (ds.length < 3) { c.parentElement.hidden = true; return; }
  const pts = ds.map(d => { const v = hasH ? h[d] : M.priceAt(t, d); return { d, value: v, invested: 0, nav: v }; });
  const idxOf = d => { const i = ds.findIndex(x => x >= d); return i < 0 ? ds.length - 1 : i; };
  const markers = tx.filter(r => r.date >= ds[0]).map(r => ({ i: idxOf(r.date), type: r.type, price: r.ccy === 'EUR' ? r.price * 1.16 : r.price, r }));
  const hd = $('tkHead'); const headAt = i => { const q = pts[i == null ? pts.length - 1 : i]; const ch = (q.nav / pts[0].nav - 1) * 100; hd.innerHTML = `<b class="num">${usd(q.nav)}</b><span class="pp ${ch >= 0 ? 'up' : 'down'} num">${pct(ch)}</span><small>${i == null ? (TR[S.tr] ? 'az időszakban' : 'az első vétel óta') : dShort(q.d)}</small>`; };
  if (hd) headAt(null);
  document.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { S.tr = b.dataset.tr; document.querySelectorAll('[data-tr]').forEach(x => x.setAttribute('aria-pressed', x === b)); tickerChart(t, p); });
  const tip = $('tkTip');
  stockChart(c, pts, (i, x, y, W) => {
    if (hd) headAt(i);
    if (i == null) { tip.hidden = true; return; }
    const mk = markers.filter(k => k.i === i);
    tip.innerHTML = `<div class="td">${dShort(pts[i].d)}</div><div class="tv num">${usd(pts[i].nav)}</div>${mk.map(k => `<div class="num ${k.type === 'B' ? 'pos' : 'neg'}">${k.type === 'B' ? 'Vétel' : 'Eladás'} ${nf(k.r.qty, 3)} db @ ${usd(k.price)}</div>`).join('')}`;
    tip.hidden = false; const tw = tip.offsetWidth; const left = x + 12 + tw > W - 4 ? x - 12 - tw : x + 12; tip.style.transform = `translate(${Math.max(4, left)}px, 4px)`;
  }, { price: true, animate: true, markers, ref: p ? p.cost / p.qty : null });
  // időzítés: a vételi ár hol áll a környező ±30 nap záróárai között
  const tl = $('timing'); if (!tl) return;
  tl.innerHTML = tx.map(r => {
    const price = r.ccy === 'EUR' ? r.price * 1.16 : r.price; const now = p ? p.price : null;
    let badge = '';
    if (hasH) { const win = Object.keys(h).filter(d => d >= Engine.addDays(r.date, -30) && d <= Engine.addDays(r.date, 30)).map(d => h[d]);
      if (win.length > 10) { const below = win.filter(v => v < price).length / win.length; const good = r.type === 'B' ? below <= 0.33 : below >= 0.67, bad = r.type === 'B' ? below >= 0.67 : below <= 0.33;
        badge = `<span class="ktag ${good ? 'k-good' : bad ? 'k-bad' : ''}">${good ? 'jó időzítés' : bad ? (r.type === 'B' ? 'drágán vett' : 'olcsón adta el') : 'átlagos'}</span>`; } }
    const since = r.type === 'B' && now ? (now / price - 1) * 100 : null;
    return `<div class="li" style="cursor:default"><span class="tag ${r.type === 'B' ? 'tb-b' : 'tb-s'}">${r.type === 'B' ? 'Vétel' : 'Eladás'}</span><span><div class="n num">${dhu(r.date)} · ${usd(price)}</div><div class="s num">${nf(r.qty, 4)} db · ${usd(r.gross * (r.ccy === 'EUR' ? 1.16 : 1))}${since != null ? ` · azóta <span class="${cls(since)}">${pct(since)}</span>` : ''}</div></span><span class="r">${badge}</span></div>`;
  }).join('') + (hasH ? '' : '<p class="sub">Az időzítés értékeléséhez élő árfolyam (Twelve Data) kell.</p>');
}

/* ---------- hiányzó adat magyarázata ---------- */
function explainNoData(kind) {
  const d = (market.diag || {}).td; const what = kind === 'spy' ? 'Az S&P 500 összehasonlításhoz' : 'A mai változáshoz';
  let why, act = '';
  if (!apiKey) { why = 'Nincs megadva Twelve Data kulcs.'; act = '<button class="btn" id="ndSet">Kulcs megadása</button>'; }
  else if (S.busy) why = 'A letöltés éppen folyamatban van. Néhány perc, és megjelenik.';
  else if (d && !d.ok) { why = 'A legutóbbi letöltés nem sikerült: ' + esc(d.msg); act = '<button class="btn" id="ndRef">Újrapróbálom</button>'; }
  else if (kind === 'spy') { why = 'Az S&P 500 adatai még nem jöttek le' + (market.errors && market.errors.length ? ': ' + esc(market.errors.filter(e => /SPY|VOO|IVV|SPX/.test(e)).join('; ') || market.errors[0]) : '.'); act = '<button class="btn" id="ndRef">Letöltés most</button>'; }
  else { why = 'Még nincsenek napi árak.'; act = '<button class="btn" id="ndRef">Letöltés most</button>'; }
  const s = sheet(`<div class="sheet-h"><div><div class="lbl-s">Hiányzó adat</div><h2 style="font-size:1.25rem">${what} élő árfolyam kell</h2></div><button class="ibtn" data-close aria-label="Bezárás">✕</button></div>
    <p>${why}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${act}<button class="btn ghost" id="ndDiag">Adatforrások állapota</button></div>`);
  const a = $('ndSet'); if (a) a.onclick = () => { s.close(); setTimeout(openSettings, 50); };
  const r = $('ndRef'); if (r) r.onclick = () => { s.close(); refresh({ force: kind === 'spy' }); };
  $('ndDiag').onclick = () => { s.close(); setTimeout(() => openSettings('diag'), 50); };
}
function diagHtml() {
  const D = market.diag || {}; const row = (k, l) => { const d = D[k]; return `<div class="dg"><i class="${!d ? '' : d.ok ? 'ok' : 'bad'}"></i><span><b>${l}</b><small>${d ? esc(d.msg) + ' · ' + new Date(d.at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'még nem futott'}</small></span></div>`; };
  const spy = market.history.SPY ? Object.keys(market.history.SPY).sort() : [];
  return `${row('td', 'Twelve Data (árfolyamok)')}${row('fx', 'ECB (USD/HUF)')}${row('fh', 'Finnhub (naptár, hírek)')}
    <div class="dg"><i class="${spy.length ? 'ok' : 'bad'}"></i><span><b>S&P 500 (${esc(market.benchSym || 'SPY')})</b><small>${spy.length ? `${spy.length} nap · utolsó ${dhu(spy[spy.length - 1])}` : 'nincs adat'}</small></span></div>
    <button class="btn ghost" id="dgTest">Kapcsolat tesztelése</button><pre class="dgout" id="dgOut" hidden></pre>`;
}
async function diagTest() {
  const o = $('dgOut'); o.hidden = false; o.textContent = 'Teszt fut…';
  const out = [];
  if (S.busy) out.push('Twelve Data: most éppen letöltés fut, ezért a tesztet kihagyom, hogy ne fogyjon a perces keret. Próbáld újra, ha a felső sorban „Élő” látszik.');
  for (const [l, u] of [...(S.busy ? [] : [['Twelve Data', `https://api.twelvedata.com/time_series?symbol=AAPL,SPY&interval=1day&outputsize=2&apikey=${encodeURIComponent(apiKey || 'demo')}`]]), ['ECB', 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=HUF']]) {
    try { const r = await fetch(u, { cache: 'no-store' }); const t = await r.text(); out.push(`${l}: HTTP ${r.status}${/"code":429/.test(t) ? ' (nem hiba: elfogyott a perces ingyenes keret, mert közben letöltés futott; egy perc múlva rendben lesz)' : r.ok && !/"status":"error"/.test(t) ? ' · rendben' : ''}\n${t.slice(0, 380)}`); if (/twelvedata/.test(u)) for (let k = 0; k < 2; k++) credits.push(Date.now()); } catch (e) { out.push(`${l}: HIBA ${e.message || e}`); }
  }
  o.textContent = out.join('\n\n');
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
  const cur = OLDTAB[S.tab] ? 'elemzes' : S.tab;
  const a = (k, l, i, mob) => `<a href="#${k}" data-tab="${k}" ${cur === k ? 'aria-current="page"' : ''}>${mob ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${i}"/></svg>${l}` : l}</a>`;
  $('tabs').innerHTML = TABS.map(t => a(...t, false)).join('');
  const T = Object.fromEntries(TABS.map(t => [t[0], t]));
  $('bnav').innerHTML = a(...T.attekintes, true) + a(...T.portfolio, true) + `<button class="fab" id="fab" aria-label="Gyorsműveletek"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg></button>` + a(...T.elemzes, true) + a(...T.naptar, true);
  $('fab').onclick = openActions;
  document.querySelectorAll('[data-tab]').forEach(x => x.onclick = e => { e.preventDefault(); switchTab(x.dataset.tab); });
}
function render(keep) {
  if (!M) return;
  buildColors();
  charts.forEach(c => c.destroy()); charts = [];
  if (!V[S.tab]) S.tab = 'attekintes';
  const y = window.scrollY;
  const mn = $('main'); mn.innerHTML = V[S.tab](M);
  if (S.enter) { mn.classList.remove('enter'); void mn.offsetWidth; mn.classList.add('enter'); S.enter = false; clearTimeout(render.t); render.t = setTimeout(() => mn.classList.remove('enter'), 700); }
  V[S.tab].after && V[S.tab].after(M);
  if (keep) window.scrollTo({ top: y });
}
function boot() {
  if (!statements.length) { onboarding(); return; }
  drawBell(); $('greet').textContent = greet();
  $('bar').hidden = false; $('bnav').hidden = false;
  drawNav(); drawCur(); drawStatus(); render();
}

$('themeBtn').onclick = () => { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme]; store.set('bf-theme', S.theme); applyTheme(); };
$('cHUF').onclick = () => { S.cur = 'HUF'; store.set('bf-cur2', 'HUF'); drawCur(); render(true); };
$('cUSD').onclick = () => { S.cur = 'USD'; store.set('bf-cur2', 'USD'); drawCur(); render(true); };
$('refreshBtn').onclick = () => refresh();
$('setBtn').onclick = openSettings;
$('bellBtn').onclick = () => M && openAlerts();
$('fileIn').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => render(true), 150); });
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  if (sheetClose) { sheetClose(true); return; }
  let h = location.hash.slice(1) || 'attekintes'; if (OLDTAB[h]) { S.an = OLDTAB[h]; h = 'elemzes'; }
  if (V[h] && h !== S.tab && M) switchTab(h, false);
});
window.addEventListener('scroll', () => { const b = $('bar'); if (b) b.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
document.addEventListener('click', e => { if (e.target.closest('button, .tabs a, .bnav a') && navigator.vibrate) { try { navigator.vibrate(6); } catch (_) {} } });
// lehúzással frissítés
(() => {
  const el = $('ptr'); let y0 = null, dy = 0; const reset = () => { el.style.transform = ''; el.style.opacity = ''; };
  addEventListener('touchstart', e => { if (window.scrollY > 0 || !M || sheetClose || S.busy || e.target.closest('canvas,.rail,.tm,.ptabs')) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 4) { el.style.transform = `translate(-50%, ${Math.min(dy * 0.5, 72)}px) rotate(${dy * 2}deg)`; el.style.opacity = Math.min(1, dy / 90); } }, { passive: true });
  addEventListener('touchend', () => { if (y0 == null) return; y0 = null; if (dy > 120) { try { navigator.vibrate && navigator.vibrate(12); } catch (_) {} el.classList.add('on'); reset(); refresh({}).finally(() => el.classList.remove('on')); } else reset(); });
})();
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
