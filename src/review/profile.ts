/**
 * Loan review: a curated workspace over the sample loan book. A credit reviewer works through a queue of loan
 * applications; each application shows with its borrower and their loan history. Group and field officer are one
 * toggle away. Following any link opens an investigation pane at the right, which is free-form.
 */
import { Briefcase, FileText, History, Inbox, UserRound, UsersRound } from "lucide-react";
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "../layout-core/types";
import { applicationFacts } from "../data/sample-sql";
import type { RoleDef, WorkspaceProfile } from "../ui/profile";

const ROLES: RoleDef[] = [
  { id: "queue", label: "Queue", priority: "supporting", icon: Inbox },
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
    queue: { kind: "review-queue", params: {} },
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
        role("queue", { size: { px: 300 } }),
        role("application", { size: { weight: 1.15 } }),
        col("context", [role("borrower"), role("history")]),
        col("network", [role("group"), role("officer")], 0.85),
      ],
    },
  };
}

export const loanReview: WorkspaceProfile = {
  id: "loan-review",
  name: "Loan review",
  itemNoun: "application",
  roles: ROLES,
  arrangements: [
    { id: "review", label: "Review", hidden: ["group", "officer"] },
    { id: "focus", label: "Focus", hidden: ["queue", "borrower", "history", "group", "officer"] },
  ],
  build,
  bind,
  anchor: "application",
  firstItem: 1,
};
