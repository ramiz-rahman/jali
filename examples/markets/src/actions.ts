/** The app's own moves on the workspace, shared by panes and ⌘K commands. */
import type { Jali, NodeId, ObjectRef } from "@jali/core";
import type { Services } from "./services";
import type { Side } from "./trading/trading";
import { blotter } from "./panes/blotter";

/**
 * Show `ref` and bring it into view, without reshaping the desk:
 *  - the pane that already shows it is revealed (one object, one pane);
 *  - else it opens as a tab of a pane of the same kind on screen (a second chart joins the chart), or of `tabWith`;
 *  - else beside `from` (default: the focused pane).
 * Focusing it brings it to the front even when the desk is full and Jali folds it into a tab.
 */
export function show(
  jali: Jali,
  ref: ObjectRef,
  { from, tabWith }: { from?: NodeId; tabWith?: NodeId } = {},
): NodeId | undefined {
  const m = jali.model();
  const open = m.panes.find((p) => jali.env.kinds.sameObject(p.ref, ref));
  if (open) {
    jali.actions.focus(open.id);
    return open.id;
  }
  const onScreen = new Set(m.resolved.panes.filter((b) => !b.hidden).map((b) => b.id));
  const sameKind = m.panes.find((p) => p.ref.kind === ref.kind && onScreen.has(p.id));
  const into = sameKind?.id ?? tabWith;
  const source = into ?? from ?? jali.get().view.focused ?? m.panes[0]?.id;
  const id = source ? jali.actions.openBeside(source, ref).pane : undefined;
  if (!id) return undefined;
  if (into && jali.model().pane(into)) jali.actions.mergeInto(id, into);
  jali.actions.focus(id);
  return id;
}

/**
 * Open `ref` from a list as a detail that follows it: the chart for a watchlist row. If the list already has a
 * following detail of that kind, that one is shown (it shows the row once the selection rests), brought to the front
 * if it was folded. Pin it first to keep it, then open another to compare.
 *
 * The watchlist selects a quote; a chart for the same instrument counts as opening the selection because the chart's
 * kind says what it shows for a quote (`follow`, panes/follow.ts), so the new chart follows the list.
 */
export function openFollowing(jali: Jali, list: NodeId, ref: ObjectRef): NodeId | undefined {
  const follower = jali
    .model()
    .panes.find((p) => p.linkedTo === list && p.follows && p.ref.kind === ref.kind);
  if (follower) {
    // Folded behind a tab (a phone, a crowded desk): bring it to the front, since the person asked to open it.
    const hidden = !jali.model().resolved.panes.some((b) => b.id === follower.id && !b.hidden);
    if (hidden) jali.actions.focus(follower.id);
    return follower.id;
  }
  return jali.actions.openBeside(list, ref).pane;
}

/** Fill the order ticket with a side and an instrument, and bring the blotter that holds it. */
export function prepareTicket(
  jali: Jali,
  services: Services,
  symbol: string,
  side: Side,
  from?: NodeId,
) {
  services.ticket.set({ symbol, side, at: Date.now() });
  showBlotter(jali, from);
}

/** The blotter: on a desk without one, it opens as a tab of the news, so the desk keeps its shape. */
export function showBlotter(jali: Jali, from?: NodeId) {
  const news = jali.model().panes.find((p) => p.ref.kind === "news");
  return show(jali, blotter(), { from, tabWith: news?.id });
}
