import type { Layout, LayoutNode, NodeId, PaneNode, SplitNode, StackNode } from "../types";

export const clone = <T>(value: T): T => structuredClone(value);
export const isSplit = (n: LayoutNode): n is SplitNode => n.type === "row" || n.type === "column";
export function nodes(root: LayoutNode): LayoutNode[] {
  return [root, ...(root.type === "pane" ? [] : root.children.flatMap(nodes))];
}
export const panes = (root: LayoutNode): PaneNode[] =>
  nodes(root).filter((n): n is PaneNode => n.type === "pane");
export const find = (root: LayoutNode, id: NodeId) => nodes(root).find((n) => n.id === id);
export function parent(root: LayoutNode, id: NodeId): SplitNode | StackNode | undefined {
  return nodes(root).find(
    (n): n is SplitNode | StackNode => n.type !== "pane" && n.children.some((c) => c.id === id),
  );
}
export function replace(root: LayoutNode, id: NodeId, replacement: LayoutNode): LayoutNode {
  if (root.id === id) return replacement;
  if (root.type === "pane") return root;
  if (root.type === "stack") {
    // A pane becoming a split replaces its entire tab group; callers target the group instead.
    root.children = root.children.map((c) =>
      c.id === id && replacement.type === "pane" ? replacement : c,
    );
  } else root.children = root.children.map((c) => replace(c, id, replacement));
  return root;
}
/**
 * Even out the children nobody sized. Beside sized children (whose weights are lengths, as a divider drag or a held
 * swap stores them), each gets the mean of those weights: a fair share, not a near-zero weight of 1 next to 536.
 */
export function balance(node: LayoutNode): void {
  if (!isSplit(node)) return;
  const sized = node.children.flatMap((c) =>
    c.userSized && "weight" in c.size ? [c.size.weight] : [],
  );
  const unit = sized.length ? sized.reduce((a, b) => a + b, 0) / sized.length : 1;
  for (const child of node.children) if (!child.userSized) child.size = { weight: unit };
}
/** Remove from an owned draft, pruning singleton containers and retaining their outer size. */
export function remove(root: LayoutNode, id: NodeId): LayoutNode | undefined {
  if (root.id === id) return undefined;
  if (root.type === "pane") return root;
  if (root.type === "stack") {
    root.children = root.children.filter((c) => c.id !== id);
    if (!root.children.some((c) => c.id === root.active)) root.active = root.children[0]?.id ?? "";
  } else
    root.children = root.children.flatMap((c) => {
      const next = remove(c, id);
      return next ? [next] : [];
    });
  if (!root.children.length) return undefined;
  if (root.children.length === 1)
    return {
      ...root.children[0]!,
      size: root.size,
      userSized: root.userSized ?? root.children[0]!.userSized,
    };
  return root;
}
export function activate(layout: Layout, id: NodeId): void {
  const group = parent(layout.root, id);
  if (group?.type === "stack") group.active = id;
}
export function newId(root: LayoutNode, prefix = "pane"): NodeId {
  const ids = new Set(nodes(root).map((n) => n.id));
  let i = 1;
  while (ids.has(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}

export function stackOf(root: LayoutNode, id: NodeId): StackNode | undefined {
  const n = parent(root, id);
  return n?.type === "stack" ? n : undefined;
}
/** A replaced node is final; unchanged branches retain identity. */
export function map(root: LayoutNode, fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  const next = fn(root);
  if (next !== root || root.type === "pane") return next;
  const children = root.children.map((c) => map(c, fn));
  if (children.every((c, i) => c === root.children[i])) return root;
  return root.type === "stack"
    ? { ...root, children: children as PaneNode[] }
    : { ...root, children };
}
/** Shape excludes sizes, tab selection and content. */
export function shape(root: LayoutNode): string {
  return root.type === "pane"
    ? root.id
    : `${root.type[0]}:${root.id}(${root.children.map(shape).join(",")})`;
}
export function unzoom(view: import("../types").ViewState): import("../types").ViewState {
  if (!view.zoomed) return view;
  const next = { ...view };
  delete next.zoomed;
  return next;
}
export const noFocus = (): import("../types").ViewState => ({ focusHistory: [] });
