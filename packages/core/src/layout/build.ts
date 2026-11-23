/**
 * Layout builders: write a layout as the shape it has on screen.
 *
 *   row(orders(), column(order({ id: 1 }), customer({ id: 7 })))
 *
 * A child is a ref (a pane showing it), a `pane(ref, options)`, or another `row`, `column` or `tabs`. Options come
 * first when there are any: `row({ weight: 2 }, a, b)`. Nodes without an `id` get one from what they hold ("orders",
 * "row", then "orders-2"); give an `id` to a pane that another one links to.
 */
declare const process: { env: { NODE_ENV?: string } };
import { UNSAFE_IDS } from "./codec/validate";
import type {
  DeepReadonly,
  Axis,
  Layout,
  LayoutNode,
  NodeId,
  ObjectRef,
  PaneNode,
  Size,
  SplitNode,
} from "./types";

/** How much of its parent a node takes: a share (`weight`, default 1) or a fixed length in px. */
export interface SizeOptions {
  id?: NodeId;
  weight?: number;
  px?: number;
}

export interface PaneNodeOptions
  extends
    SizeOptions,
    Pick<PaneNode, "linkedTo" | "follows" | "kept" | "pinned" | "role" | "priority"> {
  /** Off screen at the start (no slot, no tab): its neighbours take the space, and showing it brings it back. */
  hidden?: boolean;
}

export interface TabsOptions extends SizeOptions {
  /** The tab shown. Default: the first. */
  active?: NodeId;
}

export type PaneDraft = { type: "pane"; ref: ObjectRef; options: PaneNodeOptions };
/** A row's options: its size, and `scroll: "x"` for a row that scrolls sideways instead of folding. */
export interface RowOptions extends SizeOptions {
  scroll?: "x";
}
export type SplitDraft = { type: Axis; options: RowOptions; children: Draft[] };
export type TabsDraft = { type: "stack"; options: TabsOptions; children: PaneDraft[] };
export type Draft = PaneDraft | SplitDraft | TabsDraft;

/** Anything that can stand for a layout: a whole `Layout`, a builder's result, or a single ref. */
/** A layout: one an instance gave (`getLayout()`, read-only or not), one built with `row`/`column`/`tabs`/`pane`, or
 *  one ref alone. */
export type LayoutInput = Layout | DeepReadonly<Layout> | Draft | ObjectRef;
type Child = Draft | ObjectRef;

const isRef = (v: unknown): v is ObjectRef =>
  typeof v === "object" && v !== null && "kind" in v && "params" in v;
const isDraft = (v: unknown): v is Draft =>
  typeof v === "object" && v !== null && "options" in v && "type" in v;
const isLayout = (v: unknown): v is Layout | DeepReadonly<Layout> =>
  typeof v === "object" && v !== null && "root" in v && "version" in v;
const asDraft = (child: Child): Draft => (isRef(child) ? pane(child) : child);

/** Splits the optional leading options from the children. */
function parts<O>(args: unknown[]): [O, Child[]] {
  const [first, ...rest] = args;
  return first !== undefined && !isRef(first) && !isDraft(first)
    ? [first as O, rest as Child[]]
    : [{} as O, args as Child[]];
}

export function pane(ref: ObjectRef, options: PaneNodeOptions = {}): PaneDraft {
  // Elsewhere (production, a layout not built here) layout validation refuses it.
  // Development only, behind the literal test a production build drops (dev.ts).
  let unsafe: Error | undefined;
  try {
    if (
      process.env.NODE_ENV !== "production" &&
      options.id !== undefined &&
      UNSAFE_IDS.has(options.id)
    )
      unsafe = new Error(
        `Jali: "${options.id}" can't be a pane id (it names something on every object).`,
      );
  } catch {
    /* no `process`: production */
  }
  if (unsafe) throw unsafe;
  return { type: "pane", ref, options };
}

/**
 * Children side by side. `row({ scroll: "x" }, …)` scrolls sideways: each child keeps its own width (its
 * comfortable width until the person sizes it) and the row scrolls to the rest, so nothing folds.
 */
export function row(...children: Child[]): SplitDraft;
export function row(options: RowOptions, ...children: Child[]): SplitDraft;
export function row(...args: unknown[]): SplitDraft {
  const [options, children] = parts<RowOptions>(args);
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
  return {
    type: "stack",
    options,
    children: children.map((c) => (isRef(c) ? pane(c) : (c as PaneDraft))),
  };
}

const sizeOf = ({ px, weight }: SizeOptions): Size =>
  px !== undefined ? { px } : { weight: weight ?? 1 };

/** The layout `input` stands for, with an id on every node. */
export function toLayout(input: LayoutInput): Layout {
  if (isLayout(input)) return input as Layout;
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
    // Named after the kind, kept to the characters an id may hold (layout/codec/validate.ts).
    const base =
      d.type === "pane"
        ? String(d.ref.kind)
            .replace(/[^\w.:-]/g, "-")
            .slice(0, 100) || "pane"
        : d.type === "stack"
          ? "tabs"
          : d.type;
    let id = base;
    for (let i = 2; taken.has(id) || UNSAFE_IDS.has(id); i++) id = `${base}-${i}`;
    taken.add(id);
    return id;
  };

  const hidden: NodeId[] = [];
  const build = (d: Draft): LayoutNode => {
    const id = name(d);
    const size = sizeOf(d.options);
    if (d.type === "pane") {
      const { hidden: off, linkedTo, follows, kept, pinned, role, priority } = d.options;
      if (off) hidden.push(id);
      const node: PaneNode = {
        id,
        type: "pane",
        size,
        ref: { kind: d.ref.kind, params: { ...d.ref.params } },
      };
      if (linkedTo !== undefined) node.linkedTo = linkedTo;
      if (follows !== undefined) node.follows = follows;
      if (kept !== undefined) node.kept = kept;
      if (pinned !== undefined) node.pinned = pinned;
      if (role !== undefined) node.role = role;
      if (priority !== undefined) node.priority = priority;
      return node;
    }
    if (d.type === "stack") {
      const children = d.children.map((c) => build(c) as PaneNode);
      return {
        id,
        type: "stack",
        size,
        children,
        active: d.options.active ?? children[0]?.id ?? "",
        origin: "user",
      };
    }
    const split: SplitNode = { id, type: d.type, size, children: d.children.map(build) };
    if (d.type === "row" && d.options.scroll === "x") split.scroll = "x";
    return split;
  };

  const layout: Layout = { version: 1, root: build(root) };
  if (hidden.length) layout.overlay = { tucks: [], folds: [], shown: {}, hidden };
  return layout;
}
