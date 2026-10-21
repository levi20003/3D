/* Portfólió-számítás: pozíciók, realizált eredmény (átlagos bekerülési ár), díjak,
   napi érték és "egy részvényként" követett index (időarányos hozam, a befizetések kiszűrésével). */
(function (root) {
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

  // utolsó ismert érték egy {dátum: érték} sorozatból, a megadott napon vagy előtte
  function asOfLookup(series) {
    const ds = Object.keys(series || {}).sort();
    return (d) => { let lo = 0, hi = ds.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ds[m] <= d) { ans = m; lo = m + 1; } else hi = m - 1; } return ans < 0 ? null : series[ds[ans]]; };
  }

  function build(statements, market) {
    market = market || {};
    const hist = market.history || {};            // {TICKER: {date: close}}
    const fxh = market.fx || {};                  // {date: {HUF: usdhuf, EUR: eur per usd}}
    const usdhufAt = (() => { const f = asOfLookup(Object.fromEntries(Object.entries(fxh).map(([d, v]) => [d, v.HUF]))); return d => f(d) || market.usdhuf || 330; })();
    const eurusdAt = (() => { const f = asOfLookup(Object.fromEntries(Object.entries(fxh).map(([d, v]) => [d, v.EUR]))); return d => { const e = f(d); return e ? 1 / e : 1.16; }; })();
    const today = market.today || new Date().toISOString().slice(0, 10);

    const tx = [];
    const names = {}, snap = {}; // snapshot árak a kivonatból
    let cashNow = {}, asOf = null, stUsdhuf = null;
    for (const st of statements) {
      st.rows.forEach(r => tx.push({ ...r, acct: st.acct, label: st.label }));
      st.positions.forEach(p => { names[p.tkr] = p.name; if (p.qty && p.value) snap[p.tkr] = { price: p.value / p.qty, date: st.asOf }; });
      for (const [c, v] of Object.entries(st.cash || {})) cashNow[c] = (cashNow[c] || 0) + v;
      if (!asOf || st.asOf > asOf) { asOf = st.asOf; stUsdhuf = st.usdhuf; }
    }
    tx.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order);
    const toUsd = (v, ccy, d) => ccy === 'USD' ? v : ccy === 'EUR' ? v * eurusdAt(d) : ccy === 'HUF' ? v / usdhufAt(d) : v;
    // forintos befizetés tényleges dollárértéke: az aznapi HUF->USD átváltás árfolyamán
    const conv = {};
    tx.filter(r => r.type === 'FX').forEach(r => { const k = r.acct + '|' + r.date; const c = conv[k] = conv[k] || { HUF: 0, USD: 0 }; if (r.ccy in c) c[r.ccy] += r.gross; });
    const flowUsd = r => { if (r.ccy === 'HUF') { const c = conv[r.acct + '|' + r.date]; if (c && c.HUF < 0 && c.USD > 0) return r.gross * c.USD / -c.HUF; } return toUsd(r.gross, r.ccy, r.date); };
    const usTickers = new Set(tx.filter(r => (r.type === 'B' || r.type === 'S') && r.ccy === 'USD').map(r => r.tkr));

    // tranzakciós árak (ha nincs letöltött előzmény)
    const txPrice = {}; tx.filter(r => r.type === 'B' || r.type === 'S').forEach(r => { (txPrice[r.tkr] = txPrice[r.tkr] || {})[r.date] = toUsd(r.price, r.ccy, r.date); });
    const priceFns = {};
    const priceAt = (t, d) => {
      if (!priceFns[t]) { const h = hist[t] && Object.keys(hist[t]).length ? hist[t] : null; const s = { ...(txPrice[t] || {}) }; if (snap[t]) s[snap[t].date] = snap[t].price; priceFns[t] = { h: h && asOfLookup(h), s: interpLookup(s) }; }
      const f = priceFns[t]; return (f.h && f.h(d)) || f.s(d) || 0;
    };

    // realizált eredmény, nyitott pozíciók (számlánként átlagár)
    const books = {}; const closed = [];
    for (const r of tx) {
      if (r.type !== 'B' && r.type !== 'S') continue;
      const k = r.acct + '|' + r.tkr; const b = books[k] = books[k] || { acct: r.acct, tkr: r.tkr, qty: 0, cost: 0 };
      const g = toUsd(r.gross, r.ccy, r.date), n = toUsd(r.net, r.ccy, r.date);
      if (r.type === 'B') { b.qty += r.qty; b.cost += g; }
      else { const c = b.qty > 0 ? b.cost / b.qty * r.qty : 0; b.qty -= r.qty; b.cost -= c; if (b.qty < 1e-7) { b.qty = 0; b.cost = 0; }
        closed.push({ acct: r.acct, label: r.label, date: r.date, tkr: r.tkr, qty: r.qty, cost: c, proceeds: n, pnl: n - c, pct: c ? (n - c) / c * 100 : 0 }); }
    }
    const lastDate = d => d > today ? today : d;
    const posMap = {};
    Object.values(books).filter(b => b.qty > 0).forEach(b => { const p = posMap[b.tkr] = posMap[b.tkr] || { tkr: b.tkr, qty: 0, cost: 0, accts: [] }; p.qty += b.qty; p.cost += b.cost; p.accts.push(b.acct); });
    const positions = Object.values(posMap).map(p => {
      const price = priceAt(p.tkr, today), prev = prevClose(p.tkr);
      const value = p.qty * price; return { ...p, price, value, pnl: value - p.cost, pct: (value - p.cost) / p.cost * 100, dayChg: prev ? (price / prev - 1) * 100 : null, dayAbs: prev ? p.qty * (price - prev) : null };
    });
    function prevClose(t) { const h = hist[t]; if (!h) return null; const ds = Object.keys(h).sort(); return ds.length > 1 ? h[ds[ds.length - 2]] : null; }

    const divs = tx.filter(r => r.type === 'D').map(r => ({ ...r, grossUsd: toUsd(r.gross, r.ccy, r.date), netUsd: toUsd(r.net, r.ccy, r.date), taxUsd: toUsd(r.tax, r.ccy, r.date) }));
    const fees = tx.filter(r => r.fee).map(r => ({ date: r.date, kind: (r.type === 'B' || r.type === 'S') ? 'exec' : r.type === 'DEP' ? 'dep' : r.type === 'FX' ? 'fx' : 'other', usd: toUsd(r.fee, r.ccy, r.date), r }));
    const flows = tx.filter(r => r.type === 'DEP' || r.type === 'WD').map(r => ({ date: r.date, usd: flowUsd(r), huf: r.ccy === 'HUF' ? r.gross : null, ccy: r.ccy, acct: r.acct }));

    // napi idősor
    const start = tx.length ? tx[0].date : today; const days = [];
    const histDates = new Set(); Object.values(hist).forEach(h => Object.keys(h).forEach(d => histDates.add(d)));
    for (let d = start; d <= today; d = addDays(d, 1)) { const wd = new Date(d + 'T12:00:00Z').getUTCDay(); if (histDates.size ? (histDates.has(d) || tx.some(r => r.date === d)) : (wd !== 0 && wd !== 6)) days.push(d); }
    if (!days.includes(today)) days.push(today);
    const hold = {}, cash = {}; let ti = 0, units = 0, nav = 100, invested = 0;
    const spyF = hist.SPY ? asOfLookup(hist.SPY) : null; let spyShares = 0, spyBase = null;
    const series = [];
    for (const d of days) {
      let flow = 0;
      while (ti < tx.length && tx[ti].date <= d) {
        const r = tx[ti++];
        if (r.type === 'B') { hold[r.tkr] = (hold[r.tkr] || 0) + r.qty; cash[r.ccy] = (cash[r.ccy] || 0) - r.gross; }
        else if (r.type === 'S') { hold[r.tkr] = (hold[r.tkr] || 0) - r.qty; cash[r.ccy] = (cash[r.ccy] || 0) + r.net; }
        else if (r.type === 'D') cash[r.ccy] = (cash[r.ccy] || 0) + r.net;
        else if (r.type === 'DEP' || r.type === 'WD') { cash[r.ccy] = (cash[r.ccy] || 0) + r.gross; const u = flowUsd(r); flow += u; invested += u; if (spyF) { const p = spyF(r.date); if (p) spyShares += u / p; } }
        else if (r.type === 'FX') cash[r.ccy] = (cash[r.ccy] || 0) + r.gross;
      }
      let stocks = 0; for (const [t, q] of Object.entries(hold)) if (q > 1e-7) stocks += q * priceAt(t, d);
      let c = 0; for (const [ccy, v] of Object.entries(cash)) c += toUsd(v, ccy, d);
      const value = stocks + Math.max(c, 0);
      if (units <= 0) { if (value > 0) { nav = 100; units = value / nav; } }
      else { nav = (value - flow) / units; units += flow / nav; }
      const spy = spyF ? spyF(d) : null; if (spy && spyBase == null && units > 0) spyBase = spy;
      series.push({ d, value, invested, nav: units > 0 ? nav : 100, spyIdx: spy && spyBase ? spy / spyBase * 100 : null, spyVal: spy ? spyShares * spy : null, usdhuf: usdhufAt(d) });
    }

    const P = positions; const cashUsd = sum(Object.entries(cashNow), ([c, v]) => toUsd(v, c, today));
    const value = sum(P, p => p.value) + cashUsd;
    const dep = sum(flows, f => f.usd);
    const realized = sum(closed, c => c.pnl), unreal = sum(P, p => p.pnl);
    const divNet = sum(divs, r => r.netUsd), divTax = sum(divs, r => r.taxUsd), divGross = sum(divs, r => r.grossUsd);
    const R = market.usdhuf || stUsdhuf || usdhufAt(today);
    // forint: a forintos befizetések valós összege, a dolláros befizetések mai árfolyamon
    const hufFlowsUsd = sum(flows.filter(f => f.huf != null), f => f.usd), hufFlows = sum(flows.filter(f => f.huf != null), f => f.huf);
    const depHuf = hufFlows + (dep - hufFlowsUsd) * R;
    const tick = {}; const g = t => tick[t] = tick[t] || { tkr: t, real: 0, unreal: 0, div: 0, open: false };
    closed.forEach(c => g(c.tkr).real += c.pnl); P.forEach(p => { g(p.tkr).unreal += p.pnl; g(p.tkr).open = true; }); divs.forEach(r => g(r.tkr).div += r.netUsd);
    const ledgerCash = series.length ? sum(Object.entries(cash), ([c, v]) => toUsd(v, c, today)) : 0;
    return {
      tx, closed, positions: P, divs, fees, flows, series, names, R, today, asOf, usTickers: [...usTickers],
      cashUsd, value, dep, realized, unreal, divNet, divTax, divGross, other: value - (dep + realized + unreal + divNet),
      result: value - dep, depHuf, fxHuf: hufFlowsUsd * R - hufFlows, resultHuf: value * R - depHuf,
      feeUsd: sum(fees, f => f.usd), T: Object.values(tick).map(x => ({ ...x, total: x.real + x.unreal + x.div })), ledgerCash,
      dayChange: sum(P.filter(p => p.dayAbs != null), p => p.dayAbs)
    };
  }

  // lineáris átmenet az ismert pontok között (ha nincs napi árfolyam-előzmény)
  function interpLookup(series) {
    const ds = Object.keys(series || {}).sort(); const ts = ds.map(d => Date.parse(d + 'T12:00:00Z'));
    return (d) => { if (!ds.length) return null; const t = Date.parse(d + 'T12:00:00Z');
      if (t <= ts[0]) return series[ds[0]]; if (t >= ts[ts.length - 1]) return series[ds[ds.length - 1]];
      let i = 1; while (ts[i] < t) i++; const f = (t - ts[i - 1]) / (ts[i] - ts[i - 1]); return series[ds[i - 1]] * (1 - f) + series[ds[i]] * f; };
  }

  const api = { build, asOfLookup, interpLookup, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof self !== 'undefined' ? self : this);
