/* Tartalombank: oktató és bemutató posztok a Portfolio Lens-hez (magyar és angol).
   Minden szám illusztráció, nem előrejelzés és nem befektetési tanács. A számokat a kód számolja ki. */

const nf = (n, lang) => new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
const money = (n, lang) => (lang === 'hu' ? nf(n, 'hu') + ' Ft' : '$' + nf(n, 'en'));
const pct = (n, lang) => (lang === 'hu' ? String(n).replace('.', ',') : String(n)) + '%';
// havi befizetés jövőértéke éves hozam mellett
const fv = (pm, r, years) => { const i = r / 12, n = 12 * years; return pm * ((Math.pow(1 + i, n) - 1) / i); };
const PM = { hu: 10000, en: 100 };

const ex = {
  compound: lang => { const pm = PM[lang], inv = pm * 240, end = fv(pm, 0.07, 20); return { inv, end, gain: end - inv }; },
  fees: lang => { const pm = PM[lang], a = fv(pm, 0.07 - 0.01, 20), b = fv(pm, 0.07 - 0.002, 20); return { a, b, diff: b - a }; },
  fx: () => ({ r: (1.10 * 0.95 - 1) * 100 }),
};

const posts = [
  {
    id: 'one-stock', kind: 'app',
    slides: [
      { t: 'cover', hu: { h: 'Mi lenne, ha a portfóliód egyetlen részvény lenne?', sub: 'Egy görbe az egészről.' }, en: { h: 'What if your whole portfolio were a single stock?', sub: 'One line for everything.' } },
      { t: 'text', hu: { h: 'A baj a sok görbével van', b: 'Tizenkét részvény, befizetések, eladások, osztalékok. A bróker listát mutat, te pedig nem látod, hogy összességében merre mész.' }, en: { h: 'Too many lines', b: 'Twelve stocks, deposits, sales, dividends. Your broker shows a list, and you can’t see where you’re heading overall.' } },
      { t: 'text', hu: { h: 'A megoldás: idősúlyozott hozam', b: 'Egy új befizetés nem hozam. Ezért kiszűrjük, és a portfólióból egységárat számolunk, mint egy befektetési alapnál.' }, en: { h: 'The fix: time-weighted return', b: 'A new deposit is not performance. So we filter it out and compute a unit price for the portfolio, like a fund does.' } },
      { t: 'phone', shot: 'home_all', hu: { h: 'Így néz ki' }, en: { h: 'This is what it looks like' } },
    ],
    caption: {
      hu: 'Egyetlen görbe az egész portfóliódról, a befizetések torzítása nélkül. 📈\n\nA Portfolio Lens a bróker-kivonataidból idősúlyozott hozamot számol, és úgy mutatja, mintha egy részvény lenne.\n\nKipróbálhatod mintaadatokkal, regisztráció nélkül: link a bióban.',
      en: 'One line for your entire portfolio, without deposits distorting it. 📈\n\nPortfolio Lens turns your broker statements into a time-weighted return and shows it like a single stock.\n\nTry it with sample data, no sign-up: link in bio.',
    },
  },
  {
    id: 'hidden-costs', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'A költség, amit nem látsz a grafikonon', sub: 'Egy példa 20 évre.' }, en: { h: 'The cost you can’t see on the chart', sub: 'A 20-year example.' } },
      { t: 'stat', big: lang => money(ex.fees(lang).diff, lang), hu: { cap: 'ennyi a különbség 20 év alatt, ha a díj évi 1% helyett 0,2%.', note: 'Példa: havi 10 000 Ft, 7% bruttó éves hozam, nem előrejelzés.' }, en: { cap: 'is the difference over 20 years if the fee is 0.2% a year instead of 1%.', note: 'Example: $100 a month, 7% gross yearly return, not a forecast.' } },
      { t: 'text', hu: { h: 'Három költség, amit érdemes összeadni', l: ['Tranzakciós díj minden vételnél és eladásnál', 'Devizaváltás költsége (spread és díj)', 'Forrásadó az osztalékon'] }, en: { h: 'Three costs worth adding up', l: ['Trading fees on every buy and sell', 'Currency conversion cost (spread and fee)', 'Withholding tax on dividends'] } },
      { t: 'text', hu: { h: 'Egyetlen helyen látni', b: 'A Portfolio Lens Elemzés → Költség fülén egy összegben látod a díjakat, a devizaköltséget, a forrásadót és az osztalékot.' }, en: { h: 'See it in one place', b: 'In Portfolio Lens, Analysis → Costs adds up fees, FX cost, withholding tax and dividends.' } },
    ],
    caption: {
      hu: 'A kis százalékok hosszú távon nagyot számítanak. 💸\n\nAz illusztráció: havi 10 000 Ft, 7% bruttó hozam, 20 év. Az éves díj 1% vagy 0,2% közti különbség a végösszegben nagyon látványos.\n\nTe tudod, mennyit fizettél eddig díjra?',
      en: 'Small percentages matter a lot over long periods. 💸\n\nIllustration: $100 a month, 7% gross return, 20 years. The gap between a 1% and a 0.2% yearly fee is huge in the end result.\n\nDo you know how much you have paid in fees so far?',
    },
  },
  {
    id: 'vs-sp500', kind: 'app',
    slides: [
      { t: 'cover', hu: { h: 'Megverted az S&P 500-at?', sub: 'Őszinte összevetés.' }, en: { h: 'Did you beat the S&P 500?', sub: 'An honest comparison.' } },
      { t: 'text', hu: { h: 'Nem két százalék összevetése', b: 'A kérdés az: mit hozott volna ugyanaz a pénz, ugyanazokon a napokon, egy indexkövető alapban?' }, en: { h: 'Not two percentages side by side', b: 'The real question: what would the same money have done on the same days in an index fund?' } },
      { t: 'text', hu: { h: 'Befizetésenként számolva', b: 'Minden befizetést megvizsgálunk: ha aznap S&P 500-ba (SPY) mentél volna, ma mennyit érne.' }, en: { h: 'Deposit by deposit', b: 'We check each deposit: if you had bought the S&P 500 (SPY) that day, what would it be worth today?' } },
      { t: 'phone', shot: 'home_6m', hu: { h: 'A kék vonal az index' }, en: { h: 'The thin line is the index' } },
    ],
    caption: {
      hu: 'Az összevetés akkor ér valamit, ha ugyanazt a pénzt ugyanabban az időben nézed. 🎯\n\nA Portfolio Lens befizetésenként kiszámolja, mennyit érne ma ugyanez az összeg az S&P 500-ban.\n\nA mintaadatok kitaláltak; a sajátodat a kivonatodból töltheted be. Link a bióban.',
      en: 'A comparison only means something if you use the same money over the same time. 🎯\n\nPortfolio Lens works out, deposit by deposit, what the same money would be worth in the S&P 500 today.\n\nThe sample data is made up; load your own from your statements. Link in bio.',
    },
  },
  {
    id: 'compound', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'A kamatos kamat lassan látványos', sub: 'Egy egyszerű példa.' }, en: { h: 'Compounding is slow, then dramatic', sub: 'A simple example.' } },
      { t: 'stat', big: lang => money(ex.compound(lang).end, lang), hu: { cap: 'lesz havi 10 000 Ft-ból 20 év alatt, évi 7%-kal számolva.', note: 'Illusztráció, nem előrejelzés. A hozam nem garantált.' }, en: { cap: 'after 20 years from $100 a month at 7% a year.', note: 'Illustration, not a forecast. Returns are not guaranteed.' } },
      { t: 'text', hu: { h: 'Mennyi ebből a te pénzed?', b: lang => `Befizettél ${money(ex.compound(lang).inv, lang)}-ot, a többi (${money(ex.compound(lang).gain, lang)}) a hozam hozama.` }, en: { h: 'How much did you put in?', b: lang => `You deposited ${money(ex.compound(lang).inv, lang)}; the rest (${money(ex.compound(lang).gain, lang)}) is returns on returns.` } },
      { t: 'text', hu: { h: 'Ezért számít a rendszeresség', b: 'A legtöbb hatás a végén jön. Aki korán abbahagyja, épp azt hagyja ki.' }, en: { h: 'Why consistency matters', b: 'Most of the effect comes at the end. Stopping early means missing exactly that.' } },
    ],
    caption: {
      hu: 'A kamatos kamat a türelem jutalma. ⏳\n\nIllusztráció: havi 10 000 Ft, évi 7%, 20 év. A hozam nem garantált, a példa csak a hatást mutatja.\n\nMelyik érdekelne: egy összeg vagy rendszeres befizetés?',
      en: 'Compounding rewards patience. ⏳\n\nIllustration: $100 a month, 7% a year, 20 years. Returns are not guaranteed; the example only shows the effect.\n\nWould you rather invest a lump sum or regularly?',
    },
  },
  {
    id: 'dca', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'Rendszeres vétel: miért az átlagár más, mint az árak átlaga?', sub: 'Egy kis számpélda.' }, en: { h: 'Regular buying: why your average cost differs from the average price', sub: 'A small numeric example.' } },
      { t: 'text', hu: { h: 'Öt hónap, öt ár', b: 'Az árak: 10, 8, 5, 8, 10. Minden hónapban 100-at fektetsz be.' }, en: { h: 'Five months, five prices', b: 'Prices: 10, 8, 5, 8, 10. You invest 100 every month.' } },
      { t: 'stat', big: lang => (lang === 'hu' ? '7,69' : '7.69'), hu: { cap: 'az átlagos bekerülési ár, miközben az árak átlaga 8,2.', note: 'Összesen 65 db részvény 500-ért.' }, en: { cap: 'is your average cost, while the average of the prices is 8.2.', note: '65 shares in total for 500.' } },
      { t: 'text', hu: { h: 'Mi ennek az oka?', b: 'Ugyanannyi pénzért olcsón többet vásárolsz. Az átlagár ezért a súlyozott átlag, és az appban is így számoljuk.' }, en: { h: 'Why is that?', b: 'The same money buys more when prices are low. So your average cost is a weighted average, and that is how the app calculates it.' } },
    ],
    caption: {
      hu: 'Az átlagos bekerülési ár nem egyszerű átlag. 🧮\n\nPélda: 10, 8, 5, 8, 10 árakon havi 100-at fektetsz be: összesen 65 db részvény lesz 500-ért, az átlagár 7,69.\n\nA példa illusztráció, nem tanács.',
      en: 'Your average cost is not a simple average. 🧮\n\nExample: investing 100 a month at prices 10, 8, 5, 8, 10 gives 65 shares for 500, an average cost of 7.69.\n\nThe example is an illustration, not advice.',
    },
  },
  {
    id: 'realized', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'Realizált vagy nem realizált?', sub: 'A piros szám nem mindig veszteség.' }, en: { h: 'Realized or unrealized?', sub: 'A red number isn’t always a loss.' } },
      { t: 'text', hu: { h: 'Nem realizált', b: 'Ami ma papíron látszik, miközben a részvény még nálad van. Holnap változhat.' }, en: { h: 'Unrealized', b: 'What shows on paper today while you still hold the stock. It can change tomorrow.' } },
      { t: 'text', hu: { h: 'Realizált', b: 'Ami az eladáskor végleges lett. Ez kerül a számlád eredményébe, és ez számít adózási szempontból is.' }, en: { h: 'Realized', b: 'What became final when you sold. It goes into your account result and matters for tax too.' } },
      { t: 'text', hu: { h: 'Külön látni a kettőt', b: 'A Portfolio Lens Elemzés → Eredmény fülén a nyertesek és vesztesek mellett a két érték külön szerepel.' }, en: { h: 'See them separately', b: 'In Portfolio Lens, Analysis → P/L shows both values separately next to winners and losers.' } },
    ],
    caption: {
      hu: 'A papíron lévő eredmény és az eladott eredmény két külön dolog. 📊\n\nÉrdemes külön nézni őket, mert más dolgot mondanak a befektetésedről.\n\nNem befektetési tanács.',
      en: 'Paper results and sold results are two different things. 📊\n\nIt pays to look at them separately because they tell different stories about your investing.\n\nNot investment advice.',
    },
  },
  {
    id: 'tiny-trades', kind: 'app',
    slides: [
      { t: 'cover', hu: { h: 'Egy 1 dolláros ügylet ne legyen a „legnagyobb nyertes”', sub: 'Zaj a statisztikában.' }, en: { h: 'A $1 trade should not be your “biggest winner”', sub: 'Noise in your stats.' } },
      { t: 'text', hu: { h: 'A százalék megtévesztő', b: 'Egy pár centes részvényből 100%-ot nyerni szép szám, de a pénzedre nincs hatása.' }, en: { h: 'Percentages can mislead', b: 'Making 100% on a few cents looks great, but it has no effect on your money.' } },
      { t: 'text', hu: { h: 'Küszöb a rangsorokhoz', b: 'A Portfolio Lens kihagyja az apró ügyleteket a nyertesek és vesztesek listájából. A küszöböt te állítod.' }, en: { h: 'A threshold for the rankings', b: 'Portfolio Lens leaves tiny trades out of the winners and losers lists. You set the threshold.' } },
      { t: 'phone', shot: 'portfolio', hu: { h: 'Tiszta lista, lényegi adatok' }, en: { h: 'A clean list, what matters' } },
    ],
    caption: {
      hu: 'Az apró ügyletek eltorzítják a rangsort. 🔎\n\nEzért van az appban küszöb: így a nyertes és vesztes listán csak az szerepel, ami a pénzedre is számít.\n\nLink a bióban, a demó mintaadatokkal megy.',
      en: 'Tiny trades distort the rankings. 🔎\n\nThat’s why the app has a threshold: winners and losers only include what actually matters for your money.\n\nLink in bio, the demo runs with sample data.',
    },
  },
  {
    id: 'privacy', kind: 'trust',
    slides: [
      { t: 'cover', hu: { h: 'Nincs fiók. Nincs szerver. Nincs mit ellopni.', sub: 'Az adataid a telefonodon maradnak.' }, en: { h: 'No account. No server. Nothing to steal.', sub: 'Your data stays on your phone.' } },
      { t: 'text', hu: { h: 'Hogyan lehetséges ez?', b: 'A kivonatot a telefonod olvassa be, és csak ott tárolódik. Nincs Portfolio Lens szerver, ahová feltöltenénk.' }, en: { h: 'How is that possible?', b: 'Your phone reads the statement and stores it only there. There is no Portfolio Lens server to upload to.' } },
      { t: 'text', hu: { h: 'Mit küld ki az app?', l: ['Tickereket az árfolyamokhoz', 'Devizakódokat az árfolyamokhoz', 'Soha: összeget, darabszámot, számlaszámot'] }, en: { h: 'What does the app send?', l: ['Tickers, for prices', 'Currency codes, for exchange rates', 'Never: amounts, quantities or account numbers'] } },
      { t: 'text', hu: { h: 'A mentés a te fájlod', b: 'Mindent egy fájlba menthetsz, és új telefonon visszatöltheted. Az API-kulcsok csak akkor kerülnek bele, ha te kéred.' }, en: { h: 'Your backup, your file', b: 'Save everything to one file and restore it on a new phone. API keys are only included if you ask.' } },
    ],
    caption: {
      hu: 'A pénzügyi adat érzékeny. 🔒\n\nEzért a Portfolio Lens nem kér regisztrációt, nincs szervere, és soha nem csatlakozik a brókeredhez.\n\nA részletes adatvédelmi tájékoztató a weboldalon van, link a bióban.',
      en: 'Financial data is sensitive. 🔒\n\nThat’s why Portfolio Lens needs no sign-up, has no server and never connects to your broker.\n\nThe full privacy policy is on the website, link in bio.',
    },
  },
  {
    id: 'import', kind: 'app',
    slides: [
      { t: 'cover', hu: { h: 'Három perc, és látod az egészet', sub: 'Importálás bármelyik brókerből.' }, en: { h: 'Three minutes to see the whole picture', sub: 'Import from any broker.' } },
      { t: 'text', hu: { h: '1. Exportálj', b: 'Töltsd le a számlakivonatot (PDF) vagy a tranzakciós előzményt (CSV) a brókeredtől.' }, en: { h: '1. Export', b: 'Download your account statement (PDF) or transaction history (CSV) from your broker.' } },
      { t: 'text', hu: { h: '2. Töltsd be', b: 'Lightyear, Trading 212, Revolut és Interactive Brokers magától megy. Bármely más CSV-nél egyszer megadod az oszlopokat, és az app megjegyzi.' }, en: { h: '2. Load it', b: 'Lightyear, Trading 212, Revolut and Interactive Brokers work automatically. For any other CSV you map the columns once and the app remembers.' } },
      { t: 'text', hu: { h: '3. Nézd', b: 'Élő árakat egy ingyenes kulccsal kapsz. Nélküle is látod a portfóliót a kivonat szerinti árakon.' }, en: { h: '3. Look', b: 'Get live prices with a free key. Without one you still see your portfolio at statement prices.' } },
    ],
    caption: {
      hu: 'Nem kell átállnod semmire, a brókered marad. 📂\n\nA Portfolio Lens csak a kivonatodat olvassa be, és abból épít egy átlátható képet.\n\nMintaadatokkal kipróbálható, link a bióban.',
      en: 'You don’t have to switch anything; your broker stays. 📂\n\nPortfolio Lens only reads your statement and builds a clear picture from it.\n\nTry it with sample data, link in bio.',
    },
  },
  {
    id: 'wrapped', kind: 'app',
    slides: [
      { t: 'cover', hu: { h: 'A befektetői éved, dióhéjban', sub: 'Portfolio Wrapped.' }, en: { h: 'Your investing year in a nutshell', sub: 'Portfolio Wrapped.' } },
      { t: 'text', hu: { h: 'Mit mutat?', l: ['Az év csillaga', 'A legjobb és a legrosszabb napod', 'Mennyit fizettél díjra', 'Milyen befektető vagy'] }, en: { h: 'What does it show?', l: ['Your star of the year', 'Your best and worst day', 'How much you paid in fees', 'What kind of investor you are'] } },
      { t: 'phone', shot: 'wrapped', hu: { h: 'Lapozható történetek' }, en: { h: 'Swipeable stories' } },
      { t: 'text', hu: { h: 'Megosztható, de diszkréten', b: 'A kártyák alapból csak százalékot mutatnak, összeget soha. Te döntöd el, mit osztasz meg.' }, en: { h: 'Shareable, but discreet', b: 'Cards show percentages only by default, never amounts. You decide what to share.' } },
    ],
    caption: {
      hu: 'Mi lett a befektetői éved sztorija? 🎬\n\nA Portfolio Wrapped a saját adataidból készít lapozható összefoglalót. Az összegek rejtve maradnak, csak a százalékok látszanak.\n\nA demó kipróbálható, link a bióban.',
      en: 'What’s the story of your investing year? 🎬\n\nPortfolio Wrapped builds a swipeable recap from your own data. Amounts stay hidden; only percentages show.\n\nThe demo is available, link in bio.',
    },
  },
  {
    id: 'allocation', kind: 'app',
    slides: [
      { t: 'cover', hu: { h: 'Hol van valójában a pénzed?', sub: 'Egy pillantás elég.' }, en: { h: 'Where is your money really?', sub: 'One glance is enough.' } },
      { t: 'text', hu: { h: 'A „tíz részvény” nem azt jelenti, hogy tíz egyforma tét', b: 'Ha egyetlen pozíció a portfólió nagy része, az nagyobb hatással van az eredményre, mint a többi együtt.' }, en: { h: '“Ten stocks” doesn’t mean ten equal bets', b: 'If one position is most of the portfolio, it moves your result more than all the others combined.' } },
      { t: 'phone', shot: 'portfolio', hu: { h: 'Megoszlás, szektor, ország' }, en: { h: 'Allocation, sector, country' } },
      { t: 'text', hu: { h: 'Nem tanács, csak tudatosság', b: 'Az app nem mondja meg, mit tegyél. Azt mutatja meg, mit tartasz valójában.' }, en: { h: 'Awareness, not advice', b: 'The app doesn’t tell you what to do. It shows what you actually hold.' } },
    ],
    caption: {
      hu: 'A megoszlás ismerete az első lépés. 🍩\n\nSzektor, ország és pozíció szerinti bontás, egy fánkdiagramon.\n\nA képek mintaadatokból készültek. Nem befektetési tanács.',
      en: 'Knowing your allocation is the first step. 🍩\n\nSector, country and position breakdown on one donut chart.\n\nImages use sample data. Not investment advice.',
    },
  },
  {
    id: 'currency', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'Dollárban nyertél, forintban?', sub: 'Az árfolyam is eredmény.' }, en: { h: 'Up in dollars. And in your own currency?', sub: 'Exchange rates are part of the result.' } },
      { t: 'stat', big: lang => '+' + pct((ex.fx().r).toFixed(1), lang), hu: { cap: 'marad a részvény 10%-os emelkedéséből, ha a dollár közben 5%-ot gyengül a forinthoz képest.', note: 'Számpélda: 1,10 × 0,95 − 1.' }, en: { cap: 'is what’s left of a 10% stock gain if the dollar falls 5% against your currency.', note: 'Numeric example: 1.10 × 0.95 − 1.' } },
      { t: 'text', hu: { h: 'Fordítva is igaz', b: 'Ha a dollár erősödik, a forintos eredményed nagyobb lehet, mint a dollárban látott. A kettő külön hatás.' }, en: { h: 'It works the other way too', b: 'If the dollar strengthens, your home-currency result can be larger than what you see in dollars. They are two separate effects.' } },
      { t: 'text', hu: { h: 'Két pénznemben nézve', b: 'A Portfolio Lens-ben egy koppintással válthatsz a dollár és a saját pénznemed között.' }, en: { h: 'See both currencies', b: 'In Portfolio Lens you switch between the dollar and your own currency with one tap.' } },
    ],
    caption: {
      hu: 'Külföldi részvény = két kockázat: a részvény és a deviza. 💱\n\nA példa: +10% dollárban és −5% dollárárfolyam = kb. +4,5% forintban.\n\nIllusztráció, nem tanács.',
      en: 'A foreign stock means two exposures: the stock and the currency. 💱\n\nExample: +10% in dollars and −5% on the dollar = about +4.5% in your currency.\n\nIllustration, not advice.',
    },
  },
  {
    id: 'earnings', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'Mikor jelent a részvényed?', sub: 'A gyorsjelentés napja.' }, en: { h: 'When does your stock report?', sub: 'Earnings day.' } },
      { t: 'text', hu: { h: 'Negyedévente egyszer', b: 'A vállalatok negyedévente teszik közzé az eredményüket. Ezeken a napokon az árfolyam gyakran nagyot mozog.' }, en: { h: 'Once a quarter', b: 'Companies publish results every quarter. On those days the price often moves a lot.' } },
      { t: 'text', hu: { h: 'Érdemes tudni előre', b: 'Nem azért, hogy tippelj, hanem hogy ne lepjen meg, ha egy nap az egész portfóliód nagyot mozdul.' }, en: { h: 'Worth knowing in advance', b: 'Not to guess, but so you aren’t surprised when your whole portfolio moves in a day.' } },
      { t: 'text', hu: { h: 'Naptár a saját részvényeidre', b: 'A Portfolio Lens Naptár fülén csak a te részvényeid jelentései és hírei szerepelnek (ingyenes Finnhub kulccsal).' }, en: { h: 'A calendar for your stocks only', b: 'The Calendar tab in Portfolio Lens lists only your stocks’ reports and news (with a free Finnhub key).' } },
    ],
    caption: {
      hu: 'A jelentési napok nem meglepetések, ha tudsz róluk. 📅\n\nA Naptár fül csak a te részvényeid eseményeit mutatja.\n\nNem befektetési tanács.',
      en: 'Earnings days aren’t surprises when you know about them. 📅\n\nThe Calendar tab shows events for your own stocks only.\n\nNot investment advice.',
    },
  },
  {
    id: 'tbsz', kind: 'edu',
    slides: [
      { t: 'cover', hu: { h: 'TBSZ: a dátumok számítanak', sub: 'Gyűjtőév, lekötés, adómentesség.' }, en: { h: 'Tax-advantaged accounts: dates matter', sub: 'Qualifying periods and deadlines.' } },
      { t: 'text', hu: { h: 'Három dátum', l: ['A gyűjtőév vége', 'A lekötési időszakok határai', 'Az adómentesség kezdete'] }, en: { h: 'Three dates', l: ['The end of the collection period', 'The qualifying-period milestones', 'When the tax advantage starts'] } },
      { t: 'text', hu: { h: 'Könnyű elfelejteni', b: 'Éveken át tart, és a szabályok az időponthoz kötöttek. Egy rossz időben kivett összeg adózási következménnyel járhat.' }, en: { h: 'Easy to forget', b: 'It runs for years and the rules depend on timing. Withdrawing at the wrong moment can have tax consequences.' } },
      { t: 'text', hu: { h: 'Az app jelzi a határidőket', b: 'A TBSZ-kártya mutatja, hol tart a számlád. A pontos szabályokat mindig ellenőrizd a bankodnál vagy a NAV-nál.' }, en: { h: 'The app tracks the deadlines', b: 'The TBSZ card shows where your account stands. Always check the exact rules with your bank or the tax authority.' } },
    ],
    caption: {
      hu: 'A TBSZ-nél az idő a legfontosabb alkatrész. ⏰\n\nA Portfolio Lens kártyája mutatja a határidőket. A pontos szabályokat mindig ellenőrizd a bankodnál vagy a NAV-nál.\n\nNem adó- vagy befektetési tanács.',
      en: 'With tax-advantaged accounts, time is the key ingredient. ⏰\n\nPortfolio Lens’s card shows the deadlines (built for Hungarian TBSZ accounts). Always check the exact rules with your bank or tax authority.\n\nNot tax or investment advice.',
    },
  },
  {
    id: 'ask-index', kind: 'engage',
    slides: [
      { t: 'cover', hu: { h: 'Mérted már magad az indexhez?', sub: 'Őszintén.' }, en: { h: 'Have you ever measured yourself against the index?', sub: 'Honestly.' } },
      { t: 'text', hu: { h: 'Három válasz, melyik te vagy?', l: ['Igen, rendszeresen', 'Egyszer megnéztem', 'Nem, de érdekelne'] }, en: { h: 'Three answers, which one are you?', l: ['Yes, regularly', 'Looked once', 'No, but I’d like to'] } },
      { t: 'text', hu: { h: 'Nincs rossz válasz', b: 'Írd meg kommentben! A demóban kitalált adatokkal megnézheted, hogyan néz ki az összevetés.' }, en: { h: 'There’s no wrong answer', b: 'Tell us in the comments! In the demo, with made-up data, you can see what the comparison looks like.' } },
    ],
    caption: {
      hu: 'Mérted már magad az S&P 500-hoz? 👇\n\n1️⃣ Igen, rendszeresen\n2️⃣ Egyszer megnéztem\n3️⃣ Nem, de érdekelne\n\nÍrd be a számot kommentbe!',
      en: 'Have you ever measured yourself against the S&P 500? 👇\n\n1️⃣ Yes, regularly\n2️⃣ Looked once\n3️⃣ No, but I’d like to\n\nDrop the number in the comments!',
    },
  },
];

const HASHTAGS = {
  hu: '#befektetés #tőzsde #részvény #sp500 #portfólió #pénzügyek #tbsz #lightyear #trading212 #befektetőkezdőknek #pénzügyiműveltség',
  en: '#investing #stockmarket #portfolio #sp500 #personalfinance #investingforbeginners #fintech #financialliteracy #dividends #etf',
};
const DISCLAIMER = {
  hu: 'Nem befektetési tanácsadás. A példák illusztrációk, a mintaadatok kitaláltak.',
  en: 'Not investment advice. Examples are illustrations; sample data is made up.',
};
const CTA = {
  hu: { h: 'Próbáld ki ingyen', sub: 'Link a bióban. Regisztráció nélkül, mintaadatokkal.', pill: 'Az adataid a telefonodon maradnak' },
  en: { h: 'Try it for free', sub: 'Link in bio. No sign-up, with sample data.', pill: 'Your data stays on your phone' },
};

module.exports = { posts, HASHTAGS, DISCLAIMER, CTA };
