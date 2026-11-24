/**
 * Each pane's identity colour, shared by its box in the map and its header in the workspace. Five quiet colours from
 * Jali's palette (Nil indigo in three depths, a warm sand, a stone), defined in tree/map.css for light and dark.
 *
 * The shop's layouts name each pane after its kind, so a layout's own panes take their kind's colour, in the order of
 * `shopKinds`. A pane opened later (by the reader or the tour) has an id of Jali's, and takes a colour from it: still
 * its own, the same in the workspace and the map, but not its kind's.
 */
import { shopKinds } from "../shop/kinds";

const BY_KIND: readonly string[] = shopKinds.map((k) => k.kind);
const COLOURS = 5;

export function colourIndex(id: string): number {
  const i = BY_KIND.indexOf(id);
  if (i >= 0) return (i % COLOURS) + 1;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % COLOURS) + 1;
}

export const colourOf = (id: string) => `var(--live-id-${colourIndex(id)})`;
