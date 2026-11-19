/**
 * Rotary controls, drawn in CSS and SVG and built as real sliders: `role="slider"` with a name, a value and a
 * spoken value, the arrow keys (Shift for ten steps), Page Up and Down, Home and End, and a drag. A double-click
 * puts it back to `reset`.
 *
 * - `Knob`: a cap with a pointer mark over a printed scale, turning through 270 degrees, for pan, gain and speed.
 * - `Jog`: a knurled wheel with a dimple that turns without end, for scrubbing. Dragging sideways or round moves the
 *   value; the wheel's angle follows the value, so it turns as the playhead moves.
 */
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

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
  const turn = (clamp(p.value, p.min, p.max) - p.min) / (p.max - p.min); // 0 to 1
  const angle = -135 + turn * 270;
  const size = p.size ?? 44;
  const ticks = 11;
  return (
    <div
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

export function Jog(p: Common & { degreesPerUnit: number }) {
  const drag = useDrag(p, Math.max(240, (p.max - p.min) * 8));
  return (
    <div
      className={`jog ${p.className ?? ""}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-valuemin={p.min}
      aria-valuemax={p.max}
      aria-valuenow={Math.round(p.value)}
      aria-valuetext={p.valueText}
      style={{ "--angle": `${p.value * p.degreesPerUnit}deg` } as CSSProperties}
      onKeyDown={(e) => {
        const v = keyValue(e, p);
        if (v === null) return;
        e.preventDefault();
        p.onChange(clamp(v, p.min, p.max));
      }}
      {...drag}
    >
      <span className="jog-ring" aria-hidden>
        <span className="jog-face">
          <span className="jog-dimple" />
        </span>
      </span>
    </div>
  );
}
