import { FileText, LayoutDashboard, Link2 } from "lucide-react";
import { definePaneKind } from "../ui/define";
import { singular } from "../panes/shared/refs";
import { OverviewPane } from "./overview";
import { ReviewRecordPane } from "./records";
import { ReviewRelatedPane } from "./lists";

export const overviewKind = definePaneKind({
  kind: "review-overview", ref: (params) => ({ kind: "review-overview", params }), title: (r) => `Application #${r.params.item} overview`,
  recordable: false, minWidth: 360, minHeight: 240, icon: LayoutDashboard, Component: OverviewPane,
});

/** A record's name in a pane title or a tab: the reviewer's word for it, with its number. */
const NOUN: Record<string, string> = { loan_applications: "Application", members: "Member", lending_groups: "Group", field_officers: "Field officer", loans: "Loan", repayments: "Instalment" };
const recordTitle = (table: string, id: unknown) => id === undefined ? (NOUN[table] ?? singular(table)) : `${NOUN[table] ?? singular(table)} #${id}`;

/**
 * The tabs' views, designed for the reviewer (records.tsx, lists.tsx): plain words, ৳ amounts, related records as
 * links. Minimums stay narrow so two views fit side by side at 1440.
 */
export const reviewRecordKind = definePaneKind({
  kind: "review-record", ref: (params) => ({ kind: "review-record", params }),
  title: (r) => recordTitle(String(r.params.table ?? ""), r.params.id),
  minWidth: 380, minHeight: 240, icon: FileText, Component: ReviewRecordPane,
});
export const reviewRelatedKind = definePaneKind({
  kind: "review-related", ref: (params) => ({ kind: "review-related", params }),
  title: (r) => String(r.params.label ?? "Related"),
  minWidth: 360, minHeight: 240, icon: Link2, Component: ReviewRelatedPane,
});
