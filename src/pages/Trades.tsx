import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { api } from "../lib/api";
import { toCsv, download } from "../lib/csv";
import { dateTime, duration, money, price, signClass } from "../lib/format";
import { useAccounts, useTrades } from "../lib/queries";
import type { TradePage } from "../lib/types";
import { Button, Card, EmptyState, ErrorNote, PageHeader, Segmented, Select, SideBadge, Spinner } from "../components/ui";

type Range = "all" | "30d" | "90d" | "ytd";
function start(range: Range): string | undefined {
  const now = new Date();
  if (range === "all") return undefined;
  if (range === "ytd") return `${now.getUTCFullYear()}-01-01`;
  return new Date(now.getTime() - (range === "30d" ? 30 : 90) * 86_400_000).toISOString().slice(0, 10);
}

const PAGE_SIZE = 25;

export default function Trades() {
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [side, setSide] = useState("");
  const [symbol, setSymbol] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const filter = { accountId, dateFrom: start(range), symbol: symbol.trim().toUpperCase() || undefined, side: side || undefined };
  const trades = useTrades({ ...filter, page, pageSize: PAGE_SIZE });
  const cur = accounts.data?.find((a) => a.id === accountId)?.currency ?? accounts.data?.[0]?.currency ?? "USD";

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: (string | number)[][] = [];
      for (let p = 1; ; p++) {
        const res = await api<TradePage>("/performance/trades", { query: { account_id: accountId, date_from: filter.dateFrom, symbol: filter.symbol, side: filter.side, page: p, page_size: 200 } });
        for (const t of res.items) rows.push([t.close_time, t.open_time, t.symbol, t.side, t.volume, t.open_price, t.close_price, t.profit, t.commission, t.swap, t.net_profit]);
        if (p * 200 >= res.total) break;
      }
      download("trades.csv", toCsv(["close_time_utc", "open_time_utc", "symbol", "side", "lots", "open_price", "close_price", "profit", "commission", "swap", "net"], rows));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = trades.data ? Math.max(1, Math.ceil(trades.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader title="Trades" subtitle="Every closed position, newest first." actions={<Button variant="secondary" size="sm" loading={exporting} onClick={exportCsv} disabled={!trades.data?.total}><Download className="size-4" aria-hidden />Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3" role="search" aria-label="Trade filters">
        <Select aria-label="Account" className="w-auto min-w-44" value={accountId ?? ""} onChange={(e) => reset(setAccountId)(e.target.value ? Number(e.target.value) : null)}>
          <option value="">All accounts</option>
          {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </Select>
        <Segmented<Range> label="Date range" value={range} onChange={reset(setRange)} options={[{ value: "all", label: "All time" }, { value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "ytd", label: "YTD" }]} />
        <Select aria-label="Side" className="w-auto" value={side} onChange={(e) => reset(setSide)(e.target.value)}>
          <option value="">Buy and sell</option><option value="buy">Buy only</option><option value="sell">Sell only</option>
        </Select>
        <input aria-label="Symbol" placeholder="Symbol, e.g. EURUSD" value={symbol} onChange={(e) => reset(setSymbol)(e.target.value)} className="h-10 w-48 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted" />
      </div>

      {trades.isLoading && <Spinner label="Loading trades" />}
      {trades.error && <ErrorNote>{(trades.error as Error).message}</ErrorNote>}
      {trades.data && trades.data.total === 0 && (
        <Card><EmptyState title="No trades match">{accounts.data?.length === 0 ? <>Connect an account to see your history. <Link to="/accounts" className="text-accent underline">Connect MT5</Link></> : "Try clearing a filter, or sync your account."}</EmptyState></Card>
      )}
      {trades.data && trades.data.total > 0 && (
        <Card className={trades.isFetching ? "refetching overflow-hidden" : "overflow-hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-surface-2 text-xs text-ink-2">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Closed (UTC)</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Symbol</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Side</th>
                  {["Lots", "Open", "Close", "Held", "Costs", "Net P&L"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 text-right font-medium last:pr-4">{h}</th>)}
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {trades.data.items.map((t) => (
                  <tr key={t.id} className="border-t border-line hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 text-ink-2">{dateTime(t.close_time)}</td>
                    <td className="px-3 py-2.5 font-medium">{t.symbol}</td>
                    <td className="px-3 py-2.5"><SideBadge side={t.side} /></td>
                    <td className="px-3 py-2.5 text-right">{t.volume}</td>
                    <td className="px-3 py-2.5 text-right">{price(t.open_price)}</td>
                    <td className="px-3 py-2.5 text-right">{price(t.close_price)}</td>
                    <td className="px-3 py-2.5 text-right text-ink-2">{duration(t.hold_seconds)}</td>
                    <td className="px-3 py-2.5 text-right text-ink-2">{money(t.commission + t.swap, cur)}</td>
                    <td className={`px-3 py-2.5 pr-4 text-right font-semibold ${signClass(t.net_profit)}`}>{money(t.net_profit, cur, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-2">
            <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, trades.data.total)} of {trades.data.total.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden /></Button>
              <span className="px-2">Page {page} of {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" aria-hidden /></Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
