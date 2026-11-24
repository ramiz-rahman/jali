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

/** A page's headings as the index keeps them: without their level, and `entry` only on a reference entry. */
export const searchHeadings = (headings: TocEntry[]): SearchPage["headings"] =>
  headings.map(({ id, text, entry }) => (entry ? { id, text, entry } : { id, text }));

/** One thing search found: a page, a heading on one, or a reference entry. */
export interface Hit {
  key: string;
  href: string;
  title: string;
  /** A page's summary; for a heading or an entry, the page it is on. */
  detail: string;
  kind: "page" | "heading" | "entry";
}

/** The words of a query, as the search matches them (and as the dialog marks them in what it found). */
export const searchTerms = (q: string): string[] => q.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * What `q` finds, best first: every word must be in the text; a title counts most, then a reference entry's name,
 * a heading, a summary; text that starts with the first word counts double. With no words, the first pages.
 */
export function searchIndex(data: SearchIndex, q: string): Hit[] {
  const terms = searchTerms(q);
  const page = (p: SearchPage): Hit => ({
    key: p.path,
    href: p.path,
    title: p.title,
    detail: p.summary,
    kind: "page",
  });
  if (!terms.length) return data.pages.slice(0, 8).map(page);
  const hits: (Hit & { score: number })[] = [];
  const score = (text: string, w: number) => {
    const t = text.toLowerCase();
    if (!terms.every((x) => t.includes(x))) return 0;
    return w * (t.startsWith(terms[0]!) ? 2 : 1);
  };
  for (const p of data.pages) {
    const s = score(p.title, 6) + score(p.summary, 2) + score(`${p.title} ${p.summary}`, 1);
    if (s) hits.push({ ...page(p), score: s });
    for (const h of p.headings) {
      // A reference entry is looked up by its exact name, so a name that starts with the words ranks first.
      const hs = score(h.text, h.entry ? 4 : 3);
      if (hs)
        hits.push({
          key: `${p.path}#${h.id}`,
          href: `${p.path}#${h.id}`,
          title: h.text,
          detail: p.title,
          kind: h.entry ? "entry" : "heading",
          score: hs,
        });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}
