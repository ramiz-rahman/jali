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
import type { Edge, NodeId } from "../layout/types";
import type { OpenPage, PageEngine } from "../profile";
import {
  DONE,
  isChange,
  refuse,
  type ActionResult,
  type Outcome,
  type RefusalStep,
  type Snapshot,
} from "../state/apply";
import type { Settings } from "../state/settings";
import type { JaliStore } from "../state/store";
import { serviceOf } from "../features/feature";
import {
  paneFor,
  type ActionName,
  type JaliActions,
  type JaliDialogs,
  type JaliPage,
  type OpenPageOptions,
  type PaneTarget,
} from "./public";
import * as arg from "./args";
import { checked, type Arg, type ArgsOf, type CheckedStep } from "./args";
import { mapped, refusalOf, uses, type Step, type StepArgsOf } from "./step";
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
import { close, closeOthers, closeTabs, remove, removeClosed, undo } from "./close";
import { putBack, reveal, revealShelf, tuck } from "./tuck";
import { drop, moveDirection, moveOutOfRow, startDrag, swapWithNext } from "./move";
import { setScroll } from "./scroll";
import {
  mergeInto,
  moveTab,
  moveTabToward,
  openMergeChooser,
  setActiveTab,
  setPinned,
  unmerge,
} from "./tabs";
import {
  commitDividerDrag,
  enterResizeMode,
  leaveResizeMode,
  nudgeDivider,
  resetDivider,
  resizeDivider,
  setDividerSize,
} from "./resize";
import { closePeek, openPeekBeside, peek, select } from "./peek";
import { follow, setKept } from "./follow";
import { endRename, startRename } from "./rename";
import { choose, closeChooser, type ChooseOptions } from "./choose";
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
  toggleCentreDrop,
} from "./layout";
import {
  discardAndContinue,
  keepEditing,
  reportPane,
  setActivity,
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
>;

/** A step of the curated page's engine, as a step of the instance: each part is the page's own, and without a page
 *  it is refused (`"unavailable"`). */
function pageStep<K extends keyof PageSteps>(name: K): Step<StepArgsOf<PageSteps[K]>> {
  const of = (x: Snapshot) => x.env.page?.[name] as Step | undefined;
  return {
    check: (x, ...a) => {
      const step = of(x);
      return step ? step.check?.(x, ...a) : refuse("unavailable");
    },
    control: (x, ...a) => of(x)?.control?.(x, ...a) ?? [],
    run: (x, ...a) => of(x)!.run(x, ...a),
  };
}

/** `o`, saying `id` is the pane it acted on unless it says another: `{ ok: true, pane }`, now or once a question it
 *  asked is answered. */
function withPane(o: Outcome, id: NodeId | undefined): Outcome {
  if (!id) return o;
  if (!o) return { op: "patch", result: id };
  if (typeof o === "function") return (x) => withPane(o(x), id);
  if (Array.isArray(o)) return [...o.slice(0, -1), withPane(o[o.length - 1], id)];
  return isChange(o) && o.result === undefined ? { ...o, result: id } : o;
}

type Run<A extends unknown[]> = (x: Snapshot, ...a: A) => Outcome;
const asStep = <A extends unknown[]>(s: Step<A> | Run<A>): Step<A> =>
  typeof s === "function" ? { run: s } : s;

/** `step` on the pane its first argument names (an id, or the object it shows): each of its parts gets the pane's id,
 *  and a pane that isn't there is `"not-found"`. `explicit: false` lets the pane be left out (the step's own default,
 *  the focused pane, then applies). */
function onTarget<A extends unknown[]>(
  given: Step<[NodeId, ...A]> | Run<[NodeId, ...A]>,
  explicit: boolean,
): Step<[PaneTarget | undefined, ...A]> {
  const step = asStep(given);
  // Left out (allowed only where `explicit` is false): undefined, which the step reads as its default.
  const idOf = (x: Snapshot, pane: PaneTarget | undefined) =>
    pane === undefined && !explicit ? undefined : paneFor(x, pane!);
  const missing = (x: Snapshot, pane: PaneTarget | undefined) =>
    (pane !== undefined || explicit) && !idOf(x, pane);
  return {
    check: (x, pane, ...a) =>
      missing(x, pane) ? refuse("not-found") : step.check?.(x, idOf(x, pane)!, ...a),
    ...(step.control
      ? {
          // A pane named but not there asks nothing: the check says not-found, never the focused pane's controls.
          control: (x: Snapshot, pane: PaneTarget | undefined, ...a: A) =>
            missing(x, pane) ? [] : step.control!(x, idOf(x, pane)!, ...a),
        }
      : {}),
    run: (x, pane, ...a) => {
      const id = idOf(x, pane);
      return withPane(step.run(x, id!, ...a), id ?? x.s.view.focused);
    },
  };
}

/** A public step on the pane its first argument names, with `args` checking the rest. */
const onPane = <const A extends readonly Arg<unknown>[]>(
  args: A,
  step: Step<[NodeId, ...ArgsOf<A>]> | Run<[NodeId, ...ArgsOf<A>]>,
): CheckedStep<[PaneTarget, ...ArgsOf<A>]> =>
  // The tuple of a spread of `A` doesn't simplify while `A` is generic: the call sites check the types.
  checked([arg.target, ...args], onTarget(step, true) as never) as never;

/** The same, for a step whose pane may be left out: the step's own default, the focused pane, then applies. */
const onFocused = <const A extends readonly Arg<unknown>[]>(
  args: A,
  step: Step<[NodeId | undefined, ...ArgsOf<A>]> | Run<[NodeId | undefined, ...ArgsOf<A>]>,
): CheckedStep<[PaneTarget?, ...ArgsOf<A>]> =>
  checked([arg.optional(arg.target), ...args], onTarget(step as never, false) as never) as never;

/** "Pop out pane" (with `popOut()`): pane `id` (default: the focused one) in a window of its own, where the browser can.
 *  The window is the adapter's: this step says whether it may open, and the command opens it. */
const popOut: Step<[NodeId?]> = {
  check: (x, id = x.s.view.focused) =>
    !serviceOf(x.env, "popOutWindow")?.can()
      ? refuse("unavailable")
      : !x.m.pane(id)
        ? refuse("not-found")
        : undefined,
  control: uses("popOut"),
  run: () => null,
};

const NONE = [] as const;
// Checks made once, here, so a step passed by name (`closeTabs`) reads its argument types from them.
const TAB_SET = /* @__PURE__ */ arg.oneOf("others", "after");
const MODE = /* @__PURE__ */ arg.oneOf("single", "split");
const REF_OR_NONE = /* @__PURE__ */ arg.nullable(arg.ref);
const SELECT_OPTIONS = /* @__PURE__ */ arg.optional(
  arg.shape({ inResults: /* @__PURE__ */ arg.optional(arg.bool) }),
);

// Made in a function marked pure: each step is a call (`checked`, `onPane`), and an app that never makes an instance
// (the layout tree alone) must be able to drop the whole table.
export const STEPS = /* @__PURE__ */ (() =>
  ({
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
    closePeek: checked(NONE, closePeek),
    select: onPane([REF_OR_NONE, SELECT_OPTIONS], select),
    setKept: onPane([arg.bool], {
      check: ({ m }, id) => (m.pane(id)?.linkedTo ? undefined : refuse("nothing-to-do")),
      run: setKept,
    }),
    split: onFocused([arg.optional(arg.oneOf("right", "bottom"))], split),
    newTab: onFocused(NONE, newTab),
    addTab: onPane([arg.ref], addTab),
    close: onFocused(NONE, close),
    closeOthers: onFocused(NONE, closeOthers),
    closeTabs: onPane([TAB_SET], closeTabs),
    undo: checked(NONE, undo),
    // An object only an undo could bring back is removed from the undo stack (removeClosed).
    remove: checked([arg.target], (x: Snapshot, pane: PaneTarget) => {
      const id = paneFor(x, pane);
      return id ? withPane(remove(x, id), id) : removeClosed(x, pane);
    }),
    tuck: onFocused(NONE, tuck),
    // `preferred`, for adapters: the tab to put back when no pane is named (the one the shelf shows).
    putBack: onFocused([arg.optional(arg.text)], putBack),
    move: onPane(
      [arg.edge],
      mapped(moveDirection, (id: NodeId, direction: Edge): [Edge, NodeId] => [direction, id]),
    ),
    swapWithNext: onFocused(NONE, swapWithNext),
    moveOutOfRow: onFocused(NONE, moveOutOfRow),
    mergeInto: onPane([arg.target], mergeInto),
    unmerge: onFocused(NONE, unmerge),
    moveTab: onPane([arg.integer], moveTab),
    setPinned: onPane([arg.bool], setPinned),
    startRename: onFocused(NONE, startRename),
    preset: checked([arg.text], {
      check: ({ env }, id) =>
        !env.presets.length
          ? refuse("unavailable")
          : env.presets.some((p) => p.id === id)
            ? undefined
            : refuse("not-found"),
      run: preset,
    }),
    resetLayout: checked(NONE, {
      check: ({ env }) => (env.presets.length ? undefined : refuse("unavailable")),
      run: resetLayout,
    }),
    autoLayout: checked(NONE, autoLayout),
    // Each setting is read by `settingsWith`, which refuses a patch it can't use.
    changeSettings: checked([arg.object<Partial<Settings>>()], changeSettings),

    // ---------- jali.page: refused as "unavailable" without a page ----------
    "page.open": checked(
      [arg.optional(arg.shape({ item: arg.optional(arg.item), tab: arg.optional(arg.text) }))],
      mapped(pageStep("open"), (o: OpenPageOptions = {}): [OpenPage] => [
        { item: o.item, tab: o.tab },
      ]),
    ),
    "page.leave": checked(NONE, pageStep("leave")),
    "page.setMode": checked([MODE], pageStep("setMode")),
    "page.showView": checked([arg.text], pageStep("showView")),
    "page.showItem": checked([arg.item], pageStep("showItem")),
    "page.back": checked(NONE, pageStep("back")),
    "page.reset": checked(NONE, pageStep("reset")),

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
    revealShelf: [revealShelf, "focus"],
    setActiveTab: [setActiveTab, "focus"],
    splitAuto: [splitAuto, "split"],
    dismiss: [dismiss, "close"],
    moveDirection: [moveDirection, "move"],
    moveTabToward: [moveTabToward, "moveTab"],
    openPeekBeside: [openPeekBeside, "openBeside"],
    toggleCentreDrop: [toggleCentreDrop, "changeSettings"],
    showViewBeside: [pageStep("showViewBeside"), "page.showView"],
    hideRole: [pageStep("hideRole"), "close"],

    // ---------- adapters: steps no action names ----------
    /** The page from a link, or the page an app starts on: an arrival, which writes no history. */
    arrivePage: [pageStep("open"), null],
    placeTab: [pageStep("placeTab"), null],
    popOut: [popOut, null],
    openMergeChooser: [openMergeChooser, null],
    startDrag: [startDrag, null],
    noteOpen: [noteOpen, null],
    setScroll: [setScroll, null],
    drop: [drop, null],
    endRename: [endRename, null],
    closeChooser: [closeChooser, null],
    resizeDivider: [resizeDivider, null],
    setDividerSize: [setDividerSize, null],
    nudgeDivider: [nudgeDivider, null],
    commitDividerDrag: [commitDividerDrag, null],
    resetDivider: [resetDivider, null],
    enterResizeMode: [enterResizeMode, null],
    leaveResizeMode: [leaveResizeMode, null],
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
  }) as const satisfies Record<string, Step | readonly [Step | Run<any>, ActionName | null]>)(); // eslint-disable-line @typescript-eslint/no-explicit-any

export type Steps = typeof STEPS;
export type StepName = keyof Steps;
type StepOf<E> = E extends readonly [infer S, unknown] ? S : E;
type ArgsOfEntry<S> = S extends (x: Snapshot, ...a: infer A) => Outcome ? A : StepArgsOf<S>;
/** What a step takes after the snapshot. */
export type StepArgs<N extends StepName> = ArgsOfEntry<StepOf<Steps[N]>>;
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
type AllChecked = {
  [N in Public]: Steps[N] extends { args: readonly Arg<unknown>[] } ? true : never;
}[Public];
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
export const isPublicStep = (name: StepName): boolean => !Array.isArray(STEPS[name]);

/** The step `name`, and the public action it is a form of (undefined: none). */
export function stepOf(name: StepName): [Step, ActionName | undefined] {
  const e = STEPS[name] as Step | readonly [Step | Run<unknown[]>, ActionName | null];
  return Array.isArray(e)
    ? [asStep(e[0] as Step | Run<unknown[]>), e[1] ?? undefined]
    : [e as Step, name as ActionName];
}

/** Why step `name` can't run with `args` on snapshot `x` (its arguments, `allow` for its controls, then its check);
 *  undefined when it can. The store runs this before every step. */
export const refusalIn = <N extends StepName>(
  x: Snapshot,
  name: N,
  ...args: StepArgs<N>
): RefusalStep | undefined => refusalOf(x, stepOf(name)[0], args);

/**
 * Whether step `name` can run with `args` now: `{ ok: true }`, or the refusal it would give (`reason`, and `message`
 * when Jali says why), from the same gate the store runs before the step. Without running it: no close guard is
 * asked, and a refusal only known once the work is done (no room, a link too long) shows only when it runs. Commands,
 * header buttons, menus, tabs and drop targets ask this, so none offers what the action refuses.
 */
export function can<N extends StepName>(
  store: Pick<JaliStore, "ended" | "snapshot">,
  name: N,
  ...args: StepArgs<N>
): ActionResult {
  if (store.ended()) return { ok: false, reason: "unavailable" };
  const no = refusalIn(store.snapshot(), name, ...args);
  return no ? { ok: false, reason: no.reason, ...(no.msg ? { message: no.msg } : {}) } : DONE;
}
