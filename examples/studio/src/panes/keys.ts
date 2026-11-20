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

/**
 * Brings `row` into view by scrolling its list, and only its list. `scrollIntoView` would also scroll whatever is
 * round the list (a pane's body, when the pane is short), and push the pane's own controls out of sight.
 */
export function showRow(list: HTMLElement | null, row: Element | null | undefined, smooth = false) {
  if (!list || !row) return;
  const box = list.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const by = r.top < box.top ? r.top - box.top : r.bottom > box.bottom ? r.bottom - box.bottom : 0;
  if (by) list.scrollTo({ top: list.scrollTop + by, behavior: smooth ? "smooth" : "auto" });
}

/** Keeps the row at `index` in view inside a scrolling list. */
export function scrollRowIntoView(list: HTMLElement | null, index: number) {
  showRow(list, list?.querySelectorAll<HTMLElement>("[data-row]")[index]);
}
