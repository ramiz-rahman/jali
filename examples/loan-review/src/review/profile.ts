/**
 * Loan review: a credit reviewer works through a queue of loan applications. Each application is one page: a header,
 * then tabs (Overview, Application, Borrower, Loan history, Group, Field officer). Split view starts from
 * Overview's sections as panes: the application, with the borrower and their loan history beside it.
 */
import {
  BriefcaseIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  LayoutIcon,
  UserIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { column, pane, row, type ObjectRef } from "jali";
import { definePage, type PageView } from "jali/page";
import { factsOf } from "./facts";
import { overviewKind, reviewRecordKind, reviewRelatedKind } from "./kinds";
import { ApplicationHeader, QueueRail } from "./page";

const ROLES: PageView[] = [
  { id: "overview", label: "Overview", priority: "supporting", icon: LayoutIcon },
  { id: "application", label: "Application", priority: "primary", icon: FileTextIcon },
  { id: "borrower", label: "Borrower", priority: "supporting", icon: UserIcon },
  { id: "history", label: "Loan history", priority: "supporting", icon: ClockCounterClockwiseIcon },
  { id: "group", label: "Group", priority: "supporting", icon: UsersIcon },
  { id: "officer", label: "Field officer", priority: "supporting", icon: BriefcaseIcon },
];

const record = (table: string, id: number) => reviewRecordKind({ table, id });

/**
 * What each view shows for an application: its own record, and the borrower, group and field officer the database
 * says it is for (facts.ts). An application the database doesn't have (a stale link) binds its views to nothing that
 * exists, so each says it can't be found.
 */
function bind(item: number): Record<string, ObjectRef> {
  const f = factsOf(item) ?? { id: item, member: 0, group: 0, officer: 0 };
  return {
    overview: overviewKind({ item: f.id }),
    application: record("loan_applications", f.id),
    borrower: record("members", f.member),
    history: reviewRelatedKind({
      table: "loans",
      column: "member_id",
      value: f.member,
      label: "Loan history",
    }),
    group: record("lending_groups", f.group),
    officer: record("field_officers", f.officer),
  };
}

/** Split view's starting layout: every view is in it; Overview, Group and Field officer start hidden. */
function build(item: number) {
  const refs = bind(item);
  const view = (id: string, options: { weight?: number; hidden?: boolean } = {}) =>
    pane(refs[id]!, {
      id,
      role: id,
      priority: ROLES.find((r) => r.id === id)!.priority,
      ...options,
    });
  return row(
    { id: "arrangement" },
    view("overview", { hidden: true }),
    view("application", { weight: 1.15 }),
    column({ id: "context" }, view("borrower"), view("history")),
    column(
      { id: "network", weight: 0.85 },
      view("group", { hidden: true }),
      view("officer", { hidden: true }),
    ),
  );
}

export const loanReview = definePage({
  id: "loan-review",
  name: "Loan review",
  itemNoun: "application",
  viewers: { full: "credit reviewer", limited: "loan officer" },
  roles: ROLES,
  home: "overview",
  build,
  bind,
  firstItem: 1,
  Rail: QueueRail,
  Header: ApplicationHeader,
});
