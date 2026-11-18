import type { Layout, LayoutContext, NodeId, ObjectRef, PaneNode, ViewState } from "../types";
import { map, panes } from "../tree/tree";
import { setRef } from "./ref";

/**
 * Linked selection. A detail opened from a list's selection follows it (`follows`); a pinned detail stays on its
 * object. Rules:
 *  - a follower is a pane with `linkedTo: source` and `follows: true`; there is at most one per source and kind;
 *  - following replaces the follower's object in place: same node, slot and size (a swap, never a reshape);
 *  - opening from a selection while the source has a follower of that kind opens a pinned detail (compare);
 *  - closing the source drops the link and the following (ops/close.ts).
 */
export function follower(layout: Layout, source: NodeId, kind: string): PaneNode | undefined {
  return panes(layout.root).find((p) => p.linkedTo === source && p.follows && p.ref.kind === kind);
}

/** Show `ref` in `source`'s follower of that kind. The same layout when there is none or it already shows `ref`. */
export function follow(
  layout: Layout,
  view: ViewState,
  source: NodeId,
  ref: ObjectRef,
  ctx: LayoutContext,
): { layout: Layout; pane?: NodeId } {
  const f = follower(layout, source, ref.kind);
  if (!f) return { layout };
  return { layout: setRef(layout, view, f.id, ref, ctx), pane: f.id };
}

/** The link flags of a pane newly opened from `source`'s selection: it follows unless the source already has a follower. */
export const selectionLink = (
  layout: Layout,
  source: NodeId,
  kind: string,
): Pick<PaneNode, "follows" | "pinned"> =>
  follower(layout, source, kind) ? { pinned: true } : { follows: true };

/**
 * Pin (`false`) or unpin (`true`) a linked pane. Pinned: it keeps its object. Unpinned: it follows its source, and any
 * other follower of that source and kind is pinned in its place. Unlinked panes and unchanged states return `layout`.
 */
export function setFollows(layout: Layout, id: NodeId, follows: boolean): Layout {
  const target = panes(layout.root).find((p) => p.id === id);
  if (!target?.linkedTo || !!target.follows === follows) return layout;
  const pin = (p: PaneNode): PaneNode => {
    const { follows: _f, ...rest } = p;
    return { ...rest, pinned: true };
  };
  const unpin = (p: PaneNode): PaneNode => {
    const { pinned: _p, ...rest } = p;
    return { ...rest, follows: true };
  };
  const rival = follows ? follower(layout, target.linkedTo, target.ref.kind) : undefined;
  const root = map(layout.root, (n) =>
    n.type !== "pane"
      ? n
      : n.id === id
        ? follows
          ? unpin(n)
          : pin(n)
        : n.id === rival?.id
          ? pin(n)
          : n,
  );
  return { ...layout, root };
}
