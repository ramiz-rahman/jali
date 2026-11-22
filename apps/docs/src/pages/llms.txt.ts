/**
 * /llms.txt (https://llmstxt.org): the site for coding agents. What Jali is, then every page in reading order as a
 * link to its Markdown copy with its one-line summary. The same list as the README in jali's docs/.
 */
import type { APIRoute } from "astro";
import { markdownUrl, readingOrder, sources } from "../site/sources";

export const GET: APIRoute = ({ site }) => {
  const home = sources["/"];
  const lines = [
    "# Jali",
    "",
    `> ${home?.summary ?? ""}`,
    "",
    "Jali is one package, `jali`. Its framework-free core (the layout tree, fitting, actions and events) is `jali`; React renders it from `jali/react`; each optional feature has its own entry (`jali/url`, `jali/palette`, …). Every page below is Markdown, and all of them together are at /llms-full.txt. The same pages ship inside the package as `node_modules/jali/docs/`, for the installed version.",
  ];
  let section = "";
  for (const item of readingOrder()) {
    if (item.section !== section) {
      section = item.section;
      lines.push("", `## ${section}`, "");
    }
    const summary = sources[item.path]?.summary;
    lines.push(
      `- [${item.title}](${new URL(markdownUrl(item.path), site).href})${summary ? `: ${summary}` : ""}`,
    );
  }
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
