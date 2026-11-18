import { createKeymap, formatKeys, DEFAULT_KEYMAP } from "@jali/core";

// The same overrides createUiStore takes as `keymap`: rebind, add a second binding, or unbind with null.
const keymap = createKeymap(
  { "pane.zoom": "Mod+K Mod+Enter", "pane.close": ["Mod+K Mod+Backspace", "Mod+K Mod+W"], "pane.tuck": null },
  { platform: "mac", onInvalid: (id, binding, reason) => console.warn(id, binding, reason) },
);

keymap.label("pane.zoom");                 // "⌘K ⌘↵"
keymap.label("pane.tuck");                 // "" (unbound)
keymap.sequences("pane.close").map((s) => formatKeys(s, "other")); // ["Ctrl+K Ctrl+Backspace", "Ctrl+K Ctrl+W"]
DEFAULT_KEYMAP["pane.split.right"];        // ["Mod+\\"]
