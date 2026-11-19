import type { NodeId } from "@jali/core";
import { useStore, useUi } from "../state/react";

/**
 * The unsaved mark: a dot on a pane with unsaved work (`useUnsaved`). Where the element it sits on already says so
 * (a tab's or chip's description) it is decorative; elsewhere it is labelled "Unsaved changes".
 */
export function UnsavedMark({ labelled = false }: { labelled?: boolean }) {
  const label = useStore().messages.pane.unsaved;
  return labelled ? (
    <span className="jali-unsaved" role="img" aria-label={label} title={label} />
  ) : (
    <span className="jali-unsaved" aria-hidden />
  );
}

/** Whether pane `id` has unsaved work. */
export const useUnsavedOf = (id: NodeId) => useUi((s) => !!s.unsaved[id]);
