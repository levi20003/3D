/* Demó mód: kitalált, de élethű portfólió (mindig a mai napig), hogy az app fiók és kivonat nélkül kipróbálható legyen.
   Minden szám mintaadat, nem valós árfolyam. */
(function (root) {
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const iso = d => d.toISOString().slice(0, 10);
  const SEED = 149; // olyan mag, amely élethű, enyhén piac feletti évet ad
  const STOCKS = [ // ticker, név, kezdőár, éves drift, volatilitás, osztalék/negyedév
    ['AAPL', 'Apple', 230, 0.14, 0.26, 0.26], ['MSFT', 'Microsoft', 420, 0.16, 0.22, 0.83], ['NVDA', 'Nvidia', 135, 0.35, 0.48, 0.01],
    ['AMZN', 'Amazon', 200, 0.12, 0.32, 0], ['GOOGL', 'Alphabet', 175, 0.18, 0.30, 0.20], ['KO', 'Coca-Cola', 64, 0.05, 0.14, 0.51],
    ['JNJ', 'Johnson & Johnson', 155, 0.03, 0.16, 1.24], ['V', 'Visa', 300, 0.11, 0.20, 0.59], ['COST', 'Costco', 900, 0.10, 0.20, 1.30],
    ['TSLA', 'Tesla', 250, -0.05, 0.60, 0], ['SPY', 'S&P 500 (SPY)', 580, 0.11, 0.16, 0]];
  function build(todayIso, seed) {
    const today = new Date((todayIso || iso(new Date())) + 'T12:00:00Z');
    // mindig ugyanannyi munkanap visszafelé, így bármelyik napon ugyanúgy néz ki a minta
    const days = []; for (let d = new Date(today); days.length < 275; d.setUTCDate(d.getUTCDate() - 1)) { const wd = d.getUTCDay(); if (wd && wd < 6) days.unshift(iso(d)); }
    const r = rng(seed || SEED), gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const history = {}; const mkt = days.map(() => gauss() * 0.009);
    for (const [t, , p0, mu, sig] of STOCKS) { let p = p0; const h = history[t] = {}; days.forEach((d, i) => { const beta = t === 'SPY' ? 1 : 0.9; p *= Math.exp(mu / 252 - sig * sig / 504 + beta * mkt[i] + (sig / Math.sqrt(252)) * 0.5 * gauss()); h[d] = Math.round(p * 100) / 100; }); }
    const fx = {}; let huf = 362, eur = 0.95, gbp = 0.79; days.forEach(d => { huf *= 1 + gauss() * 0.003 - 0.00012; eur *= 1 + gauss() * 0.002 - 0.00006; gbp *= 1 + gauss() * 0.002; fx[d] = { HUF: +huf.toFixed(3), EUR: +eur.toFixed(5), GBP: +gbp.toFixed(5), CHF: +(eur * 0.94).toFixed(5), PLN: +(eur * 4.27).toFixed(4), CZK: +(eur * 25.1).toFixed(3), SEK: +(eur * 11.2).toFixed(3), NOK: +(eur * 11.6).toFixed(3), DKK: +(eur * 7.46).toFixed(3), RON: +(eur * 4.97).toFixed(3) }; });
    // havi befizetés és vásárlások
    const rows = []; let order = 0; const add = x => rows.push({ isin: '', qty: 0, ccy: 'USD', price: 0, gross: 0, fee: 0, net: 0, tax: 0, rate: 0, tkr: '', ...x, order: ++order });
    const px = (t, d) => history[t][d]; const held = {};
    const plan = [['AAPL', 'MSFT', 'NVDA', 'KO', 'V'], ['NVDA', 'KO'], ['GOOGL', 'V'], ['AMZN', 'JNJ'], ['COST', 'AAPL'], ['TSLA', 'MSFT'], ['NVDA', 'V'], ['KO', 'GOOGL'], ['AAPL', 'AMZN'], ['MSFT', 'JNJ'], ['NVDA', 'COST'], ['V', 'KO']];
    days.forEach((d, i) => {
      if (i < 3 || (i - 3) % 21) return; const k = (i - 3) / 21;
      const dep = k === 0 ? 2000 : 400; add({ date: d, type: 'DEP', gross: dep, net: dep, fee: +(dep * 0.006).toFixed(2) });
      const buys = plan[k % plan.length]; const each = (k === 0 ? 1800 : 380) / buys.length;
      buys.forEach(t => { const p = px(t, d); const fee = Math.max(0.1, +(each * 0.001).toFixed(2)); const net = each - fee; const q = +(net / p).toFixed(6); held[t] = (held[t] || 0) + q; add({ date: d, type: 'B', tkr: t, isin: 'US-DEMO', qty: q, price: p, gross: +each.toFixed(2), fee, net: +(q * p).toFixed(2) }); });
    });
    // két eladás
    [['TSLA', 0.55], ['COST', 0.8]].forEach(([t, at]) => { const d = days[Math.floor(days.length * at)]; if (!held[t]) return; const q = +(held[t] * 0.5).toFixed(6); const p = px(t, d); const g = +(q * p).toFixed(2); held[t] -= q; add({ date: d, type: 'S', tkr: t, isin: 'US-DEMO', qty: q, price: p, gross: g, fee: Math.max(0.1, +(g * 0.001).toFixed(2)), net: +(g - Math.max(0.1, g * 0.001)).toFixed(2) }); });
    // negyedéves osztalékok
    for (const [t, , , , , dv] of STOCKS) { if (!dv) continue; days.filter((d, i) => i % 63 === 40).forEach(d => { const q = rows.filter(x => x.tkr === t && x.date < d).reduce((s, x) => s + (x.type === 'B' ? x.qty : x.type === 'S' ? -x.qty : 0), 0); if (q > 0.001) { const g = +(q * dv).toFixed(2); if (g >= 0.01) add({ date: d, type: 'D', tkr: t, isin: 'US-DEMO', gross: g, tax: +(g * 0.15).toFixed(2), net: +(g * 0.85).toFixed(2) }); } }); }
    rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order); rows.forEach((x, i) => x.order = i + 1);
    let cash = 0; rows.forEach(x => { cash += x.type === 'DEP' ? x.gross : x.type === 'B' ? -x.gross : x.type === 'S' || x.type === 'D' ? x.net : 0; });
    const names = Object.fromEntries(STOCKS.map(s => [s[0], s[1]]));
    const st = { acct: 'DEMO', label: 'Demo', source: 'demo', from: rows[0].date, to: days[days.length - 1], asOf: days[days.length - 1], rows, positions: [], cash: { USD: +cash.toFixed(2) }, names };
    const last = days[days.length - 1];
    return { statements: [st], market: { history, fx, usdhuf: fx[last].HUF, updatedAt: Date.now(), benchSym: 'SPY', demo: true, errors: [] } };
  }
  const api = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Demo = api;
})(typeof self !== 'undefined' ? self : this);
