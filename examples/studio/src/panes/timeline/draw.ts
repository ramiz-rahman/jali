/**
 * The timeline's glass, drawn from a plain description of what is on it: the ruler, a loop, the lanes with their
 * waveforms and selected segments, the markers, the pointer's time and the playhead. No React here: the pane builds
 * the scene and draws it every frame while it plays.
 */
import type { Loop } from "../../audio/engine";
import { clamp } from "../../ui/lib/numbers";
import { clock } from "../../sessions/format";
import type { MarkerData, SegmentData, TrackData } from "../../sessions/types";
import type { Envelope } from "../../sessions/derive";
import type { ScreenPalette } from "../../ui/lib/canvas";
import { drawBars } from "../../ui/lib/waveform";

/** The ruler: a row of timecodes over a row of flags. */
export const RULER = 36;

export interface Lane {
  track: TrackData;
  y: number;
  h: number;
  envelope: Envelope;
  /** The track has words in the transcript: its bars are speech. */
  withWords: boolean;
  /** The mix lets it be heard. */
  heard: boolean;
  /** Its segments some list has selected, bracketed on the lane. */
  selected: readonly SegmentData[];
}

export interface Scene {
  width: number;
  height: number;
  duration: number;
  lanes: readonly Lane[];
  markers: readonly MarkerData[];
  loop: Loop | null;
  /** The pointer's x, or null. */
  hover: number | null;
  /** The playhead's time, or -1 when the session isn't in the transport. */
  playhead: number;
}

type Draw = (
  g: CanvasRenderingContext2D,
  s: Scene,
  c: ScreenPalette,
  x: (t: number) => number,
) => void;

export function drawTimeline(g: CanvasRenderingContext2D, scene: Scene, c: ScreenPalette) {
  const x = (t: number) => (t / scene.duration) * scene.width;
  g.font = `500 11px ${c.readout}`;
  g.textBaseline = "middle";
  for (const draw of [ruler, loop, lanes, markers, hover, playhead]) draw(g, scene, c, x);
}

/** Timecodes printed on the ruler's top row, a long tick for each and a short one every second; the flags' row below. */
const ruler: Draw = (g, { width, duration }, c, x) => {
  // A timecode needs about 52px (its five characters and a gap): the step between labels is the smallest round
  // number of seconds that gives it that.
  const perSecond = width / duration;
  const every = [5, 10, 20, 30, 60, 120, 300].find((s) => s * perSecond >= 52) ?? 600;
  const everySecond = perSecond >= 6;
  for (let t = 0; t <= duration; t += 1) {
    const major = t % every === 0;
    const mid = t % (every >= 60 ? 10 : 5) === 0;
    if (!major && !mid && !everySecond) continue;
    const tx = Math.round(x(t));
    g.fillStyle = major ? c.dim : c.line;
    const top = major ? 2 : mid ? RULER - 8 : RULER - 4;
    g.fillRect(tx, top, 1, major ? 12 : RULER - top);
    if (!major) continue;
    g.fillRect(tx, RULER - 8, 1, 8);
    if (x(t) < width - 40) {
      g.fillStyle = c.dim;
      g.fillText(clock(t), tx + 4, 8);
    }
  }
  g.fillStyle = c.line;
  g.fillRect(0, RULER - 1, width, 1);
};

/** The loop: two orange lines down the lanes and a bar across the ruler's foot. No fill on the glass. */
const loop: Draw = (g, { loop: l, height }, c, x) => {
  if (!l) return;
  g.fillStyle = c.played;
  g.fillRect(x(l.start), RULER - 3, x(l.end) - x(l.start), 2);
  g.fillRect(Math.round(x(l.start)), RULER, 1, height - RULER);
  g.fillRect(Math.round(x(l.end)), RULER, 1, height - RULER);
};

/** A lane keeps up to 5px of glass above and below its bars, less when eight tracks share a short pane. */
const pad = (h: number) => clamp(h * 0.12, 1.5, 5);

const lanes: Draw = (g, { lanes: all, width, duration, playhead: until }, c, x) => {
  for (const lane of all) {
    const { y, h } = lane;
    g.globalAlpha = lane.heard ? 1 : 0.35;
    // A selected segment is bracketed, not filled: an orange in and out line with short arms.
    g.fillStyle = c.played;
    for (const seg of lane.selected) {
      const a = Math.round(x(seg.start));
      const b = Math.round(x(seg.end));
      g.fillRect(a, y + 2, 2, h - 4);
      g.fillRect(b - 2, y + 2, 2, h - 4);
      g.fillRect(a, y + 2, 6, 2);
      g.fillRect(a, y + h - 4, 6, 2);
      g.fillRect(b - 6, y + 2, 6, 2);
      g.fillRect(b - 6, y + h - 4, 6, 2);
    }
    drawBars(g, {
      envelope: lane.envelope,
      box: { x: 0, y: y + pad(h), w: width, h: h - 2 * pad(h) },
      from: 0,
      to: duration,
      idle: lane.withWords ? c.idle : c.music,
      played: c.played,
      playedUntil: until,
      fill: 0.95,
    });
    g.globalAlpha = 1;
    g.fillStyle = c.line;
    g.fillRect(0, Math.round(y + h) - 1, width, 1);
  }
};

/** A flag on the ruler for each marker, its name beside it when there is room before the next, a faint line down. */
const markers: Draw = (g, { markers: ms, width, height }, c, x) => {
  ms.forEach((m, i) => {
    const mx = Math.round(x(m.time));
    const next = ms[i + 1] ? x(ms[i + 1]!.time) : width;
    g.fillStyle = c.dim;
    g.fillRect(mx, RULER, 1, height - RULER);
    g.fillStyle = c.played;
    g.beginPath();
    g.moveTo(mx, RULER - 1);
    g.lineTo(mx, RULER - 16);
    g.lineTo(mx + 7, RULER - 16);
    g.lineTo(mx + 7, RULER - 9);
    g.lineTo(mx + 1, RULER - 9);
    g.closePath();
    g.fill();
    if (mx + 10 + g.measureText(m.label).width + 6 < next) {
      g.fillStyle = c.text;
      g.fillText(m.label, mx + 10, RULER - 12);
    }
  });
};

/** The pointer: a line down the lanes and its time on a small tag at the foot. */
const hover: Draw = (g, { hover: at, width, height, duration }, c) => {
  if (at === null) return;
  const hx = Math.round(at);
  g.fillStyle = c.dim;
  g.globalAlpha = 0.5;
  g.fillRect(hx, RULER, 1, height - RULER);
  g.globalAlpha = 1;
  const label = clock(clamp((at / width) * duration, 0, duration));
  const tw = g.measureText(label).width + 8;
  const tx = clamp(hx - tw / 2, 0, width - tw);
  g.fillStyle = c.dim;
  g.fillRect(tx, height - 15, tw, 14);
  g.fillStyle = c.text;
  g.fillText(label, tx + 4, height - 7);
};

/** The playhead: a hairline, with a cap in the timecodes' row (so it never covers a marker's name) pointing down. */
const playhead: Draw = (g, { playhead: t, height }, c, x) => {
  if (t < 0) return;
  const px = Math.round(x(t));
  g.fillStyle = c.played;
  g.fillRect(px - 1, 12, 2, height - 12);
  g.beginPath();
  g.moveTo(px - 6, 1);
  g.lineTo(px + 6, 1);
  g.lineTo(px + 6, 8);
  g.lineTo(px, 14);
  g.lineTo(px - 6, 8);
  g.closePath();
  g.fill();
  g.fillStyle = "rgb(255 255 255 / 0.5)";
  g.fillRect(px - 5, 2, 10, 1);
};
