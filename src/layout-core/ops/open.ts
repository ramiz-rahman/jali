import type { Edge, Layout, LayoutContext, ObjectRef, OpenResult, PaneNode, ViewState } from "../types";
import { activate, map, clone, find, newId, panes, unzoom } from "../tree/tree";
import { beside } from "../tree/insert";
import { focus } from "./focus";
import { fitLayout } from "../fit/refit";
import { setRef } from "./ref";
/** Where a new pane goes when that is not beside its source: a designed arrangement keeps opened panes in one region. */
export interface Placement { target: string; edge: Edge }
export function open(layout: Layout, view: ViewState, target: string, edge: Edge, ref: ObjectRef, ctx: LayoutContext, linked: boolean, place?: Placement): OpenResult {
  const { fit } = ctx;
  const original = find(layout.root, target);
  if (original?.type !== "pane") throw new Error(`Unknown source pane: ${target}`);
  if (!fit.kinds[ref.kind]) throw new Error(`Unknown pane kind: ${ref.kind}`);
  if (linked) {
    const existing = panes(layout.root).find(p => p.linkedTo === target && p.ref.kind === ref.kind && !p.pinned);
    if (existing) {
      let next = setRef(layout, view, existing.id, ref, ctx);
      const root = map(next.root, n => n.type === "stack" && n.children.some(c => c.id === target) && n.active !== target ? { ...n, active: target } : n);
      if (root !== next.root) next = { ...next, root };
      return { layout: next, view: focus(view, target, ctx), opened: existing.id, mode: "replaced" };
    }
  }
  const next = clone(layout);
  const pane: PaneNode = { id: newId(layout.root), type: "pane", size: { weight: 1 }, ref: clone(ref), ...(linked ? { linkedTo: target } : {}) };
  pane.born = 1 + Math.max(panes(layout.root).length, ...panes(layout.root).map(p => p.born ?? 0));
  beside(next, place && find(next.root, place.target) ? place.target : target, place?.edge ?? edge, pane);
  const nextView = linked ? focus(unzoom(view), target, ctx) : focus(unzoom(view), pane.id, ctx);
  // No room, or over the cap: the fold is decided now, at open, and recorded. With no room the new pane becomes a tab
  // of its source (spec §3 "Opened as a tab: not enough room"); over the cap the oldest unpinned, unfocused pane does.
  const fitted = fitLayout(next, nextView, ctx, { fresh: pane.id, keep: [pane.id, target] });
  const mode: OpenResult["mode"] = fitted.overlay?.folds.includes(pane.id) ? "tab" : "beside";
  activate(fitted, nextView.focused!);
  return { layout: fitted, view: nextView, opened: pane.id, mode };
}

export const openBeside = (layout: Layout, view: ViewState, source: string, ref: ObjectRef, ctx: LayoutContext, place?: Placement) => open(layout, view, source, "right", ref, ctx, true, place);
export const split = (layout: Layout, view: ViewState, target: string, edge: Edge, ref: ObjectRef, ctx: LayoutContext) => open(layout, view, target, edge, ref, ctx, false);
