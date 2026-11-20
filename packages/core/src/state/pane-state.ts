/** A pane's own state (usePaneState), kept through the storage port so it survives a reload. */
import type { NodeId } from "../layout/types";
import type { StoragePort } from "../ports";

export type PaneStates = Record<NodeId, Record<string, unknown>>;

const PANE_STATE_KEY = "pane-state";

export function loadPaneState(storage: StoragePort): PaneStates {
  try {
    const v = JSON.parse(storage.get(PANE_STATE_KEY) ?? "{}") as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    // Only a pane's own record of values: anything else stored under a pane is left out.
    return Object.fromEntries(
      Object.entries(v).filter(([, s]) => !!s && typeof s === "object" && !Array.isArray(s)),
    ) as PaneStates;
  } catch {
    return {};
  }
}

export const savePaneState = (storage: StoragePort, state: PaneStates) =>
  storage.set(PANE_STATE_KEY, JSON.stringify(state));
