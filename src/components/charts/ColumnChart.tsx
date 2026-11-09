import { useMemo, useState, type KeyboardEvent } from "react";
import { barPath, linear, niceTicks } from "./scale";
import { Tooltip } from "./Tooltip";
import { useWidth } from "./useSize";

export interface Column {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

interface Props {
  data: Column[];
  ariaLabel: string;
  seriesLabel: string;
  formatValue(v: number): string;
  formatTick?(v: number): string;
  height?: number;
  /** Print values above the bars when they fit (only sensible for few bars). */
  labelBars?: boolean;
}

const M = { top: 14, right: 12, bottom: 26, left: 56 };

/** Columns from a zero baseline. Gains are blue, losses red (a colour-blind-safe pair) and the sign is also in the tooltip. */
export function ColumnChart({ data, ariaLabel, seriesLabel, formatValue, formatTick, height = 240, labelBars }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const n = data.length;

  const geo = useMemo(() => {
    const values = data.map((d) => d.value);
    const { ticks, min, max } = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
    const sy = linear(min, max, plotH, 0);
    const band = plotW / Math.max(1, n);
    const gap = band >= 8 ? 2 : 1;
    const w = Math.max(1, Math.min(24, band - gap));
    return { ticks, sy, band, w, zero: sy(0) };
  }, [data, n, plotW, plotH]);

  if (n === 0) return null;
  const longest = Math.max(...data.map((d) => d.label.length));
  const every = Math.max(1, Math.ceil((longest * 6.6 + 10) / geo.band)); // label width vs. available band
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  const cur = active === null ? null : data[active]!;
  const cx = (i: number) => i * geo.band + geo.band / 2;

  return (
    <div ref={ref} className="relative" tabIndex={0} onKeyDown={onKey} onFocus={() => setActive((a) => a ?? n - 1)} onBlur={() => setActive(null)} aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block select-none">
        <g transform={`translate(${M.left},${M.top})`}>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={geo.sy(t)} y2={geo.sy(t)} className={t === 0 ? "stroke-axis" : "stroke-grid"} strokeWidth={1} />
              <text x={-10} y={geo.sy(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {(formatTick ?? formatValue)(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const tip = geo.sy(d.value);
            const x = cx(i) - geo.w / 2;
            const fits = labelBars && formatValue(d.value).length * 6.4 < geo.band - 2;
            return (
              <g key={d.key}>
                <path d={barPath(x, geo.w, geo.zero, tip, 4)} className={d.value >= 0 ? "fill-pos" : "fill-neg"} opacity={active === null || active === i ? 1 : 0.55} />
                {d.value === 0 && <line x1={x} x2={x + geo.w} y1={geo.zero} y2={geo.zero} className="stroke-axis" strokeWidth={2} />}
                {fits && (
                  <text x={cx(i)} y={d.value >= 0 ? tip - 5 : tip + 13} textAnchor="middle" className="fill-ink-2 text-[11px]">
                    {formatValue(d.value)}
                  </text>
                )}
                {i % every === 0 && (
                  <text x={cx(i)} y={plotH + 18} textAnchor="middle" className="fill-muted text-[11px]">
                    {d.label}
                  </text>
                )}
                <rect x={i * geo.band} width={geo.band} y={0} height={plotH} fill="transparent" onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} onPointerLeave={() => setActive(null)} />
              </g>
            );
          })}
        </g>
      </svg>
      {cur && active !== null && (
        <Tooltip x={M.left + cx(active)} y={M.top + geo.sy(cur.value)} width={width} title={cur.label} rows={[{ color: cur.value >= 0 ? "var(--pos)" : "var(--neg)", label: seriesLabel, value: formatValue(cur.value) }]}>
          {cur.detail && <div className="mt-1 text-ink-2">{cur.detail}</div>}
        </Tooltip>
      )}
    </div>
  );
}
