import { MIN_GAP, riskRewardLayout, staggerMarkers } from "./riskReward";

describe("riskRewardLayout", () => {
  it("puts the stop at the left edge and the last target at the right for a long", () => {
    // risk 5, rewards 7.5 and 12.5 => total span 17.5
    const l = riskRewardLayout("long", 95, 100, [107.5, 112.5]);
    expect(l.stop).toBe(0);
    expect(l.targets[1]).toBe(100);
    expect(l.entry).toBeCloseTo((5 / 17.5) * 100, 5);
    expect(l.targets[0]).toBeCloseTo((12.5 / 17.5) * 100, 5);
  });
  it("mirrors a short so it reads the same way", () => {
    const long = riskRewardLayout("long", 95, 100, [107.5, 112.5]);
    const short = riskRewardLayout("short", 105, 100, [92.5, 87.5]);
    expect(short.stop).toBeCloseTo(long.stop, 5);
    expect(short.entry).toBeCloseTo(long.entry, 5);
    short.targets.forEach((t, i) => expect(t).toBeCloseTo(long.targets[i]!, 5));
  });
  it("never divides by zero", () => {
    const l = riskRewardLayout("long", 100, 100, [100]);
    expect(Number.isFinite(l.entry) && Number.isFinite(l.stop)).toBe(true);
  });
});

describe("staggerMarkers", () => {
  const m = (x: number, label: string) => ({ x, label, value: x });

  it("leaves well-spaced markers on the first row", () => {
    const out = staggerMarkers([m(0, "Stop"), m(30, "Entry"), m(70, "TP1"), m(100, "TP2")]);
    expect(out.map((o) => o.row)).toEqual([0, 0, 0, 0]);
  });
  it("moves a marker that would collide onto the second row", () => {
    const out = staggerMarkers([m(0, "Stop"), m(28, "Entry"), m(91, "TP1"), m(96, "TP2")]);
    expect(out.find((o) => o.label === "TP1")!.row).toBe(0);
    expect(out.find((o) => o.label === "TP2")!.row).toBe(1);
  });
  it("alternates rows through a tight cluster and never leaves two neighbours on one row", () => {
    const out = staggerMarkers([m(40, "A"), m(44, "B"), m(48, "C"), m(52, "D")]);
    expect(out.map((o) => o.row)).toEqual([0, 1, 0, 1]);
    for (let i = 1; i < out.length; i++) {
      if (out[i]!.x - out[i - 1]!.x < MIN_GAP) expect(out[i]!.row).not.toBe(out[i - 1]!.row);
    }
  });
  it("keeps labels away from the edges and returns them in left-to-right order", () => {
    const out = staggerMarkers([m(100, "TP2"), m(0, "Stop")]);
    expect(out.map((o) => o.label)).toEqual(["Stop", "TP2"]);
    expect(out[0]!.x).toBeGreaterThanOrEqual(6);
    expect(out[1]!.x).toBeLessThanOrEqual(94);
  });
});
