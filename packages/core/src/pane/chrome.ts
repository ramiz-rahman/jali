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
}

export const CHROME: Record<Presentation, Chrome> = {
  tiled: { draggable: true, zoomable: true, tuckable: true, island: true },
  single: { draggable: false, zoomable: false, tuckable: false, island: false },
};
