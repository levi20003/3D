/* Lightyear számlakivonat (magyar PDF) feldolgozása.
   Bemenet: soronkénti token-tömbök (pdf.js szövegelemek y szerint csoportosítva, x szerint rendezve).
   Kimenet: {acct, label, from, to, asOf, usdhuf, rows, positions, cash, fees}. */
(function (root) {
  const MONTHS = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
  const TYPES = {'Vétel':'B','Eladás':'S','Osztalék':'D','Befizetés':'DEP','Átváltás':'FX','Kifizetés':'WD','Kivétel':'WD'};
  const MONEY = /^(-?[\d\s  ]+(?:,\d+)?)\s?(\$|€|Ft|£)$/;
  const SYM = {'$':'USD','€':'EUR','Ft':'HUF','£':'GBP'};

  const num = s => parseFloat(String(s).replace(/[\s  ]/g,'').replace(',','.'));
  const money = s => { const m = MONEY.exec(String(s).trim()); return m ? {v:num(m[1]), ccy:SYM[m[2]]} : null; };
  const isoDate = s => { const m = /^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?$/.exec(s.trim()); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
  const huDate = s => { const m = /(\d{4})\.\s*([a-záéíóöőúüű]+)\s*(\d{1,2})\./i.exec(s); if(!m) return null; const mo = MONTHS.indexOf(m[2].toLowerCase())+1; return mo ? `${m[1]}-${String(mo).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}` : null; };
  // "414","444","Ft" -> 414444
  const joinFt = toks => { const out=[]; for (const t of toks){ if(t==='Ft') break; if(/^-?\d+$/.test(t)) out.push(t); else break; } return out.length ? parseInt(out.join(''),10) : null; };

  function parse(lines) {
    const st = {acct:null,label:null,from:null,to:null,asOf:null,usdhuf:null,rows:[],positions:[],cash:{},fees:{},warnings:[]};
    let section = null, order = 0;
    for (const t of lines) {
      const line = t.join(' ');
      if (!st.from && line.startsWith('Időszak:')) {
        const [a,b] = line.replace('Időszak:','').split('–'); st.from = huDate(a); st.to = huDate(b);
      }
      const ia = t.indexOf('Számlaazonosító:'); if (ia >= 0) st.acct = t[ia+1];
      const il = t.indexOf('Számlatípus:'); if (il >= 0) st.label = t[il+1];
      if (line.startsWith('Értéknap:')) st.asOf = huDate(line);
      const fx = /USD\/HUF = ([\d,]+)/.exec(line); if (fx && line.includes('záróértékei')) st.usdhuf = num(fx[1]);
      for (const [lab,key] of [['Átváltási díjak','fx'],['Végrehajtási díjak','exec'],['Végrehajtást terhelő adók','tax'],['Befizetési díjak','dep']]) {
        const i = t.indexOf(lab); if (i >= 0) st.fees[key] = joinFt(t.slice(i+1));
      }
      if (t[0] === 'Tőzsdei azonosító') { section = 'pos'; continue; }
      if (t[0] === 'Eszközök összesen') { section = null; continue; }
      if (t[0] === 'Dátum') { section = 'tx'; continue; }
      if (/^Készpénz – [A-Z]{3}$/.test(t[0]) && t.length >= 4 && !money(t[1]) && t[1] !== '0,00') {
        const m = money(t[2]+' '+t[3]) || money(t[2]); if (m) st.cash[t[0].slice(-3)] = m.v;
      }
      if (section === 'pos' && t.length >= 5 && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(t[2])) {
        const val = money(t[4]+' '+t[5]);
        st.positions.push({tkr:t[0], name:t[1], isin:t[2], qty:num(t[3].replace('.',',')), value:val?val.v:null, ccy:val?val.ccy:'USD', huf:joinFt(t.slice(6))});
        continue;
      }
      if (section === 'tx') {
        const date = isoDate(t[0]); if (!date) continue;
        const ti = t.findIndex(x => TYPES[x]); if (ti < 0) { st.warnings.push(line); continue; }
        const type = TYPES[t[ti]];
        const before = t.slice(1, ti), after = t.slice(ti+1);
        const r = {date, type, tkr:'', isin:'', qty:0, ccy:'', price:0, gross:0, fee:0, net:0, tax:0, rate:0, order:order++};
        if (before.length === 2) { r.tkr = before[0]; r.isin = before[1]; }
        else if (before.length === 1) r.tkr = before[0];
        const ms = []; const plain = [];
        for (const x of after) { const m = money(x); if (m) ms.push(m); else if (/^[A-Z]{3}$/.test(x)) r.ccy = x; else if (/^-?[\d.,]+$/.test(x)) plain.push(x); }
        if (type === 'B' || type === 'S') {
          r.qty = num(plain[0].replace('.',','));
          [r.price, r.gross] = [ms[0].v, ms[1].v];
          if (ms.length >= 4) { r.fee = ms[2].v; r.net = ms[3].v; } else { r.net = ms[2] ? ms[2].v : r.gross; }
        } else if (type === 'D') {
          r.gross = ms[0].v;
          if (ms.length >= 4) { r.fee = ms[1].v; r.net = ms[2].v; r.tax = ms[3].v; } else { r.net = ms[1].v; r.tax = ms[2] ? ms[2].v : 0; }
        } else if (type === 'DEP' || type === 'WD') {
          r.gross = ms[0].v; if (ms.length >= 3) { r.fee = ms[1].v; r.net = ms[2].v; } else r.net = ms[ms.length-1].v;
          if (type === 'WD') { r.gross = -Math.abs(r.gross); r.net = -Math.abs(r.net); }
        } else if (type === 'FX') {
          r.gross = ms[0].v; r.rate = plain[0] ? num(plain[0]) : 0;
          if (ms.length >= 3) { r.fee = ms[1].v; r.net = ms[2].v; } else r.net = ms[ms.length-1].v;
        }
        if (!r.ccy) r.ccy = ms[0] ? ms[0].ccy : 'USD';
        st.rows.push(r);
      }
    }
    // a kivonat a legújabb sorral kezd; időrendbe állítjuk, azonos napon is
    const n = st.rows.length; st.rows.forEach(r => r.order = n - r.order);
    st.rows.sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order);
    return st;
  }

  // pdf.js: oldal szövegelemek -> sorok
  async function linesFromPdf(pdfjs, data) {
    const doc = await pdfjs.getDocument({data}).promise; const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent(); const rows = [];
      for (const it of tc.items) {
        const s = it.str.trim(); if (!s) continue; const y = it.transform[5];
        let row = rows.find(r => Math.abs(r.y - y) <= 2); if (!row) rows.push(row = {y, items:[]});
        row.items.push({x:it.transform[4], s});
      }
      rows.sort((a,b) => b.y - a.y).forEach(r => out.push(r.items.sort((a,b) => a.x - b.x).map(i => i.s)));
    }
    return out;
  }

  const api = {parse, linesFromPdf};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LYParser = api;
})(typeof self !== 'undefined' ? self : this);
