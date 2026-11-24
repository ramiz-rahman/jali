/**
 * The landing's parts as Markdown (src/site/markdown, for /index.md): each proof says what its demo shows, each
 * package entry is its import line and what it gives you. The rest (the opening, sections, the stage) keep their text.
 */
import { liveDemo, str, type MarkdownComponent } from "../site/markdown/component";

export const landingMarkdown: Record<string, MarkdownComponent> = {
  Proof: liveDemo,
  Import: (p, inner) => {
    const href = str(p, "href");
    const more = href ? `[${str(p, "more") ?? href}](${href}): ` : "";
    return `\n\n\`\`\`ts\n${str(p, "code") ?? ""}\n\`\`\`\n\n${more}${inner}\n\n`;
  },
};
