import type { Axis, PaneBox, ResolvedLayout } from "../types";
/** Extent of the shown members of a slot along an axis, including any internal gaps. */
export function extentAlong(boxes: readonly PaneBox[], ids: readonly string[], axis: Axis): number {
  const rects = boxes.filter((b) => ids.includes(b.id) && !b.hidden).map((b) => b.rect);
  if (!rects.length) return 0;
  return axis === "row"
    ? Math.max(...rects.map((r) => r.x + r.width)) - Math.min(...rects.map((r) => r.x))
    : Math.max(...rects.map((r) => r.y + r.height)) - Math.min(...rects.map((r) => r.y));
}

/**
 * The same, in a resolved layout, where a row that scrolls counts as its window: when every pane of a strip is
 * among `ids`, the strip takes the room its window does, not the length of its content. (A divider beside a strip
 * shares out the window; one inside it measures its children along the content, as `extentAlong` does.)
 */
export function extentIn(resolved: ResolvedLayout, ids: readonly string[], axis: Axis): number {
  let boxes: readonly PaneBox[] = resolved.panes;
  let want = ids;
  for (const s of resolved.scrollers ?? []) {
    if (!s.paneIds.length || !s.paneIds.every((id) => want.includes(id))) continue;
    const members = new Set(s.paneIds);
    boxes = [...boxes.filter((b) => !members.has(b.id)), { id: s.id, rect: s.rect }];
    want = [...want.filter((id) => !members.has(id)), s.id];
  }
  return extentAlong(boxes, want, axis);
}
