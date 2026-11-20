/**
 * The search index (src/site/search-index.ts): every public page in reading order, then any page the nav doesn't
 * list, with the headings and reference entries the build found on it.
 */
import type { APIRoute } from "astro";
import { renderPage } from "../shell/render";
import { publicPages, readingOrder, sectionOf } from "../site/sources";
import { searchHeadings, type SearchIndex } from "../site/search-index";

export const GET: APIRoute = async () => {
  const order = readingOrder().map((i) => i.path);
  const pages = publicPages()
    .filter((p) => p.path !== "/")
    .sort((a, b) => {
      const ia = order.indexOf(a.path),
        ib = order.indexOf(b.path);
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || a.path.localeCompare(b.path);
    });
  const index: SearchIndex = { pages: [] };
  for (const p of pages) {
    const { headings } = await renderPage(p.path);
    index.pages.push({
      path: p.path,
      title: p.title,
      summary: p.summary,
      section: sectionOf(p.path),
      headings: searchHeadings(headings),
    });
  }
  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
