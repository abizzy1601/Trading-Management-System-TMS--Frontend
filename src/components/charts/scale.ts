/** Small, dependency-free scale helpers shared by the SVG charts. */

export function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks);
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const frac = raw / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

export function niceTicks(min: number, max: number, targetTicks = 4): { ticks: number[]; min: number; max: number } {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, targetTicks);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { ticks, min: lo, max: hi };
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Index of the item whose x is nearest to `x` (xs ascending). */
export function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] as number) < x) lo = mid;
    else hi = mid;
  }
  return Math.abs((xs[lo] as number) - x) <= Math.abs((xs[hi] as number) - x) ? lo : hi;
}

/**
 * SVG path for a bar from `baseline` to `tip` with a rounded data end and a square baseline end.
 * Works for bars growing up/down (vertical) — pass swapped coordinates through `horizontal` for rows.
 */
export function barPath(x: number, w: number, baseline: number, tip: number, radius: number): string {
  const len = Math.abs(tip - baseline);
  if (len < 0.5) return "";
  const r = Math.min(radius, w / 2, len);
  const up = tip < baseline;
  if (up) {
    return `M${x},${baseline} V${tip + r} Q${x},${tip} ${x + r},${tip} H${x + w - r} Q${x + w},${tip} ${x + w},${tip + r} V${baseline} Z`;
  }
  return `M${x},${baseline} V${tip - r} Q${x},${tip} ${x + r},${tip} H${x + w - r} Q${x + w},${tip} ${x + w},${tip - r} V${baseline} Z`;
}

export function rowPath(y: number, h: number, baseline: number, tip: number, radius: number): string {
  const len = Math.abs(tip - baseline);
  if (len < 0.5) return "";
  const r = Math.min(radius, h / 2, len);
  const right = tip > baseline;
  if (right) {
    return `M${baseline},${y} H${tip - r} Q${tip},${y} ${tip},${y + r} V${y + h - r} Q${tip},${y + h} ${tip - r},${y + h} H${baseline} Z`;
  }
  return `M${baseline},${y} H${tip + r} Q${tip},${y} ${tip},${y + r} V${y + h - r} Q${tip},${y + h} ${tip + r},${y + h} H${baseline} Z`;
}
