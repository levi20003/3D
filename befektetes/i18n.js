/* Nyelvi réteg: a felület magyarul készül, angolra a megjelenített szövegeket fordítjuk le
   (pontos egyezés vagy minta alapján), a számokat és dátumokat a nyelvnek megfelelően formázzuk. */
(function (root) {
  const store = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  // érvényes nyelvi kód (egyes eszközök pl. 'en-US@posix'-t adnak)
  const nav = (() => { const raw = String(navigator.language || 'en-US').split(/[@.]/)[0].replace('_', '-'); try { return Intl.getCanonicalLocales(raw)[0] || 'en-US'; } catch (e) { return 'en-US'; } })();
  try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'hu' || q === 'en') localStorage.setItem('bf-lang', JSON.stringify(q)); } catch (e) {}
  const lang = store('bf-lang') || (/^hu/i.test(nav) ? 'hu' : 'en');
  const I = { lang, exact: {}, re: [], ph: [] };
  I.locale = () => I.lang === 'hu' ? 'hu-HU' : (/^hu/i.test(nav) ? 'en-GB' : nav);
  I.t = (hu, en) => I.lang === 'en' && en != null ? en : hu;
  // alapértelmezett második pénznem a nyelv és régió alapján
  I.defaultAlt = () => {
    if (I.lang === 'hu') return 'HUF';
    const reg = (nav.split('-')[1] || '').toUpperCase();
    const map = { GB: 'GBP', CH: 'CHF', PL: 'PLN', CZ: 'CZK', SE: 'SEK', NO: 'NOK', DK: 'DKK', RO: 'RON', HU: 'HUF', US: 'EUR' };
    return map[reg] || 'EUR';
  };
  I.add = (exact, re, ph) => { Object.assign(I.exact, exact || {}); (re || []).forEach(([r, f]) => I.re.push([r, f])); (ph || []).forEach(x => I.ph.push(x)); I.ph.sort((a, b) => b[0].length - a[0].length); };
  const HAS_HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]|\b(Mind|Kivonat|Ma|Nincs|Elemzés|Napló|Riasztás|Összesen|Részvény|Mentés|Vétel|Eladás|Osztalék|Befizetés)\b/;
  I.tr = s => {
    if (I.lang !== 'en' || !s) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); const core = m[2]; if (!core) return s;
    let out = I.exact[core];
    if (out == null) for (const [r, f] of I.re) { const x = r.exec(core); if (x) { out = typeof f === 'function' ? f(...x.slice(1)) : core.replace(r, f); break; } }
    if (out == null && I.ph.length && HAS_HU.test(core)) { let x = core; for (const [h, e] of I.ph) if (x.includes(h)) x = x.split(h).join(e); if (x !== core) out = x; }
    if (out == null) { if (I.debug && (HAS_HU.test(core) || /\b(az|egy|vagy|nem|van|kulcs|nap|db|mint|csak|ha|meg|ez|ide|itt|kell|lesz|mind|minden|kivonat|ticker \(|dollár|forint)\b/i.test(core))) (I.miss = I.miss || new Set()).add(core); return s; }
    if (I.debug && HAS_HU.test(out)) (I.miss = I.miss || new Set()).add('PARTIAL: ' + out);
    return m[1] + out + m[3];
  };
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  I.dom = node => {
    if (I.lang !== 'en' || !node) return;
    const walk = n => {
      if (n.nodeType === 3) { const v = n.nodeValue; if (/[A-Za-zÁ-ű]/.test(v)) { const t = I.tr(v); if (t !== v) n.nodeValue = t; } return; }
      if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.hasAttribute('data-notr')) return;
      for (const a of ATTRS) if (n.hasAttribute(a)) { const v = n.getAttribute(a), t = I.tr(v); if (t !== v) n.setAttribute(a, t); }
      if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) n.value = I.tr(n.value);
      for (const c of n.childNodes) walk(c);
    };
    walk(node);
  };
  I.observe = () => {
    if (I.lang !== 'en') return;
    I.dom(document.body); document.title = I.tr(document.title);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName), t = I.tr(v); if (v && t !== v) m.target.setAttribute(m.attributeName, t); } else if (m.type === 'characterData') { const t = I.tr(m.target.nodeValue); if (t !== m.target.nodeValue) m.target.nodeValue = t; } else m.addedNodes.forEach(I.dom); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  I.debug = /[?&]i18ndebug/.test(location.search);
  root.I18N = I; root.t = I.t;
})(typeof self !== 'undefined' ? self : this);
