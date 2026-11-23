/**
 * The segment's own waveform, a little either side of it, with the playhead when it is inside. Click to play from a
 * point.
 *
 * One clean glass, no fill. The segment's range is marked with lines: an in and an out line with flags at the top,
 * and a fine baseline between them. State lives in the bars: the context outside the segment dim, the segment's own
 * bars bright, the played part orange. A loop over the segment is a second bracket at the foot.
 */
import { useRef, useState, type PointerEvent } from "react";
import { useFrame } from "../../audio/react";
import { useServices } from "../../services";
import { envelopeOf, trackById } from "../../sessions/derive";
import type { SegmentData, SessionData } from "../../sessions/types";
import { prepare, screenPalette, useSize } from "../../ui/lib/canvas";
import { drawBars } from "../../ui/lib/waveform";

/** The context shown either side of the segment, in seconds. */
const MARGIN = 0.4;

export function MiniWave({
  seg,
  session,
  paused,
  inTransport,
  looping,
}: {
  seg: SegmentData;
  session: SessionData;
  paused: boolean;
  inTransport: boolean;
  looping: boolean;
}) {
  const { engine } = useServices();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  const [hover, setHover] = useState<number | null>(null);
  const track = trackById(session, seg.track);
  const from = Math.max(0, seg.start - MARGIN);
  const to = Math.min(session.duration, seg.end + MARGIN);
  const timeAt = (x: number) => from + (x / Math.max(1, width)) * (to - from);
  const xAt = (e: PointerEvent<HTMLDivElement>) =>
    e.clientX - e.currentTarget.getBoundingClientRect().left;

  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g || !track) return;
      const c = screenPalette();
      const x = (t: number) => ((t - from) / (to - from)) * width;
      const x0 = Math.round(x(seg.start));
      const x1 = Math.round(x(seg.end));
      const playhead = inTransport && pos >= from && pos <= to ? pos : -1;
      drawBars(g, {
        envelope: envelopeOf(track),
        box: { x: 0, y: 12, w: width, h: height - 24 },
        from,
        to,
        idle: c.music,
        marked: c.bright,
        played: c.played,
        playedUntil: playhead,
        mark: { from: seg.start, to: seg.end },
        bar: 3,
        gap: 2,
      });
      // The in and out lines with their flags, and the baseline between them.
      g.fillStyle = c.dim;
      g.fillRect(x0, 0, 1, height);
      g.fillRect(x1, 0, 1, height);
      g.fillRect(x0, 0, 7, 2);
      g.fillRect(x1 - 6, 0, 7, 2);
      g.fillStyle = c.line;
      g.fillRect(x0, Math.round(height / 2), x1 - x0, 1);
      if (looping) {
        g.fillStyle = c.played;
        g.fillRect(x0, height - 2, x1 - x0 + 1, 2);
        g.fillRect(x0, height - 7, 2, 7);
        g.fillRect(x1 - 1, height - 7, 2, 7);
      }
      if (playhead >= 0) {
        const px = Math.round(x(pos));
        g.fillStyle = c.played;
        g.fillRect(px - 1, 3, 2, height - 3);
        g.fillRect(px - 4, 0, 8, 3);
      }
      if (hover !== null) {
        g.fillStyle = c.dim;
        g.fillRect(Math.round(hover), 0, 1, height);
      }
    },
    [width, height, seg, hover, inTransport, looping],
  );

  return (
    <div
      ref={box}
      className="clip-wave screen"
      role="img"
      aria-label={`Waveform of the segment, ${(seg.end - seg.start).toFixed(1)} seconds. Click to play from a point.`}
      onPointerDown={(e) => engine.cue(session.id, timeAt(xAt(e)), engine.get().playing)}
      onPointerMove={(e) => setHover(xAt(e))}
      onPointerLeave={() => setHover(null)}
    >
      <canvas ref={canvas} />
    </div>
  );
}
