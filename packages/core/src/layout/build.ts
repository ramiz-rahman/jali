/**
 * Layout builders: write a layout as the shape it has on screen.
 *
 *   row(orders(), column(order({ id: 1 }), customer({ id: 7 })))
 *
 * A child is a ref (a pane showing it), a `pane(ref, options)`, or another `row`, `column` or `tabs`. Options come
 * first when there are any: `row({ weight: 2 }, a, b)`. Nodes without an `id` get one from what they hold ("orders",
 * "row", then "orders-2"); give an `id` to a pane that another one links to.
 */
import type { Axis, Layout, LayoutNode, NodeId, ObjectRef, PaneNode, Size } from "./types";

/** How much of its parent a node takes: a share (`weight`, default 1) or a fixed length in px. */
export interface SizeOptions {
  id?: NodeId;
  weight?: number;
  px?: number;
}

export interface PaneNodeOptions extends SizeOptions, Pick<PaneNode, "linkedTo" | "follows" | "pinned" | "role" | "priority"> {
  /** Off screen at the start (no slot, no tab): its neighbours take the space, and showing it brings it back. */
  hidden?: boolean;
}

export interface TabsOptions extends SizeOptions {
  /** The tab shown. Default: the first. */
  active?: NodeId;
}

export type PaneDraft = { type: "pane"; ref: ObjectRef; options: PaneNodeOptions };
export type SplitDraft = { type: Axis; options: SizeOptions; children: Draft[] };
export type TabsDraft = { type: "stack"; options: TabsOptions; children: PaneDraft[] };
export type Draft = PaneDraft | SplitDraft | TabsDraft;

/** Anything that can stand for a layout: a whole `Layout`, a builder's result, or a single ref. */
export type LayoutInput = Layout | Draft | ObjectRef;
type Child = Draft | ObjectRef;

const isRef = (v: unknown): v is ObjectRef => typeof v === "object" && v !== null && "kind" in v && "params" in v;
const isDraft = (v: unknown): v is Draft => typeof v === "object" && v !== null && "options" in v && "type" in v;
const isLayout = (v: unknown): v is Layout => typeof v === "object" && v !== null && "root" in v && "version" in v;
const asDraft = (child: Child): Draft => (isRef(child) ? pane(child) : child);

/** Splits the optional leading options from the children. */
function parts<O>(args: unknown[]): [O, Child[]] {
  const [first, ...rest] = args;
  return first !== undefined && !isRef(first) && !isDraft(first) ? [first as O, rest as Child[]] : [{} as O, args as Child[]];
}

export function pane(ref: ObjectRef, options: PaneNodeOptions = {}): PaneDraft {
  return { type: "pane", ref, options };
}

/** Children side by side. */
export function row(...children: Child[]): SplitDraft;
export function row(options: SizeOptions, ...children: Child[]): SplitDraft;
export function row(...args: unknown[]): SplitDraft {
  const [options, children] = parts<SizeOptions>(args);
  return { type: "row", options, children: children.map(asDraft) };
}

/** Children one above the other. */
export function column(...children: Child[]): SplitDraft;
export function column(options: SizeOptions, ...children: Child[]): SplitDraft;
export function column(...args: unknown[]): SplitDraft {
  const [options, children] = parts<SizeOptions>(args);
  return { type: "column", options, children: children.map(asDraft) };
}

/** Panes as tabs in one place. */
export function tabs(...children: (PaneDraft | ObjectRef)[]): TabsDraft;
export function tabs(options: TabsOptions, ...children: (PaneDraft | ObjectRef)[]): TabsDraft;
export function tabs(...args: unknown[]): TabsDraft {
  const [options, children] = parts<TabsOptions>(args);
  return { type: "stack", options, children: children.map((c) => (isRef(c) ? pane(c) : (c as PaneDraft))) };
}

const sizeOf = ({ px, weight }: SizeOptions): Size => (px !== undefined ? { px } : { weight: weight ?? 1 });

/** The layout `input` stands for, with an id on every node. */
export function toLayout(input: LayoutInput): Layout {
  if (isLayout(input)) return input;
  const root = isRef(input) ? pane(input) : input;

  // Ids the app gave are kept; the rest are named after what they hold.
  const taken = new Set<NodeId>();
  const given = (d: Draft): void => {
    if (d.options.id) taken.add(d.options.id);
    if (d.type !== "pane") d.children.forEach(given);
  };
  given(root);
  const name = (d: Draft): NodeId => {
    if (d.options.id) return d.options.id;
    const base = d.type === "pane" ? d.ref.kind : d.type === "stack" ? "tabs" : d.type;
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    taken.add(id);
    return id;
  };

  const hidden: NodeId[] = [];
  const build = (d: Draft): LayoutNode => {
    const id = name(d);
    const size = sizeOf(d.options);
    if (d.type === "pane") {
      const { hidden: off, linkedTo, follows, pinned, role, priority } = d.options;
      if (off) hidden.push(id);
      const node: PaneNode = { id, type: "pane", size, ref: { kind: d.ref.kind, params: { ...d.ref.params } } };
      if (linkedTo !== undefined) node.linkedTo = linkedTo;
      if (follows !== undefined) node.follows = follows;
      if (pinned !== undefined) node.pinned = pinned;
      if (role !== undefined) node.role = role;
      if (priority !== undefined) node.priority = priority;
      return node;
    }
    if (d.type === "stack") {
      const children = d.children.map((c) => build(c) as PaneNode);
      return { id, type: "stack", size, children, active: d.options.active ?? children[0]?.id ?? "", origin: "user" };
    }
    return { id, type: d.type, size, children: d.children.map(build) };
  };

  const layout: Layout = { version: 1, root: build(root) };
  if (hidden.length) layout.overlay = { tucks: [], folds: [], shown: {}, hidden };
  return layout;
}
