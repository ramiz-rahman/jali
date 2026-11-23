/**
 * Where the map's pins and city badges go on screen, so nothing covers anything else and nothing hides under what
 * floats over the map.
 *
 * Pins are placed in order of importance (the selected place, then the day's stops in order, the hotel, the airport,
 * candidates, other days' stops). A pin shows only where it shows whole: inside the map, clear of the floating
 * controls. A pin that would overlap one already placed joins it instead: that pin says "+N" (or, for a pile of one
 * day's stops, their numbers) and names the others, and pressing it zooms in until they part. So every pin on screen is a whole target of at least 24px with room
 * around it, at any width and zoom, and nothing that was on the map is silently lost from a pile.
 *
 * A city badge labels a whole city, not a point, so it may move: it goes after the pins, which mark exact spots, and
 * takes the nearest spot to its city that is clear of the controls, of every pin, and of the other badge.
 */

/** Something to place: its centre on screen, its target's size, and how important it is (lower goes first). */
export interface PinBox {
  id: string;
  x: number;
  y: number;
  /** A square target's side. */
  size: number;
  /** A box that isn't square (a city badge): its width and height, in place of `size`. */
  width?: number;
  height?: number;
  rank: number;
  /** It may move off its point to a clear spot nearby, rather than join a pile (a city badge). */
  moves?: boolean;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PinLayout {
  /** What shows, each with the ids of the pins it stands for too, most important first. */
  shown: Map<string, string[]>;
  /** What is off the open map: past its edge, under a control floating over it, or with nowhere clear to move. */
  off: Set<string>;
  /** How far each box that moved went from its point. */
  moved: Map<string, { dx: number; dy: number }>;
}

/** Room kept between two things that show. */
export const PIN_GAP = 4;

/** How far a badge may move from its point, and in what steps. */
const REACH = 240;
const STEP = 4;
let offsets: [number, number][] | null = null;
/** Every offset within reach, nearest first: where a badge looks for room. */
function nearestFirst() {
  if (offsets) return offsets;
  const all: [number, number][] = [];
  for (let dx = -REACH; dx <= REACH; dx += STEP)
    for (let dy = -REACH; dy <= REACH; dy += STEP)
      if (dx * dx + dy * dy <= REACH * REACH) all.push([dx, dy]);
  offsets = all.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
  return offsets;
}

const boxOf = (p: PinBox, pad = 0, dx = 0, dy = 0): Rect => {
  const w = (p.width ?? p.size) / 2 + pad;
  const h = (p.height ?? p.size) / 2 + pad;
  return { left: p.x + dx - w, top: p.y + dy - h, right: p.x + dx + w, bottom: p.y + dy + h };
};

export const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const inside = (a: Rect, view: Rect) =>
  a.left >= view.left && a.top >= view.top && a.right <= view.right && a.bottom <= view.bottom;

/** Lays out `pins` in `view`, clear of `blocked` (rectangles in the same coordinates). */
export function layoutPins(
  pins: readonly PinBox[],
  view: Rect,
  blocked: readonly Rect[],
): PinLayout {
  const shown = new Map<string, string[]>();
  const off = new Set<string>();
  const moved = new Map<string, { dx: number; dy: number }>();
  const placed: { id: string; box: Rect }[] = [];
  // What can't move goes first: a pin marks its spot, and a badge finds room around it.
  const order = pins
    .map((p, i) => ({ p, i }))
    .sort((a, b) => +!!a.p.moves - +!!b.p.moves || a.p.rank - b.p.rank || a.i - b.i);
  for (const { p } of order) {
    if (p.moves) {
      const spot = nearestFirst().find(([dx, dy]) => {
        const box = boxOf(p, 0, dx, dy);
        const near = boxOf(p, PIN_GAP, dx, dy);
        return (
          inside(box, view) &&
          !blocked.some((b) => overlaps(box, b)) &&
          !placed.some((q) => overlaps(near, q.box))
        );
      });
      if (!spot) {
        off.add(p.id);
        continue;
      }
      const [dx, dy] = spot;
      if (dx || dy) moved.set(p.id, { dx, dy });
      placed.push({ id: p.id, box: boxOf(p, 0, dx, dy) });
      shown.set(p.id, []);
      continue;
    }
    const box = boxOf(p);
    if (!inside(box, view) || blocked.some((b) => overlaps(box, b))) {
      off.add(p.id);
      continue;
    }
    const near = boxOf(p, PIN_GAP);
    const host = placed.find((q) => overlaps(near, q.box));
    if (host) {
      shown.get(host.id)!.push(p.id);
      continue;
    }
    placed.push({ id: p.id, box });
    shown.set(p.id, []);
  }
  return { shown, off, moved };
}

/** A pin as a pile's badge reads it: its day and stop number, for one of the day's stops; nothing for any other. */
export interface PileStop {
  day?: number;
  order?: number;
}

/**
 * What a pile's badge says: when the pile is all one day's stops, the numbers of those it stands for ("2", "4–5",
 * "2–3,5"); else how many places it stands for ("+3").
 */
export function pileMark(head: PileStop, more: readonly PileStop[]): string {
  const oneDay =
    head.day !== undefined &&
    head.order !== undefined &&
    more.every((m) => m.day === head.day && m.order !== undefined);
  if (!oneDay) return `+${more.length}`;
  const ns = [...new Set(more.map((m) => m.order!))].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < ns.length;) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j]! + 1) j++;
    runs.push(i === j ? String(ns[i]) : `${ns[i]}–${ns[j]}`);
    i = j + 1;
  }
  return runs.join(",");
}
