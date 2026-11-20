/**
 * `layout.tree`: reading a layout tree. Every function here is pure: it never changes the tree it is given (`map`
 * returns a new tree, keeping unchanged branches). The steps that edit a draft in place (`replace`, `remove`,
 * `balance`, `activate`) are the layout operations' own (tree.ts); an app changes a layout with the operations
 * (`layout.close`, `layout.openBeside`, …) or `jali.actions`.
 */
import type { Layout, LayoutNode, NodeId } from "../types";
import * as draft from "./tree";

export {
  clone,
  isSplit,
  nodes,
  panes,
  find,
  parent,
  stackOf,
  newId,
  map,
  shape,
  unzoom,
  noFocus,
} from "./tree";

/** @deprecated Another name for `parent`; use `parent`. */
export const parentOf = draft.parent;

/** @deprecated Changes `root` in place (a layout operation's draft step). Use `map`, which returns a new tree:
 *  `map(root, (n) => (n.id === id ? replacement : n))`. */
export const replace = (root: LayoutNode, id: NodeId, replacement: LayoutNode): LayoutNode =>
  draft.replace(root, id, replacement);

/** @deprecated Changes `node` in place (a layout operation's draft step). The layout operations balance for you. */
export const balance = (node: LayoutNode): void => draft.balance(node);

/** @deprecated Changes `root` in place (a layout operation's draft step). Use `layout.close`, which returns a new
 *  layout and keeps it fitted. */
export const remove = (root: LayoutNode, id: NodeId): LayoutNode | undefined =>
  draft.remove(root, id);

/** @deprecated Changes `layout` in place (a layout operation's draft step). Use `layout.setActiveTab`, which
 *  returns a new layout. */
export const activate = (layout: Layout, id: NodeId): void => draft.activate(layout, id);
