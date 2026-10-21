# Levente 3D · 3D nyomtatás Szeged

- **`web/`**: nyilvános weboldal (`index.html` + `img/`). Élő: https://claude.ai/artifact/WZLdSDK19twEH9KM9WbH56
- **`dashboard/`**: kampánypult (címlista, Gmail-küldés, sablonok, rendelések, árkalkulátor, 3D-generátor). Élő: https://claude.ai/artifact/44semk3pH1ffrYo8XycBoS

- **`nevjegy/`**: névjegykártya, 85 × 55 mm, 3 mm kifutóval.
  - `v3_CMYK`: nyomdának, ha CMYK-t kérnek. ISO Coated v2 (FOGRA39) profillal, a fekete szöveg és a QR-kód tiszta fekete (K100), a legnagyobb festékfedés 218%.
  - `v3`: RGB, ugyanaz a kártya. Ezt akkor küldd, ha a nyomda maga alakít át.

A kampánypult a claude.ai-on futva éri el a közös adatbázist és a Gmailt. Helyben megnyitva (`file://`) a felület működik, de nem ment.

## Címek felvétele

- **Címlista → Gyors felvétel**: beírsz egy e-mail címet, Enter. A pult a domain, a név és a környező szöveg alapján kategóriába és városba sorolja, és felveszi kiküldendőnek. A Részletek alatt a kategória átírható.
- **Új címek → Okos felvétel**: bármilyen szöveg beilleszthető (aláírás, kapcsolat-oldal, több cím). Felvétel előtt soronként átnézheted, és a „Felvétel és kijelölés küldésre” gomb rögtön a küldés megerősítéséhez visz.
- A már szereplő cím, az azonos cégdomain és a tiltólistás cím nem kerül be.
- Cégnevet csak akkor tölt ki, ha a szövegben szerepel (például „Kovács Pékség Bt.”), mert a név a levélbe is bekerül.

## Arculat

Oliva `#5f6239`, homok `#b8976d`, törtfehér `#f6f5f0`. Betűk: Archivo, Instrument Sans, JetBrains Mono.

## Kapcsolat

levente3d.szeged@gmail.com · +36 70 596 1640 · Szeged
