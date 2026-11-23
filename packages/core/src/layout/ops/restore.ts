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
  UndoEntry,
  ViewState,
} from "../types";
import { clone, find, nodes, panes, parent, replace, unzoom } from "../tree/tree";
import { sameSize, sizeFrom } from "../tree/size";
import { intoStack } from "../tree/insert";
import { sameRef } from "./ref";
import { hiddenOf, overlayOf, withOverlay, withTuck } from "../fit/overlay";
import { fitLayout } from "../fit/refit";
import { focus } from "./focus";

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
  // Every pane's id first: its own unless a node (a pane, or a container) took it meanwhile, so the batch's references
  // to each other (neighbours, links, tucks) follow it, and never reach the node that took it. Keyed by pane id, so
  // without a prototype ("toString" is a pane id like any other).
  const ids: Record<NodeId, NodeId> = Object.create(null);
  const taken = new Set(nodes(next.root).map((n) => n.id));
  const fresh: typeof entry.closed = [];
  for (const c of entry.closed) {
    if (taken.has(c.pane.id)) fresh.push(c);
    else {
      taken.add(c.pane.id);
      ids[c.pane.id] = c.pane.id;
    }
  }
  // One reservation for every id this undo gives, panes and the containers it makes again alike.
  const reserve = (prefix: string) => {
    let i = 1;
    while (taken.has(`${prefix}-${i}`)) i++;
    taken.add(`${prefix}-${i}`);
    return `${prefix}-${i}`;
  };
  for (const c of fresh) ids[c.pane.id] = reserve("pane");
  const id = (n: NodeId) => ids[n] ?? n;
  // Each pane's own size in its own container, for when that container is made again around it.
  const own = new Map<NodeId, SlotLevel>();
  // Nodes wrapped in a new split or tab group for a pane to go beside them: sized once the close's sizes are back.
  const wrapped: NodeId[] = [];
  /** `node` and `pane` in a new container in node's place, with node's size: `id` again unless that is taken. */
  const wrap = (node: LayoutNode, pane: PaneNode, level: SlotLevel, after: boolean) => {
    const children = after ? [node, pane] : [pane, node];
    const shared = { size: clone(node.size), ...(node.userSized ? { userSized: true } : {}) };
    const made = taken.has(level.parent)
      ? reserve(level.type === "stack" ? "stack" : "split")
      : level.parent;
    taken.add(made);
    const mine = own.get(node.id);
    if (mine?.parent === level.parent) sizeFrom(node, mine);
    else wrapped.push(node.id);
    next.root = replace(
      next.root,
      node.id,
      level.type === "stack"
        ? {
            id: made,
            type: "stack",
            ...shared,
            children: [node as PaneNode],
            active: node.id,
            origin: "user",
          }
        : {
            id: made,
            type: level.type,
            ...shared,
            children,
            ...(level.scroll && { scroll: level.scroll }),
          },
    );
    const stack = at(made);
    if (stack?.type === "stack") intoStack(stack, pane, after ? 1 : 0, level.active);
  };
  const place = (pane: PaneNode, slot: readonly SlotLevel[]) => {
    for (const level of slot) {
      if (level.type !== "stack") sizeFrom(pane, level);
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
        let target = level.type === "stack" ? at(id(a.pane)) : (at(id(a.id)) ?? at(id(a.pane)));
        // Never beside a pane hidden since (a curated page's view, back in its tabs): it has no slot to share.
        if (
          !target ||
          hiddenOf(next).includes(target.id) ||
          (level.type === "stack" && target.type !== "pane")
        )
          continue;
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
    sizeFrom(pane, { size: { weight: 1 } });
    if (next.root.type === "row") next.root.children.push(pane);
    else {
      const row = reserve("split");
      wrap(
        next.root,
        pane,
        { parent: row, type: "row", index: 0, size: pane.size, before: [], after: [] },
        true,
      );
    }
  };
  for (const c of entry.closed) {
    const pane = { ...clone(c.pane), id: id(c.pane.id) };
    const first = c.slot[0];
    if (first && first.type !== "stack") own.set(pane.id, first);
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
    // Its source: put back with it, or still showing what it showed.
    const to = pane.linkedTo && id(pane.linkedTo);
    const source = to ? paneAt(to) : undefined;
    if (to && source && to !== pane.id && (to !== pane.linkedTo || sameRef(source.ref, c.source))) {
      pane.linkedTo = to;
      if (followed(to, pane)) delete pane.follows;
    } else {
      delete pane.linkedTo;
      delete pane.follows;
    }
    // The panes the close unlinked from it, while nothing linked them elsewhere since.
    for (const f of c.followers) {
      const p = paneAt(f.id);
      if (!p || p.linkedTo || back.includes(p.id) || !sameRef(p.ref, f.ref)) continue;
      p.linkedTo = pane.id;
      if (f.follows && !followed(pane.id, p)) p.follows = true;
    }
  }
  // Sizes the close changed come back, on nodes that still have what the close left them.
  for (const s of entry.sizes) {
    const n = at(s.id);
    if (!n || back.includes(n.id) || !sameSize(n.size, s.after)) continue;
    sizeFrom(n, s);
    const w = wrapped.indexOf(n.id);
    if (w >= 0) wrapped.splice(w, 1);
  }
  // A node wrapped with no size to return to shares its new split as a new neighbour would.
  for (const id of wrapped) {
    const n = at(id);
    if (n && !n.userSized) n.size = { weight: 1 };
  }
  // Tucks the close ended, while both panes are here and the pane can be tucked (not a tab, not tucked already).
  const o = overlayOf(next);
  let tucks = o.tucks;
  for (const t of entry.tucks) {
    const pane = id(t.pane),
      home = id(t.home);
    if (
      paneAt(pane) &&
      paneAt(home) &&
      parent(next.root, pane)?.type !== "stack" &&
      !tucks.some((u) => [u.pane, u.home].includes(pane) || u.pane === home)
    )
      tucks = withTuck(tucks, pane, home);
  }
  const restored = tucks !== o.tucks ? withOverlay(next, { ...o, tucks }) : next;
  const first = back[0];
  const nextView = focusFirst && first ? focus(unzoom(view), first, ctx) : unzoom(view);
  return { layout: fitLayout(restored, nextView, ctx, { mode: "fold" }), view: nextView, ids };
}
