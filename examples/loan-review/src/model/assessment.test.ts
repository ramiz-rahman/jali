import { describe, expect, it } from "vite-plus/test";
import { assess } from "./assessment";
import type { Case } from "./case";
import { borrower, first, home, paid, purchase } from "./fixtures";
import type { Application } from "./rows";
import { monthlyPayment, qualify } from "./underwriting";

const signals = (theCase: Case) => assess(theCase).signals;

const find = (out: ReturnType<typeof signals>, id: string) => out.find((s) => s.id === id);

describe("payment math", () => {
  it("amortizes a 30-year fixed as a lender does", () => {
    // $400,000 at 7% for 30 years: $2,661.21 a month.
    expect(monthlyPayment(400_000_00, 7, 360)).toBe(266_121);
  });

  it("adds taxes, insurance and PMI to the payment, and reads LTV on the lower of price and value", () => {
    const q = qualify(purchase, borrower, home, []);
    expect(q.ltv).toBeCloseTo(0.9, 5);
    expect(q.housing.tax).toBe(775_83);
    expect(q.housing.mortgageInsurance).toBeGreaterThan(0);
    expect(q.cashToClose).toBe(48_500_00 + 13_095_00);
  });
});

describe("assessment", () => {
  it("marks each figure with its signal's tone, and tallies what needs a look", () => {
    const assessment = assess({
      app: { ...purchase, program: "FHA", amount_cents: 400_000_00 },
      borrower: { ...borrower, credit_score: 571 },
      property: home,
      mortgages: [],
      payments: [],
    });
    expect(assessment.tones.score).toBe("risk");
    expect(assessment.tones.ltv).toBe(assessment.signals.find((s) => s.id === "ltv")?.tone);
    expect(assessment.tally.risk).toBe(assessment.signals.filter((s) => s.tone === "risk").length);
    expect(assessment.book).toMatchObject({ loans: 0 });
  });

  it("waits for the borrower, the home and the mortgages to qualify", () => {
    const assessment = assess({ app: purchase });
    expect(assessment.qualifying).toBeUndefined();
    expect(assessment.ratios.find((r) => r.id === "ltv")?.value).toBe("…");
  });
});

describe("review signals", () => {
  it("reads a first-time buyer's purchase: score, DTI, reserves, LTV with PMI", () => {
    const out = signals({ app: purchase, borrower, property: home, mortgages: [], payments: [] });
    expect(find(out, "score")).toMatchObject({ tone: "ok", text: "Credit score 742" });
    expect(find(out, "history")).toMatchObject({ text: "First-time homebuyer" });
    expect(find(out, "ltv")).toMatchObject({ tone: "ok", text: "LTV 90%" });
    expect(find(out, "mi")).toMatchObject({ text: "PMI until 80% LTV" });
    expect(find(out, "dti")?.tone).toBe("ok");
  });

  it("puts what fails a guideline first", () => {
    const out = signals({
      app: { ...purchase, program: "FHA", amount_cents: 400_000_00 },
      borrower: { ...borrower, credit_score: 571 },
      property: home,
      mortgages: [],
      payments: [],
    });
    expect(out[0]).toMatchObject({ tone: "risk", text: "Credit score 571 is under FHA's 580" });
  });

  it("reads a HELOC on its combined LTV, behind the first mortgage it keeps", () => {
    const heloc: Application = {
      ...purchase,
      program: "HELOC",
      purpose: "Home equity line",
      rate_type: { kind: "variable" },
      amount_cents: 150_000_00,
      purchase_price_cents: null,
      note_rate: 8.25,
    };
    const out = signals({
      app: heloc,
      borrower,
      property: { ...home, value_cents: 600_000_00 },
      mortgages: [first()],
      payments: paid(...Array.from({ length: 12 }, () => "on time" as const)),
    });
    // ($470,000 + $150,000) / $600,000
    expect(find(out, "ltv")).toMatchObject({
      tone: "risk",
      text: "CLTV 103.3% is over the 85% limit",
    });
    expect(find(out, "second")).toMatchObject({ text: "Keeps the 2.875% first mortgage" });
    expect(find(out, "history")).toMatchObject({ tone: "ok", text: "Every payment on time" });
  });

  it("flags a cash-out that gives up a low rate, and late payments", () => {
    const out = signals({
      app: {
        ...purchase,
        purpose: "Cash-out refinance",
        amount_cents: 392_000_00,
        purchase_price_cents: null,
        note_rate: 7.375,
      },
      borrower,
      property: home,
      mortgages: [first({ note_rate: 4.25, balance_cents: 300_000_00 })],
      payments: paid("on time", "late", "on time"),
    });
    expect(find(out, "cashout")).toMatchObject({ tone: "warn" });
    expect(find(out, "cashout")?.detail).toContain("giving up a 4.25% rate");
    expect(find(out, "history")).toMatchObject({
      tone: "warn",
      text: "1 late payment in 12 months",
    });
  });

  it("reads the program's rules, not its name: FHA's insurance for life, an ARM, a jumbo within the limit", () => {
    const fha = signals({
      app: { ...purchase, program: "FHA", amount_cents: 460_000_00 },
      borrower,
      property: home,
      mortgages: [],
    });
    expect(find(fha, "mi")).toMatchObject({ text: "FHA mortgage insurance" });
    expect(find(fha, "mi")?.detail).toContain("for the life of the loan");
    const arm = signals({
      app: { ...purchase, rate_type: { kind: "arm", fixedYears: 7, adjustsMonths: 6 } },
    });
    expect(find(arm, "arm")).toMatchObject({
      text: "7/6 ARM",
      detail: "Qualified at the note rate; adjusts after 7 years",
    });
    const jumbo = signals({ app: { ...purchase, program: "Jumbo" } });
    expect(find(jumbo, "limit")).toMatchObject({
      tone: "warn",
      text: "Within the conforming limit",
    });
  });

  it("says a conventional loan over the conforming limit is jumbo", () => {
    const out = signals({ app: { ...purchase, amount_cents: 900_000_00 } });
    expect(find(out, "limit")).toMatchObject({ tone: "risk", text: "Above the conforming limit" });
  });
});
