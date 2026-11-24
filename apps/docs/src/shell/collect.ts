/**
 * What rendering a page at build time collects besides its HTML: its headings (for "On this page" and search) and
 * its islands (the live parts the browser hydrates). Only the prerender provides it (src/shell/render.tsx); in the
 * browser the context is null and components render as usual.
 */
import { createContext, useContext, type ComponentType } from "react";

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
  /** A reference entry (`<Entry name>`), not a heading the page wrote. */
  entry?: boolean;
}

export interface IslandRecord {
  name: string;
  props: object;
  Component: ComponentType<object>;
}

export interface Collected {
  headings: TocEntry[];
  islands: IslandRecord[];
}

export const Collect = createContext<Collected | null>(null);

/**
 * Lists a heading for "On this page" and search, while the page is built (null: this one isn't listed). The prerender
 * renders each page once, so the list gets each heading once, in order.
 */
export function useTocEntry(entry: TocEntry | null) {
  const collect = useContext(Collect);
  if (entry) collect?.headings.push(entry);
}
