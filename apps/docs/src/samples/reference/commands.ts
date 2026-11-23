import { copyLink, listCommands, runCommand } from "jali";
import { store } from "./store";

// A toolbar button that runs one of Jali's commands and shows its keys.
const zoom = listCommands(store).find((c) => c.id === "pane.zoom")!;
const disabled = zoom.disabled;
const tooltip = `${zoom.title} · ${zoom.keys}`; // "Maximise or restore pane · ⇧⌘↵"

function onClick() {
  if (!runCommand(store, "pane.zoom")) console.info("refused");
}

copyLink(store); // the address on the clipboard, and "Link copied" read out
export { disabled, tooltip, onClick };
