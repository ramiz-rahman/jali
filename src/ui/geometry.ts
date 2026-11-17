import type { DividerBox, KindRegistry, LayoutNode, PaneBox, Rect, SplitNode } from "../layout-core/types";

export function panesUnder(node: LayoutNode): string[] {
  if (node.type === "pane") return [node.id];
  return node.children.flatMap((c) => panesUnder(c as LayoutNode));
}

export function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.width)), y2 = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

export function minAlong(node: LayoutNode, axis: "row" | "column", kinds: KindRegistry, gap: number): number {
  if (node.type === "pane") {
    const k = kinds[node.ref.kind];
    return axis === "row" ? (k?.minWidth ?? 240) : (k?.minHeight ?? 160);
  }
  if (node.type === "stack") return Math.max(...node.children.map((c) => minAlong(c, axis, kinds, gap)));
  const mins = node.children.map((c) => minAlong(c as LayoutNode, axis, kinds, gap));
  return node.type === axis ? mins.reduce((a, b) => a + b, 0) + gap * (mins.length - 1) : Math.max(...mins);
}

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
export function pairGeometry(d: DividerBox, parent: SplitNode | undefined, boxes: PaneBox[], kinds: KindRegistry, gap: number, label: (ids: string[]) => string): PairGeometry | null {
  const A = parent?.children[d.index] as LayoutNode | undefined, B = parent?.children[d.index + 1] as LayoutNode | undefined;
  // Prefer resolve's neighbours: the fit step can group several original siblings at one divider.
  const idsA = d.neighbours?.[0] ?? (A ? panesUnder(A) : []);
  const idsB = d.neighbours?.[1] ?? (B ? panesUnder(B) : []);
  const byId = new Map(boxes.filter((b) => !b.hiddenInStack).map((b) => [b.id, b.rect]));
  const ra = union(idsA.map((id) => byId.get(id)).filter(Boolean) as Rect[]);
  const rb = union(idsB.map((id) => byId.get(id)).filter(Boolean) as Rect[]);
  if (!ra || !rb) return null;
  const pair = union([ra, rb])!;
  const row = d.axis === "row";
  const sa = row ? ra.width : ra.height, sb = row ? rb.width : rb.height;
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
