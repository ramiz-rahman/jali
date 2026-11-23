import { describe, expect, it } from "vite-plus/test";
import { assess } from "./assessment";
import { borrower, first, home, purchase } from "./fixtures";
import type { Ratio, RatioId } from "./ratios";

const byId = (ratios: Ratio[], id: RatioId) => ratios.find((r) => r.id === id)!;

describe("ratios", () => {
  const { ratios, tones } = assess({ app: purchase, borrower, property: home, mortgages: [] });

  it("reads LTV, DTI, score and reserves in order, the first three for the header", () => {
    expect(ratios.map((r) => r.id)).toEqual(["ltv", "dti", "score", "reserves"]);
    expect(ratios.filter((r) => r.headline).map((r) => r.short)).toEqual(["LTV", "DTI", "Score"]);
  });

  it("says each against its program's limit, toned as its signal", () => {
    expect(byId(ratios, "ltv")).toMatchObject({
      label: "LTV",
      value: "90%",
      limit: 0.97,
      limitLabel: "max 97%",
      note: "on $485,000",
      tone: tones.ltv,
    });
    expect(byId(ratios, "dti")).toMatchObject({ limitLabel: "max 50%", tone: tones.dti });
    expect(byId(ratios, "score")).toMatchObject({
      value: "742",
      at: 742,
      limitLabel: "min 620",
      note: "good",
    });
    expect(byId(ratios, "reserves").limitLabel).toBe("need 2 mo");
  });

  it("reads a second lien on CLTV, with the first mortgage it stays behind", () => {
    const heloc = assess({
      app: {
        ...purchase,
        program: "HELOC",
        purpose: "Home equity line",
        rate_type: { kind: "variable" },
        amount_cents: 100_000_00,
        purchase_price_cents: null,
      },
      borrower,
      property: { ...home, value_cents: 800_000_00 },
      mortgages: [first()],
    });
    expect(byId(heloc.ratios, "ltv")).toMatchObject({
      label: "CLTV",
      value: "71.3%",
      limitLabel: "max 85%",
      note: "with the first mortgage",
    });
    expect(byId(heloc.ratios, "reserves").limitLabel).toBe("none required");
  });

  it("reads … for what hasn't loaded, and the score once the borrower has", () => {
    const { ratios: waiting } = assess({ app: purchase, borrower });
    expect(byId(waiting, "ltv")).toMatchObject({ value: "…", at: undefined });
    expect(byId(waiting, "score").value).toBe("742");
  });
});
