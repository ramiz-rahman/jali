/**
 * What rendering a page at build time collects besides its HTML: its headings (for "On this page" and search) and
 * its islands (the live parts the browser hydrates). Only the prerender provides it (src/shell/render.tsx); in the
 * browser the context is null and components render as usual.
 */
import { createContext, type ComponentType } from "react";

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
