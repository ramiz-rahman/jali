/**
 * Loan review: a credit reviewer works through a queue of loan applications. Each application is one page: a header,
 * then tabs (Overview, Application, Borrower, Loan history, Group, Field officer). Multiplexed mode starts from
 * Overview's sections as panes: the application, with the borrower and their loan history beside it.
 */
import { Briefcase, FileText, History, LayoutDashboard, UserRound, UsersRound } from "lucide-react";
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "../layout-core/types";
import { applicationFacts } from "../data/sample-sql";
import type { RoleDef, WorkspaceProfile } from "../ui/define";
import { ApplicationHeader, QueueRail } from "./page";

const ROLES: RoleDef[] = [
  { id: "overview", label: "Overview", priority: "supporting", icon: LayoutDashboard },
  { id: "application", label: "Application", priority: "primary", icon: FileText },
  { id: "borrower", label: "Borrower", priority: "supporting", icon: UserRound },
  { id: "history", label: "Loan history", priority: "supporting", icon: History },
  { id: "group", label: "Group", priority: "supporting", icon: UsersRound },
  { id: "officer", label: "Field officer", priority: "supporting", icon: Briefcase },
];

const record = (table: string, id: number): ObjectRef => ({ kind: "review-record", params: { table, id } });

function bind(item: number): Record<string, ObjectRef> {
  const f = applicationFacts(item);
  return {
    overview: { kind: "review-overview", params: { item: f.id } },
    application: record("loan_applications", f.id),
    borrower: record("members", f.member),
    history: { kind: "review-related", params: { table: "loans", column: "member_id", value: f.member, label: "Loan history" } },
    group: record("lending_groups", f.group),
    officer: record("field_officers", f.officer),
  };
}

function build(item: number): Layout {
  const refs = bind(item);
  const role = (id: string, extra: Partial<PaneNode> = {}): PaneNode => {
    const r = ROLES.find((x) => x.id === id)!;
    return { id, type: "pane", size: { weight: 1 }, ref: refs[id]!, role: id, priority: r.priority, ...extra };
  };
  const col = (id: string, children: LayoutNode[], weight = 1): LayoutNode => ({ id, type: "column", size: { weight }, children });
  return {
    version: 1,
    root: {
      id: "arrangement", type: "row", size: { weight: 1 }, children: [
        role("overview"),
        role("application", { size: { weight: 1.15 } }),
        col("context", [role("borrower"), role("history")]),
        col("network", [role("group"), role("officer")], 0.85),
      ],
    },
    overlay: { tucks: [], folds: [], shown: {}, hidden: ["overview", "group", "officer"] },
  };
}

export const loanReview: WorkspaceProfile = {
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
};
