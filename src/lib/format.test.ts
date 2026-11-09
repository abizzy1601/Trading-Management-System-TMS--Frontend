import { compact, duration, money, percent, price, timeAgo } from "./format";
import { parseErrorBody } from "./api";

describe("format", () => {
  it("formats money with a real minus sign and optional plus", () => {
    expect(money(1234.5)).toBe("$1,234.50");
    expect(money(-50)).toBe("−$50.00");
    expect(money(12, "USD", { sign: true })).toBe("+$12.00");
    expect(money(0, "USD", { sign: true })).toBe("$0.00");
    expect(money(5, "XYZ")).toBe("XYZ 5.00");
  });
  it("compacts large numbers", () => {
    expect(compact(950)).toBe("950");
    expect(compact(12_900)).toBe("12.9K");
    expect(compact(-4_200_000)).toBe("-4.2M");
  });
  it("handles missing values", () => {
    expect(percent(null)).toBe("—");
    expect(percent(54.321)).toBe("54.3%");
  });
  it("formats durations", () => {
    expect(duration(45)).toBe("45s");
    expect(duration(3000)).toBe("50m");
    expect(duration(5400)).toBe("1h 30m");
    expect(duration(3 * 3600 + 120)).toBe("3h 2m");
    expect(duration(3 * 86400 + 7200)).toBe("3d 2h");
  });
  it("picks price precision by magnitude", () => {
    expect(price(76123.456)).toBe("76,123.46");
    expect(price(150.1234)).toBe("150.123");
    expect(price(1.08123456)).toBe("1.08123");
  });
  it("describes relative time", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(timeAgo("2026-01-01T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-01-01T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo(null)).toBe("never");
  });
});

describe("parseErrorBody", () => {
  it("handles string, validation-array and coded object details", () => {
    expect(parseErrorBody(409, { detail: "Already exists" }).message).toBe("Already exists");
    expect(parseErrorBody(422, { detail: [{ loc: ["body", "login"], msg: "bad digits" }] }).message).toBe("login: bad digits");
    const paywall = parseErrorBody(402, { detail: { code: "subscription_required", message: "Subscribe" } });
    expect(paywall.isPaywall).toBe(true);
    expect(paywall.message).toBe("Subscribe");
    expect(parseErrorBody(500, null).message).toMatch(/our side/);
  });
});
