import { defineConfig, defaultClientConditions, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeShiki from "@shikijs/rehype";

// The MDX plugin compiles any .mdx id, even `?raw` ones; those must stay plain text (the page's source, for
// "Copy page" and the Markdown copies).
const mdxPlugin = mdx({
  providerImportSource: "@mdx-js/react",
  remarkPlugins: [remarkGfm, remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
  rehypePlugins: [
    [
      rehypeShiki,
      {
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        addLanguageClass: true,
        // ```tsx filename="src/kinds.tsx" highlight="3-5" → data-filename and data-highlight on the <pre>.
        parseMetaString: (meta: string) => {
          const out: Record<string, string> = {};
          for (const [, k, v] of meta.matchAll(/(\w+)="([^"]*)"/g))
            if (k === "filename" || k === "highlight") out[`data-${k}`] = v!;
          return out;
        },
      },
    ],
  ],
});
const transform = mdxPlugin.transform as (this: unknown, code: string, id: string) => unknown;
mdxPlugin.transform = function (this: unknown, code: string, id: string) {
  return id.includes("?raw") ? undefined : transform.call(this, code, id);
} as typeof mdxPlugin.transform;

export default defineConfig({
  // Each dev server gets its own dependency cache (JALI_DOCS_CACHE), so several can run at once.
  cacheDir: process.env.JALI_DOCS_CACHE ?? "node_modules/.vite",
  plugins: lazyPlugins(() => [
    { enforce: "pre", ...mdxPlugin },
    react({ include: /\.(mdx|tsx|ts)$/ }),
  ]),
  // @jali/* resolve to the packages' source, so the docs always show the code as it is.
  resolve: { conditions: ["source", ...defaultClientConditions] },
});
