/* Posztnaptár: a config.json szerinti napokon (alapból hétfő, szerda, péntek) a tartalombank sorban következő posztja. */
const fs = require('fs');
const path = require('path');
const { posts } = require('./content.cjs');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const iso = d => d.toISOString().slice(0, 10);
const day = s => new Date(s + 'T12:00:00Z');

// az adott naphoz tartozó poszt (vagy null, ha nem posztolós nap)
function postFor(dateIso) {
  const d = day(dateIso), start = day(cfg.start);
  if (d < start || !cfg.weekdays.includes(d.getUTCDay())) return null;
  let n = 0; for (let x = new Date(start); x < d; x.setUTCDate(x.getUTCDate() + 1)) if (cfg.weekdays.includes(x.getUTCDay())) n++;
  return posts[n % posts.length];
}
function upcoming(fromIso, days) {
  const out = []; const d = day(fromIso);
  for (let i = 0; i < days; i++, d.setUTCDate(d.getUTCDate() + 1)) { const p = postFor(iso(d)); if (p) out.push({ date: iso(d), id: p.id }); }
  return out;
}
module.exports = { postFor, upcoming, cfg, iso };

if (require.main === module) {
  const from = process.argv[2] || cfg.start; const n = +(process.argv[3] || 42);
  console.log(`Posztnaptár ${from} -tól, ${n} napra (${cfg.lang}):`);
  upcoming(from, n).forEach(x => console.log(`${x.date}  ${x.id}`));
}
