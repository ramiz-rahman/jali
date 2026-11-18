import type { Axis, KindRegistry, LayoutNode } from "../types";
/**
 * What a slot needs and can use. `width`/`height`: minimums (the fit step folds below them). `comfortable` and
 * `maxWidth`: the share rule's targets along a row (see PaneKind); `maxWidth` is soft, never a hard cap.
 */
export interface Bounds {
  width: number;
  height: number;
  comfortable: number;
  maxWidth: number;
}
/** `home`: for a tab group, the index of the child the slot belongs to (a stack's first tab, a fold's home pane). */
export function combineBounds(type: string, children: Bounds[], gap: number, home = 0): Bounds {
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) + Math.max(0, children.length - 1) * gap;
  const widths = children.map((c) => c.width),
    heights = children.map((c) => c.height);
  const comfortable = children.map((c) => c.comfortable),
    maxima = children.map((c) => c.maxWidth);
  // Side by side, needs add up. Stacked, the slot can use what any of its panes can. Tabbed, every tab must fit (the
  // minimums), and the slot is measured as its home: a fold of tables into a record's slot is still a record's slot,
  // and choosing a tab never resizes it.
  if (type === "row")
    return {
      width: sum(widths),
      height: Math.max(...heights),
      comfortable: sum(comfortable),
      maxWidth: sum(maxima),
    };
  const width = Math.max(...widths);
  if (type === "column")
    return {
      width,
      height: sum(heights),
      comfortable: Math.max(...comfortable),
      maxWidth: Math.max(...maxima),
    };
  const own = children[home] ?? children[0]!;
  const comfort = Math.max(width, own.comfortable);
  return {
    width,
    height: Math.max(...heights),
    comfortable: comfort,
    maxWidth: Math.max(comfort, own.maxWidth),
  };
}
export function bounds(node: LayoutNode, kinds: KindRegistry, gap: number): Bounds {
  if (node.type !== "pane")
    return combineBounds(
      node.type,
      node.children.map((c) => bounds(c, kinds, gap)),
      gap,
    );
  const kind = kinds[node.ref.kind];
  if (!kind) throw new Error(`Unknown pane kind: ${node.ref.kind}`);
  const comfortable = Math.max(kind.minWidth, kind.comfortableWidth ?? kind.minWidth);
  return {
    width: kind.minWidth,
    height: kind.minHeight,
    comfortable,
    maxWidth: Math.max(comfortable, kind.maxWidth ?? Infinity),
  };
}
export function minSize(node: LayoutNode, kinds: KindRegistry, gap: number, axis: Axis): number {
  const b = bounds(node, kinds, gap);
  return axis === "row" ? b.width : b.height;
}
