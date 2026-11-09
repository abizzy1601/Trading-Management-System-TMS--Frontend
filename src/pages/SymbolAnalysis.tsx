import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dateTime, price, shortDate } from "../lib/format";
import { useCandles, useCatalog, useSymbolDetail } from "../lib/queries";
import type { AnalysisDetail, Timeframe } from "../lib/types";
import { BiasBadge, Card, cx, ErrorNote, Meter, Notice, Segmented, Spinner } from "../components/ui";
import { CandleChart, ZONE_LEGEND } from "../components/charts/CandleChart";
import { ChartCard } from "../components/charts/ChartCard";
import { Paywall } from "../components/Paywall";

const TF_ORDER: Timeframe[] = ["M15", "H1", "H4", "D1"];

export default function SymbolAnalysis() {
  const { user } = useAuth();
  const symbol = (useParams().symbol ?? "").toUpperCase();
  if (!user?.subscription.entitled) return <Paywall title="Market bias is for subscribers">Subscribe to see the full analysis and chart for {symbol}.</Paywall>;
  return <Detail symbol={symbol} />;
}

function Detail({ symbol }: { symbol: string }) {
  const [params, setParams] = useSearchParams();
  const detail = useSymbolDetail(symbol);
  const catalog = useCatalog();
  const rows = detail.data ?? [];

  const timeframes = useMemo(() => TF_ORDER.filter((t) => rows.some((r) => r.timeframe === t)), [rows]);
  const tf = (timeframes.includes(params.get("tf") as Timeframe) ? params.get("tf") : timeframes[0]) as Timeframe | undefined;
  const methodsForTf = rows.filter((r) => r.timeframe === tf).map((r) => r.method);
  const method = methodsForTf.includes(params.get("m") ?? "") ? params.get("m")! : methodsForTf[0];
  const current = rows.find((r) => r.timeframe === tf && r.method === method);
  const candles = useCandles(symbol, tf ?? "H4");
  const methodName = (id: string) => catalog.data?.methods.find((m) => m.id === id)?.name ?? id;
  const instrument = catalog.data?.instruments.find((i) => i.symbol === symbol);
  const select = (next: { tf?: string; m?: string }) => setParams({ tf: next.tf ?? tf ?? "", m: next.m ?? method ?? "" }, { replace: true });

  const back = <Link to="/analysis" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Market bias</Link>;

  if (detail.isLoading) return <>{back}<Spinner label={`Analysing ${symbol}`} /></>;
  if (detail.error) {
    const e = detail.error as ApiError;
    return <>{back}{e.isPaywall ? <Paywall title="Subscription required">Your subscription is not active.</Paywall> : <ErrorNote>{e.status === 404 ? <>You are not following {symbol} yet. <Link to="/analysis" className="underline">Add it from the setup panel.</Link></> : e.message}</ErrorNote>}</>;
  }
  if (!current || !tf) return <>{back}<Notice>No analysis yet for {symbol}. Choose a trading method on the Market bias page.</Notice></>;

  return (
    <>
      {back}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{symbol}</h1>
          <p className="text-sm text-ink-2">{instrument?.name}{instrument?.note ? ` · ${instrument.note}` : ""}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{price(current.price)}</div>
          <div className="text-xs text-ink-2">at the {tf} candle that opened {dateTime(current.candle_time)}</div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<string> label="Timeframe" value={tf} onChange={(v) => select({ tf: v, m: undefined })} options={timeframes.map((t) => ({ value: t, label: t }))} />
        <Segmented<string> label="Method" value={method!} onChange={(v) => select({ m: v })} options={methodsForTf.map((m) => ({ value: m, label: methodName(m) }))} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <ChartCard
            title={`${symbol} ${tf} · ${methodName(current.method)}`}
            subtitle="Shaded zones and lines come from this method's reading"
            refetching={candles.isFetching && !candles.isLoading}
            table={{ columns: ["Opened (UTC)", "Open", "High", "Low", "Close"], rows: [...(candles.data ?? [])].slice(-40).reverse().map((c) => [new Date(c.time * 1000).toISOString().slice(0, 16).replace("T", " "), price(c.open), price(c.high), price(c.low), price(c.close)]) }}
            chart={candles.isLoading ? <Spinner label="Loading candles" /> : candles.data ? (
              <CandleChart candles={candles.data} detail={current.detail} ariaLabel={`${symbol} ${tf} candlestick chart with ${current.detail.zones.length} analysis zones`} />
            ) : <ErrorNote>Could not load candles.</ErrorNote>}
            footnote={`Blue candles closed higher, red candles closed lower. Last update ${shortDate(current.created_at)}.`}
          />
          <ZoneLegend detail={current.detail} />
        </div>
        <div className="space-y-4">
          <BiasPanel a={current} methodName={methodName(current.method)} />
          <PlanPanel a={current} />
          <ReasonsPanel a={current} />
        </div>
      </div>
      <p className="mt-8 text-xs text-ink-2">Educational technical analysis only. Not financial advice. Scenarios are illustrations of how the method reads the chart, not instructions, and no outcome is guaranteed.</p>
    </>
  );
}

function ZoneLegend({ detail }: { detail: AnalysisDetail["detail"] }) {
  const types = [...new Set([...detail.zones.map((z) => z.type), ...(detail.plan ? ["ENTRY"] : [])])];
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-2">
      {types.map((t) => <span key={t}><strong className="font-semibold text-ink">{t === "ENTRY" ? "Entry" : t}</strong> {ZONE_LEGEND[t] ?? t}</span>)}
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-pos/40" aria-hidden />bullish zone</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-neg/40" aria-hidden />bearish zone</span>
    </div>
  );
}

function BiasPanel({ a, methodName }: { a: AnalysisDetail; methodName: string }) {
  const ind = a.detail.indicators;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-2">{methodName} · {a.timeframe}</span>
        <BiasBadge bias={a.bias} />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between"><span className="text-sm text-ink-2">Signal strength</span><span className="text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{a.strength}<span className="text-sm font-normal text-ink-2"> / 100</span></span></div>
        <Meter value={a.strength} label="Signal strength" />
        <p className="mt-2 flex gap-1.5 text-xs text-ink-2"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />How much of the evidence agrees. It is not the probability that a trade wins.</p>
      </div>
      <p className="mt-4 text-sm leading-relaxed">{a.summary}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        {([["Structure", ind.trend], ["RSI (14)", ind.rsi === null ? "—" : ind.rsi.toFixed(0)], ["EMA 50", price(ind.ema50)], ["EMA 200", price(ind.ema200)], ["ATR (14)", price(ind.atr)]] as [string, string][]).map(([k, v]) => (
          <div key={k}><dt className="text-xs text-ink-2">{k}</dt><dd className="mt-0.5 font-medium capitalize" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</dd></div>
        ))}
      </dl>
    </Card>
  );
}

function PlanPanel({ a }: { a: AnalysisDetail }) {
  const { plan, triggers } = a.detail;
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Trade scenario</h2>
      {plan ? (
        <>
          <p className="mt-1 text-sm text-ink-2">How a {plan.direction} would look if you traded this read.</p>
          <dl className="mt-3 space-y-2 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <Row k={`Entry zone (${plan.entry_basis})`} v={`${price(plan.entry_zone[0])} – ${price(plan.entry_zone[1])}`} />
            <Row k="Invalidation / stop" v={price(plan.stop)} tone="neg" />
            {plan.targets.map((t, i) => <Row key={i} k={`Target ${i + 1} (${t.label})`} v={price(t.price)} tone="pos" />)}
            <Row k="Reward to risk (first target)" v={`${plan.risk_reward}R`} />
          </dl>
        </>
      ) : triggers ? (
        <div className="mt-2 space-y-2 text-sm text-ink-2">
          <p>No directional scenario. The evidence is mixed. This read changes if price closes:</p>
          <dl className="space-y-2" style={{ fontVariantNumeric: "tabular-nums" }}>
            <Row k="Above, turning bullish" v={price(triggers.bullish_above)} tone="pos" />
            <Row k="Below, turning bearish" v={price(triggers.bearish_below)} tone="neg" />
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-2">{a.bias === "neutral" ? "No directional scenario: the evidence is mixed." : "There is a bias but no clean entry zone near price. Waiting for a pullback is the cautious read."}</p>
      )}
    </Card>
  );
}

const Row = ({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" }) => (
  <div className="flex items-baseline justify-between gap-3"><dt className="text-ink-2">{k}</dt><dd className={cx("font-semibold", tone === "pos" && "text-pos-text", tone === "neg" && "text-neg-text")}>{v}</dd></div>
);

function ReasonsPanel({ a }: { a: AnalysisDetail }) {
  const reasons = [...a.detail.reasons].sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight));
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Why this bias</h2>
      <p className="mt-1 text-sm text-ink-2">Each factor adds to or subtracts from the score ({a.score > 0 ? "+" : ""}{a.score}).</p>
      <ul className="mt-3 divide-y divide-line">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
            <span className={cx("w-11 shrink-0 rounded-md py-0.5 text-center text-xs font-semibold", r.weight > 0 ? "bg-pos/10 text-pos-text" : r.weight < 0 ? "bg-neg/10 text-neg-text" : "bg-surface-2 text-ink-2")} style={{ fontVariantNumeric: "tabular-nums" }} aria-label={`${r.weight > 0 ? "bullish" : r.weight < 0 ? "bearish" : "neutral"} ${Math.abs(r.weight)}`}>
              {r.weight > 0 ? "+" : r.weight < 0 ? "−" : ""}{Math.abs(r.weight)}
            </span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
