/**
 * Every step of the engine, pure: `(x: Snapshot, ...args) => Outcome`. `bindActions(store)` gives adapters the
 * `store.actions.close(id)` shape: snapshot, run, apply, and return the pane it opened or acted on, if any. Apps use
 * `jali.actions` (actions/public.ts): the subset an app calls, with one convention and results that say why not.
 */
import type { NodeId } from "../layout/types";
import type { ActionResult, Outcome, Snapshot } from "../state/apply";
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
import {
  activate,
  backToPage,
  openPage,
  hideRole,
  leavePage,
  openTab,
  openTabBeside,
  placeTab,
  resetPage,
  setCanInvestigate,
  setMode,
} from "./page";

export type { PaneReport, PaneReportPatch } from "./content";
export { mergeReports } from "./content";

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
  openPage,
  leavePage,
  setMode,
  openTab,
  openTabBeside,
  placeTab,
  resetPage,
  activate,
  backToPage,
  hideRole,
  setCanInvestigate,
};

type Bound<F> = F extends (x: Snapshot, ...args: infer A) => Outcome
  ? (...args: A) => NodeId | undefined
  : never;
export type Actions = { [K in keyof typeof ACTIONS]: Bound<(typeof ACTIONS)[K]> };

export function bindActions(store: {
  snapshot(): Snapshot;
  apply(o: Outcome): ActionResult;
}): Actions {
  const out = {} as Record<string, (...args: unknown[]) => NodeId | undefined>;
  for (const [name, fn] of Object.entries(ACTIONS) as [
    string,
    (x: Snapshot, ...a: unknown[]) => Outcome,
  ][]) {
    // As a step, so a change held for an answer is the action itself, run again when the answer comes.
    out[name] = (...args) => store.apply((x) => fn(x, ...args)).pane;
  }
  return out as unknown as Actions;
}
