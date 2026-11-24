/**
 * The reference's components as Markdown (src/site/markdown): an entry becomes a heading, its kind and package, its
 * signature and example as code, and its options as a list; the generated tables are drawn from the same data as the
 * page's (./command-data.ts, ./token-data.ts, ./parts-data.ts).
 */
import { str, type MarkdownComponent } from "../site/markdown/component";
import { COMMAND_ROWS, keysOf, type Platform } from "./command-data";
import { elementCode, partWhat, partsIn, type PartArea } from "./parts-data";
import { BRIDGE, TOKEN_PURPOSE, tokensIn, valuesOf, type TokenGroup } from "./token-data";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (head: string[], rows: string[][]) =>
  `\n\n${[
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n")}\n\n`;

const keys = (id: string, platform: Platform) => keysOf(id, platform).join(" or ") || "none";
const fence = (lang: string, code: string) => `\`\`\`${lang}\n${code.replace(/\n$/, "")}\n\`\`\``;

export const referenceMarkdown: Record<string, MarkdownComponent> = {
  Entry: (p, inner) => {
    const kind = str(p, "kind");
    const from = str(p, "from");
    const sig = str(p, "signature");
    const example = str(p, "example");
    const file = str(p, "exampleFile");
    const lang = /\.(css|tsx?|jsx?)$/.exec(file ?? "")?.[1] ?? "tsx";
    const meta = `${kind ? `*${kind}*` : ""}${from ? `${kind ? ", " : ""}from \`${from}\`` : ""}`;
    return [
      `\n\n### ${str(p, "name") ?? ""}\n\n${meta}\n\n`,
      sig ? `${fence("ts", sig)}\n\n` : "",
      example ? `${file ? `Example, \`${file}\`:\n\n` : ""}${fence(lang, example)}\n\n` : "",
      `${inner}\n\n`,
    ].join("");
  },
  Params: (p, inner) => `\n\n**${str(p, "title") ?? "Parameters"}**\n\n${inner}\n\n`,
  ChildParams: (p, inner) => `\n\n**${str(p, "label") ?? "Fields"}**\n\n${inner}\n\n`,
  Param: (p, inner) => {
    const type = str(p, "type");
    return `- **\`${str(p, "name") ?? ""}\`**${type ? ` (\`${type}\`${p.required ? ", required" : ""})` : ""}: ${inner}\n`;
  },
  Member: (p, inner) => {
    const sig = str(p, "signature");
    return `- **\`${str(p, "name") ?? ""}\`**${sig ? `, \`${sig}\`` : ""}: ${inner}\n`;
  },
  Returns: (p, inner) => {
    const type = str(p, "type");
    return `\n\n**Returns**${type ? ` \`${type}\`` : ""}: ${inner}\n\n`;
  },
  Ref: (p) => {
    const to = str(p, "to") ?? "";
    const page = str(p, "page");
    return page ? `[\`${to}\`](${page}#${to})` : `\`${to}\``;
  },
  PartsTable: (p) =>
    table(
      ["Part", "Element", "What it is", "State attributes"],
      partsIn(str(p, "area") as PartArea | undefined).map(([, part]) => [
        `\`${part.selector}\``,
        elementCode(part.element),
        partWhat(part),
        part.attributes.length
          ? part.attributes.map((a) => `\`${a.name}\`: ${a.means}`).join("<br>")
          : "none",
      ]),
    ),
  CommandTable: () =>
    table(
      ["Command", "Title", "Mac", "Windows and Linux", "Refused when"],
      COMMAND_ROWS.map((r) => [
        `\`${r.shown}\``,
        r.title,
        keys(r.id, "mac"),
        keys(r.id, "other"),
        r.refused,
      ]),
    ),
  TokenTable: (p) =>
    table(
      ["Token", "Used for", "Light", "Dark"],
      tokensIn(str(p, "group") as TokenGroup | undefined).map((t) => {
        const { light, dark } = valuesOf(t);
        return [`\`${t}\``, TOKEN_PURPOSE[t]?.purpose ?? "", `\`${light}\``, `\`${dark}\``];
      }),
    ),
  BridgeTable: () =>
    table(
      ["Jali token", "Reads from your theme, first found", "Else"],
      BRIDGE.map((r) => [
        `\`${r.token}\``,
        r.host.map((h) => `\`${h}\``).join(", then "),
        `\`${r.fallback}\``,
      ]),
    ),
};
