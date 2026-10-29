# Levente 3D kampánypult: dokumentáció

Állapot: 2026. október 29.

- **Pult (élő):** https://claude.ai/artifact/44semk3pH1ffrYo8XycBoS
- **Forrás:** `dashboard/index.html` (egyetlen HTML fájl, Claude Artifact)
- **Weboldal:** https://claude.ai/artifact/WZLdSDK19twEH9KM9WbH56
- **Kapcsolódó leírások:** [ERVENYTELEN.md](ERVENYTELEN.md) (visszapattant címek), `../skill/levente3d-kampany/SKILL.md` (a napi rutin szabályai), `../projekt/` (a claude.ai projekt fájljai)

---

## 1. Mire való
A pult Levente B2B megkereséseit kezeli egy helyen. Itt vannak:
- a címek: e-mail, Instagram, Facebook;
- a levelek küldése a Gmailből;
- a follow-upok és a visszapattanók;
- a keresési terv, a sablonok;
- a rendelések és a pénzügy;
- az ártervező eszközök.

A pult a claude.ai-on, bejelentkezve működik. Ha helyben nyitod meg (`file://`), látszik a felület, de nem ment és nem küld.

## 2. Fülek
| Fül | Mire való |
|---|---|
| **Áttekintés** | Napi teendők, bevétel és kiadás, válaszarány, naptár, kategóriák, legutóbbi megkeresések. |
| **Címlista** | A napi munka: kijelölés, küldés, follow-up, privát üzenetek, javaslatok, érvénytelen címek. |
| **Lefedettség** | Keresési terv: terület (Szeged + 50 km), fókusz-kategóriák, napi keresések, kategória × város táblázat. |
| **Rendelések** | Ajánlatok és rendelések állapota, bevételek és kiadások. |
| **Célok** | 30 napos célok a saját eredményeidből számolva, haladás. |
| **Tervező** | Gyártási becslés: méret és típus alapján gramm, gépidő, ár-intervallum. |
| **Árkalkulátor** | Pontos ár díjtételekből, ajánlat egy kattintással. |
| **3D-generátor** | Szövegből névtábla, kulcstartó, QR-tábla STL fájlban (ZIP). |
| **Sablonok** | Levél-, follow-up- és DM-szövegek kategóriánként, Google Cégprofil szövegek. |
| **Új címek** | Okos felvétel szövegből (aláírás, kapcsolatoldal), kategorizálással. |
| **Beállítások** | Napi cél, aláírás, a munkáid linkje, follow-up napok. |

## 3. Napi kör telefonon
1. **Címlista** megnyitása.
   - A csatorna-gombokon (E-mail / Instagram / Facebook) a „N teendő” jelvény mutatja, hol van munka.
   - Ha az aktuális csatornán nincs, egy sáv megmutatja, hol van („Itt vár munka”).
2. **Javaslatok:** a napi keresés találatai. „Forrás” gomb, majd jóváhagyás vagy elvetés.
3. **Kiküldendő** vagy **Follow-up** szűrő, utána:
   - „Mind kijelölése (N)”;
   - „Kijelöltek küldése (N)”;
   - „Igen, küldés”.
4. Küldés közben maradjon nyitva az app. Ha bezárul, újranyitás után a **„Küldés folytatása”** gombbal megy tovább.
5. **Instagram / Facebook:**
   - „DM szöveg másolása”, a profil megnyitása, elküldés kézzel;
   - utána „Elküldtem DM-ben”.
6. **Érvénytelen** szűrő, ha van benne cím: új e-mail, átrakás DM-be, vagy lezárás.

## 4. Címlista részletesen
### Állapotok
| Állapot | Jelentés |
|---|---|
| Javasolt | A napi keresés találta, jóváhagyásra vár |
| Új (Kiküldendő) | Még nem ment neki levél |
| Elküldve | Ment levél, válaszra vár |
| Follow-up esedékes | Számolt állapot, lásd 6. pont |
| Válaszolt | Válaszolt |
| Ügyfél | Ügyfél lett |
| Lezárva | Lezárt cím |
| Elvetve | Elvetett javaslat, nem jön vissza |
| Érvénytelen | Visszapattant, nincs pótlása, kézzel kell rendezni ([ERVENYTELEN.md](ERVENYTELEN.md)) |

### Kártyák
- **Címkészlet** (Áttekintés és Címlista): kiküldhető (`uj`) + jóváhagyásra váró (`javasolt`) cím, e-mail és DM együtt, tiltólistás nélkül, a 60-as célhoz mérve. 60 alatt sárga, 30 alatt piros. Alatta: „Ezen a héten bekerült: X / 50” (hétfőtől, a felvétel dátuma szerint: `addedAt`, ha nincs, a `source` utolsó dátuma). Ugyanez a szám kerül a `settings/summary.pool` mezőbe.
- **Értesítő sáv** a Címlista tetején: ha a készlet 60 alatt van és 10-nél több javaslat vár, „N cím vár jóváhagyásra, 2 perc az egész”, gombbal a Javaslatok szűrőre.
- **Kiküldendő** és **Follow-up esedékes:** az összes csatorna együtt, alatta bontás, például „E-mail 18 · Instagram 29”.
- **Ma elküldve:** a mai darabszám. Alatta: „cél 30 · még X mehet (napi 100)”. A sáv a napi korláthoz mér.

### Sorállapotok küldéskor
| Jelvény | Jelentés |
|---|---|
| Küldésre vár | Sorban van, nem küldhető újra |
| Épp most megy ki | Küldés alatt |
| Ellenőrzésre vár | A küldés megszakadt (15 percnél régebben). Folytatáskor a Gmail Elküldött mappája dönt, hogy kell-e még küldeni. |
| Küldés bizonytalan | A Gmail nem jelezte vissza, elment-e. Döntsd el az „Elment” vagy „Nem ment el” gombbal; addig nem küldhető. |

### Gyors jóváhagyás (Javaslatok szűrő)
- Soronként: név, város · kategória · e-mail domain (DM-nél Instagram/Facebook) · **Forrás** link, alatta a hook.
- Két nagy gomb (44 px): **Jóváhagyom** (`status: "uj"`, `approvedAt`) és **Elvetem**. Elvetésnél opcionális ok: „nem célcsoport”, „magánszemély”, „rossz cím”, „tiltólistás”, vagy „Ok nélkül” (`status: "elvetve"`, `rejectedAt`, `rejectReason`). A sor animáció nélkül tűnik el, az oldal nem ugrik a tetejére.
- **Duplikált javaslat:** ha a doc_id vagy a (nem freemail) domain már szerepel egy másik címnél bármilyen állapotban (az elvetettet is beleértve), illetve DM-nél azonos cégnév, a sor figyelmeztetést kap („Már szerepel: …”), és nem hagyható jóvá, csak elvethető.
- **Mind jóváhagyása (N):** megerősítést kér, egyenként ír, és kihagyja a tiltólistás és a duplikált sorokat. A sáv kiírja: „3 kihagyva: 2 már szerepel, 1 tiltólistás”. Jóváhagyás után sem megy ki semmi magától.

### Tiltott cég
Nincs küldő, másoló vagy jóváhagyó gomb, csak a „Tiltólistán, nem küldünk neki” felirat.

## 5. Küldés
- **Folyamat:**
  1. Kijelölés.
  2. Megerősítés.
  3. A levelek kész szöveggel a `sendqueue` gyűjteménybe kerülnek (`state: "var"`).
  4. A pult egyenként elküldi őket a Gmailből (`send_message`), 4–7 másodperc szünettel.
- **Zár:** egyszerre csak egy nyitott lap küldhet (`settings/senderlock`, 90 másodperces bérlet). Küldés alatt a képernyő ébren marad (wake lock).
- **Megszakadás:**
  - a sor megmarad;
  - a „Küldés folytatása” gomb folytatja;
  - a félbemaradt tételeknél előbb Gmail-keresés (`search_threads`) ellenőrzi, nem ment-e már ki.
- **Napi korlát: 100 levél** (`DAILY_LIMIT`), az új levelek és a follow-upok együtt.
- **Leállítás:** csak megállít, a maradék folytatható. A **„Mégse küldöm el…”** megerősítés után `megszakitva` állapotba teszi a várakozó tételeket.
- **Háttérküldő:** a szerveroldali küldő (ütemezett feladat) ki van kapcsolva. A háttérfutás jogosultsága nem engedte a küldést, ezért a pult maga küld.

## 6. Follow-up szabályok
- **Mikor esedékes:** 1. follow-up a levél után 6 nappal (`fuDays`), 2. follow-up az első után 8 nappal (`fu2Days`). A levél szálában megy (`replyThreadId`), ha a szál ismert.
- **Csak az új címről:** follow-up csak a **levente3d.szeged@gmail.com** címről küldött levelekhez jár: `acct: "levente3d"`, vagy `sentAt` 2026-10-19-től (`fuSince`). A régi címről mentek mellett ez áll: „régi címről, nincs follow-up”.
- **Mikor nincs follow-up:** aki válaszolt, aki visszapattant, és aki tiltólistán van.
- **Privát üzenetek:** Instagramon és Facebookon „emlékeztető” a neve, és nincs követelmény a feladó címére.

## 7. Tiltólista (`settings/blocklist`)
- `domains`: domain és aldomain (például `n-system.hu`, `futurevisuals.hu`, informatikai cégek).
- `emails`: pontos címek.
- `keywords`: egész szóként illeszt a névre, címre, profil linkre és forrásra („futurevisuals”, „future visuals”, „n-system”, „nsystem”).
- Érvényes a gyors felvételre, a kézi pótlásra, a küldésre, a kijelölésre és a napi keresésre is.

## 8. Keresési terv (Lefedettség fül, `settings/search`)
- **Ki használja:** a hétköznap 10:00-kor futó **címgyűjtő**. A 7:25-ös napi kör nem gyűjt címet, csak a visszapattanókat és a válaszokat kezeli.
- **Terület:** `settings/main.area` egyetlen szám km-ben (50, 100 vagy 150, alapból 150). A Lefedettség fülön választható: Szeged + 50 km (19 település), + 100 km (33), + 150 km (45). A `plan.cities` ebből áll össze. A keresés előbb az 50 km-es kör azon településeire megy, ahol a kategóriának kevés címe van; a távolabbi körök és a már sűrű városok (pl. Szeged a nyomdáknál) csak utánuk jönnek. A régi 1–4-es sorszámot a pult km-ként értelmezi (1 = 50, 2 = 100, 3–4 = 150).
- **Súlyozott keret:** a napi keresések száma (`perRun`, alapból 15) a kategóriák válaszaránya szerint oszlik el. Súly = (válasz + 1) / (kiküldött + 4). Minden fókuszkategória kap legalább 1 keresést; ahol már legalább 30 levél ment ki, és a válaszarány 5% alatt van, ott 1 marad („gyenge válasz, csak minta”). A maradék a súly négyzete arányában a legjobb kategóriákba megy. A válaszarány csak az érett levelekből számít: legalább 6 napos, nem visszapattant.
- **Példa (október 29.):** nyomda 26/57, turisztika 1/4, reklám-dekor 1/37, gyártás 1/33, építész 0/23, lakber 0/7 → a 15 keresésből nyomda 8, turisztika 3, a többi 1–1.
- **Nyomda kulcsszavak:** nyomda, digitális nyomda, reklámnyomda, fénymásoló, szitanyomás, címkenyomda, csomagolóanyag, molinó nyomtatás, gyorsnyomda, könyvkötészet. Naponta váltakoznak.
- **Nem keres:** jóga, tánc, fitnesz, terápia (e-mailre 0% válasz). Ezek nem kerülnek a `targets` és a `fallback.targets` közé, a Fókusz gombok közül is kikerültek; a meglévő címek maradnak.
- **Módszer (`plan.rules`):** Google Térkép listanézet (`<kulcsszó> <város>`), majd a cég saját oldala (Kapcsolat, Impresszum) vagy a Facebook-névjegy. Cylex és Arany Oldalak nem (403-at adnak).
- **Tartalék:** fókusz módban a fókuszkategóriák Szegeden, más kulcsszóval; fókusz nélkül szegedi vendéglátóhelyek.
- **Mentés:** a pult csak `update({plan, updated})`-tal ír, és csak akkor, ha a terv változott. A `lastRun`-hoz és minden más mezőhöz nem nyúl, így a címgyűjtő írása megmarad. Ha a `lastRun.date` mai, a mai kereséseket nem számolja újra: a terv a következő hétköznapra készül (`plan.for`).
- **Kártyák:** a „Keresési terv” alján látszik, melyik napra szól a terv, és ki futtatta utoljára (`lastRun.by`: „címgyűjtő” vagy „napi kör”), mikor, hány új javaslattal. A „Kategóriák eredménye” kártya kategóriánként mutatja: kiküldve, válasz, arány (érett levelekből) és a mai keresések száma.
- **Visszajelzés:** a címgyűjtő a végén `update`-tel a `lastRun` mezőbe írja: `{date, time, by, found, fallbackUsed, empty}`.

## 9. Adatmodell (`window.claude.use("db")`)
| Gyűjtemény / dokumentum | Tartalom |
|---|---|
| `contacts/{doc_id}` | doc_id: kisbetűs e-mail, DM-nél `dm-<név>-<város>`. Fő mezők: `email`, `name`, `cat` (`catLabel`), `city`, `hook`, `note`, `source`, `status`, `sentAt`, `followupAt`, `followup2At`, `threadId`, `acct`, `channel` (`dm`), `ig`/`fb`, `dmVia`, `bounced`, `bouncedAt`, `replaceDone`, `replacedBy`, `replaces`, `invalidDone`, `sendUnsure`, `approvedAt`, `addedAt` (felvétel napja), `rejectedAt`, `rejectReason`, `repliedAt`, `clientAt` (a kézi „Válaszolt” / „Ügyfél” állapotváltáskor) |
| `sendqueue/{id}` | id: `uj-<email>` vagy `fu1-`/`fu2-<email>`. Mezők: `email`, `name`, `kind`, `stage`, `args {to, subject, body, replyThreadId?}`, `patch` (benne `"{MA}"` = küldés napja), `state` (`var`, `kuld`, `kesz`, `kihagyva`, `hiba`, `megszakitva`), `queuedAt`, `claimedAt`, `sentAt`, `error` |
| `templates/{kulcs}` | A Sablonok fülön módosított levelek (a beépített alapokat írják felül) |
| `orders`, `ledger`, `todos` | Rendelések, bevétel és kiadás, növekedési lépések |
| `settings/main` | `goal` (napi cél, 30), `fuDays`, `fu2Days`, `sig`, `link`, `area`, `focus`, `perRun`, `searchSkip`, `goals`, `rates`, `fuSince` |
| `settings/search` | `plan` (`targets`, `fallback`, `rules`, `focus`, `cities`), `updated`, `lastRun` |
| `settings/blocklist` | `domains`, `emails`, `keywords`, `rule` |
| `settings/summary` | A Claude-ok előbb ezt olvassák. A pult minden betöltéskor és küldési kör után frissíti (10 mp késleltetéssel, csak ha változott, `update`-tel, a más által írt mezőket, pl. `needReply`, `finance`, `note`, meghagyja): `updated`, `contacts` (állapotonként, plusz `total`, `fu`, `dmQueue`), `pool {uj, javasolt, total, target: 60}`, `week {from, added, sent, followups, replies, newClients}` (hétfőtől), `today {sent, followups}`, `followupDue`, `followupDue1`, `followupDue2`, `invalid`, `replyRateByCat` (`{kat: {sent, replied, rate}}`, érett levelekből). A `week.replies` és `newClients` csak a `repliedAt` / `clientAt` mezős címeket számolja. |
| `settings/senderlock` | Küldési zár (`acquire`, 90 másodperces bérlet) |

A pult jogosultságai: `db`, `downloads`, valamint `mcp` (Gmail: `send_message`, `search_threads`).

## 10. Automatizmusok
| Ütemezett feladat | Mikor | Mit csinál |
|---|---|---|
| **3D - Napi kör (értesítéssel)** | Hétköznap 7:25 | Visszapattanók rendezése, válaszok jelölése, értesítés csak újdonságnál. Új címet nem gyűjt (lásd lent). Levelet nem küld. |
| **3D - Címgyűjtő (150 km, böngészős)** | Hétköznap 10:00 | Új címek a `settings/search` terve szerint, `javasolt` állapotban. A végén `lastRun`. |
| **Heti mérföldkő-frissítés** | Vasárnap 18:35 | Heti számok a mérföldkő-tervbe. |
| 3D - Ütemezés | **kikapcsolva** | A napi kör régi változata. |
| 3D - Háttérküldő (pult sor) | **kikapcsolva** | Szerveroldali küldő; a jogosultság miatt nem működött. |

### Javasolt módosítás a két feladatban (október 29., Levente dönt, még nincs átállítva)
Egy gyűjtő, egy időpont: új címet csak a 10:00-s címgyűjtő gyűjt, és csak ő írja a `lastRun`-t.

**3D - Napi kör (értesítéssel):** a 3. és 4. pont helyére:
> 3. Új címet nem gyűjtesz: azt a hétköznap 10:00-kor futó címgyűjtő végzi. A settings/search dokumentumba ne írj.

**3D - Címgyűjtő (150 km, böngészős):**
- 0. pont: a cylex.hu és az aranyoldalak.hu tesztet hagyd el (403-at adnak), csak a Google Térkép-tesztet tartsd meg.
- 2. pont helyére: „Települések és kulcsszavak: a plan.targets kereséseit végezd sorban (a pult a válaszarány szerint súlyozza, és belülről kifelé járja be a plan.cities területét). Ha elfogytak, és még kell cím, jöhet a plan.fallback.targets.”
- 3. pont helyére: „Cégnevek: Google Térkép listanézet a q kifejezéssel (<kulcsszó> <város>), minden céget nézz végig.” A kulcsszólista és a cylex/aranyoldalak említése kimarad.
- 8. pont helyére: „A végén update-tel, csak a lastRun mezőt írd: {date, time, by: "címgyűjtő", found, fallbackUsed, empty, errors, note}. A plan és az updated mezőhöz ne nyúlj.”

A napi rutin szabályai a **levente3d-kampany** skillben vannak (`skill/levente3d-kampany/SKILL.md`, és ZIP-ben `skill/levente3d-kampany.zip`). A skill módosítása után a ZIP-et kézzel kell feltölteni a claude.ai-on: Beállítások → Skills. Előbb töröld a régit, utána töltsd fel az újat.

## 11. Fejlesztés
- **Közös szerkesztés:** a pultot a claude.ai projekt és a Claude Code is módosítja. Mielőtt bármit változtatsz, **mindig az élő változatot olvasd be** (`Artifact read`), és arra építs. A szolgáltatás elutasítja azt a publikálást, ami nem a legfrissebb változatra épül.
- **Publikálás előtt:**
  - nézd meg, nincs-e `kuld` állapotú tétel a `sendqueue`-ban, mert a publikálás újratölti a nyitott lapokat, és megszakítja a küldést;
  - a `capabilities` mezőt ne add meg, így a meglévő jogosultságok maradnak.
- **Tesztelés:**
  - helyi másolaton, hamis `window.claude`-dal (mock adatbázis és Gmail), Playwright-tal;
  - telefon (390 px) és laptop (1366 px) méretben, világos és sötét témában;
  - 0 JavaScript-hiba és vízszintes görgetés nélkül;
  - **tesztben soha nem megy ki levél**;
  - a valódi címeket tartalmazó tesztadat csak a munkamappában lehet, a repóba és a publikálásba nem kerülhet.
- **Stílus:** magyar feliratok, a meglévő `save()`, `toast()`, `renderAll()` függvények, rövid mondatok, legalább 44 px-es érintési felületek mobilon.

## 12. Változásnapló (október)
| Dátum | Változás |
|---|---|
| 10. 22. | Az e-mail és a DM számlálói külön (a 0 kiküldendő a DM-ek mellett félrevezető volt). Fókusz mód a keresési tervben, Szeged + 50 km. |
| 10. 23. | Tiltólista kulcsszavakkal (Future Visuals, N-System); minden küldő gomb tiltva. Új felsorolás a reklám-dekor és az építész sablonban. |
| 10. 26. | Follow-up csak az új Gmail-címről küldött levelekhez. Csatornánkénti teendő-jelvények, „Itt vár munka” sáv, nagyobb gombok. |
| 10. 27–28. | Instagram és Facebook külön csoport, új kategóriák (jóga, tánc, fitnesz, terápia, ügyvéd, szabadulószoba). Küldési sor; a háttérküldő helyett oldalról küldés folytatással. |
| 10. 28. | UX-átnézés: „Mind kijelölése (N)”, sorállapotok, „Küldés bizonytalan” gombokkal, 44 px-es érintési felületek, megerősítés a sor elvetéséhez. Napi korlát 60 → 100. A „Ma elküldve” kártya a korláthoz mér. |
| 10. 29. | Címkészlet-kártya (60-as cél, heti 50 új), gyors jóváhagyás a Javaslatok szűrőben (duplikáció-figyelés, elvetési ok, megerősített „Mind jóváhagyása”), `settings/summary` frissítése a pultból. |
| 10. 29. | Keresési terv a válaszarány szerint súlyozva, terület km-ben (50/100/150), a pult csak a `plan` mezőt írja, jóga/tánc/fitnesz/terápia kimarad, „Kategóriák eredménye” kártya. |
| 10. 29. | **Érvénytelen** szűrő a pótlás nélküli visszapattanókhoz: új e-mail, DM, Google-keresés, lezárás ([ERVENYTELEN.md](ERVENYTELEN.md)). |
