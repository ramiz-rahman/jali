/**
 * Every page's source, read at build time: its title, summary and layout (from the frontmatter) and its MDX text.
 * The title and summary are the page's everywhere (the page, the nav, search, previous and next, the Markdown copies);
 * the text is what the Markdown copies are made from (./markdown). Nothing here runs in the browser.
 */
import { isDraftFile, pageTexts } from "./pages";

/**
 * How a page is laid out (src/shell/Shell.tsx), from its frontmatter's `layout`:
 * - `docs` (the default): the nav, the page, and "On this page" in a column beside it;
 * - `wide`: no column beside the page, so its figures, tables and code take that room ("On this page" folds above
 *   it). The API reference, whose entries put signatures beside examples;
 * - `showcase`: wide, with no "On this page" at all: short pages that open on a picture (the Examples);
 * - `landing`: the home page, its own place, with no docs nav.
 */
export type PageLayout = "docs" | "wide" | "showcase" | "landing";
const LAYOUTS: readonly PageLayout[] = ["docs", "wide", "showcase", "landing"];

export interface PageSource {
  path: string;
  /** The file under src/docs, e.g. "get-started/introduction.mdx". */
  file: string;
  title: string;
  summary: string;
  layout: PageLayout;
  /** A draft (`_lab` and the like): in dev only, never built or indexed. */
  draft: boolean;
  /** The MDX text, frontmatter and all. */
  source: string;
}

/**
 * The site's one frontmatter parser: `key: value` lines, the value plain, "double-quoted" (JSON escapes) or
 * 'single-quoted' ('' for a quote). Every title and summary on the site, in the HTML, the search index, the nav and
 * the Markdown copies, comes from here; the MDX compiler only strips the block. A line it can't read fails the
 * build, as does a plain value containing ": " (quote it), so a page never ships with half a summary.
 */
export function frontmatterOf(
  source: string,
  file = "page",
): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) return { data: {}, body: source };
  const data: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const kv = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
    if (!kv) throw new Error(`${file}: frontmatter line not understood: ${line}`);
    const raw = kv[2]!;
    let value: string;
    if (raw.startsWith('"')) value = JSON.parse(raw) as string;
    else if (/^'(?:[^']|'')*'$/.test(raw)) value = raw.slice(1, -1).replace(/''/g, "'");
    else if (/: |\s#/.test(raw) || /^[[{&*!|>%@`]/.test(raw))
      throw new Error(
        `${file}: quote the value of "${kv[1]}" (it holds ": ", " #" or starts with a YAML sign)`,
      );
    else value = raw;
    data[kv[1]!] = value;
  }
  return { data, body: source.slice(m[0].length) };
}

function sourceOf(path: string, file: string, source: string): PageSource {
  const { data } = frontmatterOf(source, file);
  const need = (key: string) => {
    if (!data[key]) throw new Error(`${file}: the frontmatter needs a "${key}"`);
    return data[key];
  };
  const layout = (data.layout ?? "docs") as PageLayout;
  if (!LAYOUTS.includes(layout))
    throw new Error(`${file}: layout "${layout}" is not one of ${LAYOUTS.join(", ")}`);
  return {
    path,
    file,
    title: need("title"),
    summary: need("summary"),
    layout,
    draft: isDraftFile(file),
    source,
  };
}

export const sources: Record<string, PageSource> = Object.fromEntries(
  Object.entries(pageTexts).map(([path, { file, text }]) => [path, sourceOf(path, file, text)]),
);

/** The page at `path`, which the build knows is there (a route or the nav named it). */
export function pageAt(path: string): PageSource {
  const page = sources[path];
  if (!page) throw new Error(`No page at ${path}`);
  return page;
}

/** Pages a reader can find: not drafts like `_lab`. */
export const publicPages = () => Object.values(sources).filter((p) => !p.draft);

/** A page's Markdown copy: its address plus ".md", "/index.md" for the home page. */
export const markdownUrl = (path: string) => (path === "/" ? "/index.md" : `${path}.md`);
