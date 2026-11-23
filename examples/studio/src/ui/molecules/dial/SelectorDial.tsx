/**
 * The selector dial, for a few values (Studio's speed): the jog's dial with a pointer, snapping to printed detents
 * 60° apart. Press anywhere on it and turn: it points where the pointer is and snaps to the nearest detent. The mouse
 * wheel steps one detent per notch, the arrow keys step, Home and End go to the ends, and a double-click puts it back
 * to `reset` (its detent is marked).
 */
import { useRef } from "react";
import { clamp } from "../../lib/numbers";
import { angleOf, sliderProps, useDrag } from "../../lib/drag";
import { feelSlide } from "../../lib/feel";
import { keyTarget, useWheel, wheelDelta } from "../../lib/input";
import { DialBody, DialTicks, turnedTo } from "./parts";

/** Degrees between detents. */
const SPREAD = 60;

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
  const body = useRef<HTMLSpanElement>(null);
  const lastNotch = useRef(0);
  const latest = useRef(p);
  latest.current = p;
  const n = p.values.length;
  const angleAt = (i: number) => (i - (n - 1) / 2) * SPREAD;
  const index = Math.max(0, p.values.indexOf(p.value));
  const indexNow = () => latest.current.values.indexOf(latest.current.value);
  const choose = (i: number) => {
    const { values, value, onChange } = latest.current;
    const from = values.indexOf(value);
    const to = clamp(i, 0, values.length - 1);
    if (to === from) return;
    onChange(values[to]!);
    // Every position is a detent; the first and the last are the ends of its travel.
    feelSlide(from, to, { min: 0, max: values.length - 1, detents: [to] });
  };
  /** The detent nearest the pointer. */
  const nearest = (x: number, y: number) =>
    body.current ? Math.round(angleOf(body.current, x, y) / SPREAD + (n - 1) / 2) : index;

  useWheel(ref, (e) => {
    // One detent a notch: a trackpad's run of small deltas is one notch every 120 ms.
    if (e.timeStamp - lastNotch.current < 120) return;
    lastNotch.current = e.timeStamp;
    choose(indexNow() + (wheelDelta(e, { upIsMore: true }) > 0 ? 1 : -1));
  });

  const drag = useDrag({
    start(e) {
      choose(nearest(e.clientX, e.clientY));
      return true;
    },
    move: (e) => choose(nearest(e.clientX, e.clientY)),
  });

  return (
    <div
      ref={ref}
      className={`dial selector-dial ${p.className ?? ""}`}
      {...sliderProps({ label: p.label, min: 0, max: n - 1, now: index, text: p.format(p.value) })}
      style={turnedTo(angleAt(index))}
      {...drag}
      onDoubleClick={() => latest.current.onChange(latest.current.reset)}
      onKeyDown={(e) => {
        const i = indexNow();
        const to = keyTarget(e, {
          ArrowRight: i + 1,
          ArrowUp: i + 1,
          ArrowLeft: i - 1,
          ArrowDown: i - 1,
          Home: 0,
          End: n - 1,
        });
        if (to === undefined) return;
        e.preventDefault();
        choose(to);
      }}
    >
      <DialTicks
        ticks={p.values.map((v, i) => ({
          key: v,
          angle: angleAt(i),
          on: i === index,
          reset: v === p.reset,
        }))}
      />
      <DialBody mark="pointer" ref={body} />
    </div>
  );
}
