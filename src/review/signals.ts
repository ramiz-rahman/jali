/** What a reviewer should notice before deciding, worked out from the application and the borrower's record. Pure. */
import type { Book, Row } from "./data";
import { counted, instalments, plural } from "./data";

export type Tone = "ok" | "warn" | "risk" | "info";
export interface Signal { id: string; tone: Tone; text: string; detail?: string }

const n = (v: unknown) => Number(v ?? 0);
const money = (cents: number) => `৳${Math.round(cents / 100).toLocaleString("en-US")}`;

export interface SignalInput {
  app: Row; member?: Row; loans?: Row[]; repayments?: Row[];
  group?: Row; standing?: Book; officer?: Row; caseload?: Book;
}

export function signals({ app, member, loans, repayments, group, standing, officer, caseload }: SignalInput): Signal[] {
  const out: Signal[] = [];
  const amount = n(app.amount_cents);

  if (loans) {
    const overdue = loans.filter((l) => l.status === "overdue");
    const open = loans.filter((l) => l.status !== "closed");
    const owed = open.reduce((s, l) => s + n(l.outstanding_cents), 0);
    const paid = repayments ? instalments(repayments) : undefined;
    if (overdue.length) {
      const l = overdue[0]!;
      out.push({ id: "repayment", tone: "risk", text: `Cycle ${l.cycle} is overdue`, detail: `${money(n(l.outstanding_cents))} outstanding${paid?.missed ? `, ${plural(paid.missed, "instalment")} missed` : ""}` });
    } else if (!loans.length) {
      out.push({ id: "repayment", tone: "info", text: "First loan with us", detail: "No repayment record yet" });
    } else if (paid && paid.total) {
      const clean = paid.onTime === paid.total;
      out.push({ id: "repayment", tone: clean ? "ok" : "warn", text: clean ? `Every instalment on time` : `${paid.onTime} of ${paid.total} instalments on time`,
        detail: clean ? `across ${plural(loans.length, "loan")}` : `${plural(paid.late, "late payment")}${paid.missed ? `, ${paid.missed} missed` : ""}` });
    }
    if (open.length) {
      out.push({ id: "exposure", tone: overdue.length ? "warn" : "info", text: `${money(owed + amount)} owed if approved`, detail: `${money(owed)} still owed on ${open.length === 1 ? `cycle ${open[0]!.cycle}` : plural(open.length, "open loan")}` });
    } else if (loans.length) {
      out.push({ id: "exposure", tone: "ok", text: "Nothing owed today", detail: `${plural(loans.length, "earlier loan")} repaid in full` });
    }
    const last = [...loans].sort((a, b) => n(b.cycle) - n(a.cycle))[0];
    if (last) {
      const prev = n(last.principal_cents), ratio = amount / prev;
      const pct = Math.round((ratio - 1) * 100);
      out.push({
        id: "step", tone: ratio >= 1.5 ? "warn" : "info",
        text: ratio >= 1.5 ? `${ratio.toFixed(1)}× the last loan` : pct > 0 ? `${pct}% more than the last loan` : pct < 0 ? `${-pct}% less than the last loan` : "Same as the last loan",
        detail: `cycle ${last.cycle} was ${money(prev)}`,
      });
    }
  }
  if (member) {
    const savings = n(member.savings_cents), weekly = amount / Math.max(1, n(app.term_weeks));
    const weeks = savings / weekly;
    out.push({ id: "savings", tone: weeks < 1 ? "warn" : "info", text: `Savings cover ${weeks < 1 ? "less than one" : weeks < 10 ? weeks.toFixed(1) : Math.round(weeks)} weekly ${weeks >= 1 && weeks < 1.05 ? "instalment" : "instalments"}`, detail: `${money(savings)} saved, ${money(weekly)} a week` });
  }
  if (group && standing) {
    out.push(standing.overdueBorrowers
      ? { id: "group", tone: "warn", text: `${counted(standing.overdueBorrowers, "member")} of ${group.name} overdue`, detail: `${money(standing.overdueOutstanding)} at risk in the group` }
      : { id: "group", tone: "ok", text: `No one in ${group.name} is overdue`, detail: `${plural(standing.active, "active loan")} in the group` });
  }
  if (officer && caseload) {
    const rate = caseload.active ? caseload.overdue / caseload.active : 0;
    out.push({ id: "officer", tone: rate >= 0.1 ? "warn" : "info", text: `${String(officer.name).split(" ")[0]} carries ${plural(caseload.active, "active loan")}`, detail: `${caseload.overdue ? `${caseload.overdue} overdue (${Math.round(rate * 100)}%)` : "none overdue"}` });
  }
  return out;
}
