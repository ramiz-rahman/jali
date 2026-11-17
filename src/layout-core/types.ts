/**
 * Pane lab: the layout-core contract. Framework-free; no React imports anywhere in src/layout-core.
 * Spec: /Users/ramizrahman/Projects/Sixface-Initiate/workspaces/2026-11-16-sixface-design-system/pane-interaction-spec.md
 * The coordinator wrote this file. Implementers may ADD to it but must not change existing signatures without noting it in docs/DECISIONS.md.
 */

export type NodeId = string;
export type Axis = "row" | "column";
export type Edge = "left" | "right" | "top" | "bottom";

/** Size of a node along its parent's axis: fixed px, or a weight share of what fixed siblings leave (herdr-app model). */
export type Size = { px: number } | { weight: number };

/** What a pane shows. `kind` names a registered PaneKind; `params` identify the object (e.g. { table: "orders", id: 789 }). */
export interface ObjectRef {
  kind: string;
  params: Record<string, string | number>;
}

interface NodeBase {
  id: NodeId;
  size: Size;
  /** Set when the person dragged this node's divider; autobalance never overrides it. */
  userSized?: boolean;
}

export interface PaneNode extends NodeBase {
  type: "pane";
  ref: ObjectRef;
  /** The pane this one follows (linked selection), if any. */
  linkedTo?: NodeId;
  pinned?: boolean;
  /**
   * Set while the pane is tucked: it left its split and is a tab of its home (17 Nov, replaces minimise/collapse).
   * Records the slot it came from so `putBack` restores it exactly. Cleared by putBack and by any deliberate move.
   */
  tuckedFrom?: TuckOrigin;
}

/** Where a tucked pane sat, so `putBack` can restore it to the same slot at the same size. */
export interface TuckOrigin {
  /** The split it left, and that split's axis. */
  parent: NodeId;
  axis: Axis;
  /** Its index among the split's children before the tuck. */
  index: number;
  /** The sibling it sat beside (a pane, stack or split id; matched by containment, so a home turned stack still counts) and which side of it. */
  beside: NodeId;
  side: "before" | "after";
  /** Its own size and userSized in the split. */
  size: Size;
  userSized?: boolean;
  /** The pane it was tucked into (the visible pane of its home at the time). */
  home: NodeId;
  /** Its extent in px along the split axis when tucked, if geometry was known. Used when sizes changed since. */
  extent?: number;
  /** Siblings whose size the tuck changed, as [id, before, after]. putBack restores `before` where `after` is still in place. */
  resized?: [NodeId, Size, Size][];
  /** Tuck sequence: larger means tucked later. Put back uses it with `order` to restore the original relative order of panes tucked from one split. */
  seq?: number;
  /** The split's children at the moment of the tuck, itself included, each named by its first pane's id (stable when a child later becomes a stack). */
  order?: NodeId[];
}

export interface StackNode extends NodeBase {
  type: "stack";
  children: PaneNode[];
  active: NodeId;
  /**
   * "auto": legacy materialised fold (folds now live in `Layout.fold`). "user": deliberate (centre drop / tab).
   * "tuck": created by a tuck; dissolves back into its single pane when the last tucked pane is put back.
   * A deliberate tab added to a "tuck" stack makes it "user".
   */
  origin: "auto" | "user" | "tuck";
  /** Axis to restore when an automatic stack unfolds. Defaults to its parent's axis, or row. */
  axis?: Axis;
}

export interface SplitNode extends NodeBase {
  type: "row" | "column";
  children: LayoutNode[];
}

export type LayoutNode = PaneNode | StackNode | SplitNode;

/** Structure: shareable by URL and saved per user per view. */
export interface Layout {
  version: 1;
  root: LayoutNode;
  /** Folds the collapse plan has made, recorded so they are sticky (added 17 Nov; see DECISIONS). The tree stays canonical. */
  fold?: FoldState;
}

/**
 * Sticky folding. Folds are decided only on a structural or size change (`LayoutCore.refit`), never on focus, tab
 * activation or zoom, and recorded here so `resolve()` is a pure function of layout plus size.
 */
export interface FoldState {
  /** Displayed slots folded so far, in fold order: pane ids, deliberate stack ids or `@auto:<home>` group ids. Unfolding pops from the end. */
  order: NodeId[];
  /** The shown tab of each automatic stack, keyed by the stack's home pane. Absent: the home is shown. */
  active?: Record<NodeId, NodeId>;
}

/** View: personal, per screen. */
export interface ViewState {
  focused?: NodeId;
  zoomed?: NodeId;
  peek?: ObjectRef;
  /** Focus history, most recent first (for directional focus tie-breaks and close-focus return). */
  focusHistory: NodeId[];
}

export interface PaneKind {
  kind: string;
  title(ref: ObjectRef): string;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  preferredWidth?: number;
  /** Heavy panes hold their content during a divider drag and reflow on release. */
  heavy?: boolean;
}

export type KindRegistry = Record<string, PaneKind>;

/** Resolved geometry for rendering and hit-testing. */
export interface Rect { x: number; y: number; width: number; height: number }
export interface PaneBox { id: NodeId; rect: Rect; stackId?: NodeId; hiddenInStack?: boolean }
export interface DividerBox {
  parentId: NodeId; index: number; axis: Axis; rect: Rect; min: number; max: number; value: number;
  /** Pane ids on each side, including tabs. Fit can group several original siblings at one divider. */
  neighbours?: [NodeId[], NodeId[]];
}
export interface ResolvedLayout {
  panes: PaneBox[];
  dividers: DividerBox[];
  /** Panes the fit step folded into auto stacks, for announcements ("Opened as a tab: not enough room"). */
  folded: NodeId[];
  /** Automatic stacks the fit step created, for labels such as "+2 folded". Deliberate (user) stacks are not listed. */
  stacks: ResolvedStack[];
  /** Every pane not currently on screen (zoom aside), in reading order. See ShelfEntry. */
  shelf: ShelfEntry[];
}
/**
 * A pane that is not on screen. Reason, in precedence order: "tucked" (it has `tuckedFrom`), "folded" (the fit step
 * hid it in an automatic stack), "tab" (an inactive tab of a deliberate or tuck stack). Zoom does not put panes on the shelf.
 */
export interface ShelfEntry {
  paneId: NodeId;
  /** The pane on screen in the place this one lives (the visible tab of its group): "behind <home>". */
  homeId: NodeId;
  /** The group it is a tab of (PaneBox.stackId): a tree stack id or an `@auto:<home>` id. */
  stackId: NodeId;
  reason: "tucked" | "folded" | "tab";
  /** Filled by the UI store (`shelfEntries()`), never by layout-core. */
  activity?: string;
}
export interface ResolvedStack {
  /** Same as PaneBox.stackId for its panes. */
  id: NodeId;
  origin: "auto";
  /** The pane the group formed around: the source the folded panes are linked from (or the nearest neighbour). */
  homeId: NodeId;
  /** Panes folded into the home's group (tabs other than the home). */
  foldedCount: number;
  paneIds: NodeId[];
}

export interface FitOptions {
  width: number;
  height: number;
  gap: number; // 6
  kinds: KindRegistry;
}

export type OpenResult = { layout: Layout; view: ViewState; opened: NodeId; mode: "beside" | "replaced" | "tab" };

/** Every mutation returns a new Layout (immutable) and records an undo entry when structural. */
export interface LayoutOps {
  /** "Open beside" from `source`: replaces the linked pane of the same kind if one exists, else splits beside (right). Falls back to a tab when it would not fit. Focus stays on source by default (founder, 17 Nov). */
  openBeside(layout: Layout, view: ViewState, source: NodeId, ref: ObjectRef, fit: FitOptions): OpenResult;
  split(layout: Layout, view: ViewState, target: NodeId, edge: Edge, ref: ObjectRef, fit: FitOptions): OpenResult;
  close(layout: Layout, view: ViewState, target: NodeId): { layout: Layout; view: ViewState; undo: UndoEntry };
  closeOthers(layout: Layout, view: ViewState, keep: NodeId): { layout: Layout; view: ViewState; undo: UndoEntry };
  /** Centre drop. Mode is a setting under test (founder: swap may feel more natural). */
  drop(layout: Layout, view: ViewState, dragged: NodeId, target: NodeId, zone: Edge | "centre", centreMode: "swap" | "tab"): { layout: Layout; view: ViewState };
  swap(layout: Layout, a: NodeId, b: NodeId): Layout;
  moveDirection(layout: Layout, view: ViewState, pane: NodeId, dir: Edge, fit: FitOptions): { layout: Layout; view: ViewState };
  /** Divider drag or keyboard. `sizes` are px for the two neighbours; clamps at minimums; marks userSized. */
  resizeDivider(layout: Layout, parentId: NodeId, index: number, deltaPx: number, fit: FitOptions): Layout;
  resetDivider(layout: Layout, parentId: NodeId, index: number): Layout;
  /**
   * Whether `pane` can be tucked, and the home it would join. Refusals: "missing" (no such pane), "tab" (already a tab
   * of a stack), "hidden" (not on screen), "last" (the last pane on screen). Without `fit`, visibility is not checked.
   */
  canTuck(layout: Layout, pane: NodeId, fit?: FitOptions): TuckCheck;
  /**
   * Tuck: the pane leaves its split and becomes a tab of its home (its source if visible beside it, else the nearest
   * previous sibling, else the next). The home keeps its shown tab; its slot absorbs the vacated space, so every other
   * rect stays. Records `tuckedFrom`. Never refits. `view` focuses the home pane.
   */
  tuck(layout: Layout, view: ViewState, pane: NodeId, fit?: FitOptions): TuckResult;
  /**
   * Put back: restores a tucked pane to its origin slot at its original size, or beside its home on the side it came
   * from when the origin is gone. A "tuck" stack left with one tab dissolves. `view` focuses the pane. The caller
   * refits "fold" (putting back never unfolds anything).
   */
  putBack(layout: Layout, view: ViewState, pane: NodeId, fit?: FitOptions): PutBackResult;
  toggleZoom(view: ViewState, pane: NodeId): ViewState;
  focus(view: ViewState, pane: NodeId): ViewState;
  /** Directional focus: strictly in direction, overlapping on the other axis; most-recently-focused wins, then nearest edge, overlap, centre, order. No wrap. */
  focusDirection(view: ViewState, resolved: ResolvedLayout, dir: Edge): ViewState;
  focusCycle(view: ViewState, resolved: ResolvedLayout, delta: 1 | -1): ViewState;
  /** Selects a tab of a deliberate stack, or of an automatic stack (`@auto:<home>` id from ResolvedStack). Nothing else moves. */
  setActiveTab(layout: Layout, stack: NodeId, pane: NodeId): Layout;
  resetLayout(preset: Layout): Layout;
}

export interface UndoEntry {
  label: string; // "Pane closed" | "Pane tucked"
  before: { layout: Layout; view: ViewState };
  /** For a tuck: the tucked pane. Undo puts it back (exact when nothing changed since) rather than restoring `before`. */
  tucked?: NodeId;
}

export type TuckRefusal = "missing" | "tab" | "hidden" | "last";
export type TuckCheck = { ok: true; home: NodeId } | { ok: false; reason: TuckRefusal };
export type TuckResult =
  | { ok: true; layout: Layout; view: ViewState; home: NodeId; undo: UndoEntry }
  | { ok: false; reason: TuckRefusal };
export type PutBackResult =
  | { ok: true; layout: Layout; view: ViewState; restored: "origin" | "beside"; home: NodeId }
  | { ok: false; reason: "missing" | "not-tucked" };

export interface LayoutCore extends LayoutOps {
  /**
   * Resolve sizes (herdr-app flex solve with min/max freeze) and apply the folds recorded in `layout.fold`. A pure
   * function of layout plus size: `view` only places the zoom overlay, so focus never moves or folds a pane. If the
   * recorded folds do not fit (not yet refitted), it folds further by a focus-free rule rather than squeeze.
   */
  resolve(layout: Layout, view: ViewState, fit: FitOptions): ResolvedLayout;
  /**
   * Decide folds for this size and record them in `layout.fold`; returns the same object when nothing changes. Call it on
   * structural and size changes only. "full" also unfolds, most recent fold first, when room returns; "fold" never
   * unfolds (putting back a tucked pane); "load" (link, reload, Back) behaves like "full". Unfolding is judged as if
   * every tucked pane were back in its slot, so a tuck never unfolds anything. The focused pane, its source and direct details are protected when choosing.
   */
  refit(layout: Layout, view: ViewState, fit: FitOptions, mode?: "full" | "fold" | "load"): Layout;
  /** Compact, URL-safe, versioned. decode() validates and returns null on anything invalid (caller falls back to preset, keeps a copy). */
  encode(layout: Layout): string;
  decode(text: string, kinds: KindRegistry): Layout | null;
  validate(layout: Layout, kinds: KindRegistry): { ok: true } | { ok: false; errors: string[] };
}

/** Cap on simultaneously displayed pane slots; tabs retain their objects and state. */
export interface LayoutCoreOptions { paneCap?: number }
