import { formatKeys, keyHint } from "@jali/core";
import { store } from "./store";

keyHint("Alt+Enter", "mac"); // "⌥↵"
keyHint("Alt+Enter", "other"); // "Alt+Enter"
keyHint("Mod+Enter"); // for this platform: "⌘↵" on a Mac, "Ctrl+Enter" elsewhere
store.keymap.sequences("pane.zoom").map((s) => formatKeys(s, store.keymap.platform));
