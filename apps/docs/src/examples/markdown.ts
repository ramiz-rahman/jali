/**
 * The example apps' parts as Markdown (src/site/markdown), for llms.txt, the .md pages and the docs in the package:
 * the links that open an app, what it shows, its data and how to run it, with full addresses throughout.
 */
import type { MarkdownComponent } from "../site/markdown/component";
import { SITE_URL } from "../site/site-url.mjs";
import { EXAMPLES, appOf, appPage, appPath, sourceUrl } from "./data";

const appList = () =>
  `\n\n${EXAMPLES.map((a) => `- [${a.name}](${SITE_URL}${appPage(a.id)}): ${a.summary}`).join("\n")}\n\n`;

/** A component that names one app (`<ExampleShot id="trips" />`). */
const forApp =
  (write: (id: string) => string): MarkdownComponent =>
  (p) =>
    `\n\n${write(String(p.id))}\n\n`;

export const examplesMarkdown: Record<string, MarkdownComponent> = {
  ExampleIndex: appList,
  ExampleShowcase: appList,
  ExampleShot: forApp((id) => {
    const app = appOf(id);
    return `[Open ${app.name}](${SITE_URL}${appPath(id, app.shows[0].link)}) · [Source](${sourceUrl(id)})`;
  }),
  ExampleShows: forApp((id) =>
    appOf(id)
      .shows.map(
        (s) =>
          `- **[${s.title}](${SITE_URL}${appPath(id, s.link)})**: ${s.text}${s.learn ? ` ([how it works](${SITE_URL}${s.learn}))` : ""}`,
      )
      .join("\n"),
  ),
  ExampleData: forApp((id) => appOf(id).data),
  ExampleRun: forApp(
    (id) =>
      `Run \`pnpm ${id}\` at the repository's root, then open http://localhost:${appOf(id).port}.`,
  ),
};
