/**
 * Who each application is for (its borrower, property and loan officer), read from the database once, before the
 * page opens. Jali binds a page's views to an item synchronously (`definePage({ bind })`), so the bindings are read
 * here up front and handed to the workspace (workspace.ts: `createLoanReview(parties)`), whose page binds its views
 * from them. The sample is the review's own and nothing in Loan review edits it, so what is read at the start stays
 * true for the visit.
 */
import type { DataApi } from "@jali-examples/shared/data/types";

/** One application's parties, by id. */
export interface ApplicationParties {
  id: number;
  borrower: number;
  property: number;
  officer: number;
}

/** Every application's parties, by application id. */
export type Parties = (application: number) => ApplicationParties;

/** The most applications the review reads: the queue's and the parties' reads share it. */
export const MAX_APPLICATIONS = 500;

/** A whole number id, or undefined. */
const idOf = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * Reads every application's parties. Called once, before the workspace is made. An application the database
 * doesn't have (a stale link) is given ids no row has, so each view bound to them says it can't be found.
 */
export async function loadParties(api: DataApi): Promise<Parties> {
  const { rows } = await api.rows("loan_applications", { limit: MAX_APPLICATIONS });
  const byId = new Map<number, ApplicationParties>();
  for (const r of rows) {
    const [id, borrower, property, officer] = [
      r.id,
      r.borrower_id,
      r.property_id,
      r.loan_officer_id,
    ].map(idOf);
    if (id && borrower && property && officer) byId.set(id, { id, borrower, property, officer });
  }
  return (id) => byId.get(id) ?? { id, borrower: 0, property: 0, officer: 0 };
}
