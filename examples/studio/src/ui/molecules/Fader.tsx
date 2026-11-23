/**
 * The fader: a long-throw slide, built as a real slider (vertical, with a name, a value in dB and a spoken value). A
 * shaped cap with grip ribs and a centre line rides in a milled slot; the scale and the meter beside it share the
 * slot's geometry, so their ticks line up with the cap's travel.
 *
 * - Taper: the travel is mapped to dB by `dbToFader` and `faderToDb` (+6 dB at the top, 0 dB about 3/4 of the way
 *   up, −6 dB at the middle, silence at the foot), so the useful range near 0 dB has most of the throw.
 * - Drag: relative. Grabbing the cap never jumps it; pressing the slot elsewhere moves the cap there first, then the
 *   drag carries on from there. Shift moves it finely (a quarter as far).
 * - Detent at 0 dB: within ±0.75 dB the cap settles on 0, unless Shift is held. A double-click resets to 0 dB.
 * - Wheel: 0.5 dB a notch (Shift: 0.1). Keys: up and down 0.5 dB (Shift: 0.1), Page Up and Down 3 dB, Home to
 *   silence, End to +6 dB.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { MAX_DB, SILENCE_DB } from "../lib/levels";
import { clamp } from "../lib/numbers";
import { sliderProps, useDrag } from "../lib/drag";
import { feelSlide } from "../lib/feel";
import { keyTarget, useWheel, wheelDelta } from "../lib/input";

/** Fader travel (0 to 1) to dB and back: +6 at the top, −6 at the middle, silence at the foot. */
export const faderToDb = (p: number) => (p <= 0.032 ? SILENCE_DB : 40 * Math.log10(p) + MAX_DB);
export const dbToFader = (db: number) =>
  db <= SILENCE_DB ? 0 : Math.min(1, 10 ** ((db - MAX_DB) / 40));

/** The dB the fader settles on for `db`: rounded to 0.1, held in range, and caught by the 0 dB detent. */
export function settle(db: number, fine = false): number {
  let x = clamp(Math.round(db * 10) / 10, SILENCE_DB, MAX_DB);
  if (x <= SILENCE_DB + 0.05) x = SILENCE_DB;
  if (!fine && Math.abs(x) < 0.75) x = 0;
  return x;
}

/** From silence, a step up starts here, where the scale's ticks start. */
const FIRST_TICK = -48;

export function Fader(p: {
  label: string;
  /** dB, `SILENCE_DB` for silence. */
  value: number;
  onChange(db: number): void;
  valueText?: string;
  /** Drawn in the slot's box beside the cap: a meter, or the printed scale. */
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(p);
  latest.current = p;
  const travel = () => {
    const slot = ref.current?.querySelector(".fader-travel")?.getBoundingClientRect();
    return slot && slot.height > 0 ? slot : null;
  };
  const set = (db: number, fine = false) => {
    const from = latest.current.value;
    const to = settle(db, fine);
    if (to === from) return;
    latest.current.onChange(to);
    feelSlide(from, to, { min: SILENCE_DB, max: MAX_DB, detents: [0] });
  };
  const setTravel = (pos: number, fine = false) => set(faderToDb(clamp(pos, 0, 1)), fine);
  /** Where a step up from `v` starts: silence steps up from the first tick. */
  const above = (v: number) => (v <= SILENCE_DB ? FIRST_TICK : v);

  useWheel(ref, (e) => {
    const d = wheelDelta(e, { upIsMore: true });
    set(above(latest.current.value) + Math.sign(d) * (e.shiftKey ? 0.1 : 0.5), true);
  });

  const drag = useDrag({
    start(e) {
      const t = travel();
      if (!t) return null;
      let raw = dbToFader(latest.current.value);
      if (!(e.target as Element).closest(".fader-cap")) {
        raw = clamp(1 - (e.clientY - t.top) / t.height, 0, 1);
        setTravel(raw, e.shiftKey);
      }
      return { y: e.clientY, raw };
    },
    move(e, d) {
      const t = travel();
      if (!t) return;
      d.raw = clamp(d.raw - ((e.clientY - d.y) / t.height) * (e.shiftKey ? 0.25 : 1), 0, 1);
      d.y = e.clientY;
      setTravel(d.raw, e.shiftKey);
    },
  });

  return (
    <div
      ref={ref}
      className={`fader ${p.className ?? ""}`}
      {...sliderProps({
        label: p.label,
        min: SILENCE_DB,
        max: MAX_DB,
        now: p.value,
        text: p.valueText,
        vertical: true,
      })}
      style={{ "--pos": dbToFader(p.value) } as CSSProperties}
      {...drag}
      onDoubleClick={() => latest.current.onChange(0)}
      onKeyDown={(e) => {
        const v = latest.current.value;
        const step = e.shiftKey ? 0.1 : 0.5;
        const down = v <= SILENCE_DB ? SILENCE_DB : v - step;
        const to = keyTarget(e, {
          ArrowUp: above(v) + step,
          ArrowRight: above(v) + step,
          ArrowDown: down,
          ArrowLeft: down,
          PageUp: above(v) + 3,
          PageDown: v - 3,
          Home: SILENCE_DB,
          End: MAX_DB,
        });
        if (to === undefined) return;
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
