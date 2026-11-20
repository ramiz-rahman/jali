/** Framework-free layout model. The tree is canonical; hiding and tab selection are overlays. */
export type NodeId = string;
export type Axis = "row" | "column";
export type Edge = "left" | "right" | "top" | "bottom";
/** Reading direction. Right to left, a row lays its children out from the right; the tree is the same. */
export type Direction = "ltr" | "rtl";
export type Size = { px: number } | { weight: number };
export interface ObjectRef {
  kind: string;
  params: Record<string, string | number | boolean>;
}
interface NodeBase {
  id: NodeId;
  size: Size;
  userSized?: boolean;
  /** Reset preference, carried through edits and the URL instead of remembered by a core instance. */
  base?: Size;
}
export interface PaneNode extends NodeBase {
  type: "pane";
  ref: ObjectRef;
  /** The pane this one was opened from. Closing that pane drops the link. */
  linkedTo?: NodeId;
  /**
   * Linked selection: this pane shows the object selected in `linkedTo` (a detail opened from a list's row). When the
   * list's selection moves, the object is replaced in place (`follow`). At most one follower per source and kind.
   */
  follows?: boolean;
  /** Kept by the person: never reused for another object, never following, and the last to fold. */
  kept?: boolean;
  /** A pinned tab: first in its tab group, and left open by Close other tabs and Close tabs to the right. It stays
   *  pinned when it leaves a group, so it is pinned again if it joins one. */
  pinned?: boolean;
  /** Monotonic age; imported panes without an age precede newly opened panes in reading order. */
  born?: number;
  /** The place this pane fills in a designed arrangement ("borrower"). Panes without a role were opened by the person. */
  role?: string;
  /** Fold priority. Supporting panes give way first when room runs out; a primary pane never folds while another can. */
  priority?: "primary" | "supporting";
}
export interface StackNode extends NodeBase {
  type: "stack";
  children: PaneNode[];
  active: NodeId;
  /** Optional; "user" is the only value (a stack the person or the app made). */
  origin?: "user";
}
export interface SplitNode extends NodeBase {
  type: Axis;
  children: LayoutNode[];
  /**
   * A row that scrolls sideways (rows only): its children keep their own widths (a person's px size, else their
   * comfortable width) and the row scrolls to the rest, instead of sharing its width and folding what doesn't fit.
   * To its parent it needs one child's room; to the pane cap it is one slot. See docs/research/scrolling-rows.md.
   */
  scroll?: "x";
}
export type LayoutNode = PaneNode | StackNode | SplitNode;
export interface TuckRecord {
  pane: NodeId;
  home: NodeId;
  seq: number;
}
export interface Overlay {
  tucks: TuckRecord[];
  /** Slots folded in order. Group ids are opaque to consumers. */
  folds: NodeId[];
  /** Chosen tab, keyed by the stable home pane of the projected group. */
  shown: Record<NodeId, NodeId>;
  /** Panes taken off screen entirely (no tab, no slot); their neighbours absorb the space. Showing drops the id. */
  hidden?: NodeId[];
}
export interface Layout {
  version: 1;
  root: LayoutNode;
  overlay?: Overlay;
}
export interface ViewState {
  focused?: NodeId;
  zoomed?: NodeId;
  /** How far each row that scrolls has scrolled, by its id, in px along its content (geometry/scroll.ts). */
  scroll?: Record<NodeId, number>;
  peek?: ObjectRef;
  focusHistory: NodeId[];
}
export interface PaneKind {
  kind: string;
  title(ref: ObjectRef): string;
  /**
   * Pane sizing: minimum, comfortable, max. Widths are px along a row.
   * - `minWidth`: the narrowest the content still works at. Below it the pane folds into a tab; never shrunk past it.
   * - `comfortableWidth`: where spare space takes the pane first, before any sibling grows past its own. Default: min.
   * - `maxWidth`: the widest the content usefully uses. Spare space past it goes to siblings that can still use it;
   *   only when every sibling is at its max does the pane grow on (a split never leaves a void), and the content
   *   holds its measure (the pane content contract). Default: unbounded.
   * The share rule applies to splits nobody has sized; a split the person sized keeps its proportions exactly.
   */
  minWidth: number;
  minHeight: number;
  comfortableWidth?: number;
  maxWidth?: number;
  /** What is wrong with a ref's params for this kind (a required param missing, a value its type can't read), or
   *  undefined when nothing is. A layout holding such a ref is invalid, so a link to it opens as broken. */
  checkParams?(params: ObjectRef["params"]): string | undefined;
}
export type KindRegistry = Record<string, PaneKind>;
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** `hidden`: behind another tab, behind a zoomed pane, or "off" (hidden by the overlay: no slot, no tab). */
export interface PaneBox {
  id: NodeId;
  rect: Rect;
  stackId?: NodeId;
  hidden?: "tab" | "zoom" | "off";
  /** In a row that scrolls, once scrolled (`scrolled`): the strip's window, which the pane is cut to. */
  clip?: Rect;
}
export interface DividerBox {
  /** In a row that scrolls, once scrolled: the strip's window. */
  clip?: Rect;
  parentId: NodeId;
  index: number;
  axis: Axis;
  rect: Rect;
  min: number;
  max: number;
  value: number;
  neighbours?: [NodeId[], NodeId[]];
}
export interface ShelfEntry {
  paneId: NodeId;
  homeId: NodeId;
  stackId: NodeId;
  reason: "tucked" | "folded" | "tab";
}
export interface ResolvedStack {
  id: NodeId;
  kind: "fold" | "tuck";
  homeId: NodeId;
  paneIds: NodeId[];
}
/**
 * A row that scrolls sideways, as drawn: `rect` is its window on screen, and its panes' rects are laid along its
 * content, from `rect.x` to `rect.x + contentWidth` (unscrolled). A renderer scrolls that content inside `rect`.
 */
export interface ScrollerBox {
  id: NodeId;
  rect: Rect;
  contentWidth: number;
  /** Its panes, in reading order. */
  paneIds: NodeId[];
}
export interface ResolvedLayout {
  panes: PaneBox[];
  dividers: DividerBox[];
  stacks: ResolvedStack[];
  /** Rows that scroll sideways, outermost first. */
  scrollers: ScrollerBox[];
  /** Single source for hidden-pane reasons; zoom does not change the shelf. */
  shelf: ShelfEntry[];
}
export interface FitOptions {
  width: number;
  height: number;
  gap: number;
  kinds: KindRegistry;
}
export interface LayoutContext {
  fit: FitOptions;
  paneCap: number;
  /** Reading direction. "rtl" mirrors the geometry (rects are screen coordinates); the tree is the same. Default
   *  "ltr". */
  dir?: Direction;
}
export type OpenResult = {
  layout: Layout;
  view: ViewState;
  opened: NodeId;
  mode: "beside" | "replaced" | "tab";
};
export type HideRefusal = "missing" | "hidden" | "last";
export type HideResult =
  | { ok: true; layout: Layout; view: ViewState }
  | { ok: false; reason: HideRefusal };
export interface UndoEntry {
  kind: "close" | "closeOthers" | "tuck";
  before: { layout: Layout; view: ViewState };
  tucked?: NodeId;
}
export type TuckRefusal = "missing" | "tab" | "hidden" | "last";
export type TuckCheck = { ok: true; home: NodeId } | { ok: false; reason: TuckRefusal };
export type TuckResult =
  | { ok: true; layout: Layout; view: ViewState; home: NodeId; undo: UndoEntry }
  | { ok: false; reason: TuckRefusal };
export type PutBackResult =
  | { ok: true; layout: Layout; view: ViewState; home: NodeId }
  | { ok: false; reason: "missing" | "not-tucked" };
