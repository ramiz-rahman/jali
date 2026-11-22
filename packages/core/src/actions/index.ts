/**
 * Every action, in one table: each step is pure, `(x: Snapshot, ...args) => Outcome`, and names the public action it
 * is a form of. A step on its own is the public action of its name (`jali.actions.close`; a name with a group,
 * `"page.showView"`, is `jali.page.showView`). A step written `[step, name]` is a form of the action `name` (a focus
 * key is a form of `focus`), or of none (`null`: a drag, a divider, what a pane reports). The `layout` event says
 * that name, whoever ran the step.
 *
 * Apps, adapters, keys, commands and the agent all go through the same `run(name, ...args)` (the store's), which
 * commits the step once and returns its `ActionResult`, refusals and all.
 */
import type { Edge, NodeId, ObjectRef } from "../layout/types";
import type { PageEngine } from "../profile";
import { refuse, type ActionResult, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { checkRef } from "../pane-kinds";
import { paneFor, type ActionName, type OpenPageOptions, type PaneTarget } from "./public";
import {
  focusCycle,
  focusDirection,
  focusEnd,
  focusIndex,
  focusShown,
  toggleFullScreen,
  toggleZoom,
} from "./focus";
import {
  addTab,
  dismiss,
  newTab,
  noteOpen,
  openBeside,
  openHere,
  split,
  splitAuto,
  type OpenBesideOptions,
} from "./open";
import { close, closeOthers, closeTabs, remove, undo } from "./close";
import { putBack, reveal, tuck } from "./tuck";
import { drop, moveDirection, moveOutOfRow, swapWithNext } from "./move";
import { setScroll } from "./scroll";
import { mergeInto, moveTab, moveTabToward, setActiveTab, setPinned, unmerge } from "./tabs";
import {
  commitDividerDrag,
  enterResizeMode,
  leaveResizeMode,
  nudgeDivider,
  resetDivider,
  resizeDivider,
  setDividerSize,
} from "./resize";
import { openPeekBeside, openPeekFull, peek, select } from "./peek";
import { follow, setKept } from "./follow";
import { endRename, startRename } from "./rename";
import { choose, type ChooseOptions } from "./choose";
import {
  arrive,
  autoLayout,
  changeSettings,
  closePalette,
  closeSettings,
  openPalette,
  openSettings,
  preset,
  resetLayout,
  setActivity,
} from "./layout";
import {
  discardAndContinue,
  keepEditing,
  reportPane,
  setPaneAttributes,
  setPaneCommands,
  setPaneState,
  setTitle,
  setUnsaved,
} from "./content";

export type { PaneReport, PaneReportPatch } from "./content";
export { mergeReports } from "./content";

/** The curated page's steps (actions/page.ts), which the workspace reaches through its page's engine. */
export type PageSteps = Pick<
  PageEngine,
  | "open"
  | "leave"
  | "setMode"
  | "showView"
  | "showViewBeside"
  | "placeTab"
  | "reset"
  | "showItem"
  | "back"
  | "hideRole"
  | "setLinkMode"
>;
type Rest<F> = F extends (x: Snapshot, ...args: infer A) => Outcome ? A : never;

/** A step of the curated page's engine, as a step of the workspace: refused (`"unavailable"`) without a page. */
const pageStep =
  <K extends keyof PageSteps>(name: K) =>
  (x: Snapshot, ...args: Rest<PageSteps[K]>): Outcome => {
    const step = x.env.page?.[name] as ((x: Snapshot, ...a: unknown[]) => Outcome) | undefined;
    return step ? step(x, ...args) : refuse("unavailable");
  };

/** What is wrong with `ref`, in the workspace's words; undefined when nothing is. `known: false`: any kind will do. */
function refProblem(x: Snapshot, ref: unknown, known = true): string | undefined {
  if (checkRef(x.env.kinds, ref, { known: false })) return say(x).invalidRef;
  return known && checkRef(x.env.kinds, ref)
    ? say(x).unknownKind((ref as ObjectRef).kind)
    : undefined;
}

/** `o`, saying `id` is the pane it acted on unless it says another: `{ ok: true, pane }`, now or once a question it
 *  asked is answered. */
function withPane(o: Outcome, id: NodeId | undefined): Outcome {
  if (!id) return o;
  if (!o) return { op: "patch", result: id };
  if (typeof o === "function") return (x) => withPane(o(x), id);
  if (Array.isArray(o)) return [...o.slice(0, -1), withPane(o[o.length - 1], id)];
  return o.op === "refused" || o.op === "answer" || o.result !== undefined
    ? o
    : { ...o, result: id };
}

/**
 * A public step on the pane `target` names: an id, or the object it shows. Nothing it is given makes it throw: a pane
 * named by something that is neither is `"invalid"`, as is the ref at `refAt` among the rest when it isn't one of the
 * workspace's kinds.
 */
const onPane =
  <A extends unknown[]>(
    step: (x: Snapshot, id: NodeId, ...a: A) => Outcome,
    refAt?: number,
    orNull?: boolean,
  ) =>
  (x: Snapshot, target: PaneTarget, ...a: A): Outcome =>
    run(x, target, a, step, refAt, orNull);

/** The same, where no target is the step's own default: the focused pane. */
const onFocused =
  <A extends unknown[]>(step: (x: Snapshot, id: NodeId | undefined, ...a: A) => Outcome) =>
  (x: Snapshot, target?: PaneTarget, ...a: A): Outcome =>
    target === undefined
      ? withPane(step(x, undefined, ...a), x.s.view.focused)
      : run(x, target, a, step);

function run<A extends unknown[]>(
  x: Snapshot,
  target: PaneTarget,
  a: A,
  step: (x: Snapshot, id: NodeId, ...a: A) => Outcome,
  refAt?: number,
  orNull?: boolean,
): Outcome {
  const ref = refAt === undefined ? undefined : a[refAt];
  const problem =
    (typeof target === "string" ? undefined : refProblem(x, target, false)) ??
    (refAt === undefined || (orNull && ref === null) ? undefined : refProblem(x, ref));
  if (problem) return refuse("invalid", problem);
  const id = paneFor(x, target);
  return id ? withPane(step(x, id, ...a), id) : refuse("not-found");
}

const EDGES: readonly unknown[] = ["left", "right", "top", "bottom"];

type Step = (x: Snapshot, ...args: any[]) => Outcome; // eslint-disable-line @typescript-eslint/no-explicit-any

export const STEPS = {
  // ---------- jali.actions ----------
  focus: onPane(focusShown),
  toggleZoom: onFocused(toggleZoom),
  toggleFullScreen: onFocused(toggleFullScreen),
  openBeside: onPane(
    (x, id, ref: ObjectRef, options?: OpenBesideOptions) =>
      options?.edge !== undefined && !EDGES.includes(options.edge)
        ? refuse("invalid")
        : openBeside(x, id, ref, options?.edge ? { edge: options.edge } : {}),
    0,
  ),
  openHere: onPane((x, id, ref: ObjectRef) => openHere(x, id, ref), 0),
  peek: onPane((x, id, ref: ObjectRef) => peek(x, ref, id), 0),
  closePeek: (x: Snapshot): Outcome => (x.s.view.peek ? peek(x, null) : null),
  select: onPane(
    (x, id, ref: ObjectRef | null, options?: { inResults?: boolean }) =>
      select(x, id, ref, options),
    0,
    true,
  ),
  setKept: onPane((x, id, kept: boolean) =>
    x.m.pane(id)?.linkedTo ? setKept(x, id, kept) : refuse("nothing-to-do"),
  ),
  split: onFocused((x, id, direction?: "right" | "bottom") => {
    const target = id ?? x.s.view.focused;
    const box = x.m.resolved.panes.find((b) => b.id === target);
    const dir = direction ?? (box && box.rect.height > box.rect.width ? "bottom" : "right");
    return target ? split(x, dir, target) : refuse("not-found");
  }),
  newTab: onFocused((x, id) => newTab(x, id ?? x.s.view.focused)),
  addTab: onPane((x, id, ref: ObjectRef) => addTab(x, id, ref), 0),
  close: onFocused((x, id) => ((id ?? x.s.view.focused) ? close(x, id) : refuse("not-found"))),
  closeOthers: onFocused(closeOthers),
  closeTabs: onPane((x, id, which: "others" | "after") => closeTabs(x, id, which)),
  undo,
  remove: onPane(remove),
  tuck: onFocused(tuck),
  // `preferred`, for adapters: the tab to put back when no pane is named (the one the shelf shows).
  putBack: onFocused((x, id, preferred?: NodeId) => putBack(x, id, preferred)),
  move: onPane((x, id, direction: Edge) => moveDirection(x, direction, id)),
  swapWithNext: onFocused(swapWithNext),
  moveOutOfRow: onFocused(moveOutOfRow),
  mergeInto: onPane((x, id, into: PaneTarget) => {
    const other = paneFor(x, into);
    return other ? mergeInto(x, id, other) : refuse("not-found");
  }),
  unmerge: onFocused(unmerge),
  moveTab: onPane((x, id, index: number) => moveTab(x, id, index)),
  setPinned: onPane((x, id, pinned: boolean) => setPinned(x, id, pinned)),
  startRename: onFocused(startRename),
  preset: (x: Snapshot, id: string): Outcome =>
    !x.env.presets.length
      ? refuse("unavailable")
      : x.env.presets.some((p) => p.id === id)
        ? preset(x, id)
        : refuse("not-found"),
  resetLayout: (x: Snapshot): Outcome =>
    x.env.presets.length ? resetLayout(x) : refuse("unavailable"),
  autoLayout,
  changeSettings,

  // ---------- jali.page: refused as "unavailable" without a page ----------
  "page.open": (x: Snapshot, o: OpenPageOptions = {}): Outcome =>
    pageStep("open")(x, { item: o.item, tab: o.tab }),
  "page.leave": (x: Snapshot): Outcome => (x.s.page ? pageStep("leave")(x) : null),
  "page.setMode": pageStep("setMode"),
  "page.showView": pageStep("showView"),
  "page.showItem": pageStep("showItem"),
  "page.back": pageStep("back"),
  "page.reset": pageStep("reset"),
  "page.setLinkMode": pageStep("setLinkMode"),

  // ---------- jali.dialogs ----------
  "dialogs.choose": (x: Snapshot, options: ChooseOptions<unknown>) => choose(x, options),
  "dialogs.openPalette": openPalette,
  "dialogs.closePalette": closePalette,
  "dialogs.openSettings": openSettings,
  "dialogs.closeSettings": closeSettings,

  // ---------- adapters: forms of a public action ----------
  focusCycle: [focusCycle, "focus"],
  focusDirection: [focusDirection, "focus"],
  focusIndex: [focusIndex, "focus"],
  focusEnd: [focusEnd, "focus"],
  reveal: [reveal, "focus"],
  setActiveTab: [setActiveTab, "focus"],
  splitAuto: [splitAuto, "split"],
  dismiss: [dismiss, "close"],
  moveDirection: [moveDirection, "move"],
  moveTabToward: [moveTabToward, "moveTab"],
  openPeekBeside: [openPeekBeside, "openBeside"],
  showViewBeside: [pageStep("showViewBeside"), "page.showView"],
  hideRole: [pageStep("hideRole"), "close"],

  // ---------- adapters: steps no action names ----------
  /** The page from a link, or the page an app starts on: an arrival, which writes no history. */
  arrivePage: [pageStep("open"), null],
  placeTab: [pageStep("placeTab"), null],
  noteOpen: [noteOpen, null],
  setScroll: [setScroll, null],
  drop: [drop, null],
  endRename: [endRename, null],
  resizeDivider: [resizeDivider, null],
  setDividerSize: [setDividerSize, null],
  nudgeDivider: [nudgeDivider, null],
  commitDividerDrag: [commitDividerDrag, null],
  resetDivider: [resetDivider, null],
  enterResizeMode: [enterResizeMode, null],
  leaveResizeMode: [leaveResizeMode, null],
  openPeekFull: [openPeekFull, null],
  follow: [follow, null],
  arrive: [arrive, null],
  setActivity: [setActivity, null],
  setUnsaved: [setUnsaved, null],
  setPaneCommands: [setPaneCommands, null],
  setPaneState: [setPaneState, null],
  setTitle: [setTitle, null],
  setPaneAttributes: [setPaneAttributes, null],
  reportPane: [reportPane, null],
  discardAndContinue: [discardAndContinue, null],
  keepEditing: [keepEditing, null],
} as const satisfies Record<string, Step | readonly [Step, ActionName | null]>;

export type Steps = typeof STEPS;
export type StepName = keyof Steps;
type StepOf<E> = E extends readonly [infer S, unknown] ? S : E;
/** What a step takes after the snapshot. */
export type StepArgs<N extends StepName> = Rest<StepOf<Steps[N]>>;
/** The steps an adapter calls by name on `store.actions`: every step without a group, through `run`. */
export type Actions = {
  [N in StepName as N extends `${string}.${string}` ? never : N]: (
    ...args: StepArgs<N>
  ) => ActionResult;
};

/** Every step written on its own is a public action, and every public action but `setLayout` is one. */
type Public = { [N in StepName]: Steps[N] extends readonly unknown[] ? never : N }[StepName];
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export type OneNamePerAction = Same<Public, Exclude<ActionName, "setLayout">>;
const oneNamePerAction: OneNamePerAction = true;
void oneNamePerAction;

/** The step `name`, and the public action it is a form of (undefined: none). */
export function stepOf(name: StepName): [Step, ActionName | undefined] {
  const e = STEPS[name] as Step | readonly [Step, ActionName | null];
  return typeof e === "function" ? [e, name as ActionName] : [e[0], e[1] ?? undefined];
}
