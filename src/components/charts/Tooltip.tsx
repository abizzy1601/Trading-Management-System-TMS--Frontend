import type { ReactNode } from "react";

export interface TipRow {
  /** Colour of the short line key (a stroke, never a filled box). */
  color?: string;
  label: string;
  value: string;
}

/**
 * One tooltip for every chart. The value leads (strong), the label follows (secondary).
 * All text is rendered through React text nodes, so untrusted labels can never inject markup.
 */
export function Tooltip({ x, y, width, title, rows, children }: { x: number; y: number; width: number; title?: string; rows: TipRow[]; children?: ReactNode }) {
  const flip = x > width * 0.62;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: flip ? undefined : x + 14, right: flip ? width - x + 14 : undefined, top: Math.max(0, y - 20) }}
    >
      {title && <div className="mb-1 text-ink-2">{title}</div>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color && <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: r.color }} aria-hidden />}
            {r.label}
          </span>
          <span className="text-sm font-semibold text-ink">{r.value}</span>
        </div>
      ))}
      {children}
    </div>
  );
}
