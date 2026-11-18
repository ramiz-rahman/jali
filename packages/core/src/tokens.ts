/** Geometry shared by layout math (TS) and styles (CSS). One source: `applyTokens` writes them as CSS variables at boot. */

/** The gap between panes, and the workspace's inset. */
export const GAP = 6;
export const TOPBAR_H = 48;
export const STATUS_H = 28;
/** Height of the pane switcher in single view. */
export const SWITCHER_H = 44;

export function applyTokens(root: HTMLElement = document.documentElement) {
  root.style.setProperty("--gap", `${GAP}px`);
  root.style.setProperty("--topbar-h", `${TOPBAR_H}px`);
  root.style.setProperty("--status-h", `${STATUS_H}px`);
  root.style.setProperty("--switcher-h", `${SWITCHER_H}px`);
}

/** First guess at the workspace before the ResizeObserver measures it: the window minus bars and insets. */
export const initialArea = () =>
  typeof window === "undefined"
    ? { width: 1200, height: 700 }
    : {
        width: window.innerWidth - GAP * 2,
        height: window.innerHeight - TOPBAR_H - STATUS_H - GAP * 2,
      };
