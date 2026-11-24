/**
 * Every page as plain Markdown, at its own address plus ".md" ("/index.md" for the home page): for readers who
 * want the text and for coding agents. The same text "Copy page" gives.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { toMarkdown } from "../site/markdown";
import { pageAt, publicPages } from "../site/sources";

export const getStaticPaths: GetStaticPaths = () =>
  publicPages().map((p) => ({ params: { slug: p.path === "/" ? "index" : p.path.slice(1) } }));

export const GET: APIRoute = ({ params }) =>
  new Response(toMarkdown(pageAt(params.slug === "index" ? "/" : `/${params.slug}`)), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
