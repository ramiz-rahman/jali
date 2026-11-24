/**
 * A page as plain Markdown: what "Copy page", "View as Markdown", /llms-full.txt and the docs in the package
 * (tooling/agent-docs.mjs) give a reader or an agent. A title and summary stand in for the frontmatter, the imports
 * go, and each docs component becomes the Markdown its own area writes for it (./components.ts); a component with
 * nothing to say is dropped and its text kept. Everything else is the page's text exactly as written.
 *
 * The page is parsed by the compiler the site renders it with (@mdx-js/mdx), so code, inline code and `{…}` are told
 * from tags the same way, and each component is replaced in place, inside out. Build time only.
 */
import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { frontmatterOf, type PageSource } from "../sources";
import type { Props } from "./component";
import { COMPONENTS } from "./components";

export type { MarkdownComponent, Props } from "./component";

/** Code samples pages import with `?raw`, so the Markdown can include them. */
const samples = import.meta.glob<string>("../../samples/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface MarkdownOptions {
  /** Turn a site link (`/guides/theming#x`) into another: a full address, or a relative file. */
  link?: (href: string) => string;
  /** The file under src/docs the text is from, so its `?raw` imports resolve. */
  file?: string;
}

/** What the converter reads of the parsed page (mdast with MDX's nodes): where each node is, and a tag's parts. */
interface Node {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: Node[];
  /** An import (`mdxjsEsm`): its text. */
  value?: string;
  /** A tag (`mdxJsxFlowElement`, `mdxJsxTextElement`): its name and attributes. */
  name?: string | null;
  attributes?: {
    type: string;
    name: string;
    value?: string | null | { value: string };
    position?: Node["position"];
  }[];
}

const processor = createProcessor({ remarkPlugins: [remarkGfm] });

const span = (n: Pick<Node, "position">) => ({
  from: n.position!.start.offset!,
  to: n.position!.end.offset!,
});

/** The text a `?raw` import in `file` names (`../../samples/x.tsx?raw`), from the samples. */
function rawImport(file: string, spec: string): string | undefined {
  const parts = ["..", "..", "docs", ...file.split("/").slice(0, -1)];
  for (const seg of spec.replace(/\?raw$/, "").split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return samples[parts.join("/")];
}

/** MDX (a page's body) as Markdown. */
export function mdxToMarkdown(mdx: string, opts: MarkdownOptions = {}): string {
  const tree = processor.parse(mdx) as unknown as Node;
  const top = tree.children ?? [];

  // The page's `import x from "…?raw"`: what an attribute `{x}` stands for.
  const vars: Record<string, string> = {};
  for (const n of top) {
    if (n.type !== "mdxjsEsm") continue;
    for (const m of (n.value ?? "").matchAll(/import\s+(\w+)\s+from\s+["']([^"']+\?raw)["']/g)) {
      const text = opts.file ? rawImport(opts.file, m[2]!) : undefined;
      if (text !== undefined) vars[m[1]!] = text;
    }
  }

  /** An attribute's value: text as written, `{x}` as the import it names, `{"…"}` and `{`…`}` as their text. */
  const valueOf = (v: NonNullable<Node["attributes"]>[number]["value"]): string | true => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v;
    const code = v.value.trim();
    if (/^[A-Za-z_$][\w$]*$/.test(code) && code in vars) return vars[code]!;
    // A template literal's text, its escapes read (\n, \`, \$ and \\).
    const template = /^`([\s\S]*)`$/.exec(code);
    if (template)
      return template[1]!.replace(/\\([n`$\\])/g, (_, c: string) => (c === "n" ? "\n" : c));
    if (/^"(?:[^"\\]|\\.)*"$/.test(code)) return JSON.parse(code) as string;
    return code;
  };

  /** The text between `from` and `to`, with the elements in it written as Markdown and the imports gone. */
  const write = (from: number, to: number, nodes: Node[]): string => {
    let out = "";
    let at = from;
    for (const n of nodes) {
      const { from: a, to: b } = span(n);
      out += mdx.slice(at, a);
      if (n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement") out += element(n);
      else if (n.type !== "mdxjsEsm") out += write(a, b, n.children ?? []);
      at = b;
    }
    return out + mdx.slice(at, to);
  };

  const element = (n: Node): string => {
    const { from, to } = span(n);
    // An HTML element written in the page (`<kbd>`) stays as written: Markdown takes HTML.
    if (n.name && /^[a-z]/.test(n.name)) return mdx.slice(from, to);
    const props: Props = {};
    for (const a of n.attributes ?? [])
      if (a.type === "mdxJsxAttribute") props[a.name] = valueOf(a.value);
    // Its own text runs from the end of its opening tag to the start of its closing tag.
    const last = n.attributes?.at(-1);
    const openEnd = mdx.indexOf(">", last ? span(last).to : from + 1) + 1;
    const selfClosing = mdx[openEnd - 2] === "/";
    const inner = selfClosing ? "" : write(openEnd, mdx.lastIndexOf("</", to), n.children ?? []);
    const component = n.name ? COMPONENTS[n.name] : undefined;
    // A tag that closes itself has no text, so nothing follows its own words: the page's line ends it.
    if (component)
      return selfClosing ? component(props, "").replace(/\n+$/, "") : component(props, inner);
    // Any other tag goes, and its text stays.
    return selfClosing ? "" : `${inner}\n\n`;
  };

  const out = write(0, mdx.length, top)
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const link = opts.link;
  return link ? out.replace(/\]\((\/[^)\s]*)\)/g, (_, href: string) => `](${link(href)})`) : out;
}

/** The page as Markdown, under its title and summary. */
export function toMarkdown(page: PageSource, opts: Omit<MarkdownOptions, "file"> = {}): string {
  const { body } = frontmatterOf(page.source);
  const text = mdxToMarkdown(body, { ...opts, file: page.file });
  return `# ${page.title}\n\n${page.summary}\n\n${text}\n`;
}
