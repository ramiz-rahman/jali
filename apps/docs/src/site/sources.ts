/**
 * Every page's MDX source, read as text, at build time. The source gives each page's title and summary (the page,
 * the nav, search, previous and next), and is what the Markdown copies ("View as Markdown", "Copy page", the
 * packages' docs/) are made from. Nothing here runs in the browser.
 */
import { jsxToMarkdown, type MarkdownOptions } from "./jsx-markdown";
import { NAV, type NavSection } from "./nav";
import { pathOf } from "./pages";

// The MDX plugin skips `?raw` ids (astro.config.mjs), so each import is the file's text. Draft pages (`_lab` and
// the like) are read in dev only, as in ./pages.
const raw: Record<string, string> = import.meta.env.DEV
  ? import.meta.glob<string>("../docs/**/*.mdx", { query: "?raw", import: "default", eager: true })
  : import.meta.glob<string>(["../docs/**/*.mdx", "!../docs/**/_*.mdx", "!../docs/**/_*/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
/** Code samples pages import with `?raw`, so the Markdown can include them. */
const samples = import.meta.glob<string>("../samples/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface PageSource {
  path: string;
  /** The file under src/docs, e.g. "get-started/introduction.mdx". */
  file: string;
  title: string;
  summary: string;
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

/** "unsaved-work-and-pane-state" → "Unsaved work and pane state": a title for a page that isn't written yet. */
export const titleFromPath = (path: string) => {
  const slug = path.split("/").filter(Boolean).at(-1) ?? "Home";
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const sources: Record<string, PageSource> = Object.fromEntries(
  Object.entries(raw).map(([file, source]) => {
    const path = pathOf(file);
    const { data } = frontmatterOf(source, file);
    return [
      path,
      {
        path,
        file: file.replace(/^\.\.\/docs\//, ""),
        title: data.title ?? titleFromPath(path),
        summary: data.summary ?? "",
        source,
      },
    ];
  }),
);

/** A draft page (a file or folder starting with "_", like `_lab`): in dev only, never built or indexed. */
export const isDraft = (p: PageSource) => p.file.split("/").some((s) => s.startsWith("_"));

/** Pages a reader can find: written ones, not drafts like `_lab`. */
export const publicPages = () => Object.values(sources).filter((p) => !isDraft(p));

// ---------- the nav, resolved ----------

export interface ResolvedItem {
  path: string;
  title: string;
  exists: boolean;
  section: string;
}
export interface ResolvedSection {
  title: string;
  items: ResolvedItem[];
}

export const resolvedNav = (nav: NavSection[] = NAV): ResolvedSection[] =>
  nav.map((s) => ({
    title: s.title,
    items: s.items.map((i) => ({
      path: i.path,
      title: i.title ?? sources[i.path]?.title ?? titleFromPath(i.path),
      exists: !!sources[i.path],
      section: s.title,
    })),
  }));

/** The written pages in reading order. */
export const readingOrder = (): ResolvedItem[] =>
  resolvedNav()
    .flatMap((s) => s.items)
    .filter((i) => i.exists);

export function neighbours(path: string): { prev?: ResolvedItem; next?: ResolvedItem } {
  const order = readingOrder();
  const i = order.findIndex((p) => p.path === path);
  if (i < 0) return path === "/" ? { next: order[0] } : {};
  return { prev: i > 0 ? order[i - 1] : undefined, next: order[i + 1] };
}

export const sectionOf = (path: string) =>
  resolvedNav().find((s) => s.items.some((i) => i.path === path))?.title;

/**
 * A page's section as a breadcrumb: its name, and the address of its first written page (the sections have no
 * pages of their own), so every item but the last has a URL, as search engines expect.
 */
export function sectionLink(path: string): { name: string; path: string } | undefined {
  const section = resolvedNav().find((s) => s.items.some((i) => i.path === path));
  const first = section?.items.find((i) => i.exists);
  return section && first ? { name: section.title, path: first.path } : undefined;
}

// ---------- the page as Markdown ----------

function resolveImport(pageFile: string, spec: string): string | undefined {
  const clean = spec.replace(/\?raw$/, "");
  const parts = ["..", "docs", ...pageFile.split("/").slice(0, -1)];
  for (const seg of clean.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return samples[parts.join("/")];
}

const attr = (attrs: string, name: string) =>
  new RegExp(
    `\\b${name}=(?:"([^"]*)"|\\{\`([\\s\\S]*?)\`\\}|\\{"([^"]*)"\\}|\\{([A-Za-z_$][\\w$]*)\\})`,
  ).exec(attrs);

/**
 * The page as plain Markdown: a title and summary instead of frontmatter, no imports, and the docs components that
 * carry text (Code, Install, Callout) written as Markdown. Live parts and other components stay as tags.
 */
export function toMarkdown(page: PageSource, opts?: MarkdownOptions): string {
  const { body } = frontmatterOf(page.source);
  const vars: Record<string, string> = {};
  // The page's own imports go; an `import` inside a fenced code block is part of the code, and stays.
  let text = outsideFences(body, (part) =>
    part
      .replace(
        /^import\s+(\w+)\s+from\s+["']([^"']+)["'];?[ \t]*$/gm,
        (_, name: string, spec: string) => {
          const content = spec.endsWith("?raw") ? resolveImport(page.file, spec) : undefined;
          if (content !== undefined) vars[name] = content;
          return "";
        },
      )
      .replace(/^import\s+[^;]*?from\s+["'][^"']+["'];?[ \t]*$/gm, ""),
  );

  text = text.replace(/<Code\b([\s\S]*?)\/>/g, (whole, attrs: string) => {
    const c = attr(attrs, "code");
    const code = c ? (c[1] ?? c[2] ?? c[3] ?? (c[4] ? vars[c[4]] : undefined)) : undefined;
    if (code === undefined) return whole;
    const lang = attr(attrs, "lang")?.[1] ?? "tsx";
    const filename = attr(attrs, "filename")?.[1];
    return `${filename ? `\`${filename}\`\n\n` : ""}\`\`\`${lang}\n${code.replace(/\n$/, "")}\n\`\`\``;
  });
  text = text.replace(/<Install\b([\s\S]*?)\/>/g, (whole, attrs: string) => {
    const pkgs = attr(attrs, "packages")?.[1];
    return pkgs ? `\`\`\`sh\nnpm install ${pkgs}\n\`\`\`` : whole;
  });
  text = text.replace(
    /<Callout\b([^>]*)>([\s\S]*?)<\/Callout>/g,
    (_, attrs: string, inner: string) => {
      const type = attr(attrs, "type")?.[1] ?? "note";
      const title = attr(attrs, "title")?.[1];
      const label = `**${type.charAt(0).toUpperCase() + type.slice(1)}${title ? `: ${title}` : ""}.**`;
      return inner
        .trim()
        .split("\n")
        .map((l, i) => `> ${i === 0 ? `${label} ` : ""}${l.trim()}`)
        .join("\n");
    },
  );
  text = jsxToMarkdown(text, { ...opts, code: vars });
  return `# ${page.title}\n\n${page.summary}\n\n${text}\n`;
}

/** Apply `f` to the text between fenced code blocks, leaving the blocks as they are. */
function outsideFences(text: string, f: (part: string) => string): string {
  let out = "";
  let at = 0;
  for (const m of text.matchAll(/^([ \t]*)```[^\n]*\n[\s\S]*?^\1```[ \t]*$/gm)) {
    out += f(text.slice(at, m.index)) + m[0];
    at = m.index! + m[0].length;
  }
  return out + f(text.slice(at));
}

export const markdownUrl = (path: string) => (path === "/" ? "/index.md" : `${path}.md`);
