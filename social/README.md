# Portfolio Lens: automatikus Instagram-tartalom

Ez a mappa egy **tartalomgyár**: az appból (demó mód, kitalált adatokkal) és a tartalombankból magától képeket és szöveget készít, és ütemezetten ki is teszi az Instagramra. Valódi pénzügyi adat soha nem kerül a képekre.

## Mit csinál

| Fájl | Feladat |
|---|---|
| `content.cjs` | **15 poszt** magyarul és angolul (oktató, app-bemutató, bizalom, kérdező). A számokat a kód számolja (kamatos kamat, díjhatás, deviza), így a példák nem tévedhetnek el. |
| `render.cjs` | 1080×1350-es (4:5) JPEG diák az arculatban; az app képernyői a demóból. A szöveg kilógását jelzi. |
| `calendar.cjs`, `config.json` | Hétfő/szerda/péntek: sorban a következő poszt. A `config.json`-ban állítható a kezdet, a napok és a nyelv. |
| `instagram.cjs` | Közzététel az Instagram hivatalos API-jával (carousel). |
| `run.cjs` | Parancssor mindenhez. |
| `../.github/workflows/social.yml` | Az ütemezett futtatás a GitHub Actions-ben. |

## Gyors kipróbálás (a gépeden)

```bash
npm i playwright && npx playwright install chromium
node social/run.cjs calendar 2026-11-02 42            # a következő hetek naptára
node social/run.cjs render --post vs-sp500 --lang hu  # egy poszt képei: social/out/...
node social/run.cjs render --all --lang en            # mindet, ellenőrzéshez
```

Minden poszt mappájában ott van a `caption.txt` is (leírás, jogi megjegyzés, hashtagek).

## 1. út: félautomata (nulla beállítás)

A workflow képeket készít és letölthető csomagot ad (GitHub → Actions → a futás → *Artifacts*). Ezt feltöltöd az Instagramra, vagy a **Meta Business Suite**-ban beütemezed. Ez a legbiztonságosabb kezdés.

## 2. út: teljesen automatikus

1. **Instagram fiók:** váltsd *Professzionális* (Business vagy Creator) fiókra. Külön fiók ajánlott a magyar és az angol tartalomnak.
2. **Meta fejlesztői app:** https://developers.facebook.com → új app → termék: **Instagram API with Instagram Login**. Add hozzá magad *Instagram-tesztelőként*, fogadd el a meghívót az Instagramban. A saját fiókodra tett posztokhoz nem kell app-felülvizsgálat (a Meta dokumentációja a mérvadó, a menüpontok változhatnak).
3. **Token és azonosító:** generálj hosszú élettartamú (60 napos) hozzáférési tokent az `instagram_business_basic` és `instagram_business_content_publish` jogosultsággal, és jegyezd fel az Instagram-felhasználó azonosítóját.
4. **GitHub Secrets** (Settings → Secrets and variables → Actions): `IG_USER_ID` és `IG_ACCESS_TOKEN`. **Soha ne írd a kódba vagy chatbe.**
5. **Aktiválás:** az ütemezett workflow **csak az alapértelmezett ágról fut**. Az `.github/workflows/social.yml` fájlt és a `social/` mappát tedd az alapértelmezett ágra (pull request és merge).
6. **Próba:** Actions → *Instagram poszt* → *Run workflow* → `publish = true`, egy tesztposztot kitesz. Ha jó, a hétfő/szerda/péntek futások magukra vannak bízva.
7. **Token-megújítás:** a token 60 naponta lejár. 50 naponként futtasd: `IG_ACCESS_TOKEN=… node social/run.cjs token-check`, és az új értéket írd a Secretsbe. Tegyél a naptáradba ismétlődő emlékeztetőt.

A képek az Instagramnak egy nyilvános URL-re kellenek: a workflow egy eldobható `social-assets` ágra teszi őket (felülírja, a repó nem hízik).

## 3. út: Posty

Ha a Claude-ban a *Posty* összekötőt engedélyezed (claude.ai → Beállítások → Összekötők), és a Posty-ban csatlakoztatod az Instagramot, akkor a naptárat és a leírásokat egy menetben be lehet ütemezni a Postyban, a tokenek kezelése nélkül. Ezt a következő munkamenetben el tudom végezni.

## Tartalom és szabályok

* **Nem befektetési tanács.** Minden poszt végén jogi megjegyzés van, a példák illusztrációk. Ne adj hozamígéretet, ne ajánlj konkrét részvényt. A Meta és az MNB is szigorú a pénzügyi hirdetményekre; ha fizetett promóciót indítasz, előtte olvasd el a szabályokat.
* **TBSZ-poszt:** szándékosan nem tartalmaz pontos adószabályokat. Ha konkrétumot írsz bele, ellenőrizd a hatályos szabályokat.
* **Frissítsd negyedévente** a tartalombankot (új posztok az `content.cjs`-ben), különben 5 hét után ismétlődik. Az `id`-kat egyediként add meg.
* **Évvégén** (dec. 20–jan. 10.) a **Portfolio Wrapped** a legjobb téma: érdemes külön sorozatot indítani.

## Mérés és következő lépések

1. **Link a bióban:** a weboldal (`/portfolio-lens/`), abban a demó gomb és később a Play-link. Az Instagram Insights mutatja a profil- és linkkattintásokat.
2. **Reels:** az API Reelst is tud, de videót kell hozzá renderelni. A 4:5 carousel a leggyorsabb kezdés; a Reels a következő lépés (a Wrapped és az app-demó képernyőfelvétele).
3. **Zárt teszt (Play):** a poszt-sorozat egyik tengelye legyen a tesztelőtoborzás.
4. **Mit mérj:** mentések és megosztások (nem a lájkok), profilkattintás, link kattintás, később Play telepítések.
