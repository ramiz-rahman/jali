/** Capacity: DTI against the program's limits, reserves after closing, and how steady the income is. */
import type { Case } from "../case";
import { guidelines } from "../programs";
import type { Borrower } from "../rows";
import type { Qualifying } from "../underwriting";
import { pct, plural, usd } from "../words";
import type { AreaCheck, Finding } from ".";

export const capacity: AreaCheck = ({ app, borrower }: Case, qualifying) => {
  if (!qualifying || !borrower) return [];
  const { dti: limits, reserves: monthsNeeded } = guidelines(app.program);
  const dti = qualifying.backDti;
  const out: Finding[] = [
    {
      id: "dti",
      tone: dti > limits.max ? "risk" : dti > limits.soft ? "warn" : "ok",
      text:
        dti > limits.max
          ? `DTI ${pct(dti)} is over the ${pct(limits.max, 0)} limit`
          : `DTI ${pct(dti)}`,
      detail: `Housing alone ${pct(qualifying.frontDti)} · ${app.program} allows ${pct(limits.max, 0)}`,
    },
    reserves(qualifying, monthsNeeded),
  ];
  const job = employment(borrower);
  if (job) out.push(job);
  return out;
};

function reserves(qualifying: Qualifying, need: number): Finding {
  const months = qualifying.reserveMonths;
  if (months < 0)
    return {
      id: "reserves",
      tone: "risk",
      text: `Short ${usd(-months * qualifying.housing.total)} to close`,
      detail: `${usd(qualifying.cashToClose)} needed at closing`,
    };
  const label = months >= 24 ? `${Math.floor(months / 12)} years` : `${months.toFixed(1)} months`;
  return {
    id: "reserves",
    tone: months < need ? "warn" : months < 2 ? "info" : "ok",
    text: `${label} of reserves`,
    detail: `After ${usd(qualifying.cashToClose)} to close${need ? ` · ${need} months required` : ""}`,
  };
}

/** Income that needs more than pay stubs to verify: self-employed, retired, or under two years in the job. */
function employment(borrower: Borrower): Finding | undefined {
  if (/self-employed/i.test(borrower.employer))
    return {
      id: "employment",
      tone: "info",
      text: "Self-employed",
      detail: "Two years of tax returns and a P&L to verify income",
    };
  if (/retired/i.test(borrower.job_title))
    return {
      id: "employment",
      tone: "info",
      text: "Retired: pension income",
      detail: "Award letters and 2 months of statements",
    };
  if (borrower.years_employed < 2)
    return {
      id: "employment",
      tone: "warn",
      text: `${plural(borrower.years_employed, "year")} in the current job`,
      detail: "Two-year history needed: verify the prior employer",
    };
  return undefined;
}
