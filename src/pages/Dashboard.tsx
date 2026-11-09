import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, RefreshCw } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { compact, duration, monthLabel, money, percent, ratio, shortDate, signClass, timeAgo } from "../lib/format";
import { useAccounts, usePerformance, usePositions } from "../lib/queries";
import type { Performance } from "../lib/types";
import { Button, Card, EmptyState, ErrorNote, Notice, PageHeader, Segmented, Select, SideBadge, Spinner, StatTile, ThinSegmentedBar } from "../components/ui";
import { ChartCard } from "../components/charts/ChartCard";
import { ColumnChart } from "../components/charts/ColumnChart";
import { LineAreaChart } from "../components/charts/LineAreaChart";
import { RowChart } from "../components/charts/RowChart";

type Range = "all" | "7d" | "30d" | "90d" | "ytd";
const RANGES: { value: Range; label: string }[] = [
  { value: "all", label: "All time" }, { value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "ytd", label: "YTD" },
];
const RANGE_LABEL: Record<Range, string> = { all: "All time", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", ytd: "Year to date" };

function rangeStart(range: Range): string | undefined {
  const now = new Date();
  if (range === "all") return undefined;
  if (range === "ytd") return `${now.getUTCFullYear()}-01-01`;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const perf = usePerformance({ accountId, dateFrom: rangeStart(range) });

  const selected = accounts.data?.find((a) => a.id === accountId) ?? null;
  const positionsAccount = selected ?? accounts.data?.find((a) => a.status === "connected") ?? null;
  const positions = usePositions(positionsAccount?.id ?? null);

  const sync = useMutation({
    mutationFn: () => api(`/accounts/${selected!.id}/sync`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (accounts.isLoading) return <Spinner label="Loading your accounts" />;
  if (accounts.data && accounts.data.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <EmptyState icon={<Plug className="size-8" aria-hidden />} title="Connect your first MT5 account" action={<Link to="/accounts" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Connect account</Link>}>
            Link a read-only investor login and your trade history appears here: win rate, profit factor, drawdown and what is working.
          </EmptyState>
        </Card>
      </>
    );
  }

  const data = perf.data;
  const cur = data?.currency ?? selected?.currency ?? "USD";
  const s = data?.summary;
  const connecting = accounts.data?.every((a) => a.status === "pending");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={selected ? `${selected.label} · synced ${timeAgo(selected.last_synced_at)}` : "All connected accounts"}
        actions={selected && <Button variant="secondary" size="sm" loading={sync.isPending} onClick={() => sync.mutate()}><RefreshCw className="size-4" aria-hidden />Sync now</Button>}
      />

      {/* One filter row above everything it scopes */}
      <div className="mb-6 flex flex-wrap items-center gap-3" role="search" aria-label="Dashboard filters">
        <Select aria-label="Account" className="w-auto min-w-48" value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">All accounts</option>
          {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.label} ({a.login})</option>)}
        </Select>
        <Segmented<Range> label="Date range" value={range} onChange={setRange} options={RANGES} />
      </div>

      {sync.error instanceof ApiError && <div className="mb-4"><ErrorNote>{sync.error.message}</ErrorNote></div>}
      {connecting && <div className="mb-4"><Notice>Your account is connecting to the broker. This can take a minute or two, and this page updates on its own.</Notice></div>}
      {accounts.data?.filter((a) => a.status === "error" && (accountId === null || a.id === accountId)).map((a) => (
        <div key={a.id} className="mb-4"><ErrorNote>{a.label}: {a.error_message ?? "could not sync"} <Link to="/accounts" className="underline">Manage accounts</Link></ErrorNote></div>
      ))}
      {perf.error instanceof ApiError && <ErrorNote>{perf.error.message}</ErrorNote>}
      {perf.isLoading && <Spinner label="Crunching your trades" />}

      {data && s && s.total_trades === 0 && !connecting && (
        <Card><EmptyState title="No closed trades in this period">Try a wider date range, or sync the account again if you have just traded.</EmptyState></Card>
      )}

      {data && s && s.total_trades > 0 && (
        <div className={perf.isFetching && !perf.isLoading ? "refetching" : undefined}>
          <Hero data={data} cur={cur} range={range} />
          <KpiRow data={data} cur={cur} />
          <div className="mt-6 space-y-6">
            <EquityCard data={data} cur={cur} fetching={perf.isFetching} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PeriodCard data={data} cur={cur} period={period} onPeriod={setPeriod} />
              <SymbolCard data={data} cur={cur} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <WeekdayCard data={data} cur={cur} />
              <HourCard data={data} cur={cur} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SideCard data={data} cur={cur} />
              <Card className="p-4 sm:p-5">
                <h2 className="text-base font-semibold">Open positions</h2>
                <p className="mt-0.5 text-sm text-ink-2">{positionsAccount ? positionsAccount.label : "No connected account"}</p>
                <PositionsTable cur={cur} loading={positions.isLoading} rows={positions.data ?? []} />
              </Card>
            </div>
            <Highlights s={s} cur={cur} />
          </div>
          <p className="mt-6 text-xs text-ink-2">Times are UTC. Results cover closed trades only and include commission and swap. Equity excludes deposits and withdrawals. Past performance does not predict future results.</p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- hero + KPIs
function Hero({ data, cur, range }: { data: Performance; cur: string; range: Range }) {
  const s = data.summary;
  return (
    <Card className="mb-4 p-5 sm:p-6">
      <div className="text-sm text-ink-2">Net profit · {RANGE_LABEL[range]}</div>
      <div className={`mt-1 text-5xl font-semibold tracking-tight ${signClass(s.net_profit)}`}>{money(s.net_profit, cur, { sign: true })}</div>
      <div className="mt-2 text-sm text-ink-2">
        {s.return_pct !== null && <>{s.return_pct >= 0 ? "+" : "−"}{Math.abs(s.return_pct).toFixed(1)}% on a {money(s.starting_balance, cur, { decimals: 0 })} starting balance · </>}
        {s.total_trades} closed trades
      </div>
    </Card>
  );
}

function KpiRow({ data, cur }: { data: Performance; cur: string }) {
  const s = data.summary;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatTile label="Win rate" value={percent(s.win_rate)}>
        <ThinSegmentedBar label={`${s.wins} wins, ${s.losses} losses, ${s.breakeven} break-even`} parts={[
          { name: "Wins", value: s.wins, color: "var(--pos)" },
          { name: "Losses", value: s.losses, color: "var(--neg)" },
          { name: "Even", value: s.breakeven, color: "var(--neutral)" },
        ]} />
      </StatTile>
      <StatTile label="Profit factor" value={ratio(s.profit_factor)} hint={`${money(s.gross_profit, cur, { decimals: 0, sign: true })} won vs ${money(s.gross_loss, cur, { decimals: 0 })} lost`} />
      <StatTile label="Max drawdown" value={money(-s.max_drawdown, cur, { decimals: 0 })} hint={`${s.max_drawdown_pct.toFixed(1)}% from peak equity`} />
      <StatTile label="Expectancy per trade" value={money(s.expectancy, cur, { sign: true })} tone={s.expectancy >= 0 ? "pos" : "neg"} hint={`Avg win ${money(s.avg_win, cur, { decimals: 0 })} · avg loss ${money(s.avg_loss, cur, { decimals: 0 })}`} />
      <StatTile label="Average hold" value={duration(s.avg_hold_seconds)} hint={`${s.total_volume.toFixed(2)} lots traded`} />
    </div>
  );
}

// ---------------------------------------------------------------- charts
function EquityCard({ data, cur, fetching }: { data: Performance; cur: string; fetching: boolean }) {
  const points = useMemo(() => data.equity_curve.map((p) => ({ x: Date.parse(p.time), y: p.balance })), [data]);
  const s = data.summary;
  const step = Math.max(1, Math.floor(data.equity_curve.length / 40));
  return (
    <ChartCard
      title="Equity curve"
      subtitle={`Balance after each closed trade, from ${money(s.starting_balance, cur, { decimals: 0 })}`}
      refetching={fetching}
      table={{ columns: ["Closed (UTC)", "Balance", "Drawdown"], rows: data.equity_curve.filter((_, i) => i % step === 0).map((p) => [p.time.slice(0, 16).replace("T", " "), money(p.balance, cur), money(-p.drawdown, cur)]) }}
      chart={<LineAreaChart data={points} seriesLabel="Balance" ariaLabel={`Equity curve from ${money(s.starting_balance, cur, { decimals: 0 })} to ${money(s.ending_balance, cur, { decimals: 0 })}`} formatY={(v) => money(v, cur, { decimals: 0 })} formatTick={(v) => `${money(0, cur, { decimals: 0 }).replace("0", "")}${compact(v)}`} formatX={(ms) => shortDate(new Date(ms).toISOString())} reference={{ value: s.starting_balance, label: "Starting balance" }} />}
      footnote="Excludes deposits and withdrawals."
    />
  );
}

function PeriodCard({ data, cur, period, onPeriod }: { data: Performance; cur: string; period: "daily" | "monthly"; onPeriod(p: "daily" | "monthly"): void }) {
  const daily = data.daily_pnl.slice(-90);
  const cols = period === "daily"
    ? daily.map((d) => ({ key: d.date, label: shortDate(d.date), value: d.pnl, detail: `${d.trades} trade${d.trades === 1 ? "" : "s"}` }))
    : data.monthly_pnl.map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.pnl, detail: `${m.trades} trades` }));
  return (
    <ChartCard
      title="Profit and loss"
      subtitle={period === "daily" ? (data.daily_pnl.length > 90 ? "Last 90 trading days" : "By trading day") : "By month"}
      actions={<Segmented label="Period" value={period} onChange={onPeriod} options={[{ value: "daily", label: "Daily" }, { value: "monthly", label: "Monthly" }]} />}
      table={{ columns: [period === "daily" ? "Day" : "Month", "Net P&L", "Trades"], rows: [...cols].reverse().map((c) => [c.label, money(c.value, cur, { sign: true }), c.detail.split(" ")[0]!]) }}
      chart={<ColumnChart data={cols} seriesLabel="Net P&L" ariaLabel={`${period} profit and loss`} formatValue={(v) => money(v, cur, { sign: true, decimals: Math.abs(v) < 100 && v !== 0 ? 2 : 0 })} formatTick={(v) => compact(v)} labelBars={period === "monthly" && cols.length <= 12} />}
    />
  );
}

function SymbolCard({ data, cur }: { data: Performance; cur: string }) {
  const rows = data.by_symbol.slice(0, 8).map((r) => ({ key: r.symbol, label: r.symbol, value: r.net, detail: `${r.trades} trades · ${r.win_rate}% win` }));
  return (
    <ChartCard
      title="Results by instrument"
      subtitle="Net profit, best first"
      table={{ columns: ["Symbol", "Net", "Trades", "Win rate", "Profit factor"], rows: data.by_symbol.map((r) => [r.symbol, money(r.net, cur, { sign: true }), r.trades, percent(r.win_rate), ratio(r.profit_factor)]) }}
      chart={<RowChart rows={rows} seriesLabel="Net P&L" ariaLabel="Net profit by instrument" formatValue={(v) => money(v, cur, { sign: true, decimals: 0 })} />}
      footnote={data.by_symbol.length > 8 ? `Top 8 of ${data.by_symbol.length} instruments. The table lists all.` : undefined}
    />
  );
}

function WeekdayCard({ data, cur }: { data: Performance; cur: string }) {
  const cols = data.by_weekday.map((d) => ({ key: d.day, label: d.day, value: d.net, detail: `${d.trades} trades · ${d.win_rate}% win` }));
  return (
    <ChartCard
      title="By weekday"
      subtitle="Net profit by the day trades were opened (UTC)"
      table={{ columns: ["Day", "Net", "Trades", "Win rate"], rows: data.by_weekday.map((d) => [d.day, money(d.net, cur, { sign: true }), d.trades, percent(d.win_rate)]) }}
      chart={<ColumnChart data={cols} seriesLabel="Net P&L" ariaLabel="Net profit by weekday" formatValue={(v) => money(v, cur, { sign: true, decimals: 0 })} formatTick={(v) => compact(v)} labelBars height={220} />}
    />
  );
}

function HourCard({ data, cur }: { data: Performance; cur: string }) {
  const byHour = new Map(data.by_hour.map((h) => [h.hour, h]));
  const cols = Array.from({ length: 24 }, (_, h) => {
    const b = byHour.get(h);
    return { key: String(h), label: String(h).padStart(2, "0"), value: b?.net ?? 0, detail: `${String(h).padStart(2, "0")}:00 UTC · ${b?.trades ?? 0} trades${b ? ` · ${b.win_rate}% win` : ""}` };
  });
  return (
    <ChartCard
      title="By hour of day"
      subtitle="Net profit by the hour trades were opened (UTC)"
      table={{ columns: ["Hour (UTC)", "Net", "Trades", "Win rate"], rows: data.by_hour.map((h) => [`${String(h.hour).padStart(2, "0")}:00`, money(h.net, cur, { sign: true }), h.trades, percent(h.win_rate)]) }}
      chart={<ColumnChart data={cols} seriesLabel="Net P&L" ariaLabel="Net profit by hour of day" formatValue={(v) => money(v, cur, { sign: true, decimals: 0 })} formatTick={(v) => compact(v)} height={220} />}
    />
  );
}

// ---------------------------------------------------------------- tables
function SideCard({ data, cur }: { data: Performance; cur: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-base font-semibold">Long versus short</h2>
      <p className="mt-0.5 text-sm text-ink-2">Do you perform better buying or selling?</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-xs text-ink-2"><tr><th className="py-2 text-left font-medium">Side</th><th className="py-2 text-right font-medium">Trades</th><th className="py-2 text-right font-medium">Win rate</th><th className="py-2 text-right font-medium">Net</th></tr></thead>
        <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
          {data.by_side.map((r) => (
            <tr key={r.side} className="border-t border-line">
              <td className="py-2"><SideBadge side={r.side} /></td>
              <td className="py-2 text-right">{r.trades}</td>
              <td className="py-2 text-right">{percent(r.win_rate)}</td>
              <td className={`py-2 text-right font-medium ${signClass(r.net)}`}>{money(r.net, cur, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PositionsTable({ rows, loading, cur }: { rows: import("../lib/types").Position[]; loading: boolean; cur: string }) {
  if (loading) return <Spinner />;
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-ink-2">No open positions.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-2"><tr><th className="py-2 text-left font-medium">Symbol</th><th className="py-2 text-left font-medium">Side</th><th className="py-2 text-right font-medium">Lots</th><th className="py-2 text-right font-medium">Open</th><th className="py-2 text-right font-medium">Floating</th></tr></thead>
        <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
          {rows.map((p) => (
            <tr key={p.position_id} className="border-t border-line">
              <td className="py-2 font-medium">{p.symbol}</td>
              <td className="py-2"><SideBadge side={p.side} /></td>
              <td className="py-2 text-right">{p.volume}</td>
              <td className="py-2 text-right">{p.open_price}</td>
              <td className={`py-2 text-right font-medium ${signClass(p.profit)}`}>{money(p.profit, cur, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Highlights({ s, cur }: { s: Performance["summary"]; cur: string }) {
  const items: [string, string][] = [
    ["Best trade", money(s.best_trade, cur, { sign: true })], ["Worst trade", money(s.worst_trade, cur, { sign: true })],
    ["Best day", money(s.best_day, cur, { sign: true })], ["Worst day", money(s.worst_day, cur, { sign: true })],
    ["Profitable days", percent(s.profitable_days_pct, 0)], ["Payoff ratio", ratio(s.payoff_ratio)],
    ["Longest win streak", String(s.max_consecutive_wins)], ["Longest losing streak", String(s.max_consecutive_losses)],
    ["Commission paid", money(s.total_commission, cur)], ["Swap paid", money(s.total_swap, cur)],
  ];
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-base font-semibold">Highlights</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-2">{k}</dt>
            <dd className="mt-0.5 text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
