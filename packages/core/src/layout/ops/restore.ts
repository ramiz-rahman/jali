/**
 * Undo of a close: the closed panes go back into the layout as it is now, never by putting back the layout from
 * before. Each pane returns to its slot (the same container, at its place, with its size) when that container is still
 * there; failing that, beside the nearest neighbour it had, level by level outwards; failing that, at the end. What
 * happened since (panes opened, pins, resizes, moves) stays.
 */
import type {
  Layout,
  LayoutContext,
  LayoutNode,
  NodeId,
  PaneNode,
  SlotLevel,
  StackNode,
  UndoEntry,
  ViewState,
} from "../types";
import { clone, find, newId, panes, parent, replace, unzoom } from "../tree/tree";
import { sameSize } from "../tree/size";
import { fitLayout } from "../fit/refit";
import { focus } from "./focus";

/** Put `pane` into `stack` at `index`, kept within its section (pinned tabs first). */
function intoStack(stack: StackNode, pane: PaneNode, index: number, active?: boolean): void {
  const pinned = stack.children.filter((c) => c.pinned).length;
  const at = Math.min(index, stack.children.length);
  stack.children.splice(pane.pinned ? Math.min(at, pinned) : Math.max(at, pinned), 0, pane);
  if (active) stack.active = pane.id;
}

/**
 * Put the panes of a close's undo entry back into `layout` as it is now (see the header), in the order they were
 * closed, so a pane put back first can be the neighbour of the next. A pane whose id another pane took meanwhile comes
 * back under a new id (`ids` maps each closed pane's id to the one it has now). Links the close dropped and sizes it
 * changed come back only where nothing changed them since. Fits once, folding as a put back does; `focus` focuses the
 * first pane put back.
 */
export function restoreClosed(
  layout: Layout,
  view: ViewState,
  entry: Extract<UndoEntry, { closed: unknown }>,
  ctx: LayoutContext,
  focusFirst = false,
): { layout: Layout; view: ViewState; ids: Record<NodeId, NodeId> } {
  const next = clone(layout);
  const at = (id: NodeId) => find(next.root, id);
  const ids: Record<NodeId, NodeId> = {};
  // Nodes wrapped in a new split or tab group for a pane to go beside them: sized once the close's sizes are back.
  const wrapped: NodeId[] = [];
  /** `node` and `pane` in a new container in node's place, with node's size: `id` again unless that is taken. */
  const wrap = (node: LayoutNode, pane: PaneNode, level: SlotLevel, after: boolean) => {
    const children = after ? [node, pane] : [pane, node];
    const shared = { size: clone(node.size), ...(node.userSized ? { userSized: true } : {}) };
    const id = at(level.parent)
      ? newId(next.root, level.type === "stack" ? "stack" : "split")
      : level.parent;
    wrapped.push(node.id);
    next.root = replace(
      next.root,
      node.id,
      level.type === "stack"
        ? {
            id,
            type: "stack",
            ...shared,
            children: [node as PaneNode],
            active: node.id,
            origin: "user",
          }
        : { id, type: level.type, ...shared, children },
    );
    const stack = at(id);
    if (stack?.type === "stack") intoStack(stack, pane, after ? 1 : 0, level.active);
  };
  const place = (pane: PaneNode, slot: readonly SlotLevel[]) => {
    for (const level of slot) {
      if (level.type !== "stack") {
        pane.size = clone(level.size);
        pane.userSized = level.userSized;
        if (!level.userSized) delete pane.userSized;
      }
      const container = at(level.parent);
      if (container?.type === level.type) {
        if (container.type === "stack") intoStack(container, pane, level.index, level.active);
        else container.children.splice(level.index, 0, pane);
        return;
      }
      for (const a of [
        ...level.before.map((n) => ({ ...n, after: true })),
        ...level.after.map((n) => ({ ...n, after: false })),
      ]) {
        // A tab joins its neighbour pane; anything else goes beside the neighbour, or the pane nearest it in there.
        let target = level.type === "stack" ? at(a.pane) : (at(a.id) ?? at(a.pane));
        if (!target || (level.type === "stack" && target.type !== "pane")) continue;
        const group = parent(next.root, target.id);
        if (group?.type === "stack") {
          if (level.type === "stack") {
            intoStack(
              group,
              pane,
              group.children.indexOf(target as PaneNode) + +a.after,
              level.active,
            );
            return;
          }
          target = group;
        }
        const container = parent(next.root, target.id);
        if (container && container.type === level.type && container.type !== "stack")
          container.children.splice(container.children.indexOf(target) + +a.after, 0, pane);
        else wrap(target, pane, level, a.after);
        return;
      }
    }
    // At the end in reading order: the last child of a row at the root, else beside the whole layout.
    pane.size = { weight: 1 };
    delete pane.userSized;
    if (next.root.type === "row") next.root.children.push(pane);
    else {
      const row = newId(next.root, "split");
      wrap(
        next.root,
        pane,
        { parent: row, type: "row", index: 0, size: pane.size, before: [], after: [] },
        true,
      );
    }
  };
  for (const c of entry.closed) {
    const pane = clone(c.pane);
    if (at(pane.id)) pane.id = newId(next.root);
    ids[c.pane.id] = pane.id;
    place(pane, c.slot);
  }
  const back = Object.values(ids);
  const paneAt = (id: NodeId) => {
    const n = at(id);
    return n?.type === "pane" ? n : undefined;
  };
  // At most one follower per source and kind (layout/ops/follow.ts).
  const followed = (source: NodeId, p: PaneNode) =>
    panes(next.root).some(
      (o) => o !== p && o.follows && o.linkedTo === source && o.ref.kind === p.ref.kind,
    );
  for (const c of entry.closed) {
    const pane = paneAt(ids[c.pane.id]!)!;
    const to = pane.linkedTo && (ids[pane.linkedTo] ?? pane.linkedTo);
    if (to && paneAt(to) && to !== pane.id) {
      pane.linkedTo = to;
      if (followed(to, pane)) delete pane.follows;
    } else {
      delete pane.linkedTo;
      delete pane.follows;
    }
    // The panes the close unlinked from it, while nothing linked them elsewhere since.
    for (const f of c.followers) {
      const p = paneAt(f.id);
      if (!p || p.linkedTo || back.includes(p.id)) continue;
      p.linkedTo = pane.id;
      if (f.follows && !followed(pane.id, p)) p.follows = true;
    }
  }
  // Sizes the close changed come back, on nodes that still have what the close left them.
  for (const s of entry.sizes) {
    const n = at(s.id);
    if (!n || back.includes(n.id) || !sameSize(n.size, s.after)) continue;
    n.size = clone(s.size);
    n.userSized = s.userSized;
    if (!s.userSized) delete n.userSized;
    wrapped.splice(wrapped.indexOf(n.id) >>> 0, 1);
  }
  // A node wrapped with no size to return to shares its new split as a new neighbour would.
  for (const id of wrapped) {
    const n = at(id);
    if (n && !n.userSized) n.size = { weight: 1 };
  }
  const first = back[0];
  const nextView = focusFirst && first ? focus(unzoom(view), first, ctx) : unzoom(view);
  return { layout: fitLayout(next, nextView, ctx, { mode: "fold" }), view: nextView, ids };
}
