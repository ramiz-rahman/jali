/** A pane's own state (usePaneState), kept through the storage port so it survives a reload. */
import type { NodeId } from "../layout/types";
import type { StoragePort } from "../ports";

export type PaneStates = Record<NodeId, Record<string, unknown>>;

const PANE_STATE_KEY = "pane-state";

export function loadPaneState(storage: StoragePort): PaneStates {
  try {
    const v = JSON.parse(storage.get(PANE_STATE_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as PaneStates) : {};
  } catch {
    return {};
  }
}

export const savePaneState = (storage: StoragePort, state: PaneStates) => storage.set(PANE_STATE_KEY, JSON.stringify(state));
