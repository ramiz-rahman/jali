/** The pane a component is inside, for the hooks that act for it (usePane, useCommands, usePaneState, ...). */
import type { NodeId, ObjectRef, OpenBesideOptions } from "@jali/core";
import { createContext, useContext } from "react";
import type { ActionResult, PaneReportPatch } from "@jali/core/adapter";
import type { PaneProps } from "../define";
import type { HeaderSlot } from "./header";

/** What a pane's content can ask of the workspace. */
export interface PaneHost {
  openBeside(ref: ObjectRef, options?: OpenBesideOptions): ActionResult;
  peek(ref: ObjectRef | null): ActionResult;
  select(ref: ObjectRef | null, opts?: { inResults?: boolean }): ActionResult;
  openHere(ref: ObjectRef): ActionResult;
  dismiss(): void;
  /** One caller's report (the pane hooks): `caller` is the hook call's own id, `seq` its order among the pane's
   *  callers, `null` when it unmounts. The workspace merges every caller's (actions/content.ts `reportPane`). */
  report(caller: string, seq: number, patch: PaneReportPatch | null): void;
}

export interface PaneContextValue {
  /** The pane's node id; null in the peek sheet, which keeps nothing. */
  id: NodeId | null;
  host: PaneHost;
  props: PaneProps;
  /** Where useHeaderActions puts the content's controls; absent in the peek sheet, which has no header. */
  header?: HeaderSlot;
}

export const PaneContext = /* @__PURE__ */ createContext<PaneContextValue | null>(null);

export function usePaneContext(hook: string): PaneContextValue {
  const pane = useContext(PaneContext);
  if (!pane) throw new Error(`${hook}() must be called inside a pane's component`);
  return pane;
}
