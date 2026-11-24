/**
 * The search index (src/site/search-index.ts): every public page in reading order, then any page the nav doesn't
 * list, with the headings and reference entries the build found on it.
 */
import type { APIRoute } from "astro";
import { renderPage } from "../shell/render";
import { inReadingOrder, sectionOf } from "../site/nav";
import { publicPages } from "../site/sources";
import { searchHeadings, type SearchIndex } from "../site/search-index";

export const GET: APIRoute = async () => {
  const index: SearchIndex = { pages: [] };
  for (const p of inReadingOrder(publicPages().filter((p) => p.path !== "/"))) {
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
