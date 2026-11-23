/**
 * The jog dial, for scrubbing: a knurled dial with a finger dimple, turned by dragging round its centre. The dial
 * follows the pointer's angle, and the mapping is fixed: one full turn is `perTurn` of the value (Studio: 10 seconds),
 * so the dimple sits under the finger all the way round. The mouse wheel or a trackpad turns it too (100 of delta is
 * one unit), and the arrow keys step one (Shift: five), Page Up and Down ten, Home and End go to the ends.
 *
 * `onTurn` gives each move of a turn as a distance, for a value that moves on its own while the hand is on the dial
 * (a playhead that is playing); without it, `onChange` gets the value the turn has reached.
 */
import { useRef } from "react";
import { clamp } from "../../../numbers";
import { angleOf, sliderProps, turnBy, useDrag } from "../../lib/drag";
import { keyTarget, useWheel, wheelDelta } from "../../lib/input";
import { DialBody, turnedTo } from "./parts";

export function JogDial(p: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  /** While a hand turns the dial: how far it just turned, in the value's units. */
  onTurn?(by: number): void;
  valueText?: string;
  /** How far one full turn moves the value. */
  perTurn: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const latest = useRef(p);
  latest.current = p;
  const set = (v: number) =>
    latest.current.onChange(clamp(v, latest.current.min, latest.current.max));

  useWheel(ref, (e) => set(latest.current.value + wheelDelta(e) / 100));

  const drag = useDrag({
    start: (e) =>
      body.current
        ? { angle: angleOf(body.current, e.clientX, e.clientY), value: latest.current.value }
        : null,
    move(e, t) {
      if (!body.current) return;
      const a = angleOf(body.current, e.clientX, e.clientY);
      const by = (turnBy(t.angle, a) / 360) * latest.current.perTurn;
      t.value += by;
      t.angle = a;
      if (latest.current.onTurn) latest.current.onTurn(by);
      else set(t.value);
    },
  });

  return (
    <div
      ref={ref}
      className={`dial jog-dial ${p.className ?? ""}`}
      {...sliderProps({
        label: p.label,
        min: p.min,
        max: Math.round(p.max),
        now: Math.round(p.value),
        text: p.valueText,
      })}
      style={turnedTo((p.value / p.perTurn) * 360)}
      {...drag}
      onKeyDown={(e) => {
        const v = latest.current.value;
        const step = e.shiftKey ? 5 : 1;
        const to = keyTarget(e, {
          ArrowRight: v + step,
          ArrowUp: v + step,
          ArrowLeft: v - step,
          ArrowDown: v - step,
          PageUp: v + 10,
          PageDown: v - 10,
          Home: latest.current.min,
          End: latest.current.max,
        });
        if (to === undefined) return;
        e.preventDefault();
        set(to);
      }}
    >
      <DialBody mark="dimple" ref={body} />
    </div>
  );
}
