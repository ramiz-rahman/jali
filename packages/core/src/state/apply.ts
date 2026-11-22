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
 * An action is all or nothing. However many steps it is made of (a sequence, a step computed from the state the last
 * one left), its changes land together or not at all: the first refusal puts back every change before it, and a
 * question that holds the action puts them back too, keeping the action itself to run again once answered. An
 * action that may partly happen says so (`each`): each of its parts is then all or nothing on its own.
 *
 * Timing is declared, not hidden: a change may carry a `defer`red step (keyed; a newer step with the same key replaces
 * or cancels it). The store runs it after `ms` against the state at that moment. Linked selection uses it: a list's
 * detail follows the selection once it rests (actions/follow.ts).
 */
import * as core from "../layout/engine";
import type { Env } from "../env";
import { say } from "./messages";
import type {
  Layout,
  LayoutContext,
  NodeId,
  ObjectRef,
  UndoEntry,
  ViewState,
} from "../layout/types";
import type { Model } from "./model";
import type { UiState } from "./store";
import type { ActionName } from "../actions/public";
import { pruneUndo } from "./undo";
import { discardedReports, prunedReports, withMaps } from "./reports";
import type { PaneKinds } from "../pane-kinds";
import { ownedPaneState, ownedSelection } from "./pane-state";
import { sameRef } from "../layout/ops/ref";
import { currentInput, withInput } from "../dom/input";
import { MAX_NODES } from "../layout/codec/validate";
import { MAX_LINK_TEXT } from "../layout/codec/codec";

/**
 * A change whose address would be one no instance reopens: a layout with more nodes than a link holds (`MAX_NODES`,
 * a cheap count), or, where the instance keeps its layout in the address, layout text longer than the codec reads
 * (`MAX_LINK_TEXT`; one long param in a small layout). A layout already that big may still shrink. (Ops never nest a
 * split in a split of one, so a layout within the node limit is within the depth limit too.)
 */
function pastLinks(from: Layout, to: Layout, linkText?: (layout: Layout) => number): boolean {
  const next = core.tree.nodes(to.root).length;
  if (next > MAX_NODES && next > core.tree.nodes(from.root).length) return true;
  if (!linkText) return false;
  const text = linkText(to);
  return text > MAX_LINK_TEXT && text > linkText(from);
}

/** What an action reads: the state, the model derived from it, and the core's context. */
export interface Snapshot {
  s: UiState;
  m: Model;
  ctx: LayoutContext;
  /** The instance's pane kinds and profile. */
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
  | "scroll"
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
  | "moveTab"
  | "pinTab"
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
  | "keep"
  | "setLayout"
  | "remove";

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
  /** The host's `beforeClose` already allowed this change: it is not asked again. */
  allowed?: true;
}

/**
 * Why an action did not happen. Each public action documents the reasons it can give.
 *  - "not-found": the pane, preset, view or item it names is not there.
 *  - "invalid": what it was given won't do: an argument its type doesn't allow (a mode, an edge, an index), a ref of a
 *    kind this instance doesn't have, or a layout that can't be shown (a malformed tree).
 *  - "unavailable": this instance can't do it: no launcher (split, new tab), no curated page, no free layout.
 *  - "single-view": a curated page in Single view has no layout to change.
 *  - "not-allowed": the person's role on the curated page may only peek (`setCanInvestigate(false)`).
 *  - "last-pane": the last pane, or a page's last view on screen, stays.
 *  - "blocked": the pane can't go there (move past the edge, tuck the only pane, tuck a tab), or the layout would
 *    hold more than a link can (256 nodes, 128 levels), so its address could never be reopened.
 *  - "nothing-to-do": nothing to undo, put back, close, resize or unmerge.
 *  - "unsaved": it would lose unsaved work, so Jali asks the person ("Discard unsaved changes?") and holds it;
 *    `settled` says how the question ended. (A following detail with unsaved work doesn't ask: it keeps its object,
 *    and that refusal has no `settled`.)
 *  - "kept": the host's `beforeClose` kept the panes, or the person chose Keep editing.
 *  - "pending": the host's `beforeClose` is still deciding; `settled` says what happened in the end.
 */
export type RefusalReason =
  | "not-found"
  | "invalid"
  | "unavailable"
  | "single-view"
  | "not-allowed"
  | "last-pane"
  | "blocked"
  | "nothing-to-do"
  | "unsaved"
  | "kept"
  | "pending";

/** An action that did not happen, and why (silent without `msg`). */
export interface RefusalStep {
  op: "refused";
  reason: RefusalReason;
  msg?: string;
}
export const refuse = (reason: RefusalReason, msg?: string): RefusalStep => ({
  op: "refused",
  reason,
  msg,
});
export const isRefusal = (o: Outcome): o is RefusalStep =>
  !!o && typeof o === "object" && "op" in o && o.op === "refused";
/** Whether `o` is one change (not a sequence, a step, a refusal, an answer or `each`). */
export const isChange = (o: Outcome): o is Change =>
  !!o &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  o.op !== "refused" &&
  o.op !== "answer" &&
  o.op !== "each";

/** An action as it was asked for: run again against the state of the moment when a held question is answered. */
export type Intent = (x: Snapshot) => Outcome;

/** What a question about leaving named: each pane and the object it showed when it was asked. */
export type Asked = CloseRequest["panes"];

/** What has been agreed to already: panes the host's `beforeClose` let go, and panes whose unsaved work the person
 *  discarded. Each counts only while the pane still shows the object it showed when asked. */
export interface Agreed {
  host?: Asked;
  discard?: Asked;
}

/**
 * The answer to a held question: the intent runs again against the state now, with what was agreed. If it would
 * still remove or replace only what the question named, it is made; if more is at stake now, the question is asked
 * again. `settle` hears how it ended.
 */
export interface AnswerStep {
  op: "answer";
  intent: Intent;
  agreed: Agreed;
  settle?: (r: ActionResult | Promise<ActionResult>) => void;
  /** The action that was held, which the `layout` event names when the answer makes it. */
  action?: ActionName;
  msg?: undefined;
}

/**
 * Parts that each happen or not on their own (`each(...)`): a part that is refused puts back only its own changes,
 * and the parts after it still run. For an action whose parts are separate on purpose: following several details at
 * once, where one with unsaved work keeps its object and the others move on. The result is the first refusal, else
 * the last part's.
 */
export interface EachStep {
  op: "each";
  parts: Outcome[];
  msg?: undefined;
}
/** Parts that happen or not one by one: see `EachStep`. */
export const each = (...parts: Outcome[]): EachStep => ({ op: "each", parts });

/** A change, a refusal, nothing, a step computed from the state the previous step left, the answer to a held
 *  question, several in order (all or nothing), or parts that each happen or not on their own (`each`). */
export type Outcome =
  | Change
  | RefusalStep
  | AnswerStep
  | EachStep
  | null
  | undefined
  | ((x: Snapshot) => Outcome)
  | Outcome[];

/** An action happened (or there was nothing to do: what it asks for is already so). `pane`: the pane it opened or
 *  acted on, when there is one. */
export interface Done {
  ok: true;
  pane?: NodeId;
  /** Always undefined, so `result.reason` reads without checking `ok` first. */
  reason?: undefined;
  message?: undefined;
  settled?: undefined;
}

/** An action did not happen. `message` is what Jali announced to screen readers, if anything. */
export interface Refusal {
  ok: false;
  reason: RefusalReason;
  message?: string;
  /** Always undefined, so `result.pane` reads without checking `ok` first. */
  pane?: undefined;
  /**
   * On a refusal that asks ("unsaved": Jali asks the person; "pending": the host's `beforeClose` is deciding): how the
   * question ended. It resolves with `{ ok: true, pane }` when the action went ahead, or with a refusal when it didn't
   * (`"kept"` after Keep editing, or when a newer question took its place). It resolves when this question is
   * answered, so a yes that leads to the other question (the host says yes, then a pane still has unsaved work)
   * resolves with that `"unsaved"` refusal, whose own `settled` says how the person answered. It never rejects.
   */
  settled?: Promise<ActionResult>;
}

/** What every public action returns. */
export type ActionResult = Done | Refusal;

export const DONE: Done = /* @__PURE__ */ Object.freeze({ ok: true }) as Done;
const refused = (reason: RefusalReason, message?: string): Refusal =>
  message === undefined ? { ok: false, reason } : { ok: false, reason, message };

/** Why the host's `beforeClose` is asked. */
export type CloseReason = "close" | "show" | "layout" | "address";

/** What `beforeClose` is asked about: the panes a change would remove or point at another object. */
export interface CloseRequest {
  panes: { pane: NodeId; ref: ObjectRef }[];
  /** "close": closed (close, close others, Back to the page). "show": the pane would show another object.
   *  "layout": a new layout (a preset, `setLayout`, undo, a page's mode or item). "address": Back, Forward or a link. */
  reason: CloseReason;
}

/** The host's close guard (`createJali({ beforeClose })`): true lets the change happen, false keeps the panes. */
export type BeforeClose = (request: CloseRequest) => boolean | Promise<boolean>;

const CLOSE_REASON: Partial<Record<Op, CloseReason>> = {
  close: "close",
  closeOthers: "close",
  dismiss: "close",
  hide: "close",
  openHere: "show",
  focusExisting: "show",
  follow: "show",
  page: "show",
  activate: "show",
  arrive: "address",
};

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
  // Where a row that scrolls sideways came to rest: in the link, but Back doesn't step through every swipe.
  scroll: view("replace"),
  peek: view("replace"),
  select: view("replace"),
  permission: view("none"),
  // swap: content changes in place
  openHere: layout("push", "swap"),
  focusExisting: layout("push", "swap", "change"),
  reveal: layout("replace", "swap"),
  tab: layout("replace", "swap"),
  // A tab's place in its strip: the group keeps its rect.
  moveTab: layout("push", "swap"),
  pinTab: layout("push", "swap"),
  swap: layout("push", "swap"),
  activate: layout("push", "swap"),
  page: layout("push", "swap", "change"),
  // A list's detail follows its selection in place; history is replaced, so Back skips the rows passed through.
  follow: layout("replace", "swap"),
  // Keep or release a linked detail: a flag on the pane, nothing moves.
  keep: layout("replace", "focus"),
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
  setLayout: layout("push", "reshape"),
  // The host closed the pane's object elsewhere: Back never returns to it.
  remove: layout("replace", "reshape"),
  hide: layout("push", "reshape"),
  mode: layout("push", "reshape"),
  // direct: follows the pointer
  resize: layout("debounce", "direct"),
};

/**
 * Ops that never move anything, by contract: a tab chosen or moved in its strip, a pane revealed or pinned, a linked
 * pane kept, a page's view shown in place. Development reports any of them that moves a rect (`unstable`): that is a
 * bug. Other focus and swap ops may change rects with what they show (a record put where a table was stops at its
 * measure); their geometry is measured, not assumed, and panes slide to a new place as for a reshape.
 */
export const STABLE: ReadonlySet<Op> = /* @__PURE__ */ new Set<Op>([
  "focus",
  "tab",
  "reveal",
  "moveTab",
  "pinTab",
  "keep",
]);

/** The geometry on screen: the set of rects, whoever fills them. Equal before and after a focus or swap op. */
export const geometryOf = (m: Model) =>
  m.resolved.panes
    .filter((b) => !b.hidden)
    .map((b) => `${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`)
    .sort()
    .join(" ");

/** Where apply() writes: the store's state and its effect sinks. */
export interface ApplyIO {
  get(): UiState;
  set(patch: Partial<UiState>): void;
  /** Put back a state this commit read with `get()`, as it was: an action refused or held part way undoes its own
   *  writes. No refit, no address write: nothing of it was told yet. */
  restore(state: UiState): void;
  snapshot(): Snapshot;
  url(mode: HistoryMode): void;
  announce(text: string): void;
  toast(t: Toast): void;
  focus(id: NodeId): void;
  /** Schedule (or cancel) a deferred step. Without a scheduler, deferred steps are dropped. */
  defer?(d: Deferred): void;
  /** A focus or swap op that moved something: development reports it. */
  unstable?(op: Op, before: string, after: string): void;
  /** A layout change was committed by `op`, for `action` when one is named (the store's events say so once the
   *  commit ends). */
  committed?(op: Op, action?: ActionName): void;
  /** The host's close guard (`createJali({ beforeClose })`). */
  beforeClose?: BeforeClose;
  /** Run host code inside this commit (`beforeClose`). A commit the host makes meanwhile waits until this one ends
   *  (the store's `apply`), so this commit's reading of the state stays true. */
  host?<T>(call: () => T): T;
  /** Commit an outcome later, from the top (a change `beforeClose` allowed after a while). */
  later?(o: Outcome): ActionResult;
  /** How long `layout`'s text is in the address, as the instance would write it; absent when it writes no layout
   *  there (no URL sync). */
  linkText?(layout: Layout): number;
  /** The instance's lifetime. Once it ends (`destroy()`), a held host answer settles as `"kept"` at once, and its
   *  later yes changes nothing. */
  signal?: AbortSignal;
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
    return !!a && (!b || !sameRef(a.ref, b.ref));
  });
}

/** Every pane `next` would remove or point at another object, with what it shows now (`beforeClose` is asked). */
export function leavingPanes(s: UiState, next: Layout): CloseRequest["panes"] {
  if (next === s.layout) return [];
  const after = new Map(core.tree.panes(next.root).map((p) => [p.id, p]));
  return core.tree
    .panes(s.layout.root)
    .filter((a) => {
      const b = after.get(a.id);
      return !b || !sameRef(a.ref, b.ref);
    })
    .map((p) => ({ pane: p.id, ref: p.ref }));
}

/** Ask the host. An answer that throws or rejects keeps the panes. */
function ask(guard: BeforeClose, request: CloseRequest): boolean | Promise<boolean> {
  try {
    const answer = guard(request);
    return typeof answer === "boolean"
      ? answer
      : Promise.resolve(answer).then(Boolean, () => false);
  } catch {
    return false;
  }
}

/**
 * Per-pane records for the panes that can still use them. A pane's own state stays while a pane with its id shows
 * its object, in the layout or an undo entry (an undo brings the pane back); a pane that now shows another object
 * starts afresh. A list's selection stays with the list it was made in. `prior`: the state before this commit.
 */
function prunePanes(
  s: UiState,
  layout: Layout,
  undo: UndoEntry[],
  kinds: PaneKinds,
  prior: UiState,
): Partial<UiState> {
  const was = new Map(core.tree.panes(s.layout.root).map((p) => [p.id, p.ref]));
  const moved = new Set(
    core.tree
      .panes(layout.root)
      .filter((p) => was.has(p.id) && !sameRef(was.get(p.id), p.ref))
      .map((p) => p.id),
  );
  // What panes reported goes with the pane, and what described its object goes when it shows another
  // (state/reports.ts); the maps made from the reports follow them.
  const live = new Set(core.tree.panes(layout.root).map((p) => p.id));
  const reports = withMaps(prior, prunedReports(s.paneReports, live, moved));
  // A pane's own state stays while a pane with its id shows its object, here or in the undo stack; a list's selection
  // stays with the list it was made in (state/pane-state.ts).
  const owned = ownedPaneState(s, kinds, [layout, ...undo.map((e) => e.before.layout)]);
  const selected = ownedSelection(prior, s.selection, kinds, layout);
  return {
    ...(owned.paneState !== s.paneState || owned.paneStateHeld !== s.paneStateHeld ? owned : {}),
    ...(selected.selection !== s.selection || selected.selectionOf !== s.selectionOf
      ? selected
      : {}),
    ...reports,
  };
}

const sameView = (a: ViewState, b: ViewState) =>
  a.focused === b.focused && a.zoomed === b.zoomed && a.peek === b.peek;

/**
 * Held questions (C8–C10 in docs/reviews/QUALITY-REVIEW.md). A change that waits for an answer (the host's `beforeClose`, or
 * "Discard unsaved changes?") is not kept as the change it computed: that change is about the state when the question
 * opened. What waits is the intent: the whole action (or the part of an `each` it was in), whose changes so far are
 * put back. The answer runs the intent again against the state of that moment (an `AnswerStep`): if what it would
 * remove or replace is still only what was asked about (the same panes, showing the same objects), the fresh result
 * is made; if more is at stake, the question is asked again.
 */
interface Hold {
  /** What runs again once the question is answered: set when the action (or part) it held is put back. */
  intent: Intent;
  /** How the question ends, once it has been put. */
  settled?: Promise<ActionResult>;
}

/** One commit: what was agreed already, the question that holds it, if one does, and where its effects wait. */
interface Run {
  io: ApplyIO;
  tx: Transaction;
  agreed: Agreed;
  hold?: Hold;
  /** The public action being made, if one is: the `layout` event names it. */
  action?: ActionName;
}

/** What a step did: its result, and whether an all-or-nothing boundary inside it already settled it (a refusal put
 *  back and said, or a question held), so the boundaries around it leave it as it is. */
interface Res {
  r: ActionResult;
  settled: boolean;
}
const ok = (r: ActionResult): Res => ({ r, settled: false });

/**
 * A commit's writes and effects, so they can be put back. State writes go through at once (each step reads the state
 * the last one left); the effects the world sees (the address, announcements, toasts, DOM focus, deferred steps, the
 * layout events) wait until the whole commit is made, and are dropped with the writes they followed.
 */
interface Transaction {
  io: ApplyIO;
  /** Where the commit is now: a state, how many effects wait, and how many writes it made. */
  mark(): { state: UiState; effects: number; writes: number };
  /** Back to `mark`: its state (when it wrote since), and only the effects that waited then. */
  restore(at: { state: UiState; effects: number; writes: number }): void;
  /** Tell the world: every effect that waits, in order. */
  flush(): void;
}

function transaction(io: ApplyIO): Transaction {
  const effects: (() => void)[] = [];
  const later =
    <A extends unknown[]>(fn: ((...a: A) => void) | undefined) =>
    (...a: A) =>
      void (fn && effects.push(() => fn(...a)));
  /** How many writes this commit made: a restore puts back only its own, never what host code wrote meanwhile. */
  let writes = 0;
  const tx: ApplyIO = {
    get: () => io.get(),
    set: (patch) => (writes++, io.set(patch)),
    restore: (state) => io.restore(state),
    snapshot: () => io.snapshot(),
    url: later((m) => io.url(m)),
    announce: later((t) => io.announce(t)),
    toast: later((t) => io.toast(t)),
    focus: later((id) => io.focus(id)),
    defer: later(io.defer && ((d) => io.defer!(d))),
    unstable: later(io.unstable && ((op, a, b) => io.unstable!(op, a, b))),
    committed: later(io.committed && ((op, action) => io.committed!(op, action))),
    get beforeClose() {
      return io.beforeClose;
    },
    host: io.host && ((call) => io.host!(call)),
    linkText: io.linkText && ((layout) => io.linkText!(layout)),
    later: io.later && ((o) => io.later!(o)),
    signal: io.signal,
  };
  return {
    io: tx,
    mark: () => ({ state: io.get(), effects: effects.length, writes }),
    restore(at) {
      if (writes !== at.writes && io.get() !== at.state) io.restore(at.state);
      effects.length = at.effects;
    },
    flush() {
      for (const e of effects.splice(0)) e();
    },
  };
}

const sameAsked = (a: Asked[number], b: Asked[number]) =>
  a.pane === b.pane && sameRef(a.ref, b.ref);
/** Every pane is one that was agreed to, still showing the object it showed then. */
const covered = (panes: Asked, agreed?: Asked) =>
  !!agreed && panes.every((p) => agreed.some((a) => sameAsked(a, p)));

/** `o` as an intent to run again: a step as it is; a change computed outside a step is made only on the layout it was
 *  computed from. */
function intentOf(o: Outcome, from: Layout): Intent {
  return typeof o === "function" ? o : (x) => (x.s.layout === from ? o : refuse("kept"));
}

/** Hold the commit for a question. Its intent is set where the action (or the part of an `each`) is put back. */
function holdFor(c: Run): Hold {
  c.hold = { intent: () => refuse("kept") };
  return c.hold;
}

/**
 * Commit an outcome. Returns what happened: the last step's `result` as `pane`, or the refusal that stopped it (its
 * changes put back), or the question that holds it (`"pending"`, `"unsaved"`, with `settled`).
 */
export function apply(io: ApplyIO, o: Outcome, action?: ActionName): ActionResult {
  const tx = transaction(io);
  const c: Run = { io: tx.io, tx, agreed: {}, action };
  const r = whole(c, o).r;
  tx.flush();
  return r;
}

/**
 * `o`, all or nothing: refused, every change it made is put back and the refusal is said; held, its changes are put
 * back too (the question stays) and `o` is what runs again.
 */
function whole(c: Run, o: Outcome): Res {
  const at = c.tx.mark();
  const res = step(c, o);
  if (res.settled) return res;
  if (c.hold) {
    const confirm = c.io.get().confirm;
    c.tx.restore(at);
    // The question is the one thing a held action leaves: it is what the person answers.
    if (confirm !== at.state.confirm) c.io.set({ confirm });
    c.hold.intent = intentOf(o, at.state.layout);
    return { r: res.r, settled: true };
  }
  if (!res.r.ok) {
    c.tx.restore(at);
    if (res.r.message) c.io.announce(res.r.message);
    return { r: res.r, settled: true };
  }
  return res;
}

function step(c: Run, o: Outcome): Res {
  const io = c.io;
  if (!o) return ok(DONE);
  if (typeof o === "function") return step(c, o(io.snapshot()));
  if (Array.isArray(o)) {
    // In order, all or nothing: the first refusal or question stops it, and `whole` puts back what came before.
    let out: ActionResult = DONE;
    for (const part of o) {
      const res = step(c, part);
      if (res.settled || c.hold || !res.r.ok) return res;
      out = res.r;
    }
    return ok(out);
  }
  if (o.op === "refused") return ok(refused(o.reason, o.msg));
  if (o.op === "each") {
    let out: ActionResult | undefined,
      last: ActionResult = DONE;
    for (let i = 0; i < o.parts.length; i++) {
      const res = whole(c, o.parts[i]);
      if (c.hold) {
        // A part held: it and the parts after it wait for the answer; the parts before it stay made.
        const held = c.hold.intent,
          rest = o.parts.slice(i + 1);
        c.hold.intent = rest.length ? () => each(held, ...rest) : held;
        return { r: res.r, settled: true };
      }
      if (!res.r.ok) out ??= res.r;
      else last = res.r;
    }
    return { r: out ?? last, settled: true };
  }
  if (o.op === "answer") {
    const inner: Run = { io, tx: c.tx, agreed: o.agreed, action: o.action };
    const res = whole(inner, o.intent);
    // Asked again: this question ends as that one does.
    o.settle?.(inner.hold?.settled ?? res.r);
    if (inner.hold) c.hold = inner.hold;
    return res;
  }
  let s = io.get();
  const p = POLICY[o.op];
  const next = { layout: o.layout ?? s.layout, view: o.view ?? s.view };
  let discarding: NodeId[] = [];
  if (p.writes === "view") {
    if (next.view !== s.view || o.patch) {
      const selection = o.patch?.selection;
      const owned =
        selection && selection !== s.selection
          ? ownedSelection(s, selection, io.snapshot().env.kinds, s.layout)
          : {};
      io.set({ view: next.view, ...o.patch, ...owned });
    }
    io.url(p.history);
    if (o.msg) io.announce(o.msg);
  } else {
    const layoutChanged = next.layout !== s.layout,
      viewChanged = !sameView(next.view, s.view);
    // A curated page's address holds no layout: only the free layout's text counts.
    const page = o.patch && "page" in o.patch ? o.patch.page : s.page;
    if (layoutChanged && pastLinks(s.layout, next.layout, page ? undefined : io.linkText))
      return ok(refused("blocked"));
    // Unsaved work is never lost without asking. A following detail keeps its object instead (it moves on its own
    // while the person browses the list: a question each time would be worse).
    // The host is asked first (beforeClose); its yes still meets Jali's own question about unsaved work.
    const leaving =
      layoutChanged && io.beforeClose && !o.allowed ? leavingPanes(s, next.layout) : [];
    if (leaving.length && !covered(leaving, c.agreed.host)) {
      const request: CloseRequest = { panes: leaving, reason: CLOSE_REASON[o.op] ?? "layout" };
      const guard = io.beforeClose!;
      const answer = io.host ? io.host(() => ask(guard, request)) : ask(guard, request);
      if (answer === false) return ok(refused("kept"));
      const host = [...(c.agreed.host ?? []), ...leaving];
      if (answer !== true) {
        // Allowed later: the intent runs again then, and asks again if it would now remove something else.
        const hold = holdFor(c),
          agreed = { ...c.agreed, host };
        const again: AnswerStep = {
          op: "answer",
          intent: (x) => hold.intent(x),
          agreed,
          action: c.action,
        };
        // The instance's end settles it as kept at once; a promise settles once, so a later answer changes nothing.
        // The change made on a yes is still the one asked for, by whoever asked: its events carry that input.
        const signal = io.signal,
          input = currentInput();
        const settled = new Promise<ActionResult>((resolve) => {
          const kept = () => resolve(refused("kept"));
          signal?.addEventListener("abort", kept);
          void answer.then((yes) => {
            if (signal?.aborted || !yes) return kept();
            const r = withInput(input, () => (io.later ? io.later(again) : apply(io, again)));
            resolve(r.reason === "pending" && r.settled ? r.settled : r);
          });
        });
        hold.settled = settled;
        return ok({ ok: false, reason: "pending", settled });
      }
      c.agreed = { ...c.agreed, host };
      // The host's code may have reported on its panes while it decided (unsaved work, say): what follows reads the
      // state as it is now. Its commits waited (the store's `apply`), so the layout is the one this change was made
      // from; if it isn't, the change no longer fits it and is kept back.
      const now = io.get();
      if (now !== s) {
        if (now.layout !== s.layout || now.view !== s.view) return ok(refused("kept"));
        s = now;
      }
    }
    // A pane the host removed has no work left to keep: its object is gone.
    const losing = layoutChanged && o.op !== "remove" ? wouldLoseWork(s, next.layout) : [];
    if (losing.length) {
      if (o.op === "follow")
        return ok(refused("unsaved", say(io.snapshot()).keptUnsaved(s.unsaved[losing[0]!]!)));
      // `confirmDiscard: false`: the app asked already (beforeClose), so its yes stands.
      if (io.snapshot().env.confirmDiscard !== false) {
        const refs = new Map(core.tree.panes(s.layout.root).map((n) => [n.id, n.ref]));
        const asked = losing.map((pane) => ({ pane, ref: refs.get(pane)! }));
        if (covered(asked, c.agreed.discard)) discarding = losing;
        else {
          const hold = holdFor(c);
          let settle!: (r: ActionResult | Promise<ActionResult>) => void;
          const settled = new Promise<ActionResult>((r) => (settle = r));
          hold.settled = settled;
          // A newer question takes the place of one not answered: that one ends as kept.
          s.confirm?.settle(refused("kept"));
          io.set({
            confirm: {
              panes: losing,
              asked,
              agreed: c.agreed,
              action: c.action,
              intent: (x) => hold.intent(x),
              settled,
              settle,
            },
          });
          return ok({ ok: false, reason: "unsaved", settled });
        }
      }
    }
    const geometry = o.geometry ?? p.geometry;
    // A focus or swap op's geometry is measured: what it shows can change rects. Only then is the model built for it.
    const check =
      layoutChanged && (geometry === "focus" || geometry === "swap")
        ? geometryOf(io.snapshot().m)
        : null;
    if (layoutChanged || viewChanged || o.patch || o.undo) {
      // A reshape is counted, so the instance can let panes slide to their new place.
      const motion = layoutChanged && geometry === "reshape" ? { reshapes: s.reshapes + 1 } : {};
      const undoStack = pruneUndo(o.undo ?? s.undoStack, next.layout);
      // The work the person discarded goes in this commit, never before it: an answer that changes nothing keeps it.
      const kept = discarding.length
        ? {
            paneReports: discardedReports(s.paneReports, discarding),
            // A draft kept in the pane's own state is discarded too: an undo must not bring it back.
            paneState: Object.fromEntries(
              Object.entries(s.paneState).filter(([id]) => !discarding.includes(id)),
            ),
          }
        : {};
      if (discarding.length) io.announce(say(io.snapshot()).discarded(discarding.length));
      const pruned = layoutChanged
        ? prunePanes(
            { ...s, ...kept, ...o.patch },
            next.layout,
            undoStack,
            io.snapshot().env.kinds,
            s,
          )
        : {};
      io.set({
        layout: next.layout,
        view: layoutChanged || viewChanged ? next.view : s.view,
        ...kept,
        ...o.patch,
        ...motion,
        ...pruned,
        undoStack,
      });
      if (layoutChanged) io.committed?.(o.op, c.action);
      if (check !== null) {
        const after = geometryOf(io.snapshot().m);
        if (after !== check) {
          // Rects moved: they slide there, as for a reshape. For an op that never moves anything, it's a bug.
          io.set({ reshapes: io.get().reshapes + 1 });
          if (STABLE.has(o.op)) io.unstable?.(o.op, check, after);
        }
      }
      io.url(layoutChanged ? p.history : viewChanged ? "replace" : "none");
      if (o.msg && (layoutChanged || (p.announceWhen === "change" && viewChanged)))
        io.announce(o.msg);
      if (o.toast && layoutChanged) io.toast(o.toast);
    }
  }
  if (o.focusDom) io.focus(o.focusDom);
  if (o.defer) io.defer?.(o.defer);
  return ok(o.result === undefined ? DONE : { ok: true, pane: o.result });
}
