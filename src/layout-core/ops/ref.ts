import type { Layout, LayoutContext, ObjectRef, ViewState } from "../types";
import { clone, find, map } from "../tree/tree";
import { fitLayout } from "../fit/refit";
import { holdGeometry } from "../fit/hold";
const equalRef = (a: ObjectRef, b: ObjectRef) => a.kind === b.kind && Object.keys(a.params).length === Object.keys(b.params).length && Object.entries(a.params).every(([k, v]) => b.params[k] === v);
export function setRef(layout: Layout, view: ViewState, id: string, ref: ObjectRef, ctx: LayoutContext): Layout {
  const original = find(layout.root, id);
  if (original?.type !== "pane" || equalRef(original.ref, ref)) return layout;
  if (!ctx.fit.kinds[ref.kind]) throw new Error(`Unknown pane kind: ${ref.kind}`);
  const root = map(layout.root, n => n.id === id && n.type === "pane" ? { ...n, ref: clone(ref) } : n);
  // A swap: the slot keeps its rect even when the new object would size differently.
  return holdGeometry(layout, fitLayout({ ...layout, root }, view, ctx), ctx);
}
