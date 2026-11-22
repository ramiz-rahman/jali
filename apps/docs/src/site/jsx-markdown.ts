/**
 * The docs' own components, written as Markdown: what "Copy page", "View as Markdown" and the copy in the packages
 * (tooling/agent-docs.mjs) give a reader or an agent. Reference entries become headings and lists, live demos become
 * one line saying what they show, generated tables (parts, commands, tokens) are drawn from their data, and any other
 * tag is dropped with its text kept.
 */

/** A tag's attributes: "text", {`text`}, {expression} (kept as written) or a bare flag. */
type Attrs = Record<string, string | true>;

interface Tag {
  name: string;
  attrs: Attrs;
  /** Where the tag starts and where its opening tag ends. */
  start: number;
  end: number;
  selfClosing: boolean;
}

/** Read the opening tag that starts at `at` (`<Name …>` or `<Name … />`). */
function readTag(text: string, at: number): Tag | undefined {
  const m = /^<([A-Z][A-Za-z]*)/.exec(text.slice(at));
  if (!m) return undefined;
  let i = at + m[0].length;
  const attrs: Attrs = {};
  while (i < text.length) {
    while (/\s/.test(text[i]!)) i++;
    if (text.startsWith("/>", i))
      return { name: m[1]!, attrs, start: at, end: i + 2, selfClosing: true };
    if (text[i] === ">") return { name: m[1]!, attrs, start: at, end: i + 1, selfClosing: false };
    const n = /^[A-Za-z_-][\w-]*/.exec(text.slice(i));
    if (!n) return undefined;
    i += n[0].length;
    if (text[i] !== "=") {
      attrs[n[0]] = true;
      continue;
    }
    i++;
    if (text[i] === '"' || text[i] === "'") {
      const q = text[i]!;
      const close = text.indexOf(q, i + 1);
      attrs[n[0]] = text.slice(i + 1, close);
      i = close + 1;
    } else if (text[i] === "{") {
      let depth = 0;
      let j = i;
      let quote: string | undefined;
      for (; j < text.length; j++) {
        const c = text[j]!;
        if (quote) {
          if (c === quote && text[j - 1] !== "\\") quote = undefined;
        } else if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}" && --depth === 0) break;
      }
      const inner = text.slice(i + 1, j).trim();
      const tpl = /^`([\s\S]*)`$/.exec(inner);
      attrs[n[0]] = tpl ? tpl[1]!.replace(/\\n/g, "\n") : inner;
      i = j + 1;
    } else return undefined;
  }
  return undefined;
}

const str = (a: Attrs, k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);

/** Live demos: they say what they show, in one line. */
const DEMOS = new Set([
  "Frame",
  "Spotlight",
  "TreeView",
  "KeysDemo",
  "LinkDemo",
  "MinimalApp",
  "QuickstartApp",
  "Proof",
]);

export interface MarkdownOptions {
  /** Generated tables, by component name: `PartsTable`, `CommandTable`, `TokenTable` (with its attributes)… */
  tables?: Record<string, (attrs: Attrs) => string>;
  /** Turn a site link (`/guides/theming#x`) into another, e.g. a relative file. */
  link?: (href: string) => string;
}

/** Replace every docs component in `text` (Markdown with JSX in it) with Markdown. */
export function jsxToMarkdown(text: string, opts: MarkdownOptions = {}): string {
  const link = opts.link ?? ((h: string) => h);
  let out = "";
  let i = 0;
  // Code is left alone: fenced blocks, and inline spans outside them (`Pane<P>` is a type, not a tag).
  const fences: [number, number][] = [];
  for (const m of text.matchAll(/^```[\s\S]*?^```/gm))
    fences.push([m.index!, m.index! + m[0].length]);
  for (const m of text.matchAll(/`[^`\n]+`/g))
    if (!fences.some(([a, b]) => m.index! >= a && m.index! < b))
      fences.push([m.index!, m.index! + m[0].length]);
  const inFence = (at: number) => fences.find(([a, b]) => at >= a && at < b);
  while (i < text.length) {
    const fence = inFence(i);
    if (fence) {
      out += text.slice(i, fence[1]);
      i = fence[1];
      continue;
    }
    const lt = text.indexOf("<", i);
    if (lt < 0) {
      out += text.slice(i);
      break;
    }
    const f = inFence(lt);
    if (f) {
      out += text.slice(i, f[1]);
      i = f[1];
      continue;
    }
    out += text.slice(i, lt);
    const close = /^<\/([A-Z][A-Za-z]*)>/.exec(text.slice(lt));
    if (close) {
      out += closing(close[1]!);
      i = lt + close[0].length;
      continue;
    }
    const tag = readTag(text, lt);
    if (!tag) {
      out += "<";
      i = lt + 1;
      continue;
    }
    out += opening(tag, opts, link);
    i = tag.end;
  }
  return out
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function opening(tag: Tag, opts: MarkdownOptions, link: (h: string) => string): string {
  const a = tag.attrs;
  const table = opts.tables?.[tag.name];
  if (table) return `\n\n${table(a)}\n\n`;
  if (DEMOS.has(tag.name)) {
    const what = (str(a, "caption") ?? str(a, "title"))?.replace(/[^.!?]$/, "$&.");
    const more = str(a, "href");
    return what
      ? `\n\n*Live demo on the site: ${what}${more ? ` See [${str(a, "more") ?? "more"}](${link(more)}).` : ""}*\n\n`
      : "";
  }
  switch (tag.name) {
    case "Entry": {
      const name = str(a, "name") ?? "";
      const kind = str(a, "kind");
      const from = str(a, "from");
      const sig = str(a, "signature");
      return `\n\n### ${name}\n\n${kind ? `*${kind}*` : ""}${from ? `${kind ? ", " : ""}from \`${from}\`` : ""}\n\n${sig ? `\`\`\`ts\n${sig}\n\`\`\`\n\n` : ""}`;
    }
    case "Params":
      return `\n\n**${str(a, "title") ?? "Parameters"}**\n\n`;
    case "ChildParams":
      return `\n\n**${str(a, "label") ?? "Fields"}**\n\n`;
    case "Param": {
      const type = str(a, "type");
      return `- **\`${str(a, "name") ?? ""}\`**${type ? ` (\`${type}\`${a.required ? ", required" : ""})` : ""}: `;
    }
    case "Member": {
      const sig = str(a, "signature");
      return `- **\`${str(a, "name") ?? ""}\`**${sig ? `, \`${sig}\`` : ""}: `;
    }
    case "Value":
      return `- \`${str(a, "name") ?? ""}\`: `;
    case "Returns":
      return `\n\n**Returns**${str(a, "type") ? ` \`${str(a, "type")}\`` : ""}: `;
    case "Ref": {
      const to = str(a, "to") ?? "";
      const page = str(a, "page");
      return page ? `[\`${to}\`](${link(`${page}#${to}`)})` : `\`${to}\``;
    }
    case "Card":
    case "Step":
    case "Tab":
      if (str(a, "href")) return `\n- [${str(a, "title") ?? ""}](${link(str(a, "href")!)}): `;
      return `\n\n### ${str(a, "title") ?? str(a, "label") ?? ""}\n\n`;
    case "Install":
      return `\n\n\`\`\`sh\nnpm install ${str(a, "packages") ?? ""}\n\`\`\`\n\n`;
    default:
      return "";
  }
}

function closing(name: string): string {
  return name === "Param" || name === "Member" || name === "Value" || name === "Card"
    ? "\n"
    : "\n\n";
}
