/** Parse a number typed by a person: tolerates thousands separators and surrounding spaces. null if not a positive-or-zero finite number. */
export function parseNum(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Decimal places for prices on an instrument: one finer than the pip. 0.0001 -> 5, 0.01 -> 3. */
export function priceDecimals(pipSize: number): number {
  return Math.max(0, -Math.floor(Math.log10(pipSize))) + 1;
}

/** Stop-loss price that sits `pips` away from `entry`, on the losing side of the trade. */
export function stopFromPips(entry: number, pips: number, pipSize: number, direction: "long" | "short"): number {
  const distance = pips * pipSize;
  const stop = direction === "long" ? entry - distance : entry + distance;
  return Number(stop.toFixed(priceDecimals(pipSize)));
}

/** Shorten a live price for an input box without losing meaningful precision. */
export function inputPrice(value: number): string {
  return String(Number(value.toPrecision(8)));
}

/** A fetched market price, rounded to the precision the instrument actually trades at. */
export function livePriceText(value: number, pipSize: number | null): string {
  const decimals = pipSize ? priceDecimals(pipSize) : value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return String(Number(value.toFixed(decimals)));
}
