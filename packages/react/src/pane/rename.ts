/**
 * Renaming in the chrome, when the workspace has the `rename()` feature: whether a pane can be renamed, and the field
 * (features/rename.ts brings it, so a workspace without renaming ships no field).
 */
import type { NodeId } from "@jali/core";
import { canRename, partOf, type JaliStore } from "@jali/core/adapter";
import type { ComponentType } from "react";
import { useStore } from "../state/react";

/** Whether pane `id` can be renamed now (`rename({ can })`), for a double-click to ask. */
export function useCanRename() {
  const store = useStore();
  return (id: NodeId) => canRename(store.snapshot(), id);
}

/** The rename field, if the workspace has renaming. */
export const renameFieldOf = (store: JaliStore) =>
  partOf<ComponentType<{ pane: NodeId; title: string }>>(store.env, "renameField");
