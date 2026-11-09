import { inputPrice, livePriceText, parseNum, priceDecimals, stopFromPips } from "./sizing";

describe("parseNum", () => {
  it("parses plain, decimal and comma-separated numbers", () => {
    expect(parseNum("1.1")).toBe(1.1);
    expect(parseNum(" 10,000 ")).toBe(10000);
    expect(parseNum("0.0050")).toBe(0.005);
    expect(parseNum(".5")).toBe(0.5);
    expect(parseNum("5.")).toBe(5);
    expect(parseNum("-2")).toBe(-2);
  });
  it("rejects anything that is not a number", () => {
    for (const bad of ["", "  ", "abc", "1.2.3", "1e5", "--1", "$100", "NaN", "Infinity"]) expect(parseNum(bad)).toBeNull();
  });
});

describe("stop from pips", () => {
  it("places the stop on the losing side", () => {
    expect(stopFromPips(1.1, 50, 0.0001, "long")).toBe(1.095);
    expect(stopFromPips(1.1, 50, 0.0001, "short")).toBe(1.105);
    expect(stopFromPips(150, 50, 0.01, "long")).toBe(149.5);
  });
  it("does not leak floating-point noise", () => {
    expect(String(stopFromPips(1.1234, 7, 0.0001, "long"))).toBe("1.1227");
    expect(priceDecimals(0.0001)).toBe(5);
    expect(priceDecimals(0.01)).toBe(3);
  });
  it("shortens live prices", () => {
    expect(inputPrice(1.0912345678)).toBe("1.0912346");
    expect(inputPrice(75929.03)).toBe("75929.03");
  });
});

describe("live price rounding", () => {
  it("rounds to the precision the instrument trades at", () => {
    expect(livePriceText(1.1166946, 0.0001)).toBe("1.11669");     // forex: one finer than the pip
    expect(livePriceText(149.83712, 0.01)).toBe("149.837");        // JPY pair
    expect(livePriceText(2403.456, null)).toBe("2403.46");         // gold, crypto: two decimals above 1,000
    expect(livePriceText(75929.0301, null)).toBe("75929.03");
    expect(livePriceText(0.123456789, null)).toBe("0.123457");
  });
});
