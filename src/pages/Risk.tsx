import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calculator, CheckCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { compact, money, percent, timeAgo } from "../lib/format";
import { useAccounts, usePortfolio, useRiskAlerts, useRiskSettings } from "../lib/queries";
import type { Finding, Portfolio, RiskAlert, RiskSettings } from "../lib/types";
import { Button, Card, EmptyState, ErrorNote, Field, Input, LimitMeter, PageHeader, Select, SeverityBadge, Spinner, StatTile } from "../components/ui";
import { ChartCard } from "../components/charts/ChartCard";
import { ColumnChart } from "../components/charts/ColumnChart";
import { RowChart } from "../components/charts/RowChart";

export default function Risk() {
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const portfolio = usePortfolio(accountId);
  const noAccounts = accounts.data?.length === 0;

  return (
    <>
      <PageHeader
        title="Risk & portfolio"
        subtitle="Alerts when you over-trade, how your portfolio is positioned, and the limits you set for yourself."
        actions={
          <>
            {(accounts.data?.length ?? 0) > 1 && (
              <Select aria-label="Account" className="w-auto min-w-44" value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">All accounts</option>
                {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </Select>
            )}
            <Link to="/calculator" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              <Calculator className="size-4" aria-hidden />Lot size calculator
            </Link>
          </>
        }
      />

      {noAccounts && (
        <div className="mb-6">
          <Card><EmptyState icon={<ShieldCheck className="size-8" aria-hidden />} title="Connect an account to start monitoring" action={<Link to="/accounts" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Connect MT5</Link>}>
            Your alerts and portfolio analysis come from your own trades. You can set your limits below before you connect.
          </EmptyState></Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <AlertsCard />
          {portfolio.error instanceof ApiError && <ErrorNote>{portfolio.error.message}</ErrorNote>}
          {portfolio.isLoading && !noAccounts && <Spinner label="Analysing your portfolio" />}
          {portfolio.data && !noAccounts && <Analysis p={portfolio.data} fetching={portfolio.isFetching && !portfolio.isLoading} />}
        </div>
        <div className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
          {portfolio.data && !noAccounts && <TodayCard p={portfolio.data} />}
          <LimitsCard />
        </div>
      </div>
      <p className="mt-8 text-xs text-ink-2">Alerts and analysis are generated from your own limits and trading history, refreshed each time your account syncs. They are a prompt to pause and think, not financial advice. The trading day is the UTC calendar day.</p>
    </>
  );
}

// ---------------------------------------------------------------- alerts
function AlertsCard() {
  const alerts = useRiskAlerts();
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of ["risk-alerts", "portfolio"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const markAll = useMutation({ mutationFn: () => api("/risk/alerts/read", { method: "POST", body: {} }), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id: number) => api("/risk/alerts/read", { method: "POST", body: { ids: [id] } }), onSuccess: refresh });
  const check = useMutation({ mutationFn: () => api<{ created: number }>("/risk/check", { method: "POST" }), onSuccess: refresh });
  const items = alerts.data?.items ?? [];
  const unread = alerts.data?.unread ?? 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Alerts{unread > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">{unread}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {check.isSuccess && <span className="text-xs text-ink-2" role="status">{check.data.created > 0 ? `${check.data.created} new` : "Nothing new"}</span>}
          <Button variant="secondary" size="sm" loading={check.isPending} onClick={() => check.mutate()}><RefreshCw className="size-4" aria-hidden />Check now</Button>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={() => markAll.mutate()}><CheckCheck className="size-4" aria-hidden />Mark all read</Button>
        </div>
      </div>
      {alerts.isLoading && <Spinner />}
      {!alerts.isLoading && items.length === 0 && (
        <EmptyState icon={<ShieldCheck className="size-8" aria-hidden />} title="No alerts. You are within your limits.">
          You will be warned here, and by email if you turn that on, when you trade more than your plan, lose more than your daily limit, size up after a loss, or take on too many positions.
        </EmptyState>
      )}
      <ul className="divide-y divide-line">
        {items.map((a) => <AlertRow key={a.id} alert={a} onOpen={() => !a.read && markOne.mutate(a.id)} />)}
      </ul>
    </Card>
  );
}

function AlertRow({ alert: a, onOpen }: { alert: RiskAlert; onOpen(): void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="block w-full px-4 py-3.5 text-left hover:bg-surface-2/60" aria-label={`${a.severity} alert: ${a.title}. ${a.read ? "Read" : "Unread, press to mark as read"}.`}>
        <div className="flex items-center gap-3 text-xs text-ink-2">
          {!a.read && <span className="size-2 rounded-full bg-accent" aria-hidden />}
          <SeverityBadge severity={a.severity} />
          <span className="truncate">{a.account_label}</span>
          <span className="ml-auto shrink-0">{timeAgo(a.created_at)}</span>
        </div>
        <h3 className="mt-1.5 text-sm font-semibold">{a.title}</h3>
        <p className="mt-0.5 text-sm text-ink-2">{a.message}</p>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- today
function TodayCard({ p }: { p: Portfolio }) {
  const t = p.today;
  const lim = p.limits;
  const cur = p.currency;
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Today against your limits</h2>
      <div className="mt-4 space-y-5">
        <LimitMeter label="Trades opened" used={t.trades_opened} limit={lim.max_trades_per_day} display={`${t.trades_opened} of ${lim.max_trades_per_day}`} />
        {t.pnl < 0 ? (
          <LimitMeter label="Loss today" used={t.loss_pct} limit={lim.max_daily_loss_pct} display={`${t.loss_pct.toFixed(1)}% of ${lim.max_daily_loss_pct}%`} caption={money(t.pnl, cur)} />
        ) : (
          <div>
            <div className="flex items-baseline justify-between"><span className="text-sm font-medium">Result today</span><span className="text-sm font-semibold text-pos-text" style={{ fontVariantNumeric: "tabular-nums" }}>{money(t.pnl, cur, { sign: true })}</span></div>
            <p className="mt-1 text-xs text-ink-2">Not losing today. Your limit is {lim.max_daily_loss_pct}% of the balance.</p>
          </div>
        )}
        <LimitMeter label="Open positions" used={t.open_positions} limit={lim.max_open_positions} display={`${t.open_positions} of ${lim.max_open_positions}`} caption={p.data.open_positions_available ? undefined : "Could not read live positions"} />
        <LimitMeter label="Trades in the last hour" used={t.trades_last_hour} limit={lim.max_trades_per_hour} display={`${t.trades_last_hour} of ${lim.max_trades_per_hour}`} />
      </div>
      <p className="mt-4 text-xs text-ink-2">Realised {money(t.realized_pnl, cur, { sign: true })} · floating {money(t.floating_pnl, cur, { sign: true })}</p>
    </Card>
  );
}

// ---------------------------------------------------------------- limits form
const FIELDS: { key: keyof RiskSettings; label: string; hint: string; step: string; min: number; max: number }[] = [
  { key: "max_trades_per_day", label: "Most trades in a day", hint: "You are warned when you reach it, then again when you go over.", step: "1", min: 1, max: 100 },
  { key: "max_trades_per_hour", label: "Most trades in an hour", hint: "Catches rapid-fire entries.", step: "1", min: 2, max: 20 },
  { key: "max_open_positions", label: "Most open positions", hint: "Many open trades are many ways to be wrong at once.", step: "1", min: 1, max: 50 },
  { key: "max_daily_loss_pct", label: "Daily loss limit (%)", hint: "Of your balance at the start of the day. You are warned at 70% of it.", step: "0.1", min: 0.5, max: 20 },
  { key: "risk_per_trade_pct", label: "Risk per trade (%)", hint: "Used by the calculator and to judge your position sizes.", step: "0.1", min: 0.1, max: 5 },
];

function LimitsCard() {
  const { data } = useRiskSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [flags, setFlags] = useState({ alerts_enabled: true, email_alerts: true });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data || form) return;
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key])])));
    setFlags({ alerts_enabled: data.alerts_enabled, email_alerts: data.email_alerts });
  }, [data, form]);

  const save = useMutation({
    mutationFn: () => api<RiskSettings>("/risk/settings", { method: "PUT", body: { ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(form![f.key])])), ...flags } }),
    onSuccess: async (s) => {
      queryClient.setQueryData(["risk-settings"], s);
      await api("/risk/check", { method: "POST" }).catch(() => undefined); // apply the new limits straight away
      for (const key of ["risk-alerts", "portfolio"]) queryClient.invalidateQueries({ queryKey: [key] });
      setSaved(true);
    },
  });
  if (!form) return <Card className="p-5"><Spinner /></Card>;

  const submit = (e: FormEvent) => { e.preventDefault(); setSaved(false); save.mutate(); };
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Your limits</h2>
      <p className="mt-1 text-sm text-ink-2">Set the rules you want to hold yourself to. They are yours, so change them when your plan changes.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Input type="number" inputMode="decimal" required step={f.step} min={f.min} max={f.max} value={form[f.key]} onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setSaved(false); }} />
          </Field>
        ))}
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={flags.alerts_enabled} onChange={(e) => { setFlags({ ...flags, alerts_enabled: e.target.checked }); setSaved(false); }} /><span className="text-sm"><span className="block font-medium">Alert me when I break these limits</span></span></label>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={flags.email_alerts} disabled={!flags.alerts_enabled} onChange={(e) => { setFlags({ ...flags, email_alerts: e.target.checked }); setSaved(false); }} /><span className="text-sm"><span className="block font-medium">Also email me</span><span className="block text-ink-2">Only for warnings and critical alerts.</span></span></label>
        {save.error instanceof ApiError && <ErrorNote>{save.error.message}</ErrorNote>}
        <div className="flex items-center gap-3"><Button type="submit" loading={save.isPending}>Save limits</Button>{saved && <span className="text-sm text-ink-2" role="status">Saved and checked</span>}</div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- analysis
function Analysis({ p, fetching }: { p: Portfolio; fetching: boolean }) {
  const cur = p.currency;
  const hasHistory = p.data.closed_trades > 0;
  return (
    <div className={fetching ? "refetching space-y-6" : "space-y-6"}>
      <Findings items={p.recommendations} hasHistory={hasHistory} />
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <ExposureCard p={p} cur={cur} />
        <ActivityCard p={p} cur={cur} />
        <ConcentrationCard p={p} cur={cur} />
        <SizingCard p={p} cur={cur} />
      </div>
    </div>
  );
}

function Findings({ items, hasHistory }: { items: Finding[]; hasHistory: boolean }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">What stands out</h2>
      {!hasHistory ? (
        <p className="mt-2 text-sm text-ink-2">Findings appear once you have closed trades. Patterns need data.</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">Nothing concerning in your portfolio or your habits right now. Keep sizing each trade from its stop.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((f, i) => (
            <li key={i} className="flex gap-3 py-3 text-sm">
              <span className="w-24 shrink-0"><SeverityBadge severity={f.severity} /></span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ExposureCard({ p, cur }: { p: Portfolio; cur: string }) {
  const rows = p.exposure.by_currency.slice(0, 8).map((c) => ({
    key: c.currency, label: c.currency, value: c.net_lots, detail: `${c.long_positions} long · ${c.short_positions} short positions`,
  }));
  const fmt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)} lots`;
  const symbols = p.exposure.by_symbol;
  return (
    <ChartCard
      title="Open exposure by currency"
      subtitle="Net direction of your open forex positions. Blue is net long, red is net short."
      table={{ columns: ["Currency", "Net lots", "Long positions", "Short positions"], rows: p.exposure.by_currency.map((c) => [c.currency, fmt(c.net_lots), c.long_positions, c.short_positions]) }}
      chart={
        <>
          {rows.length ? (
            <RowChart rows={rows} seriesLabel="Net lots" ariaLabel="Net open exposure by currency in lots" formatValue={fmt} />
          ) : (
            <p className="py-6 text-center text-sm text-ink-2">{p.data.open_positions_available ? "No open forex positions right now." : "Live positions could not be read from your broker."}</p>
          )}
          {symbols.length > 0 && (
            <div className="mt-4 overflow-x-auto border-t border-line pt-3">
              <table className="w-full text-sm">
                <caption className="sr-only">Open positions by instrument</caption>
                <thead className="text-xs text-ink-2"><tr><th scope="col" className="py-1.5 text-left font-medium">Instrument</th><th scope="col" className="py-1.5 text-right font-medium">Long lots</th><th scope="col" className="py-1.5 text-right font-medium">Short lots</th><th scope="col" className="py-1.5 text-right font-medium">Floating</th></tr></thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {symbols.map((r) => (
                    <tr key={r.symbol} className="border-t border-line">
                      <td className="py-1.5 font-medium">{r.symbol}</td>
                      <td className="py-1.5 text-right">{r.long_lots || "—"}</td>
                      <td className="py-1.5 text-right">{r.short_lots || "—"}</td>
                      <td className={`py-1.5 text-right font-medium ${r.floating > 0 ? "text-pos-text" : r.floating < 0 ? "text-neg-text" : ""}`}>{money(r.floating, cur, { sign: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      }
      footnote="Lots are weighted by direction, not converted to value. Metals, crypto and indices appear in the table by instrument."
    />
  );
}

function ActivityCard({ p, cur }: { p: Portfolio; cur: string }) {
  const o = p.overtrading;
  const cols = o.by_activity.map((b) => ({ key: b.label, label: b.label.replace(" trades", ""), value: b.avg_pnl_per_day, detail: `${b.days} days · ${b.win_rate}% of trades won` }));
  const q = o.quick_reentry;
  return (
    <ChartCard
      title="Profit by how busy the day was"
      subtitle={`Average result per day, grouped by trades opened that day. Busiest day: ${o.max_trades_in_a_day} trades.`}
      table={{ columns: ["Trades that day", "Days", "Avg profit per day", "Win rate"], rows: o.by_activity.map((b) => [b.label, b.days, money(b.avg_pnl_per_day, cur, { sign: true }), percent(b.win_rate)]) }}
      chart={cols.length ? (
        <>
          <ColumnChart data={cols} seriesLabel="Avg per day" ariaLabel="Average profit per day by number of trades that day" formatValue={(v) => money(v, cur, { sign: true, decimals: 0 })} formatTick={(v) => compact(v)} labelBars height={200} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label={`Opened within ${q.window_minutes} min of a loss`} value={q.after_loss.trades ? percent(q.after_loss.win_rate, 0) : "—"} hint={`won · ${q.after_loss.trades} trades`} />
            <StatTile label="All other trades" value={q.other.trades ? percent(q.other.win_rate, 0) : "—"} hint={`won · ${q.other.trades} trades`} />
          </div>
        </>
      ) : <p className="py-8 text-center text-sm text-ink-2">Not enough closed trades yet.</p>}
      footnote={`Average ${o.avg_trades_per_day} trades a day. You went over your ${o.daily_limit}-trade limit on ${o.days_over_limit} of ${o.trading_days} days.`}
    />
  );
}

function ConcentrationCard({ p, cur }: { p: Portfolio; cur: string }) {
  const c = p.concentration;
  const rows = c.by_symbol.slice(0, 8).map((r) => ({ key: r.symbol, label: r.symbol, value: r.share_trades, detail: `${r.trades} trades · ${money(r.net, cur, { sign: true, decimals: 0 })} net` }));
  return (
    <ChartCard
      title="Where your trades go"
      subtitle={`Share of trades by instrument. Your portfolio is ${c.label}.`}
      table={{ columns: ["Symbol", "Trades", "Share of trades", "Share of volume", "Net"], rows: c.by_symbol.map((r) => [r.symbol, r.trades, `${r.share_trades}%`, `${r.share_volume}%`, money(r.net, cur, { sign: true })]) }}
      chart={rows.length ? <RowChart rows={rows} tone="accent" seriesLabel="Share of trades" ariaLabel="Share of trades by instrument" formatValue={(v) => `${v.toFixed(0)}%`} /> : <p className="py-8 text-center text-sm text-ink-2">No closed trades yet.</p>}
      footnote={c.by_symbol.length > 8 ? `Top 8 of ${c.by_symbol.length} instruments. The table lists all.` : undefined}
    />
  );
}

function SizingCard({ p, cur }: { p: Portfolio; cur: string }) {
  const s = p.sizing;
  const over = s.kelly_fraction !== null && s.current_risk_pct > s.suggested_risk_pct * 1.5;
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-base font-semibold">How much to risk per trade</h2>
      <p className="mt-0.5 text-sm text-ink-2">Suggested from your own results.</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
        <span className="text-5xl font-semibold tracking-tight">{s.suggested_risk_pct}%</span>
        <span className="text-sm text-ink-2">of your balance per trade</span>
      </div>
      <p className="mt-2 text-sm text-ink-2">{s.basis}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
        <div><dt className="text-xs text-ink-2">Your setting</dt><dd className={`mt-0.5 font-semibold ${over ? "text-neg-text" : ""}`}>{s.current_risk_pct}%{over ? " (above suggestion)" : ""}</dd></div>
        <div><dt className="text-xs text-ink-2">Longest losing streak</dt><dd className="mt-0.5 font-semibold">{s.longest_losing_streak} trades</dd></div>
        <div><dt className="text-xs text-ink-2">That streak costs, at your setting</dt><dd className="mt-0.5 font-semibold">{s.streak_cost_at_current_pct}% of the account</dd></div>
        <div><dt className="text-xs text-ink-2">Deepest drawdown</dt><dd className="mt-0.5 font-semibold">{s.max_drawdown_pct}%</dd></div>
        {s.size_consistency && <div><dt className="text-xs text-ink-2">Typical / largest lot size</dt><dd className="mt-0.5 font-semibold">{s.size_consistency.median_lots} / {s.size_consistency.max_lots}</dd></div>}
        <div><dt className="text-xs text-ink-2">Commission and swap paid</dt><dd className="mt-0.5 font-semibold">{money(s.costs.total, cur)}{s.costs.share_of_gross_profit !== null ? ` (${s.costs.share_of_gross_profit}% of gross profit)` : ""}</dd></div>
      </dl>
      <div className="mt-4"><Link to="/calculator" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-on-accent hover:bg-accent-hover"><Calculator className="size-4" aria-hidden />Size a trade</Link></div>
    </Card>
  );
}

