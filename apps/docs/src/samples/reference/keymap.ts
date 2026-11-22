import { DEFAULT_KEYMAP, formatKeys } from "jali";
import { store } from "./store";

// The instance's keymap: the defaults, with `keyboard.keymap`'s overrides applied.
store.keymap.label("pane.close"); // "⌘K ⌘W" (rebound in store.ts)
store.keymap.label("pane.split.down"); // "" (unbound)
store.keymap.sequences("pane.zoom").map((s) => formatKeys(s, "other")); // ["Ctrl+Shift+Enter"]
DEFAULT_KEYMAP["pane.split.right"]; // ["Mod+\\"]
