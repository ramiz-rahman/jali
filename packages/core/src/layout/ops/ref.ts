import type { Layout, LayoutContext, ObjectRef, ViewState } from "../types";
import { clone, find, map } from "../tree/tree";
import { fitLayout } from "../fit/refit";
import { holdGeometry } from "../fit/hold";

/**
 * Exactly the same object reference: the same kind and every param the same (`===`), in any key order. The one ref
 * equality in Jali: a layout read back from storage that reorders keys (Postgres `jsonb`) still shows the same panes.
 */
export const sameRef = (a: ObjectRef | undefined, b: ObjectRef | undefined): boolean =>
  !!a &&
  !!b &&
  (a === b ||
    (a.kind === b.kind &&
      Object.keys(a.params).length === Object.keys(b.params).length &&
      Object.entries(a.params).every(([k, v]) => Object.hasOwn(b.params, k) && b.params[k] === v)));
/**
 * Show `ref` in pane `id`. By default a swap: the slot keeps its rect even when the new object would size differently.
 * `hold: false` lets the layout settle to the new object's measure (filling a placeholder is a reshape).
 */
export function setRef(
  layout: Layout,
  view: ViewState,
  id: string,
  ref: ObjectRef,
  ctx: LayoutContext,
  opts: { hold?: boolean } = {},
): Layout {
  const original = find(layout.root, id);
  if (original?.type !== "pane" || sameRef(original.ref, ref)) return layout;
  if (!Object.hasOwn(ctx.fit.kinds, ref.kind)) throw new Error(`Unknown pane kind: ${ref.kind}`);
  const root = map(layout.root, (n) =>
    n.id === id && n.type === "pane" ? { ...n, ref: clone(ref) } : n,
  );
  const fitted = fitLayout({ ...layout, root }, view, ctx);
  return opts.hold === false ? fitted : holdGeometry(layout, fitted, ctx);
}
