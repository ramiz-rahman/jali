/**
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
  | "hide" | "show" | "activate" | "arrange" | "permission";

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
}

const view = (history: HistoryMode): Policy => ({ writes: "view", history, announceWhen: "always" });
const layout = (history: HistoryMode, announceWhen: "layout" | "change" = "layout"): Policy => ({ writes: "layout", history, announceWhen });

export const POLICY: Record<Op, Policy> = {
  focus: view("none"), patch: view("none"), zoom: view("replace"), peek: view("replace"), select: view("replace"),
  open: layout("push"), split: layout("push"), openHere: layout("push"), focusExisting: layout("push", "change"),
  dismiss: layout("push"), newTab: layout("push"), openFull: layout("push"),
  close: layout("push"), closeOthers: layout("push"), undo: layout("push"), tuck: layout("push"), putBack: layout("push"),
  merge: layout("push"), unmerge: layout("push"), move: layout("push"), drop: layout("push"), swap: layout("push"), preset: layout("push"),
  reveal: layout("replace"), tab: layout("replace"), resetSizes: layout("replace"), wide: layout("replace"),
  resize: layout("debounce"), arrive: layout("none"),
  hide: layout("push"), show: layout("push"), activate: layout("push"), arrange: layout("push"), permission: view("none"),
};

/** Where apply() writes: the store's state and its effect sinks. */
export interface ApplyIO {
  get(): UiState;
  set(patch: Partial<UiState>): void;
  snapshot(): Snapshot;
  url(mode: HistoryMode): void;
  announce(text: string): void;
  toast(t: Toast): void;
  focus(id: NodeId): void;
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
    if (layoutChanged || viewChanged || o.patch || o.undo) {
      io.set({ layout: next.layout, view: layoutChanged || viewChanged ? next.view : s.view, ...o.patch, undoStack: pruneUndo(o.undo ?? s.undoStack, next.layout) });
      io.url(layoutChanged ? p.history : viewChanged ? "replace" : "none");
      if (o.msg && (layoutChanged || (p.announceWhen === "change" && viewChanged))) io.announce(o.msg);
      if (o.toast && layoutChanged) io.toast(o.toast);
    }
  }
  if (o.focusDom) io.focus(o.focusDom);
  return o.result;
}
