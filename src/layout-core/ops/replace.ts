import type { Layout, LayoutContext, LayoutNode, PaneNode, ViewState } from "../types";
import { clone, find, map, unzoom } from "../tree/tree";
import { overlayOf, withOverlay } from "../fit/overlay";
import { fitLayout } from "../fit/refit";
import { focus } from "./focus";

/**
 * Replace: `incoming` takes `current`'s place exactly (slot, size, tab position, fold and tuck records), and `current`
 * takes `incoming`'s old place: off screen when that was hidden. Nothing else moves, so every rect on screen stays
 * the same unless `incoming` cannot fit the slot (then the layout refits around it and `reshaped` says so).
 */
export function replace(layout: Layout, view: ViewState, current: string, incoming: string, ctx: LayoutContext) {
  const a = find(layout.root, current), b = find(layout.root, incoming);
  if (current === incoming || a?.type !== "pane" || b?.type !== "pane") return { layout, view, reshaped: false };
  // Each pane moves into the other's position; the position keeps its size.
  const place = (n: PaneNode, at: PaneNode): PaneNode => {
    const { size: _s, userSized: _u, base: _b, ...content } = clone(n);
    return { ...content, size: at.size, ...(at.userSized ? { userSized: at.userSized } : {}), ...(at.base ? { base: at.base } : {}) };
  };
  const swapId = (id: string) => (id === current ? incoming : id === incoming ? current : id);
  const moved = map(layout.root, (n): LayoutNode => (n.id === current ? place(b, a) : n.id === incoming ? place(a, b) : n));
  // A stack showing either pane now shows the one in that position (map stops at a changed node, hence two passes).
  const root = map(moved, (n): LayoutNode => (n.type === "stack" && (n.active === current || n.active === incoming) ? { ...n, active: swapId(n.active), children: n.children } : n));
  // Overlay records follow the position, not the pane.
  const o = overlayOf(layout);
  const next = withOverlay({ ...layout, root }, {
    tucks: o.tucks.map((t) => ({ ...t, pane: swapId(t.pane), home: swapId(t.home) })),
    folds: o.folds.map(swapId),
    shown: Object.fromEntries(Object.entries(o.shown).map(([k, v]) => [swapId(k), swapId(v)])),
    hidden: o.hidden?.map(swapId),
  });
  const nextView = focus(unzoom(view), incoming, ctx);
  const fitted = fitLayout(next, nextView, ctx, { keep: [incoming] });
  return { layout: fitted, view: nextView, reshaped: fitted !== next };
}
