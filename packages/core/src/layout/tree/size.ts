import type { LayoutNode, Size } from "../types";
import { clone } from "./tree";
export function combined(a: Size, b: Size): Size {
  if ("px" in a && "px" in b) return { px: a.px + b.px };
  if ("weight" in a && "weight" in b) return { weight: a.weight + b.weight };
  return "weight" in a ? { ...a } : { ...b };
}
export const sameSize = (a: Size, b: Size) =>
  "px" in a && "px" in b ? a.px === b.px : "weight" in a && "weight" in b && a.weight === b.weight;
/** Give `node` the size `from` has, and its `userSized` (none when `from` has none). */
export function sizeFrom(node: LayoutNode, from: { size: Size; userSized?: boolean }): void {
  node.size = clone(from.size);
  node.userSized = from.userSized;
  if (!from.userSized) delete node.userSized;
}
