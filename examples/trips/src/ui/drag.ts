/**
 * Dragging a stop: within a day, from one day pane to another, or onto a day in the overview. It is the app's own
 * pointer drag, on a handle in each stop row, so it works the same with a mouse, a pen and a finger. It never meets
 * Jali's own drag, which starts only from a pane's header.
 *
 * Drop targets are marked in the DOM: `data-drop-day="2"` on a day's list (its rows carry `data-stop-index`), or on
 * an overview row, which takes the stop at the end of that day.
 */
import { edgeScroll, type Jali } from "jali";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createStore, useStore } from "../state/store";

export interface Drop {
  day: number;
  /** Where in the day, counted without the dragged stop; undefined: the end. */
  index?: number;
}

export interface StopDrag {
  id: string;
  fromDay: number;
  fromIndex: number;
  label: string;
  x: number;
  y: number;
  over: Drop | null;
}

export const dragStore = createStore<StopDrag | null>(null);

// The drag changes on every pointer move. Each reader takes only what it shows, as a plain value, so a move that
// doesn't change it renders nothing: the ghost alone follows the pointer, and a day pane renders when the drop
// line moves within it, not for every move anywhere.

/** The whole drag, for the ghost under the pointer. */
export const useDrag = () => useStore(dragStore, (d) => d);

/** The id of the stop in hand when it was picked up from day `n`, else null: it changes when a drag starts and ends. */
export const useDraggedFrom = (n: number) =>
  useStore(dragStore, (d) => (d?.fromDay === n ? d.id : null));

/** Where in day `n` (of `length` stops) the stop would land: its index, `length` for the end, or -1 when it isn't
 *  over that day. */
export const useDropIndex = (n: number, length: number) =>
  useStore(dragStore, (d) => (d?.over?.day === n ? (d.over.index ?? length) : -1));

/** The day a stop from another day is over (in the overview), or null. */
export const useDropDay = () =>
  useStore(dragStore, (d) => (d?.over && d.over.day !== d.fromDay ? d.over.day : null));

/** Where a point is over: a day list and a place in it, or a day row of the overview. */
export function dropAt(
  x: number,
  y: number,
  drag: Pick<StopDrag, "fromDay" | "fromIndex">,
): Drop | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-day]");
  if (!el) return null;
  const day = Number(el.dataset.dropDay);
  if (!day) return null;
  const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-stop-index]"));
  if (!rows.length) return { day, index: el.hasAttribute("data-drop-end") ? undefined : 0 };
  let index = rows.length;
  for (const row of rows) {
    const r = row.getBoundingClientRect();
    if (y < r.top + r.height / 2) {
      index = Number(row.dataset.stopIndex);
      break;
    }
  }
  // Counted without the stop in hand: moving down within its own day, the rows below it shift up by one.
  if (day === drag.fromDay && index > drag.fromIndex) index -= 1;
  return { day, index };
}

const THRESHOLD = 5;

/**
 * Start watching a press on a stop's handle. It becomes a drag once the pointer has moved a few pixels, and ends
 * with `onDrop` (on a target) or nothing (anywhere else, or Esc).
 */
export function startStopDrag(
  e: ReactPointerEvent,
  stop: { id: string; day: number; index: number; label: string },
  onDrop: (id: string, drop: Drop) => void,
  jali?: Jali,
) {
  if (e.button !== 0) return;
  const target = e.currentTarget as HTMLElement;
  const start = { x: e.clientX, y: e.clientY };
  let active = false;
  target.setPointerCapture?.(e.pointerId);

  const from = { fromDay: stop.day, fromIndex: stop.index };
  let last = start;
  const place = (x: number, y: number) =>
    dragStore.set({ id: stop.id, ...from, label: stop.label, x, y, over: dropAt(x, y, from) });
  // Held near the edge of the week's strip (Days), it scrolls on to the days out of view; the day under the
  // pointer is found again as they slide past.
  const edge = jali ? edgeScroll(jali, () => place(last.x, last.y)) : null;
  const move = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
    if (!active) {
      active = true;
      document.body.classList.add("is-dragging-stop");
    }
    ev.preventDefault();
    last = { x: ev.clientX, y: ev.clientY };
    place(ev.clientX, ev.clientY);
    edge?.move(ev.clientX, ev.clientY);
  };
  const end = (drop: boolean) => {
    edge?.stop();
    const d = dragStore.get();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    document.body.classList.remove("is-dragging-stop");
    dragStore.set(null);
    if (drop && active && d?.over) onDrop(stop.id, d.over);
  };
  const up = () => end(true);
  const cancel = () => end(false);
  // Esc cancels the drag; the workspace never sees it (it would restore a maximised pane, or close the peek).
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !active) return;
    ev.preventDefault();
    ev.stopPropagation();
    end(false);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}
