/** How a pane is presented decides its chrome. Tiled panes are islands you can drag, maximise and tuck; in single
 *  view (phone) each pane is full-bleed, chosen from the switcher. */
export type Presentation = "tiled" | "single";

export interface Chrome {
  /** The header drags the pane (grip shown). */
  draggable: boolean;
  /** Maximise button and header double-click. */
  zoomable: boolean;
  tuckable: boolean;
  /** Border, radius and focus edge. */
  island: boolean;
  /** The header's close button shows even when the header holds tabs (each tab has its own ×). */
  closeWithTabs: boolean;
  /** A Full screen button in the header. */
  fullScreenable: boolean;
}

export const CHROME: Record<Presentation, Chrome> = {
  tiled: {
    draggable: true,
    zoomable: true,
    tuckable: true,
    island: true,
    closeWithTabs: true,
    fullScreenable: true,
  },
  single: {
    draggable: false,
    zoomable: false,
    tuckable: false,
    island: false,
    closeWithTabs: true,
    fullScreenable: false,
  },
};

/**
 * A lone pane (the only one on screen, tiled): the chrome grows only when there is something to arrange. Full-bleed
 * with no focus edge (there is nothing to tell it from), no tuck, maximise or drag, and no header close when its tabs
 * carry their own ×. A second pane brings the island back.
 */
export const ALONE_CHROME: Chrome = {
  draggable: false,
  zoomable: false,
  tuckable: false,
  island: false,
  closeWithTabs: false,
  // A lone pane may still want the whole screen: a chart, a document, a presentation.
  fullScreenable: true,
};
