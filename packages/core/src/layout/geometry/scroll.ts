/**
 * Rows that scroll sideways, at a scroll position. `resolve` lays a strip's panes along its content, unscrolled;
 * `scrolled` moves them by each strip's offset and cuts them to its window, so everything downstream (drawing,
 * hit-testing a drag, dividers) reads screen positions as for any pane. Pure.
 *
 * An offset is how far along its content a strip has scrolled, in px, in reading order: left to right, it moves the
 * content left; right to left (a strip starts at its right edge), it moves it right.
 */
import type { NodeId, Rect, ResolvedLayout, ScrollerBox } from "../types";

export type Offsets = Readonly<Record<NodeId, number>>;

/** The furthest a strip scrolls: its content past its window. */
export const maxOffset = (s: ScrollerBox) => Math.max(0, s.contentWidth - s.rect.width);
/** An offset kept within the strip. */
export const clampOffset = (s: ScrollerBox, offset: number) =>
  Math.min(maxOffset(s), Math.max(0, Number.isFinite(offset) ? offset : 0));

/** The resolved layout with each strip at its offset: its panes and dividers moved, and cut to its window. */
export function scrolled(resolved: ResolvedLayout, offsets: Offsets, dir: "ltr" | "rtl" = "ltr"): ResolvedLayout {
  if (!resolved.scrollers.length) return resolved;
  const strips = new Map<NodeId, { s: ScrollerBox; shift: number }>();
  for (const s of resolved.scrollers) {
    const offset = clampOffset(s, offsets[s.id] ?? 0);
    for (const id of s.paneIds) strips.set(id, { s, shift: dir === "rtl" ? offset : -offset });
  }
  const move = (rect: Rect, shift: number): Rect => ({ ...rect, x: rect.x + shift });
  const panes = resolved.panes.map((b) => {
    const at = strips.get(b.id);
    return at && !b.hidden ? { ...b, rect: move(b.rect, at.shift), clip: at.s.rect } : b;
  });
  // A divider belongs to the strip that holds the panes either side of it.
  const dividers = resolved.dividers.map((d) => {
    const at = d.neighbours && strips.get(d.neighbours[0][0]!);
    return at && d.neighbours!.every((side) => side.every((id) => strips.get(id)?.s === at.s))
      ? { ...d, rect: move(d.rect, at.shift), clip: at.s.rect }
      : d;
  });
  return { ...resolved, panes, dividers };
}

/** Whether a pane's rect, once scrolled, shows at all in its strip's window. */
export const inWindow = (rect: Rect, clip: Rect) =>
  rect.x < clip.x + clip.width - 0.5 && rect.x + rect.width > clip.x + 0.5;

/**
 * The offset that shows the whole of `rect` (a pane in the strip, unscrolled) with the least movement from
 * `offset`, or `offset` itself when it already shows. A pane wider than the window shows from its start.
 */
export function offsetToShow(s: ScrollerBox, rect: Rect, offset: number, dir: "ltr" | "rtl" = "ltr"): number {
  // Where the pane starts along the content, in reading order.
  const start = dir === "rtl" ? s.rect.x + s.contentWidth - (rect.x + rect.width) : rect.x - s.rect.x;
  const end = start + rect.width;
  const view = s.rect.width;
  let next = offset;
  if (rect.width >= view || start < offset) next = start;
  else if (end > offset + view) next = end - view;
  return clampOffset(s, next);
}
