/** The app's own moves on the workspace, shared by panes and ⌘K commands. */
import type { Jali, NodeId, ObjectRef } from "jali";
import type { Services } from "./services";
import type { Side } from "./trading/trading";
import { blotter } from "./panes/blotter";

/**
 * Show `ref` and bring it into view, without reshaping the desk:
 *  - the pane that already shows it is focused, which brings it to the front (one object, one pane);
 *  - else it opens as a tab of a pane of the same kind on screen (a second chart joins the chart), or of `tabWith`,
 *    in one step (`addTab`: one history entry, nothing folds on the way);
 *  - else beside `from` (default: the focused pane), focused, so it comes to the front even when the desk is full and
 *    Jali folds it into a tab.
 */
export function show(
  jali: Jali,
  ref: ObjectRef,
  { from, tabWith }: { from?: NodeId; tabWith?: NodeId } = {},
): NodeId | undefined {
  const m = jali.model();
  const open = m.paneOf(ref);
  if (open) return jali.actions.focus(open.id).pane;
  const sameKind = m.panes.find((p) => p.ref.kind === ref.kind && p.where === "shown");
  const into = sameKind?.id ?? (tabWith && m.pane(tabWith) ? tabWith : undefined);
  if (into) return jali.actions.addTab(into, ref).pane;
  const source = from ?? jali.get().view.focused ?? m.panes[0]?.id;
  const id = source ? jali.actions.openBeside(source, ref).pane : undefined;
  if (id) jali.actions.focus(id);
  return id;
}

/**
 * Open `ref` from a list as a detail that follows it: the chart for a watchlist row. If the list already has a
 * following detail of that kind, that one is shown (it shows the row once the selection rests), brought to the front
 * if it was folded. Keep it first to keep it, then open another to compare.
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
    if (follower.where !== "shown") jali.actions.focus(follower.id);
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
