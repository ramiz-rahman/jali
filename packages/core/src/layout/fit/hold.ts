import type { Layout, LayoutContext, LayoutNode, ResolvedLayout } from "../types";
import { clone, find, isSplit, nodes, noFocus, panes } from "../tree/tree";
import { extentAlong } from "../geometry/extent";
import { resolve } from "./resolve";

/** The rects on screen, whoever fills them (the same measure as the UI's stability check). */
const rects = (r: ResolvedLayout) =>
  r.panes
    .filter((b) => !b.hidden)
    .map((b) => `${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`)
    .sort()
    .join(" ");

/**
 * Swap ops (another object shown in a slot, two panes trading places) promise that nothing on screen moves. Under the
 * share rule a slot's length follows what it shows (a record stops at its measure, a table takes the rest), so when
 * the new content's needs differ, the op holds the geometry `before` had: every split whose children would change
 * length keeps their old lengths as exact weights, as if the person had sized it (`userSized`, with the reset size in
 * `base`), so it shares by weights until reset. Resetting that split's divider hands it back to the share rule. Pure. Returns `after` when nothing moves,
 * or when no hold can keep every rect (a minimum forces the change).
 */
export function holdGeometry(before: Layout, after: Layout, ctx: LayoutContext): Layout {
  if (after === before) return after;
  const was = resolve(before, noFocus(), ctx),
    now = resolve(after, noFocus(), ctx);
  if (rects(was) === rects(now)) return after;
  const next = clone(after);
  let held = false;
  for (const node of nodes(next.root)) {
    const old = find(before.root, node.id);
    if (
      !isSplit(node) ||
      !old ||
      old.type !== node.type ||
      !isSplit(old) ||
      old.children.length !== node.children.length
    )
      continue;
    const extent = (r: ResolvedLayout, c: LayoutNode) =>
      extentAlong(
        r.panes,
        panes(c).map((p) => p.id),
        node.type,
      );
    // Slots keep their place in the split, so the child now at index i takes the length index i had.
    const target = old.children.map((c) => extent(was, c)),
      current = node.children.map((c) => extent(now, c));
    const weighted = node.children.flatMap((c, i) => ("weight" in c.size ? [i] : []));
    if (
      !weighted.length ||
      weighted.some((i) => target[i]! <= 0) ||
      weighted.every((i) => Math.abs(target[i]! - current[i]!) < 0.5)
    )
      continue;
    // Weights in px units, as a divider drag stores them: the split reproduces these lengths exactly. As with a drag,
    // the children that would have moved count as sized; the others are only re-expressed, so a divider reset
    // returns the whole split to the share rule.
    for (const i of weighted) {
      const child = node.children[i]!;
      child.base ??= clone(child.size);
      child.size = { weight: target[i]! };
      if (Math.abs(target[i]! - current[i]!) >= 0.5) child.userSized = true;
    }
    held = true;
  }
  // Only a hold that keeps every rect is worth recording; when a minimum forces a change, the op reshapes as before.
  return held && rects(resolve(next, noFocus(), ctx)) === rects(was) ? next : after;
}
