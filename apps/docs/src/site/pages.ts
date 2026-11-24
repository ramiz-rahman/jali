/**
 * Every page on the site: the MDX files under src/docs, keyed by their path. `docs/index.mdx` is "/",
 * `docs/learn/layout-tree.mdx` is "/learn/layout-tree". Each page is here twice: compiled (what src/shell/render.tsx
 * renders) and as text (what ./sources.ts reads titles from and the Markdown copies are made of).
 *
 * Draft pages (a file or folder starting with "_", like `_lab`) exist in dev only: the built site never ships them.
 * Vite needs each glob's patterns written out, so the draft rule is spelled in both globs and in `isDraftFile`; keep
 * the three together, here.
 */
import type { ComponentType } from "react";

export interface PageModule {
  default: ComponentType;
}

const compiled = import.meta.env.DEV
  ? import.meta.glob<PageModule>("../docs/**/*.mdx")
  : import.meta.glob<PageModule>(["../docs/**/*.mdx", "!../docs/**/_*.mdx", "!../docs/**/_*/**"]);

// The MDX plugin skips `?raw` ids (astro.config.mjs), so each of these is the file's text.
const text: Record<string, string> = import.meta.env.DEV
  ? import.meta.glob<string>("../docs/**/*.mdx", { query: "?raw", import: "default", eager: true })
  : import.meta.glob<string>(["../docs/**/*.mdx", "!../docs/**/_*.mdx", "!../docs/**/_*/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });

/** A draft: a file or folder under src/docs starting with "_". */
export const isDraftFile = (file: string) => file.split("/").some((s) => s.startsWith("_"));

const pathOf = (file: string) =>
  file
    .replace(/^\.\.\/docs/, "")
    .replace(/\.mdx$/, "")
    .replace(/\/index$/, "") || "/";

const byPath = <T>(files: Record<string, T>) =>
  Object.fromEntries(Object.entries(files).map(([file, v]) => [pathOf(file), v]));

/** Each page's compiled module, loaded when it is rendered. */
export const pageModules: Record<string, () => Promise<PageModule>> = byPath(compiled);

/** Each page's file (relative to src/docs) and MDX text, frontmatter and all. */
export const pageTexts: Record<string, { file: string; text: string }> = byPath(
  Object.fromEntries(
    Object.entries(text).map(([file, t]) => [
      file,
      { file: file.replace(/^\.\.\/docs\//, ""), text: t },
    ]),
  ),
);
