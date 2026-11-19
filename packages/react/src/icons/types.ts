import type { ComponentType } from "react";

/** What Jali passes an icon: a pixel size, sometimes a class, and `aria-hidden` (a label always sits beside it). */
export interface JaliIconProps {
  /** Jali passes a number of pixels. A string is allowed so icon sets that take one (Phosphor) fit in React 18's types. */
  size?: number | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

/** An icon Jali can draw: any Phosphor icon, or any component that takes these props. */
export type JaliIcon = ComponentType<JaliIconProps>;

/**
 * Every icon Jali draws in its own chrome, by what it means. A kind's icon is the kind's own (`definePane({ icon })`);
 * `defaultKind` is drawn for a kind without one.
 */
export type JaliIconName =
  // a pane's header and tabs
  | "close"
  | "maximise"
  | "restore"
  | "tuck"
  | "putBack"
  | "newTab"
  | "more"
  | "current"
  | "fold"
  | "grip"
  | "follow"
  | "keep"
  | "pin"
  | "activityError"
  | "defaultKind"
  // the peek sheet and the chooser
  | "openBeside"
  | "openFull"
  | "addToTabs"
  // a curated page's bar
  | "singleView"
  | "splitView"
  | "back"
  | "reset"
  // what a drop will do
  | "dropLeft"
  | "dropRight"
  | "dropTop"
  | "dropBottom"
  | "dropSwap"
  | "dropTab";

/** One icon per name: the complete set `@jali/react/bare` needs. `@jali/react` takes any part of it. */
export type JaliIcons = Record<JaliIconName, JaliIcon>;
