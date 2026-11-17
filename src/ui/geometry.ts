import { extentAlong, minSize, tree } from "../layout-core";
import type { DividerBox, KindRegistry, LayoutNode, PaneBox, Rect, SplitNode } from "../layout-core/types";

export const panesUnder = (node: LayoutNode) => tree.panes(node).map(p => p.id);

export function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width)), y2 = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

export const minAlong = (node: LayoutNode, axis: "row" | "column", kinds: KindRegistry, gap: number) => minSize(node, kinds, gap, axis);

export interface PairGeometry {
  divider: DividerBox;
  axis: "row" | "column";
  /** Rect covering both neighbours and the gap. */
  pair: Rect;
  a: { ids: string[]; size: number; min: number; label: string };
  b: { ids: string[]; size: number; min: number; label: string };
  /** Usable length: a + b (gap excluded). */
  total: number;
}

/** The two neighbours of a divider, measured from resolved pane boxes (independent of DividerBox.value semantics). */
export function pairGeometry(d: DividerBox, parent: SplitNode | undefined, boxes: PaneBox[], _kinds: KindRegistry, _gap: number, label: (ids: string[]) => string): PairGeometry | null {
  const A = parent?.children[d.index] as LayoutNode | undefined, B = parent?.children[d.index + 1] as LayoutNode | undefined;
  // Prefer resolve's neighbours: the fit step can group several original siblings at one divider.
  const idsA = d.neighbours?.[0] ?? (A ? panesUnder(A) : []);
  const idsB = d.neighbours?.[1] ?? (B ? panesUnder(B) : []);
  const byId = new Map(boxes.filter((b) => !b.hidden).map((b) => [b.id, b.rect]));
  const ra = union(idsA.map((id) => byId.get(id)).filter(Boolean) as Rect[]);
  const rb = union(idsB.map((id) => byId.get(id)).filter(Boolean) as Rect[]);
  if (!ra || !rb) return null;
  const pair = union([ra, rb])!;

  const sa = extentAlong(boxes, idsA, d.axis), sb = extentAlong(boxes, idsB, d.axis);
  return {
    divider: d,
    axis: d.axis,
    pair,
    // DividerBox.min/max bound the first neighbour's extent (layout-core clamps with them too).
    a: { ids: idsA, size: sa, min: d.min, label: label(idsA) },
    b: { ids: idsB, size: sb, min: Math.max(0, sa + sb - d.max), label: label(idsB) },
    total: sa + sb,
  };
}
