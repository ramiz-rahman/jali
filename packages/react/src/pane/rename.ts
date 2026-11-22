/**
 * Renaming in the chrome, when the instance has the `rename()` feature: whether a pane can be renamed, and the field
 * (features/rename.ts brings it, so an instance without renaming ships no field).
 */
import type { NodeId } from "@jali/core";
import { canRename, type JaliStore } from "@jali/core/adapter";
import { partOf } from "../features/feature-parts";
import { useStore } from "../state/react";

/** Whether pane `id` can be renamed now (`rename({ can })`), for a double-click to ask. */
export function useCanRename() {
  const store = useStore();
  return (id: NodeId) => canRename(store.snapshot(), id);
}

/** The rename field, if the instance has renaming. */
export const renameFieldOf = (store: JaliStore) =>
  partOf(store.env, "renameField");
