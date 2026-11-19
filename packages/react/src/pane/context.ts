/** The pane a component is inside, for the hooks that act for it (usePane, useCommands, usePaneState, ...). */
import type { NodeId, ObjectRef, PaneActivity, PaneCommand } from "@jali/core";
import { createContext, useContext } from "react";
import type { PaneAttributes } from "@jali/core/adapter";
import type { PaneProps } from "../define";

/** What a pane's content can ask of the workspace. */
export interface PaneHost {
  openBeside(ref: ObjectRef): void;
  peek(ref: ObjectRef | null): void;
  select(ref: ObjectRef | null, opts?: { inResults?: boolean }): void;
  openHere(ref: ObjectRef): void;
  dismiss(): void;
  setActivity(a: PaneActivity): void;
  setUnsaved(what: string | null): void;
  setCommands(commands: PaneCommand[] | null): void;
  setTitle(title: string | null): void;
  setAttributes(attributes: PaneAttributes | null): void;
}

export interface PaneContextValue {
  /** The pane's node id; null in the peek sheet, which keeps nothing. */
  id: NodeId | null;
  host: PaneHost;
  props: PaneProps;
}

export const PaneContext = createContext<PaneContextValue | null>(null);

export function usePaneContext(hook: string): PaneContextValue {
  const pane = useContext(PaneContext);
  if (!pane) throw new Error(`${hook}() must be called inside a pane's component`);
  return pane;
}
