/**
 * The reference's generated tables as Markdown, from the same data the pages draw them from: parts, commands, tokens
 * and the Tailwind bridge. `toMarkdown(page, { tables: MARKDOWN_TABLES })`.
 */
import { PALETTE_ID, createKeymap, formatKeys } from "@jali/core/adapter";
import { ADORNMENTS, parts } from "../../../../packages/react/src/parts";
import { COMMANDS, REFUSED, displayId } from "../reference/command-data";
import {
  BRIDGE,
  PUBLIC_TOKENS,
  TOKEN_PURPOSE,
  valuesOf,
  type TokenGroup,
} from "../reference/token-data";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");

const MAC = createKeymap({}, { platform: "mac" });
const OTHER = createKeymap({}, { platform: "other" });
const keys = (id: string, platform: "mac" | "other") => {
  const seqs = (platform === "mac" ? MAC : OTHER).sequences(id);
  return seqs.length ? seqs.map((s) => formatKeys(s, platform)).join(" or ") : "none";
};

export const MARKDOWN_TABLES: Record<string, (attrs: Record<string, string | true>) => string> = {
  PartsTable: (a) =>
    table(
      ["Part", "Element", "What it is", "State attributes"],
      Object.values(parts)
        .filter((p) => typeof a.area !== "string" || p.area === a.area)
        .map((p) => [
          `\`${p.selector}\``,
          p.element.startsWith("`") ? p.element : p.element.replace(/^(\w+)/, "`$1`"),
          "adornments" in p ? `${p.what} ${ADORNMENTS}` : p.what,
          p.attributes.length
            ? p.attributes.map((a) => `\`${a.name}\`: ${a.means}`).join("<br>")
            : "none",
        ]),
    ),
  CommandTable: () =>
    table(
      ["Command", "Title", "Mac", "Windows and Linux", "Refused when"],
      [
        [
          `\`${PALETTE_ID}\``,
          "Open or close the command palette, and start a two-step chord",
          keys(PALETTE_ID, "mac"),
          keys(PALETTE_ID, "other"),
          "Never. Works with a dialog open too.",
        ],
        ...COMMANDS.map((c) => [
          `\`${displayId(c.id)}\``,
          c.title,
          keys(c.id, "mac"),
          keys(c.id, "other"),
          REFUSED[displayId(c.id)] ?? "Not documented.",
        ]),
      ],
    ),
  TokenTable: (a) => {
    const group = typeof a.group === "string" ? (a.group as TokenGroup) : undefined;
    const order = Object.keys(TOKEN_PURPOSE);
    const tokens = PUBLIC_TOKENS.filter((t) => !group || TOKEN_PURPOSE[t]?.group === group).sort(
      (x, y) => order.indexOf(x) - order.indexOf(y),
    );
    return table(
      ["Token", "Used for", "Light", "Dark"],
      tokens.map((t) => {
        const { light, dark } = valuesOf(t);
        return [`\`${t}\``, TOKEN_PURPOSE[t]?.purpose ?? "", `\`${light}\``, `\`${dark}\``];
      }),
    );
  },
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
