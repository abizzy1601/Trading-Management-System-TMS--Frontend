const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", NGN: "₦", ZAR: "R", AUD: "A$", CAD: "C$" };

export function money(value: number, currency: string | null = "USD", opts: { sign?: boolean; decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 2;
  const symbol = currency ? (CURRENCY_SYMBOL[currency] ?? `${currency} `) : "";
  const abs = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = value < 0 ? "−" : opts.sign && value > 0 ? "+" : "";
  return `${sign}${symbol}${abs}`;
}

/** Compact axis/tile numbers: 1,284 / 12.9K / 4.2M */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e4) return `${trim(value / 1e3)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");

export function percent(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(decimals)}%`;
}

export function ratio(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

export function duration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** Price with precision suited to its magnitude (JPY pairs, BTC, EURUSD...). */
export function price(value: number): string {
  if (value >= 1000) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 10) return value.toFixed(3);
  if (value >= 1) return value.toFixed(5);
  return value.toFixed(6);
}

export function signClass(value: number): string {
  return value > 0 ? "text-pos-text" : value < 0 ? "text-neg-text" : "text-ink-2";
}
