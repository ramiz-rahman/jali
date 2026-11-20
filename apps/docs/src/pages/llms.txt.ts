/**
 * /llms.txt (https://llmstxt.org): the site for coding agents. What Jali is, then every page in reading order as a
 * link to its Markdown copy with its one-line summary. The same list as the README in @jali/core's docs/.
 */
import type { APIRoute } from "astro";
import { markdownUrl, readingOrder, sources } from "../site/sources";

export const GET: APIRoute = ({ site }) => {
  const home = sources["/"];
  const lines = [
    "# Jali",
    "",
    `> ${home?.summary ?? "Workspaces of panes for React."}`,
    "",
    "Jali is two packages: `@jali/core` (the layout tree, fitting and the workspace, with no framework) and `@jali/react` (renders it). Every page below is Markdown. The same pages ship inside `@jali/core` as `node_modules/@jali/core/docs/`, for the installed version.",
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
