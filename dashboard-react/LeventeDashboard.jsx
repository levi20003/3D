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
import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";

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

function useDerived({ contacts, orders, ledger, settings }) {
  return useMemo(() => {
    const td = today();
    const st = {}; let ma = 0;
    for (const c of contacts) {
      const s = effStatus(c, settings); st[s] = (st[s] || 0) + 1;
      if (isDM(c) && (s === "uj" || s === "fu")) st.dmq = (st.dmq || 0) + 1;
      if (c.sentAt === td || c.followupAt === td || c.followup2At === td) ma++;
    }
    const sentList = contacts.filter((c) => (c.status || "uj") !== "uj" && c.sentAt && !c.bounced && !/^Ugyanaz a cég/i.test(c.note || ""));
    const sent = sentList.length, rep = sentList.filter(didReply).length, cust = sentList.filter((c) => c.status === "ugyfel").length;
    const active = contacts.filter((c) => !["javasolt", "elvetve"].includes(c.status));
    const f2 = contacts.filter((c) => fuStage(c, settings) === 2).length;

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

    const goal = +settings.goal || 30, uj = st.uj || 0, fu = st.fu || 0, nJ = st.javasolt || 0;
    const sentToday = ma, left = Math.max(0, goal - sentToday), fuToday = Math.min(fu, left), ujToday = Math.min(uj, left - fuToday);
    const todo = [];
    if (nJ) todo.push({ k: "Új címek", tone: "javasolt", title: `${nJ} új cím vár jóváhagyásra`, detail: "A napi keresés találta őket. Nézd át a forrást, és hagyd jóvá, amit érdemes megkeresni." });
    if (fu) todo.push({ k: "Follow-up", tone: "fu", title: `${fu} follow-up esedékes${fu > fuToday ? ` · ma ${fuToday} belőle` : ""}`, detail: "Kategóriára szabott emlékeztető a levél szálában (6 nap után), majd egy rövid utolsó levél (+8 nap)." });
    if (uj && sentToday < goal) todo.push({ k: "Kiküldés", tone: "uj", title: `Mai kiküldés: ${sentToday} / ${Math.min(goal, uj + sentToday)}${fu && ujToday < uj ? (ujToday ? ` · ma ${ujToday} jut rá` : " · holnap jön") : ""}`, detail: `${uj} cím vár kiküldésre. Egyenként, csatolmány nélkül.` });
    if (st.dmq) todo.push({ k: "DM", tone: "valaszolt", title: `${st.dmq} cég vár DM-re`, detail: "Facebookon vagy Instagramon érhetők el. A pult kimásolja a cégre szabott üzenetet." });
    for (const o of orders) {
      if (o.status === "keres") todo.push({ k: "Ajánlat", tone: "fu", title: `Ajánlatkérés érkezett: ${o.company}`, detail: `${o.item || ""}${o.qty ? " · " + o.qty + " db" : ""}` });
      if (o.status === "ajanlat" && daysSince(o.date) >= 3) todo.push({ k: "Ajánlat", tone: "fu", title: `Kérdezz rá az ajánlatra: ${o.company}`, detail: `${o.item} · ${ft(o.total)} · ${daysSince(o.date)} napja nyitott` });
      if (o.status === "elfogadva" || o.status === "gyartas") todo.push({ k: "Gyártás", tone: "ugyfel", title: `Gyártsd le és add át: ${o.company}`, detail: `${o.qty} db ${o.item}${o.deadline ? " · határidő: " + huDate(o.deadline) : ""}` });
      if (o.status === "atadva") todo.push({ k: "Pénz", tone: "ugyfel", title: `Fizetés rendezése: ${o.company}`, detail: ft(o.total) });
      if (o.status === "fizetve" && !o.thanksDone) todo.push({ k: "Köszönet", tone: "valaszolt", title: `Köszönd meg és kérj véleményt: ${o.company}`, detail: o.item || "" });
    }

    return {
      st, ma, goal, sent, rep, cust, rate: sent ? rep / sent : 0, active, f2, nJ, cat, months, inc, exp, tI, tE, ev, todo,
      openOrders: orders.filter((o) => ["keres", "ajanlat", "elfogadva", "gyartas"].includes(o.status)).length,
      paid: orders.filter((o) => o.status === "fizetve").length,
      recent: [...contacts].filter(lastActivity).sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))),
    };
  }, [contacts, orders, ledger, settings]);
}

/* ---------- adatforrás: a pult adatbázisa, különben jelölt mintaadat ---------- */
function sampleData() {
  const t = today(), c = [];
  const add = (i, o) => c.push({ email: `info@minta${i}.hu`, name: `Minta cég ${i}`, city: "Szeged", status: "uj", sentAt: "", ...o });
  for (let i = 0; i < 24; i++) add(i, { cat: "nyomda", status: i < 4 ? "valaszolt" : "elkuldve", sentAt: addDays(t, -9) });
  for (let i = 24; i < 60; i++) add(i, { cat: "kisker", status: i < 26 ? "valaszolt" : "elkuldve", sentAt: addDays(t, -3), city: i % 3 ? "Szeged" : "Makó" });
  for (let i = 60; i < 72; i++) add(i, { cat: "vendeglato" });
  add(72, { cat: "dekor", status: "javasolt" }); add(73, { cat: "szolg", status: "ugyfel", sentAt: addDays(t, -20) });
  add(74, { cat: "szolg", status: "lezarva", bounced: true, sentAt: addDays(t, -2) });
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
  const [state, setState] = useState(() => ({ ...sampleData(), settings: { goal: 30, fuDays: 6 }, live: false }));
  useEffect(() => {
    let alive = true; const off = [];
    (async () => {
      let db = null;
      try { db = await window.claude?.use?.("db"); } catch (e) { db = null; }
      if (!db || !alive) return;
      setState((s) => ({ ...s, contacts: [], orders: [], ledger: [], live: true }));
      const docs = (snap, idKey) => snap.docs.map((d) => ({ ...d.data(), [idKey]: d.data()[idKey] || d.id }));
      off.push(db.collection("contacts").onSnapshot((s) => setState((x) => ({ ...x, contacts: docs(s, "email") })), () => {}));
      off.push(db.collection("orders").onSnapshot((s) => setState((x) => ({ ...x, orders: docs(s, "id") })), () => {}));
      off.push(db.collection("ledger").onSnapshot((s) => setState((x) => ({ ...x, ledger: docs(s, "id") })), () => {}));
      off.push(db.doc("settings/main").onSnapshot((s) => { if (s.exists) setState((x) => ({ ...x, settings: { ...x.settings, ...s.data() } })); }, () => {}));
    })();
    return () => { alive = false; off.forEach((f) => typeof f === "function" && f()); };
  }, []);
  return state;
}

/* ---------- ikonok ---------- */
const PATHS = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z", list: "M4 6h16M4 12h16M4 18h10", bars: "M3 21h18M6 17V9M11 17V5M16 17v-6M21 17v-3",
  card: "M3 6h18v13H3zM3 10h18M16 15h2", target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", pen: "M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3",
  calc: "M5 3h14v18H5zM8 7h8M8 12h2M12 12h2M8 16h2M12 16h2", cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9", mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  user: "M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20c0-3.3 3.1-6 7-6s7 2.7 7 6M19 8v6M16 11h6", gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z", check: "M20 6L9 17l-5-5", clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5", sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z", left: "M15 18l-6-6 6-6", right: "M9 18l6-6-6-6",
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
                  <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">{CATS[k] || k}</span>
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
                  <td className="pr-3"><Pill tone="elkuldve">{CATS[c.cat] || c.cat || "–"}</Pill></td>
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
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{dateLine} · {d.st.uj || 0} kiküldendő cím, {d.st.fu || 0} esedékes follow-up{d.nJ ? `, ${d.nJ} javaslat` : ""}</p>
            </div>
            <form role="search" onSubmit={(e) => { e.preventDefault(); setTab("todo"); }} className="flex w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 focus-within:outline focus-within:outline-2 focus-within:outline-[#c3c78f] dark:border-zinc-800 dark:bg-zinc-900 sm:w-72">
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
          ) : tab !== "todo" ? <ElsewherePanel label={label} /> : (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard icon="send" label="Kiküldendő" value={d.st.uj || 0} sub={d.nJ ? `${d.nJ} javaslat vár jóváhagyásra` : d.st.dmq ? `${d.st.dmq} cég DM-re vár` : ""} onClick={sel("queue")} />
                <StatCard icon="check" label="Ma elküldve" value={`${d.ma} / ${d.goal}`} progress={d.ma / d.goal} onClick={sel("queue")} />
                <StatCard icon="clock" label="Follow-up" value={d.st.fu || 0} sub={d.st.fu ? (d.f2 ? `${d.st.fu - d.f2} első, ${d.f2} második kör` : "első kör") : "nincs esedékes"} onClick={sel("queue")} />
                <StatCard icon="chat" label="Válaszok" value={(d.st.valaszolt || 0) + (d.st.ugyfel || 0)} sub={d.sent ? `${(d.rate * 100).toLocaleString("hu-HU", { maximumFractionDigits: 1 })}% válaszarány` : ""} onClick={sel("queue")} />
                <StatCard icon="user" label="Összes cím" value={d.active.length} sub={`${new Set(d.active.map((c) => c.cat)).size} kategória`} onClick={sel("cov")} />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
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
