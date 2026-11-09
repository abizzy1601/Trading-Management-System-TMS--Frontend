import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries, ColorType, CrosshairMode, LineStyle, createChart,
  type IChartApi, type IPrimitivePaneRenderer, type IPrimitivePaneView, type ISeriesApi, type ISeriesPrimitive,
  type MouseEventParams, type SeriesAttachedParameter, type Time, type UTCTimestamp,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { AnalysisDetail, Candle, Zone } from "../../lib/types";
import { price as fmtPrice } from "../../lib/format";
import { cssVar, useThemeVersion } from "./useSize";

interface Colors {
  pos: string; neg: string; neutral: string; ink2: string; muted: string; grid: string; axis: string; surface: string; accent: string;
}

function readColors(): Colors {
  return {
    pos: cssVar("--pos"), neg: cssVar("--neg"), neutral: cssVar("--neutral"), ink2: cssVar("--ink-2"),
    muted: cssVar("--muted"), grid: cssVar("--grid"), axis: cssVar("--axis"), surface: cssVar("--surface"), accent: cssVar("--accent"),
  };
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

interface Rect { x1: number; x2: number; y1: number; y2: number; fill: string; stroke: string; label: string; textColor: string }

class ZoneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly rects: () => Rect[]) {}
  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      for (const r of this.rects()) {
        const x = Math.round(r.x1 * hr);
        const y = Math.round(Math.min(r.y1, r.y2) * vr);
        const w = Math.round((r.x2 - r.x1) * hr);
        const h = Math.max(1, Math.round(Math.abs(r.y2 - r.y1) * vr));
        ctx.fillStyle = r.fill;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = r.stroke;
        ctx.lineWidth = Math.max(1, Math.round(hr));
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        if (h >= 16 * vr) { // a label on a sliver of a zone only adds clutter
          ctx.fillStyle = r.textColor;
          ctx.font = `${Math.round(11 * vr)}px system-ui, sans-serif`;
          ctx.textBaseline = "top";
          ctx.fillText(r.label, x + 6 * hr, y + 3 * vr);
        }
      }
    });
  }
}

/** Draws analysis zones (order blocks, FVGs, supply/demand, entry) as shaded rectangles behind the candles. */
class ZonesPrimitive implements ISeriesPrimitive<Time> {
  private chart?: IChartApi;
  private series?: ISeriesApi<"Candlestick">;
  private rects: Rect[] = [];
  private readonly view: IPrimitivePaneView = { zOrder: () => "bottom", renderer: () => new ZoneRenderer(() => this.rects) };

  constructor(private readonly zones: Zone[], private readonly colors: Colors) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<"Candlestick">;
  }
  detached() {
    this.chart = undefined;
    this.series = undefined;
  }
  paneViews() {
    return [this.view];
  }
  updateAllViews() {
    if (!this.chart || !this.series) return;
    const right = this.chart.timeScale().width();
    this.rects = [];
    for (const z of this.zones) {
      const y1 = this.series.priceToCoordinate(z.top);
      const y2 = this.series.priceToCoordinate(z.bottom);
      if (y1 === null || y2 === null) continue;
      const startX = this.chart.timeScale().timeToCoordinate(z.start as UTCTimestamp);
      const x1 = Math.max(0, startX ?? 0);
      if (x1 >= right) continue;
      const base = z.side === "bullish" ? this.colors.pos : z.side === "bearish" ? this.colors.neg : this.colors.neutral;
      const fresh = z.status === "fresh" || z.status === "open";
      this.rects.push({
        x1, x2: right, y1, y2,
        fill: withAlpha(base, fresh ? 0.16 : 0.09),
        stroke: withAlpha(base, 0.55),
        label: z.label,
        textColor: this.colors.ink2,
      });
    }
  }
}

interface Props {
  candles: Candle[];
  detail: AnalysisDetail["detail"];
  height?: number;
  ariaLabel: string;
}

const VISIBLE_BARS = 110;

export function CandleChart({ candles, detail, height = 460, ariaLabel }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const themeVersion = useThemeVersion();
  const [readout, setReadout] = useState<Candle | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || candles.length === 0) return;
    const c = readColors();
    const chart = createChart(el, {
      autoSize: true,
      height,
      layout: { background: { type: ColorType.Solid, color: c.surface }, textColor: c.muted, fontFamily: "system-ui, sans-serif", attributionLogo: false },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.axis },
      timeScale: { borderColor: c.axis, timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: c.pos, downColor: c.neg, wickUpColor: c.pos, wickDownColor: c.neg, borderVisible: false,
      priceFormat: { type: "custom", formatter: (p: number) => fmtPrice(p), minMove: 0.000001 },
    });
    series.setData(candles.map((k) => ({ time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close })));

    const zones: Zone[] = [...detail.zones];
    const plan = detail.plan;
    if (plan) {
      zones.push({ type: "ENTRY", side: "neutral", top: plan.entry_zone[1], bottom: plan.entry_zone[0], start: candles[candles.length - 8]?.time ?? candles[0]!.time, status: "open", label: "Entry" });
    }
    series.attachPrimitive(new ZonesPrimitive(zones, c));

    const last = candles[candles.length - 1]!.close;
    const near = detail.levels.filter((lv) => Math.abs(lv.price - last) <= 8 * detail.indicators.atr).slice(0, 6);
    for (const lv of near) {
      series.createPriceLine({ price: lv.price, color: withAlpha(c.muted, 0.9), lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: lv.label });
    }
    if (plan) {
      series.createPriceLine({ price: plan.stop, color: c.neg, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Stop" });
      plan.targets.forEach((t, i) => series.createPriceLine({ price: t.price, color: c.pos, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `TP${i + 1}` }));
    }

    const n = candles.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - VISIBLE_BARS), to: n + 6 });

    const byTime = new Map(candles.map((k) => [k.time, k]));
    const onMove = (p: MouseEventParams<Time>) => setReadout(p.time === undefined ? null : (byTime.get(p.time as number) ?? null));
    chart.subscribeCrosshairMove(onMove);
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
    };
  }, [candles, detail, height, themeVersion]);

  const shown = readout ?? candles[candles.length - 1];
  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" style={{ fontVariantNumeric: "tabular-nums" }}>
        {shown && (
          <>
            <span>{new Date(shown.time * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</span>
            {(["open", "high", "low", "close"] as const).map((k) => (
              <span key={k}>
                {k[0]!.toUpperCase()} <strong className="font-semibold text-ink">{fmtPrice(shown[k])}</strong>
              </span>
            ))}
          </>
        )}
      </div>
      <div ref={host} role="img" aria-label={ariaLabel} style={{ height }} className="w-full overflow-hidden rounded-lg" />
    </div>
  );
}

export const ZONE_LEGEND: Record<string, string> = {
  OB: "Order block", FVG: "Fair value gap", SD: "Supply / demand zone", OTE: "Optimal trade entry", ENTRY: "Planned entry zone",
};
