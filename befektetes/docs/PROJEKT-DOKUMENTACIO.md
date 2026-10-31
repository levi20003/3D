# Portfolio Lens (Befektetés) – projektdokumentáció

Állapot: **2026. október 29.** · Készítő: Paulik Levente · Fejlesztés: Claude Code-dal, egyetlen összefüggő munkamenetben, 2026. október 21–23. között (31 commit a repóban, ebből 21 ehhez a projekthez, a többi a korábbi, független Levente 3D anyag).

> **Adatvédelmi megjegyzés:** a repó **nyilvános**. Ebben a dokumentumban és a kódban nincs valódi számlaszám, kivonat, egyenleg vagy API-kulcs. A valódi adatok csak a készüléken vannak.

---

## 1. Összefoglaló egy bekezdésben

A projekt egy **telepíthető, kétnyelvű (magyar/angol) portfóliókövető webalkalmazás (PWA)**, amely a felhasználó bróker-kivonataiból (Lightyear PDF, valamint Trading 212 / Revolut / Interactive Brokers / bármilyen CSV) **egyetlen, részvényszerűen ábrázolt portfóliót** épít, élő árfolyamokkal, S&P 500-összevetéssel, elemzésekkel, TBSZ-nézettel, naptárral és megosztható kártyákkal. **Nincs szerver, nincs fiók: minden adat a telefonon marad.** A cél egy globálisan terjeszthető, márkaépítésre alkalmas app (Google Play + web), amelynek lényege a **vizualizáció**, nem a részvénykeresés.

| | |
|---|---|
| Magyar név | Befektetés |
| Globális márkanév | **Portfolio Lens** |
| Élő app | https://levi20003.github.io/3D/befektetes/ |
| Demó (valódi adat nélkül) | …/befektetes/?demo=1 |
| Weboldal | https://levi20003.github.io/3D/portfolio-lens/ |
| Adatvédelmi tájékoztató | …/portfolio-lens/privacy.html |
| Ág (branch) | `claude/lightyear-accounts-visualization-qdki29` |
| Saját kód mérete | ≈ 2 800 sor (app.js 1 564, index.html 517, i18n-en.js 209, csv.js 164, engine.js 134, parser.js 94, i18n.js 51, demo.js 43, sw.js 15) |

---

## 2. Idővonal: a nullától idáig

| Dátum | Mérföldkő |
|---|---|
| **okt. 21.** | Kiinduló kérés: két Lightyear TBSZ-kivonat (PDF) vizualizálása, elemző oldalak, a ~1–2 dolláros apró ügyletek kizárása a nyertes/vesztes listákból. Kérdéslista és válaszok után az igények bővültek: egy portfólió, élő árfolyamok, S&P-összevetés, világos/sötét mód, appként telepíthetőség. |
| okt. 21. | **Biztonsági fordulat:** a számadatokat tartalmazó HTML-t a nyilvános repóba tölteni nem lehetett/szabadott. Átálltunk **kód-only PWA-ra**, ahol az adatok csak a készüléken vannak. A `lightyear/` mappa a helyi `.git/info/exclude`-ban van. |
| okt. 21. | **Motor:** PDF-értelmező, átlagár-alapú realizált eredmény, napi főkönyv, „portfólió egy részvényként” (TWR-index), deviza-átváltás (EKB), Twelve Data árak. |
| okt. 21. | **Dizájn-iterációk:** minimál → Bitpanda-szerű interaktív → **zöld fintech** téma; sima (monoton köbös) grafikon, hőtérkép (Mind/YTD/Mai), eszközkártyák, fánkdiagram, alsó navigáció középső gombbal. |
| okt. 21. | TBSZ-nézet, riasztások, szektor/ország bontás, vétel/eladás jelölők, **naptár** (gyorsjelentések, hírek – Finnhub). Diagnosztika és „miért nincs adat” magyarázatok. Y-tengely $/Ft-ban. |
| **okt. 22.** | **Kézi tranzakciók** és **biztonsági mentés/visszaállítás**. **Angol verzió** (Portfolio Lens), nyelvfelismerés. **Megosztható kártyák**, **CSV-import** (4 bróker + térképező varázsló), **Portfolio Wrapped**. |
| okt. 22. | **Demó mód**, márkaikon, store-anyagok (képernyőképek, kiemelt grafika), **weboldal + adatvédelmi tájékoztató**, Play Store-útmutató, tesztelőtoborzó posztok. Különálló React/Tailwind minta-dashboard (nem része az appnak). |
| okt. 22–23. | **Üzemeltetési hibajavítások:** Twelve Data keretkezelés, beépített frissítés-értesítő, szkrollzár a lapok mögött, **mentés minden letöltési kör után**, sorba állítás kerethiba esetén, sűrű grafikon egyenes szakaszokkal, kompakt ár-kapszula a grafikonon. |
| okt. 29. | Ez a dokumentáció. |

---

## 3. Termék: mit tud az app

### 3.1 Fő képernyők (alsó navigáció: Kezdőlap · Portfólió · [Gyors műveletek] · Elemzés · Naptár; Napló a Több menüből)

* **Kezdőlap** – nagy „portfólió mint egy részvény” grafikon, időszakok (1 hét, 1 hó, 3 hó, 6 hó, YTD, 1 év, Mind), **Árfolyam / Érték** váltó, S&P 500 kapcsoló, számláló-animált egyenleg, százalék és összeg változás, érintésre követő kurzor és kapszula, gyors műveletek (Kivonat, Frissítés, Rögzítés, Több), TBSZ-kártya, tippkártyák (élő árak, mentés, demó).
* **Portfólió** – birtokolt részvények színes kártyákon, rendezés érték/eredmény/nap szerint, sparkline-ok, nyertes/vesztes, allokáció (fánk + sáv), szektor/ország bontás, hőtérkép.
* **Elemzés** – alfülek: Trend, Eredmény (nyertesek/vesztesek, apró ügyletek kizárása küszöbbel), **S&P 500** (befizetésenkénti „mit hozott volna ugyanez a pénz SPY-ban”), Költség (díjak, devizaköltség, forrásadó, osztalék).
* **Naptár** – gyorsjelentések és céghírek a birtokolt részvényekre.
* **Napló** – összes tranzakció, szűrés típus és keresés szerint, kézi tételek szerkesztése.
* **Részvény-lap (alsó lap)** – saját árfolyamgrafikon vétel/eladás jelölőkkel, átlagár-vonal, realizált/nem realizált/osztalék bontás.

### 3.2 Különleges funkciók

| Funkció | Lényeg |
|---|---|
| Portfólió egy részvényként | **Idősúlyozott (TWR) egységár-index**: a befizetések nem emelik a görbét, így a valódi teljesítmény látszik. „Érték” módban a számla teljes értéke (befizetésekkel) – ez a bróker MAX-grafikonjának megfelelője. |
| S&P 500 összevetés | Ugyanaz a pénz, ugyanazokon a napokon SPY-ban. Tartalék-lánc: SPY → VOO → IVV → SPX. |
| TBSZ | Gyűjtőév, 3 éves lekötés, 5 év utáni adómentesség határidők; kézi tételek hatásával. |
| Riasztások | Napi mozgás küszöb, ár fölött/alatt; értesítési napló. |
| Kézi tranzakciók | Vétel, eladás, osztalék, befizetés; a Lightyear-díj becslése (max(0,10 USD; 0,1%)); figyelmeztetés a túl-eladásra; a később betöltött hivatalos kivonat felülírja az átfedő kézi tételeket. |
| Mentés/visszaállítás | Egy JSON-fájl, opcionálisan árfolyam-előzménnyel és API-kulcsokkal (alapból **kulcs nélkül**). |
| Megosztható kártyák | 1080×1350 és 1080×1920, alapból **csak százalék**, összeg nélkül; Web Share vagy letöltés. |
| Portfolio Wrapped | Story-szerű, automatikusan lapozó összefoglaló (csillag, legjobb nap, díjak, személyiségtípus). |
| Demó mód | Kitalált, magyar/angol nyelven is működő minta-portfólió; csak a memóriában él, a valódi adatot nem írja felül. |
| Beépített frissítés | `version.json` figyelés: új verziónál „Frissítés” sáv, a régi gyorsítótár törlésével. |
| Diagnosztika | Beállítások → „Adatforrások állapota”: kulcs, EKB, Twelve Data, Finnhub, S&P tesztje, hibaüzenetekkel. |

---

## 4. Technikai architektúra

### 4.1 Alapelvek
1. **Zéró backend.** Statikus fájlok a GitHub Pages-en; az adatok `localStorage`-ban.
2. **Függőségek minimálisan:** futásidőben csak **pdf.js 3.11.174** (PDF-hez, igény szerint töltve) és **Chart.js 4.4.1** (oszlopdiagramokhoz) a cdnjs-ről; a fő grafikon, fánk, sparkline, kártyák **saját canvas-kód**. Betűtípus: Plus Jakarta Sans (Google Fonts).
3. **Offline-first:** service worker; a héj gyorsítótárból indul.
4. **Adat és megjelenítés szétválasztva:** `parser/csv` → `engine` → `app` (nézetek).

### 4.2 Fájltérkép (`befektetes/`)

| Fájl | Feladat |
|---|---|
| `index.html` | Héj + teljes CSS (témák: világos/sötét tokenek, komponensek), betöltési sorrend: i18n → i18n-en → parser → csv → engine → demo → app. |
| `app.js` | UI, állapot, nézetek, canvas-grafikonok, lapok, frissítés, mentés, megosztás, Wrapped, riasztások, frissítés-ellenőrző. |
| `engine.js` | A számítási mag (lásd 4.3). |
| `parser.js` | Magyar nyelvű Lightyear-PDF értelmező (`LYParser`). |
| `csv.js` | CSV-felismerés, presetek, térképező, pszeudo-kivonat építés (`CSVImport`). |
| `demo.js` | Szintetikus portfólió generátor, rögzített mag (seed) → bármely napon ugyanolyan alakú. |
| `i18n.js`, `i18n-en.js` | Fordítási réteg és angol szótár. |
| `sw.js` | Service worker (jelenleg `befektetes-v21`). |
| `version.json` | Kiadási verzió az értesítőhöz (jelenleg `2026.10.23e`). |
| `manifest*.webmanifest` | HU/EN PWA-leírók, ikonok (any, maskable), képernyőképek, kategória. |
| `store/` | Play-anyagok, útmutató, tesztelőposztok. |
| `docs/` | Ez a dokumentáció. |

Repo-gyökér, a projekten kívül: `portfolio-lens/` (weboldal), `portfolio-dashboard/` (különálló React-minta), valamint a korábbi, **független** Levente 3D anyagok (`web/`, `dashboard/`, `nevjegy/`).

### 4.3 A számítási motor (`engine.js`)

* **Bemenet:** kivonatok listája (egy kivonat = számla + sorok + készpénz + nevek), piaci adatok (előzmények, devizák).
* **Sortípusok:** `B` vétel, `S` eladás, `D` osztalék, `DEP` befizetés, `WD` kivét, `FX` átváltás, `INT` kamat, `FEE` díj, `SPLIT` részvényosztás.
* **Realizált eredmény:** **átlagár** módszer számlánként; a hozam- és díjszámítás USD-ben.
* **Deviza:** általános átváltás EKB-adatokkal (USD-bázis); GBX kezelése; a befizetéseknél a **tényleges átváltási pár árfolyama**, nem a napi (korábbi hiba javítva).
* **Napi főkönyv:** minden napra darabszám, készpénz, érték → `series` (érték, befizetett, **nav**, SPY-index és SPY-érték).
* **TWR/nav:** egységár-index a pénzmozgások kiszűrésével.
* **Hiányzó előzmény:** árak **interpolálása** a tranzakciós árak között, hogy ne legyen blokkos a görbe.
* **Kimenet:** `positions`, `closed`, `divs`, `fees`, `flows`, `series`, `T` (részvényenkénti összesítés), `dayChange`, `value`, `result`, stb.
* **Ellenőrzés:** a magyar PDF-ekből 89 tranzakciót a kézzel ellenőrzött adattal **tételről tételre egyezően** olvasott be; az app értéke ≈ a bróker értékével (eltérés < 0,1 USD a kerekítés/árfrissesség miatt); a készpénz egyezik.

### 4.4 Importálás

* **Lightyear PDF** (`parser.js`): pdf.js szövegelemek y-koordináta szerinti sorokba csoportosítva, majd a magyar kivonat sorainak értelmezése.
* **CSV** (`csv.js`): automatikus felismerés fejléc-aláírással; presetek: **Trading 212, Revolut, Lightyear CSV, Interactive Brokers** (többszekciós). Ismeretlen formátumnál **oszlop-térképező varázsló**, a leképezést a fejléc-aláírás szerint megjegyzi. A Lightyear-CSV és az IBKR eredménye a szintetikus teszteken egyezett a PDF-fel (pl. realizált eredmény).
* **Egyesítés:** `mergeStatement` az azonos számla érintett időszakát **lecseréli** (nincs duplikáció), a lefedett kézi tételeket eltávolítja.

### 4.5 Élő adatok

| Forrás | Mire | Megjegyzés |
|---|---|---|
| **Twelve Data** `time_series` | Napi záróárak, S&P | Saját kulcs; ingyenes keret **8 kredit/perc, 800/nap**. |
| **Frankfurter (EKB)** | Devizák: HUF, EUR, GBP, CHF, PLN, CZK, SEK, NOK, DKK, RON | Kulcs nélkül. |
| **Finnhub** | Gyorsjelentés-naptár, céghírek | Saját kulcs, csak a Naptárhoz. |

**Letöltési logika (`fetchPrices`)** – a termék legérzékenyebb része:
1. Nyolcas kötegek, `waitCredits` korlátozó a percenkénti 8-hoz.
2. Prioritás: **S&P, majd a legnagyobb nyitott pozíciók**.
3. **Mentés minden kör után** (megszakított letöltés sem veszik el).
4. A kerethibás részvény **sorba áll újra** (legfeljebb 3×), nem lesz „hibás”.
5. **Napi keret** elfogyása → `tdBlock` éjfél (UTC) utánig, érthető üzenet.
6. Zárt tőzsde mellett csak az kerül lekérésre, aminek hiányzik az utolsó záróára; nyitva 15 percenként.
7. Ami nem jön le, 6 óránként próbálható újra.
8. Maradékot **egy perc múlva** magától tölti.
9. Frissítés: induláskor, 15 percenként, láthatóvá váláskor, lehúzásra, online eseményre.

### 4.6 Grafikon (`stockChart`)

* Saját canvas; **≤ 40 pontnál monoton köbös simítás** (Fritsch–Carlson), **> 40 pontnál egyenes szakaszok** (a bróker-appokhoz hasonló, „élő” alak).
* Értéktengely pénzben (szép lépésközzel), kiemelt végponti címke, kurzor + dátumkapszula, **tömör ár-kapszula** érintésre, rajzolódó animáció, csúcs/mélypont jelölés, vétel/eladás jelölők, átlagár-vonal.
* „Árfolyam” módban a skála a mai értékre kalibrált (a befizetések nem torzítanak).

### 4.7 Navigáció és UX

* Android **vissza gomb**: history API (`pushState`/`popstate`), a lapok zárása előbb, majd lap-váltás.
* **Lehúzással frissítés**, oldalbetöltő animációk, haptika, szkrollzár a lapok mögött, biztonságos képernyőterületek (safe-area).
* Hozzáférhetőség: ARIA-szerepkörök, fókuszkezelés, `prefers-reduced-motion`, érintésbarát méretek.

### 4.8 Többnyelvűség

* Magyar a forrásnyelv; az angol **szótár + reguláris kifejezések + kifejezések** a DOM-szövegcsomópontokra és attribútumokra (MutationObserver), a kódban `t(hu, en)`.
* Nyelv: `navigator` szerint (hu → magyar, egyéb → angol), kézzel váltható, `?lang=` paraméterrel is.
* Számok, dátumok, hónapnevek lokalizálva; második pénznem régió szerint (HU→Ft, GB→£, CH→CHF, PL→zł stb.).
* Érvénytelen nyelvi kód (pl. `en-US@posix`) összeomlását javítottuk.
* A szótár lefedettségét **gyűjtő-szkripttel** (hiányzó fordítások listája) ellenőriztük.

### 4.9 Biztonság és adatvédelem (műszaki)

* Adatok csak `localStorage`-ban; nincs analitika, nincs követő szkript, nincs hirdetés.
* A hálózati kérések **csak tickereket, dátumot, devizakódot és a felhasználó saját API-kulcsát** tartalmazzák – összeg, darabszám, számlaszám soha.
* Az API-kulcsok a mentésbe csak kérésre kerülnek.
* A kulcs egy korábbi képernyőképen látszott; a kulcsot **soha nem írtuk repóba**. *Javaslat: a látott kulcsot cseréld le a Twelve Data fiókban.*
* A megosztó kártyák alapból összegek nélküliek.
* A kivonatot a készülék olvassa; az eredeti fájlt az app nem őrzi.
* Kockázat: a `localStorage` böngészőadat-törléskor elvész → emiatt van a mentés-emlékeztető és a visszaállítás.

### 4.10 Tesztelés és minőségbiztosítás

* **Playwright** (headless Chromium) szkriptek a fejlesztési munkamenetben: nézetek screenshotjai, érintés/görgetés/vissza-navigáció, EN/HU, sötét/világos, mentés-visszaállítás, CSV-varázsló, Wrapped, megosztó kártyák, demó mód, frissítés-értesítő, szkrollzár.
* Hálózat-mockolás: a Twelve Data/EKB/Finnhub válaszait szimuláltuk, köztük **kerethiba-forgatókönyveket** (percenkénti/napi) és üres előzményt (22 részvény).
* Szintetikus CSV-minták (T212, Revolut, Lightyear, IBKR) a feldolgozás egyezésének ellenőrzésére.
* **Nincs** automatizált CI és egységteszt-csomag a repóban (a szkriptek a munkamenet-szkratchpadben voltak). → Roadmap.

---

## 5. Üzemeltetés és IT

### 5.1 Hosting és kiadás

* **GitHub Pages** az ágból, gyökérből szolgálja ki a `befektetes/` és `portfolio-lens/` mappát. Ingyenes, HTTPS, CDN.
* **Kiadási lépések:** módosítás → `APP_VERSION` (app.js) és `version.json` közös emelése → `sw.js` gyorsítótár-név emelése (jelenleg v21) → commit/push → a Pages pár perc alatt frissül.
* **Felhasználói oldali frissülés:** az app induláskor, láthatóvá váláskor és 30 percenként ellenőrzi a `version.json`-t; eltérés esetén a „Frissítés” sáv törli a gyorsítótárat és újratölt. A service worker saját fájlokat `no-cache`-sel ellenőrzi. A `version.json`, Twelve Data, Frankfurter és Finnhub kéréseit az SW nem gyorsítótárazza.
* **Verziókezelés:** egy fejlesztői ág, beszédes commitok, Co-Authored-By trailer a Claude-szakaszokhoz.

### 5.2 Műszaki adósság és ismert korlátok

| Téma | Állapot |
|---|---|
| **Angol nyelvű Lightyear-PDF** | Nincs támogatva (csak magyar). Minta kell. |
| **Valódi CSV-minták** | A T212/Revolut/IBKR import csak szintetikus mintán tesztelt; valódi exporttal próbálni kell. |
| **Twelve Data ingyenes keret** | Egy teljes első letöltés ~22 részvényre kb. 3 perc; a felhasználói élmény miatt érdemes lenne gyorsítótárazó/proxy szolgáltatásra gondolni (lásd roadmap). |
| **Napon belüli grafikon** | Nincs; csak napi záróár. A Lightyear is naponta egy pontot rajzol a MAX nézetben; 1 napos/1 hetes nézethez intraday adat kellene. |
| **Egyetlen nagy `app.js`** | ~1 560 sor; modulokra bontás és build-lépés (pl. Vite) hosszabb távon. |
| **Tesztek** | Nincs repóba mentett automata teszt. |
| **iOS** | Működik Safariból „Főképernyőhöz adás”-sal; natív app nincs, értesítések (push) nincsenek. |
| **Riasztások** | Csak megnyitott/látható appnál fut a kiértékelés (nincs háttér-push). |
| **Különálló React-minta** (`portfolio-dashboard/`) | Nem része az appnak; Finnhub REST + WebSocket demó. |
| **Adóvonal** | A TBSZ-szabályok egyszerűsítettek, nem adótanácsadás. |

### 5.3 Fontos tanulságok / hibatörténet (RCA röviden)

* **Blokkos grafikon:** hiányzó előzményeknél interpolálás + monoton görbe; később sűrű adatnál egyenes szakasz.
* **CSS-névütközések** (`.tm`, `.av`, `.bar`): átnevezés, a `.bar` miatt a fejléc összeesett asztali nézetben.
* **Twelve Data 429:** 12 szimbólum / 8 kredit → inkrementális frissítés; később napi vs. percenkénti keret szétválasztása; **a legsúlyosabb hiba:** a letöltött árak csak a végén mentődtek, így megszakításnál mindig nulláról indult (javítva: kötegenkénti mentés, sorba állítás).
* **Szkroll a lapok mögött:** `html.lock` + `overscroll-behavior`.
* **Régi verzió a telefonon:** SW cache és Pages-gyorsítótár → beépített frissítés-értesítő.
* **Nyelvi kód összeomlás:** `en-US@posix` normalizálása.

---

## 6. Google Play-terv (TWA)

Részletes lépések: `befektetes/store/PLAY-STORE.md`. Összefoglalva:

1. **Fejlesztői fiók:** egyszeri 25 USD; személyes fióknál **zárt teszt legalább 12 tesztelővel, legalább 14 napig**, utána élesítés.
2. **Csomag:** PWABuilder → Android (TWA), csomagnév pl. `app.portfoliolens.twa` (később nem módosítható), **aláíró kulcs biztonságos helyre, nem a GitHubra**.
3. **Digital Asset Links:** `/.well-known/assetlinks.json` a **domain gyökerében**. A jelenlegi `levi20003.github.io/3D/…` cím alatt ez nem teljesíthető → vagy `levi20003.github.io` nevű repó, vagy (ajánlott márkaépítéshez) saját domain (pl. `portfoliolens.app`).
4. **Console kitöltés:** adatvédelmi URL, „nincs hirdetés”, célközönség 18+, adatbiztonság „nem gyűjt adatot”, pénzügyi funkciók nyilatkozata (nem nyújt pénzügyi szolgáltatást, csak a saját adatot jeleníti meg).
5. **Anyagok kész:** ikon 512, kiemelt grafika (EN/HU), 5–5 telefonos képernyőkép felirattal, rövid és hosszú leírás EN/HU.
6. **Kiadási fázisok:** belső teszt → zárt teszt (12+ fő, 14 nap) → éles hozzáférés kérése → élő.
7. Frissítés: az app tartalma a weboldalról magától frissül; új `.aab` csak ikon/név/csomagbeállítás változásakor kell.

**Állapot:** a fejlesztői fiók, a domain és az aláíró kulcs **még nincs meg** (ez a te teendőd).

---

## 7. Marketing és márkaépítés

### 7.1 Pozicionálás
* **Ígéret:** „Lásd, mi történt valójában a pénzeddel.” / „Your portfolio, in focus.”
* **Különbség a tipikus portfóliókövetőktől:** nincs fiók, nincs szerver, nincs bróker-összekapcsolás → **bizalom és adatvédelem mint fő érv**; vizualizáció-központú (nem részvénykereső, nem tőzsdei app); **őszinte S&P-összevetés** és a **rejtett költségek** (díj, deviza, forrásadó) kiemelése.
* **Elsődleges célcsoport:** magyar és közép-európai, kisebb összegekkel dolgozó, mobil-első brókerfelhasználók (Lightyear, Trading 212, Revolut, IBKR), akik TBSZ-t vagy index-vs-válogatás kérdést követnek.
* **Másodlagos:** angol nyelvű globális önálló befektetők (r/eupersonalfinance, r/trading212, r/SideProject közönség).

### 7.2 Márka
* **Portfolio Lens** – nagyító + emelkedő görbe ikon; arculat: krém/erdőzöld, mentazöld kiemelés, Plus Jakarta Sans.
* Hangnem: nyugodt, tiszta, tényszerű; nincs „tipp”, nincs ígéret hozamra.

### 7.3 Terjesztési mechanikák (beépítve a termékbe)
1. **Portfolio Wrapped** – évzáró „Spotify Wrapped”-hatás, a legjobb csatorna a vírusos terjedéshez.
2. **Megosztható kártyák** – alapból csak százalék (biztonságos megosztás), márkajellel (Portfolio Lens).
3. **Demó mód + `?demo=1` link** – kockázatmentes kipróbálás, közösségi posztokban és Google-bírálóknak is.
4. **Kétnyelvű landing oldal**, OG-képpel; adatvédelmi oldal.
5. **ASO-alapok (Play):** a név + rövid leírás a „portfolio tracker”, „S&P 500”, „Lightyear”, „TBSZ”, „Trading 212” kulcsszavakra optimalizálva; képernyőképek kiemelt felirattal.

### 7.4 Elkészült marketing-anyagok
* Weboldal (hero, funkciók, galéria, adatvédelmi szekció, 3 lépéses útmutató, GYIK, záró CTA).
* `store/TESZTELOK-POSZTOK.md`: tesztelőcsere (r/AndroidClosedTesting, r/TestersCommunity), r/SideProject, pénzügyi subredditek, magyar csoportok, rövid közösségi posztok, DM-sablonok.
* Play-szövegek EN/HU.

### 7.4b Automatizált Instagram-tartalom (okt. 31.)
* **`social/`**: tartalomgyár: 15 poszt (HU/EN), számolt példákkal, az app demó képernyőivel; 1080×1350 JPEG carousel; naptár (hétfő/szerda/péntek); közzététel az Instagram hivatalos API-jával; ütemezett GitHub Actions workflow (`.github/workflows/social.yml`).
* Három út: félautomata (letölthető képek), teljesen automatikus (Meta app + token a GitHub Secretsben), vagy a Posty összekötő. Részletek: `social/README.md`.
* Feltételek: Instagram professzionális fiók, Meta fejlesztői app, a workflow az alapértelmezett ágra kerüljön, a token 60 naponta megújítandó.

### 7.5 Javasolt következő marketinglépések
1. **0–2 hét:** 12+ tesztelő toborzása; Google-csoport; 14 napos zárt teszt; visszajelzések gyűjtése (egyszerű űrlap).
2. **2–4 hét:** éles Play-megjelenés; Product Hunt / r/SideProject / HU Facebook csoportok; rövid demóvideó (Reels/TikTok: „A portfóliód egyetlen részvényként”).
3. **Szezonális csúcs:** **év vége Wrapped** (dec. 20–jan. 10.) – itt várható a legnagyobb organikus növekedés; kártyasablonok finomítása.
4. **Tartalom:** „Megvertem az S&P 500-at?” sorozat; TBSZ-határidők magyarul; költségleleplező bejegyzések (díjak és deviza).
5. **Közösség:** r/…, Discord/Telegram csoport, nyilvános ötletlista.
6. **Mérés (adatvédelem-barát):** Play Console telepítések/eltávolítások, landing oldal látogatottság (privacy-first analitika, pl. önállóan hosztolt számláló – csak ha a policy frissül), vélemények és értékelések; a termékben **nincs** követés, ezt érdemes márkaértékként kommunikálni.
7. **Monetizáció (opcionális, később):** ingyenes mag + **Pro** (több számla-profil, extra kártyasablonok, exportok, felhőmentés titkosítva), Play Billing; vagy hozzájárulás („támogatás”). A fizetős funkciók ne sértsék az „adat a készüléken” ígéretet.

### 7.6 Versenykép (általános ismeret, nem friss piackutatás)
Hasonló kategória: Getquin, Delta, Snowball Analytics, Sharesight, Portfolio Performance, bróker-saját appok. A mi különbségünk: **adatok a készüléken, magyar/TBSZ-fókusz, egyszerű vizualizáció, Wrapped, nulla regisztráció**. Konkrét versenytárs-elemzés (funkció, ár, értékelések) még **nincs** elvégezve → javasolt.

---

## 8. Jog, megfelelőség, kockázatok

| Téma | Megjegyzés |
|---|---|
| **Nem befektetési tanácsadás** | Felirat az appban (Névjegy), a weboldalon és a Play-leírásban. |
| **GDPR / adatvédelem** | Nincs szerveroldali személyes adatkezelés; a policy EN/HU, tartalmazza a harmadik felek hívásait (Twelve Data, Finnhub, Frankfurter, cdnjs, Google Fonts, GitHub Pages). Kapcsolat: GitHub issues – *javasolt egy dedikált e-mail-cím.* |
| **Twelve Data használati feltételek** | Az ingyenes kulcs személyes használatra szól; mivel minden felhasználó a **saját kulcsát** adja meg, ez rendben van. **Közös kulcsot ne építs be.** |
| **Védjegyek** | A bróker-neveket (Lightyear, Trading 212, Revolut, IBKR) csak leíró jelleggel használjuk, nem hivatalos kapcsolat – a footerben jelezve. Hivatalos logókat ne használj. |
| **Pénzügyi besorolás (Play)** | Portfóliókövető, nem nyújt pénzügyi szolgáltatást, nem kereskedik. |
| **Adatbiztonság (Play)** | „Nem gyűjt/oszt adatot”; átvitel közben HTTPS. |
| **Márka/domain** | A „Portfolio Lens” védjegy-kereső vizsgálata (EUIPO/USPTO) még hátravan. |
| **Kulcskezelés** | A látott Twelve Data-kulcs cseréje ajánlott; aláíró kulcs és jelszó biztonságos tárolása. |

---

## 9. Roadmap (javaslat prioritás szerint)

**P0 – megjelenés előtt**
1. Google Play fejlesztői fiók, Google-csoport, 12+ tesztelő, 14 napos zárt teszt.
2. Domain döntés → `assetlinks.json`, PWABuilder-csomag, belső teszt.
3. Valódi CSV-exportokkal a T212/Revolut/IBKR-import ellenőrzése; angol Lightyear-PDF támogatás (minta kell).
4. A látott API-kulcs cseréje.

**P1 – 1–2 hónap**
5. Automata tesztek a repóba (parser/engine/csv egységtesztek + Playwright smoke), CI (GitHub Actions).
6. Intraday adatok az 1 napos/1 hetes nézetekhez (Twelve Data intraday, kötegelve).
7. Opcionális **névtelen árfolyam-gyorsítótár proxy** (Cloudflare Worker/…): sok felhasználónál a 8/perc ingyenes keret nem skálázódik; a saját kulcsos mód maradna alapértelmezett.
8. Push-értesítések (Web Push/TWA), háttérben futó riasztások.
9. Több számlaprofil, összehasonlítás számlánként, adóév-összesítő (CSV-export).

**P2 – 3–6 hónap**
10. Modulokra bontás + build lépés; kódméret- és teljesítménymérés (Lighthouse).
11. További nyelvek (német, lengyel, cseh – a régiós brókerek miatt), további bróker-presetek (eToro, XTB, Degiro, Freedom24).
12. Pro csomag / támogatás, titkosított felhőmentés.
13. Közösségi funkciók (anonim ranglisták, opcionális).

---

## 10. Teendők rád (amit én nem tudok elvégezni)

1. **Play Console fiók** (25 USD, személyazonosság-ellenőrzés).
2. **Domain** vásárlása vagy a `levi20003.github.io` repó létrehozása.
3. **Google-csoport + tesztelői link**, majd a posztok kitevése (a `[GOOGLE GROUP LINK]` és `[TESZT LINK]` helyőrzők cseréjével).
4. **PWABuilder** futtatása, az aláíró kulcs biztonságos mentése, `assetlinks.json` kitétele.
5. **Valódi bróker-exportok** és az **angol Lightyear-kivonat** feltöltése (adatok nélkül, vagy kitakarva), hogy a parser kiterjeszthető legyen.
6. **API-kulcs csere**, Finnhub-kulcs (opcionális a Naptárhoz).
7. Üzleti döntések: ár/Pro, márkanév véglegesítése, védjegykeresés.

---

## 11. Gyorsreferencia

**Kiadás (fejlesztőknek)**
```text
1) app.js  → APP_VERSION emelése      (pl. '2026.10.24')
2) version.json → ugyanaz az érték
3) sw.js   → CACHE = 'befektetes-vNN' emelése
4) git add -A && git commit && git push -u origin claude/lightyear-accounts-visualization-qdki29
5) ~2–10 perc: a Pages frissül → a felhasználó appjában megjelenik a „Frissítés” sáv
```

**Helyi tesztelés**
```text
python3 -m http.server 8090   # a repó gyökeréből
→ http://127.0.0.1:8090/befektetes/?demo=1
```

**Localstorage kulcsok** (a felhasználó készülékén): `bf-st` (kivonatok), `bf-mkt` (piaci adat), `bf-key`, `bf-fhkey` (API-kulcsok), `bf-manual`, `bf-lastbackup`, `bf-alertcfg`, `bf-alertlog`, `bf-alerted`, `bf-cur2`, `bf-alt`, `bf-lang`, `bf-theme`, `bf-range`, `bf-mode2`, `bf-bench`, `bf-hm`, `bf-bd`, `bf-ps`, `bf-an`, `bf-hide`, `bf-csvmaps`, `bf-demo`.

**Szószedet:** PWA – telepíthető webapp · TWA – Trusted Web Activity (a weboldalt Android-appként csomagoló megoldás) · TBSZ – tartós befektetési számla · TWR – idősúlyozott hozam · SPY – S&P 500 ETF · ASO – áruházi keresőoptimalizálás · EKB – Európai Központi Bank.
