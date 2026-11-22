/**
 * Who each application is for (its borrower, group and field officer), read from the database once, before the page
 * opens. Jali binds a page's views to an item synchronously (`definePage({ bind })`), so the bindings are read here
 * up front rather than per view. The sample is the review's own and nothing in Loan review edits it, so what is read
 * at the start stays true for the visit.
 */
import type { DataApi } from "@jali-examples/shared/data/types";

export interface Facts {
  id: number;
  member: number;
  group: number;
  officer: number;
}

const byId = new Map<number, Facts>();

/** A whole number id, or undefined. */
const idOf = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Reads every application's facts. Called once, before the workspace is made. */
export async function loadFacts(api: DataApi) {
  const { rows } = await api.rows("loan_applications", { limit: 100_000 });
  byId.clear();
  for (const r of rows) {
    const f = {
      id: idOf(r.id),
      member: idOf(r.member_id),
      group: idOf(r.group_id),
      officer: idOf(r.field_officer_id),
    };
    if (f.id && f.member && f.group && f.officer) byId.set(f.id, f as Facts);
  }
}

/** Sets the facts directly: for tests that run the page without its database. */
export function setFacts(list: readonly Facts[]) {
  byId.clear();
  for (const f of list) byId.set(f.id, f);
}

/** An application's facts, or undefined for one the database doesn't have. */
export const factsOf = (id: number): Facts | undefined => byId.get(id);
