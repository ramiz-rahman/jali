/**
 * Keys inside a pane. Jali gives the focused content every key first: a pane claims the ones it uses with
 * `preventDefault()` and lets the rest (⌘K and the workspace's chords) bubble on.
 */
import type { KeyboardEvent } from "react";

/** J/K and the arrows move by one, Page keys by ten, Home and End to the ends. Returns the new index, or null. */
export function listMove(e: KeyboardEvent, at: number, count: number): number | null {
  if (e.metaKey || e.ctrlKey || e.altKey || !count) return null;
  const to = (() => {
    switch (e.key) {
      case "j":
      case "ArrowDown":
        return at + 1;
      case "k":
      case "ArrowUp":
        return at - 1;
      case "PageDown":
        return at + 10;
      case "PageUp":
        return at - 10;
      case "Home":
        return 0;
      case "End":
        return count - 1;
      default:
        return null;
    }
  })();
  return to === null ? null : Math.max(0, Math.min(count - 1, to));
}

/** Keeps the row at `index` in view inside a scrolling list. */
export function scrollRowIntoView(list: HTMLElement | null, index: number) {
  const row = list?.querySelectorAll<HTMLElement>("[data-row]")[index];
  row?.scrollIntoView({ block: "nearest" });
}
