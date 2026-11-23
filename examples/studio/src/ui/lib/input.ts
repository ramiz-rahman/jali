/**
 * What the controls and lists share for the wheel and the keyboard: the wheel's movement, and the plain keys a control
 * answers to. The hand's drags are in drag.ts.
 */
import { useEffect, useRef, type RefObject } from "react";

/** Calls `fn(event)` for wheel events on `ref`, as a non-passive listener, so the page doesn't scroll under it.
 *  `fn` returns `false` to leave an event to the browser (a pinch-zoom). */
export function useWheel(ref: RefObject<HTMLElement | null>, fn: (e: WheelEvent) => void | false) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      if (latest.current(e) !== false) e.preventDefault();
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [ref]);
}

/** The wheel's main movement: sideways when it moves more that way, else up and down (`upIsMore`: up is positive,
 *  for a control whose value rises as it is pushed up). */
export const wheelDelta = (e: WheelEvent, { upIsMore = false } = {}) =>
  Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : upIsMore ? -e.deltaY : e.deltaY;

/** A key typed into a field: the field's, never a list's or a pane's. */
export const typingIn = (e: { target: EventTarget | null }) =>
  e.target instanceof Element && !!e.target.closest("input, textarea, select, [contenteditable]");

interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/** A key pressed without ⌘, Ctrl or ⌥: one a control or a list may take; the rest are the workspace's. */
export const plain = (e: KeyLike) => !e.metaKey && !e.ctrlKey && !e.altKey;

/**
 * What a plain key asks for, from a table of keys (`KeyboardEvent.key`) to values: where a slider goes, what a list
 * does. `undefined` for any other key, or one pressed with a modifier.
 */
export function keyTarget<T>(e: KeyLike, table: Partial<Record<string, T>>): T | undefined {
  return plain(e) && Object.hasOwn(table, e.key) ? table[e.key] : undefined;
}
