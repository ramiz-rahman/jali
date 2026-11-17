/**
 * Layout stability: every op declares what it may do to the geometry on screen.
 *  - focus:   nothing moves (focus edge, tab marks, peek).
 *  - swap:    what a slot shows changes; every rect stays the same (a tab chosen, a view put in place of another).
 *  - reshape: rects change; only deliberate gestures (drag, open beside, close, reset). Panes slide to their new place.
 *  - direct:  rects follow the pointer (a divider drag); never animated.
 * In development apply() checks focus and swap ops against the rects before and after, and reports a breach.
 *
 * Actions are pure: `(x: Snapshot, ...args) => Outcome`. One `apply()` commits an outcome: state, then URL, then
 * announcement, toast and DOM focus, as the POLICY table says for its op. Nothing that did not happen is written
 * or announced: an unchanged layout keeps its object, pushes no history and says nothing.
 */
import type { Layout, LayoutContext, NodeId, UndoEntry, ViewState } from "../../layout-core/types";
import type { WorkspaceModel } from "./model";
import type { UiState } from "./store";
import { pruneUndo } from "./undo";

/** What an action reads: the state, the model derived from it, and the core's context. */
export interface Snapshot {
  s: UiState;
  m: WorkspaceModel;
  ctx: LayoutContext;
}

export type HistoryMode = "push" | "replace" | "debounce" | "none";

export interface Toast { title: string; description?: string; undo?: boolean; error?: boolean }

export type Op =
  | "focus" | "zoom" | "peek" | "select" | "patch"
  | "open" | "split" | "openHere" | "focusExisting" | "dismiss" | "newTab" | "openFull"
  | "close" | "closeOthers" | "undo" | "tuck" | "putBack" | "reveal"
  | "merge" | "unmerge" | "tab" | "move" | "drop" | "swap"
  | "resize" | "resetSizes" | "preset" | "wide" | "arrive"
  | "hide" | "activate" | "page" | "mode" | "permission";

export type Geometry = "focus" | "swap" | "reshape" | "direct";

export interface Change {
  op: Op;
  layout?: Layout;
  view?: ViewState;
  msg?: string;
  /** The new undo stack. */
  undo?: UndoEntry[];
  patch?: Partial<UiState>;
  toast?: Toast;
  /** Move DOM focus into this pane after the next paint. */
  focusDom?: NodeId;
  /** What the action returns to its caller (the pane it opened, for example). */
  result?: NodeId;
  /** Overrides the op's geometry class when this instance does more (another item that also closes opened panes). */
  geometry?: Geometry;
}

/** An action that did not happen, and why (silent without `msg`). */
export interface Refusal { op: "refused"; msg?: string }
export const refuse = (msg?: string): Refusal => ({ op: "refused", msg });
export const isRefusal = (o: Outcome): o is Refusal => !!o && typeof o === "object" && "op" in o && o.op === "refused";

/** A change, a refusal, nothing, a step computed from the state the previous step left, or several in order. */
export type Outcome = Change | Refusal | null | undefined | ((x: Snapshot) => Outcome) | Outcome[];

interface Policy {
  /** "view" ops only touch the view (and patch); "layout" ops commit layout and view together. */
  writes: "view" | "layout";
  /** URL history for a layout change; for a view op, the URL write that always follows it. */
  history: HistoryMode;
  /** "layout": only when the layout changed. "change": when the layout or the focus changed. "always": view ops. */
  announceWhen: "layout" | "change" | "always";
  geometry: Geometry;
}

const view = (history: HistoryMode, geometry: Geometry = "focus"): Policy => ({ writes: "view", history, announceWhen: "always", geometry });
const layout = (history: HistoryMode, geometry: Geometry, announceWhen: "layout" | "change" = "layout"): Policy => ({ writes: "layout", history, announceWhen, geometry });

export const POLICY: Record<Op, Policy> = {
  focus: view("none"), patch: view("none"), zoom: view("replace", "reshape"), peek: view("replace"), select: view("replace"), permission: view("none"),
  // swap: content changes in place
  openHere: layout("push", "swap"), focusExisting: layout("push", "swap", "change"), reveal: layout("replace", "swap"), tab: layout("replace", "swap"),
  swap: layout("push", "swap"), activate: layout("push", "swap"), page: layout("push", "swap", "change"),
  // reshape: deliberate gestures
  open: layout("push", "reshape"), split: layout("push", "reshape"), dismiss: layout("push", "reshape"), newTab: layout("push", "reshape"), openFull: layout("push", "reshape"),
  close: layout("push", "reshape"), closeOthers: layout("push", "reshape"), undo: layout("push", "reshape"), tuck: layout("push", "reshape"), putBack: layout("push", "reshape"),
  merge: layout("push", "reshape"), unmerge: layout("push", "reshape"), move: layout("push", "reshape"), drop: layout("push", "reshape"), preset: layout("push", "reshape"),
  resetSizes: layout("replace", "reshape"), wide: layout("replace", "reshape"), arrive: layout("none", "reshape"),
  hide: layout("push", "reshape"), mode: layout("push", "reshape"),
  // direct: follows the pointer
  resize: layout("debounce", "direct"),
};

/** The geometry on screen: the set of rects, whoever fills them. Equal before and after a focus or swap op. */
export const geometryOf = (m: WorkspaceModel) => m.resolved.panes.filter((b) => !b.hidden).map((b) => `${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`).sort().join(" ");

/** Where apply() writes: the store's state and its effect sinks. */
export interface ApplyIO {
  get(): UiState;
  set(patch: Partial<UiState>): void;
  snapshot(): Snapshot;
  url(mode: HistoryMode): void;
  announce(text: string): void;
  toast(t: Toast): void;
  focus(id: NodeId): void;
  /** A focus or swap op that moved something: development reports it. */
  unstable?(op: Op, before: string, after: string): void;
}

const sameView = (a: ViewState, b: ViewState) => a.focused === b.focused && a.zoomed === b.zoomed && a.peek === b.peek;

/** Commit an outcome. Returns the last step's `result`. */
export function apply(io: ApplyIO, o: Outcome): NodeId | undefined {
  if (!o) return undefined;
  if (typeof o === "function") return apply(io, o(io.snapshot()));
  if (Array.isArray(o)) return o.reduce<NodeId | undefined>((_, step) => apply(io, step), undefined);
  if (o.op === "refused") {
    if (o.msg) io.announce(o.msg);
    return undefined;
  }
  const s = io.get(), p = POLICY[o.op];
  const next = { layout: o.layout ?? s.layout, view: o.view ?? s.view };
  if (p.writes === "view") {
    if (next.view !== s.view || o.patch) io.set({ view: next.view, ...o.patch });
    io.url(p.history);
    if (o.msg) io.announce(o.msg);
  } else {
    const layoutChanged = next.layout !== s.layout, viewChanged = !sameView(next.view, s.view);
    const geometry = o.geometry ?? p.geometry;
    const check = layoutChanged && io.unstable && (geometry === "focus" || geometry === "swap") ? geometryOf(io.snapshot().m) : null;
    if (layoutChanged || viewChanged || o.patch || o.undo) {
      // A reshape is counted, so the workspace can let panes slide to their new place.
      const motion = layoutChanged && geometry === "reshape" ? { reshapes: s.reshapes + 1 } : {};
      io.set({ layout: next.layout, view: layoutChanged || viewChanged ? next.view : s.view, ...o.patch, ...motion, undoStack: pruneUndo(o.undo ?? s.undoStack, next.layout) });
      if (check !== null) { const after = geometryOf(io.snapshot().m); if (after !== check) io.unstable!(o.op, check, after); }
      io.url(layoutChanged ? p.history : viewChanged ? "replace" : "none");
      if (o.msg && (layoutChanged || (p.announceWhen === "change" && viewChanged))) io.announce(o.msg);
      if (o.toast && layoutChanged) io.toast(o.toast);
    }
  }
  if (o.focusDom) io.focus(o.focusDom);
  return o.result;
}
