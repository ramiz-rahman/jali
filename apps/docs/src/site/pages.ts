/**
 * Every page on the site: the MDX files under src/docs, keyed by their path. `docs/index.mdx` is "/",
 * `docs/learn/layout-tree.mdx` is "/learn/layout-tree". Each page's frontmatter has `title` and `summary`.
 */
import type { ComponentType } from "react";

export interface Frontmatter {
  title: string;
  /** One line under the title, and the page's description for search and agents. */
  summary: string;
}
export interface PageModule {
  default: ComponentType;
  frontmatter: Frontmatter;
}

const modules = import.meta.glob<PageModule>("../docs/**/*.mdx");

export const pathOf = (file: string) =>
  file
    .replace(/^\.\.\/docs/, "")
    .replace(/\.mdx$/, "")
    .replace(/\/index$/, "") || "/";

export const pages: Record<string, () => Promise<PageModule>> = Object.fromEntries(
  Object.entries(modules).map(([file, load]) => [pathOf(file), load]),
);
