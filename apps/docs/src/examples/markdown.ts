/** An example app for the Markdown copies (llms.txt, the .md pages, the docs in the package): full addresses throughout. */
import { SITE_URL } from "../site/site-url.mjs";
import { EXAMPLES, appOf, appPage, appPath, sourceUrl } from "./data";

/** The parts of an app's page, as Markdown: the links that open it, what it shows, its data, how to run it. */
export const exampleShotMarkdown = (id: string) => {
  const app = appOf(id);
  return `[Open ${app.name}](${SITE_URL}${appPath(id, app.shows[0].link)}) · [Source](${sourceUrl(id)})`;
};
export const exampleShowsMarkdown = (id: string) =>
  appOf(id)
    .shows.map(
      (s) =>
        `- **[${s.title}](${SITE_URL}${appPath(id, s.link)})**: ${s.text}${s.learn ? ` ([how it works](${SITE_URL}${s.learn}))` : ""}`,
    )
    .join("\n");
export const exampleDataMarkdown = (id: string) => appOf(id).data;
export const exampleRunMarkdown = (id: string) =>
  `Run \`pnpm ${id}\` at the repository's root, then open http://localhost:${appOf(id).port}.`;

/** The six apps as a list, for the home page's and the overview's Markdown copies. */
export const exampleListMarkdown = () =>
  EXAMPLES.map((a) => `- [${a.name}](${SITE_URL}${appPage(a.id)}): ${a.summary}`).join("\n");
