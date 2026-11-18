import { describe, expect, it } from "vite-plus/test";
import { signals } from "./signals";

const app = { id: 4, amount_cents: 6_000_000, term_weeks: 26 };
const loan = (cycle: number, status: string, principal: number, outstanding = 0) => ({
  id: cycle,
  member_id: 1,
  cycle,
  status,
  principal_cents: principal,
  outstanding_cents: outstanding,
});

describe("review signals", () => {
  it("reads a clean record: every instalment on time, the step up from the last loan, what would be owed", () => {
    const loans = [loan(1, "closed", 2_000_000), loan(2, "active", 4_500_000, 2_925_000)];
    const repayments = Array.from({ length: 8 }, () => ({ status: "on time" }));
    const out = signals({ app, loans, repayments });
    expect(out.find((s) => s.id === "repayment")).toMatchObject({
      tone: "ok",
      text: "Every instalment on time",
    });
    expect(out.find((s) => s.id === "exposure")).toMatchObject({
      text: "৳89,250 owed if approved",
    });
    expect(out.find((s) => s.id === "step")).toMatchObject({
      tone: "info",
      text: "33% more than the last loan",
    });
  });

  it("puts an overdue loan first, as a risk, with the missed instalments", () => {
    const repayments = [
      { status: "on time" },
      { status: "late" },
      { status: "missed" },
      { status: "missed" },
    ];
    const out = signals({ app, loans: [loan(1, "overdue", 5_500_000, 3_025_000)], repayments });
    expect(out[0]).toMatchObject({
      tone: "risk",
      text: "Cycle 1 is overdue",
      detail: "৳30,250 outstanding, 2 instalments missed",
    });
    expect(out.find((s) => s.id === "exposure")?.tone).toBe("warn");
  });

  it("flags a big step up and a first loan in words", () => {
    expect(
      signals({ app, loans: [loan(1, "closed", 2_000_000)], repayments: [] }).find(
        (s) => s.id === "step",
      ),
    ).toMatchObject({ tone: "warn", text: "3.0× the last loan" });
    expect(signals({ app, loans: [], repayments: [] })[0]).toMatchObject({
      text: "First loan with us",
    });
  });
});
