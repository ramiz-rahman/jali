import type {
  ClosedPane,
  Layout,
  LayoutContext,
  LayoutNode,
  NodeId,
  SizeChange,
  SlotLevel,
  UndoEntry,
  ViewState,
} from "../types";
import {
  activate,
  clone,
  find,
  isSplit,
  nodes,
  panes,
  parent,
  remove,
  unzoom,
  noFocus,
} from "../tree/tree";
import { combined, sameSize } from "../tree/size";
import { focus } from "./focus";
import { fitLayout } from "../fit/refit";
import { resolve } from "../fit/resolve";
import { forget } from "../fit/overlay";
import { extentIn } from "../geometry/extent";
function cleanLinks(layout: Layout): void {
  const ids = new Set(panes(layout.root).map((p) => p.id));
  for (const pane of panes(layout.root))
    if (pane.linkedTo && !ids.has(pane.linkedTo)) {
      delete pane.linkedTo;
      delete pane.follows;
    }
}

/** Where `id` is in `layout`, level by level from its own container out (types.ts, `SlotLevel`). */
export function captureSlot(layout: Layout, id: NodeId): SlotLevel[] {
  const levels: SlotLevel[] = [];
  for (
    let child = find(layout.root, id), group = parent(layout.root, id);
    child && group;
    child = group, group = parent(layout.root, group.id)
  ) {
    const at = group.children.indexOf(child as never);
    // A neighbour, and the pane in it nearest the closed pane.
    const near = (n: LayoutNode, last: boolean) => ({
      id: n.id,
      pane: panes(n).at(last ? -1 : 0)!.id,
    });
    levels.push({
      parent: group.id,
      type: group.type,
      index: at,
      size: clone(child.size),
      userSized: child.userSized,
      before: group.children
        .slice(0, at)
        .reverse()
        .map((n) => near(n, true)),
      after: group.children.slice(at + 1).map((n) => near(n, false)),
      active: group.type === "stack" && group.active === child.id,
      scroll: group.type === "row" ? group.scroll : undefined,
    });
  }
  return levels;
}

/** The record of closing `targets` from `before`, leaving `after`: each pane as it was and where, the panes linked to
 *  it, and the sizes the close changed on nodes that stayed. Undefined when nothing closed. */
function record(
  kind: "close" | "closeOthers",
  before: Layout,
  after: Layout,
  targets: readonly NodeId[],
): UndoEntry | undefined {
  const left = new Map(nodes(after.root).map((n) => [n.id, n]));
  const pane = (id?: NodeId) => panes(before.root).find((p) => p.id === id);
  const closed: ClosedPane[] = targets.map((id) => ({
    pane: clone(pane(id)!),
    slot: captureSlot(before, id),
    source: clone(pane(pane(id)!.linkedTo)?.ref),
    followers: panes(before.root)
      .filter((p) => p.linkedTo === id && left.has(p.id))
      .map((p) => ({ id: p.id, ref: clone(p.ref), follows: p.follows })),
  }));
  const sizes: SizeChange[] = [];
  for (const n of nodes(before.root)) {
    const now = left.get(n.id);
    if (now && !sameSize(now.size, n.size))
      sizes.push({ id: n.id, size: clone(n.size), userSized: n.userSized, after: clone(now.size) });
  }
  const tucks = (before.overlay?.tucks ?? []).filter(
    (t) => targets.includes(t.pane) || targets.includes(t.home),
  );
  return closed.length ? { kind, closed, sizes, tucks: clone(tucks) } : undefined;
}

/**
 * Remove one pane from an owned draft: its space goes to its opener, else the next sibling, else the previous. With
 * `keepSizes`, no sibling's size changes: the others share the room as their sizes say.
 */
function removeOne(next: Layout, target: NodeId, ctx: LayoutContext, keepSizes: boolean): void {
  const victim = find(next.root, target);
  if (victim?.type !== "pane") return;
  const container = parent(next.root, target);
  const index = container?.children.findIndex((c) => c.id === target) ?? -1;
  if (container && isSplit(container) && !keepSizes) {
    const opener = container.children.find((c) => c.id === victim.linkedTo);
    const recipient = opener ?? container.children[index + 1] ?? container.children[index - 1];
    if (recipient) {
      const { fit } = ctx;
      const victimFixed = "px" in victim.size;
      const mixed = victimFixed !== "px" in recipient.size;
      if (mixed && fit) {
        const boxes = resolve(next, noFocus(), ctx);
        const extent = (n: LayoutNode) =>
          extentIn(
            boxes,
            panes(n).map((p) => p.id),
            container.type,
          );
        recipient.size = { px: extent(recipient) + extent(victim) + fit.gap };
      } else recipient.size = combined(recipient.size, victim.size);
      // Preserve transferred space during autobalance; balance the other undragged siblings.
      for (const sibling of container.children)
        if (sibling !== recipient && sibling.id !== target && !sibling.userSized)
          sibling.size = { weight: 1 };
    }
  }
  next.root = remove(next.root, target)!;
  forget(next, [target]);
}

/**
 * Close every pane of `targets` in one change, recorded as one undo entry (`kind`). Each pane's slot is read from the
 * layout before any is removed, so an earlier removal can't change a later pane's recorded place or size. Missing
 * targets are skipped; the last pane is never closed. Without a pane closed, the same layout comes back and no entry.
 * `keepSizes`: the panes that stay keep their sizes (see `removeOne`).
 */
export function closeMany(
  layout: Layout,
  view: ViewState,
  targets: readonly NodeId[],
  ctx: LayoutContext,
  kind: "close" | "closeOthers" = "closeOthers",
  options: { keepSizes?: boolean } = {},
): { layout: Layout; view: ViewState; undo?: UndoEntry } {
  const original = panes(layout.root);
  const closing = new Set(targets.filter((t) => original.some((p) => p.id === t)));
  // The last pane stays.
  if (closing.size >= original.length) closing.delete(original.at(-1)!.id);
  if (!closing.size) return { layout, view };
  const next = clone(layout);
  for (const target of closing) removeOne(next, target, ctx, !!options.keepSizes);
  cleanLinks(next);
  const remaining = panes(next.root);
  const ids = new Set(remaining.map((p) => p.id));
  const nextView = { ...unzoom(view), focusHistory: view.focusHistory.filter((id) => ids.has(id)) };
  if (!view.focused || !ids.has(view.focused)) {
    const at = original.findIndex((p) => p.id === view.focused);
    const fallback =
      nextView.focusHistory[0] ??
      (at >= 0 ? original.slice(at + 1).find((p) => ids.has(p.id))?.id : undefined) ??
      remaining.at(-1)!.id;
    Object.assign(nextView, focus(nextView, fallback, ctx));
  }
  activate(next, nextView.focused!);
  const undo = record(kind, layout, next, [...closing]);
  return { layout: fitLayout(next, nextView, ctx), view: nextView, ...(undo ? { undo } : {}) };
}

export function close(layout: Layout, view: ViewState, target: string, ctx: LayoutContext) {
  const original = panes(layout.root);
  if (!original.some((p) => p.id === target) || original.length === 1) return { layout, view };
  // The closed pane's focus goes on in reading order when nothing was focused before it.
  const from =
    view.focused && original.some((p) => p.id === view.focused)
      ? view
      : { ...view, focused: target };
  return closeMany(layout, from, [target], ctx, "close");
}

export function closeOthers(layout: Layout, view: ViewState, keep: string, ctx: LayoutContext) {
  const pane = find(layout.root, keep);
  if (pane?.type !== "pane" || panes(layout.root).length === 1) return { layout, view };
  const root = clone(pane);
  delete root.linkedTo;
  delete root.follows;
  root.size = { weight: 1 };
  delete root.userSized;
  const next: Layout = { version: 1, root };
  const nextView = focus({ ...unzoom(view), focusHistory: [] }, keep, ctx);
  const others = panes(layout.root).flatMap((p) => (p.id === keep ? [] : [p.id]));
  const undo = record("closeOthers", layout, next, others);
  return { layout: fitLayout(next, nextView, ctx), view: nextView, ...(undo ? { undo } : {}) };
}
