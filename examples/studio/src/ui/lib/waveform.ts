/**
 * Waveforms: rounded bars, quiet until played, signal orange after, drawn on a canvas from an envelope (a loudness
 * value every so often, 0 to 1).
 */

/** What a waveform is drawn from. */
export interface Envelope {
  peaks: ArrayLike<number>;
  /** Values per second. */
  perSecond: number;
  /** The loudest value, so a quiet envelope can be scaled up to its box. */
  loudest: number;
}

export interface Bars {
  envelope: Envelope;
  /** The box to fill, in CSS pixels; bars are centred on its middle line. */
  box: { x: number; y: number; w: number; h: number };
  /** The times the box spans, in seconds. */
  from: number;
  to: number;
  /** Bar colours: not yet played, played, and (optionally) not yet played inside `mark`. */
  idle: string;
  played: string;
  marked?: string;
  /** Bars at or before this time are played; -1 for none. */
  playedUntil?: number;
  /** A range drawn in `marked` (a selected segment). */
  mark?: { from: number; to: number };
  /** A bar's width and the gap between bars, in pixels. */
  bar?: number;
  gap?: number;
  /** How much of the box's height the loudest bar fills. */
  fill?: number;
}

/** The bars of an envelope from `from` to `to`, into their box. */
export function drawBars(g: CanvasRenderingContext2D, b: Bars) {
  const { envelope, box, from, to, playedUntil = -1, mark, bar = 2, gap = 1, fill = 1 } = b;
  const { peaks, perSecond } = envelope;
  const scale = fill / envelope.loudest;
  const n = Math.max(1, Math.floor((box.w + gap) / (bar + gap)));
  const span = to - from;
  const mid = box.y + box.h / 2;
  for (let i = 0; i < n; i++) {
    const t0 = from + (i / n) * span;
    const t1 = from + ((i + 1) / n) * span;
    let v = 0;
    const a = Math.floor(t0 * perSecond);
    const z = Math.max(a + 1, Math.ceil(t1 * perSecond));
    for (let k = a; k < z && k < peaks.length; k++) v = Math.max(v, peaks[k]!);
    const h = Math.max(1.5, Math.min(1, v * scale) * (box.h - 2));
    const centre = (t0 + t1) / 2;
    g.fillStyle =
      centre <= playedUntil
        ? b.played
        : mark && b.marked && centre >= mark.from && centre <= mark.to
          ? b.marked
          : b.idle;
    g.beginPath();
    g.roundRect(box.x + i * (bar + gap), mid - h / 2, bar, h, Math.min(bar / 2, h / 2, 1.5));
    g.fill();
  }
}
