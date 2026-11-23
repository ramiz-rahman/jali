/**
 * The hand on a control: a drag with pointer capture, so the hand can wander the whole window, and a slider's name
 * and value as a screen reader hears them. Every fader and dial is built from these two and a rule of its own for
 * what a move of the hand means.
 */
import { useRef, type HTMLAttributes, type PointerEvent } from "react";

/** While a drag runs: the drag's cursor everywhere, and no text selection under it. */
export function dragCursor(cursor: string | null) {
  const s = document.documentElement.style;
  s.cursor = cursor ?? "";
  s.userSelect = cursor ? "none" : "";
}

type PointerHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
>;

/**
 * A drag on a control. `start` gets the press (the main button only) and returns the drag's own state, or `null` to
 * leave the press alone; `move` gets each move with that state. While it runs the control has focus, the pointer is
 * captured, the control carries `data-dragging` (the styles press it in) and the page shows the grabbing cursor.
 * Spread the result on the control.
 */
export function useDrag<S>(on: {
  start(e: PointerEvent<HTMLElement>): S | null;
  move(e: PointerEvent<HTMLElement>, state: S): void;
}): PointerHandlers {
  const latest = useRef(on);
  latest.current = on;
  const state = useRef<S | null>(null);
  const end = (el: HTMLElement) => {
    if (state.current === null) return;
    state.current = null;
    delete el.dataset.dragging;
    dragCursor(null);
  };
  return {
    onPointerDown(e) {
      if (e.button !== 0) return;
      const s = latest.current.start(e);
      if (s === null) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      e.currentTarget.focus();
      e.currentTarget.dataset.dragging = "";
      dragCursor("grabbing");
      state.current = s;
    },
    onPointerMove(e) {
      if (state.current !== null) latest.current.move(e, state.current);
    },
    onPointerUp: (e) => end(e.currentTarget),
    onPointerCancel: (e) => end(e.currentTarget),
  };
}

/** The pointer's angle around an element's centre, in degrees, clockwise from 12 o'clock. */
export function angleOf(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
}

/** The step from one angle to the next, unwrapped across ±180°, so a turn past 6 o'clock doesn't jump. */
export const turnBy = (from: number, to: number) => ((to - from + 540) % 360) - 180;

/** A control's ARIA as a slider: its name, its range and its value, spoken as `text` where a number alone won't do. */
export const sliderProps = (s: {
  label: string;
  min: number;
  max: number;
  now: number;
  text?: string;
  vertical?: boolean;
}) => ({
  role: "slider",
  tabIndex: 0,
  "aria-label": s.label,
  "aria-valuemin": s.min,
  "aria-valuemax": s.max,
  "aria-valuenow": s.now,
  "aria-valuetext": s.text,
  "aria-orientation": s.vertical ? ("vertical" as const) : undefined,
});
