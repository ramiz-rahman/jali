import { DEFAULT_SETTINGS, resolveTheme } from "@jali/core";
import { store } from "./store";

// Settings live in the store; changing them is a plain write. startUi saves them and applies the theme.
store.set({ settings: { ...store.get().settings, theme: "dark", paneCap: 6 } });

const s = store.get();
resolveTheme(s.settings.theme, s.systemDark);   // "dark"
DEFAULT_SETTINGS.paneCap;                        // 8
