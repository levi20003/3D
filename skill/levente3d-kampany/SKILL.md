---
name: "levente3d-kampany"
description: "Levente 3D (Paulik Levente, Szeged) 3D nyomtatós vállalkozás és B2B kampány kezelése takarékosan: kampánypult, címek, sablonok, rendelések, pénzügy, Gmail."
---

# Levente 3D – kampány és vállalkozás (takarékos mód)

Levente Claude Pro előfizetéssel dolgozik, ezért **minden lépésnél a lehető legkevesebb adatot olvass be**. Ez a legfontosabb szabály.

## Források
- Kampánypult (artifact, db): https://claude.ai/artifact/44semk3pH1ffrYo8XycBoS
  - Kollekciók: `contacts` (doc_id = kisbetűs e-mail, DM-nél dm-<név>-<város>; status javasolt|uj|elkuldve|valaszolt|ugyfel|lezarva|elvetve), `todos`, `orders`, `ledger` (bevétel/kiadás), `templates`, `settings` (`main`, `blocklist`, `summary`, `search`).
  - A pultban van 3D-generátor fül is (szöveg → névtábla/kulcstartó STL, ZIP-ben tölthető le).
- Weboldal: https://claude.ai/artifact/WZLdSDK19twEH9KM9WbH56
- Napi automatikus feladat: hétköznap 7:19, frissíti a pultot és a `settings/summary` dokumentumot.
- Névjegy forrásfájlok: card2.py (reportlab), olajzöld #777A4B, homok #C1A37D, törtfehér #E9E8DF; logó = rétegzett L, a LEVENTE első betűje.

## Takarékossági szabályok
1. **Először mindig csak a `settings/summary` dokumentumot olvasd** (ArtifactData get). A legtöbb kérdésre (hány cím, ki válaszolt, pénzügy, teendők) ebből válaszolj.
2. Az artifact HTML-jét **ne olvasd be** (Artifact read), hacsak nem kell kódot módosítani. Ha módosítani kell, a helyi fájlt szerkeszd célzottan (Grep + kis Read szakaszok), ne olvasd be egészben.
3. A `contacts`-ot ne listázd teljesen: használj `query`-t `where` szűrővel és `limit`-tel, nagy eredménynél `out_dir`-be ments, és Python-nal számolj.
4. Gmail: `search_threads` THREAD_VIEW_METADATA_ONLY nézettel, szűk dátummal (newer_than:3d). Teljes szálat (`get_thread`, PLAIN_TEXT vagy MINIMAL) csak akkor olvass, ha tényleg kell a tartalom.
5. PDF/képek: előbb `pdftotext`, csak ha üres, akkor kis felbontású (≈70 dpi) raszter, és csak a tartalmas oldalak.
6. Írásnál batch-et használj, mindig `if_version`-nel. Ne olvass vissza ellenőrzésképp mindent, elég egy célzott get.
7. Válaszok legyenek rövidek; ne ismételd meg, amit a pult már mutat.

## Címlista utántöltése
- Ha a napi futáskor az `uj` és `javasolt` állapotú címek együtt kevesebb mint 60-an vannak, gyűjts új címeket.
- **Előbb olvasd el a `settings/search` dokumentumot** (ArtifactData get). A `plan.targets` listában vannak a mai keresések (`q`: keresőkifejezés, `cat`, `city`), a `plan.rules` a szabályok, a `plan.perRun` a futásonkénti felső határ. A pult számolja ki a válaszarányok és a lefedettség alapján; ettől ne térj el.
- Minden célra: webes keresés a `q` kifejezéssel (Google Térkép-találatok, céges weboldalak), majd a cég Kapcsolat/Impresszum oldala vagy Facebook-névjegye.
- **Bármilyen e-mail címet felvehetsz, amit a cég maga tesz közzé, nem csak `info@`-t.** Csak ténylegesen látott címet, soha ne tippelj. Cégenként egy cím (az általános vagy az értékesítési).
- Ha nincs e-mail, de van Facebook- vagy Instagram-oldal: DM-kapcsolat (`doc_id` és `email` = `dm-<név>-<város>`, `channel: "dm"`, `fb` vagy `ig` mező).
- Duplikáció-ellenőrzés: `contacts` doc_id és domain (az `elvetve` állapotúakat is beleértve), Gmail `to:` keresés, tiltólista. Az `elvetve` állapotú cégeket soha ne vedd fel újra.
- Új rekord: **status `javasolt`** (Levente a pultban hagyja jóvá), `cat`, `city`, `name`, rövid `hook` (egy mondat arról, mit csinálnak), `source` = az oldal URL-je és a dátum.
- Futás végén `update`-tel írd a `settings/search` dokumentumba: `lastRun: {date, found, empty: [azok a q-k, amelyekre nem volt új találat]}`. A `plan` mezőhöz ne nyúlj.
- **Tartalék:** ha a `plan.targets` keresései együtt 0 új címet hoztak, végezd el a `plan.fallback.targets` kereséseit is (szegedi éttermek, gyorséttermek, `cat: vendeglato`). Csak olyan helyet vegyél fel, ahová még nem ment levél vagy DM: contacts doc_id és domain, azonos nevű `dm-` kapcsolat, Gmail `to:`. A `lastRun`-ba írd be: `fallbackUsed: true`.
- Ha így sem sikerül elég címet találni, ne erőltesd.

## Üzleti szabályok
- **Soha ne küldj e-mailt** Levente kifejezett kérése nélkül; ha kéri, egyenként, sosem BCC-ben. Levente általában maga küld a pult Küldés gombjával.
- **Tiltólista:** informatikai cégek, N-System (n-system.hu – Levente gyakorlati helye), `settings/blocklist`, egyetemi tanulmányi és könyvtári címek, magánszemélyek, pubok, bárok, szórakozóhelyek (éttermek és gyorséttermek csak tartalékként, a `plan.fallback` szerint), fitness, autósiskola, autószerviz.
- Soha ne találj ki e-mail-címet; csak oldalon ténylegesen látott címet vegyél fel, duplikáció-ellenőrzéssel (contacts + Gmail `to:/bcc:`).
- Kategóriák: nyomda, ipar, epitoipar, mezogazd, epitesz, oktatas, sport, rendezveny, kisker, turizmus, hobbi, szolg, auto, lakber, civil, allat, vendeglato, egyeb.
- Gép: Bambu A1 mini, max 18×18×18 cm, PLA fekete/fehér/ezüst/pink. Árazás a pult Árkalkulátorában (Perfect Profil kapocs: 1 000 Ft/db).
- Jogi/adó kérdésnél tényeket adj, és jelezd, hogy nem vagy könyvelő/jogász.