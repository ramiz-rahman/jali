/**
 * Every page's MDX source, read as text. The source gives each page's title and summary without loading its module
 * (nav, search, previous and next), and is what "Copy page" and "View as Markdown" hand to readers and agents.
 */
import { jsxToMarkdown, type MarkdownOptions } from "./jsx-markdown";
import { NAV, type NavSection } from "./nav";
import { pathOf } from "./pages";

// Draft pages (`_lab` and the like) are read in dev only, as in ./pages.
const rawModules = import.meta.env.DEV
  ? import.meta.glob<unknown>("../docs/**/*.mdx", { query: "?raw", import: "default", eager: true })
  : import.meta.glob<unknown>(["../docs/**/*.mdx", "!../docs/**/_*.mdx", "!../docs/**/_*/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });

/**
 * The text of a `?raw` import of an .mdx file. Today @mdx-js/rollup also compiles `?raw` ids (it drops the query
 * before its filter), and MDX reads `export default "…"` as the page's layout: the text survives as the layout of
 * the compiled component, and calling the component (no hooks run when a layout is set) returns an element of
 * that type. Once vite.config.ts skips `?raw` ids in the MDX plugin, the import is the string itself.
 */
function rawText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "function") {
    try {
      const el = (value as (p: object) => { type?: unknown } | null)({});
      if (el && typeof el.type === "string") return el.type;
    } catch {
      /* not a layout-wrapped module */
    }
  }
  return "";
}
const raw: Record<string, string> = Object.fromEntries(
  Object.entries(rawModules).map(([k, v]) => [k, rawText(v)]),
);
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
  /** The page's h2 and h3 headings, for search. */
  headings: string[];
  /** The MDX text, frontmatter and all. */
  source: string;
}

function frontmatterOf(source: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) return { data: {}, body: source };
  const data: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]!] = kv[2]!.trim().replace(/^(["'])(.*)\1$/, "$2");
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
    const { data, body } = frontmatterOf(source);
    const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((h) => h[1]!.trim());
    return [
      path,
      {
        path,
        file: file.replace(/^\.\.\/docs\//, ""),
        title: data.title ?? titleFromPath(path),
        summary: data.summary ?? "",
        headings,
        source,
      },
    ];
  }),
);

/** Pages a reader can find: written ones, not drafts like `_lab`. */
export const publicPages = () =>
  Object.values(sources).filter((p) => !p.file.split("/").some((s) => s.startsWith("_")));

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
  let text = body.replace(
    /^import\s+(\w+)\s+from\s+["']([^"']+)["'];?\s*$/gm,
    (_, name: string, spec: string) => {
      const content = spec.endsWith("?raw") ? resolveImport(page.file, spec) : undefined;
      if (content !== undefined) vars[name] = content;
      return "";
    },
  );
  text = text.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");

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
  text = jsxToMarkdown(text, opts);
  return `# ${page.title}\n\n${page.summary}\n\n${text}\n`;
}

export const markdownUrl = (path: string) => (path === "/" ? "/index.md" : `${path}.md`);
