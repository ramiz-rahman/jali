/**
 * What search reads (/search.json, src/pages/search.json.ts): each public page's title, summary and the headings and
 * reference entries on it, with their real ids, in reading order. A few KB gzipped, instead of every page's source.
 */
import type { TocEntry } from "../shell/collect";

export interface SearchPage {
  path: string;
  title: string;
  summary: string;
  section?: string;
  headings: { id: string; text: string; entry?: boolean }[];
}

export interface SearchIndex {
  pages: SearchPage[];
}

export const searchHeadings = (headings: TocEntry[]): SearchPage["headings"] =>
  headings.map((h) =>
    h.entry ? { id: h.id, text: h.text, entry: true } : { id: h.id, text: h.text },
  );
