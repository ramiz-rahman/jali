/**
 * What the review knows about each loan-book table (the reviewer's word for its rows, the icon a link to one shows),
 * and the refs its links open, with the params of the kinds that show them (kinds.tsx). This module renders nothing,
 * so the views and the kinds can both import it.
 */
import {
  BankIcon,
  CalendarCheckIcon,
  FileTextIcon,
  HouseLineIcon,
  IdentificationBadgeIcon,
  UserIcon,
  type Icon,
} from "@phosphor-icons/react";
import { optional, type ObjectRef, type ParamValue } from "jali-layout";
import { singular } from "@jali-examples/shared/panes/shared/refs";
import type { BookTable } from "../model/rows";

/** The review's pane kinds' ids: kinds.tsx defines them, and the refs below name them. */
export const KIND = {
  overview: "review-overview",
  record: "review-record",
  list: "review-related",
} as const;

export const TABLES: Record<BookTable, { noun: string; icon: Icon }> = {
  loan_applications: { noun: "Application", icon: FileTextIcon },
  borrowers: { noun: "Borrower", icon: UserIcon },
  properties: { noun: "Property", icon: HouseLineIcon },
  loan_officers: { noun: "Loan officer", icon: IdentificationBadgeIcon },
  mortgages: { noun: "Mortgage", icon: BankIcon },
  payments: { noun: "Payment", icon: CalendarCheckIcon },
};

const isBookTable = (table: string): table is BookTable => Object.hasOwn(TABLES, table);

/** A record's name in a pane title or a tab: the reviewer's word for it, with its number ("Application #4"). */
export const recordTitle = (table: string, id: string | number) =>
  `${isBookTable(table) ? TABLES[table].noun : singular(table)} #${id}`;

/** A key as a link carries it: a number, or text. */
const key = (v: ParamValue): string | number => (typeof v === "number" ? v : String(v));

/** A list's params: the rows of `table` whose `column` is `value`, titled `label`. */
export const listParams = { table: String, column: String, value: key, label: optional(String) };

/** An application's Overview. */
export const overviewRef = (item: number): ObjectRef => ({ kind: KIND.overview, params: { item } });

/** One record, in the review's record view. */
export const recordRef = (table: BookTable, id: number): ObjectRef => ({
  kind: KIND.record,
  params: { table, id },
});

/** The columns a list is told by: whose rows it shows. */
export type ListColumn = "borrower_id" | "property_id" | "loan_officer_id";

/** A ref to a list of one loan-book table's rows. */
export interface ListRef extends ObjectRef {
  params: { table: BookTable; column: ListColumn; value: number; label: string };
}

/** The rows of `table` whose `column` is `value`, in the review's list view, titled `label`. */
const listRef = (table: BookTable, column: ListColumn, value: number, label: string): ListRef => ({
  kind: KIND.list,
  params: { table, column, value, label },
});

/** Every mortgage a borrower has with us. */
export const mortgagesOf = (borrower: number) =>
  listRef("mortgages", "borrower_id", borrower, "Mortgages");
/** The applications a borrower has made; `name` is theirs, once it is known. */
export const applicationsBy = (borrower: number, name?: string) =>
  listRef(
    "loan_applications",
    "borrower_id",
    borrower,
    name ? `Applications by ${name}` : "Applications",
  );
/** The liens recorded on a property, titled by its address. */
export const liensOn = (property: number, address: string) =>
  listRef("mortgages", "property_id", property, `Liens on ${address}`);
/** The applications made on a property, titled by its address. */
export const applicationsOn = (property: number, address: string) =>
  listRef("loan_applications", "property_id", property, `Applications on ${address}`);
/** The loans an officer originated. */
export const loansBy = (officer: number, name: string) =>
  listRef("mortgages", "loan_officer_id", officer, `Loans by ${name}`);
/** The applications an officer works on. */
export const applicationsFrom = (officer: number, name: string) =>
  listRef("loan_applications", "loan_officer_id", officer, `Applications from ${name}`);
/** An officer's clients. */
export const clientsOf = (officer: number, name: string) =>
  listRef("borrowers", "loan_officer_id", officer, `Borrowers of ${name}`);

/** What a ref names, for `data-ref`: "borrowers 4", "mortgages borrower_id=4". Tests and tools find links by it. */
export const refKey = ({ kind, params }: ObjectRef) =>
  kind === KIND.record
    ? `${params.table} ${params.id}`
    : `${params.table} ${params.column}=${params.value}`;
