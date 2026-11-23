import type { Edge, Layout, PaneNode, SplitNode, StackNode } from "../types";
import { balance, find, newId, parent, replace } from "./tree";
const axisFor = (edge: Edge) => (edge === "left" || edge === "right" ? "row" : "column");
const before = (edge: Edge) => edge === "left" || edge === "top";

/**
 * Put `pane` on `edge` of `targetId`: in its split when that runs the same way, else in a new split around it. The
 * children nobody sized share again (`balance`); with `keepSizes`, they keep their sizes and the new pane takes the
 * mean of theirs, so taking it out again leaves them as they were.
 */
export function beside(
  layout: Layout,
  targetId: string,
  edge: Edge,
  pane: PaneNode,
  keepSizes = false,
): void {
  let target = find(layout.root, targetId)!;
  let container = parent(layout.root, targetId);
  if (container?.type === "stack") {
    target = container;
    container = parent(layout.root, target.id);
  }
  const axis = axisFor(edge);
  if (container && container.type === axis) {
    const index = container.children.findIndex((c) => c.id === target.id);
    // Beside sized children, the mean of theirs (as `balance` gives); else the mean of all.
    const sized = container.children.some((c) => c.userSized);
    const weights = container.children.flatMap((c) =>
      "weight" in c.size && (!sized || c.userSized) ? [c.size.weight] : [],
    );
    container.children.splice(index + (before(edge) ? 0 : 1), 0, pane);
    if (!keepSizes) balance(container);
    else if (weights.length && !pane.userSized)
      pane.size = { weight: weights.reduce((a, b) => a + b, 0) / weights.length };
  } else {
    const original = { ...target, size: target.userSized ? target.size : { weight: 1 } };
    const split: SplitNode = {
      id: newId(layout.root, "split"),
      type: axis,
      size: target.size,
      userSized: target.userSized,
      children: before(edge) ? [pane, original] : [original, pane],
    };
    layout.root = replace(layout.root, target.id, split);
    balance(split);
  }
}
/** Put `pane` into `stack` at `index`, kept within its section (pinned tabs first); `active` shows it. */
export function intoStack(stack: StackNode, pane: PaneNode, index: number, active?: boolean): void {
  const pinned = stack.children.filter((c) => c.pinned).length;
  const at = Math.min(index, stack.children.length);
  stack.children.splice(pane.pinned ? Math.min(at, pinned) : Math.max(at, pinned), 0, pane);
  if (active) stack.active = pane.id;
}
export function tab(layout: Layout, targetId: string, pane: PaneNode): void {
  const target = find(layout.root, targetId)!;
  const container = parent(layout.root, targetId);
  if (container?.type === "stack") {
    // A pinned tab joins at the end of the group's pinned tabs; any other at the end.
    intoStack(container, pane, Infinity, true);
    container.origin = "user";
  } else if (target.type === "pane") {
    layout.root = replace(layout.root, target.id, {
      id: newId(layout.root, "stack"),
      type: "stack",
      size: target.size,
      userSized: target.userSized,
      children: pane.pinned && !target.pinned ? [pane, target] : [target, pane],
      active: pane.id,
      origin: "user",
    });
  }
}
