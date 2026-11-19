import type { Direction, Edge, Rect } from "../types";

/**
 * Two kinds of side. A screen side is where something is on screen: what a key, a command, a drop zone or a message
 * means by "left". A tree side is where it sits in the layout tree: "left" is before (a row's earlier child), "right"
 * is after. Left to right they are the same; right to left a row starts at the right, so left and right swap.
 */
export function treeSide(side: Edge, dir: Direction | undefined): Edge;
export function treeSide(side: Edge | "centre", dir: Direction | undefined): Edge | "centre";
export function treeSide(side: Edge | "centre", dir: Direction | undefined): Edge | "centre" {
  if (dir !== "rtl") return side;
  return side === "left" ? "right" : side === "right" ? "left" : side;
}

/** The screen side a row ends on: where "after" is. */
export const endSide = (dir: Direction | undefined): "left" | "right" =>
  dir === "rtl" ? "left" : "right";

/** The rect mirrored across a box `width` wide: what a left-to-right rect is right to left. */
export const mirrorRect = (r: Rect, width: number): Rect => ({
  ...r,
  x: width - r.x - r.width,
});
