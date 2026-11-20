import type { ComponentType } from "react";

/** What Jali passes an icon: a pixel size, a class, and `aria-hidden` (a label always sits beside it). */
export interface JaliIconProps {
  /** Jali passes a number of pixels: the default for the icon's place. A string is allowed so icon sets that take one (such as Phosphor) fit in React 18's types. */
  size?: number | string;
  /** The class that sizes the icon from its place's token (`--jali-icon-header`…). Put it on the icon's element. */
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

/** An icon Jali can draw: any component that takes these props, such as a Phosphor, Lucide or Heroicons icon. */
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
  | "fullScreen"
  | "exitFullScreen"
  | "tuck"
  | "putBack"
  | "newTab"
  | "more"
  | "menu"
  | "popOut"
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

/** One icon per name. `<JaliRoot icons>` takes any part of it; `defaultIcons` is all of it. */
export type JaliIcons = Record<JaliIconName, JaliIcon>;
