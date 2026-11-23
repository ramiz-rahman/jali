/**
 * The page's views (its roles), as tabs name them: Overview, Application, Borrower, Mortgages, Property and Loan
 * officer. A role's id is the `tab` a link carries. Each one says whose rows it shows (the application's own, or its
 * borrower's, property's or loan officer's) and the ref that shows them, so the page binds its views by mapping
 * them (page/definition.ts). Their words and icons are their table's (refs.ts). This module renders nothing, so
 * Overview and the tests can name the views without importing the page.
 */
import { LayoutIcon, type Icon } from "@phosphor-icons/react";
import type { ObjectRef } from "jali";
import type { PageView } from "jali/page";
import type { BookTable } from "../model/rows";
import { pluralOf } from "../model/words";
import type { ApplicationParties } from "../parties";
import { mortgagesOf, overviewRef, recordRef, TABLES } from "./refs";

/** One view: how a tab names it, and what it shows for an application's party. */
interface RoleView extends Pick<PageView, "label" | "priority"> {
  icon: Icon;
  /** Whose rows: the application's own, or its borrower's, property's or loan officer's. */
  party: keyof ApplicationParties;
  /** The ref that shows party `id`'s rows. */
  ref: (id: number) => ObjectRef;
}

/** The record of a table's row (or, with `ref`, a list of them), named by the table. */
function of(
  table: BookTable,
  party: RoleView["party"],
  {
    ref = (id: number) => recordRef(table, id),
    plural = false,
    priority = "supporting",
  }: { ref?: RoleView["ref"]; plural?: boolean; priority?: RoleView["priority"] } = {},
): RoleView {
  const { noun, icon } = TABLES[table];
  return { label: plural ? pluralOf(noun) : noun, icon, priority, party, ref };
}

export const ROLES = {
  overview: {
    label: "Overview",
    icon: LayoutIcon,
    priority: "supporting",
    party: "id",
    ref: overviewRef,
  },
  application: of("loan_applications", "id", { priority: "primary" }),
  borrower: of("borrowers", "borrower"),
  mortgages: of("mortgages", "borrower", { ref: mortgagesOf, plural: true }),
  property: of("properties", "property"),
  officer: of("loan_officers", "officer"),
} satisfies Record<string, RoleView>;

export type Role = keyof typeof ROLES;

/** The views as the page declares them, in tab order. */
export const PAGE_VIEWS = Object.entries(ROLES).map(
  ([id, { label, icon, priority }]): PageView => ({ id, label, icon, priority }),
);
