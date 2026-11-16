import type { Axis, Layout, LayoutNode, NodeId, PaneNode, Size, SplitNode, StackNode } from "./types";

export const clone = <T>(value: T): T => structuredClone(value);
export const isSplit = (n: LayoutNode): n is SplitNode => n.type === "row" || n.type === "column";
export function nodes(root: LayoutNode): LayoutNode[] {
  return [root, ...(root.type === "pane" ? [] : root.children.flatMap(nodes))];
}
export const panes = (root: LayoutNode): PaneNode[] => nodes(root).filter((n): n is PaneNode => n.type === "pane");
export const find = (root: LayoutNode, id: NodeId) => nodes(root).find(n => n.id === id);
export function parent(root: LayoutNode, id: NodeId): SplitNode | StackNode | undefined {
  return nodes(root).find((n): n is SplitNode | StackNode => n.type !== "pane" && n.children.some(c => c.id === id));
}
export function replace(root: LayoutNode, id: NodeId, replacement: LayoutNode): LayoutNode {
  if (root.id === id) return replacement;
  if (root.type === "pane") return root;
  if (root.type === "stack") {
    // A pane becoming a split replaces its entire tab group; callers target the group instead.
    root.children = root.children.map(c => c.id === id && replacement.type === "pane" ? replacement : c);
  } else root.children = root.children.map(c => replace(c, id, replacement));
  return root;
}
export function balance(node: LayoutNode): void {
  if (isSplit(node)) for (const child of node.children) if (!child.userSized) child.size = { weight: 1 };
}
export function combined(a: Size, b: Size): Size {
  if ("px" in a && "px" in b) return { px: a.px + b.px };
  if ("weight" in a && "weight" in b) return { weight: a.weight + b.weight };
  return "weight" in a ? { ...a } : { ...b };
}
/** Expand only automatic groups. Child sizes survive folding, including dragged sizes. */
export function unfold(node: LayoutNode, axis: Axis = "row"): LayoutNode {
  if (node.type === "pane") return node;
  if (node.type === "stack") {
    if (node.origin === "user") return node;
    return { id: node.id, type: node.axis ?? axis, size: node.size, userSized: node.userSized, children: node.children };
  }
  return { ...node, children: node.children.map(c => unfold(c, node.type)) };
}
/** Remove from an owned draft, pruning singleton containers and retaining their outer size. */
export function remove(root: LayoutNode, id: NodeId): LayoutNode | undefined {
  if (root.id === id) return undefined;
  if (root.type === "pane") return root;
  if (root.type === "stack") {
    root.children = root.children.filter(c => c.id !== id);
    if (!root.children.some(c => c.id === root.active)) root.active = root.children[0]?.id ?? "";
  } else root.children = root.children.flatMap(c => { const next = remove(c, id); return next ? [next] : []; });
  if (!root.children.length) return undefined;
  if (root.children.length === 1) return { ...root.children[0]!, size: root.size, userSized: root.userSized ?? root.children[0]!.userSized };
  return root;
}
export function activate(layout: Layout, id: NodeId): void {
  const group = parent(layout.root, id);
  if (group?.type === "stack") group.active = id;
}
export function newId(root: LayoutNode, prefix = "pane"): NodeId {
  const ids = new Set(nodes(root).map(n => n.id));
  let i = 1;
  while (ids.has(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}
