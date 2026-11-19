/**
 * Rotary controls, drawn in CSS and SVG and built as real sliders: `role="slider"` with a name, a value and a
 * spoken value, the arrow keys (Shift for ten steps), Page Up and Down, Home and End, and a drag. A double-click
 * puts it back to `reset`.
 *
 * - `Knob`: a cap with a pointer mark over a printed scale, turning through 270 degrees, for pan, gain and speed.
 * - `JogDial`: a knurled dial with a dimple, turned round its centre, for scrubbing.
 * - `SelectorDial`: the same dial with a pointer, snapping to a few detents, for speed.
 */
import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

interface Common {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
  valueText?: string;
  reset?: number;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, step: number, min: number) =>
  Number((Math.round((v - min) / step) * step + min).toFixed(6));

/** The keys every rotary control shares. Returns the new value, or null for a key it doesn't use. */
function keyValue(e: KeyboardEvent, p: Common): number | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const big = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case "ArrowUp":
    case "ArrowRight":
      return p.value + p.step * big;
    case "ArrowDown":
    case "ArrowLeft":
      return p.value - p.step * big;
    case "PageUp":
      return p.value + p.step * 10;
    case "PageDown":
      return p.value - p.step * 10;
    case "Home":
      return p.min;
    case "End":
      return p.max;
    default:
      return null;
  }
}

/** Vertical drag (and horizontal, for a trackpad's habit): 180 pixels from one end of the range to the other. */
function useDrag(p: Common, pixelsForRange = 180) {
  const start = useRef<{ x: number; y: number; value: number } | null>(null);
  const latest = useRef(p);
  latest.current = p;
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      start.current = { x: e.clientX, y: e.clientY, value: latest.current.value };
      e.preventDefault();
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s) return;
      const q = latest.current;
      const moved = s.y - e.clientY + (e.clientX - s.x);
      const next = s.value + (moved / pixelsForRange) * (q.max - q.min);
      const v = snap(clamp(next, q.min, q.max), q.step, q.min);
      if (v !== q.value) q.onChange(v);
    },
    onPointerUp() {
      start.current = null;
    },
  };
}

export function Knob(
  p: Common & {
    /** The cap's colour: one of the app's encoder colours. */
    cap?: "orange" | "blue" | "green" | "white" | "graphite";
    /** A centre mark on the scale (pan), or none. */
    centre?: boolean;
    size?: number;
  },
) {
  const drag = useDrag(p);
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(p);
  latest.current = p;
  useWheel(ref, (e) => {
    const q = latest.current;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    q.onChange(snap(clamp(q.value + Math.sign(d) * q.step * 5, q.min, q.max), q.step, q.min));
  });
  const turn = (clamp(p.value, p.min, p.max) - p.min) / (p.max - p.min); // 0 to 1
  const angle = -135 + turn * 270;
  const size = p.size ?? 44;
  const ticks = 11;
  return (
    <div
      ref={ref}
      className={`knob ${p.className ?? ""}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={p.value}
      aria-valuetext={p.valueText}
      data-cap={p.cap ?? "white"}
      style={{ "--knob": `${size}px`, "--angle": `${angle}deg` } as CSSProperties}
      onKeyDown={(e) => {
        const v = keyValue(e, p);
        if (v === null) return;
        e.preventDefault();
        p.onChange(snap(clamp(v, p.min, p.max), p.step, p.min));
      }}
      onDoubleClick={() => p.reset !== undefined && p.onChange(p.reset)}
      {...drag}
    >
      <svg className="knob-scale" viewBox="0 0 100 100" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => {
          const a = ((-135 + (i / (ticks - 1)) * 270 - 90) * Math.PI) / 180;
          const long = i === 0 || i === ticks - 1 || (p.centre && i === (ticks - 1) / 2);
          const r0 = long ? 40 : 43;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * r0}
              y1={50 + Math.sin(a) * r0}
              x2={50 + Math.cos(a) * 48}
              y2={50 + Math.sin(a) * 48}
            />
          );
        })}
      </svg>
      <span className="knob-body" aria-hidden>
        <span className="knob-cap" />
      </span>
    </div>
  );
}

/** Calls `fn(event)` for wheel events on `ref`, as a non-passive listener, so the page doesn't scroll under it. */
function useWheel(ref: RefObject<HTMLElement | null>, fn: (e: WheelEvent) => void) {
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
function dragging(cursor: string | null) {
  const s = document.documentElement.style;
  s.cursor = cursor ?? "";
  s.userSelect = cursor ? "none" : "";
}

/** The pointer's angle around an element's centre, in degrees, clockwise from 12 o'clock. */
function angleOf(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
}

/** The step from one angle to the next, unwrapped across ±180°, so a turn past 6 o'clock doesn't jump. */
const turnBy = (from: number, to: number) => ((to - from + 540) % 360) - 180;

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
