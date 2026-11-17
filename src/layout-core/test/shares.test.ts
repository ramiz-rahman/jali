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
    expect(shares([{ size: { px: 50 }, min: 100, max: 200 }, { size: { px: 500 }, min: 100, max: 200 }], 500)).toEqual([200, 200]);
    // Leftover space goes to whatever can still grow, so a row never shows a void.
    expect(shares([{ size: { px: 56 }, min: 56, max: 56 }, { size: { px: 300 }, min: 240 }], 1000)).toEqual([56, 944]);
  });
  it("never scales down infeasible minimums", () => {
    expect(shares([{ size: { weight: 1 }, min: 320 }, { size: { weight: 1 }, min: 480 }], 390)).toEqual([320, 480]);
  });
});
