/** The pages as Markdown (./index.ts): what "View as Markdown", llms-full.txt and the packages' docs/ hold. */
import { describe, expect, it } from "vite-plus/test";
import type { PageSource } from "../sources";
import { mdxToMarkdown, toMarkdown } from "./index";

describe("mdxToMarkdown", () => {
  it("writes a reference entry as a heading, its signature and a list of params", () => {
    const md =
      mdxToMarkdown(`<Entry name="tuck" kind="action" from="jali-layout" signature={\`tuck(pane): ActionResult\`} compact>

Tucks a pane. See <Ref to="Shelf" page="/reference/react" />.

<Params>
<Param name="pane" type="PaneTarget" required>The pane.</Param>
</Params>

</Entry>`);
    expect(md).toContain("### tuck");
    expect(md).toContain("*action*, from `jali-layout`");
    expect(md).toContain("```ts\ntuck(pane): ActionResult\n```");
    expect(md).toContain("[`Shelf`](/reference/react#Shelf)");
    expect(md).toContain("- **`pane`** (`PaneTarget`, required): The pane.");
    expect(md).not.toMatch(/<[A-Z]/);
  });

  it("leaves code alone, inline and fenced, and says what a live demo shows", () => {
    const md = mdxToMarkdown(
      'A `Pane<P>` and `<JaliRoot>`.\n\n```tsx\n<JaliRoot jali={jali} />\n```\n\n<Frame layout="two" caption="Two panes." />\n\n<Proof title="Folds" href="/learn/fitting" demo={<Frame layout="x" />} />',
      { link: (h) => `.${h}.md` },
    );
    expect(md).toContain("A `Pane<P>` and `<JaliRoot>`.");
    expect(md).toContain("```tsx\n<JaliRoot jali={jali} />\n```");
    expect(md).toContain("*Live demo on the site: Two panes.*");
    expect(md).toContain("*Live demo on the site: Folds. See [more](./learn/fitting.md).*");
  });

  it("draws a generated table from the reference's data", () => {
    const md = mdxToMarkdown("<CommandTable />");
    expect(md).toMatch(
      /^\| Command \| Title \| Mac \| Windows and Linux \| Refused when \|\n\| --- \|/,
    );
    expect(md).toMatch(/^\| `pane\.close` \| .+ \|$/m);
  });

  it("rewrites every site link, in the prose and in components alike", () => {
    const md = mdxToMarkdown(
      'See [fitting](/learn/fitting) and <Ref to="Shelf" page="/reference/react" />.',
      {
        link: (h) => `https://example.com${h}`,
      },
    );
    expect(md).toBe(
      "See [fitting](https://example.com/learn/fitting) and [`Shelf`](https://example.com/reference/react#Shelf).",
    );
  });

  it("keeps a tag it doesn't know as its text", () => {
    expect(mdxToMarkdown('<Section title="x">\n\nIn a section.\n\n</Section>')).toBe(
      "In a section.",
    );
  });
});

describe("toMarkdown", () => {
  const page = (body: string): PageSource => ({
    path: "/x",
    file: "guides/x.mdx",
    title: "X",
    summary: "A page.",
    layout: "docs",
    draft: false,
    source: `---\ntitle: X\nsummary: A page.\n---\n\n${body}`,
  });

  it("drops the page's imports and keeps the imports inside its code blocks", () => {
    const md = toMarkdown(
      page(
        'import { Frame } from "../../live";\n\nText.\n\n```ts\nimport { createJali } from "jali-layout";\nimport { order } from "./panes";\n```\n',
      ),
    );
    expect(md).not.toContain("../../live");
    expect(md).toContain(
      '```ts\nimport { createJali } from "jali-layout";\nimport { order } from "./panes";\n```',
    );
  });

  it("writes a reference entry's example, from the sample the page imports, after its signature", () => {
    const md = toMarkdown(
      page(
        'import code from "../../samples/reference/create-workspace.ts?raw";\n\n<Entry name="createJali" kind="function" from="jali-layout" signature={`createJali(options)`} example={code} exampleFile="jali.ts">\n\nMakes one.\n\n</Entry>',
      ),
    );
    expect(md).toMatch(/```ts\ncreateJali\(options\)\n```\n\nExample, `jali.ts`:\n\n```ts\n\S/);
  });

  it("writes a callout as a quote, labelled by its type and title", () => {
    const md = toMarkdown(
      page('<Callout type="tip" title="Keys">\nPress F6.\nThen Tab.\n</Callout>'),
    );
    expect(md).toContain("> **Tip: Keys.** Press F6.\n> Then Tab.");
  });
});
