/**
 * The site's navigation, in reading order (docs/DOCS-PLAN.md). A path here must have a page in src/pages; a page
 * not listed here is reachable but not in the nav. Titles come from each page's frontmatter unless given.
 */
export interface NavItem { path: string; title?: string }
export interface NavSection { title: string; items: NavItem[] }

export const NAV: NavSection[] = [
  { title: "Get started", items: [
    { path: "/get-started/introduction" },
    { path: "/get-started/quickstart" },
    { path: "/get-started/key-concepts" },
    { path: "/get-started/coding-agents" },
  ] },
  { title: "Learn", items: [
    { path: "/learn/layout-tree" },
    { path: "/learn/fitting" },
    { path: "/learn/opening-and-linking" },
    { path: "/learn/following" },
    { path: "/learn/curated-pages" },
  ] },
  { title: "Guides", items: [
    { path: "/guides/pane-kinds" },
    { path: "/guides/presets" },
    { path: "/guides/url-and-routers" },
    { path: "/guides/unsaved-work-and-pane-state" },
    { path: "/guides/commands-and-keys" },
    { path: "/guides/theming" },
    { path: "/guides/chakni" },
    { path: "/guides/testing" },
    { path: "/guides/two-workspaces" },
  ] },
  { title: "Reference", items: [
    { path: "/reference/core" },
    { path: "/reference/react" },
    { path: "/reference/tokens" },
    { path: "/reference/commands" },
  ] },
  { title: "Examples", items: [
    { path: "/examples" },
  ] },
];
