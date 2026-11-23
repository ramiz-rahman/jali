/**
 * A number that flashes when it ticks: green up, red down, for a moment. The flash restarts on every tick by
 * alternating between two identical animations. Under reduced motion there is no flash; the arrow beside the
 * price still says which way it went.
 */
import { useRef, type ReactNode } from "react";

/** A price that ticks every moment (FX) flashes at most once a second, so a column of them stays calm. */
const CALM_MS = 1000;

export function Flash({
  value,
  dir,
  children,
}: {
  value: number;
  dir: 1 | -1 | 0;
  children: ReactNode;
}) {
  const seen = useRef({ value, n: 0, at: 0 });
  if (seen.current.value !== value) {
    const now = Date.now();
    const flash = now - seen.current.at >= CALM_MS;
    seen.current = {
      value,
      n: seen.current.n + (flash ? 1 : 0),
      at: flash ? now : seen.current.at,
    };
  }
  const flash = seen.current.n === 0 ? undefined : dir > 0 ? "up" : dir < 0 ? "down" : undefined;
  return (
    <span className="flash" data-flash={flash} data-beat={seen.current.n % 2}>
      {children}
    </span>
  );
}
