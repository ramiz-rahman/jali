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
  /** Minimised: edge panes fold to a rail, middle panes to their header. Still mounted, still reporting activity. */
  collapsed?: boolean;
}

export interface StackNode extends NodeBase {
  type: "stack";
  children: PaneNode[];
  active: NodeId;
  /** "auto": created by the collapse plan and unfolds when room returns. "user": deliberate (centre drop / tab). */
  origin: "auto" | "user";
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
  setCollapsed(layout: Layout, pane: NodeId, collapsed: boolean): Layout;
  toggleZoom(view: ViewState, pane: NodeId): ViewState;
  focus(view: ViewState, pane: NodeId): ViewState;
  /** Directional focus: strictly in direction, overlapping on the other axis; most-recently-focused wins, then nearest edge, overlap, centre, order. No wrap. */
  focusDirection(view: ViewState, resolved: ResolvedLayout, dir: Edge): ViewState;
  focusCycle(view: ViewState, resolved: ResolvedLayout, delta: 1 | -1): ViewState;
  setActiveTab(layout: Layout, stack: NodeId, pane: NodeId): Layout;
  resetLayout(preset: Layout): Layout;
}

export interface UndoEntry {
  label: string; // "Pane closed"
  before: { layout: Layout; view: ViewState };
}

export interface LayoutCore extends LayoutOps {
  /** Resolve sizes (herdr-app flex solve with min/max freeze), then apply the collapse plan: fold auto-stacks when minimums + gaps don't fit; unfold auto-stacks when room returns. Never squeezes below a minimum. */
  resolve(layout: Layout, view: ViewState, fit: FitOptions): ResolvedLayout;
  /** Compact, URL-safe, versioned. decode() validates and returns null on anything invalid (caller falls back to preset, keeps a copy). */
  encode(layout: Layout): string;
  decode(text: string, kinds: KindRegistry): Layout | null;
  validate(layout: Layout, kinds: KindRegistry): { ok: true } | { ok: false; errors: string[] };
}

/** Cap on simultaneously displayed pane slots; tabs retain their objects and state. */
export interface LayoutCoreOptions { paneCap?: number }
