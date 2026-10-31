/* Instagram-képek renderelése: 1080×1350 (4:5) JPEG, a Portfolio Lens arculatában.
   Az app képernyőit a demó módból (?demo=1) rögzíti, valódi adat soha nem kerül a képekre. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { posts, HASHTAGS, DISCLAIMER, CTA } = require('./content.cjs');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error('Playwright nincs telepítve (npm i playwright && npx playwright install chromium).');
}

const ROOT = path.resolve(__dirname, '..');
const ICON = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ROOT, 'befektetes/icon.svg')).toString('base64');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
    }).listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

/* ---------- az app képernyői a demó módból ---------- */
const SHOTS = {
  home_all: { tab: 'attekintes', range: 'all' },
  home_6m: { tab: 'attekintes', range: '6m' },
  portfolio: { tab: 'portfolio' },
  wrapped: { tab: 'attekintes', wrapped: true },
};
async function appShots(browser, port, lang, need) {
  const out = {};
  for (const key of need) {
    const spec = SHOTS[key]; if (!spec) throw new Error('Ismeretlen képernyő: ' + key);
    const ctx = await browser.newContext({ viewport: { width: 412, height: 824 }, deviceScaleFactor: 2.5, serviceWorkers: 'block', locale: lang === 'hu' ? 'hu-HU' : 'en-US', colorScheme: 'light' });
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    await pg.addInitScript(([l, rg]) => { localStorage.setItem('bf-lang', JSON.stringify(l)); localStorage.setItem('bf-cur2', '"USD"'); localStorage.setItem('bf-alt', JSON.stringify(l === 'hu' ? 'HUF' : 'EUR')); localStorage.setItem('bf-theme', '"light"'); if (rg) localStorage.setItem('bf-range', JSON.stringify(rg)); }, [lang, spec.range || null]);
    await pg.goto(`http://127.0.0.1:${port}/befektetes/index.html?demo=1&lang=${lang}#${spec.tab}`);
    await pg.waitForTimeout(2600);
    await pg.addStyleTag({ content: '#status,.toast,#toast,.updbar{display:none!important}' });
    if (spec.wrapped) { await pg.evaluate(() => document.getElementById('wrapBtn') && document.getElementById('wrapBtn').click()); await pg.waitForTimeout(500); await pg.mouse.click(370, 400); await pg.waitForTimeout(250); await pg.mouse.click(370, 400); await pg.waitForTimeout(1400); }
    else await pg.waitForTimeout(900);
    out[key] = (await pg.screenshot()).toString('base64');
    await ctx.close();
  }
  return out;
}

/* ---------- sablonok ---------- */
const val = (v, lang) => (typeof v === 'function' ? v(lang) : v);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const CSS = `
:root{--cream:#f5f3ea;--bg:#f2f1eb;--ink:#14231c;--muted:#5d6b63;--hero:#1e4334;--hero2:#142e23;--mint:#b4e3c4;--accent:#1e4636}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1350px;overflow:hidden;background:#000}
.s{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:'Plus Jakarta Sans',system-ui,sans-serif;padding:92px 88px;display:flex;flex-direction:column}
.dark{background:radial-gradient(120% 80% at 15% 0%,#2a6049 0%,var(--hero) 45%,var(--hero2) 100%);color:var(--cream)}
.light{background:var(--bg);color:var(--ink)}
.top{display:flex;align-items:center;justify-content:space-between;font-size:30px;font-weight:700}
.brand{display:flex;align-items:center;gap:16px}
.brand img{width:52px;height:52px;border-radius:15px}
.pg{opacity:.55;font-weight:600}
.body{flex:1;display:flex;flex-direction:column;justify-content:center}
h1{font-size:104px;line-height:1.02;letter-spacing:-3px;font-weight:800}
h1 em{font-style:normal;color:var(--mint)}
.sub{font-size:44px;margin-top:34px;opacity:.78;font-weight:500;line-height:1.3}
h2{font-size:80px;line-height:1.06;letter-spacing:-2px;font-weight:800;margin-bottom:44px}
.light h2{color:var(--accent)}
p.b{font-size:46px;line-height:1.45;font-weight:500}
.light p.b{color:#2c3d34}
ul{list-style:none;padding:0;display:grid;gap:26px}
li{font-size:46px;line-height:1.3;font-weight:600;display:flex;gap:24px;align-items:flex-start}
li:before{content:'';flex:none;width:18px;height:18px;border-radius:50%;background:var(--accent);margin-top:20px}
.dark li:before{background:var(--mint)}
.big{font-size:190px;line-height:1;font-weight:800;letter-spacing:-6px;color:var(--mint)}
.cap{font-size:50px;line-height:1.35;margin-top:34px;font-weight:600}
.note{font-size:30px;margin-top:40px;opacity:.6;font-weight:500}
.foot{font-size:26px;opacity:.55;font-weight:500;line-height:1.35}
.swipe{position:absolute;right:88px;bottom:88px;font-size:30px;font-weight:700;color:var(--mint);display:flex;gap:10px;align-items:center}
.light .swipe{color:var(--accent)}
.phoneslide .body{justify-content:flex-start;padding-top:30px}
.phoneslide h2{font-size:70px;margin-bottom:0}
.phone{position:absolute;left:50%;top:380px;transform:translateX(-50%);width:700px;border-radius:70px 70px 0 0;background:#0d1f17;padding:16px 16px 0;box-shadow:0 40px 120px rgba(0,0,0,.5)}
.phone img{width:100%;display:block;border-radius:56px 56px 0 0}
.ctaicon{width:240px;height:240px;border-radius:64px;margin-bottom:56px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.pill{display:inline-block;margin-top:50px;padding:18px 34px;border-radius:99px;background:rgba(245,243,234,.12);color:var(--mint);font-size:34px;font-weight:700;align-self:flex-start}
`;
const FONT = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">';

function frame(cls, n, total, inner, extra = '') {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}</style></head><body><div class="s ${cls}">
  <div class="top"><span class="brand"><img src="${ICON}" alt="">Portfolio Lens</span><span class="pg">${n}/${total}</span></div>
  ${inner}${extra}</div></body></html>`;
}
const swipe = lang => `<div class="swipe">${lang === 'hu' ? 'Lapozz' : 'Swipe'} →</div>`;

function slideHtml(sl, n, total, lang, shots) {
  const c = sl[lang] || {};
  if (sl.t === 'cover') {
    const words = esc(c.h).split(' '); const k = Math.ceil(words.length * 0.55);
    return frame('dark', n, total, `<div class="body"><h1>${words.slice(0, k).join(' ')} <em>${words.slice(k).join(' ')}</em></h1><div class="sub">${esc(c.sub || '')}</div></div>`, swipe(lang));
  }
  if (sl.t === 'text') {
    const body = c.l ? `<ul>${c.l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="b">${esc(val(c.b, lang))}</p>`;
    return frame('light', n, total, `<div class="body"><h2>${esc(c.h)}</h2>${body}</div>`, n < total ? swipe(lang) : '');
  }
  if (sl.t === 'stat') {
    return frame('dark', n, total, `<div class="body"><div class="big">${esc(sl.big(lang))}</div><div class="cap">${esc(c.cap)}</div><div class="note">${esc(c.note || '')}</div></div>`, swipe(lang));
  }
  if (sl.t === 'phone') {
    return frame('dark phoneslide', n, total, `<div class="body"><h2>${esc(c.h)}</h2></div><div class="phone"><img src="data:image/png;base64,${shots[sl.shot]}" alt=""></div>`);
  }
  throw new Error('Ismeretlen dia: ' + sl.t);
}
function ctaHtml(n, total, lang) {
  const c = CTA[lang];
  return frame('dark', n, total, `<div class="body"><img class="ctaicon" src="${ICON}" alt=""><h1>${esc(c.h)}</h1><div class="sub">${esc(c.sub)}</div><div class="pill">${esc(c.pill)}</div></div><div class="foot">${esc(DISCLAIMER[lang])}</div>`);
}

/* ---------- egy poszt renderelése ---------- */
async function renderPost(post, lang, outDir, ctxBundle) {
  const { browser, port } = ctxBundle;
  fs.mkdirSync(outDir, { recursive: true });
  const need = [...new Set(post.slides.filter(s => s.t === 'phone').map(s => s.shot))];
  const shots = need.length ? await appShots(browser, port, lang, need) : {};
  const total = post.slides.length + 1;
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  const files = [];
  for (let i = 0; i < total; i++) {
    const html = i < post.slides.length ? slideHtml(post.slides[i], i + 1, total, lang, shots) : ctaHtml(i + 1, total, lang);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => { const b = document.querySelector('.body'); const s = document.querySelector('.s'); return b.scrollHeight > b.clientHeight + 2 || document.documentElement.scrollHeight > 1352; });
    if (over) console.warn(`  Figyelem: a(z) ${post.id}/${lang} ${i + 1}. dia szövege kilóghat, rövidítsd.`);
    const f = path.join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
    files.push(f);
  }
  await page.close();
  const caption = `${post.caption[lang]}\n\n${DISCLAIMER[lang]}\n\n${HASHTAGS[lang]}`;
  fs.writeFileSync(path.join(outDir, 'caption.txt'), caption);
  return { id: post.id, lang, dir: outDir, files, caption };
}

async function withBrowser(fn) {
  const { chromium } = loadPlaywright();
  const { srv, port } = await serve();
  const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
  try { return await fn({ browser, port }); } finally { await browser.close(); srv.close(); }
}

module.exports = { renderPost, withBrowser, posts };
