/**
 * Every page as plain Markdown, at its own address plus ".md" ("/index.md" for the home page): for readers who
 * want the text and for coding agents. The same text "Copy page" gives.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { MARKDOWN_TABLES } from "../site/markdown-tables";
import { publicPages, sources, toMarkdown } from "../site/sources";

export const getStaticPaths: GetStaticPaths = () =>
  publicPages().map((p) => ({ params: { slug: p.path === "/" ? "index" : p.path.slice(1) } }));

export const GET: APIRoute = ({ params }) => {
  const path = params.slug === "index" ? "/" : `/${params.slug}`;
  const page = sources[path]!;
  return new Response(toMarkdown(page, { tables: MARKDOWN_TABLES }), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
