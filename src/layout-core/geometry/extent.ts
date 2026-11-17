import type { Axis, PaneBox } from "../types";
/** Extent of the shown members of a slot along an axis, including any internal gaps. */
export function extentAlong(boxes: readonly PaneBox[], ids: readonly string[], axis: Axis): number {
  const rects = boxes.filter(b => ids.includes(b.id) && !b.hidden).map(b => b.rect);
  if (!rects.length) return 0;
  return axis === "row" ? Math.max(...rects.map(r => r.x + r.width)) - Math.min(...rects.map(r => r.x)) : Math.max(...rects.map(r => r.y + r.height)) - Math.min(...rects.map(r => r.y));
}
