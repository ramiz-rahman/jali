import type { Edge, Layout, PaneNode, SplitNode } from "../types";
import { balance, find, newId, parent, replace } from "./tree";
const axisFor = (edge: Edge) => (edge === "left" || edge === "right" ? "row" : "column");
const before = (edge: Edge) => edge === "left" || edge === "top";

export function beside(layout: Layout, targetId: string, edge: Edge, pane: PaneNode): void {
  let target = find(layout.root, targetId)!;
  let container = parent(layout.root, targetId);
  if (container?.type === "stack") {
    target = container;
    container = parent(layout.root, target.id);
  }
  const axis = axisFor(edge);
  if (container && container.type === axis) {
    const index = container.children.findIndex((c) => c.id === target.id);
    container.children.splice(index + (before(edge) ? 0 : 1), 0, pane);
    balance(container);
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
export function tab(layout: Layout, targetId: string, pane: PaneNode): void {
  const target = find(layout.root, targetId)!;
  const container = parent(layout.root, targetId);
  if (container?.type === "stack") {
    container.children.push(pane);
    container.active = pane.id;
    container.origin = "user";
  } else if (target.type === "pane") {
    layout.root = replace(layout.root, target.id, {
      id: newId(layout.root, "stack"),
      type: "stack",
      size: target.size,
      userSized: target.userSized,
      children: [target, pane],
      active: pane.id,
      origin: "user",
    });
  }
}
