/**
 * The site's navigation, in reading order (docs/DOCS-PLAN.md). Every path here must be a page under src/docs, or the
 * build fails; a page not listed here is reachable but not in the nav. Titles come from each page's frontmatter
 * unless given.
 */
import { pageAt } from "./sources";

interface NavSection {
  title: string;
  items: { path: string; title?: string }[];
}

const NAV: NavSection[] = [
  {
    title: "Get started",
    items: [
      { path: "/get-started/introduction" },
      { path: "/get-started/why-jali" },
      { path: "/get-started/installation" },
      { path: "/get-started/quickstart" },
      { path: "/get-started/key-concepts" },
      { path: "/get-started/coding-agents" },
    ],
  },
  {
    title: "Learn",
    items: [
      { path: "/learn/layout-tree" },
      { path: "/learn/fitting" },
      { path: "/learn/opening-and-linking" },
      { path: "/learn/following" },
      { path: "/learn/curated-pages" },
      { path: "/learn/accessibility" },
    ],
  },
  {
    title: "Guides",
    items: [
      { path: "/guides/pane-kinds" },
      { path: "/guides/layouts" },
      { path: "/guides/url-and-routers" },
      { path: "/guides/unsaved-work-and-pane-state" },
      { path: "/guides/commands-and-keys" },
      { path: "/guides/theming" },
      { path: "/guides/your-app" },
      { path: "/guides/testing" },
      { path: "/guides/troubleshooting" },
    ],
  },
  {
    title: "Reference",
    items: [
      { path: "/reference/core" },
      { path: "/reference/core/types", title: "jali types" },
      { path: "/reference/react" },
      { path: "/reference/features" },
      { path: "/reference/testing" },
      { path: "/reference/tokens" },
      { path: "/reference/parts" },
      { path: "/reference/commands" },
    ],
  },
  {
    title: "Examples",
    items: [
      { path: "/examples", title: "Overview" },
      { path: "/examples/data-studio" },
      { path: "/examples/loan-review" },
      { path: "/examples/markets" },
      { path: "/examples/studio" },
      { path: "/examples/trips" },
      { path: "/examples/handshake" },
    ],
  },
];

export interface NavItem {
  path: string;
  title: string;
  section: string;
}

/** The nav with every title filled in, resolved once. */
export const nav: { title: string; items: NavItem[] }[] = NAV.map((s) => ({
  title: s.title,
  items: s.items.map((i) => ({
    path: i.path,
    title: i.title ?? pageAt(i.path).title,
    section: s.title,
  })),
}));

/** The nav's pages in reading order. */
export const readingOrder: NavItem[] = nav.flatMap((s) => s.items);

const itemAt = (path: string) => readingOrder.find((i) => i.path === path);

export function neighbours(path: string): { prev?: NavItem; next?: NavItem } {
  const i = readingOrder.findIndex((p) => p.path === path);
  if (i < 0) return path === "/" ? { next: readingOrder[0] } : {};
  return { prev: readingOrder[i - 1], next: readingOrder[i + 1] };
}

/** The nav section a page is in ("Learn"), if it is in the nav. */
export const sectionOf = (path: string) => itemAt(path)?.section;

/**
 * A page's section as a breadcrumb: its name, and the address of its first page (the sections have no pages of their
 * own), so every item but the last has a URL, as search engines expect.
 */
export function sectionLink(path: string): { name: string; path: string } | undefined {
  const section = nav.find((s) => s.items.some((i) => i.path === path));
  const first = section?.items[0];
  return section && first ? { name: section.title, path: first.path } : undefined;
}

/** Pages in reading order, then the pages the nav doesn't list, by path: the order search lists them in. */
export function inReadingOrder<P extends { path: string }>(pages: P[]): P[] {
  const at = (p: P) => {
    const i = readingOrder.findIndex((r) => r.path === p.path);
    return i < 0 ? Infinity : i;
  };
  return [...pages].sort((a, b) => at(a) - at(b) || a.path.localeCompare(b.path));
}
