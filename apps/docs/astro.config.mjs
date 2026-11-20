// The docs site: Astro prerenders every page to static HTML (title, description, canonical, sitemap), then the
// React shell hydrates for navigation, search and the live workspaces.
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defaultClientConditions, defaultServerConditions } from "vite";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeShiki from "@shikijs/rehype";
import { SITE_URL } from "./src/site/site-url.mjs";

// The pages under src/docs are React MDX (rendered by the shell through MDXProvider), not Astro MDX, so they are
// compiled here with @mdx-js/rollup. It compiles any .mdx id, even `?raw` ones; those must stay plain text (the
// page's source, for "Copy page" and the Markdown copies).
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
        parseMetaString: (meta) => {
          const out = {};
          for (const [, k, v] of meta.matchAll(/(\w+)="([^"]*)"/g))
            if (k === "filename" || k === "highlight") out[`data-${k}`] = v;
          return out;
        },
      },
    ],
  ],
});
const transform = mdxPlugin.transform;
mdxPlugin.transform = function (code, id) {
  return id.includes("?raw") ? undefined : transform.call(this, code, id);
};

// @jali/* resolve to the packages' source, so the docs always show the code as it is. Astro builds in several Vite
// environments (client, prerender, ssr), and each needs the "source" condition.
const sourceCondition = {
  name: "jali-source-condition",
  configEnvironment(name, config) {
    const defaults = name === "client" ? defaultClientConditions : defaultServerConditions;
    const conditions = config.resolve?.conditions ?? defaults;
    return { resolve: { conditions: ["source", ...conditions.filter((c) => c !== "source")] } };
  },
};

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [react(), sitemap({ filter: (page) => !/\/_[^/]*$/.test(new URL(page).pathname) })],
  vite: {
    // Each dev server gets its own dependency cache (JALI_DOCS_CACHE), so several can run at once.
    cacheDir: process.env.JALI_DOCS_CACHE ?? "node_modules/.vite",
    // A server takes the port it was given or stops: never the next one, where a test or a reader would miss it.
    // (`astro dev` and `astro preview` take no --strictPort flag.)
    server: { strictPort: true },
    preview: { strictPort: true },
    plugins: [{ enforce: "pre", ...mdxPlugin }, sourceCondition],
  },
});
