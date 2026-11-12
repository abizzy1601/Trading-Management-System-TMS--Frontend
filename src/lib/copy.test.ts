import { describe, expect, it } from "vitest";
import { answerLabel, movePct, recordWarnings, sizingSummary } from "./copy";
import type { LeaderStats } from "./types";

const stats = (over: Partial<LeaderStats> = {}): LeaderStats => ({
  trades: 120, win_rate: 55, profit_factor: 1.6, payoff_ratio: 1.2, return_pct: 40, max_drawdown_pct: 12, avg_hold_seconds: 3600,
  track_days: 200, trades_per_week: 4, last_trade_at: null, top_symbols: [], ...over,
});

describe("recordWarnings", () => {
  it("says nothing about a long, deep, shallow-drawdown record", () => {
    expect(recordWarnings(stats())).toEqual([]);
  });
  it("flags a short record, a thin one and deep losses separately", () => {
    expect(recordWarnings(stats({ track_days: 12 }))).toEqual(["Short record: 12 days of trading"]);
    expect(recordWarnings(stats({ trades: 21 }))).toEqual(["Few trades: 21 closed trades is too few to judge skill"]);
    expect(recordWarnings(stats({ max_drawdown_pct: 31.4 }))).toEqual(["Deep losses: the account has fallen 31% from a peak"]);
  });
  it("uses the singular for one day and one trade, and the boundaries are exclusive", () => {
    expect(recordWarnings(stats({ track_days: 1, trades: 1 }))).toEqual([
      "Short record: 1 day of trading", "Few trades: 1 closed trade is too few to judge skill",
    ]);
    expect(recordWarnings(stats({ track_days: 30, trades: 50, max_drawdown_pct: 24.9 }))).toEqual([]);
    expect(recordWarnings(stats({ max_drawdown_pct: 25 }))).toHaveLength(1);
  });
});

describe("sizingSummary", () => {
  it("describes each way of sizing", () => {
    expect(sizingSummary({ size_mode: "proportional", size_value: 1, max_lots: 1 })).toBe("Matches the trader's risk to your balance, never above 1 lot");
    expect(sizingSummary({ size_mode: "proportional", size_value: 0.5, max_lots: 2 })).toBe("0.5× the trader's risk, scaled to your balance, never above 2 lots");
    expect(sizingSummary({ size_mode: "fixed", size_value: 0.05, max_lots: 0.5 })).toBe("0.05 lots every trade, never above 0.5 lots");
  });
});

describe("movePct", () => {
  it("writes the sign out and uses a true minus", () => {
    expect(movePct(0.424)).toBe("+0.42%");
    expect(movePct(-1.2)).toBe("−1.20%");
    expect(movePct(0)).toBe("0.00%");
  });
});

describe("answerLabel", () => {
  it("matches the action", () => {
    expect(answerLabel("copy")).toBe("I placed it");
    expect(answerLabel("update")).toBe("I've updated mine");
    expect(answerLabel("close")).toBe("I've closed mine");
  });
});
