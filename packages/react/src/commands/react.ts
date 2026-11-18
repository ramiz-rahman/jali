import { useStore } from "../state/react";

/** A command's keys in this workspace's keymap, for a tooltip ("⌘K ⌘[" / "Ctrl+K Ctrl+["); "" when unbound. */
export const useShortcut = (id: string) => useStore().keymap.label(id);
