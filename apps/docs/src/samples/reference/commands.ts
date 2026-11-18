import { commandsOf, copyLink, runCommand } from "@jali/core";
import { store } from "./store";

// A toolbar button that runs a workspace command and shows its keys.
const zoom = commandsOf(store).find((c) => c.id === "pane.zoom")!;
const disabled = !!zoom.check?.(store.snapshot());
const tooltip = `${zoom.title} · ${store.keymap.label(zoom.id)}`; // "Maximise or restore pane · ⇧⌘↵"

function onClick() {
  if (!runCommand(store, "pane.zoom")) console.info("refused");
}

copyLink(store); // the address on the clipboard, and "Link copied" read out
export { disabled, tooltip, onClick };
