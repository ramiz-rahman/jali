import { defineConfig } from "vite-plus";

// `vp pack` builds the published package, `jali`, from the workspace packages @jali/core and @jali/react (private):
// ESM, declarations and source maps, one entry per subpath. The code comes from their source (the "source"
// condition); the declarations from their dist/, so build them first (`pnpm build:packages` does, in order).
//
// - Two chunks hold the code: `core` (everything from packages/core) and `react` (everything from packages/react).
//   An app's bundler tree-shakes each, as it did @jali/core's and @jali/react's dist, and the size gate measures
//   each as before (tooling/size.mjs).
// - "use client" starts the `react` chunk and every entry that re-exports it, so a React Server Components host
//   (Next.js's App Router) loads them on the client. The framework-free entries (`jali`, `jali/url`,
//   `jali/testing`, `jali/adapter`) and the `core` chunk don't have it.
// - `layout` is a namespace (`export * as layout`). Bundled, it becomes an object of getters an app can't tree-shake,
//   so it is built as a file of its own and re-exported from it (`export * as layout from "./layout.js"`), which
//   bundlers tree-shake member by member. `dist/layout.js` is not an entry of the package.
// - React stays an import (an optional peer); nothing else is imported.
const ENTRIES = [
  "index",
  "react",
  "page",
  "testing",
  "adapter",
  "url",
  "palette",
  "settings",
  "chooser",
  "rename",
  "pop-out",
  "pressed",
  "features",
];
const FRAMEWORK_FREE = new Set(["index", "testing", "adapter", "url", "layout"]);
const fromReact = (id: string) => /[\\/]packages[\\/]react[\\/]src[\\/]/.test(id);

const layoutNamespace = {
  name: "jali:layout-namespace",
  resolveId(id: string, importer?: string) {
    if (
      id === "./layout" &&
      importer &&
      /[\\/]core[\\/]src[\\/](index|adapter)\.(d\.)?ts$/.test(importer)
    )
      return { id: "./layout.js", external: true };
  },
};

const useClient = {
  name: "jali:use-client",
  renderChunk(
    code: string,
    chunk: { name: string; fileName: string; isEntry: boolean; moduleIds: string[] },
  ) {
    if (chunk.fileName.endsWith(".d.ts")) return;
    const client = chunk.isEntry
      ? !FRAMEWORK_FREE.has(chunk.name)
      : chunk.moduleIds.some(fromReact);
    if (client) return { code: `"use client";\n${code}`, map: null };
  },
};

export default defineConfig({
  pack: {
    entry: {
      ...Object.fromEntries(ENTRIES.map((e) => [e, `src/${e}.ts`])),
      layout: "../core/src/layout/index.ts",
    },
    format: "esm",
    dts: true,
    // The packages' own source: an example that can't emit declarations never breaks the build.
    tsconfig: "../../tsconfig.build.json",
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    clean: true,
    inputOptions: { resolve: { conditionNames: ["source", "import", "default"] } },
    outputOptions: {
      codeSplitting: {
        groups: [
          // A group takes what its modules import too, so core's, which React imports, is matched first.
          { name: "core", priority: 2, test: /[\\/]packages[\\/]core[\\/]src[\\/]/ },
          { name: "react", priority: 1, test: fromReact },
        ],
      },
    },
    deps: {
      alwaysBundle: [/^@jali\//],
      neverBundle: [/^react/],
      dts: { alwaysBundle: [/^@jali\//] },
    },
    plugins: [layoutNamespace, useClient],
    onSuccess: "node scripts/build-css.mjs",
  },
});
