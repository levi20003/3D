/* Bróker CSV-exportok beolvasása. Ismert formátumok: Trading 212, Revolut, Lightyear, Interactive Brokers;
   minden más fájl oszlop-hozzárendeléssel. Kimenet: a PDF-kivonattal azonos tranzakciósorok. */
(function (root) {
  // --- CSV szöveg -> sorok (idézőjelek, ; , vagy tab elválasztó) ---
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    const cnt = ch => (first.match(new RegExp('\\' + ch, 'g')) || []).length;
    const delim = [',', ';', '\t'].sort((a, b) => cnt(b) - cnt(a))[0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row.map(x => x.trim())); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row.map(x => x.trim()));
    return { rows, delim };
  }
  // --- számok és dátumok ---
  function num(s) {
    if (s == null) return 0; let t = String(s).replace(/[^\d,.\-−]/g, '').replace('−', '-'); if (!t || t === '-') return 0;
    const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
    if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (lc > -1) t = /,\d{3}$/.test(t) && (t.match(/,/g) || []).length > 1 ? t.replace(/,/g, '') : t.replace(',', '.');
    const v = parseFloat(t); return isFinite(v) ? v : 0;
  }
  const curOf = s => { const m = /\b([A-Z]{3})\b/.exec(String(s || '')); return m ? m[1] : (/\$/.test(s) ? 'USD' : /€/.test(s) ? 'EUR' : /£/.test(s) ? 'GBP' : ''); };
  function date(s, order) {
    s = String(s || '').trim(); let m;
    if ((m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if ((m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/.exec(s))) { let a = +m[1], b = +m[2]; if (order === 'mdy' || (order !== 'dmy' && b > 12)) [a, b] = [b, a]; return `${m[3]}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`; }
    if ((m = /^(\d{4})(\d{2})(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const blank = () => ({ date: null, type: '', tkr: '', isin: '', qty: 0, ccy: 'USD', price: 0, gross: 0, fee: 0, net: 0, tax: 0, rate: 0 });
  const H = (hdr) => { const idx = {}; hdr.forEach((h, i) => { idx[h.toLowerCase().replace(/\s+/g, ' ').trim()] = i; }); return (row, ...names) => { for (const n of names) { const i = idx[n.toLowerCase()]; if (i != null && row[i] != null && row[i] !== '') return row[i]; } return ''; }; };
  const has = (hdr, ...names) => { const s = new Set(hdr.map(h => h.toLowerCase().replace(/\s+/g, ' ').trim())); return names.every(n => s.has(n.toLowerCase())); };

  // --- ismert formátumok ---
  const PRESETS = {
    t212: {
      name: 'Trading 212',
      match: hdr => has(hdr, 'action', 'time', 'no. of shares'),
      read(rows) { const hdr = rows[0], g = H(hdr), out = [], names = {};
        for (const r of rows.slice(1)) {
          const act = g(r, 'action').toLowerCase(); const x = blank(); x.date = date(g(r, 'time')); if (!x.date) continue;
          x.ccy = g(r, 'currency (total)') || curOf(g(r, 'total')) || 'EUR'; const total = Math.abs(num(g(r, 'total')));
          const fees = Math.abs(num(g(r, 'charge amount'))) + Math.abs(num(g(r, 'currency conversion fee'))) + Math.abs(num(g(r, 'stamp duty reserve tax'))) + Math.abs(num(g(r, 'finra fee'))) + Math.abs(num(g(r, 'transaction fee')));
          x.tkr = g(r, 'ticker').toUpperCase(); x.isin = g(r, 'isin'); if (x.tkr && g(r, 'name')) names[x.tkr] = g(r, 'name');
          if (/buy/.test(act)) { x.type = 'B'; x.qty = num(g(r, 'no. of shares')); x.gross = total; x.fee = fees; x.net = total - fees; x.price = x.qty ? x.net / x.qty : 0; }
          else if (/sell/.test(act)) { x.type = 'S'; x.qty = num(g(r, 'no. of shares')); x.net = total; x.fee = fees; x.gross = total + fees; x.price = x.qty ? x.gross / x.qty : 0; }
          else if (/dividend/.test(act)) { x.type = 'D'; x.net = total; const tax = Math.abs(num(g(r, 'withholding tax'))); const tc = g(r, 'currency (withholding tax)'); x.tax = !tc || tc === x.ccy ? tax : 0; x.gross = total + x.tax; }
          else if (/deposit/.test(act)) { x.type = 'DEP'; x.gross = x.net = total; x.tkr = ''; }
          else if (/withdraw/.test(act)) { x.type = 'WD'; x.gross = x.net = -total; x.tkr = ''; }
          else if (/interest/.test(act)) { x.type = 'INT'; x.gross = x.net = total; x.tkr = ''; }
          else continue;
          out.push(x);
        }
        return { rows: out, names }; }
    },
    revolut: {
      name: 'Revolut',
      match: hdr => has(hdr, 'date', 'ticker', 'type', 'total amount'),
      read(rows) { const g = H(rows[0]), out = [];
        for (const r of rows.slice(1)) {
          const ty = g(r, 'type').toUpperCase(); const x = blank(); x.date = date(g(r, 'date')); if (!x.date) continue;
          const tot = g(r, 'total amount'); x.ccy = g(r, 'currency') || curOf(tot) || 'USD'; const total = Math.abs(num(tot)); x.tkr = g(r, 'ticker').toUpperCase();
          x.qty = Math.abs(num(g(r, 'quantity'))); x.price = num(g(r, 'price per share'));
          if (/^BUY/.test(ty)) { x.type = 'B'; x.gross = total; x.net = x.qty * x.price || total; x.fee = Math.max(0, x.gross - x.net); }
          else if (/^SELL/.test(ty)) { x.type = 'S'; x.net = total; x.gross = x.qty * x.price || total; x.fee = Math.max(0, x.gross - x.net); }
          else if (/DIVIDEND/.test(ty)) { x.type = 'D'; x.gross = x.net = total; }
          else if (/TOP-UP|TOPUP|DEPOSIT/.test(ty)) { x.type = 'DEP'; x.gross = x.net = total; x.tkr = ''; }
          else if (/WITHDRAW/.test(ty)) { x.type = 'WD'; x.gross = x.net = -total; x.tkr = ''; }
          else if (/FEE/.test(ty)) { x.type = 'FEE'; x.gross = x.net = x.fee = total; x.tkr = ''; }
          else if (/SPLIT/.test(ty)) { x.type = 'SPLIT'; x.qty = num(g(r, 'quantity')); }
          else continue;
          out.push(x);
        }
        return { rows: out }; }
    },
    lightyear: {
      name: 'Lightyear',
      match: hdr => has(hdr, 'date', 'ticker', 'type', 'ccy') && hdr.some(h => /net amt|net amount/i.test(h)),
      read(rows) { const g = H(rows[0]), out = [];
        for (const r of rows.slice(1)) {
          const ty = g(r, 'type').toLowerCase(); const x = blank(); x.date = date(g(r, 'date'), 'dmy'); if (!x.date) continue;
          x.ccy = g(r, 'ccy') || 'USD'; x.tkr = g(r, 'ticker').toUpperCase(); x.isin = g(r, 'isin');
          const G = num(g(r, 'gross amount', 'gross amt.', 'gross')), N = num(g(r, 'net amt.', 'net amount', 'net amt')), F = Math.abs(num(g(r, 'fee'))), T = Math.abs(num(g(r, 'tax amt.', 'tax amount', 'tax')));
          x.qty = Math.abs(num(g(r, 'quantity'))); x.price = num(g(r, 'price/share', 'price per share', 'price'));
          const hi = Math.max(Math.abs(G), Math.abs(N)), lo = Math.min(Math.abs(G), Math.abs(N));
          if (ty === 'buy') { x.type = 'B'; x.gross = hi; x.net = lo || hi - F; x.fee = F || hi - lo; }
          else if (ty === 'sell') { x.type = 'S'; x.gross = hi; x.net = lo || hi - F; x.fee = F || hi - lo; }
          else if (/dividend|distribution/.test(ty)) { x.type = 'D'; x.tax = T; x.net = Math.abs(N) || Math.abs(G) - T; x.gross = Math.abs(G) || x.net + T; }
          else if (/deposit/.test(ty)) { x.type = 'DEP'; x.gross = x.net = Math.abs(G || N); x.fee = F; x.tkr = ''; }
          else if (/withdraw/.test(ty)) { x.type = 'WD'; x.gross = x.net = -Math.abs(G || N); x.tkr = ''; }
          else if (/conversion|exchange/.test(ty)) { x.type = 'FX'; x.gross = G || N; x.net = N || G; x.fee = F; x.tkr = x.ccy; }
          else if (/interest/.test(ty)) { x.type = 'INT'; x.gross = x.net = Math.abs(N || G); x.tkr = ''; }
          else continue;
          out.push(x);
        }
        return { rows: out }; }
    },
    ibkr: {
      name: 'Interactive Brokers',
      match: (hdr, rows) => rows.some(r => r[0] === 'Trades' && r[1] === 'Header'),
      read(rows) { const out = []; const hdrs = {};
        for (const r of rows) {
          if (r[1] === 'Header') { hdrs[r[0]] = r; continue; } if (r[1] !== 'Data') continue; const hd = hdrs[r[0]]; if (!hd) continue; const g = H(hd);
          if (r[0] === 'Trades' && /stock/i.test(g(r, 'asset category')) && /order/i.test(g(r, 'datadiscriminator') || 'Order')) {
            const x = blank(); x.date = date(g(r, 'date/time')); if (!x.date) continue; x.ccy = g(r, 'currency') || 'USD'; x.tkr = g(r, 'symbol').toUpperCase();
            const q = num(g(r, 'quantity')), pr = num(g(r, 't. price')), proc = num(g(r, 'proceeds')), fee = Math.abs(num(g(r, 'comm/fee')));
            x.qty = Math.abs(q); x.price = pr; x.fee = fee;
            if (q > 0) { x.type = 'B'; x.net = Math.abs(proc); x.gross = x.net + fee; } else { x.type = 'S'; x.gross = Math.abs(proc); x.net = x.gross - fee; }
            out.push(x);
          } else if (r[0] === 'Dividends' || r[0] === 'Withholding Tax') {
            const desc = g(r, 'description'); const m = /^([A-Z.]+)\s*\(/.exec(desc); if (!m) continue; const d = date(g(r, 'date')); if (!d) continue; const amt = num(g(r, 'amount'));
            let x = out.find(o => o.type === 'D' && o.tkr === m[1] && o.date === d); if (!x) { x = blank(); x.type = 'D'; x.date = d; x.tkr = m[1]; x.ccy = g(r, 'currency') || 'USD'; out.push(x); }
            if (r[0] === 'Dividends') x.gross += amt; else x.tax += Math.abs(amt); x.net = x.gross - x.tax;
          } else if (r[0] === 'Deposits & Withdrawals') {
            const x = blank(); x.date = date(g(r, 'settle date')); if (!x.date) continue; x.ccy = g(r, 'currency') || 'USD'; const a = num(g(r, 'amount'));
            x.type = a >= 0 ? 'DEP' : 'WD'; x.gross = x.net = a; out.push(x);
          }
        }
        return { rows: out }; }
    }
  };

  // --- általános hozzárendelés: { date, type, tkr, qty, price, total, fee, tax, ccy, ccyFixed, dateOrder, types: {érték: 'B'|'S'|'D'|'DEP'|'WD'|'FEE'|'INT'|'skip'} } ---
  function readMapped(rows, map) {
    const hdr = rows[0], out = [], col = k => map[k] != null && map[k] !== '' ? hdr.indexOf(map[k]) : -1;
    const v = (r, k) => { const i = col(k); return i >= 0 ? r[i] : ''; };
    for (const r of rows.slice(1)) {
      const t = map.types[v(r, 'type')] || 'skip'; if (t === 'skip') continue;
      const x = blank(); x.date = date(v(r, 'date'), map.dateOrder); if (!x.date) continue;
      x.type = t; x.tkr = v(r, 'tkr').toUpperCase(); x.ccy = map.ccyFixed || curOf(v(r, 'ccy')) || v(r, 'ccy') || 'USD';
      x.qty = Math.abs(num(v(r, 'qty'))); x.price = Math.abs(num(v(r, 'price'))); x.fee = Math.abs(num(v(r, 'fee'))); x.tax = Math.abs(num(v(r, 'tax')));
      const tot = Math.abs(num(v(r, 'total'))) || x.qty * x.price;
      if (t === 'B') { x.gross = tot; x.net = col('fee') >= 0 ? tot - x.fee : (x.qty * x.price || tot); if (!x.fee) x.fee = Math.max(0, x.gross - x.net); }
      else if (t === 'S') { x.net = tot; x.gross = col('fee') >= 0 ? tot + x.fee : (x.qty * x.price || tot); if (!x.fee) x.fee = Math.max(0, x.gross - x.net); }
      else if (t === 'D') { x.net = tot; x.gross = tot + x.tax; }
      else if (t === 'WD') { x.gross = x.net = -tot; x.tkr = ''; }
      else { x.gross = x.net = tot; if (t !== 'D') x.tkr = t === 'INT' || t === 'DEP' || t === 'FEE' ? '' : x.tkr; }
      if (!x.price && x.qty) x.price = (t === 'B' ? x.net : x.gross) / x.qty;
      out.push(x);
    }
    return { rows: out };
  }

  function detect(rows) { const hdr = rows[0] || []; for (const [id, p] of Object.entries(PRESETS)) if (p.match(hdr, rows)) return id; return null; }
  // sorok -> számla (a kivonat szerkezetével)
  function toStatement(res, acct, label) {
    const rows = res.rows.filter(r => r.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    rows.forEach((r, i) => r.order = i + 1);
    const cash = {}; const add = (c, v) => cash[c] = (cash[c] || 0) + v;
    for (const r of rows) { if (r.type === 'DEP' || r.type === 'WD' || r.type === 'FX') add(r.ccy, r.gross); else if (r.type === 'B' || r.type === 'FEE') add(r.ccy, -Math.abs(r.gross)); else if (r.type === 'S' || r.type === 'D' || r.type === 'INT') add(r.ccy, r.net); }
    for (const c of Object.keys(cash)) if (Math.abs(cash[c]) < 0.005) cash[c] = 0;
    return { acct, label, source: 'csv', from: rows.length ? rows[0].date : null, to: rows.length ? rows[rows.length - 1].date : null, asOf: rows.length ? rows[rows.length - 1].date : null, rows, positions: [], cash, names: res.names || {} };
  }
  const api = { parseCSV, detect, PRESETS, readMapped, toStatement, num, date };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CSVImport = api;
})(typeof self !== 'undefined' ? self : this);
