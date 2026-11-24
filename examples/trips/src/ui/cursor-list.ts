/**
 * A list with a cursor, the way every list in the app works (the overview's days, a day's stops, Explore's results):
 * ↓ or J and ↑ or K move the cursor a row, Home and End to the ends; Enter, or a press on the cursor's row, opens
 * it; a press on another row moves the cursor there. One Tab stop for the list, the cursor's row (or the first
 * while there is none), and the keyboard stays on the cursor's row as the list changes under it.
 *
 * A list's own actions on the cursor's row (Space to peek, M to move…) are declared once, each with its keys: the
 * same declaration handles the key and lists the command in ⌘K (`commands`), so the two never drift apart. Keys
 * with Mod or Ctrl are never a list's: they go on to the workspace.
 *
 * The cursor is the pane's own (`usePaneState`, or Jali's selection): the list is told it and says where it moves.
 */
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { keyHint, type PaneCommand } from "jali-layout";

/** Something to do on the cursor's row. */
export interface ListAction {
  id: string;
  /** The keys that run it: "M", "Space", "Delete", "Alt+ArrowUp". A letter is either case. */
  keys: readonly string[];
  /** Its name in ⌘K; an action without one is a key only. */
  title?: string;
  /** Why it can't run now; its keys then do nothing. */
  disabled?: string | false;
  run: () => void;
}

export interface CursorListOptions<T> {
  /** The rows, in order. */
  items: readonly T[];
  /** The row the cursor is on, if any. */
  cursor: T | null;
  /** The cursor moves to `item`: a key, a press on another row, or focus arriving on it. */
  onMove: (item: T) => void;
  /** Enter, or a press on the cursor's row. */
  onOpen: (item: T) => void;
  actions?: readonly ListAction[];
  /** Scroll the cursor's row into view whenever the cursor moves, as well as keeping focus on it. */
  keepInView?: boolean;
}

/** The props a focusable row's own control takes. */
export interface RowProps {
  ref: (el: HTMLElement | null) => void;
  tabIndex: number;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

const MOVES: Record<string, (at: number, last: number) => number> = {
  ArrowDown: (at) => at + 1,
  j: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  k: (at) => at - 1,
  Home: () => 0,
  End: (_, last) => last,
};

/** Whether `e` is the key `keys` names ("Alt+ArrowUp", "Space", "M"). Shift is free, so "M" is m or M. */
function isKey(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split("+");
  const key = parts.pop()!;
  const alt = parts.includes("Alt");
  if (e.metaKey || e.ctrlKey || e.altKey !== alt) return false;
  const pressed = key === "Space" ? " " : key;
  return pressed.length === 1 ? e.key.toLowerCase() === pressed.toLowerCase() : e.key === pressed;
}

export function useCursorList<T>({
  items,
  cursor,
  onMove,
  onOpen,
  actions = [],
  keepInView = false,
}: CursorListOptions<T>) {
  const rows = useRef(new Map<T, HTMLElement>());
  const at = cursor === null ? -1 : items.indexOf(cursor);

  // The cursor's row keeps the keyboard when the list moves under it (a reorder, a new filter), and comes into view.
  useEffect(() => {
    const row = cursor === null ? undefined : rows.current.get(cursor);
    if (!row) return;
    if (keepInView) row.scrollIntoView({ block: "nearest" });
    const list = row.closest("[data-cursor-list]");
    if (list?.contains(document.activeElement) && document.activeElement !== row) row.focus();
  }, [cursor, at, keepInView]);

  /** The keys on the list: a move, Enter, or one of its actions. Anything else goes on to the workspace. */
  const onKeyDown = (e: KeyboardEvent) => {
    const move = !e.metaKey && !e.ctrlKey && !e.altKey && items.length ? MOVES[e.key] : undefined;
    const action = actions.find((a) => a.keys.some((k) => isKey(e, k)));
    if (move) onMove(items[Math.max(0, Math.min(items.length - 1, move(at, items.length - 1)))]!);
    else if (isKey(e, "Enter") && cursor !== null) onOpen(cursor);
    else if (action) {
      if (!action.disabled) action.run();
    } else return;
    e.preventDefault();
  };

  const setRow = useCallback(
    (item: T) => (el: HTMLElement | null) => {
      if (el) rows.current.set(item, el);
      else rows.current.delete(item);
    },
    [],
  );

  /** A press on a row: the cursor's row opens; another row takes the cursor. */
  const press = (item: T) => (item === cursor ? onOpen(item) : onMove(item));

  /** The props for a row's own control, in a list where each row takes focus (roving Tab stop). */
  const row = (item: T): RowProps => {
    const i = items.indexOf(item);
    return {
      ref: setRow(item),
      tabIndex: i === Math.max(0, at) ? 0 : -1,
      onClick: () => press(item),
      onFocus: () => item !== cursor && onMove(item),
      onKeyDown,
    };
  };

  /** The actions with a title, as ⌘K lists them, each with its first key. */
  const commands: PaneCommand[] = actions.flatMap((a) =>
    a.title
      ? [{ id: a.id, title: a.title, keys: keyHint(a.keys[0]!), disabled: a.disabled, run: a.run }]
      : [],
  );

  return {
    /** Where the cursor is in `items`, -1 for nowhere. */
    at,
    /** For a list that keeps focus itself (a listbox with an active descendant): its keys. */
    onKeyDown,
    press,
    row,
    commands,
    /** On the list's element, so the keyboard is known to be in it. */
    listProps: { "data-cursor-list": "" },
  };
}
