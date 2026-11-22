/**
 * /llms-full.txt (https://llmstxt.org): every page of the docs as Markdown, in reading order, in one file, for a
 * coding agent that wants all of it at once. /llms.txt is the index; each page is also at its own address plus ".md".
 */
import type { APIRoute } from "astro";
import { MARKDOWN_TABLES } from "../site/markdown-tables";
import { markdownUrl, readingOrder, sources, toMarkdown } from "../site/sources";

export const GET: APIRoute = ({ site }) => {
  const home = sources["/"];
  const parts = [
    `# Jali\n\n> ${home?.summary ?? ""}\n\nThe whole of Jali's docs, one page after another. The same pages ship inside the package as \`node_modules/jali/docs/\`, for the installed version.`,
  ];
  for (const item of readingOrder()) {
    const page = sources[item.path];
    if (!page) continue;
    const md = toMarkdown(page, {
      tables: MARKDOWN_TABLES,
      link: (href) => (href.startsWith("/") ? new URL(href, site).href : href),
    }).replace(/\]\((\/[^)\s]*)\)/g, (_, href: string) => `](${new URL(href, site).href})`);
    parts.push(`<!-- ${new URL(markdownUrl(item.path), site).href} -->\n\n${md.trim()}`);
  }
  return new Response(`${parts.join("\n\n---\n\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
