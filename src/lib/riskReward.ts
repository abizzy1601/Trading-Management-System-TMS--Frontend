/**
 * Horizontal positions (0 to 100) for the stop, entry and targets of a trade, so a bar can show them to scale.
 * The bar always reads left to right as "stop, entry, targets", whichever way the trade points,
 * so a short is drawn mirrored.
 */
export function riskRewardLayout(direction: "long" | "short", stop: number, entry: number, targets: number[]) {
  const prices = [stop, entry, ...targets];
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const span = hi - lo || 1;
  const at = (p: number) => {
    const x = ((p - lo) / span) * 100;
    return direction === "long" ? x : 100 - x;
  };
  return { stop: at(stop), entry: at(entry), targets: targets.map(at) };
}

export interface Marker {
  x: number;
  label: string;
  value: number;
}

/** Closest two markers may sit, as a share of the bar, before their labels would touch. */
export const MIN_GAP = 13;
const EDGE = 6;

/**
 * Keep every marker label on the bar and readable. Markers closer than MIN_GAP alternate onto a second row,
 * so "TP1" and "TP2" never print on top of each other.
 */
export function staggerMarkers(markers: Marker[]): (Marker & { row: 0 | 1 })[] {
  const sorted = [...markers].sort((a, b) => a.x - b.x);
  let previous = -Infinity;
  let previousRow: 0 | 1 = 1;
  return sorted.map((m) => {
    const x = Math.min(100 - EDGE, Math.max(EDGE, m.x));
    const row: 0 | 1 = x - previous < MIN_GAP ? (previousRow === 0 ? 1 : 0) : 0;
    previous = x;
    previousRow = row;
    return { ...m, x, row };
  });
}
