/**
 * Where the map's pins go on screen, so no two cover each other and none hides under what floats over the map.
 *
 * Pins are placed in order of importance (the selected place, then the day's stops in order, the hotel, the airport,
 * candidates, other days' stops). A pin shows only where it shows whole: inside the map, clear of the floating
 * controls. A pin that would overlap one already placed joins it instead: that pin says "+N" and names the others,
 * and pressing it zooms in until they part. So every pin on screen is a whole target of at least 24px with room
 * around it, at any width and zoom, and nothing that was on the map is silently lost from a pile.
 */

/** A pin to place: its centre on screen, the size of its target, and how important it is (lower goes first). */
export interface PinBox {
  id: string;
  x: number;
  y: number;
  size: number;
  rank: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PinLayout {
  /** The pins that show, each with the ids of the pins it stands for too, most important first. */
  shown: Map<string, string[]>;
  /** The pins that are off the open map: past its edge, or under a control floating over it. */
  off: Set<string>;
}

/** Room kept between two pins that show. */
export const PIN_GAP = 4;

const boxOf = (p: PinBox, pad = 0): Rect => {
  const half = p.size / 2 + pad;
  return { left: p.x - half, top: p.y - half, right: p.x + half, bottom: p.y + half };
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
  const placed: { id: string; box: Rect }[] = [];
  const order = pins.map((p, i) => ({ p, i })).sort((a, b) => a.p.rank - b.p.rank || a.i - b.i);
  for (const { p } of order) {
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
  return { shown, off };
}
