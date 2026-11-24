/** The docs components (./index.ts) as Markdown, for the Markdown copies (src/site/markdown). */
import { str, type MarkdownComponent } from "../../site/markdown/component";
import { CALLOUTS, type CalloutType } from "./Callout";
import { MANAGERS } from "./Install";

const fence = (lang: string, code: string) => `\`\`\`${lang}\n${code.replace(/\n$/, "")}\n\`\`\``;

/** A step, a tab or a card: a heading over its text, or, when it links somewhere, a list item. */
const titled: (after: string) => MarkdownComponent = (after) => (p, inner) => {
  const href = str(p, "href");
  return href
    ? `\n- [${str(p, "title") ?? ""}](${href}): ${inner}${after}`
    : `\n\n### ${str(p, "title") ?? str(p, "label") ?? ""}\n\n${inner}${after}`;
};

export const mdxMarkdown: Record<string, MarkdownComponent> = {
  Code: (p) => {
    const code = str(p, "code");
    if (code === undefined) return "";
    const filename = str(p, "filename");
    return `${filename ? `\`${filename}\`\n\n` : ""}${fence(str(p, "lang") ?? "tsx", code)}`;
  },
  // The first manager's command: the default the page shows.
  Install: (p) => fence("sh", `${MANAGERS[0].cmd} ${str(p, "packages") ?? ""}`),
  Callout: (p, inner) => {
    const type = (str(p, "type") ?? "note") as CalloutType;
    const title = str(p, "title");
    const label = `**${(CALLOUTS[type] ?? CALLOUTS.note).label}${title ? `: ${title}` : ""}.**`;
    return inner
      .trim()
      .split("\n")
      .map((l, i) => `> ${i === 0 ? `${label} ` : ""}${l.trim()}`)
      .join("\n");
  },
  Step: titled("\n\n"),
  Tab: titled("\n\n"),
  Card: titled("\n"),
};
