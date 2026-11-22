import { useJaliShortcut, useJali } from "jali/react";

/** A button in your own chrome that runs one of Jali's actions and shows its key from the keymap. */
export function CloseButton() {
  const { actions } = useJali();
  const keys = useJaliShortcut("pane.close"); // "⌘K ⌘⌫", or "" when unbound
  return (
    <button onClick={() => actions.close()} title={keys ? `Close pane · ${keys}` : "Close pane"}>
      Close {keys ? <kbd>{keys}</kbd> : null}
    </button>
  );
}
