/** An example app for the Markdown copies (llms.txt, the .md pages, the docs in the package): full addresses throughout. */
import { SITE_URL } from "../site/site-url.mjs";
import { EXAMPLES, appOf, appPath, sourceUrl } from "./data";

export function exampleMarkdown(id: string): string {
  const app = appOf(id);
  const abs = (link: string) => `${SITE_URL}${appPath(id, link)}`;
  const learn = (path?: string) => (path ? ` ([how it works](${SITE_URL}${path}))` : "");
  return [
    app.summary,
    "",
    `[Open ${app.name}](${abs(app.shows[0].link)}) · [Source](${sourceUrl(id)})`,
    "",
    ...app.shows.map((s) => `- **[${s.title}](${abs(s.link)})**: ${s.text}${learn(s.learn)}`),
    "",
    app.data,
    "",
    `Run it yourself: \`pnpm ${id}\` at the repository's root, then http://localhost:${app.port}.`,
  ].join("\n");
}

/** The six apps as a list, for the home page's Markdown copy. */
export const exampleListMarkdown = () =>
  EXAMPLES.map((a) => `- [${a.name}](${SITE_URL}/examples#${a.id}): ${a.summary}`).join("\n");
