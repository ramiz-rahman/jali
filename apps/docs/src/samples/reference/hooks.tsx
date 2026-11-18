import { useActions, useModel, useShortcutSuffix, useUi } from "@jali/react";

// A status line: reads exactly what it shows, so it re-renders only when that changes.
export function StatusLine() {
  const focused = useUi((s) => s.view.focused);
  const m = useModel();
  const actions = useActions();
  const keys = useShortcutSuffix("pane.zoom");
  return (
    <footer>
      {m.visible.length} panes on screen · {m.title(focused)}
      <button title={`Maximise${keys}`} onClick={() => actions.toggleZoom()}>Maximise</button>
    </footer>
  );
}
