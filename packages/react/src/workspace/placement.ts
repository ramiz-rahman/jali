/**
 * Where everything in the layout goes, from one calculation over core's `frames`: which presentation shows, the box
 * the frames sit in, each frame's final rect (a pane alone full-bleed included), and stacked view's divider. `<Panes>`
 * measures the area and knows whether the keyboard is up and where the person left the divider; it draws what this
 * returns. Pure: no React, so it is tested on its own.
 */
import type { ViewState } from "@jali/core";
import {
  SWITCHER_H,
  defaultStackShare,
  frames,
  stackSplit,
  type Frame,
  type Model,
  type Presentation,
} from "@jali/core/adapter";

/** A box in the layout's coordinates. */
export interface LayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PlacementInput {
  /** The measured area: the instance's size inside its inset. */
  area: { width: number; height: number };
  /** A curated page is showing (its tabs choose the view, so there is no pane switcher and no stacking). */
  page?: boolean;
  /** The on-screen keyboard is up: stacked view shows one pane, unless across a fold. */
  keyboardUp?: boolean;
  /** Stacked view: the top pane's share once the person moved the divider. Left out, the kinds' heights decide. */
  share?: number;
}

export interface Placement {
  presentation: Presentation;
  /** Tiled, with one pane on screen and nothing zoomed: drawn full-bleed and quiet. */
  alone: boolean;
  /** Stacked view: two linked panes, one above the other or either side of a fold. */
  stacked: boolean;
  /** Where the frames are measured from (under the pane switcher in single view, inside the inset when tiled). */
  inner: LayoutBox;
  /** The element the frames are drawn in: `inner`, or the whole instance when a pane is alone. */
  bleed: LayoutBox;
  /** Every pane's frame, with its final rect in `bleed`'s coordinates. */
  frames: Frame[];
  /** Stacked view without a fold: the divider, in the room between the panes, and the top pane's share it shows. */
  divider?: { share: number; y: number; height: number };
}

export function placement(m: Model, view: ViewState, input: PlacementInput): Placement {
  const { area, page = false, keyboardUp = false } = input;
  const single = m.onePane;
  const presentation: Presentation = single ? "single" : "tiled";
  const { inset, gap } = m.env.spacing;
  // On a phone the page tabs already choose the view, so a curated page has no pane switcher under them.
  const switcherH = page ? 0 : SWITCHER_H;
  const inner: LayoutBox = single
    ? {
        left: 0,
        top: switcherH,
        width: area.width + inset * 2,
        height: Math.max(0, area.height + inset * 2 - switcherH),
      }
    : { left: inset, top: inset, width: area.width, height: area.height };
  // One pane on screen, tiled: full-bleed and quiet, as a plain tab strip would be. Not a maximised pane: the others
  // are behind it, and it needs its Restore.
  const alone =
    !single && !page && !view.zoomed && m.resolved.panes.filter((b) => !b.hidden).length === 1;
  const bleed: LayoutBox = alone
    ? { left: 0, top: 0, width: area.width + inset * 2, height: area.height + inset * 2 }
    : inner;
  // Across a fold the two halves stay whatever the keyboard does: they are two screens.
  const stacked = single && !page && !!m.stacked && (!keyboardUp || !!m.stacked.hinge);
  // The top pane's share, worked out once: the frames are split by it and the divider shows it.
  const share = stacked ? (input.share ?? defaultStackShare(m, inner.height)) : undefined;
  const placed = frames(
    m,
    view,
    presentation,
    { width: inner.width, height: inner.height },
    stacked ? share : false,
    { x: inner.left, y: inner.top },
  );
  const whole = { x: 0, y: 0, width: bleed.width, height: bleed.height };
  return {
    presentation,
    alone,
    stacked,
    inner,
    bleed,
    // A row that scrolls places its own frames along its content.
    frames: alone ? placed.map((f) => (f.hidden || f.strip ? f : { ...f, rect: whole })) : placed,
    ...(share !== undefined && !m.stacked?.hinge
      ? { divider: { share, ...stackSplit(inner.height, share, gap) } }
      : {}),
  };
}
