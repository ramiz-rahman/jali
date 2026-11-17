/** Framework-free layout model. The tree is canonical; hiding and tab selection are overlays. */
export type NodeId = string;
export type Axis = "row" | "column";
export type Edge = "left" | "right" | "top" | "bottom";
export type Size = { px: number } | { weight: number };
export interface ObjectRef { kind: string; params: Record<string, string | number> }
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
  linkedTo?: NodeId;
  pinned?: boolean;
  /** Monotonic age; imported panes without an age precede newly opened panes in reading order. */
  born?: number;
}
export interface StackNode extends NodeBase {
  type: "stack";
  children: PaneNode[];
  active: NodeId;
  origin: "user";
}
export interface SplitNode extends NodeBase { type: Axis; children: LayoutNode[] }
export type LayoutNode = PaneNode | StackNode | SplitNode;
export interface TuckRecord { pane: NodeId; home: NodeId; seq: number }
export interface Overlay {
  tucks: TuckRecord[];
  /** Slots folded in order. Group ids are opaque to consumers. */
  folds: NodeId[];
  /** Chosen tab, keyed by the stable home pane of the projected group. */
  shown: Record<NodeId, NodeId>;
}
export interface Layout { version: 1; root: LayoutNode; overlay?: Overlay }
export interface ViewState {
  focused?: NodeId;
  zoomed?: NodeId;
  peek?: ObjectRef;
  focusHistory: NodeId[];
}
export interface PaneKind {
  kind: string;
  title(ref: ObjectRef): string;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  preferredWidth?: number;
}
export type KindRegistry = Record<string, PaneKind>;
export interface Rect { x: number; y: number; width: number; height: number }
export interface PaneBox { id: NodeId; rect: Rect; stackId?: NodeId; hidden?: "tab" | "zoom" }
export interface DividerBox {
  parentId: NodeId; index: number; axis: Axis; rect: Rect; min: number; max: number; value: number;
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
export interface ResolvedLayout {
  panes: PaneBox[];
  dividers: DividerBox[];
  stacks: ResolvedStack[];
  /** Single source for hidden-pane reasons; zoom does not change the shelf. */
  shelf: ShelfEntry[];
}
export interface FitOptions { width: number; height: number; gap: number; kinds: KindRegistry }
export interface LayoutContext { fit: FitOptions; paneCap: number }
export type OpenResult = { layout: Layout; view: ViewState; opened: NodeId; mode: "beside" | "replaced" | "tab" };
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
