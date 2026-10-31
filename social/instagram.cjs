/* Instagram közzététel (Instagram API, carousel). A képeknek nyilvános JPEG URL-en kell elérhetőnek lenniük.
   Szükséges környezeti változók: IG_USER_ID, IG_ACCESS_TOKEN. Kulcsot soha ne írj a repóba. */
const GRAPH = process.env.IG_GRAPH || 'https://graph.instagram.com/v21.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(pathname, params, method = 'POST') {
  const url = new URL(GRAPH + pathname);
  const body = new URLSearchParams(params);
  const r = method === 'GET' ? await fetch(url + '?' + body) : await fetch(url, { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram API hiba (${pathname}): ${(j.error && j.error.message) || r.status}`);
  return j;
}
async function waitReady(id, token) {
  for (let i = 0; i < 30; i++) {
    const j = await api('/' + id, { fields: 'status_code', access_token: token }, 'GET');
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') throw new Error('A média feldolgozása sikertelen: ' + j.status_code);
    await sleep(3000);
  }
  throw new Error('A média feldolgozása időtúllépés miatt megszakadt.');
}
async function publishCarousel({ userId, token, imageUrls, caption }) {
  if (!userId || !token) throw new Error('Hiányzik az IG_USER_ID vagy az IG_ACCESS_TOKEN.');
  const kids = [];
  for (const u of imageUrls) { const c = await api(`/${userId}/media`, { image_url: u, is_carousel_item: 'true', access_token: token }); kids.push(c.id); }
  for (const id of kids) await waitReady(id, token);
  const parent = await api(`/${userId}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption, access_token: token });
  await waitReady(parent.id, token);
  const pub = await api(`/${userId}/media_publish`, { creation_id: parent.id, access_token: token });
  return pub.id;
}
// a hosszú élettartamú token (60 nap) frissítése; az új értéket a Secretsben kell lecserélni
async function refreshToken(token) {
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Token-frissítés sikertelen: ' + ((j.error && j.error.message) || r.status));
  return { token: j.access_token, expiresIn: j.expires_in };
}
module.exports = { publishCarousel, refreshToken };
