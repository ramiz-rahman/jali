/**
 * What the review reads from the database, typed (model/rows.ts). A pane that is out of sight stops reading: every
 * hook here reads `usePaused()`, which the review's panes give (`<Paused value={paused}>`) and which is false outside
 * them, for the header and the queue.
 */
import { createContext, useCallback, useContext, useMemo } from "react";
import {
  isLoading,
  useRecord,
  useRows,
  useRowsMany,
  type Q,
} from "@jali-examples/shared/data/hooks";
import type { RowsQuery } from "@jali-examples/shared/data/types";
import { assess, type Assessment } from "./model/assessment";
import type { Case } from "./model/case";
import {
  parse,
  type BookRows,
  type BookTable,
  type Mortgage,
  type Officer,
  type Payment,
} from "./model/rows";
import { bookOf, paidOf } from "./model/underwriting";

/** Whether the pane reading is out of sight. A review pane gives it; outside one (the header, the queue) it is false. */
export const Paused = createContext(false);

/** Whether this component's reads are paused: its pane is out of sight. */
export const usePaused = () => useContext(Paused);

/**
 * The most rows each read asks for (the data layer reads 100 without a limit). Each is above what the sample holds,
 * so nothing is cut short; the applications' is parties.ts's `MAX_APPLICATIONS`.
 */
export const MOST = {
  /** A list pane's rows. */
  list: 500,
  /** Every borrower, for their names. */
  borrowers: 400,
  /** Mortgages: the whole book. A borrower's are all read, since qualifying counts every open one. */
  mortgages: 2000,
  /** An officer's applications. */
  pipeline: 200,
  /** One mortgage's payments: the last year's. */
  payments: 100,
} as const;

/** A read a pane can gate on: its data (null for a record that isn't there), whether it is loading or failed, a retry. */
export interface Read<T> extends Q<T> {
  refetch: () => unknown;
}

/** The rows of a loan-book table, read as their type, with the read's state. No `query`: nothing is read. */
export function useBookQuery<T extends BookTable>(
  table: T,
  query: RowsQuery | undefined,
): Read<BookRows[T][]> {
  const q = useRows(table, query ?? {}, { paused: usePaused() || !query });
  const rows = useMemo(() => q.data?.rows.map(parse[table]), [q.data, table]);
  return {
    data: rows,
    isLoading: isLoading(q),
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/** Rows of a loan-book table, read as their type; undefined until they load. No `query`: nothing is read. */
export const useBookRows = <T extends BookTable>(table: T, query: RowsQuery | undefined) =>
  useBookQuery(table, query).data;

/** One record, read as its type, with the read's state: null when the database doesn't have it. */
export function useBookRecordQuery<T extends BookTable>(
  table: T,
  id: string,
): Read<BookRows[T] | null> {
  const q = useRecord(table, id, { paused: usePaused() });
  const row = useMemo(() => (q.data ? parse[table](q.data) : q.data), [q.data, table]);
  return {
    data: row,
    isLoading: isLoading(q),
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

/** One record, read as its type; undefined until it loads. No `id`: nothing is read. */
export function useBookRecord<T extends BookTable>(table: T, id: number | undefined) {
  const q = useRecord(table, String(id ?? ""), { paused: usePaused() || id === undefined });
  return useMemo(
    () => (id !== undefined && q.data ? parse[table](q.data) : undefined),
    [q.data, table, id],
  );
}

/**
 * One row by id, read as a query (`where id`), whose cache entry is its own, rather than as a record, whose entry it
 * would share with the record pane showing the same row. The header reads the case this way and is never paused,
 * and a hidden pane doesn't hear the answers to a query it shares (FINDINGS.md, 5): a fetch the header made on a
 * shared entry would leave that pane loading until it is shown. A workaround, kept until the shared hooks change.
 */
const useUnsharedRow = <T extends BookTable>(table: T, id: number | undefined) =>
  useBookRows(table, id === undefined ? undefined : { where: { id }, limit: 1 })?.[0];

/** How many rows match: one row fetched, the total read. */
export function useCount(table: BookTable, where: Record<string, number>) {
  return useRows(table, { where, limit: 1 }, { paused: usePaused() }).data?.total;
}

/** Every mortgage whose `column` is `value`, newest first. No `value`: nothing is read. */
const useMortgagesWhere = (column: "borrower_id" | "property_id", value: number | undefined) =>
  useBookRows(
    "mortgages",
    value === undefined
      ? undefined
      : { where: { [column]: value }, orderBy: "originated_on DESC", limit: MOST.mortgages },
  );

/** Every mortgage a borrower has with us, newest first. */
export const useMortgagesOf = (borrower: number | undefined) =>
  useMortgagesWhere("borrower_id", borrower);

/** Every lien recorded on a property, newest first. */
export const useLiensOn = (property: number | undefined) =>
  useMortgagesWhere("property_id", property);

/** A borrower's name by id, for lists that show many: their number until the names load. The queue reads the same
 *  query, so it is usually cached. */
export function useBorrowerName() {
  const all = useBookRows("borrowers", { orderBy: "id ASC", limit: MOST.borrowers });
  const names = useMemo(() => new Map((all ?? []).map((b) => [b.id, b.name])), [all]);
  return useCallback((id: number) => names.get(id) ?? `Borrower ${id}`, [names]);
}

/**
 * Every payment on these mortgages, oldest first: by mortgage, and, once all have loaded, together and summed up.
 * `mortgages` undefined (still loading) reads nothing and is not ready.
 */
export function usePayments(mortgages: Mortgage[] | undefined) {
  const ids = (mortgages ?? []).map((m) => m.id);
  const results = useRowsMany(
    "payments",
    ids.map((id) => ({ where: { mortgage_id: id }, orderBy: "due_on ASC", limit: MOST.payments })),
    { paused: usePaused() },
  );
  const byMortgage = new Map<number, Payment[]>();
  results.forEach((r, i) => {
    if (r.data) byMortgage.set(ids[i]!, r.data.rows.map(parse.payments));
  });
  const ready = mortgages !== undefined && results.every((r) => r.data !== undefined);
  const all = ready ? [...byMortgage.values()].flat() : undefined;
  return { byMortgage, all, paid: all && paidOf(all) };
}

/** A loan officer's book and pipeline: the mortgages they closed, summed up, and the applications they brought. */
export function useOfficerBook(officer: number | undefined) {
  const where = officer === undefined ? undefined : { loan_officer_id: officer };
  const mortgages = useBookRows("mortgages", where && { where, limit: MOST.mortgages });
  return {
    mortgages,
    book: mortgages && bookOf(mortgages),
    pipeline: useBookRows(
      "loan_applications",
      where && { where, orderBy: "submitted_at DESC", limit: MOST.pipeline },
    ),
  };
}

/** An application's case as read so far, its loan officer, its payments by mortgage, and the case assessed. */
export interface Assessed extends Partial<Case> {
  officer?: Officer;
  byMortgage: Map<number, Payment[]>;
  /** The case assessed (model/assessment.ts), once the application has loaded. */
  assessment?: Assessment;
}

/**
 * An application assessed: the application, then who and what it is for (by the ids on it), the borrower's
 * mortgages and their payments, and the officer. The header, Overview and the Application view all read this, so
 * they never disagree. An application the database doesn't have reads nothing more.
 */
export function useAssessment(item: number): Assessed {
  const app = useUnsharedRow("loan_applications", item);
  const borrower = useUnsharedRow("borrowers", app?.borrower_id);
  const property = useUnsharedRow("properties", app?.property_id);
  const officer = useUnsharedRow("loan_officers", app?.loan_officer_id);
  const mortgages = useMortgagesOf(app?.borrower_id);
  const { byMortgage, all: payments } = usePayments(mortgages);
  const theCase = { borrower, property, mortgages, payments };
  return {
    app,
    ...theCase,
    officer,
    byMortgage,
    assessment: app && assess({ app, ...theCase }),
  };
}
