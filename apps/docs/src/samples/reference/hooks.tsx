import { useShortcut, useJali, useJaliModel, useJaliState } from "@jali/react";

// A status line: reads exactly what it shows, so it re-renders only when that changes.
export function StatusLine() {
  const focused = useJaliState((s) => s.view.focused);
  const m = useJaliModel();
  const { actions } = useJali();
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
