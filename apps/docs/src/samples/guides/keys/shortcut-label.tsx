import { useActions, useShortcut, useShortcutSuffix } from "@jali/react";

/** A button in your own chrome that runs a workspace action and shows the store's key for it. */
export function CloseButton() {
  const actions = useActions();
  const keys = useShortcut("pane.close");          // "⌘K ⌘⌫", or "" when unbound
  const suffix = useShortcutSuffix("pane.close");  // " · ⌘K ⌘⌫", or ""
  return (
    <button onClick={() => actions.close()} title={`Close pane${suffix}`}>
      Close {keys ? <kbd>{keys}</kbd> : null}
    </button>
  );
}
