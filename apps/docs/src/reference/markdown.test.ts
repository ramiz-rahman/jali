/** The docs' components as Markdown (site/jsx-markdown.ts): what "View as Markdown" and the packages' docs/ hold. */
import { describe, expect, it } from "vite-plus/test";
import { jsxToMarkdown } from "../site/jsx-markdown";
import { toMarkdown } from "../site/sources";

describe("jsxToMarkdown", () => {
  it("writes a reference entry as a heading, its signature and a list of params", () => {
    const md =
      jsxToMarkdown(`<Entry name="tuck" kind="action" from="jali" signature={\`tuck(pane): ActionResult\`} compact>

Tucks a pane. See <Ref to="Shelf" page="/reference/react" />.

<Params>
<Param name="pane" type="PaneTarget" required>The pane.</Param>
</Params>

</Entry>`);
    expect(md).toContain("### tuck");
    expect(md).toContain("*action*, from `jali`");
    expect(md).toContain("```ts\ntuck(pane): ActionResult\n```");
    expect(md).toContain("[`Shelf`](/reference/react#Shelf)");
    expect(md).toContain("- **`pane`** (`PaneTarget`, required): The pane.");
    expect(md).not.toMatch(/<[A-Z]/);
  });

  it("leaves code alone, inline and fenced, and says what a live demo shows", () => {
    const md = jsxToMarkdown(
      'A `Pane<P>` and `<JaliRoot>`.\n\n```tsx\n<JaliRoot jali={jali} />\n```\n\n<Frame layout="two" caption="Two panes." />\n\n<Proof title="Folds" href="/learn/fitting" demo={<Frame layout="x" />} />',
      { link: (h) => `.${h}.md` },
    );
    expect(md).toContain("A `Pane<P>` and `<JaliRoot>`.");
    expect(md).toContain("```tsx\n<JaliRoot jali={jali} />\n```");
    expect(md).toContain("*Live demo on the site: Two panes.*");
    expect(md).toContain("*Live demo on the site: Folds. See [more](./learn/fitting.md).*");
  });

  it("draws a generated table from its data", () => {
    const md = jsxToMarkdown('<TokenTable group="Text" />', {
      tables: { TokenTable: (a) => `| ${a.group} |` },
    });
    expect(md).toBe("| Text |");
  });
});

describe("toMarkdown", () => {
  const page = (body: string) => ({
    path: "/x",
    file: "guides/x.mdx",
    title: "X",
    summary: "A page.",
    source: `---\ntitle: X\nsummary: A page.\n---\n\n${body}`,
  });

  it("drops the page's imports and keeps the imports inside its code blocks", () => {
    const md = toMarkdown(
      page(
        'import { Frame } from "../../live";\n\nText.\n\n```ts\nimport { createJali } from "jali";\nimport { order } from "./panes";\n```\n',
      ),
    );
    expect(md).not.toContain("../../live");
    expect(md).toContain(
      '```ts\nimport { createJali } from "jali";\nimport { order } from "./panes";\n```',
    );
  });

  it("writes a reference entry's example after its signature", () => {
    const md = jsxToMarkdown(
      '<Entry name="createJali" kind="function" from="jali" signature={`createJali(options)`} example={createCode} exampleFile="jali.ts">\n\nMakes one.\n\n</Entry>',
      { code: { createCode: "const jali = createJali({ panes });\n" } },
    );
    expect(md).toContain(
      "```ts\ncreateJali(options)\n```\n\nExample, `jali.ts`:\n\n```ts\nconst jali = createJali({ panes });\n```",
    );
  });
});
