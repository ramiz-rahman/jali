import { useKeymap } from "../state/hydrated";

/** A command's keys in this instance's keymap, for a tooltip ("⌘K ⌘[" / "Ctrl+K Ctrl+["); "" when unbound. */
export const useJaliShortcut = (id: string) => useKeymap().label(id);
