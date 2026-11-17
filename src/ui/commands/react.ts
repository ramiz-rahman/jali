import { useStore } from "../state/react";

/** A command's keys in this store's keymap, for a tooltip ("⌘K ⌘[" / "Ctrl+K Ctrl+["); "" when unbound. */
export const useShortcut = (id: string) => useStore().keymap.label(id);

/** " · ⌘K ⌘[" for appending to a tooltip, or "" when the command is unbound. */
export const useShortcutSuffix = (id: string) => {
  const k = useShortcut(id);
  return k ? ` · ${k}` : "";
};
