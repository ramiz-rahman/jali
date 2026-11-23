/**
 * The pan dial: a dial with a pointer, turning through 270° (L100 at 7 o'clock, C at 12, R100 at 5). Turned round its
 * centre like the jog (relative: grabbing it never jumps it), 270° of turn is the full range. Near C it settles into a
 * detent (within 4, unless Shift is held); Shift turns it finely (a quarter as far). The mouse wheel moves 5 a notch,
 * the arrow keys 1 (Shift: 10), Home and End go to the ends, and a double-click centres it.
 */
import { useRef } from "react";
import { clamp } from "../../lib/numbers";
import { angleOf, sliderProps, turnBy, useDrag } from "../../lib/drag";
import { feelSlide } from "../../lib/feel";
import { keyTarget, useWheel, wheelDelta } from "../../lib/input";
import { DialBody, DialTicks, turnedTo } from "./parts";

/** The value's range, either side of C. */
const RANGE = 100;
/** Degrees of the dial for one unit of the value: 270° for the whole range. */
const DEGREES = 270 / (2 * RANGE);
const TICKS = [-100, -50, 0, 50, 100];

export function PanDial(p: {
  label: string;
  /** −100 (left) to 100 (right). */
  value: number;
  onChange(value: number): void;
  valueText?: string;
  /** The colour of the ring on its face (`data-cap`, which the styles read). */
  cap?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const latest = useRef(p);
  latest.current = p;
  const set = (v: number, fine = false) => {
    const from = latest.current.value;
    let to = clamp(Math.round(v), -RANGE, RANGE);
    if (!fine && Math.abs(to) < 4) to = 0;
    if (to === from) return;
    latest.current.onChange(to);
    feelSlide(from, to, { min: -RANGE, max: RANGE, step: 10, detents: [0] });
  };

  useWheel(ref, (e) => {
    const d = wheelDelta(e, { upIsMore: true });
    set(latest.current.value + Math.sign(d) * (e.shiftKey ? 1 : 5), true);
  });

  const drag = useDrag({
    start: (e) =>
      body.current
        ? { angle: angleOf(body.current, e.clientX, e.clientY), raw: latest.current.value }
        : null,
    move(e, t) {
      if (!body.current) return;
      const a = angleOf(body.current, e.clientX, e.clientY);
      t.raw = clamp(
        t.raw + (turnBy(t.angle, a) / DEGREES) * (e.shiftKey ? 0.25 : 1),
        -RANGE,
        RANGE,
      );
      t.angle = a;
      set(t.raw, e.shiftKey);
    },
  });

  return (
    <div
      ref={ref}
      className={`dial pan-dial ${p.className ?? ""}`}
      {...sliderProps({ label: p.label, min: -RANGE, max: RANGE, now: p.value, text: p.valueText })}
      data-cap={p.cap}
      style={turnedTo(p.value * DEGREES)}
      {...drag}
      onDoubleClick={() => latest.current.onChange(0)}
      onKeyDown={(e) => {
        const v = latest.current.value;
        const step = e.shiftKey ? 10 : 1;
        const to = keyTarget(e, {
          ArrowRight: v + step,
          ArrowUp: v + step,
          ArrowLeft: v - step,
          ArrowDown: v - step,
          Home: -RANGE,
          End: RANGE,
        });
        if (to === undefined) return;
        e.preventDefault();
        set(to, true);
      }}
    >
      <DialTicks
        ticks={TICKS.map((v) => ({
          key: v,
          angle: v * DEGREES,
          reset: v === 0,
          on: v === 0 && p.value === 0,
        }))}
      />
      <DialBody mark="pointer" ref={body} />
    </div>
  );
}
