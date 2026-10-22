# Portfolio Lens · Play Áruház-csomag

Ez a mappa mindent tartalmaz, ami a Google Play-megjelenéshez kell. Minden kép **mintaadatokból** készült (demó mód), valódi pénzügyi adat nincs benne.

| Fájl | Mire kell | Play Console helye |
|---|---|---|
| `icon-512.png` | Alkalmazásikon, 512×512 | Fő áruházi adatlap → Alkalmazásikon |
| `feature-graphic-en.png` / `-hu.png` | Kiemelt grafika, 1024×500 | Fő áruházi adatlap → Kiemelt grafika |
| `en/phone-1…5.png` | Angol telefonos képernyőképek, 1080×1920 | Fő áruházi adatlap (angol) |
| `hu/phone-1…5.png` | Magyar képernyőképek | Fordítások → magyar |

Weboldal: `https://levi20003.github.io/3D/portfolio-lens/`
Adatvédelmi tájékoztató (a Play Console kéri): `https://levi20003.github.io/3D/portfolio-lens/privacy.html`
Demó link (közösségi médiához): `https://levi20003.github.io/3D/befektetes/?demo=1&lang=en`

---

## 1. Fejlesztői fiók (egyszeri, 25 USD)

1. https://play.google.com/console/signup → **Személyes** fiók (magánszemélyként).
2. Személyazonosság-ellenőrzés (igazolvány), telefonszám, 25 USD regisztrációs díj.
3. **Fontos:** 2023 óta új személyes fióknál kötelező a **zárt teszt**: legalább **12 tesztelő** legalább **14 egymást követő napig** benne van a tesztben, csak utána kérheted az éles (production) kiadást. Kezdd el minél előbb gyűjteni a tesztelőket (barátok, család, egy Reddit/Discord-poszt).

## 2. Saját domain vagy GitHub Pages gyökér (ajánlott előtte)

A Play-alkalmazás egy **TWA** (Trusted Web Activity), vagyis a weboldalt nyitja meg teljes képernyőn, böngészősáv nélkül. Ehhez a Google-nak ellenőriznie kell, hogy a domain a tiéd, egy `/.well-known/assetlinks.json` fájllal, ami **a domain gyökerében** van.

- A `levi20003.github.io/3D/...` cím alatt ez **nem** működik, mert a gyökér (`levi20003.github.io/`) egy másik repó.
- **A. lehetőség (ingyenes):** hozz létre egy `levi20003.github.io` nevű repót, és abba tedd a `.well-known/assetlinks.json` fájlt (a PWABuilder adja meg a tartalmát, lásd 3. lépés). Ehhez a Pages-ben a `.well-known` mappa miatt kell egy üres `.nojekyll` fájl is.
- **B. lehetőség (márkaépítéshez jobb):** vegyél domaint (pl. `portfoliolens.app`, kb. 10–20 USD/év), állítsd be GitHub Pages egyedi domainnek. Utána a link szebb, és ha később máshova költözteted az appot, a Play-alkalmazás marad.

> Ha domaint veszel, szólj, és átállítom a linkeket, a manifestet és a weboldalt.

## 3. Android-csomag a PWABuilderrel

1. Nyisd meg: https://www.pwabuilder.com → írd be: `https://levi20003.github.io/3D/befektetes/?lang=en` (vagy a saját domaint).
2. A pontszámnál a manifest és a service worker zöld lesz (ikonok, maskable ikon, képernyőképek, kategória már benne van).
3. **Package for stores → Android → Generate**. Beállítások:
   - Package ID: `app.portfoliolens.twa` (később nem változtatható!)
   - App name: `Portfolio Lens`, Launcher name: `Portfolio Lens`
   - Theme / background color: `#1e4334`
   - Signing key: **Create new**. A letöltött ZIP-ben lesz egy `signing.keystore` és a jelszavai (`signing-key-info.txt`). **Ezt mentsd el biztonságos helyre, és soha ne töltsd fel a GitHubra.** Ha elveszik, nem tudsz frissítést kiadni.
4. A ZIP-ben lévő `assetlinks.json`-t tedd ki a 2. lépés szerinti helyre. Miután a Play Console-ba feltöltötted az appot, a **Beállítás → Alkalmazásintegritás** oldalon lévő SHA-256 ujjlenyomatot is add hozzá ehhez a fájlhoz (a Google újraaláírja az appot).
5. A Play Console-ba a ZIP-ben lévő `.aab` fájlt töltöd fel.

## 4. Play Console beállítások

**Alkalmazás létrehozása:** név `Portfolio Lens`, alapértelmezett nyelv angol (en-US), App, Ingyenes.

**Alkalmazás tartalma:**
- Adatvédelmi irányelvek: a fenti privacy.html link.
- Hirdetések: **Nem tartalmaz hirdetést.**
- Hozzáférés az apphoz: **Minden funkció korlátozás nélkül elérhető** (nincs bejelentkezés; a demó mód a nyitóképernyőn van).
- Tartalom-besorolás (IARC kérdőív): kategória „Segédprogram / Termelékenység”, minden kérdésre **Nem** → várhatóan „Mindenki / 3+”.
- Célközönség: **18 év felett** (befektetési számlával rendelkezők).
- Hírek: Nem hírapp.
- Pénzügyi funkciók nyilatkozat: válaszd azt, hogy az app **nem nyújt** pénzügyi szolgáltatást (se kereskedés, se hitel, se fizetés), csak a felhasználó saját adatait jeleníti meg (portfóliókövető).
- Kormányzati app: Nem.

**Adatbiztonság (Data safety) kérdőív:**
- Gyűjt vagy oszt meg az app felhasználói adatot? → **Nem.** Indoklás: minden adat csak a készüléken tárolódik, nincs szerver. Az árfolyam-lekérések csak tickereket és a felhasználó saját API-kulcsát tartalmazzák, felhasználóhoz kötött adatot nem.
- Titkosítás átvitel közben: Igen (HTTPS).
- Adattörlés kérése: az app Beállítások → „Minden adat törlése” gombjával, illetve eltávolítással.

**Áruházi beállítások:** kategória **Pénzügy (Finance)**, címkék: Portfolio tracker, Investing. Kapcsolati e-mail: a fejlesztői fiók e-mailje (ez nyilvános lesz).

## 5. Áruházi szövegek

### English (en-US)

**App name (≤30):**
```
Portfolio Lens
```

**Short description (≤80):**
```
See your whole portfolio as one stock and check it against the S&P 500.
```

**Full description (≤4000):**
```
See what actually happened to your money.

Portfolio Lens turns your broker statements into one clear, beautiful picture. Import your files, and see your whole portfolio as if it were a single stock: one smooth chart, live prices, and an honest comparison with the S&P 500.

No account. No sign-up. No server. Your data never leaves your phone.

WHAT YOU GET
• Your portfolio as one stock: a time-weighted chart that ignores deposits, so you see real performance
• Beat the S&P 500? See what the same money would have done in an index fund, deposit by deposit
• Where your money is: allocation, sectors, countries and a daily heatmap
• Winners and losers, realized and unrealized gains, with tiny trades filtered out
• Fees, FX costs and withholding taxes added up, next to your dividends
• Portfolio Wrapped: your year as a story you can swipe through
• Share cards that show percentages, never amounts
• Earnings calendar and company news for your holdings (free Finnhub key)
• Price alerts, multi-currency view (USD, EUR, GBP, HUF and more), light and dark mode

IMPORT FROM YOUR BROKER
• Lightyear PDF statements and CSV
• Trading 212, Revolut and Interactive Brokers CSV exports
• Any other broker: map the columns once, the app remembers
• Add transactions by hand, too

PRIVATE BY DESIGN
Portfolio Lens never connects to your broker and can’t trade or move money. Statements are read on your device and stored only there. Market-data requests contain ticker symbols only. Back everything up to one file and restore it on a new phone.

LIVE PRICES
Without a key you see your portfolio at statement prices. Add a free Twelve Data key for daily live prices and the S&P 500 comparison.

TRY IT FIRST
Not ready to import? Open the app and tap “Try it with sample data”.

Portfolio Lens is a visualisation tool, not investment advice. Prices may be delayed. Not affiliated with any broker; broker names are trademarks of their owners.
```

### Magyar (hu-HU)

**Név:**
```
Portfolio Lens · Befektetés
```

**Rövid leírás (≤80):**
```
Az egész portfóliód egy részvényként. Regisztráció nélkül, a telefonodon marad.
```

**Teljes leírás:**
```
Lásd, mi történt valójában a pénzeddel.

A Portfolio Lens a bróker-kivonataidból egyetlen tiszta, szép képet készít. Töltsd be a fájljaidat, és az egész portfóliódat úgy látod, mintha egyetlen részvény lenne: egy sima grafikon, élő árfolyamok és őszinte összevetés az S&P 500-zal.

Nincs fiók. Nincs regisztráció. Nincs szerver. Az adataid nem hagyják el a telefonodat.

MIT KAPSZ
• A portfólió egy részvényként: időarányos görbe, amelyből kiszűrjük a befizetéseket, így a valódi teljesítményt látod
• Jobb vagy, mint az S&P 500? Megmutatjuk, mit hozott volna ugyanez a pénz egy indexalapban, befizetésenként
• Hol van a pénzed: megoszlás, szektorok, országok és napi hőtérkép
• Nyertesek és vesztesek, realizált és nem realizált eredmény, a pár dolláros apró ügyletek nélkül
• Díjak, devizaköltségek és forrásadók összesítve, mellettük az osztalékok
• TBSZ-számlák: gyűjtőév, lekötés és adómentesség dátumai
• Portfolio Wrapped: az éved történetekben
• Megosztható kártyák, amelyek csak százalékot mutatnak, összeget soha
• Gyorsjelentés-naptár és céghírek (ingyenes Finnhub kulccsal)
• Árfolyam-riasztások, több pénznem (USD, HUF, EUR és mások), világos és sötét mód

IMPORT A BRÓKEREDTŐL
• Lightyear PDF-kivonat és CSV
• Trading 212, Revolut és Interactive Brokers CSV-export
• Bármely más bróker: egyszer megadod az oszlopokat, az app megjegyzi
• Kézi rögzítés is

ADATVÉDELEM ALAPBÓL
A Portfolio Lens soha nem kapcsolódik a brókeredhez, nem tud kereskedni és pénzt mozgatni. A kivonatokat a telefonod olvassa be, és csak ott tárolja. Az árfolyam-lekérésekben csak tickerek szerepelnek. Mindent egy fájlba menthetsz, és új telefonon visszatöltheted.

ÉLŐ ÁRFOLYAMOK
Kulcs nélkül a kivonat szerinti árakon látod a portfóliót. Egy ingyenes Twelve Data kulccsal napi élő árakat és S&P 500 összevetést kapsz.

PRÓBÁLD KI ELŐBB
Nyisd meg az appot, és koppints a „Kipróbálom mintaadatokkal” gombra.

A Portfolio Lens vizualizációs eszköz, nem befektetési tanácsadás. Az árfolyamok késleltetettek lehetnek. Egyik brókerhez sem kapcsolódik; a brókerek nevei tulajdonosaik védjegyei.
```

## 6. Kiadás menete

1. **Belső teszt** (Testing → Internal testing): töltsd fel az `.aab`-t, add hozzá magad, telepítsd, nézd meg, hogy nincs-e böngészősáv (ha van, az assetlinks.json nincs rendben).
2. **Zárt teszt** (Closed testing): tesztelők e-mail-címei vagy Google-csoport, legalább 12 fő, legalább 14 nap. Kérd meg őket, hogy tényleg nyissák meg többször.
3. 14 nap után: **Production access** kérése (a Console kérdez pár dolgot a tesztről), majd éles kiadás.
4. Frissítés: az app tartalma (weboldal) **magától frissül**, új `.aab` csak akkor kell, ha az ikon, név vagy csomagbeállítás változik.

## 7. Amire figyelj

- **Twelve Data ingyenes csomag:** a feltételeik szerint az ingyenes kulcs személyes használatra szól. Mivel minden felhasználó a **saját** kulcsát adja meg, ez rendben van, de ne építs be közös kulcsot az appba. Ha később saját kulccsal adnál élő árakat mindenkinek, ahhoz fizetős csomag kell.
- **Lightyear PDF:** jelenleg a magyar nyelvű kivonatot ismeri fel. Az angol kivonat támogatásához kell egy minta (amint feltöltöd, megcsinálom).
- **Árazás:** maradjon ingyenes az elején. Később lehet „Pro” (pl. több számla, extra kártyák), de ez a Play Billing miatt külön munka.
- A demó mód és a képernyőképek véletlenszerű, kitalált adatok, valós árfolyamra nem utalnak.
