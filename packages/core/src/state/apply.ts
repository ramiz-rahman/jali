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
import { say } from "./messages";
import type {
  Layout,
  LayoutContext,
  NodeId,
  ObjectRef,
  UndoEntry,
  ViewState,
} from "../layout/types";
import type { JaliModel } from "./model";
import type { UiState } from "./store";
import type { ActionName } from "../actions/public";
import { pruneUndo } from "./undo";
import type { PaneReport } from "../actions/content";
import type { PaneKinds } from "../pane-kinds";
import { ownedPaneState, ownedSelection } from "./pane-state";
import { sameRef } from "../layout/ops/ref";

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
 *  - "invalid": the layout given can't be shown (a pane kind this workspace doesn't have, or a malformed tree).
 *  - "unavailable": this workspace can't do it: no launcher (split, new tab), no curated page, no free workspace.
 *  - "single-view": a curated page in Single view has no layout to change.
 *  - "not-allowed": the person's role on the curated page may only peek (`setCanInvestigate(false)`).
 *  - "last-pane": the last pane, or a page's last view on screen, stays.
 *  - "blocked": the pane can't go there (move past the edge, tuck the only pane, tuck a tab).
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

/** A change, a refusal, nothing, a step computed from the state the previous step left, the answer to a held
 *  question, or several in order. */
export type Outcome =
  | Change
  | RefusalStep
  | AnswerStep
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
  /** A layout change was committed by `op`, for `action` when one is named (the store's events say so once the
   *  commit ends). */
  committed?(op: Op, action?: ActionName): void;
  /** The host's close guard (`createJali({ beforeClose })`). */
  beforeClose?: BeforeClose;
  /** Commit an outcome later, from the top (a change `beforeClose` allowed after a while). */
  later?(o: Outcome): ActionResult;
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
  // Unsaved work, commands and activity belong to mounted content; state also survives in the undo stack.
  // The same content stays mounted when its object changes, so these go only with the pane.
  const live = new Set(core.tree.panes(layout.root).map((p) => p.id));
  const mounted = <T>(r: Record<NodeId, T>) =>
    Object.keys(r).every((id) => live.has(id))
      ? r
      : Object.fromEntries(Object.entries(r).filter(([id]) => live.has(id)));
  // A title or attributes from data are about the object they were set for: they go when the pane shows another.
  const named = Object.keys(s.titles).every((id) => live.has(id) && !moved.has(id))
    ? s.titles
    : Object.fromEntries(Object.entries(s.titles).filter(([id]) => live.has(id) && !moved.has(id)));
  const marked = Object.keys(s.paneAttributes).every((id) => live.has(id) && !moved.has(id))
    ? s.paneAttributes
    : Object.fromEntries(
        Object.entries(s.paneAttributes).filter(([id]) => live.has(id) && !moved.has(id)),
      );
  // Each caller's reports go with the pane; a title or attributes it gave go when the pane shows another object.
  const reports = Object.entries(s.paneReports);
  const paneReports = reports.every(([id]) => live.has(id) && !moved.has(id))
    ? s.paneReports
    : Object.fromEntries(
        reports
          .filter(([id]) => live.has(id))
          .map(([id, r]) => [id, moved.has(id) ? withoutNames(r) : r] as const)
          .filter(([, r]) => Object.keys(r).length),
      );
  // A pane's own state stays while a pane with its id shows its object, here or in the undo stack; a list's selection
  // stays with the list it was made in (state/pane-state.ts).
  const owned = ownedPaneState(s, kinds, [layout, ...undo.map((e) => e.before.layout)]);
  const selected = ownedSelection(prior, s.selection, kinds, layout);
  return {
    ...(owned.paneState !== s.paneState ? owned : {}),
    ...(selected.selection !== s.selection || selected.selectionOf !== s.selectionOf
      ? selected
      : {}),
    paneReports,
    unsaved: mounted(s.unsaved),
    paneCommands: mounted(s.paneCommands),
    activity: mounted(s.activity),
    titles: named,
    paneAttributes: marked,
  };
}

/** A pane's reports without the titles and attributes its callers gave, which were about the object it showed. */
function withoutNames(reports: Record<string, PaneReport>): Record<string, PaneReport> {
  const out: Record<string, PaneReport> = {};
  for (const [caller, { title: _t, attributes: _a, ...rest }] of Object.entries(reports))
    if (Object.keys(rest).some((k) => k !== "seq")) out[caller] = rest;
  return out;
}

/** The reports of `panes` without the unsaved work their callers gave: the person discarded it. */
function withoutUnsaved(
  all: UiState["paneReports"],
  panes: readonly NodeId[],
): UiState["paneReports"] {
  const out: UiState["paneReports"] = {};
  for (const [id, reports] of Object.entries(all)) {
    if (!panes.includes(id)) {
      out[id] = reports;
      continue;
    }
    const kept: Record<string, PaneReport> = {};
    for (const [caller, { unsaved: _u, ...rest }] of Object.entries(reports))
      if (Object.keys(rest).some((k) => k !== "seq")) kept[caller] = rest;
    if (Object.keys(kept).length) out[id] = kept;
  }
  return out;
}

const sameView = (a: ViewState, b: ViewState) =>
  a.focused === b.focused && a.zoomed === b.zoomed && a.peek === b.peek;

/**
 * Held questions (C8–C10 in docs/reviews/QUALITY-REVIEW.md). A change that waits for an answer (the host's `beforeClose`, or
 * "Discard unsaved changes?") is not kept as the change it computed: that change is about the state when the question
 * opened. What waits is the intent: the step `(x) => Outcome` that produced it, while nothing it began has been
 * committed (the outermost such step, so a public action re-reads its target too), plus the steps after it in any
 * sequence outside that step. The answer runs the intent again against the state of that moment (an `AnswerStep`):
 * if what it would remove or replace is still only what was asked about (the same panes, showing the same objects),
 * the fresh result is made; if more is at stake, the question is asked again. A held step stops its sequence: what
 * follows it waits with it.
 */
interface Hold {
  intent: Intent;
  /** The depth of the step the intent runs again from; sequences outside it carry their remaining steps along. */
  depth: number;
  /** How the question ends, once it has been put. */
  settled?: Promise<ActionResult>;
}

/** A step `(x) => Outcome` being run: `mark` is how many writes the run had made when it started. */
interface Frame {
  fn: Intent;
  mark: number;
  depth: number;
  up?: Frame;
}

/** One commit: what was agreed already, the writes made so far, and the step held, if one was. */
interface Run {
  io: ApplyIO;
  agreed: Agreed;
  writes: number;
  hold?: Hold;
  /** The public action being made, if one is: the `layout` event names it. */
  action?: ActionName;
}

const sameAsked = (a: Asked[number], b: Asked[number]) =>
  a.pane === b.pane && sameRef(a.ref, b.ref);
/** Every pane is one that was agreed to, still showing the object it showed then. */
const covered = (panes: Asked, agreed?: Asked) =>
  !!agreed && panes.every((p) => agreed.some((a) => sameAsked(a, p)));

/** Hold `o`: its intent is the outermost step around it that has committed nothing yet. A change with no such step
 *  (an outcome computed outside a step) is held as it is, and made only on the layout it was computed from. */
function holdFor(c: Run, f: Frame | undefined, o: Change, from: Layout): Hold {
  let pick: Frame | undefined;
  for (let g = f; g && g.mark === c.writes; g = g.up) pick = g;
  c.hold = pick
    ? { intent: pick.fn, depth: pick.depth }
    : { intent: (x) => (x.s.layout === from ? o : refuse("kept")), depth: Infinity };
  return c.hold;
}

/**
 * Commit an outcome. Returns what happened: the last step's `result` as `pane`, or the first refusal among the steps
 * (later steps still run, unless a step is held: then they wait with it).
 */
export function apply(io: ApplyIO, o: Outcome, action?: ActionName): ActionResult {
  return step({ io, agreed: {}, writes: 0, action }, o, undefined);
}

function step(c: Run, o: Outcome, f: Frame | undefined): ActionResult {
  const io = c.io;
  if (!o) return DONE;
  if (typeof o === "function")
    return step(c, o(io.snapshot()), {
      fn: o,
      mark: c.writes,
      depth: (f?.depth ?? -1) + 1,
      up: f,
    });
  if (Array.isArray(o)) {
    let out: ActionResult = DONE;
    for (let i = 0; i < o.length; i++) {
      const before = c.hold;
      const r = step(c, o[i], f);
      if (out.ok) out = r;
      if (c.hold !== before) {
        const hold = c.hold!,
          rest = o.slice(i + 1);
        if ((f?.depth ?? -1) < hold.depth && rest.length) {
          const held = hold.intent;
          hold.intent = () => [held, ...rest];
        }
        break;
      }
    }
    return out;
  }
  if (o.op === "refused") {
    if (o.msg) io.announce(o.msg);
    return refused(o.reason, o.msg);
  }
  if (o.op === "answer") {
    const inner: Run = { io, agreed: o.agreed, writes: 0, action: o.action };
    const r = step(inner, o.intent, undefined);
    c.writes += inner.writes;
    // Asked again: this question ends as that one does.
    o.settle?.(inner.hold?.settled ?? r);
    return r;
  }
  const s = io.get(),
    p = POLICY[o.op];
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
      c.writes++;
    }
    io.url(p.history);
    if (o.msg) io.announce(o.msg);
  } else {
    const layoutChanged = next.layout !== s.layout,
      viewChanged = !sameView(next.view, s.view);
    // Unsaved work is never lost without asking. A following detail keeps its object instead (it moves on its own
    // while the person browses the list: a question each time would be worse).
    // The host is asked first (beforeClose); its yes still meets Jali's own question about unsaved work.
    const leaving =
      layoutChanged && io.beforeClose && !o.allowed ? leavingPanes(s, next.layout) : [];
    if (leaving.length && !covered(leaving, c.agreed.host)) {
      const answer = ask(io.beforeClose!, {
        panes: leaving,
        reason: CLOSE_REASON[o.op] ?? "layout",
      });
      if (answer === false) return refused("kept");
      const host = [...(c.agreed.host ?? []), ...leaving];
      if (answer !== true) {
        // Allowed later: the intent runs again then, and asks again if it would now remove something else.
        const hold = holdFor(c, f, o, s.layout),
          agreed = { ...c.agreed, host };
        const again: AnswerStep = {
          op: "answer",
          intent: (x) => hold.intent(x),
          agreed,
          action: c.action,
        };
        const settled = answer.then((yes): ActionResult | Promise<ActionResult> => {
          if (!yes) return refused("kept");
          const r = io.later ? io.later(again) : apply(io, again);
          return r.reason === "pending" && r.settled ? r.settled : r;
        });
        hold.settled = settled;
        return { ok: false, reason: "pending", settled };
      }
      c.agreed = { ...c.agreed, host };
    }
    // A pane the host removed has no work left to keep: its object is gone.
    const losing = layoutChanged && o.op !== "remove" ? wouldLoseWork(s, next.layout) : [];
    if (losing.length) {
      if (o.op === "follow")
        return step(
          c,
          refuse("unsaved", say(io.snapshot()).keptUnsaved(s.unsaved[losing[0]!]!)),
          f,
        );
      // `confirmDiscard: false`: the app asked already (beforeClose), so its yes stands.
      if (io.snapshot().env.confirmDiscard !== false) {
        const refs = new Map(core.tree.panes(s.layout.root).map((n) => [n.id, n.ref]));
        const asked = losing.map((pane) => ({ pane, ref: refs.get(pane)! }));
        if (covered(asked, c.agreed.discard)) discarding = losing;
        else {
          const hold = holdFor(c, f, o, s.layout);
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
          return { ok: false, reason: "unsaved", settled };
        }
      }
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
      // The work the person discarded goes in this commit, never before it: an answer that changes nothing keeps it.
      const kept = discarding.length
        ? {
            unsaved: Object.fromEntries(
              Object.entries(s.unsaved).filter(([id]) => !discarding.includes(id)),
            ),
            paneReports: withoutUnsaved(s.paneReports, discarding),
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
      c.writes++;
      io.set({
        layout: next.layout,
        view: layoutChanged || viewChanged ? next.view : s.view,
        ...o.patch,
        ...motion,
        ...pruned,
        undoStack,
      });
      if (layoutChanged) io.committed?.(o.op, c.action);
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
  return o.result === undefined ? DONE : { ok: true, pane: o.result };
}
