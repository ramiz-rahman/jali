/**
 * Rotary controls, one dial in three uses, drawn in CSS and built as real sliders: `role="slider"` with a name,
 * a value and a spoken value, the keys, the mouse wheel and a circular drag with pointer capture.
 *
 * - `PanDial`: a dial with a pointer through 270°, a centre detent at C, for pan.
 * - `JogDial`: a knurled dial with a dimple, turned round its centre, for scrubbing.
 * - `SelectorDial`: the same dial with a pointer, snapping to a few detents, for speed.
 */
import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Calls `fn(event)` for wheel events on `ref`, as a non-passive listener, so the page doesn't scroll under it. */
export function useWheel(ref: RefObject<HTMLElement | null>, fn: (e: WheelEvent) => void) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      e.preventDefault();
      latest.current(e);
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [ref]);
}

/** While a drag runs: the drag's cursor everywhere, and no text selection under it. */
export function dragging(cursor: string | null) {
  const s = document.documentElement.style;
  s.cursor = cursor ?? "";
  s.userSelect = cursor ? "none" : "";
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

/**
 * The jog dial, for scrubbing. A knurled dial with a finger dimple, turned by dragging round its centre: the dial
 * follows the pointer's angle (true circular drag, with pointer capture, so the hand can wander the whole window).
 * The mapping is fixed: one full turn is `secondsPerTurn` seconds (Studio: 10), so the dimple sits under the finger
 * all the way round. The mouse wheel or a trackpad turns it too (100 of delta is one second), and the arrow keys
 * step a second (Shift: five), Page Up and Down ten, Home and End go to the ends.
 *
 * `onStart` and `onEnd` bracket a gesture (a turn, or a run of wheel events), so the app can hold playback while
 * the person scrubs and carry on afterwards.
 */
export function JogDial(p: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  onStart?(): void;
  onEnd?(): void;
  valueText?: string;
  secondsPerTurn?: number;
  className?: string;
}) {
  const perTurn = p.secondsPerTurn ?? 10;
  const ref = useRef<HTMLDivElement>(null);
  const dial = useRef<HTMLSpanElement>(null);
  const turn = useRef<{ angle: number; value: number } | null>(null);
  const wheelEnd = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(p);
  latest.current = p;
  const set = (v: number) =>
    latest.current.onChange(clamp(v, latest.current.min, latest.current.max));
  const end = (el: HTMLElement) => {
    if (!turn.current) return;
    turn.current = null;
    delete el.dataset.dragging;
    dragging(null);
    latest.current.onEnd?.();
  };

  useWheel(ref, (e) => {
    const q = latest.current;
    if (!wheelEnd.current) q.onStart?.();
    else clearTimeout(wheelEnd.current);
    wheelEnd.current = setTimeout(() => {
      wheelEnd.current = null;
      latest.current.onEnd?.();
    }, 250);
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    set(q.value + d / 100);
  });
  useEffect(
    () => () => {
      if (wheelEnd.current) clearTimeout(wheelEnd.current);
    },
    [],
  );

  return (
    <div
      ref={ref}
      className={`dial jog-dial ${p.className ?? ""}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={p.min}
      aria-valuemax={Math.round(p.max)}
      aria-valuenow={Math.round(p.value)}
      aria-valuetext={p.valueText}
      style={{ "--angle": `${(p.value / perTurn) * 360}deg` } as CSSProperties}
      onPointerDown={(e) => {
        if (e.button !== 0 || !dial.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.focus();
        turn.current = {
          angle: angleOf(dial.current, e.clientX, e.clientY),
          value: latest.current.value,
        };
        e.currentTarget.dataset.dragging = "";
        dragging("grabbing");
        latest.current.onStart?.();
      }}
      onPointerMove={(e) => {
        const t = turn.current;
        if (!t || !dial.current) return;
        const a = angleOf(dial.current, e.clientX, e.clientY);
        t.value += (turnBy(t.angle, a) / 360) * perTurn;
        t.angle = a;
        set(t.value);
      }}
      onPointerUp={(e) => end(e.currentTarget)}
      onPointerCancel={(e) => end(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const q = latest.current;
        const step = e.shiftKey ? 5 : 1;
        const to =
          e.key === "ArrowRight" || e.key === "ArrowUp"
            ? q.value + step
            : e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? q.value - step
              : e.key === "PageUp"
                ? q.value + 10
                : e.key === "PageDown"
                  ? q.value - 10
                  : e.key === "Home"
                    ? q.min
                    : e.key === "End"
                      ? q.max
                      : null;
        if (to === null) return;
        e.preventDefault();
        set(to);
      }}
    >
      <span ref={dial} className="dial-body" aria-hidden>
        <span className="dial-face">
          <span className="dial-dimple" />
        </span>
      </span>
    </div>
  );
}

/**
 * The selector dial, for a few values (Studio's speed): the same dial as the jog, with a pointer, snapping to
 * printed detents 60° apart. Press anywhere on it and turn: it points where the pointer is and snaps to the nearest
 * detent. The mouse wheel steps one detent per notch, the arrow keys step, Home and End go to the ends, and a
 * double-click puts it back to `reset` (its detent is marked).
 */
export function SelectorDial<T extends number>(p: {
  label: string;
  values: readonly T[];
  value: T;
  onChange(value: T): void;
  reset: T;
  format(value: T): string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dial = useRef<HTMLSpanElement>(null);
  const active = useRef(false);
  const last = useRef(0);
  const latest = useRef(p);
  latest.current = p;
  const n = p.values.length;
  const SPREAD = 60; // degrees between detents
  const angleAt = (i: number) => (i - (n - 1) / 2) * SPREAD;
  const index = Math.max(0, p.values.indexOf(p.value));
  const choose = (i: number) => {
    const q = latest.current;
    const v = q.values[clamp(i, 0, q.values.length - 1)]!;
    if (v !== q.value) q.onChange(v);
  };
  const nearest = (x: number, y: number) => {
    if (!dial.current) return index;
    const a = angleOf(dial.current, x, y);
    return Math.round(a / SPREAD + (n - 1) / 2);
  };
  useWheel(ref, (e) => {
    const now = e.timeStamp;
    if (now - last.current < 120) return;
    last.current = now;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    choose(latest.current.values.indexOf(latest.current.value) + (d > 0 ? 1 : -1));
  });
  return (
    <div
      ref={ref}
      className={`dial selector-dial ${p.className ?? ""}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={index}
      aria-valuetext={p.format(p.value)}
      style={{ "--angle": `${angleAt(index)}deg` } as CSSProperties}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.focus();
        active.current = true;
        dragging("grabbing");
        choose(nearest(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        if (active.current) choose(nearest(e.clientX, e.clientY));
      }}
      onPointerUp={() => {
        active.current = false;
        dragging(null);
      }}
      onPointerCancel={() => {
        active.current = false;
        dragging(null);
      }}
      onDoubleClick={() => latest.current.onChange(latest.current.reset)}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const i = latest.current.values.indexOf(latest.current.value);
        const to =
          e.key === "ArrowRight" || e.key === "ArrowUp"
            ? i + 1
            : e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? i - 1
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? n - 1
                  : null;
        if (to === null) return;
        e.preventDefault();
        choose(to);
      }}
    >
      <span className="dial-ticks" aria-hidden>
        {p.values.map((v, i) => (
          <span
            key={v}
            className="dial-tick"
            data-on={i === index ? "" : undefined}
            data-reset={v === p.reset ? "" : undefined}
            style={{ "--at": `${angleAt(i)}deg` } as CSSProperties}
          />
        ))}
      </span>
      <span ref={dial} className="dial-body" aria-hidden>
        <span className="dial-face">
          <span className="dial-pointer" />
        </span>
      </span>
    </div>
  );
}

/**
 * The pan dial: the slab's dial with a pointer, turning through 270° (L100 at 7 o'clock, C at 12, R100 at 5).
 * Turned round its centre like the jog (relative: grabbing it never jumps it), 270° of turn is the full range. Near C
 * it settles into a detent (within 4, unless Shift is held); Shift turns it finely (a quarter as far). The mouse
 * wheel moves 5 a notch, the arrow keys 1 (Shift: 10), Home and End go to the ends, and a double-click centres it.
 */
export function PanDial(p: {
  label: string;
  value: number;
  onChange(value: number): void;
  valueText?: string;
  cap?: "blue" | "green" | "white" | "orange";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const turn = useRef<{ angle: number; raw: number } | null>(null);
  const latest = useRef(p);
  latest.current = p;
  const set = (v: number, fine = false) => {
    let x = clamp(Math.round(v), -100, 100);
    if (!fine && Math.abs(x) < 4) x = 0;
    if (x !== latest.current.value) latest.current.onChange(x);
  };
  useWheel(ref, (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    set(latest.current.value + Math.sign(d) * (e.shiftKey ? 1 : 5), true);
  });
  const end = (el: HTMLElement) => {
    turn.current = null;
    delete el.dataset.dragging;
    dragging(null);
  };
  return (
    <div
      ref={ref}
      className={`dial pan-dial ${p.className ?? ""}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={p.value}
      aria-valuetext={p.valueText}
      data-cap={p.cap}
      style={{ "--angle": `${p.value * 1.35}deg` } as CSSProperties}
      onPointerDown={(e) => {
        if (e.button !== 0 || !body.current) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.focus();
        turn.current = {
          angle: angleOf(body.current, e.clientX, e.clientY),
          raw: latest.current.value,
        };
        e.currentTarget.dataset.dragging = "";
        dragging("grabbing");
      }}
      onPointerMove={(e) => {
        const t = turn.current;
        if (!t || !body.current) return;
        const a = angleOf(body.current, e.clientX, e.clientY);
        t.raw += (turnBy(t.angle, a) / 270) * 200 * (e.shiftKey ? 0.25 : 1);
        t.raw = clamp(t.raw, -100, 100);
        t.angle = a;
        set(t.raw, e.shiftKey);
      }}
      onPointerUp={(e) => end(e.currentTarget)}
      onPointerCancel={(e) => end(e.currentTarget)}
      onDoubleClick={() => latest.current.onChange(0)}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const v = latest.current.value;
        const step = e.shiftKey ? 10 : 1;
        const to =
          e.key === "ArrowRight" || e.key === "ArrowUp"
            ? v + step
            : e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? v - step
              : e.key === "Home"
                ? -100
                : e.key === "End"
                  ? 100
                  : null;
        if (to === null) return;
        e.preventDefault();
        set(to, true);
      }}
    >
      <span className="dial-ticks" aria-hidden>
        {[-100, -50, 0, 50, 100].map((v) => (
          <span
            key={v}
            className="dial-tick"
            data-reset={v === 0 ? "" : undefined}
            data-on={v === 0 && p.value === 0 ? "" : undefined}
            style={{ "--at": `${v * 1.35}deg` } as CSSProperties}
          />
        ))}
      </span>
      <span ref={body} className="dial-body" aria-hidden>
        <span className="dial-face">
          <span className="dial-pointer" />
        </span>
      </span>
    </div>
  );
}
