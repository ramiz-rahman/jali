/**
 * Every page on the site: the MDX files under src/docs, keyed by their path. `docs/index.mdx` is "/",
 * `docs/learn/layout-tree.mdx` is "/learn/layout-tree". A page's title and summary come from its frontmatter, read
 * by ./sources.ts; the compiled module is only the content.
 */
import type { ComponentType } from "react";

export interface PageModule {
  default: ComponentType;
}

// Draft pages (a file or folder starting with "_", like `_lab`) exist in dev only: the built site never ships them.
const modules = import.meta.env.DEV
  ? import.meta.glob<PageModule>("../docs/**/*.mdx")
  : import.meta.glob<PageModule>(["../docs/**/*.mdx", "!../docs/**/_*.mdx", "!../docs/**/_*/**"]);

export const pathOf = (file: string) =>
  file
    .replace(/^\.\.\/docs/, "")
    .replace(/\.mdx$/, "")
    .replace(/\/index$/, "") || "/";

export const pages: Record<string, () => Promise<PageModule>> = Object.fromEntries(
  Object.entries(modules).map(([file, load]) => [pathOf(file), load]),
);
