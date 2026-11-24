/**
 * /llms.txt (https://llmstxt.org): the site for coding agents. What Jali is, then every page in reading order as a
 * link to its Markdown copy with its one-line summary. The same list as the README in jali's docs/.
 */
import type { APIRoute } from "astro";
import { readingOrder } from "../site/nav";
import { markdownUrl, pageAt } from "../site/sources";

export const GET: APIRoute = ({ site }) => {
  const lines = [
    "# Jali",
    "",
    `> ${pageAt("/").summary}`,
    "",
    "Jali is one package, `jali-layout`. Its framework-free core (the layout tree, fitting, actions and events) is `jali-layout`; React renders it from `jali-layout/react`; each optional feature has its own entry (`jali-layout/url`, `jali-layout/palette`, …). Every page below is Markdown, and all of them together are at /llms-full.txt. The same pages ship inside the package as `node_modules/jali-layout/docs/`, for the installed version.",
  ];
  let section = "";
  for (const item of readingOrder) {
    if (item.section !== section) {
      section = item.section;
      lines.push("", `## ${section}`, "");
    }
    lines.push(
      `- [${item.title}](${new URL(markdownUrl(item.path), site).href}): ${pageAt(item.path).summary}`,
    );
  }
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
