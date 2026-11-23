/**
 * A list box: one cursor over a list of rows, moved by the keys every list shares, and a row kept in view by scrolling
 * the list alone. Focus stays on the list; the cursor's row is its active descendant, so a screen reader moves
 * through the rows one by one.
 *
 *   const list = useListbox({ id, count, at, focused, onMove, onKey });
 *   <div {...list.props} aria-label="Sessions">{rows.map((r, i) => <div {...list.row(i)}>…</div>)}</div>
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { clamp } from "../../numbers";
import { keyTarget, typingIn } from "./input";

/** J/K and the arrows move by one, Page keys by ten, Home and End to the ends. The new index, or null. */
export function listMove(e: KeyboardEvent, at: number, count: number): number | null {
  if (!count || typingIn(e)) return null;
  const to = keyTarget(e, {
    j: at + 1,
    ArrowDown: at + 1,
    k: at - 1,
    ArrowUp: at - 1,
    PageDown: at + 10,
    PageUp: at - 10,
    Home: 0,
    End: count - 1,
  });
  return to === undefined ? null : clamp(to, 0, count - 1);
}

/**
 * Brings the row at `index` into view by scrolling its list, and only its list. `scrollIntoView` would also scroll
 * whatever is round the list (a pane's body, when the pane is short), and push the pane's own controls out of sight.
 * Rows carry `data-row`; a list may print headings between them.
 */
export function showRow(list: HTMLElement | null, index: number, { smooth = false } = {}) {
  const row = list?.querySelectorAll<HTMLElement>("[data-row]")[index];
  if (!list || !row) return;
  const box = list.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const by = r.top < box.top ? r.top - box.top : r.bottom > box.bottom ? r.bottom - box.bottom : 0;
  if (by) list.scrollTo({ top: list.scrollTop + by, behavior: smooth ? "smooth" : "auto" });
}

/** A row's part in its list: spread it on the row. */
export interface ListRow {
  id: string;
  "data-row": "";
  role: "option";
  "aria-selected": boolean;
  "data-active": "" | undefined;
}

export function useListbox({
  id,
  count,
  at,
  focused,
  onMove,
  onKey,
  reveal = "cursor",
}: {
  /** Unique on the page: each row's id is `${id}-${index}`, so the list can name its active row. */
  id: string;
  count: number;
  /** The cursor's row, or -1 for none. */
  at: number;
  /** The list has keyboard focus: the cursor's row is marked active. */
  focused: boolean;
  /** A key moved the cursor to row `index`. */
  onMove(index: number): void;
  /** Any other key: the owner's keys (its actions). Unclaimed, a key bubbles on (Space plays and pauses). */
  onKey?(e: KeyboardEvent): void;
  /** What the list scrolls to show: the cursor's row wherever it moves (`"cursor"`), or only where a key moved it
   *  (`"keys"`, for a list whose owner scrolls it otherwise, as the transcript follows the voice). */
  reveal?: "cursor" | "keys";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reveal === "cursor") showRow(ref.current, at);
  }, [reveal, at]);
  const rowId = (i: number) => `${id}-${i}`;
  return {
    ref,
    props: {
      ref,
      role: "listbox",
      tabIndex: 0,
      "aria-activedescendant": at >= 0 ? rowId(at) : undefined,
      onKeyDown(e: KeyboardEvent) {
        const to = listMove(e, at, count);
        if (to === null) return onKey?.(e);
        e.preventDefault();
        onMove(to);
        if (reveal === "keys") showRow(ref.current, to);
      },
    },
    /** A row's part in the list: its id, its option role, and whether the cursor is on it. */
    row: (i: number): ListRow => ({
      id: rowId(i),
      "data-row": "",
      role: "option",
      "aria-selected": i === at,
      "data-active": focused && i === at ? "" : undefined,
    }),
  };
}
