import { describe, expect, it } from "vitest";
import { fraction, parseProgress, visit } from "./progress";

describe("progress", () => {
  it("reads what was stored, and drops what is not the right shape", () => {
    expect(parseProgress(null)).toEqual({});
    expect(parseProgress("not json")).toEqual({});
    expect(parseProgress("[1]")).toEqual({});
    const stored = {
      tcp: { step: 2, reached: 4 },
      bad: { step: "x" },
      neg: { step: -1, reached: 0 },
    };
    expect(parseProgress(JSON.stringify(stored))).toEqual({ tcp: { step: 2, reached: 4 } });
  });

  it("keeps the furthest step reached and the one the person is on", () => {
    let p = visit({}, "tcp", 0);
    p = visit(p, "tcp", 3);
    p = visit(p, "tcp", 1);
    expect(p["tcp"]).toEqual({ step: 1, reached: 4 });
  });

  it("returns the same object when nothing changed", () => {
    const p = visit({}, "dns", 2);
    expect(visit(p, "dns", 2)).toBe(p);
  });

  it("is a fraction of the lesson’s pages, never past one", () => {
    expect(fraction({}, "dns", 9)).toBe(0);
    expect(fraction({ dns: { step: 3, reached: 3 } }, "dns", 9)).toBeCloseTo(1 / 3);
    expect(fraction({ dns: { step: 8, reached: 12 } }, "dns", 9)).toBe(1);
  });
});
