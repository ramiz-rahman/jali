import type { NodeId } from "@jali/core";
import type { Tab } from "@jali/core/adapter";

/** A group's tabs, in the parts the strip draws them in. Each list keeps the group's order. */
export interface TabGroups {
  /** Every tab the strip lists: on a curated page, its views only where they belong (below). */
  listed: Tab[];
  /** Made by you (not folded in by the layout): pinned and scrolling together. */
  mine: Tab[];
  /** Yours and pinned: they stay in view at the strip's start, as in a browser. */
  pinned: Tab[];
  /** Yours and not pinned: the tabs that scroll. */
  scrolling: Tab[];
  /** The folded tab that is shown, after a hairline: of the panes the layout folded here, only it is a tab. */
  shownFolded: Tab[];
  /** The other folded panes, which wait behind one "N folded" chip, so yours and the layout's never blend. */
  foldedAway: Tab[];
  /** The part that holds the shown tab, which draws the underline: none when no listed tab is shown. */
  activeIn: "pinned" | "scrolling" | null;
}

/**
 * The tabs of a group (`tabs`, `active`) as the strip draws them; `page` while a curated page is shown. A curated
 * page's views live in the page tabs, so a pane's strip lists a page view only while it is shown: never a repeat. The
 * exception is a group of page views, which only a centre drop ("Add as tab") makes: you asked for those tabs, so it
 * lists each view you put there (not ones the layout folded in).
 */
export function tabGroups(
  group: { readonly tabs: readonly Tab[]; readonly active: NodeId },
  page: boolean,
): TabGroups {
  const placed = group.tabs.filter((t) => t.node.role && !t.folded);
  const listed = !page
    ? [...group.tabs]
    : group.tabs.filter(
        (t) => !t.node.role || t.node.id === group.active || (placed.length > 1 && !t.folded),
      );
  const mine = listed.filter((t) => !t.folded);
  const pinned = mine.filter((t) => t.node.pinned);
  return {
    listed,
    mine,
    pinned,
    scrolling: mine.filter((t) => !t.node.pinned),
    shownFolded: listed.filter((t) => t.folded && t.node.id === group.active),
    foldedAway: listed.filter((t) => t.folded && t.node.id !== group.active),
    activeIn: pinned.some((t) => t.node.id === group.active)
      ? "pinned"
      : listed.some((t) => t.node.id === group.active)
        ? "scrolling"
        : null,
  };
}
