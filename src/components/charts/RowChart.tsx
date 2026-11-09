import { useMemo, useState, type KeyboardEvent } from "react";
import { linear, rowPath } from "./scale";
import { Tooltip } from "./Tooltip";
import { useWidth } from "./useSize";

export interface Row {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

interface Props {
  rows: Row[];
  ariaLabel: string;
  seriesLabel: string;
  formatValue(v: number): string;
  /** "diverging" colours gains blue and losses red. "accent" is for shares and counts, where sign carries no good or bad. */
  tone?: "diverging" | "accent";
}

const ROW_H = 32;
const BAR_H = 16;
const LABEL_W = 84;
const VALUE_W = 78;

/** Ranked horizontal bars. Every bar is labelled at its tip, so no value axis is needed. */
export function RowChart({ rows, ariaLabel, seriesLabel, formatValue, tone = "diverging" }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(420);
  const [active, setActive] = useState<number | null>(null);
  const height = rows.length * ROW_H + 4;

  const geo = useMemo(() => {
    const vals = rows.map((r) => r.value);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    const x0 = LABEL_W + (lo < 0 ? VALUE_W : 0);
    const x1 = width - VALUE_W;
    const sx = linear(lo, hi === lo ? lo + 1 : hi, x0, Math.max(x0 + 20, x1));
    return { sx, zero: sx(0) };
  }, [rows, width]);

  if (rows.length === 0) return null;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") setActive((a) => Math.max(0, (a ?? rows.length) - 1));
    else if (e.key === "ArrowDown") setActive((a) => Math.min(rows.length - 1, (a ?? -1) + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  const cur = active === null ? null : rows[active]!;

  return (
    <div ref={ref} className="relative" tabIndex={0} onKeyDown={onKey} onFocus={() => setActive((a) => a ?? 0)} onBlur={() => setActive(null)} aria-label={`${ariaLabel}. Use up and down arrow keys to read values.`}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block select-none">
        <line x1={geo.zero} x2={geo.zero} y1={0} y2={height} className="stroke-axis" strokeWidth={1} />
        {rows.map((r, i) => {
          const y = i * ROW_H + (ROW_H - BAR_H) / 2;
          const tip = geo.sx(r.value);
          const neg = r.value < 0;
          return (
            <g key={r.key} opacity={active === null || active === i ? 1 : 0.55}>
              <text x={0} y={i * ROW_H + ROW_H / 2} dy="0.32em" className="fill-ink text-[13px] font-medium">
                {r.label}
              </text>
              <path d={rowPath(y, BAR_H, geo.zero, tip, 4)} className={tone === "accent" ? "fill-accent" : neg ? "fill-neg" : "fill-pos"} />
              <text x={neg ? tip - 8 : tip + 8} y={i * ROW_H + ROW_H / 2} dy="0.32em" textAnchor={neg ? "end" : "start"} className="fill-ink text-[12px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatValue(r.value)}
              </text>
              <rect x={0} y={i * ROW_H} width={width} height={ROW_H} fill="transparent" onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} onPointerLeave={() => setActive(null)} />
            </g>
          );
        })}
      </svg>
      {cur && active !== null && (
        <Tooltip x={geo.sx(cur.value)} y={active * ROW_H + ROW_H / 2} width={width} title={cur.label} rows={[{ color: tone === "accent" ? "var(--accent)" : cur.value >= 0 ? "var(--pos)" : "var(--neg)", label: seriesLabel, value: formatValue(cur.value) }]}>
          {cur.detail && <div className="mt-1 text-ink-2">{cur.detail}</div>}
        </Tooltip>
      )}
    </div>
  );
}
