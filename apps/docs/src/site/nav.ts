/**
 * The site's navigation, in reading order (docs/DOCS-PLAN.md). A path here must have a page in src/pages; a page
 * not listed here is reachable but not in the nav. Titles come from each page's frontmatter unless given.
 */
export interface NavItem {
  path: string;
  title?: string;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
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
