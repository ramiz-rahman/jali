/**
 * What every dial is made of: a body turned round its centre (with a pointer, or a finger's dimple) and, on a dial
 * with positions, the ticks printed round it. Angles are degrees clockwise from 12 o'clock; the styles turn the body to
 * `--angle` and set each tick at `--at`.
 */
import type { CSSProperties, Ref } from "react";

/** The angle a dial's styles turn it to. */
export const turnedTo = (angle: number) => ({ "--angle": `${angle}deg` }) as CSSProperties;

/** The turning body: `ref` is what the hand's angle is measured round. */
export function DialBody({ mark, ref }: { mark: "pointer" | "dimple"; ref: Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} className="dial-body" aria-hidden>
      <span className="dial-face">
        <span className={mark === "pointer" ? "dial-pointer" : "dial-dimple"} />
      </span>
    </span>
  );
}

/** The ticks printed round a dial: lit where the dial points, longer at its reset position. */
export function DialTicks({
  ticks,
}: {
  ticks: readonly { key: string | number; angle: number; on?: boolean; reset?: boolean }[];
}) {
  return (
    <span className="dial-ticks" aria-hidden>
      {ticks.map((t) => (
        <span
          key={t.key}
          className="dial-tick"
          data-on={t.on ? "" : undefined}
          data-reset={t.reset ? "" : undefined}
          style={{ "--at": `${t.angle}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
