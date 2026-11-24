/**
 * Every docs component's Markdown, by tag name: each area writes its own, beside its components. A live part (an
 * island) says what it shows. A tag that isn't here keeps its text (./index.ts).
 */
import { ISLANDS } from "../../client/island-id";
import { examplesMarkdown } from "../../examples/markdown";
import { landingMarkdown } from "../../landing/markdown";
import { referenceMarkdown } from "../../reference/markdown";
import { mdxMarkdown } from "../../shell/mdx/markdown";
import { liveDemo, type MarkdownComponent } from "./component";

export const COMPONENTS: Record<string, MarkdownComponent> = {
  ...Object.fromEntries(ISLANDS.map((name) => [name, liveDemo])),
  ...mdxMarkdown,
  ...referenceMarkdown,
  ...examplesMarkdown,
  ...landingMarkdown,
};
