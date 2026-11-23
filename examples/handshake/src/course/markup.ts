/**
 * The course's small markup: what a lesson's prose and a glossary definition are written in, parsed into typed
 * blocks. It is deliberately tiny (paragraphs, lists, code, emphasis, glossary links) so the text stays readable
 * in the data files and the renderer has nothing to get wrong.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "em"; v: Inline[] }
  | { t: "strong"; v: Inline[] }
  | { t: "term"; id: string; label: string | undefined };

export type Block = { t: "p"; v: Inline[] } | { t: "ul"; v: Inline[][] } | { t: "pre"; v: string };

/** The first index of `mark` in `s` at or after `from`, or -1. */
const find = (s: string, mark: string, from: number) => s.indexOf(mark, from);

/** Inline markup. An unmatched marker is plain text: a stray `*` in "2 * 3" must not eat the line. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    if (rest.startsWith("`")) {
      const end = find(src, "`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (rest.startsWith("[[")) {
      const end = find(src, "]]", i + 2);
      if (end > i + 2) {
        flush();
        const [id = "", label] = src.slice(i + 2, end).split("|");
        out.push({ t: "term", id: id.trim(), label: label?.trim() });
        i = end + 2;
        continue;
      }
    } else if (rest.startsWith("**")) {
      const end = find(src, "**", i + 2);
      if (end > i + 2 && !/\s/.test(src.charAt(i + 2))) {
        flush();
        out.push({ t: "strong", v: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    } else if (rest.startsWith("*") && !/[\s*]/.test(src.charAt(i + 1))) {
      const end = find(src, "*", i + 1);
      if (end > i + 1 && !/\s/.test(src.charAt(end - 1))) {
        flush();
        out.push({ t: "em", v: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    text += src.charAt(i);
    i += 1;
  }
  flush();
  return out;
}

/** One entry of a body: a fenced code block, a list when every line starts "- ", otherwise a paragraph. */
export function parseBlock(entry: string): Block {
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```\s*$/.exec(entry);
  if (fenced) return { t: "pre", v: fenced[1] ?? "" };
  const lines = entry.split("\n");
  if (lines.every((l) => l.startsWith("- "))) {
    return { t: "ul", v: lines.map((l) => parseInline(l.slice(2))) };
  }
  return { t: "p", v: parseInline(entry.replace(/\n/g, " ")) };
}

export const parseBody = (entries: readonly string[]): Block[] => entries.map(parseBlock);

/** Every glossary id linked from some inline runs, in order, once each. */
export function termsIn(blocks: readonly Block[]): string[] {
  const seen = new Set<string>();
  const walk = (runs: readonly Inline[]) => {
    for (const r of runs) {
      if (r.t === "term") seen.add(r.id);
      else if (r.t === "em" || r.t === "strong") walk(r.v);
    }
  };
  for (const b of blocks) {
    if (b.t === "p") walk(b.v);
    else if (b.t === "ul") b.v.forEach(walk);
  }
  return [...seen];
}
