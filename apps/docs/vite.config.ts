import { defineConfig, defaultClientConditions } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeShiki from "@shikijs/rehype";

// Each dev server gets its own dependency cache (JALI_DOCS_CACHE), so several can run at once without breaking each other.
export default defineConfig({
  cacheDir: process.env.JALI_DOCS_CACHE ?? "node_modules/.vite",
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [remarkGfm, remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }]],
        rehypePlugins: [[rehypeShiki, { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, addLanguageClass: true }]],
      }),
    },
    react({ include: /\.(mdx|tsx|ts)$/ }),
  ],
  // @jali/* resolve to the packages' source, so the docs always show the code as it is.
  resolve: { conditions: ["source", ...defaultClientConditions] },
});
