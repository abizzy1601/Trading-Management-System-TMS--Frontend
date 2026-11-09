import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Plus, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { price, timeAgo } from "../lib/format";
import { useCatalog, useFeed, useOverview, usePreferences } from "../lib/queries";
import type { Analysis, FeedItem, Preferences, Timeframe } from "../lib/types";
import { BiasBadge, Button, Card, cx, EmptyState, ErrorNote, Meter, PageHeader, Select, Spinner } from "../components/ui";
import { Paywall } from "../components/Paywall";

const TF_LABEL: Record<Timeframe, string> = { M15: "15 min", H1: "1 hour", H4: "4 hour", D1: "Daily" };
// What traders actually call each method; the full name stays available as a tooltip.
const METHOD_SHORT: Record<string, string> = { smc: "SMC", fvg: "FVG", ict: "ICT", supply_demand: "Supply & demand", price_action: "Price action", trend_following: "Trend following" };
const REASON_LABEL: Record<FeedItem["reason"], string> = { first: "New", bias_changed: "Bias changed", strength_shift: "Strength shifted" };

export default function AnalysisPage() {
  const { user } = useAuth();
  if (!user?.subscription.entitled) {
    return (
      <>
        <PageHeader title="Market bias" subtitle="Automatic reads on the coins and pairs you follow." />
        <Paywall title="Market bias is for subscribers">
          Choose the coins and currency pairs you trade and the way you trade them (SMC, fair value gaps, ICT, supply and demand, price action, trend following). We analyse them every time a candle closes and tell you when the bias changes.
        </Paywall>
      </>
    );
  }
  return <Subscribed />;
}

function Subscribed() {
  const prefs = usePreferences();
  const overview = useOverview();
  const feed = useFeed();
  const catalog = useCatalog();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const expected = (prefs.data?.watchlist.length ?? 0) * (prefs.data?.methods.length ?? 0) * (prefs.data?.timeframes.length ?? 0);
  const received = overview.data?.length ?? 0;
  const waiting = expected > 0 && received < expected;

  // New symbols/methods are analysed in the background after saving; poll briefly until they land.
  const [polls, setPolls] = useState(0);
  useEffect(() => {
    if (!waiting || polls >= 12) return;
    const t = setTimeout(() => {
      setPolls((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["unread"] });
    }, 2500);
    return () => clearTimeout(t);
  }, [waiting, polls, received, queryClient]);

  const needsSetupNow = (prefs.data?.methods.length ?? 0) === 0 || (prefs.data?.timeframes.length ?? 0) === 0 || (prefs.data?.watchlist.length ?? 0) === 0;
  useEffect(() => {
    if (prefs.data && needsSetupNow) setEditing(true);
  }, [prefs.data, needsSetupNow]);

  if (prefs.isLoading || catalog.isLoading) return <Spinner />;
  if (!prefs.data || !catalog.data) return <ErrorNote>Could not load your settings. Refresh to try again.</ErrorNote>;

  const methodName = (id: string) => catalog.data!.methods.find((m) => m.id === id)?.name ?? id;
  const setupDone = prefs.data.methods.length > 0 && prefs.data.timeframes.length > 0;
  const needsSetup = !setupDone || prefs.data.watchlist.length === 0;

  return (
    <>
      <PageHeader title="Market bias" subtitle="Analysis for the coins and pairs you follow, in the methods you trade." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {needsSetup || editing ? (
            <Setup prefs={prefs.data} onClose={needsSetup ? undefined : () => setEditing(false)} />
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-ink-2">
                Following <strong className="text-ink">{prefs.data.watchlist.join(", ")}</strong> with <strong className="text-ink">{prefs.data.methods.map(methodName).join(", ")}</strong> on <strong className="text-ink">{prefs.data.timeframes.join(", ")}</strong>
              </p>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit setup</Button>
            </Card>
          )}
          <section aria-labelledby="overview-h">
            <h2 id="overview-h" className="mb-3 text-base font-semibold">Current bias</h2>
            {!setupDone || prefs.data.watchlist.length === 0 ? (
              <Card><EmptyState title={!setupDone ? "Pick your trading method" : "Add a coin or pair"}>
                {!setupDone ? "Choose at least one method and timeframe above. Your analysis follows the way you trade." : "Add the instruments you want analysed and the bias appears here within moments."}
              </EmptyState></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {prefs.data.watchlist.map((symbol) => (
                  <SymbolCard key={symbol} symbol={symbol} prefs={prefs.data!} rows={(overview.data ?? []).filter((a) => a.symbol === symbol)} methodName={methodName} name={catalog.data!.instruments.find((i) => i.symbol === symbol)?.name ?? ""} />
                ))}
              </div>
            )}
            {waiting && polls < 12 && <p className="mt-3 text-sm text-ink-2" role="status">Analysing your instruments… {received} of {expected} ready.</p>}
          </section>
        </div>
        <FeedPanel items={feed.data?.items ?? []} unread={feed.data?.unread ?? 0} loading={feed.isLoading} methodName={methodName} />
      </div>
      <p className="mt-8 text-xs text-ink-2">Market bias is rule-based technical analysis for education. It is not financial advice, and signal strength shows how much of the evidence agrees, not the chance a trade will win. Always manage your risk.</p>
    </>
  );
}

// ---------------------------------------------------------------- setup
function Setup({ prefs, onClose }: { prefs: Preferences; onClose?: () => void }) {
  const { data: catalog } = useCatalog();
  const queryClient = useQueryClient();
  const [methods, setMethods] = useState(prefs.methods);
  const [timeframes, setTimeframes] = useState<Timeframe[]>(prefs.timeframes);
  const [adding, setAdding] = useState("");

  const dirty = useMemo(() => methods.join() !== prefs.methods.join() || timeframes.join() !== prefs.timeframes.join(), [methods, timeframes, prefs]);
  const update = (p: Preferences) => queryClient.setQueryData(["preferences"], p);

  const save = useMutation({ mutationFn: () => api<Preferences>("/analysis/preferences", { method: "PUT", body: { methods, timeframes } }), onSuccess: update });
  const add = useMutation({ mutationFn: (symbol: string) => api<Preferences>("/analysis/watchlist", { method: "POST", body: { symbol } }), onSuccess: (p) => { update(p); setAdding(""); } });
  const remove = useMutation({ mutationFn: (symbol: string) => api<Preferences>(`/analysis/watchlist/${symbol}`, { method: "DELETE" }), onSuccess: (p) => { update(p); queryClient.invalidateQueries({ queryKey: ["overview"] }); } });

  const toggle = <T extends string>(list: T[], set: (l: T[]) => void, v: T, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  const groups: [string, string][] = [["crypto", "Crypto"], ["forex", "Forex"], ["metal", "Metals"]];
  const available = catalog?.instruments.filter((i) => !prefs.watchlist.includes(i.symbol)) ?? [];
  const error = [save.error, add.error, remove.error].find((e): e is ApiError => e instanceof ApiError);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Your setup</h2>
        {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">How do you trade?</h3>
          <span className="text-xs text-ink-2">
            {methods.length} of {prefs.max_methods} selected
            {prefs.max_methods < (catalog?.methods.length ?? 0) && <> · <Link to="/billing" className="text-accent underline">upgrade for more</Link></>}
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label="Trading methods">
          {catalog?.methods.map((m) => {
            const on = methods.includes(m.id);
            const locked = !on && methods.length >= prefs.max_methods;
            return (
              <button key={m.id} type="button" aria-pressed={on} disabled={locked} title={locked ? "Your plan's method limit is reached. Upgrade for more." : undefined} onClick={() => toggle(methods, setMethods, m.id, prefs.max_methods)}
                className={cx("flex gap-3 rounded-lg border p-3 text-left transition-colors", on ? "border-accent bg-accent/5" : "border-line hover:bg-surface-2", locked && "cursor-not-allowed opacity-50")}>
                <span className={cx("mt-0.5 grid size-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-on-accent" : "border-axis")} aria-hidden>{on && <Check className="size-3" />}</span>
                <span><span className="block text-sm font-medium">{m.name}</span><span className="mt-0.5 block text-xs text-ink-2">{m.description}</span></span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Timeframes</h3>
          <span className="text-xs text-ink-2">{timeframes.length} of {prefs.max_timeframes} selected</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Timeframes">
          {catalog?.timeframes.map((tf) => {
            const on = timeframes.includes(tf);
            const locked = !on && timeframes.length >= prefs.max_timeframes;
            return (
              <button key={tf} type="button" aria-pressed={on} disabled={locked} onClick={() => toggle(timeframes, setTimeframes, tf, prefs.max_timeframes)}
                className={cx("rounded-lg border px-3 py-1.5 text-sm", on ? "border-accent bg-accent/5 font-medium" : "border-line hover:bg-surface-2", locked && "cursor-not-allowed opacity-50")}>
                {tf} <span className="text-ink-2">· {TF_LABEL[tf]}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty || methods.length === 0 || timeframes.length === 0}>Save method and timeframes</Button>
          {save.isSuccess && !dirty && <span className="text-sm text-ink-2" role="status">Saved</span>}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Coins and pairs you follow</h3>
          <span className="text-xs text-ink-2">{prefs.watchlist.length} of {prefs.max_symbols}</span>
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (adding) add.mutate(adding); }}>
          <Select aria-label="Instrument to add" className="min-w-0 flex-1" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choose a coin or pair…</option>
            {groups.map(([cls, label]) => (
              <optgroup key={cls} label={label}>
                {available.filter((i) => i.asset_class === cls).map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol} · {i.name}</option>)}
              </optgroup>
            ))}
          </Select>
          <Button type="submit" disabled={!adding || prefs.watchlist.length >= prefs.max_symbols} loading={add.isPending}><Plus className="size-4" aria-hidden />Add</Button>
        </form>
        {prefs.watchlist.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {prefs.watchlist.map((s) => (
              <li key={s} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm font-medium">
                {s}
                <button type="button" onClick={() => remove.mutate(s)} className="rounded-full p-1 text-ink-2 hover:bg-surface hover:text-ink" aria-label={`Stop following ${s}`}><X className="size-3.5" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        {error && <div className="mt-3"><ErrorNote>{error.message} {error.status === 403 && <Link to="/billing" className="underline">See plans</Link>}</ErrorNote></div>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- overview
function SymbolCard({ symbol, name, prefs, rows, methodName }: { symbol: string; name: string; prefs: Preferences; rows: Analysis[]; methodName(id: string): string }) {
  const navigate = useNavigate();
  const pending = prefs.methods.length * prefs.timeframes.length - rows.length;
  const latest = rows.reduce<Analysis | null>((a, r) => (!a || r.created_at > a.created_at ? r : a), null);
  const order = (a: Analysis) => prefs.timeframes.indexOf(a.timeframe) * 100 + prefs.methods.indexOf(a.method);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{symbol}</h3>
          <p className="text-xs text-ink-2">{name}</p>
        </div>
        {latest && <div className="text-right text-xs text-ink-2"><div className="text-sm font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>{price(latest.price)}</div>updated {timeAgo(latest.created_at)}</div>}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {[...rows].sort((a, b) => order(a) - order(b)).map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => navigate(`/analysis/${symbol}?tf=${a.timeframe}&m=${a.method}`)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2/60" aria-label={`${symbol} ${a.timeframe} ${methodName(a.method)}: ${a.bias}, strength ${a.strength}. Open detail.`}>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.timeframe}</span><span className="block truncate text-xs text-ink-2" title={methodName(a.method)}>{METHOD_SHORT[a.method] ?? methodName(a.method)}</span></span>
              <BiasBadge bias={a.bias} size="sm" />
              <span className="flex w-20 shrink-0 items-center gap-2"><Meter value={a.strength} label="Signal strength" /><span className="w-6 text-right text-xs text-ink-2" style={{ fontVariantNumeric: "tabular-nums" }}>{a.strength}</span></span>
            </button>
          </li>
        ))}
        {pending > 0 && <li className="py-2.5 text-xs text-ink-2">Analysing {pending} more…</li>}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- feed
function FeedPanel({ items, unread, loading, methodName }: { items: FeedItem[]; unread: number; loading: boolean; methodName(id: string): string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["feed"] }); queryClient.invalidateQueries({ queryKey: ["unread"] }); };
  const markAll = useMutation({ mutationFn: () => api("/analysis/feed/read", { method: "POST", body: {} }), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id: number) => api("/analysis/feed/read", { method: "POST", body: { ids: [id] } }), onSuccess: refresh });
  return (
    <aside aria-labelledby="feed-h" className="xl:sticky xl:top-6 xl:self-start">
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="feed-h" className="flex items-center gap-2 text-base font-semibold"><BellRing className="size-4 text-ink-2" aria-hidden />Alerts{unread > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">{unread}</span>}</h2>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={() => markAll.mutate()}>Mark all read</Button>
        </div>
        {loading && <Spinner />}
        {!loading && items.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-2">Alerts appear here when a new bias is read or an existing one changes.</p>}
        <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" className="block w-full px-4 py-3 text-left hover:bg-surface-2/60" onClick={() => { if (!it.read) markOne.mutate(it.id); navigate(`/analysis/${it.analysis.symbol}?tf=${it.analysis.timeframe}&m=${it.analysis.method}`); }}>
                <div className="flex items-center gap-2 text-xs text-ink-2">
                  {!it.read && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                  <span className="font-medium text-ink">{it.analysis.symbol} · {it.analysis.timeframe}</span>
                  <span>{methodName(it.analysis.method)}</span>
                  <span className="ml-auto">{timeAgo(it.created_at)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2"><BiasBadge bias={it.analysis.bias} size="sm" /><span className="text-xs text-ink-2">{REASON_LABEL[it.reason]}</span></div>
                <p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{it.analysis.summary}</p>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}
