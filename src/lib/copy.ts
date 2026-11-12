import type { Follow, FollowSettings, LeaderStats, Ticket } from "./types";

export const NEEDS_LABEL: Record<NonNullable<Ticket["needs"]>, string> = {
  copy: "New trade to copy",
  update: "Trade changed",
  close: "Trader closed this",
};

/** Defaults for a new follow: balance-matched, the same risk as the trader, with conservative limits. */
export const DEFAULT_SETTINGS: FollowSettings = {
  size_mode: "proportional",
  size_value: 1,
  max_lots: 1,
  max_open_copies: 3,
  daily_loss_stop_pct: 3,
  notify_email: true,
};

export const lotsText = (n: number) => `${n} lot${n === 1 ? "" : "s"}`;

/** One line on how trades are sized, for lists and confirmations. */
export function sizingSummary(f: Pick<Follow, "size_mode" | "size_value" | "max_lots">): string {
  const base = f.size_mode === "fixed" ? `${lotsText(f.size_value)} every trade` : f.size_value === 1 ? "Matches the trader's risk to your balance" : `${f.size_value}× the trader's risk, scaled to your balance`;
  return `${base}, never above ${lotsText(f.max_lots)}`;
}

/** Plain-language cautions about a track record. A high return over a short or thin record means little. */
export function recordWarnings(s: LeaderStats): string[] {
  const out: string[] = [];
  if (s.track_days < 30) out.push(`Short record: ${s.track_days} day${s.track_days === 1 ? "" : "s"} of trading`);
  if (s.trades < 50) out.push(`Few trades: ${s.trades} closed trade${s.trades === 1 ? "" : "s"} is too few to judge skill`);
  if (s.max_drawdown_pct >= 25) out.push(`Deep losses: the account has fallen ${s.max_drawdown_pct.toFixed(0)}% from a peak`);
  return out;
}

/** A price move, signed, with the sign written out so the colour never carries it alone. */
export function movePct(value: number): string {
  const text = Math.abs(value).toFixed(2);
  return value > 0 ? `+${text}%` : value < 0 ? `−${text}%` : `${text}%`;
}

/** The label of the button that answers a ticket. */
export function answerLabel(needs: NonNullable<Ticket["needs"]>): string {
  return needs === "update" ? "I've updated mine" : needs === "close" ? "I've closed mine" : "I placed it";
}
