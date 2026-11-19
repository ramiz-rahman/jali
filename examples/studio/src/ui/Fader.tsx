/**
 * The fader: a long-throw slide, built as a real slider (`role="slider"`, vertical, with a name, a value in dB and a
 * spoken value). A shaped cap with grip ribs and a centre line rides in a milled slot; the scale and the meter beside
 * it share the slot's geometry, so their ticks line up with the cap's travel.
 *
 * - Taper: the travel is mapped to dB by `dbToFader` and `faderToDb` (+6 dB at the top, 0 dB about 3/4 of the way
 *   up, −6 dB at the middle, silence at the foot), so the useful range near 0 dB has most of the throw.
 * - Drag: relative. Grabbing the cap never jumps it; pressing the slot elsewhere moves the cap there first, then the
 *   drag carries on from there. Pointer capture keeps the drag across the whole window. Shift moves it finely (a
 *   quarter as far).
 * - Detent at 0 dB: within ±0.75 dB the cap settles on 0, unless Shift is held. A double-click resets to 0 dB.
 * - Wheel: 0.5 dB a notch (Shift: 0.1). Keys: up and down 0.5 dB (Shift: 0.1), Page Up and Down 3 dB, Home to
 *   silence, End to +6 dB.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { clamp, dragging, useWheel } from "./Knob";

/** Fader travel (0 to 1) to dB and back: +6 at the top, −6 at the middle, silence at the foot. */
export const faderToDb = (p: number) => (p <= 0.032 ? -60 : 40 * Math.log10(p) + 6);
export const dbToFader = (db: number) => (db <= -60 ? 0 : Math.min(1, 10 ** ((db - 6) / 40)));

/** The dB the fader settles on for `db`: rounded to 0.1, held in range, and caught by the 0 dB detent. */
export function settle(db: number, fine = false): number {
  let x = clamp(Math.round(db * 10) / 10, -60, 6);
  if (x <= -59.95) x = -60;
  if (!fine && Math.abs(x) < 0.75) x = 0;
  return x;
}

export function Fader(p: {
  label: string;
  /** dB, −60 for silence. */
  value: number;
  onChange(db: number): void;
  valueText?: string;
  /** Drawn in the slot's box beside the cap: a meter, or the printed scale. */
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; raw: number } | null>(null);
  const latest = useRef(p);
  latest.current = p;
  const travel = () => {
    const slot = ref.current?.querySelector(".fader-travel")?.getBoundingClientRect();
    return slot && slot.height > 0 ? slot : null;
  };
  const set = (db: number, fine = false) => {
    const v = settle(db, fine);
    if (v !== latest.current.value) latest.current.onChange(v);
  };
  const setTravel = (pos: number, fine = false) => set(faderToDb(clamp(pos, 0, 1)), fine);
  useWheel(ref, (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    const step = e.shiftKey ? 0.1 : 0.5;
    const v = latest.current.value <= -60 ? -48 : latest.current.value;
    set(v + Math.sign(d) * step, true);
  });
  const end = (el: HTMLElement) => {
    drag.current = null;
    delete el.dataset.dragging;
    dragging(null);
  };
  const pos = dbToFader(p.value);
  return (
    <div
      ref={ref}
      className={`fader ${p.className ?? ""}`}
      role="slider"
      tabIndex={0}
      aria-label={p.label}
      aria-orientation="vertical"
      aria-valuemin={-60}
      aria-valuemax={6}
      aria-valuenow={p.value}
      aria-valuetext={p.valueText}
      style={{ "--pos": pos } as CSSProperties}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const t = travel();
        if (!t) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.focus();
        const onCap = (e.target as Element).closest(".fader-cap");
        let raw = dbToFader(latest.current.value);
        if (!onCap) {
          raw = clamp(1 - (e.clientY - t.top) / t.height, 0, 1);
          setTravel(raw, e.shiftKey);
        }
        drag.current = { y: e.clientY, raw };
        e.currentTarget.dataset.dragging = "";
        dragging("grabbing");
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const t = travel();
        if (!d || !t) return;
        d.raw = clamp(d.raw - ((e.clientY - d.y) / t.height) * (e.shiftKey ? 0.25 : 1), 0, 1);
        d.y = e.clientY;
        setTravel(d.raw, e.shiftKey);
      }}
      onPointerUp={(e) => end(e.currentTarget)}
      onPointerCancel={(e) => end(e.currentTarget)}
      onDoubleClick={() => latest.current.onChange(0)}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const v = latest.current.value;
        const from = v <= -60 ? -48 : v;
        const step = e.shiftKey ? 0.1 : 0.5;
        const to =
          e.key === "ArrowUp" || e.key === "ArrowRight"
            ? from + step
            : e.key === "ArrowDown" || e.key === "ArrowLeft"
              ? v <= -60
                ? -60
                : v - step
              : e.key === "PageUp"
                ? from + 3
                : e.key === "PageDown"
                  ? v - 3
                  : e.key === "Home"
                    ? -60
                    : e.key === "End"
                      ? 6
                      : null;
        if (to === null) return;
        e.preventDefault();
        set(to, true);
      }}
    >
      <span className="fader-slot" aria-hidden>
        <span className="fader-travel">
          {p.children}
          <span className="fader-groove" />
          <span className="fader-zero" />
          <span className="fader-cap">
            <span className="fader-line" />
          </span>
        </span>
      </span>
    </div>
  );
}
