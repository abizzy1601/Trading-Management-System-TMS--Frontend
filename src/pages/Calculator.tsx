import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Crosshair, ShieldAlert, Target } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { money, price as fmtPrice } from "../lib/format";
import { livePriceText, parseNum, stopFromPips } from "../lib/sizing";
import { useAccounts, useCatalog, useRiskSettings } from "../lib/queries";
import type { PositionSize, PositionSizeRequest } from "../lib/types";
import { Button, Card, cx, ErrorNote, Field, Input, PageHeader, Segmented, Select } from "../components/ui";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "NZD", "CAD", "CHF", "JPY"];
const CUSTOM = "__custom";

export default function CalculatorPage() {
  const accounts = useAccounts();
  const catalog = useCatalog();
  const settings = useRiskSettings();

  // The trade planner can send a plan here to be fine-tuned: ?symbol=&dir=&entry=&sl=&tp=&acct=
  const [params] = useSearchParams();
  const [accountId, setAccountId] = useState<string>(params.get("acct") ?? "");   // "" = enter manually
  const [accountInit, setAccountInit] = useState(params.has("acct"));
  const [balance, setBalance] = useState("10000");
  const [currency, setCurrency] = useState("USD");
  const [otherCurrency, setOtherCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [riskMode, setRiskMode] = useState<"percent" | "amount">("percent");
  const [riskValue, setRiskValue] = useState("");
  const [symbol, setSymbol] = useState(params.get("symbol") ?? "EURUSD");
  const [customSymbol, setCustomSymbol] = useState({ name: "", contract: "", quote: "USD" });
  const [contractOverride, setContractOverride] = useState("");
  const [direction, setDirection] = useState<"long" | "short">(params.get("dir") === "short" ? "short" : "long");
  const [entry, setEntry] = useState(params.get("entry") ?? "");
  const [stop, setStop] = useState(params.get("sl") ?? "");
  const [stopPips, setStopPips] = useState("");
  const [target, setTarget] = useState(params.get("tp") ?? "");

  // Start from the user's own settings and first connected account, once.
  useEffect(() => {
    if (settings.data && riskValue === "") setRiskValue(String(settings.data.risk_per_trade_pct));
  }, [settings.data, riskValue]);
  useEffect(() => {
    if (accountInit || !accounts.data) return;
    const first = accounts.data.find((a) => a.status === "connected" && a.balance !== null);
    if (first) setAccountId(String(first.id));
    setAccountInit(true);
  }, [accounts.data, accountInit]);

  const account = accounts.data?.find((a) => String(a.id) === accountId) ?? null;
  const isCustom = symbol === CUSTOM;
  const instrument = catalog.data?.instruments.find((i) => i.symbol === symbol) ?? null;
  const accountCurrency = account ? (account.currency ?? "USD") : currency === CUSTOM ? otherCurrency.trim().toUpperCase() : currency;
  const needsRate = !account && currency === CUSTOM;
  const quote = isCustom ? customSymbol.quote.trim().toUpperCase() : (instrument?.quote_currency ?? "");

  const request = useMemo<PositionSizeRequest | null>(() => {
    const entryN = parseNum(entry), stopN = parseNum(stop), riskN = parseNum(riskValue);
    if (entryN === null || stopN === null || riskN === null || entryN <= 0 || stopN <= 0 || riskN <= 0) return null;
    if (!account && (parseNum(balance) === null || (parseNum(balance) ?? 0) <= 0 || accountCurrency.length < 3)) return null;
    if (isCustom && (!customSymbol.name.trim() || !parseNum(customSymbol.contract) || quote.length < 3)) return null;
    if (needsRate && !(parseNum(rate) ?? 0)) return null;
    const targetN = parseNum(target);
    return {
      account_id: account?.id ?? null,
      balance: account ? null : parseNum(balance),
      currency: account ? null : accountCurrency,
      risk_mode: riskMode,
      risk_value: riskN,
      symbol: isCustom ? customSymbol.name.trim() : symbol,
      direction,
      entry: entryN,
      stop_loss: stopN,
      take_profit: targetN && targetN > 0 ? targetN : null,
      contract_size: isCustom ? parseNum(customSymbol.contract) : parseNum(contractOverride),
      quote_currency: isCustom ? quote : null,
      conversion_rate: needsRate ? parseNum(rate) : null,
    };
  }, [entry, stop, riskValue, target, account, balance, accountCurrency, isCustom, customSymbol, quote, needsRate, rate, riskMode, symbol, direction, contractOverride]);

  const debounced = useDebounced(request, 350);
  const result = useQuery({
    queryKey: ["position-size", debounced],
    queryFn: () => api<PositionSize>("/risk/position-size", { method: "POST", body: debounced }),
    enabled: debounced !== null,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const livePrice = useMutation({
    mutationFn: () => api<{ price: number }>("/risk/price", { query: { symbol } }),
    onSuccess: (r) => { setEntry(livePriceText(r.price, instrument?.pip_size ?? null)); setStopPips(""); },
  });

  const pip = instrument?.pip_size ?? null;
  const onPips = (v: string) => {
    setStopPips(v);
    const pips = parseNum(v), e = parseNum(entry);
    if (pip && pips && pips > 0 && e) setStop(String(stopFromPips(e, pips, pip, direction)));
  };

  const error = result.error instanceof ApiError ? result.error : null;
  const shown = debounced === null ? undefined : result.data;

  return (
    <>
      <PageHeader title="Lot size calculator" subtitle="How many lots to trade so that if your stop is hit you lose only what you meant to." actions={<><Link to="/planner" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"><Target className="size-4" aria-hidden />Suggest my levels</Link><Link to="/risk" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"><ShieldAlert className="size-4" aria-hidden />Risk & portfolio</Link></>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card className="min-w-0 p-5">
          <section aria-labelledby="acct-h">
            <h2 id="acct-h" className="text-sm font-semibold">Your account</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Account">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full">
                  {accounts.data?.filter((a) => a.balance !== null).map((a) => <option key={a.id} value={a.id}>{a.label} · {money(a.balance ?? 0, a.currency)}</option>)}
                  <option value="">Enter manually</option>
                </Select>
              </Field>
              {account ? (
                <div className="self-end pb-2 text-sm text-ink-2">Balance <strong className="text-ink">{money(account.balance ?? 0, account.currency)}</strong>{account.leverage ? <> · leverage <strong className="text-ink">1:{account.leverage}</strong></> : null}</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Balance"><Input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
                  <Field label="Currency">
                    <Select className="w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      <option value={CUSTOM}>Other…</option>
                    </Select>
                  </Field>
                </div>
              )}
            </div>
            {needsRate && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Account currency code"><Input maxLength={5} placeholder="e.g. NGN" value={otherCurrency} onChange={(e) => setOtherCurrency(e.target.value)} /></Field>
                <Field label={`1 ${quote || "quote currency"} in ${accountCurrency || "your currency"}`} hint="We have no live rate for this currency."><Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
              </div>
            )}
          </section>

          <section aria-labelledby="risk-h" className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between"><h2 id="risk-h" className="text-sm font-semibold">How much to risk</h2>
              <Segmented<"percent" | "amount"> label="Risk unit" value={riskMode} onChange={setRiskMode} options={[{ value: "percent", label: "% of balance" }, { value: "amount", label: "Amount" }]} />
            </div>
            <div className="mt-3 max-w-xs"><Field label={riskMode === "percent" ? "Risk per trade (%)" : `Risk per trade (${accountCurrency || "money"})`} hint={riskMode === "percent" ? "Most traders keep this between 0.5 and 2." : undefined}><Input inputMode="decimal" value={riskValue} onChange={(e) => setRiskValue(e.target.value)} /></Field></div>
          </section>

          <section aria-labelledby="trade-h" className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="trade-h" className="text-sm font-semibold">The trade</h2>
              <Segmented<"long" | "short"> label="Direction" value={direction} onChange={(d) => { setDirection(d); setStopPips(""); }} options={[{ value: "long", label: "Buy / long" }, { value: "short", label: "Sell / short" }]} />
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Instrument">
                <Select className="w-full" value={symbol} onChange={(e) => { setSymbol(e.target.value); setStopPips(""); }}>
                  {([["forex", "Forex"], ["metal", "Metals"], ["crypto", "Crypto"]] as const).map(([cls, label]) => (
                    <optgroup key={cls} label={label}>{catalog.data?.instruments.filter((i) => i.asset_class === cls).map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol} · {i.name}</option>)}</optgroup>
                  ))}
                  <option value={CUSTOM}>Another instrument…</option>
                </Select>
              </Field>
              {isCustom ? (
                <Field label="Symbol name"><Input placeholder="e.g. NAS100" value={customSymbol.name} onChange={(e) => setCustomSymbol({ ...customSymbol, name: e.target.value })} /></Field>
              ) : (
                <p className="self-end pb-2 text-sm text-ink-2">{instrument ? `1 lot = ${instrument.contract_size.toLocaleString()} units · quoted in ${instrument.quote_currency}` : ""}</p>
              )}
            </div>
            {isCustom && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Contract size" hint="Units per 1.00 lot. Find it in MT5: right-click the symbol, then Specification."><Input inputMode="decimal" value={customSymbol.contract} onChange={(e) => setCustomSymbol({ ...customSymbol, contract: e.target.value })} /></Field>
                <Field label="Quote currency"><Input maxLength={5} value={customSymbol.quote} onChange={(e) => setCustomSymbol({ ...customSymbol, quote: e.target.value })} /></Field>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Entry price">
                <div className="flex gap-2">
                  <Input inputMode="decimal" value={entry} onChange={(e) => { setEntry(e.target.value); setStopPips(""); }} />
                  {!isCustom && <Button type="button" variant="secondary" loading={livePrice.isPending} onClick={() => livePrice.mutate()} title="Fill in the latest market price"><Crosshair className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Live</span></Button>}
                </div>
                {livePrice.error instanceof ApiError && <span className="mt-1.5 block text-xs text-neg-text">{livePrice.error.message}</span>}
              </Field>
              <Field label="Stop-loss price"><Input inputMode="decimal" value={stop} onChange={(e) => { setStop(e.target.value); setStopPips(""); }} /></Field>
              {pip && <Field label="…or stop distance in pips" hint="Fills in the stop price from your entry."><Input inputMode="decimal" value={stopPips} onChange={(e) => onPips(e.target.value)} /></Field>}
              <Field label="Take-profit price (optional)"><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
            </div>
            {!isCustom && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-ink-2 hover:text-ink">Broker contract settings</summary>
                <div className="mt-3 max-w-xs"><Field label="Contract size override" hint="Only if your broker's contract size differs from the default."><Input inputMode="decimal" placeholder={instrument ? String(instrument.contract_size) : ""} value={contractOverride} onChange={(e) => setContractOverride(e.target.value)} /></Field></div>
              </details>
            )}
          </section>
        </Card>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ResultCard result={shown} loading={result.isFetching && debounced !== null} error={error} waiting={debounced === null} />
        </div>
      </div>
      <p className="mt-8 text-xs text-ink-2">This is arithmetic, not advice. It assumes the stop fills at your price, and in fast markets or over a weekend gap it may not. Check the contract size against your broker before relying on it.</p>
    </>
  );
}

function ResultCard({ result, loading, error, waiting }: { result?: PositionSize; loading: boolean; error: ApiError | null; waiting: boolean }) {
  if (waiting) {
    return <Card className="p-6"><h2 className="text-base font-semibold">Position size</h2><p className="mt-2 text-sm text-ink-2">Enter your entry price and stop loss and the lot size appears here as you type.</p></Card>;
  }
  if (error && !result) return <Card className="p-6"><h2 className="text-base font-semibold">Position size</h2><div className="mt-3"><ErrorNote>{error.message}</ErrorNote></div></Card>;
  if (!result) return <Card className="p-6"><h2 className="text-base font-semibold">Position size</h2><p className="mt-2 text-sm text-ink-2">Calculating…</p></Card>;

  const cur = result.currency;
  const zero = result.lots === 0;
  const rows: [string, string][] = [
    ["Risk if the stop is hit", `${money(result.actual_risk_amount, cur)} (${result.actual_risk_percent.toFixed(2)}%)`],
    ["Stop distance", result.stop_distance_pips !== null ? `${result.stop_distance_pips} pips` : fmtPrice(result.stop_distance)],
    ["Units", result.units.toLocaleString()],
  ];
  if (result.pip_value_per_lot !== null) rows.push(["Pip value per lot", money(result.pip_value_per_lot, cur)]);
  if (result.reward_amount !== null) rows.push(["Reward at target", `${money(result.reward_amount, cur)} (${result.reward_risk_ratio}R)`]);
  if (result.margin_required !== null) rows.push(["Margin needed", `${money(result.margin_required, cur)} (${result.margin_percent_of_balance}% of balance)`]);
  if (result.losing_trades_to_daily_limit !== null) rows.push(["Losses to your daily limit", `${result.losing_trades_to_daily_limit} like this`]);

  return (
    <Card className={cx("p-6", loading && "refetching")}>
      <h2 className="text-base font-semibold">Position size</h2>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-6xl font-semibold tracking-tight" aria-live="polite">{result.lots.toFixed(2)}</span>
        <span className="text-lg text-ink-2">lots</span>
      </div>
      <p className="mt-1 text-sm text-ink-2">{zero ? "No trade at this stop distance and risk." : `${result.symbol} ${result.units.toLocaleString()} units`}</p>

      {error && <div className="mt-3"><ErrorNote>{error.message}</ErrorNote></div>}
      <dl className="mt-5 divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2"><dt className="text-ink-2">{k}</dt><dd className="text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</dd></div>
        ))}
      </dl>

      {result.warnings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {result.warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{w}</span></li>
          ))}
        </ul>
      )}
      <ul className="mt-4 space-y-1 text-xs text-ink-2">{result.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
    </Card>
  );
}
