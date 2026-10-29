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
- **Kiküldendő** és **Follow-up esedékes:** az összes csatorna együtt, alatta bontás, például „E-mail 18 · Instagram 29”.
- **Ma elküldve:** a mai darabszám. Alatta: „cél 30 · még X mehet (napi 100)”. A sáv a napi korláthoz mér.

### Sorállapotok küldéskor
| Jelvény | Jelentés |
|---|---|
| Küldésre vár | Sorban van, nem küldhető újra |
| Épp most megy ki | Küldés alatt |
| Ellenőrzésre vár | A küldés megszakadt (15 percnél régebben). Folytatáskor a Gmail Elküldött mappája dönt, hogy kell-e még küldeni. |
| Küldés bizonytalan | A Gmail nem jelezte vissza, elment-e. Döntsd el az „Elment” vagy „Nem ment el” gombbal; addig nem küldhető. |

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
- **Terület:** Szeged + 50 km, 19 település. A keresés oda megy, ahol a lakossághoz képest kevés a cím.
- **Fókusz** („Partnerek”): nyomda, reklám-dekor, építész-belsőépítész, lakberendezés, gyártás. Kategóriánként naponta két kulcsszó-város pár.
- **Tartalék:** fókusz módban ugyanezek a kategóriák Szegeden, más kulcsszóval; fókusz nélkül szegedi vendéglátóhelyek.
- **Mentés:** a pult minden betöltéskor újraszámolja és elmenti a tervet. A kézzel írt célokat ezért felülírja, kategóriát a Fókusz gombokkal adj hozzá.
- **Visszajelzés:** a napi rutin a végén a `lastRun` mezőbe írja az eredményt, ez a „Keresési terv” kártya alján látszik.

## 9. Adatmodell (`window.claude.use("db")`)
| Gyűjtemény / dokumentum | Tartalom |
|---|---|
| `contacts/{doc_id}` | doc_id: kisbetűs e-mail, DM-nél `dm-<név>-<város>`. Fő mezők: `email`, `name`, `cat` (`catLabel`), `city`, `hook`, `note`, `source`, `status`, `sentAt`, `followupAt`, `followup2At`, `threadId`, `acct`, `channel` (`dm`), `ig`/`fb`, `dmVia`, `bounced`, `bouncedAt`, `replaceDone`, `replacedBy`, `replaces`, `invalidDone`, `sendUnsure`, `approvedAt` |
| `sendqueue/{id}` | id: `uj-<email>` vagy `fu1-`/`fu2-<email>`. Mezők: `email`, `name`, `kind`, `stage`, `args {to, subject, body, replyThreadId?}`, `patch` (benne `"{MA}"` = küldés napja), `state` (`var`, `kuld`, `kesz`, `kihagyva`, `hiba`, `megszakitva`), `queuedAt`, `claimedAt`, `sentAt`, `error` |
| `templates/{kulcs}` | A Sablonok fülön módosított levelek (a beépített alapokat írják felül) |
| `orders`, `ledger`, `todos` | Rendelések, bevétel és kiadás, növekedési lépések |
| `settings/main` | `goal` (napi cél, 30), `fuDays`, `fu2Days`, `sig`, `link`, `area`, `focus`, `perRun`, `searchSkip`, `goals`, `rates`, `fuSince` |
| `settings/search` | `plan` (`targets`, `fallback`, `rules`, `focus`, `cities`), `updated`, `lastRun` |
| `settings/blocklist` | `domains`, `emails`, `keywords`, `rule` |
| `settings/senderlock` | Küldési zár (`acquire`, 90 másodperces bérlet) |

A pult jogosultságai: `db`, `downloads`, valamint `mcp` (Gmail: `send_message`, `search_threads`).

## 10. Automatizmusok
| Ütemezett feladat | Mikor | Mit csinál |
|---|---|---|
| **3D - Napi kör (értesítéssel)** | Hétköznap 7:25 | Visszapattanók rendezése, válaszok jelölése, új címek gyűjtése a terv szerint, értesítés csak újdonságnál. Levelet nem küld. |
| **Heti mérföldkő-frissítés** | Vasárnap 18:35 | Heti számok a mérföldkő-tervbe. |
| 3D - Ütemezés | **kikapcsolva** | A napi kör régi változata. |
| 3D - Háttérküldő (pult sor) | **kikapcsolva** | Szerveroldali küldő; a jogosultság miatt nem működött. |

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
| 10. 29. | **Érvénytelen** szűrő a pótlás nélküli visszapattanókhoz: új e-mail, DM, Google-keresés, lezárás ([ERVENYTELEN.md](ERVENYTELEN.md)). |
