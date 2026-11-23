/** Printed glyphs: plain geometry, one stroke weight, like the legends on a recorder's keys. */
import type { ReactNode } from "react";

export type TransportGlyph = "play" | "pause" | "stop" | "back" | "forward" | "loop";

const SHAPES: Record<TransportGlyph, ReactNode> = {
  play: <path d="M6.5 4.5v11l8.5-5.5z" />,
  pause: (
    <>
      <rect x="5.5" y="4.5" width="3" height="11" />
      <rect x="11.5" y="4.5" width="3" height="11" />
    </>
  ),
  stop: <rect x="5.5" y="5.5" width="9" height="9" />,
  back: <path d="M10 5v10L3 10zM17 5v10l-7-5z" />,
  forward: <path d="M10 5v10l7-5zM3 5v10l7-5z" />,
  loop: (
    <path
      d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H15m0 0-2.5-2.5M15 5l-2.5 2.5M16 11v1.5A2.5 2.5 0 0 1 13.5 15H5m0 0 2.5 2.5M5 15l2.5-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
    />
  ),
};

/** A transport key's glyph. */
export function Glyph({ name }: { name: TransportGlyph }) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden className="face-glyph glyph">
      {SHAPES[name]}
    </svg>
  );
}

/** A rectangle of a plan: x, y, width, height, on a 22 × 16 grid. */
export type PlanRect = readonly [number, number, number, number];

/** A plan drawn small, as outlined rectangles: a layout's panes, where they sit. */
export function PlanGlyph({ rects }: { rects: readonly PlanRect[] }) {
  return (
    <svg viewBox="0 0 22 16" width="29" height="21" aria-hidden className="face-glyph">
      {rects.map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      ))}
    </svg>
  );
}

/** Studio's mark: four bars of a waveform, the loudest in signal orange. */
export function StudioMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="brand-mark">
      <rect x="2" y="9" width="3" height="6" rx="1.5" />
      <rect x="7.5" y="5" width="3" height="14" rx="1.5" />
      <rect x="13" y="2" width="3" height="20" rx="1.5" className="brand-mark-hot" />
      <rect x="18.5" y="7" width="3" height="10" rx="1.5" />
    </svg>
  );
}
