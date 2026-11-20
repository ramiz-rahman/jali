import { describe, expect, it } from "vite-plus/test";
import { pickChartColumns } from "./chart";

describe("the chart", () => {
  it("picks a text column across and a number that isn't an id up", () => {
    expect(
      pickChartColumns([{ region: "Dhaka", id: 1, amount: 5 }], ["region", "id", "amount"]),
    ).toEqual({ x: "region", y: "amount" });
  });
});
