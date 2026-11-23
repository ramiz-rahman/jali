/** Credit: the score against the program's minimum, and how the borrower has paid their mortgages with us. */
import type { Case } from "../case";
import { guidelines } from "../programs";
import type { Borrower, Mortgage, Payment } from "../rows";
import { NEAR_MINIMUM, scoreBand, STRONG_SCORE } from "../scores";
import { isDelinquent } from "../statuses";
import { paidOf } from "../underwriting";
import { onTime, plural } from "../words";
import type { AreaCheck, Finding } from ".";

export const credit: AreaCheck = ({ app, borrower, mortgages, payments }: Case) => {
  const out: Finding[] = [];
  if (borrower) {
    const score = borrower.credit_score;
    const { minScore } = guidelines(app.program);
    out.push({
      id: "score",
      tone:
        score < minScore
          ? "risk"
          : score < minScore + NEAR_MINIMUM
            ? "warn"
            : score >= STRONG_SCORE
              ? "ok"
              : "info",
      text:
        score < minScore
          ? `Credit score ${score} is under ${app.program}'s ${minScore}`
          : `Credit score ${score}`,
      detail: `${scoreBand(score)} · ${app.program} minimum ${minScore}`,
    });
  }
  if (mortgages && payments) out.push(history(mortgages, payments, borrower));
  return out;
};

/** The borrower's record with us: delinquent, new to us, paid late, on time, or paid off. */
function history(
  mortgages: Mortgage[],
  payments: Payment[],
  borrower: Borrower | undefined,
): Finding {
  const paid = paidOf(payments);
  const behind = mortgages.find(isDelinquent);
  if (behind)
    return {
      id: "history",
      tone: "risk",
      text: "A mortgage is delinquent",
      detail: `${behind.program} loan #${behind.id}, ${plural(paid.missed, "payment")} missed`,
    };
  if (!mortgages.length)
    return {
      id: "history",
      tone: "info",
      text: borrower?.first_time_buyer ? "First-time homebuyer" : "No mortgage with us yet",
      detail: "No mortgage payment history on file",
    };
  if (paid.total && paid.onTime < paid.total)
    return {
      id: "history",
      tone: "warn",
      text: `${plural(paid.late + paid.missed, "late payment")} in 12 months`,
      detail: `${onTime(paid)}${paid.missed ? `, ${paid.missed} missed` : ""}`,
    };
  if (paid.total)
    return {
      id: "history",
      tone: "ok",
      text: "Every payment on time",
      detail: `${plural(paid.total, "payment")} in the last 12 months`,
    };
  return {
    id: "history",
    tone: "ok",
    text: "Earlier mortgages paid in full",
    detail: `${plural(mortgages.length, "loan")} on file`,
  };
}
