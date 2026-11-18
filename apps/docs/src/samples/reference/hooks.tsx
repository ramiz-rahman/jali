import { useShortcut, useWorkspace, useWorkspaceModel, useWorkspaceState } from "@jali/react";

// A status line: reads exactly what it shows, so it re-renders only when that changes.
export function StatusLine() {
  const focused = useWorkspaceState((s) => s.view.focused);
  const m = useWorkspaceModel();
  const { actions } = useWorkspace();
  const keys = useShortcut("pane.zoom");
  return (
    <footer>
      {m.visible.length} panes on screen · {m.title(focused)}
      <button title={keys ? `Maximise · ${keys}` : "Maximise"} onClick={() => actions.toggleZoom()}>
        Maximise
      </button>
    </footer>
  );
}
