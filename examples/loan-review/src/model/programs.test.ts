import { describe, expect, it } from "vite-plus/test";
import { purchase } from "./fixtures";
import { guidelines, isLine, isSecondLien, maxLtv } from "./programs";

describe("maxLtv", () => {
  it("is the program's limit for the purpose", () => {
    expect(maxLtv(purchase)).toBe(0.97);
    expect(maxLtv({ ...purchase, purpose: "Cash-out refinance" })).toBe(0.8);
    expect(maxLtv({ ...purchase, program: "FHA", purpose: "Rate-and-term refinance" })).toBe(
      0.9775,
    );
    expect(maxLtv({ ...purchase, program: "HELOC", purpose: "Home equity line" })).toBe(0.85);
  });

  it("is capped for a home the borrower doesn't live in", () => {
    expect(maxLtv({ ...purchase, occupancy: "Second home" })).toBe(0.9);
    expect(maxLtv({ ...purchase, program: "VA", occupancy: "Investment" })).toBe(0.85);
    // A cap above the program's own limit changes nothing.
    expect(maxLtv({ ...purchase, program: "Jumbo", occupancy: "Investment" })).toBe(0.8);
  });
});

describe("guidelines", () => {
  it("says what kind of loan a program is", () => {
    expect(isLine({ program: "HELOC" })).toBe(true);
    expect(isSecondLien({ program: "Home equity" })).toBe(true);
    expect(isLine({ program: "Home equity" })).toBe(false);
    expect(guidelines("Home equity").closingCostRate).toBe(0.01);
    expect(guidelines("Jumbo").conforming).toBe("above");
  });
});
