import { FileTextIcon, LayoutIcon, LinkSimpleHorizontalIcon } from "@phosphor-icons/react";
import { definePane } from "@jali/react";
import { singular } from "../../../shared/src/panes/shared/refs";
import { OverviewPane } from "./overview";
import { ReviewRecordPane } from "./records";
import { recordParams } from "../../../shared/src/panes/kinds/record";
import { ReviewRelatedPane } from "./lists";

export const overviewKind = definePane("review-overview", {
  params: { item: Number },
  title: ({ item }) => `Application #${item} overview`,
  icon: LayoutIcon,
  width: { min: 360 },
  height: { min: 240 },
  inRecent: false,
  Component: OverviewPane,
});

/** A record's name in a pane title or a tab: the reviewer's word for it, with its number. */
const NOUN: Record<string, string> = {
  loan_applications: "Application",
  members: "Member",
  lending_groups: "Group",
  field_officers: "Field officer",
  loans: "Loan",
  repayments: "Instalment",
};
const recordTitle = (table: string, id: string | number) =>
  `${NOUN[table] ?? singular(table)} #${id}`;

/**
 * The tabs' views, designed for the reviewer (records.tsx, lists.tsx): plain words, ৳ amounts, related records as
 * links. Minimums stay narrow so two views fit side by side at 1440. They show the same objects as Data Studio's
 * record and related kinds, so a link to one already on the page goes to it, whichever kind the link names.
 */
export const reviewRecordKind = definePane("review-record", {
  params: recordParams,
  title: ({ table, id }) => recordTitle(table, id),
  icon: FileTextIcon,
  width: { min: 380 },
  height: { min: 240 },
  shows: "record",
  Component: ReviewRecordPane,
});

export const reviewRelatedKind = definePane("review-related", {
  title: ({ label }) => String(label ?? "Related"),
  icon: LinkSimpleHorizontalIcon,
  width: { min: 360 },
  height: { min: 240 },
  shows: "related",
  Component: ReviewRelatedPane,
});
