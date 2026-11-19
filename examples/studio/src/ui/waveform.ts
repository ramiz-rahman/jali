/**
 * Waveforms in Spoke's manner: rounded bars, quiet zinc until played, signal orange after. Drawn on a canvas, from
 * envelopes at 50 values a second that come with each session's tracks (measured when the session was built).
 */
import { useLayoutEffect, useState, type RefObject } from "react";
import type { SessionData } from "../sessions/sessions";

export const PEAKS_PER_SECOND = 50;

const cache = new Map<string, Float32Array>();

/** A track's envelope across the whole session, 0 to 1. One scale for all of a session's tracks. */
export function trackPeaks(session: SessionData, track: string): Float32Array {
  const key = `${session.id}/${track}`;
  let out = cache.get(key);
  if (out) return out;
  const peaks = session.tracks.find((t) => t.id === track)?.peaks ?? [];
  out = Float32Array.from(peaks, (v) => v / 99);
  cache.set(key, out);
  return out;
}

/** A voice track's envelope: the same as any track's, now that every track is one recording. */
export const voicePeaks = trackPeaks;

/** The whole session in one envelope, the loudest track at each moment: the library's thumbnails. */
export function overviewPeaks(session: SessionData): Float32Array {
  const key = `${session.id}/*`;
  let out = cache.get(key);
  if (out) return out;
  const all = session.tracks.map((t) => trackPeaks(session, t.id));
  out = new Float32Array(Math.max(0, ...all.map((a) => a.length)));
  for (const a of all) for (let i = 0; i < a.length; i++) if (a[i]! > out[i]!) out[i] = a[i]!;
  cache.set(key, out);
  return out;
}

export interface BarStyle {
  idle: string;
  played: string;
  /** Bars inside a highlighted range (a selected segment) when unplayed. */
  marked?: string;
  bar?: number;
  gap?: number;
}

export interface BarRange {
  from: number;
  to: number;
}

/**
 * Bars for `peaks` between the times `from` and `to`, into the box (x, y, w, h), centred on its middle line. Bars at
 * or before `playedUntil` take `style.played`; unplayed ones inside `mark` take `style.marked`.
 */
export function drawBars(
  g: CanvasRenderingContext2D,
  peaks: ArrayLike<number>,
  box: { x: number; y: number; w: number; h: number },
  range: BarRange,
  style: BarStyle,
  playedUntil = -1,
  mark?: BarRange | null,
  scale = 1,
) {
  const bar = style.bar ?? 2;
  const gap = style.gap ?? 1;
  const n = Math.max(1, Math.floor((box.w + gap) / (bar + gap)));
  const span = range.to - range.from;
  const mid = box.y + box.h / 2;
  for (let i = 0; i < n; i++) {
    const t0 = range.from + (i / n) * span;
    const t1 = range.from + ((i + 1) / n) * span;
    let v = 0;
    const a = Math.floor(t0 * PEAKS_PER_SECOND);
    const b = Math.max(a + 1, Math.ceil(t1 * PEAKS_PER_SECOND));
    for (let k = a; k < b && k < peaks.length; k++) v = Math.max(v, peaks[k]!);
    v = Math.min(1, v * scale);
    const hh = Math.max(1.5, v * (box.h - 2));
    const x = box.x + i * (bar + gap);
    const centre = (t0 + t1) / 2;
    g.fillStyle =
      centre <= playedUntil
        ? style.played
        : mark && style.marked && centre >= mark.from && centre <= mark.to
          ? style.marked
          : style.idle;
    roundBar(g, x, mid - hh / 2, bar, hh);
  }
}

function roundBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / 2, h / 2, 1.5);
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

/** The loudest value in an envelope: to scale a quiet track up to its box. */
export function loudest(peaks: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < peaks.length; i++) m = Math.max(m, peaks[i]!);
  return m || 1;
}

/** An element's size in CSS pixels, kept up to date. */
export function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((s) =>
        Math.round(s.width) === Math.round(r.width) && Math.round(s.height) === Math.round(r.height)
          ? s
          : { width: Math.round(r.width), height: Math.round(r.height) },
      );
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** A canvas sized for the screen's pixel density, and its 2D context in CSS pixels. */
export function prepare(canvas: HTMLCanvasElement | null, width: number, height: number) {
  if (!canvas || width <= 0 || height <= 0) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);
  return g;
}

const COLOURS = {
  idle: "--st-wave-idle",
  played: "--st-signal",
  marked: "--st-wave-marked",
  text: "--jali-text",
  subtle: "--jali-text-subtle",
  faint: "--jali-text-faint",
  line: "--jali-border",
  lineStrong: "--jali-border-strong",
  surface: "--jali-surface",
  signalSoft: "--st-signal-soft",
  music: "--st-wave-music",
  // On a screen (OLED glass): light marks on black, in both themes.
  scrIdle: "--scr-idle",
  scrBright: "--scr-bright",
  scrMusic: "--scr-music",
  scrInk: "--scr-ink",
  scrDim: "--scr-dim",
  scrLine: "--scr-line",
  scrBlock: "--scr-block",
  scrSoft: "--scr-soft",
  scrHot: "--scr-hot",
} as const;
type Palette = Record<keyof typeof COLOURS, string>;
let probe: HTMLElement | null = null;
let cached: { key: string; palette: Palette } | null = null;

/**
 * The app's colours for drawing, from its tokens. A token holds `light-dark(…)`, which a canvas can't read, so each
 * is resolved through a hidden element's `color`, once per theme.
 */
export function paletteOf(_el?: Element): Palette {
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const key = `${document.documentElement.dataset.theme ?? ""}|${dark}`;
  if (cached?.key === key) return cached.palette;
  if (!probe) {
    probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  const palette = {} as Palette;
  for (const [name, token] of Object.entries(COLOURS) as [keyof Palette, string][]) {
    probe.style.color = `var(${token})`;
    palette[name] = getComputedStyle(probe).color;
  }
  cached = { key, palette };
  return palette;
}

/**
 * The same names for drawing on a screen: every waveform and meter sits behind dark glass, so its marks are light,
 * in the light theme too.
 */
export function screenPaletteOf(el?: Element) {
  const c = paletteOf(el);
  return {
    ...c,
    idle: c.scrIdle,
    music: c.scrMusic,
    played: c.scrHot,
    text: c.scrInk,
    subtle: c.scrDim,
    faint: c.scrDim,
    line: c.scrLine,
    lineStrong: c.scrDim,
    signalSoft: c.scrSoft,
    block: c.scrBlock,
  };
}
