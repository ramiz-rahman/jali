import { describe, expect, it } from "vite-plus/test";
import { parse, rateType } from "./rows";
import { isOpen, queueOrder } from "./statuses";

describe("rows", () => {
  it("reads how the rate moves", () => {
    expect(rateType("Fixed")).toEqual({ kind: "fixed" });
    expect(rateType("Variable")).toEqual({ kind: "variable" });
    expect(rateType("7/6 ARM")).toEqual({ kind: "arm", fixedYears: 7, adjustsMonths: 6 });
  });

  it("reads a status as its kind's", () => {
    const mortgage = parse.mortgages({ status: "paid off" });
    expect(mortgage.status).toBe("paid off");
    expect(isOpen(mortgage)).toBe(false);
    expect(isOpen(parse.mortgages({ status: "delinquent" }))).toBe(true);
  });

  it("puts what waits for a decision first in the queue, then by number", () => {
    const apps = [
      { id: 1, status: "approved" },
      { id: 3, status: "pending" },
      { id: 2, status: "pending" },
      { id: 4, status: "conditions" },
    ] as const;
    expect([...apps].sort(queueOrder).map((a) => a.id)).toEqual([2, 3, 4, 1]);
  });
});
