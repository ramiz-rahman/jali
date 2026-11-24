/**
 * /llms-full.txt (https://llmstxt.org): every page of the docs as Markdown, in reading order, in one file, for a
 * coding agent that wants all of it at once. /llms.txt is the index; each page is also at its own address plus ".md".
 */
import type { APIRoute } from "astro";
import { toMarkdown } from "../site/markdown";
import { readingOrder } from "../site/nav";
import { markdownUrl, pageAt } from "../site/sources";

export const GET: APIRoute = ({ site }) => {
  const parts = [
    `# Jali\n\n> ${pageAt("/").summary}\n\nThe whole of Jali's docs, one page after another. The same pages ship inside the package as \`node_modules/jali-layout/docs/\`, for the installed version.`,
  ];
  for (const item of readingOrder) {
    const md = toMarkdown(pageAt(item.path), { link: (href) => new URL(href, site).href });
    parts.push(`<!-- ${new URL(markdownUrl(item.path), site).href} -->\n\n${md.trim()}`);
  }
  return new Response(`${parts.join("\n\n---\n\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
