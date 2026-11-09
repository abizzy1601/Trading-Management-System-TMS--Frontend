import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { linear, nearestIndex, niceTicks } from "./scale";
import { Tooltip } from "./Tooltip";
import { useWidth } from "./useSize";

export interface LinePoint {
  x: number; // epoch ms
  y: number;
}

interface Props {
  data: LinePoint[];
  seriesLabel: string;
  ariaLabel: string;
  formatY(v: number): string;
  formatTick?(v: number): string;
  formatX(ms: number): string;
  height?: number;
  reference?: { value: number; label: string };
}

const M = { top: 12, right: 16, bottom: 26, left: 58 };
const MAX_POINTS = 1500;

/** Single-series line with a 10% area wash, a 2px line, hairline grid, crosshair + tooltip and keyboard support. */
export function LineAreaChart({ data, seriesLabel, ariaLabel, formatY, formatTick, formatX, height = 260, reference }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const id = useId();

  const points = useMemo(() => {
    if (data.length <= MAX_POINTS) return data;
    const k = Math.ceil(data.length / MAX_POINTS);
    return data.filter((_, i) => i % k === 0 || i === data.length - 1);
  }, [data]);

  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const ys = points.map((p) => p.y).concat(reference ? [reference.value] : []);
    const { ticks, min, max } = niceTicks(Math.min(...ys), Math.max(...ys), 4);
    const x0 = points[0]!.x;
    const x1 = points[points.length - 1]!.x;
    const sx = linear(x0, x1 === x0 ? x0 + 1 : x1, 0, plotW);
    const sy = linear(min, max, plotH, 0);
    const xs = points.map((p) => sx(p.x));
    const line = points.map((p, i) => `${i ? "L" : "M"}${xs[i]!.toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
    const area = `${line}L${xs[xs.length - 1]!.toFixed(1)},${plotH}L${xs[0]!.toFixed(1)},${plotH}Z`;
    const xTickCount = Math.max(2, Math.min(6, Math.floor(plotW / 96)));
    const xTicks = Array.from({ length: xTickCount }, (_, i) => x0 + ((x1 - x0) * i) / (xTickCount - 1));
    return { ticks, sx, sy, xs, line, area, xTicks, x0, x1 };
  }, [points, plotW, plotH, reference]);

  if (!geo) return null;
  const idx = active === null ? null : Math.min(active, points.length - 1);
  const cur = idx === null ? null : points[idx]!;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(geo.xs, e.clientX - rect.left));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKey} tabIndex={0} onFocus={() => setActive((a) => a ?? points.length - 1)} onBlur={() => setActive(null)} aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block select-none">
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect width={plotW} height={plotH + 4} y={-2} />
          </clipPath>
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={geo.sy(t)} y2={geo.sy(t)} className={t === 0 ? "stroke-axis" : "stroke-grid"} strokeWidth={1} />
              <text x={-10} y={geo.sy(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {(formatTick ?? formatY)(t)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((t, i) => (
            <text key={t} x={geo.sx(t)} y={plotH + 18} textAnchor={i === 0 ? "start" : i === geo.xTicks.length - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
              {formatX(t)}
            </text>
          ))}
          {reference && (
            <g>
              <line x1={0} x2={plotW} y1={geo.sy(reference.value)} y2={geo.sy(reference.value)} className="stroke-axis" strokeWidth={1} />
              <text x={plotW} y={geo.sy(reference.value) - 5} textAnchor="end" className="fill-muted text-[11px]">
                {reference.label}
              </text>
            </g>
          )}
          <g clipPath={`url(#${id}-clip)`}>
            <path d={geo.area} className="fill-accent" fillOpacity={0.1} />
            <path d={geo.line} className="fill-none stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {cur && idx !== null && (
            <g pointerEvents="none">
              <line x1={geo.xs[idx]} x2={geo.xs[idx]} y1={0} y2={plotH} className="stroke-axis" strokeWidth={1} />
              <circle cx={geo.xs[idx]} cy={geo.sy(cur.y)} r={5} className="fill-accent stroke-surface" strokeWidth={2} />
            </g>
          )}
          {!cur && (
            <circle cx={geo.xs[geo.xs.length - 1]} cy={geo.sy(points[points.length - 1]!.y)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />
          )}
          <rect width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
        </g>
      </svg>
      {cur && idx !== null && (
        <Tooltip x={M.left + geo.xs[idx]!} y={M.top + geo.sy(cur.y)} width={width} title={formatX(cur.x)} rows={[{ color: "var(--accent)", label: seriesLabel, value: formatY(cur.y) }]} />
      )}
    </div>
  );
}
