import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Lock, Target, TrendingDown, TrendingUp } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { money, price as fmtPrice } from "../lib/format";
import { parseNum } from "../lib/sizing";
import { useAccounts, useCatalog, useRiskSettings } from "../lib/queries";
import type { DirectionPlan, PlanSide, Timeframe, TradePlan } from "../lib/types";
import { BiasBadge, Button, Card, cx, ErrorNote, Field, Input, PageHeader, Segmented, Select } from "../components/ui";
import { RiskRewardBar } from "../components/RiskRewardBar";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "NZD", "CAD", "CHF", "JPY"];
const STYLES: { value: Timeframe; label: string; hint: string }[] = [
  { value: "M15", label: "15 min", hint: "Scalping: trades last minutes to a few hours." },
  { value: "H1", label: "1 hour", hint: "Intraday: trades last hours, closed within the day." },
  { value: "H4", label: "4 hour", hint: "Swing: trades last days." },
  { value: "D1", label: "Daily", hint: "Position: trades last days to weeks." },
];

export default function TradePlanner() {
  const accounts = useAccounts();
  const catalog = useCatalog();
  const settings = useRiskSettings();

  const [accountId, setAccountId] = useState("");
  const [initialised, setInitialised] = useState(false);
  const [balance, setBalance] = useState("10000");
  const [currency, setCurrency] = useState("USD");
  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [riskMode, setRiskMode] = useState<"percent" | "amount">("percent");
  const [riskValue, setRiskValue] = useState("");

  useEffect(() => {
    if (settings.data && riskValue === "") setRiskValue(String(settings.data.risk_per_trade_pct));
  }, [settings.data, riskValue]);
  useEffect(() => {
    if (initialised || !accounts.data) return;
    const first = accounts.data.find((a) => a.status === "connected" && a.balance !== null);
    if (first) setAccountId(String(first.id));
    setInitialised(true);
  }, [accounts.data, initialised]);

  const account = accounts.data?.find((a) => String(a.id) === accountId) ?? null;
  const risk = parseNum(riskValue);
  const manualBalance = parseNum(balance);
  const ready = risk !== null && risk > 0 && (account !== null || (manualBalance !== null && manualBalance > 0));

  const plan = useMutation({
    mutationFn: () =>
      api<TradePlan>("/risk/trade-plan", {
        method: "POST",
        body: {
          account_id: account?.id ?? null,
          balance: account ? null : manualBalance,
          currency: account ? null : currency,
          symbol, timeframe, risk_mode: riskMode, risk_value: risk,
        },
      }),
  });
  const result = plan.data;
  const error = plan.error instanceof ApiError ? plan.error : null;
  const hint = STYLES.find((s) => s.value === timeframe)?.hint;
  const suggestion = result?.risk.suggested;

  return (
    <>
      <PageHeader
        title="Trade planner"
        subtitle="Pick a coin or pair and your timeframe. Get the lot size, stop loss and take profit that fit your account balance."
        actions={<Link to="/calculator" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"><Calculator className="size-4" aria-hidden />I have my own levels</Link>}
      />

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Account">
            <Select className="w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.data?.filter((a) => a.balance !== null).map((a) => <option key={a.id} value={a.id}>{a.label} · {money(a.balance ?? 0, a.currency)}</option>)}
              <option value="">Enter balance manually</option>
            </Select>
          </Field>
          {!account && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Balance"><Input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
              <Field label="Currency"><Select className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            </div>
          )}
          <Field label="Coin or currency pair">
            <Select className="w-full" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {([["forex", "Forex"], ["metal", "Metals"], ["crypto", "Crypto"]] as const).map(([cls, label]) => (
                <optgroup key={cls} label={label}>{catalog.data?.instruments.filter((i) => i.asset_class === cls).map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol} · {i.name}</option>)}</optgroup>
              ))}
            </Select>
          </Field>
          <Field label={riskMode === "percent" ? "Risk per trade (%)" : `Risk per trade (${account?.currency ?? currency})`}>
            <div className="flex gap-2">
              <Input inputMode="decimal" value={riskValue} onChange={(e) => setRiskValue(e.target.value)} />
              <Segmented<"percent" | "amount"> label="Risk unit" value={riskMode} onChange={setRiskMode} options={[{ value: "percent", label: "%" }, { value: "amount", label: "$" }]} />
            </div>
            {suggestion && riskMode === "percent" && Number(riskValue) !== suggestion.percent && (
              <button type="button" onClick={() => setRiskValue(String(suggestion.percent))} className="mt-1.5 block text-left text-xs text-accent hover:underline">
                Your results suggest {suggestion.percent}%. Use it.
              </button>
            )}
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
          <div>
            <div className="mb-1.5 text-sm font-medium">How long do you hold trades?</div>
            <Segmented<Timeframe> label="Timeframe" value={timeframe} onChange={setTimeframe} options={STYLES.map((s) => ({ value: s.value, label: s.label }))} />
            <p className="mt-1.5 text-xs text-ink-2">{hint}</p>
          </div>
          <Button onClick={() => plan.mutate()} loading={plan.isPending} disabled={!ready}><Target className="size-4" aria-hidden />Get my trade plan</Button>
        </div>
        {error && <div className="mt-4"><ErrorNote>{error.message}</ErrorNote></div>}
      </Card>

      {result && <Results r={result} accountId={account?.id ?? null} refreshing={plan.isPending} />}
      {!result && !plan.isPending && !error && (
        <p className="mt-6 text-sm text-ink-2">Choose an instrument and press the button. You get a long plan and a short plan, each with its lot size, stop loss, two take-profit levels, and what you stand to lose and gain.</p>
      )}
      <p className="mt-8 text-xs text-ink-2">Suggested levels are places to put orders that suit recent volatility and the price swings around it. They are not predictions, they do not include spread or slippage, and no trade is guaranteed to work. This is educational and not financial advice.</p>
    </>
  );
}

// ---------------------------------------------------------------- results
function Results({ r, accountId, refreshing }: { r: TradePlan; accountId: number | null; refreshing: boolean }) {
  const cur = r.account.currency;
  return (
    <div className={cx("mt-6 space-y-5", refreshing && "refetching")}>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <div>
            <h2 className="text-lg font-semibold">{r.symbol} <span className="text-sm font-normal text-ink-2">{r.name} · {r.timeframe}</span></h2>
            <p className="mt-0.5 text-sm text-ink-2">
              Price <strong className="text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtPrice(r.price)}</strong> latest
              {" · "}typical move per candle <strong className="text-ink">{r.atr_pips !== null ? `${r.atr_pips} pips` : fmtPrice(r.atr)}</strong>
              {" · "}balance <strong className="text-ink">{money(r.account.balance, cur)}</strong>
            </p>
          </div>
          <Direction r={r} />
        </div>
        {r.budget && <Budget b={r.budget} />}
        {r.notes.map((n) => <p key={n.text} className="mt-3 text-sm text-ink-2">{n.text}</p>)}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {(["long", "short"] as const).map((side) => <PlanCard key={side} side={r.plans[side]} r={r} accountId={accountId} />)}
      </div>
      <ul className="space-y-1 text-xs text-ink-2">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
    </div>
  );
}

function Direction({ r }: { r: TradePlan }) {
  if (r.consensus_locked) {
    return (
      <Link to="/billing" className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm hover:bg-surface">
        <Lock className="size-4 text-ink-2" aria-hidden />
        <span><strong className="font-medium">Which way is the market leaning?</strong> <span className="text-ink-2">Subscribers see it here.</span></span>
      </Link>
    );
  }
  const c = r.consensus!;
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-2"><span className="text-sm text-ink-2">Market bias</span><BiasBadge bias={c.bias} /></div>
      <p className="mt-1 text-xs text-ink-2">{c.bullish} bullish, {c.bearish} bearish, {c.neutral} neutral of {c.methods} methods</p>
    </div>
  );
}

function Budget({ b }: { b: NonNullable<TradePlan["budget"]> }) {
  const spent = b.remaining_pct <= 0;
  return (
    <div className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
      <strong className="font-medium">Today's risk budget:</strong>{" "}
      <span className={spent ? "font-semibold text-neg-text" : undefined}>
        {b.used_pct.toFixed(1)}% of your {b.limit_pct}% daily loss limit used, {b.remaining_pct.toFixed(1)}% left
      </span>
      <span className="text-ink-2"> · {b.trades_today} of {b.trade_limit} trades opened today</span>
    </div>
  );
}

function PlanCard({ side, r, accountId }: { side: PlanSide; r: TradePlan; accountId: number | null }) {
  const long = side.direction === "long";
  const Icon = long ? TrendingUp : TrendingDown;
  const title = long ? "Buy / long" : "Sell / short";
  if ("error" in side) {
    return <Card className="p-5"><h3 className="flex items-center gap-2 text-base font-semibold"><Icon className="size-4" aria-hidden />{title}</h3><div className="mt-3"><ErrorNote>{side.error}</ErrorNote></div></Card>;
  }
  return <PlanBody p={side} r={r} accountId={accountId} title={title} Icon={Icon} />;
}

function PlanBody({ p, r, accountId, title, Icon }: { p: DirectionPlan; r: TradePlan; accountId: number | null; title: string; Icon: typeof TrendingUp }) {
  const cur = r.account.currency;
  const tp1 = p.targets[0]!;
  const params = new URLSearchParams({ symbol: r.symbol, dir: p.direction, entry: String(p.entry), sl: String(p.stop_loss), tp: String(tp1.price) });
  if (accountId !== null) params.set("acct", String(accountId));
  const rows: [string, string, string?][] = [
    ["Entry", fmtPrice(p.entry), "Market price now. Use a limit order to wait for a better one."],
    ["Stop loss", fmtPrice(p.stop_loss), `${p.stop_distance_pips !== null ? `${p.stop_distance_pips} pips, ` : ""}${p.stop_atr} times the typical candle range. ${p.stop_basis}.`],
    ...p.targets.map((t, i): [string, string, string] => [`Take profit ${i + 1}`, fmtPrice(t.price), `${t.rr}R: wins ${money(t.reward_amount, cur)}${t.distance_pips !== null ? `, ${t.distance_pips} pips away` : ""}. ${t.basis}.`]),
  ];

  return (
    <Card className={cx("p-5", p.favoured && "border-accent ring-1 ring-accent")}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Icon className={cx("size-4", p.direction === "long" ? "text-pos-text" : "text-neg-text")} aria-hidden />{title}</h3>
        {p.favoured && <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Favoured by market bias</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-5xl font-semibold tracking-tight">{p.lots.toFixed(2)}</span>
        <span className="text-lg text-ink-2">lots</span>
      </div>
      <p className="text-sm text-ink-2">
        {p.lots === 0 ? "Too small for this stop distance." : `${p.units.toLocaleString()} units · risks ${money(p.risk_amount, cur)} (${p.risk_percent.toFixed(2)}%) if stopped out`}
      </p>

      <RiskRewardBar direction={p.direction} stop={p.stop_loss} entry={p.entry} targets={p.targets} />

      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v, note]) => (
          <div key={k} className="py-2.5">
            <div className="flex items-baseline justify-between gap-4"><dt className="font-medium">{k}</dt><dd className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</dd></div>
            {note && <p className="mt-0.5 text-xs text-ink-2">{note}</p>}
          </div>
        ))}
        {p.margin_required !== null && (
          <div className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-ink-2">Margin needed</dt><dd className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.margin_required, cur)} ({p.margin_percent_of_balance}%)</dd></div>
        )}
      </dl>

      {p.warnings.length > 0 && (
        <ul className="mt-3 space-y-2">
          {p.warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{w}</span></li>
          ))}
        </ul>
      )}
      <Link to={`/calculator?${params.toString()}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"><Calculator className="size-4" aria-hidden />Fine-tune in the calculator</Link>
    </Card>
  );
}
