import type { KeyboardEvent } from "react";
import { inlineStep } from "@jali/core/adapter";
import { useUi } from "../state/react";

/**
 * The keys of a row with one tab stop (APG roving tabindex: a tablist or a toolbar). ← and → move along the row in
 * reading order (right to left, ← moves forward), wrapping at both ends; Home and End go to the first and the last.
 * Only keys pressed on an item count (not in a field inside the row, such as a tab being renamed), and a key with a
 * modifier is left alone, for the keymap.
 *
 * `move` is what a step does with the item it lands on: by default it focuses it (manual activation: Enter, Space
 * or a click selects). A row that selects as you go passes its own.
 */
export function useRovingKeys(
  items: () => HTMLElement[],
  move: (el: HTMLElement) => void = (el) => el.focus({ preventScroll: true }),
) {
  const dir = useUi((s) => s.dir);
  return (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const step = inlineStep(e.key, dir);
    const list = items();
    const n = list.length;
    const i = list.indexOf(e.target as HTMLElement);
    if (i < 0 || (!step && e.key !== "Home" && e.key !== "End")) return;
    e.preventDefault();
    move(list[step ? (i + step + n) % n : e.key === "Home" ? 0 : n - 1]!);
  };
}
