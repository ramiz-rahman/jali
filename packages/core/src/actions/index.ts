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
import type { NodeId } from "../layout/types";
import type { PageEngine } from "../profile";
import { refuse, type ActionResult, type Outcome, type Snapshot } from "../state/apply";
import type { Settings } from "../state/settings";
import {
  paneFor,
  type ActionName,
  type JaliActions,
  type JaliDialogs,
  type JaliPage,
  type PaneTarget,
} from "./public";
import * as arg from "./args";
import { checked, type Arg, type ArgsOf, type CheckedStep } from "./args";
import {
  focusCycle,
  focusDirection,
  focusEnd,
  focusIndex,
  focus,
  focusShown,
  toggleFullScreen,
  toggleZoom,
} from "./focus";
import { addTab, dismiss, newTab, noteOpen, openBeside, openHere, split, splitAuto } from "./open";
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

/** The curated page's steps (actions/page.ts), which the instance reaches through its page's engine. */
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

/** A step of the curated page's engine, as a step of the instance: refused (`"unavailable"`) without a page. */
const pageStep =
  <K extends keyof PageSteps>(name: K) =>
  (x: Snapshot, ...args: Rest<PageSteps[K]>): Outcome => {
    const step = x.env.page?.[name] as ((x: Snapshot, ...a: unknown[]) => Outcome) | undefined;
    return step ? step(x, ...args) : refuse("unavailable");
  };

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

/** The pane `pane` names, and `step` run on it; `"not-found"` when there is none. */
function onTarget(x: Snapshot, pane: PaneTarget, run: (id: NodeId) => Outcome): Outcome {
  const id = paneFor(x, pane);
  return id ? withPane(run(id), id) : refuse("not-found");
}

/** A public step on the pane its first argument names (an id, or the object it shows), with `args` checking the rest:
 *  the step gets the pane's id, and a pane that isn't there is `"not-found"`. */
const onPane = <const A extends readonly Arg<unknown>[]>(
  args: A,
  step: (x: Snapshot, id: NodeId, ...a: ArgsOf<A>) => Outcome,
): CheckedStep<[PaneTarget, ...ArgsOf<A>]> =>
  // The tuple of a spread of `A` doesn't simplify while `A` is generic: the call sites check the types.
  checked([arg.target, ...args], ((x: Snapshot, pane: PaneTarget, ...a: ArgsOf<A>) =>
    onTarget(x, pane, (id) => step(x, id, ...a))) as never) as never;

/** The same, for a step whose pane may be left out: the step's own default, the focused pane, then applies. */
const onFocused = <const A extends readonly Arg<unknown>[]>(
  args: A,
  step: (x: Snapshot, id: NodeId | undefined, ...a: ArgsOf<A>) => Outcome,
): CheckedStep<[PaneTarget?, ...ArgsOf<A>]> =>
  checked([arg.optional(arg.target), ...args], ((
    x: Snapshot,
    pane: PaneTarget | undefined,
    ...a: ArgsOf<A>
  ) =>
    pane === undefined
      ? withPane(step(x, undefined, ...a), x.s.view.focused)
      : onTarget(x, pane, (id) => step(x, id, ...a))) as never) as never;

type Step = (x: Snapshot, ...args: any[]) => Outcome; // eslint-disable-line @typescript-eslint/no-explicit-any

const NONE = [] as const;
// Checks made once, here, so a step passed by name (`closeTabs`) reads its argument types from them.
const TAB_SET = /* @__PURE__ */ arg.oneOf("others", "after");
const REF_OR_NONE = /* @__PURE__ */ arg.nullable(arg.ref);
const SELECT_OPTIONS = /* @__PURE__ */ arg.optional(
  arg.shape({ inResults: /* @__PURE__ */ arg.optional(arg.bool) }),
);

export const STEPS = {
  // ---------- jali.actions ----------
  focus: onPane(NONE, focusShown),
  toggleZoom: onFocused(NONE, toggleZoom),
  toggleFullScreen: onFocused(NONE, toggleFullScreen),
  openBeside: onPane(
    [arg.ref, arg.optional(arg.shape({ edge: arg.optional(arg.edge) }))],
    (x, id, ref, options) => openBeside(x, id, ref, options?.edge ? { edge: options.edge } : {}),
  ),
  openHere: onPane([arg.ref], openHere),
  peek: onPane([arg.ref], (x, id, ref) => peek(x, ref, id)),
  closePeek: checked(NONE, (x) => (x.s.view.peek ? peek(x, null) : null)),
  select: onPane([REF_OR_NONE, SELECT_OPTIONS], select),
  setKept: onPane([arg.bool], (x, id, kept) =>
    x.m.pane(id)?.linkedTo ? setKept(x, id, kept) : refuse("nothing-to-do"),
  ),
  split: onFocused([arg.optional(arg.oneOf("right", "bottom"))], (x, id, direction) => {
    const target = id ?? x.s.view.focused;
    const box = x.m.resolved.panes.find((b) => b.id === target);
    const dir = direction ?? (box && box.rect.height > box.rect.width ? "bottom" : "right");
    return target ? split(x, dir, target) : refuse("not-found");
  }),
  newTab: onFocused(NONE, (x, id) => newTab(x, id ?? x.s.view.focused)),
  addTab: onPane([arg.ref], addTab),
  close: onFocused(NONE, (x, id) =>
    (id ?? x.s.view.focused) ? close(x, id) : refuse("not-found"),
  ),
  closeOthers: onFocused(NONE, closeOthers),
  closeTabs: onPane([TAB_SET], closeTabs),
  undo: checked(NONE, undo),
  remove: onPane(NONE, remove),
  tuck: onFocused(NONE, tuck),
  // `preferred`, for adapters: the tab to put back when no pane is named (the one the shelf shows).
  putBack: onFocused([arg.optional(arg.text)], putBack),
  move: onPane([arg.edge], (x, id, direction) => moveDirection(x, direction, id)),
  swapWithNext: onFocused(NONE, swapWithNext),
  moveOutOfRow: onFocused(NONE, moveOutOfRow),
  mergeInto: onPane([arg.target], (x, id, into) => {
    const other = paneFor(x, into);
    return other ? mergeInto(x, id, other) : refuse("not-found");
  }),
  unmerge: onFocused(NONE, unmerge),
  moveTab: onPane([arg.integer], moveTab),
  setPinned: onPane([arg.bool], setPinned),
  startRename: onFocused(NONE, startRename),
  preset: checked([arg.text], (x, id) =>
    !x.env.presets.length
      ? refuse("unavailable")
      : x.env.presets.some((p) => p.id === id)
        ? preset(x, id)
        : refuse("not-found"),
  ),
  resetLayout: checked(NONE, (x) =>
    x.env.presets.length ? resetLayout(x) : refuse("unavailable"),
  ),
  autoLayout: checked(NONE, autoLayout),
  // Each setting is read by `settingsWith`, which refuses a patch it can't use.
  changeSettings: checked([arg.object<Partial<Settings>>()], changeSettings),

  // ---------- jali.page: refused as "unavailable" without a page ----------
  "page.open": checked(
    [arg.optional(arg.shape({ item: arg.optional(arg.item), tab: arg.optional(arg.text) }))],
    (x, o = {}) => pageStep("open")(x, { item: o.item, tab: o.tab }),
  ),
  "page.leave": checked(NONE, (x) => (x.s.page ? pageStep("leave")(x) : null)),
  "page.setMode": checked([arg.oneOf("single", "split")], pageStep("setMode")),
  "page.showView": checked([arg.text], pageStep("showView")),
  "page.showItem": checked([arg.item], pageStep("showItem")),
  "page.back": checked(NONE, pageStep("back")),
  "page.reset": checked(NONE, pageStep("reset")),
  "page.setLinkMode": checked([arg.oneOf("open", "peek")], pageStep("setLinkMode")),

  // ---------- jali.dialogs ----------
  // The request's items and callback are read by `choose`, which refuses one it can't use.
  "dialogs.choose": checked([arg.object<ChooseOptions<unknown>>()], choose),
  "dialogs.openPalette": checked(NONE, openPalette),
  "dialogs.closePalette": checked(NONE, closePalette),
  "dialogs.openSettings": checked(NONE, openSettings),
  "dialogs.closeSettings": checked(NONE, closeSettings),

  // ---------- adapters: forms of a public action ----------
  /** Focus only, as a click in a pane does: no tab is chosen, so nothing in the address changes. */
  focusPane: [focus, "focus"],
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

/** Every public action checks what it is given before its step runs (actions/args.ts). */
type AllChecked = { [N in Public]: Steps[N] extends CheckedStep<never> ? true : never }[Public];
const allChecked: AllChecked = true;
void allChecked;

/** The public interface's method for a public step's name. */
type PublicMethod<N extends Public> = N extends `page.${infer K extends keyof JaliPage}`
  ? JaliPage[K]
  : N extends `dialogs.${infer K extends keyof JaliDialogs}`
    ? JaliDialogs[K]
    : N extends keyof JaliActions
      ? JaliActions[N]
      : never;
/** Each public action takes, in `jali.actions`, `jali.page` and `jali.dialogs`, exactly what its step takes. */
type SameArgs = {
  [N in Public]: Same<Parameters<PublicMethod<N>>, StepArgs<N>>;
}[Public];
const sameArgs: SameArgs = true;
void sameArgs;

/**
 * Calls for the steps `keyOf` names, each through `run` (the store's): `keyOf` gives a step's key in the object made,
 * or undefined to leave it out. The store's `actions` and the instance's `jali.actions`, `jali.page` and
 * `jali.dialogs` are each one of these, so every way in calls the same `run` with the same arguments.
 */
export function bindSteps(
  run: <N extends StepName>(name: N, ...args: StepArgs<N>) => ActionResult,
  keyOf: (name: StepName) => string | undefined,
): Record<string, (...args: never[]) => ActionResult> {
  // Each call passes its arguments on as they came: `run` checks them (a public step's `args`) before its step runs.
  const call = run as (name: StepName, ...args: unknown[]) => ActionResult;
  const out: Record<string, (...args: never[]) => ActionResult> = {};
  for (const name of Object.keys(STEPS) as StepName[]) {
    const key = keyOf(name);
    if (key !== undefined) out[key] = (...args) => call(name, ...args);
  }
  return Object.freeze(out);
}

/** Whether `name` is a public action's step (written on its own in the table, not as a form of one). */
export const isPublicStep = (name: StepName): boolean => typeof STEPS[name] === "function";

/** The step `name`, and the public action it is a form of (undefined: none). */
export function stepOf(name: StepName): [Step, ActionName | undefined] {
  const e = STEPS[name] as Step | readonly [Step, ActionName | null];
  return typeof e === "function" ? [e, name as ActionName] : [e[0], e[1] ?? undefined];
}
