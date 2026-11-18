import { altClick, detectPlatform, formatKeys, keyHint } from "@jali/core";
import { store } from "./store";

const platform = detectPlatform();                       // "mac" or "other"
keyHint("Alt+Enter", "mac");                             // "⌥↵"
keyHint("Alt+Enter", "other");                           // "Alt+Enter"
altClick(platform);                                      // "⌥-click" or "Alt-click"
store.keymap.sequences("pane.zoom").map((s) => formatKeys(s, store.keymap.platform));
