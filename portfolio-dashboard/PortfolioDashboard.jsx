import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ---------- config ---------- */
const FINNHUB_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_FINNHUB_KEY) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_FINNHUB_KEY) ||
  "";
const POLL_MS = 45_000; // free plan: 60 calls/min, 6 symbols every 45 s stays well under it
const WS_FLUSH_MS = 1_000; // batch WebSocket trades into one render per second
const SPARK_POINTS = 32;
const FALLBACK_USD_HUF = 365.4;

/* ---------- holdings (cost basis in USD) + offline fallback prices ---------- */
const HOLDINGS = [
  { tkr: "ELF", name: "e.l.f. Beauty", qty: 4.2, cost: 412.0, color: "#10b981" },
  { tkr: "AAPL", name: "Apple", qty: 2.1, cost: 401.3, color: "#6366f1" },
  { tkr: "MSFT", name: "Microsoft", qty: 0.9, cost: 352.6, color: "#0ea5e9" },
  { tkr: "NVDA", name: "Nvidia", qty: 3.0, cost: 318.0, color: "#f59e0b" },
  { tkr: "KO", name: "Coca-Cola", qty: 3.5, cost: 228.1, color: "#ec4899" },
  { tkr: "NKE", name: "Nike", qty: 3.8, cost: 501.2, color: "#f43f5e" },
];

const MOCK_SPARK = {
  ELF: [96, 101, 99, 108, 115, 112, 124, 131, 128, 142, 150, 155],
  AAPL: [210, 214, 209, 218, 221, 219, 224, 222, 226, 229, 227, 228.4],
  MSFT: [398, 402, 410, 405, 415, 420, 418, 425, 422, 428, 430, 431.2],
  NVDA: [118, 121, 116, 124, 127, 122, 126, 130, 125, 129, 131, 128.7],
  KO: [65, 64.5, 64.8, 64.1, 63.6, 64.2, 63.8, 63.4, 63.9, 64.1, 63.7, 63.9],
  NKE: [132, 124, 118, 110, 104, 98, 95, 88, 84, 80, 77, 75.9],
};

const mockQuotes = () =>
  Object.fromEntries(
    HOLDINGS.map(({ tkr }) => {
      const s = MOCK_SPARK[tkr];
      return [tkr, { price: s.at(-1), prevClose: s.at(-2), spark: s, live: false }];
    })
  );

/* ---------- live data hook: REST polling + WebSocket trade stream + fallback ---------- */
class RateLimitError extends Error {}

function mergePrice(prev, tkr, price, prevClose) {
  const q = prev[tkr];
  if (!q || !(price > 0)) return q;
  // first live tick: rescale the placeholder sparkline so it ends at the real price
  const base = q.live ? q.spark : q.spark.map((v) => (v / q.spark.at(-1)) * price);
  const spark = q.live && base.at(-1) === price ? base : [...base, price].slice(-SPARK_POINTS);
  return { price, prevClose: prevClose ?? q.prevClose, spark, live: true };
}

function useLivePrices(symbols, token) {
  const [quotes, setQuotes] = useState(mockQuotes);
  const [status, setStatus] = useState(token ? "loading" : "fallback"); // loading | live | delayed | fallback
  const [fetching, setFetching] = useState(Boolean(token));
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(token ? null : "No API key, showing demo data");
  const backoff = useRef(0);
  const symKey = symbols.join(",");

  /* REST polling (quote incl. previous close for the day change) */
  useEffect(() => {
    if (!token) return undefined;
    const syms = symKey.split(",");
    let timer;
    let ctrl;
    let cancelled = false;

    const poll = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(poll, POLL_MS);
        return;
      }
      ctrl = new AbortController();
      setFetching(true);
      try {
        const results = await Promise.all(
          syms.map(async (s) => {
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${token}`, { signal: ctrl.signal });
            if (r.status === 429) throw new RateLimitError("API rate limit reached");
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return [s, await r.json()];
          })
        );
        if (cancelled) return;
        setQuotes((prev) => {
          const next = { ...prev };
          for (const [s, j] of results) if (j && j.c > 0) next[s] = mergePrice(prev, s, j.c, j.pc);
          return next;
        });
        const anyLive = results.some(([, j]) => j && j.c > 0);
        setStatus(anyLive ? "live" : "fallback");
        setError(anyLive ? null : "No quotes returned, showing demo data");
        setUpdatedAt(new Date());
        backoff.current = 0;
      } catch (e) {
        if (cancelled || e.name === "AbortError") return;
        backoff.current = Math.min(backoff.current + 1, 4);
        setStatus((s) => (s === "live" || s === "delayed" ? "delayed" : "fallback"));
        setError(e instanceof RateLimitError ? "Rate limit reached, retrying shortly" : "Network error, showing last known prices");
      } finally {
        if (!cancelled) {
          setFetching(false);
          timer = setTimeout(poll, POLL_MS * 2 ** backoff.current);
        }
      }
    };

    poll();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symKey, token]);

  /* WebSocket trade stream (real-time during market hours) */
  useEffect(() => {
    if (!token || typeof WebSocket === "undefined") return undefined;
    const syms = symKey.split(",");
    let ws;
    let retry = 0;
    let reconnectTimer;
    let closed = false;
    const pending = {};

    const flush = setInterval(() => {
      const entries = Object.entries(pending);
      if (!entries.length) return;
      entries.forEach(([s]) => delete pending[s]);
      setQuotes((prev) => {
        const next = { ...prev };
        for (const [s, p] of entries) next[s] = mergePrice(prev, s, p);
        return next;
      });
      setUpdatedAt(new Date());
      setStatus("live");
    }, WS_FLUSH_MS);

    const connect = () => {
      ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);
      ws.onopen = () => {
        retry = 0;
        syms.forEach((s) => ws.send(JSON.stringify({ type: "subscribe", symbol: s })));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "trade" && Array.isArray(msg.data)) for (const t of msg.data) pending[t.s] = t.p;
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        reconnectTimer = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** retry++));
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      clearInterval(flush);
      clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) syms.forEach((s) => ws.send(JSON.stringify({ type: "unsubscribe", symbol: s })));
      ws?.close();
    };
  }, [symKey, token]);

  return { quotes, status, fetching, updatedAt, error };
}

/* ---------- USD/HUF from ECB (Frankfurter), with fallback ---------- */
function useUsdHuf() {
  const [rate, setRate] = useState(FALLBACK_USD_HUF);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("https://api.frankfurter.app/latest?from=USD&to=HUF", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.rates?.HUF > 0) setRate(j.rates.HUF);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return rate;
}

/* ---------- formatting ---------- */
const pct = (v) => `${v >= 0 ? "+" : ""}${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;

function useMoney(cur, usdHuf) {
  return useCallback(
    (usd, { sign = false, compact = false } = {}) => {
      const v = cur === "HUF" ? usd * usdHuf : usd;
      const abs = Math.abs(v);
      const s =
        cur === "HUF"
          ? `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0, notation: compact ? "compact" : "standard" }).format(abs)} Ft`
          : `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: 2, notation: compact ? "compact" : "standard" }).format(abs)}`;
      return `${v < 0 ? "−" : sign ? "+" : ""}${s}`;
    },
    [cur, usdHuf]
  );
}

/* ---------- UI primitives ---------- */
function Sparkline({ id, data, up, className = "" }) {
  const w = 72, h = 28, min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / r) * (h - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const gid = `spark-${id}`;
  const c = up ? "#10b981" : "#f43f5e";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-7 w-[72px] ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity=".25" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ items, total, money }) {
  const R = 70, C = 2 * Math.PI * R, gap = 4;
  let acc = 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle cx="90" cy="90" r={R} fill="none" strokeWidth="18" className="stroke-zinc-100 dark:stroke-zinc-800/60" />
        {items.map((p) => {
          const len = (p.value / total) * C;
          const el = (
            <circle key={p.tkr} cx="90" cy="90" r={R} fill="none" stroke={p.color} strokeWidth="18" strokeLinecap="round"
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`} strokeDashoffset={-acc} className="transition-all duration-700" />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total</p>
          <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{money(total, { compact: true })}</p>
          <p className="text-xs text-zinc-500">{items.length} holdings</p>
        </div>
      </div>
    </div>
  );
}

const Card = ({ className = "", children }) => (
  <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-none ${className}`}>{children}</section>
);

const Badge = ({ up, children, solid = false }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
      solid
        ? up ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        : up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
    }`}
  >
    <svg viewBox="0 0 10 10" className={`h-2 w-2 ${up ? "" : "rotate-180"}`}><path d="M5 1l4 7H1z" fill="currentColor" /></svg>
    {children}
  </span>
);

const STATUS = {
  loading: { dot: "bg-zinc-400", ping: false, label: "Connecting…" },
  live: { dot: "bg-emerald-500", ping: true, label: "Live" },
  delayed: { dot: "bg-amber-500", ping: false, label: "Delayed" },
  fallback: { dot: "bg-zinc-400", ping: false, label: "Demo data" },
};

function MarketStatus({ status, fetching, updatedAt, error }) {
  const s = STATUS[status];
  const time = updatedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <p className="flex items-center gap-1.5 text-xs text-zinc-500" title={error || undefined} aria-live="polite">
      <span className="relative flex h-2 w-2">
        {s.ping && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      {s.label}
      {time && status !== "fallback" && <span className="tabular-nums">· {time}</span>}
      {fetching && (
        <svg viewBox="0 0 24 24" className="ml-0.5 h-3 w-3 animate-spin text-zinc-400" fill="none" aria-label="Updating prices">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
    </p>
  );
}

const Skeleton = ({ className = "" }) => <span className={`inline-block animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />;

/* ---------- page ---------- */
export default function PortfolioDashboard({ apiKey = FINNHUB_KEY }) {
  const [dark, setDark] = useState(true);
  const [cur, setCur] = useState("USD");
  const [filter, setFilter] = useState("all");

  const symbols = useMemo(() => HOLDINGS.map((h) => h.tkr), []);
  const { quotes, status, fetching, updatedAt, error } = useLivePrices(symbols, apiKey);
  const usdHuf = useUsdHuf();
  const money = useMoney(cur, usdHuf);
  const loading = status === "loading";

  const rows = useMemo(
    () =>
      HOLDINGS.map((h) => {
        const q = quotes[h.tkr];
        const value = h.qty * q.price;
        const pnl = value - h.cost;
        const day = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;
        const dayAbs = h.qty * (q.price - (q.prevClose || q.price));
        return { ...h, price: q.price, spark: q.spark, value, pnl, pnlPct: (pnl / h.cost) * 100, day, dayAbs };
      }).sort((a, b) => b.value - a.value),
    [quotes]
  );

  const total = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const pnl = total - cost;
  const dayAbs = rows.reduce((s, r) => s + r.dayAbs, 0);
  const best = rows.reduce((a, b) => (b.pnlPct > a.pnlPct ? b : a));
  const worst = rows.reduce((a, b) => (b.pnlPct < a.pnlPct ? b : a));
  const shown = rows.filter((r) => filter === "all" || (filter === "gain" ? r.pnl >= 0 : r.pnl < 0));

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /></svg>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Portfolio</h1>
                <MarketStatus status={status} fetching={fetching} updatedAt={updatedAt} error={error} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800/60 dark:bg-zinc-900" role="group" aria-label="Currency">
                {[["HUF", "Ft"], ["USD", "$"]].map(([k, l]) => (
                  <button key={k} onClick={() => setCur(k)} aria-pressed={cur === k}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${cur === k ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={() => setDark((d) => !d)} aria-label="Toggle theme"
                className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                {dark ? (
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
                )}
              </button>
            </div>
          </header>

          {status === "fallback" && error && (
            <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              {error}. Set <code className="font-mono">VITE_FINNHUB_KEY</code> for live prices.
            </div>
          )}

          {/* Balance */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <p className="text-sm font-medium text-zinc-500">Total balance</p>
            {loading ? (
              <Skeleton className="mt-2 h-12 w-56" />
            ) : (
              <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums transition-colors sm:text-5xl">{money(total)}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge up={pnl >= 0} solid>{pct((pnl / cost) * 100)}</Badge>
              <span className={`text-sm font-semibold tabular-nums ${pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{money(pnl, { sign: true })}</span>
              <span className="text-sm text-zinc-500">all time</span>
              <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
              <Badge up={dayAbs >= 0}>{money(dayAbs, { sign: true })} today</Badge>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[["Top performer", best, true], ["Worst performer", worst, false]].map(([label, p, up]) => (
                <div key={label} className={`rounded-2xl border p-3.5 ${up ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                  <div className="mt-2 flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-bold text-white" style={{ background: p.color }}>{p.tkr.slice(0, 4)}</span>
                    <div className="min-w-0">
                      <p className="font-bold leading-tight">{p.tkr}</p>
                      <p className={`text-sm font-semibold tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{pct(p.pnlPct)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Allocation */}
            <Card>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-bold">Allocation</h2>
                <span className="text-xs text-zinc-500">by holding</span>
              </div>
              <Donut items={rows} total={total} money={money} />
              <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {rows.map((p) => (
                  <li key={p.tkr} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="font-medium">{p.tkr}</span>
                    <span className="ml-auto tabular-nums text-zinc-500">{((p.value / total) * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
                {rows.map((p) => (
                  <div key={p.tkr} className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.tkr} ${((p.value / total) * 100).toFixed(1)}%`} />
                ))}
              </div>
            </Card>

            {/* Positions */}
            <Card className="p-0 sm:p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                <h2 className="font-bold">Positions</h2>
                <div className="flex gap-1.5" role="group" aria-label="Filter">
                  {[["all", "All"], ["gain", "Gainers"], ["loss", "Losers"]].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === k
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {shown.map((p) => {
                  const up = p.pnl >= 0;
                  return (
                    <li key={p.tkr} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-white" style={{ background: p.color }}>{p.tkr.slice(0, 4)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{p.tkr}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {p.name} · {p.qty} sh ·{" "}
                          <span className={`tabular-nums ${p.day >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{pct(p.day)} today</span>
                        </p>
                      </div>
                      {loading ? (
                        <Skeleton className="hidden h-7 w-[72px] sm:block" />
                      ) : (
                        <Sparkline id={p.tkr} data={p.spark} up={p.spark.at(-1) >= p.spark[0]} className="hidden sm:block" />
                      )}
                      <div className="text-right">
                        {loading ? <Skeleton className="h-5 w-20" /> : <p className="font-semibold tabular-nums">{money(p.value)}</p>}
                        <span className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                          {pct(p.pnlPct)}
                        </span>
                      </div>
                    </li>
                  );
                })}
                {!shown.length && <li className="px-5 py-10 text-center text-sm text-zinc-500">No positions match this filter.</li>}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
