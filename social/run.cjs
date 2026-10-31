#!/usr/bin/env node
/* Használat:
   node social/run.cjs render  --post <id>|--today [--lang hu|en] [--out social/out]
   node social/run.cjs render  --all [--lang hu]                (minden poszt, ellenőrzéshez)
   node social/run.cjs publish [--manifest social/out/manifest.json] --base-url <URL>
   node social/run.cjs calendar [YYYY-MM-DD] [napok]
   node social/run.cjs token-check                              (hány napja jár le a token – frissítés) */
const fs = require('fs');
const path = require('path');
const cal = require('./calendar.cjs');
const { renderPost, withBrowser, posts } = require('./render.cjs');
const ig = require('./instagram.cjs');

const args = process.argv.slice(2); const cmd = args.shift();
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };

(async () => {
  if (cmd === 'calendar') return require('child_process').spawnSync('node', [path.join(__dirname, 'calendar.cjs'), ...args], { stdio: 'inherit' });
  if (cmd === 'render') {
    const lang = opt('lang', cal.cfg.lang); const out = path.resolve(opt('out', 'social/out'));
    let list;
    if (opt('all', false)) list = posts;
    else if (opt('today', false)) { const p = cal.postFor(opt('date', cal.iso(new Date()))); if (!p) { console.log('Ma nincs poszt a naptár szerint.'); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ none: true })); return; } list = [p]; }
    else { const p = posts.find(x => x.id === opt('post', '')); if (!p) throw new Error('Add meg a posztot: --post <id> (' + posts.map(x => x.id).join(', ') + ') vagy --today'); list = [p]; }
    const results = await withBrowser(async b => { const r = []; for (const p of list) { console.log('Renderelés:', p.id, lang); r.push(await renderPost(p, lang, path.join(out, `${opt('date', cal.iso(new Date()))}-${p.id}-${lang}`), b)); } return r; });
    const rel = results.map(r => ({ id: r.id, lang: r.lang, files: r.files.map(f => path.relative(out, f).split(path.sep).join('/')), caption: r.caption }));
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ posts: rel }, null, 2));
    console.log('Kész:', results.map(r => r.dir).join('\n       '));
    return;
  }
  if (cmd === 'publish') {
    const man = JSON.parse(fs.readFileSync(path.resolve(opt('manifest', 'social/out/manifest.json')), 'utf8'));
    if (man.none) { console.log('Nincs mit közzétenni.'); return; }
    const base = String(opt('base-url', '')).replace(/\/$/, ''); if (!base) throw new Error('--base-url kell (nyilvános URL, ahol a képek elérhetők).');
    for (const p of man.posts) {
      const urls = p.files.map(f => `${base}/${f}`); console.log('Közzététel:', p.id, urls.length, 'kép');
      const id = await ig.publishCarousel({ userId: process.env.IG_USER_ID, token: process.env.IG_ACCESS_TOKEN, imageUrls: urls, caption: p.caption });
      console.log('Megjelent, média azonosító:', id);
    }
    return;
  }
  if (cmd === 'token-check') {
    const r = await ig.refreshToken(process.env.IG_ACCESS_TOKEN); console.log(`Token frissítve, érvényes még ${Math.round(r.expiresIn / 86400)} napig. Az új értéket a Secretsbe is írd be (IG_ACCESS_TOKEN).`); return;
  }
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 7).join('\n'));
})().catch(e => { console.error(e.message || e); process.exit(1); });
