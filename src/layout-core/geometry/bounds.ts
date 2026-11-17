import type { Axis, KindRegistry, LayoutNode } from "../types";
export interface Bounds { width: number; height: number; maxWidth: number }
export function combineBounds(type: string, children: Bounds[], gap: number): Bounds {
  const widths = children.map(c => c.width), heights = children.map(c => c.height), maxima = children.map(c => c.maxWidth);
  const gaps = Math.max(0, children.length - 1) * gap;
  return {
    width: type === "row" ? widths.reduce((a, b) => a + b, 0) + gaps : Math.max(...widths),
    height: type === "column" ? heights.reduce((a, b) => a + b, 0) + gaps : Math.max(...heights),
    maxWidth: type === "row" ? maxima.reduce((a, b) => a + b, 0) + gaps : Math.max(Math.max(...widths), Math.min(...maxima)),
  };
}
export function bounds(node: LayoutNode, kinds: KindRegistry, gap: number): Bounds {
  if (node.type !== "pane") return combineBounds(node.type, node.children.map(c => bounds(c, kinds, gap)), gap);
  const kind = kinds[node.ref.kind];
  if (!kind) throw new Error(`Unknown pane kind: ${node.ref.kind}`);
  return { width: kind.minWidth, height: kind.minHeight, maxWidth: kind.maxWidth ?? Infinity };
}
export function minSize(node: LayoutNode, kinds: KindRegistry, gap: number, axis: Axis): number {
  const b = bounds(node, kinds, gap); return axis === "row" ? b.width : b.height;
}
