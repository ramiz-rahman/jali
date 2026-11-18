/**
 * Geometry shared by layout math (TS) and styles (CSS). The styles carry the same values as fallbacks
 * (`var(--jali-gap, 6px)`); `applyTokens` writes them as `--jali-*` variables on an element, for a host that reads them.
 * A host's own bars (a top bar, a status line) are the host's: Jali neither knows nor sets their heights.
 */

/** The gap between panes, and the workspace's inset. */
export const GAP = 6;
/** Height of the pane switcher in single view. */
export const SWITCHER_H = 44;

export function applyTokens(root: HTMLElement = document.documentElement) {
  root.style.setProperty("--jali-gap", `${GAP}px`);
  root.style.setProperty("--jali-switcher-h", `${SWITCHER_H}px`);
}

/** First guess at the workspace before the ResizeObserver measures it: the window minus the workspace's inset. */
export const initialArea = () =>
  typeof window === "undefined"
    ? { width: 1200, height: 700 }
    : { width: window.innerWidth - GAP * 2, height: window.innerHeight - GAP * 2 };
