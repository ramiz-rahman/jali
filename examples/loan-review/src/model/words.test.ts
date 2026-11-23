import { describe, expect, it } from "vite-plus/test";
import { purchase } from "./fixtures";
import { counted, day, loanTerm, monthDay, monthYear, product, rateKind, when } from "./words";

describe("dates", () => {
  it("says a date day first, in UTC", () => {
    expect(day("2026-11-04")).toBe("4 Nov 2026");
    expect(day("2026-11-04T23:30:00Z")).toBe("4 Nov 2026");
    expect(day("2026-09-01")).toBe("1 Sep 2026");
    expect(monthDay("2026-11-04T09:00:00Z")).toBe("4 Nov");
    expect(monthYear("2021-06-15")).toBe("Jun 2021");
  });

  it("adds the time when there is one", () => {
    expect(when("2026-11-02T09:05:00Z")).toBe("2 Nov 2026, 09:05");
    expect(when("2026-11-02")).toBe("2 Nov 2026");
  });

  it("says what isn't a date as it came", () => {
    expect(day("soon")).toBe("soon");
    expect(when("soon")).toBe("soon");
  });
});

describe("loans", () => {
  it("says how the rate moves", () => {
    expect(rateKind(purchase)).toBe("fixed");
    expect(rateKind({ rate_type: { kind: "arm", fixedYears: 7, adjustsMonths: 6 } })).toBe(
      "7/6 ARM",
    );
  });

  it("names the product, and a line's draw and repayment", () => {
    expect(product(purchase)).toBe("Conventional 30-year fixed");
    expect(product({ ...purchase, program: "Home equity", term_months: 180 })).toBe(
      "Home equity loan, 15-year fixed",
    );
    expect(product({ ...purchase, program: "HELOC" })).toBe("HELOC");
    expect(loanTerm({ program: "HELOC", term_months: 360 })).toBe(
      "10-year draw, 20-year repayment",
    );
    expect(loanTerm({ program: "HELOC", term_months: 360 }, true)).toBe("10-year draw");
    expect(loanTerm(purchase)).toBe("30-year");
  });
});

describe("counts", () => {
  it("says a count as a reader does, and the plural before it is known", () => {
    expect(counted(0, "other application")).toBe("No other applications");
    expect(counted(1, "mortgage")).toBe("One mortgage");
    expect(counted(13, "loan")).toBe("13 loans");
    expect(counted(undefined, "other application")).toBe("Other applications");
  });
});
