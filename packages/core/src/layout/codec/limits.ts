/**
 * What a link holds, in one place for the writer and the reader alike (docs/DECISIONS.md, 20 and 23 Nov 2026). The
 * reader refuses a link past any of them; an action whose result would pass one is refused (`"blocked"`), and the
 * instance never writes an address past one. A layout already past one (an app's own, at start-up) still opens and may
 * shrink, but grows no further, and its address is left unwritten until it fits.
 */
import type { Layout } from "../types";

/** The most nodes a layout in a link holds (panes, rows, columns and tab groups). */
export const MAX_NODES = 256;
/** The deepest a layout in a link nests. */
export const MAX_DEPTH = 128;
/** The longest an instance's own params may be in an address, as written (layout, page, view; never the host's). */
export const MAX_LINK_TEXT = 1_000_000;
/** The most panes a curated page's link opens (`open=`). */
export const OPEN_MAX = 32;

/** What a layout uses of a link's limits: its nodes, its depth and, on a curated page, the panes opened from it (the
 *  ones without a role). */
export interface LinkUsage {
  nodes: number;
  depth: number;
  opened: number;
}

export function linkUsage(layout: Layout, page: boolean): LinkUsage {
  const used: LinkUsage = { nodes: 0, depth: 0, opened: 0 };
  const visit = (n: Layout["root"], depth: number) => {
    used.nodes++;
    if (depth > used.depth) used.depth = depth;
    if (n.type === "pane") {
      if (page && !n.role) used.opened++;
    } else for (const c of n.children) visit(c, depth + 1);
  };
  visit(layout.root, 0);
  return used;
}

/** Whether `to` passes a limit `from` was within, or passes it further: a layout already past one may still shrink. */
export function pastLimits(from: LinkUsage, to: LinkUsage): boolean {
  const over = (k: keyof LinkUsage, max: number) => to[k] > max && to[k] > from[k];
  return over("nodes", MAX_NODES) || over("depth", MAX_DEPTH) || over("opened", OPEN_MAX);
}

/** Whether a layout fits a link (its address can be written). */
export const fitsLink = (u: LinkUsage): boolean =>
  u.nodes <= MAX_NODES && u.depth <= MAX_DEPTH && u.opened <= OPEN_MAX;
