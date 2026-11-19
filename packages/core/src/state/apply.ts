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
 *
 * Timing is declared, not hidden: a change may carry a `defer`red step (keyed; a newer step with the same key replaces
 * or cancels it). The store runs it after `ms` against the state at that moment. Linked selection uses it: a list's
 * detail follows the selection once it rests (actions/follow.ts).
 */
import * as core from "../layout";
import type { Env } from "../profile";
import { msg } from "./messages";
import type { Layout, LayoutContext, NodeId, UndoEntry, ViewState } from "../layout/types";
import type { JaliModel } from "./model";
import type { UiState } from "./store";
import { pruneUndo } from "./undo";

/** What an action reads: the state, the model derived from it, and the core's context. */
export interface Snapshot {
  s: UiState;
  m: JaliModel;
  ctx: LayoutContext;
  /** The workspace's pane kinds and profile. */
  env: Env;
}

export type HistoryMode = "push" | "replace" | "debounce" | "none";

export interface Toast {
  title: string;
  description?: string;
  undo?: boolean;
  error?: boolean;
}

/** A step to run later. The latest step for a key wins; without `run` it cancels the pending one. */
export interface Deferred {
  key: string;
  ms: number;
  run?: (x: Snapshot) => Outcome;
}

export type Op =
  | "focus"
  | "zoom"
  | "peek"
  | "select"
  | "patch"
  | "open"
  | "split"
  | "openHere"
  | "focusExisting"
  | "dismiss"
  | "newTab"
  | "openFull"
  | "close"
  | "closeOthers"
  | "undo"
  | "tuck"
  | "putBack"
  | "reveal"
  | "merge"
  | "unmerge"
  | "tab"
  | "move"
  | "drop"
  | "swap"
  | "resize"
  | "resetSizes"
  | "preset"
  | "wide"
  | "arrive"
  | "hide"
  | "activate"
  | "page"
  | "mode"
  | "permission"
  | "follow"
  | "pin";

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
  /** A step to run later (debounced by key): see the header. */
  defer?: Deferred;
}

/** An action that did not happen, and why (silent without `msg`). */
export interface Refusal {
  op: "refused";
  msg?: string;
}
export const refuse = (msg?: string): Refusal => ({ op: "refused", msg });
export const isRefusal = (o: Outcome): o is Refusal =>
  !!o && typeof o === "object" && "op" in o && o.op === "refused";

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

const view = (history: HistoryMode, geometry: Geometry = "focus"): Policy => ({
  writes: "view",
  history,
  announceWhen: "always",
  geometry,
});
const layout = (
  history: HistoryMode,
  geometry: Geometry,
  announceWhen: "layout" | "change" = "layout",
): Policy => ({ writes: "layout", history, announceWhen, geometry });

export const POLICY: Record<Op, Policy> = {
  focus: view("none"),
  patch: view("none"),
  zoom: view("replace", "reshape"),
  peek: view("replace"),
  select: view("replace"),
  permission: view("none"),
  // swap: content changes in place
  openHere: layout("push", "swap"),
  focusExisting: layout("push", "swap", "change"),
  reveal: layout("replace", "swap"),
  tab: layout("replace", "swap"),
  swap: layout("push", "swap"),
  activate: layout("push", "swap"),
  page: layout("push", "swap", "change"),
  // A list's detail follows its selection in place; history is replaced, so Back skips the rows passed through.
  follow: layout("replace", "swap"),
  // Pin or unpin a linked detail: a flag on the pane, nothing moves.
  pin: layout("replace", "focus"),
  // reshape: deliberate gestures
  open: layout("push", "reshape"),
  split: layout("push", "reshape"),
  dismiss: layout("push", "reshape"),
  newTab: layout("push", "reshape"),
  openFull: layout("push", "reshape"),
  close: layout("push", "reshape"),
  closeOthers: layout("push", "reshape"),
  undo: layout("push", "reshape"),
  tuck: layout("push", "reshape"),
  putBack: layout("push", "reshape"),
  merge: layout("push", "reshape"),
  unmerge: layout("push", "reshape"),
  move: layout("push", "reshape"),
  drop: layout("push", "reshape"),
  preset: layout("push", "reshape"),
  resetSizes: layout("replace", "reshape"),
  wide: layout("replace", "reshape"),
  arrive: layout("none", "reshape"),
  hide: layout("push", "reshape"),
  mode: layout("push", "reshape"),
  // direct: follows the pointer
  resize: layout("debounce", "direct"),
};

/** The geometry on screen: the set of rects, whoever fills them. Equal before and after a focus or swap op. */
export const geometryOf = (m: JaliModel) =>
  m.resolved.panes
    .filter((b) => !b.hidden)
    .map((b) => `${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`)
    .sort()
    .join(" ");

/** Where apply() writes: the store's state and its effect sinks. */
export interface ApplyIO {
  get(): UiState;
  set(patch: Partial<UiState>): void;
  snapshot(): Snapshot;
  url(mode: HistoryMode): void;
  announce(text: string): void;
  toast(t: Toast): void;
  focus(id: NodeId): void;
  /** Schedule (or cancel) a deferred step. Without a scheduler, deferred steps are dropped. */
  defer?(d: Deferred): void;
  /** A focus or swap op that moved something: development reports it. */
  unstable?(op: Op, before: string, after: string): void;
}

/**
 * Panes with unsaved work that `next` would remove or point at another object: their content would unmount and the
 * work would be lost. A pane moved, tabbed, folded, tucked or hidden stays mounted, so it keeps its work.
 */
export function wouldLoseWork(s: UiState, next: Layout): NodeId[] {
  const dirty = Object.keys(s.unsaved);
  if (!dirty.length || next === s.layout) return [];
  const before = new Map(core.tree.panes(s.layout.root).map((p) => [p.id, p]));
  const after = new Map(core.tree.panes(next.root).map((p) => [p.id, p]));
  return dirty.filter((id) => {
    const a = before.get(id),
      b = after.get(id);
    return !!a && (!b || JSON.stringify(a.ref) !== JSON.stringify(b.ref));
  });
}

/**
 * Per-pane records for panes still in the layout or in an undo entry (an undo brings the pane back). A pane that now
 * shows another object starts afresh: its state was about the object it showed.
 */
function prunePanes(s: UiState, layout: Layout, undo: UndoEntry[]): Partial<UiState> {
  const was = new Map(core.tree.panes(s.layout.root).map((p) => [p.id, JSON.stringify(p.ref)]));
  const moved = new Set(
    core.tree
      .panes(layout.root)
      .filter((p) => was.has(p.id) && was.get(p.id) !== JSON.stringify(p.ref))
      .map((p) => p.id),
  );
  const ids = new Set(
    core.tree
      .panes(layout.root)
      .filter((p) => !moved.has(p.id))
      .map((p) => p.id),
  );
  for (const e of undo) for (const p of core.tree.panes(e.before.layout.root)) ids.add(p.id);
  const keep = <T>(r: Record<NodeId, T>) =>
    Object.keys(r).every((id) => ids.has(id))
      ? r
      : Object.fromEntries(Object.entries(r).filter(([id]) => ids.has(id)));
  // Unsaved work, commands and activity belong to mounted content; state also survives in the undo stack.
  // The same content stays mounted when its object changes, so these go only with the pane.
  const live = new Set(core.tree.panes(layout.root).map((p) => p.id));
  const mounted = <T>(r: Record<NodeId, T>) =>
    Object.keys(r).every((id) => live.has(id))
      ? r
      : Object.fromEntries(Object.entries(r).filter(([id]) => live.has(id)));
  // A title from data names the object it was set for: it goes when the pane shows another.
  const named = Object.keys(s.titles).every((id) => live.has(id) && !moved.has(id))
    ? s.titles
    : Object.fromEntries(Object.entries(s.titles).filter(([id]) => live.has(id) && !moved.has(id)));
  return {
    paneState: keep(s.paneState),
    unsaved: mounted(s.unsaved),
    paneCommands: mounted(s.paneCommands),
    activity: mounted(s.activity),
    titles: named,
  };
}

const sameView = (a: ViewState, b: ViewState) =>
  a.focused === b.focused && a.zoomed === b.zoomed && a.peek === b.peek;

/** Commit an outcome. Returns the last step's `result`. */
export function apply(io: ApplyIO, o: Outcome): NodeId | undefined {
  if (!o) return undefined;
  if (typeof o === "function") return apply(io, o(io.snapshot()));
  if (Array.isArray(o))
    return o.reduce<NodeId | undefined>((_, step) => apply(io, step), undefined);
  if (o.op === "refused") {
    if (o.msg) io.announce(o.msg);
    return undefined;
  }
  const s = io.get(),
    p = POLICY[o.op];
  const next = { layout: o.layout ?? s.layout, view: o.view ?? s.view };
  if (p.writes === "view") {
    if (next.view !== s.view || o.patch) io.set({ view: next.view, ...o.patch });
    io.url(p.history);
    if (o.msg) io.announce(o.msg);
  } else {
    const layoutChanged = next.layout !== s.layout,
      viewChanged = !sameView(next.view, s.view);
    // Unsaved work is never lost without asking. A following detail keeps its object instead (it moves on its own
    // while the person browses the list: a question each time would be worse).
    const losing = layoutChanged ? wouldLoseWork(s, next.layout) : [];
    if (losing.length) {
      if (o.op === "follow") return apply(io, refuse(msg.keptUnsaved(s.unsaved[losing[0]!]!)));
      io.set({ confirm: { panes: losing, change: o } });
      return undefined;
    }
    const geometry = o.geometry ?? p.geometry;
    const check =
      layoutChanged && io.unstable && (geometry === "focus" || geometry === "swap")
        ? geometryOf(io.snapshot().m)
        : null;
    if (layoutChanged || viewChanged || o.patch || o.undo) {
      // A reshape is counted, so the workspace can let panes slide to their new place.
      const motion = layoutChanged && geometry === "reshape" ? { reshapes: s.reshapes + 1 } : {};
      const undoStack = pruneUndo(o.undo ?? s.undoStack, next.layout);
      const pruned = layoutChanged ? prunePanes({ ...s, ...o.patch }, next.layout, undoStack) : {};
      io.set({
        layout: next.layout,
        view: layoutChanged || viewChanged ? next.view : s.view,
        ...o.patch,
        ...motion,
        ...pruned,
        undoStack,
      });
      if (check !== null) {
        const after = geometryOf(io.snapshot().m);
        if (after !== check) io.unstable!(o.op, check, after);
      }
      io.url(layoutChanged ? p.history : viewChanged ? "replace" : "none");
      if (o.msg && (layoutChanged || (p.announceWhen === "change" && viewChanged)))
        io.announce(o.msg);
      if (o.toast && layoutChanged) io.toast(o.toast);
    }
  }
  if (o.focusDom) io.focus(o.focusDom);
  if (o.defer) io.defer?.(o.defer);
  return o.result;
}
