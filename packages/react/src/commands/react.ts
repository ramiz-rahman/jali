import { useMemo } from "react";
import { listCommands, type ListedCommand } from "@jali/core/adapter";
import { useModel, useStore, useUi } from "../state/react";

/** A command's keys in this workspace's keymap, for a tooltip ("⌘K ⌘[" / "Ctrl+K Ctrl+["); "" when unbound. */
export const useShortcut = (id: string) => useStore().keymap.label(id);

/**
 * Jali's commands for your own command menu (cmdk, kbar, …), when the workspace is made with `palette: false`:
 * the focused pane's own commands first, then the workspace's and yours, each with its title, group, keys label,
 * whether it can run now and why not, and `run`. Re-renders when the list can change.
 *
 *   const commands = useJaliCommands();
 *   <Command.Item disabled={c.disabled} onSelect={() => { close(); c.run(); }}>{c.title}</Command.Item>
 */
export function useJaliCommands(): ListedCommand[] {
  const store = useStore();
  const state = useUi((s) => s);
  const model = useModel();
  return useMemo(() => listCommands(store), [store, state, model]);
}
