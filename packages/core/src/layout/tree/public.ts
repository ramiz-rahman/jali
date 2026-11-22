/**
 * `layout.tree`: reading a layout tree. Every function here is pure: it never changes the tree it is given (`map`
 * returns a new tree, keeping unchanged branches), so each takes a tree a workspace gave (`jali.getLayout().root`,
 * read-only) as well as one of the app's own. An app changes a layout with the operations (`layout.close`,
 * `layout.openBeside`, …) or `jali.actions`.
 */
import type {
  DeepReadonly,
  Layout,
  LayoutNode,
  NodeId,
  PaneNode,
  SplitNode,
  StackNode,
} from "../types";
import * as draft from "./tree";

/** A tree as given: the app's own, or one a workspace gave (read-only). What comes back is read-only too. */
type Node = DeepReadonly<LayoutNode>;
type Read<T> = DeepReadonly<T>;

export { unzoom, noFocus } from "./tree";
/** A deep copy, to edit: `clone(jali.getLayout())` is a layout of the app's own. */
export const clone = draft.clone as {
  (layout: DeepReadonly<Layout>): Layout;
  <T>(value: T): T;
};
/** Whether `node` is a row or a column. */
export const isSplit = draft.isSplit as (node: Node) => node is Read<SplitNode>;
/** Every node under `root` (itself first), in tree order. */
export const nodes = draft.nodes as (root: Node) => Read<LayoutNode>[];
/** Every pane under `root`, in tree order. */
export const panes = draft.panes as (root: Node) => Read<PaneNode>[];
/** The node with this id under `root`. */
export const find = draft.find as (root: Node, id: NodeId) => Read<LayoutNode> | undefined;
/** The split or stack holding the node `id`. */
export const parent = draft.parent as (
  root: Node,
  id: NodeId,
) => Read<SplitNode | StackNode> | undefined;
/** The stack holding the pane `id`, if it is in one. */
export const stackOf = draft.stackOf as (root: Node, id: NodeId) => Read<StackNode> | undefined;
/** An id no node under `root` has (`"pane-3"`). */
export const newId = draft.newId as (root: Node, prefix?: string) => NodeId;
/** A new tree with `fn` applied to every node, top down (a node `fn` replaces is not walked further). */
export const map = draft.map as (root: Node, fn: (node: Node) => Node) => Read<LayoutNode>;
/** The tree's shape as text (`r:root(a,s:tabs(b,c))`), for tests and logs. */
export const shape = draft.shape as (root: Node) => string;
