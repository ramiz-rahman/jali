import type { Layout, LayoutContext, LayoutNode, ViewState, UndoEntry } from "../types";
import { activate, clone, find, isSplit, panes, parent, remove, unzoom, noFocus } from "../tree/tree";
import { combined } from "../tree/size";
import { focus } from "./focus";
import { fitLayout } from "../fit/refit";
import { resolve } from "../fit/resolve";
import { forget } from "../fit/overlay";
import { extentAlong } from "../geometry/extent";
function cleanLinks(layout: Layout): void {
  const ids = new Set(panes(layout.root).map(p => p.id));
  for (const pane of panes(layout.root)) if (pane.linkedTo && !ids.has(pane.linkedTo)) delete pane.linkedTo;
}
export function close(layout: Layout, view: ViewState, target: string, ctx: LayoutContext) {
  const undo: UndoEntry = { kind: "close", before: { layout: clone(layout), view: clone(view) } };
  const original = panes(layout.root);
  const victim = original.find(p => p.id === target);
  if (!victim || original.length === 1) return { layout, view, undo };
  const next = clone(layout);
  const container = parent(next.root, target);
  const index = container?.children.findIndex(c => c.id === target) ?? -1;
  if (container && isSplit(container)) {
    const opener = container.children.find(c => c.id === victim.linkedTo);
    const recipient = opener ?? container.children[index + 1] ?? container.children[index - 1];
    if (recipient) {
      const { fit } = ctx;
      const victimFixed = "px" in victim.size;
      const mixed = victimFixed !== ("px" in recipient.size);
      if (mixed && fit) {
        const boxes = resolve(layout, noFocus(), ctx).panes;
        const extent = (n: LayoutNode) => extentAlong(boxes, panes(n).map(p => p.id), container.type);
        recipient.size = { px: extent(recipient) + extent(victim) + fit.gap };
      } else recipient.size = combined(recipient.size, victim.size);
      // Preserve transferred space during autobalance; balance the other undragged siblings.
      for (const sibling of container.children) if (sibling !== recipient && sibling.id !== target && !sibling.userSized) sibling.size = { weight: 1 };
    }
  }
  next.root = remove(next.root, target)!;
  forget(next, [target]);
  cleanLinks(next);
  const remaining = panes(next.root);
  const ids = new Set(remaining.map(p => p.id));
  const nextView = { ...unzoom(view), focusHistory: view.focusHistory.filter(id => ids.has(id)) };
  if (view.focused === target || !view.focused || !ids.has(view.focused)) {
    const fallback = nextView.focusHistory[0] ?? original.slice(original.findIndex(p => p.id === target) + 1).find(p => ids.has(p.id))?.id ?? remaining.at(-1)!.id;
    Object.assign(nextView, focus(nextView, fallback, ctx));
  }
  activate(next, nextView.focused!);
  return { layout: fitLayout(next, nextView, ctx), view: nextView, undo };
}

export function closeOthers(layout: Layout, view: ViewState, keep: string, ctx: LayoutContext) {
  const pane = find(layout.root, keep);
  const undo: UndoEntry = { kind: "closeOthers", before: { layout: clone(layout), view: clone(view) } };
  if (pane?.type !== "pane" || panes(layout.root).length === 1) return { layout, view, undo };
  const root = clone(pane); delete root.linkedTo;
  root.size = { weight: 1 }; delete root.userSized;
  const nextView = focus({ ...unzoom(view), focusHistory: [] }, keep, ctx);
  return { layout: fitLayout({ version: 1, root }, nextView, ctx), view: nextView, undo };
}
