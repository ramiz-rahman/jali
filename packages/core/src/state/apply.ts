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
 * An action is a proposal until it commits. However many steps it is made of (a sequence, a step computed from the
 * state the last one left), they are worked out on a private copy of the state, and land together or not at all: a
 * refusal or a question that holds the action discards the proposal, and nothing needs putting back. What others write
 * meanwhile (a pane's reports, the host's own actions inside `beforeClose`) are commits of their own, and stay. An
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
import { closedPanes, pruneUndo } from "./undo";
import { discardedReports, prunedReports, withMaps } from "./reports";
import type { PaneKinds } from "../pane-kinds";
import { ownedPaneState, ownedSelection } from "./pane-state";
import { sameRef } from "../layout/ops/ref";
import { currentInput, withInput, type JaliInput } from "../dom/input";
import { linkUsage, MAX_LINK_TEXT, pastLimits } from "../layout/codec/limits";

/** The share of a state a link holds, as the budget measures it (`ApplyIO.linkText`). */
export type LinkState = Pick<UiState, "layout" | "view" | "presetId" | "page">;

/**
 * A change whose address no instance would reopen (layout/codec/limits.ts): more nodes or levels than a link holds,
 * more panes opened on a curated page than its link opens, or, where the instance writes an address, more text than a
 * reader reads. Measured on the whole state the change proposes. What was already past a limit may stay or shrink.
 */
function pastLinks(io: ApplyIO, from: LinkState, to: LinkState): boolean {
  if (pastLimits(linkUsage(from.layout, !!from.page), linkUsage(to.layout, !!to.page))) return true;
  if (!io.linkText) return false;
  const text = io.linkText(to);
  return text > MAX_LINK_TEXT && text > io.linkText(from);
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
  /** History this change writes when it commits, in place of its op's, even when nothing changes (a link arrival). */
  history?: HistoryMode;
}

/**
 * Why an action did not happen. Each public action documents the reasons it can give.
 *  - "not-found": the pane, preset, view or item it names is not there.
 *  - "invalid": what it was given won't do: an argument its type doesn't allow (a mode, an edge, an index), a ref of a
 *    kind this instance doesn't have, or a layout that can't be shown (a malformed tree).
 *  - "unavailable": this instance can't do it: no launcher (split, new tab), no curated page, no free layout.
 *  - "single-view": a curated page in Single view has no layout to change.
 *  - "not-allowed": the app's `allow` turns that control off for the pane (a kind's, the instance's, or its `when`),
 *    or for a pane beside a divider it would move.
 *  - "last-pane": the last pane, or a page's last view on screen, stays.
 *  - "blocked": the pane can't go there (move past the edge, tuck the only pane, tuck a tab), or the result would be
 *    more than a link holds (256 nodes, 128 levels, a curated page's 32 opened panes, or, where the instance writes an
 *    address, more text than a reader reads), so its address could never be reopened.
 *  - "nothing-to-do": nothing to undo, put back, close, resize or unmerge.
 *  - "unsaved": it would lose unsaved work, so Jali asks the person ("Discard unsaved changes?") and holds it;
 *    `settled` says how the question ended. (A following detail with unsaved work doesn't ask: it keeps its object,
 *    and that refusal has no `settled`.)
 *  - "kept": the host's `beforeClose` kept the panes, or the person chose Keep editing, or what a held action was
 *    computed from is gone by the time it is answered.
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
  /** Whoever asked for it, when not whoever answers: the commit's events carry it. */
  input?: JaliInput;
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
  // The peek is never in the address (a reload closes it): nothing to write.
  peek: view("none"),
  select: view("replace"),
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

/** Where apply() reads and writes: the store's state, how a patch lands on it, and its effect sinks. */
export interface ApplyIO {
  get(): UiState;
  snapshotOf(s: UiState): Snapshot;
  /** `s` with `patch` over it, refitted when its room or pane cap changed (`refit`: the address then follows). Pure. */
  reduce(s: UiState, patch: Partial<UiState>): { state: UiState; refit: boolean };
  /** Put `s` in place and run `effects`, as one batch: told once it ends. */
  publish(s: UiState, effects: () => void): void;
  url(mode: HistoryMode): void;
  announce(text: string): void;
  toast(t: Toast): void;
  focus(id: NodeId): void;
  /** Schedule (or cancel) a deferred step; without it, deferred steps are dropped. */
  defer?(d: Deferred): void;
  /** A focus or swap op that moved something: development reports it. */
  unstable?(op: Op, before: string, after: string): void;
  /** A layout change was committed by `op`, for `action` when one is named. */
  committed?(op: Op, action?: ActionName): void;
  beforeClose?: BeforeClose;
  /** How long the instance's own params would be in the address it writes, for `s`; absent when it writes none (no URL
   *  sync), so text is then no limit. */
  linkText?(s: LinkState): number;
  /** Aborted by `destroy()`: nothing is committed after, and every held answer settles as `"unavailable"`. */
  signal: AbortSignal;
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
 * its object, in the layout or as a closed pane an undo could bring back; a pane that now shows another object
 * starts afresh. A list's selection stays with the list it was made in. `prior`: the state before this change.
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
  const owned = ownedPaneState(s, kinds, layout, closedPanes(undo));
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
 * Held questions (C8–C10 in docs/reviews/QUALITY-REVIEW.md). What waits for an answer (the host's `beforeClose`, or
 * "Discard unsaved changes?") is the intent, not the change it computed: the answer runs it again against the state
 * then (an `AnswerStep`), and asks again if it would now remove or replace more than was asked about.
 */
interface Hold {
  /** What runs again once the question is answered: set where the action (or part) it held is discarded. */
  intent: Intent;
  settled?: Promise<ActionResult>;
  /** The host holds it (a promise from `beforeClose`): its answer is awaited already. */
  host?: true;
}

/** One working out of an action. Its proposal, `p`, is a private state and the effects that wait for the commit. */
interface Run {
  io: ApplyIO;
  p: { state: UiState; effects: (() => void)[]; snap?: Snapshot };
  /** The store's state the proposal started from: if host code changes it meanwhile, the proposal is stale. */
  base: UiState;
  agreed: Agreed;
  hold?: Hold;
  /** The public action being made, if one is: the `layout` event names it. */
  action?: ActionName;
  /** Shared by every part of one `apply`: the panes the host let go, whether to stop (see `stop`), and the input of
   *  whoever asked for an action it answers. */
  top: { host: Asked; stop: boolean; input?: JaliInput };
}

/** A step's result, and whether a boundary inside it settled it already (a refusal said, a question held). */
interface Res {
  r: ActionResult;
  settled: boolean;
}
const ok = (r: ActionResult): Res => ({ r, settled: false });
export const UNAVAILABLE: Refusal = /* @__PURE__ */ Object.freeze({
  ok: false,
  reason: "unavailable",
}) as Refusal;

const snap = (c: Run) => (c.p.snap ??= c.io.snapshotOf(c.p.state));
const set = (c: Run, patch: Partial<UiState>) => {
  const r = c.io.reduce(c.p.state, patch);
  c.p.state = r.state;
  c.p.snap = undefined;
  // A refit's folds are part of what is on screen, so the address follows, once the size rests.
  if (r.refit) fx(c, () => c.io.url("debounce"));
};
const fx = (c: Run, effect: () => void) => void c.p.effects.push(effect);
/** Stop working the action out: host code ended the instance, or wrote the state it is worked out from. */
const stop = (c: Run): Res => ((c.top.stop = true), { r: UNAVAILABLE, settled: true });
const disturbed = (c: Run) => c.io.signal.aborted || c.io.get() !== c.base;

/** Every pane is one that was agreed to, still showing the object it showed then. */
const covered = (panes: Asked, agreed?: Asked) =>
  !!agreed && panes.every((p) => agreed.some((a) => a.pane === p.pane && sameRef(a.ref, p.ref)));

/** `o` as an intent to run again: a step, or the answer to a question (its own intent runs again), as it is; a
 *  change computed outside a step is made only on the layout it was computed from. */
function intentOf(o: Outcome, from: Layout): Intent {
  if (typeof o === "function") return o;
  if (o && !Array.isArray(o) && o.op === "answer") return () => o;
  return (x) => (x.s.layout === from ? o : refuse("kept"));
}

/** Hold the run for a question. Its intent is set where the action (or the part of an `each`) is discarded. */
function holdFor(c: Run): Hold {
  c.hold = { intent: () => refuse("kept") };
  return c.hold;
}

/** How a host's held answer ends: a yes runs `again` against the state then; a no is `"kept"`. The instance ending
 *  settles it as `"unavailable"` at once, and a later answer changes nothing. It settles once, and never rejects. */
function heldAnswer(
  io: ApplyIO,
  answer: Promise<boolean>,
  again: AnswerStep,
): Promise<ActionResult> {
  // The change made on a yes is still the one asked for, by whoever asked: its events carry that input.
  const input = currentInput();
  return new Promise<ActionResult>((resolve) => {
    const ended = () => resolve(UNAVAILABLE);
    if (io.signal.aborted) return ended();
    io.signal.addEventListener("abort", ended, { once: true });
    void answer.then((yes) => {
      io.signal.removeEventListener("abort", ended);
      if (io.signal.aborted) return ended();
      if (!yes) return resolve(refused("kept"));
      try {
        const r = withInput(input, () => apply(io, again));
        resolve(r.reason === "pending" && r.settled ? r.settled : r);
      } catch (err) {
        console.error(err);
        resolve(refused("kept"));
      }
    });
  });
}

/** The closes: what a host's `beforeClose` can do for them, by closing their panes itself. */
const CLOSES: ReadonlySet<ActionName | undefined> = /* @__PURE__ */ new Set<ActionName>([
  "close",
  "closeOthers",
  "closeTabs",
  "page.back",
]);

/**
 * A close the host made itself: worked out again after its `beforeClose` (at once, or once its promised yes came), it
 * found nothing left to do, and every pane the host let go (`host`, or what an answer carries) is gone. Its goal holds,
 * so it is done, not refused. Never another action: a replace whose pane the host closed did not happen.
 */
function closedByHost(
  o: Outcome,
  action: ActionName | undefined,
  r: ActionResult,
  host: Asked,
  layout: Layout,
): boolean {
  const answer = o && !Array.isArray(o) && typeof o === "object" && o.op === "answer" ? o : null;
  const gone = [...host, ...(answer?.agreed.host ?? [])];
  return (
    CLOSES.has(action ?? answer?.action) &&
    (r.reason === "not-found" || r.reason === "nothing-to-do") &&
    gone.length > 0 &&
    gone.every((p) => !core.tree.find(layout.root, p.pane))
  );
}

/**
 * Commit an outcome: worked out first, then committed in one go. Returns the last step's `result` as `pane`, or the
 * refusal that stopped it, or the question that holds it (`"pending"`, `"unsaved"`, with `settled`). Host code it calls
 * (`beforeClose`, a callback) that writes the state has it worked out again; one that ends the instance makes it
 * `"unavailable"`.
 */
export function apply(io: ApplyIO, o: Outcome, action?: ActionName): ActionResult {
  if (io.signal.aborted) return UNAVAILABLE;
  const intent = intentOf(o, io.get().layout);
  const top: Run["top"] = { host: [], stop: false };
  for (let tries = 0; ; tries++) {
    const base = io.get();
    const c: Run = { io, p: { state: base, effects: [] }, base, agreed: {}, action, top };
    top.stop = false;
    const res = whole(c, intent);
    if (io.signal.aborted) return UNAVAILABLE;
    if (closedByHost(o, action, res.r, top.host, base.layout)) return DONE;
    if (io.get() !== base) {
      // Held by the host: its answer is awaited already, and runs the whole action again against the state then.
      if (c.hold?.host) {
        c.hold.intent = intent;
        return res.r;
      }
      if (top.stop || c.p.state !== base) {
        if (tries < 8) continue;
        return refused("kept");
      }
    }
    const { state, effects } = c.p;
    // Each effect may run host code (a URL writer, a focus callback) that ends the instance.
    const publish = () => io.publish(state, () => effects.forEach((e) => io.signal.aborted || e()));
    if (state !== base || effects.length) withInput(top.input ?? currentInput(), publish);
    return res.r;
  }
}

/**
 * `o`, all or nothing: refused, every change it made is discarded and the refusal is said; held, its changes are
 * discarded too (the question stays) and `o` is what runs again.
 */
function whole(c: Run, o: Outcome): Res {
  const at = { state: c.p.state, effects: c.p.effects.length };
  const res = step(c, o);
  if (res.settled || c.top.stop) return res;
  if (!c.hold && res.r.ok) return res;
  const confirm = c.p.state.confirm;
  c.p.state = at.state;
  c.p.snap = undefined;
  c.p.effects.length = at.effects;
  if (c.hold) {
    // The question is the one thing a held action leaves: it is what the person answers. One it takes the place of
    // ends as kept.
    const was = at.state.confirm;
    if (confirm !== was) {
      set(c, { confirm });
      if (was) fx(c, () => was.settle(refused("kept")));
    }
    c.hold.intent = intentOf(o, at.state.layout);
  } else if (res.r.message) {
    const text = res.r.message;
    fx(c, () => c.io.announce(text));
  }
  return { r: res.r, settled: true };
}

function step(c: Run, o: Outcome): Res {
  const io = c.io;
  if (!o) return ok(DONE);
  if (typeof o === "function") {
    const next = o(snap(c));
    // A step may call host code (a kind's callback, the app's `allow`): it may have ended the instance or written.
    return disturbed(c) ? stop(c) : step(c, next);
  }
  if (Array.isArray(o)) {
    // In order, all or nothing: the first refusal or question stops it, and `whole` discards what came before.
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
      if (c.top.stop) return res;
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
    const inner: Run = { ...c, agreed: o.agreed, action: o.action, hold: undefined };
    if (o.input) c.top.input = o.input;
    const res = whole(inner, o.intent);
    if (c.top.stop) return res;
    // Asked again: this question ends as that one does. Told once this commit lands.
    const settle = o.settle,
      end = inner.hold?.settled ?? res.r;
    if (settle) fx(c, () => settle(end));
    if (inner.hold) c.hold = inner.hold;
    return res;
  }
  const s = c.p.state;
  const p = POLICY[o.op];
  const next = { layout: o.layout ?? s.layout, view: o.view ?? s.view };
  const url = (mode: HistoryMode) => mode !== "none" && fx(c, () => io.url(mode));
  let discarding: NodeId[] = [];
  // The state the change proposes, as far as a link holds it: its page and preset may come with it.
  const has = <K extends keyof UiState>(k: K) => !!o.patch && k in o.patch;
  const proposed: LinkState = {
    layout: next.layout,
    view: next.view,
    page: has("page") ? (o.patch!.page ?? null) : s.page,
    presetId: has("presetId") ? o.patch!.presetId : s.presetId,
  };
  if (p.writes === "view") {
    // A view the address holds (zoom, scroll) is part of the link too: one past what a reader reads isn't made.
    if (next.view !== s.view && (o.history ?? p.history) !== "none" && pastLinks(io, s, proposed))
      return ok(refused("blocked"));
    if (next.view !== s.view || o.patch) {
      const selection = o.patch?.selection;
      const owned =
        selection && selection !== s.selection
          ? ownedSelection(s, selection, snap(c).env.kinds, s.layout)
          : {};
      set(c, { view: next.view, ...o.patch, ...owned });
    }
    url(o.history ?? p.history);
    const { msg, toast } = o;
    if (msg) fx(c, () => io.announce(msg));
    if (toast) fx(c, () => io.toast(toast));
  } else {
    const layoutChanged = next.layout !== s.layout,
      viewChanged = !sameView(next.view, s.view);
    if ((layoutChanged || viewChanged) && pastLinks(io, s, proposed)) return ok(refused("blocked"));
    // Unsaved work is never lost without asking. A following detail keeps its object instead (it moves on its own
    // while the person browses the list: a question each time would be worse).
    // The host is asked first (beforeClose); its yes still meets Jali's own question about unsaved work.
    const leaving =
      layoutChanged && io.beforeClose && !o.allowed ? leavingPanes(s, next.layout) : [];
    const host = [...(c.agreed.host ?? []), ...c.top.host];
    if (leaving.length && !covered(leaving, host)) {
      const request: CloseRequest = { panes: leaving, reason: CLOSE_REASON[o.op] ?? "layout" };
      // Nothing of this action is written yet, so whatever the host does meanwhile is its own commit, and stays.
      const answer = ask(io.beforeClose!, request);
      if (io.signal.aborted) return stop(c);
      if (answer === false) return ok(refused("kept"));
      if (answer !== true) {
        // Allowed later: the intent runs again then, and asks again if it would now remove something else.
        const hold = holdFor(c);
        hold.host = true;
        hold.settled = heldAnswer(io, answer, {
          op: "answer",
          intent: (x) => hold.intent(x),
          agreed: { ...c.agreed, host: [...host, ...leaving] },
          action: c.action,
        });
        return ok({ ok: false, reason: "pending", settled: hold.settled });
      }
      c.top.host.push(...leaving);
      // The host wrote while it decided (unsaved work it reported, an action of its own): the action is worked out
      // again from the state now, and what the host allowed is not asked again.
      if (io.get() !== c.base) return stop(c);
    }
    // A pane the host removed has no work left to keep: its object is gone.
    const losing = layoutChanged && o.op !== "remove" ? wouldLoseWork(s, next.layout) : [];
    if (losing.length) {
      if (o.op === "follow")
        return ok(refused("unsaved", say(snap(c)).keptUnsaved(s.unsaved[losing[0]!]!)));
      // `confirmDiscard: false`: the app asked already (beforeClose), so its yes stands.
      if (snap(c).env.confirmDiscard !== false) {
        const refs = new Map(core.tree.panes(s.layout.root).map((n) => [n.id, n.ref]));
        const asked = losing.map((pane) => ({ pane, ref: refs.get(pane)! }));
        if (covered(asked, c.agreed.discard)) discarding = losing;
        else {
          const hold = holdFor(c);
          let settle!: (r: ActionResult | Promise<ActionResult>) => void;
          const settled = new Promise<ActionResult>((r) => (settle = r));
          hold.settled = settled;
          set(c, {
            confirm: {
              panes: losing,
              asked,
              agreed: { ...c.agreed, host: [...(c.agreed.host ?? []), ...c.top.host] },
              action: c.action,
              intent: (x) => hold.intent(x),
              settled,
              settle,
              input: currentInput(),
            },
          });
          return ok({ ok: false, reason: "unsaved", settled });
        }
      }
    }
    const geometry = o.geometry ?? p.geometry;
    // A focus or swap op's geometry is measured: what it shows can change rects. Only then is the model built for it.
    const check =
      layoutChanged && (geometry === "focus" || geometry === "swap") ? geometryOf(snap(c).m) : null;
    if (layoutChanged || viewChanged || o.patch || o.undo) {
      // A reshape is counted, so the instance can let panes slide to their new place.
      const motion = layoutChanged && geometry === "reshape" ? { reshapes: s.reshapes + 1 } : {};
      const undoStack = pruneUndo(o.undo ?? s.undoStack, next.layout, snap(c).env.kinds);
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
      if (discarding.length) {
        const text = say(snap(c)).discarded(discarding.length);
        fx(c, () => io.announce(text));
      }
      // A pane's state goes with the last way back to it: the layout changing, or an undo entry dropped.
      const pruned =
        layoutChanged || undoStack !== s.undoStack
          ? prunePanes({ ...s, ...kept, ...o.patch }, next.layout, undoStack, snap(c).env.kinds, s)
          : {};
      set(c, {
        layout: next.layout,
        view: layoutChanged || viewChanged ? next.view : s.view,
        ...kept,
        ...o.patch,
        ...motion,
        ...pruned,
        undoStack,
      });
      if (layoutChanged) fx(c, () => io.committed?.(o.op, c.action));
      if (check !== null) {
        const after = geometryOf(snap(c).m);
        if (after !== check) {
          // Rects moved: they slide there, as for a reshape. For an op that never moves anything, it's a bug.
          set(c, { reshapes: c.p.state.reshapes + 1 });
          if (STABLE.has(o.op)) fx(c, () => io.unstable?.(o.op, check, after));
        }
      }
      const { msg, toast } = o;
      if (msg && (layoutChanged || (p.announceWhen === "change" && viewChanged)))
        fx(c, () => io.announce(msg));
      if (toast && layoutChanged) fx(c, () => io.toast(toast));
    }
    url(o.history ?? (layoutChanged ? p.history : viewChanged ? "replace" : "none"));
  }
  const { focusDom, defer } = o;
  if (focusDom) fx(c, () => io.focus(focusDom));
  if (defer) fx(c, () => io.defer?.(defer));
  return ok(o.result === undefined ? DONE : { ok: true, pane: o.result });
}
