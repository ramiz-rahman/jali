/** The docs' components as Markdown (site/jsx-markdown.ts): what "View as Markdown" and the packages' docs/ hold. */
import { describe, expect, it } from "vite-plus/test";
import { jsxToMarkdown } from "../site/jsx-markdown";

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
