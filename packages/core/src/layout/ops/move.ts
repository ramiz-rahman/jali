import { offsetToShow, scrolled } from "../geometry/scroll";
import type { Edge, Layout, LayoutContext, PaneNode, ViewState } from "../types";
import { activate, clone, find, nodes, parent, remove, unzoom, noFocus } from "../tree/tree";
import { beside, tab } from "../tree/insert";
import { focus, directionalCandidates } from "./focus";
import { fitLayout } from "../fit/refit";
import { resolve } from "../fit/resolve";
import { forget } from "../fit/overlay";
import { holdGeometry } from "../fit/hold";
import { treeSide } from "../geometry/direction";

function swapTree(layout: Layout, a: string, b: string): Layout {
  const next = clone(layout);
  const left = find(next.root, a),
    right = find(next.root, b);
  if (a === b || left?.type !== "pane" || right?.type !== "pane") return layout;
  forget(next, [a, b]);
  const leftContent = { ...left, size: right.size, userSized: right.userSized };
  const rightContent = { ...right, size: left.size, userSized: left.userSized };
  // Simultaneous replacement also works when the panes are in the same stack.
  for (const node of nodes(next.root))
    if (node.type !== "pane") {
      if (node.type === "stack") {
        node.children = node.children.map((c) =>
          c.id === a ? rightContent : c.id === b ? leftContent : c,
        );
        if (node.active === a) node.active = b;
        else if (node.active === b) node.active = a;
      } else
        node.children = node.children.map((c) =>
          c.id === a ? rightContent : c.id === b ? leftContent : c,
        );
    }
  return next;
}
export function swap(layout: Layout, a: string, b: string, ctx: LayoutContext): Layout {
  const next = swapTree(layout, a, b);
  // Slots keep their rects; the panes trade places in them.
  return next === layout ? layout : holdGeometry(layout, fitLayout(next, noFocus(), ctx), ctx);
}
/** `zone` is a tree side ("left" is before the target, "right" after), whatever the reading direction: an action that
 *  takes a screen side converts it first (geometry/direction.ts). */
export function drop(
  layout: Layout,
  view: ViewState,
  dragged: string,
  target: string,
  zone: Edge | "centre",
  centreMode: "swap" | "tab",
  ctx: LayoutContext,
) {
  const nextView = unzoom(view);
  if (
    dragged === target ||
    find(layout.root, dragged)?.type !== "pane" ||
    find(layout.root, target)?.type !== "pane"
  )
    return { layout, view };
  const owner = parent(layout.root, dragged),
    targetOwner = parent(layout.root, target);
  if (!layout.overlay && owner && owner === targetOwner) {
    const at = owner.children.findIndex((c) => c.id === dragged),
      to = owner.children.findIndex((c) => c.id === target);
    if (
      zone === "centre" &&
      centreMode === "tab" &&
      owner.type === "stack" &&
      owner.active === dragged &&
      at === owner.children.length - 1
    )
      return { layout, view };
    const axis = zone === "left" || zone === "right" ? "row" : "column";
    const offset = zone === "left" || zone === "top" ? -1 : 1;
    if (
      zone !== "centre" &&
      owner.type === axis &&
      at === to + offset &&
      owner.children.every((c) => c.userSized || ("weight" in c.size && c.size.weight === 1))
    )
      return { layout, view };
  }
  if (zone === "centre" && centreMode === "swap") {
    const next = swapTree(layout, dragged, target);
    activate(next, dragged);
    return {
      layout: holdGeometry(layout, fitLayout(next, focus(nextView, dragged, ctx), ctx), ctx),
      view: focus(nextView, dragged, ctx),
    };
  }
  const next = clone(layout);
  const pane = clone(find(next.root, dragged) as PaneNode);
  // A deliberate move ends a tuck: the pane now lives where it was dropped.
  next.root = remove(next.root, dragged)!;
  forget(next, [dragged]);
  if (zone === "centre") tab(next, target, pane);
  else beside(next, target, zone, pane);
  activate(next, dragged);
  return {
    layout: fitLayout(next, focus(nextView, dragged, ctx), ctx),
    view: focus(nextView, dragged, ctx),
  };
}

/** `dir` is a screen side: the neighbour on that side of the screen, in either reading direction. */
export function moveDirection(
  layout: Layout,
  view: ViewState,
  pane: string,
  dir: Edge,
  ctx: LayoutContext,
) {
  const nextView = unzoom(view);
  let resolved = resolve(layout, { ...nextView, focused: pane }, ctx);
  // In a row that scrolls, directions are judged as on screen with the pane in view: the strip scrolled to show it.
  // Along its content, the last pane of a week sits far right of the map beside the strip, never left of it.
  const strip = resolved.scrollers.find((s) => s.paneIds.includes(pane));
  const box = strip && resolved.panes.find((b) => b.id === pane);
  if (strip && box)
    resolved = scrolled(
      resolved,
      { [strip.id]: offsetToShow(strip, box.rect, 0, ctx.dir) },
      ctx.dir,
    );
  const target = directionalCandidates({ ...nextView, focused: pane }, resolved, dir)[0];
  if (target) return drop(layout, nextView, pane, target.id, treeSide(dir, ctx.dir), "swap", ctx);
  // Nothing that way: at a strip's edge, the pane still leaves the strip, beside it on that side.
  return (
    (strip && leaveStrip(layout, nextView, pane, strip.id, treeSide(dir, ctx.dir), ctx)) || {
      layout,
      view,
    }
  );
}

/**
 * Take `pane` out of the row that scrolls `stripId`, beside the strip on `side` (a tree side), when it is the
 * strip's first child and `side` is its start, or its last and `side` its end. Else undefined: a pane inside a strip
 * moves past its neighbours, not out.
 */
function leaveStrip(
  layout: Layout,
  view: ViewState,
  pane: string,
  stripId: string,
  side: Edge,
  ctx: LayoutContext,
) {
  if (side !== "left" && side !== "right") return undefined;
  const strip = find(layout.root, stripId);
  if (!strip || strip.type !== "row") return undefined;
  const at = strip.children.findIndex((c) => nodes(c).some((n) => n.id === pane));
  if (at !== (side === "left" ? 0 : strip.children.length - 1)) return undefined;
  const r = moveOutOfStrip(layout, view, pane, side, ctx);
  return r.layout === layout ? undefined : r;
}

/**
 * Take `pane` out of the row that scrolls holding it, from wherever it is in the strip, and put it beside the strip
 * on `side` (a tree side: before or after it). A pane in a column in the strip comes out on its own. A strip left
 * with one child becomes that child, and the pane goes beside it. Unchanged when the pane is in no strip.
 */
export function moveOutOfStrip(
  layout: Layout,
  view: ViewState,
  pane: string,
  side: "left" | "right",
  ctx: LayoutContext,
) {
  const strip = nodes(layout.root).find(
    (n) =>
      n.type === "row" &&
      n.scroll === "x" &&
      nodes(n).some((c) => c.id === pane && c.type === "pane"),
  );
  if (!strip || strip.type !== "row") return { layout, view };
  const others = strip.children
    .filter((c) => !nodes(c).some((n) => n.id === pane))
    .map((c) => c.id);
  const next = clone(layout);
  const moved = clone(find(next.root, pane) as PaneNode);
  // A deliberate move ends a tuck, as a drop does.
  next.root = remove(next.root, pane)!;
  forget(next, [pane]);
  const anchor = find(next.root, strip.id) ? strip.id : others.find((id) => find(next.root, id));
  if (!anchor) return { layout, view };
  beside(next, anchor, side, moved);
  activate(next, pane);
  const nextView = focus(unzoom(view), pane, ctx);
  return { layout: fitLayout(next, nextView, ctx), view: nextView };
}
