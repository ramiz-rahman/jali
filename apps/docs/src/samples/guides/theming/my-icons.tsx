import type { JaliIcon, JaliIcons } from "jali/react";

/** Your design system's icons: one SVG sprite, a symbol per icon. */
export const sprite = (id: string): JaliIcon =>
  function SpriteIcon({ size = 16, className, "aria-hidden": hidden }) {
    return (
      <svg width={size} height={size} className={className} aria-hidden={hidden}>
        <use href={`/icons.svg#${id}`} />
      </svg>
    );
  };

/** Every icon Jali draws, from your set. Leave one out and the type says which. */
export const myIcons: JaliIcons = {
  close: sprite("x"),
  maximise: sprite("expand"),
  restore: sprite("collapse"),
  fullScreen: sprite("fullscreen"),
  exitFullScreen: sprite("fullscreen-exit"),
  tuck: sprite("minus"),
  putBack: sprite("undo"),
  newTab: sprite("plus"),
  more: sprite("chevron-down"),
  menu: sprite("more-horizontal"),
  popOut: sprite("picture-in-picture"),
  current: sprite("check"),
  fold: sprite("fold"),
  grip: sprite("grip"),
  follow: sprite("link"),
  keep: sprite("anchor"),
  pin: sprite("pin"),
  activityError: sprite("x-bold"),
  defaultKind: sprite("square"),
  openBeside: sprite("panel-right"),
  openFull: sprite("expand"),
  addToTabs: sprite("layers"),
  singleView: sprite("square"),
  splitView: sprite("columns"),
  back: sprite("undo"),
  reset: sprite("rotate-ccw"),
  dropLeft: sprite("arrow-left"),
  dropRight: sprite("arrow-right"),
  dropTop: sprite("arrow-up"),
  dropBottom: sprite("arrow-down"),
  dropSwap: sprite("arrows-left-right"),
  dropTab: sprite("square-plus"),
};
