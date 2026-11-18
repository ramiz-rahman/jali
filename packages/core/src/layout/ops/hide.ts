import type { HideResult, Layout, LayoutContext, ViewState } from "../types";
import type { PaneNode } from "../types";
import { clone, find, noFocus, panes, parent, remove, unzoom } from "../tree/tree";
import { beside } from "../tree/insert";
import { hiddenOf, overlayOf, withOverlay } from "../fit/overlay";
import { resolve } from "../fit/resolve";
import { fitLayout } from "../fit/refit";
import { focus } from "./focus";

/**
 * Hide: the pane leaves the screen with no tab and no slot, and its neighbours absorb the space. The tree keeps it, so
 * showing it again restores its place and size. A tab of a stack is first lifted out beside its group, so it comes back
 * next to the group rather than inside it. Never the last pane shown.
 */
export function hide(
  layout: Layout,
  view: ViewState,
  pane: string,
  ctx: LayoutContext,
): HideResult {
  if (find(layout.root, pane)?.type !== "pane") return { ok: false, reason: "missing" };
  if (hiddenOf(layout).includes(pane)) return { ok: false, reason: "hidden" };
  const owner = parent(layout.root, pane);
  if (owner?.type === "stack")
    layout = liftOut(layout, pane, owner.children.find((c) => c.id !== pane)!.id);
  const shown = resolve(layout, noFocus(), ctx).panes.filter((b) => !b.hidden);
  if (!shown.some((b) => b.id !== pane)) return { ok: false, reason: "last" };
  const o = overlayOf(layout);
  // A hidden pane takes no tucks with it: tabs tucked behind it, or its own tuck record, are dropped.
  const next = withOverlay(layout, {
    ...o,
    tucks: o.tucks.filter((t) => t.pane !== pane && t.home !== pane),
    hidden: [...(o.hidden ?? []), pane],
  });
  const ids = new Set(
    panes(layout.root)
      .map((p) => p.id)
      .filter((id) => id !== pane && !hiddenOf(layout).includes(id)),
  );
  let nextView = unzoom(view);
  if (!view.focused || view.focused === pane) {
    const fallback =
      view.focusHistory.find((id) => ids.has(id)) ?? shown.find((b) => b.id !== pane)!.id;
    nextView = focus(nextView, fallback, ctx);
  }
  return { ok: true, layout: fitLayout(next, nextView, ctx), view: nextView };
}

/** Show a hidden pane in its own place. Room is made by folding others, never the pane being shown. */
export function show(
  layout: Layout,
  view: ViewState,
  pane: string,
  ctx: LayoutContext,
): HideResult {
  if (find(layout.root, pane)?.type !== "pane") return { ok: false, reason: "missing" };
  const o = overlayOf(layout);
  if (!o.hidden?.includes(pane)) return { ok: false, reason: "hidden" };
  const nextView = focus(unzoom(view), pane, ctx);
  const next = withOverlay(layout, {
    ...o,
    hidden: o.hidden.filter((id) => id !== pane),
    folds: o.folds.filter((id) => id !== pane),
  });
  return { ok: true, layout: fitLayout(next, nextView, ctx, { keep: [pane] }), view: nextView };
}

/** The pane, taken out of its stack and placed to the right of the group (a two-tab stack becomes its other pane). */
function liftOut(layout: Layout, pane: string, sibling: string): Layout {
  const next = clone(layout);
  const { userSized: _, ...node } = clone(find(next.root, pane) as PaneNode);
  next.root = remove(next.root, pane)!;
  beside(next, sibling, "right", { ...node, size: { weight: 1 } });
  return next;
}
