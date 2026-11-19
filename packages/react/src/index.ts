/**
 * @jali/react: React components and hooks for a Jali workspace, with Jali's own icons (`<JaliRoot icons>` replaces any;
 * `@jali/react/icons` exports the full set). Styles: "@jali/react/styles.css" (Jali's default
 * theme and the workspace, in the `jali` cascade layer); "@jali/react/tailwind.css" to take the app's Tailwind theme.
 */

export * from "./common";
export { JaliRoot, JaliProvider, type JaliRootProps } from "./JaliRoot";

// ---------- experimental ----------
// Pop out a pane into a floating window that stays on top (Document Picture-in-Picture: Chrome and Edge on desktop).
// A prototype: its name and shape may change in any release.
export {
  popOut as unstable_popOut,
  bringBack as unstable_bringBack,
  canPopOut as unstable_canPopOut,
} from "./pane/PopOut";
