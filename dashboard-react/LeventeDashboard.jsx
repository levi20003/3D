/*
 * LEVENTE·3D – kampánypult, React + Tailwind áttekintő felület.
 *
 * Mit tartalmaz: a menüsáv, a fejléc (keresés, téma, fiók) és az Áttekintés lap összes widgetje
 * (statkártyák, bevétel/kiadás, válaszarány, címek állapota, naptár, kategóriák, teendők, megkeresések).
 * Az üzleti logika a meglévő pultból van átvéve változatlanul: follow-up szakaszok (fuDays / fu2Days),
 * válasznak számító állapotok, visszapattanók kizárása, napi küldésszám, kategória-válaszarány, teendőlista.
 *
 * Adat: ugyanazokat a gyűjteményeket olvassa, mint a pult (contacts, orders, ledger, settings/main), ha a
 * komponens a pult artifactjában fut (window.claude.use("db")). Máshol jelölt mintaadatokkal indul.
 * Az Óratartó-generátor menüpont a WatchStandGenerator komponenst nyitja meg (lusta betöltéssel).
 * A Címlista, Rendelések, 3D-generátor és a többi menüpont a meglévő pultban működik tovább; itt a
 * menüpontjuk egy átirányító panelt mutat, mert azok átírása React-re külön munka.
 *
 * Tailwind: darkMode: "class". Betű: Inter (Google Fonts), tartalék: system-ui.
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

// A Three.js-t csak akkor tölti be, ha a menüpontot megnyitják.
const WatchStandGenerator = lazy(() => import("./WatchStandGenerator.jsx"));

const PULT_URL = "https://claude.ai/artifact/44semk3pH1ffrYo8XycBoS";
const BRAND = { olive: "#c3c78f", oliveDeep: "#5f6239", sand: "#c9ab84" };

const CATS = {
  nyomda: "Nyomda, csomagoló", dekor: "Reklám, dekor, gravírozás", ipar: "Gyártás, műhely, labor",
  epitoipar: "Építőipar, szerelő, asztalos", mezogazd: "Mezőgazdaság, kertészet", epitesz: "Építész, belsőépítész, ingatlan",
  oktatas: "Iskola, tanszék, múzeum", sport: "Sportklub, egyesület", rendezveny: "Esküvő, rendezvény",
  kisker: "Bolt, ajándék, könyv", turizmus: "Szuvenír, turisztika", hobbi: "Hobbi, társasjáték, hangszer, fotó",
  szolg: "Szállás, szépség, egészség", auto: "Autó, motor, kerékpár", lakber: "Lakberendezés, bútor",
  civil: "Civil, kulturális intézmény", allat: "Állatorvos, kisállat", vendeglato: "Vendéglátás", egyeb: "Egyéb",
};
const STATUS = { javasolt: "Javasolt", elvetve: "Elvetve", uj: "Új", elkuldve: "Elküldve", fu: "Follow-up esedékes", valaszolt: "Válaszolt", ugyfel: "Ügyfél", lezarva: "Lezárva" };
const PILL = {
  uj: "bg-lime-600/10 text-lime-800 dark:bg-[#c3c78f]/15 dark:text-[#d9dcae]",
  fu: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  elkuldve: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300",
  valaszolt: "bg-sky-500/15 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  ugyfel: "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  lezarva: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  javasolt: "bg-violet-500/15 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  elvetve: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
  bounced: "bg-rose-500/15 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
  cold: "bg-orange-500/15 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300",
};
const HU_MON = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const HU_MONL = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

/* ---------- logika (a pultból átvéve) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const daysSince = (s) => (s ? Math.round((new Date(today() + "T00:00:00") - new Date(s + "T00:00:00")) / 864e5) : 0);
const huDate = (s) => { if (!s) return ""; const [, m, d] = s.split("-"); return `${+m}. ${+d}.`; };
const ft = (n) => Math.round(n || 0).toLocaleString("hu-HU") + " Ft";
const isDM = (c) => !String(c.email || "").includes("@");
const FREEMAIL = new Set(["gmail.com", "freemail.hu", "t-online.hu", "t-email.hu", "citromail.hu", "outlook.com", "hotmail.com", "yahoo.com"]);
const displayName = (c) => {
  if (c.name || isDM(c)) return c.name || c.email;
  const [loc, dom] = c.email.split("@");
  return FREEMAIL.has(dom) ? loc : dom.replace(/\.(hu|com|eu)$/, "");
};
function fuStage(c, s) {
  if (c.status !== "elkuldve" || !c.sentAt) return 0;
  if (!c.followupAt) return daysSince(c.sentAt) >= (+s.fuDays || 6) ? 1 : 0;
  if (!c.followup2At) return daysSince(c.followupAt) >= (+s.fu2Days || 8) ? 2 : 0;
  return 0;
}
const effStatus = (c, s) => (fuStage(c, s) ? "fu" : c.status || "uj");
function didReply(c) {
  if (c.bounced) return false;
  const st = c.status || "uj";
  if (st === "valaszolt" || st === "ugyfel") return true;
  return st === "lezarva" && !/nem válaszolt|nem jött válasz/i.test(c.note || "");
}
function fuDue(c, s) {
  if (c.bounced || c.status !== "elkuldve" || !c.sentAt) return "";
  if (!c.followupAt) return addDays(c.sentAt, +s.fuDays || 6);
  if (!c.followup2At) return addDays(c.followupAt, +s.fu2Days || 8);
  return "";
}
const lastActivity = (c) => [c.sentAt, c.followupAt, c.followup2At].filter(Boolean).sort().pop() || "";

/* ---------- címutánpótlás: import, szektorok, újrakörözés ---------- */
const RECYCLE_DAYS = 14;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const slugify = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s) => " " + slugify(s).replace(/-/g, " ") + " ";
const domOf = (e) => (String(e || "").includes("@") ? String(e).split("@")[1].toLowerCase() : "");
const catName = (c) => c.catLabel || CATS[c.cat] || c.cat || "–";
const isBlocked = (c, bl) => !!bl && ((bl.emails || []).some((x) => String(x).toLowerCase() === String(c.email).toLowerCase()) || (bl.domains || []).some((x) => String(x).toLowerCase() === domOf(c.email)));
// Hideg cím: kiment a levél, nem jött válasz, és 14 napja nem történt vele semmi.
function coldDays(c) {
  if (c.status !== "elkuldve" || c.bounced || isDM(c)) return null;
  const la = lastActivity(c);
  return la && daysSince(la) >= RECYCLE_DAYS ? daysSince(la) : null;
}
// Visszateszi a kiküldendők közé; az előző kör dátumát megőrzi a jegyzetben.
const recycleDoc = (c) => ({
  ...c, status: "uj", prevSentAt: c.sentAt || "", sentAt: "", followupAt: "", followup2At: "", recycledAt: today(), recycleCount: (+c.recycleCount || 0) + 1,
  note: [c.note, `Újrakörözve ${huDate(today())} (előző levél: ${huDate(c.sentAt) || "?"})`].filter(Boolean).join(" · "),
});
const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + " Szeged")}`;
const SECTORS = [
  { id: "kavezo", label: "Kávézók", icon: "coffee", cat: "vendeglato", keywords: ["kávé", "kávéz", "cafe", "coffee", "espresso", "bistro", "cukrász"], queries: ["kávézó", "kávéház", "specialty coffee"], pitch: "QR-kódos asztali tábla, menütartó, pultdísz logóval." },
  { id: "ora", label: "Óra, ékszer", icon: "gem", cat: "x-ora-ekszer", catLabel: "Óra, ékszer", strictCat: true, keywords: ["óra", "órás", "ékszer", "watch", "jewel", "arany", "ezüst", "zálog"], queries: ["órás", "ékszerüzlet", "óraszalon"], pitch: "Óratartó, ékszertartó, kirakati display saját logóval." },
  { id: "gym", label: "Edzőtermek", icon: "dumbbell", cat: "sport", keywords: ["fitness", "fitnesz", "gym", "edzőterem", "crossfit", "jóga", "yoga", "box", "pilates"], queries: ["edzőterem", "fitness", "crossfit"], pitch: "Tárcsatartó, kulacstartó, éremtartó, falitábla." },
  { id: "ajandek", label: "Ajándékboltok", icon: "gift", cat: "kisker", keywords: ["ajándék", "gift", "kézműves", "szuvenír", "souvenir", "design shop"], queries: ["ajándékbolt", "kézműves bolt", "szuvenír"], pitch: "Saját tervezésű kis szériás termékek, bizományba is." },
];
function sectorMatch(c, s) {
  if (c.sector === s.id || (s.strictCat && c.cat === s.cat)) return true;
  const hay = norm([c.name, c.email, c.hook, c.catLabel].join(" "));
  return s.keywords.some((k) => hay.includes(" " + norm(k).trim()));
}

// CSV (pontosvessző, tabulátor vagy vessző; idézőjeles mezők) → sorok tömbje.
function parseCSV(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const delim = [";", "\t", ","].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"' && !f.trim()) { q = true; f = ""; }
    else if (ch === delim) { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some(Boolean));
}
const COLS = {
  email: ["email", "e-mail", "mail", "emailcim", "e-mail cim"], name: ["name", "nev", "cegnev", "ceg", "company", "uzlet"], cat: ["cat", "kategoria", "category", "szektor"],
  city: ["city", "varos", "telepules"], hook: ["hook", "horog"], note: ["note", "megjegyzes", "jegyzet"], fb: ["fb", "facebook"], ig: ["ig", "instagram"], web: ["web", "weboldal", "website", "url", "honlap"],
};
const colKey = (h) => { const n = slugify(h).replace(/-/g, ""); return Object.keys(COLS).find((k) => COLS[k].some((a) => a.replace(/[^a-z]/g, "") === n)); };
function rowsToObjects(rows) {
  if (!rows.length) return [];
  const head = rows[0].map(colKey), hasHead = head.filter(Boolean).length >= 1 && !rows[0].some((x) => x.includes("@"));
  const keys = hasHead ? head : ["email", "name", "cat", "city"];
  return (hasHead ? rows.slice(1) : rows).map((r) => {
    const o = {}; r.forEach((v, i) => { if (keys[i] && v) o[keys[i]] = v; });
    if (!String(o.email || "").includes("@")) { const hit = r.find((v) => /\S+@\S+\.\S+/.test(v)); if (hit) o.email = hit; }
    return o;
  });
}
function parseJSONLeads(text) {
  const j = JSON.parse(text), arr = Array.isArray(j) ? j : j.contacts || j.leads || [];
  return arr.map((x) => {
    if (typeof x === "string") return { email: x };
    const o = {}; Object.entries(x || {}).forEach(([k, v]) => { const ck = colKey(k); if (ck && v != null && v !== "") o[ck] = String(v); });
    return o;
  });
}
function parseLeads(text) {
  const t = text.trim();
  if (!t) return { rows: [], err: "" };
  try { return { rows: /^[[{]/.test(t) ? parseJSONLeads(t) : rowsToObjects(parseCSV(t)), err: "" }; } catch (e) { return { rows: [], err: "A JSON nem olvasható: " + e.message }; }
}
function resolveCat(raw, r, def) {
  const v = String(raw || "").trim();
  if (v) {
    if (CATS[v]) return { cat: v };
    const n = norm(v), hitS = SECTORS.find((s) => norm(s.label) === n || s.id === v);
    if (hitS) return { cat: hitS.cat, catLabel: hitS.catLabel, sector: hitS.id };
    const hitC = Object.entries(CATS).find(([, l]) => norm(l).includes(n) || n.includes(norm(l.split(",")[0])));
    if (hitC) return { cat: hitC[0] };
    return { cat: "x-" + slugify(v), catLabel: v };
  }
  const s = SECTORS.find((x) => sectorMatch(r, x));
  if (s && !def.sector) return { cat: s.cat, catLabel: s.catLabel, sector: s.id };
  return { cat: def.cat, catLabel: def.catLabel, sector: def.sector };
}
const IMPORT_STATE = {
  ok: ["uj", "Új"], van: ["lezarva", "Már szerepel"], ceg: ["elkuldve", "Azonos cég"], tiltott: ["bounced", "Tiltólistán"], hibas: ["bounced", "Hibás"], fajlban: ["lezarva", "Ismétlődik"],
};
// Minden sorhoz eldönti, felvehető-e: meglévő cím, azonos cégdomain, tiltólista, hibás, fájlon belüli ismétlődés.
function prepareImport(rows, { contacts, blocklist, def, city, status, source }) {
  const have = new Set(contacts.map((c) => String(c.email).toLowerCase()));
  const doms = new Map();
  contacts.forEach((c) => { const dm = domOf(c.email); if (dm && !FREEMAIL.has(dm) && !doms.has(dm)) doms.set(dm, displayName(c)); });
  const seen = new Set(), seenDom = new Map();
  return rows.map((r) => {
    let email = String(r.email || "").trim().toLowerCase().replace(/^mailto:/, "").replace(/[<>,;]/g, ""), dm = false;
    if (!email) {
      if (!(r.fb || r.ig) || !r.name) return { r, state: "hibas", why: r.name ? "Nincs e-mail, FB vagy IG" : "Üres sor" };
      email = `dm-${slugify(r.name)}-${slugify(r.city || city || "szeged")}`; dm = true;
    } else if (!EMAIL_RE.test(email)) return { r, state: "hibas", why: "Hibás e-mail" };
    const dom = domOf(email), corp = dom && !FREEMAIL.has(dom);
    let state = "ok", why = "";
    if (have.has(email)) { state = "van"; why = "Már a címlistán"; }
    else if (seen.has(email)) { state = "fajlban"; why = "Kétszer szerepel"; }
    else if (!dm && isBlocked({ email }, blocklist)) { state = "tiltott"; why = "Leiratkozott vagy tiltott"; }
    else if (corp && doms.has(dom)) { state = "ceg"; why = `Ugyanaz a cég: ${doms.get(dom)}`; }
    else if (corp && seenDom.has(dom)) { state = "fajlban"; why = `Ugyanaz a cég: ${seenDom.get(dom)}`; }
    seen.add(email);
    if (state === "ok" && corp) seenDom.set(dom, email);
    const k = resolveCat(r.cat, r, def);
    const doc = {
      email, name: r.name || "", cat: k.cat, city: r.city || city || "Szeged", hook: r.hook || "", status, sentAt: "", source, addedAt: today(),
      note: [r.note, r.web && "Web: " + r.web].filter(Boolean).join(" · "),
    };
    if (k.catLabel) doc.catLabel = k.catLabel;
    if (k.sector) doc.sector = k.sector;
    if (dm) { doc.channel = "dm"; if (r.fb) doc.fb = r.fb; if (r.ig) doc.ig = r.ig; }
    return { r, state, why, doc };
  });
}
const SAMPLE_CSV = "email;név;kategória;város;megjegyzés\ninfo@pelda-kavezo.hu;Példa Kávézó;Kávézók;Szeged;Kárász utca\nhello@pelda-oras.hu;Példa Órás;Óra, ékszer;Szeged;\n;Példa Fitness;Edzőtermek;Szeged;fb: facebook.com/peldafitness";

function useDerived({ contacts, orders, ledger, settings, blocklist }) {
  return useMemo(() => {
    const td = today();
    const st = { ujE: 0, fuE: 0, dmUj: 0, dmFu: 0 }; let ma = 0;
    for (const c of contacts) {
      const s = effStatus(c, settings), dm = isDM(c); st[s] = (st[s] || 0) + 1;
      // A Címlista az e-mailt és a DM-et külön csoportban mutatja, ezért külön is számoljuk
      if (s === "uj") dm ? st.dmUj++ : st.ujE++;
      if (s === "fu") dm ? st.dmFu++ : st.fuE++;
      if (isDM(c) && (s === "uj" || s === "fu")) st.dmq = (st.dmq || 0) + 1;
      if (c.sentAt === td || c.followupAt === td || c.followup2At === td) ma++;
    }
    const sentList = contacts.filter((c) => (c.status || "uj") !== "uj" && c.sentAt && !c.bounced && !/^Ugyanaz a cég/i.test(c.note || ""));
    const sent = sentList.length, rep = sentList.filter(didReply).length, cust = sentList.filter((c) => c.status === "ugyfel").length;
    const active = contacts.filter((c) => !["javasolt", "elvetve"].includes(c.status));
    const f2 = contacts.filter((c) => !isDM(c) && fuStage(c, settings) === 2).length;

    const cold = contacts.filter((c) => coldDays(c) != null && !isBlocked(c, blocklist)).sort((a, b) => lastActivity(a).localeCompare(lastActivity(b)));
    const catLabels = {};
    for (const c of contacts) if (c.catLabel) catLabels[c.cat] = c.catLabel;

    const cat = {};
    for (const c of contacts) {
      const s = c.status || "uj"; if (s === "elvetve" || s === "javasolt") continue;
      const x = cat[c.cat || "egyeb"] || (cat[c.cat || "egyeb"] = { n: 0, sent: 0, rep: 0 });
      x.n++; if (c.sentAt && !c.bounced) { x.sent++; if (didReply(c)) x.rep++; }
    }

    const now = new Date(), months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    const inc = {}, exp = {}; let tI = 0, tE = 0;
    for (const x of ledger) {
      const k = (x.date || "").slice(0, 7), a = +x.amount || 0;
      if (x.type === "bevetel") { tI += a; inc[k] = (inc[k] || 0) + a; } else if (x.type === "kiadas") { tE += a; exp[k] = (exp[k] || 0) + a; }
    }

    const ev = {};
    const addEv = (d, k) => { if (d) (ev[d] = ev[d] || { fu: 0, ord: 0 })[k]++; };
    for (const c of contacts) { const d = fuDue(c, settings); if (d) addEv(d < td ? td : d, "fu"); }
    for (const o of orders) if (o.deadline && !["fizetve", "atadva", "elveszett"].includes(o.status)) addEv(o.deadline, "ord");

    const goal = +settings.goal || 30, uj = st.ujE, fu = st.fuE, nJ = st.javasolt || 0;
    const sentToday = ma, left = Math.max(0, goal - sentToday), fuToday = Math.min(fu, left), ujToday = Math.min(uj, left - fuToday);
    const todo = [];
    if (nJ) todo.push({ k: "Új címek", tone: "javasolt", title: `${nJ} új cím vár jóváhagyásra`, detail: "A napi keresés találta őket. Nézd át a forrást, és hagyd jóvá, amit érdemes megkeresni." });
    if (fu) todo.push({ k: "Follow-up", tone: "fu", title: `${fu} follow-up esedékes${fu > fuToday ? ` · ma ${fuToday} belőle` : ""}`, detail: "Kategóriára szabott emlékeztető a levél szálában (6 nap után), majd egy rövid utolsó levél (+8 nap)." });
    if (uj && sentToday < goal) todo.push({ k: "Kiküldés", tone: "uj", title: `Mai kiküldés: ${sentToday} / ${Math.min(goal, uj + sentToday)}${fu && ujToday < uj ? (ujToday ? ` · ma ${ujToday} jut rá` : " · holnap jön") : ""}`, detail: `${uj} cím vár kiküldésre. Egyenként, csatolmány nélkül.` });
    if (cold.length) todo.push({ k: "Utánkövetés", tone: "cold", title: `${cold.length} hideg cím újrakörözhető`, detail: `${RECYCLE_DAYS} napja nem jött rájuk válasz. A Címlistában egy kattintással visszakerülnek a kiküldendők közé.` });
    if (uj < goal) todo.push({ k: "Utánpótlás", tone: "fu", title: uj ? `Fogy a cím: ${uj} kiküldendő maradt (napi cél ${goal})` : "Elfogyott a kiküldendő cím", detail: "Importálj új címeket, vagy indíts szektorkeresést a Címlistában (kávézók, órások, edzőtermek, ajándékboltok)." });
    if (st.dmq) todo.push({ k: "DM", tone: "valaszolt", title: `${st.dmq} cég vár DM-re`, detail: "Facebookon vagy Instagramon érhetők el. A pult kimásolja a cégre szabott üzenetet." });
    for (const o of orders) {
      if (o.status === "keres") todo.push({ k: "Ajánlat", tone: "fu", title: `Ajánlatkérés érkezett: ${o.company}`, detail: `${o.item || ""}${o.qty ? " · " + o.qty + " db" : ""}` });
      if (o.status === "ajanlat" && daysSince(o.date) >= 3) todo.push({ k: "Ajánlat", tone: "fu", title: `Kérdezz rá az ajánlatra: ${o.company}`, detail: `${o.item} · ${ft(o.total)} · ${daysSince(o.date)} napja nyitott` });
      if (o.status === "elfogadva" || o.status === "gyartas") todo.push({ k: "Gyártás", tone: "ugyfel", title: `Gyártsd le és add át: ${o.company}`, detail: `${o.qty} db ${o.item}${o.deadline ? " · határidő: " + huDate(o.deadline) : ""}` });
      if (o.status === "atadva") todo.push({ k: "Pénz", tone: "ugyfel", title: `Fizetés rendezése: ${o.company}`, detail: ft(o.total) });
      if (o.status === "fizetve" && !o.thanksDone) todo.push({ k: "Köszönet", tone: "valaszolt", title: `Köszönd meg és kérj véleményt: ${o.company}`, detail: o.item || "" });
    }

    return {
      st, ma, goal, sent, rep, cust, rate: sent ? rep / sent : 0, active, f2, nJ, cat, catLabels, cold, months, inc, exp, tI, tE, ev, todo,
      openOrders: orders.filter((o) => ["keres", "ajanlat", "elfogadva", "gyartas"].includes(o.status)).length,
      paid: orders.filter((o) => o.status === "fizetve").length,
      recent: [...contacts].filter(lastActivity).sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))),
    };
  }, [contacts, orders, ledger, settings, blocklist]);
}

/* ---------- adatforrás: a pult adatbázisa, különben jelölt mintaadat ---------- */
function sampleData() {
  const t = today(), c = [];
  const add = (i, o) => c.push({ email: `info@minta${i}.hu`, name: `Minta cég ${i}`, city: "Szeged", status: "uj", sentAt: "", ...o });
  for (let i = 0; i < 24; i++) add(i, { cat: "nyomda", status: i < 4 ? "valaszolt" : "elkuldve", sentAt: addDays(t, -9) });
  for (let i = 4; i < 10; i++) Object.assign(c[i], { sentAt: addDays(t, -30 - i), followupAt: addDays(t, -24 - i), followup2At: addDays(t, -16 - i) });
  for (let i = 24; i < 60; i++) add(i, { cat: "kisker", status: i < 26 ? "valaszolt" : "elkuldve", sentAt: addDays(t, -3), city: i % 3 ? "Szeged" : "Makó" });
  for (let i = 60; i < 72; i++) add(i, { cat: "vendeglato" });
  add(72, { cat: "dekor", status: "javasolt" }); add(73, { cat: "szolg", status: "ugyfel", sentAt: addDays(t, -20) });
  add(74, { cat: "szolg", status: "lezarva", bounced: true, sentAt: addDays(t, -2) });
  add(75, { cat: "vendeglato", name: "Minta Kávéház", status: "elkuldve", sentAt: addDays(t, -4) });
  add(76, { cat: "x-ora-ekszer", catLabel: "Óra, ékszer", name: "Minta Órás", status: "valaszolt", sentAt: addDays(t, -6) });
  add(77, { cat: "sport", name: "Minta Fitness", status: "uj" });
  return {
    contacts: c,
    orders: [{ id: "o1", company: "Minta Pizzéria", item: "QR-állvány", qty: 12, total: 42000, status: "elfogadva", deadline: addDays(t, 3), date: addDays(t, -1) }],
    ledger: [
      { id: "l1", type: "bevetel", amount: 24300, date: addDays(t, -32) }, { id: "l2", type: "bevetel", amount: 110000, date: addDays(t, -5) },
      { id: "l3", type: "kiadas", amount: 96600, date: addDays(t, -70) }, { id: "l4", type: "kiadas", amount: 30000, date: addDays(t, -10) },
    ],
  };
}

function useDashboardData() {
  const [state, setState] = useState(() => ({ ...sampleData(), settings: { goal: 30, fuDays: 6 }, blocklist: { emails: [], domains: [] }, live: false }));
  const dbRef = useRef(null);
  useEffect(() => {
    let alive = true; const off = [];
    (async () => {
      let db = null;
      try { db = await window.claude?.use?.("db"); } catch (e) { db = null; }
      if (!db || !alive) return;
      dbRef.current = db;
      setState((s) => ({ ...s, contacts: [], orders: [], ledger: [], live: true }));
      const docs = (snap, idKey) => snap.docs.map((d) => ({ ...d.data(), [idKey]: d.data()[idKey] || d.id }));
      off.push(db.collection("contacts").onSnapshot((s) => setState((x) => ({ ...x, contacts: docs(s, "email") })), () => {}));
      off.push(db.collection("orders").onSnapshot((s) => setState((x) => ({ ...x, orders: docs(s, "id") })), () => {}));
      off.push(db.collection("ledger").onSnapshot((s) => setState((x) => ({ ...x, ledger: docs(s, "id") })), () => {}));
      off.push(db.doc("settings/main").onSnapshot((s) => { if (s.exists) setState((x) => ({ ...x, settings: { ...x.settings, ...s.data() } })); }, () => {}));
      off.push(db.doc("settings/blocklist").onSnapshot((s) => { if (s.exists) setState((x) => ({ ...x, blocklist: { emails: [], domains: [], ...s.data() } })); }, () => {}));
    })();
    return () => { alive = false; off.forEach((f) => typeof f === "function" && f()); };
  }, []);
  // Teljes névjegyeket ír (új vagy módosított); élő módban a pult adatbázisába, egyébként helyben.
  const saveContacts = useCallback(async (docs) => {
    const db = dbRef.current, failed = [];
    if (db) {
      for (let i = 0; i < docs.length; i += 8) {
        await Promise.all(docs.slice(i, i + 8).map(async (d) => { try { await db.collection("contacts").doc(d.email).set(d); } catch (e) { failed.push(d.email); } }));
      }
    } else {
      setState((x) => { const m = new Map(x.contacts.map((c) => [c.email, c])); docs.forEach((d) => m.set(d.email, d)); return { ...x, contacts: [...m.values()] }; });
    }
    return { ok: docs.length - failed.length, failed };
  }, []);
  return { ...state, saveContacts };
}

/* ---------- ikonok ---------- */
const PATHS = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z", list: "M4 6h16M4 12h16M4 18h10", bars: "M3 21h18M6 17V9M11 17V5M16 17v-6M21 17v-3",
  card: "M3 6h18v13H3zM3 10h18M16 15h2", target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", pen: "M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3",
  calc: "M5 3h14v18H5zM8 7h8M8 12h2M12 12h2M8 16h2M12 16h2", cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9", mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  user: "M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20c0-3.3 3.1-6 7-6s7 2.7 7 6M19 8v6M16 11h6", gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z", check: "M20 6L9 17l-5-5", clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5", sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z", upload: "M12 16V4M7 9l5-5 5 5M4 20h16", x: "M6 6l12 12M18 6L6 18",
  refresh: "M20 11a8 8 0 0 0-14.9-3.9L4 9M4 4v5h5M4 13a8 8 0 0 0 14.9 3.9L20 15M20 20v-5h-5", map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  alert: "M12 3l9.5 17h-19L12 3zM12 10v4M12 17h.01", coffee: "M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2",
  gem: "M6 3h12l3 6-9 12L3 9l3-6zM3 9h18M12 21L9 9l3-6 3 6-3 12", dumbbell: "M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10",
  gift: "M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-1.5-4-5-4-5-2s3 2 5 2c2 0 5 0 5-2s-3.5-2-5 2", left: "M15 18l-6-6 6-6", right: "M9 18l6-6-6-6",
  watch: "M9 3h6l1 4H8l1-4zM9 21h6l1-4H8l1 4zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 9.5V12l1.6 1.2",
};
const Icon = ({ name, className = "h-[18px] w-[18px]" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={PATHS[name]} /></svg>
);
const Logo = () => (
  <span className="inline-flex items-baseline font-extrabold tracking-[0.08em] text-zinc-100" aria-label="Levente 3D">
    <svg viewBox="3 3 26 28" className="mr-0.5 h-[0.78em] w-auto self-center" aria-hidden="true">
      {[3, 10.5, 18].map((y) => <rect key={y} x="3" y={y} width="8" height="5.5" rx="1.4" fill="currentColor" />)}
      <rect x="3" y="25.5" width="26" height="5.5" rx="1.4" fill={BRAND.sand} />
    </svg>
    EVENTE<span style={{ color: BRAND.sand }}>·</span>3D
  </span>
);

/* ---------- alapelemek ---------- */
const Card = ({ className = "", children, glow }) => (
  <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-none ${glow ? "dark:shadow-[0_0_48px_-18px_rgba(195,199,143,0.45)]" : ""} ${className}`}>{children}</section>
);
const CardHead = ({ title, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>{action}</div>
);
const Pill = ({ tone, children }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone] || PILL.elkuldve}`}>{children}</span>;
const GhostBtn = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c3c78f] dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500">{children}</button>
);

/* ---------- widgetek ---------- */
function StatCard({ icon, label, value, sub, progress, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c3c78f] dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-zinc-700 dark:hover:shadow-[0_0_40px_-16px_rgba(195,199,143,0.5)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#5f6239]/10 text-[#5f6239] dark:bg-[#c3c78f]/10 dark:text-[#c3c78f]"><Icon name={icon} className="h-4 w-4" /></span>
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-zinc-900 dark:text-white">{value}</div>
      {progress != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className="h-full rounded-full bg-[#5f6239] dark:bg-[#c3c78f]" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      ) : (
        <div className="mt-1 min-h-[1.25rem] text-xs text-zinc-500 dark:text-zinc-400">{sub}</div>
      )}
    </button>
  );
}

function RevenueCard({ d }) {
  const res = d.tI - d.tE;
  const mx = Math.max(1, ...d.months.map((m) => Math.max(d.inc[m] || 0, d.exp[m] || 0)));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(mx))), f = mx / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; })();
  const W = 560, H = 170, L = 56, B = 22, T = 8, iw = W - L - 8, ih = H - T - B, bw = iw / d.months.length;
  const Y = (v) => T + ih * (1 - v / nice);
  const cur = d.inc[d.months[5]] || 0, prev = d.inc[d.months[4]] || 0;
  return (
    <Card glow className="lg:col-span-2">
      <CardHead title="Bevétel és kiadás" action={<Pill tone={res >= 0 ? "ugyfel" : "bounced"}>{res >= 0 ? "Nyereséges" : "Veszteséges"}</Pill>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Összes bevétel", ft(d.tI)], ["Összes kiadás", ft(d.tE)], ["Eredmény", (res > 0 ? "+" : "") + ft(res)], ["Ebben a hónapban", ft(cur)]].map(([l, v], i) => (
          <div key={l} className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/60">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{l}</div>
            <div className={`text-lg font-bold tabular-nums ${i === 2 ? (res >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400") : "text-zinc-900 dark:text-white"}`}>{v}</div>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Havi bevétel és kiadás az elmúlt hat hónapban">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - 8} y1={Y(nice * f)} y2={Y(nice * f)} className="stroke-zinc-200 dark:stroke-zinc-800" />
            <text x={L - 8} y={Y(nice * f) + 4} textAnchor="end" className="fill-zinc-400 text-[11px]">{Math.round((nice * f) / 1000)} e Ft</text>
          </g>
        ))}
        {d.months.map((m, i) => {
          const x = L + i * bw + bw * 0.2, w = bw * 0.28, vi = d.inc[m] || 0, ve = d.exp[m] || 0;
          return (
            <g key={m}>
              <rect x={x} y={Y(vi)} width={w} height={Math.max(0, Y(0) - Y(vi))} rx="4" fill={BRAND.olive} />
              <rect x={x + w + 3} y={Y(ve)} width={w} height={Math.max(0, Y(0) - Y(ve))} rx="4" fill={BRAND.sand} fillOpacity="0.75" />
              <text x={x + w + 1.5} y={H - 6} textAnchor="middle" className="fill-zinc-400 text-[11px]">{HU_MON[+m.slice(5) - 1]}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: BRAND.olive }} />Bevétel</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: BRAND.sand }} />Kiadás</span>
        <span>Előző hónapban {ft(prev)} bevétel · {d.paid} fizetett rendelés</span>
      </div>
    </Card>
  );
}

function GaugeCard({ d }) {
  const scale = d.rate > 0.5 ? 1 : d.rate > 0.25 ? 0.5 : 0.25, N = 22, cx = 110, cy = 106, r1 = 64, r2 = 88;
  const on = Math.round(Math.min(1, d.rate / scale) * N);
  const pct = (v) => (v * 100).toLocaleString("hu-HU", { maximumFractionDigits: 1 }) + "%";
  return (
    <Card>
      <CardHead title="Válaszarány" action={<span className="text-xs text-zinc-500 dark:text-zinc-400">{d.sent} kiküldött levél</span>} />
      <svg viewBox="-18 0 256 132" className="w-full" role="img" aria-label={`Válaszarány ${pct(d.rate)}`}>
        {Array.from({ length: N }, (_, i) => {
          const a = Math.PI * (1 - (i + 0.5) / N);
          return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy - r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy - r2 * Math.sin(a)} strokeWidth="7" strokeLinecap="round" className={i < on ? "stroke-[#5f6239] dark:stroke-[#c3c78f]" : "stroke-zinc-200 dark:stroke-zinc-800"} />;
        })}
        {[0, 0.5, 1].map((f) => { const a = Math.PI * (1 - f); return <text key={f} x={cx + (r2 + 13) * Math.cos(a)} y={cy - (r2 + 13) * Math.sin(a) + 4} textAnchor="middle" className="fill-zinc-400 text-[11px]">{pct(scale * f)}</text>; })}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-zinc-900 text-[30px] font-extrabold dark:fill-white">{pct(d.rate)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">{d.rep} válasz, {d.cust} ügyfél</text>
      </svg>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">A skála 0 és {pct(scale)} között méri a válaszokat a kiküldött levelekhez képest (e-mail és DM, visszapattanók nélkül).</p>
    </Card>
  );
}

function DonutCard({ d, onOpen }) {
  const parts = [["Kiküldendő", d.st.uj || 0, BRAND.olive], ["Follow-up esedékes", d.st.fu || 0, "#f59e0b"], ["Válaszra vár", d.st.elkuldve || 0, BRAND.sand], ["Válaszolt, ügyfél", (d.st.valaszolt || 0) + (d.st.ugyfel || 0), "#34d399"], ["Lezárva", d.st.lezarva || 0, "#71717a"]];
  const tot = parts.reduce((a, p) => a + p[1], 0), C = 2 * Math.PI * 58, nz = parts.filter((p) => p[1]).length;
  let off = 0;
  return (
    <Card>
      <CardHead title="Címek állapota" action={<GhostBtn onClick={onOpen}>Címlista</GhostBtn>} />
      <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-center gap-4">
        <svg viewBox="0 0 160 160" className="w-full" role="img" aria-label="Címek állapot szerint">
          <circle cx="80" cy="80" r="58" fill="none" strokeWidth="20" className="stroke-zinc-100 dark:stroke-zinc-800" />
          {parts.filter((p) => p[1]).map((p) => {
            const len = (C * p[1]) / tot, l = Math.max(0.5, len - (nz > 1 ? 2.5 : 0));
            const el = <circle key={p[0]} cx="80" cy="80" r="58" fill="none" stroke={p[2]} strokeWidth="20" strokeDasharray={`${l} ${C - l}`} strokeDashoffset={-off} transform="rotate(-90 80 80)" />;
            off += len; return el;
          })}
          <text x="80" y="82" textAnchor="middle" className="fill-zinc-900 text-[28px] font-extrabold dark:fill-white">{tot}</text>
          <text x="80" y="100" textAnchor="middle" className="fill-zinc-400 text-[11px]">cím</text>
        </svg>
        <ul className="grid gap-1.5 text-[13px]">
          {parts.map(([l, v, c]) => (
            <li key={l} className="flex items-center justify-between gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
              <b className="tabular-nums text-zinc-900 dark:text-zinc-100">{v}</b>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function CalendarCard({ d }) {
  const [off, setOff] = useState(0);
  const td = today(), now = new Date(), base = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const y = base.getFullYear(), mo = base.getMonth(), first = (new Date(y, mo, 1).getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate();
  const up = Object.keys(d.ev).filter((x) => x >= td).sort().slice(0, 3);
  return (
    <Card>
      <CardHead title="Naptár" action={
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Előző hónap" onClick={() => setOff(off - 1)} className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:hover:text-white"><Icon name="left" className="h-3.5 w-3.5" /></button>
          <span className="min-w-[8.5rem] text-center text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{y}. {HU_MONL[mo]}</span>
          <button type="button" aria-label="Következő hónap" onClick={() => setOff(off + 1)} className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:hover:text-white"><Icon name="right" className="h-3.5 w-3.5" /></button>
        </div>} />
      <div className="grid grid-cols-7 gap-0.5 text-center text-[12.5px] tabular-nums">
        {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((x) => <div key={x} className="py-1 text-[11px] text-zinc-400">{x}</div>)}
        {Array.from({ length: first }, (_, i) => <div key={"e" + i} />)}
        {Array.from({ length: dim }, (_, i) => {
          const ds = `${y}-${pad(mo + 1)}-${pad(i + 1)}`, e = d.ev[ds], isT = ds === td;
          return (
            <div key={ds} title={e ? [e.fu && `${e.fu} follow-up`, e.ord && `${e.ord} határidő`].filter(Boolean).join(", ") : undefined}
              className={`relative rounded-lg pb-2.5 pt-1.5 ${isT ? "bg-[#5f6239] font-bold text-white dark:bg-[#c3c78f] dark:text-zinc-950" : ds < td ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}`}>
              {i + 1}
              {e && <span className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">{e.fu > 0 && <i className="h-1 w-1 rounded-full bg-amber-400" />}{e.ord > 0 && <i className="h-1 w-1 rounded-full bg-emerald-400" />}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-1.5">
        {up.length ? up.map((x) => (
          <div key={x} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] dark:bg-zinc-950/60">
            <b className="text-zinc-800 dark:text-zinc-200">{x === td ? "Ma" : huDate(x)}</b>
            <span className="flex gap-1.5">{d.ev[x].fu > 0 && <Pill tone="fu">{d.ev[x].fu} follow-up</Pill>}{d.ev[x].ord > 0 && <Pill tone="ugyfel">{d.ev[x].ord} határidő</Pill>}</span>
          </div>
        )) : <p className="text-[13px] text-zinc-500">Nincs esedékes follow-up vagy határidő.</p>}
      </div>
    </Card>
  );
}

function CategoryCard({ d }) {
  const rows = Object.entries(d.cat).filter(([, x]) => x.sent >= 3).sort((a, b) => b[1].rep / b[1].sent - a[1].rep / a[1].sent).slice(0, 6);
  const top = Math.max(1e-4, ...rows.map(([, x]) => x.rep / x.sent));
  return (
    <Card>
      <CardHead title="Kategóriák válaszaránya" action={<span className="text-xs text-zinc-500 dark:text-zinc-400">min. 3 levél</span>} />
      {rows.length ? (
        <ul className="grid gap-3">
          {rows.map(([k, x]) => {
            const r = x.rep / x.sent;
            return (
              <li key={k}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">{CATS[k] || d.catLabels[k] || k}</span>
                  <Pill tone={r >= 0.1 ? "ugyfel" : r > 0 ? "fu" : "lezarva"}>{Math.round(r * 100)}% · {x.rep}/{x.sent}</Pill>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className="h-full rounded-full bg-[#5f6239] dark:bg-[#c3c78f]" style={{ width: `${(r / top) * 100}%` }} /></div>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[13px] text-zinc-500">Egy kategóriához legalább 3 kiküldött levél kell.</p>}
    </Card>
  );
}

function TodoCard({ d }) {
  return (
    <Card className="lg:col-span-2">
      <CardHead title="Mire kell ma válaszolnod, mit kell megcsinálnod" action={<span className="text-xs text-zinc-500 dark:text-zinc-400">{d.todo.length} tétel</span>} />
      {d.todo.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {d.todo.map((t, i) => (
            <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="w-24 shrink-0"><Pill tone={t.tone}>{t.k}</Pill></span>
              <div className="min-w-0"><div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.title}</div>{t.detail && <div className="text-[13px] text-zinc-500 dark:text-zinc-400">{t.detail}</div>}</div>
            </li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-zinc-500">Most nincs semmi sürgős.</p>}
    </Card>
  );
}

function OutreachTable({ d, settings, query }) {
  const q = query.trim().toLowerCase();
  const rows = (q ? d.recent.filter((c) => [c.name, c.email, c.city].join(" ").toLowerCase().includes(q)) : d.recent).slice(0, 10);
  return (
    <Card className="lg:col-span-3">
      <CardHead title={q ? `Találatok: „${query}”` : "Legutóbbi megkeresések"} action={<a href={PULT_URL} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#5f6239] hover:underline dark:text-[#c3c78f]">Teljes címlista a pultban</a>} />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-zinc-400">
              {["Cég", "Kategória", "Város", "Állapot", "Utolsó levél", "Következő lépés"].map((h) => <th key={h} className="border-b border-zinc-200 pb-2 font-semibold dark:border-zinc-800">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const s = effStatus(c, settings), nx = fuDue(c, settings), stage = fuStage(c, settings);
              return (
                <tr key={c.email} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
                  <td className="py-2.5 pr-3"><div className="font-semibold text-zinc-900 dark:text-zinc-100">{displayName(c)}</div><div className="text-xs text-zinc-500">{isDM(c) ? "DM" : c.email}</div></td>
                  <td className="pr-3"><Pill tone="elkuldve">{catName(c)}</Pill></td>
                  <td className="pr-3 text-zinc-600 dark:text-zinc-400">{c.city}</td>
                  <td className="pr-3"><Pill tone={c.bounced ? "bounced" : s}>{c.bounced ? "Visszapattant" : s === "fu" ? `${stage}. follow-up` : STATUS[s]}</Pill></td>
                  <td className="pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">{huDate(lastActivity(c))}</td>
                  <td>{nx ? <Pill tone={nx <= today() ? "fu" : "uj"}>{nx <= today() ? "Follow-up ma" : "Follow-up " + huDate(nx)}</Pill> : <span className="text-zinc-400">–</span>}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="py-4 text-zinc-500">{q ? "Nincs találat." : "Még nem ment ki levél."}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Címlista: utánpótlás, import, szektorok, újrakörözés ---------- */
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c3c78f] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_MAIN = `${BTN} bg-[#5f6239] text-white hover:brightness-110 dark:bg-[#c3c78f] dark:text-zinc-950`;
const BTN_GHOST = `${BTN} border border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500`;
const FIELD = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#5f6239] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-[#c3c78f]";

function catOptionsOf(contacts) {
  const m = new Map(Object.entries(CATS));
  SECTORS.forEach((s) => s.catLabel && m.set(s.cat, s.catLabel));
  contacts.forEach((c) => c.catLabel && !m.has(c.cat) && m.set(c.cat, c.catLabel));
  return [...m.entries()];
}

function ImportModal({ preset, contacts, blocklist, saveContacts, onClose, onDone }) {
  const opts = useMemo(() => catOptionsOf(contacts), [contacts]);
  const [text, setText] = useState("");
  const [file, setFile] = useState("");
  const [defCat, setDefCat] = useState(preset ? preset.cat : "egyeb");
  const [city, setCity] = useState("Szeged");
  const [status, setStatus] = useState("uj");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k); box.current?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  const parsed = useMemo(() => parseLeads(text), [text]);
  const items = useMemo(() => {
    const lbl = opts.find(([k]) => k === defCat)?.[1];
    const def = { cat: defCat, catLabel: CATS[defCat] ? undefined : lbl, sector: preset && preset.cat === defCat ? preset.id : undefined };
    const source = `Import (${file || "beillesztés"}), ${huDate(today())}`;
    return prepareImport(parsed.rows, { contacts, blocklist, def, city: city.trim(), status, source });
  }, [parsed, contacts, blocklist, defCat, city, status, file, opts, preset]);
  const counts = items.reduce((m, x) => ((m[x.state] = (m[x.state] || 0) + 1), m), {});
  const ok = items.filter((x) => x.state === "ok");

  const readFile = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setText(String(r.result || "")); setFile(f.name); setErr(""); };
    r.onerror = () => setErr("A fájl nem olvasható.");
    r.readAsText(f, "utf-8");
  };
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const res = await saveContacts(ok.map((x) => x.doc));
      if (res.failed.length) setErr(`${res.failed.length} cím mentése nem sikerült: ${res.failed.slice(0, 3).join(", ")}${res.failed.length > 3 ? "…" : ""}`);
      else { onDone(`${res.ok} új cím felvéve${status === "javasolt" ? " jóváhagyásra" : " a kiküldendők közé"}.`); onClose(); }
    } catch (e) { setErr("Mentési hiba: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="l3d-imp-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#5f6239]/10 text-[#5f6239] dark:bg-[#c3c78f]/10 dark:text-[#c3c78f]"><Icon name={preset ? preset.icon : "upload"} className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="l3d-imp-title" className="text-base font-bold text-zinc-900 dark:text-white">Címek importálása{preset ? ` · ${preset.label}` : ""}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">CSV vagy JSON. A meglévő címek, az azonos cégdomain és a tiltólista kimarad.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Bezárás" className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"><Icon name="x" className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 hover:border-[#5f6239] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-[#c3c78f]"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]); }}>
              <Icon name="upload" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate">{file ? <b className="text-zinc-900 dark:text-zinc-100">{file}</b> : "Fájl kiválasztása vagy ide húzása (.csv, .json, .txt)"}</span>
              <input type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
            </label>
            <button type="button" className={BTN_GHOST} onClick={() => { setText(SAMPLE_CSV); setFile(""); }}>Minta beillesztése</button>
          </div>
          <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Vagy illeszd be ide (fejléccel vagy anélkül: email; név; kategória; város)
            <textarea value={text} onChange={(e) => { setText(e.target.value); setFile(""); }} rows={5} spellCheck={false} placeholder={"email;név;kategória;város\ninfo@kavezo.hu;Kávézó Kft.;Kávézók;Szeged"} className={`${FIELD} font-mono text-[12.5px]`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Kategória, ha a sorban nincs
              <select value={defCat} onChange={(e) => setDefCat(e.target.value)} className={FIELD}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Város, ha a sorban nincs
              <input value={city} onChange={(e) => setCity(e.target.value)} className={FIELD} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Felvétel mint
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD}><option value="uj">Kiküldendő</option><option value="javasolt">Javasolt (jóváhagyásra vár)</option></select>
            </label>
          </div>
          {parsed.err && <p className="text-sm text-rose-600 dark:text-rose-400">{parsed.err}</p>}

          {items.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap gap-1.5">{Object.entries(IMPORT_STATE).filter(([k]) => counts[k]).map(([k, [tone, l]]) => <Pill key={k} tone={tone}>{l}: {counts[k]}</Pill>)}</div>
              <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-400 dark:bg-zinc-950">
                    <tr>{["Cím", "Név", "Kategória", "Város", "Állapot"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 200).map((x, i) => (
                      <tr key={i} className={`border-t border-zinc-100 dark:border-zinc-800/70 ${x.state === "ok" ? "" : "opacity-60"}`}>
                        <td className="max-w-[200px] truncate px-3 py-1.5 font-medium text-zinc-900 dark:text-zinc-100">{x.doc ? (x.doc.channel === "dm" ? `DM · ${x.doc.fb || x.doc.ig}` : x.doc.email) : x.r.email || "–"}</td>
                        <td className="max-w-[160px] truncate px-3 text-zinc-600 dark:text-zinc-400">{x.r.name || "–"}</td>
                        <td className="px-3">{x.doc ? <span className="whitespace-nowrap text-zinc-600 dark:text-zinc-400">{catName(x.doc)}</span> : "–"}</td>
                        <td className="px-3 text-zinc-600 dark:text-zinc-400">{x.doc?.city || "–"}</td>
                        <td className="px-3"><span title={x.why}><Pill tone={IMPORT_STATE[x.state][0]}>{x.why || IMPORT_STATE[x.state][1]}</Pill></span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {items.length > 200 && <p className="mt-1 text-xs text-zinc-500">Az előnézet az első 200 sort mutatja, a felvétel mindet érinti.</p>}
            </div>
          )}
          {err && <p className="text-sm text-rose-600 dark:text-rose-400">{err}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <span className="mr-auto text-xs text-zinc-500 dark:text-zinc-400">{items.length ? `${items.length} sorból ${ok.length} vehető fel` : "Még nincs beolvasott sor"}</span>
          <button type="button" className={BTN_GHOST} onClick={onClose} disabled={busy}>Mégse</button>
          <button type="button" className={BTN_MAIN} onClick={submit} disabled={busy || !ok.length}>{busy ? "Mentés…" : `${ok.length} cím felvétele`}</button>
        </div>
      </div>
    </div>
  );
}

const LEAD_FILTERS = [
  ["all", "Mind"], ["uj", "Kiküldendő"], ["fu", "Follow-up"], ["cold", "Utánkövetés"], ["javasolt", "Javasolt"], ["valaszolt", "Válaszolt"], ["ugyfel", "Ügyfél"], ["lezarva", "Lezárva"],
];

function MiniStat({ label, value, tone, onClick, active }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c3c78f] ${active ? "border-[#5f6239] dark:border-[#c3c78f]" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"}`}>
      <Pill tone={tone}>{label}</Pill>
      <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-white">{value}</div>
    </button>
  );
}

function LeadsView({ data, d, query, autoRecycle, setAutoRecycle }) {
  const { contacts, settings, blocklist, saveContacts } = data;
  const [filter, setFilter] = useState("all");
  const [sector, setSector] = useState("");
  const [catF, setCatF] = useState("");
  const [cityF, setCityF] = useState("");
  const [limit, setLimit] = useState(50);
  const [modal, setModal] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const tableRef = useRef(null);
  useEffect(() => setLimit(50), [filter, sector, catF, cityF, query]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 6000); return () => clearTimeout(t); }, [msg]);

  const uj = d.st.ujE, runway = d.goal ? uj / d.goal : 0, coldSet = useMemo(() => new Set(d.cold.map((c) => c.email)), [d.cold]);
  const pool = useMemo(() => contacts.filter((c) => c.status !== "elvetve"), [contacts]);
  const sectorStats = useMemo(() => SECTORS.map((s) => {
    const list = pool.filter((c) => sectorMatch(c, s)), sent = list.filter((c) => c.sentAt && !c.bounced);
    return { s, n: list.length, uj: list.filter((c) => effStatus(c, settings) === "uj").length, sent: sent.length, rep: sent.filter(didReply).length };
  }), [pool, settings]);
  const cats = useMemo(() => catOptionsOf(contacts).filter(([k]) => pool.some((c) => c.cat === k)), [contacts, pool]);
  const cities = useMemo(() => [...new Set(pool.map((c) => c.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hu")), [pool]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase(), sec = SECTORS.find((s) => s.id === sector);
    const match = (c) => {
      const s = effStatus(c, settings);
      if (filter === "cold") return coldSet.has(c.email);
      if (filter === "valaszolt") return s === "valaszolt";
      if (filter !== "all" && s !== filter) return false;
      return true;
    };
    return pool
      .filter((c) => match(c) && (!sec || sectorMatch(c, sec)) && (!catF || c.cat === catF) && (!cityF || c.city === cityF)
        && (!q || [c.name, c.email, c.city, catName(c), c.fb, c.ig].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (filter === "cold" ? lastActivity(a).localeCompare(lastActivity(b)) : lastActivity(b).localeCompare(lastActivity(a)) || displayName(a).localeCompare(displayName(b), "hu")));
  }, [pool, filter, sector, catF, cityF, query, settings, coldSet]);

  const save = async (docs, done) => {
    if (!docs.length) return;
    setBusy(true);
    try {
      const res = await saveContacts(docs);
      setMsg(res.failed.length ? `${res.failed.length} cím mentése nem sikerült.` : done(res.ok));
    } catch (e) { setMsg("Mentési hiba: " + e.message); }
    setBusy(false);
  };
  const recycle = (list) => save(list.filter((c) => !isBlocked(c, blocklist)).map(recycleDoc), (n) => `${n} cím visszakerült a kiküldendők közé.`);
  const focusTable = (f, sec = "") => { setFilter(f); setSector(sec); setCatF(""); setCityF(""); tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <div className="grid grid-cols-1 gap-4">
      {msg && <div role="status" className="rounded-xl border border-[#5f6239]/30 bg-[#5f6239]/10 px-4 py-2.5 text-[13px] font-medium text-[#3f4126] dark:border-[#c3c78f]/25 dark:bg-[#c3c78f]/10 dark:text-[#d9dcae]">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className={runway < 1 ? "border-amber-300 dark:border-amber-400/30" : ""}>
          <CardHead title="Címkészlet" action={<Pill tone={runway >= 3 ? "ugyfel" : runway >= 1 ? "fu" : "bounced"}>{runway >= 10 ? "10+ nap" : `${runway.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} nap`}</Pill>} />
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Kiküldendő" value={uj} tone="uj" onClick={() => focusTable("uj")} active={filter === "uj"} />
            <MiniStat label="Javasolt" value={d.nJ} tone="javasolt" onClick={() => focusTable("javasolt")} active={filter === "javasolt"} />
            <MiniStat label="Follow-up" value={d.st.fu || 0} tone="fu" onClick={() => focusTable("fu")} active={filter === "fu"} />
            <MiniStat label="Utánkövetés" value={d.cold.length} tone="cold" onClick={() => focusTable("cold")} active={filter === "cold"} />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className={`h-full rounded-full ${runway >= 3 ? "bg-[#5f6239] dark:bg-[#c3c78f]" : "bg-amber-500 dark:bg-amber-400"}`} style={{ width: `${Math.min(100, (runway / 5) * 100)}%` }} /></div>
          <p className="mt-2 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            {runway >= 3 ? `A napi ${d.goal} levéllel ${Math.floor(runway)} napra elég a kiküldendő cím.` : (
              <span className="inline-flex items-start gap-1.5 text-amber-700 dark:text-amber-300"><Icon name="alert" className="mt-px h-4 w-4 shrink-0" />{uj ? `Napi ${d.goal} levélhez kevés: importálj, vagy köröztesd újra a hideg címeket.` : "Elfogyott a kiküldendő cím: importálj, vagy köröztesd újra a hideg címeket."}</span>
            )}
          </p>
        </Card>

        <Card>
          <CardHead title="Utánkövetés" action={<span className="text-xs text-zinc-500 dark:text-zinc-400">{RECYCLE_DAYS}+ napja csend</span>} />
          {d.cold.length ? (
            <ul className="grid gap-1.5">
              {d.cold.slice(0, 4).map((c) => (
                <li key={c.email} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-[13px] dark:bg-zinc-950/60">
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{displayName(c)}</div><div className="truncate text-xs text-zinc-500">{catName(c)} · {coldDays(c)} napja</div></div>
                  <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => recycle([c])} aria-label={`${displayName(c)} újrakörözése`}><Icon name="refresh" className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Nincs hideg cím. Ami {RECYCLE_DAYS} napja válasz nélkül áll, itt jelenik meg.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {d.cold.length > 0 && (confirmAll ? (
              <>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{d.cold.length} cím vissza a sorba?</span>
                <button type="button" className={BTN_MAIN} disabled={busy} onClick={() => { setConfirmAll(false); recycle(d.cold); }}>Igen</button>
                <button type="button" className={BTN_GHOST} onClick={() => setConfirmAll(false)}>Mégse</button>
              </>
            ) : <button type="button" className={BTN_MAIN} disabled={busy} onClick={() => setConfirmAll(true)}><Icon name="refresh" className="h-3.5 w-3.5" />Mind újrakörözése ({d.cold.length})</button>)}
            {d.cold.length > 4 && !confirmAll && <button type="button" className={BTN_GHOST} onClick={() => focusTable("cold")}>Lista</button>}
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-zinc-100 pt-3 text-[12.5px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <input type="checkbox" checked={autoRecycle} onChange={(e) => setAutoRecycle(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5f6239] dark:accent-[#c3c78f]" />
            <span><b className="text-zinc-800 dark:text-zinc-200">Automatikus feltöltés:</b> ha a kiküldendő a napi cél alá esik, naponta egyszer a legrégebbi hideg címek visszakerülnek a sorba.</span>
          </label>
        </Card>

        <Card glow>
          <CardHead title="Új címek importálása" />
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400">Szegedi boltok, kávézók, órások listája CSV-ből vagy JSON-ból. Felvétel előtt látod, mi kerül be.</p>
          <ul className="mt-3 grid gap-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            {["Meglévő cím és azonos cégdomain kimarad", "Tiltólistás cím nem kerül be", "E-mail nélkül, FB/IG-vel DM-címként jön"].map((t) => <li key={t} className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-[#5f6239] dark:text-[#c3c78f]" />{t}</li>)}
          </ul>
          <button type="button" className={`${BTN_MAIN} mt-4 w-full py-2 text-sm`} onClick={() => setModal({})}><Icon name="upload" className="h-4 w-4" />Importálás (CSV / JSON)</button>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sectorStats.map(({ s, n, uj: su, sent, rep }) => (
          <Card key={s.id} className={sector === s.id ? "ring-2 ring-[#5f6239] dark:ring-[#c3c78f]" : ""}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#5f6239]/10 text-[#5f6239] dark:bg-[#c3c78f]/10 dark:text-[#c3c78f]"><Icon name={s.icon} className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{s.label}</h3><div className="text-xs text-zinc-500">Szeged · {n} cím</div></div>
              {n === 0 && <Pill tone="javasolt">Új szektor</Pill>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone="uj">{su} kiküldendő</Pill>
              <Pill tone={sent ? (rep ? "valaszolt" : "elkuldve") : "lezarva"}>{sent ? `${Math.round((rep / sent) * 100)}% válasz · ${rep}/${sent}` : "még nincs levél"}</Pill>
            </div>
            <p className="mt-2.5 min-h-[2.5rem] text-[12.5px] text-zinc-500 dark:text-zinc-400">{s.pitch}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {s.queries.map((q) => <a key={q} href={mapsUrl(q)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#5f6239] hover:underline dark:text-[#c3c78f]"><Icon name="map" className="h-3.5 w-3.5" />{q}</a>)}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className={`${BTN_GHOST} flex-1`} onClick={() => (sector === s.id ? setSector("") : focusTable("all", s.id))}>{sector === s.id ? "Szűrő ki" : "Szűrés"}</button>
              <button type="button" className={`${BTN_MAIN} flex-1`} onClick={() => setModal({ preset: s })}><Icon name="upload" className="h-3.5 w-3.5" />Import ide</button>
            </div>
          </Card>
        ))}
      </div>

      <div ref={tableRef} className="scroll-mt-4">
        <Card>
          <CardHead title={query.trim() ? `Címlista · „${query.trim()}”` : "Címlista"} action={<span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{rows.length} cím</span>} />
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {LEAD_FILTERS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c3c78f] ${filter === k ? "bg-[#5f6239] text-white dark:bg-[#c3c78f] dark:text-zinc-950" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"}`}>
                {l}{k === "cold" && d.cold.length ? ` · ${d.cold.length}` : ""}
              </button>
            ))}
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Szektor" className={FIELD}><option value="">Minden szektor</option>{SECTORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <select value={catF} onChange={(e) => setCatF(e.target.value)} aria-label="Kategória" className={FIELD}><option value="">Minden kategória</option>{cats.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={cityF} onChange={(e) => setCityF(e.target.value)} aria-label="Város" className={FIELD}><option value="">Minden város</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-zinc-400">
                  {["Cég", "Kategória", "Város", "Állapot", "Utolsó levél", ""].map((h, i) => <th key={i} className="border-b border-zinc-200 pb-2 font-semibold dark:border-zinc-800">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((c) => {
                  const s = effStatus(c, settings), cd = coldSet.has(c.email) ? coldDays(c) : null;
                  return (
                    <tr key={c.email} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
                      <td className="py-2.5 pr-3"><div className="font-semibold text-zinc-900 dark:text-zinc-100">{displayName(c)}</div><div className="text-xs text-zinc-500">{isDM(c) ? `DM${c.fb ? " · FB" : ""}${c.ig ? " · IG" : ""}` : c.email}{c.recycleCount ? ` · ${c.recycleCount}. kör` : ""}</div></td>
                      <td className="pr-3"><Pill tone="elkuldve">{catName(c)}</Pill></td>
                      <td className="pr-3 text-zinc-600 dark:text-zinc-400">{c.city}</td>
                      <td className="pr-3">
                        <Pill tone={c.bounced ? "bounced" : cd != null ? "cold" : s}>{c.bounced ? "Visszapattant" : cd != null ? `Utánkövetés · ${cd} napja` : s === "fu" ? `${fuStage(c, settings)}. follow-up` : STATUS[s]}</Pill>
                      </td>
                      <td className="pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">{huDate(lastActivity(c)) || "–"}</td>
                      <td className="text-right">
                        {cd != null ? <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => recycle([c])}><Icon name="refresh" className="h-3.5 w-3.5" />Újrakörözés</button>
                          : s === "javasolt" ? <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => save([{ ...c, status: "uj" }], () => `${displayName(c)} a kiküldendők közé került.`)}><Icon name="check" className="h-3.5 w-3.5" />Jóváhagyás</button>
                          : null}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={6} className="py-4 text-zinc-500">Nincs a szűrésnek megfelelő cím.</td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > limit && <div className="mt-3 text-center"><GhostBtn onClick={() => setLimit(limit + 100)}>Továbbiak ({rows.length - limit})</GhostBtn></div>}
        </Card>
      </div>

      {modal && <ImportModal preset={modal.preset} contacts={contacts} blocklist={blocklist} saveContacts={saveContacts} onClose={() => setModal(null)} onDone={setMsg} />}
    </div>
  );
}

/* ---------- váz ---------- */
const NAV = [
  ["Főmenü", [["todo", "Áttekintés", "grid"], ["queue", "Címlista", "list"], ["cov", "Lefedettség", "bars"], ["orders", "Rendelések", "card"], ["goals", "Célok", "target"]]],
  ["Eszközök", [["plan", "Tervező", "pen"], ["calc", "Árkalkulátor", "calc"], ["gen", "3D-generátor", "cube"], ["watch", "Óratartó-generátor", "watch"], ["tpl", "Sablonok", "mail"], ["add", "Új címek", "user"]]],
  ["Általános", [["set", "Beállítások", "gear"]]],
];

function Sidebar({ tab, setTab, badges, d }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-zinc-800 bg-zinc-900 px-3 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:flex">
      <div className="px-3 pb-4"><div className="text-xl"><Logo /></div><div className="mt-0.5 text-xs text-zinc-500">Kampánypult</div></div>
      <nav className="flex-1 overflow-y-auto" aria-label="Menü">
        {NAV.map(([group, items]) => (
          <div key={group} className="mb-2">
            <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{group}</div>
            {items.map(([k, label, ic]) => {
              const act = tab === k;
              return (
                <button key={k} type="button" onClick={() => setTab(k)} aria-current={act ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c3c78f] ${act ? "bg-[#c3c78f] text-zinc-950 shadow-[0_0_28px_-8px_rgba(195,199,143,0.7)]" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"}`}>
                  <Icon name={ic} /><span className="flex-1">{label}</span>
                  {badges[k] > 0 && <span className={`rounded-full px-2 py-px text-[11px] font-bold tabular-nums ${act ? "bg-zinc-950/15 text-zinc-950" : "bg-amber-400/15 text-amber-300"}`}>{badges[k]}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="text-sm font-semibold text-zinc-100">Mai cél</div>
        <div className="mt-1 text-xs text-zinc-400">{d.ma} / {d.goal} levél ment ki ma</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-[#c3c78f]" style={{ width: `${Math.min(100, (d.ma / d.goal) * 100)}%` }} /></div>
        <a href={PULT_URL} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-lg bg-[#c3c78f] px-3 py-2 text-center text-xs font-bold text-zinc-950 hover:brightness-110">Kiküldés a pultban</a>
      </div>
    </aside>
  );
}

function MobileNav({ tab, setTab }) {
  return (
    <nav className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50/90 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:hidden" aria-label="Menü">
      {NAV.flatMap(([, items]) => items).map(([k, label, ic]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === k ? "bg-[#5f6239] text-white dark:bg-[#c3c78f] dark:text-zinc-950" : "text-zinc-500 dark:text-zinc-400"}`}>
          <Icon name={ic} className="h-4 w-4" />{label}
        </button>
      ))}
    </nav>
  );
}

function ElsewherePanel({ label }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{label}</h3>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Ez a modul a meglévő kampánypultban fut tovább (küldés, szerkesztés, generátor). Az adatai ugyanazok, mint itt.</p>
      <a href={PULT_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-lg bg-[#5f6239] px-4 py-2 text-sm font-semibold text-white dark:bg-[#c3c78f] dark:text-zinc-950">Megnyitás a pultban</a>
    </Card>
  );
}

export default function LeventeDashboard() {
  const data = useDashboardData();
  const d = useDerived(data);
  const [tab, setTab] = useState("todo");
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("l3d-theme") !== "light"; } catch (e) { return true; } });
  useEffect(() => { try { localStorage.setItem("l3d-theme", dark ? "dark" : "light"); } catch (e) { /* tárolás nélkül is működik */ } }, [dark]);
  const [autoRecycle, setAutoRecycle] = useState(() => { try { return localStorage.getItem("l3d-autorecycle") === "1"; } catch (e) { return false; } });
  useEffect(() => { try { localStorage.setItem("l3d-autorecycle", autoRecycle ? "1" : "0"); } catch (e) { /* tárolás nélkül is működik */ } }, [autoRecycle]);

  // Automatikus feltöltés: ha a kiküldendő a napi cél alá esik, naponta egyszer a legrégebbi hideg címek visszakerülnek a sorba.
  const autoDay = useRef("");
  const { saveContacts, live } = data;
  useEffect(() => {
    const need = d.goal - d.st.ujE, td = today();
    if (!autoRecycle || need <= 0 || !d.cold.length) return;
    let last = autoDay.current;
    if (live) { try { last = localStorage.getItem("l3d-autorecycle-day") || last; } catch (e) { /* csak a munkamenetre */ } }
    if (last === td) return;
    autoDay.current = td;
    if (live) { try { localStorage.setItem("l3d-autorecycle-day", td); } catch (e) { /* csak a munkamenetre */ } }
    saveContacts(d.cold.slice(0, need).map(recycleDoc));
  }, [autoRecycle, live, d.cold, d.goal, d.st.ujE, saveContacts]);

  const badges = { todo: d.todo.length, queue: (d.st.uj || 0) + (d.st.fu || 0), orders: d.openOrders };
  const label = NAV.flatMap(([, i]) => i).find(([k]) => k === tab)?.[1];
  const sel = (t) => () => setTab(t);
  const dateLine = new Date().toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-zinc-50 font-['Inter',system-ui,sans-serif] text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <Sidebar tab={tab} setTab={setTab} badges={badges} d={d} />
        <main className="min-w-0 pb-12 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:ml-64 lg:pl-8 lg:pr-8">
          <MobileNav tab={tab} setTab={setTab} />
          <header className="mb-5 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Szia, Levente!</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{dateLine} · {d.st.ujE} kiküldendő e-mail, {d.st.fuE} esedékes follow-up{d.st.dmq ? `, ${d.st.dmq} DM` : ""}{d.nJ ? `, ${d.nJ} javaslat` : ""}</p>
            </div>
            <form role="search" onSubmit={(e) => { e.preventDefault(); if (tab !== "queue") setTab("todo"); }} className="flex w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 focus-within:outline focus-within:outline-2 focus-within:outline-[#c3c78f] dark:border-zinc-800 dark:bg-zinc-900 sm:w-72">
              <Icon name="search" className="h-4 w-4 text-zinc-400" />
              <input type="search" id="l3d-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cég, e-mail vagy város" aria-label="Keresés a megkeresések között" className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-zinc-400" />
            </form>
            <button type="button" onClick={() => setDark(!dark)} aria-label={dark ? "Világos téma" : "Sötét téma"} className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#5f6239] font-bold text-white dark:bg-[#c3c78f] dark:text-zinc-950">L</span>
              <div className="text-[13px] leading-tight"><b className="text-zinc-900 dark:text-white">Levente</b><div className="text-zinc-500">levente3d.szeged@gmail.com</div></div>
            </div>
          </header>

          {!data.live && (
            <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              Mintaadatok: ez a nézet nem éri el a pult adatbázisát. A pult artifactjában futtatva a saját számaid jelennek meg.
            </div>
          )}

          {tab === "watch" ? (
            <Suspense fallback={<Card><p className="text-sm text-zinc-500 dark:text-zinc-400">Az óratartó-generátor betöltése…</p></Card>}>
              <WatchStandGenerator className="rounded-2xl" />
            </Suspense>
          ) : tab === "queue" ? (
            <LeadsView data={data} d={d} query={query} autoRecycle={autoRecycle} setAutoRecycle={setAutoRecycle} />
          ) : tab !== "todo" ? <ElsewherePanel label={label} /> : (
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard icon="send" label="Kiküldendő e-mail" value={d.st.ujE} sub={[d.st.dmUj ? `+ ${d.st.dmUj} cég DM-re vár` : "", d.nJ ? `${d.nJ} javaslat` : ""].filter(Boolean).join(" · ")} onClick={sel("queue")} />
                <StatCard icon="check" label="Ma elküldve" value={`${d.ma} / ${d.goal}`} progress={d.ma / d.goal} onClick={sel("queue")} />
                <StatCard icon="clock" label="Follow-up" value={d.st.fuE} sub={[d.st.fuE ? (d.f2 ? `${d.st.fuE - d.f2} első, ${d.f2} második kör` : "első kör") : "nincs esedékes", d.st.dmFu ? `+ ${d.st.dmFu} DM` : ""].filter(Boolean).join(" · ")} onClick={sel("queue")} />
                <StatCard icon="chat" label="Válaszok" value={(d.st.valaszolt || 0) + (d.st.ugyfel || 0)} sub={d.sent ? `${(d.rate * 100).toLocaleString("hu-HU", { maximumFractionDigits: 1 })}% válaszarány` : ""} onClick={sel("queue")} />
                <StatCard icon="user" label="Összes cím" value={d.active.length} sub={`${new Set(d.active.map((c) => c.cat)).size} kategória`} onClick={sel("cov")} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <RevenueCard d={d} />
                <GaugeCard d={d} />
                <DonutCard d={d} onOpen={sel("queue")} />
                <CalendarCard d={d} />
                <CategoryCard d={d} />
                <TodoCard d={d} />
                <Card glow>
                  <CardHead title="Rendelések" action={<Pill tone={d.openOrders ? "fu" : "lezarva"}>{d.openOrders} nyitott</Pill>} />
                  <div className="grid gap-2 text-[13px]">
                    {data.orders.filter((o) => o.status !== "elveszett").slice(0, 5).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-950/60">
                        <div className="min-w-0"><div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{o.company}</div><div className="truncate text-xs text-zinc-500">{o.qty ? `${o.qty} db ` : ""}{o.item}</div></div>
                        <div className="text-right"><div className="font-bold tabular-nums">{ft(o.total)}</div>{o.deadline && <Pill tone="fu">{huDate(o.deadline)}</Pill>}</div>
                      </div>
                    ))}
                    {!data.orders.length && <p className="text-zinc-500">Még nincs rendelés.</p>}
                  </div>
                </Card>
                <OutreachTable d={d} settings={data.settings} query={query} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
