import { describe, expect, it } from "vitest";
import { shares } from "../geometry/shares";

describe("flex shares", () => {
  it("allocates fixed pixels then proportional weights", () => {
    expect(shares([{ size: { px: 200 }, min: 100 }, { size: { weight: 1 }, min: 100 }, { size: { weight: 2 }, min: 100 }], 1100)).toEqual([200, 300, 600]);
  });
  it("freezes a minimum then re-shares", () => {
    expect(shares([{ size: { weight: 1 }, min: 400 }, { size: { weight: 3 }, min: 100 }], 800)).toEqual([400, 400]);
  });
  it("freezes maxima and re-shares through multiple rounds", () => {
    expect(shares([{ size: { weight: 1 }, min: 100, max: 150 }, { size: { weight: 1 }, min: 100, max: 250 }, { size: { weight: 1 }, min: 100 }], 1000)).toEqual([150, 250, 600]);
  });
  it("handles opposing min and max violations without over-freezing", () => {
    expect(shares([{ size: { weight: 1 }, min: 400 }, { size: { weight: 1 }, min: 100, max: 280 }], 600)).toEqual([400, 200]);
  });
  it("bounds fixed sizes and preserves weighted minimums on viewport shrink", () => {
    expect(shares([{ size: { px: 900 }, min: 100 }, { size: { weight: 1 }, min: 300 }], 600)).toEqual([300, 300]);
    // Was [200, 200]: max was a hard cap that cut a px size and left a 100px void. max is soft now (a split never shows
    // a void), so px sizes only give way to minimums: 100 + 500 shrinks toward the minimums to fill 500.
    expect(shares([{ size: { px: 50 }, min: 100, max: 200 }, { size: { px: 500 }, min: 100, max: 200 }], 500)).toEqual([100, 400]);
    // Leftover space goes to whatever can still grow, so a row never shows a void.
    expect(shares([{ size: { px: 56 }, min: 56, max: 56 }, { size: { px: 300 }, min: 240 }], 1000)).toEqual([56, 944]);
  });
  it("never scales down infeasible minimums", () => {
    expect(shares([{ size: { weight: 1 }, min: 320 }, { size: { weight: 1 }, min: 480 }], 390)).toEqual([320, 480]);
  });
});

describe("the share rule: minimum, comfortable, max", () => {
  // Data Studio's measures: a table uses any width; a record is comfortable at 440 and uses up to 600.
  const table = { size: { weight: 1 }, min: 400, comfortable: 560 };
  const record = { size: { weight: 1 }, min: 360, comfortable: 440, max: 600 };

  it("brings panes below comfortable up first", () => {
    // 760 of minimums, 140 spare: the record reaches 440 (comfortable) while the table takes the rest.
    expect(shares([record, table], 900)).toEqual([440, 460]);
  });
  it("caps records at comfortable while room is short, and gives a list the rest", () => {
    // The 1440 case: table + record + record in 1428 - 2 gaps. Before, 3 × 480 minimums did not fit.
    expect(shares([table, record, record], 1416)).toEqual([536, 440, 440]);
  });
  it("stops records at their max and lets the table absorb the rest", () => {
    expect(shares([table, record, record], 1896)).toEqual([696, 600, 600]);
  });
  it("grows past max only when every sibling is at its max: a split never shows a void", () => {
    expect(shares([record, record], 1600)).toEqual([800, 800]);
  });
  it("shares in proportion to weight once every child is comfortable", () => {
    expect(shares([{ ...table, size: { weight: 2 } }, table], 1800)).toEqual([1200, 600]);
    // Below comfortable, weight still decides, but no child is held under a sibling's comfortable floor.
    expect(shares([{ ...table, size: { weight: 2 } }, table], 1500)).toEqual([940, 560]);
  });
  it("keeps exact proportions in a split the person sized (weights mode ignores comfortable and max)", () => {
    expect(shares([{ ...table, size: { weight: 700 } }, { ...record, size: { weight: 500 } }], 1200, "weights")).toEqual([700, 500]);
    expect(shares([{ ...record, size: { weight: 1 } }, { ...record, size: { weight: 3 } }], 2000, "weights")).toEqual([500, 1500]);
  });
  it("is the old weighted rule when kinds declare no comfortable or max", () => {
    const items = [{ size: { weight: 1 }, min: 300 }, { size: { weight: 2 }, min: 100 }, { size: { px: 200 }, min: 100 }];
    expect(shares(items, 1100, "flex")).toEqual(shares(items, 1100, "weights"));
  });
});
