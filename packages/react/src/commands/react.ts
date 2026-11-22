import type { ListedCommand } from "@jali/core";
import { listCommands } from "@jali/core/adapter";
import { useDerived, useStore } from "../state/react";
import { useKeymap } from "../state/hydrated";

/** A command's keys in this instance's keymap, for a tooltip ("⌘K ⌘[" / "Ctrl+K Ctrl+["); "" when unbound. */
export const useJaliShortcut = (id: string) => useKeymap().label(id);

/** The same list as far as a menu shows it. An instance command's `run` runs it by id, so any copy does; a pane's own
 *  `run` is the pane's, so it must be the same one. */
const sameCommands = (a: ListedCommand[], b: ListedCommand[]) =>
  a.length === b.length &&
  a.every((c, i) => {
    const d = b[i]!;
    return (
      c.key === d.key &&
      c.id === d.id &&
      c.title === d.title &&
      c.group === d.group &&
      c.keys === d.keys &&
      c.disabled === d.disabled &&
      c.reason === d.reason &&
      (c.id !== undefined || c.run === d.run)
    );
  });

/**
 * Jali's commands for your own command menu (cmdk, kbar, …), when the instance is made with `palette: false`:
 * the focused pane's own commands first, then the instance's and yours, each with its title, group, keys label,
 * whether it can run now and why not, and `run`. The same array until something it lists changes, so a menu that
 * registers its actions from it does so only then.
 *
 *   const commands = useJaliCommands();
 *   <Command.Item disabled={c.disabled} onSelect={() => { close(); c.run(); }}>{c.title}</Command.Item>
 */
export function useJaliCommands(): ListedCommand[] {
  const store = useStore();
  return useDerived(() => listCommands(store.jali), sameCommands, [store]);
}
