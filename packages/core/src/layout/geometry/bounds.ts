import type { Axis, KindRegistry, LayoutNode } from "../types";
/**
 * What a slot needs and can use. `width`/`height`: minimums (the fit step folds below them). `comfortable` and
 * `maxWidth`: the share rule's targets along a row (see PaneKind); `comfortableHeight` and `maxHeight` the same down
 * a column. The maximums are soft, never a hard cap.
 */
export interface Bounds {
  width: number;
  height: number;
  comfortable: number;
  maxWidth: number;
  comfortableHeight: number;
  maxHeight: number;
}
/** A slot with no needs: what a split measures as before its children are combined. */
export const NO_BOUNDS: Bounds = {
  width: 0,
  height: 0,
  comfortable: 0,
  maxWidth: Infinity,
  comfortableHeight: 0,
  maxHeight: Infinity,
};
/** `home`: for a fold's tab group, the index of the child the slot belongs to (its home pane); -1 for a tab group the
 *  person or the app made, which is measured by all its tabs alike, so their order never changes its size. */
export function combineBounds(
  type: string,
  children: Bounds[],
  gap: number,
  home = 0,
  scroll = false,
): Bounds {
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) + Math.max(0, children.length - 1) * gap;
  const widths = children.map((c) => c.width),
    heights = children.map((c) => c.height);
  const comfortable = children.map((c) => c.comfortable),
    maxima = children.map((c) => c.maxWidth);
  const comfortableHeights = children.map((c) => c.comfortableHeight),
    maxHeights = children.map((c) => c.maxHeight);
  // Heights mirror widths: down a column they add up, across a row the slot takes the most any child needs or uses.
  const across = {
    comfortableHeight: Math.max(...comfortableHeights),
    maxHeight: Math.max(...maxHeights),
  };
  // Side by side, needs add up. Stacked, the slot can use what any of its panes can. Tabbed, every tab must fit (the
  // minimums), and the slot is measured as its home: a fold of tables into a record's slot is still a record's slot,
  // and choosing a tab never resizes it.
  // A row that scrolls needs room for one child whole, at its comfortable width (it scrolls to the rest; a window
  // narrower than that would cut even the child in view), and would like all of them at comfort, so its parent
  // gives it what room there is. Short of that room, a neighbour folds rather than the strip.
  if (type === "row" && scroll)
    return {
      width: Math.max(...comfortable),
      height: Math.max(...heights),
      comfortable: sum(comfortable),
      maxWidth: sum(maxima),
      ...across,
    };
  if (type === "row")
    return {
      width: sum(widths),
      height: Math.max(...heights),
      comfortable: sum(comfortable),
      maxWidth: sum(maxima),
      ...across,
    };
  const width = Math.max(...widths);
  if (type === "column")
    return {
      width,
      height: sum(heights),
      comfortable: Math.max(...comfortable),
      maxWidth: Math.max(...maxima),
      comfortableHeight: sum(comfortableHeights),
      maxHeight: sum(maxHeights),
    };
  // A tab group the person made can show any of its tabs: it is comfortable for the most demanding one, and grows
  // no further than its most limited one uses, so no tab is left with space it can't use (a record in a tab group
  // keeps the slot a record's). Its tab order says nothing about its size.
  const own =
    home < 0
      ? {
          comfortable: Math.max(...comfortable),
          maxWidth: Math.min(...maxima),
          comfortableHeight: Math.max(...comfortableHeights),
          maxHeight: Math.min(...maxHeights),
        }
      : (children[home] ?? children[0]!);
  const comfort = Math.max(width, own.comfortable);
  const height = Math.max(...heights);
  const comfortHeight = Math.max(height, own.comfortableHeight);
  return {
    width,
    height,
    comfortable: comfort,
    maxWidth: Math.max(comfort, own.maxWidth),
    comfortableHeight: comfortHeight,
    maxHeight: Math.max(comfortHeight, own.maxHeight),
  };
}
export function bounds(node: LayoutNode, kinds: KindRegistry, gap: number): Bounds {
  if (node.type !== "pane")
    return combineBounds(
      node.type,
      node.children.map((c) => bounds(c, kinds, gap)),
      gap,
      node.type === "stack" ? -1 : 0,
      node.type === "row" && node.scroll === "x",
    );
  const kind = Object.hasOwn(kinds, node.ref.kind) ? kinds[node.ref.kind] : undefined;
  if (!kind) throw new Error(`Unknown pane kind: ${node.ref.kind}`);
  const comfortable = Math.max(kind.minWidth, kind.comfortableWidth ?? kind.minWidth);
  const comfortableHeight = Math.max(kind.minHeight, kind.comfortableHeight ?? kind.minHeight);
  return {
    width: kind.minWidth,
    height: kind.minHeight,
    comfortable,
    maxWidth: Math.max(comfortable, kind.maxWidth ?? Infinity),
    comfortableHeight,
    maxHeight: Math.max(comfortableHeight, kind.maxHeight ?? Infinity),
  };
}
export function minSize(node: LayoutNode, kinds: KindRegistry, gap: number, axis: Axis): number {
  const b = bounds(node, kinds, gap);
  return axis === "row" ? b.width : b.height;
}
