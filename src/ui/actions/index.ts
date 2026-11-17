/**
 * Every workspace action, pure: `(x: Snapshot, ...args) => Outcome`. `bindActions(store)` gives callers the familiar
 * `actions.close(id)` shape: snapshot, run, apply, and return the action's result (the pane it opened, for example).
 */
import type { NodeId } from "../../layout-core/types";
import type { Outcome, Snapshot } from "../state/apply";
import { focus, focusCycle, focusDirection, focusEnd, focusIndex, toggleZoom } from "./focus";
import { dismiss, newTab, noteOpen, openBeside, openHere, split, splitAuto } from "./open";
import { close, closeOthers, undo } from "./close";
import { putBack, reveal, tuck } from "./tuck";
import { drop, moveDirection, swapWithNext } from "./move";
import { mergeInto, setActiveTab, unmerge } from "./tabs";
import { commitDividerDrag, enterResizeMode, leaveResizeMode, nudgeDivider, resetDivider, resizeDivider, setDividerSize } from "./resize";
import { openPeekFull, peek, pinPeek, select } from "./peek";
import { arrive, preset, resetLayout, setActivity } from "./layout";
import { activate, arrange, backToReview, enterReview, hideRole, leaveReview, resetArrangement, setCanInvestigate, showRole, toggleRole } from "./review";

export const ACTIONS = {
  focus, focusCycle, focusDirection, focusIndex, focusEnd, toggleZoom,
  openBeside, split, splitAuto, openHere, dismiss, newTab, noteOpen,
  close, closeOthers, undo,
  tuck, putBack, reveal,
  moveDirection, drop, swapWithNext,
  mergeInto, unmerge, setActiveTab,
  resizeDivider, setDividerSize, nudgeDivider, commitDividerDrag, resetDivider, enterResizeMode, leaveResizeMode,
  peek, pinPeek, openPeekFull, select,
  preset, resetLayout, arrive, setActivity,
  enterReview, leaveReview, arrange, resetArrangement, activate, backToReview, hideRole, showRole, toggleRole, setCanInvestigate,
};

type Bound<F> = F extends (x: Snapshot, ...args: infer A) => Outcome ? (...args: A) => NodeId | undefined : never;
export type Actions = { [K in keyof typeof ACTIONS]: Bound<(typeof ACTIONS)[K]> };

export function bindActions(store: { snapshot(): Snapshot; apply(o: Outcome): NodeId | undefined }): Actions {
  const out = {} as Record<string, (...args: unknown[]) => NodeId | undefined>;
  for (const [name, fn] of Object.entries(ACTIONS) as [string, (x: Snapshot, ...a: unknown[]) => Outcome][]) {
    out[name] = (...args) => store.apply(fn(store.snapshot(), ...args));
  }
  return out as unknown as Actions;
}
