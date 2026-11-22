/** What the loan-review views read, beyond one application (useApplication in page.tsx): counts, repayments, standing. */
import { useQueries } from "@tanstack/react-query";
import { useRows } from "@jali-examples/shared/data/hooks";
import { useDataLayer } from "@jali-examples/shared/data/react";
import type { Row, RowsQuery, TableName } from "@jali-examples/shared/data/types";

export type { Row };
const n = (v: unknown) => Number(v ?? 0);

/** How many rows match: one row fetched, the total read. */
export function useCount(
  table: TableName,
  where: Record<string, string | number> | null,
  paused = false,
) {
  const q = useRows(table, { where: where ?? {}, limit: 1 }, { paused: paused || !where });
  return where ? q.data?.total : undefined;
}

/** Every instalment of these loans, by loan id. */
export function useRepayments(loanIds: number[], paused = false) {
  const layer = useDataLayer();
  const results = useQueries(
    {
      queries: loanIds.map((id) => {
        const opts: RowsQuery = { where: { loan_id: id }, orderBy: "due_on ASC", limit: 100 };
        return {
          queryKey: layer.keys.rows("repayments", opts),
          queryFn: () => layer.api.rows("repayments", opts),
          enabled: !paused,
        };
      }),
    },
    layer.queryClient,
  );
  const byLoan = new Map<number, Row[]>();
  results.forEach((r, i) => {
    if (r.data) byLoan.set(loanIds[i]!, r.data.rows);
  });
  return { byLoan, ready: results.every((r) => r.data !== undefined) };
}

/** A set of loans summed up: how many are open, how much is owed, how many are overdue. */
export interface Book {
  loans: number;
  active: number;
  overdue: number;
  outstanding: number;
  overdueOutstanding: number;
  borrowers: number;
  overdueBorrowers: number;
}
export function book(loans: Row[]): Book {
  const open = loans.filter((l) => l.status !== "closed");
  const late = loans.filter((l) => l.status === "overdue");
  return {
    loans: loans.length,
    active: open.length,
    overdue: late.length,
    outstanding: open.reduce((s, l) => s + n(l.outstanding_cents), 0),
    overdueOutstanding: late.reduce((s, l) => s + n(l.outstanding_cents), 0),
    borrowers: new Set(open.map((l) => n(l.member_id))).size,
    overdueBorrowers: new Set(late.map((l) => n(l.member_id))).size,
  };
}

/** A field officer's caseload: their loans and groups. A group's standing is the same loans, narrowed to its members. */
export function useOfficerBook(officer: number | undefined, paused = false) {
  const loans = useRows(
    "loans",
    { where: officer ? { field_officer_id: officer } : {}, limit: 2000 },
    { paused: paused || !officer },
  );
  const groups = useRows(
    "lending_groups",
    { where: officer ? { field_officer_id: officer } : {}, orderBy: "name ASC", limit: 200 },
    { paused: paused || !officer },
  );
  return {
    loans: officer ? loans.data?.rows : undefined,
    groups: officer ? groups.data?.rows : undefined,
  };
}

export function useGroupStanding(group: Row | undefined, paused = false) {
  const id = group ? n(group.id) : undefined;
  const members = useRows(
    "members",
    { where: id ? { group_id: id } : {}, orderBy: "name ASC", limit: 500 },
    { paused: paused || !id },
  );
  const officer = useOfficerBook(group ? n(group.field_officer_id) : undefined, paused);
  const list = id ? members.data?.rows : undefined;
  if (!list || !officer.loans) return { members: list, loans: undefined, standing: undefined };
  const ids = new Set(list.map((m) => n(m.id)));
  const loans = officer.loans.filter((l) => ids.has(n(l.member_id)));
  return { members: list, loans, standing: book(loans) };
}

/** Every member (the queue reads the same query, so it is usually cached). */
export const useAllMembers = (paused = false) =>
  useRows("members", { orderBy: "id ASC", limit: 400 }, { paused }).data?.rows;
/** Every member's name, for lists that show borrowers. */
export function useMemberNames(paused = false) {
  return new Map((useAllMembers(paused) ?? []).map((m) => [n(m.id), String(m.name)]));
}

/** Each member's latest loan, from a set of loans. */
export function latestLoans(loans: Row[]) {
  const out = new Map<number, Row>();
  for (const l of loans) {
    const m = n(l.member_id),
      had = out.get(m);
    if (!had || n(l.cycle) > n(had.cycle)) out.set(m, l);
  }
  return out;
}

/* ---------- words ---------- */

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
/** "13 members", "One other application", "No other applications": a count as a reader says it. */
export function counted(count: number, one: string, many = `${one}s`) {
  if (count < 10) return `${WORDS[count]} ${count === 1 ? one : many}`;
  return plural(count, one, many);
}

/** Whole years between two ISO dates, "less than a year" under one. */
export function tenure(since: unknown, until: unknown): string {
  const a = new Date(String(since)),
    b = new Date(String(until));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const years = Math.floor((b.getTime() - a.getTime()) / (365.25 * 864e5));
  return years < 1 ? "less than a year" : plural(years, "year");
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for review",
  returned: "Returned",
  approved: "Approved",
  active: "Active",
  overdue: "Overdue",
  closed: "Repaid",
  "on time": "On time",
  late: "Late",
  missed: "Missed",
};
export const statusLabel = (s: unknown) => STATUS_LABEL[String(s)] ?? String(s ?? "");

/** Instalments summed up across loans. */
export function instalments(rows: Row[]) {
  const paid = rows.filter((r) => r.status !== "missed");
  return {
    total: rows.length,
    onTime: rows.filter((r) => r.status === "on time").length,
    late: rows.filter((r) => r.status === "late").length,
    missed: rows.length - paid.length,
  };
}
