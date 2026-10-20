# Levente 3D · 3D nyomtatás Szeged

Levente 3D üzleti weboldala és kampányzási pultja.

## Projekt struktúra

- **`web/`** - Nyilvános weboldal (index.html + assets)
- **`dashboard/`** - Kampánypult és CRM alkalmazás (index.html)
- **`img/`** - Közös képek és média fájlok

## Weboldal

Az `web/index.html` a teljes, termékkész 3D nyomtatási weboldal:
- Leszállító szekciók (szolgáltatások, portfólió, folyamat)
- Átvételi lehetőségek (személyesen, automata, posta)
- FAQ és ajánlatkérő forma
- Reszponzív dizájn (mobile-first)
- Sötét mód támogatás

## Kampánypult

Az `dashboard/index.html` egy teljes CRM/email kampánykezelő alkalmazás:
- Címlista kezelés
- E-mail sablonok
- Ajánlatok és rendelések kezelése
- 3D generátor (szöveg → STL)
- Árkalkulátor
- Gyártástervező
- Célkövetés és analitika
- Gmail integráció

## Fejlesztés

```bash
# Weboldal indítása
cd web
python3 -m http.server 8000

# Kampánypult indítása
cd dashboard
python3 -m http.server 8001
```

## Branding

**Szín палета:**
- Oliva: `#5f6239` (dark) / `#c4c792` (light)
- Homok: `#b8976d` (dark) / `#cbac83` (light)
- Háttér: `#f6f5f0` (light) / `#15160f` (dark)

**Betűtípusok:**
- Display: Archivo (font-stretch: 100–125%)
- UI: Instrument Sans
- Mono: JetBrains Mono

## Kapcsolat

📧 levente3d.szeged@gmail.com
📞 +36 70 596 1640
📍 Szeged, Magyarország
