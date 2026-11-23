/**
 * Drawing on a canvas behind glass: the canvas sized for the screen, the box it fills, and the colours to draw with.
 * Every waveform and meter sits behind dark glass, so its marks are light in the light theme too.
 */
import { useLayoutEffect, useState, type RefObject } from "react";

/** An element's size in CSS pixels, whole, kept up to date. */
export function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const width = Math.round(r.width);
      const height = Math.round(r.height);
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** A canvas sized for the screen's pixel density, cleared, and its 2D context in CSS pixels; `null` with no room. */
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

/** The glass's colours, by what they mark, from the screen tokens (tokens.css). */
const TOKENS = {
  /** Bars not yet played: speech. */
  idle: "--scr-idle",
  /** Bars not yet played on a track with no words (music, a loop), and context outside a range. */
  music: "--scr-music",
  /** Bars inside the range in question. */
  bright: "--scr-bright",
  /** What has played, the playhead, a loop, a selection: signal orange. */
  played: "--scr-hot",
  /** Printed text. */
  text: "--scr-ink",
  /** Secondary print and strong rules. */
  dim: "--scr-dim",
  /** Fine rules. */
  line: "--scr-line",
} as const;

export type ScreenPalette = Record<keyof typeof TOKENS, string> & {
  /** The font family for numbers on glass. */
  readout: string;
};

let probe: HTMLElement | null = null;
let dark: MediaQueryList | null = null;
let cached: { theme: string | undefined; dark: boolean; palette: ScreenPalette } | null = null;

/**
 * The glass's colours for the theme in use. A token holds `light-dark(…)`, which a canvas can't read, so each is
 * resolved through a hidden element's `color`, once per theme: canvases ask every frame, so asking allocates nothing.
 */
export function screenPalette(): ScreenPalette {
  dark ??= window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  const theme = document.documentElement.dataset.theme;
  const isDark = !!dark?.matches;
  if (cached && cached.theme === theme && cached.dark === isDark) return cached.palette;
  if (!probe) {
    probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const palette = { readout: style.getPropertyValue("--font-readout") } as ScreenPalette;
  for (const [name, token] of Object.entries(TOKENS) as [keyof typeof TOKENS, string][]) {
    probe.style.color = `var(${token})`;
    palette[name] = getComputedStyle(probe).color;
  }
  cached = { theme, dark: isDark, palette };
  return palette;
}
