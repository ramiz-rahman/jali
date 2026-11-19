import type { Layout, LayoutContext, NodeId, ObjectRef, PaneNode, ViewState } from "../types";
import { map, panes } from "../tree/tree";
import { setRef } from "./ref";

/**
 * Linked selection. A detail opened from a list's selection follows it (`follows`); a kept detail stays on its
 * object. Rules:
 *  - a follower is a pane with `linkedTo: source` and `follows: true`; there is at most one per source and kind, and a
 *    source can have followers of several kinds (a watchlist with a chart, a quote and the news);
 *  - following replaces the follower's object in place: same node, slot and size (a swap, never a reshape);
 *  - opening from a selection while the source has a follower of that kind opens a kept detail (compare);
 *  - closing the source drops the link and the following (ops/close.ts).
 */
export function follower(layout: Layout, source: NodeId, kind: string): PaneNode | undefined {
  return panes(layout.root).find((p) => p.linkedTo === source && p.follows && p.ref.kind === kind);
}

/** Every follower of `source`, one per kind, in tree order. */
export function followers(layout: Layout, source: NodeId): PaneNode[] {
  return panes(layout.root).filter((p) => p.linkedTo === source && p.follows);
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
): Pick<PaneNode, "follows" | "kept"> =>
  follower(layout, source, kind) ? { kept: true } : { follows: true };

/**
 * Keep a linked pane (`kept: true`): it stays on its object. A follower stops following its list; a plain link is no
 * longer replaced by the next link from its source. Let go (`kept: false`) with `follow`, it follows its source again,
 * and any other follower of that source and kind is kept in its place; without, it is a plain link again. Unlinked
 * panes and unchanged states return `layout`.
 */
export function setKept(
  layout: Layout,
  id: NodeId,
  kept: boolean,
  { follow = false }: { follow?: boolean } = {},
): Layout {
  const target = panes(layout.root).find((p) => p.id === id);
  if (!target?.linkedTo) return layout;
  if (kept ? !!target.kept && !target.follows : !target.kept) return layout;
  const keep = (p: PaneNode): PaneNode => {
    const { follows: _f, ...rest } = p;
    return { ...rest, kept: true };
  };
  const release = (p: PaneNode): PaneNode => {
    const { kept: _k, ...rest } = p;
    return follow ? { ...rest, follows: true } : rest;
  };
  const rival = !kept && follow ? follower(layout, target.linkedTo, target.ref.kind) : undefined;
  const root = map(layout.root, (n) =>
    n.type !== "pane"
      ? n
      : n.id === id
        ? kept
          ? keep(n)
          : release(n)
        : n.id === rival?.id
          ? keep(n)
          : n,
  );
  return { ...layout, root };
}
