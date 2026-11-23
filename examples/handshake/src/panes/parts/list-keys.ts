/**
 * The lab's list keys, said once: J and K move through every list, as in the rest of the lab. A list that draws its
 * own rows (the packet list, the hops) also takes the arrows, Page Up and Down, Home and End; a CyberSpec list
 * handles those itself. Jali's own keys all carry ⌘ or Ctrl, so these bare keys are the content's.
 */
import type { KeyboardEvent } from "react";

/** A key with no modifier: one the content may take. Shift is allowed only where it says so. */
export const bare = (e: KeyboardEvent, { shift = false } = {}) =>
  !e.metaKey && !e.ctrlKey && !e.altKey && (shift || !e.shiftKey);

/** Typing in a field inside the list's pane: its letters are text, not keys. */
const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLElement &&
  (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);

/**
 * Where a list key moves the cursor: the new index, kept inside the list, or null when the key is not a list key.
 * `at` is -1 when nothing is selected yet. `rows: true` adds the arrows, paging and Home/End; `page` is how many
 * rows Page Up and Down move.
 */
export function listMove(
  e: KeyboardEvent,
  at: number,
  length: number,
  { rows = false, page = 10 }: { rows?: boolean; page?: number } = {},
): number | null {
  if (!bare(e) || typing(e) || length === 0) return null;
  const to = (() => {
    switch (e.key) {
      case "j":
        return at + 1;
      case "k":
        return at < 0 ? 0 : at - 1;
    }
    if (!rows) return null;
    switch (e.key) {
      case "ArrowDown":
        return at + 1;
      case "ArrowUp":
        return at < 0 ? 0 : at - 1;
      case "PageDown":
        return at + page;
      case "PageUp":
        return at - page;
      case "Home":
        return 0;
      case "End":
        return length - 1;
    }
    return null;
  })();
  return to === null ? null : Math.max(0, Math.min(length - 1, to));
}
