/**
 * Every step of the engine, pure: `(x: Snapshot, ...args) => Outcome`. `bindActions(store)` gives adapters the
 * `store.actions.close(id)` shape: snapshot, run, apply, and return the pane it opened or acted on, if any. Apps use
 * `jali.actions` (actions/public.ts): the subset an app calls, with one convention and results that say why not.
 */
import type { NodeId } from "../layout/types";
import type { PageEngine } from "../profile";
import { refuse, type ActionResult, type Outcome, type Snapshot } from "../state/apply";
import type { ActionName } from "./public";
import {
  focus,
  focusCycle,
  focusDirection,
  focusEnd,
  focusIndex,
  toggleFullScreen,
  toggleZoom,
} from "./focus";
import { dismiss, newTab, noteOpen, openBeside, openHere, split, splitAuto } from "./open";
import { close, closeOthers, closeTabs, undo } from "./close";
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
import { openPeekFull, peek, openPeekBeside, select } from "./peek";
import { follow, setKept } from "./follow";
import { endRename, startRename } from "./rename";
import {
  arrive,
  changeSettings,
  closePalette,
  closeSettings,
  openPalette,
  openSettings,
  preset,
  resetLayout,
  autoLayout,
  setActivity,
} from "./layout";
import {
  discardAndContinue,
  keepEditing,
  setPaneCommands,
  setPaneAttributes,
  setPaneState,
  setTitle,
  setUnsaved,
  reportPane,
} from "./content";

export type { PaneReport, PaneReportPatch } from "./content";
export { mergeReports } from "./content";

/** The curated page's steps (actions/page.ts), which the workspace reaches through its page's engine. */
export type PageSteps = Pick<
  PageEngine,
  | "openPage"
  | "leavePage"
  | "setMode"
  | "openTab"
  | "openTabBeside"
  | "placeTab"
  | "resetPage"
  | "activate"
  | "backToPage"
  | "hideRole"
  | "setCanInvestigate"
>;
type Rest<F> = F extends (x: Snapshot, ...args: infer A) => Outcome ? A : never;

/** A step of the curated page's engine, as a step of the workspace: refused (`"unavailable"`) without a page. */
export const pageStep =
  <K extends keyof PageSteps>(name: K) =>
  (x: Snapshot, ...args: Rest<PageSteps[K]>): Outcome => {
    const step = x.env.page?.[name] as ((x: Snapshot, ...a: unknown[]) => Outcome) | undefined;
    return step ? step(x, ...args) : refuse("unavailable");
  };

export const ACTIONS = {
  focus,
  focusCycle,
  focusDirection,
  focusIndex,
  focusEnd,
  toggleZoom,
  toggleFullScreen,
  openBeside,
  split,
  splitAuto,
  openHere,
  dismiss,
  newTab,
  noteOpen,
  close,
  closeOthers,
  closeTabs,
  undo,
  tuck,
  putBack,
  reveal,
  moveDirection,
  moveOutOfRow,
  setScroll,
  drop,
  swapWithNext,
  mergeInto,
  unmerge,
  moveTab,
  moveTabToward,
  setPinned,
  startRename,
  endRename,
  setActiveTab,
  resizeDivider,
  setDividerSize,
  nudgeDivider,
  commitDividerDrag,
  resetDivider,
  enterResizeMode,
  leaveResizeMode,
  peek,
  openPeekBeside,
  openPeekFull,
  select,
  follow,
  setKept,
  preset,
  resetLayout,
  autoLayout,
  arrive,
  setActivity,
  openPalette,
  closePalette,
  openSettings,
  closeSettings,
  changeSettings,
  setUnsaved,
  setPaneCommands,
  setPaneState,
  setTitle,
  setPaneAttributes,
  reportPane,
  discardAndContinue,
  keepEditing,
  openPage: pageStep("openPage"),
  leavePage: pageStep("leavePage"),
  setMode: pageStep("setMode"),
  openTab: pageStep("openTab"),
  openTabBeside: pageStep("openTabBeside"),
  placeTab: pageStep("placeTab"),
  resetPage: pageStep("resetPage"),
  activate: pageStep("activate"),
  backToPage: pageStep("backToPage"),
  hideRole: pageStep("hideRole"),
  setCanInvestigate: pageStep("setCanInvestigate"),
};

/**
 * What the `layout` event calls an engine step: the public action it is a form of (a click on a tab is `focus`), or
 * `null` for a step no action names (a drag, a divider, a list's detail following it, what a pane reports). A step not
 * listed has its public action's name.
 */
const NAMED_AS = {
  focusCycle: "focus",
  focusDirection: "focus",
  focusIndex: "focus",
  focusEnd: "focus",
  reveal: "focus",
  setActiveTab: "focus",
  splitAuto: "split",
  dismiss: "close",
  moveDirection: "move",
  moveTabToward: "moveTab",
  openPeekBeside: "openBeside",
  openTabBeside: "openTab",
  hideRole: "close",
  noteOpen: null,
  setScroll: null,
  drop: null,
  endRename: null,
  resizeDivider: null,
  setDividerSize: null,
  nudgeDivider: null,
  commitDividerDrag: null,
  resetDivider: null,
  enterResizeMode: null,
  leaveResizeMode: null,
  openPeekFull: null,
  follow: null,
  arrive: null,
  setActivity: null,
  setUnsaved: null,
  setPaneCommands: null,
  setPaneState: null,
  setTitle: null,
  setPaneAttributes: null,
  reportPane: null,
  discardAndContinue: null,
  keepEditing: null,
  placeTab: null,
} as const satisfies Partial<Record<keyof typeof ACTIONS, ActionName | null>>;
/** Every engine step NAMED_AS leaves out is a public action of the same name. */
type Unnamed = Exclude<keyof typeof ACTIONS, keyof typeof NAMED_AS>;
const _sameNames: Unnamed extends ActionName ? true : never = true;
void _sameNames;

type Bound<F> = F extends (x: Snapshot, ...args: infer A) => Outcome
  ? (...args: A) => NodeId | undefined
  : never;
export type Actions = { [K in keyof typeof ACTIONS]: Bound<(typeof ACTIONS)[K]> };

export function bindActions(store: {
  snapshot(): Snapshot;
  apply(o: Outcome, action?: ActionName): ActionResult;
}): Actions {
  const out = {} as Record<string, (...args: unknown[]) => NodeId | undefined>;
  for (const [name, fn] of Object.entries(ACTIONS) as [
    string,
    (x: Snapshot, ...a: unknown[]) => Outcome,
  ][]) {
    // As a step, so a change held for an answer is the action itself, run again when the answer comes.
    const as = Object.hasOwn(NAMED_AS, name)
      ? (NAMED_AS[name as keyof typeof NAMED_AS] ?? undefined)
      : (name as ActionName);
    out[name] = (...args) => store.apply((x) => fn(x, ...args), as).pane;
  }
  return out as unknown as Actions;
}
