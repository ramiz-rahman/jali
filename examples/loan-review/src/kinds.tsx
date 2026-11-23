/** The review's pane kinds: Overview, and the record and list views the tabs and links open. */
import { FileTextIcon, LayoutIcon, LinkSimpleHorizontalIcon } from "@phosphor-icons/react";
import { definePane, type Pane } from "jali/react";
import { recordParams } from "@jali-examples/shared/panes/kinds/record";
import { relatedIdentity } from "@jali-examples/shared/panes/kinds/related";
import { KIND, listParams, recordTitle } from "./nav/refs";
import { ReviewListPane } from "./views/lists";
import { OverviewPane } from "./views/overview";
import { ReviewRecordPane } from "./views/records";

export const overviewKind = definePane(KIND.overview, {
  params: { item: Number },
  title: ({ item }) => `Application #${item} overview`,
  icon: LayoutIcon,
  width: { min: 360 },
  height: { min: 240 },
  inRecent: false,
  Component: OverviewPane,
});

/**
 * The tabs' views, designed for the reviewer (views/records, views/lists): plain words, dollar amounts, related
 * records as links. Minimums stay narrow so two views fit side by side at 1440. They show the same objects as Data
 * Studio's record and related kinds, so a link to one already on the page goes to it, whichever kind the link names.
 */
export const reviewRecordKind = definePane(KIND.record, {
  params: recordParams,
  title: ({ table, id }) => recordTitle(table, id),
  icon: FileTextIcon,
  width: { min: 380 },
  height: { min: 240 },
  shows: "record",
  Component: ReviewRecordPane,
});

export const reviewListKind = definePane(KIND.list, {
  params: listParams,
  title: ({ label }) => label ?? "Related",
  icon: LinkSimpleHorizontalIcon,
  width: { min: 360 },
  height: { min: 240 },
  shows: "related",
  identity: relatedIdentity,
  Component: ReviewListPane,
});

/** The loan-review workspace's pane kinds. */
export const loanReviewKinds: readonly Pane[] = [overviewKind, reviewRecordKind, reviewListKind];
