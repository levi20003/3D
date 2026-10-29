# „Érvénytelen” címek a kampánypultban

Bevezetve: 2026. október 29.

## Mit csinál
A visszapattant e-mail címek, amelyekhez a napi rutin nem talált pótlást, nem tűnnek el a „Lezárva” állapotban. A **Címlista → E-mail → Érvénytelen** szűrőben jelennek meg, kiemelt (keretes) jelvénnyel és darabszámmal. Minden sor alatt mindig látható egy panel:

| Gomb | Mit csinál |
|---|---|
| **Új e-mail mentése** | Új rekordot hoz létre ugyanazzal a névvel, kategóriával, várossal és hookkal, `status: "uj"` (a Kiküldendők közé kerül). A régi rekord `replacedBy` és `replaceDone: true` mezőt kap, és eltűnik a szűrőből. |
| **Átteszem DM-be** | A megadott Instagram- vagy Facebook-linkből DM-rekordot hoz létre (`dm-<név>-<város>`, `channel: "dm"`, `ig` vagy `fb`), és a megfelelő csatornán jelenik meg. A régi rekordba `replacedBy` kerül. |
| **Keresés Google-ben** | Új lapon megnyitja a „cégnév + város + e-mail kapcsolat” keresést. |
| **Nincs más, lezárom** | `invalidDone: true`, `status: "lezarva"`, a megjegyzés végére „Nincs más elérhetősége.” |

## Szabályok
- **Érvénytelen** = `bounced === true`, nincs `replacedBy` és nincs `invalidDone` (`isInv`). Ezek csak ebben a szűrőben látszanak, a többi nézetben nem duplázódnak.
- **Ellenőrzések az új e-mailnél:**
  - formátum;
  - nem egyezhet a visszapattant címmel;
  - nem szerepelhet már a címlistán;
  - **tiltólista**: domain, cím és kulcsszó.
- **Ellenőrzések a DM-nél:**
  - kötelező a `https://` link, és Instagram- vagy Facebook-linknek kell lennie;
  - a `dm-` azonosító még nem foglalt;
  - a cég nincs tiltólistán.
- **Sorrend:** előbb az új rekord íródik. Ha ez nem sikerül, a változás visszaáll, és a régi rekord érintetlen marad.
- A válaszarányt és a statisztikákat nem érinti, mert ezek eddig is kihagyták a `bounced` rekordokat.

## Napi rutin
A skill (`skill/levente3d-kampany/SKILL.md`, és a projektben `05_skill_levente3d-kampany.md`) mostantól ezt kéri: ha a rutin nem talál pótlást, ne zárja le véglegesen. Csak `replaceDone: true` kerüljön a rekordba, `replacedBy` és `invalidDone` nélkül, a megjegyzés végére pedig: „Nincs más elérhetősége, kézi ellenőrzés kell.”

A „3D - Napi kör (értesítéssel)” ütemezett feladat szövegét innen nem lehetett módosítani (az ilyen feladatot csak törléssel és újralétrehozással lehet átírni). A jelenlegi szövege sem ír `invalidDone`-t, így a pótlás nélküli visszapattanók maguktól megjelennek az „Érvénytelen” szűrőben. Ha mégis frissíteni szeretnéd, az 1. pontot ezzel cseréld:

> Visszapattanók: Gmail from:mailer-daemon newer_than:2d. A nem létező címeket jelöld meg (status lezarva, bounced: true, bouncedAt, ok a note-ban), és keress nekik másik e-mailt a cég saját oldalán; ha nincs, DM-rekord Instagram/Facebook alapján. Ha semmilyen pótlást nem találsz, ne zárd le véglegesen: replaceDone: true, replacedBy és invalidDone nélkül, a note végére „Nincs más elérhetősége, kézi ellenőrzés kell.” Az invalidDone: true rekordokhoz ne nyúlj.

## Teszt (2026. 10. 29.)
Playwright, helyi tesztadatokkal, levél- és DM-küldés nélkül, telefonos nézetben (390 px):
- **Szűrők:** az „Érvénytelen” 3-at számolt (két pótlás nélküli visszapattanó és egy „nincs más elérhetősége”). A pótolt visszapattanó a „Lezárva” alatt maradt.
- **Elutasított mentések:** a tiltólistás domain (`info@tiltott.hu`) és a már meglévő cím mentését is elutasította, egyik sem írt az adatbázisba.
- **Új e-mail:** `info@jocim.hu` mentése: az új rekord `uj` állapotban a Kiküldendők között, a régi `replacedBy`-t kapott.
- **Átrakás DM-be:** Instagram-link után új `dm-rossz-ketto-bt-mako` rekord az Instagram csoportban.
- **Lezárás:** a lezárt cím kikerült a szűrőből. Ha nem marad érvénytelen cím, maga a szűrő is eltűnik.
- **Megjelenés:** nincs vízszintes görgetés, nincs JavaScript-hiba. A teljes fülvégigjárás (390 és 1366 px, világos és sötét téma) is hiba nélkül ment.
