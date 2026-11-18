/**
 * Each pane's identity colour, shared by its box in the map and its header in the workspace. Five quiet colours from
 * Jali's palette (Nil indigo in three depths, a warm sand, a stone), defined in live.css for light and dark.
 */
const KNOWN = ["orders", "order", "customer", "notes", "activity"];

export function colourIndex(id: string): number {
  const i = KNOWN.indexOf(id);
  if (i >= 0) return i + 1;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}

export const colourOf = (id: string) => `var(--live-id-${colourIndex(id)})`;
