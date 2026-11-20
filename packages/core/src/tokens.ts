/**
 * Geometry shared by layout math (TS) and styles (CSS). The layout measures in pixels, so the numbers here (and a
 * workspace's own `createJali({ gap, inset })`) are the source of truth: `<JaliRoot>` writes them on its root as
 * `--jali-gap` and `--jali-inset`, and the styles read those (with these values as fallbacks). `applyTokens` writes
 * them on another element, for a host that reads them outside the workspace.
 * A host's own bars (a top bar, a status line) are the host's: Jali neither knows nor sets their heights.
 */

/** The default gap between panes, and the default inset from the workspace's edges to the panes. */
export const GAP = 6;
/** Height of the pane switcher in single view. */
export const SWITCHER_H = 44;

/** A workspace's spacing, in CSS pixels: between panes, and from the workspace's edges to them. */
export interface Spacing {
  gap: number;
  inset: number;
}

/** The spacing a workspace was given (`createJali({ gap, inset })`): the inset follows the gap unless set. */
export function spacingOf(o: { gap?: number; inset?: number } = {}): Spacing {
  const check = (v: number | undefined, name: string) => {
    if (v !== undefined && !(Number.isFinite(v) && v >= 0))
      throw new RangeError(`Jali: ${name} must be a finite number of pixels, 0 or more (got ${v})`);
    return v;
  };
  const gap = check(o.gap, "gap") ?? GAP;
  return { gap, inset: check(o.inset, "inset") ?? gap };
}

/** The spacing as CSS variables, for an element's style. */
export const spacingVars = ({
  gap,
  inset,
}: Spacing): Record<"--jali-gap" | "--jali-inset", string> => ({
  "--jali-gap": `${gap}px`,
  "--jali-inset": `${inset}px`,
});

export function applyTokens(
  root: HTMLElement = document.documentElement,
  spacing: Spacing = spacingOf(),
) {
  for (const [k, v] of Object.entries(spacingVars(spacing))) root.style.setProperty(k, v);
  root.style.setProperty("--jali-switcher-h", `${SWITCHER_H}px`);
}

/** First guess at the workspace before the ResizeObserver measures it: the window minus the workspace's inset. */
export const initialArea = (inset = GAP) =>
  typeof window === "undefined"
    ? { width: 1200, height: 700 }
    : { width: window.innerWidth - inset * 2, height: window.innerHeight - inset * 2 };
