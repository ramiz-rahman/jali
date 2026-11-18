import { useShortcut, useWorkspace } from "@jali/react";

/** A button in your own chrome that runs a workspace action and shows the workspace's key for it. */
export function CloseButton() {
  const { actions } = useWorkspace();
  const keys = useShortcut("pane.close"); // "⌘K ⌘⌫", or "" when unbound
  return (
    <button onClick={() => actions.close()} title={keys ? `Close pane · ${keys}` : "Close pane"}>
      Close {keys ? <kbd>{keys}</kbd> : null}
    </button>
  );
}
